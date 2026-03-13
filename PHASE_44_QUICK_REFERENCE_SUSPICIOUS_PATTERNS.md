# Phase 44: Quick Reference - Suspicious Code Patterns

## Table 1: Answer Record Creation - Transaction Issues

| Issue | Location | Severity | Code Pattern | Problem |
|-------|----------|----------|-----|---------|
| **No Transaction Wrapper** | [views.py:10527-10548](backend/api/views.py#L10527) | 🔴 CRITICAL | `LessonCompletionQuestionAnswer.objects.create()` outside ANY transaction | Record may not be visible to SELECT queries immediately after |
| **Multi-Part Save** | [views.py:10535-10545](backend/api/views.py#L10535) | 🟡 MEDIUM | Create → set FK → save() → set M2M (no save) | Inconsistent persistence pattern |
| **M2M No Save** | [views.py:10542](backend/api/views.py#L10542) | 🟡 MEDIUM | `answer_record.answer_choices.set(choices)` | Django ORM may not persist M2M relationship immediately |
| **Exception Swallowed** | [views.py:10543-10548](backend/api/views.py#L10543) | 🟡 MEDIUM | `except Exception as e: ... # Don't fail response` | Partial saves continue - incomplete record state |

---

## Table 2: Completion Creation - Transaction Handling

| Issue | Location | Severity | Pattern | Status |
|-------|----------|----------|---------|--------|
| **Atomic Transaction** | [views.py:10560](backend/api/views.py#L10560) | ✅ GOOD | `with transaction.atomic(): CompletedLesson.objects.get_or_create()` | Properly wrapped |
| **Separate from Answer** | [views.py:10550+](backend/api/views.py#L10550) | 🔴 CRITICAL | Answer transaction ends BEFORE completion transaction starts | Race condition window exists |
| **Verification Check** | [views.py:10531-10540](backend/api/views.py#L10531) | ⚠️ WARNING | Checks answer WITHOUT reading its database state | May create completion before answer persisted |

---

## Table 3: Frontend Timing Issues

| Issue | Location | Code | Timing | Problem |
|-------|----------|------|--------|---------|
| Answer submitted | [LessonCompletionQuestionModal.jsx:96](frontend/src/components/CourseDetail/LessonCompletionQuestionModal.jsx#L96) | `const response = await API.post(...)` | **T0** | Awaits response |
| Event dispatched | [LessonCompletionQuestionModal.jsx:102](frontend/src/components/CourseDetail/LessonCompletionQuestionModal.jsx#L102) | `window.dispatchEvent(new CustomEvent(...))` | **T0+5ms** | Backend returns immediately |
| Event listener fires | [CourseDetail.jsx:2505](frontend/src/views/student/CourseDetail.jsx#L2505) | `window.addEventListener('lessonAnsweredCorrectly', ...)` | **T0+5ms** | Instantly triggers |
| Delay before fetch | [CourseDetail.jsx:2514](frontend/src/views/student/CourseDetail.jsx#L2514) | `setTimeout(async () => { fetchCourseDetail(true) }, 500)` | **T0+505ms** | **⚠️ 500ms minimum wait** |
| Data fetched | [CourseDetail.jsx:2164](frontend/src/views/student/CourseDetail.jsx#L2164) | `fetchCourseDetail(preventLoadingState)` | **T0+510ms** | Fresh query to backend |
| **CRITICAL**: Serializer queries | [serializer.py:1149](backend/api/serializer.py#L1149) | `all_answers = LessonCompletionQuestionAnswer.objects.filter(...)` | **T0+515ms** | **Answer record may not be visible yet!** |

**Timeline Issue**: Answer created at T0, CompletedLesson at T0+20ms, but answer visibility check at T0+515ms might not see it.

---

## Table 4: Serializer Filtering Logic - Root Cause

| Step | Location | Query | Expected Result | Actual Problem |
|------|----------|-------|-----------------|-----------------|
| 1. Get CompletedLesson records | [serializer.py:1120](backend/api/serializer.py#L1120) | `SELECT * FROM api_completedlesson WHERE user=X AND course=Y` | Returns CompletedLesson for LAST lesson ✅ | ✅ WORKS |
| 2. Check if lesson has verification Q | [serializer.py:1135](backend/api/serializer.py#L1135) | `SELECT * FROM api_lessoncompletionquestion WHERE variant_item=Z` | Returns question record ✅ | ✅ WORKS |
| **🔴 3. Check student answered correctly** | [serializer.py:1149](backend/api/serializer.py#L1149) | `SELECT * FROM api_lessoncompletionquestionanswer WHERE user=X AND question=Y AND is_correct=True` | Returns answer record ❌ | ❌ **RETURNS EMPTY** (not yet visible) |
| 4. Filter decision | [serializer.py:1150-1160](backend/api/serializer.py#L1150) | Check if list has any is_correct records | Should include lesson | ❌ **EXCLUDES from completed_lesson array** |

**The critical query at line 1149:**
```sql
-- This query FAILS to find the answer record
SELECT * 
FROM api_lessoncompletionquestionanswer 
WHERE user_id = 5 
  AND question_id = 123 
  AND is_correct = True
  
-- Returns: 0 rows (even though record exists in database!)
-- Reason: Transaction not committed to this isolation level yet
```

---

## Table 5: Special Cases in Code

| Pattern | Location | Why It Matters | Risk |
|---------|----------|----------------|------|
| "last lesson" mention | None found in main code | No explicit last lesson logic | ✅ Not a special case handler |
| "final" lesson handling | None found | No checkpoint/completion trigger | ✅ Not a special case handler |
| Variant ordering | Multiple `.first()` calls | Gets first match, but no ORDER BY specified | ⚠️ Ordering not deterministic |
| Video completion trigger | [views.py:2505-2530](frontend/src/views/student/CourseDetail.jsx#L2505) | Events cascade | ✅ Works for any lesson |
| Quiz vs Lesson completion | [serializer.py:1150+](backend/api/serializer.py#L1150) | Different models | Lesson completion: CompletedLesson; Quiz: QuizAttempt |

---

## Table 6: Question Type Handling Differences

| Question Type | Answer Creation | Persistence | Pattern | Issue |
|---------------|-----------------|-------------|---------|-------|
| **multiple_choice** | Line 10530-10537 | `.save()` after FK set | CREATE → SET FK → SAVE | ✅ Explicit save |
| **multi_select** | Line 10530-10542 | `.set()` only (no save) | CREATE → SET M2M → (no save) | 🟡 No explicit save |
| **short_answer** | Line 10530-10544 | `.save()` after text set | CREATE → SET TEXT → SAVE | ✅ Explicit save |
| **fill_in_blank** | Line 10530-10544 | `.save()` after text set | CREATE → SET TEXT → SAVE | ✅ Explicit save |

**Pattern Found**: Only multi_select uses `.set()` without `.save()`, others use explicit `.save()`

---

## Table 7: Data Validation Paths

| Validation Check | Location | When Checked | Issue |
|------------------|----------|--------------|-------|
| **Answer correctness** | [views.py:10512-10520](backend/api/views.py#L10512) | Immediately during POST | ✅ Correct logic |
| **Lesson has verification Q** | [views.py:10531](backend/api/views.py#L10531) | Before creating completion | ⚠️ Checks if Q exists, not if answer saved |
| **Student answered correctly** | [serializer.py:1149](backend/api/serializer.py#L1149) | During API response serialization | 🔴 **Race condition: might not see answer yet** |
| **Completion exists** | [serializer.py:1120](backend/api/serializer.py#L1120) | During API response serialization | ✅ Works fine |

**Gap Identified**: Answer correctness checked at creation (line 10513), but NOT re-verified before creating CompletedLesson. Then checked AGAIN at serialization time (line 1149) which is where it fails.

---

## Table 8: Response Handling

| Layer | Sends What | Expects What | Gets What |
|-------|-----------|--------------|-----------|
| **Backend Post** | `{'is_correct': true}` | Nothing | ✅ Sends it |
| **Frontend Modal** | Event with `variantItemId` | Course data refresh | ⏳ Waits 500ms then fetches |
| **API Endpoint** | `{'completed_lesson': [...]}` | Lesson in array | 🔴 Lesson NOT in array (filtered out) |
| **Frontend Display** | Check if lesson in array | Lesson appears | ❌ Doesn't appear |

**Missing**: Backend response doesn't include `completed_lesson` array - frontend has to wait and fetch it separately!

---

## Quick Diagnosis Flowchart

```
Q: Last lesson shows "ditonton XX.X%" instead of "Diselesaikan"
│
├─→ Check: Is completion visible in database?
│   │
│   ├─→ YES: Record exists in api_completedlesson
│   │   │
│   │   └─→ Check: Does answer record exist?
│   │       │
│   │       ├─→ YES: api_lessoncompletionquestionanswer exists
│   │       │   │
│   │       │   └─→ 🔴 ISSUE: Race condition
│   │       │       Answer exists but NOT visible to API query
│   │       │       at the moment serializer runs
│   │       │
│   │       └─→ NO: Answer record missing
│   │           └─→ 🔴 ISSUE: Exception swallowed or M2M not persisted
│   │
│   └─→ NO: CompletedLesson missing
│       └─→ 🔴 ISSUE: Transaction failed silently
│
└─→ Timeline Issue: 500ms delay insufficient
    └─→ 🔴 ISSUE: Frontend timing too aggressive
```

---

## Code Snippets to Add Debugging

### Backend - Track Answer Persistence
```python
# Add after creating answer_record (line 10530)
answer_record_id = answer_record.id

# Add after setting details (line 10544)
persisted = api_models.LessonCompletionQuestionAnswer.objects.filter(
    id=answer_record_id
).exists()
print(f"[DEBUG] Answer {answer_record_id} immediately persisted: {persisted}")

# Add before creating completion (line 10550)
at_transaction_create = api_models.LessonCompletionQuestionAnswer.objects.filter(
    id=answer_record_id
).exists()
print(f"[DEBUG] Answer {answer_record_id} visible at completion time: {at_transaction_create}")
```

### Backend - Track Serializer Query
```python
# In get_completed_lesson (line 1149)
print(f"[DEBUG] Querying answers for question {verification_question.id}")
all_answers_raw = list(api_models.LessonCompletionQuestionAnswer.objects.raw(
    "SELECT * FROM api_lessoncompletionquestionanswer WHERE question_id = %s",
    [verification_question.id]
))
print(f"[DEBUG] Raw SQL found {len(all_answers_raw)} records")
print(f"[DEBUG] ORM query found {len(all_answers)} records")
```

### Frontend - Verify Lesson Appears
```javascript
// After fetchCourseDetail() completes (line 2520)
const lesson = courseData.completed_lesson?.find(
    cl => cl.variant_item_id === variantItemId
);
console.log(`[DEBUG] Lesson ${variantItemId} in completed_lesson array: ${!!lesson}`);
if (!lesson) {
    console.error('[DEBUG] ISSUE DETECTED: Lesson not in array after correct answer!');
}
```

---

## Prevention Checklist

- [ ] Wrap answer creation in `transaction.atomic()`
- [ ] Call explicit `.save()` on all question types
- [ ] Don't swallow exceptions during answer recording
- [ ] Increase frontend delay to 1000-2000ms minimum
- [ ] Implement frontend polling for lesson appearance
- [ ] Add database constraint: `CompletedLesson.variant_item NOT NULL`
- [ ] Add test case: Answer verification question → verify lesson appears
- [ ] Monitor logs for `[PHASE 12.16]` and `[PHASE 13.3]` errors
- [ ] Check PostgreSQL isolation level and transaction settings

---
