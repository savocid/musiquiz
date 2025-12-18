// ********* //
// Variables //
// ********* //

const STATE = {
  start: 0,
  game: 1,
  next: 2,
  end: 3,
};

const gameState_default = {
	state: STATE.start,
    collection: null,
    settings: null,
	rounds: 0,
    timeout: null,
    lifelines: {
        time:   { remaining: 0, total: 0, used: false, },
        hint:   { remaining: 0, total: 0, used: false, },
        year:   { remaining: 0, total: 0, used: false, },
        skip:   { remaining: 0, total: 0, used: false, },
        expand: { remaining: 0, total: 0, used: false, }
    },
    shuffledSongs: [],
	currentSong: null,
    currentSongIndex: 0,
	result: {
		score: 0,
		sources: 0,
		totalSources: 0,
		songs: 0,
		totalSongs: 0,
	},

	revealed: {
		sources: [],
		songs: [],
		year: false,
	},



    baseUrl: '',




    sourceRevealed: [],
    songRevealed: false,
    yearRevealed: false,
	hintLettersRevealed: { source: [], song: [] },
    canGuess: true,



	
	
};

let gameState;

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

let audio = WaveSurfer.create({
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

const params = new URLSearchParams(window.location.search);
const paramsCollectionId = params.get('collection');
const paramsCollectionsUrl = localStorage.getItem('collectionsUrl') || params.get('data') || '';
const paramsMode = params.get('mode') || localStorage.getItem('selectedMode') || 'default';


// ************** //
// EventListeners //
// ************** //

document.addEventListener('DOMContentLoaded', async () => {
    if (!paramsCollectionId) return;
    
    // Clear data button
    document.getElementById('clearDataBtn').addEventListener('click', () => {
		localStorage.clear();
		location.reload();
	});

  	document.getElementById('volumeSlider').addEventListener('input', (e) => {
		const volume = e.target.value / 100;
		if (audio) {
			audio.setVolume(volume);
		}
	});

	document.getElementById('submitGuess').addEventListener('click', checkGuess);
 	document.getElementById('guessInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            checkGuess();
        }
    });

    document.addEventListener('keydown', (e) => {
        // Handle Enter key for next round if next button is active
        if (e.key === 'Enter' && gameState.state == STATE.next) {
			nextRound();
			return;
        }

		const guessInput = document.getElementById('guessInput');
		// Only handle if game is active and input is enabled
		if (gameState.state == STATE.game) {
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
				if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
					guessInput.focus();
				}
			}
		}
	});

	document.getElementById('repeatBtn').addEventListener('click', repeatSong);
	document.getElementById('giveUpBtn').addEventListener('click', giveUp);
    document.getElementById('nextBtn').addEventListener('click', nextRound);

  	// Lifeline event listeners
    document.getElementById('timeLifeline').addEventListener('click', useTimeLifeline);
    document.getElementById('hintLifeline').addEventListener('click', useHintLifeline);
    document.getElementById('yearLifeline').addEventListener('click', useYearLifeline);
    document.getElementById('skipLifeline').addEventListener('click', useSkipLifeline);
    document.getElementById('expandLifeline').addEventListener('click', useExpandLifeline);
    
	// Slider
	const roundsSlider = document.getElementById('roundsSlider');
	const maxDigits = roundsSlider.max.toString().length;
	const padNumber = (num) => num.toString().padStart(maxDigits, '0');
	roundsSlider.addEventListener('input', () => {
		roundsValue.textContent = padNumber(roundsSlider.value);
		gameState.rounds = roundsSlider.value;
	});
	
	// Add start button listener
	document.getElementById('startGameBtn').addEventListener('click', () => {
		startGame();
	});

    await loadGameData();
});


// ************** //
// Initialization //
// ************** //

async function loadGameData() {

   	gameState = gameState_default;

    if (!paramsCollectionId) {
        console.error('No collection ID in URL');
		document.getElementById('startScreen').dataset.error = 'collection';
        return;
    }

	try {
        // Fetch collection data from individual collection directory
        const collectionDataUrl = `${paramsCollectionsUrl}/collections/${paramsCollectionId}/data.json`;
        const collectionResponse = await fetch('https://' + collectionDataUrl);
        if (!collectionResponse.ok) {
            console.error('Failed to fetch collection data.json:', collectionResponse.status, collectionResponse.statusText);
			document.getElementById('startScreen').dataset.error = 'collection';
            return;
        }
        const collectionData = await collectionResponse.json();

        // Fetch songs data
        const songsDataUrl = `${paramsCollectionsUrl}/audio/songs.json`;
        const songsResponse = await fetch('https://' + songsDataUrl);
        if (!songsResponse.ok) {
            console.error('Failed to fetch songs.json:', songsResponse.status, songsResponse.statusText);
			document.getElementById('startScreen').dataset.error = 'collection';
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

		updateStart();

    } catch (error) {
        console.error('Failed to load collection:', error);
		document.getElementById('startScreen').dataset.error = 'collection';
    }
}



// *************** //
// Round Functions //
// *************** //

async function startGame() {

	changeState(STATE.game);

    const numRounds = parseInt(gameState.rounds);
    const shuffled = [...gameState.collection.songs].sort(() => Math.random() - 0.5);
    gameState.shuffledSongs = shuffled.slice(0, numRounds);

	await initRound();
	await initAudio();
}

async function initRound() {

 	if (gameState.currentSongIndex >= gameState.shuffledSongs.length) {
    	// All rounds complete - check if game over or win
        endGame();
        return;
    }

    clearInterval(gameState.timeout);
	updateRoundStates();

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
		let maxClipStart = Math.max(maxEnd - gameState.settings.clipDuration, minStart);
		let startTime = minStart;
		if (maxClipStart > minStart) {
			startTime = minStart + Math.random() * (maxClipStart - minStart);
		}
		let endTime = Math.min(startTime + gameState.settings.clipDuration, maxEnd);

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


}

async function initAudio() {
	if (audio && audio.isPlaying()) { audio.stop(); }

    const audioUrl = gameState.currentSong.audioFile.startsWith('http') ? gameState.currentSong.audioFile : gameState.baseUrl + '/audio/' + gameState.currentSong.audioFile;

    audio.load(audioUrl);
	
	audio.once('ready', () => {
		const startTime = gameState.currentSong.startTime || 0;
		const endTime = gameState.currentSong.endTime || gameState.currentSong.duration || 0;

		audio.options.startTime = startTime;
		audio.options.endTime = endTime;
		audio.getRenderer().reRender();
		audio.play(0)

		startRound();
	});
}

function startRound() {

	changeState(STATE.game)
    
	gameState.result.sources += gameState.currentSong.sources.filter(s => s[0]).length;
    gameState.result.songs += 1;

    updateGame();
    updateAnswerDisplay();
    updateLifelineButtons();

	startCountdown();

	console.log(gameState.currentSong.sources.map(source => source[1]))
	console.log(gameState.currentSong.title.filter((title, i) => i !== 0))
}

function endGame() {

	changeState(STATE.end)

	stopSong();

    clearInterval(gameState.timeout);
    
	updateGame();

	updateResult();
}

async function nextRound() {

	changeState(STATE.game)

	gameState.currentSongIndex++;

	stopSong();
  
    clearInterval(gameState.timeout);
    
	await initRound();
    await initAudio();
}

function giveUp() {

	showResult();
}

function changeState(state) {
	gameState.state = state;
	document.body.dataset.state = state;
}


// **************** //
// Update Functions //
// **************** //

function updateStart() {
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

	// Set base URL for audio files
	gameState.baseUrl = 'https://' + paramsCollectionsUrl.replace(/\/$/, ''); // Remove trailing slash

	// Always use current MODES definition (ensures fresh settings)
	gameState.settings = { ...MODES[paramsMode], mode: paramsMode, collectionId: paramsCollectionId };
	gameState.settings.totalLives = gameState.settings.lives;

	
	// Initialize lifelines based on mode
	if (gameState.settings.timeout > 0) {
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
		const coverUrl = randomCover.startsWith('http') ? randomCover : gameState.baseUrl + '/collections/' + paramsCollectionId + '/' + randomCover.replace('./', '');
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

	// Attach progress update events
  	audio.on('timeupdate', updateProgressBar);
    audio.on('ready', updateProgressBar);
    audio.on('interaction', updateProgressBar);
  
	const volume = (localStorage.getItem('musicQuizVolume') || 50) / 100;
	audio.setVolume(volume);

	document.getElementById('gameCollectionTitle').textContent = gameState.collection.title;
}

function updateGame() {
    // Update score display with source/song stats
    document.getElementById('sourceScore').textContent = `${gameState.result.totalSources}`;
    document.getElementById('songScore').textContent = `${gameState.result.totalSongs}`;
    
	// Hide/show timerDisplay
	document.getElementById("timerDisplay").hidden = gameState.settings.timeout <= 0;

    // Update lives display with hearts
    const livesElement = document.getElementById('lives');
    const livesContainer = livesElement.parentElement;
    
    if (gameState.settings.totalLives === 999) {
        // Hide lives display for infinite lives
        livesContainer.hidden = true;
    } else {
        livesContainer.hidden = false;
        // Create all hearts once if not already created
        if (livesElement.querySelectorAll('.heart').length === 0) {
            const heartsArray = [];
            for (let i = 0; i < gameState.settings.totalLives; i++) {
                heartsArray.push('<span class="heart">❤️</span>');
            }
            livesElement.innerHTML = heartsArray.join('');
        }
        // Show/hide hearts based on current lives
        const hearts = livesElement.querySelectorAll('.heart');
        hearts.forEach((heart, index) => {
            if (index < gameState.settings.lives) {
				heart.style.visibility = 'visible';
            } else if (index === gameState.settings.lives) {
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
    
	// Clear input
    document.getElementById('guessInput').value = '';
    document.getElementById('guessInput').disabled = gameState.state != STATE.game;

	// Original Start/End Time Display
	const startPercent = (gameState.currentSong.originalStartTime / gameState.currentSong.duration) * 100;
	const endPercent = Math.min((gameState.currentSong.originalEndTime / gameState.currentSong.duration) * 100, 100);
	const audioPlayer = document.getElementById("audioPlayer")
	audioPlayer.style.setProperty('--initial_start', startPercent.toFixed(3) + '%');
	audioPlayer.style.setProperty('--initial_end', endPercent.toFixed(3) + '%');

	// Album Image
	document.getElementById('album-img').src = "";
	const audioUrl = gameState.currentSong.audioFile.startsWith('http') ? 
					gameState.currentSong.audioFile : 
					gameState.baseUrl + '/audio/' + gameState.currentSong.audioFile;
	extractAudioCover(audioUrl).then(src => {	document.getElementById("album-img").src = src; });

    document.getElementById('round').textContent = gameState.currentSongIndex + 1;
    document.getElementById('total').textContent = gameState.shuffledSongs.length;

	audio.getRenderer().reRender();
}

function updateResult() {

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
        const coverUrl = randomCover.startsWith('http') ? randomCover : gameState.baseUrl + '/collections/' + paramsCollectionId + '/' + randomCover.replace('./', '');
        resultScreenCover.src = coverUrl;
        resultScreenCover.alt = `${gameState.collection.title} cover`;
    } else {
        resultScreenCover.src = '';
    }


 	// Update mode info (just the name, not "Mode")
    let modeName = '';
    if (gameState.settings.lives === 999 || (gameState.settings && gameState.settings.lives === 999)) {
        modeName = 'Trivial';
    } else if (gameState.settings.lives === 3 || (gameState.settings && gameState.settings.lives === 3)) {
        // Check timeout to differentiate Default from Intense
        if (gameState.settings.timeout > 0 || (gameState.settings && gameState.settings.timeout > 0)) {
            modeName = 'Intense';
        } else {
            modeName = 'Default';
        }
    } else if (gameState.settings.lives === 1 || (gameState.settings && gameState.settings.lives === 1)) {
        modeName = 'Sudden Death';
    }
    document.getElementById('resultMode').textContent = modeName;
    
    // Update stats
    // If completed successfully, we've finished all rounds (including the current one)
    // If failed, currentSongIndex shows how many we completed (0-based, but incremented after each)
    document.getElementById('totalRounds').textContent = gameState.shuffledSongs.length;
    document.getElementById('sourcesGuessed').textContent = gameState.result.totalSources;
    document.getElementById('totalSources').textContent = gameState.result.sources;
    document.getElementById('songsGuessed').textContent = gameState.result.totalSongs;
    document.getElementById('totalSongs').textContent = gameState.result.songs;


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
    const totalLives = gameState.settings.totalLives;
    
    if (totalLives !== 999) {
        heartsContainer.hidden = false;
        let heartsHTML = '';
        
        for (let i = 0; i < totalLives; i++) {
            const isLost = i >= gameState.settings.lives;
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

function updateRoundStates() {
	gameState.timeout = null;
    gameState.currentSong = gameState.shuffledSongs[gameState.currentSongIndex];
    gameState.sourceRevealed = [];
    gameState.songRevealed = false;
    gameState.canGuess = true;
    gameState.hintLettersRevealed = { source: gameState.currentSong.sources.map(() => []), song: [] };
    gameState.yearRevealed = false;
	Object.values(gameState.lifelines).forEach(l => l.used = true);
}

function updateProgressBar() {
    if (!audio || !gameState.currentSong) return;

    const startTime = gameState.currentSong.startTime || 0;
	const endTime = gameState.currentSong.endTime || gameState.currentSong.duration || 0;

	const waveTime = audio.getCurrentTime();
    const segDuration = endTime - startTime;
    const segTime = Math.max(0, waveTime - startTime);
	const segRemaining = segDuration > 0 ? Math.max(0, Math.min(segDuration, Math.ceil(endTime - waveTime))) : 0;
    const progress = Math.max(0, Math.min(1, segTime / segDuration));

	document.getElementById('progressBar').style.setProperty('--progress', progress);
	document.getElementById('progressTimer').textContent = formatTime(segRemaining);
}


// *********** //
// Guess Logic //
// *********** //

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
            gameState.result.score += 100;
            gameState.result.totalSongs++;
        }
        requiredGuessed = song.title[0] ? gameState.songRevealed : true;
        allGuessed = gameState.songRevealed;
    } else if (gameStyle === 2) {
        // Source only
        if (sourceCorrect) {
            gameState.result.score += 50;
            const sourceRevealedAfter = gameState.sourceRevealed.length;
            gameState.result.totalSources += (sourceRevealedAfter - sourceRevealedBefore);
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
            gameState.result.score += 50;
            const sourceRevealedAfter = gameState.sourceRevealed.length;
            gameState.result.totalSources += (sourceRevealedAfter - sourceRevealedBefore);
        }
        if (songCorrect) {
            gameState.result.score += 100;
            gameState.result.totalSongs++;
        }
        const allSourcesRevealed = gameState.sourceRevealed.length === song.sources.length;
        requiredGuessed = allRequiredSourcesRevealed && (song.title[0] ? gameState.songRevealed : true);
        allGuessed = allSourcesRevealed && gameState.songRevealed;
    }
    // Only stop countdown timer if all guessed (but keep clip timer running)
    if (allGuessed) {
        clearInterval(gameState.timeout);
        gameState.canGuess = false;
        document.getElementById('guessInput').disabled = true;

        // Let the song play to the end and show full progress
		
		changeState(STATE.next);

        playFullSong();
        //! Resume playback if it was paused

		if (!audio.isPlaying()) {
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
		if (gameState.settings.lives !== 999) {
			gameState.settings.lives--;
		}
        showResult();
    }

    // Update UI first so lives count is correct
    updateGame();
    
    // Check game over BEFORE showing result
    if (gameState.settings.lives <= 0) {
        document.getElementById('guessInput').disabled = true;
        document.getElementById('guessInput').value = '';

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
    if ((requiredGuessed || !gameState.canGuess) && gameState.settings.lives > 0) {
        // Move into NEXT state so UI (CSS) shows the next button and hides game actions
        changeState(STATE.next);
        
        // Stop the countdown timer when next state appears
        clearInterval(gameState.timeout);
    }
}


// ************** //
// Play Functions //
// ************** //

function playSong() {
	audio.play();
}

function pauseSong() {
	audio.pause();
}

function stopSong() {
	audio.stop();
}

function repeatSong() {
	if (!audio || !gameState.currentSong) return;

    const startTime = gameState.currentSong.startTime || 0;
	const endTime = gameState.currentSong.endTime || gameState.currentSong.duration || 0;

	audio.play(startTime, endTime);
}

function playFullSong() {

	gameState.currentSong.startTime = 0;
	gameState.currentSong.endTime = gameState.currentSong.duration;

	audio.options.startTime = gameState.currentSong.startTime;
	audio.options.endTime = gameState.currentSong.endTime;

	updateGame();
	updateProgressBar();
}


// ******* //
// Timeout //
// ******* //

function startCountdown() {
    
    if (gameState.settings.timeout <= 0 || gameState.state != STATE.game) { return; }

    // Always clear any existing guess timer before starting a new one
    clearInterval(gameState.timeout);
    let timeLeft = gameState.settings.timeout;
    const timerElement = document.getElementById('timer');
    timerElement.textContent = timeLeft;
    // Update color based on time remaining
    updateTimerColor(timeLeft, gameState.settings.timeout);
    gameState.timeout = setInterval(() => {
        timeLeft--;
        timerElement.textContent = timeLeft;
        // Update color as time decreases
        updateTimerColor(timeLeft, gameState.settings.timeout);
        if (timeLeft <= 0) {
            clearInterval(gameState.timeout);
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
    if (gameState.settings.lives !== 999) {
        gameState.settings.lives--;
    }
    
    // Don't reveal answers on timeout (only reveal on correct guess or hints)
    // Keep the answer hidden so player can try again next round
    
    // Update UI first so lives count is correct
    updateGame();
    
    // Check game over
    if (gameState.settings.lives <= 0) {
        // On game over, reveal the answer
        gameState.sourceRevealed = gameState.currentSong.sources.map((s, i) => s[0] ? i : null).filter(i => i !== null);
        gameState.songRevealed = true;
        updateAnswerDisplay();
        
        // Action buttons will be hidden by endGame() when state moves to END
        document.getElementById('guessInput').disabled = true;
        // Go directly to game over immediately
        endGame();
    } else {
        // Disable input and show result when timed out but still have lives
        document.getElementById('guessInput').disabled = true;
        // Show result and next button if still alive (without revealing answer)
        showResult();
    }
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
    const timeCanUse = hasTime && gameState.settings.timeout > 0 && (isTimeInfinite ? !gameState.lifelines.time.used : gameState.lifelines.time.remaining > 0) && gameState.canGuess;

    const hasHint = gameState.lifelines.hint.total > 0;
    const isHintInfinite = hasHint && gameState.lifelines.hint.total === 999;
    const hintCanUse = hasHint && (isHintInfinite ? !gameState.lifelines.hint.used : gameState.lifelines.hint.remaining > 0) && gameState.canGuess;

    const hasYear = gameState.lifelines.year.total > 0;
    const isYearInfinite = hasYear && gameState.lifelines.year.total === 999;
    const yearCanUse = hasYear && (isYearInfinite ? !gameState.lifelines.year.used : gameState.lifelines.year.remaining > 0) && gameState.canGuess && !gameState.yearRevealed;

    const hasSkip = gameState.lifelines.skip.total > 0;
    const isSkipInfinite = hasSkip && gameState.lifelines.skip.total === 999;
    const skipCanUse = hasSkip && (isSkipInfinite ? !gameState.lifelines.skip.used : gameState.lifelines.skip.remaining > 0) && gameState.canGuess;

    const hasExpand = gameState.lifelines.expand.total > 0;
    const isExpandInfinite = hasExpand && gameState.lifelines.expand.total === 999;
    const song = gameState.currentSong || { startTime: 0, endTime: null, duration: 0 };
    const isAlreadyFull = song.startTime === 0 && (song.endTime === null || song.endTime >= song.duration);
    const expandCanUse = hasExpand && (isExpandInfinite ? !gameState.lifelines.expand.used : gameState.lifelines.expand.remaining > 0) && gameState.canGuess && !isAlreadyFull;

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
    const canUse = isInfinite ? !gameState.lifelines.time.used : gameState.lifelines.time.remaining > 0;
    
    if (!canUse || gameState.settings.timeout <= 0 || !gameState.canGuess) return;
    
    // Add 10 seconds to timer
    if (gameState.timeout) {
        clearInterval(gameState.timeout);
        let currentTime = parseInt(document.getElementById('timer').textContent);
        currentTime += 10;
        document.getElementById('timer').textContent = currentTime;
        
        // Restart countdown with new time
        gameState.timeout = setInterval(() => {
            currentTime--;
            document.getElementById('timer').textContent = currentTime;
            
            if (currentTime <= 0) {
                clearInterval(gameState.timeout);
                handleTimeout();
            }
        }, 1000);
    }
    
    // Mark as used this round or deduct if limited
    if (isInfinite) {
        gameState.lifelines.time.used = true;
    } else {
        gameState.lifelines.time.remaining--;
    }
    
    updateLifelineButtons();
}

function useHintLifeline() {
    const isInfinite = gameState.lifelines.hint.total === 999;
    const canUse = isInfinite ? !gameState.lifelines.hint.used : gameState.lifelines.hint.remaining > 0;
    
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
        gameState.lifelines.hint.used = true;
    } else {
        gameState.lifelines.hint.remaining--;
    }
    
    // Update display with hints
    updateAnswerDisplay();
    updateLifelineButtons();
}

function useYearLifeline() {
    const isInfinite = gameState.lifelines.year.total === 999;
    const canUse = isInfinite ? !gameState.lifelines.year.used : gameState.lifelines.year.remaining > 0;
    
    if (!canUse || !gameState.canGuess || gameState.yearRevealed) return;
    
    const song = gameState.currentSong;
    
    // Reveal year if available
    if (song.year) {
        gameState.yearRevealed = true;
    }
    
    // Mark as used this round or deduct if limited
    if (isInfinite) {
        gameState.lifelines.year.used = true;
    } else {
        gameState.lifelines.year.remaining--;
    }
    
    // Update display to show year
    updateAnswerDisplay();
    updateLifelineButtons();
}

async function useSkipLifeline() {
    const isInfinite = gameState.lifelines.skip.total === 999;
    const canUse = isInfinite ? !gameState.lifelines.skip.used : gameState.lifelines.skip.remaining > 0;
    
    if (!canUse || !gameState.canGuess) return;
    
    if (isInfinite) {
        gameState.lifelines.skip.used = true;
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
    const canUse = isInfinite ? !gameState.lifelines.expand.used : gameState.lifelines.expand.remaining > 0;
    
    if (!canUse || !gameState.canGuess) return;
    
    // Set start and end to full song
    gameState.currentSong.startTime = 0;
    gameState.currentSong.endTime = gameState.currentSong.duration;
    
    //! Stop current playback
    
    //! play audio

	playFullSong();
    
    // Mark as used this round or deduct if limited
    if (isInfinite) {
        gameState.lifelines.expand.used = true;
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
