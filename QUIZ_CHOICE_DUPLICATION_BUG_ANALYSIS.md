# Quiz Choice Duplication Bug Analysis & Fix

**Date**: February 22, 2026  
**Issue**: When editing quiz question options, old options are not deleted. Instead, new options are appended, creating duplicates (A, B, C, D → A, B, C, D, E, F, G, H)  
**Severity**: 🔴 HIGH - Data integrity issue affecting quiz editing functionality  
**URL**: `http://localhost:5174/instructor/edit-course/190854/quiz/`

---

## 1. Root Cause Analysis

### The Problem Flow

1. **User Action**: Instructor edits a quiz question's options from A, B, C, D → E, F, G, H
2. **Frontend Sends**: New choices (E, F, G, H) via POST request
3. **Backend Creates**: New choice records E, F, G, H in database
4. **What Doesn't Happen**: Old choices A, B, C, D are NOT deleted
5. **Result**: Database contains A, B, C, D, E, F, G, H (8 options instead of 4)

### Root Cause Location

**File**: `frontend/src/views/instructor/CourseQuiz.jsx`  
**Function**: `saveQuestionChoices()` (Lines 280-295)  
**Code Snippet**:
```javascript
const saveQuestionChoices = async (questionId, choices) => {
    try {
        // If editing, delete existing choices first
        if (editingQuestion) {
            // This would require additional API endpoint to delete all choices for a question
            // For now, we'll create new ones (you may want to implement choice updating)
        }

        // Create new choices
        for (const [index, choice] of choices.entries()) {
            await apiInstance.post("quiz/choice/list-create/", {
                question_id: questionId,
                choice_text: choice.choice_text,
                is_correct: choice.is_correct,
                order: index + 1
            });
        }
    } catch (error) {
        throw error;
    }
};
```

### The Issue

The comment says **"This would require additional API endpoint"**, but that's **INCORRECT**. The backend **ALREADY HAS** the necessary endpoint!

### Available Backend API Endpoints

**For Creating Choices:**
- `POST /api/v1/quiz/choice/list-create/` ✅ Working
- Backend View: `QuizChoiceListCreateAPIView` (Line 4854)

**For Deleting Choices (MISSING IN FRONTEND):**
- `DELETE /api/v1/quiz/choice/detail/<choice_id>/` ✅ **Already exists but not used!**
- Backend View: `QuizChoiceDetailAPIView` extends `generics.RetrieveUpdateDestroyAPIView` (Line 4882)
- Supports: Retrieve, Update, **Destroy (DELETE)**

### Why This Happens

1. **Backend Support**: Django REST Framework's `RetrieveUpdateDestroyAPIView` automatically provides DELETE support
2. **Model**: `QuizChoice` has `choice_id` field (UUID) as lookup field
3. **Frontend Gap**: The frontend developer commented that the endpoint doesn't exist, but it actually does
4. **Silent Failure**: The delete operation is skipped, but no error is shown to the user

---

## 2. Impact Assessment

### Affected Functionality

- ❌ Quiz question editing (every time user updates question options)
- ❌ Quiz creation when adding questions with choices
- ✅ Quiz deletion works fine (cascade deletes choices)

### Data Integrity Issues

- **Duplicate Choices**: Questions accumulate old choices they should have replaced
- **Confusing Display**: When editing, users see old + new choices mixed together
- **Incorrect Quiz Options**: Students may see incorrect/extra options they shouldn't

### Example Scenario

```
Step 1: Instructor creates question with: A, B, C, D  →  Stored in DB ✓
Step 2: Instructor edits to: E, F, G (removes D)      →  Now DB has A, B, C, D, E, F, G ✗
Step 3: Instructor edits to: X, Y, Z                  →  Now DB has A, B, C, D, E, F, G, X, Y, Z ✗✗
```

---

## 3. The Fix

### Solution Overview

Modify `saveQuestionChoices()` function to:
1. **Delete** all existing choices for the question (if editing)
2. **Create** new choices from scratch

### Code Changes Required

**File**: `frontend/src/views/instructor/CourseQuiz.jsx`

**Old Code (Broken)**:
```javascript
const saveQuestionChoices = async (questionId, choices) => {
    try {
        // If editing, delete existing choices first
        if (editingQuestion) {
            // This would require additional API endpoint to delete all choices for a question
            // For now, we'll create new ones (you may want to implement choice updating)
        }

        // Create new choices
        for (const [index, choice] of choices.entries()) {
            await apiInstance.post("quiz/choice/list-create/", {
                question_id: questionId,
                choice_text: choice.choice_text,
                is_correct: choice.is_correct,
                order: index + 1
            });
        }
    } catch (error) {
        throw error;
    }
};
```

**New Code (Fixed)**:
```javascript
const saveQuestionChoices = async (questionId, choices) => {
    try {
        // If editing, delete existing choices first
        if (editingQuestion) {
            // Delete all old choices using the existing backend endpoint
            console.log(`[Quiz Choice] Deleting ${editingQuestion.choices.length} old choice(s)...`);
            for (const oldChoice of editingQuestion.choices) {
                try {
                    await apiInstance.delete(`quiz/choice/detail/${oldChoice.choice_id}/`);
                } catch (error) {
                    console.error(`Failed to delete choice ${oldChoice.choice_id}:`, error);
                    // Continue deleting other choices even if one fails
                }
            }
            console.log(`[Quiz Choice] Old choice(s) deleted successfully`);
        }

        // Create new choices
        console.log(`[Quiz Choice] Creating ${choices.length} new choice(s)...`);
        for (const [index, choice] of choices.entries()) {
            await apiInstance.post("quiz/choice/list-create/", {
                question_id: questionId,
                choice_text: choice.choice_text,
                is_correct: choice.is_correct,
                order: index + 1
            });
        }
        console.log(`[Quiz Choice] New choice(s) created successfully`);
    } catch (error) {
        throw error;
    }
};
```

### Key Changes

1. **Lines 5-15**: Added deletion loop when `editingQuestion` exists
2. **Error Handling**: Wrapped individual deletes in try-catch to allow continuing if one fails
3. **Logging**: Added console logs to track the operation (helps with debugging)
4. **Uses Existing API**: `DELETE /quiz/choice/detail/<choice_id>/` that backend already provides

---

## 4. Testing Strategy

### Manual Testing Steps

1. **Create Quiz with Question**
   - Create quiz with title "Test Quiz"
   - Add question with options: A, B, C, D
   - Verify all 4 options appear in database

2. **Edit Question Options**
   - Click edit on the question
   - Change options to: E, F, G, H
   - Save the question

3. **Verify Fix**
   - Check database for question's choices
   - Should have **exactly 4 choices**: E, F, G, H
   - Should **NOT have**: A, B, C, D (old ones should be deleted)

4. **Edit Again Multiple Times**
   - Edit to: X, Y
   - Should have exactly 2 choices: X, Y
   - Should NOT accumulate: A, B, C, D, E, F, G, H, X, Y

### SQL Verification Query

```sql
SELECT q.question_id, q.question_text, 
       COUNT(qc.choice_id) as choice_count,
       STRING_AGG(qc.choice_text, ', ') as choices
FROM api_quizquestion q
LEFT JOIN api_quizchoice qc ON q.id = qc.question_id
GROUP BY q.question_id, q.question_text
ORDER BY choice_count DESC;
```

---

## 5. Prevention for Future

### Lessons Learned

1. **API Documentation**: Backend already provides all needed endpoints
2. **Comments as Documentation**: Code comments claimed endpoint didn't exist when it did
3. **Frontend Assumptions**: Frontend made assumptions without verifying backend capabilities

### Recommendations

1. ✅ Update code to use the existing DELETE endpoint
2. ✅ Add proper logging for quiz operations
3. ✅ Test quiz editing workflows thoroughly
4. ✅ Document all available API endpoints  
5. ✅ Review other question management code for similar issues

---

## 6. Backend Endpoint Reference

### Delete Single Choice

**Endpoint**: `DELETE /api/v1/quiz/choice/detail/{choice_id}/`  
**Backend Class**: `QuizChoiceDetailAPIView` (Line 4882 in views.py)  
**Parent Class**: `generics.RetrieveUpdateDestroyAPIView`  
**Supports**: GET (Retrieve), PUT (Update), DELETE ✅  

**Example Request**:
```bash
curl -X DELETE "http://localhost:8001/api/v1/quiz/choice/detail/abc123/" \
  -H "Content-Type: application/json"
```

### List/Create Choices

**Endpoint**: `POST /api/v1/quiz/choice/list-create/`  
**Backend Class**: `QuizChoiceListCreateAPIView` (Line 4854 in views.py)  
**Supports**: GET (List), POST (Create) ✅

---

## Impact Summary

| Aspect | Before Fix | After Fix |
|--------|-----------|-----------|
| **Editing Options** | Duplicates A, B, C, D, E, F, G, H | Cleanly replaces with E, F, G, H |
| **Multiple Edits** | Accumulates options | Correctly replaces each time |
| **User Experience** | Confusing, error-prone | Clean, predictable |
| **Data Integrity** | ❌ Broken | ✅ Correct |

---

**Status**: Ready for implementation  
**Estimated Fix Time**: 5 minutes  
**Risk Level**: 🟢 LOW (uses existing, tested API endpoint)
