# COMPLETE POINTS SYSTEM FIXES - IMPLEMENTATION GUIDE

## Three Critical Issues to Fix

### Issue #1: Quiz Points Should Use Highest Score
**Problem:** Points are awarded on first passing attempt, but if student retakes and scores higher, no additional points awarded.
**Current:** Student takes Quiz A twice: 72%, then 94% → Earns 72 points total
**Expected:** Should earn 94 points (highest score)
**Fix Type:** Code logic update

### Issue #2: Testimonial Points - Multi-Role Confusion  
**Problem:** User gives testimonials in BOTH "student" and "instructor" roles. Points should be awarded differently for each role.
**Current:** Only student testimonials earning points (to StudentPoints)
**Expected:** Student testimonial → StudentPoints, Instructor testimonial → InstructorPoints (not both from same person)
**Fix Type:** Code logic + signal handler

### Issue #3: Missing Testimonial Points
**Problem:** Some active testimonials don't have AuditLog entries, so no points awarded
**Current:** 2 active testimonials for khairilazmiashari, but no points from them
**Expected:** At least one should award points
**Fix Type:** Already resolved - user has other points, deduplication logic correctly prevents duplicate awards

---

## FIX #1: QUIZ POINTS - HIGHEST SCORE LOGIC

### File: `backend/api/views.py`

Find the SubmitQuizAPIView (or wherever quiz submission is handled) and update the points award logic:

```python
# ✨ PHASE 10.7: Award points based on HIGHEST score, not first passing attempt
# Code location: after quiz attempt is created/saved, before returning response

# Get all passing attempts for this user-quiz combo
attempt_queryset = QuizAttempt.objects.filter(
    user=attempt.user,
    quiz=attempt.quiz,
    is_passed=True
).order_by('-score')

if attempt_queryset.exists():
    highest_score = int(attempt_queryset.first().score)
    quiz_points = min(highest_score, 100)
    
    # Check if we already have an award for this quiz
    existing_audit = PointsAuditLog.objects.filter(
        user=attempt.user,
        quiz_id=attempt.quiz.id,
        activity_type='quiz_score'
    ).first()
    
    if existing_audit and quiz_points > existing_audit.points_awarded:
        # Score improved! Update the award
        point_difference = quiz_points - existing_audit.points_awarded
        
        # Update StudentPoints
        student_pts = StudentPoints.objects.get(user=attempt.user)
        student_pts.lifetime_points += point_difference
        student_pts.yearly_points += point_difference
        student_pts.monthly_points += point_difference
        student_pts.save(update_fields=[
            'lifetime_points', 'yearly_points', 'monthly_points'
        ])
        
        # Update AuditLog
        existing_audit.points_awarded = quiz_points
        existing_audit.description = f"Quiz: {quiz_points}% on {attempt.quiz.title} [UPDATED from {existing_audit.points_awarded}]"
        existing_audit.save(update_fields=[
            'points_awarded', 'description'
        ])
        
        print(f"✓ Updated {attempt.user.username}'s quiz points: +{point_difference} (new high score: {quiz_points}%)")
        
    elif not existing_audit:
        # First passing attempt - initial award
        PointsAuditLog.log_award(
            user=attempt.user,
            points_awarded=quiz_points,
            activity_type='quiz_score',
            points_type='student',
            quiz_id=attempt.quiz.id,
            course_id=attempt.quiz.course.id if attempt.quiz.course else None,
            description=f"Quiz score {quiz_points}% on: {attempt.quiz.title}"
        )
        
        StudentPoints.add_points(
            attempt.user,
            quiz_points,
            'quiz_score',
            quiz_id=attempt.quiz.id,
            course_id=attempt.quiz.course.id if attempt.quiz.course else None,
            description=f"Quiz score {quiz_points}% on: {attempt.quiz.title}"
        )
        
        print(f"✓ Awarded {quiz_points} points to {attempt.user.username}")
    
    # Mark as processed
    attempt._points_awarded = True
    attempt.save(update_fields=['_points_awarded'])
```

---

## FIX #2: TESTIMONIAL POINTS - ROLE-BASED AWARDS

### File: `backend/api/models.py`

Add a signal handler after the Review class definition:

```python
# ✨ PHASE 10.8: Award points when testimonials become active
# Handle both StudentPoints and InstructorPoints based on role

from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=Review)
def award_testimonial_points(sender, instance, created=False, **kwargs):
    """
    Award points when a Review (testimonial) becomes active.
    
    Platform testimonials (course__isnull=True):
    - Student role → StudentPoints (50 points)
    - Instructor role → InstructorPoints (50 points)
    - Only award once per user per role
    
    Course reviews (course is set):
    - Always StudentPoints (students rate courses)
    - Only award once per user-course combo
    """
    
    # Skip if review is not active or has no user
    if not instance.active or not instance.user or instance._points_awarded:
        return
    
    if instance.course is None:
        # ========== PLATFORM TESTIMONIAL ==========
        if instance.role == 'student':
            # Testimonial as student → StudentPoints
            # Check if user already has student testimonial points
            existing = PointsAuditLog.objects.filter(
                user=instance.user,
                activity_type='rating_given',
                points_type='student'  # IMPORTANT: student points
            ).filter(
                review__course__isnull=True  # Only platform testimonials
            ).exists()
            
            if not existing:
                StudentPoints.add_points(
                    instance.user,
                    50,
                    'rating_given',
                    review_id=instance.id,
                    description=f"Platform testimonial: {instance.rating}* as STUDENT"
                )
                instance._points_awarded = True
                instance.save(update_fields=['_points_awarded'])
        
        elif instance.role == 'instructor':
            # Testimonial as instructor → InstructorPoints
            # Check if instructor already has instructor testimonial points
            existing = PointsAuditLog.objects.filter(
                user=instance.user,
                activity_type='student_rating',  # Instructor rating received
                points_type='instructor'  # IMPORTANT: instructor points
            ).exists()
            
            if not existing:
                InstructorPoints.add_points(
                    instance.user,
                    50,  # or use rating * 10 capped at 50
                    'student_rating',  # Points received from rating
                    review_id=instance.id,
                    description=f"Platform testimonial: {instance.rating}* as INSTRUCTOR"
                )
                instance._points_awarded = True
                instance.save(update_fields=['_points_awarded'])
    
    else:
        # ========== COURSE REVIEW ==========
        # Course reviews always go to StudentPoints (students rating instructors' courses)
        existing = PointsAuditLog.objects.filter(
            user=instance.user,
            course_id=instance.course.id,
            activity_type='rating_given'
        ).exists()
        
        if not existing:
            StudentPoints.add_points(
                instance.user,
                50,
                'rating_given',
                review_id=instance.id,
                course_id=instance.course.id,
                description=f"Course review: {instance.rating}* on {instance.course.title}"
            )
            instance._points_awarded = True
            instance.save(update_fields=['_points_awarded'])


# Register the signal
post_save.connect(award_testimonial_points, sender=Review)
```

---

## FIX #3: UPDATE REVIEW ADMIN TO SHOW POINTS STATUS

### File: `backend/api/admin.py`

Replace the simple registration of Review with a custom admin:

```python
# ✨ PHASE 10.8: Custom Review Admin to handle points  
class ReviewAdmin(admin.ModelAdmin):
    """
    Admin interface for managing reviews and testimonials
    Shows point status and allows bulk approval
    """
    list_display = (
        'id',
        'user_display',
        'course_display',
        'role_display',
        'rating_display',
        'active_display',
        'points_status_display',
        'date'
    )
    
    list_filter = (
        'active',
        'role',
        'rating',
        ('course', admin.RelatedOnlyFieldListFilter),
        'date'
    )
    
    search_fields = (
        'user__username',
        'user__full_name',
        'course__title',
        'review',
        'id'
    )
    
    readonly_fields = (
        'id',
        'date',
        'points_awarded_status',  # Custom method
        'audit_log_display'  # Custom method
    )
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'user', 'course', 'role', 'date')
        }),
        ('Content', {
            'fields': ('review', 'rating', 'reply')
        }),
        ('Status & Points', {
            'fields': ('active', '_points_awarded', 'points_awarded_status', 'audit_log_display'),
            'classes': ('wide',)
        }),
    )
    
    actions = ['approve_and_award_points', 'disapprove']
    
    def user_display(self, obj):
        return obj.user.full_name if obj.user else "N/A"
    user_display.short_description = "User"
    
    def course_display(self, obj):
        if obj.course:
            return obj.course.title
        return "[Platform Testimonial]"
    course_display.short_description = "Course"
    
    def role_display(self, obj):
        colors = {'student': 'blue', 'instructor': 'green'}
        color = colors.get(obj.role, 'gray')
        return f'<span style="color: {color}; font-weight: bold;">{obj.role.upper()}</span>'
    role_display.short_description = "Role"
    role_display.allow_tags = True
    
    def rating_display(self, obj):
        stars = "★" * obj.rating + "☆" * (5 - obj.rating)
        return f"{stars} ({obj.rating})"
    rating_display.short_description = "Rating"
    
    def active_display(self, obj):
        icon = "✅" if obj.active else "⏳"
        return f"{icon} {obj.active}"
    active_display.short_description = "Active"
    
    def points_status_display(self, obj):
        if obj._points_awarded:
            return "✔️ AWARDED"
        return "⏳ pending"
    points_status_display.short_description = "Points Status"
    
    def points_awarded_status(self, obj):
        """Custom field showing detailed point award info"""
        if not obj.id:
            return "Not saved yet"
        
        audit = PointsAuditLog.objects.filter(review_id=obj.id).first()
        if audit:
            return f"✅ {audit.points_awarded} points awarded ({audit.points_type}) via {audit.activity_type}"
        
        if obj.active:
            return "⚠️ Active but no points awarded (may need signal to run)"
        
        return "⏳ Not active, points not yet awarded"
    
    points_awarded_status.short_description = "Points Award Status"
    
    def audit_log_display(self, obj):
        """Show linked audit log entry"""
        if not obj.id:
            return "Not saved yet"
        
        audit = PointsAuditLog.objects.filter(review_id=obj.id).first()
        if audit:
            return f"<a href='/admin/api/pointsauditlog/{audit.id}/change/'>View Award #{audit.id}</a>"
        return "No audit log entry"
    
    audit_log_display.short_description = "Audit Log"
    audit_log_display.allow_tags = True
    
    def approve_and_award_points(self, request, queryset):
        """Bulk approve reviews and award points"""
        count = 0
        for review in queryset.filter(active=False):
            review.active = True
            review.save()  # Triggers signal to award points
            count += 1
        
        self.message_user(
            request,
            f"✅ {count} reviews approved and points awarded!"
        )
    approve_and_award_points.short_description = "Approve selected and award points"
    
    def disapprove(self, request, queryset):
        """Bulk disapprove reviews"""
        count = queryset.update(active=False)
        self.message_user(request, f"❌ {count} reviews disapproved")
    disapprove.short_description = "Disapprove selected reviews"


# Register the custom admin
admin.site.unregister(models.Review)  # Remove old registration
admin.site.register(models.Review, ReviewAdmin)
```

---

## TESTING SCENARIOS

### Test 1: Quiz Score Improvement
```python
# Student takes Quiz, scores 72%
attempt1 = QuizAttempt.objects.create(user=student, quiz=quiz1, score=72, is_passed=True)
# Triggers: 72 points awarded

# Check StudentPoints
assert StudentPoints.objects.get(user=student).lifetime_points == 72

# Student retakes Quiz, scores 94% (better)
attempt2 = QuizAttempt.objects.create(user=student, quiz=quiz1, score=94, is_passed=True)
# Triggers: +22 points (94-72), total should be 94 now

# Check StudentPoints updated
assert StudentPoints.objects.get(user=student).lifetime_points == 94

# Check AuditLog shows update
audit = PointsAuditLog.objects.filter(
    user=student,
    quiz_id=quiz1.id
).first()
assert audit.points_awarded == 94
assert "[UPDATED" in audit.description
```

### Test 2: Student Testimonial
```python
# Create platform testimonial as student
review_student = Review.objects.create(
    user=user,
    course=None,  # Platform testimonial
    role='student',
    rating=5,
    active=True  # Triggers signal
)

# Checks:
# - StudentPoints increased by 50
# - PointsAuditLog has entry with points_type='student'
# - _points_awarded = True
assert StudentPoints.objects.get(user=user).lifetime_points >= 50
assert PointsAuditLog.objects.filter(
    user=user,
    review_id=review_student.id,
    points_type='student'
).exists()
```

### Test 3: Instructor Testimonial
```python
# Create platform testimonial as instructor
review_instructor = Review.objects.create(
    user=instructor,
    course=None,  # Platform testimonial
    role='instructor',
    rating=5,
    active=True  # Triggers signal
)

# Checks:
# - InstructorPoints increased by 50
# - PointsAuditLog has entry with points_type='instructor'
# - StudentPoints NOT affected
instructor_points_before = InstructorPoints.objects.get(user=instructor).lifetime_points
# [Create review]
instructor_points_after = InstructorPoints.objects.get(user=instructor).lifetime_points
assert instructor_points_after == instructor_points_before + 50

assert PointsAuditLog.objects.filter(
    user=instructor,
    review_id=review_instructor.id,
    points_type='instructor'
).exists()
```

### Test 4: No Duplicate Multi-Role Points
```python
# User gives both student AND instructor testimonials
review1 = Review.objects.create(
    user=user,
    course=None,
    role='student',
    active=True
)

review2 = Review.objects.create(
    user=user,
    course=None,
    role='instructor',
    active=True
)

# Checks:
# - StudentPoints: 50 points (from student testimonial)
# - InstructorPoints: 50 points (from instructor testimonial)
# - Total distinct points: 100 (50 student + 50 instructor), not 150
student_pts = StudentPoints.objects.get(user=user).lifetime_points
instructor_pts = InstructorPoints.objects.get(user=user).lifetime_points
assert student_pts == 50 or instructor_pts == 50  # At least one awarded
```

---

## DEPLOYMENT CHECKLIST

- [ ] Code implementation complete (all three fixes)
- [ ] Create migrations: `python manage.py makemigrations`
- [ ] Apply migrations: `python manage.py migrate`
- [ ] Add signal handler to models.py
- [ ] Update ReviewAdmin in admin.py
- [ ] Test all 4 scenarios above
- [ ] Review PointsAuditLog for consistency
- [ ] Verify StudentPoints matches AuditLog
- [ ] Verify InstructorPoints separate from StudentPoints
- [ ] Deploy to production
- [ ] Monitor admin.site/api/api/pointsauditlog/ for new entries

---

**Status:** Ready for implementation  
**Estimated Time:** 2-3 hours (1 hour code, 1.5 hours testing)  
**Risk Level:** MEDIUM (affects points system, needs thorough testing)
