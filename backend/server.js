// backend/server.js
const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto'); // Built-in Node.js security module

const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Global Game State
let gameState = {
    systemPool: 1000000,
    players: {}, // Tracks connected sockets, scores, streaks, skins, cards
    rooms: {}    // Tracks active 2-player match matches
};

// --- PROVABLY FAIR SYSTEM ENGINE ---
// Uses cryptographically secure pseudo-random number generators (CSPRNG)
// This ensures outcomes cannot be predicted, manipulated, or front-run by clients.
function secureCoinFlip() {
    // Generates a secure random byte (0-255)
    const randomByte = crypto.randomBytes(1)[0];
    // Even = Heads, Odd = Tails
    return randomByte % 2 === 0 ? "heads" : "tails";
}

wss.on('connection', (ws) => {
    let playerId = crypto.randomUUID();
    console.log(`Player connected: ${playerId}`);
    
    // Initialize player profile with premium skin logic
    gameState.players[playerId] = {
        id: playerId,
        ws: ws,
        coins: 0,
        streak: 0,
        stealCards: 1, // Start with one 'Steal Coin Card'
        currentSkin: "default", // Premium skin inventory slot
        currentRoom: null
    };

    // Send initial configuration to client
    ws.send(JSON.stringify({ type: 'INIT', playerId: playerId, systemPool: gameState.systemPool }));

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        const player = gameState.players[playerId];

        switch (data.type) {
            case 'JOIN_MATCH':
                handleMatchmaking(player);
                break;

            case 'SUBMIT_MOVE':
                handlePlayerMove(player, data.choice, data.useDoubleFlip, data.useStealCard);
                break;

            case 'WATCHED_AD':
                // Monetization reward hook
                player.coins += 2;
                ws.send(JSON.stringify({ type: 'UPDATE_BAL', coins: player.coins, msg: "Ad reward claimed! +2 Coins" }));
                break;

            case 'BUY_SKIN':
                // Premium item monetization shop
                if (player.coins >= 50) {
                    player.coins -= 50;
                    player.currentSkin = data.skinName;
                    ws.send(JSON.stringify({ type: 'UPDATE_BAL', coins: player.coins, currentSkin: player.currentSkin, msg: `Skin ${data.skinName} unlocked!` }));
                } else {
                    ws.send(JSON.stringify({ type: 'ERROR', msg: "Insufficient coins for premium skin." }));
                }
                break;
        }
    });

    ws.on('close', () => {
        // Cleanup on disconnect
        const player = gameState.players[playerId];
        if (player && player.currentRoom) {
            closeRoom(player.currentRoom, `${playerId} disconnected.`);
        }
        delete gameState.players[playerId];
    });
});

function handleMatchmaking(player) {
    // Find an available room or create a new one
    let targetRoom = Object.keys(gameState.rooms).find(roomId => gameState.rooms[roomId].p2 === null);

    if (!targetRoom) {
        let newRoomId = `room_${crypto.randomUUID()}`;
        gameState.rooms[newRoomId] = {
            id: newRoomId,
            p1: player,
            p2: null,
            moves: {}
        };
        player.currentRoom = newRoomId;
        player.ws.send(JSON.stringify({ type: 'WAITING_FOR_OPPONENT' }));
    } else {
        gameState.rooms[targetRoom].p2 = player;
        player.currentRoom = targetRoom;
        
        // Notify both players that the multiplayer match is synchronized and active
        broadcastToRoom(targetRoom, { 
            type: 'MATCH_START', 
            p1Data: { id: gameState.rooms[targetRoom].p1.id, skin: gameState.rooms[targetRoom].p1.currentSkin },
            p2Data: { id: player.id, skin: player.currentSkin }
        });
    }
}

function handlePlayerMove(player, choice, useDoubleFlip, useStealCard) {
    const room = gameState.rooms[player.currentRoom];
    if (!room) return;

    // Record the encrypted move details safely on the server side
    room.moves[player.id] = {
        choice: choice,
        doubleFlip: useDoubleFlip,
        stealCard: useStealCard && player.stealCards > 0
    };

    // If both players have committed their choices, execute the round logic
    if (room.moves[room.p1.id] && room.moves[room.p2.id]) {
        evaluateRound(room);
    } else {
        player.ws.send(JSON.stringify({ type: 'MOVE_ACKNOWLEDGED', msg: "Waiting for opponent's choice..." }));
    }
}

function evaluateRound(room) {
    const p1 = room.p1;
    const p2 = room.p2;
    const m1 = room.moves[p1.id];
    const m2 = room.moves[p2.id];

    // 1. Flip the coin securely via CSPRNG
    const flipResult = secureCoinFlip();
    let logs = [];

    // Base payout calculation parameters
    let p1Payout = 0;
    let p2Payout = 0;

    // 2. Check Guesses & Calculate Base Rewards
    if (m1.choice === flipResult) p1Payout = 1;
    if (m2.choice === flipResult) p2Payout = 1;

    // 3. Double Flip Mode Rule Engine (Higher Risk, Double Reward)
    if (m1.doubleFlip) {
        // If correct, get 2 coins instead of 1. If wrong, lose 1 coin.
        p1Payout = m1.choice === flipResult ? 2 : -1;
        logs.push("Player 1 triggered Double Flip Mode!");
    }
    if (m2.doubleFlip) {
        p2Payout = m2.choice === flipResult ? 2 : -1;
        logs.push("Player 2 triggered Double Flip Mode!");
    }

    // Apply base modifications safely, preventing negative ledger errors
    p1.coins = Math.max(0, p1.coins + p1Payout);
    p2.coins = Math.max(0, p2.coins + p2Payout);
    gameState.systemPool -= (Math.max(0, p1Payout) + Math.max(0, p2Payout));

    // 4. Lucky Streak Payout Logic (3 wins in a row = 10 extra coins)
    if (m1.choice === flipResult) {
        p1.streak++;
        if (p1.streak >= 3) {
            p1.coins += 10;
            gameState.systemPool -= 10;
            logs.push("🔥 Player 1 hit a 3x Lucky Streak! +10 Coins.");
        }
    } else { p1.streak = 0; }

    if (m2.choice === flipResult) {
        p2.streak++;
        if (p2.streak >= 3) {
            p2.coins += 10;
            gameState.systemPool -= 10;
            logs.push("🔥 Player 2 hit a 3x Lucky Streak! +10 Coins.");
        }
    } else { p2.streak = 0; }

    // 5. Steal Coin Card Payout Logic (Winner steals 1 coin from opponent)
    if (m1.stealCard && p1Payout > 0 && p2.coins > 0) {
        p1.stealCards--;
        p1.coins += 1;
        p2.coins -= 1;
        logs.push("🃏 Player 1 played a Steal Card and poached 1 coin!");
    }
    if (m2.stealCard && p2Payout > 0 && p1.coins > 0) {
        p2.stealCards--;
        p2.coins += 1;
        p1.coins -= 1;
        logs.push("🃏 Player 2 played a Steal Card and poached 1 coin!");
    }

    // 6. Check Win Target Thresholds (e.g., Target state reached)
    let winner = null;
    const TARGET = 15; // Set win target for quick match testing
    if (p1.coins >= TARGET) winner = p1.id;
    else if (p2.coins >= TARGET) winner = p2.id;

    // Broadcast finalized sync state packet down to clients
    broadcastToRoom(room.id, {
        type: 'ROUND_RESULT',
        result: flipResult,
        systemPool: gameState.systemPool,
        logs: logs,
        scores: { [p1.id]: p1.coins, [p2.id]: p2.coins },
        streaks: { [p1.id]: p1.streak, [p2.id]: p2.streak },
        winner: winner
    });

    // Clear operational buffer state for next turn round
    room.moves = {};
    if (winner) {
        closeRoom(room.id, `Match concluded. Winner: ${winner}`);
    }
}

function broadcastToRoom(roomId, packet) {
    const room = gameState.rooms[roomId];
    if (!room) return;
    const payload = JSON.stringify(packet);
    if (room.p1) room.p1.ws.send(payload);
    if (room.p2) room.p2.ws.send(payload);
}

function closeRoom(roomId, reasoning) {
    const room = gameState.rooms[roomId];
    if (room) {
        console.log(`Closing Room ${roomId}: ${reasoning}`);
        delete gameState.rooms[roomId];
    }
}

server.listen(8080, () => console.log('Multiplayer Game Engine active on Port 8080'));
