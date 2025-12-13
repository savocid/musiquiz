// Helper function to get audio duration
function getAudioDuration(audioUrl) {
    return new Promise((resolve, reject) => {
        const audio = new Audio();
        
        audio.addEventListener('loadedmetadata', () => {
            resolve(audio.duration);
        });
        
        audio.addEventListener('error', (error) => {
            reject(error);
        });
        
        audio.src = audioUrl;
        audio.load();
    });
}

// Helper function to normalize strings for comparison
function normalize_str(str) {
    return str.toLowerCase().trim().replace(/^the\s+/, '').replace(/^a\s+/, '').replace(/^an\s+/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace('&','and').replace(/[^a-z0-9 ]/g, '').replace('  ',' ').trim();
}

// Helper function to format seconds as MM:SS
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Helper function to check if guess matches any title
function matchesTitle(song, normalizedInput) {
    if (song.title && song.title.length > 1) {
        return song.title.slice(1).some(t => normalize_str(t) === normalizedInput || normalizedInput.includes(normalize_str(t)));
    } else if (song.title) {
        const normalizedTitle = normalize_str(song.title);
        return normalizedInput === normalizedTitle || normalizedInput.includes(normalizedTitle);
    }
    return false;
}

// Helper function to get the primary title
function getTitle(song) {
    if (song.title && song.title.length > 1) {
        return song.title[1];
    } else if (song.title) {
        return song.title;
    }
    return '';
}

let gameState = {
    collection: null,
    settings: null,
    baseUrl: '',
    currentSongIndex: 0,
    score: 0,
    sourceGuessed: 0,  // Total sources guessed correctly
    songsGuessed: 0,    // Total songs guessed correctly
    totalSourcesSoFar: 0,  // Total sources encountered so far
    totalSongsSoFar: 0,    // Total songs encountered so far
    lives: 3,
    totalLives: 3,  // Track total lives to keep hearts in DOM
    shuffledSongs: [],
    audio: null,
    clipTimer: null,
    guessTimer: null,
    progressInterval: null,
    currentSong: null,
    sourceRevealed: [],  // Track which sources have been guessed
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
    hintLettersRevealed: { source: [], song: [] },  // Track revealed letter positions
    yearRevealed: false  // Track if year has been revealed
};

// Game modes configuration
const MODES = {
    'trivial': { 
        lives: 999, 
        clipDuration: 20, 
        timeout: 0,
        lifelines: {
            hint: { total: 999 },
            year: { total: 999 },
            skip: { total: 999 } 
        }
    },
    'default': { 
        lives: 999, 
        clipDuration: 20, 
        timeout: 60,
        lifelines: {
            hint: { total: 1 }, 
            year: { total: 1 }, 
            skip: { total: 1 }  
        }
    },
    'intense': { 
        lives: 3, 
        clipDuration: 10, 
        timeout: 20,
        lifelines: {
            hint: { total: 1 }, 
            year: { total: 1 }, 
            skip: { total: 1 }  
        }
    },
    'sudden-death': { 
        lives: 1, 
        clipDuration: 10, 
        timeout: 0,
        lifelines: {
            hint: { total: 1 }, 
            year: { total: 1 }, 
            skip: { total: 1 }  
        }
    }
};

// ↔️

window.MODES = MODES;

// Function to change mode dynamically
window.changeMode = function(newMode) {
    const oldTimeout = gameState.hasTimeout;
    gameState.settings = { ...MODES[newMode], mode: newMode, collectionId: gameState.collection.id || gameState.collectionId };
    gameState.lives = gameState.settings.lives;
    gameState.clipDuration = gameState.settings.clipDuration;
    gameState.timeout = gameState.settings.timeout;
    gameState.hasTimeout = gameState.timeout > 0;
    
    // Update lifelines
    if (gameState.timeout > 0) {
        gameState.lifelines.time = { remaining: 1, total: 1 };
    } else {
        gameState.lifelines.time = { remaining: 0, total: 0 };
    }
    
    // Set lifelines from mode configuration
    gameState.lifelines.hint = { remaining: gameState.settings.lifelines.hint.total, total: gameState.settings.lifelines.hint.total };
    gameState.lifelines.year = { remaining: gameState.settings.lifelines.year.total, total: gameState.settings.lifelines.year.total };
    gameState.lifelines.skip = { remaining: gameState.settings.lifelines.skip.total, total: gameState.settings.lifelines.skip.total };
    
    // Reset lifeline used this round
    gameState.lifelineUsedThisRound = { time: false, hint: false, year: false, skip: false };
    
    updateLifelineButtons();
    
    // Handle timeout changes
    if (gameState.hasTimeout && !oldTimeout) {
        // Started having timeout, start timer if guessing
        if (gameState.canGuess && !gameState.guessTimer) {
            startCountdown();
        }
    } else if (!gameState.hasTimeout && oldTimeout) {
        // Stopped having timeout, clear timer
        if (gameState.guessTimer) {
            clearInterval(gameState.guessTimer);
            gameState.guessTimer = null;
            document.getElementById('timer').textContent = '';
        }
    }
    
    // Update URL
    const params = new URLSearchParams(window.location.search);
    params.set('mode', newMode);
    window.history.replaceState(null, '', '?' + params.toString());
    
    // Apply theme
    if (window.applyModeTheme) {
        window.applyModeTheme(newMode, true);
    }
};

// Initialize game
document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get('collection')) return; // Only run on game pages
    
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
    // MODES is now defined globally


    // Get URL parameters
    const params = new URLSearchParams(window.location.search);
    const collectionId = params.get('collection');
    const mode = params.get('mode') || localStorage.getItem('selectedMode') || 'default';
	let collectionsUrl = localStorage.getItem('collectionsUrl') || params.get('data') || '';


    if (!collectionId) {
        console.error('No collection ID in URL');
        showCollectionError();
        return;
    }

    try {
        // Fetch collection data from individual collection directory
        const collectionDataUrl = `${collectionsUrl}/collections/${collectionId}/data.json`;
        const collectionResponse = await fetch('https://' + collectionDataUrl);
        if (!collectionResponse.ok) {
            console.error('Failed to fetch collection data.json:', collectionResponse.status, collectionResponse.statusText);
            showCollectionError();
            return;
        }
        const collectionData = await collectionResponse.json();

        // Fetch songs data
        const songsDataUrl = `${collectionsUrl}/audio/songs.json`;
        const songsResponse = await fetch('https://' + songsDataUrl);
        if (!songsResponse.ok) {
            console.error('Failed to fetch songs.json:', songsResponse.status, songsResponse.statusText);
            showCollectionError();
            return;
        }
        const songsData = await songsResponse.json();

        // Resolve song references to actual song objects
        collectionData.songs = collectionData.songs.map(songKey => {
            const song = songsData[songKey];
            if (!song) {
                console.warn('Song not found:', songKey);
                return null;
            }
            return song;
        }).filter(song => song !== null);

        gameState.collection = collectionData;

        // Set the source label based on collection's sourceName
        const gameStyle = gameState.collection.gameStyle || 1;
        document.getElementById('sourceLabel').textContent = gameState.collection.sourceName+"s" || "Sources";
        document.getElementById('sourcesLabel').textContent = (gameState.collection.sourceName || "Source") + "s";

		document.getElementById('sourcePart').innerHTML = `<span>${gameState.collection.sourceName || "Source"}</span>`;
        
        // Set placeholder based on game style
        let placeholder = "Type ";
        if (gameStyle === 1) {
            placeholder += `${gameState.collection.sourceName ? gameState.collection.sourceName.toLowerCase() : "source"} and/or song name...`;
        } else if (gameStyle === 2) {
            placeholder += `${gameState.collection.sourceName ? gameState.collection.sourceName.toLowerCase() : "source"} name...`;
        } else if (gameStyle === 3) {
            placeholder += "song name...";
        }
        document.getElementById('guessInput').placeholder = placeholder;
        
        // Set hint title based on game style
        let hintTitle = "Reveals some letters in the ";
        if (gameStyle === 1) {
            hintTitle += `${gameState.collection.sourceName ? gameState.collection.sourceName.toLowerCase() : "source"} and song names`;
        } else if (gameStyle === 2) {
            hintTitle += `${gameState.collection.sourceName ? gameState.collection.sourceName.toLowerCase() : "source"} names`;
        } else if (gameStyle === 3) {
            hintTitle += "song names";
        }
        document.getElementById('hintLifeline').title = hintTitle;
        
        // Hide score displays based on game style
        if (gameStyle === 2) {
            const songScoreDiv = document.querySelector('.game-info > div:first-child > div:last-child');
            if (songScoreDiv) songScoreDiv.style.display = 'none';
        } else if (gameStyle === 3) {
            const sourceScoreDiv = document.querySelector('.game-info > div:first-child > div:first-child');
            if (sourceScoreDiv) sourceScoreDiv.style.display = 'none';
        }
        
        // Hide stats based on game style
        if (gameStyle === 3) {
            const sourcesStatsDiv = document.querySelector('.stats > div:nth-child(2)');
            if (sourcesStatsDiv) sourcesStatsDiv.style.display = 'none';
        } else if (gameStyle === 2) {
            const songsStatsDiv = document.querySelector('.stats > div:nth-child(3)');
            if (songsStatsDiv) songsStatsDiv.style.display = 'none';
        }
        
        // Set base URL for audio files
        gameState.baseUrl = 'https://' + collectionsUrl;
        
        // Always use current MODES definition (ensures fresh settings)
        gameState.settings = { ...MODES[mode], mode: mode, collectionId: collectionId };		gameState.lives = gameState.settings.lives;
        gameState.totalLives = gameState.settings.lives;
        gameState.clipDuration = gameState.settings.clipDuration;
        gameState.timeout = gameState.settings.timeout;
        gameState.hasTimeout = gameState.timeout > 0;
        
        // Initialize lifelines based on mode
        if (gameState.timeout > 0) {
            gameState.lifelines.time = { remaining: 1, total: 1 };
        } else {
            gameState.lifelines.time = { remaining: 0, total: 0 };
        }
        
        // Set lifelines from mode configuration
        gameState.lifelines.hint = { remaining: gameState.settings.lifelines.hint.total, total: gameState.settings.lifelines.hint.total };
        gameState.lifelines.year = { remaining: gameState.settings.lifelines.year.total, total: gameState.settings.lifelines.year.total };
        gameState.lifelines.skip = { remaining: gameState.settings.lifelines.skip.total, total: gameState.settings.lifelines.skip.total };
        
        // Disable lifelines based on collection settings
        if (gameState.collection.disabledLifelines && Array.isArray(gameState.collection.disabledLifelines)) {
            gameState.collection.disabledLifelines.forEach(lifeline => {
                if (gameState.lifelines[lifeline]) {
                    gameState.lifelines[lifeline] = { remaining: 0, total: 0 };
                }
            });
        }
        
        // Populate start screen
        document.getElementById('collectionTitle').textContent = gameState.collection.title;
        document.getElementById('collectionDescription').textContent = gameState.collection.description || '';
        const difficulty = gameState.collection.difficulty || 'Medium';
        document.getElementById('collectionDifficulty').textContent = difficulty;
        document.getElementById('collectionDifficulty').className = `difficulty-${difficulty.toLowerCase().replace(' ', '-')}`;
        
        // Show random cover image if available
        const startScreenCover = document.getElementById('startScreenCover');
        if (gameState.collection.covers && gameState.collection.covers.length > 0) {
            const randomCover = gameState.collection.covers[Math.floor(Math.random() * gameState.collection.covers.length)];
            // Resolve cover path relative to collection directory
            const coverUrl = randomCover.startsWith('http') ? randomCover : gameState.baseUrl + '/collections/' + collectionId + '/' + randomCover.replace('./', '');
            startScreenCover.src = coverUrl;
            startScreenCover.alt = `${gameState.collection.title} cover`;
            startScreenCover.style.display = 'block';
        } else {
            startScreenCover.style.display = 'none';
        }
        
        // Set up rounds slider
        const roundsSlider = document.getElementById('roundsSlider');
        const roundsValue = document.getElementById('roundsValue');
        const totalSongs = gameState.collection.songs.length;
        
        // Calculate number of digits for padding
        const maxDigits = totalSongs.toString().length;
        
        // Function to pad number with leading zeros
        const padNumber = (num) => num.toString().padStart(maxDigits, '0');
        
        // Set slider max to total songs, default to 10 or 50% of max (whichever is smaller)
        roundsSlider.max = totalSongs;
        roundsSlider.value = totalSongs >= 10 ? 10 : Math.ceil(totalSongs * 0.5);
        roundsValue.textContent = padNumber(roundsSlider.value);
        
        // Update display when slider changes
        roundsSlider.addEventListener('input', () => {
            roundsValue.textContent = padNumber(roundsSlider.value);
        });
        
        // Add start button listener
        document.getElementById('startGameBtn').addEventListener('click', () => {
            // Hide start screen, show game
            document.getElementById('startScreen').style.display = 'none';
            document.getElementById('gameContent').style.display = 'block';
            document.getElementById('gameCollectionTitle').textContent = gameState.collection.title;
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
    document.querySelector('#startScreen > div').style.display = 'none'; // Hide the difficulty and rounds selection
    document.getElementById('startGameBtn').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'block';
}

async function initializeGame() {
    // Get number of rounds from slider
    const numRounds = parseInt(document.getElementById('roundsSlider').value);
    
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
    await startRound();
}

async function startRound() {
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
    gameState.sourceRevealed = [];
    gameState.songRevealed = false;
    gameState.canGuess = true;
    gameState.hintLettersRevealed = { source: gameState.currentSong.sources.map(() => []), song: [] };  // Reset hint state
    gameState.yearRevealed = false;  // Reset year reveal
    gameState.lifelineUsedThisRound = { time: false, hint: false, year: false, skip: false };  // Reset per-round usage
    
    // Generate random startTime based on startTime and endTime
    try {
        const audioUrl = gameState.currentSong.audioFile.startsWith('http') ? 
            gameState.currentSong.audioFile : 
            gameState.baseUrl + '/' + gameState.currentSong.audioFile;
        const duration = await getAudioDuration(audioUrl);
        gameState.currentSong.duration = duration;
        
        // Parse startTime
        let parsedStart = 0;
        if (gameState.currentSong.startTime !== null) {
            if (typeof gameState.currentSong.startTime === 'string' && gameState.currentSong.startTime.includes(':')) {
                const parts = gameState.currentSong.startTime.split(':');
                parsedStart = parseInt(parts[0]) * 60 + parseInt(parts[1]);
            } else {
                parsedStart = parseFloat(gameState.currentSong.startTime);
            }
        }
        
        // Parse endTime
        let parsedEnd = null;
        if (gameState.currentSong.endTime !== null) {
            if (typeof gameState.currentSong.endTime === 'string' && gameState.currentSong.endTime.includes(':')) {
                const parts = gameState.currentSong.endTime.split(':');
                parsedEnd = parseInt(parts[0]) * 60 + parseInt(parts[1]);
            } else {
                parsedEnd = parseFloat(gameState.currentSong.endTime);
            }
        }
        
        // Determine effective start and end
        const effectiveStart = parsedStart;
        const effectiveEnd = parsedEnd !== null ? parsedEnd : duration - 5; // padding 5s
        
        // Check if there's enough room for randomization
        if (effectiveStart + gameState.clipDuration + 5 >= effectiveEnd) {
            // Not enough room, use fixed start
            gameState.currentSong.startTime = effectiveStart;
        } else {
            // Randomize between effectiveStart and effectiveEnd - clipDuration
            const maxStart = effectiveEnd - gameState.clipDuration;
            gameState.currentSong.startTime = effectiveStart + Math.random() * (maxStart - effectiveStart);
        }
    } catch (error) {
        console.error('Failed to get audio duration, using 0:', error);
        gameState.currentSong.startTime = 0;
    }
    
    // Update total sources/songs counters
    gameState.totalSourcesSoFar += gameState.currentSong.sources.filter(s => s[0]).length;
    gameState.totalSongsSoFar += 1;
    
	// Reset revealed status
	document.getElementById('gameContent').dataset.revealed = false;
	document.getElementById('gameContent').dataset.correct = "";

	// Reset Album Image
	document.getElementById('album-img').src = "";

    // Clear input
    document.getElementById('guessInput').value = '';
    document.getElementById('guessInput').disabled = false;
    document.getElementById('guessInput').style.display = '';
    
	// Clear progressBar
	document.getElementById('progressBar').style.setProperty('--initial_start', 0);
	document.getElementById('progressBar').style.setProperty('--initial_end', 0);

    // Auto-focus input so player can start typing immediately
    setTimeout(() => {
        document.getElementById('guessInput').focus();
    }, 100);
    
    // Reset UI elements
    document.getElementById('nextButtonContainer').style.display = 'none';
    document.getElementById('actionButtons').style.display = 'block';
    document.getElementById('repeatBtn').style.display = 'none';
    document.getElementById('progressBar').style.width = '0%';
    
	// Cover Image
	const audioUrl = gameState.currentSong.audioFile.startsWith('http') ? 
					gameState.currentSong.audioFile : 
					gameState.baseUrl + '/' + gameState.currentSong.audioFile;
	audio_to_img(audioUrl).then(src => {	document.getElementById("album-img").src = src; });

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

	console.log(gameState.currentSong)

    // Play audio (start countdown)
    playSong(true);
}

function playSong(restartCountdown = false) {
    const song = gameState.currentSong;
    
    // Mark this round as active
    const roundId = Date.now() + Math.random(); // Unique ID for this playback
    gameState.currentRoundId = roundId;
    
    // Parse startTime (support both formats and null for random)
    let startTime = 0;
    if (song.startTime !== null) {
        if (typeof song.startTime === 'string' && song.startTime.includes(':')) {
            // Format: "1:30" or "0:45"
            const parts = song.startTime.split(':');
            startTime = parseInt(parts[0]) * 60 + parseInt(parts[1]);
        } else {
            // Format: number in seconds
            startTime = parseFloat(song.startTime);
        }
    }
    
    // Store the start time for seeking calculations
    gameState.currentStartTime = startTime;
    
    // Parse endTime (support both formats and null to ignore)
    let endTime = null;
    if (song.endTime !== null && song.startTime !== null) {
        if (typeof song.endTime === 'string' && song.endTime.includes(':')) {
            // Format: "1:30" or "0:45"
            const parts = song.endTime.split(':');
            endTime = parseInt(parts[0]) * 60 + parseInt(parts[1]);
        } else {
            // Format: number in seconds
            endTime = parseFloat(song.endTime);
        }
    }
    
    // Calculate effective clip duration
    let effectiveClipDuration = gameState.clipDuration;
    if (endTime !== null && endTime > startTime) {
        effectiveClipDuration = Math.min(gameState.clipDuration, endTime - startTime);
    }
    if (endTime === null && gameState.currentSong.duration > 0) {
        effectiveClipDuration = Math.min(effectiveClipDuration, gameState.currentSong.duration - startTime - 5);
    }
    gameState.effectiveClipDuration = Math.max(effectiveClipDuration, 1); // minimum 1 second to avoid division by zero
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
    
    // Set up clip timer to stop audio after effectiveClipDuration
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
                document.getElementById('repeatBtn').style.display = 'flex';
                document.getElementById('progressTimer').style.display = 'none';
            }
        }
    }, effectiveClipDuration * 1000);
    
    // Set up audio end listener with round validation
    gameState.audio.addEventListener('ended', () => {
        // Only stop if we're still on the same round
        if (gameState.currentRoundId === thisRoundId) {
            stopProgressBar();
            // Show replay button when audio naturally ends (unless game is over)
            if (gameState.lives > 0) {
                document.getElementById('repeatBtn').style.display = 'flex';
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
    const duration = (gameState.effectiveClipDuration || gameState.clipDuration) * 1000; // in ms
    const startTime = Date.now();
    
    // Show timer
    progressTimer.style.display = 'block';
    
    gameState.progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const percent = Math.min((elapsed / duration) * 100, 100);
        progressBar.style.width = percent + '%';
        
        // Update countdown timer
        const remaining = Math.max(0, Math.ceil((duration - elapsed) / 1000));
        progressTimer.textContent = formatTime(remaining);
        
        if (percent >= 100) {
            clearInterval(gameState.progressInterval);
            progressTimer.textContent = '0:00';
        }
    }, 50); // Update every 50ms for smooth animation
}

function startFullProgressBar() {
    const progressBar = document.getElementById('progressBar');
    const progressTimer = document.getElementById('progressTimer');
    const duration = gameState.currentSong.duration;
    
    // Show timer, hide repeat button
    progressTimer.style.display = 'block';
    document.getElementById('repeatBtn').style.display = 'none';
    
    gameState.progressInterval = setInterval(() => {
        if (!gameState.audio) return;
        const currentTime = gameState.audio.currentTime;
        const percent = Math.min((currentTime / duration) * 100, 100);
        progressBar.style.width = percent + '%';
        
        // Update countdown timer (remaining time to end)
        const remaining = Math.max(0, Math.ceil(duration - currentTime));
        progressTimer.textContent = formatTime(remaining);
        
        if (percent >= 100) {
            clearInterval(gameState.progressInterval);
            progressTimer.textContent = '0:00';
        }
    }, 50); // Update every 50ms for smooth animation
}

function stopProgressBar() {
    if (gameState.progressInterval) {
        clearInterval(gameState.progressInterval);
        document.getElementById('progressBar').style.width = '100%';
        document.getElementById('progressTimer').textContent = '0:00';
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
            
            const isRevealed = document.getElementById('gameContent').dataset.revealed === 'true';
            let targetTime;
            let remainingDuration;
            
            if (isRevealed) {
                // Seek within full song duration
                targetTime = percentClicked * gameState.currentSong.duration;
                remainingDuration = gameState.currentSong.duration - targetTime;
            } else {
                // Seek within clip duration
                targetTime = percentClicked * (gameState.effectiveClipDuration || gameState.clipDuration);
                remainingDuration = (gameState.effectiveClipDuration || gameState.clipDuration) - targetTime;
            }
            
            const song = gameState.currentSong;
            
            // Store whether audio was playing before seek
            const wasPlaying = !gameState.audio.paused;
            
            // Set audio to the clicked position
            if (isRevealed) {
                gameState.audio.currentTime = targetTime;
            } else {
                // For clip mode, targetTime is relative to clip start, so add the song start time
                gameState.audio.currentTime = gameState.currentStartTime + targetTime;
            }
            
            // Always resume playing after seeking
            gameState.audio.play().catch(err => console.error('Error playing audio after seek:', err));
            
            // Restart progress bar from new position
            clearInterval(gameState.progressInterval);
            if (isRevealed) {
                startFullProgressBar();
            } else {
                // For clip mode, restart progress bar with adjusted start time
                clearTimeout(gameState.clipTimer);
                
                const progressBarEl = document.getElementById('progressBar');
                const progressTimerEl = document.getElementById('progressTimer');
                const duration = (gameState.effectiveClipDuration || gameState.clipDuration) * 1000; // in ms
                const startTime = Date.now() - (targetTime * 1000); // Adjust so elapsed starts from targetTime
                
                // Show timer
                progressTimerEl.style.display = 'block';
                
                gameState.progressInterval = setInterval(() => {
                    const elapsed = Date.now() - startTime;
                    const percent = Math.min((elapsed / duration) * 100, 100);
                    progressBarEl.style.width = percent + '%';
                    
                    // Update countdown timer
                    const remaining = Math.max(0, Math.ceil((duration - elapsed) / 1000));
                    progressTimerEl.textContent = formatTime(remaining);
                    
                    if (percent >= 100) {
                        clearInterval(gameState.progressInterval);
                        progressTimerEl.textContent = '0:00';
                    }
                }, 50);
                
                // Restart clip timer
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
                            document.getElementById('repeatBtn').style.display = 'flex';
                            document.getElementById('progressTimer').style.display = 'none';
                        }
                    }
                }, remainingTime * 1000);
            }
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
        gameState.sourceRevealed = gameState.currentSong.sources.map((s, i) => s[0] ? i : null).filter(i => i !== null);
        gameState.songRevealed = true;
        updateAnswerDisplay();
        
        // Hide action buttons immediately
        document.getElementById('actionButtons').style.display = 'none';
        document.getElementById('guessInput').disabled = true;
        // Go directly to game over immediately
        endGame(false);
    } else {
        // Disable input and show result when timed out but still have lives
        document.getElementById('guessInput').disabled = true;
		document.getElementById('gameContent').dataset.correct = false;
        // Show result and next button if still alive (without revealing answer)
        showResult();
    }
}

function checkGuess() {
    if (!gameState.canGuess) return;
    
    const userInput = document.getElementById('guessInput').value.trim();
    if (!userInput) return;
    
    const normalizedInput = normalize_str(userInput);
    
    const song = gameState.currentSong;
    let sourceCorrect = false;
    let songCorrect = false;
    let newCorrectGuess = false;
    let sourceRevealedBefore = gameState.sourceRevealed.length;
    
    const gameStyle = gameState.collection ? gameState.collection.gameStyle || 1 : 1;
    
    if (gameStyle === 3) {
        // Only check song title
        if (!gameState.songRevealed) {
            if (matchesTitle(song, normalizedInput)) {
                gameState.songRevealed = true;
                songCorrect = true;
                newCorrectGuess = true;
            }
        }
    } else if (gameStyle === 2) {
        // Only check sources
        song.sources.forEach((source, index) => {
            if (source[0] && !gameState.sourceRevealed.includes(index)) {
                for (let i = 1; i < source.length; i++) {
                    const spelling = source[i];
                    const normalizedSpelling = normalize_str(spelling);
                    if (normalizedInput === normalizedSpelling || normalizedInput.includes(normalizedSpelling)) {
                        gameState.sourceRevealed.push(index);
                        sourceCorrect = true;
                        newCorrectGuess = true;
						break;
                    }
                }
            }
        });
    } else { // gameStyle 1
        // Check each source - if not revealed
        song.sources.forEach((source, index) => {
            if (!gameState.sourceRevealed.includes(index)) {
                for (let i = 1; i < source.length; i++) {
                    const spelling = source[i];
                    const normalizedSpelling = normalize_str(spelling);
                    if (normalizedInput === normalizedSpelling || normalizedInput.includes(normalizedSpelling)) {
                        gameState.sourceRevealed.push(index);
                        sourceCorrect = true;
                        newCorrectGuess = true;
						break;
                    }
                }
            }
        });
        // Check song title - exact match or contained in input
        if (!gameState.songRevealed) {
            if (matchesTitle(song, normalizedInput)) {
                gameState.songRevealed = true;
                songCorrect = true;
                newCorrectGuess = true;
            }
        }
    }
    
    // Update display
    updateAnswerDisplay();
    
    // Award points and check completion
    const allSourcesRevealed = gameState.sourceRevealed.length === song.sources.length;
    const allRequiredSourcesRevealed = song.sources.every((source, index) => !source[0] || gameState.sourceRevealed.includes(index));
    let requiredGuessed = false;
    let allGuessed = false;
    if (gameStyle === 3) {
        // Song only
        if (songCorrect) {
            gameState.score += 100;
            gameState.songsGuessed++;
        }
        requiredGuessed = song.title[0] ? gameState.songRevealed : true;
        allGuessed = gameState.songRevealed;
    } else if (gameStyle === 2) {
        // Source only
        if (sourceCorrect) {
            gameState.score += 50;
            const sourceRevealedAfter = gameState.sourceRevealed.length;
            gameState.sourceGuessed += (sourceRevealedAfter - sourceRevealedBefore);
            const allSourcesRevealed = gameState.sourceRevealed.length === song.sources.length;
            requiredGuessed = allRequiredSourcesRevealed;
            allGuessed = allSourcesRevealed;
            // Reveal song title as optional when all sources are revealed
            if (allSourcesRevealed) {
                gameState.songRevealed = true;
            }
        }
    } else {
        // Both
        if (sourceCorrect) {
            gameState.score += 50;
            const sourceRevealedAfter = gameState.sourceRevealed.length;
            gameState.sourceGuessed += (sourceRevealedAfter - sourceRevealedBefore);
        }
        if (songCorrect) {
            gameState.score += 100;
            gameState.songsGuessed++;
        }
        const allSourcesRevealed = gameState.sourceRevealed.length === song.sources.length;
        requiredGuessed = allRequiredSourcesRevealed && (song.title[0] ? gameState.songRevealed : true);
        allGuessed = allSourcesRevealed && gameState.songRevealed;
    }
    // Only stop countdown timer if all guessed (but keep clip timer running)
    if (allGuessed) {
        clearInterval(gameState.guessTimer);
        gameState.canGuess = false;
        document.getElementById('guessInput').disabled = true;
        document.getElementById('guessInput').style.display = 'none';
		document.getElementById('gameContent').dataset.revealed = true;
		document.getElementById('gameContent').dataset.correct = true;
        
        // Set CSS variables for original clip positions on progress bar
        const progressBar = document.getElementById('progressBar');
        const song = gameState.currentSong;
        const duration = song.duration;
        
        // Parse startTime
        let startTime = 0;
        if (song.startTime !== null) {
            if (typeof song.startTime === 'string' && song.startTime.includes(':')) {
                const parts = song.startTime.split(':');
                startTime = parseInt(parts[0]) * 60 + parseInt(parts[1]);
            } else {
                startTime = parseFloat(song.startTime);
            }
        }
        
        // Parse endTime
        let endTime = null;
        if (song.endTime !== null && song.startTime !== null) {
            if (typeof song.endTime === 'string' && song.endTime.includes(':')) {
                const parts = song.endTime.split(':');
                endTime = parseInt(parts[0]) * 60 + parseInt(parts[1]);
            } else {
                endTime = parseFloat(song.endTime);
            }
        }
        
        // Calculate percentages based on original clip boundaries
        let actualEndTime = startTime;
        if (endTime !== null) {
            actualEndTime = endTime;
        } else {
            // For songs without endTime, the clip ends at startTime + clipDuration
            actualEndTime = startTime + gameState.clipDuration;
        }
        
        const startPercent = (startTime / duration) * 100;
        const endPercent = Math.min((actualEndTime / duration) * 100, 100);
        
        progressBar.style.setProperty('--initial_start', startPercent.toFixed(3) + '%');
        progressBar.style.setProperty('--initial_end', endPercent.toFixed(3) + '%');
        
        // Let the song play to the end and show full progress
        clearTimeout(gameState.clipTimer);
        stopProgressBar();
        startFullProgressBar();
        // Resume playback if it was paused
        if (gameState.audio && gameState.audio.paused) {
            gameState.audio.play().catch(err => console.error('Error resuming audio after reveal:', err));
        }
    }
    

    
    // Show result (only if not game over)
    if (sourceCorrect || songCorrect) {
        showResult();
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
		if (gameState.lives !== 999) {
			gameState.lives--;
		}
        showResult();
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
    const sourcePart = document.getElementById('sourcePart');
    const songPart = document.getElementById('songPart');
    const separator = document.querySelector('.answer-wrapper .separator');
    
    // Helper function to build hint display
    const buildHintDisplay = (text, revealedIndices) => {
        const chars = text.split('');
        if (!revealedIndices || revealedIndices.length === 0) {
            return chars.map(char => {
                if (char === ' ') return ' ';
                if (/[a-zA-Z0-9]/.test(char)) return '_';
                return ''; // remove punctuation
            }).join('');
        }
        return chars.map((char, i) => {
            if (char === ' ') return ' ';
            if (/[a-zA-Z0-9]/.test(char)) {
                if (revealedIndices.includes(i)) {
                    return `<span class="revealed">${char}</span>`;
                }
                return '_';
            }
            return ''; // remove punctuation
        }).join('');
    };
    
    // Get game style
    const gameStyle = gameState.collection ? gameState.collection.gameStyle || 1 : 1;
    
    // Compute if all sources are revealed
    const allSourcesRevealed = gameState.sourceRevealed.length === song.sources.length;
    
    // Hide parts based on game style
    if (gameStyle === 3) { // only song, hide source
        sourcePart.innerHTML = '';
        if (separator) separator.style.display = 'none';
        // Build song display with optional year
        let songDisplay = '';
        if (gameState.songRevealed) {
            const isRequired = song.title[0];
            const titleText = song.title[1];
            songDisplay = `<span class="revealed${isRequired ? '' : ' optional'}">${titleText}</span>`;
        } else {
            // Check if hints are active for song
            const hintLetters = gameState.hintLettersRevealed.song;
            const isPrimaryOptional = song.title[0] === false;
            if (hintLetters && hintLetters.length > 0) {
                const hintText = buildHintDisplay(getTitle(song), hintLetters);
                songDisplay = `<span class="hint${isPrimaryOptional ? ' optional' : ''}">${hintText}</span>`;
            } else {
                songDisplay = `<span class="hidden${isPrimaryOptional ? ' optional' : ''}">Song</span>`;
            }
        }
        
        // Add year if revealed or lifeline used
        if ((gameState.yearRevealed || (allSourcesRevealed && gameState.songRevealed)) && song.year) {
            songDisplay += ` <span class="revealed">(${song.year})</span>`;
        }
        
        songPart.innerHTML = songDisplay;
    } else if (gameStyle === 2) { // only source, show song title as optional when all sources revealed
        const sourceName = gameState.collection.sourceName || "Source";
        const allSources = song.sources;
        const sourceDisplay = allSources.map((source, index) => {
            const isRequired = source[0];
            if (gameState.sourceRevealed.includes(index)) {
                return `<span class="revealed${isRequired ? '' : ' optional'}">${source[1]}</span>`;
            } else {
                // Check if hints are active for this source
                const hintLetters = gameState.hintLettersRevealed.source[index];
                if (hintLetters && hintLetters.length > 0) {
                    const hintText = buildHintDisplay(source[1], hintLetters);
                    return `<span class="hint${isRequired ? '' : ' optional'}">${hintText}</span>`;
                } else {
                    const requiredCount = allSources.filter(s => s[0]).length;
                    const label = sourceName;
                    return `<span class="hidden${isRequired ? '' : ' optional'}">${label}</span>`;
                }
            }
        }).join(', ');
        sourcePart.innerHTML = sourceDisplay;
        
        // Show song title as optional when all sources are revealed
        if (allSourcesRevealed) {
            const titleText = getTitle(song);
            let songDisplay = `<span class="revealed optional">${titleText}</span>`;
            // Add year after title when all sources are revealed
            if ((gameState.yearRevealed || allSourcesRevealed) && song.year) {
                songDisplay += ` <span class="revealed">(${song.year})</span>`;
            }
            songPart.innerHTML = songDisplay;
            if (separator) separator.style.display = '';
        } else {
            songPart.innerHTML = '';
            if (separator) separator.style.display = 'none';
        }
        
        // For gameStyle 2, show year with source only when song is not revealed
        if (gameState.yearRevealed && !allSourcesRevealed && song.year) {
            sourcePart.innerHTML += ` <span class="revealed">(${song.year})</span>`;
        }
    } else { // gameStyle 1, show both
        const sourceName = gameState.collection.sourceName || "Source";
        const allSources = song.sources;
        const sourceDisplay = allSources.map((source, index) => {
            const isRequired = source[0];
            if (gameState.sourceRevealed.includes(index)) {
                return `<span class="revealed${isRequired ? '' : ' optional'}">${source[1]}</span>`;
            } else {
                // Check if hints are active for this source
                const hintLetters = gameState.hintLettersRevealed.source[index];
                if (hintLetters && hintLetters.length > 0) {
                    const hintText = buildHintDisplay(source[1], hintLetters);
                    return `<span class="hint${isRequired ? '' : ' optional'}">${hintText}</span>`;
                } else {
                    const requiredCount = allSources.filter(s => s[0]).length;
                    const label = sourceName;
                    return `<span class="hidden${isRequired ? '' : ' optional'}">${label}</span>`;
                }
            }
        }).join(', ');
        sourcePart.innerHTML = sourceDisplay;
        if (separator) separator.style.display = '';
        
        // Build song display with optional year
        let songDisplay = '';
        if (gameState.songRevealed) {
            const isRequired = song.title[0];
            const titleText = song.title[1];
            songDisplay = `<span class="revealed${isRequired ? '' : ' optional'}">${titleText}</span>`;
        } else {
            // Check if hints are active for song
            const hintLetters = gameState.hintLettersRevealed.song;
            const isPrimaryOptional = song.title[0] === false;
            if (hintLetters && hintLetters.length > 0) {
                const hintText = buildHintDisplay(getTitle(song), hintLetters);
                songDisplay = `<span class="hint${isPrimaryOptional ? ' optional' : ''}">${hintText}</span>`;
            } else {
                songDisplay = `<span class="hidden${isPrimaryOptional ? ' optional' : ''}">Song</span>`;
            }
        }
        
        // Add year if revealed or lifeline used
        if ((gameState.yearRevealed || (allSourcesRevealed && gameState.songRevealed)) && song.year) {
            songDisplay += ` <span class="revealed">(${song.year})</span>`;
        }
        
        songPart.innerHTML = songDisplay;
    }
}

function showResult() {
    // Animation is now handled in checkGuess before life deduction
    
    // Check if required guessed
    const song = gameState.currentSong;
    const gameStyle = gameState.collection ? gameState.collection.gameStyle || 1 : 1;
    const allRequiredSourcesRevealed = song.sources.every((source, index) => !source[0] || gameState.sourceRevealed.includes(index));
    let requiredGuessed = false;
    
    if (gameStyle === 3) {
        requiredGuessed = song.title[0] ? gameState.songRevealed : true;
    } else if (gameStyle === 2) {
        requiredGuessed = allRequiredSourcesRevealed;
    } else {
        requiredGuessed = allRequiredSourcesRevealed && (song.title[0] ? gameState.songRevealed : true);
    }

    // Show next button and disable input if required guessed or timeout (but not if game over)
    if ((requiredGuessed || !gameState.canGuess) && gameState.lives > 0) {
        // Always show next button when required guessed
        document.getElementById('nextButtonContainer').style.display = 'block';
        document.getElementById('actionButtons').style.display = 'none';
        document.getElementById('lifelineButtons').style.display = 'none';
        
        // Stop the countdown timer when next button appears
        clearInterval(gameState.guessTimer);

        // Disable all lifeline buttons during next phase
        document.querySelectorAll('.btn-lifeline').forEach(btn => {
            btn.disabled = true;
        });
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

async function useSkipLifeline() {
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

    // Temporarily disable skip button to prevent rapid skipping
    const skipBtn = document.getElementById('skipLifeline');
    if (skipBtn) {
        skipBtn.classList.add('skip-disabled');
        setTimeout(() => {
            skipBtn.classList.remove('skip-disabled');
        }, 500);
    }
    
    // Go directly to next round
    gameState.currentSongIndex++;
    await startRound();
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
    
    const isRevealed = document.getElementById('gameContent').dataset.revealed === 'true';
    
    if (isRevealed) {
        // For revealed songs, replay from the beginning of the full song
        gameState.audio.currentTime = 0;
        gameState.audio.play().catch(err => console.error('Error playing audio after repeat:', err));
        startFullProgressBar();
    } else {
        // For clip mode, replay the clip
        playSong(false);
    }
}

async function nextRound() {
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
    await startRound();
    
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
    document.getElementById('gameContent').style.display = 'none';
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
    const resultDifficulty = gameState.collection.difficulty || 'Medium';
    document.getElementById('resultDifficulty').textContent = resultDifficulty;
    document.getElementById('resultDifficulty').className = `difficulty-${resultDifficulty.toLowerCase().replace(' ', '-')}`;
    
    // Show random cover image if available
    const resultScreenCover = document.getElementById('resultScreenCover');
    if (gameState.collection.covers && gameState.collection.covers.length > 0) {
        const randomCover = gameState.collection.covers[Math.floor(Math.random() * gameState.collection.covers.length)];
        // Resolve cover path relative to collections base URL
        const coverUrl = randomCover.startsWith('http') ? randomCover : gameState.baseUrl + '/' + randomCover.replace('./', '');
        resultScreenCover.src = coverUrl;
        resultScreenCover.alt = `${gameState.collection.title} cover`;
        resultScreenCover.style.display = 'block';
    } else {
        resultScreenCover.style.display = 'none';
    }
    
    // Update mode info (just the name, not "Mode")
    let modeName = '';
    if (gameState.lives === 999 || (gameState.settings && gameState.settings.lives === 999)) {
        modeName = 'Trivial';
    } else if (gameState.lives === 3 || (gameState.settings && gameState.settings.lives === 3)) {
        // Check timeout to differentiate Default from Intense
        if (gameState.timeout > 0 || (gameState.settings && gameState.settings.timeout > 0)) {
            modeName = 'Intense';
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
    document.getElementById('sourcesGuessed').textContent = gameState.sourceGuessed;
    document.getElementById('totalSources').textContent = gameState.totalSourcesSoFar;
    document.getElementById('songsGuessed').textContent = gameState.songsGuessed;
    document.getElementById('totalSongs').textContent = gameState.totalSongsSoFar;
    
    // Hide stats based on game style
    const gameStyle = gameState.collection ? gameState.collection.gameStyle || 1 : 1;
    if (gameStyle === 3) {
        const sourcesDiv = document.querySelector('#resultScreen > div > div > div:nth-child(3)');
        if (sourcesDiv) sourcesDiv.style.display = 'none';
    } else if (gameStyle === 2) {
        const songsDiv = document.querySelector('#resultScreen > div > div > div:nth-child(4)');
        if (songsDiv) songsDiv.style.display = 'none';
    }
    
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
    // Update score display with source/song stats
    document.getElementById('sourceScore').textContent = `${gameState.sourceGuessed}`;
    document.getElementById('songScore').textContent = `${gameState.songsGuessed}`;
    
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
            } else if (index === gameState.lives) {
                // This is the heart that just got lost - animate it
                heart.style.visibility = 'visible'; // Keep visible during animation
                if (!heart.classList.contains('heartbeat')) {
                    heart.classList.add('heartbeat');
                }
            } else {
                // Hearts already lost
                heart.style.visibility = 'hidden';
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
    const gameStyle = gameState.collection ? gameState.collection.gameStyle || 1 : 1;
    
    // Reveal letters for each source
    if (gameStyle !== 3) {
        song.sources.forEach((source, globalIndex) => {
            if (!gameState.sourceRevealed.includes(globalIndex)) {
                if (!gameState.hintLettersRevealed.source[globalIndex]) {
                    gameState.hintLettersRevealed.source[globalIndex] = [];
                }
                
                const sourceName = source[1]; // Use first spelling for hints
                const letters = sourceName.split('').filter(c => c !== ' ');
                const letterIndices = letters.map((_, i) => i);
                const unrevealed = letterIndices.filter(i => !gameState.hintLettersRevealed.source[globalIndex].includes(i));
                
                const lettersToReveal = Math.max(2, Math.floor(unrevealed.length * 0.3));
                // Special rule: if calculated amount equals total unrevealed, reveal one less
                const adjustedCount = unrevealed.length === lettersToReveal ? lettersToReveal - 1 : lettersToReveal;
                const toReveal = Math.min(adjustedCount, unrevealed.length);
                
                for (let i = 0; i < toReveal; i++) {
                    const randomIndex = Math.floor(Math.random() * unrevealed.length);
                    const letterIndex = unrevealed.splice(randomIndex, 1)[0];
                    gameState.hintLettersRevealed.source[globalIndex].push(letterIndex);
                }
            }
        });
    }
    
    // Reveal letters for song title if not revealed
    if (gameStyle !== 2 && !gameState.songRevealed) {
        if (!gameState.hintLettersRevealed.song) {
            gameState.hintLettersRevealed.song = [];
        }
        
        const letters = getTitle(song).split('').filter(c => c !== ' ');
        const letterIndices = letters.map((_, i) => i);
        const unrevealed = letterIndices.filter(i => !gameState.hintLettersRevealed.song.includes(i));
        
        const lettersToReveal = Math.max(2, Math.floor(unrevealed.length * 0.3));
        // Special rule: if calculated amount equals total unrevealed, reveal one less
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
if (new URLSearchParams(window.location.search).get('collection')) {
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
        
        // Handle Enter key for next round if next button is active
        if (e.key === 'Enter' && guessInput.disabled) {
            const nextButtonContainer = document.getElementById('nextButtonContainer');
            if (nextButtonContainer && nextButtonContainer.style.display !== 'none') {
                nextRound();
                return;
            }
        }
        
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
}


function audio_to_img(url) {
	return fetch(url)
		.then(response => {
			if (!response.ok) throw new Error('Network response was not ok');
			return response.arrayBuffer();
		})
		.then(buffer => {
			return new Promise((resolve, reject) => {
				const blob = new Blob([buffer], {type: 'audio/mpeg'});
				musicmetadata(blob, function(err, metadata) {
					if (err) {
						reject(err);
						return;
					}
					if (metadata.picture && metadata.picture.length > 0) {
						const pic = metadata.picture[0];
						// Build binary string in chunks to avoid call stack overflow with large images
						let binaryString = '';
						const chunkSize = 8192; // Process in chunks
						for (let i = 0; i < pic.data.length; i += chunkSize) {
							const chunk = pic.data.slice(i, i + chunkSize);
							binaryString += String.fromCharCode.apply(null, chunk);
						}
						const imgSrc = `data:${pic.format};base64,${btoa(binaryString)}`;
						resolve(imgSrc);
					} else {
						resolve(null);
					}
				});
			});
		})
		.catch(error => {
			console.error('Error:', error);
			return Promise.resolve(null);
		});
}
