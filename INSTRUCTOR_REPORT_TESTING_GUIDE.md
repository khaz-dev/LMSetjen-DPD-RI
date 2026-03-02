# Instructor Q&A Report Status - Quick Testing Guide

## Pre-Testing Checklist

- [ ] Backend is running: `http://localhost:8001`
- [ ] Frontend is running: `http://localhost:5174`
- [ ] Frontend has NO compile errors
- [ ] You're logged in as an instructor
- [ ] Instructor has at least 1 course with Q&A enabled

---

## Test 1: New Report Creation ✅

**Goal**: Verify form appears for new reports and modal reopens with status

### Steps:
1. Navigate to **Instructor Q&A** page
2. Select a course from the dropdown
3. Click **report button** (`🚩` flag icon) on any question
4. **Verify**: Modal opens with form (title: "Laporkan Pertanyaan")
   - [ ] Reason dropdown visible
   - [ ] Description textarea visible
   - [ ] "Kirim Laporan" button visible

5. Select reason from dropdown (e.g., "Spam")
6. Enter description: "Test report message for verification"
7. Click **"Kirim Laporan"** button
8. **Verify**: Success toast appears
   - [ ] Message: "Laporan berhasil dikirim!"
   - [ ] Toast auto-dismisses after ~3 seconds

9. **Verify**: Modal automatically reopens (Wait 1-2 seconds)
   - [ ] Modal is still visible
   - [ ] Title changed to: "Status Laporan Pertanyaan"
   - [ ] Showing status page, NOT form
   - [ ] Status badge shows: "🕐 Menunggu Tinjauan" (yellow badge)
   - [ ] Shows your submitted reason
   - [ ] Shows your submitted description
   - [ ] Shows "Tanggal Lapor" timestamp
   - [ ] Shows info message about pending review

10. Click **"Tutup"** button
11. **Verify**: Modal closes and you're back to question list

---

## Test 2: View Existing Report ✅

**Goal**: Verify status page appears immediately (no form) when clicking report for same question

### Steps:
1. From Test 1, you should still be on same course
2. Click report button on the **same question** you reported in Test 1
3. **Verify**: Modal opens **directly to status page** (NOT form)
   - [ ] Title: "Status Laporan Pertanyaan"
   - [ ] Shows previous status badge
   - [ ] Shows previous reason submitted
   - [ ] Shows previous description
   - [ ] Shows previous report date
   - [ ] Footer shows: "Tutup" and **"Edit Laporan"** buttons
   - [ ] "Edit Laporan" button is visible and enabled

4. Click **"Tutup"** button
5. **Verify**: Modal closes

---

## Test 3: Edit Pending Report ✅

**Goal**: Verify edit functionality updates report and reopens with fresh status

### Steps:
1. Click report button on the **same question** again
2. **Verify**: Modal opens to status page
3. Click **"Edit Laporan"** button
4. **Verify**: Modal changes to form mode
   - [ ] Info message shows: "Anda sedang mengedit laporan Anda..."
   - [ ] Reason dropdown is pre-filled with previous choice (e.g., "Spam")
   - [ ] Description textarea is pre-filled with previous text
   - [ ] Button changed to: "Perbarui Laporan" (instead of "Kirim Laporan")

5. Change the reason to something different (e.g., "Konten Tidak Pantas")
6. Modify description text (e.g., add "- EDITED" to the end)
7. Click **"Perbarui Laporan"** button
8. **Verify**: Success toast appears
   - [ ] Message: "Laporan berhasil diperbarui!"
   - [ ] Text: "Laporan Anda telah diperbarui dan menunggu tinjauan ulang."

9. **Verify**: Modal automatically reopens (Wait 1-2 seconds)
   - [ ] Shows updated status page
   - [ ] Reason shows your new choice
   - [ ] Description shows your new text with "-EDITED"
   - [ ] Status still shows "🕐 Menunggu Tinjauan"
   - [ ] "Edit Laporan" button still visible

10. Click **"Tutup"**

---

## Test 4: Different Questions ✅

**Goal**: Verify each question tracks its own report independently

### Steps:
1. You should still be on same course
2. Find a **different question** (not the one you reported)
3. Click report button on this **different question**
4. **Verify**: Modal opens with **form** (NOT status page)
   - [ ] Title: "Laporkan Pertanyaan"
   - [ ] Fields are empty (not pre-filled)
   - [ ] This is a new report for a different question

5. Select reason: "Offensive" 
6. Enter description: "Different question test report"
7. Click **"Kirim Laporan"**
8. **Verify**: Modal reopens with status for this question
   - [ ] Status badge visible
   - [ ] Your new reason shown: "Offensive"
   - [ ] Your new description shown

9. Click **"Tutup"**
10. Click report button on the **first question** you reported
11. **Verify**: Modal shows the **first question's report** (not the second)
    - [ ] Status badge visible
    - [ ] Original reason shown (e.g., "Spam")
    - [ ] Original description shown

---

## Test 5: Error Handling ✅

**Goal**: Verify form validation and error messages work

### Steps:
1. Find a **third question** (different from previous two)
2. Click report button
3. **Verify**: Modal opens with form
4. Do NOT select any reason - leave dropdown as "--Pilih Alasan--"
5. Fill in description
6. Click **"Kirim Laporan"** button
7. **Verify**: Warning toast appears
   - [ ] Message: "Silakan pilih alasan laporan"
   - [ ] Modal remains open
   - [ ] Form is not submitted
   - [ ] Button is still clickable

8. Click dropdown and select a reason (e.g., "Misinformation")
9. Click **"Kirim Laporan"** again
10. **Verify**: Now it succeeds (same as Test 1)

---

## Test 6: Browse Multiple Courses ✅

**Goal**: Verify reports track separately per course

### Steps:
1. You're on Course A with questions already reported
2. Click report button on any question in Course A
3. **Verify**: Shows report status correctly
4. Close modal
5. Click **course dropdown** at top
6. Select a **different course** (Course B)
7. Click report button on any question in Course B
8. **Verify**: Modal opens with **form** (no report exists yet in this course)
   - [ ] Title: "Laporkan Pertanyaan"
   - [ ] Fields are empty

9. Submit report for Course B
10. **Verify**: Modal reopens with status for Course B
11. Go back to Course A dropdown
12. Select **Course A** again
13. Click report button on same question from earlier in Course A
14. **Verify**: Shows Course A's previous report
    - [ ] Not the Course B report
    - [ ] Shows your Course A submission

---

## Test 7: Console Logging (Developer Check) ✅

**Goal**: Verify debug logging is working (optional but helpful)

### Steps:
1. Open **Browser DevTools** (F12)
2. Go to **Console** tab
3. Report a question
4. **Verify**: Console shows debug logs
   - [ ] `[handleOpenReportModal] Opening modal for:`
   - [ ] `[handleOpenReportModal] Found existing report:` (if re-opening)
   - [ ] `[handleSubmitReport] Report created`
   - [ ] `[handleSubmitReport] Fetching fresh reports`
   - [ ] `[handleSubmitReport] Modal reopened`

5. Edit the report
6. **Verify**: Shows different logs
   - [ ] `[handleEditQAReport] Entering edit mode`
   - [ ] `[handleSubmitReport] Report updated`

---

## Test 8: Network Error Simulation ⚠️ (Advanced)

**Goal**: Verify graceful error handling

### Steps:
1. Open **Network tab** in DevTools
2. Find any report submit action
3. Set Network tab to **"Offline"** status (before submit)
4. Click report button on a new question
5. Try to submit report
6. **Error toast should appear** before any network call
7. Go back **Online** in Network tab
8. Try again
9. **Verify**: Now succeeds normally

---

## Expected Button State Changes

### Modal States Timeline

```
Initial Load
    ↓
Click Report (New) → Form Appears
[Batal] [Kirim Laporan]
    ↓ (Submit)
Pending State
[Tutup] [Edit Laporan] ← Can edit
    ↓ (Admin reviews - would need backend change)
Reviewed State
[Tutup]                ← Cannot edit, no Edit button
    ↓ (Admin takes action)
Action Taken State
[Tutup]                ← Cannot edit
```

---

## Troubleshooting

### Issue: Modal shows form on second click
**Expected**: Status page should appear
**Solution**: 
- [ ] Verify `fetchQAReports` is being called after submit
- [ ] Check Network tab - reports endpoint should return `question_reports` array
- [ ] Check browser console for errors

### Issue: No success toast on submit
**Expected**: Green toast with "Laporan berhasil dikirim!"
**Solution**:
- [ ] Check if Toast plugin is working (should appear for any action)
- [ ] Check Network tab - POST request should return 200-201 status
- [ ] Check browser console for errors

### Issue: Modal doesn't reopen after submit
**Expected**: Modal closes then automatically reopens within 2 seconds
**Solution**:
- [ ] Check browser console for errors
- [ ] Verify `fetchQAReports` completes successfully
- [ ] Check that `reportingQuestion` state is not being cleared

### Issue: Form shows previous data on different questions
**Expected**: Each question should start with empty form
**Solution**:
- [ ] Verify different questions have different `qa_id` values
- [ ] Check that form fields are dependent on `reportingQuestion.qa_id`
- [ ] Look for state leakage in component

---

## Success Criteria Checklist

### All Tests Pass When:
- [ ] Test 1: New reports create and status page appears
- [ ] Test 2: Existing reports show status immediately
- [ ] Test 3: Edit functionality works and updates
- [ ] Test 4: Multiple questions track independently
- [ ] Test 5: Form validation prevents empty submissions
- [ ] Test 6: Multiple courses track reports separately
- [ ] Test 7: Console logging appears for debugging
- [ ] Test 8: Network errors are handled gracefully
- [ ] No browser errors in Console
- [ ] No network 500 errors
- [ ] Toasts display correctly
- [ ] Modal transitions are smooth

### Performance Checks:
- [ ] Modal reopen happens within 2-3 seconds
- [ ] No lag clicking buttons repeatedly
- [ ] Page doesn't freeze during submit

---

## Quick Testing Checklist (5 minutes)

For a quick validation, just run these:

```
✅ 1. Report a question → Form appears
   2. Submit → Status page appears automatically
   3. Click same question → Status page appears (no form)
   4. Click "Edit Laporan" → Form shows with pre-filled data
   5. Update and submit → Status page shows updated data
   6. Report different question → Form appears (new report)
   7. Close modal → No errors in console
```

If all 7 pass → Implementation is working correctly! 🎉

---

## Post-Testing Notes

- Save this guide for regression testing
- If any test fails, note the exact step and error message
- Check console logs before/after modifications
- Performance baseline: Modal should reopen within 2s of "Kirim Laporan" click

---

**Estimated Testing Time**: 10-15 minutes for all tests  
**Quick Testing Time**: 5 minutes  
**Difficulty Level**: Easy - all UI-based, no backend modifications needed
