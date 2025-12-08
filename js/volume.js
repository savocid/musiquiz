// Initialize volume slider on page load AND on back/forward navigation
function initVolumeControl() {
    const volumeSlider = document.getElementById('volumeSlider');
    const volumePercent = document.getElementById('volumePercent');
    
    if (volumeSlider && volumePercent) {
        // Get saved volume or default to 50%
        const savedVolume = localStorage.getItem('musicQuizVolume') || 50;
        
        // Update both slider AND text to match saved value
        volumeSlider.value = savedVolume;
        volumePercent.textContent = savedVolume + '%';
        
        // Remove existing listener if any to prevent duplicates
        const newSlider = volumeSlider.cloneNode(true);
        volumeSlider.parentNode.replaceChild(newSlider, volumeSlider);
        
        newSlider.addEventListener('input', (e) => {
            const volume = e.target.value;
            document.getElementById('volumePercent').textContent = volume + '%';
            localStorage.setItem('musicQuizVolume', volume);
            
            // Update any playing audio immediately
            updateAllAudioVolume(volume / 100);
        });
    }
}

document.addEventListener('DOMContentLoaded', initVolumeControl);

// Handle browser back/forward button (fixes volume sync issue)
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        // Page was loaded from cache (back/forward button)
        initVolumeControl();
    }
});

// Function to get current volume (0-1 scale for audio elements)
function getCurrentVolume() {
    return (localStorage.getItem('musicQuizVolume') || 50) / 100;
}

// Function to update all audio elements on page
function updateAllAudioVolume(volume) {
    // Update DOM audio elements
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
        audio.volume = volume;
    });
    
    // Update gameState audio if it exists (for game.js)
    if (typeof gameState !== 'undefined' && gameState.audio) {
        gameState.audio.volume = volume;
    }
}
