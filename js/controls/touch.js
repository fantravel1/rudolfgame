/**
 * Touch Controls - Tap handlers with cross-device compatibility
 * Handles touch, mouse, and pointer events
 */
const TouchControls = {
    enabled: false,
    isInitialized: false,

    // Touch tracking
    lastTap: 0,
    lastTapPosition: { x: 0, y: 0 },

    // Timing thresholds
    doubleTapThreshold: 300,
    holdThreshold: 500,

    // Distance thresholds
    doubleTapDistance: 50,

    // Hold state
    isHolding: false,
    holdTimer: null,
    holdPosition: { x: 0, y: 0 },

    // Radar cooldown
    radarCooldown: 10000,
    lastRadar: 0,

    // Active touches
    activeTouches: new Map(),

    // Target element
    targetElement: null,

    // Event handler references
    _handlers: {},

    // Mouse state (for desktop)
    isMouseDown: false,

    // Callbacks
    onTap: null,
    onDoubleTap: null,
    onHoldStart: null,
    onHoldEnd: null,
    onTwoFingerTap: null,

    /**
     * Initialize touch controls
     */
    init(elementId = 'game-canvas') {
        if (this.isInitialized) return;

        this.targetElement = document.getElementById(elementId);
        if (!this.targetElement) {
            console.warn('Target element not found:', elementId);
            return;
        }

        this.bindEvents();
        this.isInitialized = true;
    },

    /**
     * Bind all input events
     */
    bindEvents() {
        const el = this.targetElement;
        const options = { passive: false };

        // Touch events (mobile)
        this._handlers.touchstart = (e) => this.handleTouchStart(e);
        this._handlers.touchend = (e) => this.handleTouchEnd(e);
        this._handlers.touchmove = (e) => this.handleTouchMove(e);
        this._handlers.touchcancel = (e) => this.handleTouchCancel(e);

        el.addEventListener('touchstart', this._handlers.touchstart, options);
        el.addEventListener('touchend', this._handlers.touchend, options);
        el.addEventListener('touchmove', this._handlers.touchmove, options);
        el.addEventListener('touchcancel', this._handlers.touchcancel, options);

        // Mouse events (desktop fallback)
        this._handlers.mousedown = (e) => this.handleMouseDown(e);
        this._handlers.mouseup = (e) => this.handleMouseUp(e);
        this._handlers.mousemove = (e) => this.handleMouseMove(e);
        this._handlers.mouseleave = (e) => this.handleMouseLeave(e);

        el.addEventListener('mousedown', this._handlers.mousedown, options);
        el.addEventListener('mouseup', this._handlers.mouseup, options);
        el.addEventListener('mousemove', this._handlers.mousemove, options);
        el.addEventListener('mouseleave', this._handlers.mouseleave, options);

        // Prevent context menu on long press
        el.addEventListener('contextmenu', (e) => e.preventDefault());

        // Escape key to pause (desktop)
        this._handlers.keydown = (e) => {
            if (e.code === 'Escape' && this.enabled && this.onTwoFingerTap) {
                this.onTwoFingerTap();
            }
        };
        window.addEventListener('keydown', this._handlers.keydown);
    },

    /**
     * Handle touch start
     */
    handleTouchStart(event) {
        if (!this.enabled) return;
        event.preventDefault();

        const touches = event.touches;

        // Two-finger tap for pause
        if (touches.length === 2) {
            if (this.onTwoFingerTap) {
                this.onTwoFingerTap();
            }
            return;
        }

        if (touches.length === 1) {
            const touch = touches[0];
            this.startInteraction(touch.clientX, touch.clientY, touch.identifier);
        }
    },

    /**
     * Handle touch end
     */
    handleTouchEnd(event) {
        if (!this.enabled) return;
        event.preventDefault();

        const changedTouches = event.changedTouches;
        if (changedTouches.length >= 1) {
            const touch = changedTouches[0];
            this.endInteraction(touch.clientX, touch.clientY, touch.identifier);
        }
    },

    /**
     * Handle touch move
     */
    handleTouchMove(event) {
        if (!this.enabled) return;
        event.preventDefault();

        if (event.touches.length === 1) {
            const touch = event.touches[0];
            this.moveInteraction(touch.clientX, touch.clientY, touch.identifier);
        }
    },

    /**
     * Handle touch cancel
     */
    handleTouchCancel(event) {
        this.cancelInteraction();
    },

    /**
     * Handle mouse down
     */
    handleMouseDown(event) {
        if (!this.enabled || event.button !== 0) return;

        // Skip if touch device (prevents double events)
        if (window.DeviceCompat && DeviceCompat.hasTouch) return;

        event.preventDefault();
        this.isMouseDown = true;
        this.startInteraction(event.clientX, event.clientY, 'mouse');
    },

    /**
     * Handle mouse up
     */
    handleMouseUp(event) {
        if (!this.enabled || event.button !== 0) return;
        if (!this.isMouseDown) return;

        event.preventDefault();
        this.isMouseDown = false;
        this.endInteraction(event.clientX, event.clientY, 'mouse');
    },

    /**
     * Handle mouse move
     */
    handleMouseMove(event) {
        if (!this.enabled || !this.isMouseDown) return;
        this.moveInteraction(event.clientX, event.clientY, 'mouse');
    },

    /**
     * Handle mouse leave
     */
    handleMouseLeave(event) {
        if (this.isMouseDown) {
            this.cancelInteraction();
            this.isMouseDown = false;
        }
    },

    /**
     * Start an interaction
     */
    startInteraction(x, y, id) {
        this.holdPosition = { x, y };
        this.activeTouches.set(id, { x, y, startTime: Date.now() });

        // Start hold timer
        if (this.holdTimer) {
            clearTimeout(this.holdTimer);
        }

        this.holdTimer = setTimeout(() => {
            this.isHolding = true;
            if (this.onHoldStart) {
                this.onHoldStart(x, y);
            }
        }, this.holdThreshold);
    },

    /**
     * End an interaction
     */
    endInteraction(x, y, id) {
        // Clear hold timer
        if (this.holdTimer) {
            clearTimeout(this.holdTimer);
            this.holdTimer = null;
        }

        // Handle hold end
        if (this.isHolding) {
            this.isHolding = false;
            if (this.onHoldEnd) {
                this.onHoldEnd();
            }
            this.activeTouches.delete(id);
            return;
        }

        // Handle tap
        const now = Date.now();
        const timeSinceLastTap = now - this.lastTap;
        const distanceFromLastTap = this.getDistance(
            x, y,
            this.lastTapPosition.x,
            this.lastTapPosition.y
        );

        if (timeSinceLastTap < this.doubleTapThreshold &&
            distanceFromLastTap < this.doubleTapDistance) {
            // Double tap
            this.handleDoubleTap();
            this.lastTap = 0;
        } else {
            // Single tap
            if (this.onTap) {
                this.onTap(x, y);
            }
            this.lastTap = now;
            this.lastTapPosition = { x, y };
        }

        this.activeTouches.delete(id);
    },

    /**
     * Move during interaction
     */
    moveInteraction(x, y, id) {
        // Cancel hold if moved too far
        if (this.holdTimer) {
            const distance = this.getDistance(
                x, y,
                this.holdPosition.x,
                this.holdPosition.y
            );

            if (distance > 20) {
                clearTimeout(this.holdTimer);
                this.holdTimer = null;
            }
        }

        // Update active touch position
        if (this.activeTouches.has(id)) {
            const touch = this.activeTouches.get(id);
            touch.x = x;
            touch.y = y;
        }
    },

    /**
     * Cancel interaction
     */
    cancelInteraction() {
        if (this.holdTimer) {
            clearTimeout(this.holdTimer);
            this.holdTimer = null;
        }
        this.isHolding = false;
        this.activeTouches.clear();
    },

    /**
     * Handle double tap (radar)
     */
    handleDoubleTap() {
        const now = Date.now();
        if (now - this.lastRadar >= this.radarCooldown) {
            this.lastRadar = now;
            if (this.onDoubleTap) {
                this.onDoubleTap();
            }
        }
    },

    /**
     * Calculate distance
     */
    getDistance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    },

    /**
     * Check if radar available
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
     * Convert screen to game coordinates
     */
    screenToGame(screenX, screenY) {
        if (!this.targetElement) return { x: screenX, y: screenY };

        const rect = this.targetElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        return {
            x: (screenX - rect.left) * dpr,
            y: (screenY - rect.top) * dpr
        };
    },

    /**
     * Enable controls
     */
    enable() {
        this.enabled = true;
    },

    /**
     * Disable controls
     */
    disable() {
        this.enabled = false;
        this.cancelInteraction();
        this.isMouseDown = false;
    },

    /**
     * Reset state
     */
    reset() {
        this.lastTap = 0;
        this.lastRadar = 0;
        this.isHolding = false;
        this.isMouseDown = false;
        this.activeTouches.clear();
        this.cancelInteraction();
    },

    /**
     * Cleanup
     */
    destroy() {
        if (!this.targetElement) return;

        const el = this.targetElement;

        // Remove element listeners
        ['touchstart', 'touchend', 'touchmove', 'touchcancel',
         'mousedown', 'mouseup', 'mousemove', 'mouseleave'].forEach(event => {
            if (this._handlers[event]) {
                el.removeEventListener(event, this._handlers[event]);
            }
        });

        // Remove window listeners
        if (this._handlers.keydown) {
            window.removeEventListener('keydown', this._handlers.keydown);
        }

        this._handlers = {};
        this.isInitialized = false;
    }
};

// Export
window.TouchControls = TouchControls;
