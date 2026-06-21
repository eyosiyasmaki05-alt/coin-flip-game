// frontend/app.js
let ws;
let myPlayerId = "";
let selectedChoice = null;

const poolDisplay = document.getElementById('pool-display');
const logOutput = document.getElementById('log-output');
const lobbyView = document.getElementById('lobby-view');
const gameView = document.getElementById('game-view');

function appendLog(text) {
    logOutput.innerHTML = `<div>> ${text}</div>` + logOutput.innerHTML;
}

function connectToLobby() {
    // Note: When running locally, change this URL address string to 'ws://localhost:8080'
    // To run live without downloading files, you will insert your sandbox address here.
    ws = new WebSocket('ws://localhost:8080');

    ws.onopen = () => {
        appendLog("Connected to high-speed game networking stream backend.");
        ws.send(JSON.stringify({ type: 'JOIN_MATCH' }));
    };

    ws.onmessage = (event) => {
        const packet = JSON.parse(event.data);
        
        switch (packet.type) {
            case 'INIT':
                myPlayerId = packet.playerId;
                poolDisplay.innerText = packet.systemPool.toLocaleString();
                appendLog(`Handshake secured. Profile initialized: Node ID ${myPlayerId}`);
                break;

            case 'WAITING_FOR_OPPONENT':
                appendLog("Entered dynamic tournament matchmaking pool. Waiting for opponent player...");
                break;

            case 'MATCH_START':
                lobbyView.style.display = "none";
                gameView.style.display = "block";
                appendLog("🎯 Opponent matched! Game session established.");
                document.getElementById('local-skin').innerText = packet.p1Data.id === myPlayerId ? packet.p1Data.skin : packet.p2Data.skin;
                document.getElementById('enemy-skin').innerText = packet.p1Data.id !== myPlayerId ? packet.p1Data.skin : packet.p2Data.skin;
                break;

            case 'MOVE_ACKNOWLEDGED':
                appendLog(packet.msg);
                break;

            case 'ROUND_RESULT':
                animateCoinFlip(packet.result);
                poolDisplay.innerText = packet.systemPool.toLocaleString();
                
                // Track state arrays
                Object.keys(packet.scores).forEach(id => {
                    if (id === myPlayerId) {
                        document.getElementById('local-coins').innerText = packet.scores[id];
                        document.getElementById('local-streak').innerText = packet.streaks[id];
                    } else {
                        document.getElementById('enemy-coins').innerText = packet.scores[id];
                        document.getElementById('enemy-streak').innerText = packet.streaks[id];
                    }
                });

                packet.logs.forEach(msg => appendLog(msg));
                appendLog(`Result: The coin flipped and landed on ${packet.result.toUpperCase()}!`);

                if (packet.winner) {
                    if (packet.winner === myPlayerId) {
                        alert("👑 GRAND VICTORY! You emptied the target parameters first!");
                    } else {
                        alert("MATCH LOST! Opponent claimed final bounty.");
                    }
                    location.reload(); // Returns player to lobby system interface
                }
                break;

            case 'UPDATE_BAL':
                document.getElementById('local-coins').innerText = packet.coins;
                if(packet.currentSkin) document.getElementById('local-skin').innerText = packet.currentSkin;
                appendLog(packet.msg);
                break;

            case 'ERROR':
                alert(packet.msg);
                break;
        }
    };
}

function selectChoice(choice) {
    selectedChoice = choice;
    appendLog(`Locally pre-set stance alignment to: ${choice.toUpperCase()}`);
}

function submitTurnMove() {
    if (!selectedChoice) {
        alert("Please pick HEADS or TAILS choice node first.");
        return;
    }
    const doubleFlipChecked = document.getElementById('double-flip-cb').checked;
    const stealCardChecked = document.getElementById('steal-card-cb').checked;

    ws.send(JSON.stringify({
        type: 'SUBMIT_MOVE',
        choice: selectedChoice,
        useDoubleFlip: doubleFlipChecked,
        useStealCard: stealCardChecked
    }));
}

function animateCoinFlip(finalResult) {
    const coin = document.getElementById('coin-graphic');
    coin.innerText = "🔄"; // Flip animation placeholder sequence
    setTimeout(() => {
        coin.innerText = finalResult === 'heads' ? "🪙 (HEADS)" : "🔱 (TAILS)";
    }, 600);
}

// --- MONETIZATION HOOK SIMULATION ENGINES ---
function triggerAdSimulation() {
    appendLog("Opening overlay ad container stream... [Simulated 5-second Ad video tracking]");
    setTimeout(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'WATCHED_AD' }));
        } else {
            appendLog("Error: Join a matchmaking instance first before executing ad reward triggers.");
        }
    }, 2000);
}

function purchaseSkin(name) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'BUY_SKIN', skinName: name }));
    } else {
        alert("Connect to game engine environment network grid to purchase items.");
    }
}
