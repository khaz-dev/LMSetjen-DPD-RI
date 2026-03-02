# Quick Test Guide: Instructor Badge in Forum

## What to Test

### Test 1: Student View - Forum in Course Detail
```
URL: http://localhost:5174/student/courses/124632/
Steps:
1. Click "Diskusi Kursus" tab
2. Click on any question thread
3. VERIFY:
   - Original question shows instructor badge ✓
   - Any instructor replies show badge ✓
   - Student replies do NOT show badge ✓
```

### Test 2: Instructor View - QA Page
```
URL: http://localhost:5174/instructor/course-qa/
Steps:
1. Select a course
2. Click on any question thread
3. VERIFY:
   - Original question shows instructor badge ✓
   - Instructor's own replies show badge ✓
   - Student replies do NOT show badge ✓
```

## Browser Console Debugging

If badge still doesn't appear, check console logs:

```javascript
// Look for this debug log in browser console (F12)
[CourseDetail.Forum] Message {index}:
  - msg_user_id: {should match teacher user_id}
  - msg_profile_user_id: {should match teacher user_id}
  - teacher_user_id: {the course instructor's user_id}
  - isInstructor: true (should show badge)

// Check if user_id is being returned in API response
// Open Network tab -> course-detail API call -> Response -> check for user_id field
```

## Checklist of Changes

- [x] Backend: Added `user_id` to Question_AnswerSerializer
- [x] Frontend: Fixed original question badge in CourseDetail.jsx
- [x] Frontend: Fixed original question badge in QA.jsx
- [x] Both now check: `user_id` OR `profile?.user_id`
- [x] Both now match message badge logic pattern

## Expected API Response

After fix, Question_Answer object should include:
```json
{
  "qa_id": "abc123",
  "user_id": 42,
  "user": { ... },
  "profile": {
    "user_id": 42,
    ...
  },
  "messages": [
    {
      "user_id": 42,
      "profile": {
        "user_id": 42,
        ...
      },
      ...
    }
  ]
}
```

## Rollback (if needed)

Only need to revert these 3 changes:
1. Remove `user_id` line from Question_AnswerSerializer
2. Revert original question badge in CourseDetail.jsx
3. Revert original question badge in QA.jsx
