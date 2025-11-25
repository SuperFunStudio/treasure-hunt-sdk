/**
 * Telescope Loader Animation
 * Creates the iconic rotating telescope rings with progress scanning
 */

class TelescopeLoader {
    constructor(container) {
        this.container = container;
        this.progress = 0;
        this.animationFrame = null;
        this.scanRing = null;
        this.progressText = null;
    }

    /**
     * Create the telescope loader HTML structure
     */
    create() {
        this.container.innerHTML = `
            <div class="telescope-loader">
                <!-- Rotating background rings (half-circles) -->
                <div class="telescope-ring telescope-ring-half"></div>
                <div class="telescope-ring telescope-ring-half"></div>
                <div class="telescope-ring telescope-ring-half"></div>

                <!-- Progress scan ring (turns blue and fills) -->
                <svg class="telescope-scan-svg" viewBox="0 0 200 200">
                    <circle
                        class="telescope-scan-ring-bg"
                        cx="100"
                        cy="100"
                        r="95"
                        fill="none"
                        stroke="rgba(59, 130, 246, 0.2)"
                        stroke-width="4"
                    />
                    <circle
                        class="telescope-scan-ring-progress"
                        cx="100"
                        cy="100"
                        r="95"
                        fill="none"
                        stroke="#3b82f6"
                        stroke-width="4"
                        stroke-linecap="round"
                        stroke-dasharray="597"
                        stroke-dashoffset="597"
                        transform="rotate(-90 100 100)"
                    />
                </svg>

                <!-- Progress percentage display -->
                <div class="telescope-progress">
                    <span class="progress-number">0</span><span class="progress-percent">%</span>
                </div>
            </div>
        `;

        this.scanRing = this.container.querySelector('.telescope-scan-ring-progress');
        this.progressText = this.container.querySelector('.progress-number');

        // Add additional CSS for SVG if not in main CSS
        this.addInlineStyles();
    }

    /**
     * Add inline styles for SVG elements
     */
    addInlineStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .telescope-scan-svg {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 100%;
                height: 100%;
                max-width: 200px;
                max-height: 200px;
            }

            .telescope-scan-ring-progress {
                transition: stroke-dashoffset 0.3s ease-out;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Start the loading animation
     */
    start() {
        this.progress = 0;
        this.updateProgress(0);
    }

    /**
     * Update progress (0-100)
     * @param {number} percent - Progress percentage
     */
    updateProgress(percent) {
        this.progress = Math.min(100, Math.max(0, percent));

        // Update progress text
        if (this.progressText) {
            this.progressText.textContent = Math.round(this.progress);
        }

        // Update scan ring (SVG circle)
        // Circle circumference = 2πr = 2π(95) ≈ 597
        const circumference = 597;
        const offset = circumference - (circumference * this.progress / 100);

        if (this.scanRing) {
            this.scanRing.style.strokeDashoffset = offset;
        }

        // Add completion effect
        if (this.progress >= 100) {
            this.onComplete();
        }
    }

    /**
     * Animate progress from current to target
     * @param {number} targetPercent - Target percentage
     * @param {number} duration - Animation duration in ms
     */
    animateTo(targetPercent, duration = 1000) {
        const startPercent = this.progress;
        const diff = targetPercent - startPercent;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function (ease-out)
            const eased = 1 - Math.pow(1 - progress, 3);
            const currentPercent = startPercent + (diff * eased);

            this.updateProgress(currentPercent);

            if (progress < 1) {
                this.animationFrame = requestAnimationFrame(animate);
            }
        };

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        animate();
    }

    /**
     * Called when progress reaches 100%
     */
    onComplete() {
        // Add completion pulse effect
        if (this.scanRing) {
            this.scanRing.style.stroke = '#10b981'; // Success green
        }

        // Trigger custom event
        const event = new CustomEvent('telescope-complete', {
            detail: { loader: this }
        });
        this.container.dispatchEvent(event);
    }

    /**
     * Reset the loader
     */
    reset() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        this.progress = 0;
        this.updateProgress(0);

        if (this.scanRing) {
            this.scanRing.style.stroke = '#3b82f6'; // Reset to blue
        }
    }

    /**
     * Remove the loader
     */
    destroy() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        this.container.innerHTML = '';
    }

    /**
     * Simulate progress through stages
     * @param {Array} stages - Array of stage objects with {percent, duration}
     */
    async progressThroughStages(stages) {
        for (const stage of stages) {
            await new Promise(resolve => {
                this.animateTo(stage.percent, stage.duration);
                setTimeout(resolve, stage.duration);
            });
        }
    }
}

/**
 * Create a simple telescope loader
 * @param {HTMLElement} container - Container element
 * @returns {TelescopeLoader} Loader instance
 */
function createTelescopeLoader(container) {
    const loader = new TelescopeLoader(container);
    loader.create();
    return loader;
}

/**
 * Example usage for 5-stage analysis
 * @param {HTMLElement} container - Container element
 * @param {Function} onStageChange - Callback for stage changes
 */
async function runAnalysisAnimation(container, onStageChange) {
    const loader = createTelescopeLoader(container);
    loader.start();

    const stages = [
        { name: 'Upload', percent: 20, duration: 1000 },
        { name: 'AI Analysis', percent: 40, duration: 2000 },
        { name: 'Category', percent: 60, duration: 1500 },
        { name: 'Pricing', percent: 80, duration: 1500 },
        { name: 'Complete', percent: 100, duration: 1000 }
    ];

    for (const stage of stages) {
        if (onStageChange) {
            onStageChange(stage.name, stage.percent);
        }
        await new Promise(resolve => {
            loader.animateTo(stage.percent, stage.duration);
            setTimeout(resolve, stage.duration);
        });
    }

    return loader;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TelescopeLoader, createTelescopeLoader, runAnalysisAnimation };
}
