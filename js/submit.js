// IMPORTANT: Replace this URL with your Google Apps Script Web App URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz5GNzvlZpHUbZp84SnEk-koOaXlmNAxy2pw-BwxZEIqNj9eIhyrCUxmeFFwXrdiMPkFA/exec';

document.getElementById('createForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = document.getElementById('createForm');
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    // Collect form data
    const formData = {
        collectionTitle: document.getElementById('collectionTitle').value,
        description: document.getElementById('description').value,
        difficulty: document.getElementById('difficulty').value,
        songList: document.getElementById('songList').value,
        note: document.getElementById('submitterName').value,
        timestamp: new Date().toISOString()
    };

    try {
        // Check if Google Script URL is configured
        if (GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
            // For now, just show success and log to console
            console.log('Collection submission:', formData);
            showSuccess();
            form.reset();
            return;
        }

        // Send to Google Sheets via Apps Script
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Required for Google Apps Script
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        // Show success message
        showSuccess();

        // Reset form
        form.reset();

    } catch (error) {
        submitBtn.disabled = false;
        console.error('Error submitting form:', error);
        alert('There was an error submitting your collection. Please try again.');
    }
});

function showSuccess() {
    const form = document.getElementById('createForm');
    const successWrapper = document.getElementById('successWrapper');
    form.style.display = 'none';
    successWrapper.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
