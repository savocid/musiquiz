let selectedMode = localStorage.getItem('selectedMode') || 'default'; // Restore saved mode or default
let selectedCollection = null;

let allCollections = []; // Store all collections
let displayedCount = 5; // Number of collections to show initially

let collectionsUrl = localStorage.getItem('collectionsUrl') || '';
collectionsUrl = collectionsUrl ? cleanUrl(collectionsUrl) : collectionsUrl;


// Load collections when page loads
document.addEventListener('DOMContentLoaded', async () => {
	loadCollections(collectionsUrl);
});

document.getElementById('collectionsUrlSubmit').addEventListener('click', () => {
	const input = document.getElementById('collectionsUrlInputMain');
	loadCollections(input.value);
});

document.getElementById('collectionsUrlInputMain').addEventListener('blur', cleanInput);

function cleanInput() {
	const input = document.getElementById('collectionsUrlInputMain');
	input.value = cleanUrl(input.value);
}

async function loadCollections(url) {

	document.getElementById('collectionsList').innerHTML = "";
	localStorage.setItem('collectionsUrl', "");

	if (!url) { return; }

    try {
        const indexUrl = `https://${url}/collections/index.json`;
        const indexResponse = await fetch(indexUrl);

        if (!indexResponse.ok) {
            throw new Error(`Failed to fetch collections index: ${indexResponse.status}`);
        }

        const collectionIds = await indexResponse.json();

        // Fetch all collection data files
        const collectionPromises = collectionIds.map(async (collectionId) => {
            const collectionUrl = `https://${url}/collections/${collectionId}/data.json`;
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

		localStorage.setItem('collectionsUrl', url);
		document.getElementById('collectionsUrlInputMain').value = cleanUrl(url);
        
        displayCollections();
    } catch (error) {
        console.error('Error loading collections:', error);
        document.getElementById('collectionsList').innerHTML = `<p style=\"color: #fff; text-align: center; padding: 2rem;\">Error loading collections. Please check the URL.</p>`;
        document.getElementById('loadMoreBtn').style.display = 'none';
    }
}

function displayCollections() {
	const container = document.getElementById('collectionsList');

    // Get the collections to display (up to displayedCount)
    const collectionsToShow = allCollections.slice(0, displayedCount);
    
    container.innerHTML = collectionsToShow.map(collection => {
		const collectionsUrl = localStorage.getItem('collectionsUrl') || '';

		const randomCover = collection.covers[Math.floor(Math.random() * collection.covers.length)];
		const coverSrc = 
			collection.covers && collection.covers.length > 0 ? `https://${collectionsUrl}/collections/${collection.id}/${randomCover.replace('./', '')}` : 
			"";
		const coverTitle = 
			collection.covers && collection.covers.length > 0 ? `${collection.title}` : 
			"";

        return `
        <div class="collection-item">
            <img src="${coverSrc}" title="${coverTitle}" class="collection-cover" loading="lazy">
            <div class="collection-info">
                <h3>${collection.title}</h3>
                <p>${collection.description || 'No description'}</p>
                <p><strong>Difficulty:</strong> <span class="difficulty-${collection.difficulty.toLowerCase().replace(' ', '-')}">${collection.difficulty}</span> | <strong>Songs:</strong> ${collection.songs.length} | <strong>Language:</strong> ${collection.language.join("/")}</p>
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
	localStorage.setItem("collection",collectionId)
    window.location.href = `game.html`;
}
