# PHASE 49: Quick Testing Guide - Center Button & Scroll to Certificate

## Summary
"Buat Sertifikat" button is now centered horizontally, and page automatically scrolls to show the generated certificate after creation.

## Quick Start

### 1. Restart Servers
```bash
# Terminal 1: Backend
cd "d:\Project\LMSetjen DPD RI\backend"
python manage.py runserver

# Terminal 2: Frontend
cd "d:\Project\LMSetjen DPD RI\frontend"
npm run dev
```

### 2. Test Scenario: View Certificate Tab (Check Button Centering)

**Steps**:
1. Navigate to: http://localhost:5174/student/courses/124632/
2. Click "Sertifikat" tab (Sertifikat Tab)
3. Scroll down to "Buat Sertifikat" section
4. Observe button position

**Expected Result** ✅:
- Congratulations card visible
- "Buat Sertifikat" button **horizontally centered** on screen
- Button centered regardless of browser window width
- Works on mobile and desktop

**Wrong Result** ❌:
- Button left-aligned
- Button not centered
- Button alignment differs on different screen sizes

---

### 3. Test Scenario: Create Certificate (Check Auto-Scroll)

**Prerequisites**:
- Student must be eligible to create certificate
- All lessons completed (100%)
- All quizzes passed (70%+)

**Steps**:
1. Go to Sertifikat tab
2. Scroll UP to the top of page (away from certificate area)
3. Click "Buat Sertifikat" button
4. Wait for success toast notification
5. Observe page behavior

**Expected Result** ✅:
- Toast appears: "Sertifikat Berhasil Dibuat!"
- Page **smoothly scrolls down** (animated, not instant)
- Certificate display area comes into view
- Certificate **centered** in the middle of screen
- Can immediately see the generated certificate
- Download button visible: "Unduh Sertifikat"

**Wrong Result** ❌:
- Page doesn't scroll
- Must manually scroll to see certificate
- Certificate appears at bottom of screen (not centered)
- Scroll is instant/jerky (not smooth)

---

### 4. Test Scenario: Button Centering on Different Screen Sizes

**Test 1: Desktop (1920px width)**:
1. Open course on desktop
2. Check "Buat Sertifikat" button position
3. Should be centered ✅

**Test 2: Tablet (768px width)**:
1. Open DevTools (F12)
2. Enable device toolbar (Ctrl+Shift+M)
3. Select tablet size (iPad, etc.)
4. Go to Sertifikat tab
5. Button should still be centered ✅

**Test 3: Mobile (375px width)**:
1. In DevTools, select mobile size (iPhone, etc.)
2. Button should still be centered ✅
3. Congratulations card should be responsive

---

### 5. Test Scenario: Scroll Timing

**Steps**:
1. Go to Sertifikat tab
2. Scroll to top (away from certificate area)
3. Click "Buat Sertifikat"
4. Monitor timing:
   - T=0ms: Button click
   - T=0-500ms: "Membuat..." spinner shows
   - T=500-1000ms: Image generation in progress
   - T=1000ms: Toast notification appears
   - T=1000-1500ms: Page scrolls to certificate
   - T=1500ms+: Certificate visible and centered

**Expected Result** ✅:
- Scroll happens **after** toast appears
- Scroll is **smooth** (takes ~500-800ms animation)
- Certificate is ready to view by the time scroll completes
- No scrolling to incomplete/empty certificate

---

## Console Logs

**No special console messages** - Phase 49 has minimal logging.

If debugging needed, check:
- Browser DevTools → Network tab: Verify image upload completes
- No errors in Console (F12 → Console tab)

---

## Quick Validation Checklist

- [ ] "Buat Sertifikat" button is horizontally centered
- [ ] Button centered on desktop, tablet, and mobile
- [ ] After creation, page scrolls to certificate display
- [ ] Scroll is smooth (animated), not instant
- [ ] Certificate appears centered in viewport
- [ ] Download button visible after scroll
- [ ] Toast notification appears before scroll
- [ ] No console errors

---

## If Something Goes Wrong

### Issue: Button not centered

1. **Check window width**: Try different browser window sizes
2. **Check DevTools**: Is flexbox being applied?
   - Right-click button → Inspect
   - Check computed styles for `.generate-section`
   - Should show: `display: flex`, `justify-content: center`

3. **Check CSS file**:
   - Verify `.generate-section` rule exists in `CertificateTab.css`
   - Verify it's at the correct location (after `.certificate-actions`)

4. **Clear cache**:
   - Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
   - Clear browser cache: DevTools → Application → Clear storage

### Issue: Page doesn't scroll after certificate creation

1. **Check ref attachment**:
   - Open component code (CertificateTab.jsx)
   - Search for `certificateDisplayRef`
   - Verify ref is attached to the `<div className="certificate-display">`

2. **Check browser console**:
   - F12 → Console tab
   - Look for any JavaScript errors
   - Should be clear

3. **Check timing**:
   - Create certificate
   - Wait full 2 seconds after success toast
   - If scroll happens after 2 seconds, timing is working but slow
   - Check backend logs for image generation delays

4. **Test manually**:
   - In browser console, run:
   ```javascript
   // Find the certificate display element and scroll to it
   document.querySelector('.certificate-display')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
   ```
   - If this works, the mechanism is working

### Issue: Scroll is instant, not smooth

1. **Check browser support**:
   - Not all browsers support `behavior: 'smooth'`
   - Test in Chrome (supports smooth)
   - Test in Safari (may not support smooth)

2. **Fallback behavior**:
   - If smooth not supported, scroll still works (just instant)
   - This is acceptable fallback

3. **Check CSS prefers-reduced-motion**:
   - Some users have reduced motion enabled
   - Browser respects that setting
   - Scroll will be instant for those users (by design)

### Issue: Certificate not visible after scroll

1. **Check certificate generation**:
   - Did image actually upload to server?
   - Check backend logs for certificate-save-image endpoint
   - Should see: "Certificate image saved successfully"

2. **Check rendering**:
   - After scroll completes, do you see the `.certificate-display` div?
   - Or is there just blank space?
   - Right-click → Inspect the area

3. **Wait longer**:
   - Image generation can take 1-2 seconds
   - Scroll delay is set to 1000ms (1 second)
   - Try waiting full 3 seconds before scrolling manually

---

## Success Indicator

✅ **Phase 49 is successful when**:
- Button appears horizontally centered
- Page automatically scrolls to certificate display
- Scroll is smooth and centered
- All tests pass on desktop, tablet, mobile

---

**Test Date**: ____________  
**Tester**: ____________  
**Result**: ✅ PASS / ❌ FAIL  

**Notes**:
_______________________________________________________________________
_______________________________________________________________________
