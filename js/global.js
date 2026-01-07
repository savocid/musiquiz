
const lifeLines = {
	reveal: {
		symbol: "💡",
		text: "Reveal",
		description: "Reveal some letters.",
	},
	cover: {
		symbol: "🖼️",
		text: "Cover",
		description: "Display the Cover Image.",
	},
	year: {
		symbol: "📅",
		text: "Year",
		description: "Show the release year of the song.",
	},
	expand: {
		symbol: "↔️",
		text: "Expand",
		description: "Expand the song to its full duration.",
	},
	skip: {
		symbol: "⏭️",
		text: "Skip",
		description: "Skip the current song.",
	},
	time: {
		symbol: "⏱️",
		text: "Reset",
		description: "Reset the countdown timer.",
	},
}

const MODES = {
    trivial: {
		title: "Trivial",
        lives: Infinity,
        clipDuration: Infinity,
        timeout: 0,
        lifelines: {
            reveal:	{ total: Infinity, },
			cover:	{ total: Infinity, },
            expand: { total: 0, },
            year:	{ total: Infinity, },
            skip:	{ total: 0, },
			time:	{ total: 0, },
        }
    },
    basic: {
		title: "Basic",
        lives: Infinity,
        clipDuration: 20,
        timeout: 0,
        lifelines: {
            reveal:	{ total: 1, },
			cover:	{ total: 1, },
            expand: { total: 1, },
            year:	{ total: 1, },
            skip:	{ total: 0, },
			time:	{ total: 0, },
        }
    },
    intense: {
		title: "Intense",
        lives: 3,
        clipDuration: 20,
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
        clipDuration: 20,
        timeout: 60,
        lifelines: {
            reveal:	{ total: 1, },
			cover:	{ total: 1, },
            expand:	{ total: 1, },
            year:	{ total: 1, },
            skip:	{ total: 1, },
			time:	{ total: 1, },
        }
    }
};


function cleanUrl(url) {

	try {
		const decoded = decodeURIComponent(url);
		url = decoded;
	} catch (e) {
	}

	url = url.replace(/^https?:\/\//, '');
	url = url.replace(/^www\./, '');
	url = url.replace(/\/$/, '');
	url = url.replace(/\?.*$/,'');
	url = url.trim();

    return url;
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
	document.body.dataset.mode = currentMode && MODES[currentMode] ? currentMode : 'basic';

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
	collectionId && document.body.dataset.page == "game" && (params.set('collection', collectionId));
	collectionsUrl && (params.set('data', collectionsUrl));

	const newUrl = params.toString() ? `${window.location.origin}${window.location.pathname.replace(/\/$/,"")}?${params.toString()}` : `${window.location.origin}${window.location.pathname}`;
	history.replaceState(null, '', newUrl);
}