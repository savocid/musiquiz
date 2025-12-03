// volume.js - Persistent volume control across all pages

// Get saved volume or default to 50%
const savedVolume = localStorage.getItem('musicQuizVolume') || 50;

// Initialize volume slider on page load
document.addEventListener('DOMContentLoaded', () => {
    const volumeSlider = document.getElementById('volumeSlider');
    const volumePercent = document.getElementById('volumePercent');
    
    if (volumeSlider) {
        volumeSlider.value = savedVolume;
        volumePercent.textContent = savedVolume + '%';
        
        volumeSlider.addEventListener('input', (e) => {
            const volume = e.target.value;
            volumePercent.textContent = volume + '%';
            localStorage.setItem('musicQuizVolume', volume);
            
            // Update any playing audio
            updateAllAudioVolume(volume / 100);
        });
    }
});

// Function to get current volume (0-1 scale for audio elements)
function getCurrentVolume() {
    return (localStorage.getItem('musicQuizVolume') || 50) / 100;
}

// Function to update all audio elements on page
function updateAllAudioVolume(volume) {
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
        audio.volume = volume;
    });
}
