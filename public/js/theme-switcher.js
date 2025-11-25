// ============================================
// THRIFTSPOT THEME MODE SWITCHER
// Add this to your main JavaScript file
// ============================================

/**
 * Updates the body class to switch between Scan and Find mode themes
 * Call this function whenever the mode changes
 */
function updateThemeMode(mode) {
    const body = document.body;
    
    if (mode === 'find') {
        body.classList.add('find-mode-active');
        console.log('🧭 Switched to Brass & Compass theme (Find Mode)');
    } else {
        body.classList.remove('find-mode-active');
        console.log('🔭 Switched to Periscope Modern theme (Scan Mode)');
    }
}

// ============================================
// INTEGRATION WITH YOUR EXISTING switchMode FUNCTION
// ============================================

/**
 * Replace or update your existing switchMode function with this:
 */
function switchMode(mode) {
    currentMode = mode;

    // Update button states
    document.getElementById('scanBtn').classList.toggle('active', mode === 'scan');
    document.getElementById('findBtn').classList.toggle('active', mode === 'find');

    // Hide all content sections
    document.getElementById('scanModeUpload').classList.remove('active');
    document.getElementById('scanModeLoading').classList.remove('active');
    document.getElementById('scanModeResults').classList.remove('active');
    document.getElementById('findMode').classList.remove('active');

    // *** NEW: Update theme ***
    updateThemeMode(mode);

    if (mode === 'scan') {
        // Show appropriate scan view based on state
        if (currentScanData.analysis) {
            document.getElementById('scanModeResults').classList.add('active');
        } else {
            document.getElementById('scanModeUpload').classList.add('active');
        }
    } else if (mode === 'find') {
        document.getElementById('findMode').classList.add('active');
        if (!map) {
            setTimeout(() => initializeMap(), 100);
        } else {
            setTimeout(() => map.invalidateSize(), 150);
        }
    }
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the theme on page load
 * Add this to your DOMContentLoaded or initialization code
 */
document.addEventListener('DOMContentLoaded', function() {
    // Set initial theme based on starting mode
    updateThemeMode(currentMode || 'scan');
    
    console.log('🎨 ThriftSpot themed CSS initialized');
});

// ============================================
// OPTIONAL: SMOOTH THEME TRANSITION EFFECTS
// ============================================

/**
 * Add extra polish with sound effects or haptic feedback (optional)
 */
function playSwitchEffect(mode) {
    // Add haptic feedback on mobile if available
    if (navigator.vibrate) {
        navigator.vibrate(50);
    }
    
    // Optional: Add a subtle visual flash effect
    const flash = document.createElement('div');
    flash.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: ${mode === 'find' ? 'rgba(184, 134, 11, 0.1)' : 'rgba(0, 229, 255, 0.1)'};
        pointer-events: none;
        z-index: 9999;
        animation: flashFade 0.3s ease-out;
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes flashFade {
            0% { opacity: 1; }
            100% { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(flash);
    
    // Remove after animation
    setTimeout(() => {
        flash.remove();
        style.remove();
    }, 300);
}

// Enhanced switchMode with effects
function switchModeWithEffects(mode) {
    playSwitchEffect(mode);
    switchMode(mode);
}

// ============================================
// USAGE EXAMPLES
// ============================================

/*
// Example 1: Basic usage with your existing buttons
document.getElementById('scanBtn').addEventListener('click', () => {
    switchMode('scan');
});

document.getElementById('findBtn').addEventListener('click', () => {
    switchMode('find');
});

// Example 2: With visual effects
document.getElementById('scanBtn').addEventListener('click', () => {
    switchModeWithEffects('scan');
});

document.getElementById('findBtn').addEventListener('click', () => {
    switchModeWithEffects('find');
});

// Example 3: Programmatic mode switch
setTimeout(() => {
    switchMode('find');
}, 3000); // Switch to find mode after 3 seconds
*/

// ============================================
// THEME CUSTOMIZATION HELPERS
// ============================================

/**
 * Get current theme colors for custom elements
 */
function getCurrentThemeColors() {
    const isFind = document.body.classList.contains('find-mode-active');
    
    if (isFind) {
        return {
            primary: getComputedStyle(document.documentElement).getPropertyValue('--brass-primary').trim(),
            secondary: getComputedStyle(document.documentElement).getPropertyValue('--brass-light').trim(),
            background: getComputedStyle(document.documentElement).getPropertyValue('--parchment-aged').trim(),
            text: getComputedStyle(document.documentElement).getPropertyValue('--compass-ink').trim(),
        };
    } else {
        return {
            primary: getComputedStyle(document.documentElement).getPropertyValue('--scan-neon-cyan').trim(),
            secondary: getComputedStyle(document.documentElement).getPropertyValue('--scan-neon-purple').trim(),
            background: getComputedStyle(document.documentElement).getPropertyValue('--scan-hull-dark').trim(),
            text: '#ffffff',
        };
    }
}

/**
 * Apply theme to dynamically created elements
 */
function applyThemeToElement(element) {
    const colors = getCurrentThemeColors();
    const isFind = document.body.classList.contains('find-mode-active');
    
    if (isFind) {
        // Brass & Compass styling
        element.style.borderColor = colors.primary;
        element.style.color = colors.text;
    } else {
        // Periscope Modern styling
        element.style.borderColor = colors.primary;
        element.style.boxShadow = `0 0 15px ${colors.primary}`;
        element.style.color = colors.text;
    }
}

// Export for use in other files if using modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        updateThemeMode,
        switchMode,
        switchModeWithEffects,
        getCurrentThemeColors,
        applyThemeToElement
    };
}