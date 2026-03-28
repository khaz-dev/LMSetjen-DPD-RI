# 🧪 Testing Guide: Hybrid Aktivitas Terbaru Fix

**Status**: Ready for Testing  
**Fix Applied**: March 28, 2026  
**System Check**: ✅ PASSED (0 issues)

---

## 📋 Pre-Test Checklist

- [ ] Backend running on `http://localhost:8001` (or your dev port)
- [ ] Frontend running on `http://localhost:5174`
- [ ] PostgreSQL database active
- [ ] Django migrations applied (at least through migration 0116)
- [ ] No uncommitted changes

---

## 🚀 Test Scenario 1: Create Course Activity

**Objective**: Verify that `course_created` activity is logged and displayed

### Steps:

1. **Login as Instructor**
   - Go to: `http://localhost:5174/login`
   - Use instructor account credentials
   - Verify you're logged in (check sidebar)

2. **Create a New Course**
   - Navigate to: Instructor Dashboard → Create Course (or similar)
   - Fill out course details:
     - Title: "Test Python Course"
     - Description: "Test course for hybrid aktivitas"
     - Category: Any category
     - Level: Beginner
   - Click: Create Course button

3. **Check Backend Logs** (Optional but helpful)
   - Monitor terminal running Django backend
   - Look for: `course_created` activity log entry
   - Should see signal handler executing without errors

4. **Navigate to Dashboard**
   - Go to: `http://localhost:5174/instructor/dashboard/`
   - Click: "Aktivitas Terbaru" section (or "Recent Activities")

5. **Verify Activity Appears**
   - ✅ Should see: "Buat Kursus: Test Python Course"
   - ✅ Badge: Purple "Mengajar" (Teaching) badge
   - ✅ Icon: Blue circle with plus icon
   - ✅ Time: "just now" or recent timestamp

**Expected Result**: 
```
✅ Activity displays with teaching badge
✅ Shows course title correctly
✅ Appears at top of activity list (most recent)
```

**If it doesn't work**:
```
❌ Still seeing same activities as before
   → API endpoint still filtering it out
   → Check: Did we reload the backend server?
   
❌ Getting console error
   → Check: Browser F12 console
   → Check: Backend error logs
```

---

## 🚀 Test Scenario 2: Test with Student Enrollment

**Objective**: Verify both student and instructor activities show together

### Steps:

1. **Have a Student Enroll**
   - Use another browser/window logged in as student
   - Go to: Instructor's published course
   - Click: "Enroll" button

2. **Back to Instructor Dashboard**
   - Refresh instructor dashboard (F5)
   - Check: Aktivitas Terbaru section

3. **Verify Hybrid Display**
   - ✅ Should see TWO activities now:
     - 1. "Publikasikan Kursus: Test Python Course" (purple Teaching badge)
     - 2. "Pendaftaran Kursus: [Student Name]" (green Enrollment badge)
   - ✅ Most recent first (chronological order)
   - ✅ Different visual distinction

**Expected Result**:
```
✅ Mixed student + instructor activities visible
✅ Ordered by date (newest first)
✅ Clear visual distinction (different badges/colors)
```

---

## 🚀 Test Scenario 3: API Endpoint Test (Advanced)

**Objective**: Verify API returns both activity types

### Using Curl/Postman:

```bash
# Get your JWT token (from browser storage or login endpoint)
TOKEN="your_jwt_token_here"

# Test endpoint
curl -X GET "http://localhost:8001/api/v1/instructor/activities/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

### Expected Response:

```json
{
    "count": 42,
    "results": [
        {
            "id": 1001,
            "activity_type": "course_published",
            "activity_type_display": "Publikasikan Kursus",
            "role_at_time": "instructor",  ← Instructor activity
            "user_name": "Ahmad Wijaya",
            "course_title": "Python for Beginners",
            "title": "Publikasikan Kursus: Python for Beginners",
            "success": true,
            "activity_date": "2026-03-28T14:30:00Z"
        },
        {
            "id": 1000,
            "activity_type": "enrollment",
            "activity_type_display": "Pendaftaran Kursus",
            "role_at_time": "student",  ← Student activity
            "user_name": "Siti Nurhaliza",
            "course_title": "Python for Beginners",
            "title": "Pendaftaran Kursus: Python for Beginners",
            "success": true,
            "activity_date": "2026-03-28T14:25:00Z"
        }
    ]
}
```

### Verify:
- ✅ `count` > 0
- ✅ Contains both `role_at_time: 'instructor'` and `role_at_time: 'student'`
- ✅ `activity_type_display` shows Indonesian labels
- ✅ `activity_date` fields present and parseable

---

## 🚀 Test Scenario 4: Filtering Test

**Objective**: Verify filters work for both activity types

### Steps:

1. **On Dashboard Aktivitas Terbaru**
   - Click: "Tampilkan Filter" (Show Filters) button
   - Should see two dropdowns:
     - "Tipe Aktivitas" (Activity Type)
     - "Status" (Success Status)

2. **Filter by Instructor Activity**
   - Activity Type: Select "Buat Kursus" (course_created)
   - Should see: Only course creation activities
   - Should hide: Student activities

3. **Filter by Student Activity**
   - Activity Type: Select "Pendaftaran" (enrollment)
   - Should see: Only enrollment activities
   - Should hide: Instructor teaching activities

4. **Clear Filters**
   - Click: "Bersihkan" (Clear) button
   - Should see: All activities again

**Expected Result**:
```
✅ Filter dropdown shows all 28 activity types
✅ Filtering works for both student and instructor types
✅ Clear filter button resets to all activities
```

---

## 🚀 Test Scenario 5: Add Lesson Activity

**Objective**: Verify course content activities are logged

### Steps:

1. **Edit Published Course**
   - Go to: Your published course
   - Click: "Edit" or manage curriculum

2. **Add New Lesson**
   - Add new lesson/variant with:
     - Title: "Introduction to Variables"
     - Description: "Learn about variables"

3. **Back to Dashboard**
   - Refresh dashboard
   - Check: Aktivitas Terbaru section

4. **Verify New Activity**
   - ✅ Should see: "Tambah Pelajaran: Introduction to Variables"
   - ✅ Badge: Purple "Mengajar"
   - ✅ Icon: File with plus icon

**Expected Result**:
```
✅ lesson_created activity appears
✅ Shows exact lesson title
✅ Displays with teaching badge
```

---

## 🚀 Test Scenario 6: API Filter by Role (Advanced)

**Objective**: Test optional role filtering

### Steps:

1. **Get only instructor activities**:
```bash
curl -X GET "http://localhost:8001/api/v1/instructor/activities/?role=instructor" \
  -H "Authorization: Bearer $TOKEN"
```

2. **Get only student activities**:
```bash
curl -X GET "http://localhost:8001/api/v1/instructor/activities/?role=student" \
  -H "Authorization: Bearer $TOKEN"
```

### Expected Results:
- First query: Only activities with `role_at_time: 'instructor'`
- Second query: Only activities with `role_at_time: 'student'`

---

## 🐛 Troubleshooting

### Symptom: Still seeing only student activities

**Check Points**:
1. Did you restart the Django backend server?
   ```bash
   # Kill old process and restart
   cd backend
   python manage.py runserver 8001
   ```

2. Is the fix applied correctly?
   ```bash
   # Verify the view has no .exclude(user=user)
   grep -A5 "get_queryset" backend/api/views.py | grep -i exclude
   # Should show: NO results (the exclude should be removed)
   ```

3. Are signals being triggered?
   ```bash
   # Check Django signals are imported in apps.py
   cd backend/api
   python -c "import signals; print('Signals loaded successfully')"
   ```

### Symptom: Activities show but without role_at_time field

**Fix**:
- Older activities might not have `role_at_time` set
- Signal handlers only ran AFTER the code was added
- Previous activities won't have role info
- Create new activities after the fix to test

### Symptom: Getting 403 Forbidden error

**Fix**:
- Verify instructor has `teacher` profile
- Check: Instructor is logged in properly
- Test with actual instructor account, not student

### Symptom: Filter dropdown doesn't show instructor activity types

**Fix**:
- Frontend component might be cached
- Hard refresh: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
- Clear browser cache
- Check: Component file was edited correctly

---

## ✅ Full Test Checklist

After completing all scenarios, verify:

- [ ] **Course Created Activity**
  - [ ] Shows in dashboard
  - [ ] Has purple "Mengajar" badge
  - [ ] Shows with correct course title

- [ ] **Hybrid Display**
  - [ ] Both student and instructor activities visible
  - [ ] Chronologically ordered (newest first)
  - [ ] Different visual distinction

- [ ] **Filtering**
  - [ ] All 28 activity types in dropdown
  - [ ] Can filter by individual types
  - [ ] Can clear filters

- [ ] **API Response**
  - [ ] Returns both `role_at_time: 'student'` and `role_at_time: 'instructor'`
  - [ ] Includes `activity_type_display` field
  - [ ] Includes `user_name` and `course_title`

- [ ] **Student Activities Still Work**
  - [ ] Student enrollments appear
  - [ ] Lesson completions recorded
  - [ ] Quiz attempts logged

- [ ] **No Errors**
  - [ ] No console errors in browser F12
  - [ ] No Django errors in terminal
  - [ ] No database errors

---

## 📊 Success Criteria

✅ **Fix is working if**:
1. Both student and instructor activities visible simultaneously
2. Instructor activities show with `role_at_time: 'instructor'`
3. Dashboard displays mixed activities chronologically
4. Filtering works for both types
5. No console or backend errors
6. System check still passes: `python manage.py check`

---

## 🔄 Roll-Back Plan (If Needed)

If the fix causes issues, revert with:

```bash
cd backend
git diff api/views.py  # See what changed
git checkout api/views.py  # Revert to previous version
python manage.py runserver  # Restart
```

---

## 📞 Debug Commands

If issues arise, run these for diagnostics:

```bash
# 1. Verify system health
cd backend
python manage.py check

# 2. Check database has activities
python manage.py shell
>>> from api.models import ActivityLog
>>> ActivityLog.objects.filter(role_at_time='instructor').count()
# Should return > 0 if instructor activities exist

# 3. Check signal handlers loaded
python -c "import api.signals; print('Signals OK')"

# 4. Test serializer
python manage.py shell
>>> from api.serializer import ActivityLogListSerializer
>>> from api.models import ActivityLog
>>> activity = ActivityLog.objects.first()
>>> serializer = ActivityLogListSerializer(activity)
>>> print(serializer.data)  # Should include activity_type_display
```

---

**Testing Started**: [Date]  
**Testing Completed**: [Date]  
**Status**: [Pass/Fail]  
**Notes**: [Add any additional observations]
