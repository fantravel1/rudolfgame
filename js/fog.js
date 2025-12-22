/**
 * Fog System - Creates and manages the fog that covers the game world
 * Rudolf's nose clears visibility through the fog
 */
class FogSystem {
    constructor(width, height) {
        this.width = width;
        this.height = height;

        // Fog density levels
        this.densityLevels = {
            light: 0.7,
            medium: 0.8,
            thick: 0.88,
            heavy: 0.92,
            whiteout: 0.96
        };

        this.density = this.densityLevels.light;

        // Fog color
        this.fogColor = { r: 200, g: 210, b: 220 };

        // Create off-screen canvas for fog
        this.fogCanvas = document.createElement('canvas');
        this.fogCanvas.width = width;
        this.fogCanvas.height = height;
        this.fogCtx = this.fogCanvas.getContext('2d');

        // Visibility holes
        this.visibilityHoles = [];

        // Animated fog particles
        this.particles = [];
        this.initParticles();
    }

    /**
     * Initialize fog particles for animation
     */
    initParticles() {
        const particleCount = 50;

        for (let i = 0; i < particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                size: 100 + Math.random() * 200,
                speedX: (Math.random() - 0.5) * 0.5,
                speedY: (Math.random() - 0.5) * 0.2,
                opacity: 0.1 + Math.random() * 0.2
            });
        }
    }

    /**
     * Set fog density
     */
    setDensity(level) {
        if (typeof level === 'string' && this.densityLevels[level]) {
            this.density = this.densityLevels[level];
        } else if (typeof level === 'number') {
            this.density = Math.max(0, Math.min(1, level));
        }
    }

    /**
     * Update fog particles
     */
    update(deltaTime) {
        // Move particles
        this.particles.forEach(particle => {
            particle.x += particle.speedX;
            particle.y += particle.speedY;

            // Wrap around edges
            if (particle.x < -particle.size) particle.x = this.width + particle.size;
            if (particle.x > this.width + particle.size) particle.x = -particle.size;
            if (particle.y < -particle.size) particle.y = this.height + particle.size;
            if (particle.y > this.height + particle.size) particle.y = -particle.size;
        });

        // Clean up old visibility holes
        this.visibilityHoles = this.visibilityHoles.filter(hole => {
            return !hole.temporary || hole.expiry > Date.now();
        });
    }

    /**
     * Add a visibility hole (cleared area)
     */
    addVisibilityHole(x, y, radius, temporary = false, duration = 0) {
        const hole = {
            x,
            y,
            radius,
            temporary,
            expiry: temporary ? Date.now() + duration : Infinity
        };

        if (!temporary) {
            // Check if there's already a permanent hole at this position (Rudolf's nose)
            const existingIndex = this.visibilityHoles.findIndex(h => !h.temporary);
            if (existingIndex >= 0) {
                this.visibilityHoles[existingIndex] = hole;
            } else {
                this.visibilityHoles.push(hole);
            }
        } else {
            this.visibilityHoles.push(hole);
        }
    }

    /**
     * Set Rudolf's nose visibility (main visibility source)
     */
    setNoseVisibility(x, y, radius) {
        this.addVisibilityHole(x, y, radius, false);
    }

    /**
     * Add temporary boost visibility burst
     */
    addBoostBurst(x, y, radius) {
        this.addVisibilityHole(x, y, radius, true, 3000);
    }

    /**
     * Reveal all (for bell power-up)
     */
    revealAll(duration) {
        this.addVisibilityHole(this.width / 2, this.height / 2, Math.max(this.width, this.height), true, duration);
    }

    /**
     * Check if a point is visible (not covered by fog)
     */
    isPointVisible(x, y) {
        for (const hole of this.visibilityHoles) {
            const dx = x - hole.x;
            const dy = y - hole.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < hole.radius * 0.8) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get visibility level at a point (0 = hidden, 1 = fully visible)
     */
    getVisibilityAt(x, y) {
        let maxVisibility = 0;

        for (const hole of this.visibilityHoles) {
            const dx = x - hole.x;
            const dy = y - hole.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < hole.radius) {
                // Smooth falloff from center to edge
                const visibility = 1 - (distance / hole.radius);
                maxVisibility = Math.max(maxVisibility, visibility);
            }
        }

        return maxVisibility;
    }

    /**
     * Render the fog layer
     */
    render(ctx) {
        const fogCtx = this.fogCtx;

        // Clear fog canvas
        fogCtx.clearRect(0, 0, this.width, this.height);

        // Fill with fog color
        fogCtx.fillStyle = `rgba(${this.fogColor.r}, ${this.fogColor.g}, ${this.fogColor.b}, ${this.density})`;
        fogCtx.fillRect(0, 0, this.width, this.height);

        // Draw animated fog particles for depth
        this.particles.forEach(particle => {
            const gradient = fogCtx.createRadialGradient(
                particle.x, particle.y, 0,
                particle.x, particle.y, particle.size
            );
            gradient.addColorStop(0, `rgba(255, 255, 255, ${particle.opacity})`);
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

            fogCtx.fillStyle = gradient;
            fogCtx.beginPath();
            fogCtx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            fogCtx.fill();
        });

        // Cut out visibility holes
        fogCtx.globalCompositeOperation = 'destination-out';

        this.visibilityHoles.forEach(hole => {
            // Create radial gradient for smooth edge
            const gradient = fogCtx.createRadialGradient(
                hole.x, hole.y, 0,
                hole.x, hole.y, hole.radius
            );

            // Visibility is full in center, fades at edges
            gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
            gradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.9)');
            gradient.addColorStop(0.8, 'rgba(0, 0, 0, 0.5)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

            fogCtx.fillStyle = gradient;
            fogCtx.beginPath();
            fogCtx.arc(hole.x, hole.y, hole.radius, 0, Math.PI * 2);
            fogCtx.fill();
        });

        // Reset composite operation
        fogCtx.globalCompositeOperation = 'source-over';

        // Draw fog canvas onto main canvas
        ctx.drawImage(this.fogCanvas, 0, 0);
    }

    /**
     * Resize fog system
     */
    resize(width, height) {
        this.width = width;
        this.height = height;
        this.fogCanvas.width = width;
        this.fogCanvas.height = height;
    }

    /**
     * Reset fog for new game/level
     */
    reset() {
        this.visibilityHoles = [];
    }
}

// Export for use in other modules
window.FogSystem = FogSystem;
