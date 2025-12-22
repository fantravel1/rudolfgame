/**
 * Haptics - Vibration feedback patterns
 * Provides tactile feedback for game events
 */
const Haptics = {
    enabled: true,

    // Vibration patterns (in milliseconds)
    patterns: {
        chimneyNear: [50],                          // Quick pulse - chimney nearby
        chimneyFound: [50, 50, 50],                 // Double pulse - chimney in view
        boost: [100, 50, 100],                      // Boost activation
        windWarning: [200],                         // Long buzz - wind gust incoming
        timeWarning: [100, 100, 100, 100, 100],     // Urgent - 10 seconds left
        success: [50, 100, 50, 100, 200],           // Present delivered
        gameOver: [500],                            // Sad buzz
        powerUp: [30, 30, 30],                      // Sparkle collect
        collision: [150],                           // Sharp buzz - hit obstacle
        cold: [50, 200, 50, 200, 50],               // Ice cloud pattern
        miss: [300]                                 // Missed chimney
    },

    /**
     * Check if vibration API is supported
     */
    isSupported() {
        return 'vibrate' in navigator;
    },

    /**
     * Enable haptic feedback
     */
    enable() {
        this.enabled = true;
    },

    /**
     * Disable haptic feedback
     */
    disable() {
        this.enabled = false;
    },

    /**
     * Toggle haptic feedback
     */
    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    },

    /**
     * Vibrate with a specific pattern
     * @param {string|number[]} pattern - Pattern name or custom pattern array
     */
    vibrate(pattern) {
        if (!this.enabled || !this.isSupported()) return;

        const vibrationPattern = typeof pattern === 'string'
            ? this.patterns[pattern]
            : pattern;

        if (vibrationPattern) {
            try {
                navigator.vibrate(vibrationPattern);
            } catch (e) {
                console.warn('Vibration failed:', e);
            }
        }
    },

    /**
     * Stop any ongoing vibration
     */
    stop() {
        if (this.isSupported()) {
            navigator.vibrate(0);
        }
    },

    /**
     * Quick single pulse
     */
    pulse() {
        this.vibrate([50]);
    },

    /**
     * Notify chimney is nearby (getting warmer)
     */
    chimneyNear() {
        this.vibrate('chimneyNear');
    },

    /**
     * Notify chimney is in view - tap now!
     */
    chimneyFound() {
        this.vibrate('chimneyFound');
    },

    /**
     * Boost activated feedback
     */
    boost() {
        this.vibrate('boost');
    },

    /**
     * Wind gust warning
     */
    windWarning() {
        this.vibrate('windWarning');
    },

    /**
     * 10 seconds remaining warning
     */
    timeWarning() {
        this.vibrate('timeWarning');
    },

    /**
     * Present successfully delivered
     */
    success() {
        this.vibrate('success');
    },

    /**
     * Game over vibration
     */
    gameOver() {
        this.vibrate('gameOver');
    },

    /**
     * Power-up collected
     */
    powerUp() {
        this.vibrate('powerUp');
    },

    /**
     * Collision with obstacle
     */
    collision() {
        this.vibrate('collision');
    },

    /**
     * Ice cloud effect
     */
    cold() {
        this.vibrate('cold');
    },

    /**
     * Missed a chimney
     */
    miss() {
        this.vibrate('miss');
    }
};

// Export for use in other modules
window.Haptics = Haptics;
