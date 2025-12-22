/**
 * Level Configuration - Defines all level parameters
 * Manages level progression and difficulty scaling
 */
const Levels = {
    // Level configurations
    configs: [
        {
            id: 1,
            name: 'Suburbs',
            fog: 'light',
            chimneys: 5,
            time: 90,
            powerups: 3,
            hazards: [],
            description: 'Learn the tilts',
            unlocked: true
        },
        {
            id: 2,
            name: 'City',
            fog: 'medium',
            chimneys: 8,
            time: 80,
            powerups: 4,
            hazards: ['buildings'],
            description: 'Taller buildings to dodge',
            unlocked: false
        },
        {
            id: 3,
            name: 'Mountains',
            fog: 'thick',
            chimneys: 10,
            time: 75,
            powerups: 4,
            hazards: ['trees', 'altitude'],
            description: 'Altitude matters',
            unlocked: false
        },
        {
            id: 4,
            name: 'Blizzard',
            fog: 'heavy',
            chimneys: 12,
            time: 70,
            powerups: 5,
            hazards: ['wind', 'trees'],
            description: 'Phone vibrates in wind gusts',
            unlocked: false
        },
        {
            id: 5,
            name: 'Arctic',
            fog: 'whiteout',
            chimneys: 15,
            time: 60,
            powerups: 5,
            hazards: ['wind', 'ice', 'airplanes'],
            description: 'Ice dims your nose',
            unlocked: false
        },
        {
            id: 6,
            name: 'Nightmare',
            fog: 'whiteout',
            chimneys: 20,
            time: 55,
            powerups: 6,
            hazards: ['wind', 'ice', 'airplanes', 'balloons'],
            description: 'Good luck',
            unlocked: false
        }
    ],

    // Current level
    currentLevel: 1,

    // High scores per level
    highScores: {},

    // Stars earned per level (0-3)
    starsEarned: {},

    /**
     * Get configuration for a specific level
     */
    getConfig(levelNumber) {
        const index = Math.min(levelNumber - 1, this.configs.length - 1);

        if (levelNumber > this.configs.length) {
            // Generate nightmare+ levels
            const baseConfig = this.configs[this.configs.length - 1];
            return {
                ...baseConfig,
                id: levelNumber,
                name: `Nightmare ${levelNumber - 5}`,
                chimneys: 15 + (levelNumber - 5) * 2,
                time: Math.max(45, 60 - (levelNumber - 5) * 3),
                powerups: Math.min(8, 6 + Math.floor((levelNumber - 5) / 2)),
                description: '💀 Beyond hope 💀'
            };
        }

        return this.configs[index];
    },

    /**
     * Get current level configuration
     */
    getCurrentConfig() {
        return this.getConfig(this.currentLevel);
    },

    /**
     * Set current level
     */
    setLevel(levelNumber) {
        this.currentLevel = Math.max(1, levelNumber);
    },

    /**
     * Advance to next level
     */
    nextLevel() {
        this.currentLevel++;
        return this.getCurrentConfig();
    },

    /**
     * Unlock a level
     */
    unlockLevel(levelNumber) {
        if (levelNumber <= this.configs.length) {
            this.configs[levelNumber - 1].unlocked = true;
            this.save();
        }
    },

    /**
     * Check if a level is unlocked
     */
    isUnlocked(levelNumber) {
        if (levelNumber > this.configs.length) {
            return this.configs[this.configs.length - 1].unlocked;
        }
        return this.configs[levelNumber - 1].unlocked;
    },

    /**
     * Record score and calculate stars
     */
    recordScore(levelNumber, score, timeLeft, allDelivered, noBoosts, sleighUntouched, noRadar) {
        // Update high score
        if (!this.highScores[levelNumber] || score > this.highScores[levelNumber]) {
            this.highScores[levelNumber] = score;
        }

        // Calculate stars
        let stars = 0;

        // 1 star: Complete level
        if (allDelivered) stars++;

        // 2 stars: Complete with time bonus (>20% time remaining)
        const config = this.getConfig(levelNumber);
        if (allDelivered && timeLeft > config.time * 0.2) stars++;

        // 3 stars: Perfect run (no boosts or radar used, sleigh untouched)
        if (allDelivered && noBoosts && sleighUntouched && noRadar) stars++;

        // Update stars earned
        if (!this.starsEarned[levelNumber] || stars > this.starsEarned[levelNumber]) {
            this.starsEarned[levelNumber] = stars;
        }

        // Unlock next level if completed
        if (allDelivered) {
            this.unlockLevel(levelNumber + 1);
        }

        this.save();

        return stars;
    },

    /**
     * Calculate bonus points
     */
    calculateBonus(timeLeft, allDelivered, noBoosts, sleighUntouched, noRadar) {
        let bonus = 0;
        let breakdown = [];

        // Time bonus: 10 points per second
        if (timeLeft > 0) {
            const timeBonus = timeLeft * 10;
            bonus += timeBonus;
            breakdown.push({ name: 'Time Bonus', points: timeBonus });
        }

        // All chimneys: 500 points
        if (allDelivered) {
            bonus += 500;
            breakdown.push({ name: 'All Chimneys', points: 500 });
        }

        // No boosts used: 200 points
        if (noBoosts) {
            bonus += 200;
            breakdown.push({ name: 'No Boosts Used', points: 200 });
        }

        // Sleigh untouched: 300 points
        if (sleighUntouched) {
            bonus += 300;
            breakdown.push({ name: 'Sleigh Untouched', points: 300 });
        }

        // No radar used: 100 points
        if (noRadar) {
            bonus += 100;
            breakdown.push({ name: 'No Radar Used', points: 100 });
        }

        return { total: bonus, breakdown };
    },

    /**
     * Get rank text based on stars
     */
    getRankDisplay(stars) {
        return '⭐'.repeat(stars) || '☆☆☆';
    },

    /**
     * Save progress to localStorage
     */
    save() {
        try {
            const data = {
                highScores: this.highScores,
                starsEarned: this.starsEarned,
                unlocked: this.configs.map(c => c.unlocked)
            };
            localStorage.setItem('rudolf_game_progress', JSON.stringify(data));
        } catch (e) {
            console.warn('Could not save progress:', e);
        }
    },

    /**
     * Load progress from localStorage
     */
    load() {
        try {
            const data = JSON.parse(localStorage.getItem('rudolf_game_progress'));
            if (data) {
                this.highScores = data.highScores || {};
                this.starsEarned = data.starsEarned || {};

                if (data.unlocked) {
                    data.unlocked.forEach((unlocked, index) => {
                        if (index < this.configs.length) {
                            this.configs[index].unlocked = unlocked;
                        }
                    });
                }
            }
        } catch (e) {
            console.warn('Could not load progress:', e);
        }
    },

    /**
     * Reset all progress
     */
    resetProgress() {
        this.highScores = {};
        this.starsEarned = {};
        this.currentLevel = 1;

        this.configs.forEach((config, index) => {
            config.unlocked = index === 0;
        });

        localStorage.removeItem('rudolf_game_progress');
    },

    /**
     * Get total stars earned
     */
    getTotalStars() {
        return Object.values(this.starsEarned).reduce((sum, stars) => sum + stars, 0);
    },

    /**
     * Get maximum possible stars
     */
    getMaxStars() {
        return this.configs.length * 3;
    }
};

// Load saved progress on init
Levels.load();

// Export for use in other modules
window.Levels = Levels;
