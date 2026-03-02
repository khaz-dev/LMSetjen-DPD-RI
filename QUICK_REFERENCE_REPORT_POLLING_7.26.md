# Quick Implementation Reference - Report Status Live Polling (PHASE 7.26)

## Summary of Changes

**File:** `frontend/src/views/instructor/QA.jsx`

**Total Changes:** 4 additions (1 ref + 2 functions + 1 useEffect)

---

## CHANGE 1: Add Report Polling Ref

**Location:** Line 78 (after `pollingIntervalRef`)

**Added:**
```javascript
const reportPollingIntervalRef = useRef(null);
```

---

## CHANGE 2: Add startReportPolling Function

**Location:** Lines 514-564 (after `stopForumPolling`)

**Added:**
```javascript
// ✨ PHASE 7.26: Start polling for report status updates
const startReportPolling = () => {
    // Clear existing polling
    if (reportPollingIntervalRef.current) {
        clearInterval(reportPollingIntervalRef.current);
    }
    
    console.log("[Report Polling] Starting polling for report status updates");
    
    // Poll every 3 seconds to fetch updated report status
    reportPollingIntervalRef.current = setInterval(async () => {
        try {
            if (!selectedCourse || !reportingQuestion) return;
            
            const userId = UserData()?.id || UserData()?.user_id;
            const courseId = selectedCourse?.id || selectedCourse?.course_id;
            
            // Fetch latest reports for the course
            const res = await useAxios.get(`student/qa-reports/${courseId}/?user_id=${userId}`);
            
            const normalizedReports = {
                question_reports: res.data?.question_reports || [],
                message_reports: res.data?.message_reports || []
            };
            
            // Update the reports state
            setQaReports(normalizedReports);
            
            // Find the current report being viewed
            const isMessage = reportingQuestion?.message && !reportingQuestion?.title;
            const reportList = isMessage ? normalizedReports.message_reports : normalizedReports.question_reports;
            const fieldName = isMessage ? 'message__qa_id' : 'question__qa_id';
            
            const updatedReport = reportList?.find(r => r[fieldName] === reportingQuestion?.qa_id);
            
            if (updatedReport) {
                // Update the current report data being displayed in modal
                setCurrentReportData(updatedReport);
                console.log(`[Report Polling] Updated report status: ${updatedReport.status}`);
            } else {
                // Report was deleted or user doesn't exist anymore
                console.log("[Report Polling] Report not found, clearing modal");
                setCurrentReportData(null);
            }
        } catch (error) {
            console.log("[Report Polling] Error fetching report updates:", error.message);
        }
    }, 3000); // Poll every 3 seconds
};
```

---

## CHANGE 3: Add stopReportPolling Function

**Location:** Lines 566-573 (after `startReportPolling`)

**Added:**
```javascript
// ✨ PHASE 7.26: Stop polling for report status
const stopReportPolling = () => {
    if (reportPollingIntervalRef.current) {
        clearInterval(reportPollingIntervalRef.current);
        reportPollingIntervalRef.current = null;
        console.log("[Report Polling] Polling stopped");
    }
};
```

---

## CHANGE 4: Add Report Polling Lifecycle useEffect

**Location:** Lines 860-875 (after forum polling useEffect)

**Added:**
```javascript
// ✨ PHASE 7.26: Start report polling when modal opens with report data, stop when modal closes
useEffect(() => {
    if (showReportModal && currentReportData && reportingQuestion) {
        console.log("[useEffect] Starting polling for report status");
        startReportPolling();
    } else {
        console.log("[useEffect] Stopping polling - report modal closed or no report selected");
        stopReportPolling();
    }
    
    // Cleanup on unmount or when dependencies change
    return () => {
        if (showReportModal && currentReportData) {
            stopReportPolling();
        }
    };
}, [showReportModal, currentReportData?.id, reportingQuestion?.qa_id]);
```

---

## Key Implementation Details

### Polling Trigger Conditions
```javascript
if (showReportModal && currentReportData && reportingQuestion)
```
All three must be true:
- `showReportModal === true` → User has modal open
- `currentReportData !== null` → Modal showing existing report (not form)
- `reportingQuestion !== null` → Context of which item was reported

### Report Type Detection Logic
```javascript
const isMessage = reportingQuestion?.message && !reportingQuestion?.title;
// If has 'message' field AND no 'title' field → it's a message reply
// Otherwise → it's a question
```

### Field Name Mapping
| Type | Field Name | List |
|------|-----------|------|
| Question | `question__qa_id` | `question_reports` |
| Message | `message__qa_id` | `message_reports` |

### Dependencies Array Explained
```javascript
[showReportModal, currentReportData?.id, reportingQuestion?.qa_id]
```
- `showReportModal` → Stop polling when modal closes
- `currentReportData?.id` → Restart when viewing different report
- `reportingQuestion?.qa_id` → Restart when context changes

---

## How It Works Step-by-Step

1. **User Opens Report Modal**
   - Calls `handleOpenReportModal()`
   - Sets `showReportModal = true`
   - Loads `currentReportData` from cached `qaReports`

2. **useEffect Detects Change**
   - All three dependencies true → starts polling
   - Logs: `[useEffect] Starting polling for report status`

3. **Polling Loop Every 3 Seconds**
   - Fetches fresh reports: `student/qa-reports/{courseId}/?user_id={userId}`
   - Updates `qaReports` state with latest data
   - Finds current report in fresh data
   - Calls `setCurrentReportData(updatedReport)`
   - Modal re-renders with new status

4. **Admin Changes Status in Backend**
   - Next polling tick fetches new status
   - Badge in modal changes color automatically
   - Admin feedback section appears/updates
   - All within 3 seconds of status change

5. **User Closes Modal**
   - `handleCloseReportModal()` called
   - Sets `showReportModal = false`
   - useEffect detects change → calls `stopReportPolling()`
   - Clears interval, prevents memory leak

---

## Testing Quick Checks

### Test Polling Started
Open DevTools Console → Should see:
```
[useEffect] Starting polling for report status
[Report Polling] Starting polling for report status updates
```

### Test Polling Running
Wait 3 seconds in console → Should see recurring:
```
[Report Polling] Updated report status: pending
```

### Test Polling Stopped
Close modal → Should see:
```
[useEffect] Stopping polling - report modal closed or no report selected
[Report Polling] Polling stopped
```

### Test Live Update
Change report status in admin panel → In modal should see within 3 seconds:
```
Badge changes from yellow (pending) to blue (reviewed)
[Report Polling] Updated report status: reviewed
```

---

## Conflict Prevention

### No Conflicts with Forum Polling
- Forum polling uses: `pollingIntervalRef` (questions/messages)
- Report polling uses: `reportPollingIntervalRef` (reports)
- Separate refs = no interference
- Both can run simultaneously

### No Conflicts with Form Submission
- Polling stops when: `currentReportData === null`
- Form only shown when: `!currentReportData`
- Safe coexistence: can't edit while polling

---

## Rollback Instructions (if needed)

To completely remove this feature:
1. Delete `const reportPollingIntervalRef = useRef(null);` (line 78)
2. Delete `startReportPolling()` function (lines 514-564)
3. Delete `stopReportPolling()` function (lines 566-573)
4. Delete report polling useEffect (lines 860-875)

Report modal will still work, just won't update live.

---

## Status Indicators Updated Live

The following display elements update every 3 seconds while modal open:

✅ Status badge:
- Yellow: "Menunggu Tinjauan" (pending)
- Blue: "Sudah Ditinjau" (reviewed)
- Green: "Tindakan Diambil" (action_taken)
- Gray: "Ditolak" (dismissed)

✅ Report Details Section:
- Alasan yang Dilaporkan (Reason)
- Deskripsi Laporan (Description)
- Tanggal Lapor (Reported date)

✅ Admin Feedback Section (appears after review):
- Ditinjau Pada (Reviewed date)
- Ditinjau Oleh (Reviewed by)
- Catatan Admin (Admin notes)

✅ Form Buttons:
- "Edit Laporan" button availability
- "Selesai" vs "Batal" button logic

---

## Performance Notes

- **No Performance Degradation** - Only active when modal open
- **Memory Safe** - Interval cleared on modal close
- **API Efficient** - Single endpoint call every 3 seconds (existing endpoint)
- **CPU Impact** - Minimal async operation with short interval
- **Network Impact** - ~20 per minute API calls when modal open (vs 0 before)

---

Generated: March 2, 2026 | Phase 7.26 | Status: ✅ DEPLOYED
