// Panel toggle functionality
document.addEventListener('DOMContentLoaded', () => {
    const settingsToggle = document.getElementById('settingsToggle');
    const settingsPanel = document.getElementById('settingsPanel');

    // Toggle settings panel
    if (settingsToggle && settingsPanel) {
        settingsToggle.addEventListener('click', () => {
            settingsPanel.classList.toggle('open');
            settingsToggle.classList.toggle('panel-open');
        });
    }

    // Close panels when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.side-panel') && 
            !e.target.closest('.panel-toggle')) {
            if (settingsPanel) {
                settingsPanel.classList.remove('open');
                if (settingsToggle) settingsToggle.classList.remove('panel-open');
            }
        }
    });
});
