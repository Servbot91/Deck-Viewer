import { getPluginConfig, injectDynamicStyles, PLUGIN_NAME } from './config.js';
import { detectContext, fetchContextImages, getVisibleImages, getVisibleGalleryCovers } from './context.js';
import { initSwiper } from './swiper.js';
import { isMobile } from './utils.js';

let pluginConfig = null;
let currentSwiper = null;
let currentImages = [];
let autoPlayInterval = null;
let isAutoPlaying = false;
let contextInfo = null;
let loadingQueue = [];
let currentChunkPage = 1;
let chunkSize = 50;
let totalImageCount = 0;
let totalPages = 0;
let storedContextInfo = null;

export async function openDeck() {
    console.log('[Image Deck] Opening deck...');
    console.log('[Image Deck] Current URL:', window.location.pathname);
    
    try {
        // Reset chunk tracking
        currentChunkPage = 1;
        chunkSize = 50;
        totalImageCount = 0;
        totalPages = 0;

        // Load config
        pluginConfig = await getPluginConfig();
        console.log('[Image Deck] Plugin config loaded:', pluginConfig);

        // Inject dynamic styles
        injectDynamicStyles(pluginConfig);

        // 1. Context Detection Logic
let detectedContext = detectContext();

// If we are on a gallery listing page, ensure detectContext 
// has correctly identified it. If not, we force the refresh here.
if (window.location.pathname === '/galleries' && !detectedContext?.isGalleryListing) {
    detectedContext = {
        type: 'galleries',
        isGalleryListing: true,
        filter: parseUrlFilters(window.location.search) // This is the crucial part
    };
}

storedContextInfo = detectedContext;
contextInfo = detectedContext;
console.log('[Image Deck] Context assigned:', contextInfo);

// 2. Determine what content to show
let imageResult;

// Ensure this check includes your gallery listing
const isListContext = contextInfo && (
    contextInfo.isSingleGallery || 
    contextInfo.isGalleryListing || 
    contextInfo.type === 'images' || 
    contextInfo.isFilteredView ||
    window.location.pathname.startsWith('/images') // Added this
);

        if (isListContext) {
            console.log('[Image Deck] Using context-based fetching for page 1');
            imageResult = await fetchContextImages(contextInfo, 1, chunkSize);
        } else {
            console.log('[Image Deck] Falling back to visible images');
            imageResult = getVisibleImages();
        }
        
        // 3. Handle data results
        if (Array.isArray(imageResult)) {
            // This path is for getVisibleImages() (the 20 items on screen)
            currentImages = imageResult;
            totalImageCount = imageResult.length;
            totalPages = 1;
            currentChunkPage = 1;
        } else if (imageResult) {
            // This path is for fetchContextImages() (Full database results)
            currentImages = imageResult.images || [];
            totalImageCount = imageResult.totalCount || 0;
            totalPages = imageResult.totalPages || 1;
            currentChunkPage = imageResult.currentPage || 1;
        }

        console.log(`[Image Deck] Opening with ${currentImages.length} items (chunk 1 of ${totalPages || 1})`);

        // 4. Create UI
        const container = createDeckUI();
        document.body.classList.add('image-deck-open');

        requestAnimationFrame(() => {
            container.classList.add('active');
        });

        // 5. Initialize Swiper 
        // We pass checkAndLoadNextChunk into the update callback so it checks on every slide change
        currentSwiper = initSwiper(
            container, 
            currentImages, 
            pluginConfig, 
            () => {
                updateUI(container);
                checkAndLoadNextChunk(); 
            }, 
            savePosition, 
            contextInfo
        );
        
        window.currentSwiperInstance = currentSwiper;
        
        // Restore position
        restorePosition();

        // Initial UI update
        updateUI(container);

        // Setup event handlers
        import('./controls.js').then(module => {
            module.setupEventHandlers(container);
        });
        
    } catch (error) {
        console.error('[Image Deck] Error opening deck:', error);
        alert('Error opening Image Deck: ' + error.message);
    }
}

// Create the image deck UI
function createDeckUI() {
    // Remove any existing deck
    const existing = document.querySelector('.image-deck-container');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.className = `image-deck-container${isMobile ? ' mobile-optimized' : ''}`;
    container.innerHTML = `
        <div class="image-deck-ambient"></div>
        <div class="image-deck-topbar">
            <div class="image-deck-counter"></div>
            <div class="image-deck-topbar-btns">
                <button class="image-deck-fullscreen" title="Toggle Fullscreen">⛶</button>
                <button class="image-deck-close">✕</button>
            </div>
        </div>
        <div class="image-deck-progress"></div>
        <div class="image-deck-loading"></div>
        <div class="image-deck-swiper swiper">
            <div class="swiper-wrapper"></div>
        </div>
        <div class="image-deck-controls">
            <button class="image-deck-control-btn" data-action="prev">◀</button>
            <button class="image-deck-control-btn" data-action="play">▶</button>
            <button class="image-deck-control-btn" data-action="next">▶</button>
            <button class="image-deck-control-btn image-deck-info-btn" data-action="info" title="Image Info (I)">ℹ</button>
            <button class="image-deck-control-btn" data-action="next-chunk" title="Load Next Chunk">⏭️</button>
        </div>
        <div class="image-deck-speed">Speed: ${pluginConfig.autoPlayInterval}ms</div>
        <div class="image-deck-metadata-modal">
            <div class="image-deck-metadata-content">
                <div class="image-deck-metadata-header">
                    <h3>Image Details</h3>
                    <button class="image-deck-metadata-close">✕</button>
                </div>
                <div class="image-deck-metadata-body"></div>
            </div>
        </div>
    `;

    document.body.appendChild(container);

    return container;
}

// Update UI elements - debounced to prevent flicker
	let uiUpdatePending = false;
function updateUI(container) {
    if (!currentSwiper || uiUpdatePending) return;

    uiUpdatePending = true;
    requestAnimationFrame(() => {
        let current = 1;
        const displayedTotal = currentImages.length;
        const actualTotal = totalImageCount || displayedTotal;

        // Handle virtual slides differently
        if (currentSwiper.virtual) {
            // For virtual slides, we track the active slide index
            current = currentSwiper.activeIndex + 1;
            //console.log('[Image Deck] Virtual mode - Active index:', currentSwiper.activeIndex, 'Total slides:', currentSwiper.virtual.slides.length);
        } else {
            // Handle looped galleries properly
            if (currentSwiper.params.loop && contextInfo?.isSingleGallery) {
                // For looped galleries, get the real index
                const realIndex = currentSwiper.realIndex + 1;
                // Handle the case where we're at the cloned slides at the beginning/end
                if (realIndex === 0) {
                    current = displayedTotal; // Last slide
                } else if (realIndex > displayedTotal) {
                    current = 1; // First slide
                } else {
                    current = realIndex;
                }
            } else {
                current = currentSwiper.activeIndex + 1;
            }
        }

        // Update counter with chunk info
        if (pluginConfig.showCounter) {
            const counter = container.querySelector('.image-deck-counter');
            const chunkInfo = totalPages > 1 ? ` (chunk ${currentChunkPage}/${totalPages})` : '';
            if (counter) {
                counter.textContent = `${current} of ${actualTotal}${chunkInfo}`;
            }
        }

        // Update progress bar
        if (pluginConfig.showProgressBar) {
            const progress = container.querySelector('.image-deck-progress');
            if (progress) {
                const progressValue = actualTotal > 0 ? current / actualTotal : 0;
                progress.style.transform = `scaleX(${progressValue})`;
            }
        }

        uiUpdatePending = false;
    });
}

function checkAndLoadNextChunk() {
    if (!currentSwiper || isChunkLoading) return;
    
    const currentIndex = currentSwiper.activeIndex;
    const totalCurrentSlides = currentImages.length;
    
    // 1. Only trigger if we are in the last few slides
    // 2. Only trigger if there actually ARE more pages to fetch
    if (currentIndex >= totalCurrentSlides - 3 && currentChunkPage < totalPages) {
        console.log('[Image Deck] Auto-loading next chunk...');
        loadNextChunk(); 
    }
}

// Auto-play controls
export function startAutoPlay() {
    if (!currentSwiper || isAutoPlaying) return;

    isAutoPlaying = true;
    const playBtn = document.querySelector('[data-action="play"]');
    if (playBtn) {
        playBtn.innerHTML = '⏸';
        playBtn.classList.add('active');
    }

    autoPlayInterval = setInterval(() => {
        if (currentSwiper.isEnd) {
            stopAutoPlay();
        } else {
            currentSwiper.slideNext();
        }
    }, pluginConfig.autoPlayInterval);

    // Show speed indicator briefly
    const speedIndicator = document.querySelector('.image-deck-speed');
    if (speedIndicator) {
        speedIndicator.classList.add('visible');
        setTimeout(() => speedIndicator.classList.remove('visible'), 2000);
    }
}

export function stopAutoPlay() {
    if (!isAutoPlaying) return;

    isAutoPlaying = false;
    const playBtn = document.querySelector('[data-action="play"]');
    if (playBtn) {
        playBtn.innerHTML = '▶';
        playBtn.classList.remove('active');
    }

    if (autoPlayInterval) {
        clearInterval(autoPlayInterval);
        autoPlayInterval = null;
    }
}

// Save/restore position
function savePosition() {
    if (!currentSwiper || !contextInfo) return;
    const key = `${PLUGIN_NAME}_position_${contextInfo.type}_${contextInfo.id}`;
    sessionStorage.setItem(key, currentSwiper.activeIndex.toString());
}

function restorePosition() {
    if (!currentSwiper || !contextInfo) return;
    const key = `${PLUGIN_NAME}_position_${contextInfo.type}_${contextInfo.id}`;
    const savedPosition = sessionStorage.getItem(key);
    if (savedPosition) {
        const index = parseInt(savedPosition);
        if (!isNaN(index) && index < (currentSwiper.slides.length || currentImages.length)) {
            currentSwiper.slideTo(index, 0);
        }
    }
}

// Load next chunk of images
// Add this to your module-level variables at the top of the file
let isChunkLoading = false; 

export async function loadNextChunk() {
    // 1. Guard: Prevent multiple simultaneous loads
    if (isChunkLoading) {
        console.log('[Image Deck] Load already in progress, skipping...');
        return;
    }

    // 2. Guard: Check if we've reached the end
    if (currentChunkPage >= totalPages && totalPages !== 0) {
        console.log('[Image Deck] All chunks already loaded.');
        const loadingIndicator = document.querySelector('.image-deck-loading');
        if (loadingIndicator) {
            loadingIndicator.textContent = 'All items loaded';
            setTimeout(() => { loadingIndicator.style.display = 'none'; }, 2000);
        }
        return;
    }

    isChunkLoading = true;

    // UI Feedback
    const loadingIndicator = document.querySelector('.image-deck-loading');
    const nextChunkButton = document.querySelector('[data-action="next-chunk"]');
    
    if (nextChunkButton) {
        nextChunkButton.disabled = true;
        nextChunkButton.style.opacity = '0.5';
    }

    if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
        loadingIndicator.textContent = `Loading chunk ${currentChunkPage + 1}...`;
    }

    try {
        const contextToUse = storedContextInfo || contextInfo || detectContext();
        if (!contextToUse) throw new Error('Could not detect context for fetching');

        const nextPage = currentChunkPage + 1;
        const result = await fetchContextImages(contextToUse, nextPage, chunkSize);
        
        if (!result || !result.images || result.images.length === 0) {
            if (loadingIndicator) loadingIndicator.textContent = 'No more items found';
            setTimeout(() => { if (loadingIndicator) loadingIndicator.style.display = 'none'; }, 2000);
            return;
        }

        // 3. Update Data State
        currentImages.push(...result.images);
        currentChunkPage = nextPage;
        totalPages = result.totalPages || totalPages;

        // 4. Update UI (Swiper OR Gallery)
        if (currentSwiper && currentSwiper.virtual) {
            // Re-generate ALL slides to ensure formatting consistency across the whole deck
            const allSlides = currentImages.map(img => {
                const fullSrc = img.paths.image;
                const isGallery = img.url && !contextInfo?.isSingleGallery;
                
                if (isGallery) {
                    return `
                        <div class="swiper-zoom-container" data-type="gallery" data-url="${img.url}">
                            <div class="gallery-cover-container">
                                <div class="gallery-cover-title" title="${img.title || 'Untitled Gallery'}">${img.title || 'Untitled Gallery'}</div>
                                <a href="${img.url}" target="_blank" class="gallery-cover-link">
                                    <img src="${fullSrc}" alt="${img.title || ''}" decoding="async" loading="lazy" />
                                </a>
                            </div>
                        </div>`;
                } else {
                    return `
                        <div class="swiper-zoom-container" data-type="image">
                            <img src="${fullSrc}" alt="${img.title || ''}" decoding="async" loading="lazy" style="max-width: 100%; height: auto; display: block; margin: 0 auto;" />
                        </div>`;
                }
            });

            // Update Swiper Virtual Slides
            currentSwiper.virtual.slides = allSlides;
            currentSwiper.virtual.update(true);
            
            // Small timeout to let DOM settle, then force a layout refresh
            setTimeout(() => { if (currentSwiper) currentSwiper.update(); }, 100);

        } else {
            // Logic for Standard Gallery Grid (if not using Virtual/Swiper)
            const galleryGrid = document.querySelector('.gallery-grid');
            if (galleryGrid) {
                result.images.forEach(img => {
                    const imgHTML = `<div class="gallery-item"><img src="${img.paths.image}" alt="${img.title || ''}" class="gallery-img" /></div>`;
                    galleryGrid.insertAdjacentHTML('beforeend', imgHTML);
                });
            }
        }

        // 5. General UI Refresh (Context buttons, etc.)
        const container = document.querySelector('.image-deck-container');
        if (container && typeof updateUI === 'function') updateUI(container);

        // Success Feedback
        if (loadingIndicator) {
            loadingIndicator.textContent = `✓ Loaded ${result.images.length} new items`;
            setTimeout(() => { loadingIndicator.style.display = 'none'; }, 2000);
        }

    } catch (error) {
        console.error('[Image Deck] Failed to load chunk:', error);
        if (loadingIndicator) {
            loadingIndicator.textContent = 'Error: ' + error.message;
            setTimeout(() => { loadingIndicator.style.display = 'none'; }, 3000);
        }
    } finally {
        isChunkLoading = false;
        if (nextChunkButton) {
            nextChunkButton.disabled = false;
            nextChunkButton.style.opacity = '1';
        }
    }
}
// Close the deck
export function closeDeck() {
    stopAutoPlay();

    const container = document.querySelector('.image-deck-container');
    if (container) {
        container.classList.remove('active');
        setTimeout(() => {
            container.remove();
            document.body.classList.remove('image-deck-open');
        }, 300);
    }

    if (currentSwiper) {
        currentSwiper.destroy(true, true);
        currentSwiper = null;
    }

    currentImages = [];
    contextInfo = null;
    loadingQueue = [];
}