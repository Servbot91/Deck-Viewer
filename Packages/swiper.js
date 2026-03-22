// Import Swiper if needed
// import Swiper from 'swiper/bundle';

// Get effect-specific Swiper options - OPTIMIZED
export function getEffectOptions(effect, pluginConfig) {
    const depth = pluginConfig.effectDepth;

    // Simplify effects for better performance
    switch(effect) {
        case 'cards':
            return {
                cardsEffect: {
                    slideShadows: false, // Disable shadows for performance
                    rotate: true,
                    perSlideRotate: 2,
                    perSlideOffset: 8
                }
            };

        case 'coverflow':
            return {
                coverflowEffect: {
                    rotate: 30, // Reduced from 50
                    stretch: 0,
                    depth: Math.min(depth, 100), // Cap depth
                    modifier: 1,
                    slideShadows: false // Disable shadows
                }
            };

        case 'flip':
            return {
                flipEffect: {
                    slideShadows: false,
                    limitRotation: true
                }
            };

        case 'cube':
            return {
                cubeEffect: {
                    shadow: false, // Disable shadows
                    slideShadows: false
                }
            };

        case 'fade':
            return {
                fadeEffect: {
                    crossFade: true
                },
                speed: 200 // Faster fade
            };

        default: // slide - most performant
            return {
                spaceBetween: 20,
                slidesPerView: 1
            };
    }
}

export function initSwiper(container, images, pluginConfig, updateUICallback, savePositionCallback, contextInfo) {
    const wrapper = container.querySelector('.swiper-wrapper');

    // For ANY gallery with more than 10 images, use virtual slides for performance
    const useVirtual = images.length > 10;
	// For smaller galleries (< 10 images), load all images eagerly to avoid lazy loading issues
	const eagerLoadAll = images.length <= 10;

    // Get effect-specific options
    const effectOptions = getEffectOptions(pluginConfig.transitionEffect, pluginConfig);

    // Swiper configuration with performance optimizations
	const swiperConfig = {
		effect: pluginConfig.transitionEffect,
		grabCursor: true,
		centeredSlides: true,
		slidesPerView: 1,
		resistanceRatio: pluginConfig.swipeResistance / 100,
		// Performance optimizations
		speed: 150,
		watchSlidesProgress: true,
		preloadImages: false,
		keyboard: {
			enabled: true,
			onlyInViewport: false
		},
		// Add loop functionality for single galleries
		loop: contextInfo?.isSingleGallery ? true : false,
		loopAdditionalSlides: 2, // Add extra slides for smooth looping
		...effectOptions
	};

    // Add virtual slides configuration for large galleries
    if (useVirtual) {
        console.log('[Image Deck] Using virtual slides for performance');
        swiperConfig.virtual = {
            slides: images.map((img, index) => {
                const fullSrc = img.paths.image;
                // Check if this is a gallery cover with a URL
                if (img.url) {
                    return `<div class="swiper-zoom-container">
                        <div class="gallery-cover-container">
                            <div class="gallery-cover-title" title="${img.title || 'Untitled Gallery'}">${img.title || 'Untitled Gallery'}</div>
                            <a href="${img.url}" target="_blank" class="gallery-cover-link">
                                <img src="${fullSrc}" alt="${img.title || ''}" decoding="async" loading="lazy" />
                            </a>
                        </div>
                    </div>`;
                } else {
                    return `<div class="swiper-zoom-container"><img src="${fullSrc}" alt="${img.title || ''}" decoding="async" loading="lazy" style="max-width: 100%; height: auto; display: block; margin: 0 auto;" /></div>`;
                }
            }),
            cache: true,
            addSlidesBefore: 2,
            addSlidesAfter: 2,
            renderSlide: function (slideData) {
                // Custom render function for virtual slides
                return `<div class="swiper-slide">${slideData}</div>`;
            }
        };
        
        swiperConfig.lazy = false;
    } else {
        // For smaller galleries, add slides normally but with optimization
		images.forEach((img, index) => {
			const slide = document.createElement('div');
			slide.className = 'swiper-slide';
			const fullSrc = img.paths.image;

			// Check if this is a gallery cover with a URL
			if (img.url && !contextInfo?.isSingleGallery) {
				// Create clickable gallery cover with title (only for gallery listings, not single gallery images)
				slide.innerHTML = `
					<div class="swiper-zoom-container">
						<div class="gallery-cover-container">
							<div class="gallery-cover-title" title="${img.title || 'Untitled Gallery'}">${img.title || 'Untitled Gallery'}</div>
							<a href="${img.url}" target="_blank" class="gallery-cover-link">
								<img
									src="${fullSrc}"
									alt="${img.title || ''}"
									decoding="async"
									loading="eager"
								>
							</a>
						</div>
					</div>
				`;
			} else {
                // For regular images or images in a single gallery, just show the image
                // Load first 1 image immediately, rest lazily
				slide.innerHTML = `
					<div class="swiper-zoom-container">
						<img
							src="${fullSrc}"
							alt="${img.title || ''}"
							decoding="async"
							loading="eager"
						>
					</div>
				`;
				
				// Pre-decode the image for better performance
				const imgEl = slide.querySelector('img');
				if (imgEl && imgEl.decode) {
					imgEl.decode().catch(() => {});
				}
			}
			wrapper.appendChild(slide);
		});
    
        
    swiperConfig.lazy = false;
    }

    // Add event handlers
    const commonEvents = {
        slideChange: function() {
            if (updateUICallback) {
                updateUICallback(container);
            }
            if (savePositionCallback) {
                savePositionCallback();
            }
        },
        reachEnd: function() {
            console.log('[Image Deck] Reached end of current chunk');
            
            // Check if we're at the end and there are more chunks to load
            const playBtn = document.querySelector('[data-action="play"]');
            const isAutoPlaying = playBtn && playBtn.classList.contains('active');
            
            // Try to load next chunk automatically when reaching end
            const nextChunkBtn = document.querySelector('[data-action="next-chunk"]');
            if (nextChunkBtn && !nextChunkBtn.disabled) {
                console.log('[Image Deck] Auto-loading next chunk...');
                // Auto-load next chunk when reaching the end
                setTimeout(() => {
                    nextChunkBtn.click();
                }, 300); // Small delay to ensure smooth transition
            } else if (isAutoPlaying) {
                // If autoplaying and no more chunks, stop autoplay
                console.log('[Image Deck] No more chunks available, stopping autoplay');
                const stopAutoPlay = () => {
                    if (playBtn) {
                        playBtn.innerHTML = '▶';
                        playBtn.classList.remove('active');
                    }
                    const speedIndicator = document.querySelector('.image-deck-speed');
                    if (speedIndicator) {
                        speedIndicator.classList.remove('visible');
                    }
                };
                stopAutoPlay();
            }
        },
		slideChangeTransitionEnd: function() {
			// Always try to load lazy images on slide change
			if (this.lazy && this.lazy.load) {
				setTimeout(() => {
					this.lazy.load(); // Force load lazy images
				}, 50);
			}
			
			// Check if we're near the end and should preload next chunk
			const currentIndex = this.activeIndex;
			const totalSlides = this.slides ? this.slides.length : (this.virtual ? this.virtual.slides.length : 0);
			
			if (totalSlides > 0 && currentIndex >= totalSlides - 3) { // Preload when 3 slides from end
				const nextChunkBtn = document.querySelector('[data-action="next-chunk"]');
				if (nextChunkBtn && !nextChunkBtn.disabled) {
					console.log('[Image Deck] Preloading next chunk...');
					// Preload next chunk
					setTimeout(() => {
						nextChunkBtn.click();
					}, 1000);
				}
			}
		}
    };

    swiperConfig.on = { ...swiperConfig.on, ...commonEvents };

    // Initialize Swiper
    const swiper = new Swiper(container.querySelector('.swiper'), swiperConfig);

    // Hide loading
    container.querySelector('.image-deck-loading').style.display = 'none';

    return swiper;
}
