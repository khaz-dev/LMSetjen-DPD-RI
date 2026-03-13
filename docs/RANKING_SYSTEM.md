# 📊 LMSetjen Ranking System Documentation

**Version**: PHASE 10.1+ | **Updated**: March 5, 2026

## Overview

The ranking system automatically tracks student and instructor performance through points awarded for activities such as course completions, quiz scores, ratings, and course publications. Rankings are displayed on the homepage and updated in real-time via Django signals.

---

## 🎯 How Points Are Awarded

### **Student Points System**

Points are automatically awarded when:

| Event | Points | Trigger | Frequency |
|-------|--------|---------|-----------|
| **Course Completion** | 100 | Complete all course lessons | 1x per course |
| **Quiz Passed** | 0-100 | Pass a quiz (based on score %) | Per quiz |
| **Course Rating** | 50 | Submit a 5-star rating | 1x per course |
| **Total Potential** | **Up to 250+** | Per course | Varies |

**Example**: Student completing 3 courses with 80% quiz average and ratings:
- Course 1: 100 (completion) + 80 (quiz) + 50 (rating) = 230 points
- Course 2: 100 + 75 + 50 = 225 points  
- Course 3: 100 + 85 + 50 = 235 points
- **Total: 690 lifetime points**

### **Instructor Points System**

Points are automatically awarded when:

| Event | Points | Trigger | Frequency |
|-------|--------|---------|-----------|
| **Course Published** | 100 | Publish a new course | 1x per course |
| **Student Enrollment** | 10 | Student enrolls in course | Per enrollment |
| **Rating Received** | Variable | Student rates a course | Per rating |
| **Total Potential** | **Unlimited** | Per action | Varies |

**Example**: Instructor with 5 published courses and 50 enrollments:
- 5 courses × 100 = 500 points (publication)
- 50 enrollments × 10 = 500 points (enrollment)
- Ratings: ~25 students, ~50 points avg = 1,250 points
- **Total: 2,250+ lifetime points**

---

## 🔄 How Rankings Update (Automatic via Signals)

The system uses **Django Signals** to automatically update rankings whenever relevant database events occur:

```python
# When user completes a course:
EnrolledCourse.post_save signal  
  → Check if is_course_completed = True
  → Automatically call StudentPoints.add_points(user, 100, 'course_completion')
  → Points added to lifetime, yearly, and monthly buckets

# When instructor publishes a course:
Course.post_save signal
  → Check if is_published_version = True (and course was just saved)
  → Automatically call InstructorPoints.add_points(teacher.user, 100, 'course_published')

# When student takes a quiz:
QuizAttempt.post_save signal
  → Check if is_passed = True
  → Calculate points from score (0-100)
  → Automatically add points to StudentPoints
```

**No manual admin action needed** - Points are calculated and awarded instantly!

---

## 👁️ Viewing Rankings in Admin

### **Access the Admin Interface**

1. Navigate to: `http://localhost:8001/admin/`
2. Login with admin credentials
3. Look for these new sections:

#### **API > Student Points**
- View all students with their lifetime, yearly, and monthly points
- Sort by points (highest first = rank #1)
- Filter by year/month
- Search by student name or email

#### **API > Instructor Points**  
- View all instructors with their lifetime, yearly, and monthly points
- Sort by points (highest first = rank #1)
- Filter by year/month
- Search by instructor name or email

**Example Admin Display**:
```
Student Points
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name              | Lifetime | Yearly | Monthly | Year | Month
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Budi Santoso      | 690      | 245    | 85      | 2026 | 3
Ani Wijaya        | 540      | 340    | 120     | 2026 | 3
Rina Kusuma       | 430      | 180    | 45      | 2026 | 3
```

---

## 🛠️ Management Commands

### **Initialize/Update Rankings**

```bash
# Initialize StudentPoints and InstructorPoints for all users
python manage.py update_rankings

# Show detailed output
python manage.py update_rankings --verbose

# Recalculate all rankings from existing data (used after data fixes)
python manage.py update_rankings --recalculate
```

**Output Example**:
```
✨ Starting Ranking System Update...

StudentPoints: 45 created, 120 existing
InstructorPoints: 12 created, 8 existing

📊 Ranking Statistics:

  Students Ranked: 165
  Students with Points: 127
  Average Points: 234.5
  Total Points Awarded: 38,715

  Top Student: Budi Santoso (690 points)

  Instructors Ranked: 20
  Instructors with Points: 18
  Average Points: 1,245.3
  Total Points Awarded: 24,906

  Top Instructor: Dr. Agus Wijaya (2,150 points)

✅ Ranking system updated successfully!
```

---

## 📱 Frontend Display

### **Homepage Rankings (CTA Section)**

Located at: `http://localhost:5174/`

Shows:

**Siswa Terbaik (Top Students Widget)**
- Top 5 students by lifetime points
- Includes: Name, Position/Organization/Country, Points
- Period filter: Sepanjang Masa | Tahun Ini | Bulan Ini
- Rank badge: 🥇 🥈 🥉 #4 #5

**Instruktur Terbaik (Top Instructors Widget)**
- Top 5 instructors by lifetime points  
- Includes: Name, Position/Organization/Country, Point
- Same period filters
- Same rank badges

### **API Endpoints for Rankings**

```
GET /api/v1/rankings/students/lifetime/   - Top students (all time)
GET /api/v1/rankings/students/yearly/     - Top students (this year)
GET /api/v1/rankings/students/monthly/    - Top students (this month)

GET /api/v1/rankings/instructors/lifetime/ - Top instructors (all time)
GET /api/v1/rankings/instructors/yearly/   - Top instructors (this year)
GET /api/v1/rankings/instructors/monthly/  - Top instructors (this month)
```

**Response Format**:
```json
[
  {
    "id": 1,
    "user_id": 42,
    "full_name": "Budi Santoso",
    "image": "https://...",
    "position_name": "Kepala Divisi",
    "organization_unit_name": "Divisi Gakkum",
    "country": "Indonesia",
    "lifetime_points": 690,
    "yearly_points": 245,
    "monthly_points": 85,
    "rank": "🥇",
    "rank_position": 1
  },
  ...
]
```

---

## 🔍 Troubleshooting

### **Problem: Rankings not appearing**
**Solution**:
1. Verify StudentPoints/InstructorPoints records exist: `python manage.py update_rankings`
2. Check if students/instructors have completed activities (courses, quizzes, ratings)
3. Verify Django signals are running (check logs)

### **Problem: Specific student missing from rankings**
**Solution**:
1. Check if StudentPoints record exists in admin
2. Manually verify points calculation:
   - Count course completions: `EnrolledCourse.objects.filter(user=student, is_course_completed=True).count()`
   - Count quiz passes: `QuizAttempt.objects.filter(user=student, is_passed=True).count()`
   - Count ratings: `Review.objects.filter(user=student).count()`
3. Run: `python manage.py update_rankings --recalculate`

### **Problem: Points seem incorrect**
**Solution**:
1. Check if signals fired correctly
2. Review Django settings to ensure signals app is enabled
3. Recompute from scratch: `python manage.py update_rankings --recalculate`

### **Problem: Year/Month not resetting properly**
**Solution**:
- Monthly points reset when calendar month changes
- Yearly points reset on January 1st
- Run `update_rankings` after date changes to recalculate buckets

---

## 🔧 Technical Details

### **Models**

**StudentPoints** (`api.models.StudentPoints`)
```python
class StudentPoints(models.Model):
    user = OneToOneField(User)  # Unique per student
    
    # Lifetime (never resets)
    lifetime_points = IntegerField(default=0, db_index=True)
    
    # Yearly (resets Jan 1)
    yearly_points = IntegerField(default=0)
    yearly_year = IntegerField(default=current_year)
    
    # Monthly (resets 1st of month)
    monthly_points = IntegerField(default=0)
    monthly_year = IntegerField(default=current_year)
    monthly_month = IntegerField(default=current_month)  # 1-12
```

**InstructorPoints** (`api.models.InstructorPoints`)
- Same structure as StudentPoints
- Includes reference to Teacher model

### **Signals** (`api.signals.py`)

Four signal receivers:
1. `award_points_on_course_completion` - Awards when EnrolledCourse saved
2. `award_points_on_quiz_completion` - Awards when QuizAttempt saved  
3. `award_points_on_rating_given` - Awards when Review saved
4. `award_points_on_course_published` - Awards when Course published

### **Serializers** (`api.serializer.py`)

**RankedStudentSerializer** & **RankedInstructorSerializer**
- Include: `position_name`, `organization_unit_name`, `country` (for privacy)
- Exclude: Email (for privacy)
- Methods: `get_rank()`, `get_rank_position()` for badge calculation

### **Views** (`api.views.py`)

**RankingsStudentListAPIView** (lines ~10058-10180)
**RankingsInstructorListAPIView** (lines ~10196-10320)
- Three periods: lifetime, yearly, monthly
- Pagination: max 10 items per period
- Serializer: RankedStudentSerializer / RankedInstructorSerializer
- Permission: AllowAny (public API)

---

## 📈 Performance Notes

- Rankings query uses `order_by('-lifetime_points')[:10]` for efficiency
- StudentPoints/InstructorPoints indexed on `lifetime_points` for fast sorting
- Django signals trigger on save (minimal overhead)
- No scheduled tasks needed (real-time updates)
- API endpoints cached at 60s intervals (see `@cache_results` decorator)

---

## 🔐 Privacy Features

- **Email removed** from ranking displays (privacy protection)
- **Position/Organization/Country shown** instead for professional identification
- Rankings are public API (no authentication required)
- Student data in rankings limited to name, position, points

---

## 📞 Support

For issues or questions about the ranking system:
1. Check admin panel: `/admin/api/studentpoints/`
2. Run diagnostic: `python manage.py update_rankings --verbose`
3. Review logs: `backend/django.log` and `backend/django_error.log`
4. Check signals execution: Verify post_save receivers firing

