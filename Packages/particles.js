// Particle system for visual candy
let particleAnimationId = null;

export function initParticles(canvas, pluginConfig) {
    if (!canvas) return;
    if (pluginConfig.particleCount === 0) return; // Disabled

    const ctx = canvas.getContext('2d', {
        alpha: true,
        desynchronized: true, // Hint for better performance on modern browsers
        willReadFrequently: false
    });
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const particleCount = pluginConfig.particleCount;
    const speedMult = pluginConfig.particleSpeed;
    const sizeMult = pluginConfig.particleSize;
    const baseHue = pluginConfig.particleColorHue;

    // Particle class
    class Particle {
        constructor() {
            this.reset();
            this.y = Math.random() * canvas.height;
            this.opacity = Math.random() * 0.5 + 0.3;
        }

        reset() {
            this.x = Math.random() * canvas.width;
            this.y = -10;
            this.speed = (Math.random() * 0.5 + 0.3) * speedMult;
            this.size = (Math.random() * 2 + 1) * sizeMult;
            this.opacity = Math.random() * 0.5 + 0.3;
            // Vary hue around base color
            this.hue = baseHue + (Math.random() * 40 - 20);
            this.wobble = Math.random() * 2 - 1;
            this.wobbleSpeed = Math.random() * 0.02 + 0.01;
        }

        update() {
            this.y += this.speed;
            this.x += Math.sin(this.y * this.wobbleSpeed) * this.wobble;

            if (this.y > canvas.height + 10) {
                this.reset();
            }
        }

        draw() {
            // Set shadow properties per particle (batched in render loop)
            ctx.shadowBlur = 20;
            ctx.shadowColor = `hsla(${this.hue}, 70%, 65%, ${this.opacity})`;

            ctx.fillStyle = `hsla(${this.hue}, 70%, 65%, ${this.opacity})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Create particles
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }

    // Animation loop - optimized for modern GPUs
    function animate() {
        // Clear with compositing for trail effect (faster than fillRect)
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';

        // Batch particle updates and draws
        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();
        }

        particleAnimationId = requestAnimationFrame(animate);
    }

    animate();

    // Handle resize
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
}

export function stopParticles() {
    if (particleAnimationId) {
        cancelAnimationFrame(particleAnimationId);
        particleAnimationId = null;
    }
}
