
const lifeLines = {
	hint: {
		symbol: "💡",
		text: "Hint",
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
		text: "+10s",
		description: "Adds 10 seconds to the countdown timer.",
	},
}

const MODES = {
    trivial: {
		title: "Trivial",
        lives: Infinity, 
        clipDuration: 20, 
        timeout: 0,
        lifelines: {
            hint:	{ total: Infinity, },
			cover:	{ total: Infinity, },
            expand: { total: Infinity, },
            year:	{ total: Infinity, },
            skip:	{ total: 0, },
			time:	{ total: 0, },
        }
    },
    default: { 
		title: "Default",
        lives: Infinity, 
        clipDuration: 20, 
        timeout: 60,
        lifelines: {
            hint:	{ total: 1, },
			cover:	{ total: 1, },
            expand: { total: 1, },
            year:	{ total: 1, }, 
            skip:	{ total: 1, },
			time:	{ total: 1, },
        }
    },
    intense: { 
		title: "Intense",
        lives: 3, 
        clipDuration: 10, 
        timeout: 20,
        lifelines: {
            hint:	{ total: 1, },
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
            hint:	{ total: 1, },
			cover:	{ total: 1, },
            expand:	{ total: 1, },
            year:	{ total: 1, }, 
            skip:	{ total: 1, },
			time:	{ total: 0, },
        }
    }
};


// Function to clean URL
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

	setTimeout(() => {
		document.body.classList.remove('preload');
	}, 100);
})();
	