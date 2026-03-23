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
    const swiperEl = container.querySelector('.swiper');

    // For ANY gallery with more than 10 images, use virtual slides for performance
    const useVirtual = images.length > 10;
    const effectOptions = getEffectOptions(pluginConfig.transitionEffect, pluginConfig);

    // Swiper configuration
    const swiperConfig = {
        effect: pluginConfig.transitionEffect,
        grabCursor: true,
        centeredSlides: true,
        slidesPerView: 1,
        resistanceRatio: pluginConfig.swipeResistance / 100,
        speed: 150,
        watchSlidesProgress: true,
        preloadImages: false,
        keyboard: { enabled: true, onlyInViewport: false },
        loop: contextInfo?.isSingleGallery ? true : false,
        loopAdditionalSlides: 2,
        ...effectOptions
    };

    // Helper to generate the exact HTML from your first snippet
    const getSlideTemplate = (img, isEager) => {
        const fullSrc = img.paths.image;
        const isGallery = img.url && !contextInfo?.isSingleGallery;
        const loadingStrategy = isEager ? 'eager' : 'lazy';

        if (isGallery) {
            return `
                <div class="swiper-zoom-container" data-type="gallery" data-url="${img.url}">
                    <div class="gallery-cover-container">
                        <div class="gallery-cover-title" title="${img.title || 'Untitled Gallery'}">${img.title || 'Untitled Gallery'}</div>
                        <a href="${img.url}" target="_blank" class="gallery-cover-link">
                            <img src="${fullSrc}" alt="${img.title || ''}" decoding="async" loading="${loadingStrategy}" />
                        </a>
                    </div>
                </div>`;
        } else {
            return `
                <div class="swiper-zoom-container" data-type="image">
                    <img src="${fullSrc}" alt="${img.title || ''}" decoding="async" loading="${loadingStrategy}" style="max-width: 100%; height: auto; display: block; margin: 0 auto;" />
                </div>`;
        }
    };

    if (useVirtual) {
        console.log('[Image Deck] Using virtual slides for performance');
        swiperConfig.virtual = {
            slides: images.map(img => getSlideTemplate(img, false)),
            cache: true, // Re-enabled cache to prevent the "load nothing" refresh issue
            addSlidesBefore: 2,
            addSlidesAfter: 2,
            renderSlide: function (slideContent) {
                return `<div class="swiper-slide">${slideContent}</div>`;
            }
        };
    } else {
        // Build slides normally for small galleries
        images.forEach((img) => {
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';
            slide.innerHTML = getSlideTemplate(img, true);
            
            const imgEl = slide.querySelector('img');
            if (imgEl && imgEl.decode) {
                imgEl.decode().catch(() => {});
            }
            wrapper.appendChild(slide);
        });
    }

    // Combined Event Handlers
    swiperConfig.on = {
        click: function(swiper, event) {
            // This captures clicks on virtual OR normal slides
            const zoomContainer = event.target.closest('.swiper-zoom-container');
            if (zoomContainer && zoomContainer.dataset.type === 'gallery') {
                const url = zoomContainer.dataset.url;
                if (url) window.open(url, '_blank');
            }
        },
        slideChange: function() {
            if (updateUICallback) updateUICallback(container);
            if (savePositionCallback) savePositionCallback();
        },
        reachEnd: function() {
            const nextChunkBtn = document.querySelector('[data-action="next-chunk"]');
            if (nextChunkBtn && !nextChunkBtn.disabled) {
                setTimeout(() => nextChunkBtn.click(), 300);
            }
        },
        slideChangeTransitionEnd: function() {
            // Force lazy load if applicable
            if (this.lazy && this.lazy.load) {
                setTimeout(() => this.lazy.load(), 50);
            }
            
            // Preload logic
            const currentIndex = this.activeIndex;
            const totalSlides = this.virtual ? this.virtual.slides.length : this.slides.length;
            if (totalSlides > 0 && currentIndex >= totalSlides - 3) {
                const nextChunkBtn = document.querySelector('[data-action="next-chunk"]');
                if (nextChunkBtn && !nextChunkBtn.disabled) {
                    setTimeout(() => nextChunkBtn.click(), 1000);
                }
            }
        }
    };

    const swiper = new Swiper(swiperEl, swiperConfig);
    container.querySelector('.image-deck-loading').style.display = 'none';

    return swiper;
}