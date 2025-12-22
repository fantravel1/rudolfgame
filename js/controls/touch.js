/**
 * Touch Controls - Tap handlers for game interactions
 * Handles tap, double-tap, hold, and two-finger gestures
 */
const TouchControls = {
    enabled: false,

    // Touch tracking
    touches: [],
    lastTap: 0,
    lastTapPosition: { x: 0, y: 0 },

    // Timing thresholds (ms)
    doubleTapThreshold: 300,
    holdThreshold: 500,

    // Distance thresholds (px)
    doubleTapDistance: 50,

    // Hold state
    isHolding: false,
    holdTimer: null,
    holdPosition: { x: 0, y: 0 },

    // Double-tap radar cooldown
    radarCooldown: 10000,               // 10 seconds
    lastRadar: 0,

    // Callbacks
    onTap: null,                        // (x, y) - Single tap
    onDoubleTap: null,                  // () - Double tap for radar
    onHoldStart: null,                  // (x, y) - Hold started
    onHoldEnd: null,                    // () - Hold ended
    onTwoFingerTap: null,               // () - Pause gesture

    /**
     * Initialize touch controls
     */
    init() {
        this.bindEvents();
    },

    /**
     * Bind touch events
     */
    bindEvents() {
        const canvas = document.getElementById('game-canvas');
        if (!canvas) {
            console.warn('Game canvas not found for touch controls');
            return;
        }

        canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        canvas.addEventListener('touchcancel', (e) => this.handleTouchCancel(e), { passive: false });
    },

    /**
     * Handle touch start
     */
    handleTouchStart(event) {
        if (!this.enabled) return;
        event.preventDefault();

        const touches = event.touches;

        // Check for two-finger tap (pause)
        if (touches.length === 2) {
            if (this.onTwoFingerTap) {
                this.onTwoFingerTap();
            }
            return;
        }

        // Single touch
        if (touches.length === 1) {
            const touch = touches[0];
            const x = touch.clientX;
            const y = touch.clientY;

            this.holdPosition = { x, y };

            // Start hold timer
            this.holdTimer = setTimeout(() => {
                this.isHolding = true;
                if (this.onHoldStart) {
                    this.onHoldStart(x, y);
                }
            }, this.holdThreshold);
        }
    },

    /**
     * Handle touch end
     */
    handleTouchEnd(event) {
        if (!this.enabled) return;
        event.preventDefault();

        // Clear hold timer
        if (this.holdTimer) {
            clearTimeout(this.holdTimer);
            this.holdTimer = null;
        }

        // Check if was holding
        if (this.isHolding) {
            this.isHolding = false;
            if (this.onHoldEnd) {
                this.onHoldEnd();
            }
            return;
        }

        // Handle tap
        const changedTouches = event.changedTouches;
        if (changedTouches.length === 1) {
            const touch = changedTouches[0];
            const x = touch.clientX;
            const y = touch.clientY;
            const now = Date.now();

            // Check for double-tap
            const timeSinceLastTap = now - this.lastTap;
            const distanceFromLastTap = this.getDistance(
                x, y,
                this.lastTapPosition.x,
                this.lastTapPosition.y
            );

            if (timeSinceLastTap < this.doubleTapThreshold &&
                distanceFromLastTap < this.doubleTapDistance) {
                // Double tap detected
                this.handleDoubleTap();
                this.lastTap = 0; // Reset to prevent triple-tap
            } else {
                // Single tap
                this.handleTap(x, y);
                this.lastTap = now;
                this.lastTapPosition = { x, y };
            }
        }
    },

    /**
     * Handle touch move
     */
    handleTouchMove(event) {
        if (!this.enabled) return;
        event.preventDefault();

        // Cancel hold if moved too far
        if (this.holdTimer) {
            const touch = event.touches[0];
            const distance = this.getDistance(
                touch.clientX,
                touch.clientY,
                this.holdPosition.x,
                this.holdPosition.y
            );

            if (distance > 20) {
                clearTimeout(this.holdTimer);
                this.holdTimer = null;
            }
        }
    },

    /**
     * Handle touch cancel
     */
    handleTouchCancel(event) {
        if (this.holdTimer) {
            clearTimeout(this.holdTimer);
            this.holdTimer = null;
        }
        this.isHolding = false;
    },

    /**
     * Handle single tap
     */
    handleTap(x, y) {
        if (this.onTap) {
            this.onTap(x, y);
        }
    },

    /**
     * Handle double tap (radar ping)
     */
    handleDoubleTap() {
        const now = Date.now();
        const timeSinceLastRadar = now - this.lastRadar;

        if (timeSinceLastRadar >= this.radarCooldown) {
            this.lastRadar = now;
            if (this.onDoubleTap) {
                this.onDoubleTap();
            }
        }
    },

    /**
     * Calculate distance between two points
     */
    getDistance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    },

    /**
     * Check if radar is available
     */
    canUseRadar() {
        return (Date.now() - this.lastRadar) >= this.radarCooldown;
    },

    /**
     * Get radar cooldown remaining
     */
    getRadarCooldown() {
        const elapsed = Date.now() - this.lastRadar;
        return Math.max(0, this.radarCooldown - elapsed);
    },

    /**
     * Convert screen coordinates to game coordinates
     */
    screenToGame(screenX, screenY, canvas, game) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (screenX - rect.left) * scaleX,
            y: (screenY - rect.top) * scaleY
        };
    },

    /**
     * Enable touch controls
     */
    enable() {
        this.enabled = true;
    },

    /**
     * Disable touch controls
     */
    disable() {
        this.enabled = false;
        if (this.holdTimer) {
            clearTimeout(this.holdTimer);
            this.holdTimer = null;
        }
        this.isHolding = false;
    },

    /**
     * Reset state for new game
     */
    reset() {
        this.lastTap = 0;
        this.lastRadar = 0;
        this.isHolding = false;
        if (this.holdTimer) {
            clearTimeout(this.holdTimer);
            this.holdTimer = null;
        }
    }
};

// Export for use in other modules
window.TouchControls = TouchControls;
