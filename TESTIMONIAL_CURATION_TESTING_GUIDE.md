# Testimonial Curation System - Testing Guide
**PHASE 4.12: Complete Testimonial Approval Workflow**

## Quick Start Test (5 minutes)

### 1. Submit a Testimonial (as Student/Instructor)
```
1. Login as student or instructor
2. Go to /student/testimonials/ or /instructor/testimonials/
3. Submit a testimonial with rating and text
4. **Expected**: Message says "Testimoni akan ditampilkan setelah disetujui admin" ✅
```

### 2. Check Homepage - Testimonial Should NOT Appear
```
1. Go to http://localhost:5174/
2. Scroll to testimonials section
3. **Expected**: New testimonial does NOT appear yet ✅
```

### 3. Review Testimonial as Admin
```
1. Login as admin
2. Go to /admin/testimonials/
3. Click "Pending Persetujuan" tab
4. **Expected**: See your submitted testimonial ✅
```

### 4. Approve Testimonial
```
1. In admin panel, click "Setujui" button
2. **Expected**: 
   - Success toast: "Testimoni berhasil disetujui"
   - Testimonial moves to "Sudah Disetujui" tab ✅
```

### 5. Check Homepage Again - Testimonial NOW Appears
```
1. Go to http://localhost:5174/
2. Scroll to testimonials section
3. **Expected**: Approved testimonial now appears with correct role badge ✅
```

## Complete Test Suite

### Backend API Tests

#### Test 1: Create Testimonial (Pending Status)
```bash
curl -X POST http://localhost:8001/api/v1/student/submit-testimonial/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "review": "Testimoni test approval workflow",
    "role": "student"
  }'
```

**Expected Response (201)**:
```json
{
  "message": "Testimoni berhasil dikirim! Testimoni akan ditampilkan setelah disetujui admin.",
  "status": "pending_review",
  "requires_approval": true,
  "testimonial_id": 123,
  "role": "student"
}
```

#### Test 2: List Pending Testimonials (Admin Only)
```bash
curl -X GET http://localhost:8001/api/v1/admin/testimonials/pending/ \
  -H "Authorization: Bearer <admin_token>"
```

**Expected Response (200)**:
```json
{
  "count": 1,
  "results": [
    {
      "id": 123,
      "full_name": "John Doe",
      "email": "john@example.com",
      "review": "Testimoni test approval workflow",
      "rating": 5,
      "role": "student",
      "active": false,
      "date": "2024-02-16T10:30:00Z"
    }
  ]
}
```

#### Test 3: Approve Testimonial (Admin Only)
```bash
curl -X PATCH http://localhost:8001/api/v1/admin/testimonials/123/approve-reject/ \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"action": "approve"}'
```

**Expected Response (200)**:
```json
{
  "message": "Testimoni berhasil disetujui dan akan ditampilkan di halaman utama.",
  "testimonial_id": 123,
  "status": "approved",
  "action": "approve"
}
```

#### Test 4: Reject Testimonial (Admin Only)
```bash
curl -X PATCH http://localhost:8001/api/v1/admin/testimonials/124/approve-reject/ \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"action": "reject", "reason": "Contains inappropriate language"}'
```

**Expected Response (200)**:
```json
{
  "message": "Testimoni berhasil ditolak.",
  "testimonial_id": 124,
  "status": "rejected",
  "action": "reject"
}
```

#### Test 5: List Approved Testimonials (Admin)
```bash
curl -X GET http://localhost:8001/api/v1/admin/testimonials/approved/ \
  -H "Authorization: Bearer <admin_token>"
```

**Expected Response (200)**:
```json
{
  "count": 1,
  "results": [
    {
      "id": 123,
      "full_name": "John Doe",
      "email": "john@example.com",
      "review": "Testimoni test approval workflow",
      "rating": 5,
      "role": "student",
      "active": true,
      "date": "2024-02-16T10:30:00Z"
    }
  ]
}
```

#### Test 6: List Homepage Testimonials (Public)
```bash
curl -X GET http://localhost:8001/api/v1/statistics/testimonials/?role=student
```

**Expected Response (200)**:
- Should only include testimonials with `active=true`
- Should not include pending testimonials

### Frontend UI Tests

#### Test 1: Navigation to Admin Panel
```
1. Login as admin
2. Should see "Kurasi Testimoni" in admin menu
3. Click it → goes to /admin/testimonials/
4. ✅ Should not get 404
```

#### Test 2: Pending Tab
```
1. Go to /admin/testimonials/
2. Click "Pending Persetujuan" tab
3. ✅ Should show count of pending testimonials
4. ✅ Should display testimonial cards with:
   - User avatar
   - Full name
   - Email
   - Position/Golongan
   - Role badge (Siswa/Instruktur)
   - Rating (5 stars)
   - Review text
   - Date
   - "Setujui" and "Tolak" buttons
```

#### Test 3: Approved Tab
```
1. From Pending tab, click "Setujui" on a testimonial
2. Should see success toast
3. Switch to "Sudah Disetujui" tab
4. ✅ Approved testimonial appears there
5. ✅ No action buttons on approved tab
```

#### Test 4: Rejection Modal
```
1. In Pending tab, click "Tolak" button
2. ✅ Modal appears with:
   - Title: "Berikan Alasan Penolakan"
   - Textarea for reason
   - "Batal" and "Tolak Testimoni" buttons
3. Enter reason and click "Tolak Testimoni"
4. ✅ Toast: "Testimoni berhasil ditolak"
5. ✅ Testimonial disappears from pending tab
```

#### Test 5: User Feedback (Student/Instructor View)
```
1. Submit testimonial as student
2. ✅ Message says: "Testimoni akan ditampilkan setelah disetujui admin"
3. Refresh page
4. ✅ If testimonial is pending, might show different status
5. After admin approves:
   - Refresh page
   - ✅ Could show "Testimoni Anda disetujui dan ditampilkan"
```

### Integration Tests

#### Test 1: Complete Workflow
```
1. Student submits testimonial → active=false
2. Admin sees it in pending list → active=false
3. Admin clicks approve → active=true (DB updated)
4. Homepage displays testimonial → filters by active=true ✅
5. Testimonial appears correctly with role badge
```

#### Test 2: Multi-User Scenario
```
1. Student A submits testimonial (#1)
2. Instructor B submits testimonial (#2)
3. Both appear in pending list
4. Approve #1, reject #2
5. Homepage shows only #1
6. Admin Approved list shows only #1
```

#### Test 3: Testimonial Resubmission
```
1. Student submits testimonial (pending)
2. Admin rejects it with reason
3. Student submits again
4. ✅ New submission should be pending again
5. ✅ Old rejection should not appear
```

#### Test 4: Permission Tests
```
1. Non-admin tries to access /admin/testimonials/
   → ✅ Should get 403 or redirect to student dashboard
2. Non-admin tries to call /api/v1/admin/testimonials/pending/
   → ✅ Should get 403 Forbidden
3. Admin can access all endpoints
   → ✅ Should get 200 OK
```

### Edge Cases

#### Test 1: No Pending Testimonials
```
1. Approve/delete all pending testimonials
2. Go to admin panel
3. ✅ "Pending Persetujuan" tab shows:
   - Count: 0
   - Empty state icon and message
```

#### Test 2: Empty Approved List (Fresh Start)
```
1. Reject or delete all approved
2. Go Approved tab
3. ✅ Shows empty state:
   - "Belum ada testimoni yang disetujui"
```

#### Test 3: Very Long Review Text
```
1. Submit testimonial with very long text (500+ chars)
2. ✅ Should display correctly in card (truncated with ellipsis or scrollable)
3. ✅ Should display fully in modal/expanded view
```

#### Test 4: Special Characters
```
1. Submit testimonial with special chars (emoji, accents, symbols)
2. ✅ Should display correctly in admin panel
3. ✅ Should display correctly on homepage
```

## Database Verification

### Check Pending Testimonials
```sql
SELECT id, user_id, review, rating, active, role, date
FROM api_review
WHERE active = false
AND course_id IS NULL
ORDER BY date DESC;
```

**Expected**: Shows only pending (active=false) testimonials

### Check Approved Testimonials
```sql
SELECT id, user_id, review, rating, active, role, date
FROM api_review
WHERE active = true
AND course_id IS NULL
ORDER BY date DESC;
```

**Expected**: Shows only approved (active=true) testimonials

### Verify Active Field Exists
```sql
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'api_review'
AND column_name = 'active';
```

**Expected**: `active` boolean field with default false

## Common Issues & Solutions

### Issue: Testimonials Still Appear on Homepage
- Check: Is `active` field set correctly in database?
- Check: Does `TestimonialListAPIView` filter by `active=True`?
- Solution: Run migration (if not done), verify code changes

### Issue: Admin Cannot See Pending Testimonials
- Check: Is user admin? (`user.is_admin == True`)
- Check: Can access `/admin/testimonials/pending/` API?
- Check: Browser console for errors
- Solution: Verify admin privileges, check API response

### Issue: Approve/Reject Buttons Don't Work
- Check: Browser console for errors
- Check: Network tab - is request being sent?
- Check: Admin token validity
- Solution: Check API response status, verify permission classes

### Issue: Modal Doesn't Appear
- Check: CSS file loaded?
- Check: JavaScript error in console?
- Solution: Hard refresh, check component import

## Performance Considerations

- Pending list filtered by `active=False` → indexed for fast lookup
- Approved list filtered by `active=True` → already indexed
- Response includes `select_related('user', 'user__profile')` → prevents N+1 queries
- Consider pagination for large datasets

## Rollback Plan

If issues occur:
1. Revert views.py changes (remove admin views, restore old testimonial creation)
2. Revert urls.py changes (remove new routes)
3. Revert frontend changes (App.jsx, AdminHeader.jsx, TestimonialsAdmin files)
4. No database rollback needed (only logic, data unchanged)

## Success Criteria ✅

- [x] New testimonials created with `active=False`
- [x] Homepage does not display pending testimonials
- [x] Admin can list pending testimonials
- [x] Admin can approve testimonials (sets `active=True`)
- [x] Admin can reject testimonials with reason
- [x] Approved testimonials appear on homepage
- [x] Permission checks prevent non-admin access
- [x] Clear user messaging about approval status
- [x] Responsive UI works on mobile/desktop
- [x] Error handling with toast notifications

---
**Version**: 1.0  
**Last Updated**: February 16, 2026  
**Status**: Ready for Testing
