let selectedMode = localStorage.getItem('selectedMode') || 'default'; // Restore saved mode or default
let selectedCollection = null;
let collectionsUrl = localStorage.getItem('collectionsUrl') || '';
let allCollections = []; // Store all collections
let displayedCount = 5; // Number of collections to show initially

// Load collections when page loads
document.addEventListener('DOMContentLoaded', async () => {
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

// Collections URL input logic
const collectionsUrlInputMain = document.getElementById('collectionsUrlInputMain');
const collectionsUrlSubmit = document.getElementById('collectionsUrlSubmit');

// Function to clean URL
function cleanUrl(url) {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
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

    try {
        // First fetch the collections index
        const indexUrl = fullUrl + '/collections/index.json';
        const indexResponse = await fetch(indexUrl);
        if (!indexResponse.ok) {
            throw new Error(`Failed to fetch collections index: ${indexResponse.status}`);
        }
        const collectionIds = await indexResponse.json();

        // Fetch all collection data files
        const collectionPromises = collectionIds.map(async (collectionId) => {
            const collectionUrl = `${fullUrl}/collections/${collectionId}/data.json`;
            try {
                const response = await fetch(collectionUrl);
                if (!response.ok) {
                    console.warn(`Failed to fetch collection ${collectionId}: ${response.status}`);
                    return null;
                }
                return await response.json();
            } catch (error) {
                console.warn(`Error fetching collection ${collectionId}:`, error);
                return null;
            }
        });

        const collections = await Promise.all(collectionPromises);
        allCollections = collections.filter(collection => collection !== null);

        allCollections.sort((a, b) => {
            return a.title.localeCompare(b.title, undefined, { numeric: true });
        });

		const container = document.getElementById('collectionsList');
		if (allCollections.length === 0) {
			container.innerHTML = '<p style="text-align: center; padding: 2rem;">No collections available yet.</p>';
			return;
		}

        // Save only if successful and cleanedUrl provided
        if (cleanedUrl) {
            localStorage.setItem('collectionsUrl', cleanedUrl);
        }
        displayCollections();
    } catch (error) {
        console.error('Error loading collections:', error);
        document.getElementById('collectionsList').innerHTML = `<p style=\"color: #fff; text-align: center; padding: 2rem;\">Error loading collections. Please check the URL.</p>`;
        if (document.getElementById('loadMoreBtn')) document.getElementById('loadMoreBtn').style.display = 'none';
    }
}

function displayCollections() {
	const container = document.getElementById('collectionsList');

    // Get the collections to display (up to displayedCount)
    const collectionsToShow = allCollections.slice(0, displayedCount);
    
    container.innerHTML = collectionsToShow.map(collection => {
		let collectionsUrl = localStorage.getItem('collectionsUrl') || '';

        // Get random cover image if available
        let coverImage = '';
        if (collection.covers && collection.covers.length > 0) {
            const randomCover = collection.covers[Math.floor(Math.random() * collection.covers.length)];
            // Resolve cover path relative to collection directory
            const coverUrl = randomCover.startsWith('http') ? randomCover : 'https://' + collectionsUrl + '/collections/' + collection.id + '/' + randomCover.replace('./', '');
            coverImage = `<img src="${coverUrl}" alt="${collection.title} cover" class="collection-cover" loading="lazy">`;
        }
        
        return `
        <div class="collection-item">
            ${coverImage}
            <div class="collection-info">
                <h3>${collection.title}</h3>
                <p>${collection.description || 'No description'}</p>
                <p><strong>Difficulty:</strong> <span class="difficulty-${collection.difficulty.toLowerCase().replace(' ', '-')}">${collection.difficulty}</span> | <strong>Songs:</strong> ${collection.songs.length}</p>
            </div>
            <button class="btn btn-success" onclick="startGame('${collection.id}')">Start Game</button>
        </div>
    `}).join('');

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
	let selectedMode = localStorage.getItem('selectedMode') || 'default'; 

    // Navigate to game with URL parameters
    const params = new URLSearchParams();
    params.set('collection', collectionId);
    params.set('mode', selectedMode);
	params.set('data', collectionsUrl);
    
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
