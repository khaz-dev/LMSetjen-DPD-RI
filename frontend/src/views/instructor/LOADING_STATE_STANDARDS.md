# Instructor Page Loading State Standards

## ⚠️ CRITICAL: Never Block Page Loading

**ALL instructor pages MUST follow the non-blocking loading pattern.**

---

## ✅ CORRECT Pattern (Non-Blocking)

### Required Imports
```jsx
import MinimalLoader from "./Partials/MinimalLoader";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import Header from "./Partials/Header";
import Sidebar from "./Partials/Sidebar";
```

### Loading State Structure
```jsx
// At the component return statement
if (loading) {  // or: if (uiState.loading && !data.title)
    return (
        <>
            <BaseHeader />
            <MinimalLoader message="Loading [Page Name]..." />
            <section style={{ 
                minHeight: 'calc(100vh - 120px)', 
                display: 'flex', 
                alignItems: 'center' 
            }}>
                <div className="container" style={{ flex: 1 }}>
                    <Header />
                    <div className="row">
                        <Sidebar />
                        <div className="col-lg-9 col-md-8 col-12" style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            minHeight: '60vh' 
                        }}>
                            <div className="text-center">
                                <div className="spinner-border text-primary" role="status" style={{ 
                                    width: '3rem', 
                                    height: '3rem' 
                                }}>
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                                <p className="mt-3 text-muted">Loading [Page Name]...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            <Footer />
        </>
    );
}
```

---

## ❌ WRONG Patterns (NEVER USE)

### ❌ Full-Page Blocking Overlay
```jsx
// NEVER DO THIS - Blocks entire page
if (loading) {
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            zIndex: 9999,
            width: '100vw',
            height: '100vh',
            background: 'rgba(255,255,255,0.95)'
        }}>
            <div className="spinner-border"></div>
        </div>
    );
}
```

### ❌ Old LoadingSpinner Component
```jsx
// NEVER DO THIS - Deprecated component
if (loading) {
    return <LoadingSpinner fullPage={true} message="Loading..." />;
}
```

### ❌ Multiple Loading Conditions
```jsx
// NEVER DO THIS - Duplicate/conflicting conditions
if (uiState.loading) {
    return <FullPageOverlay />;  // First condition
}

if (uiState.loading && !course.title) {
    return <ProperLoadingState />;  // Second condition - causes conflicts!
}
```

---

## 🎯 Key Principles

### 1. **Always Show Layout Structure**
- ✅ BaseHeader visible
- ✅ Header visible
- ✅ Sidebar visible
- ✅ Footer visible
- ✅ MinimalLoader at top (non-blocking progress bar)

### 2. **Center Content Loading**
- Use flexbox for centered spinner
- Parent container fills viewport height
- Content column centered with `display: flex` + `align-items: center` + `justify-content: center`

### 3. **Single Loading Condition**
- ONE loading check per component
- No duplicate or nested loading conditions
- Clear condition: `if (loading)` or `if (uiState.loading && !data.title)`

### 4. **Consistent Styling**
- Section: `minHeight: calc(100vh - 120px)`
- Content column: `minHeight: 60vh`
- Spinner: `width: 3rem, height: 3rem`
- Message below spinner with `mt-3` margin

---

## 📋 Checklist for New/Modified Pages

Before committing changes to any instructor page:

- [ ] Page uses MinimalLoader (not LoadingSpinner)
- [ ] Loading state shows BaseHeader, Header, Sidebar, Footer
- [ ] Only ONE loading condition exists
- [ ] Spinner is centered using flexbox
- [ ] No `position: fixed` with `zIndex: 9999`
- [ ] No full-page overlays blocking content
- [ ] Message matches page context ("Loading Dashboard...", etc.)
- [ ] Verified zero compilation errors

---

## 🔍 Verification Commands

Run these to check for violations:

```powershell
# Check for blocking patterns
grep -r "position.*fixed.*zIndex.*9999" frontend/src/views/instructor/*.jsx

# Check for old LoadingSpinner usage
grep -r "LoadingSpinner fullPage" frontend/src/views/instructor/*.jsx

# Check for duplicate loading conditions
grep -r "if.*loading.*return" frontend/src/views/instructor/*.jsx
```

---

## 📦 Affected Pages (All Must Follow Standard)

1. ✅ Dashboard.jsx
2. ✅ Courses.jsx
3. ✅ Profile.jsx
4. ✅ Review.jsx
5. ✅ TeacherNotification.jsx
6. ✅ QA.jsx
7. ✅ Students.jsx
8. ✅ CourseQuiz.jsx
9. ✅ CourseEdit.jsx
10. ✅ CourseEditCurriculum.jsx

---

## 🐛 Bug History

### Issue: CourseEditCurriculum Blocking Load (2024-10-19)
- **Problem**: Duplicate loading conditions - one blocking overlay + one proper pattern
- **Root Cause**: Old blocking overlay code (lines 2855-2887) not removed when proper pattern was added
- **Fix**: Removed duplicate `if (uiState.loading)` condition with fixed positioning
- **Lesson**: Always verify only ONE loading condition exists after updates

---

## 🚀 Future Improvements

Consider these enhancements:
- Create reusable `<InstructorLoadingState>` component
- Add TypeScript types for loading state consistency
- Implement automated tests to prevent blocking patterns
- Add ESLint rule to detect `position: fixed` with high z-index in loading states

---

**Last Updated**: October 19, 2024  
**Maintained By**: Development Team  
**Status**: ✅ Active Standard - All Pages Compliant
