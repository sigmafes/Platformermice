// server.js
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Usa el puerto que Render asigne, o 3000 como fallback local
const PORT = process.env.PORT || 3000; 

// *** CAMBIO CLAVE PARA LA OPCIÓN B: ***
// Sirve archivos estáticos (game.js, socket.io.js) desde la raíz del proyecto.
app.use(express.static(__dirname));

// Ruta principal: Envía index.html desde la raíz del proyecto.
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

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