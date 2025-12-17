const STATE = {
  start: 0,
  game: 1,
  next: 2,
  end: 3,
};

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
    isExpanded: false,  // Track if expand lifeline has been used this round
    originalStartTime: 0,  // Store original clip start time
    originalEndTime: null,  // Store original clip end time
	success: false,
	rounds: 0,
    // Lifelines
    lifelines: {
        time: { remaining: 0, total: 0 },
        hint: { remaining: 0, total: 0 },
        year: { remaining: 0, total: 0 },
        skip: { remaining: 0, total: 0 },
        expand: { remaining: 0, total: 0 }
    },
    lifelineUsedThisRound: { time: false, hint: false, year: false, skip: false, expand: false },  // Track per-round usage
    hintLettersRevealed: { source: [], song: [] },  // Track revealed letter positions
    yearRevealed: false,  // Track if year has been revealed
	state: STATE.start,
};


// Game modes configuration
const MODES = {
    'trivial': { 
        lives: 999, 
        clipDuration: 20, 
        timeout: 0,
        lifelines: {
            hint: { total: 999 },
            expand: { total: 999 },
            year: { total: 999 },
            skip: { total: 999 },
        }
    },
    'default': { 
        lives: 999, 
        clipDuration: 20, 
        timeout: 60,
        lifelines: {
            hint: { total: 1 },
            expand: { total: 1 },
            year: { total: 1 }, 
            skip: { total: 1 },
        }
    },
    'intense': { 
        lives: 3, 
        clipDuration: 10, 
        timeout: 20,
        lifelines: {
            hint: { total: 1 }, 
            expand: { total: 1 },
            year: { total: 1 }, 
            skip: { total: 1 },
        }
    },
    'sudden-death': { 
        lives: 1, 
        clipDuration: 10, 
        timeout: 0,
        lifelines: {
            hint: { total: 1 },
            expand: { total: 1 },
            year: { total: 1 }, 
            skip: { total: 1 },
        }
    }
};
let wavesurfer = WaveSurfer.create({
	container: '#audioPlayer',
	waveColor: '#f0f0f0',
	progressColor: 'black',
	cursorColor: 'black',
	cursorWidth: 0,
	barWidth: 2,
	barGap: 1,
	barRadius: 1,
	height: "100%",
	width: "100%",
	responsive: true,
	interact: true,
	mediaControls: false,
	autoplay: true,
});

function initAudio() {
	// Attach progress update events
    wavesurfer.on('timeupdate', updateProgressBar);
    wavesurfer.on('ready', updateProgressBar);
    wavesurfer.on('interaction', updateProgressBar);
  
	const volume = (localStorage.getItem('musicQuizVolume') || 50) / 100;
	wavesurfer.setVolume(volume);

	document.getElementById('repeatBtn').addEventListener('click', repeatSong);

}

function repeatSong() {
	if (!wavesurfer || !gameState.currentSong) return;

    const startTime = gameState.currentSong.startTime || 0;
	const endTime = gameState.currentSong.endTime || gameState.currentSong.duration || 0;

	wavesurfer.play(startTime, endTime);
}

function updateProgressBar() {
    if (!wavesurfer || !gameState.currentSong) return;

    const startTime = gameState.currentSong.startTime || 0;
	const endTime = gameState.currentSong.endTime || gameState.currentSong.duration || 0;

	const waveTime = wavesurfer.getCurrentTime();
    const segDuration = endTime - startTime;
    const segTime = Math.max(0, waveTime - startTime);
    const progress = Math.max(0, Math.min(1, segTime / segDuration));


	document.getElementById('progressBar').style.setProperty('--progress', progress);
}

function updateAudio() {
    if (!gameState.currentSong) return;

    const audioUrl = gameState.currentSong.audioFile.startsWith('http') ? gameState.currentSong.audioFile : gameState.baseUrl + '/audio/' + gameState.currentSong.audioFile;

    wavesurfer.load(audioUrl);
	console.log(audioUrl);
	
	wavesurfer.once('ready', () => {
		const startTime = gameState.currentSong.startTime || 0;
		const endTime = gameState.currentSong.endTime || gameState.currentSong.duration || 0;

		wavesurfer.options.startTime = startTime;
		wavesurfer.options.endTime = endTime;
		wavesurfer.getRenderer().reRender();

		wavesurfer.play(0)

		console.log(wavesurfer.options.startTime);
		console.log(wavesurfer.options.endTime);
	});
}




// ************** //
// Initialization //
// ************** //

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get('collection')) return;
    
    // Clear data button
    document.getElementById('clearDataBtn').addEventListener('click', () => {
		localStorage.clear();
		location.reload();
	});

  	document.getElementById('volumeSlider').addEventListener('input', (e) => {
		const volume = e.target.value / 100;
		if (wavesurfer) {
			wavesurfer.setVolume(volume);
		}
	});

	document.getElementById('submitGuess').addEventListener('click', checkGuess);
 	document.getElementById('guessInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            checkGuess();
        }
    });

	document.getElementById('giveUpBtn').addEventListener('click', giveUp);
    document.getElementById('nextBtn').addEventListener('click', nextRound);

  	// Lifeline event listeners
    document.getElementById('timeLifeline').addEventListener('click', useTimeLifeline);
    document.getElementById('hintLifeline').addEventListener('click', useHintLifeline);
    document.getElementById('yearLifeline').addEventListener('click', useYearLifeline);
    document.getElementById('skipLifeline').addEventListener('click', useSkipLifeline);
    document.getElementById('expandLifeline').addEventListener('click', useExpandLifeline);
    
    // Ensure body state matches initial gameState
    changeState(gameState.state);

    // Ensure certain elements are in their default visibility states
    const repeatBtn = document.getElementById('repeatBtn');
    if (repeatBtn) repeatBtn.hidden = true;
    const progressTimer = document.getElementById('progressTimer');
    if (progressTimer) progressTimer.hidden = false; // default shown during playback
    // timer display visibility will be managed per-round based on mode (hasTimeout) via data attributes and startRound()


    await loadGameData();
});

async function loadGameData() {

    // Get URL parameters
    const params = new URLSearchParams(window.location.search);
    const collectionId = params.get('collection');
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
        }).filter(song => song !== null && song.audioFile);

        gameState.collection = collectionData;

		setupGame();

    } catch (error) {
        console.error('Failed to load collection:', error);
        showCollectionError();
    }
}


function setupGame() {
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
	
	// Hide score displays based on game style (use the 'hidden' attribute so CSS handles layout)
	if (gameStyle === 2) {
		const songScoreDiv = document.querySelector('.game-info > div:first-child > div:last-child');
		if (songScoreDiv) songScoreDiv.hidden = true;
	} else if (gameStyle === 3) {
		const sourceScoreDiv = document.querySelector('.game-info > div:first-child > div:first-child');
		if (sourceScoreDiv) sourceScoreDiv.hidden = true;
	}
	
	// Hide stats based on game style
	if (gameStyle === 3) {
		const sourcesStatsDiv = document.querySelector('.stats > div:nth-child(2)');
		if (sourcesStatsDiv) sourcesStatsDiv.hidden = true;
	} else if (gameStyle === 2) {
		const songsStatsDiv = document.querySelector('.stats > div:nth-child(3)');
		if (songsStatsDiv) songsStatsDiv.hidden = true;
	}
	
	const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode') || localStorage.getItem('selectedMode') || 'default';
	const collectionId = params.get('collection');
	let collectionsUrl = localStorage.getItem('collectionsUrl') || params.get('data') || '';

	// Set base URL for audio files
	collectionsUrl = collectionsUrl.replace(/\/$/, ''); // Remove trailing slash
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
	gameState.lifelines.expand = { remaining: gameState.settings.lifelines.expand.total, total: gameState.settings.lifelines.expand.total };
	
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
	} else {
		// ensure no src so CSS can hide it
		startScreenCover.src = '';
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
	gameState.rounds = roundsSlider.value;
	
	// Update display when slider changes
	roundsSlider.addEventListener('input', () => {
		roundsValue.textContent = padNumber(roundsSlider.value);
		gameState.rounds = roundsSlider.value;
	});
	
	// Add start button listener
	document.getElementById('startGameBtn').addEventListener('click', () => {
		initGame();
	});
}

function showCollectionError() {
    // Mark the start screen as having a collection error; CSS will hide the normal controls
    const startScreen = document.getElementById('startScreen');
    startScreen.dataset.error = 'collection';
}

function initGame() {
	// switch to game state (CSS will show/hide screens)
	changeState(STATE.game);
	document.getElementById('gameCollectionTitle').textContent = gameState.collection.title;

    const numRounds = parseInt(gameState.rounds);
    const shuffled = [...gameState.collection.songs].sort(() => Math.random() - 0.5);
    gameState.shuffledSongs = shuffled.slice(0, numRounds);

    updateUI();

	startGame();
}

async function startGame() {


	await startRound();

	initAudio();
	updateAudio();

	console.log(gameState)
	console.log(wavesurfer)

}



async function startRound() {

 	if (gameState.currentSongIndex >= gameState.shuffledSongs.length) {
    	// All rounds complete - check if game over or win
		gameState.success = true;
        endGame();
        return;
    }

	changeState(STATE.game)
    
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
    gameState.isExpanded = false;  // Reset expand state
    gameState.lifelineUsedThisRound = { time: false, hint: false, year: false, skip: false, expand: false };  // Reset per-round usage
    
    // Generate random startTime based on startTime and endTime
    try {
		const audioUrl = gameState.currentSong.audioFile.startsWith('http')
			? gameState.currentSong.audioFile
			: gameState.baseUrl + '/audio/' + gameState.currentSong.audioFile;
		const duration = await getAudioDuration(audioUrl);
		gameState.currentSong.duration = duration;

		const endPadding = 5;
		// Use original start/end if present, else default to 0/duration
		let origStart = extractTime(gameState.currentSong.startTime);
		let origEnd = extractTime(gameState.currentSong.endTime);

		let minStart = (typeof origStart === 'number' && !isNaN(origStart)) ? origStart : 0;
		let maxEnd = (typeof origEnd === 'number' && !isNaN(origEnd)) ? origEnd : duration;

		// Ensure maxEnd is not beyond duration - endPadding
		maxEnd = Math.max(Math.min(maxEnd, duration - endPadding), minStart + 1);

		// Calculate the latest possible start time for the clip
		let maxClipStart = Math.max(maxEnd - gameState.clipDuration, minStart);
		let startTime = minStart;
		if (maxClipStart > minStart) {
			startTime = minStart + Math.random() * (maxClipStart - minStart);
		}
		let endTime = Math.min(startTime + gameState.clipDuration, maxEnd);

		// Clamp values to valid range
		startTime = Math.max(0, Math.min(startTime, duration - 1));
		endTime = Math.max(startTime + 1, Math.min(endTime, duration - endPadding));

		gameState.currentSong.startTime = startTime;
		gameState.currentSong.endTime = endTime;

		gameState.currentSong.originalStartTime = startTime;
		gameState.currentSong.originalEndTime = endTime;

    } catch (error) {
        console.error('Failed to get audio duration, using 0:', error);
        gameState.currentSong.startTime = 0;
    }
    
    // Store original clip boundaries for CSS highlighting when guessed correctly
    gameState.originalStartTime = gameState.currentSong.startTime;
    gameState.originalEndTime = gameState.currentSong.endTime;
    
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

	// Clear audioPlayer
	document.getElementById('audioPlayer').style.setProperty('--initial_start', 0);
	document.getElementById('audioPlayer').style.setProperty('--initial_end', 0);
	document.getElementById('audioPlayer').dataset.hidden = "true";

    // Auto-focus input so player can start typing immediately
    setTimeout(() => {
        document.getElementById('guessInput').focus();
    }, 100);
    
    // Reset UI elements' visibility (CSS state controls screens, elements like repeat/timer handled locally)
    const repeatBtn = document.getElementById('repeatBtn');
    if (repeatBtn) repeatBtn.hidden = true;
    const progressTimer = document.getElementById('progressTimer');
    if (progressTimer) progressTimer.hidden = false;
    document.getElementById('progressBar').style.setProperty('--progress', 0);
    
	// Cover Image
	const audioUrl = gameState.currentSong.audioFile.startsWith('http') ? 
					gameState.currentSong.audioFile : 
					gameState.baseUrl + '/audio/' + gameState.currentSong.audioFile;
	extractAudioCover(audioUrl).then(src => {	document.getElementById("album-img").src = src; });

    // Update answer display (hidden)
    updateAnswerDisplay();
    
    // Update UI (score, lives, round number)
    updateUI();
    
    // Update give up button text and visibility
    const giveUpBtn = document.getElementById('giveUpBtn');
    if (giveUpBtn) {
        giveUpBtn.hidden = false;
        giveUpBtn.textContent = 'Give Up';
    }
    
    // Let CSS know whether we have a timeout (show/hide via CSS)
    document.body.dataset.hasTimeout = gameState.hasTimeout ? 'true' : 'false';

    // Also ensure the timer display element's hidden attribute matches the mode
    const timerDisplay = document.getElementById('timerDisplay');
    if (timerDisplay) timerDisplay.hidden = !gameState.hasTimeout;

    
    // Update lifeline buttons
    updateLifelineButtons();

	console.log(gameState.currentSong.sources.map(source => source[1]))
	console.log(gameState.currentSong.title.filter((title, i) => i !== 0))

	// Mark this round as active
    const roundId = Date.now() + Math.random(); // Unique ID for this playback
    gameState.currentRoundId = roundId;
    
	const startTime = gameState.currentSong.startTime || 0;
	const endTime = gameState.currentSong.endTime || gameState.currentSong.duration || 0;

    // Calculate effective clip duration
    let effectiveClipDuration = gameState.clipDuration;
    if (endTime !== null && endTime > startTime) {
        effectiveClipDuration = Math.min(gameState.clipDuration, endTime - startTime);
    }
    if (endTime === null && gameState.currentSong.duration > 0) {
        effectiveClipDuration = Math.min(effectiveClipDuration, gameState.currentSong.duration - startTime - 5);
    }
    gameState.effectiveClipDuration = Math.max(effectiveClipDuration, 1); // minimum 1 second to avoid division by zero

    // Start countdown only if requested (new round)
    if (gameState.hasTimeout && gameState.canGuess) {
        startCountdown();
    }
    
    // Store reference to current round for timer validation
    const thisRoundId = roundId;
    
    // Set up clip timer to stop audio after effectiveClipDuration
    gameState.clipTimer = setTimeout(() => {
        // Only pause if we're still on the same round
        if (gameState.currentRoundId === thisRoundId) {
            //! PAUSE AUDIO
            
            // Always show replay button after clip ends (unless game is over)
            if (gameState.lives > 0) {
                const repeatBtn = document.getElementById('repeatBtn');
                if (repeatBtn) repeatBtn.hidden = false;
                const progressTimer = document.getElementById('progressTimer');
                if (progressTimer) progressTimer.hidden = true;
            }
        }
    }, effectiveClipDuration * 1000);
}

function playSong() {
	wavesurfer.play();
}

function stopSong() {
	wavesurfer.stop();
}

function playFullSong() {

	gameState.currentSong.startTime = 0;
	gameState.currentSong.endTime = gameState.currentSong.duration;

	wavesurfer.options.startTime = gameState.currentSong.startTime;
	wavesurfer.options.endTime = gameState.currentSong.endTime;

	// waveform rendering is handled in updateAudio when the audio player is revealed
	if (gameState.state == STATE.next) {
		const startPercent = (gameState.currentSong.originalStartTime / gameState.currentSong.duration) * 100;
		const endPercent = Math.min((gameState.currentSong.originalEndTime / gameState.currentSong.duration) * 100, 100);

		const audioPlayer = document.getElementById("audioPlayer")
		audioPlayer.style.setProperty('--initial_start', startPercent.toFixed(3) + '%');
		audioPlayer.style.setProperty('--initial_end', endPercent.toFixed(3) + '%');
		audioPlayer.dataset.hidden = "false";
	}

	updateUI();
	updateProgressBar();
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
        
        // Action buttons will be hidden by endGame() when state moves to END
        document.getElementById('guessInput').disabled = true;
        // Go directly to game over immediately
		gameState.success = false;
        endGame();
    } else {
        // Disable input and show result when timed out but still have lives
        document.getElementById('guessInput').disabled = true;
		document.getElementById('gameContent').dataset.correct = false;
        // Show result and next button if still alive (without revealing answer)
        showResult();
    }
}


function endGame() {

	changeState(STATE.end)

	const params = new URLSearchParams(window.location.search);
    const collectionId = params.get('collection');

    // Stop everything
	stopSong();

    clearTimeout(gameState.clipTimer);
    clearInterval(gameState.guessTimer);
    clearInterval(gameState.progressInterval);
    
    // State has been set to END via changeState(STATE.end) so CSS shows/hides screens and controls accordingly
    // Hide element-specific controls
    const repeatBtn = document.getElementById('repeatBtn');
    if (repeatBtn) repeatBtn.hidden = true;
    const timerDisplay = document.getElementById('timerDisplay');
    if (timerDisplay) timerDisplay.hidden = true;
    const progressTimer = document.getElementById('progressTimer');
    if (progressTimer) progressTimer.hidden = true;
    document.getElementById('lifelineButtons').hidden = true;
    
    // Update result screen based on success/failure
    const resultStatus = document.getElementById('resultStatus');

	resultStatus.textContent = gameState.success ? 'Success!' : 'Failure';
	resultStatus.style.color = gameState.success ? '#48bb78' : '#f56565';
    
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
        const coverUrl = randomCover.startsWith('http') ? randomCover : gameState.baseUrl + '/collections/' + collectionId + '/' + randomCover.replace('./', '');
        resultScreenCover.src = coverUrl;
        resultScreenCover.alt = `${gameState.collection.title} cover`;
    } else {
        resultScreenCover.src = '';
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
        if (sourcesDiv) sourcesDiv.hidden = true;
    } else if (gameStyle === 2) {
        const songsDiv = document.querySelector('#resultScreen > div > div > div:nth-child(4)');
        if (songsDiv) songsDiv.hidden = true;
    }
    
    // Display hearts if mode uses lives
    const heartsContainer = document.getElementById('resultHearts');
    const heartsDisplay = document.getElementById('resultHeartsDisplay');
    const totalLives = gameState.totalLives;
    
    if (totalLives !== 999) {
        heartsContainer.hidden = false;
        let heartsHTML = '';
        
        for (let i = 0; i < totalLives; i++) {
            const isLost = i >= gameState.lives;
            const style = isLost ? 'filter: grayscale(100%); opacity: 0.5;' : '';
            heartsHTML += `<span style="${style}">❤️</span>`;
        }
        
        heartsDisplay.innerHTML = heartsHTML;
    } else {
        heartsContainer.hidden = true;
    }
    
    // Display lifelines if any were available
    const lifelineContainer = document.getElementById('resultLifelines');
    const lifelineDisplay = document.getElementById('resultLifelinesDisplay');
    const hasLifelines = gameState.lifelines.time.total > 0 || gameState.lifelines.hint.total > 0 || 
                         gameState.lifelines.year.total > 0 || gameState.lifelines.skip.total > 0 || gameState.lifelines.expand.total > 0;
    
    if (hasLifelines) {
        lifelineContainer.hidden = false;
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
        
        // Expand lifeline
        if (gameState.lifelines.expand.total > 0) {
            const used = gameState.lifelines.expand.total === 999 ? 
                         false : gameState.lifelines.expand.remaining < gameState.lifelines.expand.total;
            const style = used ? 'filter: grayscale(100%); opacity: 0.5;' : '';
            lifelinesHTML += `<span style="${style}" title="Expand: ${used ? 'Used' : 'Unused'}">↔️</span>`;
        }
        
        lifelineDisplay.innerHTML = lifelinesHTML;
    } else {
        lifelineContainer.hidden = true;
    }

}
async function nextRound() {

	changeState(STATE.game)

	gameState.currentSongIndex++;

	// Stop audio and all timers
	stopSong();
  
    clearTimeout(gameState.clipTimer);
    clearInterval(gameState.guessTimer);
    
    await startRound();
	console.log("hi")
	wavesurfer.stop();
	updateAudio();
    updateUI();

    // Re-enable lifeline buttons for new round (they'll be updated based on availability)
    updateLifelineButtons();
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
        document.getElementById('guessInput').hidden = true;
		document.getElementById('gameContent').dataset.revealed = true;
		document.getElementById('gameContent').dataset.correct = true;

        // Let the song play to the end and show full progress
        clearTimeout(gameState.clipTimer);
		
		changeState(STATE.next);

        playFullSong();
        //! Resume playback if it was paused

		if (!wavesurfer.isPlaying()) {
			playSong();
		} 
    }
    
    // Show result (only if not game over)
    if (sourceCorrect || songCorrect) {
        showResult();
    } else {
        // Add shake animation to answer display
        const answerDisplay = document.querySelector('#answerDisplay');
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
        document.getElementById('guessInput').disabled = true;
        document.getElementById('guessInput').value = '';
    
		gameState.success = false;
        endGame();
        return;
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

function changeState(state) {
	if (!state && state !== 0) return;

	gameState.state = state;
	document.body.dataset.state = state;

	// waveform rendering is handled in updateAudio when the audio player is loaded and shown.
}

// Helper for setting boolean body flags used by CSS selectors

function giveUp() {

    clearTimeout(gameState.clipTimer);
    clearInterval(gameState.guessTimer);
    
	gameState.success = false;
    endGame();
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
        // Move into NEXT state so UI (CSS) shows the next button and hides game actions
        changeState(STATE.next);
        
        // Stop the countdown timer when next state appears
        clearInterval(gameState.guessTimer);
    }
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
        if (separator) separator.hidden = true;
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
            if (separator) separator.hidden = false;
        } else {
            songPart.innerHTML = '';
            if (separator) separator.hidden = true;
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
if (separator) separator.hidden = false;
        
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

	document.getElementById("answerDisplay").classList.remove("hidden");
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
        livesContainer.hidden = true;
    } else {
        livesContainer.hidden = false;
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




// ********* //
// Lifelines //
// ********* //

function updateLifelineButtons() {
    const lifelineContainer = document.getElementById('lifelineButtons');
    const timeBtn = document.getElementById('timeLifeline');
    const hintBtn = document.getElementById('hintLifeline');
    const yearBtn = document.getElementById('yearLifeline');
    const timeCount = document.getElementById('timeCount');
    const hintCount = document.getElementById('hintCount');
    const yearCount = document.getElementById('yearCount');
    const skipBtn = document.getElementById('skipLifeline');
    const skipCount = document.getElementById('skipCount');
    const expandBtn = document.getElementById('expandLifeline');
    const expandCount = document.getElementById('expandCount');

    // Compute per-lifeline availability (true = button should be visible and usable now)
    const hasTime = gameState.lifelines.time.total > 0;
    const isTimeInfinite = hasTime && gameState.lifelines.time.total === 999;
    const timeCanUse = hasTime && gameState.hasTimeout && (isTimeInfinite ? !gameState.lifelineUsedThisRound.time : gameState.lifelines.time.remaining > 0) && gameState.canGuess;

    const hasHint = gameState.lifelines.hint.total > 0;
    const isHintInfinite = hasHint && gameState.lifelines.hint.total === 999;
    const hintCanUse = hasHint && (isHintInfinite ? !gameState.lifelineUsedThisRound.hint : gameState.lifelines.hint.remaining > 0) && gameState.canGuess;

    const hasYear = gameState.lifelines.year.total > 0;
    const isYearInfinite = hasYear && gameState.lifelines.year.total === 999;
    const yearCanUse = hasYear && (isYearInfinite ? !gameState.lifelineUsedThisRound.year : gameState.lifelines.year.remaining > 0) && gameState.canGuess && !gameState.yearRevealed;

    const hasSkip = gameState.lifelines.skip.total > 0;
    const isSkipInfinite = hasSkip && gameState.lifelines.skip.total === 999;
    const skipCanUse = hasSkip && (isSkipInfinite ? !gameState.lifelineUsedThisRound.skip : gameState.lifelines.skip.remaining > 0) && gameState.canGuess;

    const hasExpand = gameState.lifelines.expand.total > 0;
    const isExpandInfinite = hasExpand && gameState.lifelines.expand.total === 999;
    const song = gameState.currentSong || { startTime: 0, endTime: null, duration: 0 };
    const isAlreadyFull = song.startTime === 0 && (song.endTime === null || song.endTime >= song.duration);
    const expandCanUse = hasExpand && (isExpandInfinite ? !gameState.lifelineUsedThisRound.expand : gameState.lifelines.expand.remaining > 0) && gameState.canGuess && !isAlreadyFull && !gameState.isExpanded;

    // Show container if any lifeline is enabled by mode/collection (total > 0)
    const anyAvailable = hasTime || hasHint || hasYear || hasSkip || hasExpand;
    lifelineContainer.hidden = !anyAvailable;

    // Time lifeline: visible if hasTime; disabled when not usable right now
    timeCount.textContent = hasTime ? (isTimeInfinite ? '∞' : gameState.lifelines.time.remaining) : '';
    if (hasTime) {
        timeBtn.hidden = false;
        timeBtn.disabled = !timeCanUse;
    } else {
        timeBtn.hidden = true;
        timeBtn.disabled = true;
    }

    // Hint lifeline
    hintCount.textContent = hasHint ? (isHintInfinite ? '∞' : gameState.lifelines.hint.remaining) : '';
    if (hasHint) {
        hintBtn.hidden = false;
        hintBtn.disabled = !hintCanUse;
    } else {
        hintBtn.hidden = true;
        hintBtn.disabled = true;
    }

    // Year lifeline
    yearCount.textContent = hasYear ? (isYearInfinite ? '∞' : gameState.lifelines.year.remaining) : '';
    if (hasYear) {
        yearBtn.hidden = false;
        yearBtn.disabled = !yearCanUse;
    } else {
        yearBtn.hidden = true;
        yearBtn.disabled = true;
    }

    // Skip lifeline
    skipCount.textContent = hasSkip ? (isSkipInfinite ? '∞' : gameState.lifelines.skip.remaining) : '';
    if (hasSkip) {
        skipBtn.hidden = false;
        skipBtn.disabled = !skipCanUse;
    } else {
        skipBtn.hidden = true;
        skipBtn.disabled = true;
    }

    // Expand lifeline
    expandCount.textContent = hasExpand ? (isExpandInfinite ? '∞' : gameState.lifelines.expand.remaining) : '';
    if (hasExpand) {
        expandBtn.hidden = false;
        expandBtn.disabled = !expandCanUse;
    } else {
        expandBtn.hidden = true;
        expandBtn.disabled = true;
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

async function useSkipLifeline() {
    const isInfinite = gameState.lifelines.skip.total === 999;
    const canUse = isInfinite ? !gameState.lifelineUsedThisRound.skip : gameState.lifelines.skip.remaining > 0;
    
    if (!canUse || !gameState.canGuess) return;
    
    if (isInfinite) {
        gameState.lifelineUsedThisRound.skip = true;
    } else {
        gameState.lifelines.skip.remaining--;
    }

	nextRound();

    // Temporarily disable skip button to prevent rapid skipping
    const skipBtn = document.getElementById('skipLifeline');
    if (skipBtn) {
        skipBtn.classList.add('skip-disabled');
        setTimeout(() => {
            skipBtn.classList.remove('skip-disabled');
        }, 500);
    }
}

function useExpandLifeline() {
    const isInfinite = gameState.lifelines.expand.total === 999;
    const canUse = isInfinite ? !gameState.lifelineUsedThisRound.expand : gameState.lifelines.expand.remaining > 0;
    
    if (!canUse || !gameState.canGuess) return;
    
    // Set start and end to full song
    gameState.currentSong.startTime = 0;
    gameState.currentSong.endTime = gameState.currentSong.duration;
    gameState.isExpanded = true;  // Mark as expanded
    
    //! Stop current playback
    clearTimeout(gameState.clipTimer);
    clearInterval(gameState.progressInterval);
    
    //! play audio

	playFullSong();
    
    // Mark as used this round or deduct if limited
    if (isInfinite) {
        gameState.lifelineUsedThisRound.expand = true;
    } else {
        gameState.lifelines.expand.remaining--;
    }
    
    updateLifelineButtons();
}

// **************** //
// Helper Functions //
// **************** //





function extractTime(str) {
	if (!str) { return str; }

	if (typeof str === 'string' && str.includes(':')) {
		const parts = str.split(':');
		return parseInt(parts[0]) * 60 + parseInt(parts[1]);
	} else {
		return parseFloat(str);
	}
}

function normalize_str(str) {
    return str.toLowerCase().trim().replace(/^the\s+/, '').replace(/^a\s+/, '').replace(/^an\s+/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace('&','and').replace(/[^a-z0-9 ]/g, '').replace('  ',' ').trim();
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function getAudioDuration(audioUrl) {
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

function getTitle(song) {
    if (song.title && song.title.length > 1) {
        return song.title[1];
    } else if (song.title) {
        return song.title;
    }
    return '';
}

function extractAudioCover(url) {
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
