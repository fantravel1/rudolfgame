/**
 * UI Manager - Handles all menu and HUD elements
 * Manages screen transitions and UI updates
 */
const UI = {
    // Screen elements
    screens: {
        start: null,
        permission: null,
        calibration: null,
        game: null,
        success: null,
        failure: null,
        settings: null
    },

    // HUD elements
    hud: {
        score: null,
        timer: null,
        chimneysCurrent: null,
        chimneysTotal: null,
        boostCharges: null,
        levelNumber: null
    },

    // Current state
    currentScreen: 'start',

    // Callbacks
    onPlayClick: null,
    onSettingsClick: null,
    onPermissionGrant: null,
    onPause: null,
    onResume: null,
    onQuit: null,
    onRetry: null,
    onNextLevel: null,
    onCalibrate: null,

    /**
     * Initialize UI
     */
    init() {
        this.cacheElements();
        this.bindEvents();
        this.showScreen('start');
    },

    /**
     * Cache DOM elements
     */
    cacheElements() {
        // Screens
        this.screens.start = document.getElementById('start-screen');
        this.screens.permission = document.getElementById('permission-screen');
        this.screens.calibration = document.getElementById('calibration-screen');
        this.screens.game = document.getElementById('game-screen');
        this.screens.success = document.getElementById('success-screen');
        this.screens.failure = document.getElementById('failure-screen');
        this.screens.settings = document.getElementById('settings-screen');

        // HUD
        this.hud.score = document.getElementById('score-value');
        this.hud.timer = document.getElementById('timer-value');
        this.hud.chimneysCurrent = document.getElementById('chimneys-found');
        this.hud.chimneysTotal = document.getElementById('chimneys-total');
        this.hud.boostCharges = document.getElementById('boost-charges');
        this.hud.levelNumber = document.getElementById('level-number');

        // Pause overlay
        this.pauseOverlay = document.getElementById('pause-overlay');
    },

    /**
     * Bind button events
     */
    bindEvents() {
        // Start screen
        document.getElementById('play-btn')?.addEventListener('click', () => {
            if (this.onPlayClick) this.onPlayClick();
        });

        document.getElementById('settings-btn')?.addEventListener('click', () => {
            if (this.onSettingsClick) this.onSettingsClick();
            this.showScreen('settings');
        });

        // Permission screen
        document.getElementById('grant-permission-btn')?.addEventListener('click', () => {
            if (this.onPermissionGrant) this.onPermissionGrant();
        });

        // Pause overlay
        document.getElementById('resume-btn')?.addEventListener('click', () => {
            if (this.onResume) this.onResume();
            this.hidePause();
        });

        document.getElementById('quit-btn')?.addEventListener('click', () => {
            if (this.onQuit) this.onQuit();
            this.hidePause();
            this.showScreen('start');
        });

        // Result screens
        document.getElementById('next-level-btn')?.addEventListener('click', () => {
            if (this.onNextLevel) this.onNextLevel();
        });

        document.getElementById('retry-btn')?.addEventListener('click', () => {
            if (this.onRetry) this.onRetry();
        });

        // Settings
        document.getElementById('settings-back-btn')?.addEventListener('click', () => {
            this.showScreen('start');
        });

        document.getElementById('calibrate-btn')?.addEventListener('click', () => {
            if (this.onCalibrate) this.onCalibrate();
        });

        // Settings controls
        document.getElementById('tilt-sensitivity')?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (window.TiltControls) {
                TiltControls.setSensitivity(value);
            }
        });

        document.getElementById('shake-sensitivity')?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (window.ShakeDetection) {
                ShakeDetection.setSensitivity(value);
            }
        });

        document.getElementById('haptics-toggle')?.addEventListener('change', (e) => {
            if (window.Haptics) {
                if (e.target.checked) {
                    Haptics.enable();
                } else {
                    Haptics.disable();
                }
            }
        });
    },

    /**
     * Show a specific screen
     */
    showScreen(screenName) {
        // Hide all screens
        Object.values(this.screens).forEach(screen => {
            if (screen) screen.classList.remove('active');
        });

        // Show requested screen
        if (this.screens[screenName]) {
            this.screens[screenName].classList.add('active');
            this.currentScreen = screenName;
        }
    },

    /**
     * Update score display
     */
    updateScore(score) {
        if (this.hud.score) {
            this.hud.score.textContent = score.toLocaleString();
        }
    },

    /**
     * Update timer display
     */
    updateTimer(seconds) {
        if (this.hud.timer) {
            this.hud.timer.textContent = Math.ceil(seconds);

            // Add warning class when low
            const timerElement = this.hud.timer.parentElement;
            if (seconds <= 10) {
                timerElement.classList.add('warning');
            } else {
                timerElement.classList.remove('warning');
            }
        }
    },

    /**
     * Update chimneys count
     */
    updateChimneys(found, total) {
        if (this.hud.chimneysCurrent) {
            this.hud.chimneysCurrent.textContent = found;
        }
        if (this.hud.chimneysTotal) {
            this.hud.chimneysTotal.textContent = total;
        }
    },

    /**
     * Update boost charges display
     */
    updateBoostCharges(charges) {
        if (this.hud.boostCharges) {
            const dots = this.hud.boostCharges.querySelectorAll('.boost-dot');
            dots.forEach((dot, index) => {
                if (index < charges) {
                    dot.classList.add('active');
                } else {
                    dot.classList.remove('active');
                }
            });
        }
    },

    /**
     * Update level number display
     */
    updateLevel(level) {
        if (this.hud.levelNumber) {
            this.hud.levelNumber.textContent = level;
        }
    },

    /**
     * Show pause overlay
     */
    showPause() {
        if (this.pauseOverlay) {
            this.pauseOverlay.classList.remove('hidden');
        }
    },

    /**
     * Hide pause overlay
     */
    hidePause() {
        if (this.pauseOverlay) {
            this.pauseOverlay.classList.add('hidden');
        }
    },

    /**
     * Update calibration progress
     */
    updateCalibrationProgress(progress) {
        const bar = document.querySelector('.calibration-bar');
        if (bar) {
            bar.style.width = `${progress * 100}%`;
        }
    },

    /**
     * Show success screen with stats
     */
    showSuccess(score, timeLeft, stars) {
        document.getElementById('success-score').textContent = score.toLocaleString();
        document.getElementById('success-time').textContent = `${timeLeft}s`;
        document.getElementById('success-rank').textContent = '⭐'.repeat(stars) || '☆';

        this.showScreen('success');
    },

    /**
     * Show failure screen with stats
     */
    showFailure(chimneysFound, chimneysTotal, score) {
        document.getElementById('failure-chimneys').textContent = `${chimneysFound}/${chimneysTotal}`;
        document.getElementById('failure-score').textContent = score.toLocaleString();

        this.showScreen('failure');
    },

    /**
     * Show floating score popup
     */
    showScorePopup(x, y, points, isPerfect = false) {
        const popup = document.createElement('div');
        popup.className = 'score-popup';
        popup.textContent = isPerfect ? `+${points} PERFECT!` : `+${points}`;
        popup.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            color: ${isPerfect ? '#f1c40f' : '#2ecc71'};
            font-size: ${isPerfect ? '24px' : '20px'};
            font-weight: bold;
            pointer-events: none;
            z-index: 1000;
            animation: scorePopup 1s ease-out forwards;
        `;

        document.body.appendChild(popup);

        // Add animation keyframes if not exists
        if (!document.getElementById('score-popup-style')) {
            const style = document.createElement('style');
            style.id = 'score-popup-style';
            style.textContent = `
                @keyframes scorePopup {
                    0% { opacity: 1; transform: translateY(0) scale(1); }
                    100% { opacity: 0; transform: translateY(-50px) scale(1.2); }
                }
            `;
            document.head.appendChild(style);
        }

        setTimeout(() => popup.remove(), 1000);
    },

    /**
     * Show boost activation effect
     */
    showBoostEffect() {
        const effect = document.createElement('div');
        effect.className = 'boost-active';
        document.body.appendChild(effect);
        setTimeout(() => effect.remove(), 300);
    },

    /**
     * Show direction indicator (for radar)
     */
    showDirectionIndicator(angle) {
        // Remove existing indicators
        document.querySelectorAll('.direction-arrow').forEach(el => el.remove());

        const arrow = document.createElement('div');
        arrow.className = 'direction-arrow';
        arrow.textContent = '➤';

        // Position on edge of screen in direction of target
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const radius = Math.min(centerX, centerY) - 50;

        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;

        arrow.style.left = `${x}px`;
        arrow.style.top = `${y}px`;
        arrow.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;

        document.body.appendChild(arrow);

        // Remove after 3 seconds
        setTimeout(() => arrow.remove(), 3000);
    },

    /**
     * Show message toast
     */
    showToast(message, duration = 2000) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 24px;
            border-radius: 25px;
            font-size: 16px;
            z-index: 1000;
            animation: toastIn 0.3s ease-out;
        `;

        if (!document.getElementById('toast-style')) {
            const style = document.createElement('style');
            style.id = 'toast-style';
            style.textContent = `
                @keyframes toastIn {
                    from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'toastIn 0.3s ease-out reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
};

// Export for use in other modules
window.UI = UI;
