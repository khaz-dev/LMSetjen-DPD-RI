# Deep Scan: CourseQuiz Column Behavior Analysis

## Issue Summary
CourseQuiz page has **CONFLICTING CSS RULES** for collapsed/expanded sidebar behavior that don't match other instructor pages.

---

## Problem Identified

### CourseQuiz.css - TWO Conflicting Media Query Blocks

**Location 1: Lines 1041-1103** (SIDEBAR LAYOUT FIX - Correct Pattern)
```css
@media (min-width: 992px) {
    /* Expanded state: col-lg-9 = 75% */
    .modern-dashboard .col-lg-9 {
        flex: 0 0 auto !important;
        width: 75% !important;
        max-width: 75% !important;
    }
    
    /* Collapsed state: col-lg-9 = 100% - 100px (sidebar width) */
    .modern-dashboard .col-lg-9:has(~ .col-lg-3 .instructor-sidebar.collapsed),
    .modern-dashboard .row:has(.instructor-sidebar.collapsed) > .col-lg-9 {
        flex: 1 1 auto !important;
        width: calc(100% - 100px) !important;
        max-width: calc(100% - 100px) !important;
    }
}
```

**Location 2: Lines 1117-1170** (RESPONSIVE LAYOUT - Conflicting Rules)
```css
@media (min-width: 992px) {
    .instructor-course-quiz-page .row > .col-lg-9 {
        flex: 1 1 auto;
        min-width: 500px;
    }
}

@media (min-width: 992px) {
    .instructor-course-quiz-page .row > .col-lg-9 {
        flex: 1 1 auto;
        min-width: 0;
        width: auto;
        max-width: 100%;
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .instructor-course-quiz-page .row > .col-lg-9 {
        min-width: 500px;
    }
}
```

### CSS Cascade Conflict
- **Location 1** uses: `.modern-dashboard .col-lg-9` selector
- **Location 2** uses: `.instructor-course-quiz-page .row > .col-lg-9` selector
- **Result**: Location 2 rules OVERRIDE Location 1 because more specific selector

**Winner in CSS Cascade**:
```css
.instructor-course-quiz-page .row > .col-lg-9 {
    flex: 1 1 auto;
    min-width: 0;
    width: auto;  /* <-- BROKEN: Overrides fixed width from Location 1 */
    max-width: 100%;  /* <-- BROKEN: Overrides max-width from Location 1 */
}
```

---

## Comparison with Other Pages

### CourseEdit.css - CORRECT Pattern
- **Only ONE media query block** for sidebar collapse behavior (Lines 1402-1459)
- Uses `.course-edit-container .col-lg-9:has()` selector
- Uses `.course-edit-container` prefix consistently
- **No conflicting rules** that override the collapse logic

```css
/* Single, unified media query section */
@media (min-width: 992px) {
    .course-edit-container .col-lg-9 { width: 75% !important; }
    .course-edit-container .col-lg-9:has(~ .col-lg-3 .instructor-sidebar.collapsed) {
        width: calc(100% - 100px) !important;
    }
}
```

### Dashboard.css - CORRECT Pattern
- **Uses two separate sections** BUT with proper selector specificity
- Location 1: Lines ~59-87: Uses `.modern-dashboard .col-lg-9`
- Location 2: Lines ~1087-1140: Uses `.modern-dashboard .row > .col-lg-9`
- Both use same prefix `.modern-dashboard` so no selector conflict
- Responsive rules use `width: auto` WITHOUT `!important` (won't override Location 1's `!important`)

```css
/* Location 1: Base rules with !important */
.modern-dashboard .row:has(.instructor-sidebar-column) > .col-lg-9 {
    width: calc(100% - var(--bs-gutter-x, 24px)) !important;
    flex: 1 1 auto !important;
}

/* Location 2: Responsive rules WITHOUT !important (doesn't override) */
@media (min-width: 992px) {
    .modern-dashboard .row > .col-lg-9 {
        flex: 1 1 auto;
        width: auto;  /* <-- No !important, won't override Location 1 */
        max-width: 100%;
    }
}
```

### Courses.css, Students.css, Review.css, QA.css, etc.
- **Only ONE media query section** for sidebar collapse behavior
- Uses page-specific container prefix consistently
- **No conflicting rules**

---

## Root Cause

**CourseQuiz.css Problem**:
1. Lines 1041-1103: Defines collapse behavior with `.modern-dashboard` prefix
2. Lines 1117-1170: Defines responsive behavior with `.instructor-course-quiz-page` prefix
3. **More specific selector wins**: `.instructor-course-quiz-page .row > .col-lg-9` beats `.modern-dashboard .col-lg-9`
4. **Result**: Collapse rules are ignored, columns stay at `width: auto` in both expanded AND collapsed states

---

## What Should Happen

### Expanded State (Sidebar Not Collapsed)
- col-lg-3 sidebar = 25% width
- col-lg-9 content = 75% width

### Collapsed State (Sidebar Collapsed)
- col-lg-3 sidebar = 100px width (fixed)
- col-lg-9 content = calc(100% - 100px) width
- Content expands to fill the extra space

### Current Behavior in CourseQuiz
- **Both states**: col-lg-9 = `width: auto` with `min-width: 500px`
- **Result**: No responsive behavior, columns don't adapt to sidebar collapse

---

## Solution

### Option 1: Remove Duplicate/Conflicting Rules (RECOMMENDED)
Remove the conflicting media query sections (Lines 1117-1170) that override the collapse logic.

### Option 2: Make Responsive Rules More Specific
Add the collapse selectors to the responsive media queries:

```css
@media (min-width: 992px) {
    /* Expanded state */
    .instructor-course-quiz-page .row > .col-lg-9 {
        flex: 1 1 auto;
        min-width: 500px;
        width: 75%;
        max-width: 75%;
    }
    
    /* Collapsed state - with explicit selectors */
    .instructor-course-quiz-page .row > .col-lg-9:has(~ .col-lg-3 .instructor-sidebar.collapsed),
    .instructor-course-quiz-page .row:has(.instructor-sidebar.collapsed) > .col-lg-9 {
        width: calc(100% - 100px) !important;
        max-width: calc(100% - 100px) !important;
        min-width: auto;
    }
}
```

### Option 3: Use !important Flags (Risky)
Add `!important` to the collapse selectors in Location 1 to force them to win cascade.

---

## Files Affected

| File | Issue | Status |
|------|-------|--------|
| CourseQuiz.css | Conflicting media query selectors | ❌ NEEDS FIX |
| CourseEdit.css | Single, unified section | ✅ CORRECT |
| Dashboard.css | Two sections but no selector conflict | ✅ CORRECT |
| CourseEditCurriculum.css | Single, unified section | ✅ CORRECT |
| Courses.css | Single, unified section | ✅ CORRECT |
| Students.css | Single, unified section | ✅ CORRECT |
| Review.css | Single, unified section | ✅ CORRECT |
| QA.css | Single, unified section | ✅ CORRECT |
| Profile.css | Single, unified section | ✅ CORRECT |
| ChangePassword.css | Single, unified section | ✅ CORRECT |
| TeacherNotification.css | Single, unified section | ✅ CORRECT |

---

## Recommended Fix

**Apply Option 1 + Option 2 combined**:
1. Remove the conflicting media query block (Lines 1117-1170)
2. Update the SIDEBAR LAYOUT FIX section to include responsive logic
3. Replace `.modern-dashboard` selectors with `.instructor-course-quiz-page` or `.modern-dashboard` (use consistently with rest of file)
4. Ensure collapse selectors have proper specificity and `!important` flags

---

## Expected Result After Fix

CourseQuiz will match behavior of other instructor pages:
- ✅ Sidebar expands to normal width → content shrinks to 75%
- ✅ Sidebar collapses to 100px → content expands to fill remaining space
- ✅ Smooth CSS transitions during collapse/expand
- ✅ No layout jumping or unexpected resizing
