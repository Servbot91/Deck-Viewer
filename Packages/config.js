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
        if (!settings.preloadImages || settings.preloadImages === 0) settings.preloadImages = isMobile ? 1 : 2;
        if (!settings.swipeResistance || settings.swipeResistance === 0) settings.swipeResistance = 50;
        if (!settings.effectDepth || settings.effectDepth === 0) settings.effectDepth = 150;

        // Visual effects defaults (flashier!)
        if (!settings.particleCount || settings.particleCount === 0) settings.particleCount = 80;
        if (!settings.particleSpeed || settings.particleSpeed === 0) settings.particleSpeed = 1.0;
        if (!settings.particleSize || settings.particleSize === 0) settings.particleSize = 1.5;
        if (!settings.particleColorHue || settings.particleColorHue === 0) settings.particleColorHue = 260; // Purple
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
            particleCount: 80,
            particleSpeed: 1.0,
            particleSize: 1.5,
            particleColorHue: 260,
            ambientColorHue: 260,
            imageGlowIntensity: 40,
            ambientPulseSpeed: 6,
            edgeGlowIntensity: 50,
            strobeSpeed: 150,
            strobeIntensity: 60
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
    `;
}
