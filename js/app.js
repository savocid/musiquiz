// app.js - Handles collection selection and game setup

let selectedCollection = null;

// Load collections when page loads
document.addEventListener('DOMContentLoaded', async () => {
    await loadCollections();
});

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
        <div class="collection-item" onclick="selectCollection('${collection.id}')">
            <h3>${collection.title}</h3>
            <p>${collection.description || 'No description'}</p>
            <p><strong>Difficulty:</strong> ${collection.difficulty} | <strong>Songs:</strong> ${collection.songs.length}</p>
        </div>
    `).join('');
}

function selectCollection(collectionId) {
    // Load collections and find selected one
    fetch('data/collections.json')
        .then(res => res.json())
        .then(data => {
            selectedCollection = data.collections.find(c => c.id === collectionId);
            showSettings();
        });
}

function showSettings() {
    document.getElementById('settingsPanel').style.display = 'block';
    document.getElementById('settingsPanel').scrollIntoView({ behavior: 'smooth' });
}

// Start game button
document.getElementById('startGameBtn').addEventListener('click', () => {
    const settings = {
        collectionId: selectedCollection.id,
        lives: parseInt(document.getElementById('gameLives').value),
        mode: document.getElementById('gameMode').value
    };
    
    // Store settings in sessionStorage
    sessionStorage.setItem('gameSettings', JSON.stringify(settings));
    sessionStorage.setItem('selectedCollection', JSON.stringify(selectedCollection));
    
    // Navigate to game
    window.location.href = 'game.html';
});
