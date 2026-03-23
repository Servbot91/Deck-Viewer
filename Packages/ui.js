// ui/ui.js
import { createLaunchButton, cleanupButton, retryCreateButton } from './button.js';

// Export initialize function for main.js
export function initialize() {
    console.log('[Image Deck] Initializing...');

    // Wait for Swiper to load
    if (typeof Swiper === 'undefined') {
        console.error('[Image Deck] Swiper not loaded!');
        return;
    }

    // Create launch button on relevant pages
    retryCreateButton();

    // Watch for DOM changes to detect when React renders new content
    let debounceTimer;
    const observer = new MutationObserver((mutations) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            // Check if button exists and we're still on a valid page
            const hasButton = document.querySelector('.image-deck-launch-btn');
            const shouldHaveButton = 
                document.querySelectorAll('img[src*="/image/"]').length > 0 ||
                document.querySelectorAll('.gallery-cover img, .gallery-card img').length > 0;

            if (!hasButton && shouldHaveButton) {
                createLaunchButton();
            }
        }, 300);
    });

    // Observe the main content area for changes
    const mainContent = document.querySelector('.main-content') ||
                      document.querySelector('[role="main"]') ||
                      document.body;

    observer.observe(mainContent, {
        childList: true,
        subtree: true // Watch subtree to catch React updates
    });

    console.log('[Image Deck] Initialized');
}

export { createLaunchButton, cleanupButton, retryCreateButton } from './button.js';
export { openDeck, closeDeck, startAutoPlay, stopAutoPlay, loadNextChunk } from './deck.js';
