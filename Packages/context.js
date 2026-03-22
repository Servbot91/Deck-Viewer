export function detectContext() {
    const path = window.location.pathname;
    const hash = window.location.hash;
    const search = window.location.search;

    // Check if we're on the images page
    const isImagesPage = path === '/images' || path === '/images/';
    
    // Check for individual image page pattern like /images/123456
    const imageIdMatch = path.match(/^\/images\/(\d+)$/);
    if (imageIdMatch) {
        return {
            type: 'images',
            id: imageIdMatch[1],
            hash: hash,
            isSingleImage: true
        };
    }
    
    // Check for gallery pages
    const isGalleriesPage = path === '/galleries' || path === '/galleries/';
    const galleryIdMatch = path.match(/^\/galleries\/(\d+)(\?.*)?$/);
    if (galleryIdMatch) {
        return {
            type: 'galleries',
            id: galleryIdMatch[1],
            hash: hash,
            isSingleGallery: true
        };
    }
    
    // Extract ID from simple path pattern like /performers/123 or /tags/456
    const idMatch = path.match(/\/(\w+)\/(\d+)/);
    
    // Check if we're on an images tab
    const isImagesContext = hash.includes('images') ||
                           document.querySelector('.nav-tabs .active')?.textContent?.includes('Images');

    // Handle complex filtered views on /images page
    if (isImagesPage && search && search.includes('c=')) {
        // Parse the filter parameters from URL
        const filters = parseUrlFilters(search);
        
        return {
            type: 'images',
            id: null,
            hash: hash,
            isFilteredView: true,
            filter: filters,
            isGeneralListing: false
        };
    }

    // Handle simple path-based contexts
    if (idMatch) {
        const [, type, id] = idMatch;

        if (!isImagesContext && type !== 'galleries') {
            return null; // Only work with image contexts
        }

        return { type, id, hash };
    }

    // For general image listings, check if we have visible images
    if (document.querySelectorAll('img[src*="/image/"]').length > 0) {
        return {
            type: 'images',
            id: null,
            hash: hash,
            isGeneralListing: true
        };
    }

    return null;
}

// Parse URL filter parameters
function parseUrlFilters(search) {
    const params = new URLSearchParams(search);
    const filterParams = [];
    
    // Get all 'c' parameters (filters)
    for (const [key, value] of params.entries()) {
        if (key === 'c') {
            filterParams.push(value);
        }
    }
    
    // Parse sorting and pagination parameters
    return {
        rawFilters: filterParams,
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
}

// Fetch images based on context - PAGINATED VERSION
export async function fetchContextImages(context, page = 1, perPage = 50) {
    const { type, id, filter, isFilteredView, isGeneralListing, isSingleImage, isSingleGallery } = context;
    let query = '';
    let variables = {};
    
    // Handle single image page
    if (isSingleImage && id) {
        // Fetch the single image details
        const query = `query FindImage($id: ID!) {
            findImage(id: $id) {
                id
                title
                paths {
                    thumbnail
                    image
                }
            }
        }`;

        try {
            const response = await fetch('/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, variables: { id } })
            });

            const data = await response.json();
            const image = data?.data?.findImage;
            
            if (image) {
                return { 
                    images: [image], 
                    totalCount: 1, 
                    currentPage: 1,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPreviousPage: false
                };
            }
        } catch (error) {
            console.error('[Image Deck] Error fetching single image:', error);
        }
        
        return { 
            images: [], 
            totalCount: 0, 
            currentPage: 1,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false
        };
    }

    // Handle filtered views
    if (isFilteredView && filter) {
        query = `query FindImages($filter: FindFilterType!, $image_filter: ImageFilterType!) {
            findImages(filter: $filter, image_filter: $image_filter) {
                count
                images {
                    id
                    title
                    paths {
                        thumbnail
                        image
                    }
                }
            }
        }`;
        
        // Build the image filter based on URL parameters
        let imageFilter = {};
        
        if (filter.rawFilters) {
            // Process each filter parameter
            filter.rawFilters.forEach(filterStr => {
                try {
                    // Decode the URL-encoded string
                    const decoded = decodeURIComponent(filterStr);
                    
                    // Convert the pseudo-JSON format to real JSON
                    // Replace parentheses with braces and fix quotes
                    let jsonStr = decoded
                        .replace(/\(/g, '{')
                        .replace(/\)/g, '}')
                        .replace(/\\+"/g, '"')
                        .replace(/^"(.*)"$/, '$1'); // Remove surrounding quotes if present
                    
                    // Fix malformed JSON by ensuring proper quote escaping
                    jsonStr = jsonStr.replace(/([^\\])"/g, '$1\\"').replace(/\\"/g, '"');
                    
                    const filterObj = JSON.parse(jsonStr);
                    
                    if (filterObj.type === 'tags' && filterObj.value) {
                        const tagFilter = {};
                        
                        // Handle included tags
                        if (filterObj.value.items && filterObj.value.items.length > 0) {
                            tagFilter.value = filterObj.value.items.map(item => item.id);
                            tagFilter.modifier = filterObj.modifier || "INCLUDES_ALL";
                        }
                        
                        // Handle excluded tags  
                        if (filterObj.value.excluded && filterObj.value.excluded.length > 0) {
                            // Combine excluded with existing tag filter or create new one
                            if (!tagFilter.value) {
                                tagFilter.value = [];
                            }
                            tagFilter.value.push(...filterObj.value.excluded.map(item => item.id));
                            if (!tagFilter.modifier || tagFilter.modifier === "INCLUDES_ALL") {
                                tagFilter.modifier = "EXCLUDES"; // This logic may need adjustment
                            }
                        }
                        
                        if (tagFilter.value && tagFilter.value.length > 0) {
                            imageFilter.tags = tagFilter;
                        }
                    }
                    else if (filterObj.type === 'performers' && filterObj.value) {
                        if (filterObj.value.items && filterObj.value.items.length > 0) {
                            imageFilter.performers = {
                                value: filterObj.value.items.map(item => item.id),
                                modifier: filterObj.modifier || "INCLUDES_ALL"
                            };
                        }
                    }
                    else if (filterObj.type === 'file_count' && filterObj.value) {
                        // Handle file_count filter
                        imageFilter.file_count = {
                            value: filterObj.value.value,
                            modifier: filterObj.modifier || "GREATER_THAN"
                        };
                    }
                    // Add more filter types as needed
                } catch (e) {
                    console.error('[Image Deck] Error parsing filter:', filterStr, e);
                }
            });
        }
        
        variables = {
            filter: { 
                per_page: filter.perPage || perPage, 
                page: page, 
                sort: filter.sortBy || "created_at",
                direction: (filter.sortDir || "desc").toUpperCase()
            },
            image_filter: imageFilter
        };
    }
    // Handle simple path-based contexts
    else if (type && id) {
        switch(type) {
            case 'performers':
                query = `query FindImages($filter: FindFilterType!, $image_filter: ImageFilterType!) {
                    findImages(filter: $filter, image_filter: $image_filter) {
                        count
                        images {
                            id
                            title
                            paths {
                                thumbnail
                                image
                            }
                        }
                    }
                }`;
                variables = {
                    filter: { per_page: perPage, page: page, sort: "random" },
                    image_filter: { performers: { value: [id], modifier: "INCLUDES" } }
                };
                break;

            case 'tags':
                query = `query FindImages($filter: FindFilterType!, $image_filter: ImageFilterType!) {
                    findImages(filter: $filter, image_filter: $image_filter) {
                        count
                        images {
                            id
                            title
                            paths {
                                thumbnail
                                image
                            }
                        }
                    }
                }`;
                variables = {
                    filter: { per_page: perPage, page: page, sort: "random" },
                    image_filter: { tags: { value: [id], modifier: "INCLUDES" } }
                };
                break;

		case 'galleries':
			// For single gallery view, show images in the gallery using findImages
			if (context && context.isSingleGallery) {
				query = `query FindImages($filter: FindFilterType!, $image_filter: ImageFilterType!) {
					findImages(filter: $filter, image_filter: $image_filter) {
						count
						images {
							id
							title
							paths {
								thumbnail
								image
							}
						}
					}
				}`;
				variables = {
					filter: { per_page: perPage, page: page, sort: "created_at", direction: "ASC" },
					image_filter: { galleries: { value: [id], modifier: "INCLUDES" } }
				};
				console.log('[Image Deck] Fetching images for gallery ID:', id, 'Variables:', variables);
			} else {
				// For galleries listing, show gallery covers
				query = `query FindGalleries($filter: FindFilterType!) {
					findGalleries(filter: $filter) {
						count
						galleries {
							id
							title
							cover {
								paths {
									thumbnail
									image
								}
							}
						}
					}
				}`;
				variables = {
					filter: { 
						per_page: perPage, 
						page: page, 
						sort: "created_at",
						direction: "DESC"
					}
				};
			}
			break;

            default:
                // For general image listings, grab visible images
                return getVisibleImages();
        }
    }
	
    // Handle general listings
    else if (isGeneralListing) {
        // Use GraphQL to fetch paginated general images
        query = `query FindImages($filter: FindFilterType!) {
            findImages(filter: $filter) {
                count
                images {
                    id
                    title
                    paths {
                        thumbnail
                        image
                    }
                }
            }
        }`;
        variables = {
            filter: { 
                per_page: perPage, 
                page: page, 
                sort: "created_at",
                direction: "DESC"
            }
        };
    }
    else {
        // For general image listings, grab visible images
        return getVisibleImages();
    }

    try {
        const response = await fetch('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables })
        });

        const responseText = await response.text();
        console.log('[Image Deck] GraphQL Response Text:', responseText);

        // Try to parse as JSON
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('[Image Deck] Failed to parse GraphQL response as JSON:', parseError);
            console.error('[Image Deck] Raw response:', responseText);
            throw new Error('Invalid GraphQL response format');
        }

        // Check for GraphQL errors
        if (data.errors) {
            console.error('[Image Deck] GraphQL Errors:', data.errors);
            throw new Error(`GraphQL Error: ${data.errors.map(e => e.message).join(', ')}`);
        }

        let images = [];
        let totalCount = 0;
        
        if ((type === 'galleries') || (context && context.type === 'galleries')) {
            if (context && context.isSingleGallery) {
                // For single gallery, show images
images = data?.data?.findImages?.images || [];
totalCount = data?.data?.findImages?.count || images.length;
                totalCount = images.length; // Galleries have direct count
                console.log('[Image Deck] Fetched gallery images:', images);
            } else {
                // For galleries listing, show covers
                const galleries = data?.data?.findGalleries?.galleries || [];
                images = galleries.map(gallery => ({
                    id: gallery.id,
                    title: gallery.title,
                    paths: {
                        image: gallery.cover?.paths?.image || gallery.cover?.paths?.thumbnail || ''
                    }
                })).filter(g => g.paths.image); // Filter out galleries without covers
                totalCount = data?.data?.findGalleries?.count || images.length;
            }
        } else {
            images = data?.data?.findImages?.images || [];
            totalCount = data?.data?.findImages?.count || images.length;
            if (page === 1 && totalCount > perPage) {
                console.log(`[Image Deck] Total images: ${totalCount}, loading first ${perPage} for performance`);
            }
        }

        // Return both images and total count plus pagination info
        return { 
            images, 
            totalCount, 
            currentPage: page,
            totalPages: Math.ceil(totalCount / perPage),
            hasNextPage: page < Math.ceil(totalCount / perPage),
            hasPreviousPage: page > 1
        };
    } catch (error) {
        console.error(`[Image Deck] Error fetching images:`, error);
        return { 
            images: [], 
            totalCount: 0, 
            currentPage: 1,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false
        };
    }
}
