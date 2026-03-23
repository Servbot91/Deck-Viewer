export function detectContext() {
    const path = window.location.pathname;
    const hash = window.location.hash;
    const search = window.location.search;

    // 1. Check for individual image page
    const imageIdMatch = path.match(/^\/images\/(\d+)$/);
    if (imageIdMatch) {
        return { type: 'images', id: imageIdMatch[1], hash, isSingleImage: true };
    }

    // 2. Check for Gallery Contexts
    if (path.startsWith('/galleries')) {
        const galleryIdMatch = path.match(/^\/galleries\/(\d+)/);
        if (galleryIdMatch) {
            return { type: 'galleries', id: galleryIdMatch[1], hash, isSingleGallery: true };
        } else {
            const filters = parseUrlFilters(search);
            return { type: 'galleries', isGalleryListing: true, filter: filters, hash };
        }
    }

    // 3. IMPROVED: Handle /images page (with OR without search params)
    if (path.startsWith('/images')) {
        const filters = parseUrlFilters(search);
        return {
            type: 'images',
            isFilteredView: !!search, // true if there are any search params
            isGeneralListing: !search, // true if it's just the base /images page
            filter: filters,
            hash: hash
        };
    }

    // 4. Handle path-based patterns (Performers, Tags, etc.)
    const idMatch = path.match(/\/(\w+)\/(\d+)/);
    if (idMatch) {
        const [, type, id] = idMatch;
        const isImagesTab = hash.includes('images') || 
                           document.querySelector('.nav-tabs .active')?.textContent?.includes('Images');

        if (isImagesTab || type === 'galleries') {
            // Mapping common types to what the GraphQL image_filter expects
            const filter = {};
            if (type === 'performers') filter.performers = { value: [id], modifier: "INCLUDES" };
            if (type === 'tags') filter.tags = { value: [id], modifier: "INCLUDES" };
            if (type === 'studios') filter.studios = { value: [id], modifier: "INCLUDES" };

            return { type, id, filter, hash };
        }
    }

    // 5. Fallback: If we see images, at least try to paginate the general list
    if (document.querySelectorAll('img[src*="/image/"]').length > 0) {
        return {
            type: 'images',
            isGeneralListing: true,
            filter: parseUrlFilters(search), // Still try to grab any sort/direction params
            hash: hash
        };
    }

    return null;
}

// Parse URL filter parameters
function parseUrlFilters(search) {
    const params = new URLSearchParams(search);
    const cParam = params.get('c');
    let parsedFilter = {};

    if (cParam) {
        try {
            // Decodes Stash's (key:value) format to JSON {key:value}
            const jsonString = cParam
                .replace(/\(/g, '{')
                .replace(/\)/g, '}')
                .replace(/"items":/g, '"value":');

            const parsed = JSON.parse(jsonString);

            // If we have a valid filter type (e.g., "performers")
            if (parsed.type && parsed.value) {
                parsedFilter[parsed.type] = {
                    value: parsed.value.value ? parsed.value.value.map(i => i.id) : [],
                    modifier: parsed.modifier || "INCLUDES"
                };
            }
        } catch (e) {
            console.error('[Image Deck] Filter parse error:', e);
        }
    }

    return {
        ...parsedFilter, // Spread the filters (e.g., performers: {...})
        sortBy: params.get('sortby') || 'created_at',
        sortDir: params.get('sortdir') || 'desc',
        perPage: parseInt(params.get('perPage')) || 40
    };
}

// Get visible images from current page
export function getVisibleImages() {
    const images = [];
    // Target only the main image grid, not sidebar or header images
    const imageGrid = document.querySelector('.main-content, [role="main"]') || document.body;
    const imageElements = imageGrid.querySelectorAll('.image-card img, .grid-card img');

    imageElements.forEach((img, index) => {
        // Exclude studio logos and other non-content images
        if (img.src && 
            img.src.includes('/image/') && 
            !img.src.includes('/studio/') && 
            !img.closest('.logo, .sidebar, .header')) {
            
            // Extract image ID from src if possible
            const idMatch = img.src.match(/\/image\/(\d+)/);
            const id = idMatch ? idMatch[1] : `img_${index}`;

            // Convert thumbnail URLs to full image URLs
            const fullImageUrl = img.src.includes('/thumbnail/')
                ? img.src.replace('/thumbnail/', '/image/')
                : img.src;

            images.push({
                id,
                title: img.alt || `Image ${index + 1}`,
                paths: {
                    image: fullImageUrl
                }
            });
        }
    });

    return images;
}

// Get visible gallery covers from current page
export function getVisibleGalleryCovers() {
    const galleries = [];
    // Target only the main gallery grid
    const galleryGrid = document.querySelector('.main-content, [role="main"]') || document.body;
    const galleryElements = galleryGrid.querySelectorAll('.gallery-card, .card');

    galleryElements.forEach((card, index) => {
        const coverImg = card.querySelector('.gallery-cover img, img');
        if (coverImg && coverImg.src) {
            // Extract gallery ID from the parent link or card
            let id = `gallery_${index}`;
            let url = null;
            const link = card.querySelector('a[href*="/galleries/"]');
            if (link) {
                const idMatch = link.href.match(/\/galleries\/(\d+)/);
                if (idMatch) {
                    id = idMatch[1];
                    url = link.href;
                }
            }

            galleries.push({
                id,
                title: card.querySelector('.card-title, h5, h6')?.textContent?.trim() || `Gallery ${index + 1}`,
                paths: {
                    image: coverImg.src
                },
                url: url // Add the gallery URL
            });
        }
    });

    return galleries;
}export async function fetchContextImages(context, page = 1, perPage = 50) {
    const { type, id, filter, isSingleGallery, isGalleryListing } = context;
    const isFetchingGalleries = isGalleryListing || (type === 'galleries' && !isSingleGallery);

    // 1. Determine Query
    let query = '';
    if (isFetchingGalleries) {
        query = `query FindGalleries($filter: FindFilterType!, $gallery_filter: GalleryFilterType) {
            findGalleries(filter: $filter, gallery_filter: $gallery_filter) {
                count
                galleries {
                    id title cover { paths { thumbnail image } }
                }
            }
        }`;
    } else {
        query = `query FindImages($filter: FindFilterType!, $image_filter: ImageFilterType) {
            findImages(filter: $filter, image_filter: $image_filter) {
                count
                images {
                    id title paths { thumbnail image }
                }
            }
        }`;
    }

    // 2. Build the active filter object
    const allowedFields = [
        'tags', 'performers', 'studios', 'markers', 'galleries', 
        'pht_path', 'rating', 'organized', 'is_missing'
    ];

    let activeFilter = {};
    if (isSingleGallery && id) {
        activeFilter = { galleries: { value: [id], modifier: "INCLUDES" } };
    } else if (filter) {
        allowedFields.forEach(field => {
            if (filter[field]) {
                activeFilter[field] = filter[field];
            }
        });
    }

    // 3. Prepare GraphQL Variables
    const variables = {
        filter: { 
            per_page: perPage, 
            page: page, 
            sort: filter?.sortBy || "created_at", 
            direction: (filter?.sortDir || "desc").toUpperCase() 
        }
    };

    // Assign to the correct GraphQL key based on context
    if (isFetchingGalleries) {
        variables.gallery_filter = activeFilter;
    } else {
        variables.image_filter = activeFilter;
    }

    // 4. Execute Fetch
    try {
        const response = await fetch('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables })
        });

        const data = await response.json();
        
        if (data.errors) {
            console.error('[Image Deck] GraphQL Errors:', data.errors);
            throw new Error(data.errors[0].message);
        }

        let normalizedImages = [];
        let totalCount = 0;

        if (isFetchingGalleries) {
            const result = data?.data?.findGalleries;
            totalCount = result?.count || 0;
            normalizedImages = (result?.galleries || []).map(g => ({
                id: g.id,
                title: g.title,
                isGallery: true,
                type: 'gallery',
                paths: { image: g.cover?.paths?.image || g.cover?.paths?.thumbnail || '' },
                url: `/galleries/${g.id}`
            }));
        } else {
            const result = data?.data?.findImages;
            totalCount = result?.count || 0;
            normalizedImages = (result?.images || []).map(img => ({
                ...img,
                isGallery: false,
                type: 'image'
            }));
        }

        const calculatedTotalPages = Math.ceil(totalCount / perPage);

        return { 
            images: normalizedImages, 
            totalCount, 
            currentPage: page,
            totalPages: calculatedTotalPages,
            hasNextPage: page < calculatedTotalPages
        };

    } catch (error) {
        console.error(`[Image Deck] Fetch Error:`, error);
        return { 
            images: [], 
            totalCount: 0, 
            currentPage: 1, 
            totalPages: 0, 
            hasNextPage: false 
        };
    }
}