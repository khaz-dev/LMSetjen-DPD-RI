# Certificate Display in Main View - PHASE 4.224

**Status**: ✅ Complete
**Date**: February 26, 2026

---

## Overview

Refactored certificate display to appear in the main course view area (between progress card and tabs) when:
1. Certificate has been generated ✅
2. Sertifikat tab is active ✅
3. Video player is hidden to make room ✅

---

## Changes Made

### 1. Added Active Tab Tracking (CourseDetail.jsx)

**New State:**
```jsx
const [activeTab, setActiveTab] = useState('lectures');
```

**Tab Change Listener:**
```jsx
useEffect(() => {
    const tabElements = document.querySelectorAll('[data-bs-toggle="tab"]');
    const handleTabChange = (e) => {
        const target = e.target.getAttribute('data-bs-target');
        const tabName = target?.replace('#', '');
        if (tabName) {
            setActiveTab(tabName);
        }
    };
    
    tabElements.forEach(tab => {
        tab.addEventListener('shown.bs.tab', handleTabChange);
    });
    
    return () => {
        tabElements.forEach(tab => {
            tab.removeEventListener('shown.bs.tab', handleTabChange);
        });
    };
}, []);
```

**Purpose**: Track which tab user is currently viewing

---

### 2. Added Certificate Display in Main View (CourseDetail.jsx)

**Location**: Between course-progress-card and modern-tabs (line 1749-1803)

**Display Logic:**
```jsx
{existingCertificate && existingCertificate.image_file_url && activeTab === 'certificate' && (
    <div className="certificate-display mb-4" ...>
        [Download Button]
        [Certificate Image]
    </div>
)}
```

**Features:**
- Download button works with Phase 4.222 endpoint
- Certificate image displays with proper styling
- Error handling for failed downloads
- Appears ONLY when:
  - `existingCertificate` exists (certificate generated)
  - `image_file_url` is available (PNG file ready)
  - `activeTab === 'certificate'` (user viewing Sertifikat tab)

---

### 3. Updated Video Player Conditional (CourseDetail.jsx)

**Before:**
```jsx
{variantItem && (
    <VideoPlayer ... />
)}
```

**After:**
```jsx
{variantItem && !(existingCertificate?.image_file_url && activeTab === 'certificate') && (
    <VideoPlayer ... />
)}
```

**Logic**: Hide video player when certificate display is shown

---

### 4. Cleaned Up CertificateTab.jsx

**Removed:**
- Download button
- Certificate image display
- Certificate styling

**Kept:**
- Fallback message for pending images
- Manual certificate display (as backup)
- Eligibility checks
- Generation UI

---

## User Experience

### Tab: Pelajaran (Default)
```
┌─ Course Progress Card ─────────────────┐
│ [Progress indicators, badges]          │
└────────────────────────────────────────┘

[VIDEO PLAYER - visible when lesson selected]

┌─ Modern Tabs ──────────────────────────┐
│ [Pelajaran] [Catatan] [Sertifikat]... │
│ Tab content...                         │
└────────────────────────────────────────┘
```

### Tab: Sertifikat (Certificate Generated)
```
┌─ Course Progress Card ─────────────────┐
│ [Progress indicators, badges]          │
└────────────────────────────────────────┘

✨ CERTIFICATE DISPLAY [NEW in Phase 4.224]
┌─ Certificate Display ──────────────────┐
│ [Unduh Sertifikat] Button              │
│ [Certificate PNG Image]                │
│ (border, shadow, proper sizing)        │
└────────────────────────────────────────┘

[VIDEO PLAYER - HIDDEN while cert shows]

┌─ Modern Tabs ──────────────────────────┐
│ [Pelajaran] [Catatan] [Sertifikat]... │
│ (Sertifikat tab content - fallback msg)│
└────────────────────────────────────────┘
```

### Tab: Other Tabs (Notes, Discussion, etc.)
```
[VIDEO PLAYER - shows normally if lesson selected]
[CERTIFICATE - hidden]
[Tab content]
```

---

## Key Behaviors

✅ **Tab Switching:**
- User clicks Sertifikat tab → activeTab = 'certificate'
- Certificate appears in main area → Video player hides
- User clicks Pelajaran tab → activeTab = 'lectures'
- Certificate disappears → Video player shows (if lesson selected)

✅ **Download Functionality:**
- Download button in inline certificate display uses Phase 4.222 endpoint
- Downloads as `{course_id}_{user_id}.png`
- Error handling with Toast notifications

✅ **Image Loading:**
- Loads from `image_file_url` in certificate object
- Error handler if image fails
- Proper sizing and styling

---

## Component Integration

**State Flow:**
```
CourseDetail
├─ existingCertificate (from CertificateTab callback)
├─ activeTab (from Bootstrap tab listener)
├─ variantItem (from LecturesTab)
│
└─ Conditional Rendering:
    ├─ Certificate Display: IF certificate AND image_file_url AND tab='certificate'
    └─ Video Player: IF variantItem AND NOT (certificate AND tab='certificate')
```

**Tab Tracking:**
```
Bootstrap Tabs emit 'shown.bs.tab' event
    ↓
Our event listener captures event
    ↓
Extract tab name from data-bs-target attribute
    ↓
Update activeTab state
    ↓
Re-render conditionals
```

---

## Files Modified

| File | Changes | Purpose |
|------|---------|---------|
| `CourseDetail.jsx` | Added activeTab state, tab listener, certificate display, updated video conditional | Main logic |
| `CertificateTab.jsx` | Removed download button, image display, kept fallback | Cleanup |

---

## Testing Scenarios

### Scenario 1: Navigate to Sertifikat Tab with Certificate
1. Generate certificate for completed course
2. Navigate to course detail page
3. Click "Sertifikat" tab
   - ✅ Certificate appears in main area (between progress and tabs)
   - ✅ Download button visible
   - ✅ Video player hidden
4. Click download
   - ✅ File downloads as `{course_id}_{user_id}.png`

### Scenario 2: Switch Back to Pelajaran Tab
1. On Sertifikat tab viewing certificate
2. Click "Pelajaran" tab
   - ✅ Certificate disappears
   - ✅ Video player shows (if lesson was selected)

### Scenario 3: Select Lesson While on Sertifikat Tab
1. On Sertifikat tab with certificate showing
2. Select a lesson from tab content
   - ✅ Certificate still visible (in main area, not in tab)
   - ✅ Video player still hidden
3. Click Pelajaran tab
   - ✅ Video player appears with selected lesson

### Scenario 4: No Certificate Yet
1. User on Sertifikat tab
2. Certificate not generated
   - ✅ No display in main area
   - ✅ Video player shows normally (if lesson selected)
   - ✅ Tab shows "Buat Sertifikat" button or requirements

---

## CSS Classes Used

| Class | Location | Purpose |
|-------|----------|---------|
| `certificate-display` | CourseDetail | Main container styling |
| `mb-4` | CourseDetail | Bottom margin |
| `d-flex`, `justify-content-center` | Button container | Centering |
| `btn btn-primary` | Download button | Bootstrap styling |
| `fas fa-download` | Icon | Font Awesome |

---

## Bootstrap Integration

**Tabs Used:**
- `data-bs-toggle="tab"` - Bootstrap tab toggle
- `data-bs-target="#certificate"` - Tab target selector
- `shown.bs.tab` event - Fires after tab is shown
- Custom listener detects tab changes and updates state

---

## Performance Considerations

- ✅ No additional API calls (uses existing certificate data)
- ✅ Event listeners cleaned up on unmount (useEffect cleanup)
- ✅ Conditional rendering prevents unnecessary component rendering
- ✅ Image lazy-loaded from URL

---

## Edge Cases Handled

1. **Certificate doesn't exist**: Display hidden, video shows normally
2. **Certificate exists but no image_file_url**: Fallback message in tab, main area empty
3. **Image fails to load**: Error handler, no crash
4. **Download fails**: Toast error notification
5. **Multiple tabs clicked rapidly**: Event listeners handle all events

---

## Phase Integration

- **Phase 4.221**: Certificate image support
- **Phase 4.222**: Semantic filename format (course_id_user_id)
- **Phase 4.223**: Cleanup and tab separation
- **Phase 4.224**: ← Certificate in main view with tab-aware display (YOU ARE HERE)

---

## Code Quality

✅ **Follows Existing Patterns**:
- Uses same conditional rendering style
- StateManagement consistent with rest of component
- Event handling follows Bootstrap conventions

✅ **Cleanup**:
- Event listeners removed on unmount
- No memory leaks

✅ **Error Handling**:
- Download errors caught and displayed
- Image load errors handled gracefully

---

**Status**: ✅ Complete and ready for testing

**Next Steps**: Test all scenarios above on http://localhost:5174/student/courses/124632/
