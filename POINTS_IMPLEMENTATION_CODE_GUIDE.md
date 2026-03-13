# Points Deduplication - Code Implementation Guide

This document provides the exact code changes needed to prevent duplicate point awards in the quiz and review systems.

## 1. Model Changes (backend/api/models.py)

### QuizAttempt Model Modification

**Location:** Find the `QuizAttempt` model class

**Add this field after line with `is_passed = models.BooleanField(default=False)`:**

```python
    is_passed = models.BooleanField(default=False)
    
    # ✨ PHASE 10.5: Deduplication flag - prevents re-awarding points
    _points_awarded = models.BooleanField(
        default=False, 
        db_index=True,
        help_text="Tracks whether points have already been awarded for this attempt"
    )
```

**Also add to Meta class indexes:**

```python
    class Meta:
        indexes = [
            # ... existing indexes ...
            models.Index(fields=['_points_awarded']),
            models.Index(fields=['user', 'quiz', '_points_awarded']),
        ]
```

### Review Model Modification

**Location:** Find the `Review` model class

**Add this field after line with `active = models.BooleanField(default=True)`:**

```python
    active = models.BooleanField(default=True)
    
    # ✨ PHASE 10.6: Deduplication flag - prevents re-awarding points
    _points_awarded = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Tracks whether points have already been awarded for this review"
    )
```

**Also add to Meta class indexes:**

```python
    class Meta:
        indexes = [
            # ... existing indexes ...
            models.Index(fields=['_points_awarded']),
            models.Index(fields=['user', 'course', '_points_awarded']),
        ]
```

## 2. Quiz Points Award Logic Update

### Location: backend/api/views.py - SubmitQuizAPIView

**Find the section where points are awarded after quiz submission**

**Old Code (vulnerable):**
```python
# Award points for passing quiz
if attempt.is_passed:
    points = min(int(attempt.score), 100)
    StudentPoints.add_points(attempt.user, points, 'quiz_score', ...)
```

**New Code (protected):**
```python
# ✨ PHASE 10.5: Deduplicated quiz scoring - prevent multiple awards
if attempt.is_passed and not attempt._points_awarded:
    # Only award points once, even if student retakes the quiz
    quiz_score_points = min(int(attempt.score), 100)
    
    if quiz_score_points > 0:
        StudentPoints.add_points(
            attempt.user,
            quiz_score_points,
            'quiz_score',
            quiz_id=attempt.quiz.id,
            course_id=attempt.quiz.course.id if attempt.quiz.course else None,
            description=f"Quiz score {quiz_score_points}% on: {attempt.quiz.title}"
        )
    
    # Mark as awarded to prevent future re-award even if attempt is modified
    attempt._points_awarded = True
    attempt.save(update_fields=['_points_awarded'])
```

### Placement in Code

Look for where quiz submission is processed (likely in `SubmitQuizAPIView.create()` or similar):

```python
class SubmitQuizAPIView(generics.CreateAPIView):
    # ...
    def perform_create(self, serializer):
        attempt = serializer.save()
        
        # [Existing validation logic...]
        
        # ✨ PHASE 10.5: Award points with deduplication
        if attempt.is_passed and not attempt._points_awarded:
            quiz_score_points = min(int(attempt.score), 100)
            if quiz_score_points > 0:
                StudentPoints.add_points(
                    attempt.user,
                    quiz_score_points,
                    'quiz_score',
                    quiz_id=attempt.quiz.id,
                    course_id=attempt.quiz.course.id if attempt.quiz.course else None,
                    description=f"Quiz score {quiz_score_points}% on: {attempt.quiz.title}"
                )
                attempt._points_awarded = True
                attempt.save(update_fields=['_points_awarded'])
```

## 3. Review Points Award Logic Update

### Location: backend/api/views.py - ReviewCreateAPIView or similar

**Find the section where review is created and points might be awarded**

**Key Logic Change:**
```python
# ✨ PHASE 10.6: Deduplicated review points
# Check if this is the first active review from this user on this course
if review.active and review.role == 'student' and not review._points_awarded:
    # Query existing reviews from same user on same course
    existing_reviews = Review.objects.filter(
        user=review.user,
        course=review.course,
        active=True
    ).exclude(id=review.id)  # Exclude current review from check
    
    # Only award points if NO other active review from this user on this course
    if not existing_reviews.exists():
        StudentPoints.add_points(
            review.user,
            50,
            'rating_given',
            review_id=review.id,
            course_id=review.course.id if review.course else None,
            description=f"Gave {review.rating}* rating on: {review.course.title if review.course else 'Course'}"
        )
        review._points_awarded = True
        review.save(update_fields=['_points_awarded'])
```

### Placement Examples

**If using perform_create method:**
```python
class ReviewCreateAPIView(generics.CreateAPIView):
    # ...
    def perform_create(self, serializer):
        review = serializer.save()
        
        # ✨ PHASE 10.6: Award points with user-course deduplication
        if review.active and review.role == 'student' and not review._points_awarded:
            existing = Review.objects.filter(
                user=review.user,
                course=review.course,
                active=True
            ).exclude(id=review.id)
            
            if not existing.exists():
                StudentPoints.add_points(
                    review.user, 50, 'rating_given',
                    review_id=review.id,
                    course_id=review.course.id,
                    description=f"Review: {review.rating}* on {review.course.title}"
                )
                review._points_awarded = True
                review.save(update_fields=['_points_awarded'])
```

**If doing inline in create method:**
```python
def create(self, request, *args, **kwargs):
    # ... serialization logic ...
    
    review = serializer.save(user=request.user)  # or similar
    
    # ✨ PHASE 10.6: Award points
    if review.active and not review._points_awarded:
        # ... check for existing reviews as shown above ...
        if not existing.exists():
            StudentPoints.add_points(...)
            review._points_awarded = True
            review.save(update_fields=['_points_awarded'])
    
    return Response(ReviewSerializer(review).data)
```

## 4. Migration File (Auto-Generated)

After making model changes, run:

```bash
python manage.py makemigrations
```

This creates a migration file (e.g., `0XXX_add_points_awarded_flags.py`) with:

```python
# Generated migration will include:
# - AddField for QuizAttempt._points_awarded
# - AddField for Review._points_awarded
# - AddIndex for performance
```

Then apply:

```bash
python manage.py migrate
```

## 5. Data Cleanup Scripts

Run the provided cleanup scripts to fix existing data:

```bash
# Step 1: Clean duplicate audit logs and recalculate StudentPoints
python fix_duplicate_points.py

# Step 2: Align StudentPoints with PointsAuditLog
python final_fix_points.py

# Step 3: Set deduplication flags on all existing records
python set_dedup_flags.py
```

## 6. Testing the Implementation

### Test Case 1: Quiz Duplicate Prevention

```python
# Create a quiz attempt
attempt1 = QuizAttempt.objects.create(
    user=student,
    quiz=quiz,
    score=72,
    is_passed=True
)

# First submission awards points
assert attempt1._points_awarded == True  # Set by code
points_after_1 = StudentPoints.objects.get(user=student).lifetime_points

# Student retakes quiz with higher score
attempt2 = QuizAttempt.objects.create(
    user=student,
    quiz=quiz,
    score=94,
    is_passed=True
)

# Second submission does NOT award new points
assert attempt2._points_awarded == True
points_after_2 = StudentPoints.objects.get(user=student).lifetime_points

# Points should only be from first attempt (72 points) not cumulative
assert points_after_2 == points_after_1 + 0  # No additional points!
```

### Test Case 2: Review Duplicate Prevention

```python
# Create first review
review1 = Review.objects.create(
    user=student,
    course=course,
    rating=4,
    active=True,
    role='student'
)

# First review awards points
assert review1._points_awarded == True
points_after_1 = StudentPoints.objects.get(user=student).lifetime_points

# Student rates same course again
review2 = Review.objects.create(
    user=student,
    course=course,
    rating=5,
    active=True,
    role='student'
)

# Second review does NOT award new points
assert review2._points_awarded == False  # Not awarded
points_after_2 = StudentPoints.objects.get(user=student).lifetime_points

# Points should not increase
assert points_after_2 == points_after_1  # Same as before!
```

## Verification Commands

After implementation, verify the system:

```bash
# Check StudentPoints consistency
python manage.py shell
>>> from api.models import StudentPoints, PointsAuditLog
>>> from django.db.models import Sum
>>> sp_total = StudentPoints.objects.aggregate(Sum('lifetime_points'))
>>> al_total = PointsAuditLog.objects.filter(points_type='student').aggregate(Sum('points_awarded'))
>>> print(f"StudentPoints: {sp_total['lifetime_points__sum']}")
>>> print(f"AuditLog: {al_total['points_awarded__sum']}")
>>> # Should be equal!
```

## Performance Considerations

- `_points_awarded` fields are indexed for fast queries
- Deduplication check adds minimal overhead (single boolean lookup)
- In SubmitQuiz: one extra check on attempt record
- In ReviewCreate: one extra query to check existing reviews (but already doing this for validation likely)

## Rollback Plan

If issues occur:

1. **Revert model changes:** Delete the migration files, remove field definitions
2. **Keep data:** The `_points_awarded` values won't break anything, just ignore them
3. **Old behavior:** Code will work but lose deduplication protection
4. **Rebuild StudentPoints:** Run cleanup scripts again if needed

## Commit Message Template

```
feat(points): implement deduplication for quiz and review points

- Add _points_awarded flag to QuizAttempt and Review models
- Prevent multiple point awards for same attempt/review
- Deduplicate existing student points in database
- Add PHASE 10.5-10.6 protection logic to award endpoints
- Audit: add indexes for performance

Fixes: Duplicate points issue where students earned multiple times for
       retaking quizzes and rating same course multiple times
       
Related: #XXX
```

---

**Status:** Ready for implementation  
**Estimated Time:** 30 minutes (coding + testing)  
**Risk Level:** Low (only adds new fields, doesn't modify existing logic)
