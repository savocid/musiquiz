

const wavesurfer = WaveSurfer.create({
    container: '#audioPlayer',
    waveColor: '#f0f0f0',
    progressColor: 'black',
    autoplay: true,
    interact: true,
    mediaControls: false,
    width: "100%",
    height: "100%",
    cursorColor: "black",
    cursorWidth: 0,
    barWidth: 1,
    barGap: 1,
    barRadius: 0,
    url: '', // Will be set dynamically
});

// Expose a function to set the current song URL and segment from game.js
window.setPlayerSong = function(url, startTime, endTime) {
    if (wavesurfer && url) {
        wavesurfer.load(url);
        // Set segment boundaries after load
        wavesurfer.once('ready', () => {
            wavesurfer.options.startTime = typeof startTime === 'number' ? startTime : 0;
            wavesurfer.options.endTime = typeof endTime === 'number' ? endTime : (wavesurfer.getDecodedData()?.duration || wavesurfer.getDuration() || 12);
            wavesurfer.getRenderer().reRender();
        });
    }
};

const repeatBtn = document.getElementById("repeatBtn");
if (repeatBtn) {
    repeatBtn.addEventListener("click", () => {
        wavesurfer.play(0);
    });
}

// Dynamic barWidth based on segment duration, with adjustable min/max duration
function getDynamicBarWidth(segmentDuration) {
    const minWidth = 1;
    const maxWidth = 4;
    const minDuration = 10;
    const maxDuration = 120;
    if (segmentDuration <= minDuration) return maxWidth;
    if (segmentDuration >= maxDuration) return minWidth;
    // Linear interpolation between max and min
    return maxWidth - ((segmentDuration - minDuration) / (maxDuration - minDuration)) * (maxWidth - minWidth);
}
function updateBarWidth() {
    const start = wavesurfer.options.startTime || 0;
    const end = wavesurfer.options.endTime || (wavesurfer.getDecodedData()?.duration || wavesurfer.getDuration() || 12);
    const segmentDuration = end - start;
    const barWidth = getDynamicBarWidth(segmentDuration);
    wavesurfer.options.barWidth = barWidth;
    wavesurfer.getRenderer().reRender();
}

// Update --progress CSS variable on #progress-bar to match segment-relative progress
function updateProgressBar() {
    const start = wavesurfer.options.startTime || 0;
    const end = wavesurfer.options.endTime || (wavesurfer.getDecodedData()?.duration || wavesurfer.getDuration() || 12);
    const segDuration = end - start;
    const segTime = Math.max(0, wavesurfer.getCurrentTime() - start);
    const progress = Math.max(0, Math.min(1, segTime / segDuration));
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
        progressBar.style.setProperty('--progress', progress);
    }
}
wavesurfer.on('timeupdate', updateProgressBar);
wavesurfer.on('ready', updateProgressBar);
wavesurfer.on('interaction', updateProgressBar);
