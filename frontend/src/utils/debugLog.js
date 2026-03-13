/**
 * ✨ PHASE 17.4: Debug Logging Utility
 * 
 * Provides conditional logging based on environment and component debug flags.
 * This prevents console spam while still allowing diagnostics when needed.
 * 
 * Usage:
 *   const log = createDebugLogger('ComponentName', false); // false = disabled by default
 *   log.log('Info message', data);
 *   log.warn('Warning message');
 *   log.error('Error message');
 *   
 * The global DEV_DEBUG flag can enable/disable all logging.
 */

// Global flag to control all debug logging (set via window.DEV_DEBUG = true)
// eslint-disable-next-line no-unused-vars
const GLOBAL_DEBUG_ENABLED = typeof window !== 'undefined' && window.DEV_DEBUG === true;

/**
 * Create a debug logger for a specific component
 * @param {string} componentName - Name of component (for log prefix)
 * @param {boolean} enabledByDefault - Whether to log by default (can be overridden by global flag)
 * @returns {Object} Logger object with log(), warn(), error() methods
 */
export const createDebugLogger = (componentName, enabledByDefault = false) => {
    // Check both global flag and component-specific setting
    const isEnabled = GLOBAL_DEBUG_ENABLED || enabledByDefault;
    
    const prefix = `[${componentName}]`;
    
    return {
        log: (message, data = null) => {
            if (!isEnabled) return;
            if (data) {
                console.log(`${prefix} ${message}`, data);
            } else {
                console.log(`${prefix} ${message}`);
            }
        },
        warn: (message, data = null) => {
            if (!isEnabled) return;
            if (data) {
                console.warn(`${prefix} ⚠️ ${message}`, data);
            } else {
                console.warn(`${prefix} ⚠️ ${message}`);
            }
        },
        error: (message, data = null) => {
            if (!isEnabled) return;
            if (data) {
                console.error(`${prefix} ❌ ${message}`, data);
            } else {
                console.error(`${prefix} ❌ ${message}`);
            }
        },
        /**
         * Log with timestamp (useful for timing diagnostics)
         * Format: [HH:MM:SS.sss] message
         */
        logWithTime: (message, data = null) => {
            if (!isEnabled) return;
            const timestamp = new Date().toISOString().split('T')[1];
            if (data) {
                console.log(`${prefix} [${timestamp}] ${message}`, data);
            } else {
                console.log(`${prefix} [${timestamp}] ${message}`);
            }
        },
        /**
         * Enable/disable logging for this specific logger
         */
        setEnabled: (enabled) => {
            // Note: This modifies the closure, but GLOBAL_DEBUG_ENABLED takes precedence
            enabledByDefault = enabled;
        }
    };
};

/**
 * Disable all debug logging globally
 */
export const disableAllDebugLogging = () => {
    if (typeof window !== 'undefined') {
        window.DEV_DEBUG = false;
    }
};

/**
 * Enable all debug logging globally (can be expensive for performance)
 */
export const enableAllDebugLogging = () => {
    if (typeof window !== 'undefined') {
        window.DEV_DEBUG = true;
    }
};

/**
 * Check if debug logging is currently enabled
 */
export const isDebugLoggingEnabled = () => {
    return GLOBAL_DEBUG_ENABLED;
};

export default createDebugLogger;
