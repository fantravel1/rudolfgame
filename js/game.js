/**
 * Rudolf Game - Main Game Controller
 * Orchestrates all game systems and manages the game loop
 */
const Game = {
    // Canvas and context
    canvas: null,
    ctx: null,

    // Game dimensions
    width: 0,
    height: 0,

    // Game state
    state: 'menu',              // menu, playing, paused, gameover, success
    isRunning: false,

    // Game time
    lastTime: 0,
    deltaTime: 0,
    timer: 0,
    timeWarningPlayed: false,

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

    /**
     * Initialize the game
     */
    async init() {
        // Get canvas
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        // Set canvas size
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Initialize UI
        UI.init();
        this.setupUICallbacks();

        // Initialize background
        this.initBackground();

        // Load saved progress
        Levels.load();

        console.log('Rudolf Game initialized!');
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
        // Check if we need motion permissions
        if (!TiltControls.hasPermission) {
            UI.showScreen('permission');
        } else if (!TiltControls.calibration.isCalibrated) {
            this.calibrate();
        } else {
            this.startLevel(Levels.currentLevel);
        }
    },

    /**
     * Request motion permissions
     */
    async requestPermissions() {
        const tiltGranted = await TiltControls.init();
        const shakeGranted = await ShakeDetection.init();

        if (tiltGranted && shakeGranted) {
            this.calibrate();
        } else {
            UI.showToast('Motion access required to play!');
        }
    },

    /**
     * Calibrate tilt controls
     */
    calibrate() {
        UI.showScreen('calibration');

        // Enable tilt temporarily for calibration
        TiltControls.enable();

        TiltControls.startCalibration(
            (progress) => {
                UI.updateCalibrationProgress(progress);
            },
            () => {
                UI.showToast('Calibration complete!');
                this.startLevel(Levels.currentLevel);
            }
        );
    },

    /**
     * Start a specific level
     */
    startLevel(levelNumber) {
        Levels.setLevel(levelNumber);
        this.currentLevel = Levels.getCurrentConfig();

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
        UI.showScreen('game');
        this.state = 'playing';
        this.isRunning = true;

        // Enable controls
        TiltControls.enable();
        ShakeDetection.enable();
        ShakeDetection.reset();
        TouchControls.init();
        TouchControls.enable();

        // Set up control callbacks
        this.setupControlCallbacks();

        // Start game loop
        this.lastTime = performance.now();
        requestAnimationFrame((time) => this.gameLoop(time));
    },

    /**
     * Initialize game objects
     */
    initGameObjects() {
        // Rudolf (player) - starts in center
        const startX = this.width / 2;
        const startY = this.height / 2;

        if (this.rudolf) {
            this.rudolf.reset(startX, startY);
        } else {
            this.rudolf = new Rudolf(startX, startY);
        }
        this.rudolf.setBounds(this.width, this.height);

        // Sleigh
        if (this.sleigh) {
            this.sleigh.reset();
        } else {
            this.sleigh = new Sleigh(this.rudolf);
        }

        // Fog system
        if (this.fogSystem) {
            this.fogSystem.reset();
            this.fogSystem.resize(this.width, this.height);
        } else {
            this.fogSystem = new FogSystem(this.width, this.height);
        }

        // Chimney system
        if (this.chimneySystem) {
            this.chimneySystem.reset();
        } else {
            this.chimneySystem = new ChimneySystem(this.width, this.height);
        }
        this.setupChimneyCallbacks();

        // Power-up system
        if (this.powerUpSystem) {
            this.powerUpSystem.reset();
        } else {
            this.powerUpSystem = new PowerUpSystem(this.width, this.height);
        }
        this.setupPowerUpCallbacks();
    },

    /**
     * Set up control callbacks
     */
    setupControlCallbacks() {
        // Shake to boost
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

        // Touch controls
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
            UI.showScorePopup(
                this.canvas.getBoundingClientRect().left + data.chimney.x,
                this.canvas.getBoundingClientRect().top + data.chimney.y,
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

            // Add boost burst to fog
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
            Haptics.pulse();
        } else {
            UI.showToast('All chimneys found!');
        }
    },

    /**
     * Handle tap on game canvas
     */
    handleTap(screenX, screenY) {
        // Convert screen coordinates to canvas coordinates
        const rect = this.canvas.getBoundingClientRect();
        const x = (screenX - rect.left) * (this.canvas.width / rect.width);
        const y = (screenY - rect.top) * (this.canvas.height / rect.height);

        // Check chimney tap
        const result = this.chimneySystem.checkTap(x, y);
        if (result) {
            // Handled by callback
        }
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

        // Calculate delta time
        this.deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        if (this.state === 'playing') {
            this.update(this.deltaTime);
        }

        this.render();

        requestAnimationFrame((time) => this.gameLoop(time));
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
            Haptics.timeWarning();
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

        // Update nose visibility with power-up multiplier
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
        for (let i = 0; i < 100; i++) {
            this.backgroundStars.push({
                x: Math.random() * 1000,
                y: Math.random() * 2000,
                size: Math.random() * 2 + 1,
                twinkle: Math.random() * Math.PI * 2
            });
        }
    },

    /**
     * Draw background
     */
    drawBackground(ctx) {
        // Draw stars
        this.backgroundStars.forEach(star => {
            const brightness = 0.5 + Math.sin(star.twinkle + Date.now() * 0.001) * 0.3;
            ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
            ctx.beginPath();
            ctx.arc(
                (star.x * this.width / 1000) % this.width,
                (star.y * this.height / 2000) % this.height,
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

        // Disable controls
        TiltControls.disable();
        ShakeDetection.disable();
        TouchControls.disable();

        // Calculate bonuses
        const timeLeft = Math.ceil(this.timer);
        const allDelivered = true;
        const noBoosts = this.boostsUsed === 0;
        const sleighUntouched = this.sleigh.wasUntouched();
        const noRadar = !this.radarUsed;

        const bonus = Levels.calculateBonus(timeLeft, allDelivered, noBoosts, sleighUntouched, noRadar);
        this.score += bonus.total;

        // Record score and get stars
        const stars = Levels.recordScore(
            Levels.currentLevel,
            this.score,
            timeLeft,
            allDelivered,
            noBoosts,
            sleighUntouched,
            noRadar
        );

        // Show success screen
        UI.showSuccess(this.score, timeLeft, stars);

        // Haptic feedback
        Haptics.success();
    },

    /**
     * Handle time out
     */
    handleTimeOut() {
        this.state = 'gameover';
        this.isRunning = false;

        // Disable controls
        TiltControls.disable();
        ShakeDetection.disable();
        TouchControls.disable();

        // Show failure screen
        UI.showFailure(
            this.chimneySystem.deliveredCount,
            this.currentLevel.chimneys,
            this.score
        );

        // Haptic feedback
        Haptics.gameOver();
    },

    /**
     * Pause game
     */
    pause() {
        if (this.state !== 'playing') return;

        this.state = 'paused';
        UI.showPause();

        // Disable controls while paused
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

        // Re-enable controls
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

        TiltControls.disable();
        ShakeDetection.disable();
        TouchControls.disable();

        UI.showScreen('start');
    },

    /**
     * Resize canvas
     */
    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        // Set canvas size with device pixel ratio for sharpness
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;

        // Scale context
        this.ctx.scale(dpr, dpr);

        // Update game objects
        if (this.rudolf) {
            this.rudolf.setBounds(this.width, this.height);
        }
        if (this.fogSystem) {
            this.fogSystem.resize(this.width, this.height);
        }
    }
};

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    Game.init();
});

// Export for use in other modules
window.Game = Game;
