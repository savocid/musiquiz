const settingsPanelHTML = `
<!-- Settings Toggle Button -->
<button class="panel-toggle panel-toggle-left" id="settingsToggle" aria-label="Toggle Settings">
    <span>⚙️</span>
</button>

<!-- Settings Panel -->
<div class="side-panel side-panel-left" id="settingsPanel">
    <div class="panel-header">
        <h3>Settings</h3>
    </div>
    
    <!-- Game Mode Section -->
    <div class="panel-section">
        <h4>Game Mode</h4>
        <div class="mode-control" id="modeControl">
            <!-- Mode buttons will be inserted here -->
        </div>
    </div>
    
    <!-- Volume Section -->
    <div class="panel-section">
        <h4>Volume</h4>
        <div class="volume-control">
            <label for="volumeSlider">🔊</label>
            <input type="range" id="volumeSlider" min="0" max="100" value="50">
            <span id="volumePercent">50%</span>
        </div>
    </div>
    
    <!-- Data Section -->
    <div class="panel-section">
        <h4>Data</h4>
        <button id="clearDataBtn" class="btn btn-secondary">Clear Data</button>
    </div>
</div>
`;

document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('settingsPanel')) {
        document.body.insertAdjacentHTML('afterbegin', settingsPanelHTML);
    }
    
    // Generate mode buttons dynamically
	for (const [modeKey, modeData] of Object.entries(MODES)) {
		const button = document.createElement('button');
		button.className = 'mode-btn-compact';
		button.setAttribute('data-mode', modeKey);
		document.getElementById('modeControl').appendChild(button);

		// Title
		const title = MODES[modeKey].title;
		const strong = document.createElement('strong');
		strong.textContent = title;
		button.appendChild(strong);
		
		// Hearts
		if (modeData.lives !== Infinity) {
			const hearts = '❤️'.repeat(modeData.lives);
			strong.innerHTML += `<span class="emoji">${hearts}</span>`;
		}
		
		// Listen time and timeout
		const listenSpan = document.createElement('span');
		listenSpan.textContent = `${modeData.clipDuration}s Listen • ${modeData.timeout > 0 ? modeData.timeout + 's Timeout' : 'No Timeout'}`;
		button.appendChild(listenSpan);

		// Lifelines
		const lifelinesWrap = document.createElement('span');
		button.appendChild(lifelinesWrap);

		Object.keys(lifeLines).forEach(key => {
			if (MODES[modeKey].lifelines[key].total > 0) {
				const lifelineSpan = document.createElement('span');
				lifelineSpan.textContent = lifeLines[key].symbol;
				lifelineSpan.classList.add("emoji");
				lifelinesWrap.appendChild(lifelineSpan);
				lifelinesWrap.innerHTML += " • "
			}
		});

		lifelinesWrap.innerHTML = lifelinesWrap.innerHTML.replace(/ • $/,"")
	}

    
    // Attach mode button listeners based on page
    const params = new URLSearchParams(window.location.search);
    const isGamePage = params.get('collection') !== null;
    const modeButtons = document.querySelectorAll('.mode-btn-compact');
    
    modeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Prevent clicks during animation
            if (document.body.classList.contains('mode-animating')) return;
            
            const newMode = this.dataset.mode;
            const params = new URLSearchParams(window.location.search);
            const currentMode = params.get('mode') || localStorage.getItem('selectedMode') || 'default';

            if (newMode !== currentMode) {
                if (isGamePage) {
                    // Game page: confirm and reload with mode param
                    if (confirm('Changing the game mode will reload the page. Continue?')) {
                        localStorage.setItem('selectedMode', newMode);
                        location.reload()
                    }
                } else {
                    // Index page: just update mode without reload
                    localStorage.setItem('selectedMode', newMode);
                    // Apply the theme immediately
                    window.applyModeTheme(newMode, true);
                    // Update active button
                    modeButtons.forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                }
            }
        });
    });
    
    // Apply current mode styling (without animation)
    const savedMode = params.get('mode') || localStorage.getItem('selectedMode') || 'default';
    // Use data-mode attribute so JS can base visibility on it (not classes)
    document.body.dataset.mode = savedMode;

    updateCSSVariables(savedMode)
    
    // Highlight active mode button
    modeButtons.forEach(btn => {
        if (btn.dataset.mode === savedMode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Clear data button
    document.getElementById('clearDataBtn').addEventListener('click', () => {
		localStorage.clear();
		location.reload();
	});
});

// Global function for mode theme application
window.applyModeTheme = function(mode, animate = false, callback) {
    updateCSSVariables(mode)
    
    if (animate) {
        // Trigger animation
        document.body.classList.add('mode-animating');
        document.body.setAttribute('data-new-mode', mode);
        
        // Apply new theme after animation completes
        setTimeout(() => {
            // Use data attribute for current mode
            document.body.dataset.mode = mode;
            // reflect whether this mode uses a timeout (controls timer preview visibility)
            // Remove animation class
            document.body.classList.remove('mode-animating');
            if (callback) callback();
        }, 1000);
    } else {
        // Just switch modes without animation
        document.body.dataset.mode = mode;
    }
};

function updateCSSVariables(mode) {
    const root = document.documentElement;
    
    if (mode === 'trivial') {
        root.style.setProperty('--primary-color', '#48bb78');
        root.style.setProperty('--primary-dark', '#2f855a');
        root.style.setProperty('--text-light', 'white');
        root.style.setProperty('--shadow-color', 'rgba(72, 187, 120, 0.4)');
    } else if (mode === 'intense') {
        root.style.setProperty('--primary-color', '#ff9800');
        root.style.setProperty('--primary-dark', '#f57c00');
        root.style.setProperty('--text-light', 'white');
        root.style.setProperty('--shadow-color', 'rgba(255, 152, 0, 0.4)');
    } else if (mode === 'suddendeath') {
        root.style.setProperty('--primary-color', '#ff6b6b');
        root.style.setProperty('--primary-dark', '#d94a4a');
        root.style.setProperty('--text-light', '#fff5f5');
        root.style.setProperty('--shadow-color', 'rgba(255, 107, 107, 0.4)');
    } else { // default
        root.style.setProperty('--primary-color', '#667eea');
        root.style.setProperty('--primary-dark', '#764ba2');
        root.style.setProperty('--text-light', 'white');
        root.style.setProperty('--shadow-color', 'rgba(102, 126, 234, 0.4)');
    }
}

// Panel toggle functionality
document.addEventListener('DOMContentLoaded', () => {
    const settingsToggle = document.getElementById('settingsToggle');
    const settingsPanel = document.getElementById('settingsPanel');

    // Toggle settings panel
    if (settingsToggle && settingsPanel) {
        settingsToggle.addEventListener('click', () => {
            settingsPanel.classList.toggle('open');
            settingsToggle.classList.toggle('panel-open');
        });
    }

    // Close panels when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.side-panel') && 
            !e.target.closest('.panel-toggle')) {
            if (settingsPanel) {
                settingsPanel.classList.remove('open');
                if (settingsToggle) settingsToggle.classList.remove('panel-open');
            }
        }
    });
});