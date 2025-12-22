/**
 * Sleigh - Santa's sleigh that follows Rudolf
 * Follows with momentum physics for smooth trailing effect
 */
class Sleigh {
    constructor(rudolf) {
        this.rudolf = rudolf;

        // Position (starts behind Rudolf)
        this.x = rudolf.x - 80;
        this.y = rudolf.y;

        // Size
        this.width = 70;
        this.height = 35;

        // Rope/chain connection
        this.ropeLength = 80;
        this.ropeSegments = 5;

        // Physics - follows with delay
        this.followSpeed = 0.08;            // How quickly it catches up
        this.maxDistance = 120;             // Maximum stretch distance
        this.velocityX = 0;
        this.velocityY = 0;
        this.friction = 0.95;

        // Swing physics
        this.swingAngle = 0;
        this.swingVelocity = 0;
        this.swingDamping = 0.92;
        this.swingForce = 0.002;

        // Collision tracking
        this.hasCollidedThisLevel = false;

        // Animation
        this.bobOffset = 0;
        this.bobSpeed = 0.003;
    }

    /**
     * Update sleigh position following Rudolf
     */
    update(deltaTime) {
        // Target position is behind Rudolf
        const targetX = this.rudolf.x - (this.rudolf.facingRight ? this.ropeLength : -this.ropeLength);
        const targetY = this.rudolf.y;

        // Calculate distance to Rudolf
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Update swing based on Rudolf's velocity
        const rudolfSpeed = Math.abs(this.rudolf.velocityX);
        this.swingVelocity += this.rudolf.velocityX * this.swingForce;
        this.swingVelocity *= this.swingDamping;
        this.swingAngle += this.swingVelocity;

        // Clamp swing angle
        this.swingAngle = Math.max(-0.4, Math.min(0.4, this.swingAngle));

        // Apply spring-like following behavior
        if (distance > 0) {
            const force = Math.min(distance * this.followSpeed, 2);
            this.velocityX += (dx / distance) * force;
            this.velocityY += (dy / distance) * force;
        }

        // If stretched too far, snap back faster
        if (distance > this.maxDistance) {
            const pullBack = (distance - this.maxDistance) * 0.1;
            this.velocityX += (dx / distance) * pullBack;
            this.velocityY += (dy / distance) * pullBack;
        }

        // Apply friction
        this.velocityX *= this.friction;
        this.velocityY *= this.friction;

        // Update position
        this.x += this.velocityX;
        this.y += this.velocityY;

        // Bob animation
        this.bobOffset = Math.sin(Date.now() * this.bobSpeed) * 3;
    }

    /**
     * Get rope points for drawing
     */
    getRopePoints() {
        const points = [];
        const startX = this.rudolf.x - (this.rudolf.facingRight ? this.rudolf.width / 2 : -this.rudolf.width / 2);
        const startY = this.rudolf.y + 10;
        const endX = this.x + (this.rudolf.facingRight ? this.width / 2 : -this.width / 2);
        const endY = this.y;

        for (let i = 0; i <= this.ropeSegments; i++) {
            const t = i / this.ropeSegments;

            // Catenary curve effect (rope sags in middle)
            const sagAmount = Math.sin(t * Math.PI) * 15;

            const x = startX + (endX - startX) * t;
            const y = startY + (endY - startY) * t + sagAmount;

            points.push({ x, y });
        }

        return points;
    }

    /**
     * Get bounding box for collision detection
     */
    getBounds() {
        return {
            x: this.x - this.width / 2,
            y: this.y - this.height / 2 + this.bobOffset,
            width: this.width,
            height: this.height
        };
    }

    /**
     * Handle collision
     */
    handleCollision() {
        if (!this.hasCollidedThisLevel) {
            this.hasCollidedThisLevel = true;
            return true;
        }
        return false;
    }

    /**
     * Check if sleigh has had any collisions this level
     */
    wasUntouched() {
        return !this.hasCollidedThisLevel;
    }

    /**
     * Draw the sleigh
     */
    draw(ctx) {
        // Draw rope first (behind sleigh)
        this.drawRope(ctx);

        ctx.save();
        ctx.translate(this.x, this.y + this.bobOffset);

        // Apply swing rotation
        ctx.rotate(this.swingAngle);

        // Flip based on direction
        if (!this.rudolf.facingRight) {
            ctx.scale(-1, 1);
        }

        // Draw sleigh body
        this.drawBody(ctx);

        ctx.restore();
    }

    /**
     * Draw the rope connecting Rudolf to the sleigh
     */
    drawRope(ctx) {
        const points = this.getRopePoints();

        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }

        ctx.stroke();
    }

    /**
     * Draw sleigh body
     */
    drawBody(ctx) {
        // Runners (bottom curves)
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(-this.width / 2 - 5, this.height / 2);
        ctx.quadraticCurveTo(-this.width / 2, this.height / 2 + 8, -this.width / 2 + 15, this.height / 2);
        ctx.lineTo(this.width / 2, this.height / 2);
        ctx.quadraticCurveTo(this.width / 2 + 10, this.height / 2, this.width / 2 + 5, this.height / 2 - 10);
        ctx.stroke();

        // Sleigh body (red)
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.moveTo(-this.width / 2, 0);
        ctx.lineTo(-this.width / 2, this.height / 2 - 5);
        ctx.lineTo(this.width / 2, this.height / 2 - 5);
        ctx.lineTo(this.width / 2 + 5, -this.height / 4);
        ctx.lineTo(this.width / 2, -this.height / 2);
        ctx.lineTo(-this.width / 2 + 10, -this.height / 2);
        ctx.closePath();
        ctx.fill();

        // Gold trim
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Present sacks
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.ellipse(0, -5, 15, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#34495e';
        ctx.beginPath();
        ctx.ellipse(-15, 0, 10, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Santa silhouette
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(15, -12, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(15, -20, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * Reset sleigh for new game/level
     */
    reset() {
        this.x = this.rudolf.x - this.ropeLength;
        this.y = this.rudolf.y;
        this.velocityX = 0;
        this.velocityY = 0;
        this.swingAngle = 0;
        this.swingVelocity = 0;
        this.hasCollidedThisLevel = false;
    }
}

// Export for use in other modules
window.Sleigh = Sleigh;
