/**
 * Tilt Controls - Gyroscope handling for flight controls
 * Uses Device Orientation API to detect phone tilts
 */
const TiltControls = {
    enabled: false,
    hasPermission: false,
    sensitivity: 0.5,                   // Default sensitivity (0.1 - 1.0)

    // Current tilt values
    gamma: 0,                           // Left/right tilt (-90 to 90)
    beta: 0,                            // Front/back tilt (-180 to 180)

    // Calibration offset
    calibration: {
        gamma: 0,
        beta: 0,
        isCalibrated: false
    },

    // Deadzone to prevent drift
    deadzone: 3,

    // Smoothing
    smoothing: 0.15,
    smoothedGamma: 0,
    smoothedBeta: 0,

    // Callbacks
    onUpdate: null,

    /**
     * Check if Device Orientation API is supported
     */
    isSupported() {
        return 'DeviceOrientationEvent' in window;
    },

    /**
     * Request permission for device orientation (required on iOS 13+)
     */
    async requestPermission() {
        if (!this.isSupported()) {
            console.warn('Device orientation not supported');
            return false;
        }

        // iOS 13+ requires explicit permission
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceOrientationEvent.requestPermission();
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
     * Initialize tilt controls
     */
    async init() {
        const granted = await this.requestPermission();
        if (!granted) {
            console.warn('Tilt permission not granted');
            return false;
        }

        this.bindEvents();
        return true;
    },

    /**
     * Bind device orientation events
     */
    bindEvents() {
        window.addEventListener('deviceorientation', (e) => this.handleOrientation(e), true);
    },

    /**
     * Handle device orientation event
     */
    handleOrientation(event) {
        if (!this.enabled) return;

        // Get raw values
        let gamma = event.gamma || 0;   // Left/right tilt
        let beta = event.beta || 0;     // Front/back tilt

        // Apply calibration offset
        if (this.calibration.isCalibrated) {
            gamma -= this.calibration.gamma;
            beta -= this.calibration.beta;
        }

        // Clamp values
        gamma = Math.max(-90, Math.min(90, gamma));
        beta = Math.max(-90, Math.min(90, beta));

        // Apply deadzone
        if (Math.abs(gamma) < this.deadzone) gamma = 0;
        if (Math.abs(beta) < this.deadzone) beta = 0;

        // Store raw values
        this.gamma = gamma;
        this.beta = beta;

        // Apply smoothing (lerp)
        this.smoothedGamma += (gamma - this.smoothedGamma) * this.smoothing;
        this.smoothedBeta += (beta - this.smoothedBeta) * this.smoothing;

        // Notify listeners
        if (this.onUpdate) {
            this.onUpdate({
                gamma: this.smoothedGamma,
                beta: this.smoothedBeta,
                rawGamma: gamma,
                rawBeta: beta
            });
        }
    },

    /**
     * Get velocity based on current tilt
     * @returns {Object} {x, y} velocity values
     */
    getVelocity() {
        const x = this.smoothedGamma * this.sensitivity;
        const y = this.smoothedBeta * this.sensitivity;

        return { x, y };
    },

    /**
     * Start calibration (call when player holds phone in playing position)
     * @param {Function} onProgress - Callback with progress (0-1)
     * @param {Function} onComplete - Callback when calibration is done
     */
    startCalibration(onProgress, onComplete) {
        const samples = [];
        const sampleCount = 30;         // 30 samples over ~3 seconds
        const sampleInterval = 100;     // 100ms between samples

        let samplesTaken = 0;

        const takeSample = () => {
            samples.push({
                gamma: this.gamma,
                beta: this.beta
            });
            samplesTaken++;

            if (onProgress) {
                onProgress(samplesTaken / sampleCount);
            }

            if (samplesTaken < sampleCount) {
                setTimeout(takeSample, sampleInterval);
            } else {
                // Calculate average offset
                const avgGamma = samples.reduce((sum, s) => sum + s.gamma, 0) / samples.length;
                const avgBeta = samples.reduce((sum, s) => sum + s.beta, 0) / samples.length;

                this.calibration.gamma = avgGamma;
                this.calibration.beta = avgBeta;
                this.calibration.isCalibrated = true;

                // Reset smoothed values
                this.smoothedGamma = 0;
                this.smoothedBeta = 0;

                if (onComplete) {
                    onComplete();
                }
            }
        };

        // Need to temporarily enable to get readings
        const wasEnabled = this.enabled;
        this.enabled = true;

        takeSample();
    },

    /**
     * Reset calibration
     */
    resetCalibration() {
        this.calibration.gamma = 0;
        this.calibration.beta = 0;
        this.calibration.isCalibrated = false;
    },

    /**
     * Set tilt sensitivity
     * @param {number} value - Sensitivity from 1-10 (UI scale)
     */
    setSensitivity(value) {
        // Convert UI scale (1-10) to internal scale (0.2 - 1.0)
        this.sensitivity = 0.2 + (value - 1) * 0.089;
    },

    /**
     * Enable tilt controls
     */
    enable() {
        this.enabled = true;
    },

    /**
     * Disable tilt controls
     */
    disable() {
        this.enabled = false;
    },

    /**
     * Reset all values
     */
    reset() {
        this.gamma = 0;
        this.beta = 0;
        this.smoothedGamma = 0;
        this.smoothedBeta = 0;
    }
};

// Export for use in other modules
window.TiltControls = TiltControls;
