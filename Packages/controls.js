// ui/controls.js
import { closeDeck, startAutoPlay, stopAutoPlay, loadNextChunk } from './deck.js';
import { openMetadataModal, closeMetadataModal } from './metadata.js';

let isDeckActive = false;
let keyboardHandler = null;

// Fullscreen functionality
function toggleFullscreen() {
    const container = document.querySelector('.image-deck-container');
    if (!container) return;

    if (!document.fullscreenElement) {
        container.requestFullscreen().catch(err => {
            console.warn('[Image Deck] Fullscreen request failed:', err);
        }).finally(() => {
            // Update any UI elements that need to know about fullscreen state
            updateFullscreenUI(true);
        });
    } else {
        document.exitFullscreen().finally(() => {
            // Update any UI elements that need to know about fullscreen state
            updateFullscreenUI(false);
        });
    }
}

// Add this helper function to update UI based on fullscreen state
function updateFullscreenUI(isFullscreen) {
    const fullscreenBtn = document.querySelector('.image-deck-fullscreen');
    if (fullscreenBtn) {
        fullscreenBtn.textContent = isFullscreen ? '⛶' : '⛶'; // You could change the icon if desired
    }
    
    // Add/remove a class to the container for styling purposes
    const container = document.querySelector('.image-deck-container');
    if (container) {
        if (isFullscreen) {
            container.classList.add('fullscreen-mode');
        } else {
            container.classList.remove('fullscreen-mode');
        }
    }
}


// Helper function to check if current slide is a gallery
function isCurrentSlideGallery() {
    const swiper = window.currentSwiperInstance;
    if (swiper && swiper.slides) {
        const activeSlide = swiper.slides[swiper.activeIndex];
        if (activeSlide) {
            const zoomContainer = activeSlide.querySelector('.swiper-zoom-container');
            if (zoomContainer && zoomContainer.dataset.type === 'gallery') {
                return true;
            }
        }
    }
    return false;
}

// Function to update the gallery state class
function updateGalleryStateClass() {
    const container = document.querySelector('.image-deck-container');
    if (!container) return;
    
    if (isCurrentSlideGallery()) {
        container.classList.add('gallery-active');
    } else {
        container.classList.remove('gallery-active');
    }
}

// Setup event handlers
export function setupEventHandlers(container) {
    // Set deck as active when handlers are set up
    setDeckActive(true);
    
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
				case 'zoom-in':
					// Check if current slide is a gallery
					if (swiper && swiper.zoom && !isCurrentSlideGallery()) {
						swiper.zoom.in();
					}
					break;
				case 'zoom-out':
					// Check if current slide is a gallery
					if (swiper && swiper.zoom && !isCurrentSlideGallery()) {
						swiper.zoom.out();
					}
					break;
				case 'next-chunk':
					loadNextChunk(container);
					break;
				default:
					console.log('[Image Deck] Unknown action:', action);
			}
		});
	});

    // Add slide change listener to update gallery state
    if (window.currentSwiperInstance) {
        window.currentSwiperInstance.on('slideChangeTransitionEnd', function() {
            updateGalleryStateClass();
        });
        
        // Initial check for first slide
        setTimeout(() => {
            updateGalleryStateClass();
        }, 0);
    }

    // Keyboard controls - use capturing phase to intercept before other handlers
    keyboardHandler = handleKeyboard;
    document.addEventListener('keydown', handleKeyboard, true);
    
    // Swipe gestures logic
    setupSwipeGestures(container);
    // Mouse wheel support
    setupMouseWheel(container);
}

// Extracted swipe logic to keep setup clean
function setupSwipeGestures(container) {
    let touchStartY = 0;
    let touchStartX = 0;
    let touchDeltaY = 0;
    let touchDeltaX = 0;
    let rafId = null;
    let lastTouchTime = 0;
    let lastTouchX = 0;
    let lastTouchY = 0;
    
    const swiperEl = container.querySelector('.image-deck-swiper');
    if (!swiperEl) return;

    swiperEl.addEventListener('touchstart', (e) => {
        // Don't interfere with pinch gestures (multi-touch)
        if (e.touches.length > 1) return;
        
        if (e.target.closest('.image-deck-metadata-modal')) return;
        
        const currentTime = new Date().getTime();
        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;
        
        // Check for double tap (within 300ms and 20px distance)
        if (currentTime - lastTouchTime < 300 && 
            Math.abs(touchX - lastTouchX) < 20 && 
            Math.abs(touchY - lastTouchY) < 20) {
            
            // Handle double tap zoom
            handleDoubleTapZoom(e, container);
            e.preventDefault();
            return;
        }
        
        lastTouchTime = currentTime;
        lastTouchX = touchX;
        lastTouchY = touchY;
        
        touchStartY = e.touches[0].clientY;
        touchStartX = e.touches[0].clientX;
        touchDeltaY = 0;
        touchDeltaX = 0;
    }, { passive: false }); // Changed to not passive to allow preventDefault

    swiperEl.addEventListener('touchmove', (e) => {
        // Don't interfere with pinch gestures (multi-touch)
        if (e.touches.length > 1) {
            if (rafId) cancelAnimationFrame(rafId);
            container.style.transform = '';
            container.style.opacity = '';
            return;
        }
        
        if (e.target.closest('.image-deck-metadata-modal')) return;
        
        const currentY = e.touches[0].clientY;
        const currentX = e.touches[0].clientX;
        
        touchDeltaY = currentY - touchStartY;
        touchDeltaX = Math.abs(currentX - touchStartX);
        
        // Check if we're in fullscreen mode
        const isInFullscreen = !!document.fullscreenElement;
        
        // Only trigger swipe-to-close if:
        // 1. NOT in fullscreen mode
        // 2. Vertical movement is significant (> 30px)
        // 3. Horizontal movement is minimal (< 50px)
        // 4. Moving downward (positive deltaY)
        if (!isInFullscreen && touchDeltaY > 30 && touchDeltaX < 50) {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                container.style.transform = `translateY(${touchDeltaY * 0.3}px)`;
                container.style.opacity = Math.max(0.3, 1 - (touchDeltaY / 500));
            });
        }
    }, { passive: true });

    swiperEl.addEventListener('touchend', (e) => {
        if (rafId) cancelAnimationFrame(rafId);
        
        // Check if we're in fullscreen mode
        const isInFullscreen = !!document.fullscreenElement;
        
        // Only close if NOT in fullscreen AND vertical swipe was significant
        if (!isInFullscreen && touchDeltaY > 150 && touchDeltaX < 50) {
            closeDeck();
        } else {
            // Animate back smoothly
            requestAnimationFrame(() => {
                container.style.transform = '';
                container.style.opacity = '';
            });
        }
        
        touchDeltaY = 0;
        touchDeltaX = 0;
    }, { passive: true });
}

// Add this helper function for double tap zoom handling
function handleDoubleTapZoom(event, container) {
    const swiper = window.currentSwiperInstance;
    if (!swiper || !swiper.zoom) return;
    
    // Check if current slide is a gallery (don't zoom galleries)
    if (isCurrentSlideGallery()) {
        console.log('[Image Deck] Double tap ignored - gallery slide');
        return;
    }
    
    // Get the target element coordinates
    const rect = event.target.getBoundingClientRect();
    const x = event.touches[0].clientX - rect.left;
    const y = event.touches[0].clientY - rect.top;
    
    // Toggle zoom
    if (swiper.zoom.scale === 1) {
        swiper.zoom.in(swiper.zoom.enabled ? 2 : 1); // Zoom to 2x
        console.log('[Image Deck] Double tap zoom in');
    } else {
        swiper.zoom.out();
        console.log('[Image Deck] Double tap zoom out');
    }
    
    event.preventDefault();
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
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Escape', '+', '-', '0'].includes(e.key)) {
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
        // ZOOM CONTROLS
		case '+':
		case '=':
			e.preventDefault();
			if (swiper && swiper.zoom && !isCurrentSlideGallery()) {
				swiper.zoom.in();
			}
			break;
		case '-':
		case '_':
			e.preventDefault();
			if (swiper && swiper.zoom && !isCurrentSlideGallery()) {
				swiper.zoom.out();
			}
			break;
		case '0':
			e.preventDefault();
			if (swiper && swiper.zoom && !isCurrentSlideGallery()) {
				swiper.zoom.reset();
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
                            loadNextChunk(container);
                        }
                    }
                }, 100);
            }
            break;
    }
}

// Cleanup function to remove event listeners
export function cleanupEventHandlers() {
    if (keyboardHandler) {
        document.removeEventListener('keydown', keyboardHandler, true);
        keyboardHandler = null;
    }
}
