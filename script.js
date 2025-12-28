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
        el.style.backgroundColor = "";
    } else {
        categoriasSeleccionadas.push(cat);
        el.style.backgroundColor = "#442222";
    }
}

// --- CONEXIONES ---
function crearSala() {
    const salaId = document.getElementById('custom-id').value.trim().toLowerCase();
    miNombre = document.getElementById('player-name').value.trim() || "Anfitrión";
    peer = new Peer(salaId);

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
            // Los invitados pueden pedir reset (opcional, pero el host manda)
        });
    });
}

function conectarAHost() {
    const salaId = document.getElementById('join-id').value.trim().toLowerCase();
    miNombre = document.getElementById('player-name').value.trim() || "Invitado";
    peer = new Peer(); 

    peer.on('open', () => {
        conn = peer.connect(salaId); 
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
    let r = segundos;
    const interval = setInterval(() => {
        const m = Math.floor(r / 60);
        const s = r % 60;
        timerDisplay.innerText = `${m}:${s.toString().padStart(2, '0')}`;
        if (r <= 0) { 
            clearInterval(interval); 
            timerDisplay.innerText = "¡A VOTAR!";
            abrirVotacion(); 
        }
        r--;
    }, 1000);
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
    } else {
        txt.innerText = "¡VICTORIA DEL IMPOSTOR!";
        txt.style.color = "#ff4757";
    }
    document.getElementById('impostor-was').innerText = `El impostor era ${data.impostor}. El pueblo acusó a ${data.acusado}.`;

    // SOLO EL HOST VE EL BOTÓN DE NUEVA PARTIDA
    const btnNueva = resDiv.querySelector('button');
    if (esHost) {
        btnNueva.style.display = "block";
        btnNueva.innerText = "Siguiente Ronda";
        btnNueva.onclick = reiniciarPartidaHost;
    } else {
        btnNueva.style.display = "none";
    }
}

// Función que ejecuta el Host para empezar de nuevo
function reiniciarPartidaHost() {
    limpiarInterfaz();
    // Avisar a todos los invitados que limpien su pantalla
    conexiones.forEach(c => c.send({ tipo: 'RESET_TABLERO' }));
}

// Función común para limpiar la UI sin recargar página
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

// Lógica para los botones de tiempo
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('time-btn')) {
        // Deseleccionar todos
        document.querySelectorAll('.time-btn').forEach(btn => btn.classList.remove('selected'));
        // Seleccionar el actual
        e.target.classList.add('selected');
        // Actualizar el valor oculto
        document.getElementById('game-time').value = e.target.dataset.value;
    }
});

// Modifica la función toggleCategory para que sea más limpia visualmente
function toggleCategory(cat, el) {
    if (categoriasSeleccionadas.includes(cat)) {
        categoriasSeleccionadas = categoriasSeleccionadas.filter(c => c !== cat);
        el.classList.remove('selected');
    } else {
        categoriasSeleccionadas.push(cat);
        el.classList.add('selected');
    }
}