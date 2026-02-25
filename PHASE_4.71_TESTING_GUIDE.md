# Testing Guide: PHASE 4.71 - Published Course Updates

## Pre-Testing Setup

### Requirements
- Published course with course_id = 157292 (or any published course)
- Frontend running on http://localhost:5174
- Backend running on http://localhost:8001
- Admin user to approve republication submissions

### Test Account Credentials
- Role: Instructor/Teacher
- Course Status: Published
- Minimum content: 1 curriculum section, 1 lesson, 1 quiz

---

## Test Cases

### Test 1: Verify Buttons Always Show for Published Courses

**Precondition:**
- Navigate to http://localhost:5174/instructor/edit-course/157292/
- Course must be in \"Published\" status

**Steps:**
1. Wait for course data to load
2. Look for status alert showing \"✓ Kursus Dipublikasikan\"
3. Check if \"Restore Kursus\" button is visible
4. Check if \"Ajukan Review Admin untuk Publikasi Kursus\" button is visible

**Expected Results:**
- ✅ Status alert shows with green checkmark
- ✅ Both buttons visible below the status alert
- ✅ Buttons are enabled (not grayed out)
- ✅ \"Restore Kursus\" button has orange gradient styling
- ✅ \"Ajukan Review Admin untuk Publikasi Kursus\" button has blue gradient styling

**Screenshot Points:**
- Screenshot the button layout for documentation
- Verify icon colors match specification (orange for restore, blue for review)

---

### Test 2: Restore Without Making Changes

**Precondition:**
- Published course page displayed
- No changes made to form fields

**Steps:**
1. Click \"Restore Kursus\" button
2. Confirmation dialog should appear
3. Review dialog content
4. Click \"Ya, Kembalikan\" button

**Expected Results:**
- ✅ Dialog appears with title \"Kembalikan ke Versi Dipublikasikan?\"
- ✅ Dialog shows warning about losing unsaved changes
- ✅ Dialog has \"Batal\" and \"Ya, Kembalikan\" buttons
- ✅ After confirmation, loading spinner appears briefly
- ✅ Toast message shows: \"Kursus Dikembalikan!\"
- ✅ \"Anda memiliki perubahan yang belum disimpan\" text is NOT visible
- ✅ Course data remains unchanged

**Console Checks:**
```javascript
// In browser console, after restore:
// Should see POST request to: /api/v1/teacher/course-restore/157292/
// Response should show: {\"success\": true, \"message\": \"...\"}
```

---

### Test 3: Make Changes and See Helper Text

**Precondition:**
- Published course page displayed
- No changes made yet

**Steps:**
1. Edit the course title (e.g., add \" (Updated)\" to the title)
2. Observe the page (don't save yet)
3. Look for the helper text below \"Restore Kursus\" button
4. Check console for isDirty flag changes

**Expected Results:**
- ✅ Form field shows edited value
- ✅ \"Anda memiliki perubahan yang belum disimpan\" text appears below \"Restore Kursus\"
- ✅ Text has info icon (ℹ️)
- ✅ isDirty should be true in component state

**Console Checks:**
```javascript
// Check React component state
// isDirty should be true
// initialCourseData should match old values
```

---

### Test 4: Restore After Making Changes

**Precondition:**
- Published course edited with changes (from Test 3)
- Helper text visible below \"Restore Kursus\"

**Steps:**
1. Click \"Restore Kursus\" button
2. Review dialog
3. Click \"Ya, Kembalikan\" button
4. Wait for restore to complete

**Expected Results:**
- ✅ Dialog appears with warning
- ✅ Form fields revert to original values
- ✅ \"Anda memiliki perubahan yang belum disimpan\" text disappears
- ✅ Toast shows: \"Kursus Dikembalikan!\"
- ✅ Course title returns to original value
- ✅ No API error in console

---

### Test 5: Save Changes to Draft

**Precondition:**
- Published course page displayed

**Steps:**
1. Edit course title or description
2. Scroll to top and click \"Simpan Draf\" button
3. Wait for save to complete
4. Observe changes

**Expected Results:**
- ✅ Loading spinner appears during save
- ✅ Success toast appears
- ✅ Changes persist in form fields
- ✅ Helper text still shows \"Anda memiliki perubahan yang belum disimpan\"
- ✅ \"Ajukan Review Admin untuk Publikasi Kursus\" button is enabled

**API Check:**
```
POST /api/v1/teacher/course-update/{course_id}/
Response: {\"success\": true, ...}
```

---

### Test 6: Submit for Republication - Initial Confirmation Dialog

**Precondition:**
- Published course with unsaved changes (from Test 5)
- Both \"Restore Kursus\" and \"Ajukan Review\" buttons visible

**Steps:**
1. Click \"Ajukan Review Admin untuk Publikasi Kursus\" button
2. Confirmation dialog should appear
3. Review dialog title and content

**Expected Results:**
- ✅ Dialog title: \"Ajukan Perubahan Kursus untuk Publikasi?\" (NOT \"Ajukan Kursus untuk Publikasi?\")
- ✅ Dialog message mentions \"perubahan pada\"
- ✅ Alert box shows \"Informasi Update Publikasi\" (not \"Alur Persetujuan Publikasi\")
- ✅ Dialog mentions: \"Kursus tetap dapat diakses siswa selama review\"
- ✅ Confirm button text: \"Ya, Ajukan Perubahan untuk Publikasi\" (not \"Ya, Ajukan Publikasi Kursus\")
- ✅ Cancel button: \"Belum\"

**Screenshot Points:**
- Capture the special dialog for republication to show difference from draft submission

---

### Test 7: Submit for Republication - Submission

**Precondition:**
- Republication confirmation dialog open (from Test 6)
- All form validations passed (canPublish = true)

**Steps:**
1. Click \"Ya, Ajukan Perubahan untuk Publikasi\" button
2. Wait for API response
3. Review success message

**Expected Results:**
- ✅ Submit button shows loading state \"Mengajukan...\"
- ✅ Device: dialog disappears
- ✅ Large success modal appears with updated message
- ✅ Success dialog title: \"Perubahan Kursus Diajukan!\" (NEW text for republication)
- ✅ Message: \"Perubahan 'Nama Kursus' telah berhasil diajukan...\"
- ✅ Shows \"Status Update:\" section with:
  - ✓ Perubahan Anda sedang ditinjau oleh admin
  - ✓ Kursus tetap dapat diakses siswa
  - ⏳ Menunggu persetujuan publikasi dari admin
- ✅ Shows different \"Apa yang terjadi selanjutnya?\" steps for republication

**API Check:**
```
POST /api/v1/teacher/course-publish/157292/
Response: {
    \"success\": true,
    \"message\": \"Kursus Anda telah diajukan untuk review admin...\",
    \"course\": {
        \"platform_status\": \"Review\",
        \"teacher_course_status\": \"Published\"
    }
}
```

**Database Check:**
```python
course = Course.objects.get(course_id=157292)
# Should show:
# - platform_status = \"Review\"
# - review_submitted_date = <current datetime>
# - rejection_reason = None (cleared)
```

---

### Test 8: Submit Draft Course for Initial Publication (Comparison)

**Precondition:**
- Draft course (or create a new draft)
- Navigate to its edit page

**Steps:**
1. Click \"Ajukan Publikasi Kursus\" button
2. Observe confirmation dialog
3. Review differences from published course submission

**Expected Results:**
- ✅ Dialog title: \"Ajukan Kursus untuk Publikasi?\" (different from Test 6)
- ✅ Dialog shows \"Alur Persetujuan Publikasi\" (different from republication)
- ✅ Confirm button: \"Ya, Ajukan Publikasi Kursus\" (different from Test 6)
- ✅ Success message: \"Kursus Diajukan untuk Publikasi!\" (different from Test 7)
- ✅ Success shows \"Status Terbaru:\" (not \"Status Update:\")

---

### Test 9: Verify Button Text Changes Based on Status

**Test Multiple Statuses:**

**For Draft Status:**
- Button text: \"Ajukan Publikasi Kursus\"
- Dialog: \"Ajukan Kursus untuk Publikasi?\"

**For Rejected Status:**
- Button text: \"Ajukan Ulang Publikasi Kursus\"
- Dialog: \"Ajukan Kursus untuk Publikasi?\"

**For Review Status:**
- Button text: \"Ajukan Publikasi Kursus\" (same as Draft)
- Dialog: \"Ajukan Kursus untuk Publikasi?\"

**For Published Status:**
- Button text: \"Ajukan Review Admin untuk Publikasi Kursus\" ✨ NEW
- Dialog: \"Ajukan Perubahan Kursus untuk Publikasi?\" ✨ NEW

---

### Test 10: Validation Tests - Published Course

**Scenario A: Missing Requirements**

**Precondition:**
- Published course but missing curriculum/lessons/quiz

**Steps:**
1. Try to click \"Ajukan Review Admin untuk Publikasi Kursus\"
2. Observe button state

**Expected Results:**
- ⚠️ Button should be disabled (gray gradient)
- ✅ Error message below button: \"Tambahkan kurikulum, pelajaran & kuis terlebih dahulu\"
- ✅ No dialog appears on click

---

### Test 11: Error Handling - Restore Failure

**Scenario: Simulate API Error**

**Precondition:**
- Published course with valid data

**Steps:**
1. Open browser DevTools Network tab
2. Click \"Restore Kursus\"
3. In DevTools, simulate error response (or wait for real error)

**Expected Results:**
- ✅ Error toast appears: \"Pengembalian Gagal\"
- ✅ Error shows descriptive message
- ✅ Submit button returns to normal state
- ✅ isDirty flag unchanged

---

### Test 12: Rapid Click Prevention

**Scenario: Click buttons repeatedly**

**Precondition:**
- Published course page

**Steps:**
1. Click \"Restore Kursus\" button
2. Immediately click again before first request completes
3. Observe behavior

**Expected Results:**
- ✅ First dialog appears
- ✅ Second click has no effect (queued or ignored)
- ✅ Only one API request sent
- ✅ Dialog has just one confirmation action

---

### Test 13: Browser Navigation During Submit

**Scenario: Leave page during republication**

**Precondition:**
- Published course, started republication submission

**Steps:**
1. Click \"Ajukan Review Admin untuk Publikasi Kursus\"
2. In dialog, click \"Ya, Ajukan Perubahan...\"
3. API request in progress
4. Navigate to different page
5. Come back

**Expected Results:**
- ✅ Page navigation allowed (no page blocker)
- ✅ API request completes in background
- ✅ On return, course status updated to Review
- ✅ No broken state

---

### Test 14: Mobile Responsive - Button Layout

**Precondition:**
- Published course page
- Device: Mobile (or browser dev tools mobile view)

**Steps:**
1. Open course edit page on mobile
2. Scroll to buttons section
3. Verify layout and click targets

**Expected Results:**
- ✅ Buttons stack vertically on mobile
- ✅ Buttons full width (or appropriate mobile width)
- ✅ Text readable at mobile sizes
- ✅ Click targets accessible (minimum 44x44px)
- ✅ Helper text wraps appropriately

---

## Manual API Testing (curl/Postman)

### Test Restore Endpoint

Use admin user token or test with test course:

```bash
# Restore published course
curl -X POST http://localhost:8001/api/v1/teacher/course-restore/157292/ \
  -H \"Authorization: Bearer <token>\" \
  -H \"Content-Type: application/json\"

# Expected Response:
{
    \"success\": true,
    \"message\": \"Kursus berhasil dikembalikan ke versi yang dipublikasikan\",
    \"course\": {
        \"course_id\": \"157292\",
        \"title\": \"Course Title\",
        \"platform_status\": \"Published\",
        \"teacher_course_status\": \"Published\"
    }
}
```

### Test Publish (Republication) Endpoint

```bash
# Submit published course for republication review
curl -X POST http://localhost:8001/api/v1/teacher/course-publish/157292/ \
  -H \"Authorization: Bearer <token>\" \
  -H \"Content-Type: application/json\"

# Expected Response:
{
    \"success\": true,
    \"message\": \"Kursus Anda telah diajukan untuk review admin...\",
    \"course\": {
        \"course_id\": \"157292\",
        \"title\": \"Course Title\",
        \"platform_status\": \"Review\",
        \"teacher_course_status\": \"Published\",
        \"curriculum_sections\": 5,
        \"lessons\": 12
    }
}
```

---

## Regression Testing

### Important: Test Existing Workflows Still Work

- [ ] Draft course creation and editing
- [ ] Draft course submission for publication
- [ ] Rejected course resubmission
- [ ] Admin approval workflow
- [ ] Admin rejection with feedback workflow
- [ ] View published courses (students)
- [ ] Enroll in published courses

---

## Admin Testing (Optional)

If you have admin access, test:

### Approve Republication

**Steps:**
1. Admin dashboard → Course Review Queue
2. Find course submitted in Test 7
3. Click \"Approve\" button
4. Add approval comment (optional)
5. Verify course status changes to \"Published\"

**Expected:**
- ✅ Instructor sees success notification
- ✅ Course status returns to \"Published\" (not \"Review\")
- ✅ Changes visible to students immediately
- ✅ Notification sent to instructor

### Reject Republication

**Steps:**
1. Admin dashboard → Course Review Queue
2. Find any submitted course
3. Click \"Reject\" button
4. Add rejection reason
5. Verify course status changes to \"Rejected\"

**Expected:**
- ✅ Instructor sees rejection notification
- ✅ Course status returns to \"Rejected\" (students still see Published version)
- ✅ Feedback message visible in instructor edit page
- ✅ \"Ajukan Ulang Publikasi Kursus\" button available

---

## Performance Testing

### Load Testing Points

- [ ] Restore endpoint response time < 1 second
- [ ] Publish endpoint response time < 2 seconds
- [ ] Page load with large course data (many sections/lessons)
- [ ] Multiple simultaneous edit sessions

---

## Accessibility Testing

- [ ] Button text readable
- [ ] Icons have proper arialabels
- [ ] Color contrast meets WCAG standards
- [ ] Keyboard navigation works (Tab to buttons)
- [ ] Screen reader reads button purposes correctly
- [ ] Dialog inputs accessible via keyboard

---

## Browser Compatibility

Test on:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Chrome
- [ ] Mobile Safari

---

## Test Result Summary Template

```
Test Date: [DATE]
Tester: [NAME]
Course ID: 157292
Browser: [VERSION]
Device: [DESKTOP/MOBILE]

Test Results:
- [ ] Test 1: PASS / FAIL / BLOCKED
- [ ] Test 2: PASS / FAIL / BLOCKED
- [ ] Test 3: PASS / FAIL / BLOCKED
...

Issues Found:
1. [Description]
   - Expected: [X]
   - Actual: [Y]
   - Severity: CRITICAL / HIGH / MEDIUM / LOW

Sign-off:
Tested by: [name]
Approved by: [manager]
Date: [date]
```

