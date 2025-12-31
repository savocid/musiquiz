
const lifeLines = {
	reveal: {
		symbol: "💡",
		text: "Reveal",
		description: "Reveals some letters.",
	},
	cover: {
		symbol: "🖼️",
		text: "Cover",
		description: "Reveals the Cover Image.",
	},
	year: {
		symbol: "📅",
		text: "Year",
		description: "Shows the release year of the song.",
	},
	expand: {
		symbol: "↔️",
		text: "Expand",
		description: "Expands the song to its full duration.",
	},
	skip: {
		symbol: "⏭️",
		text: "Skip",
		description: "Skips the current song.",
	},
	time: {
		symbol: "⏱️",
		text: "Reset",
		description: "Resets the countdown timer.",
	},
}

const MODES = {
    trivial: {
		title: "Trivial",
        lives: Infinity, 
        clipDuration: 20, 
        timeout: 0,
        lifelines: {
            reveal:	{ total: Infinity, },
			cover:	{ total: Infinity, },
            expand: { total: Infinity, },
            year:	{ total: Infinity, },
            skip:	{ total: 0, },
			time:	{ total: 0, },
        }
    },
    default: { 
		title: "Default",
        lives: 3, 
        clipDuration: 20, 
        timeout: 0,
        lifelines: {
            reveal:	{ total: 1, },
			cover:	{ total: 1, },
            expand: { total: 1, },
            year:	{ total: 1, }, 
            skip:	{ total: 1, },
			time:	{ total: 0, },
        }
    },
    intense: { 
		title: "Intense",
        lives: 3, 
        clipDuration: 10, 
        timeout: 30,
        lifelines: {
            reveal:	{ total: 1, },
			cover:	{ total: 1, },
            expand:	{ total: 1, },
            year:	{ total: 1, }, 
            skip:	{ total: 1, },
			time:	{ total: 1, },
        }
    },
    suddendeath: { 
		title: "Sudden Death",
        lives: 1, 
        clipDuration: 10, 
        timeout: 0,
        lifelines: {
            reveal:	{ total: 1, },
			cover:	{ total: 1, },
            expand:	{ total: 1, },
            year:	{ total: 1, }, 
            skip:	{ total: 1, },
			time:	{ total: 0, },
        }
    }
};


function cleanUrl(url) {
    return `${url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').replace(/\?.*$/,'').trim()}`;
}

(function() {
	if (location.protocol === 'file:') {
		document.querySelectorAll('a[href$="/"]').forEach(a => {
		const href = a.getAttribute('href');
		if (!href.endsWith('index.html')) a.setAttribute('href', href + 'index.html');
		});
	}

	const collectionId = localStorage.getItem("collection");
	document.body.dataset.collection = collectionId ? collectionId : "";

	const currentMode = localStorage.getItem('selectedMode');
	document.body.dataset.mode = currentMode ? currentMode : "default";

	updateUrl();

	setTimeout(() => {
		document.body.classList.remove('preload');
	}, 100);

    const params = new URLSearchParams(window.location.search);
	let newUrl = params.toString() ? `${window.location.origin}${window.location.pathname.replace(/\/$/,"")}?${params.toString()}` : `${window.location.origin}${window.location.pathname}`;
	history.replaceState(null, '', newUrl);
})();

function updateUrl() {
	const modeBtn = document.querySelector("#modeControl > button.active");

	const collectionsUrl = document.body.dataset.collectionsUrl;
	const collectionId = document.body.dataset.collection;
	const currentMode = modeBtn ? modeBtn.dataset.mode : "";

	const params = new URLSearchParams(window.location.search);
	currentMode && (params.set('mode', currentMode));
	collectionId && (params.set('collection', collectionId));
	collectionsUrl && (params.set('data', collectionsUrl));

	const newUrl = params.toString() ? `${window.location.origin}${window.location.pathname.replace(/\/$/,"")}?${params.toString()}` : `${window.location.origin}${window.location.pathname}`;
	history.replaceState(null, '', newUrl);
}