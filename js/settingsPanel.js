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
        <div class="mode-control">
            <button class="mode-btn-compact" data-mode="trivial">
                <strong>Trivial</strong>
                <span>20s Listen • No Timeout</span>
                <span><span class="emoji">💡 • 📅 • ⏭️</span></span>
            </button>
            <button class="mode-btn-compact" data-mode="default">
                <strong>Default</strong>
                <span><span class="emoji">❤️❤️❤️</span> • 15s Listen • No Timeout</span>
                <span><span class="emoji">💡 • 📅 • ⏭️</span></span>
            </button>
            <button class="mode-btn-compact" data-mode="hard">
                <strong>Hard</strong>
                <span><span class="emoji">❤️❤️❤️</span> • 10s Listen • 20s Timeout</span>
                <span><span class="emoji">⏱️ • 💡 • 📅 • ⏭️</span></span>
            </button>
            <button class="mode-btn-compact" data-mode="sudden-death">
                <strong>Sudden Death</strong>
                <span><span class="emoji">❤️</span> • 5s Listen • 10s Timeout</span>
                <span><span class="emoji">⏱️ • 💡 • 📅 • ⏭️</span></span>
            </button>
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
    document.body.insertAdjacentHTML('afterbegin', settingsPanelHTML);
    
    // Attach mode button listeners based on page
    const params = new URLSearchParams(window.location.search);
    const isGamePage = params.get('collection') !== null;
    const modeButtons = document.querySelectorAll('.mode-btn-compact');
    
    modeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const newMode = this.dataset.mode;
            const params = new URLSearchParams(window.location.search);
            const currentMode = params.get('mode') || localStorage.getItem('selectedMode') || 'default';
            
            if (newMode !== currentMode) {
                if (isGamePage) {
                    // Game page: confirm and reload with mode param
                    if (confirm('Changing the game mode will reload the page. Continue?')) {
                        localStorage.setItem('selectedMode', newMode);
                        const collectionId = params.get('collection');
                        if (collectionId) {
                            params.set('mode', newMode);
                            const isLocal = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                            const url = isLocal ? `game.html?${params.toString()}` : `game?${params.toString()}`;
                            window.location.href = url;
                        } else {
                            location.reload();
                        }
                    }
                } else {
                    // Index page: just update mode without reload
                    localStorage.setItem('selectedMode', newMode);
                    // Update the current mode variable and apply theme
                    // Assuming there's a way to update the mode, but since it's in app.js, perhaps trigger an event or something
                    // For now, just set localStorage, and the page can handle it
                }
            }
        });
    });
    
    // Apply current mode styling
    const savedMode = params.get('mode') || localStorage.getItem('selectedMode') || 'default';
    document.body.classList.add(`mode-${savedMode}`);
    
    // Update CSS variables
    const root = document.documentElement;
    if (savedMode === 'trivial') {
        root.style.setProperty('--primary-color', '#48bb78');
        root.style.setProperty('--primary-dark', '#2f855a');
        root.style.setProperty('--text-light', 'white');
        root.style.setProperty('--shadow-color', 'rgba(72, 187, 120, 0.4)');
    } else if (savedMode === 'hard') {
        root.style.setProperty('--primary-color', '#ff9800');
        root.style.setProperty('--primary-dark', '#f57c00');
        root.style.setProperty('--text-light', 'white');
        root.style.setProperty('--shadow-color', 'rgba(255, 152, 0, 0.4)');
    } else if (savedMode === 'sudden-death') {
        root.style.setProperty('--primary-color', '#ff6b6b');
        root.style.setProperty('--primary-dark', '#d94a4a');
        root.style.setProperty('--text-light', '#fff5f5');
        root.style.setProperty('--shadow-color', 'rgba(255, 107, 107, 0.4)');
    } else {
        root.style.setProperty('--primary-color', '#667eea');
        root.style.setProperty('--primary-dark', '#764ba2');
        root.style.setProperty('--text-light', 'white');
        root.style.setProperty('--shadow-color', 'rgba(102, 126, 234, 0.4)');
    }
    
    // Highlight active mode button
    modeButtons.forEach(btn => {
        if (btn.dataset.mode === savedMode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
});