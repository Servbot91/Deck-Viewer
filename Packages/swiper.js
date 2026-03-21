// Import Swiper if needed
// import Swiper from 'swiper/bundle';

export function initSwiper(container, images) {
    const wrapper = container.querySelector('.swiper-wrapper');

    // For large galleries, use virtual slides
    const useVirtual = images.length > 50;

    if (!useVirtual) {
        // For smaller galleries, add slides normally but with optimization
        images.forEach((img, index) => {
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';

            // Use full resolution for quality
            const fullSrc = img.paths.image;

            // Load first 3 images immediately with decode(), rest lazily
            if (index < 3) {
                slide.innerHTML = `
                    <img
                        src="${fullSrc}"
                        alt="${img.title || ''}"
                        decoding="async"
                    >
                `;
                // Use Image.decode() API for modern browsers
                const imgEl = slide.querySelector('img');
                if (imgEl && imgEl.decode) {
                    imgEl.decode().catch(() => {
                        // Fallback if decode fails
                    });
                }
            } else {
                slide.innerHTML = `
                    <img
                        class="swiper-lazy"
                        data-src="${fullSrc}"
                        alt="${img.title || ''}"
                        decoding="async"
                    >
                    <div class="swiper-lazy-preloader"></div>
                `;
            }
            wrapper.appendChild(slide);
        });
    }

    // Get effect-specific options
    const effectOptions = getEffectOptions(pluginConfig.transitionEffect);

    // Swiper configuration with performance optimizations
    const swiperConfig = {
        effect: pluginConfig.transitionEffect,
        grabCursor: true,
        centeredSlides: true,
        slidesPerView: 1,
        resistanceRatio: pluginConfig.swipeResistance / 100,
        // Performance optimizations
        speed: 300,
        watchSlidesProgress: true,
        preloadImages: false,
        // Enable lazy loading only if not using virtual slides
        lazy: useVirtual ? false : {
            loadPrevNext: true,
            loadPrevNextAmount: 2,
            loadOnTransitionStart: true,
            elementClass: 'swiper-lazy',
            loadingClass: 'swiper-lazy-loading',
            loadedClass: 'swiper-lazy-loaded',
            preloaderClass: 'swiper-lazy-preloader'
        },
        keyboard: {
            enabled: true,
            onlyInViewport: false
        },
        ...effectOptions
    };

    // Add virtual slides configuration for large galleries
    if (useVirtual) {
        swiperConfig.virtual = {
            slides: images.map((img, index) => {
                // Use full resolution for quality with async decoding
                const fullSrc = img.paths.image;
                return `<img src="${fullSrc}" alt="${img.title || ''}" decoding="async" />`;
            }),
            cache: false,
            addSlidesBefore: 2,
            addSlidesAfter: 2
        };
    }

    // Add event handlers
    swiperConfig.on = {
        slideChange: function() {
            updateUI(container);
            savePosition();
        },
        reachEnd: function() {
            if (isAutoPlaying) {
                stopAutoPlay();
            }
        }
    };

    // Initialize Swiper
    currentSwiper = new Swiper(container.querySelector('.swiper'), swiperConfig);

    // Hide loading
    container.querySelector('.image-deck-loading').style.display = 'none';

    return currentSwiper;
}

// Get effect-specific Swiper options - OPTIMIZED
export function getEffectOptions(effect) {
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
