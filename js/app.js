// app.js - Handles mode and collection selection

let selectedMode = localStorage.getItem('selectedMode') || 'default'; // Restore saved mode or default
let selectedCollection = null;
let collectionsUrl = 'https://raw.githubusercontent.com/savocid/musiquiz/refs/heads/main/data/collections.json';
let modeAnimationTimeout = null; // Track animation timeout

// Mode configurations
const MODES = {
    'trivial': {
        lives: 999,
        clipDuration: 15,
        timeout: 0  // 0 = infinite timeout
    },
    'default': {
        lives: 3,
        clipDuration: 10,
        timeout: 0  // 0 = infinite timeout
    },
    'sudden-death': {
        lives: 1,
        clipDuration: 5,
        timeout: 5  // 5 seconds to guess
    }
};

// Load collections when page loads
document.addEventListener('DOMContentLoaded', async () => {
    restoreModeSelection(); // Restore first
    setupModeButtons();
    loadCollections(); // Load immediately
    
    // Remove preload class after a brief moment to enable transitions
    setTimeout(() => {
        document.body.classList.remove('preload');
    }, 100);
});

// Handle browser back/forward button
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        // Page was loaded from cache
        restoreModeSelection();
    }
});

function setupModeButtons() {
    const modeButtons = document.querySelectorAll('.mode-btn-compact');
    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Don't allow mode change during animation
            if (modeAnimationTimeout) return;
            
            // Remove active class from all buttons
            modeButtons.forEach(b => b.classList.remove('active'));
            
            // Add active class to clicked button
            btn.classList.add('active');
            
            // Update selected mode
            selectedMode = btn.dataset.mode;
            
            // Save to localStorage
            localStorage.setItem('selectedMode', selectedMode);
            
            // Disable all mode buttons during animation
            modeButtons.forEach(b => b.style.pointerEvents = 'none');
            
            // Apply theme with animation
            applyModeTheme(selectedMode, true, () => {
                // Re-enable buttons after animation
                modeButtons.forEach(b => b.style.pointerEvents = '');
            });
        });
    });
}

function applyModeTheme(mode, animate = false, callback) {
    if (animate) {
        // Immediately update CSS variables for button colors, etc.
        updateCSSVariables(mode);
        
        // Store the NEW mode we're transitioning to
        document.body.setAttribute('data-new-mode', mode);
        
        // Add animation class (old background stays via current mode class)
        document.body.classList.add('mode-animating');
        
        // Force a reflow
        void document.body.offsetHeight;
        
        // After animation completes, switch to new mode
        modeAnimationTimeout = setTimeout(() => {
            document.body.classList.remove('mode-trivial', 'mode-default', 'mode-sudden-death');
            document.body.classList.add(`mode-${mode}`);
            document.body.classList.remove('mode-animating');
            document.body.removeAttribute('data-new-mode');
            modeAnimationTimeout = null;
            if (callback) callback();
        }, 1000);
    } else {
        // Just switch modes without animation
        document.body.classList.remove('mode-trivial', 'mode-default', 'mode-sudden-death');
        document.body.classList.add(`mode-${mode}`);
    }
}

function updateCSSVariables(mode) {
    const root = document.documentElement;
    
    if (mode === 'trivial') {
        root.style.setProperty('--primary-color', '#48bb78');
        root.style.setProperty('--primary-dark', '#2f855a');
        root.style.setProperty('--text-light', 'white');
        root.style.setProperty('--shadow-color', 'rgba(72, 187, 120, 0.4)');
    } else if (mode === 'sudden-death') {
        root.style.setProperty('--primary-color', '#e53e3e');
        root.style.setProperty('--primary-dark', '#9b2c2c');
        root.style.setProperty('--text-light', '#fff5f5');
        root.style.setProperty('--shadow-color', 'rgba(229, 62, 62, 0.4)');
    } else { // default
        root.style.setProperty('--primary-color', '#667eea');
        root.style.setProperty('--primary-dark', '#764ba2');
        root.style.setProperty('--text-light', 'white');
        root.style.setProperty('--shadow-color', 'rgba(102, 126, 234, 0.4)');
    }
}

function restoreModeSelection() {
    const modeButtons = document.querySelectorAll('.mode-btn-compact');
    modeButtons.forEach(btn => {
        if (btn.dataset.mode === selectedMode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Apply theme without animation on page load
    applyModeTheme(selectedMode, false);
    
    // Also update CSS variables immediately
    updateCSSVariables(selectedMode);
}

async function loadCollections() {
    try {
        const response = await fetch(collectionsUrl);
        const data = await response.json();
        displayCollections(data.collections);
    } catch (error) {
        console.error('Error loading collections:', error);
        document.getElementById('collectionsList').innerHTML = `
            <p style="color: #721c24; text-align: center; padding: 2rem;">
                Error loading collections. Please make sure collections.json exists.
            </p>
        `;
    }
}

function displayCollections(collections) {
    const container = document.getElementById('collectionsList');
    
    if (collections.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 2rem;">No collections available yet.</p>';
        return;
    }
    
    container.innerHTML = collections.map(collection => `
        <div class="collection-item">
            <div class="collection-info">
                <h3>${collection.title}</h3>
                <p>${collection.description || 'No description'}</p>
                <p><strong>Difficulty:</strong> ${collection.difficulty} | <strong>Songs:</strong> ${collection.songs.length} | <strong>Rounds:</strong> ${collection.rounds || collection.songs.length}</p>
            </div>
            <button class="btn btn-primary" onclick="startGame('${collection.id}')">
                ▶ Start Game
            </button>
        </div>
    `).join('');
}

function startGame(collectionId) {
    // Load collection data
    fetch(collectionsUrl)
        .then(res => res.json())
        .then(data => {
            selectedCollection = data.collections.find(c => c.id === collectionId);
            
            // Combine mode settings with collection
            const gameSettings = {
                ...MODES[selectedMode],
                collectionId: selectedCollection.id,
                mode: selectedMode
            };
            
            // Store in sessionStorage
            sessionStorage.setItem('gameSettings', JSON.stringify(gameSettings));
            sessionStorage.setItem('selectedCollection', JSON.stringify(selectedCollection));
            
            // Navigate to game
            window.location.href = 'game.html';
        });
}
