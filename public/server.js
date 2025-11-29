const express = require('express');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Explicit route for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Store rooms and their players
const rooms = new Map();

// Helper function to broadcast to all clients in a room
function broadcastToRoom(roomCode, message, excludeWs = null) {
    const room = rooms.get(roomCode);
    if (!room) return;

    room.clients.forEach(client => {
        if (client.ws !== excludeWs && client.ws.readyState === 1) {
            client.ws.send(JSON.stringify(message));
        }
    });
}

// Helper function to send player list to all in room
function sendPlayerList(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;

    const players = Array.from(room.players.values()).map(p => ({
        name: p.name,
        buzzed: p.buzzed,
        buzzTime: p.buzzTime
    }));

    broadcastToRoom(roomCode, {
        type: 'playerList',
        players: players
    });

    // Also send to the room itself
    room.clients.forEach(client => {
        if (client.ws.readyState === 1) {
            client.ws.send(JSON.stringify({
                type: 'playerList',
                players: players
            }));
        }
    });
}

wss.on('connection', (ws) => {
    console.log('New client connected');
    let currentRoom = null;
    let currentPlayer = null;

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            
            switch(message.type) {
                case 'join':
                    const roomCode = message.room.toUpperCase();
                    const playerName = message.playerName;

                    // Create room if it doesn't exist
                    if (!rooms.has(roomCode)) {
                        rooms.set(roomCode, {
                            code: roomCode,
                            players: new Map(),
                            clients: new Set(),
                            buzzedPlayers: []
                        });
                    }

                    const room = rooms.get(roomCode);
                    
                    // Add player to room
                    room.players.set(playerName, {
                        name: playerName,
                        buzzed: false,
                        buzzTime: null
                    });

                    room.clients.add({ ws, playerName });
                    
                    currentRoom = roomCode;
                    currentPlayer = playerName;

                    // Send confirmation to player
                    ws.send(JSON.stringify({
                        type: 'joined',
                        room: roomCode,
                        playerName: playerName
                    }));

                    // Update all players in room
                    sendPlayerList(roomCode);

                    console.log(`${playerName} joined room ${roomCode}`);
                    break;

                case 'buzz':
                    if (!currentRoom || !currentPlayer) break;

                    const buzzRoom = rooms.get(currentRoom);
                    if (!buzzRoom) break;

                    const player = buzzRoom.players.get(currentPlayer);
                    if (!player || player.buzzed) break;

                    // Mark player as buzzed
                    player.buzzed = true;
                    player.buzzTime = Date.now();
                    buzzRoom.buzzedPlayers.push({
                        name: currentPlayer,
                        time: player.buzzTime
                    });

                    // Notify all players about the buzz
                    broadcastToRoom(currentRoom, {
                        type: 'buzz',
                        playerName: currentPlayer,
                        time: player.buzzTime
                    });

                    ws.send(JSON.stringify({
                        type: 'buzz',
                        playerName: currentPlayer,
                        time: player.buzzTime
                    }));

                    // Check if this is the first buzz (winner)
                    if (buzzRoom.buzzedPlayers.length === 1) {
                        broadcastToRoom(currentRoom, {
                            type: 'winner',
                            winner: currentPlayer
                        });

                        ws.send(JSON.stringify({
                            type: 'winner',
                            winner: currentPlayer
                        }));
                    }

                    sendPlayerList(currentRoom);

                    console.log(`${currentPlayer} buzzed in room ${currentRoom}`);
                    break;

                case 'reset':
                    if (!currentRoom) break;

                    const resetRoom = rooms.get(currentRoom);
                    if (!resetRoom) break;

                    // Reset all players
                    resetRoom.players.forEach(p => {
                        p.buzzed = false;
                        p.buzzTime = null;
                    });
                    resetRoom.buzzedPlayers = [];

                    // Notify all players
                    broadcastToRoom(currentRoom, {
                        type: 'reset'
                    });

                    ws.send(JSON.stringify({
                        type: 'reset'
                    }));

                    sendPlayerList(currentRoom);

                    console.log(`Room ${currentRoom} reset`);
                    break;

                case 'leave':
                    if (!currentRoom || !currentPlayer) break;

                    const leaveRoom = rooms.get(currentRoom);
                    if (!leaveRoom) break;

                    // Remove player
                    leaveRoom.players.delete(currentPlayer);
                    leaveRoom.clients.forEach(client => {
                        if (client.playerName === currentPlayer) {
                            leaveRoom.clients.delete(client);
                        }
                    });

                    // Delete room if empty
                    if (leaveRoom.players.size === 0) {
                        rooms.delete(currentRoom);
                        console.log(`Room ${currentRoom} deleted (empty)`);
                    } else {
                        sendPlayerList(currentRoom);
                    }

                    console.log(`${currentPlayer} left room ${currentRoom}`);
                    
                    currentRoom = null;
                    currentPlayer = null;
                    break;
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        
        // Clean up player from room
        if (currentRoom && currentPlayer) {
            const room = rooms.get(currentRoom);
            if (room) {
                room.players.delete(currentPlayer);
                room.clients.forEach(client => {
                    if (client.playerName === currentPlayer) {
                        room.clients.delete(client);
                    }
                });

                if (room.players.size === 0) {
                    rooms.delete(currentRoom);
                    console.log(`Room ${currentRoom} deleted (empty)`);
                } else {
                    sendPlayerList(currentRoom);
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
