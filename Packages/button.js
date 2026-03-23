
import { detectContext, fetchContextImages, getVisibleImages, getVisibleGalleryCovers } from './context.js';

let retryTimer = null;

// 1. Update the Observer to use the retry logic instead of the direct call
const observer = new MutationObserver(() => {
    // Check if we are even on an allowed path first to avoid unnecessary timers
    const path = window.location.pathname;
    if (path.startsWith('/galleries') || path.startsWith('/images')) {
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
    const isAllowedPath = path.startsWith('/galleries') || path.startsWith('/images');

    if (!isAllowedPath) {
        cleanupButton();
        return;
    }

    // Double check that we actually have images before drawing
    const context = detectContext();
    const hasImages = document.querySelectorAll('img[src*="/image/"]').length > 0;
    const hasGalleryCovers = document.querySelectorAll('.gallery-cover img, .gallery-card img').length > 0;
    
    if (!context && !hasImages && !hasGalleryCovers) {
        // Don't remove here if we are in the middle of a retry loop
        return; 
    }

    if (existing) return;

    const buttonContainer = document.createElement("div");
    buttonContainer.className = "col-4 col-sm-3 col-md-2 col-lg-auto nav-link";

    // The path coordinates start around 1074 and end at 1106 horizontally, 
    // and 421 to 459 vertically. 
    // viewBox="min-x min-y width height"
    const svgPath = "M1075.82857,431.195122 L1092.28571,431.195122 C1093.24511,431.195122 1094.03194,431.944117 1094.10822,432.896752 L1094.11429,433.04878 L1094.11429,457.146341 C1094.11429,458.118901 1093.37543,458.916524 1092.43569,458.993855 L1092.28571,459 L1075.82857,459 C1074.86917,459 1074.08235,458.251005 1074.00606,457.29837 L1074,457.146341 L1074,433.04878 C1074,432.076221 1074.73886,431.278598 1075.6786,431.201267 L1075.82857,431.195122 L1092.28571,431.195122 Z M1091.37143,455.292683 L1089.54286,455.292683 C1089.03791,455.292683 1088.62857,455.707639 1088.62857,456.219512 C1088.62857,456.694823 1088.98152,457.086568 1089.43623,457.140106 L1089.54286,457.146341 L1091.37143,457.146341 C1091.87637,457.146341 1092.28571,456.731386 1092.28571,456.219512 C1092.28571,455.292683 1091.37143,455.292683 1091.37143,455.292683 Z M1102.34286,421 C1104.36264,421 1106,422.659822 1106,424.707317 L1106,448.804878 C1106,450.852373 1104.36264,452.512195 1102.34286,452.512195 L1095.94246,452.512 L1095.94286,433.04878 C1095.94286,431.067334 1094.40943,429.448952 1092.47994,429.346602 L1092.28571,429.341463 L1082.22846,429.341 L1082.22857,424.707317 C1082.22857,422.659822 1083.86593,421 1085.88571,421 L1102.34286,421 Z M1086.05344,440.463415 C1085.45815,440.463415 1084.88108,440.640782 1084.39083,440.966741 L1084.21119,441.095885 L1084.05714,441.223746 C1083.50627,440.735085 1082.79712,440.463415 1082.06038,440.463415 C1081.25617,440.463415 1080.48485,440.787117 1079.91637,441.363404 C1079.34789,441.93969 1079.02857,442.721596 1079.02857,443.536846 C1079.02857,444.279753 1079.29389,444.995021 1079.77147,445.552286 L1079.90694,445.700252 L1083.39256,449.441469 C1083.56488,449.626659 1083.80567,449.731707 1084.05714,449.731707 C1084.2667,449.731707 1084.46884,449.658757 1084.63024,449.527144 L1084.72193,449.441251 L1088.21456,445.6922 C1088.76981,445.125089 1089.08571,444.347508 1089.08571,443.536846 C1089.08571,442.721814 1088.76608,441.939843 1088.19745,441.363404 C1087.62885,440.787001 1086.85796,440.463415 1086.05344,440.463415 Z M1086.05344,442.316702 C1086.37267,442.316702 1086.679,442.445343 1086.90481,442.674253 C1087.13028,442.903164 1087.25705,443.213421 1087.25705,443.536846 C1087.25705,443.767864 1087.19237,443.992164 1087.07315,444.184989 L1086.99516,444.296709 L1086.8954,444.40898 L1084.05713,447.455146 L1081.21766,444.407946 L1081.12406,444.301978 C1080.95023,444.081822 1080.85724,443.814417 1080.85724,443.536846 C1080.85724,443.213014 1080.98381,442.903018 1081.20948,442.674253 C1081.43539,442.445239 1081.74129,442.316702 1082.06038,442.316702 C1082.334,442.316702 1082.59804,442.411199 1082.80974,442.582208 L1082.91104,442.674006 L1083.41059,443.180418 L1083.49666,443.25747 C1083.82251,443.514309 1084.28051,443.516457 1084.6089,443.264169 L1084.70327,443.18085 L1085.20269,442.674099 L1085.30413,442.582283 C1085.51609,442.411237 1085.78017,442.316702 1086.05344,442.316702 Z M1079.94286,443.536846 L1079.94959,443.70688 L1079.94637,443.660494 L1079.94286,443.536846 Z M1080.68629,441.903404 L1080.58,442.001122 L1080.6236,441.959789 C1080.64417,441.940554 1080.66507,441.921752 1080.68629,441.903404 Z M1085.615,441.437122 L1085.39825,441.495321 L1085.56598,441.447588 L1085.615,441.437122 Z M1085.73754,441.413919 L1085.615,441.437122 L1085.63841,441.431846 L1085.73754,441.413919 Z M1078.57143,433.04878 L1076.74286,433.04878 C1076.23791,433.04878 1075.82857,433.463736 1075.82857,433.97561 C1075.82857,434.450921 1076.18152,434.842665 1076.63623,434.896204 L1076.74286,434.902439 L1078.57143,434.902439 C1079.07637,434.902439 1079.48571,434.487483 1079.48571,433.97561 C1079.48571,433.463736 1079.07637,433.04878 1078.57143,433.04878 Z";

    buttonContainer.innerHTML = `
        <a href="javascript:void(0);" id="${buttonId}" class="minimal p-4 p-xl-2 d-flex d-xl-inline-block flex-column justify-content-between align-items-center btn btn-primary" title="Open Image Deck">
            <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="1074 421 32 38" 
                class="svg-inline--fa fa-icon nav-menu-icon d-block d-xl-inline mb-2 mb-xl-0" 
                fill="currentColor"
                width="20"
                height="20"
                aria-hidden="true" 
                role="img">
                <path d="${svgPath}"/>
            </svg>
            <span>Image Deck SE</span>
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
    const isAllowed = path.startsWith('/galleries') || path.startsWith('/images');
    
    if (!isAllowed) {
        cleanupButton();
        return;
    }

    const hasContext = detectContext() || 
                       document.querySelectorAll('img[src*="/image/"]').length > 0 || 
                       document.querySelectorAll('.gallery-cover img, .gallery-card img').length > 0;

    if (hasContext) {
        createLaunchButton();
    } else if (attempts < maxAttempts - 1) {
        clearTimeout(retryTimer);
        const delays = [100, 300, 500, 1000, 2000];
        retryTimer = setTimeout(() => retryCreateButton(attempts + 1, maxAttempts), delays[attempts]);
    }
}

