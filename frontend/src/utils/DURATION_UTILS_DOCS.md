# Duration Utilities Documentation

## Overview
Comprehensive utility functions for parsing, calculating, and formatting time durations in the LMS system.

## Installation
```javascript
import { calculateTotalDuration, formatDuration, parseDurationToSeconds } from '../../utils/durationUtils';
```

---

## Core Functions

### 1. `calculateTotalDuration(items, durationKey)`
**Purpose**: Calculate total duration from an array of items with duration strings

**Parameters**:
- `items` (Array): Array of objects with duration property
- `durationKey` (String, optional): Property name containing duration (default: `'content_duration'`)

**Returns**: String - Formatted total duration (e.g., "2h 15m" or "45m 30s")

**Example**:
```javascript
const lectures = [
    { content_duration: "5m 30s" },
    { content_duration: "10m 15s" },
    { content_duration: "1h 20m" }
];

const total = calculateTotalDuration(lectures);
// Output: "1h 35m 45s"
```

**Use in CourseDetail**:
```jsx
<h6>{calculateTotalDuration(course?.lectures || [])}</h6>
```

---

### 2. `parseDurationToSeconds(durationString)`
**Purpose**: Convert duration string to total seconds

**Parameters**:
- `durationString` (String): Duration in format like "5m 30s", "1h 20m 15s", "2h 15m"

**Returns**: Number - Total seconds

**Supported Formats**:
- `"30s"` → 30 seconds
- `"5m"` → 300 seconds
- `"5m 30s"` → 330 seconds
- `"1h"` → 3600 seconds
- `"1h 20m"` → 4800 seconds
- `"2h 15m 30s"` → 8130 seconds

**Example**:
```javascript
parseDurationToSeconds("1h 20m 15s");  // Returns: 4815
parseDurationToSeconds("5m 30s");       // Returns: 330
parseDurationToSeconds("45s");          // Returns: 45
```

---

### 3. `formatDuration(totalSeconds, options)`
**Purpose**: Convert seconds to human-readable duration string

**Parameters**:
- `totalSeconds` (Number): Total seconds to format
- `options` (Object, optional):
  - `showSeconds` (Boolean): Whether to show seconds (default: true for durations < 1 hour)
  - `compact` (Boolean): Use compact format (default: false)

**Returns**: String - Formatted duration

**Examples**:
```javascript
formatDuration(4815);                          // "1h 20m 15s"
formatDuration(4815, { showSeconds: false });  // "1h 20m"
formatDuration(4815, { compact: true });       // "1h 20m"
formatDuration(330);                           // "5m 30s"
formatDuration(45);                            // "45s"
```

---

### 4. `formatDurationStyle(durationString, style)`
**Purpose**: Format duration in different display styles

**Parameters**:
- `durationString` (String): Duration like "5m 30s"
- `style` (String): Output style - `'short'`, `'medium'`, `'long'`, `'clock'`

**Returns**: String - Formatted duration

**Examples**:
```javascript
const duration = "1h 20m 30s";

formatDurationStyle(duration, 'short');   // "1h 20m 30s"
formatDurationStyle(duration, 'medium');  // "1h 20min 30sec"
formatDurationStyle(duration, 'long');    // "1 hour, 20 minutes, 30 seconds"
formatDurationStyle(duration, 'clock');   // "01:20:30"

const shortDuration = "5m 30s";
formatDurationStyle(shortDuration, 'clock');  // "05:30"
```

---

### 5. `getDurationStats(items, durationKey)`
**Purpose**: Calculate comprehensive statistics from array of durations

**Parameters**:
- `items` (Array): Array of objects with duration
- `durationKey` (String, optional): Property name (default: `'content_duration'`)

**Returns**: Object with statistics
```javascript
{
    total: "2h 30m 45s",
    average: "15m 3s",
    min: "2m 10s",
    max: "45m 30s",
    count: 10,
    totalSeconds: 9045,
    averageSeconds: 903,
    minSeconds: 130,
    maxSeconds: 2730
}
```

**Example**:
```javascript
const lectures = [
    { content_duration: "5m 30s" },
    { content_duration: "10m 15s" },
    { content_duration: "3m 45s" }
];

const stats = getDurationStats(lectures);
console.log(stats.total);    // "19m 30s"
console.log(stats.average);  // "6m 30s"
console.log(stats.min);      // "3m 45s"
console.log(stats.max);      // "10m 15s"
console.log(stats.count);    // 3
```

---

### 6. `compareDurations(duration1, duration2)`
**Purpose**: Compare two duration strings

**Parameters**:
- `duration1` (String): First duration
- `duration2` (String): Second duration

**Returns**: Number - `-1` if duration1 < duration2, `0` if equal, `1` if duration1 > duration2

**Example**:
```javascript
compareDurations("5m", "10m");      // -1 (5m is less than 10m)
compareDurations("1h", "30m");      // 1  (1h is greater than 30m)
compareDurations("5m", "300s");     // 0  (5m equals 300s)

// Use in sorting
const lectures = [...];
lectures.sort((a, b) => 
    compareDurations(a.content_duration, b.content_duration)
);
```

---

### 7. `exceedsThreshold(durationString, thresholdSeconds)`
**Purpose**: Check if duration exceeds a threshold

**Parameters**:
- `durationString` (String): Duration to check
- `thresholdSeconds` (Number): Threshold in seconds

**Returns**: Boolean

**Example**:
```javascript
exceedsThreshold("10m", 300);    // true (10m = 600s > 300s)
exceedsThreshold("3m", 300);     // false (3m = 180s < 300s)
exceedsThreshold("5m", 300);     // false (5m = 300s = 300s)

// Use for filtering long videos
const longVideos = lectures.filter(lecture => 
    exceedsThreshold(lecture.content_duration, 600) // > 10 minutes
);
```

---

## Real-World Usage Examples

### Example 1: Course Duration Display
```jsx
import { calculateTotalDuration } from '../../utils/durationUtils';

function CourseCard({ course }) {
    return (
        <div>
            <h3>{course.title}</h3>
            <p>Total Duration: {calculateTotalDuration(course.lectures)}</p>
        </div>
    );
}
```

### Example 2: Video Player Duration
```jsx
import { formatDurationStyle } from '../../utils/durationUtils';

function VideoPlayer({ video }) {
    return (
        <div>
            <video src={video.url} />
            <span className="duration">
                {formatDurationStyle(video.content_duration, 'clock')}
            </span>
        </div>
    );
}
```

### Example 3: Course Statistics
```jsx
import { getDurationStats } from '../../utils/durationUtils';

function CourseStatistics({ course }) {
    const stats = getDurationStats(course.lectures);
    
    return (
        <div>
            <p>Total Content: {stats.total}</p>
            <p>Average Lecture: {stats.average}</p>
            <p>Shortest: {stats.min}</p>
            <p>Longest: {stats.max}</p>
            <p>{stats.count} lectures</p>
        </div>
    );
}
```

### Example 4: Sort Lectures by Duration
```jsx
import { compareDurations } from '../../utils/durationUtils';

function LectureList({ lectures }) {
    const sortedLectures = [...lectures].sort((a, b) =>
        compareDurations(a.content_duration, b.content_duration)
    );
    
    return (
        <div>
            {sortedLectures.map(lecture => (
                <div key={lecture.id}>
                    {lecture.title} - {lecture.content_duration}
                </div>
            ))}
        </div>
    );
}
```

### Example 5: Filter by Duration
```jsx
import { exceedsThreshold, parseDurationToSeconds } from '../../utils/durationUtils';

function FilteredLectures({ lectures }) {
    // Show only lectures longer than 10 minutes
    const longLectures = lectures.filter(lecture =>
        exceedsThreshold(lecture.content_duration, 600)
    );
    
    // Show only lectures between 5-15 minutes
    const mediumLectures = lectures.filter(lecture => {
        const seconds = parseDurationToSeconds(lecture.content_duration);
        return seconds >= 300 && seconds <= 900;
    });
    
    return (
        <div>
            <h3>Long Lectures ({longLectures.length})</h3>
            <h3>Medium Lectures ({mediumLectures.length})</h3>
        </div>
    );
}
```

---

## CourseDetail Integration

### Before (❌ Broken):
```jsx
// This was trying to add strings, resulting in concatenation not addition
{course?.lectures?.reduce((total, lecture) => {
    if (lecture.content_duration) {
        return total + lecture.content_duration;  // "0" + "5m 30s" = "05m 30s" ❌
    }
    return total;
}, 0) || "N/A"}
```

### After (✅ Fixed):
```jsx
import { calculateTotalDuration } from '../../utils/durationUtils';

// Clean, working solution
{calculateTotalDuration(course?.lectures || [])}
// Output: "2h 15m 30s" ✅
```

---

## Error Handling

All functions handle edge cases gracefully:

```javascript
// Empty/null inputs
calculateTotalDuration([]);           // "0m 0s"
calculateTotalDuration(null);         // "0m 0s"
parseDurationToSeconds("");           // 0
formatDuration(0);                    // "0m 0s"

// Invalid formats
parseDurationToSeconds("invalid");    // 0
parseDurationToSeconds("5 minutes");  // 0 (requires "5m" format)

// Missing data
const lectures = [
    { content_duration: "5m" },
    { content_duration: null },       // Skipped
    { content_duration: undefined },  // Skipped
    { content_duration: "10m" }
];
calculateTotalDuration(lectures);     // "15m 0s" (only counts valid durations)
```

---

## Performance Considerations

- ✅ **Lightweight**: Pure JavaScript, no dependencies
- ✅ **Fast**: Regex parsing is efficient for small strings
- ✅ **Memoization**: Can be wrapped with `useMemo` for React optimization

**React Optimization Example**:
```jsx
import { useMemo } from 'react';
import { calculateTotalDuration } from '../../utils/durationUtils';

function CourseInfo({ course }) {
    const totalDuration = useMemo(
        () => calculateTotalDuration(course?.lectures || []),
        [course?.lectures]
    );
    
    return <p>Total: {totalDuration}</p>;
}
```

---

## Testing Examples

```javascript
import { parseDurationToSeconds, formatDuration, calculateTotalDuration } from './durationUtils';

// Test parsing
console.assert(parseDurationToSeconds("1h 20m 15s") === 4815);
console.assert(parseDurationToSeconds("5m 30s") === 330);
console.assert(parseDurationToSeconds("45s") === 45);

// Test formatting
console.assert(formatDuration(4815) === "1h 20m 15s");
console.assert(formatDuration(330) === "5m 30s");
console.assert(formatDuration(45) === "45s");

// Test calculation
const lectures = [
    { content_duration: "5m" },
    { content_duration: "10m" }
];
console.assert(calculateTotalDuration(lectures) === "15m 0s");
```

---

## Migration Guide

### Step 1: Install Utility
```bash
# File already created at:
# frontend/src/utils/durationUtils.js
```

### Step 2: Import in Components
```jsx
import { calculateTotalDuration } from '../../utils/durationUtils';
```

### Step 3: Replace Manual Calculations
```jsx
// Old way (manual)
const totalSeconds = lectures.reduce((total, lecture) => {
    // 40+ lines of parsing code...
}, 0);

// New way (utility)
const total = calculateTotalDuration(lectures);
```

---

## Browser Compatibility

✅ **ES6+** (2015+)
- Chrome 51+
- Firefox 54+
- Safari 10+
- Edge 14+
- Node.js 6+

All modern browsers supported. Uses standard JavaScript features:
- Array methods (`reduce`, `map`, `filter`)
- Regular expressions
- Math operations
- Template literals

---

## Future Enhancements

Potential additions for future versions:

1. **Internationalization**:
   ```javascript
   formatDuration(330, { locale: 'id' });  // "5 menit 30 detik"
   ```

2. **Approximate Formatting**:
   ```javascript
   formatDuration(4815, { approximate: true });  // "sekitar 1 jam"
   ```

3. **Range Formatting**:
   ```javascript
   formatDurationRange("5m", "10m");  // "5-10 menit"
   ```

---

## Troubleshooting

### Problem: Duration shows "0m 0s"
**Solution**: Check that `content_duration` property exists and is formatted correctly

```javascript
// Check data format
console.log(course.lectures[0].content_duration);  // Should be "5m 30s"

// Verify property name
calculateTotalDuration(lectures, 'duration');  // If property is named 'duration'
```

### Problem: Duration calculation seems wrong
**Solution**: Verify duration string format

```javascript
// Correct formats
"5m 30s"    ✅
"1h 20m"    ✅
"45s"       ✅

// Incorrect formats
"5 min"     ❌
"1:30:00"   ❌
"90"        ❌
```

---

## Credits

**Created**: October 8, 2025  
**Purpose**: Fix duration calculation in CourseDetail component  
**Location**: `frontend/src/utils/durationUtils.js`

---

*End of Duration Utilities Documentation*
