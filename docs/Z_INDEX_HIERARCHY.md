# Z-Index Hierarchy Documentation

## Overview
This document establishes the z-index hierarchy for the LMS application to prevent overlay conflicts and ensure proper stacking of UI elements.

## Z-Index Scale

### Level 0-10: Base Content Layer
```css
z-index: 0-10
```
**Usage:** Background elements, base content, decorative elements
- `z-index: 0` - Sidebar base elements
- `z-index: 1` - Card overlays, gradient effects
- `z-index: 2` - Content foreground elements
- `z-index: 3` - Tooltips, small dropdowns
- `z-index: 10` - Local dropdown menus, search bars

**Examples:**
- `.instructor-header-card::before` - z-index: 1
- `.course-card-overlay` - z-index: 2
- `.dropdown-menu` - z-index: 10

### Level 100-900: Component Layer
```css
z-index: 100-900
```
**Usage:** Standalone components, modals backgrounds, larger overlays
- `z-index: 100` - File upload overlays
- `z-index: 500` - Video players, embedded content
- `z-index: 900-999` - Pre-modal overlays

**Examples:**
- `.video-overlay` - z-index: 100
- `.loading-overlay` - z-index: 10
- `.base-header .dropdown-backdrop` - z-index: 999

### Level 1000-1029: Modal Layer
```css
z-index: 1000-1029
```
**Usage:** Modal dialogs, overlays, important UI elements
- `z-index: 1000` - Standard modals (Bootstrap default)
- `z-index: 1001` - Modal backdrops
- `z-index: 1010` - Nested modals
- `z-index: 1020` - Critical modals

**Examples:**
- Bootstrap modals - z-index: 1055 (default)
- `.course-preview-modal` - z-index: 1000
- `.modal-backdrop` - z-index: 1040

### Level 1030-1039: Fixed Headers
```css
z-index: 1030-1039
```
**Usage:** Fixed navigation headers that should stay above content but below dropdowns
- `z-index: 1030` - Main navigation headers

**Examples:**
- `.base-header` - z-index: 1030
- `.admin-header` - z-index: 1030

### Level 1040-1049: Dropdown Menus
```css
z-index: 1040-1049
```
**Usage:** Dropdown menus that should appear above fixed headers
- `z-index: 1040` - Select dropdowns, autocomplete menus
- `z-index: 1041` - Context menus

**Examples:**
- `.country-selector-dropdown` - z-index: 1040
- `.search-dropdown` - z-index: 1040

### Level 1050-1099: Critical Overlays
```css
z-index: 1050-1099
```
**Usage:** Critical UI elements that must appear above everything except toasts
- `z-index: 1050` - Navbar in critical state
- `z-index: 1055` - Bootstrap modal (default)
- `z-index: 1060` - Full-screen overlays

**Examples:**
- `.navbar.critical` - z-index: 1050
- `.modal` - z-index: 1055 (Bootstrap)
- `.modal-backdrop` - z-index: 1050 (Bootstrap)

### Level 8001-9999: Notifications Layer
```css
z-index: 8001-9999
```
**Usage:** Toast notifications, alerts that should appear above all other content
- `z-index: 9999` - Toast notifications, system alerts

**Examples:**
- `.toast-container` - z-index: 9999
- `.alert-overlay` - z-index: 9999

### Level 10000+: Emergency Layer
```css
z-index: 10000+
```
**Usage:** Emergency overlays, loading screens that must block all interaction
- `z-index: 10000` - Full-page loading overlays
- `z-index: 10001` - Critical error screens

**Examples:**
- `.full-page-loading` - z-index: 10000
- `.video-modal-overlay` - z-index: 10000

## Fixed Component Z-Index Values

### Headers
```css
.base-header          { z-index: 1030; }
.admin-header         { z-index: 1030; }
.instructor-header    { z-index: 2; }    /* Relative positioning */
.student-header       { z-index: 2; }    /* Relative positioning */
```

### Dropdowns & Selectors
```css
.country-selector-dropdown     { z-index: 1040; }
.search-dropdown               { z-index: 1040; }
.user-menu-dropdown            { z-index: 1040; }
.notification-dropdown         { z-index: 1040; }
```

### Modals
```css
.modal                  { z-index: 1055; }  /* Bootstrap default */
.modal-backdrop         { z-index: 1050; }  /* Bootstrap default */
.course-preview-modal   { z-index: 1000; }
.quiz-modal             { z-index: 1000; }
```

### Overlays
```css
.loading-overlay        { z-index: 10; }    /* Local to parent */
.upload-overlay         { z-index: 100; }
.video-overlay          { z-index: 10000; }
```

### Toasts & Notifications
```css
.toast-container        { z-index: 9999; }
.alert-fixed            { z-index: 9999; }
```

## Best Practices

### 1. **Use Relative Values Within Components**
```css
/* GOOD: Relative z-index within component scope */
.card {
    position: relative;
}
.card::before {
    z-index: 1;
}
.card-content {
    z-index: 2;
}
```

### 2. **Avoid Arbitrary High Values**
```css
/* BAD: Random high values */
.my-dropdown {
    z-index: 999999;  /* ❌ Don't do this */
}

/* GOOD: Follow hierarchy */
.my-dropdown {
    z-index: 1040;    /* ✅ Use defined layer */
}
```

### 3. **Document Custom Z-Index Values**
```css
/* Always add comments for z-index values */
.custom-overlay {
    z-index: 1040;  /* Above fixed headers, below modals */
}
```

### 4. **Test Across Different Contexts**
- Test with modals open
- Test with dropdowns open
- Test with fixed headers
- Test on mobile devices
- Test with multiple overlays

### 5. **Use CSS Variables for Common Values**
```css
:root {
    --z-dropdown: 1040;
    --z-modal: 1055;
    --z-toast: 9999;
}

.my-dropdown {
    z-index: var(--z-dropdown);
}
```

## Common Issues & Solutions

### Issue 1: Dropdown Hidden Behind Fixed Header
**Problem:** Dropdown menu appears behind the fixed navigation header.

**Solution:**
```css
/* BEFORE */
.my-dropdown {
    z-index: 1000;  /* Below header (1030) */
}

/* AFTER */
.my-dropdown {
    z-index: 1040;  /* Above header */
}
```

### Issue 2: Modal Backdrop Wrong Order
**Problem:** Modal content appears behind the backdrop.

**Solution:**
```css
/* Ensure modal has higher z-index than backdrop */
.modal-backdrop {
    z-index: 1050;
}
.modal {
    z-index: 1055;
}
```

### Issue 3: Tooltips Hidden in Modals
**Problem:** Tooltips inside modals don't appear.

**Solution:**
```css
/* Use portal or increase z-index */
.tooltip {
    z-index: 1060;  /* Above modal (1055) */
}
```

### Issue 4: Fixed Header Overlaps Content
**Problem:** Fixed header covers page content at the top.

**Solution:**
```css
/* Add top padding to main content */
.main-content {
    padding-top: 85px;  /* Header height + spacing */
}
```

## Testing Checklist

Before deploying changes involving z-index:

- [ ] Test all dropdown menus open correctly
- [ ] Test modals appear above all content
- [ ] Test fixed headers don't cover content
- [ ] Test mobile responsive behavior
- [ ] Test with multiple overlays simultaneously
- [ ] Test keyboard navigation (Tab order)
- [ ] Test screen reader announcements
- [ ] Test on different browsers (Chrome, Firefox, Safari, Edge)
- [ ] Test with browser zoom (50%, 100%, 200%)
- [ ] Document any new z-index values in this file

## Recent Changes

### October 18, 2025
- **Country Selector Dropdown:** Changed from `z-index: 1000` to `z-index: 1040`
  - **Reason:** Was appearing behind BaseHeader (z-index: 1030)
  - **Location:** `frontend/src/components/CountrySelector/CountrySelector.css`
  - **Impact:** Now appears above fixed headers as intended

## Related Documentation

- [Header Spacing Requirements](./HEADER_SPACING_REQUIREMENTS.md)
- [Component Stacking Guidelines](./COMPONENT_STACKING.md)
- [CSS Architecture](./CSS_ARCHITECTURE.md)

## Maintenance

This document should be updated whenever:
1. A new z-index value is added
2. A z-index conflict is resolved
3. A new UI layer is introduced
4. Major refactoring affects stacking context

**Last Updated:** October 18, 2025
**Maintainer:** Development Team
