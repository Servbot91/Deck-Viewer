// ui/metadata.js
import { fetchImageMetadata, updateImageMetadata, updateImageTags, searchTags } from './graphql.js';

let currentMetadata = null;
let currentSwiperRef = null; // Reference to current swiper instance

export function setCurrentSwiper(swiper) {
    currentSwiperRef = swiper;
}

export async function openMetadataModal() {
    if (!currentSwiperRef) return;

    const currentIndex = currentSwiperRef.activeIndex;
    const currentImage = window.currentImages[currentIndex]; // You'll need to make currentImages accessible

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

export function closeMetadataModal() {
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
