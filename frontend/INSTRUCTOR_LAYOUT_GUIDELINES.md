# Instructor Pages Layout Guidelines

## Purpose
This document ensures uniform positioning of the instructor-header-card across ALL instructor pages.

## Required Structure

### 1. Standard Page Layout
Every instructor page MUST follow this exact structure:

```jsx
<>
    <BaseHeader />
    
    <section className="modern-dashboard"> {/* or page-specific class */}
        <div className="container">
            <Header /> {/* This renders instructor-header-card */}
            
            <div className="row mt-0 mt-md-4"> {/* CRITICAL: Must have mt-0 mt-md-4 */}
                <Sidebar />
                <div className="col-lg-9 col-md-8 col-12">
                    {/* Page content here */}
                </div>
            </div>
        </div>
    </section>
    
    <Footer />
</>
```

### 2. Critical Classes Explained

**Row Classes: `mt-0 mt-md-4`**
- `mt-0`: NO margin-top on mobile (< 768px)
- `mt-md-4`: 1.5rem margin-top on tablets and above (≥ 768px)
- These classes create proper spacing between Header and content row
- **NEVER** omit these classes or the layout will be inconsistent

### 3. CSS Rules That Control Spacing

#### InstructorHeader.css (Base Styling)
```css
.instructor-header-card {
    margin-top: 1.5rem;    /* Top spacing from container */
    margin-bottom: 1.5rem; /* Bottom spacing to row */
}
```

#### Sidebar.css (Responsive Behavior)
```css
/* Only affects mobile - allows mt-md-4 to work on larger screens */
@media (max-width: 767px) {
    .row:has(.instructor-sidebar) {
        margin-top: 0 !important;
    }
}
```

## Pages Checklist

### ✅ Correct Implementation
All these pages have the correct `mt-0 mt-md-4` classes:

- ✅ Courses.jsx
- ✅ Dashboard.jsx (FIXED)
- ✅ CourseCreate.jsx
- ✅ CourseEdit.jsx
- ✅ CourseEditCurriculum.jsx
- ✅ CourseQuiz.jsx
- ✅ Students.jsx
- ✅ Review.jsx
- ✅ QA.jsx
- ✅ QADetail.jsx
- ✅ TeacherNotification.jsx
- ✅ Profile.jsx
- ✅ ChangePassword.jsx

## Common Mistakes to Avoid

### ❌ WRONG: Missing row classes
```jsx
<Header />
<div className="row"> {/* WRONG - missing mt-0 mt-md-4 */}
    <Sidebar />
    ...
</div>
```

### ❌ WRONG: Using !important to override
```css
/* Don't add page-specific overrides like this */
.some-page .instructor-header-card {
    margin-top: 2rem !important; /* WRONG */
}
```

### ✅ CORRECT: Standard implementation
```jsx
<Header />
<div className="row mt-0 mt-md-4"> {/* CORRECT */}
    <Sidebar />
    ...
</div>
```

## Spacing Breakdown

### Mobile (< 768px)
```
Container
├─ Header Component (instructor-header-card)
│  ├─ margin-top: 1.5rem
│  └─ margin-bottom: 1.5rem
└─ Row (mt-0)
   ├─ margin-top: 0 (from mt-0 class)
   └─ Content starts immediately after header
```

### Tablet & Desktop (≥ 768px)
```
Container
├─ Header Component (instructor-header-card)
│  ├─ margin-top: 1.5rem
│  └─ margin-bottom: 1.5rem
└─ Row (mt-md-4)
   ├─ margin-top: 1.5rem (from mt-md-4 class)
   └─ Total gap: 3rem (1.5rem from header + 1.5rem from row)
```

## Testing Checklist

When adding or modifying an instructor page:

1. ✅ Verify `<Header />` is directly inside `.container`
2. ✅ Verify row has `className="row mt-0 mt-md-4"`
3. ✅ Test on mobile (< 768px) - header should be close to row
4. ✅ Test on tablet/desktop (≥ 768px) - header should have visible gap
5. ✅ Compare with other instructor pages - spacing should match exactly

## Maintenance Notes

### What NOT to Change
- ❌ Don't modify `InstructorHeader.css` margin values without updating this document
- ❌ Don't add page-specific CSS overrides for instructor-header-card margins
- ❌ Don't change Sidebar.css responsive behavior without testing all pages

### What IS Safe to Change
- ✅ Content inside `col-lg-9` column
- ✅ Page-specific content styling (cards, tables, forms, etc.)
- ✅ Additional rows below the main sidebar row

## Quick Fix Guide

If you notice inconsistent header spacing:

1. Check if row has `mt-0 mt-md-4` classes
2. Check browser DevTools for conflicting CSS rules
3. Verify Sidebar.css hasn't been modified incorrectly
4. Compare HTML structure with this document

## Contact

For questions about instructor layout:
- Check this document first
- Review InstructorHeader.css
- Review Sidebar.css
- Test on multiple screen sizes before committing changes

---

**Last Updated:** October 19, 2025
**Version:** 1.0
**Status:** Enforced across all instructor pages
