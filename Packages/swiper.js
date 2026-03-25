const GALLERY_ICON_SVG = '<svg fill="white" width="16" height="16" viewBox="0 0 36 36" style="vertical-align: middle;" xmlns="http://www.w3.org/2000/svg"><path d="M32,4H4A2,2,0,0,0,2,6V30a2,2,0,0,0,2,2H32a2,2,0,0,0,2-2V6A2,2,0,0,0,32,4ZM4,30V6H32V30Z"></path><path d="M8.92,14a3,3,0,1,0-3-3A3,3,0,0,0,8.92,14Zm0-4.6A1.6,1.6,0,1,1,7.33,11,1.6,1.6,0,0,1,8.92,9.41Z"></path><path d="M22.78,15.37l-5.4,5.4-4-4a1,1,0,0,0-1.41,0L5.92,22.9v2.83l6.79-6.79L16,22.18l-3.75,3.75H15l8.45-8.45L30,24V21.18l-5.81-5.81A1,1,0,0,0,22.78,15.37Z"></path></svg>';

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

const getSlideTemplate = (img, contextInfo, isEager = false) => {
    const fullSrc = img.paths.image;
    const isGallery = img.url && !contextInfo?.isSingleGallery;
    const loading = isEager ? 'eager' : 'lazy';
    const title = img.title || 'Untitled';

    if (isGallery) {
        // Create image count display with SVG icon
        const imageCountDisplay = img.image_count !== undefined ? 
            `${GALLERY_ICON_SVG}: ${img.image_count}` : '';
        
        // Create performer display
        let performerDisplay = '';
        if (img.performers && img.performers.length > 0) {
            const performerNames = img.performers.map(p => p.name).join(', ');
            performerDisplay = `<div class="gallery-performers" style="margin-top: 5px; font-size: 18px; color: #ccc;">${performerNames}</div>`;
        }
        
        return `
            <div class="swiper-zoom-container" data-type="gallery" data-url="${img.url}">
                <div class="gallery-cover-container">
                    <div class="gallery-cover-title" title="${title}">${title}</div>
                    ${imageCountDisplay ? `<div class="gallery-image-count" style="font-size: 18px; color: #ccc; margin-top: 3px;">${imageCountDisplay}</div>` : ''}
                    <a href="${img.url}" target="_blank" class="gallery-cover-link">
                        <img src="${fullSrc}" alt="${title}" decoding="async" loading="${loading}" />
                    </a>
                    ${performerDisplay}
                </div>
            </div>`;
    }

    // For regular images, wrap in zoom container
    return `
        <div class="swiper-zoom-container">
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
        
        // Zoom functionality
        zoom: {
            maxRatio: 3,
            minRatio: 1,
            toggle: true,
            containerClass: 'swiper-zoom-container',
            zoomedSlideClass: 'swiper-slide-zoomed'
        },
        
        // Center Fixes
        centeredSlidesBounds: true,
        centerInsufficientSlides: true,
        
        // Loop + Virtual Stability
        loop: isLooped,
        loopedSlides: 2,
        loopPreventsSliding: false,
        
        virtual: {
            slides: images.map(img => getSlideTemplate(img, contextInfo, false)),
            cache: true,
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