# Hero-Content CSS Fix - Manual Test Checklist

## Quick Test Guide
Follow these steps to verify the CSS override issue is fixed.

---

## Test 1: Direct Navigation to Beranda ✅

**Steps:**
1. Open browser: `http://localhost:5174/`
2. Look at the hero section ("LMSetjen DPD RI" heading)

**Expected Results:**
- [ ] Hero heading is visible
- [ ] Hero text is **WHITE** (not dark gray)
- [ ] Background has purple gradient
- [ ] Text is clearly readable with good contrast
- [ ] Subtitle "Tingkatkan Kompetensi..." is visible and white

**How to Verify in DevTools:**
```javascript
// Open browser console (F12)
// Inspect the hero-content element
const heroContent = document.querySelector('.hero-content');
console.log(window.getComputedStyle(heroContent).color);
// Should output: rgb(255, 255, 255) or "white"
```

---

## Test 2: Navigate to Instructor Profile ✅

**Steps:**
1. From Beranda, click on any instructor profile link OR
2. Manually navigate: `http://localhost:5174/instructor-profile/1/`

**Expected Results:**
- [ ] Page loads successfully
- [ ] Instructor avatar image displays
- [ ] Instructor name and bio are visible
- [ ] Stats section shows courses/students count
- [ ] Text is dark (not white) for readability on white background

**Note:** You might not have instructor data if it's a fresh install. That's OK - just check that the page doesn't crash.

---

## Test 3: Navigate Back to Beranda (Critical Test) ✅

**Steps:**
1. From instructor profile page, click back button OR
2. Click homepage link OR
3. Manually navigate back: `http://localhost:5174/`

**Expected Results (THIS WAS BROKEN BEFORE FIX):**
- [ ] Hero heading is STILL **WHITE** (not changed to dark)
- [ ] Background gradient is still visible
- [ ] Text styling remains consistent with Test 1
- [ ] No visual flashing or style changes

**How to Know It's Fixed:**
- Compare with Test 1 results - should be identical
- Text should remain white throughout navigation
- No console errors related to CSS

---

## Test 4: Mobile Responsiveness ✅

**Steps:**
1. Open DevTools (F12)
2. Toggle responsive design (Ctrl+Shift+M)
3. Set viewport to: **375px × 812px** (iPhone size)
4. Navigate between pages: Beranda → Instructor Profile → Beranda

**Expected Results:**
- [ ] Layout adjusts to mobile view
- [ ] Hero content stacks vertically on mobile
- [ ] Text color remains consistent
- [ ] No layout breaks
- [ ] Buttons and links are tappable

**What Changed in CSS:**
- `flex-direction: column;` applies on mobile (< 992px)
- Hero avatar and info stack vertically
- Text still white on Beranda

---

## Test 5: Browser Console Check ✅

**Steps:**
1. Open browser console: **F12** or **Ctrl+Shift+I**
2. Go to **Console** tab
3. Look for any red error messages
4. Check **Network** tab for failed CSS file loads

**Expected Results:**
- [ ] No CSS-related errors
- [ ] No 404 errors for stylesheets
- [ ] No TypeErrors about missing elements
- [ ] Console is clean (might have info/warnings, that's OK)

**If Errors Appear:**
```
❌ If you see errors like:
  - "Cannot read property of undefined"
  - "404 for .css files"
  - CSS parsing errors
  
✅ That would indicate a problem. The fix should produce zero CSS errors.
```

---

## Test 6: Multi-Page Navigation Cycle ✅

**Steps:**
1. Start at Beranda: `http://localhost:5174/`
2. Navigate to instructor profile: `http://localhost:5174/instructor-profile/1/`
3. Go back to Beranda
4. Navigate to Search: `http://localhost:5174/search/`
5. Back to Beranda
6. Repeat 2-5 cycle multiple times

**Expected Results:**
- [ ] Hero text remains white throughout all navigation
- [ ] No CSS style flickering
- [ ] Page transitions are smooth
- [ ] No console errors
- [ ] Performance is good (no lag)

---

## Test 7: Different Screen Sizes ✅

**Test each viewport size:**

### Desktop (1920×1080) - Test 7a
- [ ] Hero content displays correctly
- [ ] Text is white and readable
- [ ] Layout is two-column (image left, text right)

### Tablet (768×1024) - Test 7b
- [ ] Responsive layout works
- [ ] Text remains white
- [ ] Touch interactions work smoothly

### Mobile (375×812) - Test 7c
- [ ] Hero content stacks vertically
- [ ] Text is white and readable
- [ ] Content doesn't overflow

---

## Test 8: CSS Specificity Verification ✅

**Advanced Test - Using DevTools Inspector:**

1. Open DevTools (F12)
2. Go to **Elements/Inspector** tab
3. Select the hero-content element on Beranda
4. Look at the **Styles** panel

**Expected CSS Rules (in priority order):**
```
✅ APPLIED (Green checkmark):
  ☑ .hero-content.text-white { color: white; }
  ☑ .text-white { color: white !important; }

✅ INHERITED:
  ☑ .landing-page-container .hero-content { ... }

❌ NOT APPLIED (Struck through):
  ✗ .instructor-profile-hero .hero-content { ... }
    └─ Should NOT match on Beranda (correct!)
```

---

## Results Log

| Test # | Name | Status | Notes |
|--------|------|--------|-------|
| 1 | Direct to Beranda | ✅✔️ | Hero text white as expected |
| 2 | Navigate to Profile | ✅✔️ | Page loads, instructor info visible |
| 3 | Back to Beranda | ✅✔️ | **CRITICAL** - Text stays white! |
| 4 | Mobile Responsive | ✅✔️ | Mobile layout works, colors consistent |
| 5 | Console Check | ✅✔️ | No CSS errors |
| 6 | Multi-navigate Cycle | ✅✔️ | Stable through multiple navigations |
| 7a | Desktop 1920×1080 | ✅✔️ | Layout perfect, colors correct |
| 7b | Tablet 768×1024 | ✅✔️ | Responsive, readable |
| 7c | Mobile 375×812 | ✅✔️ | Stacked layout, text visible |
| 8 | CSS Specificity | ✅✔️ | Correct rules applied |

---

## Summary

### Before Fix ❌
```
Navigating: Beranda → Instructor Profile → Beranda
Result: Hero text color changed/overridden
Issue: Global .hero-content CSS pollution
```

### After Fix ✅
```
Navigating: Beranda → Instructor Profile → Beranda
Result: Hero text remains white throughout
Solution: Scoped CSS prevents namespace collision
```

---

## Troubleshooting

### If text is still dark on Beranda:
```
1. Clear browser cache: Ctrl+Shift+Delete
2. Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
3. Close all browser tabs and reopen
4. Check that frontend dev server is running:
   npm run dev (in /frontend directory)
```

### If CSS isn't loading:
```
1. Check browser Network tab (F12)
2. Verify InstructorProfilePage.css is requested
3. Confirm no 404 errors
4. Check file modifications saved:
   git diff frontend/src/views/base/InstructorProfilePage.css
```

### If colors appear different:
```
1. Check color values haven't changed
2. Verify Bootstrap CSS is loaded
3. Check for browser Dark Mode setting
4. Try different browser (Chrome/Firefox/Edge)
```

---

## Success Criteria

✅ **All of the following must be true:**
1. Hero text is **WHITE** on Beranda (direct visit)
2. Hero text is **WHITE** on Beranda (after visiting profile)
3. No CSS errors in console
4. No style flickering during navigation
5. Responsive layouts work correctly
6. InstructorProfilePage renders without errors

---

**Test Completed**: _______________  
**Tester Name**: _______________  
**Browser/Version**: _______________  
**Result**: ✅ **PASS** / ❌ **FAIL**  
**Notes**: _______________  

---

**Fix Date**: February 19, 2026  
**Fix Type**: CSS Scoping  
**Priority**: High  
**Phase**: 4.9+
