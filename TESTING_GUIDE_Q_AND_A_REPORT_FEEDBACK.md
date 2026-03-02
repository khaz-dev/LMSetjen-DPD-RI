# Testing Guide: Q&A Report Status Feedback

## Quick Testing Steps

### 1. **Test on Student Course Detail Page**
- Navigate to: `http://localhost:5174/student/courses/268977/`
- Go to **Diskusi (Discussion)** tab

### 2. **Test Report Button Visual Feedback**

#### For Unreported Question:
- Click **flag icon** on any question
- **Expected**: Modal opens showing "Laporkan Pertanyaan" form with report reason dropdown
- **Button appearance**: Gray flag icon

#### For Already-Reported Question:
- Submit a report for a question
- Click the flag icon again on the same question
- **Expected**: 
  - Modal opens with "Status Laporan Pertanyaan" header
  - Shows status badge (Menunggu Tinjauan / Sudah Ditinjau / Tindakan Diambil / Ditolak)
  - Shows original report reason and description
  - Shows when report was submitted (reported_at)
  - If reviewed: Shows "Umpan Balik Admin" card with:
    - When it was reviewed (reviewed_at)
    - Who reviewed it (admin name)
    - Admin's notes/decision (review_notes)
  - Button appears **RED** with **✓ checkmark**

### 3. **Check Different Report Statuses**

#### Status: Pending (Menunggu Tinjauan)
- Recently submitted report
- Shows: Yellow "Menunggu Tinjauan" badge
- No admin feedback card yet
- Alert: "Laporan ini sedang dalam proses tinjauan..."

#### Status: Reviewed (Sudah Ditinjau)
- Admin has reviewed but not taken action
- Shows: Blue "Sudah Ditinjau" badge
- Displays admin's review notes in green card

#### Status: Action Taken (Tindakan Diambil)
- Admin took action (removed content/warned user)
- Shows: Green "Tindakan Diambil" badge
- Displays admin's decision notes

#### Status: Dismissed (Ditolak)
- Admin rejected the report as invalid
- Shows: Gray "Ditolak" badge
- Displays admin's reason for dismissal

### 4. **Test Message Reports**
- Click on a question to open the discussion thread
- Find reply messages
- Click flag icon on a message
- **Expected**: Same feedback system but for message replies
- Shows "Status Laporan Balasan" (Report Status for Reply)

### 5. **Test Button Hover**
- Hover over flag button WITHOUT opening modal
- **Expected**: Tooltip shows
  - For unreported: "Laporkan pertanyaan ini"
  - For reported: "Laporan: pending/reviewed/action_taken/dismissed"

---

## Backend Testing (Optional)

### Test API Endpoint Directly
```bash
curl "http://localhost:8001/api/v1/student/qa-reports/268977/?user_id=USER_ID"
```

**Expected Response**:
```json
{
    "question_reports": [
        {
            "id": 1,
            "question__qa_id": "q123...",
            "status": "reviewed",
            "reason": "spam",
            "reported_at": "2026-03-01T10:30:00Z",
            "reviewed_at": "2026-03-01T11:45:00Z",
            "review_notes": "Konten ini melanggar kebijakan...",
            "reviewed_by__first_name": "Admin Name",
            "reviewed_by__username": "admin_user",
            "description": "Original report description..."
        }
    ],
    "message_reports": [...]
}
```

---

## Visual Indicators Summary

| State | Button Color | Icon | Badge | Modal Content |
|-------|-------------|------|-------|---------------|
| No Report | Gray | 🚩 | - | Report form |
| Pending | RED | 🚩✓ | Yellow | Pending badge + "Waiting for review" |
| Reviewed | RED | 🚩✓ | Blue | Review notes card with admin feedback |
| Action Taken | RED | 🚩✓ | Green | Action details card |
| Dismissed | RED | 🚩✓ | Gray | Dismissal reason card |

---

## What Each Section Shows

### Report Form (For Unreported Items)
- Reason dropdown (Spam, Inappropriate, Offensive, Misinformation, Other)
- Optional description field
- Info alert about admin review

### Report Status (For Reported Items)
- **Status Badge**: Color-coded status indicator
- **Report Details Card**: 
  - Original reason selected
  - Your description
  - Date submitted
- **Admin Feedback Card** (if reviewed):
  - Review date/time
  - Admin's name/username
  - Admin's notes/decision
  - Why report was dismissed (if applicable)

---

## Known Test Data Points

If you want to manually test different statuses:

### Step 1: Create Test Reports
Submit reports for different Q&A items in the discussion tab

### Step 2: Access Database (Or Use Admin Panel)
Manually update report status in backend:
```python
from api.models import Question_Answer_Report
report = Question_Answer_Report.objects.first()
report.status = 'reviewed'
report.review_notes = 'This violates our community standards.'
report.reviewed_at = timezone.now()
report.reviewed_by = admin_user  # Your admin user
report.save()
```

### Step 3: Test Each Status
- `pending` → Should show pending badge
- `reviewed` → Should show admin feedback
- `action_taken` → Should show action details
- `dismissed` → Should show dismissal reason

---

## Troubleshooting

### Report Button Always Shows "Report Form"
- **Issue**: Reports not loading from backend
- **Check**: Browser console for fetch errors
- **Solution**: Verify API endpoint returns data with `reviewed_at`, `review_notes` fields

### Modal Shows Old Report But Button Is Gray
- **Issue**: State not syncing
- **Check**: `currentReportData` state in React DevTools
- **Solution**: Hard refresh (Ctrl+F5) to reload cache

### Report Status Badge Not Showing
- **Issue**: CSS not applied or status is null
- **Check**: Console for JavaScript errors
- **Solution**: Verify `status` field in API response

### Admin Feedback Card Empty
- **Issue**: `reviewed_at` or `review_notes` is null
- **Check**: Backend data was actually updated
- **Solution**: Make sure admin used admin panel to review report

---

## Files to Remember for Future Changes

1. **Backend Endpoint**: `backend/api/views.py` (StudentQAReportsAPIView)
2. **Frontend Modal**: `frontend/src/views/student/CourseDetail.jsx` (Line 4356)
3. **CSS Styling**: `frontend/src/views/student/CourseDetail.css` (existing badge styles)

---

## Success Criteria

✅ Report button shows different color when report exists  
✅ Modal shows report status feedback instead of form  
✅ Admin notes/decision visible when reviewed  
✅ Status badges display correctly  
✅ Buttons in all 3 locations work (list, thread question, thread reply)  
✅ Tooltip shows current status on hover  

---

## Feature Complete
All admin review feedback is now visible to students who submitted a report!

