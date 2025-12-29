# 🕵️ Impostor P2P - Real-Time Multiplayer Game

¡Bienvenido a **Impostor P2P**! Un juego de mesa social de deducción y mentiras, inspirado en clásicos como "The Spyfall", pero diseñado para funcionar completamente en el navegador sin necesidad de un servidor centralizado, utilizando tecnología Peer-to-Peer.

🚀 **[VER DEMO EN VIVO](TU_LINK_DE_GITHUB_PAGES_AQUI)**

## 🌟 Características principales
- **Conectividad Global:** Gracias a la integración de servidores STUN, jugadores de cualquier parte del mundo pueden unirse a la misma sala a través de Internet.
- **Arquitectura P2P:** El juego corre directamente entre los navegadores de los usuarios mediante la librería **PeerJS (WebRTC)**, eliminando la necesidad de un backend costoso.
- **Base de Datos Masiva:** Incluye miles de palabras distribuidas en categorías (Comida, Animales, Países, Objetos) cargadas dinámicamente desde un archivo JSON.
- **Sincronización Robusta:** Sistema de cronómetro basado en tiempo real (`Date.now()`) para evitar desincronizaciones si un dispositivo móvil entra en modo reposo.
- **Experiencia de Usuario (UX):** Interfaz moderna y responsive con efectos visuales como confeti (canvas-confetti) y bloqueador de apagado de pantalla (Wake Lock API).

## 🛠️ Tecnologías utilizadas
- **JavaScript (ES6+):** Lógica del juego, manejo de estados y comunicación asíncrona.
- **PeerJS / WebRTC:** Protocolo para la comunicación directa entre jugadores.
- **HTML5 & CSS3:** Estructura y diseño moderno con CSS Grid y Flexbox.
- **Canvas-confetti:** Para feedback visual en las victorias.

## 🕹️ Cómo jugar
1. **Host:** Escribe tu nombre, elige un ID único para tu sala y dale a "Crear Sala".
2. **Invitados:** Escriben su nombre y el ID de la sala del Host en el campo "Unirse".
3. **Configuración:** El Host elige las categorías y el tiempo de discusión.
4. **Roles:** El sistema reparte los roles automáticamente. ¡Todos verán la palabra menos el Impostor!
5. **Deducción:** Al terminar el tiempo, todos votan por quién creen que es el impostor.

## 🧠 Desafíos Técnicos Superados
- **NAT Traversal:** Implementación de servidores ICE (STUN) para permitir conexiones a través de firewalls y diferentes redes domésticas.
- **Mobile Sleep Fix:** Solución al problema de congelamiento de JavaScript en móviles mediante cálculos de delta de tiempo real, asegurando que todos los jugadores terminen la ronda al mismo segundo exacto.
- **State Management:** Sincronización de votos y resultados entre múltiples nodos P2P garantizando la integridad de la partida.

## 📂 Estructura del Proyecto
- `index.html`: Estructura principal y contenedores dinámicos.
- `style.css`: Estilo visual, animaciones y diseño responsive.
- `script.js`: El cerebro del juego (Lógica P2P y flujo de partida).
- `palabras.json`: Diccionario extendido de términos.

---
Desarrollado con ❤️ por [Tu Nombre/Usuario de GitHub]
