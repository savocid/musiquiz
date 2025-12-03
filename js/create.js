// create.js - Handles quiz collection submission form

// IMPORTANT: Replace this URL with your Google Apps Script Web App URL
const GOOGLE_SCRIPT_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';

document.getElementById('createForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Collect form data
    const formData = {
        collectionTitle: document.getElementById('collectionTitle').value,
        description: document.getElementById('description').value,
        difficulty: document.getElementById('difficulty').value,
        songList: document.getElementById('songList').value,
        clipDuration: document.getElementById('clipDuration').value,
        guessTime: document.getElementById('guessTime').value,
        submitterName: document.getElementById('submitterName').value,
        submitterEmail: document.getElementById('submitterEmail').value,
        timestamp: new Date().toISOString()
    };
    
    try {
        // Check if Google Script URL is configured
        if (GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
            // For now, just show success and log to console
            console.log('Collection submission:', formData);
            showSuccess();
            document.getElementById('createForm').reset();
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
        document.getElementById('createForm').reset();
        
    } catch (error) {
        console.error('Error submitting form:', error);
        alert('There was an error submitting your collection. Please try again.');
    }
});

function showSuccess() {
    const successMsg = document.getElementById('successMessage');
    successMsg.classList.add('show');
    
    // Hide after 5 seconds
    setTimeout(() => {
        successMsg.classList.remove('show');
    }, 5000);
    
    // Scroll to top to see message
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
