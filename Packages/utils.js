// Detect mobile device
export const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     window.innerWidth < 768 ||
                     ('ontouchstart' in window);

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
