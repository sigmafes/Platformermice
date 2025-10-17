// server.js
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Usa el puerto que Render asigne, o 3000 como fallback local
const PORT = process.env.PORT || 3000; 

// *** ÚNICO CAMBIO CLAVE: ELIMINADA LA FUNCIÓN app.get('/') ***
// Esta línea ahora se encarga de TODO:
// 1. Sirve index.html cuando se accede a la ruta raíz (/).
// 2. Sirve todos los demás archivos estáticos (game.js, phaser.min.js, etc.) 
//    con el tipo MIME correcto.
app.use(express.static(__dirname));

// NOTA: La función app.get('/') ha sido eliminada.

// Objeto para guardar el estado de todos los jugadores
const players = {}; 

io.on('connection', (socket) => {
    console.log('Un usuario se ha conectado. ID:', socket.id);

    // Crea un nuevo jugador y añádelo al objeto 'players'
    players[socket.id] = {
        x: Math.floor(Math.random() * 700) + 50, 
        y: 400,
        playerId: socket.id
    };

    // 1. Enviar el estado actual de los jugadores al nuevo jugador
    socket.emit('currentPlayers', players);

    // 2. Transmitir (broadcast) el nuevo jugador a todos los demás jugadores
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // 3. Lógica del Chat
    socket.on('sendMessage', (message) => {
        io.emit('chatMessage', { playerId: socket.id, message: message });
        console.log(`[CHAT] ${socket.id}: ${message}`);
    });

    // 4. Maneja el movimiento del jugador
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            
            // Transmite la posición actualizada del jugador a todos los demás
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // 5. Maneja la desconexión del jugador
    socket.on('disconnect', () => {
        console.log('Un usuario se ha desconectado. ID:', socket.id);
        
        // Elimina al jugador del objeto 'players'
        delete players[socket.id];
        
        // Emite un mensaje a todos los demás para que eliminen al jugador
        io.emit('disconnect', socket.id);
    });
});

http.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
});