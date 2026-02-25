# Admin Review Course Page - Layout & Quiz Display Fixes (PHASE 4.38 UPDATE)

## Summary
Fixed two critical issues on the admin course review detail page:
1. **Title Repositioning**: Moved "Review Detail Kursus" to the right side of the header (not inside course card)
2. **Quiz Questions Display**: Added complete quiz questions and answer choices display with correct answer indicators

---

## Issue #1: Title Position Fix ✅

### Problem
- Title was positioned inside the course header card on the right side
- User wanted it in the `acrd-header` element on the right side instead

### Solution
**File**: `frontend/src/views/admin/AdminCourseReviewDetail.jsx`

**Changed From**:
```jsx
<div className="acrd-header mb-4">
    <button>...</button>
</div>

<div className="acrd-card acrd-course-header mb-4" style={{ position: 'relative' }}>
    <div className="acrd-card-title-right">
        <h1 className="acrd-title">Review Detail Kursus</h1>
    </div>
    {/* Course content */}
</div>
```

**Changed To**:
```jsx
<div className="acrd-header mb-4">
    <button>Kembali</button>
    <h1 className="acrd-title ms-auto">
        <i className="fas fa-eye me-2"></i>
        Review Detail Kursus
    </h1>
</div>

<div className="acrd-card acrd-course-header mb-4">
    {/* Course content without title */}
</div>
```

### CSS Changes
**File**: `frontend/src/views/admin/AdminCourseReviewDetail.css`

**Old CSS**:
```css
.acrd-header {
    display: flex;
    align-items: center;
    padding-bottom: 20px;
    border-bottom: 2px solid #f0f0f0;
}

.acrd-card-title-right {
    position: absolute;
    top: 30px;
    right: 30px;
    text-align: right;
}

.acrd-card-title-right .acrd-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #2c3e50;
    margin: 0;
    white-space: nowrap;
}
```

**New CSS**:
```css
.acrd-header {
    display: flex;
    align-items: center;
    justify-content: space-between;  /* ← Key change: space-between */
    padding-bottom: 20px;
    border-bottom: 2px solid #f0f0f0;
    gap: 20px;
}

.acrd-header .acrd-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #2c3e50;
    margin: 0;
    white-space: nowrap;
    flex-shrink: 0;  /* Prevent shrinking */
}
```

### Responsive Adjustments

**Desktop (>768px)**:
- Back button on left
- Title on right
- Space-between layout

**Tablet (768px - 577px)**:
```css
@media (max-width: 768px) {
    .acrd-header {
        flex-direction: column;  /* Stack vertically */
        align-items: flex-start;
    }

    .acrd-header .acrd-title {
        font-size: 1.25rem;
        margin-top: 10px;
    }
}
```

**Mobile (<576px)**:
```css
@media (max-width: 576px) {
    .acrd-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 15px;
    }

    .acrd-header .acrd-title {
        font-size: 1rem;
    }
}
```

---

## Issue #2: Quiz Questions & Answers Display ✅

### Problem
- Quiz questions and answer choices were not being displayed
- Backend serializer (`CourseEditSerializer.get_quizzes()`) was returning only lightweight data:
  ```python
  return obj.quizzes.values('quiz_id', 'title', 'is_active')
  ```
- This lacked the `questions`, `choices`, and `total_questions` fields

### Root Cause
The `CourseEditSerializer` was designed to return "lightweight quiz data for workflow stepper" but the admin review page needs full quiz data including all questions and choices.

### Solution

#### Backend Fix
**File**: `backend/api/serializer.py`

**Changed From**:
```python
def get_quizzes(self, obj):
    """Return lightweight quiz data for workflow stepper"""
    return obj.quizzes.values('quiz_id', 'title', 'is_active')
```

**Changed To**:
```python
def get_quizzes(self, obj):
    """✨ PHASE 4.38: Return full quiz data with questions and choices for admin review"""
    from . import serializer as ser
    quizzes = obj.quizzes.all()
    return ser.QuizSerializer(quizzes, many=True, read_only=True).data
```

**Why This Works**:
- `QuizSerializer` includes:
  - `quiz_id`, `title`, `description`, `is_active`, `date`
  - `questions` (array of `QuizQuestionSerializer`)
  - `total_questions` (readonly field)
- `QuizQuestionSerializer` includes:
  - `question_id`, `question_text`, `order`, `date`
  - `choices` (array of `QuizChoiceSerializer`)
  - `correct_answer` (the correct choice)
- `QuizChoiceSerializer` includes:
  - `choice_id`, `choice_text`, `is_correct`, `order`

#### Frontend Display Enhancement
**File**: `frontend/src/views/admin/AdminCourseReviewDetail.jsx`

**New Quiz Display Structure**:
```jsx
{expandedQuizzes[quiz.quiz_id] && (
    <div className="acrd-quiz-content">
        {/* Quiz Description */}
        {quiz.description && (
            <div className="alert alert-info mb-3">
                <strong>Deskripsi:</strong> {quiz.description}
            </div>
        )}

        {/* Question Count */}
        <div className="acrd-quiz-stats mb-4">
            <span className="badge bg-primary">
                <i className="fas fa-question-circle me-1"></i>
                Jumlah Pertanyaan: {quiz.total_questions || 0}
            </span>
        </div>

        {/* Questions with Answers */}
        {quiz.questions && quiz.questions.length > 0 ? (
            <div className="acrd-quiz-questions">
                <h5><i className="fas fa-list me-2"></i>Detail Pertanyaan & Jawaban</h5>
                
                {quiz.questions.map((question, qIdx) => (
                    <div className="acrd-question-item">
                        {/* Question */}
                        <div className="acrd-question-header">
                            <span className="acrd-question-num">Pertanyaan {qIdx + 1}</span>
                            <p className="acrd-question-text">{question.question_text}</p>
                        </div>

                        {/* Answer Choices */}
                        <div className="acrd-choices">
                            {question.choices.map((choice, cIdx) => (
                                <div className={`acrd-choice-item ${choice.is_correct ? 'correct' : ''}`}>
                                    {/* Indicator icon */}
                                    <div className="acrd-choice-indicator">
                                        {choice.is_correct ? (
                                            <i className="fas fa-check-circle text-success"></i>
                                        ) : (
                                            <i className="fas fa-circle text-muted"></i>
                                        )}
                                    </div>

                                    {/* Choice content */}
                                    <div className="acrd-choice-content">
                                        <div className="acrd-choice-letter">{String.fromCharCode(65 + cIdx)}.</div>
                                        <div className="acrd-choice-text">{choice.choice_text}</div>
                                        {choice.is_correct && (
                                            <span className="badge bg-success ms-2">Jawaban Benar</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="alert alert-warning">
                <strong>Tidak ada pertanyaan dalam kuis ini</strong>
            </div>
        )}
    </div>
)}
```

---

## New CSS Classes for Quiz Questions

**File**: `frontend/src/views/admin/AdminCourseReviewDetail.css`

### Quiz Questions Section
```css
.acrd-quiz-questions {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 2px solid #e0e0e0;
}

.acrd-quiz-questions h5 {
    font-size: 1rem;
    font-weight: 700;
    color: #2c3e50;
    margin-bottom: 20px;
}
```

### Question Item
```css
.acrd-question-item {
    padding: 15px;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    transition: all 0.3s ease;
}

.acrd-question-item:hover {
    border-color: #667eea;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
}

.acrd-question-header {
    margin-bottom: 15px;
}

.acrd-question-num {
    display: inline-block;
    background: #667eea;
    color: white;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    margin-bottom: 10px;
}

.acrd-question-text {
    font-size: 0.95rem;
    font-weight: 600;
    color: #2c3e50;
    margin: 10px 0 0 0;
    line-height: 1.5;
}
```

### Choice Items
```css
.acrd-choices {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.acrd-choice-item {
    padding: 12px;
    background: #f9fbfd;
    border: 1px solid #e8eaf6;
    border-radius: 6px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    transition: all 0.3s ease;
}

.acrd-choice-item:hover {
    background: #f3f8fc;
    border-color: #667eea;
}

/* Highlight correct answers */
.acrd-choice-item.correct {
    background: rgba(76, 175, 80, 0.05);
    border-color: #4CAF50;
}

.acrd-choice-indicator {
    font-size: 1.2rem;
    line-height: 1;
    padding-top: 4px;
    flex-shrink: 0;
}

.acrd-choice-content {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
}

.acrd-choice-letter {
    font-weight: 700;
    color: #667eea;
    min-width: 24px;
}

.acrd-choice-text {
    font-size: 0.9rem;
    color: #555;
    line-height: 1.4;
}
```

---

## Visual Features

### Quiz Structure When Expanded

```
┌─────────────────────────────────────────┐
│ Kuis 1      [Kuis Tanpa Judul] ✓ Aktif  ▼ │
├─────────────────────────────────────────┤
│                                         │
│ Deskripsi: [Quiz description if exists] │
│                                         │
│ ⊙ Jumlah Pertanyaan: 3                  │
│                                         │
│ 📋 Detail Pertanyaan & Jawaban           │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ PERTANYAAN 1                        │ │
│ │ Pertanyaan teks di sini...          │ │
│ │                                     │ │
│ │ ✔ A. Pilihan jawaban 1 [Benar]      │ │
│ │ ○ B. Pilihan jawaban 2              │ │
│ │ ○ C. Pilihan jawaban 3              │ │
│ │ ○ D. Pilihan jawaban 4              │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ PERTANYAAN 2                        │ │
│ │ Pertanyaan teks di sini...          │ │
│ │                                     │ │
│ │ ○ A. Pilihan jawaban 1              │ │
│ │ ✔ B. Pilihan jawaban 2 [Benar]      │ │
│ │ ○ C. Pilihan jawaban 3              │ │
│ │ ○ D. Pilihan jawaban 4              │ │
│ └─────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

### Key Visual Indicators
- ✔ **Check circle** (green) = Correct answer
- ○ **Empty circle** (muted gray) = Incorrect answer
- **Badge "Jawaban Benar"** (green) = Correct answer label
- **Highlighted background** (light green) = Correct answer row
- **Letter labels** (A, B, C, D) = Choice identifiers

---

## Files Modified Summary

### Backend
1. **`backend/api/serializer.py`** (1 method changed)
   - `CourseEditSerializer.get_quizzes()`: Line 888-890
   - Now returns full `QuizSerializer` data instead of lightweight values

### Frontend
1. **`frontend/src/views/admin/AdminCourseReviewDetail.jsx`** (2 sections changed)
   - Header layout: Lines 214-230 (moved title to acrd-header)
   - Quiz display: Lines 513-567 (added questions and choices rendering)

2. **`frontend/src/views/admin/AdminCourseReviewDetail.css`** (added ~100 lines)
   - Header CSS: Updated to use `justify-content: space-between`
   - Quiz questions CSS: Added 50+ lines for questions, choices, indicators
   - Responsive CSS: Updated media queries for new header layout

---

## Testing Checklist

- [x] Header layout with title on right side
- [x] Title appears on right of "Kembali" button
- [x] Quiz section expands/collapses
- [x] Questions display with full text
- [x] All answer choices show
- [x] Correct answer highlighted in green
- [x] Correct answer indicator shows checkmark
- [x] Answer letter labels (A, B, C, D)
- [x] "Jawaban Benar" badge on correct answer
- [x] Empty state message if no questions
- [x] Responsive on mobile
- [x] No console errors

---

## API Data Flow

```
Endpoint: /api/v1/teacher/course-detail/{course_id}/

Response includes:
{
    "quizzes": [
        {
            "quiz_id": "123456",
            "title": "Quiz Title",
            "description": "Quiz description",
            "is_active": true,
            "total_questions": 3,
            "questions": [
                {
                    "question_id": "q1",
                    "question_text": "Question text",
                    "order": 1,
                    "choices": [
                        {
                            "choice_id": "c1",
                            "choice_text": "Option A",
                            "is_correct": true,
                            "order": 1
                        },
                        {
                            "choice_id": "c2",
                            "choice_text": "Option B",
                            "is_correct": false,
                            "order": 2
                        }
                    ]
                }
            ]
        }
    ]
}
```

---

## Notes

- **Backward Compatibility**: The change uses `QuizSerializer` which returns more data. This should not break existing functionality.
- **Performance**: Full quiz data is now fetched, which increases response size slightly but is acceptable for admin review pages.
- **No New API Endpoints**: Uses existing endpoint, just returns fuller data.
- **Circular Reference**: Uses `from . import serializer as ser` to avoid circular import issues.

---

## Phase Information
**Phase**: 4.38 Update 2
**Date**: February 18, 2026
**Status**: ✅ Complete
