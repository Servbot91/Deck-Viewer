// ui/controls.js
import { closeDeck, startAutoPlay, stopAutoPlay, loadNextChunk } from './deck.js';
import { openMetadataModal, closeMetadataModal } from './metadata.js';

// Fullscreen functionality
function toggleFullscreen() {
    const container = document.querySelector('.image-deck-container');
    if (!container) return;

    if (!document.fullscreenElement) {
        container.requestFullscreen().catch(err => {
            console.warn('[Image Deck] Fullscreen request failed:', err);
        });
    } else {
        document.exitFullscreen();
    }
}

// Setup event handlers
export function setupEventHandlers(container) {
    // Close button
    const closeBtn = container.querySelector('.image-deck-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeDeck);
    }

    // Fullscreen button
    const fullscreenBtn = container.querySelector('.image-deck-fullscreen');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullscreen);
    }

    // Metadata modal close button
    const metadataCloseBtn = container.querySelector('.image-deck-metadata-close');
    if (metadataCloseBtn) {
        metadataCloseBtn.addEventListener('click', closeMetadataModal);
    }

    // Control buttons - Make sure we're attaching to the right elements
    const controlButtons = container.querySelectorAll('.image-deck-control-btn');
    console.log('[Image Deck] Found control buttons:', controlButtons.length);
    
    controlButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const action = button.dataset.action;
            console.log('[Image Deck] Button clicked:', action);

            if (!action) return;

            switch(action) {
                case 'prev':
                    console.log('[Image Deck] Previous button clicked');
                    const swiper = window.currentSwiperInstance; // You'll need to expose this globally or pass it
                    if (swiper) {
                        swiper.slidePrev();
                    } else {
                        console.log('[Image Deck] No swiper instance found');
                    }
                    break;
                case 'next':
                    console.log('[Image Deck] Next button clicked');
                    if (swiper) {
                        swiper.slideNext();
                        // Check if we need to load next chunk
                        setTimeout(() => {
                            if (typeof checkAndLoadNextChunk === 'function') {
                                checkAndLoadNextChunk();
                            }
                        }, 100);
                    } else {
                        console.log('[Image Deck] No swiper instance found');
                    }
                    break;
                case 'play':
                    console.log('[Image Deck] Play button clicked');
                    const playBtn = document.querySelector('[data-action="play"]');
                    const isAutoPlaying = playBtn && playBtn.classList.contains('active');
                    if (isAutoPlaying) {
                        stopAutoPlay();
                    } else {
                        startAutoPlay();
                    }
                    break;
                case 'info':
                    console.log('[Image Deck] Info button clicked');
                    openMetadataModal();
                    break;
                case 'next-chunk':
                    console.log('[Image Deck] Next chunk button clicked');
                    loadNextChunk();
                    break;
                default:
                    console.log('[Image Deck] Unknown action:', action);
            }
        });
    });

    // Keyboard controls
    document.addEventListener('keydown', handleKeyboard);

    // Swipe gestures (for touch devices) - OPTIMIZED
    let touchStartY = 0;
    let touchDeltaY = 0;
    let rafId = null;

    const swiperEl = container.querySelector('.image-deck-swiper');

    swiperEl.addEventListener('touchstart', (e) => {
        // Only handle touches on the swiper, not the modal
        if (e.target.closest('.image-deck-metadata-modal')) return;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    swiperEl.addEventListener('touchmove', (e) => {
        // Only handle touches on the swiper, not the modal
        if (e.target.closest('.image-deck-metadata-modal')) return;

        touchDeltaY = e.touches[0].clientY - touchStartY;

        // Swipe down to close
        if (touchDeltaY > 50) {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                container.style.transform = `translateY(${touchDeltaY * 0.3}px)`;
                container.style.opacity = Math.max(0.3, 1 - (touchDeltaY / 500));
            });
        }
        // Swipe up to open metadata (visual feedback)
        else if (touchDeltaY < -50) {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                const modal = container.querySelector('.image-deck-metadata-modal');
                if (modal && !modal.classList.contains('active')) {
                    // Preview the modal sliding up
                    modal.style.transform = `translateY(${Math.max(touchDeltaY, -200)}px)`;
                    modal.style.opacity = Math.min(Math.abs(touchDeltaY) / 150, 1);
                }
            });
        }
    }, { passive: true });

    swiperEl.addEventListener('touchend', () => {
        // Only handle touches on the swiper, not the modal
        if (rafId) cancelAnimationFrame(rafId);

        // Swipe down to close
        if (touchDeltaY > 150) {
            closeDeck();
        }
        // Swipe up to open metadata
        else if (touchDeltaY < -100) {
            openMetadataModal();
        }
        // Reset transform
        else {
            requestAnimationFrame(() => {
                container.style.transform = '';
                container.style.opacity = '';
                const modal = container.querySelector('.image-deck-metadata-modal');
                if (modal && !modal.classList.contains('active')) {
                    modal.style.transform = '';
                    modal.style.opacity = '';
                }
            });
        }
        touchDeltaY = 0;
    }, { passive: true });
}

// Keyboard handler
function handleKeyboard(e) {
    // Don't interfere with typing in metadata modal inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
            closeMetadataModal();
        }
        return;
    }

    switch(e.key) {
        case 'Escape':
            const modal = document.querySelector('.image-deck-metadata-modal');
            if (modal && modal.classList.contains('active')) {
                closeMetadataModal();
            } else {
                closeDeck();
            }
            break;
        case ' ':
            e.preventDefault();
            const playBtn = document.querySelector('[data-action="play"]');
            const isAutoPlaying = playBtn && playBtn.classList.contains('active');
            if (isAutoPlaying) {
                stopAutoPlay();
            } else {
                startAutoPlay();
            }
            break;
        case 'i':
        case 'I':
            e.preventDefault();
            const metadataModal = document.querySelector('.image-deck-metadata-modal');
            if (metadataModal && metadataModal.classList.contains('active')) {
                closeMetadataModal();
            } else {
                openMetadataModal();
            }
            break;
    }
}
