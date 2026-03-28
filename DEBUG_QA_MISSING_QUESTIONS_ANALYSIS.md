# Q&A Page - Missing Questions Root Cause Analysis

## Problem Statement
The instructor Q&A page (`/instructor/question-answer/`) shows "Tidak Ada Pertanyaan" even though:
- The course info shows `qa_count: 5` (5 questions exist)
- The backend API has the questions stored
- No errors appear in console

## Root Cause: Filtering Logic Bug

### The Bug Location
File: `frontend/src/views/instructor/QA.jsx`, lines 147-148

```javascript
// ❌ BROKEN FILTERING LOGIC
const courseQuestions = allQA.filter(q => 
    q.course?.course_id === publishedCourseId || 
    q.course?.course_id === draftCourseId
);
```

### Why It's Broken

1. **Backend Serializer Returns Only Course ID**
   - File: `backend/api/serializer.py`, line 2878 (Question_AnswerSerializer)
   - The serializer includes `'course'` in fields but with NO custom field definition
   - When DRF encounters a ForeignKey without a custom serializer, it defaults to returning just the primary key
   - Result: `q.course` is an **integer** (e.g., `168460`), not an object

2. **Frontend Expects Object with `course_id` Property**
   - The filter code tries to access `q.course?.course_id`
   - Since `q.course` is just an integer, `q.course?.course_id` is **undefined**
   - Example: `168460?.course_id` = `undefined`

3. **Filter Never Matches**
   - Filter: `undefined === publishedCourseId` → **always false**
   - Result: ALL questions filtered out, leaving empty array
   - UI displays: "Tidak Ada Pertanyaan"

### Data Flow Comparison

#### What Frontend Sends
```javascript
const publishedCourseId = course?.published_version?.course_id || course?.course_id;
// Result: "168460" (a string or number)

const draftCourseId = course?.course_id;
// Result: "271157" (the original draft ID)
```

#### What API Returns
```json
{
  "qa_id": "a1b2c3",
  "course": 168460,           // ❌ Just the ID, not an object!
  "title": "Sample Question",
  "profile": {...},
  "variant": {...},
  ...
}
```

#### What Filter Attempts
```javascript
// Checking: q.course?.course_id === publishedCourseId
// Actual: 168460?.course_id === "168460"
// Result: undefined === "168460" → FALSE ❌
```

## Solution

The filter logic should compare the `course` ID directly:

```javascript
// ✅ FIXED FILTERING LOGIC
const courseQuestions = allQA.filter(q => 
    q.course === publishedCourseId || 
    q.course === draftCourseId
);
```

This works because:
- `q.course` is already the integer course ID
- `publishedCourseId` and `draftCourseId` are also course IDs
- Direct comparison: `168460 === 168460` → TRUE ✅

## Files Affected
- **Frontend**: `frontend/src/views/instructor/QA.jsx`
  - Line 147-148: Main fetchCourseQuestions function
  - Line 608-609: Polling function (also has same bug)
  - Line 140-141: Variable definitions (need type alignment)

- **Backend**: No changes needed if we fix frontend filtering

## Verification Steps
1. Apply fix to remove `?.course_id` 
2. Compare `q.course` directly with course IDs
3. Test on `/instructor/question-answer/` page
4. Select a course with 5+ questions
5. Verify questions now display in modern-questions-container
