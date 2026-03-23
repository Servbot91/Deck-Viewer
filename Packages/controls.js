// ui/controls.js
import { closeDeck, startAutoPlay, stopAutoPlay, loadNextChunk } from './deck.js';
import { openMetadataModal, closeMetadataModal } from './metadata.js';

let isDeckActive = false;

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
    // Set deck as active when handlers are set up
    setDeckActive(true);
    // Store reference to handler for cleanup
    keyboardHandler = handleKeyboard;
    // Close button
    const closeBtn = container.querySelector('.image-deck-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeDeck);
    }
    // Keyboard controls - use capturing phase
    document.addEventListener('keydown', handleKeyboard, true);
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

    // Keyboard controls - use capturing phase to intercept before other handlers
    document.addEventListener('keydown', handleKeyboard, true);
    // Swipe gestures logic
    setupSwipeGestures(container);
    // Mouse wheel support
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


function setupMouseWheel(container) {
    // Mouse wheel support - attach directly to the swiper element
    const swiperEl = container.querySelector('.image-deck-swiper');
    if (!swiperEl) return;

    swiperEl.addEventListener('wheel', (e) => {
        //Fetch swiper from the global window object every time
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

export function setDeckActive(active) {
    isDeckActive = active;
}

// Keyboard handler
function handleKeyboard(e) {
    // Only handle keyboard events when deck is active
    if (!isDeckActive) return;
    
    // Always prevent default for these keys when deck is active
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Escape'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation(); // Stop event from bubbling up
    }
    
    const swiper = window.currentSwiperInstance;
    
    // Skip if typing in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
            closeMetadataModal();
            return;
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
            e.stopPropagation();
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
            e.stopPropagation();
            const metadataModal = document.querySelector('.image-deck-metadata-modal');
            if (metadataModal && metadataModal.classList.contains('active')) {
                closeMetadataModal();
            } else {
                openMetadataModal();
            }
            break;
        // ARROW KEY SUPPORT
        case 'ArrowLeft':
            e.preventDefault();
            e.stopPropagation();
            if (swiper) {
                swiper.slidePrev();
            }
            break;
        case 'ArrowRight':
            e.preventDefault();
            e.stopPropagation();
            if (swiper) {
                swiper.slideNext();
                // Trigger next chunk loading if needed
                setTimeout(() => {
                    if (window.currentSwiperInstance) {
                        const currentIndex = window.currentSwiperInstance.activeIndex;
                        const totalCurrentSlides = window.currentSwiperInstance.virtual ? 
                            window.currentSwiperInstance.virtual.slides.length : 
                            window.currentSwiperInstance.slides.length;
                        const totalPagesLocal = totalPages || 1;
                        
                        if (currentIndex >= totalCurrentSlides - 3 && currentChunkPage < totalPagesLocal) {
                            loadNextChunk();
                        }
                    }
                }, 100);
            }
            break;
    }
}
