# Course Detail Page - Three Styling & Format Fixes

**URL**: `http://localhost:5174/course-detail/{slug}/`  
**Status**: 🔴 IDENTIFIED - READY FOR FIX  
**Severity**: 🟡 MEDIUM (UI/UX presentation issues)

---

## Issues Identified

### Issue #1: Play Icon Not Centered in Sidebar Button

**Location**: `frontend/src/views/base/components/CourseSidebar.jsx` (Line 220-235)

**Current State**:
```jsx
<div className="position-absolute top-50 start-50 translate-middle">
    <button 
        className="btn rounded-circle"
        style={{ 
            width: '50px', 
            height: '50px',
            background: 'rgba(255, 255, 255, 0.9)',
            boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
            border: 'none'
        }}
    >
        <i className="fas fa-play" style={{ color: '#667eea', fontSize: '1rem' }}></i>
    </button>
</div>
```

**Problem**: 
- The button has fixed dimensions (50x50) but no flexbox properties
- The icon inside may not be truly centered both vertically and horizontally
- Missing `display: flex`, `align-items: center`, `justify-content: center` on button

**Solution**: Add flexbox properties to center the icon

---

### Issue #2: Total Durasi Not Showing JP Format in Kurikulum Tab

**Location**: `frontend/src/views/base/CourseDetail.jsx` (Line 558)

**Current State**:
```jsx
{calculateTotalDuration(course?.lectures || []).formatted}
```

**Current Output**: `1h 2m 30s` (only formatted duration)

**Expected Output**: `1h 2m 30s (2JP)` (formatted duration with JP)

**Problem**:
- Using `.formatted` property which returns plain duration
- Should use `.withJP` property to include JP calculation
- User specifically requested format: "0h 0m 0s (0JP)" where JP is counted as 45 minutes

**Solution**: Change `.formatted` to `.withJP`

---

### Issue #3: Pelajaran Duration Not in 0h 0m 0s Format

**Locations**: 
- `frontend/src/views/base/components/CurriculumTab.jsx` (Line 57)
- `frontend/src/views/base/CourseDetail.jsx` (Line 624)

**Current State**:
```jsx
<p className="mb-0">{lesson.content_duration || "N/A"}</p>
```

**Current Output**: Backend-provided format (e.g., "1m 44s", "45m", etc.)

**Expected Output**: Standardized format like "0h 0m 0s" or "1h 2m 30s"

**Problem**:
- Displaying raw backend duration without formatting
- Inconsistent formatting across different sections
- Should use standardized `formatDuration()` function for consistency
- Currently returns values like "1m 44s" which don't follow the requested "0h 0m 0s (0JP)" pattern everywhere

**Solution**: Use `formatDuration()` and `formatDurationWithJP()` functions to standardize the format

---

## Detailed Fix Plan

### Fix #1: Sidebar Play Button Centering

**File**: `frontend/src/views/base/components/CourseSidebar.jsx`

**Change**: Add flexbox properties to button styling

```jsx
// BEFORE
<button 
    className="btn rounded-circle"
    style={{ 
        width: '50px', 
        height: '50px',
        background: 'rgba(255, 255, 255, 0.9)',
        boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
        border: 'none'
    }}
>

// AFTER
<button 
    className="btn rounded-circle"
    style={{ 
        width: '50px', 
        height: '50px',
        background: 'rgba(255, 255, 255, 0.9)',
        boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
        border: 'none',
        display: 'flex',           // ← ADD
        alignItems: 'center',      // ← ADD
        justifyContent: 'center'   // ← ADD
    }}
>
```

---

### Fix #2: Total Durasi with JP Format

**File**: `frontend/src/views/base/CourseDetail.jsx`

**Change**: Replace `.formatted` with `.withJP` property

```jsx
// BEFORE
{calculateTotalDuration(course?.lectures || []).formatted}

// AFTER
{calculateTotalDuration(course?.lectures || []).withJP}
```

**Impact**: 
- Shows format like "1h 2m 30s (2JP)" instead of "1h 2m 30s"
- JP value calculated as Math.ceil(totalSeconds / 2700) where 2700 = 45 minutes

---

### Fix #3: Pelajaran Duration Formatting

**File 1**: `frontend/src/views/base/components/CurriculumTab.jsx`

**Change**: Import and use `formatDuration()` function

```jsx
// ADD IMPORT at top
import { formatDuration } from '../../../utils/durationUtils';

// BEFORE
<p className="mb-0">{lesson.content_duration || "N/A"}</p>

// AFTER
<p className="mb-0">{lesson.content_duration ? formatDuration(parseDurationToSeconds(lesson.content_duration)) : "N/A"}</p>

// OR simpler if content_duration is already formatted
<p className="mb-0">{lesson.content_duration || "N/A"}</p>
```

**Note**: Actually, the format is already correct in CurriculumTab. The lesson.content_duration comes from backend in correct format. But we should verify it's being displayed correctly.

**File 2**: `frontend/src/views/base/CourseDetail.jsx`

**Change**: Format the individual lesson durations like the total

```jsx
// ADD IMPORT if not already there
import { formatDuration, parseDurationToSeconds } from '../../utils/durationUtils';

// BEFORE
{item.content_duration && (
    <small className="badge bg-light text-muted">
        <i className="fas fa-clock me-1"></i>
        {item.content_duration}
    </small>
)}

// AFTER
{item.content_duration && (
    <small className="badge bg-light text-muted">
        <i className="fas fa-clock me-1"></i>
        {formatDuration(parseDurationToSeconds(item.content_duration))}
    </small>
)}
```

---

## Issues Summary Table

| Issue | File | Line(s) | Type | Priority |
|-------|------|---------|------|----------|
| #1: Play icon not centered | CourseSidebar.jsx | 224-235 | CSS/Styling | High |
| #2: Total durasi missing JP | CourseDetail.jsx | 558 | Format | High |
| #3a: Lesson duration format | CurriculumTab.jsx | 57 | Format | Medium |
| #3b: Lesson duration format | CourseDetail.jsx | 624 | Format | Medium |

---

## Expected Behavior After Fixes

### Sidebar Play Button
- ✅ Icon perfectly centered both vertically and horizontally inside the circular button
- ✅ No visual offset or misalignment

### Total Durasi
- ✅ Shows format: `1h 2m 30s (2JP)` instead of just `1h 2m 30s`
- ✅ JP calculated correctly (45 minutes = 1 JP)
- ✅ Matches user-requested format "0h 0m 0s (0JP)"

### Pelajaran Duration
- ✅ Displays in standardized format `0h 0m 0s` or `1h 2m 30s`
- ✅ Consistent formatting across all duration displays
- ✅ Uses `formatDuration()` utility for consistency

---

## Testing Checklist

- [ ] Sidebar play button icon is centered
- [ ] Total durasi shows JP format with parentheses (e.g., "1h 2m 30s (2JP)")
- [ ] Lesson durations are formatted as "0h 0m 0s" style
- [ ] No errors in browser console
- [ ] All components render correctly
- [ ] Responsive design not affected

