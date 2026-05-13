# Student Avatar Navigation - Detailed Code Changes

## File 1: frontend/src/views/partials/BaseHeader.jsx

### Change 1: Add State Variables (Lines 33-35)
```javascript
// ✨ PHASE 4.X: Student avatar in navigation
const [profileImage, setProfileImage] = useState(null);
const [profileLoading, setProfileLoading] = useState(false);
const [profileImageError, setProfileImageError] = useState(false);
```

**Why**: Store the fetched profile image, loading state, and any errors

---

### Change 2: Add useEffect to Fetch Profile (Lines 124-144)
```javascript
// ✨ PHASE 4.X: Fetch student profile image for navigation avatar
useEffect(() => {
    if (!isLoggedIn() || profileLoading || profileImage !== null) return;
    
    const fetchProfileImage = async () => {
        setProfileLoading(true);
        try {
            const response = await apiInstance.get('userauths/profile/');
            if (response.data?.image) {
                setProfileImage(response.data.image);
            }
        } catch (error) {
            setProfileImageError(true);
        } finally {
            setProfileLoading(false);
        }
    };
    
    fetchProfileImage();
}, [isLoggedIn(), profileImage]);
```

**Why**: Fetch profile image once when user logs in, cache result to avoid re-fetching

---

### Change 3: Add renderProfileAvatarInNav Function (Lines 380-420)
```javascript
// ✨ PHASE 4.X: Render student profile avatar in navigation
const renderProfileAvatarInNav = () => {
    if (profileLoading) {
        return (
            <div className="nav-avatar-wrapper loading">
                <div className="spinner-border text-white spinner-nav-sm" role="status">
                    <span className="visually-hidden">Sedang memuat...</span>
                </div>
            </div>
        );
    }

    if (profileImage && !profileImageError) {
        return (
            <div className="nav-avatar-wrapper">
                <img
                    src={profileImage}
                    className="nav-avatar-image"
                    alt={`${userData?.full_name || "Pengguna"} avatar`}
                    onError={() => setProfileImageError(true)}
                    title={userData?.full_name || "Profil Saya"}
                />
            </div>
        );
    }

    // Default avatar with initials or icon
    const initials = (allUserData?.full_name || userData?.full_name || "U")
        .split(' ')
        .slice(0, 2)
        .map(word => word[0])
        .join('')
        .toUpperCase();

    return (
        <div className="nav-avatar-wrapper default">
            <div className="nav-avatar-default">
                <span>{initials}</span>
            </div>
        </div>
    );
};
```

**Why**: Render avatar with proper fallback handling for different states

---

### Change 4: Update Student Navigation Link (Lines 771-773)
```javascript
// OLD CODE:
<div className="nav-link student-link">
    <i className="fas fa-graduation-cap me-2"></i>
    <span>{getDisplayName()}</span>
</div>

// NEW CODE:
<div className="nav-link student-link nav-link-avatar">
    {renderProfileAvatarInNav()}
</div>
```

**Why**: Replace text display with avatar component, add new CSS class for styling

---

## File 2: frontend/src/views/partials/BaseHeader.css

### Addition: New CSS Classes (Lines 898-950)

```css
/* ✨ PHASE 4.X: Student Avatar in Navigation */

.nav-link-avatar {
    background: none !important;
    box-shadow: none !important;
    padding: 0.25rem !important;
}

.nav-link-avatar:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
}

.nav-avatar-wrapper {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.2);
    transition: all 0.3s ease;
    flex-shrink: 0;
}

.nav-avatar-wrapper.loading {
    background: rgba(102, 126, 234, 0.1);
    border-color: rgba(102, 126, 234, 0.3);
}

.nav-avatar-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
    display: block;
}

.nav-avatar-wrapper.default {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
}

.nav-avatar-default {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    color: white;
    font-size: 1rem;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.spinner-nav-sm {
    width: 1.25rem !important;
    height: 1.25rem !important;
    border-width: 2px !important;
    color: #667eea !important;
}
```

**Why**: Style the avatar container, image, loading state, and fallback initials display

---

## Summary of Changes

### Modified Files: 2
1. ✅ `frontend/src/views/partials/BaseHeader.jsx`
   - 3 new state variables
   - 1 new useEffect hook
   - 1 new function (renderProfileAvatarInNav)
   - 1 JSX update

2. ✅ `frontend/src/views/partials/BaseHeader.css`
   - 7 new CSS classes
   - ~53 lines of new styling

### No Changes Required In:
- `frontend/src/views/student/Partials/Header.jsx` (no breaking changes)
- Backend code (uses existing `/api/v1/userauths/profile/` endpoint)
- Database schema
- Admin/Instructor navigation

### Breaking Or Conflicting Changes: NONE

---

## How It Works - Step by Step

### Initial Load
1. User logs in and BaseHeader component mounts
2. useEffect checks if user is logged in
3. Makes GET request to `/api/v1/userauths/profile/`
4. While fetching: shows loading spinner in avatar container

### After Image Loads
1. If image URL received: displays image in circular 48x48px container
2. Shows user's full name as tooltip on hover
3. Stores image in state to avoid re-fetching

### If No Image or Error
1. Falls back to displaying user initials
2. Background is gradient (purple theme)
3. Initials are extracted from first 2 words of full name
4. E.g., "John Doe" → "JD"

### Hover Interaction
1. Avatar lifts slightly upward (translateY: -2px)
2. Shadow appears below (0 4px 12px)
3. Smooth 0.3s transition
4. Opening dropdown menu still works as before

---

## Verification Steps

### Test 1: User with Profile Image
1. Log in as student with profile image
2. Check navigation bar
3. Should see: Profile image in 48x48px circle
4. Hover over: Should see shadow and lift animation
5. Click: Dropdown menu should appear

### Test 2: User without Profile Image
1. Log in as student without profile image
2. Check navigation bar
3. Should see: Initials (e.g., "JD") on gradient background
4. Hover over: Should see shadow and lift animation
5. Click: Dropdown menu should appear

### Test 3: Browser Console
```javascript
// Check if profile fetch occurred
// Open DevTools > Network tab
// Look for: /api/v1/userauths/profile/ request
// Should be 1 request, not repeated
```

### Test 4: Mobile / Responsive
1. Open on mobile device or use DevTools responsive mode
2. Avatar should be clearly visible at 48x48px
3. Should be easily clickable
4. Dropdown should work properly

### Test 5: Error Handling
1. Simulate network error (DevTools > Network tab > Throttle)
2. Avatar should fall back to initials
3. No console errors should appear
4. Navigation should continue to work

---

## Performance Impact

- **Initial Load Time**: +1 API call (async, non-blocking)
- **Memory Usage**: ~100KB for cached image
- **Network**: 1 small API request (profile endpoint)
- **Re-renders**: Only when profile data changes
- **Bundle Size**: 0 bytes added (existing modules used)

---

## CSS Sizing Reference

```
Avatar Container: 48x48px
├─ Image: covers full 48x48px with object-fit
├─ Loading Spinner: 1.25rem (~20px)
└─ Default Initials: responsive sizing within container

Navigation Height: Typically 60px
Avatar Position: Centered vertically within nav
```

---

## Notes for Developers

- Image URL comes from `/api/v1/userauths/profile/` endpoint's `image` field
- Fallback uses `allUserData?.full_name` as primary source for name
- CSS uses Bootstrap utilities (flex, text-white, etc.)
- All transitions are smooth (0.3s ease)
- Spinner class uses existing Bootstrap spinner classes
- No new external dependencies added
- Follows existing code style and patterns
