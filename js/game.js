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
    lifelines: {},
    shuffledSongs: [],
	currentSong: null,
    currentSongIndex: 0,
	revealed: {
		sources: [],
		songs: [],
		year: false,
	},
	result: {
		score: 0,
		sources: 0,
		totalSources: 0,
		songs: 0,
		totalSongs: 0,
	},




    sourceRevealed: [],
    songRevealed: false,
    yearRevealed: false,
	hintLettersRevealed: { source: [], song: [] },
    canGuess: true,
};

let gameState;

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

let collectionsUrl = localStorage.getItem('collectionsUrl') || params.get('data') || null; 
let collectionId = localStorage.getItem('collection') || params.get('collection') || null; 
let currentMode = localStorage.getItem('selectedMode') || params.get('mode') || 'default'; 
collectionsUrl = collectionsUrl ? cleanUrl(collectionsUrl) : collectionsUrl;


// ************** //
// EventListeners //
// ************** //

document.addEventListener('DOMContentLoaded', async () => {

    if (!collectionsUrl || !collectionId) return;

    const params = new URLSearchParams(window.location.search);
    params.set('mode', currentMode);
    params.set('collection', collectionId);
	params.set('data', collectionsUrl);

	let newUrl = params.toString() ? `${window.location.origin}${window.location.pathname}?${params.toString()}` : `${window.location.origin}${window.location.pathname}`;
	history.replaceState(null, '', newUrl);

  	document.getElementById('volumeSlider').addEventListener('input', (e) => {
		const volume = e.target.value / 100;
		if (audio) {
			audio.setVolume(volume);
		}
	});

	document.getElementById('submitGuess').addEventListener('click', checkGuess);

    document.addEventListener('keydown', (e) => {
        // Handle Enter key for next round if next button is active
        if (e.key === 'Enter' && gameState.state == STATE.next) {
			nextRound();
			return;
        }

		if (e.key === 'Enter') {
            checkGuess();
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

	document.getElementById('lifelineButtons').innerHTML = "";
	Object.keys(lifeLines).forEach(key => {
		document.getElementById('lifelineButtons').innerHTML += `<button class="btn btn-lifeline" data-lifeline="${key}" id="${key}Lifeline" title="${lifeLines[key].description}">${lifeLines[key].symbol} ${lifeLines[key].text} (<span id="${key}Count">0</span>)</button>`;
	});

  	// Lifeline event listeners
	document.querySelectorAll('#lifelineButtons > button').forEach(el => {
		el.addEventListener('click', () => { useLifeline(el.dataset.lifeline); });
	});

	// Rounds Slider
	document.getElementById('roundsSlider').addEventListener('input', updateRoundsSlider);
	
	// Add start button listener
	document.getElementById('startGameBtn').addEventListener('click', () => {
		startGame();
	});

	// Audio
	audio.on('timeupdate', updateProgress);
    audio.on('ready', updateProgress);
    audio.on('interaction', updateProgress);

    await loadGameData();
});


// ************** //
// Initialization //
// ************** //

async function loadGameData() {

   	gameState = gameState_default;

    if (!collectionId) {
        console.error('No collection ID in URL');
		document.getElementById('startScreen').dataset.error = 'collection';
        return;
    }

	try {
        // Fetch collection data from individual collection directory
        const collectionDataUrl = `https://${collectionsUrl}/collections/${collectionId}/data.json`;
        const collectionResponse = await fetch(collectionDataUrl);
        if (!collectionResponse.ok) {
            console.error('Failed to fetch collection data.json:', collectionResponse.status, collectionResponse.statusText);
			document.getElementById('startScreen').dataset.error = 'collection';
            return;
        }
        const collectionData = await collectionResponse.json();

        // Fetch songs data
        const songsDataUrl = `https://${collectionsUrl}/audio/songs.json`;
        const songsResponse = await fetch(songsDataUrl);
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
		gameState.collection.songs = gameState.collection.songs.map(song => ({ ...song, audioFile: `https://${collectionsUrl}/audio/${song.audioFile}` }));

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

	updateState(STATE.start);

    const numRounds = parseInt(gameState.rounds);
    const shuffled = [...gameState.collection.songs].sort(() => Math.random() - 0.5);
    gameState.shuffledSongs = shuffled.slice(0, numRounds);

	if (gameState.currentSongIndex >= gameState.shuffledSongs.length) {
        endGame();
        return;
    }

	await initRound();
}

async function initRound() {
    stopTimeout();
	updateRoundStates();

    // Generate random startTime based on startTime and endTime
    try {
		const duration = await getAudioDuration(gameState.currentSong.audioFile);
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
		
		await initAudio();

    } catch (error) {
        console.error('Failed to get audio duration, using 0:', error);
        gameState.currentSong.startTime = 0;
    }


}

async function initAudio() {
	if (audio && audio.isPlaying()) { audio.stop(); }

    audio.load(gameState.currentSong.audioFile);
	
	audio.options.startTime = 0;
  	audio.options.endTime = 1;

	audio.once('ready', () => {
		const startTime = gameState.currentSong.startTime || 0;
		const endTime = gameState.currentSong.endTime || gameState.currentSong.duration || 0;

		audio.options.startTime = startTime;
		audio.options.endTime = endTime;
		audio.getRenderer().reRender();

		removeLoad();
		startRound();
	});
}

function startRound() {
    
	updateState(STATE.game);

	gameState.result.sources += gameState.currentSong.sources.filter(s => s[0]).length;
    gameState.result.songs += 1;

    updateGame();
    updateAnswerDisplay();
    updateLifelineButtons();

	startTimeout();

	renderState(STATE.game);

	console.log(gameState.currentSong.sources.map(source => source[1]))
	console.log(gameState.currentSong.title.filter((title, i) => i !== 0))
}

function endGame() {

	updateState(STATE.end);

	stopSong();
	stopTimeout();

	updateGame();
	updateResult();

	renderState(STATE.end);
}

function prepRound() {
	updateState(STATE.next);
	playFullSong();
	renderState(STATE.next);
}

async function nextRound() {

	updateState(STATE.game);

	gameState.currentSongIndex++;

	stopSong();
    stopTimeout();
    
	if (gameState.currentSongIndex >= gameState.shuffledSongs.length) {
        endGame();
        return;
    }

	await initRound();
}

function giveUp() {

	updateGame();
	updateResult();

	showResult();
}

function updateState(state) {
	applyLoad();
	gameState.state = state;
}

function renderState(state) {
	removeLoad();
	if (state === STATE.game || state === STATE.next) { audio.getRenderer().reRender(); };
	document.body.dataset.state = state;
}


// **************** //
// Update Functions //
// **************** //

function updateStart() {

	// Always use current MODES definition (ensures fresh settings)
	gameState.settings = { ...MODES[currentMode], mode: currentMode, collectionId: collectionId };
	gameState.settings.totalLives = gameState.settings.lives;

	// Update Volume
	const volume = (localStorage.getItem('musicQuizVolume') || 50) / 100;
	audio.setVolume(volume);

	// Populate start screen
	document.getElementById('collectionTitle').textContent = gameState.collection.title;
	document.getElementById('collectionDescription').textContent = gameState.collection.description || '';
	document.getElementById('collectionDifficulty').textContent = gameState.collection.difficulty;
	document.getElementById('collectionDifficulty').className = `difficulty-${gameState.collection.difficulty.toLowerCase().replace(' ', '-')}`;

	// Update Collection Cover
	const randomCover = gameState.collection.covers[Math.floor(Math.random() * gameState.collection.covers.length)];
	document.getElementById('startScreenCover').src = 
		gameState.collection.covers && gameState.collection.covers.length > 0 ? `https://${collectionsUrl}/collections/${collectionId}/${randomCover.replace('./', '')}` : 
		"";
	document.getElementById('startScreenCover').title = 
		gameState.collection.covers && gameState.collection.covers.length > 0 ? `${gameState.collection.title}` : 
		"";

	// Set lifeline defaults
	Object.keys(lifeLines).forEach(key => {
		gameState.lifelines[key] = { remaining: MODES[currentMode].lifelines[key].total, total: MODES[currentMode].lifelines[key].total };
	});

	document.body.dataset.style = gameState.collection.gameStyle;

	updateRoundsSlider();
}

function updateGame() {

	// Hide/show timerDisplay
	document.getElementById("timerDisplay").hidden = gameState.settings.timeout <= 0;

	// Score
	document.getElementById('sourceLabel').textContent = gameState.collection.sourceName+"s" || "Sources";
	document.getElementById('sourceScore').textContent = `${gameState.result.totalSources}`;
    document.getElementById('songScore').textContent = `${gameState.result.totalSongs}`;

	// Source Answer Display Label
	//!document.getElementById('sourcePart').innerHTML = `<span>${gameState.collection.sourceName || "Source"}</span>`;

	// Update Collection Label
	document.getElementById('gameCollectionTitle').textContent = gameState.collection.title;

	// GuessInput Placeholder
	document.getElementById('guessInput').placeholder = 
		gameState.collection.gameStyle === 1 ? `Input ${gameState.collection.sourceName.toLowerCase()}/song name...` : 
		gameState.collection.gameStyle === 2 ? `Input ${gameState.collection.sourceName.toLowerCase()} name...` : 
		`Input song name...`;
	
	// Hide unused score
	document.querySelector('#scorePanel .songs').hidden = gameState.collection.gameStyle === 2;
	document.querySelector('#scorePanel .sources').hidden = gameState.collection.gameStyle === 3;

	// Hearts
    document.getElementById('livesPanel').hidden = gameState.settings.totalLives === Infinity;
	document.getElementById('lives').innerHTML = 
		gameState.settings.totalLives !== Infinity ? '<span class="heart">❤️</span>'.repeat(gameState.settings.totalLives) : 
		"";

	document.querySelectorAll('#livesPanel .heart').forEach((heart, index) => {
		const isVisible = index <= gameState.settings.lives;
		heart.style.visibility = isVisible ? 'visible' : 'hidden';
		heart.classList.toggle('heartbeat', isVisible && index === gameState.settings.lives);
		if (!isVisible) heart.classList.remove('heartbeat');
	});

	// Update Give Up Button
 	document.querySelector('#giveUpBtn > span').style.display = gameState.settings.lives != Infinity ? "initial" : "none"

	// Update Input
    document.getElementById('guessInput').value = '';
    document.getElementById('guessInput').disabled = gameState.state != STATE.game;

	// Original Start/End Time Display
	document.getElementById("audioPlayer").style.setProperty('--originalStart', gameState.currentSong.originalStartTime);
	document.getElementById("audioPlayer").style.setProperty('--originalEnd', gameState.currentSong.originalEndTime);
	document.getElementById("audioPlayer").style.setProperty('--duration', gameState.currentSong.duration);

	// Album Image
	document.getElementById('album-img').src = "";
	extractAudioCover(gameState.currentSong.audioFile).then(src => { document.getElementById("album-img").src = src; });

	// Update Rounds
    document.getElementById('currentRound').textContent = gameState.currentSongIndex + 1;
    document.getElementById('totalRounds').textContent = gameState.shuffledSongs.length;

}

function updateResult() {

    // Update collection info
    document.getElementById('resultCollection').textContent = gameState.collection.title;
    document.getElementById('resultDescription').textContent = gameState.collection.description || '';
    document.querySelector('#resultScreen .difficulty').textContent = gameState.collection.difficulty;
    document.querySelector('#resultScreen .difficulty').className = `difficulty-${gameState.collection.difficulty.toLowerCase().replace(' ', '-')}`;

	// Update Collection Cover
	const randomCover = gameState.collection.covers[Math.floor(Math.random() * gameState.collection.covers.length)];
	document.getElementById('resultScreenCover').src = 
		gameState.collection.covers && gameState.collection.covers.length > 0 ? `https://${collectionsUrl}/collections/${collectionId}/${randomCover.replace('./', '')}` : 
		"";
	document.getElementById('resultScreenCover').title = 
		gameState.collection.covers && gameState.collection.covers.length > 0 ? `${gameState.collection.title}` : 
		"";

	// Update Mode Label
    document.querySelector('#resultScreen .mode').textContent = gameState.settings.mode;
    
    // Update Stats
	document.querySelector('#resultScreen .sourcesLabel').textContent = `${(gameState.collection.sourceName || "Source")}s`;
    document.querySelector('#resultScreen .totalRounds').textContent = gameState.rounds;
    document.querySelector('#resultScreen .sourcesGuessed').textContent = gameState.result.totalSources;
    document.querySelector('#resultScreen .totalSources').textContent = gameState.result.sources;
    document.querySelector('#resultScreen .songsGuessed').textContent = gameState.result.totalSongs;
    document.querySelector('#resultScreen .totalSongs').textContent = gameState.result.songs;

	// Hearts
  	document.getElementById('resultHearts').hidden = gameState.settings.totalLives === Infinity;
	document.getElementById('resultHeartsDisplay').innerHTML = 
    	gameState.settings.totalLives !== Infinity ? [...Array(gameState.settings.totalLives)].map((_, i) => `<span class="heart" ${i >= gameState.settings.lives ? 'style="filter: grayscale(100%); opacity: 0.5;"' : ''}>❤️</span>`).join('') : 
    	"";

	// Lifelines
	Object.keys(gameState.lifelines).forEach(key => {
		document.querySelector(`#resultLifelinesDisplay .${key}`).dataset.hidden = gameState.lifelines[key].remaining === 0;
	});
}

function updateLifelineButtons() {

	// Update Lifeline Visibility
	Object.keys(gameState.lifelines).forEach(key => {
		document.getElementById(`${key}Lifeline`).hidden = gameState.lifelines[key].total == 0;
		document.getElementById(`${key}Lifeline`).disabled = gameState.lifelines[key].used || !gameState.lifelines[key].remaining;
		document.getElementById(`${key}Count`).textContent = gameState.lifelines[key].remaining.toString().replace("Infinity","∞");
	});
}


function _updateAnswerDisplay() {

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
	Object.values(gameState.lifelines).forEach(l => l.used = false);
	document.querySelectorAll("#answerDisplay .source, #answerDisplay .song, #answerDisplay .year").forEach((el, index) => { el.dataset.reveal = false; });
}

function updateProgress() {
    if (!audio || !gameState.currentSong) return;

	const currentTime = audio.getCurrentTime();
	const remaining = gameState.currentSong.endTime - currentTime;
	const progress = (currentTime - gameState.currentSong.startTime) / (gameState.currentSong.endTime - gameState.currentSong.startTime);

	document.getElementById('progressBar').style.setProperty('--progress', progress);
	document.getElementById('progressTimer').textContent = formatTime(Math.ceil(remaining.toFixed(3)).toFixed(0));
}

function updateRoundsSlider() {
	const roundsSlider = document.getElementById('roundsSlider');

	if (!roundsSlider.max) { // Initialization
		roundsSlider.max = gameState.collection.songs.length;
		roundsSlider.value = gameState.collection.songs.length >= 10 ? 10 : Math.ceil(gameState.collection.songs.length * 0.5);
	}

	const maxDigits = roundsSlider.max.toString().length;
	const padNumber = (num) => num.toString().padStart(maxDigits, '0');
	document.getElementById('roundsValue').textContent = padNumber(roundsSlider.value);
	gameState.rounds = roundsSlider.value;
}

function applyLoad() {
	document.getElementById('progressTimer').style.visibility = "hidden";
	document.getElementById('progressBar').style.visibility = "hidden";
	document.getElementById('audioPlayer').style.visibility = "hidden";
	document.getElementById('startGameBtn').classList.add("loading");
}
function removeLoad() {
	document.getElementById('progressTimer').style.visibility = "visible";
	document.getElementById('progressBar').style.visibility = "visible";
	document.getElementById('audioPlayer').style.visibility = "visible";
	document.getElementById('startGameBtn').classList.remove("loading");
}


// *********** //
// Guess Logic //
// *********** //

function _checkGuess() {
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
        stopTimeout();
        gameState.canGuess = false;
        document.getElementById('guessInput').disabled = true;

        // Let the song play to the end and show full progress

        playFullSong();
        //! Resume playback if it was paused

		if (!audio.isPlaying()) {
			playSong();
		}

		prepRound();
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
		if (gameState.settings.lives !== Infinity) {
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
        
        // Stop the countdown timer when next state appears
		stopTimeout();

        prepRound();
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
	updateProgress();
}


// ******* //
// Timeout //
// ******* //

function startTimeout() {
    
    if (gameState.settings.timeout <= 0 || gameState.state != STATE.game) { return; }

    // Always clear any existing guess timer before starting a new one
    stopTimeout();
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
            stopTimeout();
            // Time's up - mark as incorrect
            handleTimeout();
        }
    }, 1000);
}

function stopTimeout() {
    clearInterval(gameState.timeout);
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
    if (gameState.settings.lives !== Infinity) {
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
		prepRound();
        // Disable input and show result when timed out but still have lives
        document.getElementById('guessInput').disabled = true;
        // Show result and next button if still alive (without revealing answer)
        showResult();
    }
}


// ********* //
// Lifelines //
// ********* //

function useLifeline(lifeline) {

	switch(lifeline) {
		case "hint": {
			break;
		}
		case "cover": {
			document.querySelector(".album-container").dataset.reveal = true;
			break;
		}
		case "year": {
			document.querySelector("#answerDisplay .year").dataset.reveal = true;
			break;
		}
		case "expand": {
			playFullSong();
			break;
		}
		case "skip": {
			prepRound();
			break;
		}
		case "time": {
			break;
		}
		default: {
			break;
		}
	}

	gameState.lifelines[lifeline].used = true;
	gameState.lifelines[lifeline].remaining--
	updateLifelineButtons();
}

function updateAnswerDisplay() {

	const sourcesContainer = document.querySelector("#answerDisplay .sources");
	sourcesContainer.innerHTML = "";
 	gameState.currentSong.sources.forEach((source, i) => {
		const index = i+1;

		const sourceWrap = document.createElement("span");
		sourceWrap.classList.add(`source`);
		sourceWrap.dataset.index = i;
		sourceWrap.dataset.optional = !gameState.currentSong.sources[i][0];
		sourcesContainer.appendChild(sourceWrap);

		const sourceTrue = document.createElement("span");
		sourceTrue.classList.add("true");
		sourceTrue.textContent = source[1];
		sourceWrap.appendChild(sourceTrue);

		const sourceFalse = document.createElement("span");
		sourceFalse.classList.add("false");
		sourceFalse.textContent = gameState.currentSong.sources > 1 ? `${gameState.collection.sourceName} ${index}` : `${gameState.collection.sourceName}`;
		sourceWrap.appendChild(sourceFalse);
	});

	const songsContainer = document.querySelector("#answerDisplay .songs");
	songsContainer.innerHTML = "";

	const songWrap = document.createElement("span");
	songWrap.classList.add(`song`);
	songWrap.dataset.index = 1;
	songWrap.dataset.optional = !gameState.currentSong.title[0];
	songsContainer.appendChild(songWrap);

	const songTrue = document.createElement("span");
	songTrue.classList.add("true");
	songTrue.textContent = gameState.currentSong.title[1];
	songWrap.appendChild(songTrue);

	const songFalse = document.createElement("span");
	songFalse.classList.add("false");
	songFalse.textContent = `Song`;
	songWrap.appendChild(songFalse);

	document.querySelectorAll("#answerDisplay .source, #answerDisplay .song, #answerDisplay .year").forEach((el, index) => { el.dataset.reveal = false; });

	document.querySelector("#answerDisplay .year").textContent = ` (${gameState.currentSong.year})`;
}

function checkGuess() {

	let inputValue = document.getElementById('guessInput').value;
    if (!inputValue) return;
    
    inputValue = normalize_str(inputValue);

	const sources = gameState.currentSong.sources;
	sources.forEach((source, index) => {
		for (let i = 1; i < source.length; i++) {

			if (inputValue.includes(normalize_str(source[i]))) {
				revealSource(true,index);
				break;
			}
		}
	});

	const song = gameState.currentSong.title;
	for (let i = 1; i < song.length; i++) {
		if (inputValue.includes(normalize_str(song[i]))) {
			revealSong(true);
			break;
		}
	}

	switch(gameState.collection.gameStyle) {
		case 1: { // All Required Sources/Song
			if (requiredSourcesRevealed() && requiredSongsRevealed()) {
				prepRound();
			}
			break;
		}
		case 2: { // All Required Sources
			if (requiredSourcesRevealed()) {
				prepRound();
			}
			break;
		}
		case 3: { // Required Song
			if (requiredSongsRevealed()) {
				prepRound();
			}
			break;
		}
		default: {
			break;
		}
	}

	document.getElementById('guessInput').value = "";
}

function requiredSourcesRevealed() {
	const sources = document.querySelectorAll("#answerDisplay .source");
	for (let i = 0; i < sources.length; i++) {
		if (sources[i].dataset.optional) { continue; }
		if (!sources[i].dataset.reveal) { return false; }
	};

	return true;
}

function requiredSongsRevealed() {
	const songs = document.querySelectorAll("#answerDisplay .song");
	for (let i = 0; i < songs.length; i++) {
		if (songs[i].dataset.optional) { continue; }
		if (!songs[i].dataset.reveal) { return false; }
	};

	return true;
}

function revealSource(bool,i) {
	const source = document.querySelector(`#answerDisplay .source[data-index='${i}']`)
	source && (source.dataset.reveal = bool);
}

function revealSong(bool) {
	const song = document.querySelector(`#answerDisplay .song`)
	song && (song.dataset.reveal = bool);
}

function useTimeLifeline() {
    const isInfinite = gameState.lifelines.time.total === Infinity;
    const canUse = isInfinite ? !gameState.lifelines.time.used : gameState.lifelines.time.remaining > 0;
    
    if (!canUse || gameState.settings.timeout <= 0 || !gameState.canGuess) return;
    
    // Add 10 seconds to timer
    if (gameState.timeout) {
        stopTimeout();
        let currentTime = parseInt(document.getElementById('timer').textContent);
        currentTime += 10;
        document.getElementById('timer').textContent = currentTime;
        
        // Restart countdown with new time
        gameState.timeout = setInterval(() => {
            currentTime--;
            document.getElementById('timer').textContent = currentTime;
            
            if (currentTime <= 0) {
                stopTimeout();
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
    const isInfinite = gameState.lifelines.hint.total === Infinity;
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
    const isInfinite = gameState.lifelines.year.total === Infinity;
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

    const isInfinite = gameState.lifelines.skip.total === Infinity;
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
    const isInfinite = gameState.lifelines.expand.total === Infinity;
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
    return `${mins.toFixed(0)}:${secs.toString().padStart(2, '0')}`;
}

async function getAudioDuration(url) {
    return new Promise((resolve, reject) => {
        const a = new Audio();
        
        a.addEventListener('loadedmetadata', () => {
            resolve(a.duration);
        });
        
        a.addEventListener('error', (error) => {
            reject(error);
        });
        
        a.src = url;
        a.load();
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
