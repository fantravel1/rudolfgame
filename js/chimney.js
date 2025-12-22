/**
 * Chimney System - Manages chimney spawning and delivery mechanics
 * Chimneys are the main objectives to find and tap
 */
class ChimneySystem {
    constructor(width, height) {
        this.width = width;
        this.height = height;

        this.chimneys = [];
        this.deliveredCount = 0;
        this.missedCount = 0;
        this.totalRequired = 5;

        // Chimney dimensions
        this.chimneyWidth = 40;
        this.chimneyHeight = 50;

        // Spawn settings
        this.minSpawnDistance = 150;        // Minimum distance between chimneys
        this.spawnMargin = 80;              // Margin from screen edges

        // Animation
        this.glowIntensity = 0;
        this.glowDirection = 1;

        // Callbacks
        this.onDelivery = null;
        this.onMiss = null;
        this.onAllDelivered = null;
    }

    /**
     * Spawn chimneys for a level
     */
    spawnChimneys(count) {
        this.chimneys = [];
        this.deliveredCount = 0;
        this.missedCount = 0;
        this.totalRequired = count;

        const attempts = count * 20;        // Max attempts to place chimneys
        let placed = 0;

        for (let i = 0; i < attempts && placed < count; i++) {
            const x = this.spawnMargin + Math.random() * (this.width - this.spawnMargin * 2);
            const y = this.spawnMargin + Math.random() * (this.height - this.spawnMargin * 2);

            if (this.isValidPosition(x, y)) {
                this.chimneys.push({
                    x,
                    y,
                    width: this.chimneyWidth,
                    height: this.chimneyHeight,
                    delivered: false,
                    visible: false,              // Currently visible through fog
                    spotted: false,              // Has been spotted by player
                    missed: false,
                    glowPhase: Math.random() * Math.PI * 2,
                    houseStyle: Math.floor(Math.random() * 3)
                });
                placed++;
            }
        }

        return placed;
    }

    /**
     * Check if position is valid for a new chimney
     */
    isValidPosition(x, y) {
        for (const chimney of this.chimneys) {
            const dx = x - chimney.x;
            const dy = y - chimney.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < this.minSpawnDistance) {
                return false;
            }
        }
        return true;
    }

    /**
     * Update chimneys
     */
    update(deltaTime, fogSystem) {
        // Update glow animation
        this.glowIntensity += 0.05 * this.glowDirection;
        if (this.glowIntensity >= 1) {
            this.glowDirection = -1;
        } else if (this.glowIntensity <= 0) {
            this.glowDirection = 1;
        }

        // Update visibility based on fog
        this.chimneys.forEach(chimney => {
            if (!chimney.delivered && !chimney.missed) {
                const wasVisible = chimney.visible;
                chimney.visible = fogSystem.isPointVisible(chimney.x, chimney.y);

                // First time spotted
                if (chimney.visible && !chimney.spotted) {
                    chimney.spotted = true;
                }

                // Haptic feedback when chimney becomes visible
                if (chimney.visible && !wasVisible && window.Haptics) {
                    Haptics.chimneyFound();
                }
            }
        });
    }

    /**
     * Check if tap hits any visible chimney
     */
    checkTap(x, y) {
        for (const chimney of this.chimneys) {
            if (chimney.delivered || chimney.missed || !chimney.visible) continue;

            const bounds = this.getChimneyBounds(chimney);

            // Expand hit area slightly for better touch interaction
            const hitPadding = 20;

            if (x >= bounds.x - hitPadding &&
                x <= bounds.x + bounds.width + hitPadding &&
                y >= bounds.y - hitPadding &&
                y <= bounds.y + bounds.height + hitPadding) {

                return this.deliverPresent(chimney, x, y);
            }
        }
        return null;
    }

    /**
     * Deliver a present to a chimney
     */
    deliverPresent(chimney, tapX, tapY) {
        chimney.delivered = true;
        this.deliveredCount++;

        // Calculate if it's a perfect tap (center of chimney)
        const centerX = chimney.x;
        const centerY = chimney.y;
        const distance = Math.sqrt((tapX - centerX) ** 2 + (tapY - centerY) ** 2);
        const isPerfect = distance < 20;

        // Haptic feedback
        if (window.Haptics) {
            Haptics.success();
        }

        // Callback
        if (this.onDelivery) {
            this.onDelivery({
                chimney,
                isPerfect,
                delivered: this.deliveredCount,
                total: this.totalRequired
            });
        }

        // Check if all delivered
        if (this.deliveredCount >= this.totalRequired) {
            if (this.onAllDelivered) {
                this.onAllDelivered();
            }
        }

        return {
            points: isPerfect ? 150 : 100,
            isPerfect
        };
    }

    /**
     * Mark chimney as missed (flew past without tapping)
     */
    markMissed(chimney) {
        if (chimney.delivered || chimney.missed) return;

        chimney.missed = true;
        this.missedCount++;

        if (window.Haptics) {
            Haptics.miss();
        }

        if (this.onMiss) {
            this.onMiss({
                chimney,
                missed: this.missedCount
            });
        }
    }

    /**
     * Get direction to nearest undelivered chimney (for radar)
     */
    getNearestDirection(playerX, playerY) {
        let nearest = null;
        let minDistance = Infinity;

        for (const chimney of this.chimneys) {
            if (chimney.delivered || chimney.missed) continue;

            const dx = chimney.x - playerX;
            const dy = chimney.y - playerY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < minDistance) {
                minDistance = distance;
                nearest = {
                    chimney,
                    dx,
                    dy,
                    distance,
                    angle: Math.atan2(dy, dx)
                };
            }
        }

        return nearest;
    }

    /**
     * Get chimney bounds for collision/tap detection
     */
    getChimneyBounds(chimney) {
        return {
            x: chimney.x - chimney.width / 2,
            y: chimney.y - chimney.height / 2,
            width: chimney.width,
            height: chimney.height
        };
    }

    /**
     * Draw all chimneys
     */
    draw(ctx) {
        this.chimneys.forEach(chimney => {
            if (chimney.delivered || chimney.missed) return;

            ctx.save();
            ctx.translate(chimney.x, chimney.y);

            // Draw house
            this.drawHouse(ctx, chimney);

            // Draw chimney
            this.drawChimney(ctx, chimney);

            ctx.restore();
        });
    }

    /**
     * Draw house base
     */
    drawHouse(ctx, chimney) {
        const houseWidth = 70;
        const houseHeight = 40;
        const roofHeight = 25;

        // House colors based on style
        const styles = [
            { wall: '#c0392b', roof: '#7f8c8d' },
            { wall: '#2980b9', roof: '#95a5a6' },
            { wall: '#27ae60', roof: '#7f8c8d' }
        ];
        const style = styles[chimney.houseStyle];

        // House body
        ctx.fillStyle = style.wall;
        ctx.fillRect(-houseWidth / 2, 10, houseWidth, houseHeight);

        // Roof
        ctx.fillStyle = style.roof;
        ctx.beginPath();
        ctx.moveTo(-houseWidth / 2 - 5, 10);
        ctx.lineTo(0, 10 - roofHeight);
        ctx.lineTo(houseWidth / 2 + 5, 10);
        ctx.closePath();
        ctx.fill();

        // Window
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(-10, 25, 20, 15);
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 2;
        ctx.strokeRect(-10, 25, 20, 15);
        ctx.beginPath();
        ctx.moveTo(0, 25);
        ctx.lineTo(0, 40);
        ctx.moveTo(-10, 32.5);
        ctx.lineTo(10, 32.5);
        ctx.stroke();
    }

    /**
     * Draw chimney on the house
     */
    drawChimney(ctx, chimney) {
        // Chimney
        ctx.fillStyle = '#95a5a6';
        ctx.fillRect(-chimney.width / 4, -chimney.height / 2, chimney.width / 2, chimney.height / 2 + 5);

        // Chimney bricks pattern
        ctx.strokeStyle = '#7f8c8d';
        ctx.lineWidth = 1;
        for (let y = -chimney.height / 2; y < 5; y += 8) {
            ctx.beginPath();
            ctx.moveTo(-chimney.width / 4, y);
            ctx.lineTo(chimney.width / 4, y);
            ctx.stroke();
        }

        // Glow effect when visible
        if (chimney.visible) {
            const glow = 0.5 + Math.sin(chimney.glowPhase + Date.now() * 0.005) * 0.3;
            ctx.shadowColor = '#f1c40f';
            ctx.shadowBlur = 20 * glow;

            ctx.fillStyle = `rgba(241, 196, 15, ${glow * 0.5})`;
            ctx.beginPath();
            ctx.arc(0, -chimney.height / 4, 25, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowBlur = 0;
        }
    }

    /**
     * Draw delivery effect
     */
    drawDeliveryEffect(ctx, x, y, frame) {
        const progress = frame / 30;

        // Sparkle effect
        ctx.save();
        ctx.translate(x, y);

        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const distance = 20 + progress * 50;
            const size = 5 * (1 - progress);

            const px = Math.cos(angle) * distance;
            const py = Math.sin(angle) * distance;

            ctx.fillStyle = `rgba(241, 196, 15, ${1 - progress})`;
            ctx.beginPath();
            ctx.arc(px, py, size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    /**
     * Get remaining chimneys count
     */
    getRemainingCount() {
        return this.totalRequired - this.deliveredCount;
    }

    /**
     * Reset for new level
     */
    reset() {
        this.chimneys = [];
        this.deliveredCount = 0;
        this.missedCount = 0;
    }
}

// Export for use in other modules
window.ChimneySystem = ChimneySystem;
