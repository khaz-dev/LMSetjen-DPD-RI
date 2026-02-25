# Instructor Profile Page - API Reference & Data Examples

## COMPLETE API RESPONSE EXAMPLES

### 1. Teacher Profile Endpoint
**URL**: `GET /api/v1/teacher/profile/{user_id}/`
**Purpose**: Get teacher's personal info and social links
**Serializer**: `BasicTeacherSerializer`

**Example Response**:
```json
{
    "id": 5,
    "image": "https://drive.google.com/thumbnail?id=1DLjuRs2q9ZvbVHPu8ZyY5F3Xi4e_7gAG&sz=w1200",
    "full_name": "Dr. Muhammad Ridho",
    "bio": "Transformational Leadership Expert",
    "facebook": "https://facebook.com/mridho",
    "twitter": "https://twitter.com/mridho",
    "linkedin": "https://linkedin.com/in/mridho",
    "about": "With over 15 years of experience in organizational development and leadership coaching, I help leaders transform their teams and organizations. Specialized in change management, strategic planning, and team dynamics.",
    "country": "Indonesia"
}
```

### 2. Teacher Summary Endpoint
**URL**: `GET /api/v1/teacher/summary/{teacher_id}/`
**Purpose**: Get count of courses and unique students
**Serializer**: `TeacherSummarySerializer`

**Example Response**:
```json
[
    {
        "total_courses": 12,
        "total_students": 3450
    }
]
```

### 3. Teacher Course List Endpoint
**URL**: `GET /api/v1/teacher/course-lists/{teacher_id}/`
**Purpose**: Get all courses by this teacher
**Serializer**: `CourseSerializer` (full course data)
**Pagination**: None (returns array directly)

**Example Response**:
```json
[
    {
        "id": 42,
        "category": 8,
        "teacher": {
            "id": 5,
            "image": "https://...",
            "full_name": "Dr. Muhammad Ridho",
            "bio": "Transformational Leadership Expert",
            "facebook": "https://facebook.com/mridho",
            "twitter": "https://twitter.com/mridho",
            "linkedin": "https://linkedin.com/in/mridho",
            "about": "With over 15 years of experience...",
            "country": "Indonesia"
        },
        "file": null,
        "image": "https://drive.google.com/thumbnail?id=...",
        "title": "Rabuan IV: Design Thinking - Kunci ASN Inovatif dan Birokrasi yang Lebih Adaptif",
        "description": "Comprehensive course on design thinking methodology for government employees...",
        "level": "Beginner",
        "platform_status": "Published",
        "teacher_course_status": "Published",
        "featured": true,
        "course_id": "design-thinking-101",
        "slug": "rabuan-iv-design-thinking-kunci-asn-inovatif-dan-birokrasi-yang-lebih-adaptif-1",
        "date": "2025-01-15T10:30:00Z",
        "students": [], // Array of enrolled student data (usually empty in list view)
        "curriculum": [], // Array of course curriculum/variants
        "lectures": [], // Array of lecture/content items
        "reviews": [ // See reviews endpoint below
            {
                "id": 234,
                "user": {...},
                "course": 42,
                "role": "student",
                "review": "Excellent course! Very informative.",
                "rating": 5,
                "reply": null,
                "active": true,
                "date": "2025-02-10T14:20:00Z"
            }
        ],
        "features": [...],
        "requirements": [...],
        "learning_outcomes": [...],
        "resources": [...],
        "qa_count": 45,
        "quizzes": 3,
        "average_rating": 4.7,
        "rating_count": 48,
        "intro_video_source": "youtube",
        "rejection_reason": null,
        "review_submitted_date": null
    },
    // ... more courses ...
]
```

### 4. Teacher Review List Endpoint
**URL**: `GET /api/v1/teacher/review-lists/{teacher_id}/`
**Purpose**: Get all reviews from students for this teacher's courses
**Serializer**: `ReviewSerializer`
**Pagination**: Standard pagination (20 items per page)

**Example Response**:
```json
{
    "count": 156,
    "next": "http://api/teacher/review-lists/5/?page=2",
    "previous": null,
    "results": [
        {
            "id": 234,
            "user": {
                "id": 123,
                "full_name": "Budi Santoso",
                "email": "budi@example.com",
                "golongan": "III/b",
                "jenis_jabatan": "Administrator",
                "image": "https://..." // or null
            },
            "course": {
                "id": 42,
                "title": "Rabuan IV: Design Thinking...",
                "course_id": "design-thinking-101"
            },
            "role": "student",
            "review": "Sangat berguna dan informatif! Instruktur menjelaskan dengan sangat baik.",
            "rating": 5,
            "reply": "Terima kasih atas feedback positifnya!",
            "active": true,
            "date": "2025-02-10T14:20:00Z"
        },
        {
            "id": 235,
            "user": {
                "id": 124,
                "full_name": "Siti Nurhaliza",
                "email": "siti@example.com",
                "golongan": "III/a",
                "jenis_jabatan": "Analyst",
                "image": null
            },
            "course": {
                "id": 42,
                "title": "Rabuan IV: Design Thinking...",
                "course_id": "design-thinking-101"
            },
            "role": "student",
            "review": "Konten bagus. Ingin ada lebih banyak studi kasus.",
            "rating": 4,
            "reply": null,
            "active": true,
            "date": "2025-02-09T10:15:00Z"
        }
    ]
}
```

---

## APPROACH OPTIONS FOR FRONTEND FETCHING

### Option A: Parallel Fetches (Recommended)
```javascript
// Most flexible, handles errors per endpoint
const [coursesRes, summaryRes, reviewsRes] = await Promise.all([
    useAxios.get(`teacher/course-lists/5/`),
    useAxios.get(`teacher/summary/5/`),
    useAxios.get(`teacher/review-lists/5/`)
]);
```

**Pros**:
- All requests happen simultaneously
- Can handle individual endpoint failures
- Most efficient network usage
- Can retry individual calls

**Cons**:
- Need to handle more error cases
- More complex code

### Option B: Sequential Fetches
```javascript
// Fetch one at a time
const coursesRes = await useAxios.get(`teacher/course-lists/5/`);
const courses = coursesRes.data;

// Extract teacher from first course
const teacher = courses[0]?.teacher;

// Then fetch rest
const [summaryRes, reviewsRes] = await Promise.all([
    useAxios.get(`teacher/summary/5/`),
    useAxios.get(`teacher/review-lists/5/`)
]);
```

**Pros**:
- Can extract teacher data from first course
- Simpler code logic
- Only make necessary calls

**Cons**:
- Slower (courses load second)
- Dependent on courses endpoint working

### Option C: Single Unified Endpoint (Backend Change)
Create one endpoint that returns everything:
```javascript
const res = await useAxios.get(`instructor/5/full-profile/`);
const { teacher, courses, reviews, stats } = res.data;
```

**Pros**:
- Single request (fastest)
- One error handler
- Backend can optimize

**Cons**:
- Requires backend change
- Returns all data even if only need some
- Larger response size

---

## DATA MAPPING & TRANSFORMATION

### Teacher Data Mapping
```javascript
// API Response → Component State
{
    id: teacher.id,
    image: getImageUrl(teacher.image),
    fullName: teacher.full_name,
    bio: teacher.bio,
    country: teacher.country,
    about: teacher.about,
    socialLinks: {
        facebook: teacher.facebook,
        twitter: teacher.twitter,
        linkedin: teacher.linkedin
    }
}
```

### Course Data Mapping
```javascript
// API Response → Course Card Component
{
    id: course.id,
    title: course.title,
    image: getImageUrl(course.image),
    slug: course.slug,
    level: course.level,
    rating: course.average_rating,
    ratingCount: course.rating_count,
    studentCount: course.students?.length || 0
}
```

### Review Data Mapping
```javascript
// API Response → Review Card Component
{
    id: review.id,
    authorName: review.user?.full_name,
    authorImage: review.user?.image,
    rating: review.rating,
    text: review.review,
    courseTitle: review.course?.title,
    date: review.date,
    reply: review.reply
}
```

---

## HANDLING MISSING DATA

### Teacher Fields - Fallbacks
```javascript
// Each field might be null/empty on backend

teacher.full_name      // Always exists (synced from User)
teacher.bio            // Empty string possible → show nothing
teacher.about          // Empty string possible → show nothing
teacher.image          // Empty or invalid URL → use default
teacher.country        // Empty string possible → hide section
teacher.facebook       // Null possible → hide link
teacher.twitter        // Null possible → hide link
teacher.linkedin       // Null possible → hide link
```

### Course Resource - Fallbacks
```javascript
course.image           // Use getImageUrl() + fallback
course.average_rating  // Null = 0
course.rating_count    // Null = 0
course.reviews         // Empty array = no reviews yet
course.Students        // Empty array (if included)
```

### Review Resource - Fallbacks
```javascript
review.user            // May have partial data
review.user.image      // Null = show default avatar
review.user.full_name  // Usually exists
review.reply           // Null = instructor hasn't replied
review.rating          // Always 1-5
```

---

## API EDGE CASES TO HANDLE

### 1. Teacher With No Courses
**API Response**: Empty array `[]`
**Frontend Handling**:
```javascript
if (courses.length === 0) {
    return <div>Instruktur belum memiliki kursus</div>
}
```

### 2. Teacher With No Reviews
**API Response**: Empty array or `{ count: 0, results: [] }`
**Frontend Handling**:
```javascript
if (reviews.length === 0) {
    return <div>Belum ada ulasan untuk instruktur ini</div>
}
```

### 3. Invalid Teacher ID
**API Response**: 404 Not Found
**Frontend Handling**:
```javascript
.catch(err => {
    if (err.response?.status === 404) {
        setError("Instruktur tidak ditemukan");
    }
})
```

### 4. Partial Data (Some Endpoints Fail)
**Frontend Handling**:
```javascript
const [coursesRes, summaryRes, reviewsRes] = await Promise.all([
    useAxios.get(...).catch(() => ({ data: [] })),
    useAxios.get(...).catch(() => ({ data: [{ total_courses: 0, total_students: 0 }] })),
    useAxios.get(...).catch(() => ({ data: { count: 0, results: [] } }))
]);

// At least some data will exist
```

---

## IMAGE URL HANDLING SPECIFICS

### Teacher.image Field Values
```javascript
// 1. Google Drive URL (needs conversion)
"https://drive.google.com/file/d/1DLjuRs2q9ZvbVHPu8ZyY5F3Xi4e_7gAG/view"
    → getImageUrl() converts to thumbnail endpoint
    → "https://drive.google.com/thumbnail?id=1DLjuRs2q9ZvbVHPu8ZyY5F3Xi4e_7gAG&sz=w1200"

// 2. Already converted Google Drive thumbnail
"https://drive.google.com/thumbnail?id=1DLjuRs2q9ZvbVHPu8ZyY5F3Xi4e_7gAG&sz=w1200"
    → getImageUrl() returns as-is
    → Works directly

// 3. Full external URL
"https://example.com/static/image.jpg"
    → getImageUrl() returns as-is
    → Works directly

// 4. Empty or malformed
"" or null or invalid_url
    → getImageUrl() checks and returns DEFAULT_IMAGE_URL
    → img tag onError handler provides fallback
```

### Implementation Example
```javascript
<img 
    src={getImageUrl(teacher.image) || '/images/placeholders/default-instructor.svg'}
    alt={teacher.full_name}
    onError={(e) => {
        e.target.src = '/images/placeholders/default-instructor.svg';
    }}
/>
```

---

## RESPONSE TIME EXPECTATIONS

### Per-Endpoint Timing
- **Teacher Profile**: ~50-100ms (single query)
- **Teacher Summary**: ~100-150ms (count query)
- **Teacher Courses**: ~200-500ms (depends on number of courses)
- **Teacher Reviews**: ~200-500ms (depends on number of reviews, includes pagination)
- **Total Parallel**: ~500-1000ms (dominated by largest response)

### Optimization Tips
1. Frontend: Show skeleton/loading state while fetching
2. Backend: Add database indexes on `teacher_id` and `course__teacher` fields
3. Frontend: Implement `useCallback` to prevent unnecessary re-renders
4. Frontend: Cache teacher profile data in localStorage
5. Backend: Add caching layer for teacher summary (changes rarely)

---

## NETWORK REQUEST WATERFALL

```
0ms  ──┬──────────────────────── GET /api/v1/teacher/course-lists/5/                (500ms)
       ├──────────────────────── GET /api/v1/teacher/summary/5/                      (100ms)
       └──────────────────────── GET /api/v1/teacher/review-lists/5/                 (400ms)
500ms ─┴──────────────────────── All requests complete, render page

Layout: [P]erfect sequencing for parallel loads
All three requests start simultaneously and complete around 500ms
(longest request determines total time)
```

---

## DEBUGGING CHECKLIST

When instructor profile doesn't load:

1. **Check URL params**:
   ```javascript
   const { teacher_id } = useParams();
   console.log("Teacher ID from URL:", teacher_id);
   ```

2. **Verify API calls**:
   ```javascript
   // In browser DevTools Network tab, check:
   GET /api/v1/teacher/course-lists/{teacher_id}/ → Status 200?
   GET /api/v1/teacher/summary/{teacher_id}/ → Status 200?
   GET /api/v1/teacher/review-lists/{teacher_id}/ → Status 200?
   ```

3. **Check response data**:
   ```javascript
   console.log("Courses:", courses);
   console.log("Stats:", stats);
   console.log("Reviews:", reviews);
   ```

4. **Verify image loading**:
   ```javascript
   console.log("Teacher image URL:", getImageUrl(teacher.image));
   // Check browser DevTools Network tab for image requests
   ```

5. **Test fallbacks**:
   ```javascript
   // Intentionally set wrong teacher_id to see error handling
   navigate("/instructor-profile/999999/");
   ```

---

## BACKEND ENDPOINT AVAILABILITY CHECK

To verify all endpoints are working, test these in quick sequence:

```bash
# 1. Get a known teacher ID (e.g., 5)
curl http://localhost:8001/api/v1/teacher/course-lists/5/

# 2. Check response has teacher object in first course
# 3. Extract teacher.user_id or teacher.id

# 4. Get teacher profile using user_id
curl http://localhost:8001/api/v1/teacher/profile/{user_id}/

# 5. Get summary
curl http://localhost:8001/api/v1/teacher/summary/5/

# 6. Get reviews
curl http://localhost:8001/api/v1/teacher/review-lists/5/
```

All should return 200 OK status with data.
