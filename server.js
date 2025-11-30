const express = require('express');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    const publicPath = path.join(__dirname, 'public', 'index.html');
    const rootPath = path.join(__dirname, 'index.html');
    
    if (fs.existsSync(publicPath)) {
        res.sendFile(publicPath);
    } else if (fs.existsSync(rootPath)) {
        res.sendFile(rootPath);
    } else {
        res.status(404).send('index.html not found');
    }
});

// Store rooms for both games
const buzzerRooms = new Map();
const guessingRooms = new Map();

// Helper functions for Buzzer Game
function broadcastToBuzzerRoom(roomCode, message, excludeWs = null) {
    const room = buzzerRooms.get(roomCode);
    if (!room) return;

    room.clients.forEach(client => {
        if (client.ws !== excludeWs && client.ws.readyState === 1) {
            client.ws.send(JSON.stringify(message));
        }
    });
}

function sendBuzzerPlayerList(roomCode) {
    const room = buzzerRooms.get(roomCode);
    if (!room) return;

    const players = Array.from(room.players.values()).map(p => ({
        name: p.name,
        buzzed: p.buzzed,
        buzzTime: p.buzzTime
    }));

    broadcastToBuzzerRoom(roomCode, {
        type: 'playerList',
        players: players
    });

    room.clients.forEach(client => {
        if (client.ws.readyState === 1) {
            client.ws.send(JSON.stringify({
                type: 'playerList',
                players: players
            }));
        }
    });
}

// Helper functions for Guessing Game
function broadcastToGuessingRoom(roomCode, message, excludeWs = null) {
    const room = guessingRooms.get(roomCode);
    if (!room) return;

    room.clients.forEach(client => {
        if (client.ws !== excludeWs && client.ws.readyState === 1) {
            client.ws.send(JSON.stringify(message));
        }
    });
}

function sendGuessingPlayerList(roomCode) {
    const room = guessingRooms.get(roomCode);
    if (!room) return;

    const players = Array.from(room.players.values()).map(p => ({
        name: p.name,
        ready: p.ready,
        answered: p.answered,
        isHost: p.isHost
    }));

    broadcastToGuessingRoom(roomCode, {
        type: 'guessing_playerList',
        players: players
    });

    room.clients.forEach(client => {
        if (client.ws.readyState === 1) {
            client.ws.send(JSON.stringify({
                type: 'guessing_playerList',
                players: players
            }));
        }
    });
}

function checkAllReady(roomCode) {
    const room = guessingRooms.get(roomCode);
    if (!room || !room.timeSet) return false;

    const allReady = Array.from(room.players.values()).every(p => p.ready);
    
    if (allReady && room.players.size > 0) {
        startGuessingGame(roomCode);
    }
}

function checkAllAnswered(roomCode) {
    const room = guessingRooms.get(roomCode);
    if (!room || !room.gameActive) return;

    const allAnswered = Array.from(room.players.values()).every(p => p.answered);
    
    if (allAnswered) {
        endGuessingGame(roomCode);
    }
}

function startGuessingGame(roomCode) {
    const room = guessingRooms.get(roomCode);
    if (!room) return;

    room.gameActive = true;
    
    broadcastToGuessingRoom(roomCode, {
        type: 'guessing_gameStart',
        duration: room.roundTime
    });

    room.clients.forEach(client => {
        if (client.ws.readyState === 1) {
            client.ws.send(JSON.stringify({
                type: 'guessing_gameStart',
                duration: room.roundTime
            }));
        }
    });

    // Auto-end game after time runs out
    room.gameTimeout = setTimeout(() => {
        endGuessingGame(roomCode);
    }, room.roundTime * 1000);
}

function endGuessingGame(roomCode) {
    const room = guessingRooms.get(roomCode);
    if (!room) return;

    if (room.gameTimeout) {
        clearTimeout(room.gameTimeout);
        room.gameTimeout = null;
    }

    room.gameActive = false;
    
    // Reset ready and answered states
    room.players.forEach(p => {
        p.ready = false;
        p.answered = false;
    });

    broadcastToGuessingRoom(roomCode, {
        type: 'guessing_gameEnd'
    });

    room.clients.forEach(client => {
        if (client.ws.readyState === 1) {
            client.ws.send(JSON.stringify({
                type: 'guessing_gameEnd'
            }));
        }
    });

    sendGuessingPlayerList(roomCode);
}

wss.on('connection', (ws) => {
    console.log('New client connected');
    let currentBuzzerRoom = null;
    let currentGuessingRoom = null;
    let currentPlayer = null;

    ws.on('message', (data) => {
        try {
            console.log('Raw data received:', data.toString());
            const message = JSON.parse(data);
            console.log('Parsed message:', JSON.stringify(message, null, 2));
            console.log('Message type:', message.type);
            
            // BUZZER GAME HANDLERS
            if (message.type === 'join') {
                console.log('Processing BUZZER join');
                const roomCode = message.room.toUpperCase();
                const playerName = message.playerName;

                if (!buzzerRooms.has(roomCode)) {
                    buzzerRooms.set(roomCode, {
                        code: roomCode,
                        players: new Map(),
                        clients: new Set(),
                        buzzedPlayers: []
                    });
                }

                const room = buzzerRooms.get(roomCode);
                room.players.set(playerName, {
                    name: playerName,
                    buzzed: false,
                    buzzTime: null
                });

                room.clients.add({ ws, playerName });
                currentBuzzerRoom = roomCode;
                currentPlayer = playerName;

                ws.send(JSON.stringify({
                    type: 'joined',
                    room: roomCode,
                    playerName: playerName
                }));

                sendBuzzerPlayerList(roomCode);
                console.log(`${playerName} joined buzzer room ${roomCode}`);
            }
            
            else if (message.type === 'buzz') {
                if (!currentBuzzerRoom || !currentPlayer) return;

                const room = buzzerRooms.get(currentBuzzerRoom);
                if (!room) return;

                const player = room.players.get(currentPlayer);
                if (!player || player.buzzed) return;

                player.buzzed = true;
                player.buzzTime = Date.now();
                room.buzzedPlayers.push({
                    name: currentPlayer,
                    time: player.buzzTime
                });

                broadcastToBuzzerRoom(currentBuzzerRoom, {
                    type: 'buzz',
                    playerName: currentPlayer,
                    time: player.buzzTime
                });

                ws.send(JSON.stringify({
                    type: 'buzz',
                    playerName: currentPlayer,
                    time: player.buzzTime
                }));

                if (room.buzzedPlayers.length === 1) {
                    broadcastToBuzzerRoom(currentBuzzerRoom, {
                        type: 'winner',
                        winner: currentPlayer
                    });

                    ws.send(JSON.stringify({
                        type: 'winner',
                        winner: currentPlayer
                    }));
                }

                sendBuzzerPlayerList(currentBuzzerRoom);
                console.log(`${currentPlayer} buzzed in room ${currentBuzzerRoom}`);
            }
            
            else if (message.type === 'reset') {
                if (!currentBuzzerRoom) return;

                const room = buzzerRooms.get(currentBuzzerRoom);
                if (!room) return;

                room.players.forEach(p => {
                    p.buzzed = false;
                    p.buzzTime = null;
                });
                room.buzzedPlayers = [];

                broadcastToBuzzerRoom(currentBuzzerRoom, {
                    type: 'reset'
                });

                ws.send(JSON.stringify({
                    type: 'reset'
                }));

                sendBuzzerPlayerList(currentBuzzerRoom);
                console.log(`Buzzer room ${currentBuzzerRoom} reset`);
            }
            
            else if (message.type === 'leave') {
                if (!currentBuzzerRoom || !currentPlayer) return;

                const room = buzzerRooms.get(currentBuzzerRoom);
                if (!room) return;

                room.players.delete(currentPlayer);
                room.clients.forEach(client => {
                    if (client.playerName === currentPlayer) {
                        room.clients.delete(client);
                    }
                });

                if (room.players.size === 0) {
                    buzzerRooms.delete(currentBuzzerRoom);
                    console.log(`Buzzer room ${currentBuzzerRoom} deleted (empty)`);
                } else {
                    sendBuzzerPlayerList(currentBuzzerRoom);
                }

                console.log(`${currentPlayer} left buzzer room ${currentBuzzerRoom}`);
                currentBuzzerRoom = null;
                currentPlayer = null;
            }

            // GUESSING GAME HANDLERS
            else if (message.type === 'guessing_join') {
                console.log('Processing GUESSING join');
                const roomCode = message.room.toUpperCase();
                const playerName = message.playerName;
                console.log(`Room: ${roomCode}, Player: ${playerName}`);

                let isHost = false;
                if (!guessingRooms.has(roomCode)) {
                    isHost = true;
                    console.log('Creating new guessing room, player is host');
                    guessingRooms.set(roomCode, {
                        code: roomCode,
                        players: new Map(),
                        clients: new Set(),
                        roundTime: null,
                        timeSet: false,
                        gameActive: false,
                        gameTimeout: null
                    });
                } else {
                    console.log('Joining existing guessing room');
                }

                const room = guessingRooms.get(roomCode);
                room.players.set(playerName, {
                    name: playerName,
                    ready: false,
                    answered: false,
                    isHost: isHost
                });

                room.clients.add({ ws, playerName });
                currentGuessingRoom = roomCode;
                currentPlayer = playerName;

                const response = {
                    type: 'guessing_joined',
                    room: roomCode,
                    playerName: playerName,
                    isHost: isHost
                };
                console.log('Sending response:', response);

                ws.send(JSON.stringify(response));

                sendGuessingPlayerList(roomCode);
                console.log(`${playerName} joined guessing room ${roomCode} (host: ${isHost})`);
            }
            
            else if (message.type === 'guessing_setTime') {
                if (!currentGuessingRoom) return;

                const room = guessingRooms.get(currentGuessingRoom);
                if (!room) return;

                room.roundTime = message.time;
                room.timeSet = true;

                broadcastToGuessingRoom(currentGuessingRoom, {
                    type: 'guessing_timeSet',
                    time: message.time
                });

                ws.send(JSON.stringify({
                    type: 'guessing_timeSet',
                    time: message.time
                }));

                console.log(`Guessing room ${currentGuessingRoom} time set to ${message.time}s`);
            }
            
            else if (message.type === 'guessing_ready') {
                if (!currentGuessingRoom || !currentPlayer) return;

                const room = guessingRooms.get(currentGuessingRoom);
                if (!room) return;

                const player = room.players.get(currentPlayer);
                if (!player) return;

                player.ready = true;
                sendGuessingPlayerList(currentGuessingRoom);
                checkAllReady(currentGuessingRoom);
                
                console.log(`${currentPlayer} is ready in guessing room ${currentGuessingRoom}`);
            }
            
            else if (message.type === 'guessing_answer') {
                if (!currentGuessingRoom || !currentPlayer) return;

                const room = guessingRooms.get(currentGuessingRoom);
                if (!room || !room.gameActive) return;

                const player = room.players.get(currentPlayer);
                if (!player) return;

                player.answered = true;
                player.answer = message.answer;
                
                sendGuessingPlayerList(currentGuessingRoom);
                checkAllAnswered(currentGuessingRoom);
                
                console.log(`${currentPlayer} answered in guessing room ${currentGuessingRoom}`);
            }
            
            else if (message.type === 'guessing_leave') {
                if (!currentGuessingRoom || !currentPlayer) return;

                const room = guessingRooms.get(currentGuessingRoom);
                if (!room) return;

                room.players.delete(currentPlayer);
                room.clients.forEach(client => {
                    if (client.playerName === currentPlayer) {
                        room.clients.delete(client);
                    }
                });

                if (room.players.size === 0) {
                    if (room.gameTimeout) {
                        clearTimeout(room.gameTimeout);
                    }
                    guessingRooms.delete(currentGuessingRoom);
                    console.log(`Guessing room ${currentGuessingRoom} deleted (empty)`);
                } else {
                    sendGuessingPlayerList(currentGuessingRoom);
                }

                console.log(`${currentPlayer} left guessing room ${currentGuessingRoom}`);
                currentGuessingRoom = null;
                currentPlayer = null;
            }
            else {
                console.warn('Unknown message type:', message.type);
                console.log('Full message:', message);
            }
            
        } catch (error) {
            console.error('Error handling message:', error);
            console.error('Raw data that caused error:', data.toString());
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        
        // Clean up buzzer room
        if (currentBuzzerRoom && currentPlayer) {
            const room = buzzerRooms.get(currentBuzzerRoom);
            if (room) {
                room.players.delete(currentPlayer);
                room.clients.forEach(client => {
                    if (client.playerName === currentPlayer) {
                        room.clients.delete(client);
                    }
                });

                if (room.players.size === 0) {
                    buzzerRooms.delete(currentBuzzerRoom);
                    console.log(`Buzzer room ${currentBuzzerRoom} deleted (empty)`);
                } else {
                    sendBuzzerPlayerList(currentBuzzerRoom);
                }
            }
        }

        // Clean up guessing room
        if (currentGuessingRoom && currentPlayer) {
            const room = guessingRooms.get(currentGuessingRoom);
            if (room) {
                room.players.delete(currentPlayer);
                room.clients.forEach(client => {
                    if (client.playerName === currentPlayer) {
                        room.clients.delete(client);
                    }
                });

                if (room.players.size === 0) {
                    if (room.gameTimeout) {
                        clearTimeout(room.gameTimeout);
                    }
                    guessingRooms.delete(currentGuessingRoom);
                    console.log(`Guessing room ${currentGuessingRoom} deleted (empty)`);
                } else {
                    sendGuessingPlayerList(currentGuessingRoom);
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`Server running on port ${PORT}`);
    console.log(`Version: 2.0 - Multi-Game Support`);
    console.log(`Updated: ${new Date().toISOString()}`);
    console.log(`Buzzer Game: /buzzer.html`);
    console.log(`Guessing Game: /schaetzen.html`);
    console.log(`Guessing handlers: ENABLED`);
    console.log(`========================================`);
});
