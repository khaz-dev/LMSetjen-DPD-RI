# PHASE 4.11: Multi-Role Testimonials - Quick Reference

## The Problem (Fixed)
Users with multiple roles (student + instructor) could only submit ONE testimonial. Now they can submit SEPARATE testimonials for each role.

## Key Implementation Details

### ✅ Backend Changes

**Model Changes (`api/models.py`):**
- Added `role` field to Review model with choices: 'student' or 'instructor'
- Default: 'student'
- Allows one testimonial per user per course per role

**API Changes (`api/views.py`):**
- `TestimonialCreateAPIView`: Accepts `role` parameter in request body
- `TestimonialDetailAPIView`: Accepts `role` query parameter (?role=student|instructor)
- `TestimonialListAPIView`: Filters by review.role field, NOT user boolean flags

**Database (`migrations/0033_add_review_role_field.py`):**
- Adds role field with default='student'
- Creates unique constraint on (user, course, role)
- Adds performance indexes

### ✅ Frontend Changes

**TestimonialSubmitForm Component:**
```jsx
<TestimonialSubmitForm 
  onSuccess={handleTestimonialSubmitSuccess} 
  role="student"  // or "instructor"
/>
```

**Usage in Pages:**
- Student page: `role="student"`
- Instructor page: `role="instructor"`

## API Endpoints

### Submit Testimonial
```
POST /api/v1/student/submit-testimonial/
Body: {
  "rating": 1-5,
  "review": "text...",
  "role": "student|instructor"
}
```

### Get Testimonial
```
GET /api/v1/student/testimonial/?role=student
GET /api/v1/student/testimonial/?role=instructor
```

### Delete Testimonial
```
DELETE /api/v1/student/testimonial/?role=student
DELETE /api/v1/student/testimonial/?role=instructor
```

### List Testimonials
```
GET /api/v1/statistics/testimonials/?role=student
GET /api/v1/statistics/testimonials/?role=instructor
```

## Multi-Role User Example

### User: John (both student and instructor)

**As Student** → `/student/testimonials/`
- Form shows: "Bagikan Testimoni Anda sebagai Siswa"
- Submits with role='student'
- Stored: `Review(user=john, role='student', review='...')`

**As Instructor** → `/instructor/testimonials/`
- Form shows: "Bagikan Testimoni Anda sebagai Instruktur"
- Submits with role='instructor'  
- Stored: `Review(user=john, role='instructor', review='...')`

**Result:** John has 2 separate testimonials, each in correct list

## Data Schema

```python
Review {
  id: 1,
  user_id: 123,
  course_id: null,        # null for general testimonials
  role: 'student',        # NEW!
  review: 'Great course!',
  rating: 5,
  active: true,
  date: '2024-02-15T10:30:00Z'
}

# Unique constraint: (user_id, course_id, role)
```

## Testing Quick Checklist

- [ ] Single-role user can submit testimonial
- [ ] Multi-role user can submit as student
- [ ] Multi-role user can submit as instructor (different content)
- [ ] Student list shows only role='student' testimonials
- [ ] Instructor list shows only role='instructor' testimonials
- [ ] Edit student testimonial doesn't affect instructor testimonial
- [ ] Delete instructor testimonial doesn't affect student testimonial

## Backward Compatibility

✅ **100% Backward Compatible**
- Existing testimonials default to role='student'
- Clients without role parameter use default
- Old API clients still work

## Files Changed

### Backend (3 files)
1. `api/models.py` - Added TESTIMONIAL_ROLES constant and role field
2. `api/serializer.py` - Updated ReviewSerializer
3. `api/views.py` - Updated 3 testimonial views

### Migrations (1 file)
1. `api/migrations/0033_add_review_role_field.py` - NEW

### Frontend (3 files)
1. `components/TestimonialSubmitForm.jsx` - Added role prop support
2. `views/student/Testimonials.jsx` - Pass role="student"
3. `views/instructor/Testimonials.jsx` - Pass role="instructor"

### Documentation
1. `MULTI_ROLE_TESTIMONIALS_IMPLEMENTATION.md` - Full implementation details

## How to Deploy

1. **Run Migration:**
   ```bash
   python manage.py migrate api
   ```

2. **Restart Services:**
   ```bash
   # Backend
   python manage.py runserver
   
   # Frontend
   npm run dev
   ```

3. **Test:** Follow checklist above

## Success Indicators

✅ Multi-role users can submit separate testimonials  
✅ Each testimonial appears in correct role section  
✅ Edit/delete works independently per role  
✅ Admin can see testimonials sorted by role  
✅ No errors in browser console  
✅ No errors in backend logs  

---

**Status:** ✅ Implementation Complete & Ready for Testing  
**Risk Level:** Low (feature additive, backward compatible)  
**Estimated Testing Time:** 15 minutes
