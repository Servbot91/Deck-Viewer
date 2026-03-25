import { isMobile } from './utils.js';

export const PLUGIN_NAME = 'image-deck';

export async function getPluginConfig() {
    try {
        const response = await fetch('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: `query Configuration {
                    configuration {
                        plugins
                    }
                }`
            })
        });
        const data = await response.json();
        const settings = data?.data?.configuration?.plugins?.[PLUGIN_NAME] || {};

        // Set flashier defaults
        if (!settings.autoPlayInterval || settings.autoPlayInterval === 0) settings.autoPlayInterval = 500;
        if (!settings.transitionEffect || settings.transitionEffect === '') settings.transitionEffect = 'cards';
        if (settings.showProgressBar === undefined) settings.showProgressBar = true;
        if (settings.showCounter === undefined) settings.showCounter = true;
        if (!settings.preloadImages || settings.preloadImages === 0) settings.preloadImages = isMobile ? 1 : 1;
        if (!settings.swipeResistance || settings.swipeResistance === 0) settings.swipeResistance = 80;
        if (!settings.effectDepth || settings.effectDepth === 0) settings.effectDepth = 150;
		if (settings.chunkSize === undefined) settings.chunkSize = 30; // Smaller chunks for better responsiveness
		if (settings.lazyLoadThreshold === undefined) settings.lazyLoadThreshold = 2; // Load 2 slides ahead/behind
		
        // Visual effects defaults (flashier!)
        if (!settings.ambientColorHue || settings.ambientColorHue === 0) settings.ambientColorHue = 260;
        if (!settings.imageGlowIntensity || settings.imageGlowIntensity === 0) settings.imageGlowIntensity = 40;
        if (!settings.ambientPulseSpeed || settings.ambientPulseSpeed === 0) settings.ambientPulseSpeed = 6;
        if (!settings.edgeGlowIntensity || settings.edgeGlowIntensity === 0) settings.edgeGlowIntensity = 50;
        if (!settings.strobeSpeed || settings.strobeSpeed === 0) settings.strobeSpeed = 150;
        if (!settings.strobeIntensity || settings.strobeIntensity === 0) settings.strobeIntensity = 60;

        console.log(`[Image Deck] Settings loaded:`, settings);
        return settings;
    } catch (error) {
        console.error(`[Image Deck] Error loading settings:`, error);
        return {
            autoPlayInterval: 500,
            transitionEffect: 'cards',
            showProgressBar: true,
            showCounter: true,
            preloadImages: 2,
            swipeResistance: 50,
            effectDepth: 150,
            ambientColorHue: 260,
            imageGlowIntensity: 40,
            ambientPulseSpeed: 6,
        };
    }
}

export function injectDynamicStyles(settings) {
    const styleId = 'image-deck-dynamic-styles';
    let styleEl = document.getElementById(styleId);

    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
    }

    const ambientHue = settings.ambientColorHue;
    const glowIntensity = settings.imageGlowIntensity;
    const pulseSpeed = settings.ambientPulseSpeed;
    const edgeIntensity = settings.edgeGlowIntensity / 100;

    styleEl.textContent = `
        .swiper-slide img {
            filter: drop-shadow(0 0 ${glowIntensity}px hsla(${ambientHue}, 70%, 65%, 0.4));
        }

        .image-deck-ambient {
            background: radial-gradient(
                ellipse at center,
                hsla(${ambientHue}, 70%, 50%, 0.2) 0%,
                hsla(${ambientHue}, 60%, 40%, 0.15) 50%,
                transparent 100%
            );
            animation: ambientPulse ${pulseSpeed}s ease-in-out infinite;
        }

        .image-deck-container::before {
            box-shadow: inset 0 0 ${100 * edgeIntensity}px hsla(${ambientHue}, 70%, 50%, ${0.2 * edgeIntensity});
            animation: edgeGlow 4s ease-in-out infinite alternate;
        }

        @keyframes edgeGlow {
            0% {
                box-shadow: inset 0 0 ${100 * edgeIntensity}px hsla(${ambientHue}, 70%, 50%, ${0.2 * edgeIntensity});
            }
            100% {
                box-shadow: inset 0 0 ${150 * edgeIntensity}px hsla(${ambientHue + 20}, 70%, 50%, ${0.3 * edgeIntensity});
            }
        }

        .image-deck-progress {
            background: linear-gradient(90deg,
                hsl(${ambientHue}, 70%, 65%),
                hsl(${ambientHue + 30}, 70%, 65%)
            );
        }
        
        /* New control layout styles */
        .image-deck-controls-wrapper {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            z-index: 1002;
        }
        
        .image-deck-zoom-controls {
            display: flex;
            gap: 10px;
        }
        
        .image-deck-navigation-controls {
            display: flex;
            gap: 10px;
        }
        
        .image-deck-control-btn {
            background: rgba(0, 0, 0, 0.7);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.2s ease;
            backdrop-filter: blur(5px);
        }
        
        .image-deck-control-btn:hover {
            background: rgba(50, 50, 50, 0.9);
            transform: scale(1.1);
        }
        
        .image-deck-control-btn:active {
            transform: scale(0.95);
        }
        
        /* Gallery cover styles */
        .gallery-cover-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin: 20px auto;
            max-width: 300px;
        }
        
        .gallery-cover-title {
            color: white;
            font-size: 16px;
            font-weight: bold;
            text-align: center;
            margin-bottom: 10px;
            text-shadow: 0 0 5px rgba(0, 0, 0, 0.7);
            padding: 5px 10px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 4px;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .gallery-cover-link {
            display: inline-block;
            max-width: 300px;
            max-height: 500px;
            aspect-ratio: 3 / 5;
            border: 3px solid #6a5acd;
            border-radius: 8px;
            box-shadow: 0 0 15px rgba(106, 90, 205, 0.7);
            overflow: hidden;
            transition: all 0.3s ease;
            width: 100%;
        }
        
        .gallery-cover-link:hover {
            transform: scale(1.05);
            box-shadow: 0 0 25px rgba(106, 90, 205, 0.9);
            border-color: #8a7bdb;
        }
        
        .gallery-cover-link img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
        
        /* Mobile optimizations */
        @media (max-width: 768px) {
            .gallery-cover-container {
                max-width: 200px;
            }
            
            .gallery-cover-link {
                max-width: 200px;
                max-height: 350px;
            }
            
            .gallery-cover-title {
                font-size: 14px;
                padding: 4px 8px;
            }
            
            .image-deck-control-btn {
                width: 35px;
                height: 35px;
                font-size: 14px;
            }
        }
        
        @media (max-width: 480px) {
            .gallery-cover-container {
                max-width: 150px;
            }
            
            .gallery-cover-link {
                max-width: 150px;
                max-height: 250px;
            }
            
            .gallery-cover-title {
                font-size: 12px;
                padding: 3px 6px;
            }
            
            .image-deck-control-btn {
                width: 30px;
                height: 30px;
                font-size: 12px;
            }
        }
        
        /* Transition for fading UI elements */
        .image-deck-topbar,
        .image-deck-controls-wrapper,
        .image-deck-speed {
            transition: opacity 0.3s ease;
        }
    `;
}
