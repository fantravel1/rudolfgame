/**
 * Shake Detection - Accelerometer-based shake detection for boost
 * Uses Device Motion API with cross-device compatibility
 */
const ShakeDetection = {
    enabled: false,
    hasPermission: false,
    isInitialized: false,
    sensitivity: 15,

    // Cooldown settings
    cooldown: 2000,
    lastShake: 0,

    // Boost charges
    maxCharges: 3,
    charges: 3,

    // Overheat mechanic
    isOverheated: false,
    overheatDuration: 5000,
    overheatTimer: null,
    shakeCount: 0,
    shakeCountWindow: 3000,
    shakeCountTimer: null,
    maxRapidShakes: 5,

    // Motion tracking
    lastAcceleration: { x: 0, y: 0, z: 0 },
    accelerationBuffer: [],
    bufferSize: 5,

    // Fallback controls
    useFallback: false,
    _spaceHandler: null,

    // Event handler reference
    _motionHandler: null,

    // Callbacks
    onShake: null,
    onOverheat: null,
    onCooldownEnd: null,
    onChargeChange: null,

    /**
     * Check if Device Motion API is supported
     */
    isSupported() {
        return 'DeviceMotionEvent' in window &&
               window.DeviceCompat &&
               DeviceCompat.hasMotion;
    },

    /**
     * Request permission for device motion
     */
    async requestPermission() {
        if (!this.isSupported()) {
            console.warn('Device motion not supported, using fallback');
            this.useFallback = true;
            return true;
        }

        // Desktop fallback
        if (window.DeviceCompat && DeviceCompat.needsFallbackControls()) {
            this.useFallback = true;
            return true;
        }

        // iOS 13+ requires explicit permission
        if (typeof DeviceMotionEvent !== 'undefined' &&
            typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceMotionEvent.requestPermission();
                this.hasPermission = permission === 'granted';
                if (!this.hasPermission) {
                    this.useFallback = true;
                }
                return true;
            } catch (error) {
                console.error('Motion permission failed:', error);
                this.useFallback = true;
                return true;
            }
        }

        this.hasPermission = true;
        return true;
    },

    /**
     * Initialize shake detection
     */
    async init() {
        if (this.isInitialized) return true;

        const granted = await this.requestPermission();
        if (!granted) {
            return false;
        }

        this.bindEvents();
        this.isInitialized = true;
        return true;
    },

    /**
     * Bind events
     */
    bindEvents() {
        if (this.useFallback) {
            this.bindKeyboardEvents();
        } else {
            this.bindMotionEvents();
        }
    },

    /**
     * Bind device motion events
     */
    bindMotionEvents() {
        if (this._motionHandler) {
            window.removeEventListener('devicemotion', this._motionHandler);
        }

        this._motionHandler = (e) => this.handleMotion(e);
        window.addEventListener('devicemotion', this._motionHandler, { passive: true });
    },

    /**
     * Bind keyboard fallback (spacebar for boost)
     */
    bindKeyboardEvents() {
        this._spaceHandler = (e) => {
            if (e.code === 'Space' && this.enabled) {
                e.preventDefault();
                this.manualTrigger();
            }
        };
        window.addEventListener('keydown', this._spaceHandler);
    },

    /**
     * Handle device motion event
     */
    handleMotion(event) {
        if (!this.enabled || this.isOverheated) return;

        // Get acceleration with fallback
        const acceleration = event.accelerationIncludingGravity ||
                            event.acceleration ||
                            { x: 0, y: 0, z: 0 };

        if (!acceleration || acceleration.x === null) return;

        const current = {
            x: acceleration.x || 0,
            y: acceleration.y || 0,
            z: acceleration.z || 0
        };

        // Calculate delta
        const deltaX = Math.abs(current.x - this.lastAcceleration.x);
        const deltaY = Math.abs(current.y - this.lastAcceleration.y);
        const deltaZ = Math.abs(current.z - this.lastAcceleration.z);
        const totalDelta = deltaX + deltaY + deltaZ;

        // Add to buffer for smoothing
        this.accelerationBuffer.push(totalDelta);
        if (this.accelerationBuffer.length > this.bufferSize) {
            this.accelerationBuffer.shift();
        }

        // Get average acceleration
        const avgDelta = this.accelerationBuffer.reduce((a, b) => a + b, 0) /
                        this.accelerationBuffer.length;

        // Update last acceleration
        this.lastAcceleration = current;

        // Check for shake
        const now = Date.now();
        const timeSinceLastShake = now - this.lastShake;

        if (avgDelta > this.sensitivity && timeSinceLastShake > this.cooldown) {
            if (this.charges > 0) {
                this.triggerShake();
            }
        }
    },

    /**
     * Manual trigger (for fallback or button)
     */
    manualTrigger() {
        if (!this.enabled || this.isOverheated) return;

        const now = Date.now();
        const timeSinceLastShake = now - this.lastShake;

        if (timeSinceLastShake > this.cooldown && this.charges > 0) {
            this.triggerShake();
        }
    },

    /**
     * Trigger a shake event
     */
    triggerShake() {
        const now = Date.now();
        this.lastShake = now;
        this.charges--;

        // Track for overheat
        this.shakeCount++;
        this.resetShakeCountTimer();

        if (this.shakeCount >= this.maxRapidShakes) {
            this.overheat();
        }

        if (this.onShake) {
            this.onShake();
        }

        if (this.onChargeChange) {
            this.onChargeChange(this.charges);
        }

        if (window.Haptics) {
            Haptics.boost();
        }
    },

    /**
     * Reset shake count timer
     */
    resetShakeCountTimer() {
        if (this.shakeCountTimer) {
            clearTimeout(this.shakeCountTimer);
        }

        this.shakeCountTimer = setTimeout(() => {
            this.shakeCount = 0;
        }, this.shakeCountWindow);
    },

    /**
     * Trigger overheat state
     */
    overheat() {
        this.isOverheated = true;
        this.shakeCount = 0;

        if (this.onOverheat) {
            this.onOverheat();
        }

        this.overheatTimer = setTimeout(() => {
            this.isOverheated = false;
            if (this.onCooldownEnd) {
                this.onCooldownEnd();
            }
        }, this.overheatDuration);
    },

    /**
     * Set shake sensitivity
     */
    setSensitivity(value) {
        this.sensitivity = 25 - (value - 1) * 1.89;
    },

    /**
     * Add a boost charge
     */
    addCharge() {
        if (this.charges < this.maxCharges) {
            this.charges++;
            if (this.onChargeChange) {
                this.onChargeChange(this.charges);
            }
        }
    },

    /**
     * Reset charges
     */
    resetCharges() {
        this.charges = this.maxCharges;
        if (this.onChargeChange) {
            this.onChargeChange(this.charges);
        }
    },

    /**
     * Check if boost is available
     */
    canBoost() {
        return this.charges > 0 && !this.isOverheated &&
               (Date.now() - this.lastShake) > this.cooldown;
    },

    /**
     * Get cooldown remaining
     */
    getCooldownRemaining() {
        const elapsed = Date.now() - this.lastShake;
        return Math.max(0, this.cooldown - elapsed);
    },

    /**
     * Check if using fallback
     */
    isUsingFallback() {
        return this.useFallback;
    },

    /**
     * Enable shake detection
     */
    enable() {
        this.enabled = true;
    },

    /**
     * Disable shake detection
     */
    disable() {
        this.enabled = false;
    },

    /**
     * Reset state
     */
    reset() {
        this.charges = this.maxCharges;
        this.isOverheated = false;
        this.shakeCount = 0;
        this.lastShake = 0;
        this.accelerationBuffer = [];

        if (this.overheatTimer) {
            clearTimeout(this.overheatTimer);
            this.overheatTimer = null;
        }

        if (this.shakeCountTimer) {
            clearTimeout(this.shakeCountTimer);
            this.shakeCountTimer = null;
        }

        if (this.onChargeChange) {
            this.onChargeChange(this.charges);
        }
    },

    /**
     * Cleanup
     */
    destroy() {
        if (this._motionHandler) {
            window.removeEventListener('devicemotion', this._motionHandler);
        }
        if (this._spaceHandler) {
            window.removeEventListener('keydown', this._spaceHandler);
        }
        this.isInitialized = false;
    }
};

// Export
window.ShakeDetection = ShakeDetection;
