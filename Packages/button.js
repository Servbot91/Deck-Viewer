
import { detectContext, fetchContextImages, getVisibleImages, getVisibleGalleryCovers } from './context.js';

let retryTimer = null;

export function createLaunchButton() {
    console.log('[Image Deck] Creating launch button...');
    
    // Check if we're on a relevant page
    const context = detectContext();
    const hasImages = document.querySelectorAll('img[src*="/image/"]').length > 0;
    const hasGalleryCovers = document.querySelectorAll('.gallery-cover img, .gallery-card img').length > 0;
    
    console.log('[Image Deck] Context detection result:', context);
    console.log('[Image Deck] Has images:', hasImages);
    console.log('[Image Deck] Has gallery covers:', hasGalleryCovers);
    
    if (!context && !hasImages && !hasGalleryCovers) {
        console.log('[Image Deck] Not on relevant page, removing button if exists');
        // If not on relevant page, remove any existing button
        const existing = document.querySelector('.image-deck-launch-btn');
        if (existing) existing.remove();
        return;
    }

    // Remove any existing button
    const existing = document.querySelector('.image-deck-launch-btn');
    if (existing) {
        console.log('[Image Deck] Removing existing button');
        existing.remove();
    }

    const button = document.createElement('button');
    button.className = 'image-deck-launch-btn';
    button.innerHTML = '🎴';
    button.title = 'Open Image Deck';
    button.addEventListener('click', function(e) {
        console.log('[Image Deck] Launch button clicked!');
        // We'll import this dynamically to avoid circular dependencies
        import('./deck.js').then(module => {
            module.openDeck();
        });
    });

    document.body.appendChild(button);
    console.log('[Image Deck] Launch button created successfully');
}

export function cleanupButton() {
    const existing = document.querySelector('.image-deck-launch-btn');
    if (existing) existing.remove();
}

// Retry creating launch button with exponential backoff
export function retryCreateButton(attempts = 0, maxAttempts = 5) {
    const delays = [100, 300, 500, 1000, 2000];

    if (attempts >= maxAttempts) {
        console.log('[Image Deck] Max retry attempts reached');
        return;
    }

    const hasContext = detectContext();
    const hasImages = document.querySelectorAll('img[src*="/image/"]').length > 0;
    const hasGalleryCovers = document.querySelectorAll('.gallery-cover img, .gallery-card img').length > 0;

    if (hasContext || hasImages || hasGalleryCovers) {
        createLaunchButton();
    } else if (attempts < maxAttempts - 1) {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => retryCreateButton(attempts + 1, maxAttempts), delays[attempts]);
    }
}
