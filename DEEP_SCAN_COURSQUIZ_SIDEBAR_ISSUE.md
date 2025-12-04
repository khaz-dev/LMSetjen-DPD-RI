# Deep Scan: CourseQuiz Sidebar Column Behavior Issue

## CRITICAL ISSUE FOUND ⚠️

### Problem: CSS Selector Mismatch

**CourseQuiz JSX Structure** (Line 437 of CourseQuiz.jsx):
```jsx
<div className="modern-dashboard">
    <div className="container">
        <Header />
        <div className="row">
            <Sidebar />
            <div className="col-lg-9 col-md-8 col-12">
```

**CourseQuiz CSS Targeting** (CourseQuiz.css Lines 1040+):
```css
@media (min-width: 992px) {
    .instructor-course-quiz-page .row > .instructor-sidebar-column {
        /* ... rules ... */
    }
    
    .instructor-course-quiz-page .row > .col-lg-9 {
        /* ... rules ... */
    }
    
    .instructor-course-quiz-page .row > .col-lg-3:has(.instructor-sidebar.collapsed) {
        /* ... rules ... */
    }
}
```

### THE PROBLEM

CourseQuiz JSX uses **`.modern-dashboard`** class but its CSS uses **`.instructor-course-quiz-page`** selector!

**Result**: None of the CourseQuiz-specific CSS rules apply because the selector doesn't match the actual HTML structure.

---

## Comparison with Other Pages

### CourseEdit (CORRECT) ✅
**JSX** (CourseEdit.jsx line 531):
```jsx
<section className="instructor-course-edit-page">
```

**CSS** (CourseEdit.css):
```css
.instructor-course-edit-page .row > .instructor-sidebar-column { ... }
.instructor-course-edit-page .row > .col-lg-9 { ... }
```

**Match**: ✅ Perfect match - selectors apply to the actual HTML

### Dashboard (CORRECT) ✅
**JSX** (Dashboard.jsx):
```jsx
<div className="modern-dashboard">
```

**CSS** (Dashboard.css):
```css
.modern-dashboard .row > .instructor-sidebar-column { ... }
.modern-dashboard .row > .col-lg-9 { ... }
```

**Match**: ✅ Perfect match - selectors apply to the actual HTML

### CourseQuiz (BROKEN) ❌
**JSX** (CourseQuiz.jsx line 437):
```jsx
<div className="modern-dashboard">
```

**CSS** (CourseQuiz.css):
```css
.instructor-course-quiz-page .row > .instructor-sidebar-column { ... }
.instructor-course-quiz-page .row > .col-lg-9 { ... }
```

**Match**: ❌ NO MATCH - CSS selectors don't target the actual HTML element!

---

## Why This Causes Odd Behavior

### When Sidebar IS Collapsed
- CourseQuiz CSS rules try to apply: `width: calc(100% - 100px)`
- **But they never execute** because selector doesn't match
- **Result**: Content column stays at default width instead of expanding

### When Sidebar is Expanded
- CourseQuiz CSS rules try to apply: `width: 75%`
- **But they never execute** because selector doesn't match
- **Result**: Content column sizing is inconsistent with other pages

### Fallback Behavior
CourseQuiz ends up using:
1. **Base CSS from CourseQuiz.css** (Lines 35-87): Uses `.instructor-course-quiz-page` (doesn't match)
2. **Inherited CSS from Dashboard.css** (imported via CourseEdit.css): Uses `.modern-dashboard` - **THIS PARTIALLY WORKS**
3. **Bootstrap defaults**: Column sizing falls back to Bootstrap responsive classes

---

## CSS Import Chain

CourseQuiz.css (Line 5):
```css
@import url('./CourseEdit.css');
```

CourseEdit.css does NOT import anything else, so CourseQuiz doesn't get Dashboard CSS rules.

---

## Solution

Change CourseQuiz CSS to use **`.modern-dashboard`** instead of **`.instructor-course-quiz-page`**.

### Current (BROKEN):
```css
@media (min-width: 992px) {
    .instructor-course-quiz-page .row > .instructor-sidebar-column { ... }
    .instructor-course-quiz-page .row > .col-lg-9 { ... }
    .instructor-course-quiz-page .row > .col-lg-9:has(~ .col-lg-3 .instructor-sidebar.collapsed) { ... }
}
```

### Should Be (FIXED):
```css
@media (min-width: 992px) {
    .modern-dashboard .row > .instructor-sidebar-column { ... }
    .modern-dashboard .row > .col-lg-9 { ... }
    .modern-dashboard .row > .col-lg-9:has(~ .col-lg-3 .instructor-sidebar.collapsed) { ... }
}
```

---

## Expected Result After Fix

CourseQuiz sidebar behavior will match **Dashboard.css** patterns:
- ✅ Sidebar expands → content shrinks to proper width
- ✅ Sidebar collapses → content expands correctly
- ✅ CSS transitions smooth
- ✅ No visual anomalies

---

## Files Requiring Changes

1. **frontend/src/views/instructor/CourseQuiz.css** (Lines 1040-1193)
   - Change all `.instructor-course-quiz-page` selectors to `.modern-dashboard`
   - Keep the same media query structure and rules

---

## Summary

| Aspect | Issue |
|--------|-------|
| **Root Cause** | CSS selector mismatch between JSX and CSS |
| **Actual Class Used** | `.modern-dashboard` |
| **CSS Targeting** | `.instructor-course-quiz-page` (doesn't exist in HTML) |
| **Impact** | Sidebar collapse behavior doesn't work properly |
| **Fix** | Replace `.instructor-course-quiz-page` with `.modern-dashboard` in CourseQuiz.css |
| **Severity** | High (Feature broken) |
| **Complexity** | Low (Simple find/replace) |
