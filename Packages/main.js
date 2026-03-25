import { initialize, initPlugin } from './ui.js';
import './styles.css';

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initialize();
        initPlugin(); // Call initPlugin to start the observer
    });
} else {
    initialize();
    initPlugin(); // Call initPlugin to start the observer
}

// Track last URL to detect changes
let lastUrl = location.href;

// Handle SPA navigation
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function() {
    originalPushState.apply(history, arguments);
    handleNavigation();
};

history.replaceState = function() {
    originalReplaceState.apply(history, arguments);
    handleNavigation();
};

window.addEventListener('popstate', handleNavigation);

setInterval(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        handleNavigation();
    }
}, 500);

function handleNavigation() {
    lastUrl = location.href;
    // Remove any existing image deck button
    const existingButton = document.querySelector('.image-deck-launch-btn');
    if (existingButton) {
        existingButton.remove();
    }
    // Remove any existing image deck container
    const existingDeck = document.querySelector('.image-deck-container');
    if (existingDeck) {
        existingDeck.remove();
        document.body.classList.remove('image-deck-open');
    }
}
