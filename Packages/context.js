export function detectContext() {
    const path = window.location.pathname;
    const hash = window.location.hash;

    // Extract ID from path
    const idMatch = path.match(/\/(\w+)\/(\d+)/);
    if (!idMatch) return null;

    const [, type, id] = idMatch;

    // Check if we're on an images tab
    const isImagesContext = hash.includes('images') ||
                           document.querySelector('.nav-tabs .active')?.textContent?.includes('Images');

    if (!isImagesContext && type !== 'galleries') {
        return null; // Only work with image contexts
    }

    return { type, id, hash };
}

// Fetch images based on context - OPTIMIZED VERSION
export async function fetchContextImages(context) {
    const { type, id } = context;
    let query = '';
    let variables = {};

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
                // Limit initial load to 100 images for performance
                filter: { per_page: 100, sort: "random", page: 1 },
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
                // Limit initial load to 100 images for performance
                filter: { per_page: 100, sort: "random", page: 1 },
                image_filter: { tags: { value: [id], modifier: "INCLUDES" } }
            };
            break;

        case 'galleries':
            query = `query FindGallery($id: ID!) {
                findGallery(id: $id) {
                    id
                    title
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
            variables = { id };
            break;

        default:
            // For general image listings, grab visible images
            return getVisibleImages();
    }

    try {
        const response = await fetch('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables })
        });

        const data = await response.json();

        let images = [];
        if (type === 'galleries') {
            images = data?.data?.findGallery?.images || [];
        } else {
            images = data?.data?.findImages?.images || [];
            const count = data?.data?.findImages?.count || 0;
            if (count > 100) {
                console.log(`[Image Deck] Total images: ${count}, loaded first 100 for performance`);
            }
        }

        return images;
    } catch (error) {
        console.error(`[Image Deck] Error fetching images:`, error);
        return [];
    }
}

// Get visible images from current page
export function getVisibleImages() {
    const images = [];
    const imageElements = document.querySelectorAll('.image-card img, .gallery-card img, img[src*="/image/"]');

    imageElements.forEach((img, index) => {
        if (img.src) {
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
