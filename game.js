// game.js
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    backgroundColor: '#FFFFFF', // Fondo Blanco
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 600 }, 
            debug: true 
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);
let socket;
let self; // Referencia al jugador local
let otherPlayers = {}; // Objeto para guardar los sprites de los otros jugadores
let keyA, keyD, keyW;
let platforms;

function preload ()
{
    // Función vacía ya que no cargamos assets
}

function create ()
{
    // Necesitamos una referencia al objeto de la escena (this) para usarlo en las funciones de ayuda
    const scene = this;

    socket = io();
    // Configuración de controles A (izquierda), D (derecha), W (salto)
    keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);

    // 1. CONFIGURACIÓN INICIAL (Plataforma Negra)
    platforms = this.physics.add.staticGroup();
    // Dibuja un rectángulo negro para la plataforma (0x000000)
    const platformGraphics = this.add.graphics();
    platformGraphics.fillStyle(0x000000, 1); // Negro
    platformGraphics.fillRect(0, 0, 800, 32); 

    // Crea la textura y el sprite estático para la plataforma
    platformGraphics.generateTexture('platformTexture', 800, 32);
    platforms.create(400, 584, 'platformTexture').refreshBody(); 
    platformGraphics.destroy(); // Destruye el objeto gráfico para limpiar la memoria

    // Lógica de Red y Multijugador
    socket.on('currentPlayers', function (players) {
        Object.keys(players).forEach(function (id) {
            if (players[id].playerId === socket.id) {
                // LLAMADA CORREGIDA: Pasamos 'scene' como contexto
                self = addPlayer(scene, players[id]); 
            } else {
                // LLAMADA CORREGIDA: Pasamos 'scene' como contexto
                addOtherPlayer(scene, otherPlayers, players[id]);
            }
        });
    });

    socket.on('disconnect', function (playerId) {
        if (otherPlayers[playerId]) {
            otherPlayers[playerId].destroy(); 
            delete otherPlayers[playerId];
        }
    });

    socket.on('newPlayer', function (playerInfo) {
        addOtherPlayer(scene, otherPlayers, playerInfo);
    });

    socket.on('playerMoved', function (playerInfo) {
        if (otherPlayers[playerInfo.playerId]) {
            // Se usa setPosition para que el sprite se mueva directamente
            otherPlayers[playerInfo.playerId].setPosition(playerInfo.x, playerInfo.y);
        }
    });
}

function update ()
{
    if (self) // Asegúrate de que nuestro jugador (el cuadrado ROJO) haya sido creado
    {
        // 1. Manejo del Input Local
        if (keyA.isDown) {
            self.setVelocityX(-160);
        } else if (keyD.isDown) {
            self.setVelocityX(160);
        } else {
            self.setVelocityX(0);
        }

        // Saltos
        if (keyW.isDown && self.body.touching.down) {
            self.setVelocityY(-400); 
        }
        
        // 2. ENVIAR LA POSICIÓN AL SERVIDOR
        const x = self.x;
        const y = self.y;
        
        // Verifica si la posición ha cambiado lo suficiente
        if (self.oldPosition && (Math.abs(x - self.oldPosition.x) > 1 || Math.abs(y - self.oldPosition.y) > 1)) {
             socket.emit('playerMovement', { x: x, y: y });
        }
        
        // Guarda la posición actual para el siguiente frame
        self.oldPosition = { x: x, y: y };
    }
}

// --- FUNCIONES DE AYUDA PARA CREAR SPRITES ---

// Crea el sprite del jugador local (ROJO)
// Se le pasa 'scene' para usar sus métodos de gráficos y física
function addPlayer(scene, playerInfo) {
    // Dibuja un rectángulo ROJO para nuestro jugador
    const playerGraphics = scene.add.graphics();
    playerGraphics.fillStyle(0xFF0000, 1); // Rojo
    playerGraphics.fillRect(0, 0, 32, 32); // 32x32

    playerGraphics.generateTexture('localPlayerTexture', 32, 32);

    const playerSprite = scene.physics.add.sprite(playerInfo.x, playerInfo.y, 'localPlayerTexture');
    playerSprite.setBounce(0.2);
    playerSprite.setCollideWorldBounds(true);
    scene.physics.add.collider(playerSprite, platforms); // Colisión con la plataforma
    
    playerGraphics.destroy(); // Limpieza
    return playerSprite; // Retorna el sprite creado para asignarlo a 'self'
}

// Crea el sprite de otro jugador (AZUL)
function addOtherPlayer(scene, otherPlayersRef, playerInfo) {
    // Dibuja un rectángulo AZUL para otros jugadores
    const otherGraphics = scene.add.graphics();
    otherGraphics.fillStyle(0x0000FF, 1); // Azul
    otherGraphics.fillRect(0, 0, 32, 32);

    otherGraphics.generateTexture('otherPlayerTexture', 32, 32);
    
    const otherPlayer = scene.physics.add.sprite(playerInfo.x, playerInfo.y, 'otherPlayerTexture');
    otherPlayer.setBounce(0.2);
    scene.physics.add.collider(otherPlayer, platforms); // Colisión con la plataforma
    
    otherGraphics.destroy(); // Limpieza
    
    // Lo guardamos en el objeto 'otherPlayers' usando su ID para referencia futura
    otherPlayersRef[playerInfo.playerId] = otherPlayer; 
}