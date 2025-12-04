// app.js - Handles mode and collection selection

let selectedMode = localStorage.getItem('selectedMode') || 'default'; // Restore saved mode or default
let selectedCollection = null;
let collectionsUrl = 'https://raw.githubusercontent.com/savocid/musiquiz/refs/heads/main/data/collections.json';

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
    restoreModeSelection(); // Restore first to prevent flash
    setupModeButtons();
    loadCollections(); // Load immediately
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
            // Remove active class from all buttons
            modeButtons.forEach(b => b.classList.remove('active'));
            
            // Add active class to clicked button
            btn.classList.add('active');
            
            // Update selected mode
            selectedMode = btn.dataset.mode;
            
            // Save to localStorage
            localStorage.setItem('selectedMode', selectedMode);
        });
    });
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
