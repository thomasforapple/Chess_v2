// Initialize socket connection
let socket;
let currentGameId = null;

function initSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to server');
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });
    
    socket.on('game_joined', (data) => {
        console.log('Joined game room', data);
    });
    
    socket.on('game_updated', (gameState) => {
        console.log('Game updated', gameState);
        // Update the chessboard with new state
        updateChessboard(gameState);
    });
    
    socket.on('error', (error) => {
        console.error('Socket error:', error);
        alert(error.message);
    });
}

function joinGameRoom(gameId) {
    if (!socket) return;
    
    const token = localStorage.getItem('token');
    
    currentGameId = gameId;
    socket.emit('join_game', {
        game_id: gameId,
        token: token
    });
}

function emitMove(moveUci) {
    if (!socket || !currentGameId) return;
    
    const token = localStorage.getItem('token');
    
    socket.emit('make_move', {
        game_id: currentGameId,
        move: moveUci,
        token: token
    });
}

// Function to update the chessboard with new game state
function updateChessboard(gameState) {
    // Load the new FEN
    loadFEN(gameState.fen);
    
    // Update game status display
    const statusEl = document.getElementById('game-status');
    if (statusEl) {
        if (gameState.status === 'completed') {
            if (gameState.winner === 'draw') {
                statusEl.textContent = 'Game ended in a draw';
            } else {
                const currentUserId = localStorage.getItem('userId');
                statusEl.textContent = gameState.winner === currentUserId ? 
                    'You won!' : 'You lost';
            }
        } else {
            // Determine whose turn it is
            const isWhiteTurn = gameState.fen.split(' ')[1] === 'w';
            const userColor = document.getElementById('user-color').value;
            
            statusEl.textContent = (userColor === 'white' && isWhiteTurn) || 
                                 (userColor === 'black' && !isWhiteTurn) ? 
                                 'Your turn' : 'Opponent\'s turn';
        }
    }
}

// Initialize socket when document is loaded
document.addEventListener('DOMContentLoaded', initSocket);