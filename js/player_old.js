
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
    url: 'https://musiquiz-collections1.github.io/collections1/audio/disney/A%20Goofy%20Movie/I2I.mp3',
});

// Setup noUiSlider for segment selection
const slider = document.getElementById('slider-range');
const sliderValues = document.getElementById('slider-values');
let duration = 12;
// Always hook updateBarWidth to slider after creation
wavesurfer.on('ready', () => {
    duration = Math.floor(wavesurfer.getDecodedData()?.duration || wavesurfer.getDuration() || 12);
    if (slider.noUiSlider) slider.noUiSlider.destroy();
    noUiSlider.create(slider, {
        start: [0, duration],
        connect: true,
        step: 1,
        range: {
            min: 0,
            max: duration
        },
        format: {
            to: v => Math.round(v),
            from: v => Math.round(v)
        }
    });
    slider.noUiSlider.on('update', (values) => {
        const [start, end] = values.map(Number);
        wavesurfer.options.startTime = start;
        wavesurfer.options.endTime = end;
        sliderValues.textContent = `${start}s – ${end}s`;
        wavesurfer.getRenderer().reRender();
        updateBarWidth(); // <-- ensure barWidth updates on every slider change
    });
    // Set initial display
    sliderValues.textContent = `0s – ${duration}s`;
    updateBarWidth(); // <-- set barWidth on initial load
});

document.getElementById("replay-btn").addEventListener("click", () => {
    wavesurfer.play(0);
});

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
