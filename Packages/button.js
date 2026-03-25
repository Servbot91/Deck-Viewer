
import { detectContext, fetchContextImages, getVisibleImages, getVisibleGalleryCovers } from './context.js';

let retryTimer = null;

// 1. Update the Observer to use the retry logic instead of the direct call
const observer = new MutationObserver(() => {
    // Check if we are even on an allowed path first to avoid unnecessary timers
    const path = window.location.pathname;
    if (path.startsWith('/galleries') || path.startsWith('/images') || path.match(/^\/performers\/\d+/)) {
        // Only trigger retry if the button isn't already there
        if (!document.getElementById("image-deck-nav-btn")) {
            retryCreateButton();
        }
    } else {
        // If we navigated away, clean up immediately
        cleanupButton();
    }
});

// 2. Start the observer
observer.observe(document.body, { childList: true, subtree: true });

export function createLaunchButton() {
    const buttonId = "image-deck-nav-btn";
    const existing = document.getElementById(buttonId);
    
    const path = window.location.pathname;
    const isAllowedPath = path.startsWith('/galleries') || path.startsWith('/images') || path.match(/^\/performers\/\d+/);

    if (!isAllowedPath) {
        cleanupButton();
        return;
    }

    // Double check that we actually have images before drawing
    const context = detectContext();
    const hasImages = document.querySelectorAll('img[src*="/image/"]').length > 0;
    const hasGalleryCovers = document.querySelectorAll('.gallery-cover img, .gallery-card img').length > 0;
    
    // For performer pages, we don't need to check for existing images since we'll fetch them
    const isPerformerPage = path.match(/^\/performers\/\d+/);
    
    if (!context && !hasImages && !hasGalleryCovers && !isPerformerPage) {
        // Don't remove here if we are in the middle of a retry loop
        return; 
    }

    if (existing) return;

    // Rest of the button creation code remains the same...
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "col-4 col-sm-3 col-md-2 col-lg-auto nav-link";
    
    const svgPath = "M1.829,10.195 L18.286,10.195 C19.245,10.195 20.032,10.944 20.108,11.897 L20.114,12.049 L20.114,36.146 C20.114,37.119 19.375,37.917 18.436,37.994 L18.286,38 L1.829,38 C0.869,38 0.082,37.251 0.006,36.298 L0,36.146 L0,12.049 C0,11.076 0.739,10.279 1.679,10.201 L1.829,10.195 L18.286,10.195 Z M17.371,32.293 L15.543,32.293 C15.038,32.293 14.629,32.708 14.629,33.220 C14.629,33.695 14.982,34.087 15.436,34.140 L15.543,34.146 L17.371,34.146 C17.876,34.146 18.286,33.731 18.286,33.220 C18.286,32.293 17.371,32.293 17.371,32.293 Z M28.343,0 C30.363,0 32,1.660 32,3.707 L32,27.805 C32,29.852 30.363,31.512 28.343,31.512 L21.942,31.512 L21.943,12.049 C21.943,10.067 20.409,8.449 18.480,8.347 L18.286,8.341 L8.228,8.341 L8.229,3.707 C8.229,1.660 9.866,0 11.886,0 L28.343,0 Z M12.053,19.463 C11.458,19.463 10.881,19.641 10.391,19.967 L10.211,20.096 L10.057,20.224 C9.506,19.735 8.797,19.463 8.060,19.463 C7.256,19.463 6.485,19.787 5.916,20.363 C5.348,20.940 5.029,21.722 5.029,22.537 C5.029,23.280 5.294,23.995 5.771,24.552 L5.907,24.700 L9.393,28.441 C9.565,28.627 9.806,28.732 10.057,28.732 C10.267,28.732 10.469,28.659 10.630,28.527 L10.722,28.441 L14.215,24.692 C14.770,24.125 15.086,23.348 15.086,22.537 C15.086,21.722 14.766,20.940 14.197,20.363 C13.629,19.787 12.858,19.463 12.053,19.463 Z M12.053,21.317 C12.373,21.317 12.679,21.445 12.905,21.674 C13.130,21.903 13.257,22.213 13.257,22.537 C13.257,22.768 13.192,22.992 13.073,23.185 L12.995,23.297 L12.895,23.409 L10.057,26.455 L7.218,23.408 L7.124,23.302 C6.950,23.082 6.857,22.814 6.857,22.537 C6.857,22.213 6.984,21.903 7.209,21.674 C7.435,21.445 7.741,21.317 8.060,21.317 C8.334,21.317 8.598,21.411 8.810,21.582 L8.911,21.674 L9.411,22.180 L9.497,22.257 C9.823,22.514 10.281,22.516 10.609,22.264 L10.703,22.181 L11.203,21.674 L11.304,21.582 C11.516,21.411 11.780,21.317 12.053,21.317 Z M5.943,22.537 L5.950,22.707 L5.946,22.660 L5.943,22.537 Z M6.686,20.903 L6.580,21.001 L6.624,20.960 C6.644,20.941 6.665,20.922 6.686,20.903 Z M11.615,20.437 L11.398,20.495 L11.566,20.448 L11.615,20.437 Z M11.738,20.414 L11.615,20.437 L11.638,20.432 L11.738,20.414 Z M3.571,12.049 L1.743,12.049 C1.238,12.049 0.829,12.464 0.829,12.976 C0.829,13.451 1.182,13.843 1.636,13.896 L1.743,13.902 L3.571,13.902 C4.076,13.902 4.486,13.487 4.486,12.976 C4.486,12.464 4.076,12.049 3.571,12.049 Z";

    buttonContainer.innerHTML = `
        <a href="javascript:void(0);" id="${buttonId}" class="minimal p-4 p-xl-2 d-flex d-xl-inline-block flex-column justify-content-between align-items-center btn btn-primary" title="Open Image Deck">
            <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 32 38" 
                class="svg-inline--fa fa-icon nav-menu-icon d-block d-xl-inline mb-2 mb-xl-0" 
                fill="currentColor"
                width="20"
                height="20"
                aria-hidden="true" 
                role="img">
                <path d="${svgPath}"/>
            </svg>
            <span>Deck Viewer</span>
        </a>
    `;

    const button = buttonContainer.querySelector(`#${buttonId}`);
    button.addEventListener('click', (e) => {
        import('./deck.js').then(module => module.openDeck());
    });

    const navTarget = document.querySelector(".navbar-nav");
    if (navTarget) {
        navTarget.appendChild(buttonContainer);
    }
}

export function cleanupButton() {
    const existing = document.getElementById("image-deck-nav-btn");
    if (existing) existing.closest(".nav-link")?.remove();
}

export function retryCreateButton(attempts = 0, maxAttempts = 5) {
    const path = window.location.pathname;
    const isAllowed = path.startsWith('/galleries') || path.startsWith('/images') || path.match(/^\/performers\/\d+/);
    
    if (!isAllowed) {
        cleanupButton();
        return;
    }

    const hasContext = detectContext() || 
                       document.querySelectorAll('img[src*="/image/"]').length > 0 || 
                       document.querySelectorAll('.gallery-cover img, .gallery-card img').length > 0 ||
                       path.match(/^\/performers\/\d+/); // Allow performer pages even without visible images

    if (hasContext) {
        createLaunchButton();
    } else if (attempts < maxAttempts - 1) {
        clearTimeout(retryTimer);
        const delays = [100, 300, 500, 1000, 2000];
        retryTimer = setTimeout(() => retryCreateButton(attempts + 1, maxAttempts), delays[attempts]);
    }
}
