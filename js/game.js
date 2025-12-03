// game.js - Main game logic

let gameState = {
    collection: null,
    settings: null,
    currentSongIndex: 0,
    score: 0,
    lives: 3,
    shuffledSongs: [],
    audio: null,
    timer: null,
    timeRemaining: 0,
    isPlaying: false
};

// Initialize game
document.addEventListener('DOMContentLoaded', () => {
    loadGameData();
    if (gameState.collection) {
        initializeGame();
    } else {
        alert('No game data found. Redirecting to collection selection...');
        window.location.href = 'play.html';
    }
});

function loadGameData() {
    const settings = sessionStorage.getItem('gameSettings');
    const collection = sessionStorage.getItem('selectedCollection');
    
    if (settings && collection) {
        gameState.settings = JSON.parse(settings);
        gameState.collection = JSON.parse(collection);
        gameState.lives = gameState.settings.lives;
    }
}

function initializeGame() {
    // Shuffle songs
    gameState.shuffledSongs = [...gameState.collection.songs].sort(() => Math.random() - 0.5);
    
    // Update UI
    updateUI();
    
    // Start first round
    startRound();
}

function startRound() {
    if (gameState.currentSongIndex >= gameState.shuffledSongs.length) {
        endGame();
        return;
    }
    
    // Reset states
    showState('playingState');
    
    const currentSong = gameState.shuffledSongs[gameState.currentSongIndex];
    
    // Create audio element
    gameState.audio = new Audio(currentSong.audioFile);
    
    // Play song clip
    gameState.isPlaying = true;
    gameState.audio.play();
    
    // Set clip duration timer
    const clipDuration = gameState.collection.clipDuration || 15;
    startTimer(clipDuration, () => {
        // Stop audio
        gameState.audio.pause();
        gameState.isPlaying = false;
        
        // Show guess state
        showGuessState();
    });
}

function showGuessState() {
    showState('guessState');
    document.getElementById('guessInput').value = '';
    document.getElementById('guessInput').focus();
    
    // Start guess timer
    const guessTime = gameState.collection.guessTime || 10;
    startTimer(guessTime, () => {
        // Time's up - treat as wrong answer
        checkGuess(null);
    });
}

function checkGuess(userGuess) {
    clearInterval(gameState.timer);
    
    const currentSong = gameState.shuffledSongs[gameState.currentSongIndex];
    const mode = gameState.settings.mode;
    
    let isCorrect = false;
    
    if (userGuess === null) {
        // Time's up or skipped
        isCorrect = false;
    } else {
        // Normalize strings for comparison
        const normalize = (str) => str.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        const normalizedGuess = normalize(userGuess);
        
        if (mode === 'standard') {
            isCorrect = normalize(currentSong.title).includes(normalizedGuess) || 
                       normalizedGuess.includes(normalize(currentSong.title));
        } else if (mode === 'artist') {
            isCorrect = normalize(currentSong.artist).includes(normalizedGuess) || 
                       normalizedGuess.includes(normalize(currentSong.artist));
        } else if (mode === 'both') {
            const titleMatch = normalize(currentSong.title).includes(normalizedGuess);
            const artistMatch = normalize(currentSong.artist).includes(normalizedGuess);
            isCorrect = titleMatch && artistMatch;
        }
    }
    
    showResult(isCorrect, currentSong);
}

function showResult(isCorrect, song) {
    showState('resultState');
    
    const resultMsg = document.getElementById('resultMessage');
    const correctAnswer = document.getElementById('correctAnswer');
    
    if (isCorrect) {
        gameState.score += 100;
        resultMsg.className = 'result correct';
        resultMsg.textContent = '✓ Correct!';
    } else {
        if (gameState.lives !== 999) {
            gameState.lives--;
        }
        resultMsg.className = 'result incorrect';
        resultMsg.textContent = '✗ Incorrect';
    }
    
    correctAnswer.textContent = `${song.artist} - ${song.title}`;
    
    updateUI();
    
    // Check if game over
    if (gameState.lives <= 0) {
        setTimeout(() => endGame(), 2000);
    }
}

function nextRound() {
    gameState.currentSongIndex++;
    startRound();
}

function skipSong() {
    checkGuess(null);
}

function endGame() {
    showState('gameOverState');
    document.getElementById('finalScore').textContent = gameState.score;
}

function startTimer(seconds, onComplete) {
    gameState.timeRemaining = seconds;
    updateTimer();
    
    gameState.timer = setInterval(() => {
        gameState.timeRemaining--;
        updateTimer();
        
        if (gameState.timeRemaining <= 0) {
            clearInterval(gameState.timer);
            onComplete();
        }
    }, 1000);
}

function updateTimer() {
    const timerEl = document.getElementById('timer');
    timerEl.textContent = gameState.timeRemaining;
    
    if (gameState.timeRemaining <= 5) {
        timerEl.classList.add('warning');
    } else {
        timerEl.classList.remove('warning');
    }
}

function updateUI() {
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('lives').textContent = gameState.lives === 999 ? '∞' : gameState.lives;
    document.getElementById('round').textContent = gameState.currentSongIndex + 1;
    document.getElementById('total').textContent = gameState.shuffledSongs.length;
}

function showState(stateId) {
    const states = ['playingState', 'guessState', 'resultState', 'gameOverState'];
    states.forEach(state => {
        document.getElementById(state).style.display = state === stateId ? 'block' : 'none';
    });
}

// Event listeners
document.getElementById('submitGuess').addEventListener('click', () => {
    const guess = document.getElementById('guessInput').value;
    checkGuess(guess);
});

document.getElementById('guessInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const guess = document.getElementById('guessInput').value;
        checkGuess(guess);
    }
});

document.getElementById('skipBtn').addEventListener('click', skipSong);
document.getElementById('nextBtn').addEventListener('click', nextRound);
