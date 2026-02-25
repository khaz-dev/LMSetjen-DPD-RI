# Instructor Profile Page - Implementation Roadmap

## QUICK REFERENCE - API ENDPOINTS AVAILABLE

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/api/v1/teacher/profile/{user_id}/` | GET | Get teacher profile info by user ID | Teacher object with image, bio, social links, etc |
| `/api/v1/teacher/summary/{teacher_id}/` | GET | Get teacher course & student counts | `{ total_courses, total_students }` |
| `/api/v1/teacher/course-lists/{teacher_id}/` | GET | Get all courses by teacher | Array of Course objects |
| `/api/v1/teacher/review-lists/{teacher_id}/` | GET | Get all reviews for teacher's courses | Array of Review objects |
| `/api/v1/course-detail/{slug}/` | GET | Get single course with full details | Course object (for filtering reviews by course) |

---

## IMPLEMENTATION STRATEGY

### Component Structure
```
InstructorProfilePage.jsx (Main Container)
├── Header/Navigation (baseheader + top bar)
├── Hero Section (Avatar, Name, Bio, Stats, Social)
├── About Section (Biography, Expertise, Social expansions)
├── Courses Section (Grid of published courses)
├── Reviews Section (Aggregated reviews)
└── Footer
```

### Data Flow
1. Extract `teacher_id` from URL params using `useParams()`
2. Fetch teacher data using `teacher_id`
3. Parallel fetch summary, courses, and reviews
4. Display skeleton while loading
5. Render full page once data arrives

---

## KEY IMPLEMENTATION DETAILS

### 1. Handling Teacher ID vs User ID

**IMPORTANT**: The backend API has two different ID types:
- **teacher_id**: The Teacher model's ID (what we get from course.teacher.id on frontend)
- **user_id**: The User model's ID (what teacher.user.id is)

**Current Implementation Issue**:
- CourseInstructor component passes `teacher.id` correctly
- But `GET /api/v1/teacher/profile/` expects `user_id`, not `teacher_id`

**Solution**: We need to handle both or create an endpoint that accepts teacher_id

**Option A** (Recommended): Create backend endpoint using teacher_id
```python
# backend/api/views.py
class TeacherProfileByTeacherIDAPIView(generics.RetrieveAPIView):
    serializer_class = api_serializer.BasicTeacherSerializer
    permission_classes = [AllowAny]
    
    def get_object(self):
        teacher_id = self.kwargs['teacher_id']
        return api_models.Teacher.objects.get(id=teacher_id)

# backend/api/urls.py
path("teacher/{teacher_id}/profile/", api_views.TeacherProfileByTeacherIDAPIView.as_view()),
```

**Option B**: Fetch using teacher_id directly to get teacher, then use teacher.user_id
```javascript
// Frontend - more API calls but works with current backend
const response = await useAxios.get(`/api/v1/teacher/course-lists/{teacher_id}/`);
// This returns courses which have teacher.user relationship we can use
```

---

## IMAGE HANDLING SPECIFICS

### Current Teacher.image Field
- Stores **Google Drive URLs** or full URLs
- Examples:
  - `https://drive.google.com/file/d/1DLjuRs2q9ZvbVHPu8ZyY5F3Xi4e_7gAG/view`
  - `https://example.com/static/images/profile.jpg`
  - Direct URLs already processable

### Solution: Use courseUtils.js

```javascript
import { getImageUrl } from "../../../utils/courseUtils";

// In component
const imageUrl = getImageUrl(teacher.image) || '/images/placeholders/default-instructor.svg';

// Usage
<img src={imageUrl} alt={teacher.full_name} onError={(e) => {
    e.target.src = '/images/placeholders/default-instructor.svg';
}} />
```

---

## FILE ORGANIZATION PLAN

### New Files to Create
1. **frontend/src/views/base/InstructorProfilePage.jsx** (Main component - ~400 lines)
2. **frontend/src/views/base/InstructorProfilePage.css** (Styling - ~600 lines)
3. **Optional - frontend/src/views/base/components/InstructorProfileLayout/** (Sub-components)
   - `InstructorProfileHeader.jsx` (~150 lines)
   - `InstructorAboutSection.jsx` (~150 lines)
   - `InstructorCoursesGrid.jsx` (~150 lines)
   - `InstructorReviewsSection.jsx` (~200 lines)

### Modified Files
1. **frontend/src/App.jsx** - Add new route

---

## STEP-BY-STEP IMPLEMENTATION PLAN

### STEP 1: Create Route in App.jsx

At first, we don't need to create a separate page - the route is missing. We need to:
1. Import the InstructorProfilePage component (lazy load it)
2. Add route for `/instructor-profile/{teacher_id}/`
3. Make it public (no PrivateRoute wrapper)

```javascript
// In App.jsx lazy imports section (around line 60-70)
const InstructorProfilePage = lazy(() => import("./views/base/InstructorProfilePage"));

// In Routes section (around line 210-225, in Base Routes)
<Route path="/instructor-profile/:teacher_id/" element={<InstructorProfilePage />} />
```

### STEP 2: Create Basic Component Structure

File: `frontend/src/views/base/InstructorProfilePage.jsx`

```javascript
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { SkeletonInstructorProfile } from "../../components/skeletons/InstructorSkeletons";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import useAxios from "../../utils/useAxios";
import { getImageUrl } from "../../utils/courseUtils";
import "./InstructorProfilePage.css";

function InstructorProfilePage() {
    const { teacher_id } = useParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [teacher, setTeacher] = useState(null);
    const [courses, setCourses] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        if (!teacher_id) return;
        
        const fetchData = async () => {
            try {
                setLoading(true);
                
                // Parallel API calls
                const [
                    coursesRes,
                    summaryRes,
                    reviewsRes
                ] = await Promise.all([
                    useAxios.get(`teacher/course-lists/${teacher_id}/`),
                    useAxios.get(`teacher/summary/${teacher_id}/`),
                    useAxios.get(`teacher/review-lists/${teacher_id}/`)
                ]);
                
                // Extract teacher info from first course if available
                if (coursesRes.data && coursesRes.data.length > 0) {
                    setTeacher(coursesRes.data[0].teacher);
                }
                
                setCourses(coursesRes.data || []);
                setStats(summaryRes.data?.[0] || {});
                setReviews(reviewsRes.data || []);
                
            } catch (err) {
                console.error("Error fetching instructor data:", err);
                setError("Failed to load instructor profile");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [teacher_id]);

    if (loading) {
        return (
            <>
                <BaseHeader />
                <section className="instructor-profile-page pt-5 pb-5">
                    <div className="container">
                        <SkeletonInstructorProfile />
                    </div>
                </section>
                <Footer />
            </>
        );
    }

    if (error || !teacher) {
        return (
            <>
                <BaseHeader />
                <section className="instructor-profile-page pt-5 pb-5">
                    <div className="container">
                        <div className="alert alert-danger">
                            {error || "Instructor not found"}
                        </div>
                    </div>
                </section>
                <Footer />
            </>
        );
    }

    return (
        <>
            <BaseHeader />
            
            <section className="instructor-profile-page pt-5 pb-5">
                <div className="container">
                    {/* Hero Section */}
                    <div className="instructor-profile-hero mb-5">
                        <div className="hero-content">
                            <img 
                                src={getImageUrl(teacher.image) || '/images/placeholders/default-instructor.svg'}
                                alt={teacher.full_name}
                                className="hero-avatar"
                                onError={(e) => {
                                    e.target.src = '/images/placeholders/default-instructor.svg';
                                }}
                            />
                            
                            <div className="hero-info">
                                <h1 className="instructor-name">{teacher.full_name}</h1>
                                <p className="instructor-bio">{teacher.bio}</p>
                                {teacher.country && (
                                    <p className="instructor-location">
                                        <i className="fas fa-map-marker-alt"></i> {teacher.country}
                                    </p>
                                )}
                                
                                {/* Stats */}
                                <div className="instructor-stats">
                                    <div className="stat">
                                        <span className="stat-value">{stats?.total_courses || 0}</span>
                                        <span className="stat-label">Kursus</span>
                                    </div>
                                    <div className="stat">
                                        <span className="stat-value">{stats?.total_students || 0}</span>
                                        <span className="stat-label">Siswa</span>
                                    </div>
                                </div>
                                
                                {/* Social Links */}
                                {(teacher.facebook || teacher.twitter || teacher.linkedin) && (
                                    <div className="instructor-social">
                                        {teacher.facebook && (
                                            <a href={teacher.facebook} target="_blank" rel="noopener noreferrer">
                                                <i className="fab fa-facebook"></i>
                                            </a>
                                        )}
                                        {teacher.twitter && (
                                            <a href={teacher.twitter} target="_blank" rel="noopener noreferrer">
                                                <i className="fab fa-twitter"></i>
                                            </a>
                                        )}
                                        {teacher.linkedin && (
                                            <a href={teacher.linkedin} target="_blank" rel="noopener noreferrer">
                                                <i className="fab fa-linkedin"></i>
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* About Section */}
                    {teacher.about && (
                        <div className="instructor-profile-about mb-5">
                            <h2 className="section-title">Tentang Instruktur</h2>
                            <p>{teacher.about}</p>
                        </div>
                    )}

                    {/* Courses Section */}
                    {courses.length > 0 && (
                        <div className="instructor-profile-courses mb-5">
                            <h2 className="section-title">Kursus Instruktur ({courses.length})</h2>
                            <div className="courses-grid">
                                {courses.map((course) => (
                                    <div key={course.id} className="course-card">
                                        <img 
                                            src={getImageUrl(course.image) || '/images/placeholders/default-course.svg'}
                                            alt={course.title}
                                            className="course-image"
                                        />
                                        <h3>{course.title}</h3>
                                        <p className="course-level">{course.level}</p>
                                        <div className="course-footer">
                                            <span className="rating">
                                                <i className="fas fa-star"></i> {course.average_rating || 0}
                                            </span>
                                            <a href={`/course-detail/${course.slug}/`} className="btn btn-sm btn-primary">
                                                Lihat Kursus
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Reviews Section */}
                    {reviews.length > 0 && (
                        <div className="instructor-profile-reviews">
                            <h2 className="section-title">Ulasan Siswa ({reviews.length})</h2>
                            <div className="reviews-list">
                                {reviews.slice(0, 5).map((review) => (
                                    <div key={review.id} className="review-card">
                                        <div className="review-header">
                                            <span className="reviewer-name">{review.user?.full_name}</span>
                                            <span className="review-rating">
                                                {'⭐'.repeat(review.rating)}
                                            </span>
                                        </div>
                                        <p className="review-text">{review.review}</p>
                                        <small className="review-course">{review.course?.title}</small>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </section>
            
            <Footer />
        </>
    );
}

export default React.memo(InstructorProfilePage);
```

### STEP 3: Create Styling

File: `frontend/src/views/base/InstructorProfilePage.css`

```css
/* ============================================
   INSTRUCTOR PROFILE PAGE
   ============================================ */

.instructor-profile-page {
    background: #f8f9fa;
    min-height: 100vh;
}

/* ============================================
   HERO SECTION
   ============================================ */

.instructor-profile-hero {
    background: white;
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.hero-content {
    display: flex;
    gap: 2rem;
    align-items: flex-start;
}

.hero-avatar {
    width: 200px;
    height: 200px;
    border-radius: 12px;
    object-fit: cover;
    border: 4px solid #667eea;
    flex-shrink: 0;
}

.hero-info {
    flex: 1;
}

.instructor-name {
    font-size: 2rem;
    font-weight: 700;
    color: #2c3e50;
    margin-bottom: 0.5rem;
    background: linear-gradient(135deg, #667eea, #764ba2);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.instructor-bio {
    font-size: 1.1rem;
    color: #6c757d;
    margin-bottom: 1rem;
}

.instructor-location {
    color: #667eea;
    font-size: 1rem;
    margin-bottom: 1.5rem;
}

.instructor-location i {
    margin-right: 0.5rem;
}

/* Stats */

.instructor-stats {
    display: flex;
    gap: 2rem;
    margin-bottom: 1.5rem;
}

.instructor-stats .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.instructor-stats .stat-value {
    font-size: 1.8rem;
    font-weight: 700;
    color: #667eea;
}

.instructor-stats .stat-label {
    font-size: 0.9rem;
    color: #6c757d;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

/* Social Links */

.instructor-social {
    display: flex;
    gap: 1rem;
}

.instructor-social a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: #f0f3ff;
    color: #667eea;
    text-decoration: none;
    transition: all 0.3s ease;
    font-size: 1.2rem;
}

.instructor-social a:hover {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

/* ============================================
   SECTIONS
   ============================================ */

.instructor-profile-about,
.instructor-profile-courses,
.instructor-profile-reviews {
    background: white;
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.section-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #2c3e50;
    margin-bottom: 1.5rem;
    border-bottom: 3px solid #667eea;
    padding-bottom: 1rem;
}

/* ============================================
   COURSES GRID
   ============================================ */

.courses-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1.5rem;
}

.course-card {
    border-radius: 12px;
    overflow: hidden;
    background: #f8f9fa;
    transition: all 0.3s ease;
    border: 1px solid #e9ecef;
}

.course-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.course-card .course-image {
    width: 100%;
    height: 150px;
    object-fit: cover;
}

.course-card h3 {
    font-size: 1rem;
    font-weight: 600;
    color: #2c3e50;
    padding: 1rem;
    margin: 0;
    min-height: 2.5rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.course-card .course-level {
    padding: 0 1rem;
    color: #667eea;
    font-size: 0.9rem;
    margin: 0;
}

.course-card .course-footer {
    padding: 1rem;
    border-top: 1px solid #e9ecef;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.course-card .rating {
    color: #f39c12;
    font-weight: 600;
}

/* ============================================
   REVIEWS
   ============================================ */

.reviews-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.review-card {
    border-left: 4px solid #667eea;
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 8px;
}

.review-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
}

.reviewer-name {
    font-weight: 600;
    color: #2c3e50;
}

.review-rating {
    font-size: 0.9rem;
}

.review-text {
    color: #6c757d;
    margin: 0.5rem 0;
    line-height: 1.5;
}

.review-course {
    color: #667eea;
    font-style: italic;
}

/* ============================================
   RESPONSIVE DESIGN
   ============================================ */

@media (max-width: 768px) {
    .hero-content {
        flex-direction: column;
        align-items: center;
        text-align: center;
    }

    .hero-avatar {
        width: 150px;
        height: 150px;
    }

    .instructor-name {
        font-size: 1.5rem;
    }

    .instructor-stats {
        justify-content: center;
    }

    .courses-grid {
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    }

    .instructor-profile-hero,
    .instructor-profile-about,
    .instructor-profile-courses,
    .instructor-profile-reviews {
        padding: 1.5rem;
    }
}

@media (max-width: 576px) {
    .instructor-profile-page {
        padding-top: 0 !important;
        padding-bottom: 0 !important;
    }

    .hero-avatar {
        width: 120px;
        height: 120px;
    }

    .instructor-name {
        font-size: 1.25rem;
    }

    .instructor-stats {
        gap: 1.5rem;
    }

    .instructor-stats .stat-value {
        font-size: 1.5rem;
    }

    .courses-grid {
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 1rem;
    }

    .instructor-social {
        justify-content: center;
    }
}
```

---

## POTENTIAL ENHANCEMENTS

### Future Features to Add
1. **Teacher Expertise Section** - Display skills with proficiency badges
2. **Pagination for Courses** - If teacher has many courses
3. **Course Filtering** - By level, category, rating
4. **Pagination for Reviews** - Show more reviews on demand
5. **Message Button** - When messaging feature is ready
6. **Enrollment Button** - Direct enrollment from profile
7. **Share Instructor Profile** - Social sharing buttons
8. **Related Teachers** - Recommend other instructors
9. **Analytics** - Views, clicks (instructor can see)
10. **Testimonials** - Separate testimonials section

### Performance Optimizations
1. Lazy load reviews (initially show 5, load more on scroll)
2. Lazy load courses (especially if teacher has 50+ courses)
3. Use image optimization library for thumbnail generation
4. Implement caching for teacher data
5. Debounce API calls on filter changes

### SEO Considerations
1. Use `Helmet` component to set dynamic meta tags
2. Set page title to instructor name
3. Add structured data (Schema.org) for instructor information
4. Generate sitemap entry for each instructor profile

---

## BACKEND CHANGES NEEDED

### Option: Create a unified endpoint (Optional Optimization)

If performance becomes an issue, create a single endpoint that returns all data:

```python
# backend/api/views.py
class TeacherPublicProfileAPIView(generics.GenericAPIView):
    """Get complete instructor profile for public view"""
    permission_classes = [AllowAny]
    
    def get(self, request, teacher_id):
        try:
            teacher = api_models.Teacher.objects.get(id=teacher_id)
            
            # Get all related data
            courses = api_models.Course.objects.filter(teacher=teacher)
            reviews = api_models.Review.objects.filter(course__teacher=teacher)
            students_count = api_models.EnrolledCourse.objects.filter(
                course__teacher=teacher
            ).values('user').distinct().count()
            
            return Response({
                'teacher': api_serializer.BasicTeacherSerializer(teacher).data,
                'courses': api_serializer.CourseSerializer(courses, many=True).data,
                'reviews': api_serializer.ReviewSerializer(reviews, many=True).data,
                'stats': {
                    'total_courses': courses.count(),
                    'total_students': students_count,
                    'average_rating': reviews.aggregate(
                        avg=Avg('rating')
                    )['avg'] or 0
                }
            })
        except api_models.Teacher.DoesNotExist:
            return Response({'error': 'Teacher not found'}, status=404)

# backend/api/urls.py
path("instructor/<teacher_id>/", api_views.TeacherPublicProfileAPIView.as_view()),
```

---

## TESTING CHECKLIST

- [ ] Test with instructor having 0 courses
- [ ] Test with instructor having no reviews
- [ ] Test with missing social media links
- [ ] Test with very long bio/about text
- [ ] Test image loading with invalid Google Drive URL
- [ ] Test responsive layout on mobile/tablet
- [ ] Test with large number of courses (20+)
- [ ] Test with large number of reviews (50+)
- [ ] Test accessibility (keyboard navigation, screen readers)
- [ ] Test performance with Network Throttling (Slow 3G)

---

## TIMELINE ESTIMATE

- **Basic Page Structure**: 30 minutes
- **Styling & Responsiveness**: 60 minutes
- **Sub-components**: 60 minutes (if breaking into parts)
- **Testing & Refinements**: 60 minutes
- **Total**: 2-3 hours for complete implementation

---

## FILE SIZE EXPECTATIONS

- InstructorProfilePage.jsx: ~400 lines
- InstructorProfilePage.css: ~700 lines
- Total new code: ~1100 lines
- Total bundle impact: ~20-30KB (minified + gzipped)
