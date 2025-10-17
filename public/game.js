// game.js - FINAL VERSION con Chat, Stacking y Render URL
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    backgroundColor: '#FFFFFF',
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
let self; 
let otherPlayers = {}; 
let keyA, keyD, keyW, keyEnter; 
let platforms;

// Variables para el Chat
let isChatting = false;
let chatInput; // El elemento de input de HTML
let messages = {}; // { playerId: [{ message: Phaser.Text, timer: Phaser.Timer }, ...] }
const MESSAGE_DURATION = 5000; // 5 segundos
const STACK_HEIGHT = 20; // Espacio entre mensajes apilados

function preload ()
{
    // Función vacía ya que no cargamos assets
}

function create ()
{
    const scene = this;

    // CONEXIÓN AL SERVIDOR GLOBAL DE RENDER
    const RENDER_URL = 'https://platformermice.onrender.com/'; 
    socket = io(RENDER_URL); 

    // Configuración de controles
    keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    keyEnter = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER); // Tecla Enter

    // Manejo de la tecla Enter para abrir/cerrar/enviar chat
    keyEnter.on('down', toggleChat.bind(this, scene));

    // Crear Input de HTML para el Chat (se añade al DOM fuera del canvas)
    chatInput = document.createElement('input');
    chatInput.type = 'text';
    chatInput.id = 'chat-input';
    // Estilo para posicionarlo en la parte inferior y ocultarlo
    chatInput.style.position = 'absolute';
    chatInput.style.bottom = '10px';
    chatInput.style.left = '50%';
    chatInput.style.transform = 'translateX(-50%)';
    chatInput.style.width = '300px';
    chatInput.style.padding = '5px';
    chatInput.style.border = '1px solid black';
    chatInput.style.display = 'none'; // Inicialmente oculto
    document.body.appendChild(chatInput);


    // 1. CONFIGURACIÓN INICIAL (Plataforma Negra)
    platforms = this.physics.add.staticGroup();
    const platformGraphics = this.add.graphics();
    platformGraphics.fillStyle(0x000000, 1); 
    platformGraphics.fillRect(0, 0, 800, 32); 
    platformGraphics.generateTexture('platformTexture', 800, 32);
    platforms.create(400, 584, 'platformTexture').refreshBody(); 
    platformGraphics.destroy(); 

    // Lógica de Red y Multijugador
    socket.on('currentPlayers', function (players) {
        Object.keys(players).forEach(function (id) {
            if (players[id].playerId === socket.id) {
                self = addPlayer(scene, players[id]); 
            } else {
                addOtherPlayer(scene, otherPlayers, players[id]);
            }
        });
    });

    // Función de Desconexión: Desaparece el cubo del jugador
    socket.on('disconnect', function (playerId) {
        if (otherPlayers[playerId]) {
            otherPlayers[playerId].destroy(); 
            delete otherPlayers[playerId];
        }
        // Limpiar mensajes del jugador desconectado
        clearPlayerMessages(playerId, scene);
    });

    socket.on('newPlayer', function (playerInfo) {
        addOtherPlayer(scene, otherPlayers, playerInfo);
    });

    socket.on('playerMoved', function (playerInfo) {
        if (otherPlayers[playerInfo.playerId]) {
            otherPlayers[playerInfo.playerId].setPosition(playerInfo.x, playerInfo.y);
            // Mover los mensajes con el jugador
            updateMessagePosition(playerInfo.playerId);
        }
    });
    
    // Nuevo evento para recibir mensajes de chat
    socket.on('chatMessage', function(data) {
        handleNewMessage(data.playerId, data.message, scene);
    });
}

function update ()
{
    if (self) 
    {
        // ------------------------------------------
        // Lógica de movimiento (DESHABILITADA si está chateando)
        if (!isChatting) {
            // Manejo del Input Local (solo si NO está chateando)
            if (keyA.isDown) {
                self.setVelocityX(-160);
            } else if (keyD.isDown) {
                self.setVelocityX(160);
            } else {
                self.setVelocityX(0);
            }

            if (keyW.isDown && self.body.touching.down) {
                self.setVelocityY(-400); 
            }
        } else {
            // Detener el movimiento mientras se chatea
            self.setVelocityX(0);
        }
        // ------------------------------------------
        
        // 2. ENVIAR LA POSICIÓN AL SERVIDOR
        const x = self.x;
        const y = self.y;
        
        if (self.oldPosition && (Math.abs(x - self.oldPosition.x) > 1 || Math.abs(y - self.oldPosition.y) > 1)) {
             socket.emit('playerMovement', { x: x, y: y });
        }
        
        self.oldPosition = { x: x, y: y };
        
        // 3. ACTUALIZAR POSICIÓN DE LOS MENSAJES PROPIOS
        updateMessagePosition(socket.id);
    }
}

// ------------------------------------------------------------------
// --- LÓGICA DEL CHAT ---
// ------------------------------------------------------------------

function toggleChat(scene) {
    if (isChatting) {
        // Modo: Enviar Mensaje y Cerrar Chat
        const message = chatInput.value.trim();
        if (message.length > 0) {
            handleNewMessage(socket.id, message, scene); // Mostrar localmente
            socket.emit('sendMessage', message); // Enviar al servidor
        }

        // Limpiar y ocultar el input
        chatInput.value = '';
        chatInput.style.display = 'none';
        chatInput.blur(); 
        isChatting = false;

    } else {
        // Modo: Abrir Chat
        chatInput.style.display = 'block';
        chatInput.focus(); // Poner el foco en el input para escribir
        isChatting = true;
    }
}

function handleNewMessage(playerId, messageText, scene) {
    let playerSprite = playerId === socket.id ? self : otherPlayers[playerId];
    if (!playerSprite) return; 

    // Limpiar mensajes caducados y obtener mensajes existentes
    if (!messages[playerId]) {
        messages[playerId] = [];
    }
    
    // Si ya tiene 3 mensajes (o un límite), elimino el más viejo para evitar stacks infinitos
    if (messages[playerId].length >= 3) {
        const oldestMessage = messages[playerId].shift(); // Saco el primero (más viejo y bajo)
        oldestMessage.message.destroy();
        oldestMessage.timer.remove();
        restackMessages(playerId); // Reajusto la pila
    }

    // 1. Calcular la posición Y del nuevo mensaje (stacking)
    const baseOffsetY = playerSprite.height / 2 + 5; 
    const newY = playerSprite.y - baseOffsetY - (messages[playerId].length * STACK_HEIGHT);
    
    // 2. Crear el objeto de texto de Phaser
    const message = scene.add.text(playerSprite.x, newY, messageText, {
        fontFamily: 'Arial',
        fontSize: 14,
        color: '#000000', 
        backgroundColor: '#ADD8E6', // Fondo azul claro para visibilidad
        padding: { x: 5, y: 3 }
    }).setOrigin(0.5, 0.5); // Centrar en el eje X

    // 3. Establecer el temporizador para su destrucción (5 segundos)
    const timer = scene.time.delayedCall(MESSAGE_DURATION, () => {
        message.destroy();
        
        // Eliminarlo del array de mensajes
        const index = messages[playerId].findIndex(item => item.message === message);
        if (index > -1) {
            messages[playerId].splice(index, 1);
        }
        
        // Re-stacking: Mover los mensajes restantes hacia abajo
        restackMessages(playerId);
        
    }, [], scene);

    // 4. Almacenar el mensaje y su temporizador
    messages[playerId].push({ message: message, timer: timer });
}

function clearPlayerMessages(playerId, scene) {
    // Se llama cuando el jugador se desconecta
    if (messages[playerId]) {
        messages[playerId].forEach(item => {
            item.message.destroy();
            item.timer.remove(); // Asegura que el temporizador se detenga
        });
        delete messages[playerId];
    }
}

function updateMessagePosition(playerId) {
    // Mueve los mensajes con el jugador
    if (!messages[playerId]) return;

    let playerSprite = playerId === socket.id ? self : otherPlayers[playerId];
    if (!playerSprite) return;

    const baseOffsetY = playerSprite.height / 2 + 5; 

    messages[playerId].forEach((item, index) => {
        const targetY = playerSprite.y - baseOffsetY - (index * STACK_HEIGHT);
        item.message.setPosition(playerSprite.x, targetY);
    });
}

function restackMessages(playerId) {
    // Mueve los mensajes restantes hacia abajo al desaparecer uno
    if (!messages[playerId]) return;
    
    let playerSprite = playerId === socket.id ? self : otherPlayers[playerId];
    if (!playerSprite) return;

    const baseOffsetY = playerSprite.height / 2 + 5;
    
    messages[playerId].forEach((item, index) => {
        const targetY = playerSprite.y - baseOffsetY - (index * STACK_HEIGHT);
        // Pequeña animación para suavizar la caída
        game.scene.scenes[0].tweens.add({
            targets: item.message,
            y: targetY,
            duration: 150, 
            ease: 'Power1'
        });
    });
}


// --- FUNCIONES DE AYUDA PARA CREAR SPRITES ---

function addPlayer(scene, playerInfo) {
    const playerGraphics = scene.add.graphics();
    playerGraphics.fillStyle(0xFF0000, 1); 
    playerGraphics.fillRect(0, 0, 32, 32); 

    playerGraphics.generateTexture('localPlayerTexture', 32, 32);

    const playerSprite = scene.physics.add.sprite(playerInfo.x, playerInfo.y, 'localPlayerTexture');
    playerSprite.setBounce(0.2);
    playerSprite.setCollideWorldBounds(true);
    scene.physics.add.collider(playerSprite, platforms); 
    
    playerGraphics.destroy(); 
    return playerSprite; 
}

function addOtherPlayer(scene, otherPlayersRef, playerInfo) {
    const otherGraphics = scene.add.graphics();
    otherGraphics.fillStyle(0x0000FF, 1); 
    otherGraphics.fillRect(0, 0, 32, 32);

    otherGraphics.generateTexture('otherPlayerTexture', 32, 32);
    
    const otherPlayer = scene.physics.add.sprite(playerInfo.x, playerInfo.y, 'otherPlayerTexture');
    otherPlayer.setBounce(0.2);
    scene.physics.add.collider(otherPlayer, platforms); 
    
    otherGraphics.destroy(); 
    otherPlayersRef[playerInfo.playerId] = otherPlayer; 
}