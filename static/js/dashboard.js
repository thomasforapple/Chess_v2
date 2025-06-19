// Dashboard functionality for Chess Arena
// Handles user dashboard, game creation, and joining games

// API endpoint
const API_URL = '/api';

// State management
const DASHBOARD_STATE = {
    userData: null,
    activeGames: [],
    recentGames: [],
    ratings: {
        blitz: { rating: 1200, games: 0 },
        rapid: { rating: 1200, games: 0 },
        classical: { rating: 1200, games: 0 }
    }
};

// Check authentication
function checkAuth() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        // Redirect to login
        window.location.href = '/login';
        return false;
    }
    
    return true;
}

// Load user data with support for multiple ratings
async function loadUserData() {
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`${API_URL}/auth/profile`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load user data');
        }
        
        const userData = await response.json();
        DASHBOARD_STATE.userData = userData;
        
        // Update ratings if available
        if (userData.ratings) {
            DASHBOARD_STATE.ratings = userData.ratings;
        }
        
        // Update UI with user data
        updateUserUI(userData);
        
    } catch (error) {
        console.error('Error loading user data:', error);
        showNotification('Failed to load your profile. Please try again.', 'error');
    }
}

// Update UI with user data
function updateUserUI(userData) {
    // Set username
    const usernameElement = document.getElementById('username');
    if (usernameElement) {
        usernameElement.textContent = userData.username;
    }
    
    // Set overall stats
    const gamesPlayedElement = document.getElementById('games-played');
    const winsElement = document.getElementById('wins');
    const lossesElement = document.getElementById('losses');
    const drawsElement = document.getElementById('draws');
    
    if (gamesPlayedElement && userData.games) {
        gamesPlayedElement.textContent = userData.games.played || 0;
    }
    
    if (winsElement && userData.games) {
        winsElement.textContent = userData.games.won || 0;
    }
    
    if (lossesElement && userData.games) {
        lossesElement.textContent = userData.games.lost || 0;
    }
    
    if (drawsElement && userData.games) {
        drawsElement.textContent = userData.games.drawn || 0;
    }
    
    // Set ratings
    updateRatingsUI();
}

// Update the ratings UI
// Update the ratings UI - FIXED VERSION
function updateRatingsUI() {
    // Update Blitz rating
    const blitzRatingElement = document.getElementById('player-elo-blitz');
    if (blitzRatingElement) {
        blitzRatingElement.textContent = DASHBOARD_STATE.ratings.blitz.rating || 1200;
    }
    
    // Update Rapid rating
    const rapidRatingElement = document.getElementById('player-elo-rapid');
    if (rapidRatingElement) {
        rapidRatingElement.textContent = DASHBOARD_STATE.ratings.rapid.rating || 1200;
    }
    
    // Update Classical rating
    const classicalRatingElement = document.getElementById('player-elo-classical');
    if (classicalRatingElement) {
        classicalRatingElement.textContent = DASHBOARD_STATE.ratings.classical.rating || 1200;
    }
    
    // Update games count by finding parent cards
    const ratingCards = document.querySelectorAll('.rating-card');
    ratingCards.forEach((card, index) => {
        const gamesElement = card.querySelector('.games-played');
        if (gamesElement) {
            let gamesCount;
            switch(index) {
                case 0: gamesCount = DASHBOARD_STATE.ratings.blitz.games || 0; break;
                case 1: gamesCount = DASHBOARD_STATE.ratings.rapid.games || 0; break;
                case 2: gamesCount = DASHBOARD_STATE.ratings.classical.games || 0; break;
            }
            gamesElement.textContent = `Parties: ${gamesCount}`;
        }
    });
}

// Load active games
async function loadActiveGames() {
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`${API_URL}/games/active`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load active games');
        }
        
        const games = await response.json();
        DASHBOARD_STATE.activeGames = games;
        
        // Update count
        const activeGamesCountElement = document.getElementById('active-games-count');
        if (activeGamesCountElement) {
            activeGamesCountElement.textContent = games.length;
        }
        
        // Update UI with active games
        updateActiveGamesUI(games);
        
    } catch (error) {
        console.error('Error loading active games:', error);
    }
}

// Load recent games
async function loadRecentGames() {
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`${API_URL}/games/recent`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load recent games');
        }
        
        const games = await response.json();
        DASHBOARD_STATE.recentGames = games;
        
        // Update count
        const recentGamesCountElement = document.getElementById('recent-games-count');
        if (recentGamesCountElement) {
            recentGamesCountElement.textContent = games.length;
        }
        
        // Update UI with recent games
        updateRecentGamesUI(games);
        
    } catch (error) {
        console.error('Error loading recent games:', error);
    }
}

// Update UI with active games
function updateActiveGamesUI(games) {
    const activeGamesContainer = document.getElementById('active-games');
    const noActiveGamesMessage = document.getElementById('no-active-games');
    
    if (!activeGamesContainer) return;
    
    // Remove existing game cards (except the no-games message)
    const existingCards = activeGamesContainer.querySelectorAll('.game-card');
    existingCards.forEach(card => card.remove());
    
    // Show/hide no games message
    if (games.length === 0) {
        if (noActiveGamesMessage) {
            noActiveGamesMessage.style.display = 'block';
        }
        return;
    } else {
        if (noActiveGamesMessage) {
            noActiveGamesMessage.style.display = 'none';
        }
    }
    
    // Add game cards
    games.forEach(game => {
        const gameCard = createGameCard(game, true);
        activeGamesContainer.appendChild(gameCard);
    });
}

// Update UI with recent games
function updateRecentGamesUI(games) {
    const recentGamesContainer = document.getElementById('recent-games');
    const noRecentGamesMessage = document.getElementById('no-recent-games');
    
    if (!recentGamesContainer) return;
    
    // Remove existing game cards (except the no-games message)
    const existingCards = recentGamesContainer.querySelectorAll('.game-card');
    existingCards.forEach(card => card.remove());
    
    // Show/hide no games message
    if (games.length === 0) {
        if (noRecentGamesMessage) {
            noRecentGamesMessage.style.display = 'block';
        }
        return;
    } else {
        if (noRecentGamesMessage) {
            noRecentGamesMessage.style.display = 'none';
        }
    }
    
    // Add game cards
    games.forEach(game => {
        const gameCard = createGameCard(game, false);
        recentGamesContainer.appendChild(gameCard);
    });
}

// Create a game card element
function createGameCard(game, isActive) {
    const userId = localStorage.getItem('userId');
    
    // Determine if user is white or black
    const isWhite = game.white_player && game.white_player.user_id === userId;
    const opponent = isWhite ? game.black_player : game.white_player;
    
    // Create card element
    const card = document.createElement('div');
    
    // Format date
    const gameDate = new Date(game.created_at);
    const dateString = gameDate.toLocaleDateString();

    let resultText = '';
    
    // Determine result text
    if (game.status === 'completed') {
        if (game.winner === 'draw') {
            resultText = 'Nulle';
        } else if (game.winner === userId) {
            resultText = 'Victoire';
        } else {
            resultText = 'Défaite';
        }
    }
    
    card.className = `game-card ${resultText}`;
    
    const timeControlIcon = getTimeControlIcon(game.time_control);

    card.innerHTML = `
        <div class="game-card-header">
            <div class="opponent-info">
                <span class="opponent-name">${opponent ? opponent.username : 'Waiting for opponent'}</span>
                ${opponent ? `<span class="opponent-rating"> ${opponent.elo || '?'}</span>` : ''}
            </div>
            <span class="game-status-badge ${game.status}">${game.status}</span>
        </div>
        <div class="game-card-content">
            <div class="game-info">
                <span class="game-date">${dateString}</span>               
                <span class="time-control">${timeControlIcon} ${formatTimeControl(game.time_control)}</span>
                ${game.status === 'completed' ? `<span class="game-result ${resultText}">${resultText}</span>` : ''}
            </div>
        </div>
        <div class="game-card-actions">
            ${isActive ? `<a href="/game/${game.game_id}" class="btn btn-primary">
                ${game.status === 'waiting' ? "En attente de l'adversaire" : 'Continuer'}
            </a>` : 
            `<a href="/game/${game.game_id}" class="btn btn-light"> Voir</a>`}
        </div>
    `;
    
    return card;
}

// Format time control for display
function formatTimeControl(timeControl) {
    if (!timeControl) return 'Unlimited';
    
    if (typeof timeControl === 'string') {
        switch(timeControl) {
            case 'blitz':
                return '5 min';
            case 'rapid':
                return '10 min';
            case 'classical':
                return '30 min';
            case 'unlimited':
                return 'Unlimited';
            default:
                return timeControl;
        }
    }
    
    if (typeof timeControl === 'object') {
        const initialMinutes = timeControl.initial_time_ms 
            ? Math.floor(timeControl.initial_time_ms / 60000)
            : 0;
            
        const increment = timeControl.increment
            ? Math.floor(timeControl.increment / 1000)
            : 0;
            
        if (increment > 0) {
            return `${initialMinutes}+${increment}`;
        }
        
        return `${initialMinutes} min`;
    }
    
    return 'Custom';
}

// Get an appropriate icon for time control
function getTimeControlIcon(timeControl) {
    if (!timeControl) return '<i class="fas fa-infinity"></i>';
    
    if (typeof timeControl === 'string') {
        switch(timeControl) {
            case 'blitz':
                return '<i class="fas fa-bolt"></i>';
            case 'rapid':
                return '<i class="fas fa-stopwatch"></i>';
            case 'classical':
                return '<i class="fas fa-chess-clock"></i>';
            case 'unlimited':
                return '<i class="fas fa-infinity"></i>';
            default:
                return '<i class="fas fa-clock"></i>';
        }
    }
    
    if (typeof timeControl === 'object') {
        const type = timeControl.type || '';
        
        switch(type) {
            case 'blitz':
                return '<i class="fas fa-bolt"></i>';
            case 'rapid':
                return '<i class="fas fa-stopwatch"></i>';
            case 'classical':
                return '<i class="fas fa-chess-clock"></i>';
            default:
                return '<i class="fas fa-clock"></i>';
        }
    }
    
    return '<i class="fas fa-clock"></i>';
}

// Create a new game directly from quick create buttons
async function createGameFromButton(timeControlId) {
    const token = localStorage.getItem('token');
    
    // Parse the time control ID (e.g., "blitz_3_2" -> type: "blitz", time: 3, increment: 2)
    let timeControl;
    
    if (timeControlId === 'unlimited') {
        timeControl = 'unlimited';
    } else {
        const parts = timeControlId.split('_');
        const type = parts[0]; // blitz, rapid, classical
        const minutes = parseInt(parts[1], 10);
        const increment = parts.length > 2 ? parseInt(parts[2], 10) : 0;
        
        timeControl = {
            type: type,
            initial_time_ms: minutes * 60 * 1000,
            increment: increment * 1000
        };
    }
    
    try {
        // Show loading state
        showNotification('Creating game...', 'info');
        
        const response = await fetch(`${API_URL}/games/create`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                color_preference: 'random', // Always use random color
                time_control: timeControl
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to create game');
        }
        
        const gameData = await response.json();
        
        
        window.location.href = '/game/' + gameData.game_id;
        

        
    } catch (error) {
        console.error('Error creating game:', error);
        showNotification('Failed to create game. Please try again.', 'error');
    }
}

// Create a new game from custom settings
async function createCustomGame() {
    const token = localStorage.getItem('token');
    const timeControlSelect = document.getElementById('time-control');
    const useIncrement = document.getElementById('use-increment');
    
    let timeControl = timeControlSelect.value;
    
    // Check if we need to add increment
    if (useIncrement && useIncrement.checked && timeControl !== 'unlimited') {
        // Create a more detailed time control object
        const incrementSelect = document.getElementById('increment-seconds');
        const incrementSeconds = incrementSelect ? parseInt(incrementSelect.value, 10) : 0;

        // Convert time control to milliseconds
        let initialTimeMs;

        switch (timeControl) {
            case 'blitz':
                initialTimeMs = 5 * 60 * 1000; // 5 minutes
                break;
            case 'rapid':
                initialTimeMs = 10 * 60 * 1000; // 10 minutes
                break;
            case 'classical':
                initialTimeMs = 30 * 60 * 1000; // 30 minutes
                break;
            default:
                initialTimeMs = 10 * 60 * 1000; // Default to 10 minutes
        }

        timeControl = {
            type: timeControl,
            initial_time_ms: initialTimeMs,
            increment: incrementSeconds * 1000 // Convert to milliseconds
        };
    }

    try {
        // Show loading state
        showNotification('Creating game...', 'info');
        
        const response = await fetch(`${API_URL}/games/create`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                color_preference: 'random', // Always random
                time_control: timeControl
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to create game');
        }
        
        const gameData = await response.json();
        
        // Close the modal
        document.getElementById('custom-game-modal').style.display = 'none';
        
        window.location.href = '/game/' + gameData.game_id;

    
        
    } catch (error) {
        console.error('Error creating game:', error);
        showNotification('Failed to create game. Please try again.', 'error');
    }
}

// Join an existing game
async function joinGame(gameCode) {
    if (!gameCode) return;
    
    const token = localStorage.getItem('token');
    
    try {
        // Show loading state
        showNotification('Joining game...', 'info');
        
        const joinButton = document.getElementById('join-game-submit');
        if (joinButton) {
            joinButton.disabled = true;
            joinButton.textContent = 'Joining...';
        }
        
        const response = await fetch(`${API_URL}/games/join/${gameCode}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to join game');
        }
        
        const gameData = await response.json();
        
        // Show success notification
        showNotification('Successfully joined game!', 'success');
        
        // Redirect to the game page
        window.location.href = `/game/${gameData.game_id}`;
        
    } catch (error) {
        console.error('Error joining game:', error);
        showNotification('Failed to join game. Please check the game code and try again.', 'error');
        
        // Reset button state
        const joinButton = document.getElementById('join-game-submit');
        if (joinButton) {
            joinButton.disabled = false;
            joinButton.textContent = 'Join Game';
        }
    }
}

// Show the game code modal
function showGameCodeModal(gameCode, gameId) {
    // Create and show the modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    
    const gameLink = `${window.location.origin}/game/join/${gameCode}`;
    
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close">&times;</span>
            <h2>Game Created!</h2>
            <p>Share this game code with your friend:</p>
            <div class="game-code">
                <span>${gameCode}</span>
                <button class="btn btn-light copy-code">Copy</button>
            </div>
            <p>Or share this link:</p>
            <div class="game-link">
                <input type="text" value="${gameLink}" readonly>
                <button class="btn btn-light copy-link">Copy</button>
            </div>
            <div class="modal-actions">
                <button class="btn btn-primary start-game">Start Game Now</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    const closeBtn = modal.querySelector('.close');
    const copyCodeBtn = modal.querySelector('.copy-code');
    const copyLinkBtn = modal.querySelector('.copy-link');
    const startGameBtn = modal.querySelector('.start-game');
    
    closeBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    copyCodeBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(gameCode);
        copyCodeBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyCodeBtn.textContent = 'Copy';
        }, 2000);
    });
    
    copyLinkBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(gameLink);
        copyLinkBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyLinkBtn.textContent = 'Copy';
        }, 2000);
    });
    
    startGameBtn.addEventListener('click', () => {
        window.location.href = `/game/${gameId}`;
    });
}

// Show notification
function showNotification(message, type = 'info') {
    // Check if notification exists already
    let notification = document.querySelector('.notification');
    
    // Create if it doesn't exist
    if (!notification) {
        notification = document.createElement('div');
        notification.className = 'notification';
        document.body.appendChild(notification);
    }
    
    // Set type and message
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Show the notification
    notification.style.display = 'block';
    
    // Hide after 3 seconds
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// Initialize dashboard
function initDashboard() {
    // Check authentication
    if (!checkAuth()) return;
    
    // Load user data, active games, and recent games
    loadUserData();
    loadActiveGames();
    loadRecentGames();
    
    // Add event listeners to quick create buttons
    document.querySelectorAll('.create-game-btn').forEach(button => {
        button.addEventListener('click', () => {
            const timeControl = button.dataset.time;
            createGameFromButton(timeControl);
        });
    });
    
    // Add event listener to custom game button
    const customGameBtn = document.getElementById('custom-game-btn');
    if (customGameBtn) {
        customGameBtn.addEventListener('click', () => {
            document.getElementById('custom-game-modal').style.display = 'flex';
        });
    }
    
    // Add event listener to create game button in modal
    const createGameBtn = document.getElementById('create-game-btn');
    if (createGameBtn) {
        createGameBtn.addEventListener('click', () => {
            createCustomGame();
        });
    }
    
    // Add event listener to join game button
    const joinGameBtn = document.getElementById('join-game-btn');
    if (joinGameBtn) {
        joinGameBtn.addEventListener('click', () => {
            document.getElementById('join-game-modal').style.display = 'flex';
        });
    }
    
    // Add event listener to join game submit button
    const joinGameSubmit = document.getElementById('join-game-submit');
    if (joinGameSubmit) {
        joinGameSubmit.addEventListener('click', () => {
            const gameCode = document.getElementById('game-code').value.trim();
            if (gameCode) {
                joinGame(gameCode);
            }
        });
    }
    
    // Add event listeners to modal close buttons
    document.querySelectorAll('.modal .close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            closeBtn.closest('.modal').style.display = 'none';
        });
    });
    
    // Add event listener to logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
            window.location.href = '/login';
        });
    }
    
    // Add event listener to time control select for increment options
    const timeControlSelect = document.getElementById('time-control');
    const useIncrementCheckbox = document.getElementById('use-increment');
    const incrementOptionsDiv = document.getElementById('increment-options');
    const incrementContainer = document.querySelector('.increment-container');

    if (timeControlSelect) {
        timeControlSelect.addEventListener('change', function() {
            // Only show increment options for timed games
            if (this.value !== 'unlimited') {
                incrementContainer.style.display = 'block';
            } else {
                incrementContainer.style.display = 'none';
                if (useIncrementCheckbox) {
                    useIncrementCheckbox.checked = false;
                }
                if (incrementOptionsDiv) {
                    incrementOptionsDiv.style.display = 'none';
                }
            }
        });
    }

    // Show/hide increment options based on checkbox
    if (useIncrementCheckbox && incrementOptionsDiv) {
        useIncrementCheckbox.addEventListener('change', function() {
            incrementOptionsDiv.style.display = this.checked ? 'block' : 'none';
        });
    }
    
    // Close modals when clicking outside
    window.addEventListener('click', (event) => {
        document.querySelectorAll('.modal').forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
}

// Run initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', initDashboard);