// game.js - Main game logic with partial matching and progress bar

let gameState = {
    collection: null,
    settings: null,
    currentSongIndex: 0,
    score: 0,
    lives: 3,
    shuffledSongs: [],
    audio: null,
    clipTimer: null,
    guessTimer: null,
    progressInterval: null,
    currentSong: null,
    artistsRevealed: [],  // Track which artists have been guessed
    songRevealed: false,   // Track if song has been guessed
    hasTimeout: false,
    clipDuration: 10,
    timeout: 0,
    canGuess: true
};

// Initialize game
document.addEventListener('DOMContentLoaded', () => {
    loadGameData();
    if (!gameState.collection) {
        alert('No game data found. Redirecting to home...');
        window.location.href = 'index.html';
    }
    
    // Populate start screen with collection info
    document.getElementById('collectionTitle').textContent = gameState.collection.title;
    document.getElementById('collectionDescription').textContent = gameState.collection.description || '';
    document.getElementById('collectionDifficulty').textContent = gameState.collection.difficulty || 'Medium';
    
    // Show mode info
    let modeName = '';
    if (gameState.lives === 999) modeName = 'Trivial';
    else if (gameState.lives === 3) modeName = 'Default';
    else if (gameState.lives === 1) modeName = 'Sudden Death';
    document.getElementById('gameMode').textContent = modeName;
    
    // Show rounds
    const numRounds = gameState.collection.rounds || gameState.collection.songs.length;
    document.getElementById('gameRounds').textContent = numRounds;
    
    // Set up start button
    const startBtn = document.getElementById('startGameBtn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            document.getElementById('startScreen').style.display = 'none';
            document.getElementById('gameContent').style.display = 'block';
            initializeGame();
        });
    }
});

function loadGameData() {
    const settings = sessionStorage.getItem('gameSettings');
    const collection = sessionStorage.getItem('selectedCollection');
    
    if (settings && collection) {
        gameState.settings = JSON.parse(settings);
        gameState.collection = JSON.parse(collection);
        gameState.lives = gameState.settings.lives;
        gameState.clipDuration = gameState.settings.clipDuration;
        gameState.timeout = gameState.settings.timeout;
        gameState.hasTimeout = gameState.timeout > 0;
    }
}

function initializeGame() {
    // Get number of rounds (use collection.rounds or all songs)
    const numRounds = gameState.collection.rounds || gameState.collection.songs.length;
    
    // Shuffle and select songs
    const shuffled = [...gameState.collection.songs].sort(() => Math.random() - 0.5);
    gameState.shuffledSongs = shuffled.slice(0, numRounds);
    
    // Update UI
    updateUI();
    
    // Set up repeat button click handler
    document.getElementById('repeatBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        repeatSong();
    });
    
    // Start first round
    startRound();
}

function startRound() {
    if (gameState.currentSongIndex >= gameState.shuffledSongs.length) {
        // All rounds complete - check if game over or win
        endGame(true);  // true = completed all rounds
        return;
    }
    
    // Reset round state
    gameState.currentSong = gameState.shuffledSongs[gameState.currentSongIndex];
    gameState.artistsRevealed = [];
    gameState.songRevealed = false;
    gameState.canGuess = true;
    
    // Clear input
    document.getElementById('guessInput').value = '';
    document.getElementById('guessInput').disabled = false;
    
    // Reset UI elements
    document.getElementById('nextButtonContainer').style.display = 'none';
    document.getElementById('actionButtons').style.display = 'block';
    document.getElementById('repeatBtn').style.display = 'none';
    document.getElementById('progressBar').style.width = '0%';
    
    // Update answer display (hidden)
    updateAnswerDisplay();
    
    // Update UI (score, lives, round number)
    updateUI();
    
    // Update skip button text and visibility
    const skipBtn = document.getElementById('skipBtn');
    if (gameState.lives === 1) {
        skipBtn.style.display = 'none';
    } else {
        skipBtn.style.display = 'inline-block';
        if (gameState.lives === 999) {
            skipBtn.textContent = 'Skip';
        } else {
            skipBtn.textContent = 'Skip (-1 Life)';
        }
    }
    
    // Show timer if has timeout
    if (gameState.hasTimeout) {
        document.getElementById('timerDisplay').style.display = 'block';
    } else {
        document.getElementById('timerDisplay').style.display = 'none';
    }
    
    // Play audio
    playSong();
}

function playSong() {
    const song = gameState.currentSong;
    
    // Mark this round as active
    const roundId = Date.now() + Math.random(); // Unique ID for this playback
    gameState.currentRoundId = roundId;
    
    // Parse startTime (support both formats)
    let startTime = 0;
    if (song.startTime) {
        if (typeof song.startTime === 'string' && song.startTime.includes(':')) {
            // Format: "1:30" or "0:45"
            const parts = song.startTime.split(':');
            startTime = parseInt(parts[0]) * 60 + parseInt(parts[1]);
        } else {
            // Format: number in seconds
            startTime = parseFloat(song.startTime);
        }
    }
    
    // Create and configure audio
    gameState.audio = new Audio(song.audioFile);
    gameState.audio.volume = getCurrentVolume();
    gameState.audio.currentTime = startTime;
    
    // Start countdown immediately if timeout mode
    if (gameState.hasTimeout) {
        startCountdown();
    }
    
    // Play audio
    gameState.audio.play().catch(err => {
        console.error('Audio play failed:', err);
    });
    
    // Start progress bar
    startProgressBar();
    
    // Store reference to current round for timer validation
    const thisRoundId = roundId;
    
    // Set up clip timer to stop audio after clipDuration
    gameState.clipTimer = setTimeout(() => {
        // Only pause if we're still on the same round
        if (gameState.currentRoundId === thisRoundId) {
            if (gameState.audio) {
                gameState.audio.pause();
            }
            stopProgressBar();
            
            if (!gameState.hasTimeout) {
                document.getElementById('repeatBtn').style.display = 'inline-block';
            }
        }
    }, gameState.clipDuration * 1000);
    
    // Set up audio end listener with round validation
    gameState.audio.addEventListener('ended', () => {
        // Only stop if we're still on the same round
        if (gameState.currentRoundId === thisRoundId) {
            stopProgressBar();
            if (!gameState.hasTimeout) {
                document.getElementById('repeatBtn').style.display = 'inline-block';
            }
        }
    });
    
    // Make progress bar interactive
    setupProgressBarInteraction();
}

function startProgressBar() {
    const progressBar = document.getElementById('progressBar');
    const duration = gameState.clipDuration * 1000; // in ms
    const startTime = Date.now();
    
    gameState.progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const percent = Math.min((elapsed / duration) * 100, 100);
        progressBar.style.width = percent + '%';
        
        if (percent >= 100) {
            clearInterval(gameState.progressInterval);
        }
    }, 50); // Update every 50ms for smooth animation
}

function stopProgressBar() {
    if (gameState.progressInterval) {
        clearInterval(gameState.progressInterval);
        document.getElementById('progressBar').style.width = '100%';
    }
}

function setupProgressBarInteraction() {
    const progressContainer = document.querySelector('.progress-container');
    
    // Remove old listener by setting a flag
    if (!progressContainer.dataset.hasListener) {
        progressContainer.addEventListener('click', (e) => {
            if (!gameState.audio) return;
            
            // Don't seek if clicking the repeat button
            if (e.target.id === 'repeatBtn' || e.target.closest('#repeatBtn')) {
                return;
            }
            
            // Calculate click position as percentage
            const rect = progressContainer.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percentClicked = clickX / rect.width;
            
            // Seek audio to that position based on clip duration
            const targetTime = percentClicked * gameState.clipDuration;
            const song = gameState.currentSong;
            
            // Parse startTime
            let startTime = 0;
            if (song.startTime) {
                if (typeof song.startTime === 'string' && song.startTime.includes(':')) {
                    const parts = song.startTime.split(':');
                    startTime = parseInt(parts[0]) * 60 + parseInt(parts[1]);
                } else {
                    startTime = parseFloat(song.startTime);
                }
            }
            
            // Set audio to the clicked position
            gameState.audio.currentTime = startTime + targetTime;
            
            // Clear and restart the clip timer to maintain the total clip duration
            clearTimeout(gameState.clipTimer);
            const remainingTime = gameState.clipDuration - targetTime;
            const thisRoundId = gameState.currentRoundId;
            
            gameState.clipTimer = setTimeout(() => {
                // Only pause if we're still on the same round
                if (gameState.currentRoundId === thisRoundId) {
                    if (gameState.audio) {
                        gameState.audio.pause();
                    }
                    stopProgressBar();
                    
                    if (!gameState.hasTimeout) {
                        document.getElementById('repeatBtn').style.display = 'inline-block';
                    }
                }
            }, remainingTime * 1000);
            
            // Restart progress bar from clicked position
            clearInterval(gameState.progressInterval);
            const progressBar = document.getElementById('progressBar');
            progressBar.style.width = (percentClicked * 100) + '%';
            
            const duration = gameState.clipDuration * 1000;
            const newStartTime = Date.now() - (percentClicked * duration);
            
            gameState.progressInterval = setInterval(() => {
                const elapsed = Date.now() - newStartTime;
                const percent = Math.min((elapsed / duration) * 100, 100);
                progressBar.style.width = percent + '%';
                
                if (percent >= 100) {
                    clearInterval(gameState.progressInterval);
                }
            }, 50);
        });
        
        progressContainer.dataset.hasListener = 'true';
    }
}

function startCountdown() {
    let timeLeft = gameState.timeout;
    document.getElementById('timer').textContent = timeLeft;
    
    gameState.guessTimer = setInterval(() => {
        timeLeft--;
        document.getElementById('timer').textContent = timeLeft;
        
        if (timeLeft <= 0) {
            clearInterval(gameState.guessTimer);
            // Time's up - mark as incorrect
            handleTimeout();
        }
    }, 1000);
}

function handleTimeout() {
    gameState.canGuess = false;
    
    // Deduct life
    if (gameState.lives !== 999) {
        gameState.lives--;
    }
    
    // Reveal all answers
    gameState.artistsRevealed = gameState.currentSong.artists.map((_, i) => i);
    gameState.songRevealed = true;
    updateAnswerDisplay();
    
    // Show result
    showResult('Time\'s up!', "incorrect");
    
    updateUI();
    
    // Check game over
    if (gameState.lives <= 0) {
        setTimeout(() => endGame(false), 2000);
    }
}

function checkGuess() {
    if (!gameState.canGuess) return;
    
    const userInput = document.getElementById('guessInput').value.trim();
    if (!userInput) return;
    
    // Stop countdown timer (but keep clip timer running so audio stops naturally)
    clearInterval(gameState.guessTimer);
    
    // Normalize function
    const normalize = (str) => str.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const normalizedInput = normalize(userInput);
    
    const song = gameState.currentSong;
    let artistCorrect = false;
    let songCorrect = false;
    let newCorrectGuess = false;
    
    // Check each artist
    song.artists.forEach((artist, index) => {
        if (!gameState.artistsRevealed.includes(index)) {
            if (normalizedInput.includes(normalize(artist)) || normalize(artist).includes(normalizedInput)) {
                gameState.artistsRevealed.push(index);
                artistCorrect = true;
                newCorrectGuess = true;
            }
        }
    });
    
    // Check song title
    if (!gameState.songRevealed) {
        if (normalizedInput.includes(normalize(song.title)) || normalize(song.title).includes(normalizedInput)) {
            gameState.songRevealed = true;
            songCorrect = true;
            newCorrectGuess = true;
        }
    }
    
    // Update display
    updateAnswerDisplay();
    
    // Award points
    if (artistCorrect) {
        gameState.score += 50;
    }
    if (songCorrect) {
        gameState.score += 100;
    }
    
    // Build result message
    let resultMsg = '';
    if (artistCorrect && songCorrect) {
        resultMsg = '✓ Artist and Song Correct!';
        showResult(resultMsg, 'correct');
    } else if (artistCorrect) {
        resultMsg = '✓ Artist Correct!';
        showResult(resultMsg, 'correct');
    } else if (songCorrect) {
        resultMsg = '✓ Song Correct!';
        showResult(resultMsg, 'correct');
    } else {
        resultMsg = '✗ Incorrect';
        // Deduct life only if no new correct guess
        if (!newCorrectGuess && gameState.lives !== 999) {
            gameState.lives--;
        }
        showResult(resultMsg, 'incorrect');
    }
    
    updateUI();
    
    // Check if fully guessed
    const allArtistsRevealed = gameState.artistsRevealed.length === song.artists.length;
    const fullyGuessed = allArtistsRevealed && gameState.songRevealed;
    
    if (fullyGuessed) {
        gameState.canGuess = false;
    }
    
    // Check game over
    if (gameState.lives <= 0) {
        setTimeout(() => endGame(false), 2000);
    }
    
    // Clear input for next guess
    document.getElementById('guessInput').value = '';
}

function updateAnswerDisplay() {
    const song = gameState.currentSong;
    const artistPart = document.getElementById('artistPart');
    const songPart = document.getElementById('songPart');
    
    // Build artist display
    const artistDisplay = song.artists.map((artist, index) => {
        if (gameState.artistsRevealed.includes(index)) {
            return `<span class="revealed">${artist}</span>`;
        } else {
            return `<span class="hidden">ARTIST ${index + 1}</span>`;
        }
    }).join(', ');
    
    artistPart.innerHTML = artistDisplay;
    
    // Build song display
    if (gameState.songRevealed) {
        songPart.innerHTML = `<span class="revealed">${song.title}</span>`;
    } else {
        songPart.innerHTML = `<span class="hidden">SONG</span>`;
    }
}

function showResult(message, resultType) {
    // Remove result message display - use shake animation instead for incorrect
    if (resultType === 'incorrect') {
        // Shake animation for incorrect guess
        const inputElement = document.getElementById('guessInput');
        inputElement.classList.add('shake-error');
        setTimeout(() => {
            inputElement.classList.remove('shake-error');
        }, 500);
    }
    
    // Check if fully guessed
    const song = gameState.currentSong;
    const allArtistsRevealed = gameState.artistsRevealed.length === song.artists.length;
    const fullyGuessed = allArtistsRevealed && gameState.songRevealed;
    
    // Show next button and disable input if fully guessed, game over, or timeout
    if (fullyGuessed || gameState.lives <= 0 || !gameState.canGuess) {
        document.getElementById('nextButtonContainer').style.display = 'block';
        document.getElementById('actionButtons').style.display = 'none';
        document.getElementById('guessInput').disabled = true;
    }
}

function skipSong() {
    // Stop audio and timers
    if (gameState.audio) {
        gameState.audio.pause();
    }
    clearTimeout(gameState.clipTimer);
    clearInterval(gameState.guessTimer);
    stopProgressBar();
    
    // Deduct life
    if (gameState.lives !== 999) {
        gameState.lives--;
    }
    
    // Check game over
    if (gameState.lives <= 0) {
        updateUI();
        setTimeout(() => endGame(false), 500);
    } else {
        // Go directly to next round
        gameState.currentSongIndex++;
        startRound();
    }
}

function repeatSong() {
    // Hide repeat button
    document.getElementById('repeatBtn').style.display = 'none';
    
    // Stop current audio and timers
    if (gameState.audio) {
        gameState.audio.pause();
    }
    clearTimeout(gameState.clipTimer);
    clearInterval(gameState.progressInterval);
    clearInterval(gameState.guessTimer);
    
    // Reset progress bar
    document.getElementById('progressBar').style.width = '0%';
    
    // Replay song
    playSong();
}

function nextRound() {
    // Stop audio and all timers
    if (gameState.audio) {
        gameState.audio.pause();
        gameState.audio.currentTime = 0;
        gameState.audio = null;
    }
    clearTimeout(gameState.clipTimer);
    clearInterval(gameState.guessTimer);
    stopProgressBar();
    
    gameState.currentSongIndex++;
    startRound();
}

function endGame(completed) {
    // Stop everything
    if (gameState.audio) {
        gameState.audio.pause();
    }
    clearTimeout(gameState.clipTimer);
    clearInterval(gameState.guessTimer);
    clearInterval(gameState.progressInterval);
    
    // Hide game elements, show game over
    document.getElementById('gameOverState').style.display = 'block';
    document.getElementById('actionButtons').style.display = 'none';
    document.getElementById('nextButtonContainer').style.display = 'none';
    document.getElementById('answerDisplay').style.display = 'none';
    document.getElementById('guessInput').style.display = 'none';
    document.getElementById('timerDisplay').style.display = 'none';
    document.querySelector('.progress-container').style.display = 'none';
    
    document.getElementById('finalScore').textContent = gameState.score;
}

function updateUI() {
    document.getElementById('score').textContent = gameState.score;
    
    // Update lives display with hearts
    const livesElement = document.getElementById('lives');
    const livesContainer = livesElement.parentElement;
    
    if (gameState.lives === 999) {
        // Hide lives display for infinite lives
        livesContainer.style.display = 'none';
    } else {
        livesContainer.style.display = 'block';
        // Show hearts
        livesElement.textContent = '❤️'.repeat(gameState.lives);
    }
    
    document.getElementById('round').textContent = gameState.currentSongIndex + 1;
    document.getElementById('total').textContent = gameState.shuffledSongs.length;
}

// Event listeners
document.getElementById('submitGuess').addEventListener('click', checkGuess);

document.getElementById('guessInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        checkGuess();
    }
});

document.getElementById('skipBtn').addEventListener('click', skipSong);
document.getElementById('nextBtn').addEventListener('click', nextRound);
document.getElementById('repeatBtn').addEventListener('click', repeatSong);
