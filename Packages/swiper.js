/**
 * Configuration for Swiper effects with performance-focused defaults
 */
const EFFECT_CONFIGS = {
    cards: () => ({ cardsEffect: { slideShadows: false, rotate: true, perSlideRotate: 2, perSlideOffset: 8 } }),
    coverflow: (depth) => ({ coverflowEffect: { rotate: 30, stretch: 0, depth: Math.min(depth, 100), modifier: 1, slideShadows: false } }),
    flip: () => ({ flipEffect: { slideShadows: false, limitRotation: true } }),
    cube: () => ({ cubeEffect: { shadow: false, slideShadows: false } }),
    fade: () => ({ fadeEffect: { crossFade: true }, speed: 200 }),
    default: () => ({ spaceBetween: 20, slidesPerView: 1 })
};

export function getEffectOptions(effect, pluginConfig) {
    const configFn = EFFECT_CONFIGS[effect] || EFFECT_CONFIGS.default;
    return configFn(pluginConfig.effectDepth);
}

/**
 * Generates the HTML string for a single slide
 */
const getSlideTemplate = (img, contextInfo, isEager = false) => {
    const fullSrc = img.paths.image;
    const isGallery = img.url && !contextInfo?.isSingleGallery;
    const loading = isEager ? 'eager' : 'lazy';
    const title = img.title || 'Untitled';

    if (isGallery) {
        return `
            <div class="swiper-zoom-container" data-type="gallery" data-url="${img.url}">
                <div class="gallery-cover-container">
                    <div class="gallery-cover-title" title="${title}">${title}</div>
                    <a href="${img.url}" target="_blank" class="gallery-cover-link">
                        <img src="${fullSrc}" alt="${title}" decoding="async" loading="${loading}" />
                    </a>
                </div>
            </div>`;
    }

    return `
        <div class="swiper-zoom-container" data-type="image">
            <img src="${fullSrc}" alt="${title}" decoding="async" loading="${loading}" 
                 style="max-width: 100%; height: auto; display: block; margin: 0 auto;" />
        </div>`;
};

export function initSwiper(container, images, pluginConfig, updateUICallback, savePositionCallback, contextInfo) {
    const swiperEl = container.querySelector('.swiper');
    if (!swiperEl || swiperEl.swiper) return swiperEl?.swiper; // Prevent double init

const isLooped = false;
const effectOptions = getEffectOptions(pluginConfig.transitionEffect, pluginConfig);

const swiperConfig = {
    // Core Layout
    effect: pluginConfig.transitionEffect,
    centeredSlides: true,
    slidesPerView: 1,
    initialSlide: 0,
    
    // Center Fixes
    centeredSlidesBounds: true, // Keeps slides from having gaps at the edges
    centerInsufficientSlides: true,
    
    // Loop + Virtual Stability
    loop: isLooped,
    loopedSlides: 2, // Tells Swiper how many slides to "fake" for the loop
    loopPreventsSliding: false, 
    
    virtual: {
        slides: images.map(img => getSlideTemplate(img, contextInfo, false)),
        cache: true,
        // Increase these to ensure the "next" slide is already in the DOM 
        // before the button click finishes the transition
        addSlidesBefore: 3,
        addSlidesAfter: 3,
        renderSlide: (slideContent, index) => {
            return `<div class="swiper-slide" data-index="${index}">${slideContent || ''}</div>`;
        }
    },
        ...effectOptions,
        on: {
            click(s, event) {
                const zoomContainer = event.target.closest('.swiper-zoom-container[data-type="gallery"]');
                if (zoomContainer?.dataset.url) {
                    window.open(zoomContainer.dataset.url, '_blank');
                }
            },
            slideChange() {
                updateUICallback?.(container);
                savePositionCallback?.();
            },
            // Handle infinite loading/pagination logic
            slideChangeTransitionEnd() {
                const total = this.virtual?.slides?.length || this.slides.length;
                if (total > 0 && this.activeIndex >= total - 3) {
                    const nextBtn = document.querySelector('[data-action="next-chunk"]');
                    if (nextBtn && !nextBtn.disabled) {
                        nextBtn.click();
                    }
                }
            }
        }
    };

    // Initialize
    const swiper = new Swiper(swiperEl, swiperConfig);
    
    // UI Cleanup
    const loader = container.querySelector('.image-deck-loading');
    if (loader) loader.style.display = 'none';

    return swiper;
}