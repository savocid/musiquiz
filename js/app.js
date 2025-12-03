// app.js - Handles mode and collection selection

let selectedMode = null;
let selectedCollection = null;

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
    setupModeButtons();
});

function setupModeButtons() {
    const modeButtons = document.querySelectorAll('.mode-btn');
    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            selectMode(mode);
        });
    });
}

function selectMode(mode) {
    selectedMode = mode;
    
    // Hide mode selection, show collection selection
    document.getElementById('modeSelection').style.display = 'none';
    document.getElementById('collectionSelection').style.display = 'block';
    
    // Load collections
    loadCollections();
}

async function loadCollections() {
    try {
        const response = await fetch('data/collections.json');
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
    fetch('data/collections.json')
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
