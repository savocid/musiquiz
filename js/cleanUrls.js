// Clean URL redirect for non-local environments
(function() {
    const isLocal = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocal && window.location.pathname.endsWith('.html')) {
        let newPath = window.location.pathname.replace(/\.html$/, '');
        if (newPath === '') newPath = '/';
        const newUrl = window.location.origin + newPath + window.location.search + window.location.hash;
        window.location.replace(newUrl);
    }
})();

// Compute base path for the project
let basePath = window.location.pathname;
if (!basePath.endsWith('/')) basePath += '/';

// Set correct home links based on environment
document.addEventListener('DOMContentLoaded', () => {
    const isLocal = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const homeLinks = document.querySelectorAll('a[href="/"]');
    homeLinks.forEach(link => {
        if (isLocal) {
            link.href = 'index.html';
        } else {
            link.href = basePath;
        }
    });
    // For submit link in footer
    const submitLinks = document.querySelectorAll('a[href="submit"]');
    submitLinks.forEach(link => {
        if (isLocal) {
            link.href = 'submit.html';
        } else {
            link.href = basePath + 'submit';
        }
    });
});

// Function for programmatic navigation
window.goHome = function() {
    const isLocal = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
        window.location.href = 'index.html';
    } else {
        window.location.href = basePath;
    }
};