/**
 * Power-up System - Manages all collectible power-ups
 * Power-ups spawn in fog and provide various benefits
 */
class PowerUpSystem {
    constructor(width, height) {
        this.width = width;
        this.height = height;

        this.powerups = [];

        // Power-up types and their effects
        this.types = {
            carrot: {
                emoji: '🥕',
                effect: 'boost_charge',
                duration: 0,
                points: 25,
                description: '+1 Shake Boost charge'
            },
            star: {
                emoji: '⭐',
                effect: 'visibility',
                duration: 10000,
                points: 25,
                description: '2x visibility for 10s'
            },
            clock: {
                emoji: '⏰',
                effect: 'time',
                value: 15,
                duration: 0,
                points: 25,
                description: '+15 seconds'
            },
            bell: {
                emoji: '🔔',
                effect: 'reveal',
                duration: 5000,
                points: 25,
                description: 'Reveals ALL chimneys for 5s'
            },
            cocoa: {
                emoji: '☕',
                effect: 'wind_immunity',
                duration: 8000,
                points: 25,
                description: 'No wind affects you for 8s'
            },
            magnet: {
                emoji: '🧲',
                effect: 'chimney_glow',
                duration: 10000,
                points: 25,
                description: 'Chimneys glow brighter'
            }
        };

        // Spawn settings
        this.spawnMargin = 60;
        this.collectRadius = 40;

        // Animation
        this.bobSpeed = 0.003;

        // Active effects
        this.activeEffects = new Map();

        // Callbacks
        this.onCollect = null;
        this.onEffectStart = null;
        this.onEffectEnd = null;
    }

    /**
     * Spawn power-ups for a level
     */
    spawnPowerups(count, allowedTypes = null) {
        this.powerups = [];
        this.activeEffects.clear();

        const typeKeys = allowedTypes || Object.keys(this.types);

        for (let i = 0; i < count; i++) {
            const x = this.spawnMargin + Math.random() * (this.width - this.spawnMargin * 2);
            const y = this.spawnMargin + Math.random() * (this.height - this.spawnMargin * 2);

            const typeKey = typeKeys[Math.floor(Math.random() * typeKeys.length)];

            this.powerups.push({
                x,
                y,
                type: typeKey,
                collected: false,
                bobPhase: Math.random() * Math.PI * 2,
                spawnTime: Date.now()
            });
        }

        return this.powerups.length;
    }

    /**
     * Update power-ups
     */
    update(deltaTime) {
        // Check for expired effects
        const now = Date.now();

        this.activeEffects.forEach((effect, type) => {
            if (effect.expiry && now >= effect.expiry) {
                this.activeEffects.delete(type);
                if (this.onEffectEnd) {
                    this.onEffectEnd(type);
                }
            }
        });
    }

    /**
     * Check for collisions with player
     */
    checkCollision(playerX, playerY) {
        for (const powerup of this.powerups) {
            if (powerup.collected) continue;

            const dx = playerX - powerup.x;
            const dy = playerY - powerup.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < this.collectRadius) {
                return this.collect(powerup);
            }
        }
        return null;
    }

    /**
     * Collect a power-up
     */
    collect(powerup) {
        powerup.collected = true;

        const typeData = this.types[powerup.type];

        // Start duration-based effects
        if (typeData.duration > 0) {
            this.activeEffects.set(powerup.type, {
                startTime: Date.now(),
                expiry: Date.now() + typeData.duration,
                duration: typeData.duration
            });

            if (this.onEffectStart) {
                this.onEffectStart(powerup.type, typeData);
            }
        }

        // Haptic feedback
        if (window.Haptics) {
            Haptics.powerUp();
        }

        // Callback
        if (this.onCollect) {
            this.onCollect({
                type: powerup.type,
                typeData,
                x: powerup.x,
                y: powerup.y
            });
        }

        return {
            type: powerup.type,
            effect: typeData.effect,
            value: typeData.value,
            duration: typeData.duration,
            points: typeData.points
        };
    }

    /**
     * Check if an effect is active
     */
    isEffectActive(type) {
        return this.activeEffects.has(type);
    }

    /**
     * Get remaining time for an effect
     */
    getEffectTimeRemaining(type) {
        const effect = this.activeEffects.get(type);
        if (!effect) return 0;

        return Math.max(0, effect.expiry - Date.now());
    }

    /**
     * Get visibility multiplier (from star power-up)
     */
    getVisibilityMultiplier() {
        return this.isEffectActive('star') ? 2 : 1;
    }

    /**
     * Check wind immunity (from cocoa power-up)
     */
    hasWindImmunity() {
        return this.isEffectActive('cocoa');
    }

    /**
     * Check if reveal is active (from bell power-up)
     */
    isRevealActive() {
        return this.isEffectActive('bell');
    }

    /**
     * Check if chimneys glow brighter (from magnet power-up)
     */
    hasChimneyGlow() {
        return this.isEffectActive('magnet');
    }

    /**
     * Draw all power-ups
     */
    draw(ctx, fogSystem) {
        this.powerups.forEach(powerup => {
            if (powerup.collected) return;

            // Check if visible through fog
            const visibility = fogSystem ? fogSystem.getVisibilityAt(powerup.x, powerup.y) : 1;
            if (visibility < 0.3) return;

            // Bob animation
            const bobOffset = Math.sin(powerup.bobPhase + Date.now() * this.bobSpeed) * 8;

            ctx.save();
            ctx.translate(powerup.x, powerup.y + bobOffset);
            ctx.globalAlpha = 0.7 + visibility * 0.3;

            // Glow effect
            const typeData = this.types[powerup.type];
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = 15;

            // Draw emoji
            ctx.font = '32px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(typeData.emoji, 0, 0);

            ctx.restore();
        });
    }

    /**
     * Draw active effect indicators
     */
    drawEffectIndicators(ctx, x, y) {
        let offsetY = 0;

        this.activeEffects.forEach((effect, type) => {
            const typeData = this.types[type];
            const remaining = this.getEffectTimeRemaining(type);
            const progress = remaining / effect.duration;

            ctx.save();
            ctx.translate(x, y + offsetY);

            // Background bar
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, 100, 20);

            // Progress bar
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(0, 0, 100 * progress, 20);

            // Icon
            ctx.font = '16px Arial';
            ctx.textBaseline = 'middle';
            ctx.fillText(typeData.emoji, -20, 10);

            ctx.restore();

            offsetY += 25;
        });
    }

    /**
     * Reset for new level
     */
    reset() {
        this.powerups = [];
        this.activeEffects.clear();
    }
}

// Export for use in other modules
window.PowerUpSystem = PowerUpSystem;
