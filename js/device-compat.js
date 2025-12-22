/**
 * Device Compatibility Layer
 * Handles cross-browser and cross-device compatibility
 */
const DeviceCompat = {
    // Device info
    isIOS: false,
    isAndroid: false,
    isSafari: false,
    isChrome: false,
    isFirefox: false,
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    hasTouch: false,
    hasMotion: false,
    hasOrientation: false,
    hasVibration: false,
    pixelRatio: 1,

    // iOS specific
    iosVersion: 0,
    needsMotionPermission: false,

    // Screen info
    screenWidth: 0,
    screenHeight: 0,
    isLandscape: false,
    safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 },

    /**
     * Initialize device detection
     */
    init() {
        this.detectDevice();
        this.detectFeatures();
        this.detectScreen();
        this.setupResizeHandler();
        this.setupOrientationHandler();
        this.applyPolyfills();

        console.log('Device:', this.getDeviceInfo());
    },

    /**
     * Detect device type and browser
     */
    detectDevice() {
        const ua = navigator.userAgent || navigator.vendor || window.opera;

        // iOS detection
        this.isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
        if (this.isIOS) {
            const match = ua.match(/OS (\d+)_/);
            this.iosVersion = match ? parseInt(match[1], 10) : 0;
            // iOS 13+ requires permission for motion/orientation
            this.needsMotionPermission = this.iosVersion >= 13;
        }

        // Android detection
        this.isAndroid = /Android/.test(ua);

        // Browser detection
        this.isSafari = /^((?!chrome|android).)*safari/i.test(ua);
        this.isChrome = /Chrome/.test(ua) && /Google Inc/.test(navigator.vendor);
        this.isFirefox = /Firefox/.test(ua);

        // Device type detection
        this.isMobile = /Mobi|Android/i.test(ua) ||
                        (this.isIOS && !/iPad/.test(ua));
        this.isTablet = /iPad/.test(ua) ||
                        (/Android/.test(ua) && !/Mobi/.test(ua)) ||
                        (window.innerWidth >= 768 && 'ontouchstart' in window);
        this.isDesktop = !this.isMobile && !this.isTablet;

        // Touch detection
        this.hasTouch = 'ontouchstart' in window ||
                        navigator.maxTouchPoints > 0 ||
                        navigator.msMaxTouchPoints > 0;

        // Pixel ratio
        this.pixelRatio = window.devicePixelRatio || 1;
    },

    /**
     * Detect available features
     */
    detectFeatures() {
        // Motion detection (accelerometer)
        this.hasMotion = 'DeviceMotionEvent' in window;

        // Orientation detection (gyroscope)
        this.hasOrientation = 'DeviceOrientationEvent' in window;

        // Vibration API
        this.hasVibration = 'vibrate' in navigator;

        // Check if we're in a secure context (required for some APIs)
        this.isSecureContext = window.isSecureContext ||
                               location.protocol === 'https:' ||
                               location.hostname === 'localhost';
    },

    /**
     * Detect screen dimensions and safe areas
     */
    detectScreen() {
        this.screenWidth = window.innerWidth;
        this.screenHeight = window.innerHeight;
        this.isLandscape = this.screenWidth > this.screenHeight;

        // Detect safe area insets (for notched devices)
        const computedStyle = getComputedStyle(document.documentElement);
        this.safeAreaInsets = {
            top: parseInt(computedStyle.getPropertyValue('--sat') ||
                         computedStyle.getPropertyValue('env(safe-area-inset-top)') || '0'),
            bottom: parseInt(computedStyle.getPropertyValue('--sab') ||
                            computedStyle.getPropertyValue('env(safe-area-inset-bottom)') || '0'),
            left: parseInt(computedStyle.getPropertyValue('--sal') ||
                          computedStyle.getPropertyValue('env(safe-area-inset-left)') || '0'),
            right: parseInt(computedStyle.getPropertyValue('--sar') ||
                           computedStyle.getPropertyValue('env(safe-area-inset-right)') || '0')
        };
    },

    /**
     * Setup resize handler
     */
    setupResizeHandler() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.detectScreen();
                if (this.onResize) this.onResize();
            }, 100);
        });
    },

    /**
     * Setup orientation change handler
     */
    setupOrientationHandler() {
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.detectScreen();
                if (this.onOrientationChange) this.onOrientationChange();
            }, 100);
        });
    },

    /**
     * Apply necessary polyfills
     */
    applyPolyfills() {
        // requestAnimationFrame polyfill
        if (!window.requestAnimationFrame) {
            window.requestAnimationFrame = window.webkitRequestAnimationFrame ||
                                          window.mozRequestAnimationFrame ||
                                          window.msRequestAnimationFrame ||
                                          function(callback) {
                                              return setTimeout(callback, 1000 / 60);
                                          };
        }

        // cancelAnimationFrame polyfill
        if (!window.cancelAnimationFrame) {
            window.cancelAnimationFrame = window.webkitCancelAnimationFrame ||
                                         window.mozCancelAnimationFrame ||
                                         window.msCancelAnimationFrame ||
                                         function(id) { clearTimeout(id); };
        }

        // Performance.now polyfill
        if (!window.performance || !window.performance.now) {
            window.performance = window.performance || {};
            window.performance.now = function() {
                return Date.now();
            };
        }

        // Vibration API fallback
        if (!navigator.vibrate) {
            navigator.vibrate = function() { return false; };
        }
    },

    /**
     * Request motion/orientation permissions (iOS 13+)
     */
    async requestMotionPermission() {
        if (!this.needsMotionPermission) {
            return true;
        }

        try {
            // Request orientation permission
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                const orientationPermission = await DeviceOrientationEvent.requestPermission();
                if (orientationPermission !== 'granted') {
                    return false;
                }
            }

            // Request motion permission
            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                const motionPermission = await DeviceMotionEvent.requestPermission();
                if (motionPermission !== 'granted') {
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error('Motion permission error:', error);
            return false;
        }
    },

    /**
     * Check if motion controls are available
     */
    canUseMotionControls() {
        return (this.hasMotion || this.hasOrientation) &&
               (this.isMobile || this.isTablet) &&
               this.isSecureContext;
    },

    /**
     * Get optimal canvas resolution
     */
    getCanvasResolution() {
        // Limit pixel ratio on high-DPI screens for performance
        const maxPixelRatio = this.isMobile ? 2 : 3;
        const effectiveRatio = Math.min(this.pixelRatio, maxPixelRatio);

        return {
            width: Math.floor(this.screenWidth * effectiveRatio),
            height: Math.floor(this.screenHeight * effectiveRatio),
            ratio: effectiveRatio
        };
    },

    /**
     * Get device info summary
     */
    getDeviceInfo() {
        return {
            platform: this.isIOS ? `iOS ${this.iosVersion}` :
                      this.isAndroid ? 'Android' : 'Desktop',
            browser: this.isSafari ? 'Safari' :
                     this.isChrome ? 'Chrome' :
                     this.isFirefox ? 'Firefox' : 'Other',
            type: this.isMobile ? 'Mobile' :
                  this.isTablet ? 'Tablet' : 'Desktop',
            touch: this.hasTouch,
            motion: this.hasMotion,
            orientation: this.hasOrientation,
            vibration: this.hasVibration,
            screen: `${this.screenWidth}x${this.screenHeight}`,
            pixelRatio: this.pixelRatio
        };
    },

    /**
     * Show fallback controls for desktop or unsupported devices
     */
    needsFallbackControls() {
        return this.isDesktop || !this.canUseMotionControls();
    },

    // Callbacks
    onResize: null,
    onOrientationChange: null
};

// Initialize on load
DeviceCompat.init();

// Export
window.DeviceCompat = DeviceCompat;
