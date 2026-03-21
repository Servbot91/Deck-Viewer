import { initialize } from './ui.js';
import './styles.css';

// Wait for page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    setTimeout(initialize, 500);
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
    // Close deck and recreate button handled in ui.js
}
