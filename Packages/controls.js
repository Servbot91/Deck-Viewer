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

// Control buttons
    const controlButtons = container.querySelectorAll('.image-deck-control-btn');
    
    controlButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const action = button.dataset.action;
            // CORRECTED: Fetch swiper from the global window object every time a button is clicked
            const swiper = window.currentSwiperInstance; 

            if (!action) return;

            switch(action) {
                case 'prev':
                    if (swiper) {
                        swiper.slidePrev();
                    } else {
                        console.error('[Image Deck] Prev failed: window.currentSwiperInstance is not defined');
                    }
                    break;
                case 'next':
                    if (swiper) {
                        swiper.slideNext();
                        // Use the imported loadNextChunk function
                        setTimeout(() => {
                            loadNextChunk();
                        }, 100);
                    } else {
                        console.error('[Image Deck] Next failed: window.currentSwiperInstance is not defined');
                    }
                    break;
                case 'play':
                    const playBtn = document.querySelector('[data-action="play"]');
                    const isAutoPlaying = playBtn && playBtn.classList.contains('active');
                    if (isAutoPlaying) {
                        stopAutoPlay();
                    } else {
                        startAutoPlay();
                    }
                    break;
                case 'info':
                    openMetadataModal();
                    break;
                case 'next-chunk':
                    loadNextChunk();
                    break;
                default:
                    console.log('[Image Deck] Unknown action:', action);
            }
        });
    });

// Keyboard controls
    document.addEventListener('keydown', handleKeyboard);

    // Swipe gestures logic (unchanged from your original)
    setupSwipeGestures(container);
	setupMouseWheel(container);
}

// Extracted swipe logic to keep setup clean
function setupSwipeGestures(container) {
    let touchStartY = 0;
    let touchDeltaY = 0;
    let rafId = null;
    const swiperEl = container.querySelector('.image-deck-swiper');
    if (!swiperEl) return;

    swiperEl.addEventListener('touchstart', (e) => {
        if (e.target.closest('.image-deck-metadata-modal')) return;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    swiperEl.addEventListener('touchmove', (e) => {
        if (e.target.closest('.image-deck-metadata-modal')) return;
        touchDeltaY = e.touches[0].clientY - touchStartY;

        if (touchDeltaY > 50) {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                container.style.transform = `translateY(${touchDeltaY * 0.3}px)`;
                container.style.opacity = Math.max(0.3, 1 - (touchDeltaY / 500));
            });
        }
    }, { passive: true });

    swiperEl.addEventListener('touchend', () => {
        if (rafId) cancelAnimationFrame(rafId);
        if (touchDeltaY > 150) {
            closeDeck();
        } else {
            requestAnimationFrame(() => {
                container.style.transform = '';
                container.style.opacity = '';
            });
        }
        touchDeltaY = 0;
    }, { passive: true });
}

// In controls.js, add this function to setup mousewheel handling
function setupMouseWheel(container) {
    // Mouse wheel support - attach directly to the swiper element
    const swiperEl = container.querySelector('.image-deck-swiper');
    if (!swiperEl) return;

    swiperEl.addEventListener('wheel', (e) => {
        // CORRECTED: Fetch swiper from the global window object every time
        const swiper = window.currentSwiperInstance;
        if (!swiper) return;

        // Prevent default scrolling behavior
        e.preventDefault();
        
        // Debounce rapid wheel events
        if (swiper.wheeling) return;
        swiper.wheeling = true;
        
        // Determine scroll direction
        if (e.deltaY > 0) {
            // Scroll down - next slide
            swiper.slideNext();
        } else if (e.deltaY < 0) {
            // Scroll up - prev slide
            swiper.slidePrev();
        }
        
        // Reset wheeling flag after a short delay
        setTimeout(() => {
            if (swiper) swiper.wheeling = false;
        }, 150);
    }, { passive: false });
}


// Keyboard handler
function handleKeyboard(e) {
    const swiper = window.currentSwiperInstance;

    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') closeMetadataModal();
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
            if (playBtn && playBtn.classList.contains('active')) {
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
        // ADDED: Arrow Key Support
        case 'ArrowLeft':
            if (swiper) swiper.slidePrev();
            break;
        case 'ArrowRight':
            if (swiper) {
                swiper.slideNext();
                setTimeout(() => loadNextChunk(), 100);
            }
            break;
    }
}