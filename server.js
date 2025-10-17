// server.js
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

// Objeto global para mantener el estado de todos los jugadores
const players = {}; 

// Sirve archivos estáticos
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Lógica de Conexión y Juego Online
io.on('connection', (socket) => {
    console.log('Un usuario se ha conectado:', socket.id);

    // 1. Añade el nuevo jugador al objeto 'players' con una posición inicial
    players[socket.id] = {
        x: Math.floor(Math.random() * 700) + 50, // Posición X aleatoria
        y: 400, // Posición Y inicial (un poco alto para caer a la plataforma)
        playerId: socket.id
    };

    // 2. Envía la lista de jugadores actual al jugador que se acaba de conectar
    socket.emit('currentPlayers', players);
    
    // 3. Notifica a los otros jugadores sobre el nuevo jugador
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // 4. Escucha las actualizaciones de movimiento del cliente
    socket.on('playerMovement', (movementData) => {
        // Actualiza la posición del jugador en el servidor
        players[socket.id].x = movementData.x;
        players[socket.id].y = movementData.y;
        
        // Emite la posición actualizada de este jugador a todos los demás clientes
        socket.broadcast.emit('playerMoved', players[socket.id]);
    });

    // 5. Manejo de la Desconexión
    socket.on('disconnect', () => {
        console.log('Usuario desconectado:', socket.id);
        // Elimina al jugador del objeto 'players'
        delete players[socket.id];
        // Notifica a los otros jugadores que un jugador se ha ido
        io.emit('disconnect', socket.id);
    });
});

http.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
});