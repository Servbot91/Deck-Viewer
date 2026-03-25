// Add this to the detectContext function around line 40, after the /images page handling
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
		const params = new URLSearchParams(search);
		
		if (galleryIdMatch) {
			const filter = parseUrlFilters(search);
			// For single gallery views, if no sort is specified, default to title asc
			if (!params.get('sortby') && !params.get('sortdir')) {
				filter.sortBy = 'title';
				filter.sortDir = 'asc';
			}
			return { type: 'galleries', id: galleryIdMatch[1], hash, isSingleGallery: true, filter };
		} else {
			const filters = parseUrlFilters(search);
			return { type: 'galleries', isGalleryListing: true, filter: filters, hash };
		}
	}

    // 3. Handle /images page (with OR without search params)
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

    // 4. Handle performer pages with gallery/image tabs
    const performerMatch = path.match(/^\/performers\/(\d+)(?:\/(galleries|images))?/);
    if (performerMatch) {
        const [, performerId, tab] = performerMatch;
        const isImagesTab = tab === 'images' || hash.includes('images') || 
                           document.querySelector('.nav-tabs .active')?.textContent?.includes('Images');
        const isGalleriesTab = tab === 'galleries' || hash.includes('galleries') ||
                              document.querySelector('.nav-tabs .active')?.textContent?.includes('Galleries');

        // Default to images tab if no specific tab is indicated
        const activeTab = isGalleriesTab ? 'galleries' : 'images';

        // Create filter for performer
        const filter = {
            performers: { value: [performerId], modifier: "INCLUDES" }
        };

        // Parse sort parameters from URL
        const params = new URLSearchParams(search);
        if (params.has('sortby')) {
            filter.sortBy = params.get('sortby');
        }
        if (params.has('sortdir')) {
            filter.sortDir = params.get('sortdir');
        }

        return {
            type: activeTab,
            id: performerId,
            filter: filter,
            isPerformerContext: true,
            performerId: performerId,
            hash: hash
        };
    }

    // 5. Handle path-based patterns (Performers, Tags, etc.) - existing code
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

    // 6. Fallback: If we see images, at least try to paginate the general list
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

    // Handle sort direction - if not provided, assume ascending
    let sortDir = 'asc'; // Default to ascending when not specified
    if (params.has('sortdir')) {
        sortDir = params.get('sortdir') || 'asc';
    }

    return {
        ...parsedFilter,
        sortBy: params.get('sortby') || 'created_at',
        sortDir: sortDir,
        perPage: parseInt(params.get('perPage')) || 40
    };
}

// Get visible images from current page
export function getVisibleImages() {
    const images = [];
    const imageGrid = document.querySelector('.main-content, [role="main"]') || document.body;
    const imageElements = imageGrid.querySelectorAll('.image-card img, .grid-card img');

    // Convert NodeList to Array to preserve order
    const imageArray = Array.from(imageElements);

    imageArray.forEach((img, index) => {
        if (img.src && 
            img.src.includes('/image/') && 
            !img.src.includes('/studio/') && 
            !img.closest('.logo, .sidebar, .header')) {
            
            const idMatch = img.src.match(/\/image\/(\d+)/);
            const id = idMatch ? idMatch[1] : `img_${index}`;

            const fullImageUrl = img.src.includes('/thumbnail/')
                ? img.src.replace('/thumbnail/', '/image/')
                : img.src;

            // Find the preview button associated with this image
            const card = img.closest('.image-card, .grid-card');
            const previewButton = card?.querySelector('.preview-button');

            images.push({
                id,
                title: img.alt || `Image ${index + 1}`,
                paths: {
                    image: fullImageUrl
                },
                // Store reference to preview button
                previewButton: previewButton
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
}

export async function fetchContextImages(context, page = 1, perPage = 50) {
    const { type, id, filter, isSingleGallery, isGalleryListing } = context;
    const isFetchingGalleries = isGalleryListing || (type === 'galleries' && !isSingleGallery);

    // 1. Determine Query - Add performer and tag data for filtering
    let query = '';
    if (isFetchingGalleries) {
		query = `query FindGalleries($filter: FindFilterType!, $gallery_filter: GalleryFilterType) {
			findGalleries(filter: $filter, gallery_filter: $gallery_filter) {
				count
				galleries {
					id title image_count cover { paths { thumbnail image } }
					performers {
						id
						name
					}
					tags {
						id
					}
				}
			}
		}`;
    } else {
        query = `query FindImages($filter: FindFilterType!, $image_filter: ImageFilterType) {
            findImages(filter: $filter, image_filter: $image_filter) {
                count
                images {
                    id title paths { thumbnail image }
                    performers {
                        id
                    }
                    tags {
                        id
                    }
                }
            }
        }`;
    }

    // 2. Build the active filter object and collect exclusions
    let activeFilter = {};
    let exclusions = {}; // Store all exclusions by type
    
    if (isSingleGallery && id) {
        activeFilter = { galleries: { value: [id], modifier: "INCLUDES" } };
    } else if (filter) {
        if (isFetchingGalleries) {
            // Gallery-specific allowed fields
            const galleryAllowedFields = [
                'tags', 'performers', 'studios', 'markers', 'path', 
                'rating100', 'organized', 'is_missing', 'image_count',
                'date', 'url', 'photographer', 'code'
            ];
            
            galleryAllowedFields.forEach(field => {
                if (filter[field]) {
                    // Handle exclusions for any field type
                    if (filter[field].excluded && filter[field].excluded.length > 0) {
                        exclusions[field] = filter[field].excluded;
                        // Still apply the main filter if there are positive includes
                        if (filter[field].value && filter[field].value.length > 0) {
                            activeFilter[field] = {
                                value: filter[field].value,
                                modifier: filter[field].modifier
                            };
                        }
                    } else {
                        // Handle other fields normally
                        activeFilter[field] = {
                            value: filter[field].value,
                            modifier: filter[field].modifier
                        };
                    }
                }
            });
        } else {
            // Image-specific allowed fields
            const imageAllowedFields = [
                'tags', 'performers', 'studios', 'markers', 'galleries', 
                'path', 'rating100', 'organized', 'is_missing'
            ];
            
            imageAllowedFields.forEach(field => {
                if (filter[field]) {
                    // Handle exclusions for any field type
                    if (filter[field].excluded && filter[field].excluded.length > 0) {
                        exclusions[field] = filter[field].excluded;
                        // Still apply the main filter if there are positive includes
                        if (filter[field].value && filter[field].value.length > 0) {
                            activeFilter[field] = {
                                value: filter[field].value,
                                modifier: filter[field].modifier
                            };
                        }
                    } else {
                        activeFilter[field] = {
                            value: filter[field].value,
                            modifier: filter[field].modifier
                        };
                    }
                }
            });
        }
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
            let result = data?.data?.findGalleries;
            totalCount = result?.count || 0;
            
            // Apply client-side filtering for all exclusions
            if (Object.keys(exclusions).length > 0 && result?.galleries) {
                result.galleries = result.galleries.filter(item => {
                    // Check each exclusion type
                    for (const [fieldType, excludedIds] of Object.entries(exclusions)) {
                        if (excludedIds.length > 0) {
                            // Check if item has the field and any excluded values
                            if (item[fieldType] && item[fieldType].length > 0) {
                                // Check if any item in the field is in the exclusion list
                                const hasExcludedItem = item[fieldType].some(fieldItem => 
                                    excludedIds.includes(fieldItem.id)
                                );
                                
                                // If we find any excluded item, exclude this gallery
                                if (hasExcludedItem) {
                                    return false;
                                }
                            }
                        }
                    }
                    return true; // Include if no exclusions apply
                });
                
                // Update count after filtering
                totalCount = result.galleries.length;
            }
            
			normalizedImages = (result?.galleries || []).map(gallery => ({
				id: gallery.id,
				title: gallery.title,
				image_count: gallery.image_count,
				performers: gallery.performers || [], // Add this line
				isGallery: true,
				type: 'gallery',
				paths: { image: gallery.cover?.paths?.image || gallery.cover?.paths?.thumbnail || '' },
				url: `/galleries/${gallery.id}`
			}));
        } else {
            let result = data?.data?.findImages;
            totalCount = result?.count || 0;
            
            // Apply client-side filtering for all exclusions
            if (Object.keys(exclusions).length > 0 && result?.images) {
                result.images = result.images.filter(item => {
                    // Check each exclusion type
                    for (const [fieldType, excludedIds] of Object.entries(exclusions)) {
                        if (excludedIds.length > 0) {
                            // Check if item has the field and any excluded values
                            if (item[fieldType] && item[fieldType].length > 0) {
                                // Check if any item in the field is in the exclusion list
                                const hasExcludedItem = item[fieldType].some(fieldItem => 
                                    excludedIds.includes(fieldItem.id)
                                );
                                
                                // If we find any excluded item, exclude this image
                                if (hasExcludedItem) {
                                    return false;
                                }
                            }
                        }
                    }
                    return true; // Include if no exclusions apply
                });
                
                // Update count after filtering
                totalCount = result.images.length;
            }
            
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