// Detect mobile device
export const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     window.innerWidth < 768 ||
                     ('ontouchstart' in window);

// Create imageCache in utils.js scope
const imageCache = new Map();

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

// Export the cache for debugging purposes
export function getImageCache() {
    return imageCache;
}

// Export function to clear cache if needed
export function clearImageCache() {
    imageCache.clear();
}