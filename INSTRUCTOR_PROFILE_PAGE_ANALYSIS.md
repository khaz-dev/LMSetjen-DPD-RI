# Instructor Profile Page - Complete Analysis & Architecture

## 1. CURRENT STATE

### 1.1 Missing Component
There is **NO public instructor profile page** currently implemented at route `/instructor-profile/{teacher_id}/`. The button on course detail page navigates to this route but it doesn't exist yet, which is why nothing happens.

### 1.2 Existing Route Navigation
From [CourseInstructor.jsx](frontend/src/views/base/components/CourseInstructor.jsx#L23):
```jsx
navigate(`/instructor-profile/${teacher.id}/`);
```

This route needs to be created in `App.jsx`

### 1.3 Existing Internal Instructor Profile
- **Path**: `/instructor/profile/` (PRIVATE - For instructor editing their own profile)
- **Component**: [frontend/src/views/instructor/Profile.jsx](frontend/src/views/instructor/Profile.jsx)
- **Purpose**: Instructor account settings and profile management
- **Editable Fields**: 
  - Profile image/avatar
  - Full name
  - Bio (short)
  - Country
  - Professional biography (`about`)
  - Facebook URL
  - Twitter URL
  - LinkedIn URL

---

## 2. DATA MODEL - TEACHER FIELDS

### 2.1 Teacher Model Fields
From [backend/api/models.py](backend/api/models.py#L73-L82):
```python
class Teacher(models.Model):
    user = models.OneToOneField(User)
    image = models.URLField(max_length=500)              # Google Drive URL
    full_name = models.CharField(max_length=100)        # Source: User.full_name
    bio = models.CharField(max_length=100)              # Short biography/tagline
    facebook = models.URLField()                        # Social media
    twitter = models.URLField()                         # Social media
    linkedin = models.URLField()                        # Social media
    about = models.TextField()                          # Long professional biography
    country = models.CharField(max_length=100)          # Country location
```

### 2.2 Related Models
- **TeacherExpertise** - Skills and expertise areas with proficiency levels
- **Course** - All courses taught by this instructor
- **Review** - Student reviews and ratings of courses
- **EnrolledCourse** - Students enrolled in instructor's courses

---

## 3. BACKEND API ENDPOINTS FOR PUBLIC DISPLAY

### 3.1 Teacher Profile Endpoint
**Endpoint**: `GET /api/v1/teacher/profile/{user_id}/`
**Serializer**: `BasicTeacherSerializer`
**Returns**:
```python
{
    "id": 123,
    "image": "https://...",              # Full URL or Google Drive thumbnail
    "full_name": "Nama Instruktur",
    "bio": "Short tagline",
    "facebook": "https://facebook.com/...",
    "twitter": "https://twitter.com/...",
    "linkedin": "https://linkedin.com/...",
    "about": "Long professional biography...",
    "country": "Indonesia"
}
```

### 3.2 Teacher Summary Endpoint
**Endpoint**: `GET /api/v1/teacher/summary/{teacher_id}/`
**Returns**:
```python
[{
    "total_courses": 5,
    "total_students": 150
}]
```

### 3.3 Teacher Courses Endpoint
**Endpoint**: `GET /api/v1/teacher/course-lists/{teacher_id}/`
**Serializer**: `CourseSerializer`
**Returns**: Array of full course objects with all details

### 3.4 Teacher Reviews Endpoint
**Endpoint**: `GET /api/v1/teacher/review-lists/{teacher_id}/`
**Serializer**: `ReviewSerializer`
**Returns**: Array of reviews for all courses by this instructor

### 3.5 Teacher Expertise Endpoint
**Endpoint**: Not directly exposed (included in Teacher serializer)
**Data**: `teacher.expertise` - Array of skill objects with:
- `id`: Uniqueness identifier
- `skill`: Skill name
- `proficiency_level`: Beginner | Intermediate | Advanced | Expert
- `color_gradient`: CSS gradient for badge styling
- `text_color`: Text color for badge
- `border_color`: Border color for badge
- `order`: Ordering preference

---

## 4. FRONTEND COMPONENTS NEEDED

### 4.1 New Public Instructor Profile Page
**File**: `frontend/src/views/base/InstructorProfilePage.jsx`
**Route**: `/instructor-profile/{teacher_id}/`
**Access**: PUBLIC (no authentication required)

### 4.2 Child Components to Create
1. **InstructorProfileHeader** - Avatar, name, bio, location, stats
2. **InstructorAbout** - Full biography and expertise
3. **InstructorSocial** - Social media links with icons
4. **InstructorCoursesList** - Grid of courses taught by this instructor
5. **InstructorReviews** - Student reviews/ratings across all courses
6. **InstructorStats** - Total courses, total students, average rating

### 4.3 Styling File
**File**: `frontend/src/views/base/InstructorProfilePage.css`
Similar to existing instructor profile styling but for public view

---

## 5. COMPONENT DATA FLOW

```
App.jsx (Route: /instructor-profile/{teacher_id}/)
    ↓
InstructorProfilePage.jsx
    ├─→ useEffect: Extract teacher_id from URL params
    ├─→ Fetch: GET /api/v1/teacher/profile/{teacher_id}/
    ├─→ Fetch: GET /api/v1/teacher/summary/{teacher_id}/
    ├─→ Fetch: GET /api/v1/teacher/course-lists/{teacher_id}/
    ├─→ Fetch: GET /api/v1/teacher/review-lists/{teacher_id}/
    └─→ Render Structure:
        ├─ InstructorProfileHeader
        │   ├─ Avatar image with Google Drive handling
        │   ├─ Full name + bio
        │   ├─ Country location
        │   ├─ Social media icons
        │   └─ Quick stats (courses, students, rating)
        ├─ InstructorAbout
        │   ├─ Professional biography
        │   ├─ Expertise/Skills section
        │   └─ Social media links (expanded)
        ├─ InstructorCoursesList
        │   ├─ Grid of published courses
        │   ├─ Course cards with image, title, stats
        │   └─ Clickable to course-detail page
        └─ InstructorReviews
            ├─ Student testimonials
            ├─ Rating distribution
            └─ Paginated review list
```

---

## 6. KEY INFORMATION TO DISPLAY

### 6.1 Primary Section (Hero/Header)
- ✅ Instructor avatar/image (with fallback)
- ✅ Full name
- ✅ Short bio (tagline)
- ✅ Country/location
- ✅ Quick stats:
  - Number of courses
  - Total students
  - Average rating
- ✅ Social media icons (clickable links)

### 6.2 About Section
- ✅ Professional biography (long text)
- ✅ Expertise/skills with proficiency levels
- ✅ Social media links (expanded - text + icon)

### 6.3 Courses Section
- ✅ Grid of published courses taught by instructor
- ✅ For each course:
  - Course image
  - Course title
  - Rating + number of ratings
  - Student count
  - Link to course detail

### 6.4 Reviews Section
- ✅ Aggregated student reviews
- ✅ Star rating distribution
- ✅ Individual review cards with:
  - Student name/image
  - Course title
  - Rating
  - Review text
  - Date

### 6.5 Call-to-Action
- ✅ "Enroll in Courses" button
- ✅ "Message Instructor" button (future feature)
- ✅ "Social Media" links

---

## 7. DESIGN CONSIDERATIONS

### 7.1 Image Handling
- **Source**: Teacher.image (often Google Drive URLs)
- **Conversion**: Use `getImageUrl()` from courseUtils.js
- **Fallback**: Use `/images/placeholders/default-instructor.svg`
- **Error Handler**: Implement `onError` to fallback on failed loads
- **Size**: Hero image ~600x600px, thumbnails ~150x150px

### 7.2 Responsive Design
- **Desktop**: Two-column or full-width hero + grid layout
- **Tablet**: Single column, adjusted image sizes
- **Mobile**: Stacked layout, smaller images

### 7.3 Loading States
- Use existing `SkeletonInstructorProfile` from InstructorSkeletons.jsx
- Show skeleton while fetching data
- Handle error states gracefully

### 7.4 Consistency with Current UI
- Match styling from existing course-detail page
- Use same color scheme (primary: #667eea, secondary: #764ba2)
- Match typography and spacing
- Use Bootstrap 5 for layout

---

## 8. MISSING PIECES TO CREATE

### 8.1 Frontend
- [ ] New route `/instructor-profile/{teacher_id}/` in App.jsx
- [ ] `InstructorProfilePage.jsx` main component
- [ ] `InstructorProfilePage.css` styling
- [ ] Child components for each section (optional, can be inline)

### 8.2 Backend
- No additional endpoints needed - all reuse existing ones
- May want to create a dedicated endpoint like:
  - `GET /api/v1/instructor/{teacher_id}/full-profile/` 
  - That returns all data in one call (profile + summary + courses + reviews)
  - For performance optimization

### 8.3 Utilities
- Already have: `getImageUrl()` in courseUtils.js
- Already have: `useAxios` hook for API calls
- Already have: Toast and Swal for notifications

---

## 9. EXISTING INSTRUCTOR PROFILE REFERENCE

For styling and UX inspiration, reference:
- **File**: [frontend/src/views/instructor/Profile.jsx](frontend/src/views/instructor/Profile.jsx) (EDIT mode)
- **CSS**: [frontend/src/views/instructor/Profile.css](frontend/src/views/instructor/Profile.css)
- **Header**: [frontend/src/views/instructor/Partials/Header.jsx](frontend/src/views/instructor/Partials/Header.jsx)

This shows how instructor avatar, name, bio, country, social links are currently displayed (in editable form).

---

## 10. COURSE INSTRUCTOR COMPONENT REFERENCE

The CourseInstructor component on course detail page already shows a good preview:
- **File**: [frontend/src/views/base/components/CourseInstructor.jsx](frontend/src/views/base/components/CourseInstructor.jsx)
- Shows: Avatar, name, bio, stats, expertise
- Shows: Professional background section
- Reference design for the public profile page

---

## 11. IMPLEMENTATION CHECKLIST

### Phase 1: Route & Basic Structure
- [ ] Add route to App.jsx for `/instructor-profile/{teacher_id}/`
- [ ] Create InstructorProfilePage.jsx component
- [ ] Create InstructorProfilePage.css styling
- [ ] Implement basic layout with sections

### Phase 2: Data Fetching
- [ ] Set up useEffect to extract teacher_id from URL
- [ ] Fetch teacher profile data
- [ ] Fetch teacher summary (courses, students count)
- [ ] Fetch teacher courses list
- [ ] Fetch teacher reviews
- [ ] Handle loading and error states

### Phase 3: Header/Hero Section
- [ ] Display instructor avatar (with fallback)
- [ ] Display name, bio, location
- [ ] Display quick stats (courses, students, rating)
- [ ] Display social media icons with links

### Phase 4: About Section
- [ ] Display professional biography
- [ ] Display expertise/skills with badges
- [ ] Display social media links (text + clickable)

### Phase 5: Courses Section
- [ ] Display grid of published courses
- [ ] Create reusable course card component
- [ ] Add click handler to navigate to course detail

### Phase 6: Reviews Section
- [ ] Display aggregated reviews
- [ ] Show rating distribution
- [ ] Create review card component
- [ ] Implement pagination if needed

### Phase 7: Polish & Testing
- [ ] Test responsive design (mobile, tablet, desktop)
- [ ] Test image loading and fallbacks
- [ ] Test with different data scenarios
- [ ] Optimize loading performance
- [ ] Cross-browser testing

---

## 12. SKELETON LOADERS

Already available in codebase:
- **File**: [frontend/src/components/skeletons/InstructorSkeletons.jsx](frontend/src/components/skeletons/InstructorSkeletons.jsx)
- **Component**: `SkeletonInstructorProfile` - pre-built skeleton for profile
- Use this while data is loading

---

## 13. DATA FLOW EXAMPLE

### Request to get instructor profile with ID #123

```
1. URL: /instructor-profile/123/
2. Component mounts, extracts teacher_id=123

3. Parallel API Calls:
   GET /api/v1/teacher/profile/{user_id_of_teacher}/ → Teacher object
   GET /api/v1/teacher/summary/123/ → [{ total_courses, total_students }]
   GET /api/v1/teacher/course-lists/123/ → [ Course[], ... ]
   GET /api/v1/teacher/review-lists/123/ → [ Review[], ... ]

4. Response: All data loaded
5. Render: Full instructor profile page
```

---

## 14. STYLING STRATEGY

Use similar approach to existing components:
- **BEM naming convention**: `.instructor-profile-*`
- **CSS Variables**: Reuse existing color scheme
- **Bootstrap Grid**: Use row/col for layout
- **Flexbox**: For alignment and spacing
- **Mobile-first**: Media queries for responsive design

Example CSS structure:
```css
.instructor-profile-page { ... }
.instructor-profile-header { ... }
.instructor-profile-avatar { ... }
.instructor-profile-name { ... }
.instructor-profile-stats { ... }
.instructor-profile-about { ... }
.instructor-profile-expertise { ... }
.instructor-profile-expertise-badge { ... }
.instructor-profile-courses { ... }
.instructor-profile-reviews { ... }
```

---

## 15. IMPORTANT NOTES

1. **No Authentication Required**: This is a public page - anyone can view instructor profiles
2. **Image Handling**: Teacher.image field contains Google Drive URLs that need conversion
3. **URL Parameters**: Route uses `teacher_id`, not `user_id`
4. **Fallbacks**: Always have fallback content for missing data
5. **Performance**: Consider lazy-loading reviews if list is large
6. **Social Links**: May be empty for some instructors - should be optional
7. **Expertise**: May not be populated initially - backend supports this feature

---

## 16. RELATED FILES REFERENCE

### Frontend
- `app.jsx` - Need to add route
- `frontend/src/utils/courseUtils.js` - getImageUrl() function
- `frontend/src/utils/useAxios.js` - For API calls
- `frontend/src/components/skeletons/InstructorSkeletons.jsx` - SkeletonInstructorProfile
- `frontend/src/views/base/components/CourseInstructor.jsx` - Similar component reference
- `frontend/src/views/instructor/Profile.jsx` - Instructor edit profile reference

### Backend
- `backend/api/models.py` - Teacher, Course, Review models
- `backend/api/serializer.py` - BasicTeacherSerializer, CourseSerializer, ReviewSerializer
- `backend/api/views.py` - TeacherProfileAPIView, TeacherCourseListAPIView, etc.
- `backend/api/urls.py` - All teacher endpoints

---

## 17. NEXT STEPS

1. Create the InstructorProfilePage.jsx component
2. Add route to App.jsx
3. Implement all sections following the component structure
4. Test with various instructor profiles
5. Optimize images and loading performance
6. Deploy and get user feedback
