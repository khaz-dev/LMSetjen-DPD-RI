# CRITICAL ISSUE ANALYSIS & FIXES

## Issue #1: QUIZ POINTS - Highest Score Logic

### Current State
- Quiz attempts track highest score correctly via the max() function
- Points awarded when quiz is FIRST PASSED (score >= 70%)
- Problem: If student retakes and gets HIGHER score, points are NOT updated

### Example
- Student takes Quiz A: Gets 72%, earns 72 points
- Student retakes Quiz A: Gets 94%, currently earns NOTHING (already _points_awarded=True)
- Current total: 72 points
- Should be: 94 points

### Root Cause
The `_points_awarded` flag prevents re-award, but highest score logic is missing

### Solution
Update the points logic to:
1. Check if user has ANY passing attempt on a quiz
2. Calculate the maximum score from all attempts
3. Award points based on MAX score, not first
4. If user retakes and gets better score, UPDATE the StudentPoints


## Issue #2: TESTIMONIAL POINTS - Multi-Role Duplication

### Current State
- User khairilazmiashari has 2 platform testimonials (student + instructor role)
- NEITHER has AuditLog entry (points not awarded)
- User is getting 50 points total from course review (ID 8), NOT from testimonials

### Expected Behavior
- User should get points for FIRST testimonial (either student or instructor)
- Second testimonial (different role) should NOT award duplicate points
- OR: Only award points for one designated role (primary)

### Root Cause
- Platform testimonials (course__isnull=True) are not triggering point awards
- There's no logic to award points when a Review is activated/saved
- The _points_awarded flag is being set but the points are never actually awarded

### Solution
1. Create signal handler to award points when Review.active changes from False to True
2. Detect multi-role scenario and only award points once
3. Award points to StudentPoints (only), not InstructorPoints for testimonials


## Issue #3: Quiz Points Need Dynamic Update Logic

### The User's Request
"if user do another quiz attempt and got score better their point only updated"

This means:
- If highest score changes, StudentPoints should be recalculated/updated
- Not just award on first pass, but track the best attempt continuously

### Implementation Needed
When a quiz is submitted with a new highest score:
1. Check current highest score in AuditLog for this quiz
2. If new attempt has better score, UPDATE the PointsAuditLog entry
3. Update StudentPoints.lifetime_points accordingly

---

# IMPLEMENTATION PLAN

## Step 1: Fix Quiz Points to Use Highest Score

Location: backend/api/views.py - Where quiz submission is processed

Change from:
```python
if attempt.is_passed and not attempt._points_awarded:
    points = min(int(attempt.score), 100)
    StudentPoints.add_points(...)
```

To:
```python
# ✨ PHASE 10.7: Award points based on HIGHEST score, not just first pass
if attempt.is_passed:
    # Get all passing attempts for this user-quiz combo
    all_attempts = QuizAttempt.objects.filter(
        user=attempt.user,
        quiz=attempt.quiz,
        is_passed=True
    ).values_list('score', flat=True)
    
    if all_attempts:
        highest_score = max(float(s) for s in all_attempts)
        quiz_points = min(int(highest_score), 100)
        
        # Check if we have previous audit log for this
        previous_award = PointsAuditLog.objects.filter(
            user=attempt.user,
            quiz_id=attempt.quiz.id,
            activity_type='quiz_score'
        ).first()
        
        if previous_award:
            # Update existing award if new score is better
            if quiz_points > previous_award.points_awarded:
                # Adjust StudentPoints
                point_difference = quiz_points - previous_award.points_awarded
                student_points = StudentPoints.objects.get(user=attempt.user)
                student_points.lifetime_points += point_difference
                student_points.yearly_points += point_difference
                student_points.monthly_points += point_difference
                student_points.save()
                
                # Update audit log
                previous_award.points_awarded = quiz_points
                previous_award.description = f"Quiz score {quiz_points}% on: {attempt.quiz.title} [UPDATED]"
                previous_award.save()
                
                attempt._points_awarded = True
                attempt.save(update_fields=['_points_awarded'])
        else:
            # First passing attempt - award points
            StudentPoints.add_points(
                attempt.user,
                quiz_points,
                'quiz_score',
                quiz_id=attempt.quiz.id,
                course_id=attempt.quiz.course.id if attempt.quiz.course else None,
                description=f"Quiz score {quiz_points}% on: {attempt.quiz.title}"
            )
            attempt._points_awarded = True
            attempt.save(update_fields=['_points_awarded'])
```

## Step 2: Add Review Points Signal Handler

Location: backend/api/models.py - Add after Review class definition

```python
# ✨ PHASE 10.8: Award points when Review is activated
@receiver(post_save, sender=Review)
def award_review_points(sender, instance, created=False, **kwargs):
    """
    Award points when a Review becomes active.
    
    For platform testimonials (course__isnull=True):
    - Only award points once, even if user has multiple roles
    - Check if user already has points for any role
    - If not, award 50 points to StudentPoints
    
    For course reviews (course is set):
    - Award points only once per user-course combo
    """
    from django.db.models.signals import post_save
    from django.dispatch import receiver
    
    # Only process if review is being activated
    if not instance.active or not instance.user:
        return
    
    # Check if points already awarded for this review
    if instance._points_awarded:
        return
    
    # Platform Testimonial (no course)
    if instance.course is None:
        # For testimonials, only award points once per user
        # regardless of role (student/instructor)
        existing_points = PointsAuditLog.objects.filter(
            user=instance.user,
            activity_type='rating_given'  # Use same activity for testimonials
        ).exists()
        
        if not existing_points:
            # Award points only if user doesn't have points for any testimonial
            StudentPoints.add_points(
                instance.user,
                50,
                'rating_given',
                review_id=instance.id,
                description=f"Platform testimonial as {instance.role}: {instance.rating}* rating"
            )
            instance._points_awarded = True
            instance.save(update_fields=['_points_awarded'])
    else:
        # Course Review
        # Check if user already has points for reviewing this course
        existing_points = PointsAuditLog.objects.filter(
            user=instance.user,
            course_id=instance.course.id,
            activity_type='rating_given'
        ).exists()
        
        if not existing_points:
            # Only first review of a course earns points
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


# Connect the signal
post_save.connect(award_review_points, sender=Review)
```

## Step 3: Create Migration

Run:
```bash
python manage.py makemigrations  # If model fields changed
python manage.py migrate
```

## Step 4: Fix Existing Data

Run cleanup script:
```bash
python fix_testimony_testimonial_points.py
```

This script will:
1. Find all active reviews/testimonials with no AuditLog entry
2. Award points appropriately (once per user-role combo for testimonials)
3. Verify StudentPoints consistency


---

# TESTING

Test Quiz Updates:
```python
# Student scores 72%
attempt1 = QuizAttempt(..., score=72, is_passed=True)
attempt1.save()
# StudentPoints should have 72 points

# Student retakes and scores 94%
attempt2 = QuizAttempt(..., score=94, is_passed=True)
attempt2.save()  # This should trigger point update
# StudentPoints should now have 94 points (not 72+94=166)
```

Test Testimonials:
```python
# Create student testimonial
review1 = Review.objects.create(user=user, role='student', course=None, active=True)
# Should award 50 points

# Create instructor testimonial for same user
review2 = Review.objects.create(user=user, role='instructor', course=None, active=True)
# Should award 0 additional points (already has testimonial points)

# Total should be 50, not 100
```
