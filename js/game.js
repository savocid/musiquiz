// game.js - Main game logic with partial matching and progress bar

let collectionsUrl = localStorage.getItem('collectionsUrl') || '';

let gameState = {
    collection: null,
    settings: null,
    baseUrl: '',
    currentSongIndex: 0,
    score: 0,
    artistsGuessed: 0,  // Total artists guessed correctly
    songsGuessed: 0,    // Total songs guessed correctly
    totalArtistsSoFar: 0,  // Total artists encountered so far
    totalSongsSoFar: 0,    // Total songs encountered so far
    lives: 3,
    totalLives: 3,  // Track total lives to keep hearts in DOM
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
    canGuess: true,
    // Lifelines
    lifelines: {
        time: { remaining: 0, total: 0 },
        hint: { remaining: 0, total: 0 },
        year: { remaining: 0, total: 0 },
        skip: { remaining: 0, total: 0 }
    },
    lifelineUsedThisRound: { time: false, hint: false, year: false, skip: false },  // Track per-round usage
    hintLettersRevealed: { artists: [], song: [] },  // Track revealed letter positions
    yearRevealed: false  // Track if year has been revealed
};

// Initialize game
document.addEventListener('DOMContentLoaded', async () => {
    // Clear data button
    const clearDataBtn = document.getElementById('clearDataBtn');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', () => {
            localStorage.clear();
            location.reload();
        });
    }
    
    await loadGameData();
});

async function loadGameData() {
    const MODES = {
        trivial: { lives: 999, clipDuration: 20, timeout: 0 },
        default: { lives: 3, clipDuration: 15, timeout: 0 },
        hard: { lives: 3, clipDuration: 10, timeout: 20 },
        'sudden-death': { lives: 1, clipDuration: 5, timeout: 10 }
    };
    
    // Get URL parameters
    const params = new URLSearchParams(window.location.search);
    const collectionId = params.get('collection');
    const mode = params.get('mode') || localStorage.getItem('selectedMode') || 'default';
    
    if (!collectionId) {
        console.error('No collection ID in URL');
        showCollectionError();
        return;
    }
    
    try {
        // Fetch collection data
        let dataUrl = collectionsUrl;
        if (dataUrl.endsWith('/')) {
            dataUrl += 'data.json';
        } else if (!dataUrl.endsWith('/data.json')) {
            dataUrl += '/data.json';
        }
        const response = await fetch('https://' + dataUrl);
        if (!response.ok) {
            console.error('Failed to fetch data.json:', response.status, response.statusText);
            showCollectionError();
            return;
        }
        const data = await response.json();
        gameState.collection = data.collections.find(c => c.id === collectionId);
        
        if (!gameState.collection) {
            console.error('Collection not found:', collectionId);
            showCollectionError();
            return;
        }
        
        // Set base URL for audio files
        gameState.baseUrl = 'https://' + collectionsUrl;
        
        // Always use current MODES definition (ensures fresh settings)
        gameState.settings = { ...MODES[mode], mode: mode, collectionId: collectionId };
        
        gameState.lives = gameState.settings.lives;
        gameState.totalLives = gameState.settings.lives;
        gameState.clipDuration = gameState.settings.clipDuration;
        gameState.timeout = gameState.settings.timeout;
        gameState.hasTimeout = gameState.timeout > 0;
        
        // Initialize lifelines based on mode
        if (gameState.lives === 999) {
            // Trivial Mode: Hint (infinite), Year (infinite), Skip (infinite)
            gameState.lifelines.hint = { remaining: 999, total: 999 };
            gameState.lifelines.time = { remaining: 0, total: 0 };
            gameState.lifelines.year = { remaining: 999, total: 999 };
            gameState.lifelines.skip = { remaining: 999, total: 999 };
        } else if (gameState.lives === 3) {
            // Check timeout to differentiate Default from Hard
            if (gameState.timeout > 0) {
                // Hard Mode: Time (1x), Hint (1x), Year (1x), Skip (1x)
                gameState.lifelines.time = { remaining: 1, total: 1 };
                gameState.lifelines.hint = { remaining: 1, total: 1 };
                gameState.lifelines.year = { remaining: 1, total: 1 };
                gameState.lifelines.skip = { remaining: 1, total: 1 };
            } else {
                // Default Mode: Hint (1x), Year (1x), Skip (1x)
                gameState.lifelines.hint = { remaining: 1, total: 1 };
                gameState.lifelines.time = { remaining: 0, total: 0 };
                gameState.lifelines.year = { remaining: 1, total: 1 };
                gameState.lifelines.skip = { remaining: 1, total: 1 };
            }
        } else if (gameState.lives === 1) {
            // Sudden Death: Timer (1x), Hint (1x), Year (1x), Skip (1x)
            gameState.lifelines.time = { remaining: 1, total: 1 };
            gameState.lifelines.hint = { remaining: 1, total: 1 };
            gameState.lifelines.year = { remaining: 1, total: 1 };
            gameState.lifelines.skip = { remaining: 1, total: 1 };
        }
        
        // Populate start screen
        document.getElementById('collectionTitle').textContent = gameState.collection.title;
        document.getElementById('collectionDescription').textContent = gameState.collection.description || '';
        document.getElementById('collectionDifficulty').textContent = gameState.collection.difficulty || 'Medium';
        document.getElementById('gameRounds').textContent = gameState.collection.rounds || gameState.collection.songs.length;
        
        // Add start button listener
        document.getElementById('startGameBtn').addEventListener('click', () => {
            // Hide start screen, show game
            document.getElementById('startScreen').style.display = 'none';
            document.getElementById('gameContent').style.display = 'block';
            initializeGame();
        });
    } catch (error) {
        console.error('Failed to load collection:', error);
        showCollectionError();
    }
}

function showCollectionError() {
    document.getElementById('collectionTitle').style.display = 'none';
    document.getElementById('collectionDescription').style.display = 'none';
    document.querySelector('#startScreen > div').style.display = 'none'; // Hide the difficulty/rounds grid
    document.getElementById('startGameBtn').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'block';
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
    // Always clear and null guess timer for new round
    clearInterval(gameState.guessTimer);
    gameState.guessTimer = null;
    gameState.currentSong = gameState.shuffledSongs[gameState.currentSongIndex];
    gameState.artistsRevealed = [];
    gameState.songRevealed = false;
    gameState.canGuess = true;
    gameState.hintLettersRevealed = { artists: [], song: [] };  // Reset hint state
    gameState.yearRevealed = false;  // Reset year reveal
    gameState.lifelineUsedThisRound = { time: false, hint: false, year: false, skip: false };  // Reset per-round usage
    
    // Update total artists/songs counters
    gameState.totalArtistsSoFar += gameState.currentSong.artists.length;
    gameState.totalSongsSoFar += 1;
    
    // Clear input
    document.getElementById('guessInput').value = '';
    document.getElementById('guessInput').disabled = false;
    
    // Auto-focus input so player can start typing immediately
    setTimeout(() => {
        document.getElementById('guessInput').focus();
    }, 100);
    
    // Reset UI elements
    document.getElementById('nextButtonContainer').style.display = 'none';
    document.getElementById('actionButtons').style.display = 'block';
    document.getElementById('repeatBtn').style.display = 'none';
    document.getElementById('progressBar').style.width = '0%';
    
    // Update answer display (hidden)
    updateAnswerDisplay();
    
    // Update UI (score, lives, round number)
    updateUI();
    
    // Update give up button text and visibility
    const giveUpBtn = document.getElementById('giveUpBtn');
    if (giveUpBtn) {
        giveUpBtn.style.display = 'inline-block';
        giveUpBtn.textContent = 'Give Up';
    }
    
    // Show timer if has timeout
    if (gameState.hasTimeout) {
        document.getElementById('timerDisplay').style.display = 'block';
    } else {
        document.getElementById('timerDisplay').style.display = 'none';
    }
    
    // Update lifeline buttons
    updateLifelineButtons();
    
    // Play audio (start countdown)
    playSong(true);
}

function playSong(restartCountdown = false) {
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
    let audioUrl = song.audioFile.startsWith('http') ? song.audioFile : gameState.baseUrl + '/' + song.audioFile;
    gameState.audio = new Audio(audioUrl);
    gameState.audio.volume = getCurrentVolume();
    gameState.audio.currentTime = startTime;

    // Start countdown only if requested (new round)
    if (restartCountdown && gameState.hasTimeout && gameState.canGuess) {
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
            // Always pause audio and stop progress bar when clip duration is reached
            if (gameState.audio) {
                gameState.audio.pause();
            }
            stopProgressBar();
            
            // Always show replay button after clip ends (unless game is over)
            if (gameState.lives > 0) {
                document.getElementById('repeatBtn').style.display = 'inline-block';
                document.getElementById('progressTimer').style.display = 'none';
            }
        }
    }, gameState.clipDuration * 1000);
    
    // Set up audio end listener with round validation
    gameState.audio.addEventListener('ended', () => {
        // Only stop if we're still on the same round
        if (gameState.currentRoundId === thisRoundId) {
            stopProgressBar();
            // Show replay button when audio naturally ends (unless game is over)
            if (gameState.lives > 0) {
                document.getElementById('repeatBtn').style.display = 'inline-block';
                document.getElementById('progressTimer').style.display = 'none';
            }
        }
    });
    
    // Make progress bar interactive
    setupProgressBarInteraction();
}

function startProgressBar() {
    const progressBar = document.getElementById('progressBar');
    const progressTimer = document.getElementById('progressTimer');
    const duration = gameState.clipDuration * 1000; // in ms
    const startTime = Date.now();
    
    // Show timer
    progressTimer.style.display = 'block';
    
    gameState.progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const percent = Math.min((elapsed / duration) * 100, 100);
        progressBar.style.width = percent + '%';
        
        // Update countdown timer
        const remaining = Math.max(0, Math.ceil((duration - elapsed) / 1000));
        progressTimer.textContent = remaining + 's';
        
        if (percent >= 100) {
            clearInterval(gameState.progressInterval);
            progressTimer.textContent = '0s';
        }
    }, 50); // Update every 50ms for smooth animation
}

function stopProgressBar() {
    if (gameState.progressInterval) {
        clearInterval(gameState.progressInterval);
        document.getElementById('progressBar').style.width = '100%';
        document.getElementById('progressTimer').textContent = '0s';
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
            
            // Store whether audio was playing before seek
            const wasPlaying = !gameState.audio.paused;
            
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
            
            // Always resume playing after seeking
            gameState.audio.play().catch(err => console.error('Error playing audio after seek:', err));
            
            // Restart progress bar from new position
            clearInterval(gameState.progressInterval);
            const remainingDuration = (gameState.clipDuration - targetTime) * 1000; // in ms
            const seekStartTime = Date.now();
            const progressBarEl = document.getElementById('progressBar');
            const progressTimerEl = document.getElementById('progressTimer');
            
            // Set initial progress bar position
            progressBarEl.style.width = (percentClicked * 100) + '%';
            
            // Restart progress bar animation from seek position
            gameState.progressInterval = setInterval(() => {
                const elapsed = Date.now() - seekStartTime;
                const additionalPercent = (elapsed / remainingDuration) * (100 - (percentClicked * 100));
                const totalPercent = Math.min((percentClicked * 100) + additionalPercent, 100);
                progressBarEl.style.width = totalPercent + '%';
                // Only update the progress timer (clip), not the guess timer
                const remaining = Math.max(0, Math.ceil((remainingDuration - elapsed) / 1000));
                progressTimerEl.textContent = remaining + 's';
                if (totalPercent >= 100) {
                    clearInterval(gameState.progressInterval);
                    progressTimerEl.textContent = '0s';
                }
            }, 50);
            
            // Clear and restart the clip timer to maintain the total clip duration
            clearTimeout(gameState.clipTimer);
            const remainingTime = gameState.clipDuration - targetTime;
            const thisRoundId = gameState.currentRoundId;
            
            gameState.clipTimer = setTimeout(() => {
                // Only pause if we're still on the same round
                if (gameState.currentRoundId === thisRoundId) {
                    // Always pause audio and stop progress bar when clip duration is reached
                    if (gameState.audio) {
                        gameState.audio.pause();
                    }
                    stopProgressBar();
                    
                    // Always show replay button after clip ends (unless game is over)
                    if (gameState.lives > 0) {
                        document.getElementById('repeatBtn').style.display = 'inline-block';
                        document.getElementById('progressTimer').style.display = 'none';
                    }
                }
            }, remainingTime * 1000);
        });
        
        progressContainer.dataset.hasListener = 'true';
    }
}

function startCountdown() {
    // Always clear any existing guess timer before starting a new one
    clearInterval(gameState.guessTimer);
    let timeLeft = gameState.timeout;
    const timerElement = document.getElementById('timer');
    timerElement.textContent = timeLeft;
    // Update color based on time remaining
    updateTimerColor(timeLeft, gameState.timeout);
    gameState.guessTimer = setInterval(() => {
        timeLeft--;
        timerElement.textContent = timeLeft;
        // Update color as time decreases
        updateTimerColor(timeLeft, gameState.timeout);
        if (timeLeft <= 0) {
            clearInterval(gameState.guessTimer);
            // Time's up - mark as incorrect
            handleTimeout();
        }
    }, 1000);
}

function updateTimerColor(timeLeft, totalTime) {
    const timerElement = document.getElementById('timer');
    const percentage = timeLeft / totalTime;
    
    // Interpolate from green (100%) to red (0%)
    // Green: rgb(72, 187, 120) -> Yellow: rgb(255, 193, 7) -> Red: rgb(244, 67, 54)
    let r, g, b;
    
    if (percentage > 0.5) {
        // Green to Yellow (100% to 50%)
        const t = (1 - percentage) * 2; // 0 to 1
        r = Math.round(72 + (255 - 72) * t);
        g = Math.round(187 + (193 - 187) * t);
        b = Math.round(120 + (7 - 120) * t);
    } else {
        // Yellow to Red (50% to 0%)
        const t = (0.5 - percentage) * 2; // 0 to 1
        r = Math.round(255 + (244 - 255) * t);
        g = Math.round(193 + (67 - 193) * t);
        b = Math.round(7 + (54 - 7) * t);
    }
    
    timerElement.style.color = `rgb(${r}, ${g}, ${b})`;
}

function handleTimeout() {
    gameState.canGuess = false;
    
    // Deduct life
    if (gameState.lives !== 999) {
        gameState.lives--;
    }
    
    // Don't reveal answers on timeout (only reveal on correct guess or hints)
    // Keep the answer hidden so player can try again next round
    
    // Update UI first so lives count is correct
    updateUI();
    
    // Check game over
    if (gameState.lives <= 0) {
        // On game over, reveal the answer
        gameState.artistsRevealed = gameState.currentSong.artists.map((_, i) => i);
        gameState.songRevealed = true;
        updateAnswerDisplay();
        
        // Hide action buttons immediately
        document.getElementById('actionButtons').style.display = 'none';
        document.getElementById('guessInput').disabled = true;
        // Go directly to game over immediately
        endGame(false);
    } else {
        // Show result and next button if still alive (without revealing answer)
        showResult('Time\'s up!', "incorrect");
    }
}

function checkGuess() {
    if (!gameState.canGuess) return;
    
    const userInput = document.getElementById('guessInput').value.trim();
    if (!userInput) return;
    
    // Normalize function
    const normalize = (str) => str.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const normalizedInput = normalize(userInput);
    
    const song = gameState.currentSong;
    let artistCorrect = false;
    let songCorrect = false;
    let newCorrectGuess = false;
    let artistsRevealedBefore = gameState.artistsRevealed.length;
    
    const guessSongOnly = gameState.collection && gameState.collection.guessSongOnly;
    if (guessSongOnly) {
        // Only check song title
        if (!gameState.songRevealed) {
            const normalizedTitle = normalize(song.title);
            if (normalizedInput === normalizedTitle || normalizedInput.includes(normalizedTitle)) {
                gameState.songRevealed = true;
                songCorrect = true;
                newCorrectGuess = true;
            }
        }
    } else {
        // Check each artist - exact match or contained in input
        song.artists.forEach((artist, index) => {
            if (!gameState.artistsRevealed.includes(index)) {
                const normalizedArtist = normalize(artist);
                if (normalizedInput === normalizedArtist || normalizedInput.includes(normalizedArtist)) {
                    gameState.artistsRevealed.push(index);
                    artistCorrect = true;
                    newCorrectGuess = true;
                }
            }
        });
        // Check song title - exact match or contained in input
        if (!gameState.songRevealed) {
            const normalizedTitle = normalize(song.title);
            if (normalizedInput === normalizedTitle || normalizedInput.includes(normalizedTitle)) {
                gameState.songRevealed = true;
                songCorrect = true;
                newCorrectGuess = true;
            }
        }
    }
    
    // Update display
    updateAnswerDisplay();
    
    // Award points and check completion
    let fullyGuessed = false;
    if (guessSongOnly) {
        if (songCorrect) {
            gameState.score += 100;
            gameState.songsGuessed++;
            fullyGuessed = gameState.songRevealed;
        }
    } else {
        if (artistCorrect) {
            gameState.score += 50;
            const artistsRevealedAfter = gameState.artistsRevealed.length;
            gameState.artistsGuessed += (artistsRevealedAfter - artistsRevealedBefore);
        }
        if (songCorrect) {
            gameState.score += 100;
            gameState.songsGuessed++;
        }
        const allArtistsRevealed = gameState.artistsRevealed.length === song.artists.length;
        fullyGuessed = allArtistsRevealed && gameState.songRevealed;
    }
    // Only stop countdown timer if fully guessed (but keep clip timer running)
    if (fullyGuessed) {
        clearInterval(gameState.guessTimer);
        gameState.canGuess = false;
    }
    
    // Build result message
    let resultMsg = '';
    if (guessSongOnly) {
        if (songCorrect) {
            resultMsg = '✓ Song Correct!';
        } else {
            resultMsg = '✗ Incorrect';
            if (!newCorrectGuess && gameState.lives !== 999) {
                gameState.lives--;
            }
        }
    } else {
        if (artistCorrect && songCorrect) {
            resultMsg = '✓ Artist and Song Correct!';
        } else if (artistCorrect) {
            resultMsg = '✓ Artist Correct!';
        } else if (songCorrect) {
            resultMsg = '✓ Song Correct!';
        } else {
            resultMsg = '✗ Incorrect';
            if (!newCorrectGuess && gameState.lives !== 999) {
                gameState.lives--;
            }
        }
    }
    
    // Update UI first so lives count is correct
    updateUI();
    
    // Check game over BEFORE showing result
    if (gameState.lives <= 0) {
        // Hide action buttons immediately
        document.getElementById('actionButtons').style.display = 'none';
        document.getElementById('guessInput').disabled = true;
        document.getElementById('guessInput').value = '';
        // Go directly to game over immediately
        endGame(false);
        return; // Exit early, don't show result or check for fully guessed
    }
    
    // Show result (only if not game over)
    if (artistCorrect || songCorrect) {
        showResult(resultMsg, 'correct');
    } else {
        // Add shake animation to answer display
        const answerDisplay = document.querySelector('.answer-display');
        if (answerDisplay) {
            answerDisplay.classList.remove('shake');
            // Force reflow to restart animation if needed
            void answerDisplay.offsetWidth;
            answerDisplay.classList.add('shake');
            // Remove the class after animation ends
            setTimeout(() => answerDisplay.classList.remove('shake'), 400);
        }
        showResult(resultMsg, 'incorrect');
    }
    
    // Clear input for next guess
    document.getElementById('guessInput').value = '';
    
    // Re-focus input so player can continue typing
    setTimeout(() => {
        const input = document.getElementById('guessInput');
        if (!input.disabled) {
            input.focus();
        }
    }, 100);
}

function updateAnswerDisplay() {
    const song = gameState.currentSong;
    const artistPart = document.getElementById('artistPart');
    const songPart = document.getElementById('songPart');
    const separator = document.querySelector('.answer-display-wrapper .separator');
    
    // Helper function to build hint display
    const buildHintDisplay = (text, revealedIndices) => {
        if (!revealedIndices || revealedIndices.length === 0) {
            return text.split('').map(char => char === ' ' ? ' ' : '_').join('');
        }
        return text.split('').map((char, i) => {
            if (char === ' ') return ' ';
            if (revealedIndices.includes(i)) {
                return `<span class="revealed">${char}</span>`;
            }
            return '_';
        }).join('');
    };
    
    // Hide artist display if guessSongOnly is enabled
    const guessSongOnly = gameState.collection && gameState.collection.guessSongOnly;
    if (guessSongOnly) {
        artistPart.innerHTML = '';
        // Hide the separator if no artist part, but keep SONG placeholder visible
        if (separator) separator.style.display = 'none';
    } else {
        const artistDisplay = song.artists.map((artist, index) => {
            if (gameState.artistsRevealed.includes(index)) {
                return `<span class="revealed">${artist}</span>`;
            } else {
                // Check if hints are active for this artist
                const hintLetters = gameState.hintLettersRevealed.artists[index];
                if (hintLetters && hintLetters.length > 0) {
                    const hintText = buildHintDisplay(artist, hintLetters);
                    return `<span class="hint">${hintText}</span>`;
                } else {
                    return `<span class="hidden">ARTIST ${index + 1}</span>`;
                }
            }
        }).join(', ');
        artistPart.innerHTML = artistDisplay;
        if (separator) separator.style.display = '';
    }
    
    // Build song display with optional year
    let songDisplay = '';
    if (gameState.songRevealed) {
        songDisplay = `<span class="revealed">${song.title}</span>`;
    } else {
        // Check if hints are active for song
        const hintLetters = gameState.hintLettersRevealed.song;
        if (hintLetters && hintLetters.length > 0) {
            const hintText = buildHintDisplay(song.title, hintLetters);
            songDisplay = `<span class="hint">${hintText}</span>`;
        } else {
            songDisplay = `<span class="hidden">SONG</span>`;
        }
    }
    
    // Add year if revealed
    if (gameState.yearRevealed && song.year) {
        songDisplay += ` <span class="revealed">(${song.year})</span>`;
    }
    
    songPart.innerHTML = songDisplay;
}

function showResult(message, resultType) {
    // Animation is now handled in checkGuess before life deduction
    
    // Check if fully guessed
    const song = gameState.currentSong;
    const allArtistsRevealed = gameState.artistsRevealed.length === song.artists.length;
    const fullyGuessed = allArtistsRevealed && gameState.songRevealed;
    
    // Show next button and disable input if fully guessed or timeout (but not if game over)
    if ((fullyGuessed || !gameState.canGuess) && gameState.lives > 0) {
        // Check if this is the last round
        const isLastRound = gameState.currentSongIndex + 1 >= gameState.shuffledSongs.length;
        
        if (isLastRound) {
            // Last round - go directly to success screen
            endGame(true);
        } else {
            // Not last round - show next button
            document.getElementById('nextButtonContainer').style.display = 'block';
            document.getElementById('actionButtons').style.display = 'none';
            document.getElementById('guessInput').disabled = true;
            
            // Disable all lifeline buttons during next phase
            document.querySelectorAll('.btn-lifeline').forEach(btn => {
                btn.disabled = true;
            });
        }
    }
}

function giveUp() {
    // Stop audio and timers
    if (gameState.audio) {
        gameState.audio.pause();
    }
    clearTimeout(gameState.clipTimer);
    clearInterval(gameState.guessTimer);
    stopProgressBar();
    
    // Go directly to end screen (failure)
    endGame(false);
}

function useSkipLifeline() {
    const isInfinite = gameState.lifelines.skip.total === 999;
    const canUse = isInfinite ? !gameState.lifelineUsedThisRound.skip : gameState.lifelines.skip.remaining > 0;
    
    if (!canUse || !gameState.canGuess) return;
    
    // Stop audio and timers
    if (gameState.audio) {
        gameState.audio.pause();
    }
    clearTimeout(gameState.clipTimer);
    clearInterval(gameState.guessTimer);
    stopProgressBar();
    
    // Mark as used this round or deduct if limited
    if (isInfinite) {
        gameState.lifelineUsedThisRound.skip = true;
    } else {
        gameState.lifelines.skip.remaining--;
    }
    
    // Go directly to next round
    gameState.currentSongIndex++;
    startRound();
}

function repeatSong() {
    // Hide repeat button and show timer
    document.getElementById('repeatBtn').style.display = 'none';
    document.getElementById('progressTimer').style.display = 'block';
    
    // Stop current audio and timers (but NOT the guess timer - let it continue)
    if (gameState.audio) {
        gameState.audio.pause();
    }
    clearTimeout(gameState.clipTimer);
    clearInterval(gameState.progressInterval);
    
    // Reset progress bar
    document.getElementById('progressBar').style.width = '0%';
    
    // Replay song (do not restart countdown)
    playSong(false);
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
    
    // Re-enable lifeline buttons for new round (they'll be updated based on availability)
    updateLifelineButtons();
}

function endGame(completed) {
    // Stop everything
    if (gameState.audio) {
        gameState.audio.pause();
    }
    clearTimeout(gameState.clipTimer);
    clearInterval(gameState.guessTimer);
    clearInterval(gameState.progressInterval);
    
    // Hide game elements, show result screen
    document.getElementById('resultScreen').style.display = 'block';
    document.getElementById('actionButtons').style.display = 'none';
    document.getElementById('nextButtonContainer').style.display = 'none';
    document.getElementById('answerDisplay').style.display = 'none';
    document.getElementById('guessInput').style.display = 'none';
    document.getElementById('timerDisplay').style.display = 'none';
    document.getElementById('lifelineButtons').style.display = 'none';
    document.querySelector('.progress-container').style.display = 'none';
    document.querySelector('.game-info').style.display = 'none';
    
    // Update result screen based on success/failure
    const resultStatus = document.getElementById('resultStatus');
    
    if (completed) {
        resultStatus.textContent = 'Success!';
        resultStatus.style.color = '#48bb78'; // Green
    } else {
        resultStatus.textContent = 'Failure';
        resultStatus.style.color = '#f56565'; // Red
    }
    
    // Update collection info
    document.getElementById('resultCollection').textContent = gameState.collection.title;
    document.getElementById('resultDescription').textContent = gameState.collection.description || '';
    document.getElementById('resultDifficulty').textContent = gameState.collection.difficulty || 'Medium';
    document.getElementById('resultRounds').textContent = gameState.shuffledSongs.length;
    
    // Update mode info (just the name, not "Mode")
    let modeName = '';
    if (gameState.lives === 999 || (gameState.settings && gameState.settings.lives === 999)) {
        modeName = 'Trivial';
    } else if (gameState.lives === 3 || (gameState.settings && gameState.settings.lives === 3)) {
        // Check timeout to differentiate Default from Hard
        if (gameState.timeout > 0 || (gameState.settings && gameState.settings.timeout > 0)) {
            modeName = 'Hard';
        } else {
            modeName = 'Default';
        }
    } else if (gameState.lives === 1 || (gameState.settings && gameState.settings.lives === 1)) {
        modeName = 'Sudden Death';
    }
    document.getElementById('resultMode').textContent = modeName;
    
    // Update stats
    // If completed successfully, we've finished all rounds (including the current one)
    // If failed, currentSongIndex shows how many we completed (0-based, but incremented after each)
    const roundsCompleted = completed ? gameState.shuffledSongs.length : gameState.currentSongIndex;
    document.getElementById('roundsAchieved').textContent = roundsCompleted;
    document.getElementById('totalRounds').textContent = gameState.shuffledSongs.length;
    document.getElementById('artistsGuessed').textContent = gameState.artistsGuessed;
    document.getElementById('totalArtists').textContent = gameState.totalArtistsSoFar;
    document.getElementById('songsGuessed').textContent = gameState.songsGuessed;
    document.getElementById('totalSongs').textContent = gameState.totalSongsSoFar;
    
    // Display hearts if mode uses lives
    const heartsContainer = document.getElementById('resultHearts');
    const heartsDisplay = document.getElementById('resultHeartsDisplay');
    const totalLives = gameState.totalLives;
    
    if (totalLives !== 999) {
        heartsContainer.style.display = 'block';
        let heartsHTML = '';
        
        for (let i = 0; i < totalLives; i++) {
            const isLost = i >= gameState.lives;
            const style = isLost ? 'filter: grayscale(100%); opacity: 0.5;' : '';
            heartsHTML += `<span style="${style}">❤️</span>`;
        }
        
        heartsDisplay.innerHTML = heartsHTML;
    } else {
        heartsContainer.style.display = 'none';
    }
    
    // Display lifelines if any were available
    const lifelineContainer = document.getElementById('resultLifelines');
    const lifelineDisplay = document.getElementById('resultLifelinesDisplay');
    const hasLifelines = gameState.lifelines.time.total > 0 || gameState.lifelines.hint.total > 0 || 
                         gameState.lifelines.year.total > 0 || gameState.lifelines.skip.total > 0;
    
    if (hasLifelines) {
        lifelineContainer.style.display = 'block';
        let lifelinesHTML = '';
        
        // Time lifeline
        if (gameState.lifelines.time.total > 0) {
            const used = gameState.lifelines.time.total === 999 ? 
                         false : gameState.lifelines.time.remaining < gameState.lifelines.time.total;
            const style = used ? 'filter: grayscale(100%); opacity: 0.5;' : '';
            lifelinesHTML += `<span style="${style}" title="Time: ${used ? 'Used' : 'Unused'}">⏱️</span>`;
        }
        
        // Hint lifeline
        if (gameState.lifelines.hint.total > 0) {
            const used = gameState.lifelines.hint.total === 999 ? 
                         false : gameState.lifelines.hint.remaining < gameState.lifelines.hint.total;
            const style = used ? 'filter: grayscale(100%); opacity: 0.5;' : '';
            lifelinesHTML += `<span style="${style}" title="Hint: ${used ? 'Used' : 'Unused'}">💡</span>`;
        }
        
        // Year lifeline
        if (gameState.lifelines.year.total > 0) {
            const used = gameState.lifelines.year.total === 999 ? 
                         false : gameState.lifelines.year.remaining < gameState.lifelines.year.total;
            const style = used ? 'filter: grayscale(100%); opacity: 0.5;' : '';
            lifelinesHTML += `<span style="${style}" title="Year: ${used ? 'Used' : 'Unused'}">📅</span>`;
        }
        
        // Skip lifeline
        if (gameState.lifelines.skip.total > 0) {
            const used = gameState.lifelines.skip.total === 999 ? 
                         false : gameState.lifelines.skip.remaining < gameState.lifelines.skip.total;
            const style = used ? 'filter: grayscale(100%); opacity: 0.5;' : '';
            lifelinesHTML += `<span style="${style}" title="Skip: ${used ? 'Used' : 'Unused'}">⏭️</span>`;
        }
        
        lifelineDisplay.innerHTML = lifelinesHTML;
    } else {
        lifelineContainer.style.display = 'none';
    }
}

function updateUI() {
    // Update score display with artist/song stats
    document.getElementById('artistScore').textContent = `${gameState.artistsGuessed}/${gameState.totalArtistsSoFar}`;
    document.getElementById('songScore').textContent = `${gameState.songsGuessed}/${gameState.totalSongsSoFar}`;
    
    // Update lives display with hearts
    const livesElement = document.getElementById('lives');
    const livesContainer = livesElement.parentElement;
    
    if (gameState.totalLives === 999) {
        // Hide lives display for infinite lives
        livesContainer.style.display = 'none';
    } else {
        livesContainer.style.display = 'block';
        // Create all hearts once if not already created
        if (livesElement.querySelectorAll('.heart').length === 0) {
            const heartsArray = [];
            for (let i = 0; i < gameState.totalLives; i++) {
                heartsArray.push('<span class="heart">❤️</span>');
            }
            livesElement.innerHTML = heartsArray.join('');
        }
        // Show/hide hearts based on current lives
        const hearts = livesElement.querySelectorAll('.heart');
        hearts.forEach((heart, index) => {
            if (index < gameState.lives) {
                heart.style.visibility = 'visible';
                heart.style.opacity = '1';
            } else if (index === gameState.lives) {
                // This is the heart that just got lost - animate it
                heart.style.visibility = 'visible'; // Keep visible during animation
                if (!heart.classList.contains('heartbeat')) {
                    heart.classList.add('heartbeat');
                }
            } else {
                // Hearts already lost
                heart.style.visibility = 'hidden';
                heart.style.opacity = '0';
                heart.classList.remove('heartbeat');
            }
        });
    }
    
    document.getElementById('round').textContent = gameState.currentSongIndex + 1;
    document.getElementById('total').textContent = gameState.shuffledSongs.length;
}

// Lifeline Functions
function updateLifelineButtons() {
    const lifelineContainer = document.getElementById('lifelineButtons');
    const timeBtn = document.getElementById('timeLifeline');
    const hintBtn = document.getElementById('hintLifeline');
    const yearBtn = document.getElementById('yearLifeline');
    const timeCount = document.getElementById('timeCount');
    const hintCount = document.getElementById('hintCount');
    const yearCount = document.getElementById('yearCount');
    
    // Show container if any lifelines are available
    const hasLifelines = gameState.lifelines.time.total > 0 || gameState.lifelines.hint.total > 0 || gameState.lifelines.year.total > 0;
    lifelineContainer.style.display = hasLifelines ? 'flex' : 'none';
    
    // Time lifeline
    if (gameState.lifelines.time.total > 0) {
        timeBtn.style.display = 'inline-block';
        const isInfinite = gameState.lifelines.time.total === 999;
        const canUse = isInfinite ? !gameState.lifelineUsedThisRound.time : gameState.lifelines.time.remaining > 0;
        timeCount.textContent = isInfinite ? '∞' : gameState.lifelines.time.remaining;
        timeBtn.disabled = !canUse || !gameState.hasTimeout || !gameState.canGuess;
    } else {
        timeBtn.style.display = 'none';
    }
    
    // Hint lifeline
    if (gameState.lifelines.hint.total > 0) {
        hintBtn.style.display = 'inline-block';
        const isInfinite = gameState.lifelines.hint.total === 999;
        const canUse = isInfinite ? !gameState.lifelineUsedThisRound.hint : gameState.lifelines.hint.remaining > 0;
        hintCount.textContent = isInfinite ? '∞' : gameState.lifelines.hint.remaining;
        hintBtn.disabled = !canUse || !gameState.canGuess;
    } else {
        hintBtn.style.display = 'none';
    }
    
    // Year lifeline
    if (gameState.lifelines.year.total > 0) {
        yearBtn.style.display = 'inline-block';
        const isInfinite = gameState.lifelines.year.total === 999;
        const canUse = isInfinite ? !gameState.lifelineUsedThisRound.year : gameState.lifelines.year.remaining > 0;
        yearCount.textContent = isInfinite ? '∞' : gameState.lifelines.year.remaining;
        yearBtn.disabled = !canUse || !gameState.canGuess || gameState.yearRevealed;
    } else {
        yearBtn.style.display = 'none';
    }
    
    // Skip lifeline
    const skipBtn = document.getElementById('skipLifeline');
    const skipCount = document.getElementById('skipCount');
    if (gameState.lifelines.skip.total > 0) {
        skipBtn.style.display = 'inline-block';
        const isInfinite = gameState.lifelines.skip.total === 999;
        const canUse = isInfinite ? !gameState.lifelineUsedThisRound.skip : gameState.lifelines.skip.remaining > 0;
        skipCount.textContent = isInfinite ? '∞' : gameState.lifelines.skip.remaining;
        skipBtn.disabled = !canUse || !gameState.canGuess;
    } else {
        skipBtn.style.display = 'none';
    }
}

function useTimeLifeline() {
    const isInfinite = gameState.lifelines.time.total === 999;
    const canUse = isInfinite ? !gameState.lifelineUsedThisRound.time : gameState.lifelines.time.remaining > 0;
    
    if (!canUse || !gameState.hasTimeout || !gameState.canGuess) return;
    
    // Add 10 seconds to timer
    if (gameState.guessTimer) {
        clearInterval(gameState.guessTimer);
        let currentTime = parseInt(document.getElementById('timer').textContent);
        currentTime += 10;
        document.getElementById('timer').textContent = currentTime;
        
        // Restart countdown with new time
        gameState.guessTimer = setInterval(() => {
            currentTime--;
            document.getElementById('timer').textContent = currentTime;
            
            if (currentTime <= 0) {
                clearInterval(gameState.guessTimer);
                handleTimeout();
            }
        }, 1000);
    }
    
    // Mark as used this round or deduct if limited
    if (isInfinite) {
        gameState.lifelineUsedThisRound.time = true;
    } else {
        gameState.lifelines.time.remaining--;
    }
    
    updateLifelineButtons();
}

function useHintLifeline() {
    const isInfinite = gameState.lifelines.hint.total === 999;
    const canUse = isInfinite ? !gameState.lifelineUsedThisRound.hint : gameState.lifelines.hint.remaining > 0;
    
    if (!canUse || !gameState.canGuess) return;
    
    const song = gameState.currentSong;
    let lettersToReveal = 2;

    
    // Reveal letters for each artist
    song.artists.forEach((artist, artistIndex) => {
        if (!gameState.artistsRevealed.includes(artistIndex)) {
            if (!gameState.hintLettersRevealed.artists[artistIndex]) {
                gameState.hintLettersRevealed.artists[artistIndex] = [];
            }
            
            const letters = artist.split('');
            const letterIndices = letters.map((_, i) => i).filter(i => letters[i] !== ' ');
            const unrevealed = letterIndices.filter(i => !gameState.hintLettersRevealed.artists[artistIndex].includes(i));
            
            // Special rule: if name length equals letters to reveal, reveal one less
            const adjustedCount = unrevealed.length === lettersToReveal ? lettersToReveal - 1 : lettersToReveal;
            const toReveal = Math.min(adjustedCount, unrevealed.length);
            
            for (let i = 0; i < toReveal; i++) {
                const randomIndex = Math.floor(Math.random() * unrevealed.length);
                const letterIndex = unrevealed.splice(randomIndex, 1)[0];
                gameState.hintLettersRevealed.artists[artistIndex].push(letterIndex);
            }
        }
    });
    
    // Reveal letters for song title if not revealed
    if (!gameState.songRevealed) {
        if (!gameState.hintLettersRevealed.song) {
            gameState.hintLettersRevealed.song = [];
        }
        
        const letters = song.title.split('');
        const letterIndices = letters.map((_, i) => i).filter(i => letters[i] !== ' ');
        const unrevealed = letterIndices.filter(i => !gameState.hintLettersRevealed.song.includes(i));
        
        // Special rule: if name length equals letters to reveal, reveal one less
        const adjustedCount = unrevealed.length === lettersToReveal ? lettersToReveal - 1 : lettersToReveal;
        const toReveal = Math.min(adjustedCount, unrevealed.length);
        
        for (let i = 0; i < toReveal; i++) {
            const randomIndex = Math.floor(Math.random() * unrevealed.length);
            const letterIndex = unrevealed.splice(randomIndex, 1)[0];
            gameState.hintLettersRevealed.song.push(letterIndex);
        }
    }
    
    // Mark as used this round or deduct if limited
    if (isInfinite) {
        gameState.lifelineUsedThisRound.hint = true;
    } else {
        gameState.lifelines.hint.remaining--;
    }
    
    // Update display with hints
    updateAnswerDisplay();
    updateLifelineButtons();
}

function useYearLifeline() {
    const isInfinite = gameState.lifelines.year.total === 999;
    const canUse = isInfinite ? !gameState.lifelineUsedThisRound.year : gameState.lifelines.year.remaining > 0;
    
    if (!canUse || !gameState.canGuess || gameState.yearRevealed) return;
    
    const song = gameState.currentSong;
    
    // Reveal year if available
    if (song.year) {
        gameState.yearRevealed = true;
    }
    
    // Mark as used this round or deduct if limited
    if (isInfinite) {
        gameState.lifelineUsedThisRound.year = true;
    } else {
        gameState.lifelines.year.remaining--;
    }
    
    // Update display to show year
    updateAnswerDisplay();
    updateLifelineButtons();
}

// Event listeners
document.getElementById('submitGuess').addEventListener('click', checkGuess);

document.getElementById('guessInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        checkGuess();
    }
});

document.getElementById('giveUpBtn').addEventListener('click', giveUp);
document.getElementById('nextBtn').addEventListener('click', nextRound);

// Global keydown listener to capture typing anywhere on the page during gameplay
document.addEventListener('keydown', (e) => {
    const guessInput = document.getElementById('guessInput');
    const gameContent = document.getElementById('gameContent');
    
    // Only handle if game is active and input is enabled
    if (gameContent.style.display !== 'none' && !guessInput.disabled) {
        // Ignore if modifier keys are pressed (Ctrl, Alt, Meta)
        if (e.ctrlKey || e.altKey || e.metaKey) {
            return;
        }
        
        // Ignore special keys that shouldn't trigger input focus
        const ignoredKeys = ['Tab', 'Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];
        if (ignoredKeys.includes(e.key)) {
            return;
        }
        
        // If input is not focused and user types a printable character
        if (document.activeElement !== guessInput) {
            // Check if it's a printable character (letters, numbers, space, etc.)
            if (e.key.length === 1) {
                guessInput.focus();
                // The character will be automatically added by the browser's default behavior
            } else if (e.key === 'Backspace' || e.key === 'Delete') {
                // Also focus on backspace/delete
                guessInput.focus();
            }
        }
    }
});
document.getElementById('repeatBtn').addEventListener('click', repeatSong);

// Lifeline event listeners
document.getElementById('timeLifeline').addEventListener('click', useTimeLifeline);
document.getElementById('hintLifeline').addEventListener('click', useHintLifeline);
document.getElementById('yearLifeline').addEventListener('click', useYearLifeline);
document.getElementById('skipLifeline').addEventListener('click', useSkipLifeline);
