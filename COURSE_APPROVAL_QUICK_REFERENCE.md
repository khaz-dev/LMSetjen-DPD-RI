# Quick Reference: Course Approval Workflow - PHASE 4.36

## What Changed?

### Before (❌ Old System)
- Instructor clicks "Terbitkan Kursus" 
- → Course immediately publishes to students
- ✗ No quality control
- ✗ No admin oversight

### After (✅ New System)
- Instructor clicks "Ajukan untuk Review Admin"
- → Course enters "Review" status (waiting for admin)
- Admin reviews course quality
- Admin either:
  - **Approves** → Publishes to students
  - **Rejects** → Shows instructor specific reasons to fix
- Instructor fixes and resubmits

---

## For Instructors

### Step 1: Create/Edit Your Course
- Fill in course title, description, category, level
- Add curriculum sections and lessons
- Add quizzes
- (Same as before)

### Step 2: Submit for Review
- Go to course edit page
- Click button: **"Ajukan untuk Review Admin"** (blue button, paper plane icon)
- Dialog opens explaining the workflow
- Click **"Ya, Ajukan untuk Review"**

### Step 3: Wait for Admin Decision
- Status shows: **"Menunggu Persetujuan Admin"**
- Orange/blue alert box appears
- Message: "Kursus Anda sedang dalam proses review"
- You will receive notification when admin decides

### Step 4a: If Course is Approved ✓
- Status changes to: **"✓ Kursus Dipublikasikan"**
- Green alert box appears
- Course appears to students on homepage
- Students can enroll

### Step 4b: If Course is Rejected ✗
- Status changes to: **"Kursus Ditolak - Silakan Perbaiki"**
- Red alert box appears with **admin's specific feedback**
- Button: **"Ajukan Ulang untuk Review"** appears
- Fix the issues mentioned
- Click button to resubmit

---

## For Admins

### Access the Course Review Panel

```bash
# Get list of all pending courses
GET /api/v1/admin/courses-pending-review/?status=Review

# You need: JWT token with admin/superuser permissions
```

### Review a Course
1. Look at pending courses list
2. Read course details (title, description, curriculum, lessons)
3. Check quality, content, appropriateness
4. Make decision: Approve or Reject

### Approve a Course
```bash
POST /api/v1/admin/course-approval/{course_id}/

Body:
{
  "action": "approve"
}

# Result: Course status → "Published"
# Course becomes visible to students
```

### Reject a Course (with Feedback)
```bash
POST /api/v1/admin/course-approval/{course_id}/

Body:
{
  "action": "reject",
  "rejection_reason": "আপনার কোর্সের উপাদান অপর্যাপ্ত। অন্তত 10টি পাঠ যোগ করুন এবং আরও বিস্তারিত বিবরণ প্রদান করুন।"
}

# Result: Course status → "Rejected"
# Instructor sees your feedback in a red alert box
# Instructor can fix and resubmit
```

---

## Status Flow Diagram

```
                    ┌─────────────┐
                    │   DRAFT     │ (Initial state)
                    └──────┬──────┘
                           │ Instructor clicks
                           │ "Ajukan untuk Review"
                           ↓
                    ┌─────────────┐
                    │   REVIEW    │ (Waiting for admin)
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │             │
           (Admin Clicks) (Admin Clicks)
              Approve        Reject
                    │             │
                    ↓             ↓
            ┌─────────────┐ ┌──────────────┐
            │ PUBLISHED   │ │  REJECTED    │
            │ ✓ Students  │ │ ✗ With reason│
            │   can see   │ │ ✓ Reopens for│
            │             │ │   resubmit   │
            └─────────────┘ └──────┬───────┘
                                   │ Instructor
                                   │ fixes issues
                                   │
                                   └──→ Back to REVIEW
```

---

## Key Status Messages

### DRAFT (Blue)
- "Ini status awal dari kursus Anda"
- Button: "Ajukan untuk Review Admin"
- Action: Submit for approval

### REVIEW (Yellow/Orange - ⏳)
- "Menunggu Persetujuan Admin"
- "Kursus Anda sedang dalam proses review. Anda akan menerima notifikasi saat admin selesai meninjau."
- Action: Wait for admin decision

### PUBLISHED (Green - ✓)
- "✓ Kursus Dipublikasikan"
- "Kursus Anda telah disetujui dan sekarang tersedia untuk siswa di platform."
- Action: Accessible to students

### REJECTED (Red - ✗)
- "Kursus Ditolak - Silakan Perbaiki"
- Shows specific reason from admin
- Button: "Ajukan Ulang untuk Review"
- Action: Fix issues and resubmit

---

## Important Notes

⚠️ **Critical Changes**:
- You CANNOT publish courses directly anymore
- All courses must be approved by admin first
- The "Terbitkan Kursus" button is now "Ajukan untuk Review Admin"
- Button color changed from green to blue

✅ **Good News**:
- Transparent feedback from rejections
- Clear process and timeline
- Easy to resubmit after fixes
- Status always visible in course editor

---

## Troubleshooting

### Q: Where's the "Terbitkan Kursus" button?
A: Renamed to "Ajukan untuk Review Admin" (submit for review instead of direct publish)

### Q: My course says "Menunggu Persetujuan Admin" - what now?
A: Wait for admin to review. You'll see an alert when they decide. Check your email for notifications.

### Q: Admin rejected my course - what do I do?
A: Look at the red alert box at the top of the course page - it shows exactly what the admin said needs fixing. Fix those issues, then click "Ajukan Ulang untuk Review" to resubmit.

### Q: How long does approval take?
A: Depends on admin workload. No guaranteed timeline yet. (could be hours to days)

### Q: Can I edit my course while it's in review?
A: Yes, you can edit anytime. But if it's already approved (Published), editing it might revert it back to "Review" status. (Check with admin)

### Q: What if I disagree with admin's rejection reason?
A: Contact admin directly to discuss. Include reference to your course ID.

---

## Database Fields (Technical)

```python
Course model now has:

rejection_reason (TextField)
  ↳ What admin said is wrong

approved_by (ForeignKey to User)
  ↳ Which admin approved it

approval_date (DateTimeField)
  ↳ When admin approved

review_submitted_date (DateTimeField)
  ↳ When you submitted for review

platform_status (updated values)
  ↳ "Review" = awaiting approval (new)
  ↳ "Draft" = not submitted yet
  ↳ "Published" = approved and live
  ↳ "Rejected" = needs fixes
  ↳ "Disabled" = admin disabled it
```

---

## API Endpoints

### For Instructors
```
POST /api/v1/teacher/course-publish/{course_id}/
  → Submit course for review
  → Requires: JWT token, course must be complete
  → Returns: platform_status = "Review"
```

### For Admins
```
POST /api/v1/admin/course-approval/{course_id}/
  → Approve or reject a course
  → Requires: JWT token + admin permissions
  → Body: {"action": "approve"|"reject", "rejection_reason": "..."}

GET /api/v1/admin/courses-pending-review/?status=Review
  → List all courses awaiting review
  → Requires: JWT token + admin permissions
  → Returns: paginated course list with approval fields
```

---

## Summary Table

| Scenario | Before | After | Button Says |
|----------|--------|-------|-------------|
| Create course | Draft | Draft | "Ajukan untuk Review Admin" |
| Submit | Auto-publishes | Goes to Review | "Mengajukan..." |
| Admin approves | N/A | Published | (No button) |
| Admin rejects | N/A | Rejected + reason | "Ajukan Ulang untuk Review" |
| Student sees | Within minutes | After approval | On homepage |

---

**Version**: PHASE 4.36  
**Date**: 2026-02-17  
**Status**: ✅ Implemented & Ready for Testing

Need help? Check the full documentation file: `COURSE_APPROVAL_WORKFLOW_PHASE_4.36.md`
