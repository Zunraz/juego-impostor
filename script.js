let peer;
let conn; 
let conexiones = []; 
let esHost = false;
let miNombre = "";
let DICCIONARIO = {};
let categoriasSeleccionadas = [];
let partidaIniciada = false;
let miRolActual = "";
let nombreImpostor = "";
let votosRecibidos = 0;
let conteoVotos = {};
let listaNombresGlobal = [];

// --- CONFIGURACIÓN PARA CONEXIÓN GLOBAL (STUN SERVERS) ---
const peerConfig = {
    config: {
        'iceServers': [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
        ]
    }
};

const setupDiv = document.getElementById('setup');
const gameArea = document.getElementById('game-area');
const playerListDisplay = document.getElementById('player-list');
const statusDisplay = document.getElementById('status');
const roleDisplay = document.getElementById('role-display');
const timerDisplay = document.getElementById('timer-display');
const votingArea = document.getElementById('voting-area');

// --- CARGA DE DATOS ---
async function cargarBaseDeDatos() {
    try {
        const respuesta = await fetch('palabras.json');
        DICCIONARIO = await respuesta.json();
        document.getElementById('db-status').innerText = "✅ Base de datos lista";
        document.getElementById('btn-crear').disabled = false;
        document.getElementById('btn-unirse').disabled = false;
        
        const grid = document.getElementById('category-grid');
        grid.innerHTML = Object.keys(DICCIONARIO).map(cat => `
            <div class="cat-card" onclick="toggleCategory('${cat}', this)">${cat.toUpperCase()}</div>
        `).join('');
    } catch (e) { console.error("Error al cargar JSON:", e); }
}
cargarBaseDeDatos();

function toggleCategory(cat, el) {
    if (categoriasSeleccionadas.includes(cat)) {
        categoriasSeleccionadas = categoriasSeleccionadas.filter(c => c !== cat);
        el.classList.remove('selected');
        el.style.backgroundColor = "";
    } else {
        categoriasSeleccionadas.push(cat);
        el.classList.add('selected');
        el.style.backgroundColor = "#442222";
    }
}

// --- CONEXIONES ---
function crearSala() {
    const salaId = document.getElementById('custom-id').value.trim().toLowerCase();
    miNombre = document.getElementById('player-name').value.trim() || "Anfitrión";
    
    // Se añade peerConfig para permitir conexiones externas
    peer = new Peer(salaId, peerConfig);

    peer.on('open', (id) => {
        esHost = true;
        configurarPantallaJuego(id);
        document.getElementById('host-controls').style.display = 'block';
        enviarListaATodos(); 
    });

    peer.on('connection', (c) => {
        c.on('data', (data) => {
            if (data.tipo === 'UNIRSE') {
                c.nombreJugador = data.nombre;
                conexiones.push(c);
                enviarListaATodos();
            }
            if (data.tipo === 'VOTO_EMITIDO' && esHost) {
                registrarVoto(data.votoA);
            }
        });
    });

    peer.on('error', (err) => {
        alert("Error de conexión: " + err.type);
        console.error(err);
    });
}

function conectarAHost() {
    const salaId = document.getElementById('join-id').value.trim().toLowerCase();
    miNombre = document.getElementById('player-name').value.trim() || "Invitado";
    
    // Se añade peerConfig aquí también
    peer = new Peer(undefined, peerConfig); 

    peer.on('open', () => {
        conn = peer.connect(salaId, { reliable: true }); 
        conn.on('open', () => {
            conn.send({ tipo: 'UNIRSE', nombre: miNombre });
            configurarPantallaJuego(salaId);
        });

        conn.on('data', (data) => {
            if (data.tipo === 'LISTA') {
                listaNombresGlobal = data.jugadores;
                actualizarLista(data.jugadores);
            }
            if (data.tipo === 'INICIAR_PARTIDA') {
                miRolActual = data.rol;
                mostrarRol(data.rol, data.palabra);
                iniciarCronometro(data.tiempo);
                document.getElementById('game-results').style.display = 'none';
            }
            if (data.tipo === 'RESULTADO_FINAL') mostrarResultado(data);
            if (data.tipo === 'RESET_TABLERO') limpiarInterfaz();
        });
    });

    peer.on('error', (err) => {
        alert("No se pudo conectar a la sala: " + err.type);
    });
}

// --- JUEGO ---
function iniciarJuego() {
    if (!esHost) return;
    if (categoriasSeleccionadas.length === 0) return alert("Selecciona categorías");

    partidaIniciada = true;
    votosRecibidos = 0;
    conteoVotos = {};
    document.getElementById('btn-repartir').disabled = true;

    let pool = [];
    categoriasSeleccionadas.forEach(cat => pool = pool.concat(DICCIONARIO[cat]));
    const palabra = pool[Math.floor(Math.random() * pool.length)];
    
    const todos = [{n: miNombre}, ...conexiones.map(c => ({n: c.nombreJugador}))];
    const indiceImpostor = Math.floor(Math.random() * todos.length);
    const tiempo = parseInt(document.getElementById('game-time').value);

    nombreImpostor = todos[indiceImpostor].n;

    miRolActual = (indiceImpostor === 0) ? "IMPOSTOR" : palabra;
    mostrarRol(miRolActual, palabra);
    iniciarCronometro(tiempo);

    conexiones.forEach((c, i) => {
        c.send({ 
            tipo: 'INICIAR_PARTIDA', 
            rol: (i + 1 === indiceImpostor) ? "IMPOSTOR" : palabra, 
            palabra: palabra, 
            tiempo: tiempo 
        });
    });
}

function iniciarCronometro(segundos) {
    timerDisplay.style.display = 'block';
    votingArea.style.display = 'none';
    const tiempoFinal = Date.now() + (segundos * 1000);

    const interval = setInterval(() => {
        const ahora = Date.now();
        const restanteMs = tiempoFinal - ahora;
        const restanteSegs = Math.ceil(restanteMs / 1000);

        if (restanteSegs <= 0) { 
            clearInterval(interval); 
            timerDisplay.innerText = "¡TIEMPO AGOTADO!";
            abrirVotacion(); 
        } else {
            const m = Math.floor(restanteSegs / 60);
            const s = restanteSegs % 60;
            timerDisplay.innerText = `${m}:${s.toString().padStart(2, '0')}`;
        }
    }, 100);
}

function abrirVotacion() {
    votingArea.style.display = 'block';
    const botonesDiv = document.getElementById('voting-buttons');
    botonesDiv.innerHTML = listaNombresGlobal
        .filter(j => j.nombre !== miNombre)
        .map(j => `<button onclick="votar('${j.nombre}')" style="padding:15px; margin:5px; cursor:pointer; background:white; color:black; border-radius:8px; font-weight:bold;">${j.nombre}</button>`)
        .join('');
}

function votar(nombre) {
    document.getElementById('voting-buttons').innerHTML = `<h3>Votaste a: ${nombre}</h3><p>Esperando al resto...</p>`;
    if (esHost) registrarVoto(nombre);
    else if (conn && conn.open) conn.send({ tipo: 'VOTO_EMITIDO', votoA: nombre });
}

function registrarVoto(nombreAlQueVotan) {
    votosRecibidos++;
    conteoVotos[nombreAlQueVotan] = (conteoVotos[nombreAlQueVotan] || 0) + 1;

    if (votosRecibidos === conexiones.length + 1) {
        let masVotado = Object.keys(conteoVotos).reduce((a, b) => conteoVotos[a] > conteoVotos[b] ? a : b);
        let ganoInocente = (masVotado === nombreImpostor);
        
        const dataFinal = {
            tipo: 'RESULTADO_FINAL',
            ganador: ganoInocente ? "INOCENTES" : "IMPOSTOR",
            impostor: nombreImpostor,
            acusado: masVotado
        };
        
        mostrarResultado(dataFinal);
        conexiones.forEach(c => c.send(dataFinal));
    }
}

function mostrarResultado(data) {
    votingArea.style.display = 'none';
    const resDiv = document.getElementById('game-results');
    resDiv.style.display = 'block';
    const txt = document.getElementById('winner-text');
    
    if (data.ganador === "INOCENTES") {
        txt.innerText = "¡VICTORIA DE LOS INOCENTES!";
        txt.style.color = "#2ed573";
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#2ed573', '#ffffff', '#7bed9f']
        });
    } else {
        txt.innerText = "¡VICTORIA DEL IMPOSTOR!";
        txt.style.color = "#ff4757";
    }
    document.getElementById('impostor-was').innerText = `El impostor era ${data.impostor}. Se acusó a ${data.acusado}.`;

    const btnNueva = resDiv.querySelector('button');
    if (esHost) {
        btnNueva.style.display = "block";
        btnNueva.innerText = "Siguiente Ronda";
        btnNueva.onclick = reiniciarPartidaHost;
    } else {
        btnNueva.style.display = "none";
    }
}

function reiniciarPartidaHost() {
    limpiarInterfaz();
    conexiones.forEach(c => c.send({ tipo: 'RESET_TABLERO' }));
}

function limpiarInterfaz() {
    document.getElementById('game-results').style.display = 'none';
    votingArea.style.display = 'none';
    timerDisplay.style.display = 'none';
    roleDisplay.innerHTML = "Esperando nueva ronda...";
    partidaIniciada = false;
    if (esHost) {
        document.getElementById('btn-repartir').disabled = false;
    }
}

function configurarPantallaJuego(id) {
    if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').catch(() => {});
    }
    setupDiv.style.display = 'none';
    gameArea.style.display = 'block';
    document.getElementById('room-id').innerText = id;
    document.getElementById('display-mi-nombre').innerText = miNombre;
}

function actualizarLista(lista) {
    playerListDisplay.innerHTML = lista.map(j => `<li>👤 ${j.nombre}</li>`).join('');
}

function enviarListaATodos() {
    listaNombresGlobal = [{nombre: miNombre}, ...conexiones.map(c => ({nombre: c.nombreJugador}))];
    actualizarLista(listaNombresGlobal);
    conexiones.forEach(c => c.send({ tipo: 'LISTA', jugadores: listaNombresGlobal }));
}

function mostrarRol(rol, palabra) {
    roleDisplay.style.display = 'block';
    if (rol === "IMPOSTOR") {
        roleDisplay.innerHTML = `<span style="color:#ff4757; font-weight:bold; font-size:1.5rem;">ERES EL IMPOSTOR</span><br>¡Miente para ganar!`;
    } else {
        roleDisplay.innerHTML = `ERES INOCENTE<br>Palabra: <span style="color:#2ed573; font-weight:bold; font-size:1.5rem;">${palabra}</span>`;
    }
}

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('time-btn')) {
        document.querySelectorAll('.time-btn').forEach(btn => btn.classList.remove('selected'));
        e.target.classList.add('selected');
        document.getElementById('game-time').value = e.target.dataset.value;
    }
});
