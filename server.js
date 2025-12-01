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

// Store rooms for all games
const buzzerRooms = new Map();
const guessingRooms = new Map();
const geoRooms = new Map();

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
    if (!room || !room.timeSet) {
        console.log(`checkAllReady: Room not found or time not set for ${roomCode}`);
        return false;
    }

    // Prevent multiple countdowns
    if (room.countdownActive || room.gameActive) {
        console.log(`checkAllReady: Countdown already active (${room.countdownActive}) or game active (${room.gameActive})`);
        return false;
    }

    const allReady = Array.from(room.players.values()).every(p => p.ready);
    const readyCount = Array.from(room.players.values()).filter(p => p.ready).length;
    
    console.log(`checkAllReady: ${readyCount}/${room.players.size} players ready`);
    
    if (allReady && room.players.size > 0) {
        room.countdownActive = true;

        console.log(`All players ready in ${roomCode}, triggering countdown`);

        // Send countdown message
        broadcastToGuessingRoom(roomCode, {
            type: 'guessing_countdown'
        });

        room.clients.forEach(client => {
            if (client.ws.readyState === 1) {
                client.ws.send(JSON.stringify({
                    type: 'guessing_countdown'
                }));
            }
        });

        console.log(`Countdown sent, will start game in 5 seconds`);

        // Start game after 5 second countdown
        setTimeout(() => {
            console.log(`5 seconds passed, starting game for ${roomCode}`);
            room.countdownActive = false;
            startGuessingGame(roomCode);
        }, 5000);
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
    
    // Collect all answers
    const results = Array.from(room.players.values()).map(p => ({
        name: p.name,
        answer: p.answer || '',
        isHost: p.isHost
    }));

    // Send results to all players
    broadcastToGuessingRoom(roomCode, {
        type: 'guessing_gameEnd',
        results: results
    });

    room.clients.forEach(client => {
        if (client.ws.readyState === 1) {
            client.ws.send(JSON.stringify({
                type: 'guessing_gameEnd',
                results: results
            }));
        }
    });

    console.log(`Game ended in ${roomCode}, showing results`);

    // DON'T reset states here - let nextRound handle it
    sendGuessingPlayerList(roomCode);
}

// Helper functions for Geo Game
function broadcastToGeoRoom(roomCode, message, excludeWs = null) {
    const room = geoRooms.get(roomCode);
    if (!room) return;

    room.clients.forEach(client => {
        if (client.ws !== excludeWs && client.ws.readyState === 1) {
            client.ws.send(JSON.stringify(message));
        }
    });
}

function sendGeoPlayerList(roomCode) {
    const room = geoRooms.get(roomCode);
    if (!room) return;

    // Get list of connected player names
    const connectedPlayers = new Set();
    room.clients.forEach(client => {
        connectedPlayers.add(client.playerName);
    });

    const players = Array.from(room.players.values()).map(p => ({
        name: p.name,
        isModerator: p.isModerator,
        hasPlaced: p.hasPlaced,
        isConnected: connectedPlayers.has(p.name)
    }));

    broadcastToGeoRoom(roomCode, {
        type: 'geo_playerList',
        players: players
    });
}

function sendGeoScores(roomCode) {
    const room = geoRooms.get(roomCode);
    if (!room) return;

    broadcastToGeoRoom(roomCode, {
        type: 'geo_updateScores',
        scores: room.scores
    });
}

function startGeoRound(roomCode) {
    const room = geoRooms.get(roomCode);
    if (!room) return;

    room.currentRound++;
    room.roundActive = true;
    room.moderatorPhase = true; // Start with moderator phase
    room.moderatorPoint = null;

    // Reset player states
    room.players.forEach(p => {
        p.hasPlaced = false;
        p.point = null;
    });

    // Tell everyone round started (moderator phase)
    broadcastToGeoRoom(roomCode, {
        type: 'geo_roundStart',
        roundNumber: room.currentRound,
        duration: room.roundTime,
        moderatorPhase: true
    });

    sendGeoPlayerList(roomCode);

    console.log(`Geo round ${room.currentRound} started in ${roomCode} (moderator phase)`);

    // No timeout in moderator phase - wait for moderator to confirm
}

function checkAllPlacedGeo(roomCode) {
    const room = geoRooms.get(roomCode);
    if (!room || !room.roundActive || room.moderatorPhase) return;

    // Check if all NON-MODERATOR players have placed
    const nonModPlayers = Array.from(room.players.values()).filter(p => !p.isModerator);
    const allPlaced = nonModPlayers.every(p => p.hasPlaced);

    if (allPlaced && nonModPlayers.length > 0) {
        clearTimeout(room.roundTimeout);
        endGeoRound(roomCode);
    }
}

function endGeoRound(roomCode) {
    const room = geoRooms.get(roomCode);
    if (!room) return;

    room.roundActive = false;

    // Calculate distances and award points
    const results = [];

    room.players.forEach(player => {
        if (!player.isModerator && player.point && room.moderatorPoint) {
            const distance = calculateDistance(
                player.point.lat, player.point.lng,
                room.moderatorPoint.lat, room.moderatorPoint.lng
            );

            let points = 0;
            if (distance < 100) points = 3;
            else if (distance < 500) points = 2;
            else if (distance < 1000) points = 1;

            room.scores[player.name] = (room.scores[player.name] || 0) + points;

            results.push({
                name: player.name,
                isModerator: false,
                distance: Math.round(distance),
                points: points,
                point: player.point
            });
        } else if (player.isModerator) {
            results.push({
                name: player.name,
                isModerator: true,
                distance: 0,
                points: 0,
                point: player.point
            });
        }
    });

    // Sort by distance
    results.sort((a, b) => a.distance - b.distance);

    broadcastToGeoRoom(roomCode, {
        type: 'geo_roundEnd',
        results: results,
        moderatorPoint: room.moderatorPoint
    });

    sendGeoScores(roomCode);

    console.log(`Geo round ended in ${roomCode}`);
}

// Haversine formula to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

wss.on('connection', (ws) => {
    console.log('New client connected');
    let currentBuzzerRoom = null;
    let currentGuessingRoom = null;
    let currentGeoRoom = null;
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
                        gameTimeout: null,
                        countdownActive: false
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

                // If time is already set, inform the new player
                if (room.timeSet && room.roundTime) {
                    console.log(`Informing ${playerName} that time is already set to ${room.roundTime}s`);
                    ws.send(JSON.stringify({
                        type: 'guessing_timeSet',
                        time: room.roundTime
                    }));
                }

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
            
            else if (message.type === 'guessing_nextRound') {
                if (!currentGuessingRoom) return;

                const room = guessingRooms.get(currentGuessingRoom);
                if (!room) return;

                console.log(`Next round requested in ${currentGuessingRoom}`);

                // Reset all flags and player states for next round
                room.countdownActive = false;
                room.gameActive = false;
                
                room.players.forEach(p => {
                    p.ready = false;
                    p.answered = false;
                    p.answer = '';
                });

                // Notify all players to go back to game screen
                broadcastToGuessingRoom(currentGuessingRoom, {
                    type: 'guessing_nextRound'
                });

                room.clients.forEach(client => {
                    if (client.ws.readyState === 1) {
                        client.ws.send(JSON.stringify({
                            type: 'guessing_nextRound'
                        }));
                    }
                });

                // Send updated player list (all not ready)
                sendGuessingPlayerList(currentGuessingRoom);

                console.log(`Next round started in ${currentGuessingRoom}, all states reset`);
            }

            // GEO GAME HANDLERS
            else if (message.type === 'geo_join') {
                const roomCode = message.room.toUpperCase();
                const playerName = message.playerName;

                let isModerator = false;
                let room = geoRooms.get(roomCode);
                
                if (!room) {
                    // New room - first player is moderator
                    isModerator = true;
                    room = {
                        code: roomCode,
                        moderator: playerName,
                        players: new Map(),
                        clients: new Set(),
                        roundTime: 30,
                        currentRound: 0,
                        gameStarted: false,
                        roundActive: false,
                        scores: {},
                        moderatorPoint: null,
                        playerPoints: new Map()
                    };
                    geoRooms.set(roomCode, room);
                } else {
                    // Rejoining existing room
                    isModerator = (room.moderator === playerName);
                }

                // Check if player existed before (reconnecting)
                let existingPlayer = room.players.get(playerName);
                
                if (existingPlayer) {
                    // Player is reconnecting - restore their data
                    console.log(`${playerName} is reconnecting to geo room ${roomCode}`);
                    existingPlayer.isModerator = isModerator;
                    // Keep hasPlaced and point if round is active
                } else {
                    // New player
                    room.players.set(playerName, {
                        name: playerName,
                        isModerator: isModerator,
                        hasPlaced: false,
                        point: null
                    });
                }

                // Add/update client connection
                room.clients.add({ ws, playerName });
                
                // Ensure score exists (restore if rejoining)
                if (!room.scores[playerName]) {
                    room.scores[playerName] = 0;
                }
                
                currentGeoRoom = roomCode;
                currentPlayer = playerName;

                ws.send(JSON.stringify({
                    type: 'geo_joined',
                    room: roomCode,
                    playerName: playerName,
                    isModerator: isModerator,
                    score: room.scores[playerName], // Send current score
                    roundNumber: room.currentRound,
                    gameStarted: room.gameStarted
                }));

                sendGeoPlayerList(roomCode);
                sendGeoScores(roomCode);

                console.log(`${playerName} joined geo room ${roomCode} (moderator: ${isModerator}, score: ${room.scores[playerName]})`);
            }

            else if (message.type === 'geo_startGame') {
                if (!currentGeoRoom) return;

                const room = geoRooms.get(currentGeoRoom);
                if (!room || room.moderator !== currentPlayer) return;

                room.roundTime = message.roundTime || 30;
                room.gameStarted = true;
                room.currentRound = 0;

                broadcastToGeoRoom(currentGeoRoom, {
                    type: 'geo_gameStart',
                    roundTime: room.roundTime
                });

                // Start first round
                setTimeout(() => {
                    startGeoRound(currentGeoRoom);
                }, 2000);

                console.log(`Geo game started in ${currentGeoRoom}`);
            }

            else if (message.type === 'geo_confirmMarker') {
                if (!currentGeoRoom || !currentPlayer) return;

                const room = geoRooms.get(currentGeoRoom);
                if (!room || !room.roundActive) return;

                const player = room.players.get(currentPlayer);
                if (!player) return;

                player.hasPlaced = true;
                player.point = { lat: message.lat, lng: message.lng };

                if (player.isModerator) {
                    // Moderator confirmed - start player phase immediately
                    room.moderatorPoint = player.point;
                    room.moderatorPhase = false;

                    console.log(`Moderator confirmed point, starting player phase immediately in ${currentGeoRoom}`);

                    // Start player phase immediately (no countdown)
                    broadcastToGeoRoom(currentGeoRoom, {
                        type: 'geo_playerPhaseStart',
                        roundNumber: room.currentRound,
                        duration: room.roundTime
                    });

                    // Start timer for players
                    room.roundTimeout = setTimeout(() => {
                        endGeoRound(currentGeoRoom);
                    }, room.roundTime * 1000);

                } else {
                    // Regular player confirmed
                    broadcastToGeoRoom(currentGeoRoom, {
                        type: 'geo_playerPlaced',
                        playerName: currentPlayer
                    }, ws);

                    sendGeoPlayerList(currentGeoRoom);

                    // Check if all placed
                    checkAllPlacedGeo(currentGeoRoom);
                }

                console.log(`${currentPlayer} confirmed marker in geo room ${currentGeoRoom}`);
            }

            else if (message.type === 'geo_nextRound') {
                if (!currentGeoRoom) return;

                const room = geoRooms.get(currentGeoRoom);
                if (!room || room.moderator !== currentPlayer) return;

                startGeoRound(currentGeoRoom);
            }

            else if (message.type === 'geo_endGame') {
                if (!currentGeoRoom) return;

                const room = geoRooms.get(currentGeoRoom);
                if (!room || room.moderator !== currentPlayer) return;

                // Send final results to all players
                broadcastToGeoRoom(currentGeoRoom, {
                    type: 'geo_finalResults',
                    scores: room.scores
                });

                console.log(`Game ended in ${currentGeoRoom}, final results sent`);
            }

            else if (message.type === 'geo_exitGame') {
                if (!currentGeoRoom) return;

                const room = geoRooms.get(currentGeoRoom);
                if (!room || room.moderator !== currentPlayer) return;

                // Tell everyone to go back to index
                broadcastToGeoRoom(currentGeoRoom, {
                    type: 'geo_gameEnded'
                });

                // Delete the room
                if (room.roundTimeout) {
                    clearTimeout(room.roundTimeout);
                }
                geoRooms.delete(currentGeoRoom);

                console.log(`Moderator exited game, room ${currentGeoRoom} deleted`);
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

        // Clean up geo room
        if (currentGeoRoom && currentPlayer) {
            const room = geoRooms.get(currentGeoRoom);
            if (room) {
                // Remove client connection but KEEP player data and score
                room.clients.forEach(client => {
                    if (client.playerName === currentPlayer) {
                        room.clients.delete(client);
                    }
                });

                console.log(`${currentPlayer} disconnected from geo room ${currentGeoRoom} (data preserved)`);

                // Only delete room if NO clients left at all
                if (room.clients.size === 0) {
                    if (room.roundTimeout) {
                        clearTimeout(room.roundTimeout);
                    }
                    geoRooms.delete(currentGeoRoom);
                    console.log(`Geo room ${currentGeoRoom} deleted (empty, no clients)`);
                } else {
                    // Update player list to show disconnected status
                    sendGeoPlayerList(currentGeoRoom);
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`Server running on port ${PORT}`);
    console.log(`Version: 3.0 - Multi-Game Support`);
    console.log(`Updated: ${new Date().toISOString()}`);
    console.log(`Buzzer Game: /buzzer.html`);
    console.log(`Guessing Game: /schaetzen.html`);
    console.log(`Geo Game: /auslandsmaus.html`);
    console.log(`All game handlers: ENABLED`);
    console.log(`========================================`);
});
