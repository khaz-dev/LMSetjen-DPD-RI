# Like & Report Button Functionality - Complete Project Map
**Date**: March 2, 2026  
**Phase**: 7.16+ (Q&A Like & Report System)

---

## 📊 Overview

The LMSetjen DPD RI project implements a comprehensive Like and Report system for Q&A content (questions and message replies). Users can:
- **Like/Unlike** questions and replies (toggle functionality)
- **Report** inappropriate content with reasons (spam, offensive, misinformation, etc.)
- **View report status** (pending, reviewed, dismissed, action taken)
- **Edit existing reports** before admin review

---

## 🔙 BACKEND IMPLEMENTATION

### 1. **Data Models** (`backend/api/models.py`)

#### Question_Answer_Like Model
**File**: [backend/api/models.py](backend/api/models.py#L930-L943)  
**Lines**: 930-943

```python
class Question_Answer_Like(models.Model):
    question = models.ForeignKey(Question_Answer, on_delete=models.CASCADE, related_name='likes')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('question', 'user')  # Prevent duplicate likes
        ordering = ['-created_at']
```

#### Question_Answer_Message_Like Model
**File**: [backend/api/models.py](backend/api/models.py#L944-L958)  
**Lines**: 944-958

```python
class Question_Answer_Message_Like(models.Model):
    message = models.ForeignKey(Question_Answer_Message, on_delete=models.CASCADE, related_name='likes')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('message', 'user')  # Prevent duplicate likes
        ordering = ['-created_at']
```

#### Question_Answer_Report Model
**File**: [backend/api/models.py](backend/api/models.py#L959-L993)  
**Lines**: 959-993

Fields:
- `question` - ForeignKey to Question_Answer
- `reported_by` - User who reported
- `reason` - Choice field: spam, inappropriate, offensive, misinformation, other
- `description` - TextField for details
- `status` - pending, reviewed, dismissed, action_taken
- `reported_at` - Timestamp when reported
- `reviewed_at` - Timestamp when admin reviewed (nullable)
- `reviewed_by` - FK to User (admin who reviewed, nullable)
- `review_notes` - Admin feedback notes

#### Question_Answer_Message_Report Model
**File**: [backend/api/models.py](backend/api/models.py#L996-L1030)  
**Lines**: 996-1030

Similar structure to Question_Answer_Report but for message replies.

---

### 2. **Serializers** (`backend/api/serializer.py`)

#### Question_Answer_MessageSerializer
**File**: [backend/api/serializer.py](backend/api/serializer.py#L548-L562)  
**Lines**: 548-562

```python
class Question_Answer_MessageSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(source='user.profile', many=False, read_only=True)
    user_id = serializers.IntegerField(read_only=True)
    likes_count = serializers.SerializerMethodField()
    
    def get_likes_count(self, obj):
        """Count total likes on this message"""
        return api_models.Question_Answer_Message_Like.objects.filter(message=obj).count()
```

#### Question_AnswerSerializer
**File**: [backend/api/serializer.py](backend/api/serializer.py#L564-L612)  
**Lines**: 564-612

```python
class Question_AnswerSerializer(serializers.ModelSerializer):
    messages = Question_Answer_MessageSerializer(many=True)
    profile = ProfileSerializer(many=False)
    likes_count = serializers.SerializerMethodField()
    reports_count = serializers.SerializerMethodField()
    
    def get_likes_count(self, obj):
        """Count total likes on this question"""
        return api_models.Question_Answer_Like.objects.filter(question=obj).count()
    
    def get_reports_count(self, obj):
        """Count total reports on this question"""
        return api_models.Question_Answer_Report.objects.filter(question=obj).count()
```

---

### 3. **API Endpoints** (`backend/api/urls.py`)

**File**: [backend/api/urls.py](backend/api/urls.py#L87-L91)  
**Lines**: 87-91

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/student/question-answer-like/<qa_id>/` | POST | Toggle like on question |
| `/api/v1/student/question-answer-message-like/<qa_id>/` | POST | Toggle like on message reply |
| `/api/v1/student/question-answer-report/<qa_id>/` | POST/PUT | Create/update question report |
| `/api/v1/student/question-answer-message-report/<qa_id>/` | POST/PUT | Create/update message report |
| `/api/v1/student/qa-reports/<course_id>/` | GET | Get user's reports for course |

---

### 4. **API View Classes** (`backend/api/views.py`)

#### QuestionAnswerLikeAPIView
**File**: [backend/api/views.py](backend/api/views.py#L3166-L3221)  
**Lines**: 3166-3221

**POST Request**:
```json
{
  "user_id": 123,
  "course_id": 456
}
```

**Response**:
```json
{
  "message": "Suka berhasil" | "Tarik Suka berhasil",
  "likes_count": 5,
  "liked": true | false
}
```

**Logic**: Toggle like (create if doesn't exist, delete if exists)

---

#### QuestionAnswerMessageLikeAPIView
**File**: [backend/api/views.py](backend/api/views.py#L3221-L3275)  
**Lines**: 3221-3275

**POST Request**:
```json
{
  "user_id": 123,
  "course_id": 456,
  "message_id": 789
}
```

**Response**: Same as question like endpoint

---

#### QuestionAnswerReportAPIView
**File**: [backend/api/views.py](backend/api/views.py#L3278-L3440)  
**Lines**: 3278-3440

**POST Request** (Create new report):
```json
{
  "user_id": 123,
  "reason": "spam|inappropriate|offensive|misinformation|other",
  "description": "Optional description"
}
```

**PUT Request** (Update existing report):
```json
{
  "user_id": 123,
  "reason": "...",
  "description": "...",
  "status": "pending"
}
```

**Features**:
- Prevents duplicate reports from same user (unique_together constraint)
- Validates reason choices
- Returns 201 Created on success
- Resets status to "pending" when user edits report

---

#### QuestionAnswerMessageReportAPIView
**File**: [backend/api/views.py](backend/api/views.py#L3442-L3600)  
**Lines**: 3442-3600

Similar structure to QuestionAnswerReportAPIView but for message replies.

---

#### StudentQAReportsAPIView
**File**: [backend/api/views.py](backend/api/views.py#L3604-L3750)  
**Lines**: 3604-3750

**GET Request**: `/api/v1/student/qa-reports/{course_id}/?user_id={user_id}`

**Response**:
```json
{
  "question_reports": [
    {
      "id": 1,
      "question__qa_id": "qa_abc123",
      "question__course_id": 456,
      "status": "pending|reviewed|dismissed|action_taken",
      "reason": "spam|...",
      "reported_at": "2026-03-02T10:00:00Z",
      "reviewed_at": "2026-03-02T14:00:00Z",
      "review_notes": "Admin feedback",
      "reviewed_by__first_name": "Admin Name",
      "description": "Original report description"
    }
  ],
  "message_reports": [...]
}
```

---

## 🎨 FRONTEND IMPLEMENTATION

### 1. **Like Button Handler** (`frontend/src/views/student/CourseDetail.jsx`)

#### handleLikeQuestion Function
**File**: [frontend/src/views/student/CourseDetail.jsx](frontend/src/views/student/CourseDetail.jsx#L2171-L2207)  
**Lines**: 2171-2207

```javascript
const handleLikeQuestion = async (question) => {
  try {
    const response = await useAxios.post(`student/question-answer-like/${question.qa_id}/`, {
      user_id: UserData()?.user_id,
      course_id: course.course?.id,
    });
    
    // Updates filteredQuestions list
    // Updates selectedConversation if viewing this question
    // Shows success toast
  } catch (error) {
    // Shows error toast
  }
};
```

#### handleLikeMessage Function
**File**: [frontend/src/views/student/CourseDetail.jsx](frontend/src/views/student/CourseDetail.jsx#L2208-L2243)  
**Lines**: 2208-2243

```javascript
const handleLikeMessage = async (message) => {
  try {
    const response = await useAxios.post(
      `student/question-answer-message-like/${selectedConversation.qa_id}/`,
      {
        user_id: UserData()?.user_id,
        course_id: course.course?.id,
        message_id: message.id,
      }
    );
    
    // Updates selectedConversation messages
    // Shows success toast
  } catch (error) {
    // Shows error toast
  }
};
```

---

### 2. **Like Button UI Elements**

#### Like Button in Question Detail View
**File**: [frontend/src/views/student/CourseDetail.jsx](frontend/src/views/student/CourseDetail.jsx#L3105-L3135)  
**Lines**: 3105-3135

```jsx
<button 
  className="forum-like-btn" 
  title="Sukai pertanyaan ini"
  onClick={(e) => {
    e.stopPropagation();
    handleLikeQuestion(selectedConversation);
  }}
>
  <i className="far fa-heart"></i>
  <span className="like-count">{selectedConversation.likes_count || 0}</span>
</button>
```

#### Like Button in Message Reply
**File**: [frontend/src/views/student/CourseDetail.jsx](frontend/src/views/student/CourseDetail.jsx#L3200-L3220)  
**Lines**: 3200-3220

```jsx
<button 
  className="forum-like-btn" 
  title="Sukai jawaban ini"
  onClick={(e) => {
    e.stopPropagation();
    handleLikeMessage(msg);
  }}
>
  <i className="far fa-heart"></i>
  <span className="like-count">{msg.likes_count || 0}</span>
</button>
```

#### Like Button in Question List View
**File**: [frontend/src/views/student/CourseDetail.jsx](frontend/src/views/student/CourseDetail.jsx#L3530-L3555)  
**Lines**: 3530-3555

```jsx
<button className="forum-like-btn" title="Sukai pertanyaan ini" 
  onClick={(e) => { e.stopPropagation(); handleLikeQuestion(q); }}>
  <i className="far fa-heart"></i>
  <span className="like-count">{q.likes_count || 0}</span>
</button>
```

---

### 3. **Report Button & Modal**

#### Report Modal State Variables
**File**: [frontend/src/views/student/CourseDetail.jsx](frontend/src/views/student/CourseDetail.jsx#L103)  
**Line**: 103

```javascript
const [showQAReportModal, setShowQAReportModal] = useState(false);
```

#### fetchQAReports Function
**File**: [frontend/src/views/student/CourseDetail.jsx](frontend/src/views/student/CourseDetail.jsx#L1912-L1964)  
**Lines**: 1912-1964

Fetches user's existing reports for the course.

#### handleOpenQAReportModal Function
**File**: [frontend/src/views/student/CourseDetail.jsx](frontend/src/views/student/CourseDetail.jsx#L1968-2045)  
**Lines**: 1968-2045

Opens report modal and checks for existing reports.

#### handleSubmitQAReport Function
**File**: [frontend/src/views/student/CourseDetail.jsx](frontend/src/views/student/CourseDetail.jsx#L2079-L2165)  
**Lines**: 2079-2165

Handles both POST (new report) and PUT (edit report) requests.

#### Report Button with Status
**File**: [frontend/src/views/student/CourseDetail.jsx](frontend/src/views/student/CourseDetail.jsx#L3125-L3135)  
**Lines**: 3125-3135

Shows report button with status badge if already reported.

#### Report Modal Implementation
**File**: [frontend/src/views/student/CourseDetail.jsx](frontend/src/views/student/CourseDetail.jsx#L4635-L4860)  
**Lines**: 4635-4860

Full modal UI with:
- Report status display (if existing)
- Report form with reason and description fields
- Admin feedback display
- Edit button for pending reports

---

### 4. **Like Button CSS Styling** (`frontend/src/views/student/CourseDetail.css`)

#### .forum-like-btn
**File**: [frontend/src/views/student/CourseDetail.css](frontend/src/views/student/CourseDetail.css#L5555-L5585)  
**Lines**: 5555-5585

```css
.forum-like-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #fff;
    border: 1px solid #e9ecef;
    border-radius: 6px;
    color: #6c757d;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.3s ease;
    font-weight: 500;
}

.forum-like-btn:hover {
    border-color: #e9366d;
    color: #e9366d;
    background: #fff5f8;
}

.forum-like-btn i {
    font-size: 0.95rem;
}

.forum-like-btn .like-count {
    font-size: 0.85rem;
    font-weight: 600;
}
```

#### .forum-report-btn
**File**: [frontend/src/views/student/CourseDetail.css](frontend/src/views/student/CourseDetail.css#L5587-L5610)  
**Lines**: 5587-5610

```css
.forum-report-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 0.75rem;
    background: #fff;
    border: 1px solid #e9ecef;
    border-radius: 6px;
    color: #6c757d;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.3s ease;
    font-weight: 500;
}

.forum-report-btn:hover {
    border-color: #dc3545;
    color: #dc3545;
    background: #fff5f6;
}

.forum-report-btn i {
    font-size: 0.95rem;
}
```

---

## 📋 Feature Summary

| Feature | Implementation | Status |
|---------|----------------|--------|
| Like Questions | Backend model + API + Frontend | ✅ Complete |
| Unlike Questions | Toggle logic in view | ✅ Complete |
| Like Message Replies | Backend model + API + Frontend | ✅ Complete |
| Unlike Message Replies | Toggle logic in view | ✅ Complete |
| Report Questions | Backend model + API + Frontend | ✅ Complete |
| Report Replies | Backend model + API + Frontend | ✅ Complete |
| Report Status Tracking | 4-state workflow (pending→reviewed→action_taken/dismissed) | ✅ Complete |
| Edit Report Before Review | PUT endpoint + UI | ✅ Complete (Phase 7.16+) |
| Admin Feedback Display | feedback modal + review_notes field | ✅ Complete |
| Report Modal UI | Full modal with form + status display | ✅ Complete |
| Like Count Display | Serializer method + UI display | ✅ Complete |
| Duplicate Prevention | unique_together constraints | ✅ Complete |

---

## 🔄 Data Flow

### Like/Unlike Flow:
1. User clicks like button
2. Frontend calls `POST /api/v1/student/question-answer-like/{qa_id}/`
3. Backend checks if like exists (get_or_create)
4. If exists → delete (unlike)
5. If not exists → create (like)
6. Return updated like count
7. Frontend updates UI

### Report Flow:
1. User clicks report button
2. Frontend opens modal and fetches existing reports
3. User submits form → `POST /api/v1/student/question-answer-report/{qa_id}/`
4. Backend creates report with `status='pending'`
5. Admin reviews report (sees it in admin panel)
6. Admin updates status and adds review notes
7. User can edit report (shows form) → `PUT /api/v1/student/question-answer-report/{report_id}/`
8. System resets status to 'pending' for re-review

---

## 🎯 Key Constraints

1. **Duplicate Prevention**: `unique_together = ('question/message', 'user')` in models
2. **Report Validation**: Only valid reasons accepted (spam, inappropriate, offensive, misinformation, other)
3. **Permission**: User can only edit their own reports (verified by `reported_by.id`)
4. **Status Workflow**: pending → reviewed/dismissed/action_taken (cannot go backwards)
5. **Course Filtering**: Reports filtered by course_id (ShortUUID converted to database id)

---

## 📝 Notes

- All timestamps use UTC and Django's `timezone.now()`
- Messages in Indonesian (Bahasa Indonesia)
- PHASE 7.16 marks when like/report system was introduced
- Report modal includes admin feedback when reviewed
- Like count is calculated dynamically (SerializerMethodField) to avoid denormalization issues
- Frontend uses `UserData()` hook to get current user info

---

**End of Map**
