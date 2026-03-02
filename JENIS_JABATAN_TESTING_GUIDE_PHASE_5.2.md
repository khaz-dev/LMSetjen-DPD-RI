# Testing Guide: Jenis Jabatan & Golongan Database Sync (Phase 5.2)

## Quick Start Testing

### Prerequisites
- Backend running: `http://localhost:8001`
- Frontend running: `http://localhost:5174`
- Django admin accessible: `http://localhost:8001/admin/`
- Database populated with user data

---

## Test 1: Verify API Returns Database Values

### Goal
Confirm the API endpoint `/api/v1/employee/options/` now returns values from the database instead of hardcoded list.

### Steps

1. **Open Terminal** or **Postman** and hit the API:
   ```bash
   curl http://localhost:8001/api/v1/employee/options/
   ```

2. **Check Response** for `jenis_jabatan` field:
   ```json
   {
     "organizations": [...],
     "positions": [...],
     "golongan": ["I/a", "II/a", ...],
     "jenis_jabatan": [
       "Ahli",
       "Fungsional",
       "Koordinator",        ← NEW if exists in DB
       "Reguler",
       "Struktural"
     ]
   }
   ```

3. **Expected Result**: 
   - ✅ Values should match what's in Django admin User table
   - ✅ Values should be **alphabetically sorted**
   - ✅ Should be **NO duplicates**
   - ✅ Custom values (like "Koordinator") should appear if they exist in database

### Success Criteria
- [ ] Response contains jenis_jabatan array
- [ ] Array is sorted alphabetically
- [ ] No duplicate values
- [ ] Custom values appear (if any exist in database)
- [ ] No errors in response

---

## Test 2: Frontend Dropdown Display

### Goal
Verify that the dropdown on the student profile page shows the correct options from the database.

### Steps

1. **Navigate to**: `http://localhost:5174/student/profile/`

2. **Locate "Informasi Karyawan" section**:
   ```
   ┌─────────────────────────────────┐
   │  Informasi Karyawan             │
   │                                 │
   │  Jenis Jabatan:  [▼ Dropdown]   │ ← This one
   │  Golongan:       [▼ Dropdown]   │
   │  Organisasi:     [▼ Dropdown]   │
   └─────────────────────────────────┘
   ```

3. **Click "Jenis Jabatan" dropdown**

4. **Visual Inspection**:
   - ✅ All options are present
   - ✅ Options match the API response
   - ✅ Options are sorted alphabetically
   - ✅ No duplicate entries

5. **Check Pre-selected Value**:
   - If the current user has a jenis_jabatan value in database, it should be **pre-selected** in the dropdown
   - Example: If user has `jenis_jabatan = "Koordinator"`, the dropdown should show "Koordinator" as selected

### Success Criteria
- [ ] Dropdown opens without errors
- [ ] All database values are visible
- [ ] User's current value is pre-selected
- [ ] Options are alphabetically ordered
- [ ] Custom values appear (if applicable)

---

## Test 3: Multiple Users, Multiple Values

### Goal
Verify that the dropdown shows ALL unique jenis_jabatan values across all users.

### Steps

1. **In Django Admin** (`http://localhost:8001/admin/userauths/user/`):
   - Note down all different `jenis_jabatan` values you see

2. **Count distinct values**. Example:
   ```
   User 1: "Struktural"
   User 2: "Fungsional"
   User 3: "Koordinator"      ← Custom value
   User 4: "Struktural"       ← Duplicate (same user count)
   User 5: "Ahli"
   
   Distinct count: 4 unique values
   Expected array: ["Ahli", "Fungsional", "Koordinator", "Struktural"]
   ```

3. **API Check**:
   ```bash
   curl http://localhost:8001/api/v1/employee/options/ | grep -o '"jenis_jabatan":\[[^]]*\]'
   ```

4. **Verify**:
   - [ ] Array contains exactly those 4 values (or however many are in your DB)
   - [ ] No more, no less
   - [ ] All are sorted alphabetically
   - [ ] No duplicates

### Success Criteria
- [ ] Count matches distinct values in database
- [ ] No missing values
- [ ] No extra hardcoded values added

---

## Test 4: Empty Database Fallback

### Goal
Verify that the fallback mechanism works if the database has no jenis_jabatan data.

### Steps

1. **In Django Admin**, **temporarily** set all users' jenis_jabatan to NULL or empty:
   ```sql
   UPDATE userauths_user SET jenis_jabatan = NULL;
   ```
   *(Or do it through the admin UI for a few test users)*

2. **Hit API again**:
   ```bash
   curl http://localhost:8001/api/v1/employee/options/
   ```

3. **Check Response**:
   ```json
   {
     "jenis_jabatan": [
       "Ahli",
       "Fungsional",
       "Reguler",
       "Struktural"
     ]
   }
   ```
   This is the fallback list!

4. **Frontend Check**:
   - Visit profile page again
   - Dropdown should still load (no 500 error)
   - Should show fallback values

5. **Restore Data**:
   ```sql
   -- Restore from backup or re-sync via SSO
   ```

### Success Criteria
- [ ] API does NOT error when database is empty
- [ ] Returns fallback list instead
- [ ] Frontend still works (no 500 error)
- [ ] User experience not broken

---

## Test 5: User Value Selection Consistency

### Goal
Verify that when a user selects a value from dropdown, it's correctly saved and reflected.

### Steps

1. **Navigate to Profile**: `http://localhost:5174/student/profile/`

2. **Select a Jenis Jabatan value** from the dropdown:
   - Click dropdown
   - Select any option (e.g., "Fungsional")

3. **Check Save**:
   - System should auto-save (as per your implementation)
   - Watch for toast notification
   - Check DevTools Network tab for PUT/PATCH request

4. **Verify Database**:
   - Go to Django Admin
   - Find the user
   - Check `jenis_jabatan` field
   - Should show the selected value

5. **Reload Page**:
   - Go back to frontend profile page
   - Refresh browser (Ctrl+F5)
   - Check that dropdown still shows the previously selected value
   - Should be pre-selected

### Success Criteria
- [ ] Value saves without error
- [ ] Database updated correctly
- [ ] Value persists after page reload
- [ ] Dropdown shows correct pre-selected value

---

## Test 6: Compare Frontend vs Admin

### Goal
Verify that frontend dropdown options match admin view.

### Steps

1. **Side-by-Side Comparison**:

   **Left Side (Admin)**:
   - Open: `http://localhost:8001/admin/userauths/user/`
   - Scroll through users
   - List all unique jenis_jabatan values you see

   **Right Side (Frontend)**:
   - Open: `http://localhost:5174/student/profile/`
   - Click jenis_jabatan dropdown
   - List all unique values you see

2. **Manual Verification**:
   - Create checklist of values seen in admin
   - Verify each value appears in frontend dropdown
   - Example:
     ```
     ✅ "Ahli" - appears in both
     ✅ "Fungsional" - appears in both
     ✅ "Koordinator" - appears in both
     ✅ "Reguler" - appears in both
     ✅ "Struktural" - appears in both
     
     ✅ All match - Test PASSED
     ```

### Success Criteria
- [ ] All admin values appear in dropdown
- [ ] No extra values in dropdown
- [ ] Order and spelling match
- [ ] Special characters preserved (if any)

---

## Test 7: Debug Logging Output

### Goal
Verify that debug output shows how many values were loaded.

### Steps

1. **Check Backend Console**:
   - Look at the terminal where Django is running
   - When you visit profile page or API endpoint, check for:
     ```
     📊 Employee info options loaded from database:
        - Golongan: 5 unique values
        - Jenis Jabatan: 4 unique values
     ```

2. **Count Verification**:
   - Count matches the distinct values in your database? ✅
   - Shows both golongan and jenis_jabatan counts? ✅
   - Appears each time API is hit? ✅

### Success Criteria
- [ ] Debug message appears in console
- [ ] Counts are accurate
- [ ] Both fields are reported
- [ ] Format is readable

---

## Test 8: Same Test for Golongan Field

### Goal
Verify that Golongan field also loads from database (same fix applied).

### Steps

Repeat **Tests 1-7** but for the **Golongan** field instead of Jenis Jabatan.

Expected differences:
- Database likely has standard government golongan values (I/a, I/b, etc.)
- Golongan might have fewer variations than Jenis Jabatan
- Otherwise, testing logic is identical

### Success Criteria
- [ ] Golongan dropdown also shows database values
- [ ] Golongan API response includes actual values
- [ ] Pre-selection works for golongan
- [ ] Fallback works if database empty

---

## Troubleshooting

### Issue: Dropdown Still Shows Hardcoded Values

**Solution**:
1. Clear browser cache: `Ctrl+Shift+Delete`
2. Hard refresh frontend: `Ctrl+Shift+F5`
3. Restart Django backend: `python manage.py runserver`
4. Verify code change was applied: Check line 2164 in `backend/api/views.py`

### Issue: dropdown Lists Fewer Values Than Admin

**Possible Causes**:
1. Some users have `jenis_jabatan = NULL` or empty string
   - These are correctly filtered out
   - Check SQL: `SELECT DISTINCT jenis_jabatan FROM userauths_user WHERE jenis_jabatan IS NOT NULL AND jenis_jabatan != '';`

2. Recently added values not visible
   - Hard refresh: `Ctrl+Shift+F5`
   - Check API directly: `curl http://localhost:8001/api/v1/employee/options/`

### Issue: 500 Error When Visiting Profile

**Solution**:
1. Check Django logs for error
2. Verify User model imports in views.py
3. Verify database connection
4. Run migrations: `python manage.py migrate`

### Issue: Dropdown Shows Fallback, Not Database Values

**Diagnosis**:
```python
# This means no database values found
# Check:
User.objects.filter(jenis_jabatan__isnull=False).exclude(jenis_jabatan='').count()
# Should be > 0 if not in fallback mode
```

**Solutions**:
1. Add some test data via Django admin
2. Re-sync SSO data: `python manage.py sso_sync`
3. Verify database column exists: `python manage.py shell`
   ```python
   from userauths.models import User
   User.objects.values_list('jenis_jabatan', flat=True).distinct()
   ```

---

## Performance Notes

### Expected API Response Time
- **With <100 users**: < 50ms
- **With 100-1000 users**: < 100ms  
- **With >1000 users**: Consider adding caching (Phase 5.3)

### Database Query Complexity
Currently runs 2 distinct queries:
1. `SELECT DISTINCT jenis_jabatan FROM userauths_user ...`
2. `SELECT DISTINCT golongan FROM userauths_user ...`

If performance issues arise, implement caching:
```python
# Phase 5.3 suggestion
from django.core.cache import cache

def get_options():
    cache_key = 'employee_options'
    options = cache.get(cache_key)
    if not options:
        options = {...}  # Build from database
        cache.set(cache_key, options, 3600)  # Cache 1 hour
    return options
```

---

## Sign-Off Checklist

After completing all tests, check off:

- [ ] Test 1: API returns correct values ✅
- [ ] Test 2: Frontend dropdown displays correctly ✅
- [ ] Test 3: All unique values appear ✅
- [ ] Test 4: Fallback works ✅
- [ ] Test 5: Selection saves correctly ✅
- [ ] Test 6: Frontend matches admin ✅
- [ ] Test 7: Debug logging works ✅
- [ ] Test 8: Golongan field also works ✅
- [ ] No console errors ✅
- [ ] No server errors (500/400) ✅
- [ ] Performance acceptable ✅

**Status**: Ready for Production ✅

---

**Phase**: 5.2 - Database Sync Fix Testing  
**Date**: February 28, 2026  
**Estimated Test Time**: 30-45 minutes
