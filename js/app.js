// app.js - Handles mode and collection selection

let selectedMode = localStorage.getItem('selectedMode') || 'default'; // Restore saved mode or default
let selectedCollection = null;
let collectionsUrl = localStorage.getItem('collectionsUrl') || '';
let modeAnimationTimeout = null; // Track animation timeout
let allCollections = []; // Store all collections
let displayedCount = 5; // Number of collections to show initially

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
    
    // Check for data URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const dataParam = urlParams.get('data');
    if (dataParam) {
        collectionsUrl = cleanUrl(dataParam);
        // Reconstruct full URL for fetching
        let fullUrl = 'https://' + collectionsUrl;
        loadCollections(fullUrl, collectionsUrl); // Pass cleaned to save on success
    } else if (collectionsUrl) {
        // Reconstruct full URL for fetching
        let fullUrl = 'https://' + collectionsUrl;
        loadCollections(fullUrl);
    }
    
    // Set input values after DOM is ready
    if (collectionsUrlInputMain) {
        collectionsUrlInputMain.value = collectionsUrl;
    }
    
    // Remove preload class after a brief moment to enable transitions
    setTimeout(() => {
        document.body.classList.remove('preload');
    }, 100);
    
    // Clear data button
    const clearDataBtn = document.getElementById('clearDataBtn');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', () => {
            localStorage.clear();
            // Remove data parameter from URL and reload
            window.location.href = window.location.pathname;
        });
    }
    
    // Normalize URL to remove trailing slash for cleaner appearance
    if (window.location.pathname.endsWith('/') && window.location.pathname !== '/') {
        const newPath = window.location.pathname.slice(0, -1);
        const newUrl = window.location.origin + newPath + window.location.search;
        history.replaceState(null, '', newUrl);
    }
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
            document.body.classList.remove('mode-trivial', 'mode-default', 'mode-hard', 'mode-sudden-death');
            document.body.classList.add(`mode-${mode}`);
            document.body.classList.remove('mode-animating');
            document.body.removeAttribute('data-new-mode');
            modeAnimationTimeout = null;
            if (callback) callback();
        }, 1000);
    } else {
        // Just switch modes without animation
        document.body.classList.remove('mode-trivial', 'mode-default', 'mode-hard', 'mode-sudden-death');
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
    } else if (mode === 'hard') {
        root.style.setProperty('--primary-color', '#ff9800');
        root.style.setProperty('--primary-dark', '#f57c00');
        root.style.setProperty('--text-light', 'white');
        root.style.setProperty('--shadow-color', 'rgba(255, 152, 0, 0.4)');
    } else if (mode === 'sudden-death') {
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

// Collections URL input logic
const collectionsUrlInputMain = document.getElementById('collectionsUrlInputMain');
const collectionsUrlSubmit = document.getElementById('collectionsUrlSubmit');

// Function to clean URL
function cleanUrl(url) {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '');
}

// Clean input on blur
if (collectionsUrlInputMain) {
    collectionsUrlInputMain.addEventListener('blur', () => {
        collectionsUrlInputMain.value = cleanUrl(collectionsUrlInputMain.value.trim());
    });
}

if (collectionsUrlSubmit) {
    collectionsUrlSubmit.addEventListener('click', () => {
        let url = collectionsUrlInputMain.value.trim();
        if (url) {
            // Clean the URL by removing https:// and www.
            let cleanedUrl = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
            // Construct full URL for fetching
            let fullUrl = 'https://' + cleanedUrl;
            loadCollections(fullUrl, cleanedUrl);
        }
    });
}

async function loadCollections(fullUrl, cleanedUrl = null) {
    if (!fullUrl) {
        document.getElementById('collectionsList').innerHTML = `<p style="color: #fff; text-align: center; padding: 2rem;">Please enter a collections data URL above.</p>`;
        if (document.getElementById('loadMoreBtn')) document.getElementById('loadMoreBtn').style.display = 'none';
        return;
    }
    let dataUrl = fullUrl;
    if (dataUrl.endsWith('/')) {
        dataUrl += 'data.json';
    } else if (!dataUrl.endsWith('/data.json')) {
        dataUrl += '/data.json';
    }
    try {
        const response = await fetch(dataUrl);
        const data = await response.json();
        allCollections = data.collections || [];
        allCollections.sort((a, b) => {
            return a.title.localeCompare(b.title, undefined, { numeric: true });
        });

        displayCollections();
        // Save only if successful and cleanedUrl provided
        if (cleanedUrl) {
            localStorage.setItem('collectionsUrl', cleanedUrl);
        }
    } catch (error) {
        console.error('Error loading collections:', error);
        document.getElementById('collectionsList').innerHTML = `<p style=\"color: #fff; text-align: center; padding: 2rem;\">Error loading collections. Please check the URL.</p>`;
        if (document.getElementById('loadMoreBtn')) document.getElementById('loadMoreBtn').style.display = 'none';
    }
}

function displayCollections() {
    const container = document.getElementById('collectionsList');
    if (allCollections.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 2rem;">No collections available yet.</p>';
        return;
    }
    
    // Get the collections to display (up to displayedCount)
    const collectionsToShow = allCollections.slice(0, displayedCount);
    
    container.innerHTML = collectionsToShow.map(collection => `
        <div class="collection-item">
            <div class="collection-info">
                <h3>${collection.title}</h3>
                <p>${collection.description || 'No description'}</p>
                <p><strong>Difficulty:</strong> <span class="difficulty-${collection.difficulty.toLowerCase().replace(' ', '-')}">${collection.difficulty}</span> | <strong>Songs:</strong> ${collection.songs.length} | <strong>Rounds:</strong> ${collection.rounds || collection.songs.length}</p>
            </div>
            <button class="btn btn-success" onclick="startGame('${collection.id}')">
                ▶ Start Game
            </button>
        </div>
    `).join('');

    // Show/hide load more button
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.style.display = displayedCount < allCollections.length ? 'block' : 'none';
    }

}

function loadMore() {
    displayedCount += 5;
    displayCollections();
}

function startGame(collectionId) {
    // Navigate to game with URL parameters
    const params = new URLSearchParams();
    params.set('collection', collectionId);
    params.set('mode', selectedMode);
    
    // Check if running locally (file:// or localhost)
    const isLocal = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    let url;
    if (isLocal) {
        url = `game.html?${params.toString()}`;
    } else {
        // Use absolute path for production
        const basePath = '/' + window.location.pathname.split('/')[1] + '/';
        url = basePath + 'game?' + params.toString();
    }
    window.location.href = url;
}
