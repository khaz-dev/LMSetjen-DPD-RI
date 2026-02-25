/**
 * Duration Utility Functions
 * Handles parsing and formatting of time duration strings
 */

/**
 * Parse duration string (e.g., "5m 30s", "1h 20m", "2h 15m 30s") to total seconds
 * @param {string} durationString - Duration in format like "5m 30s" or "1h 20m 15s"
 * @returns {number} Total seconds
 */
export const parseDurationToSeconds = (durationString) => {
    if (!durationString || typeof durationString !== 'string') {
        return 0;
    }
    
    const duration = durationString.toLowerCase().trim();
    let totalSeconds = 0;
    
    // Parse hours
    const hoursMatch = duration.match(/(\d+)\s*h/);
    if (hoursMatch) {
        totalSeconds += parseInt(hoursMatch[1]) * 3600;
    }
    
    // Parse minutes
    const minutesMatch = duration.match(/(\d+)\s*m/);
    if (minutesMatch) {
        totalSeconds += parseInt(minutesMatch[1]) * 60;
    }
    
    // Parse seconds
    const secondsMatch = duration.match(/(\d+)\s*s/);
    if (secondsMatch) {
        totalSeconds += parseInt(secondsMatch[1]);
    }
    
    return totalSeconds;
};

/**
 * Convert seconds to human-readable duration string
 * @param {number} totalSeconds - Total seconds
 * @param {object} options - Formatting options
 * @param {boolean} options.showSeconds - Whether to show seconds (default: true for durations < 1 hour)
 * @param {boolean} options.compact - Use compact format (default: false)
 * @returns {string} Formatted duration string
 */
export const formatDuration = (totalSeconds, options = {}) => {
    if (!totalSeconds || totalSeconds <= 0) {
        return "0m 0s";
    }
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    const { showSeconds = hours === 0, compact = false } = options;
    
    if (compact) {
        if (hours > 0) {
            return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
        } else if (minutes > 0) {
            return showSeconds && seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
        } else {
            return `${seconds}s`;
        }
    }
    
    // Standard format
    const parts = [];
    
    if (hours > 0) {
        parts.push(`${hours}h`);
    }
    
    if (minutes > 0 || hours > 0) {
        parts.push(`${minutes}m`);
    }
    
    if (showSeconds || (hours === 0 && minutes === 0)) {
        parts.push(`${seconds}s`);
    }
    
    return parts.join(' ');
};

/**
 * Calculate total duration from an array of items with duration strings
 * @param {Array} items - Array of objects with content_duration or duration property
 * @param {string} durationKey - Property name containing duration (default: 'content_duration')
 * @returns {object} Object with formatted duration and JP variant
 */
export const calculateTotalDuration = (items, durationKey = 'content_duration') => {
    if (!items || !Array.isArray(items) || items.length === 0) {
        return {
            formatted: "0m 0s",
            withJP: "0m 0s (0JP)"
        };
    }
    
    const totalSeconds = items.reduce((total, item) => {
        const durationString = item[durationKey];
        if (!durationString) return total;
        
        return total + parseDurationToSeconds(durationString);
    }, 0);
    
    return {
        formatted: formatDuration(totalSeconds),
        withJP: formatDurationWithJP(totalSeconds)
    };
};

/**
 * Format duration in different styles
 * @param {string} durationString - Duration string like "5m 30s"
 * @param {string} style - Output style: 'short', 'medium', 'long', 'clock'
 * @returns {string} Formatted duration
 */
export const formatDurationStyle = (durationString, style = 'short') => {
    const totalSeconds = parseDurationToSeconds(durationString);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    switch (style) {
        case 'clock':
            // Format: 01:23:45 or 23:45
            if (hours > 0) {
                return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }
            return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        case 'long':
            // Format: "2 hours, 15 minutes, 30 seconds"
            const parts = [];
            if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
            if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
            if (seconds > 0 || parts.length === 0) parts.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`);
            return parts.join(', ');
        
        case 'medium':
            // Format: "2h 15min 30sec"
            const medParts = [];
            if (hours > 0) medParts.push(`${hours}h`);
            if (minutes > 0) medParts.push(`${minutes}min`);
            if (seconds > 0 || medParts.length === 0) medParts.push(`${seconds}sec`);
            return medParts.join(' ');
        
        case 'short':
        default:
            // Format: "2h 15m 30s" or "15m 30s"
            return formatDuration(totalSeconds);
    }
};

/**
 * Compare two duration strings
 * @param {string} duration1 - First duration string
 * @param {string} duration2 - Second duration string
 * @returns {number} -1 if duration1 < duration2, 0 if equal, 1 if duration1 > duration2
 */
export const compareDurations = (duration1, duration2) => {
    const seconds1 = parseDurationToSeconds(duration1);
    const seconds2 = parseDurationToSeconds(duration2);
    
    if (seconds1 < seconds2) return -1;
    if (seconds1 > seconds2) return 1;
    return 0;
};

/**
 * Check if duration exceeds a threshold
 * @param {string} durationString - Duration to check
 * @param {number} thresholdSeconds - Threshold in seconds
 * @returns {boolean} True if duration exceeds threshold
 */
export const exceedsThreshold = (durationString, thresholdSeconds) => {
    return parseDurationToSeconds(durationString) > thresholdSeconds;
};

/**
 * Convert seconds to JP (Jam Pelajaran) where 1 JP = 45 minutes = 2700 seconds
 * @param {number} totalSeconds - Total seconds
 * @returns {number} Number of JP (rounded up)
 */
export const secondsToJP = (totalSeconds) => {
    if (!totalSeconds || totalSeconds <= 0) {
        return 0;
    }
    const JP_VALUE = 2700; // 45 minutes in seconds
    return Math.ceil(totalSeconds / JP_VALUE);
};

/**
 * Format duration with JP (Jam Pelajaran) notation
 * Format: "0m 0s (0JP)" where 1JP = 45 minutes
 * @param {number} totalSeconds - Total seconds
 * @returns {string} Formatted duration with JP
 */
export const formatDurationWithJP = (totalSeconds) => {
    const duration = formatDuration(totalSeconds);
    const jp = secondsToJP(totalSeconds);
    return `${duration} (${jp}JP)`;
};

/**
 * Get duration statistics from an array of items
 * @param {Array} items - Array of objects with duration
 * @param {string} durationKey - Property name containing duration
 * @returns {object} Statistics object with total, average, min, max and JP variants
 */
export const getDurationStats = (items, durationKey = 'content_duration') => {
    if (!items || !Array.isArray(items) || items.length === 0) {
        return {
            total: "0m 0s",
            totalWithJP: "0m 0s (0JP)",
            average: "0m 0s",
            averageWithJP: "0m 0s (0JP)",
            min: "0m 0s",
            minWithJP: "0m 0s (0JP)",
            max: "0m 0s",
            maxWithJP: "0m 0s (0JP)",
            count: 0
        };
    }
    
    const durations = items
        .map(item => parseDurationToSeconds(item[durationKey]))
        .filter(seconds => seconds > 0);
    
    if (durations.length === 0) {
        return {
            total: "0m 0s",
            totalWithJP: "0m 0s (0JP)",
            average: "0m 0s",
            averageWithJP: "0m 0s (0JP)",
            min: "0m 0s",
            minWithJP: "0m 0s (0JP)",
            max: "0m 0s",
            maxWithJP: "0m 0s (0JP)",
            count: 0
        };
    }
    
    const totalSeconds = durations.reduce((sum, seconds) => sum + seconds, 0);
    const averageSeconds = Math.floor(totalSeconds / durations.length);
    const minSeconds = Math.min(...durations);
    const maxSeconds = Math.max(...durations);
    
    return {
        total: formatDuration(totalSeconds),
        totalWithJP: formatDurationWithJP(totalSeconds),
        average: formatDuration(averageSeconds),
        averageWithJP: formatDurationWithJP(averageSeconds),
        min: formatDuration(minSeconds),
        minWithJP: formatDurationWithJP(minSeconds),
        max: formatDuration(maxSeconds),
        maxWithJP: formatDurationWithJP(maxSeconds),
        count: durations.length,
        totalSeconds,
        averageSeconds,
        minSeconds,
        maxSeconds
    };
};

export default {
    parseDurationToSeconds,
    formatDuration,
    calculateTotalDuration,
    formatDurationStyle,
    compareDurations,
    exceedsThreshold,
    secondsToJP,
    formatDurationWithJP,
    getDurationStats
};
