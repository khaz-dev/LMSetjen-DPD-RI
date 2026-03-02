# Instructor Q&A Card Layout Fixes - Phase 7.18

**Date**: March 2, 2026  
**Status**: ✅ COMPLETED

## Issues Addressed

### 1. ❌ Bagian & Pelajaran Badges Not Showing Text
**Problem**: Badges were displaying as small circular icons (28px) with only Font Awesome icons inside, no text labels.  
**Root Cause**: In Phase 7.17, badges were styled as compact circular elements (`qa-badge-compact`) with only icon display.  
**Solution**: 
- Replaced circular icon-only badges with full text badges matching student version
- Added Bagian badge: Shows icon + text in light blue background (e.g., "📚 Bagian 1")
- Added Pelajaran badge: Shows icon + text in light purple background (e.g., "📖 Pelajaran 1")
- Styling includes proper spacing and border for accessibility

**Before**:
```jsx
<span className="qa-badge-compact" title={q.variant.title}>
    <i className="fas fa-bookmark" style={{ fontSize: '0.7rem' }}></i>
</span>
```

**After**:
```jsx
<span style={{
    backgroundColor: '#e8f4f8',
    color: '#016b87',
    padding: '0.4rem 0.9rem',
    borderRadius: '12px',
    fontSize: '0.85rem',
    fontWeight: '600',
    border: '1px solid #a8d8dc',
    whiteSpace: 'nowrap',
    display: 'inline-block'
}}>
    <i className="fas fa-layer-group" style={{ marginRight: '0.4rem' }}></i>
    {q.variant.title}
</span>
```

---

### 2. ❌ Avatar Not Loading Properly (No Default Fallback)
**Problem**: Avatar images were not displaying correctly; no proper fallback when image fails to load.  
**Root Cause**: 
- Avatar fallback mechanism was using CSS selector (`:has()`) which doesn't work reliably
- Default avatar URL conditional logic was overly complex
- Fallback div had styling issues

**Solution**:
- Replaced with conditional rendering: If image exists, render `<img>` tag; if not, render fallback `<div>`
- Removed complex URL handling; used direct conditional checks
- Fallback div renders a user icon with light blue background (#e8f4f8)
- Added `onError` handler to hide img if URL is broken (graceful degradation)

**Before**:
```jsx
<div className="qa-avatar-gradient">
    <img src={getMediaUrl(q.profile?.image || DEFAULT_AVATAR)} onError={(e) => {...}} />
    <div className="qa-avatar-fallback">...</div>
</div>
```

**After**:
```jsx
{q.profile?.image ? (
    <img src={...} alt={...} className="avatar-modern" onError={(e) => { e.target.style.display = "none"; }} />
) : (
    <div style={{ /* fallback styles */ }}>
        <i className="fas fa-user" style={{ color: '#016b87', fontSize: '1.5rem' }}></i>
    </div>
)}
```

---

### 3. ❌ Question Title Positioned Below Avatar (Should Be Beside It)
**Problem**: Title was in a separate section below the avatar, wasting space and not matching student layout.  
**Root Cause**: Card structure had avatar/user info in one header section, then title in a separate content section.  
**Solution**:
- Restructured entire header layout to be side-by-side
- Created `.question-header` flex container with avatar + title info together
- Avatar: 60px square on the left (flexShrink: 0)
- Title + metadata: Beside avatar, taking up remaining space
- Badges positioned in their own flex column on the right

**Layout Tree**:
```
Header Flex Container (space-between)
├─ Left: question-header flex
│  ├─ Avatar img (60x60px, flexShrink: 0)
│  └─ question-content flex
│     ├─ Title (qaTitle)
│     └─ User Name + Time (subtitle)
└─ Right: Badges + Replies Count
```

---

### 4. ❌ Initial Question Message Not Visible
**Problem**: The full question body/message was being shown in full length (could be very long), making the card hard to scan.  
**Root Cause**: Message was displayed without truncation or preview formatting.  
**Solution**:
- Added `.question-message-preview` class with CSS text truncation
- Truncates message to 2 lines max using CSS `-webkit-line-clamp: 2`
- Shows first 200 characters with "..." ellipsis
- Uses `overflow: hidden` and `-webkit-box-orient: vertical` for reliable truncation
- Message is shown as preview to encourage clicking "Buka Diskusi" for full view

**New Preview Display**:
```jsx
{(q.message || (q.messages && q.messages[0]?.message)) && (
    <p className="question-message-preview">
        {(q.message || q.messages?.[0]?.message || 'Tidak ada pesan').substring(0, 200)}
        {(q.message || q.messages?.[0]?.message || '').length > 200 ? '...' : ''}
    </p>
)}
```

---

## CSS Changes Summary

### Removed Classes
- `.qa-badge-compact` - Circular icon-only badges (replaced with inline styled spans)
- `.qa-avatar-gradient` with complex CSS selector `:has(img[style*="display: none"])`

### New Classes
- `.question-header` - Flex container for avatar + title layout
- `.avatar-modern` - Larger, properly styled avatar image (60x60px)
- `.question-content` - Title and user info container
- `.question-title` - Updated title styling (now 1.15rem instead of 1.25rem, as it's with avatar)
- `.question-message-preview` - Text truncation class (2-line max)
- `.replies-badge` - Reply count badge styling

### Updated Layout
**Old** (Vertical stacking):
```
[Avatar] User Name          [Badges] [Replies]
[Title]
[Metadata]
[Message text - full length...]
────────────────────────────────────────────
[Like] [Report]    [Buka Diskusi Button]
```

**New** (Horizontal avatar+title, compact):
```
[Avatar] Title              [Bagian] [Pelajaran]
         User Name • 2 mins [Replies: 3]
Message preview (max 2 lines, max 200 chars)...
────────────────────────────────────────────────
[Replies: 3] [Like][Report]
```

---

## File Changes

### Modified Files
1. **frontend/src/views/instructor/QA.jsx** (Lines 857-970)
   - Restructured question card JSX
   - Changed avatar handling from CSS fallback to conditional rendering
   - Updated badge display from icon-only to full text
   - Added message preview rendering
   - Reorganized action buttons layout

2. **frontend/src/views/instructor/QA.css** (Lines 2173-2220)
   - Replaced `qa-badge-compact` styles with new helper classes
   - Added 50+ lines of new CSS for question card layout
   - Added `.question-header`, `.avatar-modern`, `.question-title`
   - Added `.question-message-preview` with `-webkit-line-clamp`
   - Added `.replies-badge` styling

---

## Before & After Comparison

### Issue 1: Bagian Badge
**Before**: 🔵 (28px circle with small icon only)  
**After**: 📚 Bagian 1 (full text with icon, readable)

### Issue 2: Avatar Display
**Before**: Broken image icon or empty space  
**After**: Display profile pic OR light blue circle with user icon

### Issue 3: Title Position
**Before**: Below avatar (3 rows of space)  
**After**: Next to avatar (1 row with avatar)

### Issue 4: Message Display
**Before**: Full message content (could be 500+ characters)  
**After**: Preview with max 200 chars, truncated to 2 lines with "..."

---

## Testing Checklist

- [x] Avatar displays properly when image exists
- [x] Avatar fallback shows user icon when no image
- [x] Bagian badge shows full text
- [x] Pelajaran badge shows full text
- [x] Title appears next to avatar (not below)
- [x] Message shows as preview (max 200 chars, 2 lines)
- [x] Cards are clickable and open discussion
- [x] Like button works
- [x] Report button works
- [x] Replies count displays
- [x] Responsive on mobile (badges may wrap to next line)

---

## Phase Markers
- **Phase 7.16**: Initial modern question card styling
- **Phase 7.17**: Added report modal dialog
- **Phase 7.18** ⭐ **CURRENT**: Fixed card layout issues - badges text visibility, avatar handling, title positioning, message preview

---

## Next Steps (Optional Enhancements)
1. Add animation when toggling between list and detail view
2. Add "Edit Profile" link in avatar hover state
3. Add sorting options by date, replies, likes
4. Add filtering by Bagian/Pelajaran in the card view
5. Implement infinite scroll for large question lists

---

**Status**: Ready for production. All four issues completely resolved.
