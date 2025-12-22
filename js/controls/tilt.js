/**
 * Tilt Controls - Gyroscope handling for flight controls
 * Uses Device Orientation API with cross-device compatibility
 */
const TiltControls = {
    enabled: false,
    hasPermission: false,
    isInitialized: false,
    sensitivity: 0.5,

    // Current tilt values
    gamma: 0,
    beta: 0,

    // Calibration offset
    calibration: {
        gamma: 0,
        beta: 0,
        isCalibrated: false
    },

    // Deadzone and smoothing
    deadzone: 3,
    smoothing: 0.15,
    smoothedGamma: 0,
    smoothedBeta: 0,

    // Fallback keyboard controls
    useFallback: false,
    keyState: { left: false, right: false, up: false, down: false },

    // Event handler reference (for cleanup)
    _orientationHandler: null,
    _keydownHandler: null,
    _keyupHandler: null,

    // Callbacks
    onUpdate: null,

    /**
     * Check if Device Orientation API is supported
     */
    isSupported() {
        return 'DeviceOrientationEvent' in window &&
               window.DeviceCompat &&
               (DeviceCompat.hasOrientation || DeviceCompat.hasMotion);
    },

    /**
     * Request permission for device orientation
     */
    async requestPermission() {
        // Check basic support
        if (!this.isSupported()) {
            console.warn('Device orientation not supported, using fallback');
            this.useFallback = true;
            return true; // Allow game to continue with fallback
        }

        // Check if we need to use fallback (desktop)
        if (window.DeviceCompat && DeviceCompat.needsFallbackControls()) {
            console.log('Using keyboard fallback controls');
            this.useFallback = true;
            return true;
        }

        // iOS 13+ requires explicit permission
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceOrientationEvent.requestPermission();
                this.hasPermission = permission === 'granted';
                if (!this.hasPermission) {
                    console.warn('Orientation permission denied, using fallback');
                    this.useFallback = true;
                }
                return true;
            } catch (error) {
                console.error('Permission request failed:', error);
                this.useFallback = true;
                return true;
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
     * Bind device orientation or fallback events
     */
    bindEvents() {
        if (this.useFallback) {
            this.bindKeyboardEvents();
        } else {
            this.bindOrientationEvents();
        }
    },

    /**
     * Bind device orientation events
     */
    bindOrientationEvents() {
        // Remove existing handler if any
        if (this._orientationHandler) {
            window.removeEventListener('deviceorientation', this._orientationHandler);
        }

        this._orientationHandler = (e) => this.handleOrientation(e);

        // Use both standard and webkit prefixed events
        window.addEventListener('deviceorientation', this._orientationHandler, { passive: true });

        // Some Android browsers use webkitdeviceorientation
        if ('ondeviceorientationabsolute' in window) {
            window.addEventListener('deviceorientationabsolute', this._orientationHandler, { passive: true });
        }
    },

    /**
     * Bind keyboard fallback events
     */
    bindKeyboardEvents() {
        this._keydownHandler = (e) => this.handleKeydown(e);
        this._keyupHandler = (e) => this.handleKeyup(e);

        window.addEventListener('keydown', this._keydownHandler);
        window.addEventListener('keyup', this._keyupHandler);
    },

    /**
     * Handle device orientation event
     */
    handleOrientation(event) {
        if (!this.enabled) return;

        // Get raw values with null checks
        let gamma = event.gamma;
        let beta = event.beta;

        // Handle null/undefined values
        if (gamma === null || gamma === undefined) gamma = 0;
        if (beta === null || beta === undefined) beta = 0;

        // Handle screen orientation (for landscape mode support)
        const screenOrientation = screen.orientation?.angle ||
                                  window.orientation ||
                                  0;

        // Adjust for screen orientation
        if (Math.abs(screenOrientation) === 90) {
            [gamma, beta] = [beta, -gamma];
        } else if (Math.abs(screenOrientation) === 180) {
            gamma = -gamma;
            beta = -beta;
        }

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
     * Handle keydown for fallback controls
     */
    handleKeydown(event) {
        if (!this.enabled) return;

        switch (event.code) {
            case 'ArrowLeft':
            case 'KeyA':
                this.keyState.left = true;
                event.preventDefault();
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.keyState.right = true;
                event.preventDefault();
                break;
            case 'ArrowUp':
            case 'KeyW':
                this.keyState.up = true;
                event.preventDefault();
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.keyState.down = true;
                event.preventDefault();
                break;
        }

        this.updateFromKeyboard();
    },

    /**
     * Handle keyup for fallback controls
     */
    handleKeyup(event) {
        switch (event.code) {
            case 'ArrowLeft':
            case 'KeyA':
                this.keyState.left = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.keyState.right = false;
                break;
            case 'ArrowUp':
            case 'KeyW':
                this.keyState.up = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.keyState.down = false;
                break;
        }

        this.updateFromKeyboard();
    },

    /**
     * Update tilt values from keyboard state
     */
    updateFromKeyboard() {
        const targetGamma = (this.keyState.right ? 30 : 0) - (this.keyState.left ? 30 : 0);
        const targetBeta = (this.keyState.down ? 30 : 0) - (this.keyState.up ? 30 : 0);

        this.gamma = targetGamma;
        this.beta = targetBeta;

        // Apply smoothing
        this.smoothedGamma += (targetGamma - this.smoothedGamma) * 0.2;
        this.smoothedBeta += (targetBeta - this.smoothedBeta) * 0.2;
    },

    /**
     * Get velocity based on current tilt
     */
    getVelocity() {
        // Update from keyboard if using fallback
        if (this.useFallback) {
            this.updateFromKeyboard();
        }

        const x = this.smoothedGamma * this.sensitivity;
        const y = this.smoothedBeta * this.sensitivity;

        return { x, y };
    },

    /**
     * Start calibration
     */
    startCalibration(onProgress, onComplete) {
        if (this.useFallback) {
            // Skip calibration for keyboard
            this.calibration.isCalibrated = true;
            if (onProgress) onProgress(1);
            if (onComplete) onComplete();
            return;
        }

        const samples = [];
        const sampleCount = 30;
        const sampleInterval = 100;
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
                // Filter out outliers
                const validSamples = samples.filter(s =>
                    Math.abs(s.gamma) < 80 && Math.abs(s.beta) < 80
                );

                if (validSamples.length > 0) {
                    const avgGamma = validSamples.reduce((sum, s) => sum + s.gamma, 0) / validSamples.length;
                    const avgBeta = validSamples.reduce((sum, s) => sum + s.beta, 0) / validSamples.length;

                    this.calibration.gamma = avgGamma;
                    this.calibration.beta = avgBeta;
                }

                this.calibration.isCalibrated = true;
                this.smoothedGamma = 0;
                this.smoothedBeta = 0;

                if (onComplete) onComplete();
            }
        };

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
     */
    setSensitivity(value) {
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
     * Check if using fallback controls
     */
    isUsingFallback() {
        return this.useFallback;
    },

    /**
     * Reset all values
     */
    reset() {
        this.gamma = 0;
        this.beta = 0;
        this.smoothedGamma = 0;
        this.smoothedBeta = 0;
        this.keyState = { left: false, right: false, up: false, down: false };
    },

    /**
     * Cleanup event listeners
     */
    destroy() {
        if (this._orientationHandler) {
            window.removeEventListener('deviceorientation', this._orientationHandler);
            window.removeEventListener('deviceorientationabsolute', this._orientationHandler);
        }
        if (this._keydownHandler) {
            window.removeEventListener('keydown', this._keydownHandler);
        }
        if (this._keyupHandler) {
            window.removeEventListener('keyup', this._keyupHandler);
        }
        this.isInitialized = false;
    }
};

// Export
window.TiltControls = TiltControls;
