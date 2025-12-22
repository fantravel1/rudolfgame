/**
 * Rudolf Game - Main Game Controller
 * Orchestrates all game systems and manages the game loop
 * Cross-device compatible with fallback controls
 */
const Game = {
    // Canvas and context
    canvas: null,
    ctx: null,

    // Game dimensions
    width: 0,
    height: 0,

    // Game state
    state: 'menu',
    isRunning: false,
    isInitialized: false,

    // Game time
    lastTime: 0,
    deltaTime: 0,
    timer: 0,
    timeWarningPlayed: false,

    // Frame rate management
    targetFPS: 60,
    frameInterval: 1000 / 60,
    lastFrameTime: 0,

    // Score tracking
    score: 0,
    boostsUsed: 0,
    radarUsed: false,

    // Game objects
    rudolf: null,
    sleigh: null,
    fogSystem: null,
    chimneySystem: null,
    powerUpSystem: null,

    // Current level
    currentLevel: null,

    // Background
    backgroundStars: [],

    // Control mode
    usingFallbackControls: false,

    // Animation frame ID
    animationFrameId: null,

    /**
     * Initialize the game
     */
    async init() {
        if (this.isInitialized) return;

        try {
            // Get canvas
            this.canvas = document.getElementById('game-canvas');
            if (!this.canvas) {
                throw new Error('Game canvas not found');
            }

            this.ctx = this.canvas.getContext('2d', {
                alpha: false,
                desynchronized: true
            });

            if (!this.ctx) {
                throw new Error('Could not get canvas context');
            }

            // Set canvas size
            this.resize();
            window.addEventListener('resize', () => this.handleResize());
            window.addEventListener('orientationchange', () => {
                setTimeout(() => this.handleResize(), 100);
            });

            // Check device compatibility
            this.checkDeviceCompatibility();

            // Initialize UI
            UI.init();
            this.setupUICallbacks();

            // Setup boost button for desktop/fallback
            this.setupBoostButton();

            // Initialize background
            this.initBackground();

            // Load saved progress
            Levels.load();

            this.isInitialized = true;
            console.log('Rudolf Game initialized!', {
                device: window.DeviceCompat?.getDeviceInfo(),
                fallback: this.usingFallbackControls
            });

        } catch (error) {
            console.error('Game initialization failed:', error);
            this.showError('Failed to initialize game. Please refresh the page.');
        }
    },

    /**
     * Check device compatibility
     */
    checkDeviceCompatibility() {
        if (window.DeviceCompat) {
            this.usingFallbackControls = DeviceCompat.needsFallbackControls();

            if (this.usingFallbackControls) {
                document.body.classList.add('desktop-mode');
                // Hide motion-related settings
                const tiltSettings = document.getElementById('tilt-settings');
                const shakeSettings = document.getElementById('shake-settings');
                const hapticsSettings = document.getElementById('haptics-settings');
                const calibrateBtn = document.getElementById('calibrate-btn');

                if (tiltSettings) tiltSettings.style.display = 'none';
                if (shakeSettings) shakeSettings.style.display = 'none';
                if (hapticsSettings) hapticsSettings.style.display = 'none';
                if (calibrateBtn) calibrateBtn.style.display = 'none';
            }
        }
    },

    /**
     * Setup boost button for desktop/fallback mode
     */
    setupBoostButton() {
        const boostBtn = document.getElementById('boost-button');
        if (boostBtn) {
            boostBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.state === 'playing') {
                    ShakeDetection.manualTrigger();
                }
            });

            boostBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (this.state === 'playing') {
                    ShakeDetection.manualTrigger();
                }
            }, { passive: false });
        }
    },

    /**
     * Show error message
     */
    showError(message) {
        const container = document.getElementById('game-container');
        if (container) {
            container.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center;
                            justify-content: center; height: 100%; padding: 20px; text-align: center;">
                    <h2 style="color: #e74c3c; margin-bottom: 20px;">Oops!</h2>
                    <p style="color: #b0b0b0; margin-bottom: 20px;">${message}</p>
                    <button onclick="location.reload()"
                            style="padding: 15px 30px; background: #e74c3c; color: white;
                                   border: none; border-radius: 25px; cursor: pointer; font-size: 16px;">
                        Reload Game
                    </button>
                </div>
            `;
        }
    },

    /**
     * Set up UI callbacks
     */
    setupUICallbacks() {
        UI.onPlayClick = () => this.handlePlayClick();
        UI.onSettingsClick = () => this.state = 'settings';
        UI.onPermissionGrant = () => this.requestPermissions();
        UI.onPause = () => this.pause();
        UI.onResume = () => this.resume();
        UI.onQuit = () => this.quit();
        UI.onRetry = () => this.startLevel(Levels.currentLevel);
        UI.onNextLevel = () => this.startLevel(Levels.currentLevel + 1);
        UI.onCalibrate = () => this.calibrate();
    },

    /**
     * Handle play button click
     */
    async handlePlayClick() {
        try {
            // Desktop/fallback mode - skip permissions and calibration
            if (this.usingFallbackControls) {
                await TiltControls.init();
                await ShakeDetection.init();
                this.startLevel(Levels.currentLevel);
                return;
            }

            // Mobile - check permissions
            if (!TiltControls.hasPermission) {
                // iOS 13+ requires user gesture for permission
                if (window.DeviceCompat && DeviceCompat.needsMotionPermission) {
                    UI.showScreen('permission');
                } else {
                    await this.requestPermissions();
                }
            } else if (!TiltControls.calibration.isCalibrated) {
                this.calibrate();
            } else {
                this.startLevel(Levels.currentLevel);
            }
        } catch (error) {
            console.error('Error starting game:', error);
            // Fallback to keyboard controls
            this.usingFallbackControls = true;
            document.body.classList.add('desktop-mode');
            TiltControls.useFallback = true;
            ShakeDetection.useFallback = true;
            await TiltControls.init();
            await ShakeDetection.init();
            this.startLevel(Levels.currentLevel);
        }
    },

    /**
     * Request motion permissions
     */
    async requestPermissions() {
        try {
            const tiltGranted = await TiltControls.init();
            const shakeGranted = await ShakeDetection.init();

            if (TiltControls.useFallback || ShakeDetection.useFallback) {
                this.usingFallbackControls = true;
                document.body.classList.add('desktop-mode');
                this.startLevel(Levels.currentLevel);
            } else if (tiltGranted && shakeGranted) {
                this.calibrate();
            } else {
                UI.showToast('Using keyboard controls');
                this.usingFallbackControls = true;
                document.body.classList.add('desktop-mode');
                this.startLevel(Levels.currentLevel);
            }
        } catch (error) {
            console.error('Permission request failed:', error);
            this.usingFallbackControls = true;
            document.body.classList.add('desktop-mode');
            this.startLevel(Levels.currentLevel);
        }
    },

    /**
     * Calibrate tilt controls
     */
    calibrate() {
        if (this.usingFallbackControls) {
            this.startLevel(Levels.currentLevel);
            return;
        }

        UI.showScreen('calibration');
        TiltControls.enable();

        TiltControls.startCalibration(
            (progress) => {
                UI.updateCalibrationProgress(progress);
            },
            () => {
                console.log('Calibration complete, starting level...');
                UI.showToast('Calibration complete!');
                // Small delay to ensure UI updates are processed
                setTimeout(() => {
                    this.startLevel(Levels.currentLevel);
                }, 100);
            }
        );
    },

    /**
     * Start a specific level
     */
    startLevel(levelNumber) {
        console.log('Starting level:', levelNumber);
        try {
            Levels.setLevel(levelNumber);
            this.currentLevel = Levels.getCurrentConfig();
            console.log('Level config:', this.currentLevel);

            // Reset score and tracking
            this.score = 0;
            this.timer = this.currentLevel.time;
            this.boostsUsed = 0;
            this.radarUsed = false;
            this.timeWarningPlayed = false;

            // Initialize or reset game objects
            this.initGameObjects();

            // Set fog density
            this.fogSystem.setDensity(this.currentLevel.fog);

            // Spawn chimneys and power-ups
            this.chimneySystem.spawnChimneys(this.currentLevel.chimneys);
            this.powerUpSystem.spawnPowerups(this.currentLevel.powerups);

            // Update UI
            UI.updateScore(this.score);
            UI.updateTimer(this.timer);
            UI.updateChimneys(0, this.currentLevel.chimneys);
            UI.updateLevel(levelNumber);
            UI.updateBoostCharges(3);

            // Start game
            console.log('Showing game screen...');
            UI.showScreen('game');
            this.state = 'playing';
            this.isRunning = true;
            console.log('Game state:', this.state, 'isRunning:', this.isRunning);

            // Enable controls
            TiltControls.enable();
            ShakeDetection.enable();
            ShakeDetection.reset();
            TouchControls.init('game-canvas');
            TouchControls.enable();

            // Set up control callbacks
            this.setupControlCallbacks();

            // Cancel any existing animation frame
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
            }

            // Start game loop
            this.lastTime = performance.now();
            this.lastFrameTime = this.lastTime;
            this.animationFrameId = requestAnimationFrame((time) => this.gameLoop(time));

        } catch (error) {
            console.error('Error starting level:', error);
            this.showError('Failed to start level. Please try again.');
        }
    },

    /**
     * Initialize game objects
     */
    initGameObjects() {
        const startX = this.width / 2;
        const startY = this.height / 2;

        if (this.rudolf) {
            this.rudolf.reset(startX, startY);
        } else {
            this.rudolf = new Rudolf(startX, startY);
        }
        this.rudolf.setBounds(this.width, this.height);

        if (this.sleigh) {
            this.sleigh.reset();
        } else {
            this.sleigh = new Sleigh(this.rudolf);
        }

        if (this.fogSystem) {
            this.fogSystem.reset();
            this.fogSystem.resize(this.width, this.height);
        } else {
            this.fogSystem = new FogSystem(this.width, this.height);
        }

        if (this.chimneySystem) {
            this.chimneySystem.reset();
            this.chimneySystem.width = this.width;
            this.chimneySystem.height = this.height;
        } else {
            this.chimneySystem = new ChimneySystem(this.width, this.height);
        }
        this.setupChimneyCallbacks();

        if (this.powerUpSystem) {
            this.powerUpSystem.reset();
            this.powerUpSystem.width = this.width;
            this.powerUpSystem.height = this.height;
        } else {
            this.powerUpSystem = new PowerUpSystem(this.width, this.height);
        }
        this.setupPowerUpCallbacks();
    },

    /**
     * Set up control callbacks
     */
    setupControlCallbacks() {
        ShakeDetection.onShake = () => {
            if (this.state === 'playing') {
                this.activateBoost();
            }
        };

        ShakeDetection.onOverheat = () => {
            this.rudolf.setOverheated(true);
            UI.showToast('Nose overheated! Wait to recover...');
        };

        ShakeDetection.onCooldownEnd = () => {
            this.rudolf.setOverheated(false);
        };

        ShakeDetection.onChargeChange = (charges) => {
            UI.updateBoostCharges(charges);
        };

        TouchControls.onTap = (x, y) => {
            this.handleTap(x, y);
        };

        TouchControls.onDoubleTap = () => {
            this.activateRadar();
        };

        TouchControls.onTwoFingerTap = () => {
            this.pause();
        };
    },

    /**
     * Set up chimney callbacks
     */
    setupChimneyCallbacks() {
        this.chimneySystem.onDelivery = (data) => {
            const points = data.isPerfect ? 150 : 100;
            this.addScore(points);
            UI.updateChimneys(data.delivered, data.total);

            const rect = this.canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            UI.showScorePopup(
                rect.left + (data.chimney.x / dpr),
                rect.top + (data.chimney.y / dpr),
                points,
                data.isPerfect
            );
        };

        this.chimneySystem.onAllDelivered = () => {
            this.handleLevelComplete();
        };
    },

    /**
     * Set up power-up callbacks
     */
    setupPowerUpCallbacks() {
        this.powerUpSystem.onCollect = (data) => {
            this.addScore(data.typeData.points);

            switch (data.typeData.effect) {
                case 'boost_charge':
                    ShakeDetection.addCharge();
                    UI.showToast('🥕 +1 Boost Charge!');
                    break;
                case 'time':
                    this.timer += data.typeData.value;
                    UI.showToast(`⏰ +${data.typeData.value} seconds!`);
                    break;
                case 'reveal':
                    this.fogSystem.revealAll(data.typeData.duration);
                    UI.showToast('🔔 All chimneys revealed!');
                    break;
                case 'visibility':
                    UI.showToast('⭐ 2x visibility!');
                    break;
                case 'wind_immunity':
                    UI.showToast('☕ Wind immunity!');
                    break;
                case 'chimney_glow':
                    UI.showToast('🧲 Chimneys glow brighter!');
                    break;
            }
        };
    },

    /**
     * Activate nose boost
     */
    activateBoost() {
        if (this.rudolf.activateBoost()) {
            this.boostsUsed++;
            UI.showBoostEffect();

            const nosePos = this.rudolf.getNosePosition();
            this.fogSystem.addBoostBurst(nosePos.x, nosePos.y, this.rudolf.noseBoostRadius);
        }
    },

    /**
     * Activate radar (double-tap)
     */
    activateRadar() {
        if (!TouchControls.canUseRadar()) return;

        this.radarUsed = true;

        const nearest = this.chimneySystem.getNearestDirection(this.rudolf.x, this.rudolf.y);
        if (nearest) {
            UI.showDirectionIndicator(nearest.angle);
            if (window.Haptics) Haptics.pulse();
        } else {
            UI.showToast('All chimneys found!');
        }
    },

    /**
     * Handle tap on game canvas
     */
    handleTap(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const x = (screenX - rect.left) * dpr;
        const y = (screenY - rect.top) * dpr;

        this.chimneySystem.checkTap(x, y);
    },

    /**
     * Add to score
     */
    addScore(points) {
        this.score += points;
        UI.updateScore(this.score);
    },

    /**
     * Main game loop
     */
    gameLoop(currentTime) {
        if (!this.isRunning) return;

        // Calculate delta time with cap to prevent huge jumps
        this.deltaTime = Math.min(currentTime - this.lastTime, 100);
        this.lastTime = currentTime;

        if (this.state === 'playing') {
            this.update(this.deltaTime);
        }

        this.render();

        this.animationFrameId = requestAnimationFrame((time) => this.gameLoop(time));
    },

    /**
     * Update game state
     */
    update(deltaTime) {
        // Update timer
        this.timer -= deltaTime / 1000;
        UI.updateTimer(this.timer);

        // Time warning
        if (this.timer <= 10 && !this.timeWarningPlayed) {
            this.timeWarningPlayed = true;
            if (window.Haptics) Haptics.timeWarning();
        }

        // Check time out
        if (this.timer <= 0) {
            this.handleTimeOut();
            return;
        }

        // Get tilt velocity
        const tiltVelocity = TiltControls.getVelocity();

        // Apply power-up effects
        const visibilityMultiplier = this.powerUpSystem.getVisibilityMultiplier();

        // Update Rudolf
        this.rudolf.update(deltaTime, tiltVelocity);

        // Update nose visibility
        const nosePos = this.rudolf.getNosePosition();
        const noseRadius = this.rudolf.getVisibilityRadius() * visibilityMultiplier;
        this.fogSystem.setNoseVisibility(nosePos.x, nosePos.y, noseRadius);

        // Update sleigh
        this.sleigh.update(deltaTime);

        // Update fog
        this.fogSystem.update(deltaTime);

        // Update chimneys
        this.chimneySystem.update(deltaTime, this.fogSystem);

        // Update power-ups
        this.powerUpSystem.update(deltaTime);

        // Check power-up collisions
        this.powerUpSystem.checkCollision(this.rudolf.x, this.rudolf.y);
    },

    /**
     * Render game
     */
    render() {
        const ctx = this.ctx;

        // Clear canvas
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, this.width, this.height);

        // Draw background
        this.drawBackground(ctx);

        // Draw game objects (behind fog)
        this.chimneySystem.draw(ctx);
        this.powerUpSystem.draw(ctx, this.fogSystem);
        this.sleigh.draw(ctx);
        this.rudolf.draw(ctx);

        // Draw fog layer on top
        this.fogSystem.render(ctx);

        // Draw power-up effect indicators
        if (this.powerUpSystem.activeEffects.size > 0) {
            this.powerUpSystem.drawEffectIndicators(ctx, 20, 150);
        }
    },

    /**
     * Initialize background stars
     */
    initBackground() {
        this.backgroundStars = [];
        const starCount = Math.min(100, Math.floor((this.width * this.height) / 10000));

        for (let i = 0; i < starCount; i++) {
            this.backgroundStars.push({
                x: Math.random(),
                y: Math.random(),
                size: Math.random() * 2 + 1,
                twinkle: Math.random() * Math.PI * 2
            });
        }
    },

    /**
     * Draw background
     */
    drawBackground(ctx) {
        const time = Date.now() * 0.001;

        // Draw stars
        this.backgroundStars.forEach(star => {
            const brightness = 0.5 + Math.sin(star.twinkle + time) * 0.3;
            ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
            ctx.beginPath();
            ctx.arc(
                star.x * this.width,
                star.y * this.height,
                star.size,
                0,
                Math.PI * 2
            );
            ctx.fill();
        });

        // Draw moon
        const moonX = this.width - 80;
        const moonY = 100;
        const moonGradient = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 40);
        moonGradient.addColorStop(0, 'rgba(255, 255, 220, 1)');
        moonGradient.addColorStop(0.8, 'rgba(255, 255, 200, 0.8)');
        moonGradient.addColorStop(1, 'rgba(255, 255, 200, 0)');

        ctx.fillStyle = moonGradient;
        ctx.beginPath();
        ctx.arc(moonX, moonY, 40, 0, Math.PI * 2);
        ctx.fill();
    },

    /**
     * Handle level complete
     */
    handleLevelComplete() {
        this.state = 'success';
        this.isRunning = false;

        TiltControls.disable();
        ShakeDetection.disable();
        TouchControls.disable();

        const timeLeft = Math.ceil(this.timer);
        const allDelivered = true;
        const noBoosts = this.boostsUsed === 0;
        const sleighUntouched = this.sleigh.wasUntouched();
        const noRadar = !this.radarUsed;

        const bonus = Levels.calculateBonus(timeLeft, allDelivered, noBoosts, sleighUntouched, noRadar);
        this.score += bonus.total;

        const stars = Levels.recordScore(
            Levels.currentLevel,
            this.score,
            timeLeft,
            allDelivered,
            noBoosts,
            sleighUntouched,
            noRadar
        );

        UI.showSuccess(this.score, timeLeft, stars);

        if (window.Haptics) Haptics.success();
    },

    /**
     * Handle time out
     */
    handleTimeOut() {
        this.state = 'gameover';
        this.isRunning = false;

        TiltControls.disable();
        ShakeDetection.disable();
        TouchControls.disable();

        UI.showFailure(
            this.chimneySystem.deliveredCount,
            this.currentLevel.chimneys,
            this.score
        );

        if (window.Haptics) Haptics.gameOver();
    },

    /**
     * Pause game
     */
    pause() {
        if (this.state !== 'playing') return;

        this.state = 'paused';
        UI.showPause();

        TiltControls.disable();
        ShakeDetection.disable();
        TouchControls.disable();
    },

    /**
     * Resume game
     */
    resume() {
        if (this.state !== 'paused') return;

        this.state = 'playing';
        this.lastTime = performance.now();

        TiltControls.enable();
        ShakeDetection.enable();
        TouchControls.enable();
    },

    /**
     * Quit to menu
     */
    quit() {
        this.state = 'menu';
        this.isRunning = false;

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        TiltControls.disable();
        ShakeDetection.disable();
        TouchControls.disable();

        UI.showScreen('start');
    },

    /**
     * Handle resize
     */
    handleResize() {
        this.resize();

        // Re-init background for new dimensions
        this.initBackground();
    },

    /**
     * Resize canvas
     */
    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        // Get optimal resolution
        let dpr = window.devicePixelRatio || 1;

        // Limit DPR for performance on high-DPI screens
        if (window.DeviceCompat) {
            const optimalRes = DeviceCompat.getCanvasResolution();
            dpr = optimalRes.ratio;
        } else {
            dpr = Math.min(dpr, 2);
        }

        // Set canvas size
        this.canvas.width = Math.floor(this.width * dpr);
        this.canvas.height = Math.floor(this.height * dpr);
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;

        // Reset and scale context
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);

        // Update game objects
        if (this.rudolf) {
            this.rudolf.setBounds(this.width, this.height);
        }
        if (this.fogSystem) {
            this.fogSystem.resize(this.width, this.height);
        }
        if (this.chimneySystem) {
            this.chimneySystem.width = this.width;
            this.chimneySystem.height = this.height;
        }
        if (this.powerUpSystem) {
            this.powerUpSystem.width = this.width;
            this.powerUpSystem.height = this.height;
        }
    }
};

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    Game.init();
});

// Export
window.Game = Game;
