/**
 * Rudolf - Player character class
 * The main controllable character with the glowing nose
 */
class Rudolf {
    constructor(x, y) {
        // Position
        this.x = x;
        this.y = y;

        // Velocity
        this.velocityX = 0;
        this.velocityY = 0;

        // Size
        this.width = 60;
        this.height = 40;

        // Physics
        this.maxSpeed = 8;
        this.acceleration = 0.3;
        this.friction = 0.92;

        // Nose glow
        this.noseRadius = 100;              // Normal visibility radius
        this.noseBoostRadius = 300;         // Boosted visibility radius
        this.currentNoseRadius = this.noseRadius;
        this.isBoosting = false;
        this.boostDuration = 3000;          // 3 seconds
        this.boostTimer = null;

        // Overheat state
        this.isOverheated = false;
        this.overheatNoseRadius = 40;       // Tiny radius when overheated

        // Animation
        this.frameIndex = 0;
        this.animationTimer = 0;
        this.animationSpeed = 100;          // ms per frame

        // Facing direction
        this.facingRight = true;

        // Bounds
        this.minX = this.width / 2;
        this.maxX = 0;                      // Set by game
        this.minY = this.height / 2;
        this.maxY = 0;                      // Set by game

        // Immunity frames after collision
        this.isImmune = false;
        this.immuneDuration = 1000;

        // Wind effect
        this.windForceX = 0;
        this.windForceY = 0;

        // Ice effect (dims nose)
        this.isIced = false;
        this.iceDuration = 3000;
        this.iceTimer = null;
    }

    /**
     * Set world bounds
     */
    setBounds(maxX, maxY) {
        this.maxX = maxX - this.width / 2;
        this.maxY = maxY - this.height / 2;
    }

    /**
     * Update Rudolf based on tilt input
     */
    update(deltaTime, tiltVelocity) {
        // Apply tilt-based acceleration
        if (tiltVelocity) {
            this.velocityX += tiltVelocity.x * this.acceleration;
            this.velocityY += tiltVelocity.y * this.acceleration;
        }

        // Apply wind force
        this.velocityX += this.windForceX;
        this.velocityY += this.windForceY;

        // Apply friction
        this.velocityX *= this.friction;
        this.velocityY *= this.friction;

        // Clamp velocity
        const speed = Math.sqrt(this.velocityX ** 2 + this.velocityY ** 2);
        if (speed > this.maxSpeed) {
            const scale = this.maxSpeed / speed;
            this.velocityX *= scale;
            this.velocityY *= scale;
        }

        // Update position
        this.x += this.velocityX;
        this.y += this.velocityY;

        // Keep within bounds
        this.x = Math.max(this.minX, Math.min(this.maxX, this.x));
        this.y = Math.max(this.minY, Math.min(this.maxY, this.y));

        // Update facing direction
        if (Math.abs(this.velocityX) > 0.5) {
            this.facingRight = this.velocityX > 0;
        }

        // Update animation
        this.animationTimer += deltaTime;
        if (this.animationTimer >= this.animationSpeed) {
            this.animationTimer = 0;
            this.frameIndex = (this.frameIndex + 1) % 4;
        }

        // Update nose glow based on state
        this.updateNoseGlow();
    }

    /**
     * Update nose glow radius based on state
     */
    updateNoseGlow() {
        let targetRadius;

        if (this.isOverheated || this.isIced) {
            targetRadius = this.overheatNoseRadius;
        } else if (this.isBoosting) {
            targetRadius = this.noseBoostRadius;
        } else {
            targetRadius = this.noseRadius;
        }

        // Smooth transition
        const diff = targetRadius - this.currentNoseRadius;
        this.currentNoseRadius += diff * 0.1;
    }

    /**
     * Activate nose boost
     */
    activateBoost() {
        if (this.isBoosting || this.isOverheated) return false;

        this.isBoosting = true;

        if (this.boostTimer) {
            clearTimeout(this.boostTimer);
        }

        this.boostTimer = setTimeout(() => {
            this.isBoosting = false;
            this.boostTimer = null;
        }, this.boostDuration);

        return true;
    },

    /**
     * Set overheated state
     */
    setOverheated(isOverheated) {
        this.isOverheated = isOverheated;
    }

    /**
     * Apply ice effect (dims nose)
     */
    applyIce() {
        this.isIced = true;

        if (this.iceTimer) {
            clearTimeout(this.iceTimer);
        }

        this.iceTimer = setTimeout(() => {
            this.isIced = false;
            this.iceTimer = null;
        }, this.iceDuration);
    }

    /**
     * Apply wind force
     */
    applyWind(forceX, forceY) {
        this.windForceX = forceX;
        this.windForceY = forceY;
    }

    /**
     * Clear wind force
     */
    clearWind() {
        this.windForceX = 0;
        this.windForceY = 0;
    }

    /**
     * Handle collision
     */
    handleCollision() {
        if (this.isImmune) return false;

        this.isImmune = true;

        setTimeout(() => {
            this.isImmune = false;
        }, this.immuneDuration);

        return true;
    }

    /**
     * Get nose position (for fog clearing)
     */
    getNosePosition() {
        // Nose is at the front of Rudolf
        const noseOffsetX = this.facingRight ? this.width / 2 : -this.width / 2;
        return {
            x: this.x + noseOffsetX,
            y: this.y
        };
    }

    /**
     * Get current visibility radius
     */
    getVisibilityRadius() {
        return this.currentNoseRadius;
    }

    /**
     * Get bounding box for collision detection
     */
    getBounds() {
        return {
            x: this.x - this.width / 2,
            y: this.y - this.height / 2,
            width: this.width,
            height: this.height
        };
    }

    /**
     * Draw Rudolf on canvas
     */
    draw(ctx) {
        ctx.save();

        // Move to Rudolf's position
        ctx.translate(this.x, this.y);

        // Flip if facing left
        if (!this.facingRight) {
            ctx.scale(-1, 1);
        }

        // Immunity flash effect
        if (this.isImmune && Math.floor(Date.now() / 100) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }

        // Draw body (simple shape for now)
        this.drawBody(ctx);

        // Draw glowing nose
        this.drawNose(ctx);

        ctx.restore();
    }

    /**
     * Draw Rudolf's body
     */
    drawBody(ctx) {
        // Body (brown)
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.ellipse(0, 0, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Legs (animated)
        const legOffset = Math.sin(this.frameIndex * Math.PI / 2) * 5;
        ctx.fillStyle = '#654321';
        ctx.fillRect(-15, this.height / 2 - 5, 6, 15 + legOffset);
        ctx.fillRect(10, this.height / 2 - 5, 6, 15 - legOffset);

        // Antlers
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 3;
        ctx.beginPath();
        // Left antler
        ctx.moveTo(-5, -this.height / 2);
        ctx.lineTo(-10, -this.height / 2 - 15);
        ctx.lineTo(-15, -this.height / 2 - 10);
        ctx.moveTo(-10, -this.height / 2 - 15);
        ctx.lineTo(-5, -this.height / 2 - 20);
        // Right antler
        ctx.moveTo(5, -this.height / 2);
        ctx.lineTo(10, -this.height / 2 - 15);
        ctx.lineTo(15, -this.height / 2 - 10);
        ctx.moveTo(10, -this.height / 2 - 15);
        ctx.lineTo(5, -this.height / 2 - 20);
        ctx.stroke();

        // Eyes
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(10, -5, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(12, -5, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * Draw glowing nose
     */
    drawNose(ctx) {
        const noseX = this.width / 2;
        const noseY = 5;

        // Glow effect
        const glowIntensity = this.isBoosting ? 1.5 : 1;
        const glowColor = this.isOverheated || this.isIced
            ? 'rgba(150, 50, 50, '
            : 'rgba(255, 0, 0, ';

        // Outer glow
        const gradient = ctx.createRadialGradient(noseX, noseY, 0, noseX, noseY, 25 * glowIntensity);
        gradient.addColorStop(0, glowColor + '0.8)');
        gradient.addColorStop(0.5, glowColor + '0.3)');
        gradient.addColorStop(1, glowColor + '0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(noseX, noseY, 25 * glowIntensity, 0, Math.PI * 2);
        ctx.fill();

        // Core nose
        ctx.fillStyle = this.isBoosting ? '#ff3333' : '#ff0000';
        ctx.beginPath();
        ctx.arc(noseX, noseY, 8, 0, Math.PI * 2);
        ctx.fill();

        // Shine
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(noseX - 2, noseY - 2, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * Reset Rudolf for new game/level
     */
    reset(x, y) {
        this.x = x;
        this.y = y;
        this.velocityX = 0;
        this.velocityY = 0;
        this.isBoosting = false;
        this.isOverheated = false;
        this.isIced = false;
        this.isImmune = false;
        this.currentNoseRadius = this.noseRadius;
        this.windForceX = 0;
        this.windForceY = 0;

        if (this.boostTimer) {
            clearTimeout(this.boostTimer);
            this.boostTimer = null;
        }
        if (this.iceTimer) {
            clearTimeout(this.iceTimer);
            this.iceTimer = null;
        }
    }
}

// Export for use in other modules
window.Rudolf = Rudolf;
