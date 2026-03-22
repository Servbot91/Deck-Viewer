import { getPluginConfig, injectDynamicStyles, PLUGIN_NAME } from './config.js';
import { detectContext, fetchContextImages, getVisibleImages, getVisibleGalleryCovers } from './context.js';
import { fetchImageMetadata, updateImageMetadata, updateImageTags, searchTags } from './graphql.js';
import { initSwiper } from './swiper.js';
import { initParticles, stopParticles } from './particles.js';
import { isMobile, preloadImage, clearImageCache } from './utils.js';

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

// Export initialize function for main.js
export function initialize() {
    console.log('[Image Deck] Initializing...');

    // Wait for Swiper to load
    if (typeof Swiper === 'undefined') {
        console.error('[Image Deck] Swiper not loaded!');
        return;
    }

    // Create launch button on relevant pages
    retryCreateButton();

    // Watch for DOM changes to detect when React renders new content
    let debounceTimer;
    const observer = new MutationObserver((mutations) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            // Check if button exists and we're still on a valid page
            const hasButton = document.querySelector('.image-deck-launch-btn');
            const shouldHaveButton = detectContext() || 
                                   document.querySelectorAll('img[src*="/image/"]').length > 0 ||
                                   document.querySelectorAll('.gallery-cover img, .gallery-card img').length > 0;

            if (!hasButton && shouldHaveButton) {
                createLaunchButton();
            }
        }, 300);
    });

    // Observe the main content area for changes
    const mainContent = document.querySelector('.main-content') ||
                      document.querySelector('[role="main"]') ||
                      document.body;

    observer.observe(mainContent, {
        childList: true,
        subtree: true // Watch subtree to catch React updates
    });

    console.log('[Image Deck] Initialized');
}

// Create launch button
export function createLaunchButton() {
    console.log('[Image Deck] Creating launch button...');
    
    // Check if we're on a relevant page
    const context = detectContext();
    const hasImages = document.querySelectorAll('img[src*="/image/"]').length > 0;
    const hasGalleryCovers = document.querySelectorAll('.gallery-cover img, .gallery-card img').length > 0;
    
    console.log('[Image Deck] Context detection result:', context);
    console.log('[Image Deck] Has images:', hasImages);
    console.log('[Image Deck] Has gallery covers:', hasGalleryCovers);
    
    if (!context && !hasImages && !hasGalleryCovers) {
        console.log('[Image Deck] Not on relevant page, removing button if exists');
        // If not on relevant page, remove any existing button
        const existing = document.querySelector('.image-deck-launch-btn');
        if (existing) existing.remove();
        return;
    }

    // Remove any existing button
    const existing = document.querySelector('.image-deck-launch-btn');
    if (existing) {
        console.log('[Image Deck] Removing existing button');
        existing.remove();
    }

    const button = document.createElement('button');
    button.className = 'image-deck-launch-btn';
    button.innerHTML = '🎴';
    button.title = 'Open Image Deck';
    button.addEventListener('click', function(e) {
        console.log('[Image Deck] Launch button clicked!');
        openDeck();
    });

    document.body.appendChild(button);
    console.log('[Image Deck] Launch button created successfully');
}

// Function to clean up the button when navigating away
export function cleanupButton() {
    const existing = document.querySelector('.image-deck-launch-btn');
    if (existing) existing.remove();
}

// Retry creating launch button with exponential backoff
export function retryCreateButton(attempts = 0, maxAttempts = 5) {
    const delays = [100, 300, 500, 1000, 2000];

    if (attempts >= maxAttempts) {
        console.log('[Image Deck] Max retry attempts reached');
        return;
    }

    const hasContext = detectContext();
    const hasImages = document.querySelectorAll('img[src*="/image/"]').length > 0;
    const hasGalleryCovers = document.querySelectorAll('.gallery-cover img, .gallery-card img').length > 0;

    if (hasContext || hasImages || hasGalleryCovers) {
        createLaunchButton();
    } else if (attempts < maxAttempts - 1) {
        setTimeout(() => retryCreateButton(attempts + 1, maxAttempts), delays[attempts]);
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
        <canvas class="image-deck-particles"></canvas>
        <div class="image-deck-ambient"></div>
        <div class="image-deck-strobe"></div>
        <div class="image-deck-topbar">
            <div class="image-deck-counter"></div>
            <div class="image-deck-topbar-btns">
                <button class="image-deck-fullscreen" title="Toggle Fullscreen">⛶</button>
                <button class="image-deck-strobe-btn" title="Toggle Strobe">⚡</button>
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

    // Initialize particles
    initParticles(container.querySelector('.image-deck-particles'), pluginConfig);

    return container;
}

// Strobe effect
let strobeInterval = null;
let isStrobing = false;

function toggleStrobe() {
    isStrobing = !isStrobing;
    const strobeEl = document.querySelector('.image-deck-strobe');
    const strobeBtn = document.querySelector('.image-deck-strobe-btn');

    if (isStrobing) {
        strobeBtn.classList.add('active');
        const intensity = pluginConfig.strobeIntensity / 100;

        strobeInterval = setInterval(() => {
            if (strobeEl) {
                strobeEl.style.opacity = intensity;
                setTimeout(() => {
                    strobeEl.style.opacity = '0';
                }, 50);
            }
        }, pluginConfig.strobeSpeed);
    } else {
        strobeBtn.classList.remove('active');
        if (strobeInterval) {
            clearInterval(strobeInterval);
            strobeInterval = null;
        }
        if (strobeEl) strobeEl.style.opacity = '0';
    }
}

function stopStrobe() {
    isStrobing = false;
    if (strobeInterval) {
        clearInterval(strobeInterval);
        strobeInterval = null;
    }
}

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

// Metadata modal functionality
let currentMetadata = null;

async function openMetadataModal() {
    if (!currentSwiper) return;

    const currentIndex = currentSwiper.activeIndex;
    const currentImage = currentImages[currentIndex];

    if (!currentImage || !currentImage.id) return;

    const modal = document.querySelector('.image-deck-metadata-modal');
    const body = document.querySelector('.image-deck-metadata-body');

    if (!modal || !body) return;

    // Show loading state
    body.innerHTML = '<div class="metadata-loading">Loading...</div>';
    modal.classList.add('active');

    // Fetch detailed metadata
    currentMetadata = await fetchImageMetadata(currentImage.id);

    if (!currentMetadata) {
        body.innerHTML = '<div class="metadata-error">Failed to load metadata</div>';
        return;
    }

    // Populate modal
    populateMetadataModal(currentMetadata);
}

function closeMetadataModal() {
    const modal = document.querySelector('.image-deck-metadata-modal');
    if (modal) {
        modal.classList.remove('active');
    }
    currentMetadata = null;
}

function populateMetadataModal(metadata) {
    const body = document.querySelector('.image-deck-metadata-body');
    if (!body) return;

    const rating = metadata.rating100 ? metadata.rating100 / 20 : 0; // Convert to 5-star scale
    const filename = metadata.files && metadata.files.length > 0 ? metadata.files[0].basename : 'Unknown';

    body.innerHTML = `
        <div class="metadata-section metadata-file-info">
            <div class="metadata-filename" title="${filename}">${filename}</div>
            <a href="/images/${metadata.id}" target="_blank" class="metadata-link" title="Open image page in new tab">
                View in Stash →
            </a>
        </div>

        <div class="metadata-section">
            <label>Rating</label>
            <div class="metadata-rating">
                ${[1, 2, 3, 4, 5].map(star =>
                    `<button class="metadata-star ${star <= rating ? 'active' : ''}" data-rating="${star}">★</button>`
                ).join('')}
            </div>
        </div>

        <div class="metadata-section">
            <label>Title</label>
            <input type="text" class="metadata-title" value="${metadata.title || ''}" placeholder="Enter title...">
        </div>

        <div class="metadata-section">
            <label>Details</label>
            <textarea class="metadata-details" placeholder="Enter details...">${metadata.details || ''}</textarea>
        </div>

        <div class="metadata-section">
            <label>Tags</label>
            <div class="metadata-tags">
                ${metadata.tags.map(tag =>
                    `<span class="metadata-tag" data-tag-id="${tag.id}">
                        ${tag.name}
                        <button class="metadata-tag-remove" data-tag-id="${tag.id}">×</button>
                    </span>`
                ).join('')}
            </div>
            <input type="text" class="metadata-tag-search" placeholder="Search tags...">
            <div class="metadata-tag-results"></div>
        </div>

        <div class="metadata-section">
            <label>Info</label>
            <div class="metadata-info">
                ${metadata.performers.length > 0 ? `<div><strong>Performers:</strong> ${metadata.performers.map(p => p.name).join(', ')}</div>` : ''}
                ${metadata.studio ? `<div><strong>Studio:</strong> ${metadata.studio.name}</div>` : ''}
                ${metadata.date ? `<div><strong>Date:</strong> ${metadata.date}</div>` : ''}
                ${metadata.photographer ? `<div><strong>Photographer:</strong> ${metadata.photographer}</div>` : ''}
                <div><strong>Views:</strong> ${metadata.o_counter || 0}</div>
            </div>
        </div>

        <div class="metadata-actions">
            <button class="metadata-save-btn">Save Changes</button>
            <button class="metadata-organized-btn ${metadata.organized ? 'active' : ''}">
                ${metadata.organized ? 'Organized ✓' : 'Mark Organized'}
            </button>
        </div>
    `;

    // Setup event handlers for the modal
    setupMetadataHandlers(metadata);
}

function setupMetadataHandlers(metadata) {
    const body = document.querySelector('.image-deck-metadata-body');

    // Rating stars
    body.querySelectorAll('.metadata-star').forEach(star => {
        star.addEventListener('click', (e) => {
            const rating = parseInt(e.target.dataset.rating);
            body.querySelectorAll('.metadata-star').forEach((s, i) => {
                s.classList.toggle('active', i < rating);
            });
        });
    });

    // Tag removal
    body.querySelectorAll('.metadata-tag-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tagId = e.target.dataset.tagId;
            const tagEl = e.target.closest('.metadata-tag');
            if (tagEl) tagEl.remove();
        });
    });

    // Tag search
    const tagSearch = body.querySelector('.metadata-tag-search');
    const tagResults = body.querySelector('.metadata-tag-results');
    let searchTimeout;

    tagSearch.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();

        if (query.length < 2) {
            tagResults.innerHTML = '';
            return;
        }

        searchTimeout = setTimeout(async () => {
            const tags = await searchTags(query);
            tagResults.innerHTML = tags.map(tag =>
                `<div class="metadata-tag-result" data-tag-id="${tag.id}" data-tag-name="${tag.name}">
                    ${tag.name}
                </div>`
            ).join('');

            // Add click handlers for results
            tagResults.querySelectorAll('.metadata-tag-result').forEach(result => {
                result.addEventListener('click', (e) => {
                    const tagId = e.target.dataset.tagId;
                    const tagName = e.target.dataset.tagName;

                    // Add tag to list
                    const tagsContainer = body.querySelector('.metadata-tags');
                    const tagHtml = `<span class="metadata-tag" data-tag-id="${tagId}">
                        ${tagName}
                        <button class="metadata-tag-remove" data-tag-id="${tagId}">×</button>
                    </span>`;
                    tagsContainer.insertAdjacentHTML('beforeend', tagHtml);

                    // Setup remove handler for new tag
                    const newTag = tagsContainer.lastElementChild;
                    newTag.querySelector('.metadata-tag-remove').addEventListener('click', (e) => {
                        e.target.closest('.metadata-tag').remove();
                    });

                    // Clear search
                    tagSearch.value = '';
                    tagResults.innerHTML = '';
                });
            });
        }, 300);
    });

    // Save button
    const saveBtn = body.querySelector('.metadata-save-btn');
    saveBtn.addEventListener('click', async () => {
        const title = body.querySelector('.metadata-title').value;
        const details = body.querySelector('.metadata-details').value;
        const activeStar = body.querySelectorAll('.metadata-star.active').length;
        const rating100 = activeStar * 20;

        // Get current tag IDs
        const tagIds = Array.from(body.querySelectorAll('.metadata-tag')).map(tag =>
            tag.dataset.tagId
        );

        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;

        // Update metadata
        await updateImageMetadata(metadata.id, { title, details, rating100 });
        await updateImageTags(metadata.id, tagIds);

        saveBtn.textContent = 'Saved ✓';
        setTimeout(() => {
            saveBtn.textContent = 'Save Changes';
            saveBtn.disabled = false;
        }, 2000);
    });

    // Organized toggle
    const organizedBtn = body.querySelector('.metadata-organized-btn');
    organizedBtn.addEventListener('click', async () => {
        const isOrganized = organizedBtn.classList.contains('active');
        const newOrganized = !isOrganized;

        await updateImageMetadata(metadata.id, { organized: newOrganized });

        organizedBtn.classList.toggle('active', newOrganized);
        organizedBtn.textContent = newOrganized ? 'Organized ✓' : 'Mark Organized';
    });
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
    if (!currentSwiper) return;
    
    const currentIndex = currentSwiper.activeIndex;
    const totalCurrentSlides = currentImages.length;
    
    // If we're within 5 slides of the end, try to load next chunk
    if (currentIndex >= totalCurrentSlides - 5 && currentChunkPage < totalPages) {
        const nextChunkBtn = document.querySelector('[data-action="next-chunk"]');
        if (nextChunkBtn && !nextChunkBtn.disabled) {
            console.log('[Image Deck] Approaching end, preloading next chunk...');
            setTimeout(() => {
                if (nextChunkBtn) nextChunkBtn.click();
            }, 500);
        }
    }
}

// Auto-play controls
function startAutoPlay() {
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

function stopAutoPlay() {
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

function debugPageElements() {
    console.log('[Image Deck] === PAGE DEBUG INFO ===');
    console.log('Current URL:', window.location.href);
    console.log('Document title:', document.title);
    
    // Find all images
    const allImages = document.querySelectorAll('img');
    console.log('Total images on page:', allImages.length);
    
    // Find images that might be gallery covers
    const galleryImages = Array.from(allImages).filter(img => 
        img.src && (img.src.includes('/image/') || img.src.includes('/thumbnail/'))
    );
    console.log('Potential gallery images:', galleryImages.length);
    
    // Find links to galleries
    const galleryLinks = document.querySelectorAll('a[href*="/galleries/"]');
    console.log('Gallery links found:', galleryLinks.length);
    galleryLinks.forEach((link, i) => {
        console.log(`  Link ${i}:`, link.href, 'Text:', link.textContent);
    });
    
    // Find potential gallery containers
    const potentialContainers = document.querySelectorAll('[class*="gallery"], [class*="card"], [data-target="thumbnail"]');
    console.log('Potential containers:', potentialContainers.length);
    
    console.log('[Image Deck] === END DEBUG INFO ===');
}

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

        // Get context - STORE IT IN MODULE SCOPE
        const detectedContext = detectContext();
        storedContextInfo = detectedContext;
        contextInfo = detectedContext;

        console.log('[Image Deck] Context detected:', storedContextInfo);
        
        // Enhanced manual context creation for single galleries
        if ((!detectedContext || detectedContext.isGalleryListing) && window.location.pathname.startsWith('/galleries')) {
            const galleryIdMatch = window.location.pathname.match(/^\/galleries\/(\d+)/);
            if (galleryIdMatch) {
                const manualContext = {
                    type: 'galleries',
                    id: galleryIdMatch[1],
                    isSingleGallery: true
                };
                storedContextInfo = manualContext;
                contextInfo = manualContext;
                console.log('[Image Deck] Manual context override created:', manualContext);
            }
        }
        
        
        // Determine what content to show
        let imageResult;
        if (storedContextInfo) {
            console.log('[Image Deck] Using context-based fetching');
            imageResult = await fetchContextImages(storedContextInfo, 1, chunkSize);
        } else if (window.location.pathname.startsWith('/galleries')) {
            console.log('[Image Deck] Checking gallery page type');
            // Check if we're on a single gallery page
            const galleryIdMatch = window.location.pathname.match(/^\/galleries\/(\d+)/);
            if (galleryIdMatch) {
                console.log('[Image Deck] Single gallery page detected');
                // We're on a single gallery page, fetch images from this gallery
                const galleryContext = {
                    type: 'galleries',
                    id: galleryIdMatch[1],
                    isSingleGallery: true
                };
                imageResult = await fetchContextImages(galleryContext, 1, chunkSize);
            } else {
                console.log('[Image Deck] Gallery listing page detected');
                // On galleries listing page, get visible gallery covers
                imageResult = getVisibleGalleryCovers();
            }
        } else {
            console.log('[Image Deck] Falling back to visible images');
            // Default to visible images
            imageResult = getVisibleImages();
        }
        
        // Handle both return formats
        if (Array.isArray(imageResult)) {
            currentImages = imageResult;
            totalImageCount = imageResult.length;
            totalPages = 1;
        } else {
            currentImages = imageResult.images;
            totalImageCount = imageResult.totalCount;
            totalPages = imageResult.totalPages;
            currentChunkPage = imageResult.currentPage;
        }

		if (currentImages.length === 0) {
			console.warn('[Image Deck] No images found');
			
			// Provide more helpful error message
			let errorMessage = 'No images found to display in Image Deck.\n\n';
			
			if (storedContextInfo && storedContextInfo.isGalleryListing) {
				errorMessage += 'This appears to be a gallery listing page. ';
				errorMessage += 'Make sure you are on a page with visible gallery covers, ';
				errorMessage += 'or navigate to a specific gallery to view its images.';
			} else if (storedContextInfo && storedContextInfo.isSingleGallery) {
				errorMessage += 'This appears to be a single gallery page, but no images were found. ';
				errorMessage += 'The gallery might be empty or there might be a loading issue.';
			} else {
				errorMessage += 'No compatible content found on this page.';
			}
			
			alert(errorMessage);
			return;
		}
        console.log(`[Image Deck] Opening with ${currentImages.length} images (chunk 1 of ${totalPages || 1})`);

        // Create UI
        const container = createDeckUI();
        document.body.classList.add('image-deck-open');

        // Animate in with GPU acceleration
        requestAnimationFrame(() => {
            container.classList.add('active');
        });

        // Initialize Swiper
        currentSwiper = initSwiper(container, currentImages, pluginConfig, updateUI, savePosition, contextInfo);
        
        // Restore position
        restorePosition();

        // Initial UI update
        updateUI(container);

        // Setup event handlers
        setupEventHandlers(container);
        
    } catch (error) {
        console.error('[Image Deck] Error opening deck:', error);
        alert('Error opening Image Deck: ' + error.message);
    }
}

// Load next chunk of images
async function loadNextChunk() {
    console.log('[Image Deck] Attempting to load next chunk');
    
    // Always use the stored context info as primary source
    const contextToUse = storedContextInfo || contextInfo || detectContext();
    
    if (!contextToUse) {
        console.log('[Image Deck] No context info available');
        // Try to detect context again as fallback
        const freshContext = detectContext();
        if (!freshContext) {
            console.log('[Image Deck] Could not detect context');
            const loadingIndicator = document.querySelector('.image-deck-loading');
            if (loadingIndicator) {
                loadingIndicator.textContent = 'Cannot detect context';
                setTimeout(() => {
                    loadingIndicator.style.display = 'none';
                }, 2000);
            }
            return;
        }
        storedContextInfo = freshContext; // Store the fresh context
        contextInfo = freshContext;
    }

    console.log('[Image Deck] Loading chunk', (currentChunkPage + 1), 'with context:', contextToUse);
    
    const loadingIndicator = document.querySelector('.image-deck-loading');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
        loadingIndicator.textContent = 'Loading next chunk...';
        // Add visual feedback that loading started
        loadingIndicator.style.backgroundColor = 'rgba(100, 100, 255, 0.3)';
        loadingIndicator.style.color = 'white';
        loadingIndicator.style.fontWeight = 'bold';
    }

    // Also provide immediate visual feedback on the next-chunk button
    const nextChunkButton = document.querySelector('[data-action="next-chunk"]');
    if (nextChunkButton) {
        nextChunkButton.innerHTML = '🔄'; // Show loading spinner
        nextChunkButton.disabled = true;
        nextChunkButton.style.opacity = '0.5';
    }

    try {
        const nextPage = currentChunkPage + 1;
        console.log('[Image Deck] Fetching page', nextPage, 'with chunk size', chunkSize);
        
        const result = await fetchContextImages(contextToUse, nextPage, chunkSize);
        
        console.log('[Image Deck] Fetched chunk result:', result);
        
        // Check if there are more images to load
        if (!result || !result.images || result.images.length === 0) {
            console.log('[Image Deck] No more images to load (empty result)');
            if (loadingIndicator) {
                loadingIndicator.textContent = 'No more images to load';
                loadingIndicator.style.backgroundColor = 'rgba(255, 100, 100, 0.3)'; // Red for error/info
                setTimeout(() => {
                    loadingIndicator.style.display = 'none';
                }, 2000);
            }
            return;
        }
        
        // Add new images to currentImages array
        const oldLength = currentImages.length;
        currentImages.push(...result.images);
        totalImageCount = result.totalCount || totalImageCount;
        totalPages = result.totalPages || totalPages;
        currentChunkPage = nextPage; // Update the current page
        
        console.log(`[Image Deck] Added ${result.images.length} new images, total: ${currentImages.length}`);
        
        // Update swiper with new images - SPECIFICALLY FOR VIRTUAL SLIDES
        if (currentSwiper && currentSwiper.virtual && result.images.length > 0) {
            // Create new slide HTML for virtual swiper
            const newSlides = result.images.map(img => {
                const fullSrc = img.paths.image;
                // Make sure the image has proper styling
                return `<div class="swiper-zoom-container"><img src="${fullSrc}" alt="${img.title || ''}" decoding="async" loading="lazy" style="max-width: 100%; height: auto; display: block; margin: 0 auto;" /></div>`;
            });
            
            // Add new slides to virtual swiper
            currentSwiper.virtual.slides.push(...newSlides);
            
            // Force update virtual swiper
            currentSwiper.virtual.update(true); // Force update
            
            console.log(`[Image Deck] Added ${newSlides.length} virtual slides`);
        }
        
        // Update UI
        const container = document.querySelector('.image-deck-container');
        if (container) {
            updateUI(container);
        }
        
        // Success feedback
        if (loadingIndicator) {
            loadingIndicator.textContent = `✓ Loaded ${result.images.length} images (chunk ${nextPage})`;
            loadingIndicator.style.backgroundColor = 'rgba(100, 255, 100, 0.3)'; // Green for success
            // Auto-hide after 2 seconds
            setTimeout(() => {
                loadingIndicator.style.display = 'none';
            }, 2000);
        }
        
        console.log(`[Image Deck] Successfully loaded chunk ${nextPage}, total images: ${currentImages.length}`);
        
    } catch (error) {
        console.error('[Image Deck] Error loading next chunk:', error);
        const loadingIndicator = document.querySelector('.image-deck-loading');
        if (loadingIndicator) {
            loadingIndicator.textContent = 'Error loading chunk: ' + (error.message || 'Unknown error');
            loadingIndicator.style.backgroundColor = 'rgba(255, 100, 100, 0.3)'; // Red for error
            setTimeout(() => {
                loadingIndicator.style.display = 'none';
            }, 3000);
        }
    } finally {
        // Re-enable the next-chunk button
        const nextChunkButton = document.querySelector('[data-action="next-chunk"]');
        if (nextChunkButton) {
            nextChunkButton.innerHTML = '⏭️'; // Restore original icon
            nextChunkButton.disabled = false;
            nextChunkButton.style.opacity = '1';
        }
        
        // Ensure loading indicator hides even if there was an error
        const loadingIndicator = document.querySelector('.image-deck-loading');
        if (loadingIndicator) {
            setTimeout(() => {
                if (loadingIndicator.style.display !== 'none') {
                    loadingIndicator.style.display = 'none';
                }
            }, 3000);
        }
    }
}


// Close the deck
export function closeDeck() {
    stopAutoPlay();
    stopParticles();
    stopStrobe();

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

// Setup event handlers
function setupEventHandlers(container) {
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

    // Strobe button
    const strobeBtn = container.querySelector('.image-deck-strobe-btn');
    if (strobeBtn) {
        strobeBtn.addEventListener('click', toggleStrobe);
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
                    if (currentSwiper) {
                        currentSwiper.slidePrev();
                    } else {
                        console.log('[Image Deck] No swiper instance found');
                    }
                    break;
                case 'next':
                    console.log('[Image Deck] Next button clicked');
                    if (currentSwiper) {
                        currentSwiper.slideNext();
                        // Check if we need to load next chunk
                        setTimeout(checkAndLoadNextChunk, 100);
                    } else {
                        console.log('[Image Deck] No swiper instance found');
                    }
                    break;
                case 'play':
                    console.log('[Image Deck] Play button clicked');
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
    if (!currentSwiper) return;

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
