/**
 * Shake Detection - Accelerometer-based shake detection for boost
 * Uses Device Motion API to detect phone shakes
 */
const ShakeDetection = {
    enabled: false,
    hasPermission: false,
    sensitivity: 15,                    // Shake threshold (lower = more sensitive)

    // Cooldown settings
    cooldown: 2000,                     // 2 seconds between shakes
    lastShake: 0,

    // Boost charges
    maxCharges: 3,
    charges: 3,

    // Overheat mechanic
    isOverheated: false,
    overheatDuration: 5000,             // 5 seconds overheat penalty
    overheatTimer: null,
    shakeCount: 0,                      // Track rapid shakes
    shakeCountWindow: 3000,             // Time window to count shakes
    shakeCountTimer: null,
    maxRapidShakes: 5,                  // Shakes before overheat

    // Motion tracking
    lastAcceleration: { x: 0, y: 0, z: 0 },

    // Callbacks
    onShake: null,
    onOverheat: null,
    onCooldownEnd: null,
    onChargeChange: null,

    /**
     * Check if Device Motion API is supported
     */
    isSupported() {
        return 'DeviceMotionEvent' in window;
    },

    /**
     * Request permission for device motion (required on iOS 13+)
     */
    async requestPermission() {
        if (!this.isSupported()) {
            console.warn('Device motion not supported');
            return false;
        }

        // iOS 13+ requires explicit permission
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceMotionEvent.requestPermission();
                this.hasPermission = permission === 'granted';
                return this.hasPermission;
            } catch (error) {
                console.error('Permission request failed:', error);
                return false;
            }
        }

        // Android and older iOS don't need permission
        this.hasPermission = true;
        return true;
    },

    /**
     * Initialize shake detection
     */
    async init() {
        const granted = await this.requestPermission();
        if (!granted) {
            console.warn('Motion permission not granted');
            return false;
        }

        this.bindEvents();
        return true;
    },

    /**
     * Bind device motion events
     */
    bindEvents() {
        window.addEventListener('devicemotion', (e) => this.handleMotion(e), true);
    },

    /**
     * Handle device motion event
     */
    handleMotion(event) {
        if (!this.enabled || this.isOverheated) return;

        const acceleration = event.accelerationIncludingGravity;
        if (!acceleration) return;

        // Calculate total acceleration change
        const deltaX = Math.abs(acceleration.x - this.lastAcceleration.x);
        const deltaY = Math.abs(acceleration.y - this.lastAcceleration.y);
        const deltaZ = Math.abs(acceleration.z - this.lastAcceleration.z);
        const totalDelta = deltaX + deltaY + deltaZ;

        // Update last acceleration
        this.lastAcceleration = {
            x: acceleration.x || 0,
            y: acceleration.y || 0,
            z: acceleration.z || 0
        };

        // Check for shake
        const now = Date.now();
        const timeSinceLastShake = now - this.lastShake;

        if (totalDelta > this.sensitivity && timeSinceLastShake > this.cooldown) {
            if (this.charges > 0) {
                this.triggerShake();
            }
        }
    },

    /**
     * Trigger a shake event
     */
    triggerShake() {
        const now = Date.now();
        this.lastShake = now;

        // Use a charge
        this.charges--;

        // Track for overheat
        this.shakeCount++;
        this.resetShakeCountTimer();

        // Check for overheat
        if (this.shakeCount >= this.maxRapidShakes) {
            this.overheat();
        }

        // Notify listeners
        if (this.onShake) {
            this.onShake();
        }

        if (this.onChargeChange) {
            this.onChargeChange(this.charges);
        }

        // Haptic feedback
        if (window.Haptics) {
            Haptics.boost();
        }
    },

    /**
     * Reset the shake count timer
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

        // Recover after duration
        this.overheatTimer = setTimeout(() => {
            this.isOverheated = false;
            if (this.onCooldownEnd) {
                this.onCooldownEnd();
            }
        }, this.overheatDuration);
    },

    /**
     * Set shake sensitivity
     * @param {number} value - Sensitivity from 1-10 (UI scale)
     */
    setSensitivity(value) {
        // Convert UI scale (1-10) to threshold (25 - 8)
        // Higher UI value = lower threshold = more sensitive
        this.sensitivity = 25 - (value - 1) * 1.89;
    },

    /**
     * Add a boost charge (from carrot power-up)
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
     * Reset charges for new level
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
     * Get time until next boost is available
     */
    getCooldownRemaining() {
        const elapsed = Date.now() - this.lastShake;
        return Math.max(0, this.cooldown - elapsed);
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
     * Reset state for new game
     */
    reset() {
        this.charges = this.maxCharges;
        this.isOverheated = false;
        this.shakeCount = 0;
        this.lastShake = 0;

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
    }
};

// Export for use in other modules
window.ShakeDetection = ShakeDetection;
