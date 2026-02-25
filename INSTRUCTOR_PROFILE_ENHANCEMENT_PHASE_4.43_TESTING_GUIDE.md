# Instructor Profile Enhancement - Testing Guide 🧪
## Phase 4.43 Manual Testing Procedures

---

## Test Preparation

### Prerequisites
1. ✅ Backend running on `http://localhost:8001`
2. ✅ Frontend running on `http://localhost:5174`
3. ✅ Database contains at least one teacher with expertise data
4. ✅ At least one course published by that teacher

### Finding a Teacher with Expertise
```bash
# SSH into backend or use Django shell:
python manage.py shell
>>> from api.models import Teacher
>>> teacher = Teacher.objects.filter(expertise__isnull=False).first()
>>> print(f"Teacher ID: {teacher.id}, Name: {teacher.full_name}")
```

### Test URL
```
http://localhost:5174/instructor-profile/{TEACHER_ID}/
Example: http://localhost:5174/instructor-profile/1/
```

---

## Test Suite 1: Visual Verification

### Test 1.1: Expertise Section Renders
**Steps**:
1. Navigate to instructor profile page
2. Scroll to "Keahlian & Spesialisasi" section (between About and Courses)
3. **Verification**:
   - [ ] Section title visible with star icon (⭐)
   - [ ] Skill badges render in grid layout
   - [ ] Each badge has skill name visible
   - [ ] Each badge has proficiency level badge below skill name
   - [ ] Proficiency level text is uppercase (BEGINNER, INTERMEDIATE, etc.)

**Expected Result**: Clean grid of colored skill cards with text visible

---

### Test 1.2: Expertise Badges Have Custom Colors
**Steps**:
1. On expertise section, examine individual skill badges
2. **Verification**:
   - [ ] Badge background has custom gradient color (not default)
   - [ ] Text color matches database color_gradient or text_color
   - [ ] Badge has subtle border color different from background
   - [ ] Badges are visually distinct from each other

**Expected Result**: Each badge displays custom colors from TeacherExpertise model

**Debug**: Open browser DevTools:
```javascript
// In console, verify color data:
document.querySelectorAll('.expertise-badge').forEach(el => {
    console.log(el.style.backgroundColor, el.style.color, el.style.borderColor);
});
```

---

### Test 1.3: Proficiency Level Badges Have Color Variants
**Steps**:
1. Examine the small proficiency level badges inside expertise cards
2. **Verification**:
   - [ ] "BEGINNER" badge has green-ish color
   - [ ] "INTERMEDIATE" badge has blue-ish color
   - [ ] "ADVANCED" badge has purple-ish color
   - [ ] "EXPERT" badge has pink-ish color

**Expected Result**: Level badges color-coded by proficiency type

---

### Test 1.4: CTA Section Renders
**Steps**:
1. Scroll to "Mulai Belajar Hari Ini" section (below Expertise)
2. **Verification**:
   - [ ] Section title visible with handshake icon (🤝)
   - [ ] Two buttons visible below title
   - [ ] Primary button labeled "Lihat Kursus Kami" with book icon
   - [ ] Secondary button labeled "Hubungi Instruktur" with envelope icon
   - [ ] Course count badge visible on primary button
   - [ ] Buttons are horizontally aligned (desktop) or stacked (mobile)

**Expected Result**: CTA section with two clearly visible buttons

---

### Test 1.5: Button Styling (Primary Button)
**Steps**:
1. Examine primary button "Lihat Kursus Kami"
2. **Verification**:
   - [ ] Background is purple gradient (dark to light)
   - [ ] Text is white
   - [ ] Course count badge on right side has light background
   - [ ] Icon appears to left of text

**Expected Result**: Purple gradient button with white text and count badge

---

### Test 1.6: Button Styling (Secondary Button)
**Steps**:
1. Examine secondary button "Hubungi Instruktur"
2. **Verification**:
   - [ ] Background is white
   - [ ] Text is purple (#667eea)
   - [ ] Border is purple, 2px width
   - [ ] Icon appears to left of text

**Expected Result**: Outlined purple button with white background

---

## Test Suite 2: Responsive Design

### Test 2.1: Desktop Layout (> 1200px)
**Steps**:
1. Open page on full desktop (1920x1080 or larger)
2. **Verification**:
   - [ ] Expertise badges display in 3-4 columns
   - [ ] CTA buttons display side-by-side horizontally
   - [ ] No horizontal scrolling
   - [ ] Large badge size with comfortable padding

**Expected Result**: Proper 3-4 column grid, horizontal buttons

---

### Test 2.2: Tablet Layout (768px - 992px)
**Steps**:
1. Open DevTools (F12) → Toggle Device Toolbar
2. Select "iPad" or set viewport to 768x1024
3. Close DevTools to prevent squishing
4. **Verification**:
   - [ ] Expertise badges display in ~2 columns
   - [ ] CTA buttons still side-by-side OR start stacking (depending on screen width)
   - [ ] All text remains readable
   - [ ] Padding adjusted for tablet screen

**Expected Result**: 2-column grid, responsive button layout

---

### Test 2.3: Mobile Layout (< 576px)
**Steps**:
1. Toggle Device Toolbar → Select "iPhone 12 Pro" (390x844)
2. **Verification**:
   - [ ] Expertise badges display in single column
   - [ ] CTA buttons stack vertically (one per row)
   - [ ] Both buttons are full-width or near full-width
   - [ ] Text sizes adjusted for mobile (readable at arm's length)
   - [ ] No horizontal scrolling

**Expected Result**: Single-column expertise, stacked buttons

---

### Test 2.4: Responsive Text Sizes
**Steps**:
1. Test at 3 breakpoints: Desktop (1920px), Tablet (768px), Mobile (390px)
2. **Verification**:
   - [ ] **Desktop**: Section title ~1.5-2rem, skill text ~1rem
   - [ ] **Tablet**: Section title ~1.25-1.5rem, skill text ~0.9rem
   - [ ] **Mobile**: Section title ~1.1rem, skill text ~0.85rem
   - [ ] Text always readable without squinting

**Expected Result**: All text readable at every breakpoint

---

## Test Suite 3: Functionality

### Test 3.1: Primary Button Links to Courses
**Steps**:
1. Click "Lihat Kursus Kami" button
2. **Verification**:
   - [ ] Page smoothly scrolls to #courses-section
   - [ ] Courses section becomes visible
   - [ ] No browser console errors
   - [ ] Button click is responsive (no lag)

**Expected Result**: Smooth scroll to courses section

---

### Test 3.2: Secondary Button Shows Modal
**Steps**:
1. Click "Hubungi Instruktur" button
2. **Verification**:
   - [ ] SweetAlert modal appears
   - [ ] Modal title: "Hubungi Instruktur"
   - [ ] Modal text: "Fitur pengiriman pesan sedang dalam pengembangan..."
   - [ ] Confirm button visible with purple color (#667eea)
   - [ ] Modal closes when confirming

**Expected Result**: Info modal appears with appropriate message

---

### Test 3.3: Course Count Updates Dynamically
**Steps**:
1. Count published courses for instructor
2. Check primary button course count badge
3. **Verification**:
   - [ ] Badge number matches course count
   - [ ] If teacher has 0 published courses, primary button doesn't show
   - [ ] If teacher has courses, count is accurate

**Expected Result**: Course count badge shows correct number

---

### Test 3.4: Expertise Section Only Shows if Teacher Has Skills
**Steps**:
1. Navigate to instructor without expertise data
2. **Verification**:
   - [ ] If teacher has no expertise: section doesn't render (no "lonely" space)
   - [ ] If teacher has expertise: section renders properly
   - [ ] No console errors either way

**Expected Result**: Conditional rendering works correctly

---

## Test Suite 4: Hover Effects & Animations

### Test 4.1: Expertise Badge Hover Effect
**Steps**:
1. Hover over an expertise badge
2. **Verification**:
   - [ ] Card lifts up (translateY -4px)
   - [ ] Shadow enhances/darkens
   - [ ] Transition is smooth (no jumpy)
   - [ ] Colors don't change on hover
   - [ ] Effect triggers immediately on hover

**Expected Result**: Smooth elevation with shadow enhancement

---

### Test 4.2: Primary Button Hover Effect
**Steps**:
1. Hover over "Lihat Kursus Kami" button
2. **Verification**:
   - [ ] Button lifts up (translateY -2px)
   - [ ] Shadow appears/enhances (0 12px 24px with #667eea)
   - [ ] A subtle shine effect appears (left to right animation)
   - [ ] Transition is smooth
   - [ ] Text and icon color remain white

**Expected Result**: Button elevation with shine effect and shadow

---

### Test 4.3: Secondary Button Hover Effect
**Steps**:
1. Hover over "Hubungi Instruktur" button
2. **Verification**:
   - [ ] Button lifts up (translateY -2px)
   - [ ] Background changes from white to purple
   - [ ] Text changes from purple to white
   - [ ] Shadow appears (0 12px 24px with rgba(102, 126, 234, 0.3))
   - [ ] Transition is smooth

**Expected Result**: Button elevation, color swap, and shadow on hover

---

### Test 4.4: Section Entry Animations
**Steps**:
1. Load page for first time (full page refresh)
2. **Verification**:
   - [ ] Expertise section animated in from bottom (fadeInUp)
   - [ ] CTA section animated in from bottom
   - [ ] Animations are staggered (not all at same time)
   - [ ] Animations complete within ~1 second
   - [ ] Animations are smooth (no jerky motion)

**Expected Result**: Smooth staggered entry animations

---

## Test Suite 5: Data Integrity

### Test 5.1: Expertise Data Matches Database
**Steps**:
1. Get expertise data for teacher:
   ```bash
   python manage.py shell
   >>> from api.models import Teacher
   >>> teacher = Teacher.objects.get(id=1)  # Replace 1 with your teacher ID
   >>> for skill in teacher.expertise.all():
   ...     print(f"{skill.skill} - {skill.proficiency_level}")
   ```
2. Navigate to teacher's profile page
3. **Verification**:
   - [ ] All skills appear on page
   - [ ] Proficiency levels match database
   - [ ] Color fields match (color_gradient, text_color, border_color)
   - [ ] Skills appear in correct order (sorted by order field if set)

**Expected Result**: Page data matches database exactly

---

### Test 5.2: No Broken Console Errors
**Steps**:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Navigate to instructor profile
4. **Verification**:
   - [ ] No red error messages
   - [ ] Only info/warning messages acceptable
   - [ ] images load successfully (no 404s)
   - [ ] API calls successful (check Network tab)

**Expected Result**: Clean console with no critical errors

---

### Test 5.3: API Requests
**Steps**:
1. Open DevTools → Network tab
2. Navigate to instructor profile
3. **Verification**:
   - [ ] XHR request to `/api/v1/teacher/{id}/` succeeds (200 status)
   - [ ] Response includes expertise array
   - [ ] Response includes all required fields (image, name, bio, about, expertise)
   - [ ] Response time < 1000ms

**Expected Result**: API calls succeed with proper data

---

## Test Suite 6: Accessibility

### Test 6.1: Icon Fonts Render
**Steps**:
1. Check all icons render properly:
   - [ ] Star icon (⭐) in Expertise title
   - [ ] Handshake icon (🤝) in CTA title
   - [ ] Book icon (📖) in View Courses button
   - [ ] Envelope icon (✉️) in Contact button

**Expected Result**: All FontAwesome icons display correctly

---

### Test 6.2: Text Contrast
**Steps**:
1. Use browser accessibility checker or visual inspection
2. **Verification**:
   - [ ] Expertise skill text readable on gradient background
   - [ ] Primary button white text readable on purple gradient
   - [ ] Secondary button purple text readable on white background
   - [ ] Level badges text readable on tinted background

**Expected Result**: All text has sufficient contrast

---

### Test 6.3: Mobile Touch Targets
**Steps**:
1. Test on mobile/tablet with touch
2. **Verification**:
   - [ ] Buttons are at least 44x44px for touch (recommended)
   - [ ] Expertise badges are easily tappable
   - [ ] No accidental clicks on adjacent elements

**Expected Result**: Touch targets are appropriately sized

---

## Test Suite 7: Edge Cases

### Test 7.1: Teacher with No Expertise
**Steps**:
1. Find a teacher without any expertise entries
2. Navigate to their profile
3. **Verification**:
   - [ ] Expertise section doesn't render (no white space)
   - [ ] Page still looks professional
   - [ ] CTA section still appears
   - [ ] No console errors

**Expected Result**: Graceful handling when no expertise

---

### Test 7.2: Teacher with Many Expertise Entries (10+)
**Steps**:
1. Find teacher with many expertise entries OR manually add test data
2. Navigate to profile
3. **Verification**:
   - [ ] All entries display (no truncation)
   - [ ] Grid layout handles many items gracefully
   - [ ] Mobile layout still displays one per row
   - [ ] Scroll performance is smooth (no lag)

**Expected Result**: Proper display of many expertise items

---

### Test 7.3: Very Long Skill Names
**Steps**:
1. Manually test with skill name: "International Advanced Cloud Infrastructure Architecture"
2. **Verification**:
   - [ ] Text wraps within badge (no overflow)
   - [ ] Badge size adjusts to content
   - [ ] Remaining badges align properly

**Expected Result**: Text wraps gracefully

---

### Test 7.4: Teacher with 0 Published Courses
**Steps**:
1. Find teacher with no published courses
2. Navigate to profile
3. **Verification**:
   - [ ] "Lihat Kursus Kami" button DOES NOT appear
   - [ ] "Hubungi Instruktur" button still appears
   - [ ] CTA section looks appropriate with single button

**Expected Result**: Primary button hidden when no courses

---

## Test Suite 8: Browser/Device Compatibility

### Test 8.1: Chrome (Latest)
- [ ] Run all tests above in Chrome
- [ ] Verify animations are smooth
- [ ] Check console for warnings

### Test 8.2: Firefox (Latest)
- [ ] Run all tests above in Firefox
- [ ] Especially test grid layout
- [ ] Verify flex button layout

### Test 8.3: Safari (Latest)
- [ ] Test on macOS Safari
- [ ] Test on iOS Safari
- [ ] Verify gradient backgrounds render
- [ ] Check box-shadow performance

### Test 8.4: Edge (Latest)
- [ ] Run on Windows Edge
- [ ] Quick smoke test of hover effects
- [ ] Verify colors display correctly

---

## Regression Testing

### Critical Paths to Verify
1. **Hero Section Still Works**
   - [ ] Avatar displays
   - [ ] Stats render
   - [ ] Social links functional

2. **About Section Still Works**
   - [ ] About text displays
   - [ ] No formatting issues

3. **Courses Section Still Works**
   - [ ] Course cards render
   - [ ] Grid layout correct
   - [ ] Course hover effects work

4. **Reviews Section Still Works**
   - [ ] Reviews display
   - [ ] Ratings show
   - [ ] No layout shift from new sections

---

## Test Result Documentation

### Template for Recording Results

```markdown
## Test Run: [DATE] - [TESTER NAME]

### Environment
- Browser: [Chrome/Firefox/Safari/Edge] [Version]
- Device: [Desktop/Tablet/Mobile] - [Screen Size]
- Backend: ✅ Running
- Frontend: ✅ Running

### Test Suites Completed
- [x] Visual Verification (1.1 - 1.6)
- [x] Responsive Design (2.1 - 2.4)
- [x] Functionality (3.1 - 3.4)
- [x] Hover Effects (4.1 - 4.4)
- [x] Data Integrity (5.1 - 5.3)
- [x] Accessibility (6.1 - 6.3)
- [x] Edge Cases (7.1 - 7.4)

### Issues Found
1. [Issue description]
   - Steps to reproduce
   - Expected vs actual
   - Severity: [Critical/High/Medium/Low]

### Overall Result
- **Status**: ✅ PASS / ⚠️ PASS WITH ISSUES / ❌ FAIL
- **Recommendation**: Ready for production / Needs fixes

### Sign-off
- Tester: [Name]
- Date: [Date]
- Time: [~15 minutes]
```

---

## Quick Test (5 minutes)

If you're short on time, run these critical tests:

1. [ ] Navigate to instructor profile
2. [ ] See Expertise section with colorful badges
3. [ ] See CTA section with two buttons
4. [ ] Hover over primary button - see shine effect
5. [ ] Click primary button - scrolls to courses
6. [ ] Hover over secondary button - background becomes purple
7. [ ] Click secondary button - shows modal
8. [ ] Check DevTools Console - no errors
9. [ ] Test on mobile - sections display correctly
10. [ ] Check Network tab - API call succeeds

✅ **If all pass**: Code is ready for deployment

---

## Notes

- **Expected Test Duration**: 30-45 minutes (comprehensive)
- **Quick Test Duration**: 5-10 minutes
- **Regression Test Duration**: 10-15 minutes
- **Devices Recommended**: Desktop (1920x1080), Tablet (768px), Mobile (390px)
- **Browsers Priority**: Chrome > Firefox > Safari > Edge

---

**Last Updated**: Phase 4.43 (November 2025)
**Status**: Ready for Testing
