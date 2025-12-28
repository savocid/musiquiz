// ********* //
// Variables //
// ********* //

const STATE = {
  init: 0,
  game: 1,
  next: 2,
  result: 3,
};

const gameState_default = {
	state: null,
    collection: null,
    settings: null,
	rounds: 0,
    timeout: null,
    lifelines: {},
    shuffledSongs: [],
	currentSong: null,
    currentSongIndex: 0,
	result: {
		rounds: 0,
		score: 0,
		sources: 0,
		totalSources: 0,
		artists: 0,
		totalArtists: 0,
		songs: 0,
		totalSongs: 0,
	},
	revealed: {
		sources: {},
		artists: {},
		songs: {},
	},
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
	autoplay: false,
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

    if (!collectionsUrl || !collectionId) { document.getElementById('startScreen').dataset.error = 'collection'; return; };

    const params = new URLSearchParams(window.location.search);
    params.set('mode', currentMode);
    params.set('collection', collectionId);
	params.set('data', collectionsUrl);

	let newUrl = params.toString() ? `${window.location.origin}${window.location.pathname.replace(/\/$/,"")}?${params.toString()}` : `${window.location.origin}${window.location.pathname}`;
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
	document.getElementById('continueBtn').addEventListener('click', () => {
		if (!document.getElementById("continueBtn").classList.contains("btn-success")) {
			gameState.settings.lives--
			updateHearts();
		};
		continueRound();
	});
    document.getElementById('nextBtn').addEventListener('click', nextRound);

	document.getElementById('lifelineButtons').innerHTML = "";
	Object.keys(lifeLines).forEach(key => {
		document.getElementById('lifelineButtons').innerHTML += `<button class="btn btn-lifeline" data-lifeline="${key}" id="${key}Lifeline" title="${lifeLines[key].description}">${lifeLines[key].symbol} ${lifeLines[key].text} (<span id="${key}Count">0</span>)</button>`;
	});

  	// Lifeline event listeners
	document.querySelectorAll('#lifelineButtons > button').forEach(el => {
		el.addEventListener('click', () => { useLifeline(el.dataset.lifeline); });
	});

	// Add start button listener
	document.getElementById('startGameBtn').addEventListener('click', () => {
		gameState.rounds && (startGame());
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

   	try {
		gameState = structuredClone(gameState_default);
	} catch {
		gameState = JSON.parse(JSON.stringify(gameState_default));
	}

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

	if (gameState.state == STATE.init) { return; }

	updateState(STATE.init);

    const numRounds = parseInt(gameState.rounds);
    const shuffled = [...gameState.collection.songs.filter(song => song.year >= gameState.minYear && song.year <= gameState.maxYear)].sort(() => Math.random() - 0.5);
    gameState.shuffledSongs = shuffled.slice(0, numRounds);

	if (gameState.currentSongIndex >= gameState.shuffledSongs.length) {
        endGame();
        return;
    }

	await initRound();
}

async function initRound() {
    stopTimeout();
    updateNewRound();

    try {
        // Get duration
        const duration = await extractAudioDuration(gameState.currentSong.audioFile);
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

        // Analyse quiet parts for this audio file (if available)
        let quietParts = [];
        try {
            quietParts = await findQuietParts(gameState.currentSong.audioFile);
        } catch (err) {
            console.warn('findQuietParts failed:', err);
            quietParts = [];
        }

        // Pick a start/end while avoiding quiet segments if possible
        const chosen = selectAudioClipWindow(quietParts, {
            minStart,
            maxClipStart,
            clipDuration: gameState.settings.clipDuration,
            duration
        });

        // Sanitize chosen values
        const startTime = Math.max(0, Math.min(typeof chosen.startTime === 'number' ? chosen.startTime : 0, Math.max(0, duration - 1)));
        const endTime = Math.max(startTime + 1, Math.min(typeof chosen.endTime === 'number' ? chosen.endTime : startTime + gameState.settings.clipDuration, duration));

        // Commit to state
        gameState.currentSong.startTime = startTime;
        gameState.currentSong.endTime = endTime;

        // Keep "original" values for UI display
        gameState.currentSong.originalStartTime = startTime;
        gameState.currentSong.originalEndTime = endTime;

        await initAudio();
    } catch (error) {
        console.error('Failed to get audio duration, using 0:', error);
        gameState.currentSong.startTime = 0;
        gameState.currentSong.endTime = Math.min(gameState.settings.clipDuration || 5, gameState.currentSong.duration || 1);
        gameState.currentSong.originalStartTime = gameState.currentSong.startTime;
        gameState.currentSong.originalEndTime = gameState.currentSong.endTime;
        await initAudio();
    }
}

function selectAudioClipWindow(quietParts = [], { minStart = 0, maxClipStart = 0, clipDuration = 5, duration = 0, attempts = 30 } = {}) {
    // ensure sane bounds
    maxClipStart = Math.max(minStart, maxClipStart);
    const reachableEnd = Math.min(maxClipStart + clipDuration, duration);

    // normalize, filter and sort quiet segments
    // Ignore quiet parts that are:
    // - too short (<= 3s)
    // - shorter than 25% of the clip duration
    // - or excessively large (>= 50% of total audio duration)
    const minQuietByClip = clipDuration * 0.25;
    const segs = (quietParts || [])
        .map(s => ({ start: s.start, end: s.end, dur: (s.end - s.start) }))
        .filter(s => {
            // drop if duration is not a positive number
            if (!isFinite(s.dur) || s.dur <= 0) return false;
            if (s.dur <= 3) return false; // too short
            if (s.dur < minQuietByClip) return false; // too small relative to clip
            if (duration > 0 && s.dur >= duration * 0.5) return false; // too large relative to total
            return true;
        })
        .sort((a, b) => a.start - b.start)
        .map(({ start, end }) => ({ start, end }));

    // 1) Find any non-quiet gaps that can fit the full clip (zero overlap)
    let cursor = minStart;
    const gaps = [];

    for (const seg of segs) {
        if (seg.end <= minStart) continue;
        if (seg.start >= reachableEnd) break;

        const gapStart = Math.max(cursor, minStart);
        const gapEnd = Math.min(seg.start, reachableEnd);

        if (gapEnd - gapStart >= clipDuration) {
            gaps.push({ start: gapStart, end: gapEnd });
        }

        cursor = Math.max(cursor, seg.end);
    }

    // tail gap
    if (reachableEnd - cursor >= clipDuration) {
        gaps.push({ start: cursor, end: reachableEnd });
    }

    // If any gaps exist, pick a random position inside a gap
    if (gaps.length > 0) {
        // weighted pick by available space
        const weights = gaps.map(g => Math.max(0, (g.end - g.start) - clipDuration + 0.0001));
        const totalW = weights.reduce((s, w) => s + w, 0);
        let r = Math.random() * totalW;
        for (let i = 0; i < gaps.length; i++) {
            if (r <= weights[i]) {
                const g = gaps[i];
                const start = g.start + Math.random() * (g.end - g.start - clipDuration);
                return { startTime: start, endTime: Math.min(start + clipDuration, duration) };
            }
            r -= weights[i];
        }
    }

    // 2) Fallback: try random starts and prefer minimal overlap (<50% if possible)
    let best = null;
    const effectiveMaxStart = Math.min(maxClipStart, Math.max(minStart, duration - clipDuration));

    for (let i = 0; i < attempts; i++) {
        const s = minStart + Math.random() * (effectiveMaxStart - minStart);
        const e = Math.min(s + clipDuration, duration);
        let maxOverlapFraction = 0;
        for (const seg of segs) {
            const overlap = Math.max(0, Math.min(e, seg.end) - Math.max(s, seg.start));
            const frac = overlap / (e - s);
            if (frac > maxOverlapFraction) maxOverlapFraction = frac;
        }

        // Prefer any candidate that has < 0.5 overlap
        if (maxOverlapFraction < 0.5) {
            return { startTime: s, endTime: e };
        }

        if (!best || maxOverlapFraction < best.overlap) {
            best = { startTime: s, endTime: e, overlap: maxOverlapFraction };
        }
    }

    // No acceptable candidate found — return the best we saw
    return { startTime: best.startTime, endTime: best.endTime };
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

		audio.options.autoplay = true;

		audio.seekTo(0)
		audio.play()

		audio.getRenderer().reRender();

		removeLoad();
		startRound();
	});

	audio.on('play', () => {
		document.getElementById("repeatBtn").hidden = audio.isPlaying();
	});
	audio.on('pause', () => {
		document.getElementById("repeatBtn").hidden = audio.isPlaying();
	});

	
}

async function startRound() {
    
	updateState(STATE.game);

    updateGame();
    updateAnswerDisplay();
    updateLifelineButtons();

	startTimeout();

	renderState(STATE.game);

	console.log(gameState.currentSong.sources.map(source => source[1]))
	console.log(gameState.currentSong.artists.map(artist => artist[1]))
	console.log(gameState.currentSong.title.filter((title, i) => i !== 0))
}

function continueRound() {
	updateState(STATE.next);

	playFullSong();
	stopTimeout();

	updateContinue();

	renderState(STATE.next);
}


function endGame() {

	updateState(STATE.result);

	stopSong();
	stopTimeout();

	updateResult();

	renderState(STATE.result);
}


async function nextRound() {

	if (gameState.state == STATE.game) { return; }

	updateState(STATE.game);

	gameState.currentSongIndex++;

	stopSong();
    stopTimeout();
    
	if (gameState.currentSongIndex >= gameState.shuffledSongs.length || gameState.settings.lives <= 0) {
        endGame();
        return;
    }

	await initRound();
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
	document.getElementById('collectionDifficulty').dataset.difficulty = gameState.collection.difficulty;

	// Update Collection Cover
	const randomCover = gameState.collection.covers[Math.floor(Math.random() * gameState.collection.covers.length)];
	document.getElementById('startScreenCover').src = 
		gameState.collection.covers && gameState.collection.covers.length > 0 ? `https://${collectionsUrl}/collections/${collectionId}/${randomCover.replace('./', '')}` : 
		"";
	document.getElementById('startScreenCover').title = 
		gameState.collection.covers && gameState.collection.covers.length > 0 ? `${gameState.collection.title}` : 
		"";


	// Hearts
    document.getElementById('livesPanel').hidden = gameState.settings.totalLives === Infinity;
	document.getElementById('lives').innerHTML = 
		gameState.settings.totalLives !== Infinity ? '<span class="heart">❤️</span>'.repeat(gameState.settings.totalLives) : 
		"";

	document.getElementById("repeatBtn").hidden = audio.isPlaying();

	// Set lifeline defaults
	Object.keys(lifeLines).forEach(key => {
		gameState.lifelines[key] = { remaining: MODES[currentMode].lifelines[key].total, total: MODES[currentMode].lifelines[key].total };
	});

	document.body.dataset.guess = gameState.collection.guess.join(",");

	updateYearSlider();
	updateRoundSlider();
}


function updateGame() {

	// Hide/show timerDisplay
	document.getElementById("timerDisplay").hidden = gameState.settings.timeout <= 0;

	// Score
	document.getElementById('sourceLabel').textContent = gameState.collection.sourceName+"s" || "Sources";

	// Update Collection Label
	document.getElementById('gameCollectionTitle').textContent = gameState.collection.title;
	
	// Hide unused score
	document.querySelector('#scorePanel .sources').hidden = !gameState.collection.guess.includes("Sources");
	document.querySelector('#scorePanel .artists').hidden = !gameState.collection.guess.includes("Artists");
	document.querySelector('#scorePanel .songs').hidden = !gameState.collection.guess.includes("Songs");

	// Update Continue Button
	document.getElementById('continueBtn').className = "btn btn-secondary";
 	document.querySelector('#continueBtn > span:last-child').style.display = gameState.settings.lives != Infinity ? "initial" : "none";

	// Update Input
    document.getElementById('guessInput').value = '';
    document.getElementById('guessInput').disabled = gameState.state != STATE.game;

	// Original Start/End Time Display
	document.getElementById("audioPlayer").style.setProperty('--originalStart', gameState.currentSong.originalStartTime);
	document.getElementById("audioPlayer").style.setProperty('--originalEnd', gameState.currentSong.originalEndTime);
	document.getElementById("audioPlayer").style.setProperty('--duration', gameState.currentSong.duration);

	// Cover Image
	document.getElementById('cover-img').src = "";
	extractAudioCover(gameState.currentSong.audioFile).then(src => { document.getElementById("cover-img").src = src; });
	document.querySelector(".cover-container").dataset.reveal = false;

	// Update Rounds
    document.querySelector('#gameContent .currentRound').textContent = gameState.currentSongIndex + 1;
    document.querySelector('#gameContent .totalRounds').textContent = gameState.shuffledSongs.length;

	// Reset Next Button
	document.getElementById("nextBtn").className = "btn btn-success";
	document.getElementById("nextBtn").textContent = "Next Song";

	// Reset reveal
	document.querySelectorAll("#answerDisplay .source, #answerDisplay .artist, #answerDisplay .song, #answerDisplay .year").forEach((el, index) => { el.dataset.reveal = false; });

	// Reset Hint Lifeline
	document.getElementById("answerDisplay").dataset.hint = false;
}

function updateRoundSlider() {

	const slider = document.getElementById("roundSlider");
	if (slider.noUiSlider) slider.noUiSlider.destroy();

	const maxRound = gameState.collection.songs.filter(song => song.year >= gameState.minYear && song.year <= gameState.maxYear).length;
	const minRound = !maxRound ? maxRound : 1;

	const storedVal = localStorage.getItem(`${collectionsUrl}-${collectionId}-rounds`)
	const valRound = storedVal && storedVal <= maxRound ? storedVal : maxRound >= 10 ? 10 : Math.ceil(maxRound * 0.5)

	noUiSlider.create(slider, {
        start: valRound,
        connect: true,
        step: 1,
		tooltips: false,
		value: valRound,
		margin: 0,
        range: {
            min: minRound,
            max: maxRound
        }
    });

	slider.noUiSlider.on('slide', () => {
		setRoundValue();

		const roundSlider = document.getElementById("roundSlider");
		const maxRound = gameState.collection.songs.filter(song => song.year >= gameState.minYear && song.year <= gameState.maxYear).length;
		const minRound = !maxRound ? maxRound : 1;

		const storedVal = localStorage.getItem(`${collectionsUrl}-${collectionId}-rounds`)
		const valRound = storedVal && storedVal <= maxRound ? storedVal : maxRound >= 10 ? 10 : Math.ceil(maxRound * 0.5)

		roundSlider.noUiSlider.updateOptions({ range: { min: minRound, max: maxRound } });
		roundSlider.noUiSlider.updateOptions({ value: valRound >= minRound && valRound <= maxRound ? valRound : minRound });
	});

	slider.noUiSlider.on('update', () => {
		setRoundValue();
	});

	setRoundValue();
}

function setRoundValue() {
	const roundSlider = document.getElementById("roundSlider");
	const value = roundSlider && roundSlider.noUiSlider ? roundSlider.noUiSlider.get() : null;

	if (!value || value == null) return;

	const valRound = parseInt(value);
	const maxRound = roundSlider.noUiSlider.options.range.max;

	document.getElementById("roundValue").textContent = `${valRound}/${maxRound}`;

	localStorage.setItem(`${collectionsUrl}-${collectionId}-rounds`, valRound);
	gameState.rounds = valRound;
}

function updateYearSlider() {

	const slider = document.getElementById("yearSlider");
	if (slider.noUiSlider) slider.noUiSlider.destroy();

	const years = gameState.collection.songs.map(item => item.year)
	const minYear = Math.min(...years);
	const maxYear = Math.max(...years);

	const minYearStored = localStorage.getItem(`${collectionsUrl}-${collectionId}-minYear`);
	const maxYearStored = localStorage.getItem(`${collectionsUrl}-${collectionId}-maxYear`);

	const minYearVal = (minYearStored && minYearStored >= minYear && minYearStored <= maxYear) ? minYearStored : minYear;
	const maxYearVal = (maxYearStored && maxYearStored >= minYear && maxYearStored <= maxYear) ? maxYearStored : maxYear;

	noUiSlider.create(slider, {
        start: [minYearVal, maxYearVal],
        connect: true,
        step: 1,
		tooltips: false,
		margin: 0,
		direction: "ltr",
        range: {
            min: minYear,
            max: maxYear
        }
    });

	slider.noUiSlider.on('slide', () => {
		setYearValue();
		setRoundValue();
		
		const roundSlider = document.getElementById("roundSlider");
		const maxRound = gameState.collection.songs.filter(song => song.year >= gameState.minYear && song.year <= gameState.maxYear).length;
		const minRound = !maxRound ? maxRound : 1;

		const storedVal = localStorage.getItem(`${collectionsUrl}-${collectionId}-rounds`)
		const valRound = storedVal && storedVal <= maxRound ? storedVal : maxRound >= 10 ? 10 : Math.ceil(maxRound * 0.5)

		roundSlider.noUiSlider.updateOptions({ range: { min: minRound, max: maxRound } });
		roundSlider.noUiSlider.updateOptions({ value: valRound >= minRound && valRound <= maxRound ? valRound : minRound });
	});

	slider.noUiSlider.on('update', () => {
		setYearValue();
		setRoundValue();
	});


	setYearValue();
	setRoundValue();
}

function setYearValue() {
	const yearSlider = document.getElementById("yearSlider");
	const values = yearSlider && yearSlider.noUiSlider ? yearSlider.noUiSlider.get() : null;

	if (!values || values == null) return;

	const minYear = parseInt(values[0]);
	const maxYear = parseInt(values[1]);
	document.getElementById("yearValue").textContent = `${minYear} - ${maxYear}`;

	localStorage.setItem(`${collectionsUrl}-${collectionId}-minYear`, minYear);
	localStorage.setItem(`${collectionsUrl}-${collectionId}-maxYear`, maxYear);

	gameState.minYear = minYear;
	gameState.maxYear = maxYear;
}

function updateHearts() {

	document.querySelectorAll('#livesPanel .heart').forEach((heart, index) => {
		const isVisible = index <= gameState.settings.lives;
		heart.style.filter = isVisible ? '' : 'grayscale(1)';
		heart.style.opacity = isVisible ? '' : '0.5';

		heart.classList.toggle('heartbeat', isVisible && index === gameState.settings.lives);
		if (!isVisible) heart.classList.remove('heartbeat');
	});
}

function updateContinue() {

	// Dynamic Next Button
	document.getElementById("nextBtn").className = (gameState.currentSongIndex+1 >= gameState.shuffledSongs.length || gameState.settings.lives <= 0) ? "btn btn-primary" : "btn btn-success";
	document.getElementById("nextBtn").textContent = (gameState.currentSongIndex+1 >= gameState.shuffledSongs.length || gameState.settings.lives <= 0) ? "View Results" : "Next Song";

	// Reset Hint Lifeline
	document.getElementById("answerDisplay").dataset.hint = false;

	updateScore();
}

function updateScore() {

	gameState.revealed.sources = Object.keys(gameState.revealed.sources).length ? gameState.revealed.sources : sourcesRevealed();
	gameState.revealed.artists = Object.keys(gameState.revealed.artists).length ? gameState.revealed.artists : artistsRevealed();
	gameState.revealed.songs = Object.keys(gameState.revealed.songs).length ? gameState.revealed.songs : songsRevealed();

	gameState.result.rounds = gameState.currentSongIndex + 1;

	gameState.result.sources += 
		gameState.revealed.sources.required.value +
		gameState.revealed.sources.optional.value;

	gameState.result.totalSources += 
		gameState.revealed.sources.required.total +
		gameState.revealed.sources.optional.total;

	gameState.result.artists += 
		gameState.revealed.artists.required.value +
		gameState.revealed.artists.optional.value;

	gameState.result.totalArtists += 
		gameState.revealed.artists.required.total +
		gameState.revealed.artists.optional.total;
	
	gameState.result.songs += 
		gameState.revealed.songs.required.value +
		gameState.revealed.songs.optional.value;

	gameState.result.totalSongs += 
		gameState.revealed.songs.required.total +
		gameState.revealed.songs.optional.total;

	gameState.result.score += 
		(50*gameState.revealed.sources.required.value) +
		(100*gameState.revealed.sources.optional.value) +
		(50*gameState.revealed.artists.required.value) +
		(100*gameState.revealed.artists.optional.value) +
		(50*gameState.revealed.songs.required.value) +
		(100*gameState.revealed.songs.optional.value);

	document.getElementById('sourceScore').textContent = `${gameState.result.sources}`;
	document.getElementById('artistScore').textContent = `${gameState.result.artists}`;
    document.getElementById('songScore').textContent = `${gameState.result.songs}`;
}

function updateResult() {

    // Update collection info
    document.getElementById('resultCollection').textContent = gameState.collection.title;
    document.getElementById('resultDescription').textContent = gameState.collection.description || '';
    document.querySelector('#resultScreen .difficulty > *:last-child').textContent = gameState.collection.difficulty;
    document.querySelector('#resultScreen .difficulty > *:last-child').dataset.difficulty = gameState.collection.difficulty;

	// Update Collection Cover
	const randomCover = gameState.collection.covers[Math.floor(Math.random() * gameState.collection.covers.length)];
	document.getElementById('resultScreenCover').src = 
		gameState.collection.covers && gameState.collection.covers.length > 0 ? `https://${collectionsUrl}/collections/${collectionId}/${randomCover.replace('./', '')}` : 
		"";
	document.getElementById('resultScreenCover').title = 
		gameState.collection.covers && gameState.collection.covers.length > 0 ? `${gameState.collection.title}` : 
		"";

	// Update Mode Label
    document.querySelector('#resultScreen .mode > span').textContent = MODES[currentMode].title;
    
    // Update Stats
	document.querySelector('#resultScreen .sources > *:first-child').textContent = `${(gameState.collection.sourceName || "Source")}s`;

	document.querySelector('#resultScreen .rounds > span > span:nth-of-type(1)').textContent = gameState.result.rounds;
    document.querySelector('#resultScreen .rounds > span > span:nth-of-type(2)').textContent = gameState.rounds;
    document.querySelector('#resultScreen .sources > span > span:nth-of-type(1)').textContent = gameState.result.sources;
    document.querySelector('#resultScreen .sources > span > span:nth-of-type(2)').textContent = gameState.result.totalSources;
	document.querySelector('#resultScreen .artists > span > span:nth-of-type(1)').textContent = gameState.result.artists;
    document.querySelector('#resultScreen .artists > span > span:nth-of-type(2)').textContent = gameState.result.totalArtists;
    document.querySelector('#resultScreen .songs > span > span:nth-of-type(1)').textContent = gameState.result.songs;
    document.querySelector('#resultScreen .songs > span > span:nth-of-type(2)').textContent = gameState.result.totalSongs;
 	
	document.querySelector('#resultScreen .sources').hidden = !gameState.collection.guess.includes("Sources");
	document.querySelector('#resultScreen .artists').hidden = !gameState.collection.guess.includes("Artists");
	document.querySelector('#resultScreen .songs').hidden = !gameState.collection.guess.includes("Songs");

	// Hearts
  	document.getElementById('resultHearts').hidden = gameState.settings.totalLives === Infinity;
	document.getElementById('resultHeartsDisplay').innerHTML = 
    	gameState.settings.totalLives !== Infinity ? [...Array(gameState.settings.totalLives)].map((_, i) => `<span class="heart" ${i >= gameState.settings.lives ? 'style="filter: grayscale(100%); opacity: 0.5;"' : ''}>❤️</span>`).join('') : 
    	"";

	// Lifelines
	Object.keys(gameState.lifelines).forEach(key => {
		document.querySelector(`#resultLifelinesDisplay .${key}`).dataset.hidden = gameState.lifelines[key].remaining === 0;
		document.querySelector(`#resultLifelinesDisplay .${key}`).hidden = gameState.lifelines[key].total === 0;
	});
}

function updateNewRound() {
	gameState.timeout = null;
    gameState.currentSong = gameState.shuffledSongs[gameState.currentSongIndex];
	Object.values(gameState.lifelines).forEach(l => l.used = false);
}

function updateLifelineButtons() {

	// Update Lifeline Visibility
	Object.keys(gameState.lifelines).forEach(key => {
		document.getElementById(`${key}Lifeline`).hidden = gameState.lifelines[key].total == 0;
		document.getElementById(`${key}Lifeline`).disabled = gameState.lifelines[key].used || !gameState.lifelines[key].remaining;
		document.getElementById(`${key}Count`).textContent = gameState.lifelines[key].remaining.toString().replace("Infinity","∞");
	});
}

function updateProgress() {
    if (!audio || !gameState.currentSong) return;

	const currentTime = audio.getCurrentTime();
	const remaining = gameState.currentSong.endTime - currentTime;
	const progress = (currentTime - gameState.currentSong.startTime) / (gameState.currentSong.endTime - gameState.currentSong.startTime);

	document.getElementById('progressBar').style.setProperty('--progress', progress);
	document.getElementById('progressTimer').textContent = formatTime(Math.ceil(remaining.toFixed(3)).toFixed(0));
}

function updateAnswerDisplay() {

	// Source
	const sourcesContainer = document.querySelector("#answerDisplay .sources");
	sourcesContainer.innerHTML = "";
 	gameState.currentSong.sources.forEach((source, i) => {
		const index = i+1;

		const sourceWrap = document.createElement("span");
		sourceWrap.classList.add(`source`);
		sourceWrap.dataset.index = i;
		sourceWrap.dataset.optional = gameState.currentSong.sources[i][0] == false;
		sourcesContainer.appendChild(sourceWrap);

		const sourceTrue = document.createElement("span");
		sourceTrue.classList.add("true");
		sourceTrue.innerHTML = source[1].split("").map(i => `<span>${i}</span>`).join("");
		sourceWrap.appendChild(sourceTrue);

		const sourceFalse = document.createElement("span");
		sourceFalse.classList.add("false");
		sourceFalse.textContent = gameState.currentSong.sources.length > 1 ? `${gameState.collection.sourceName}${index}` : `${gameState.collection.sourceName}`;
		sourceWrap.appendChild(sourceFalse);

		sourcesContainer.innerHTML += ", ";
	});
	sourcesContainer.innerHTML = sourcesContainer.innerHTML.replace(/\, $/,"");


	// Artist
	const artistsContainer = document.querySelector("#answerDisplay .artists");
	artistsContainer.innerHTML = "";
 	gameState.currentSong.artists.forEach((artist, i) => {
		const index = i+1;

		const artistWrap = document.createElement("span");
		artistWrap.classList.add(`artist`);
		artistWrap.dataset.index = i;
		artistWrap.dataset.optional = gameState.currentSong.artists[i][0] == false;
		artistsContainer.appendChild(artistWrap);

		const artistTrue = document.createElement("span");
		artistTrue.classList.add("true");
		artistTrue.innerHTML = artist[1].split("").map(i => `<span>${i}</span>`).join("");
		artistWrap.appendChild(artistTrue);

		const artistFalse = document.createElement("span");
		artistFalse.classList.add("false");
		artistFalse.textContent = gameState.currentSong.artists.length > 1 ? `Artist${index}` : `Artist`;
		artistWrap.appendChild(artistFalse);

		artistsContainer.innerHTML += ", ";
	});
	artistsContainer.innerHTML = artistsContainer.innerHTML.replace(/\, $/,"");


	// Song
	const songsContainer = document.querySelector("#answerDisplay .songs");
	songsContainer.innerHTML = "";

	const songWrap = document.createElement("span");
	songWrap.classList.add(`song`);
	songWrap.dataset.index = 1;
	songWrap.dataset.optional = gameState.currentSong.title[0] == false;
	songsContainer.appendChild(songWrap);

	const songTrue = document.createElement("span");
	songTrue.classList.add("true");
	songTrue.innerHTML = gameState.currentSong.title[1].split("").map(i => `<span>${i}</span>`).join("");
	songWrap.appendChild(songTrue);

	const songFalse = document.createElement("span");
	songFalse.classList.add("false");
	songFalse.textContent = `Song`;
	songWrap.appendChild(songFalse);

	document.querySelector("#answerDisplay .year").textContent = ` (${gameState.currentSong.year})`;
	document.querySelectorAll("#answerDisplay .source, #answerDisplay .artist, #answerDisplay .song, #answerDisplay .year").forEach((el, index) => { el.dataset.reveal = false; });
}

function applyLoad() {
	document.body.classList.add("loading");
}
function removeLoad() {
	document.body.classList.remove("loading");
}


// *********** //
// Guess Logic //
// *********** //

function checkGuess() {

	const inputValue = document.getElementById('guessInput').value;
    if (!inputValue) return;

	let correct = false;

	const sources = gameState.collection.guess.includes("Sources") ? gameState.currentSong.sources : [];
	for (let i = 0; i < sources.length; i++) {
		const el = document.querySelector(`#answerDisplay .source[data-index='${i}']`)
		if (!el || el.dataset.reveal == "true") continue;

		for (let s = 1; s < sources[i].length; s++) {

			if (compareGuess(sources[i][s], inputValue)) {
				correct = true;
				revealSource(true,i);
			}
		}
	};

	const artists = gameState.collection.guess.includes("Artists") ? gameState.currentSong.artists : [];
	for (let i = 0; i < artists.length; i++) {
		const el = document.querySelector(`#answerDisplay .artist[data-index='${i}']`)
		if (!el || el.dataset.reveal == "true") continue;

		for (let s = 1; s < artists[i].length; s++) {

			if (compareGuess(artists[i][s], inputValue)) {
				correct = true;
				revealArtist(true,i);
			}
		}
	};

	const song = gameState.collection.guess.includes("Songs") ? gameState.currentSong.title : [];
	for (let s = 1; s < song.length; s++) {
		const el = document.querySelector(`#answerDisplay .song`)
		if (!el || el.dataset.reveal == "true") continue;

		if (compareGuess(song[s], inputValue) ) {
			correct = true;
			revealSong(true);
		}
	}
	
	const continueBtn = document.getElementById('continueBtn');	

	const revealed_sources = sourcesRevealed();
	const revealed_artists = artistsRevealed();
	const revealed_songs = songsRevealed();

	const revealedRequiredSources = revealed_sources.required.total == (revealed_sources.required.value);
	const revealedOptionalSources = revealed_sources.optional.total == (revealed_sources.optional.value);
	const revealedAllSources = revealedRequiredSources && revealedOptionalSources;

	const revealedRequiredArtists = revealed_artists.required.total == (revealed_artists.required.value);
	const revealedOptionalArtists = revealed_artists.optional.total == (revealed_artists.optional.value);
	const revealedAllArtists = revealedRequiredArtists && revealedOptionalArtists;

	const revealedRequiredSongs = revealed_songs.required.total == (revealed_songs.required.value);
	const revealedOptionalSongs = revealed_songs.optional.total == (revealed_songs.optional.value);
	const revealedAllSongs = revealedRequiredSongs && revealedOptionalSongs;

	document.getElementById('guessInput').value = "";

	const requireSource = gameState.collection.guess.includes("Sources");
	const requireArtist = gameState.collection.guess.includes("Artists");
	const requireSong = gameState.collection.guess.includes("Songs");
	

	if (correct) {
		continueBtn.className = "btn btn-secondary";

		let continueBool = false;
		let optionalBool = false;

		// Sources/Artists/Songs
		if (requireSource && requireArtist && requireSong) {
			optionalBool = revealedRequiredSources && revealedRequiredArtists && revealedRequiredSongs;
			continueBool = revealedAllSources && revealedAllArtists && revealedAllSongs;
		}

		// Sources/Artists
		if (requireSource && requireArtist && !requireSong) {
			optionalBool = revealedRequiredSources && revealedRequiredArtists;
			continueBool = revealedAllSources && revealedAllArtists;
		}

		// Sources/Songs
		if (requireSource && !requireArtist && requireSong) {
			optionalBool = revealedRequiredSources && revealedRequiredSongs;
			continueBool = revealedAllSources && revealedAllSongs;
		}

		// Artists/Songs
		if (!requireSource && requireArtist && requireSong) {
			optionalBool = revealedRequiredArtists && revealedRequiredSongs;
			continueBool = revealedAllArtists && revealedAllSongs;
		}

		// Sources
		if (requireSource && !requireArtist && !requireSong) {
			optionalBool = revealedRequiredSources;
			continueBool = revealedAllSources;
		}

		// Artists
		if (!requireSource && requireArtist && !requireSong) {
			optionalBool = revealedRequiredArtists;
			continueBool = revealedAllArtists;
		}

		// Songs
		if (!requireSource && !requireArtist && requireSong) {
			optionalBool = revealedRequiredSongs;
			continueBool = revealedAllSongs;
		}

		if (optionalBool) {
			stopTimeout();
			continueBtn.className = "btn btn-success";
		}
		if (continueBool) {
			continueRound();
		}

	}
	else {
		gameState.settings.lives--;

		updateHearts();

		const answerDisplay = document.getElementById('answerDisplay');
		answerDisplay.classList.remove('shake');
		void answerDisplay.offsetWidth;
		answerDisplay.classList.add('shake');
		setTimeout(() => answerDisplay.classList.remove('shake'), 400);

		if (gameState.settings.lives <= 0) {
			continueRound();
		}
	}
}

function compareGuess(val1,val2) {

	val1 = val1.toLowerCase();
	val2 = val2.toLowerCase();

	const normalizedVal1 = normalize_str(val1);
	const normalizedVal2 = normalize_str(val2);

	const stringSimilarityPlain = calcStringSimilarity(val1, val2);
	const stringSimilarityNormalized = calcStringSimilarity(normalizedVal1, normalizedVal2);

	const wordSimilarityPlain = calcWordSimilarity(val1, val2);
	const wordSimilarityNormalized = calcWordSimilarity(normalizedVal1, normalizedVal2);

	const stringSimilarity = Math.max(stringSimilarityPlain, stringSimilarityNormalized);
	const wordSimilarity = Math.max(wordSimilarityPlain, wordSimilarityNormalized);

	if (
		val1.includes(val2) ||
		val2.includes(val1) || 
		normalizedVal1.includes(normalizedVal2) || 
		normalizedVal2.includes(normalizedVal1) ||
		stringSimilarity >= 0.75 || 
		wordSimilarity >= 0.8 ||
		(stringSimilarity >= 0.5 && wordSimilarity >= 0.5) 
	) {
		return true;	
	}

	return false;
}

function sourcesRevealed() {
	let result = {
		required: { value: 0, total: 0, },
		optional: { value: 0, total: 0, },
	}
	const sources = document.querySelectorAll("#answerDisplay .source");
	for (let i = 0; i < sources.length; i++) {
		const item = sources[i].dataset.optional == "true" ? "optional" : "required";

		result[item].total++;
		sources[i].dataset.reveal == "true" && (result[item].value++);
	};

	return result;
}

function artistsRevealed() {
	let result = {
		required: { value: 0, total: 0, },
		optional: { value: 0, total: 0, },
	}
	const artists = document.querySelectorAll("#answerDisplay .artist");
	for (let i = 0; i < artists.length; i++) {
		const item = artists[i].dataset.optional == "true" ? "optional" : "required";

		result[item].total++;
		artists[i].dataset.reveal == "true" && (result[item].value++);
	};

	return result;
}

function songsRevealed() {
	let result = {
		required: { value: 0, total: 0, },
		optional: { value: 0, total: 0, },
	}
	const songs = document.querySelectorAll("#answerDisplay .song");
	for (let i = 0; i < songs.length; i++) {
		const item = songs[i].dataset.optional == "true" ? "optional" : "required";

		result[item].total++;
		songs[i].dataset.reveal == "true" && (result[item].value++);
	};

	return result;
}

function revealSource(bool,i) {
	const source = document.querySelector(`#answerDisplay .source[data-index='${i}']`)
	source && (source.dataset.reveal = bool);
}

function revealArtist(bool,i) {
	const artist = document.querySelector(`#answerDisplay .artist[data-index='${i}']`)
	artist && (artist.dataset.reveal = bool);
}

function revealSong(bool) {
	const song = document.querySelector(`#answerDisplay .song`)
	song && (song.dataset.reveal = bool);
}

function calcStringSimilarity(str1, str2) {

	if (str1 == null || str2 == null) return 0;
    if (str1.length === 0 && str2.length === 0) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;
    
    // Convert to lowercase for case-insensitive comparison
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    // Calculate Levenshtein distance (edit distance)
    const track = Array(s2.length + 1).fill(null).map(() =>
        Array(s1.length + 1).fill(null));
    
    for (let i = 0; i <= s1.length; i += 1) {
        track[0][i] = i;
    }
    
    for (let j = 0; j <= s2.length; j += 1) {
        track[j][0] = j;
    }
    
    for (let j = 1; j <= s2.length; j += 1) {
        for (let i = 1; i <= s1.length; i += 1) {
            const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
            track[j][i] = Math.min(
                track[j][i - 1] + 1, // deletion
                track[j - 1][i] + 1, // insertion
                track[j - 1][i - 1] + indicator, // substitution
            );
        }
    }
    
    const distance = track[s2.length][s1.length];
    const maxLength = Math.max(s1.length, s2.length);
    
    // Calculate similarity percentage
    const similarity = ((maxLength - distance) / maxLength);
    
    return similarity;
}

function calcWordSimilarity(str1, str2) {
  	if (str1 == null || str2 == null) return 0;
  	if (str1.length === 0 && str2.length === 0) return 1;
	if (str1.length === 0 || str2.length === 0) return 0;

	const w1 = str1.split(/\s+/).filter(Boolean).map(w => w.toLowerCase());
	const w2 = str2.split(/\s+/).filter(Boolean).map(w => w.toLowerCase());

	if (w1.length === 0 || w2.length === 0) return 0;

	const set1 = new Set(w1);
	const set2 = new Set(w2);

	let matches = 0;
	set1.forEach(w => { if (set2.has(w)) matches++; });

	const denom = Math.max(set1.size, set2.size);
	return denom === 0 ? 1 : (matches / denom);
}


// ************** //
// Song Functions //
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

	audio.play(0);
}

function playFullSong() {

	gameState.currentSong.startTime = 0;
	gameState.currentSong.endTime = gameState.currentSong.duration;

	audio.options.startTime = gameState.currentSong.startTime;
	audio.options.endTime = gameState.currentSong.endTime;

	audio.getRenderer().reRender();
	audio.play();

	updateProgress();
}


// ******* //
// Timeout //
// ******* //

function startTimeout(timeOut = gameState.settings.timeout) {
    
    if (gameState.settings.timeout <= 0 || gameState.state != STATE.game) { return; }

    stopTimeout();

	let timeLeft = timeOut

    const timerElement = document.getElementById('timer');
    timerElement.textContent = timeLeft;


    updateTimeoutColor(timeLeft, timeOut);

    gameState.timeout = setInterval(() => {
        timeLeft--;
        timerElement.textContent = timeLeft;

        updateTimeoutColor(timeLeft, timeOut);

        if (timeLeft <= 0) {
            stopTimeout();

            gameState.settings.lives--;
			updateHearts();

			continueRound();
        }
    }, 1000);
}

function stopTimeout() {
    clearInterval(gameState.timeout);
}

function updateTimeoutColor(timeLeft, totalTime) {
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


// ********* //
// Lifelines //
// ********* //

function useLifeline(lifeline) {

	switch(lifeline) {
		case "hint": {
			if (!revealLetters()) return;
			break;
		}
		case "cover": {
			document.querySelector(".cover-container").dataset.reveal = true;
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
			continueRound();
			break;
		}
		case "time": {
			stopTimeout();

			let currentTime = parseInt(document.getElementById('timer').textContent)+10;
			document.getElementById('timer').textContent = currentTime;
			startTimeout(currentTime);

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

function revealLetters() {

	document.getElementById("answerDisplay").dataset.hint = true;

	let check = false;

	for (const optional of [false, true]) {

		const sourceSpans = document.querySelectorAll(`#answerDisplay .source[data-optional='${optional}'][data-reveal='false'] .true > span`);
		const artistSpans = document.querySelectorAll(`#answerDisplay .artist[data-optional='${optional}'][data-reveal='false'] .true > span`);
		const songSpans = document.querySelectorAll(`#answerDisplay .song[data-optional='${optional}'][data-reveal='false'] .true > span`);
		let spans = [];

		gameState.collection.guess.includes("Sources") && (spans = [...spans, ...sourceSpans]);
		gameState.collection.guess.includes("Artists") && (spans = [...spans, ...artistSpans]);
		gameState.collection.guess.includes("Songs") && (spans = [...spans, ...songSpans]);

		let letters = [...spans].filter(span => { return /^[A-Za-z0-9]+$/.test(span.textContent); });

		let limit = Math.max(2, Math.ceil(letters.length * 0.3));
		if (letters.length < 2) {
			limit = letters.length;
		}

		for (let i = letters.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[letters[i], letters[j]] = [letters[j], letters[i]];
		}

		let count = 0;
		for (let i = 0; i < letters.length; i++) {
			if (count >= limit) { break; };
			letters[i].classList.add("hint");
			count++;
			check = true;
		}

		if (check) break;
	}

	if (!check) { return false; }

	const allSpans = document.querySelectorAll("#answerDisplay .source .true > span, #answerDisplay .artist .true > span, #answerDisplay .song .true > span");

	for (let i = 0; i < allSpans.length; i++) {
		allSpans[i].classList.remove("space");
		allSpans[i].classList.remove("special");

		if (allSpans[i].textContent == " ") { allSpans[i].classList.add("space"); };
		if (!/^[A-Za-z0-9]+$/.test(allSpans[i].textContent)) { allSpans[i].classList.add("special"); };
	}

	return true;
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

	str = str.toLowerCase();
	str = str.trim();
	str = convertRomanToNumber(str);
	str = str.replace(/^the\s+/, '');
	str = str.replace(/^a\s+/, '');
	str = str.replace(/^an\s+/, '');
	str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
	str = str.replace('&','and');
	str = str.replace(/[^a-z0-9 ]/g, '');
	str = str.replaceAll('  ',' ').replaceAll(' ','');
	str = str.trim();

    return str;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toFixed(0)}:${secs.toString().padStart(2, '0')}`;
}

async function extractAudioDuration(url) {
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

function romanToInt(roman) {
    const romanMap = {
        'I': 1,
        'V': 5,
        'X': 10,
        'L': 50,
        'C': 100,
        'D': 500,
        'M': 1000
    };
    
    let total = 0;
    let previousValue = 0;
    
    // Process from right to left
    for (let i = roman.length - 1; i >= 0; i--) {
        const currentChar = roman[i].toUpperCase();
        const currentValue = romanMap[currentChar];
        
        if (!currentValue) {
            throw new Error(`Invalid Roman numeral character: ${roman[i]}`);
        }
        
        if (currentValue < previousValue) {
            total -= currentValue; // Subtraction case (like IV, IX, etc.)
        } else {
            total += currentValue; // Addition case
        }
        
        previousValue = currentValue;
    }
    
    return total;
}

function convertRomanToNumber(text) {
    // This function finds and converts Roman numerals in a string
    return text.replace(/\b([IVXLCDM]+)\b/gi, (match, romanNumeral) => {
        try {
            return romanToInt(romanNumeral).toString();
        } catch (e) {
            return match; // Return original if conversion fails
        }
    });
}