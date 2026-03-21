import { getPluginConfig, injectDynamicStyles, PLUGIN_NAME } from './config.js';
import { detectContext, fetchContextImages, getVisibleImages } from './context.js';
import { fetchImageMetadata, updateImageMetadata, updateImageTags, searchTags } from './graphql.js';
import { initSwiper } from './swiper.js';
import { initParticles, stopParticles } from './particles.js';
import { isMobile, preloadImage } from './utils.js';

let pluginConfig = null;
let currentSwiper = null;
let currentImages = [];
let autoPlayInterval = null;
let isAutoPlaying = false;
let contextInfo = null;
let imageCache = new Map();
let loadingQueue = [];

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
            const shouldHaveButton = detectContext() || document.querySelectorAll('img[src*="/image/"]').length > 0;

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

// Detect mobile device
export const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     window.innerWidth < 768 ||
                     ('ontouchstart' in window);

// Create launch button
export function createLaunchButton() {
    // Check if we're on a relevant page
    if (!detectContext() && document.querySelectorAll('img[src*="/image/"]').length === 0) {
        return;
    }

    // Remove any existing button
    const existing = document.querySelector('.image-deck-launch-btn');
    if (existing) existing.remove();

    const button = document.createElement('button');
    button.className = 'image-deck-launch-btn';
    button.innerHTML = '🎴';
    button.title = 'Open Image Deck';
    button.addEventListener('click', openDeck);

    document.body.appendChild(button);
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

    if (hasContext || hasImages) {
        createLaunchButton();
    } else if (attempts < maxAttempts - 1) {
        setTimeout(() => retryCreateButton(attempts + 1, maxAttempts), delays[attempts]);
    }
}

// Optimized image preloader
export function preloadImage(src, priority = false) {
    if (imageCache.has(src)) {
        return Promise.resolve(imageCache.get(src));
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = 'async';
        img.loading = priority ? 'eager' : 'lazy';

        img.onload = () => {
            imageCache.set(src, img);
            resolve(img);
        };
        img.onerror = reject;
        img.src = src;
    });
}

// Upgrade slide image to full resolution
function upgradeImageToFull(slide) {
    if (!slide) return;

    const img = slide.querySelector('img');
    if (!img) return;

    const fullSrc = img.dataset.fullSrc;
    if (!fullSrc || img.src === fullSrc) return;

    // Load full resolution
    preloadImage(fullSrc, true).then(() => {
        img.src = fullSrc;
    }).catch(err => {
        console.warn('[Image Deck] Failed to load full resolution:', err);
    });
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
    initParticles(container.querySelector('.image-deck-particles'));

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
        const current = currentSwiper.activeIndex + 1;
        const total = currentSwiper.slides.length || currentImages.length;

        // Update counter
        if (pluginConfig.showCounter) {
            const counter = container.querySelector('.image-deck-counter');
            if (counter && counter.textContent !== `${current} of ${total}`) {
                counter.textContent = `${current} of ${total}`;
            }
        }

        // Update progress bar
        if (pluginConfig.showProgressBar) {
            const progress = container.querySelector('.image-deck-progress');
            if (progress) {
                progress.style.transform = `scaleX(${current / total})`;
            }
        }

        uiUpdatePending = false;
    });
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

// Open the image deck
export async function openDeck() {
    // Load config
    pluginConfig = await getPluginConfig();

    // Inject dynamic styles
    injectDynamicStyles(pluginConfig);

    // Get context
    contextInfo = detectContext();
    if (!contextInfo && document.querySelectorAll('img[src*="/image/"]').length === 0) {
        console.warn('[Image Deck] No image context detected');
        return;
    }

    // Fetch images
    currentImages = contextInfo ? await fetchContextImages(contextInfo) : getVisibleImages();

    if (currentImages.length === 0) {
        console.warn('[Image Deck] No images found');
        return;
    }

    console.log(`[Image Deck] Opening with ${currentImages.length} images`);

    // Clear image cache if it's getting too large
    if (imageCache.size > 100) {
        imageCache.clear();
    }

    // Create UI
    const container = createDeckUI();
    document.body.classList.add('image-deck-open');

    // Animate in with GPU acceleration
    requestAnimationFrame(() => {
        container.classList.add('active');
    });

    // Initialize Swiper
    initSwiper(container, currentImages);

    // Restore position
    restorePosition();

    // Initial UI update
    updateUI(container);

    // Setup event handlers
    setupEventHandlers(container);
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
    container.querySelector('.image-deck-close').addEventListener('click', closeDeck);

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

    // Control buttons
    container.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (!action) return;

        switch(action) {
            case 'prev':
                currentSwiper?.slidePrev();
                break;
            case 'next':
                currentSwiper?.slideNext();
                break;
            case 'play':
                if (isAutoPlaying) {
                    stopAutoPlay();
                } else {
                    startAutoPlay();
                }
                break;
            case 'info':
                openMetadataModal();
                break;
        }
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
