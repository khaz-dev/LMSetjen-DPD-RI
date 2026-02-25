# PHASE 4.78: Instructor Request System - Deep Analysis & Implementation Plan

**Date**: February 22, 2026
**Status**: 📋 Planning & Implementation
**Current Problem**: Search page shows email Swal2 popup instead of proper instructor request workflow

---

## 🔍 DEEP PROBLEM ANALYSIS

### Issue Found
**Location**: [frontend/src/views/base/Search.jsx](frontend/src/views/base/Search.jsx#L225)

```jsx
// Current Implementation - Email Service Only
const handleStartTeaching = () => {
    const email = "sdm@dpd.go.id";
    const subject = "Aplikasi untuk Menjadi Instruktur";
    // ... Shows Swal popup with instructions to send email
    // Does NOT save request to database
    // No tracking of who applied
    // No admin approval system
}
```

**Problems**:
1. ❌ No database persistence - requests disappear
2. ❌ No admin tracking/approval system
3. ❌ No student notification of status
4. ❌ No structured workflow
5. ❌ Manual email handling (not scalable)
6. ❌ Doesn't require login first
7. ❌ No rejection reasons
8. ❌ No ability to reapply after rejection

---

## 📊 CURRENT SYSTEM ARCHITECTURE

### Existing Approval Systems (Reference)
✅ **Course Approval Workflow** (PHASE 4.36+)
- Model: `Course` with `platform_status`, `rejection_reason`
- Views: `CourseApprovalAPIView` at `/admin/course-approval/<id>/`
- Status: Draft → Review → Published/Rejected
- Admin Endpoints: ✓ Approve, ✓ Reject with feedback

### Existing Role System
✅ **User Model** (backend/userauths/models.py)
```python
class User(AbstractUser):
    # Boolean role system
    is_student = True  # Default
    is_instructor = False  # Becomes True when approved
    is_admin = False
    
    # CSV role list
    roles = 'student,teacher'  # Updated when instructor role granted
    current_role = 'student'  # Can switch to 'teacher'
```

✅ **Teacher Model** (backend/api/models.py)
```python
class Teacher(models.Model):
    user = OneToOneField(User)  # Created when instructor approved
    image, full_name, bio, about, etc.
```

✅ **Role Selection** (backend/api/views.py)
- `SelectRoleAPIView` - Switch between user's existing roles
- Does NOT grant new roles - require separate request system

---

## 🎯 DESIRED SYSTEM (PHASE 4.78)

### Complete Workflow

```
┌─ Student (is_instructor=False) ─┐
│                                  │
│  Clicks "Mulai Mengajar"        │
│  ↓                                │
│  Check: Is logged in?            │
│    • NO → Show login modal      │
│    • YES → Show request form    │
│                                  │
│  Submits request with:          │
│  • Areas of expertise           │
│  • Bio/Introduction             │
│  • Experience level             │
│                                  │
│  Request saved to DB            │
│  Status: "PENDING"              │
└─────────┬──────────────────────┘
          │
          ↓
┌─ Admin Approval Panel ──────────┐
│                                  │
│  Sees: PENDING instructor       │
│  requests                        │
│                                  │
│  Can:                            │
│  • Review student profile       │
│  • View request details         │
│  • Click "Terima" (Approve)    │
│  • Click "Tolak" (Reject)      │
│  • Add rejection reason         │
│                                  │
│  If TERIMA:                     │
│  • Create Teacher record        │
│  • Set is_instructor = True     │
│  • Add 'teacher' to roles       │
│  • Status → "APPROVED"          │
│                                  │
│  If TOLAK:                      │
│  • Store rejection reason       │
│  • Status → "REJECTED"          │
│  • Show reason to student       │
│  • Student can reapply          │
└─────────┬──────────────────────┘
          │
          ↓
┌─ Student (is_instructor=True) ──┐
│                                  │
│  Sees: "Status: Disetujui"     │
│  Now has "Buat Materi" button  │
│  Can access instructor menu    │
│  Can create courses            │
└──────────────────────────────────┘
```

---

## 🏗️ TECHNICAL IMPLEMENTATION PLAN

### Backend Components

#### 1. New Model: `InstructorRequest` (backend/api/models.py)
```python
class InstructorRequest(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Menunggu Review'),
        ('APPROVED', 'Disetujui'),
        ('REJECTED', 'Ditolak'),
    ]
    
    user = ForeignKey(User, on_delete=CASCADE)
    expertise_areas = CharField(max_length=500)  # Areas of expertise
    bio = TextField()  # Self introduction
    experience_level = CharField(choices=[...])  # Beginner, Intermediate, Advanced
    request_date = DateTimeField(auto_now_add=True)
    status = CharField(default='PENDING', choices=STATUS_CHOICES)
    
    # Admin fields
    reviewed_by = ForeignKey(User, null=True, related_name='instructor_requests_reviewed')
    reviewed_date = DateTimeField(null=True)
    rejection_reason = TextField(blank=True, null=True)
    
    class Meta:
        unique_together = [('user', 'status')]  # Only 1 PENDING per user
        ordering = ['-request_date']
```

#### 2. Serializers (backend/api/serializer.py)
```python
class InstructorRequestSerializer(serializers.ModelSerializer):
    user_name = CharField(source='user.full_name', read_only=True)
    user_email = CharField(source='user.email', read_only=True)
    class Meta:
        model = InstructorRequest
        fields = ['id', 'user', 'user_name', 'user_email', 'expertise_areas', 
                  'bio', 'experience_level', 'request_date', 'status', ...]

class AdminInstructorRequestSerializer(InstructorRequestSerializer):
    reviewed_by_name = CharField(source='reviewed_by.full_name', read_only=True)
    class Meta(InstructorRequestSerializer.Meta):
        fields = [..., 'reviewed_by', 'reviewed_by_name', 'reviewed_date', 'rejection_reason']
```

#### 3. API Views (backend/api/views.py)

**1. Create Request** (Student)
```python
class InstructorRequestCreateAPIView(CreateAPIView):
    """POST /api/v1/instructor-request/
    Student creates a request to become instructor
    """
    serializer_class = InstructorRequestSerializer
    permission_classes = [IsAuthenticated]
    
    def create(self, request):
        # Check if user already has pending request
        # Check if user already is instructor
        # Create new request
        # Return 201
```

**2. List Pending Requests** (Admin)
```python
class AdminInstructorRequestListAPIView(ListAPIView):
    """GET /api/v1/admin/instructor-requests/?status=PENDING
    Admin lists all pending requests
    """
    serializer_class = AdminInstructorRequestSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get_queryset(self):
        status = request.query_params.get('status', 'PENDING')
        return InstructorRequest.objects.filter(status=status)
```

**3. Approve Request** (Admin)
```python
class AdminInstructorRequestApproveAPIView(UpdateAPIView):
    """POST /api/v1/admin/instructor-request/{id}/approve/
    Admin approves request and grants instructor role
    """
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def update(self, request, request_id):
        # Get InstructorRequest
        # Create Teacher object for user
        # Set user.is_instructor = True
        # Add 'teacher' to user.roles
        # Set request.status = 'APPROVED'
        # Set request.reviewed_by = current_user
        # Return 200 with updated data
```

**4. Reject Request** (Admin)
```python
class AdminInstructorRequestRejectAPIView(UpdateAPIView):
    """POST /api/v1/admin/instructor-request/{id}/reject/
    Admin rejects request with reason
    """
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def update(self, request, request_id):
        # Validate rejection_reason provided
        # Set request.status = 'REJECTED'
        # Set request.rejection_reason = reason
        # Set request.reviewed_by = current_user
        # Return 200 with rejection reason
```

#### 4. URL Endpoints (backend/api/urls.py)
```python
# Student endpoints
path("instructor-request/", InstructorRequestCreateAPIView.as_view()),

# Admin endpoints
path("admin/instructor-requests/", AdminInstructorRequestListAPIView.as_view()),
path("admin/instructor-request/<int:request_id>/approve/", AdminInstructorRequestApproveAPIView.as_view()),
path("admin/instructor-request/<int:request_id>/reject/", AdminInstructorRequestRejectAPIView.as_view()),
```

---

### Frontend Components

#### 1. InstructorRequestModal Component
**File**: `frontend/src/components/InstructorRequestModal.jsx`

```jsx
const InstructorRequestModal = ({ isOpen, onClose, userId, isLoggedIn }) => {
    // Form state
    const [expertise, setExpertise] = useState('')
    const [bio, setBio] = useState('')
    const [experience, setExperience] = useState('')
    const [loading, setLoading] = useState(false)
    
    // If not logged in, show login prompt
    if (!isLoggedIn) {
        return <LoginPromptModal onClose={onClose} />
    }
    
    // Form with:
    // - "Bidang Keahlian" (Areas of Expertise)
    // - "Biografi Singkat" (Short Bio)
    // - "Tingkat Pengalaman" (Experience Level: Pemula/Menengah/Lanjutan)
    // - Submit button
    // - Show existing request status if any
    
    const handleSubmit = async () => {
        const response = await apiInstance.post('/instructor-request/', {
            expertise_areas: expertise,
            bio: bio,
            experience_level: experience
        })
        // Show success message
        // Close modal
    }
    
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            {/* Form JSX */}
        </Modal>
    )
}
```

#### 2. Update Search.jsx
**File**: `frontend/src/views/base/Search.jsx`

```jsx
import { InstructorRequestModal } from '../../components/InstructorRequestModal'

const Search = () => {
    const [showInstructorModal, setShowInstructorModal] = useState(false)
    const userData = UserData()
    const isLoggedIn = !!userData?.id
    
    const handleStartTeaching = () => {
        setShowInstructorModal(true)
    }
    
    return (
        <>
            {/* Existing search content */}
            
            {/* Replace existing button with */}
            <button onClick={handleStartTeaching} className="btn-cta">
                <span>Mulai Mengajar</span>
                <i className="fas fa-arrow-right"></i>
            </button>
            
            <InstructorRequestModal
                isOpen={showInstructorModal}
                onClose={() => setShowInstructorModal(false)}
                userId={userData?.id}
                isLoggedIn={isLoggedIn}
            />
        </>
    )
}
```

#### 3. Admin Panel Component
**File**: `frontend/src/views/admin/InstructorRequestsReview.jsx`

```jsx
const InstructorRequestsReview = () => {
    const [requests, setRequests] = useState([])
    const [selectedRequest, setSelectedRequest] = useState(null)
    
    useEffect(() => {
        fetchPendingRequests()
    }, [])
    
    const fetchPendingRequests = async () => {
        const response = await apiInstance.get('/admin/instructor-requests/?status=PENDING')
        setRequests(response.data.results)
    }
    
    const handleApprove = async (requestId) => {
        const response = await apiInstance.post(`/admin/instructor-request/${requestId}/approve/`)
        // Show success message
        // Refresh list
        fetchPendingRequests()
    }
    
    const handleReject = async (requestId, reason) => {
        const response = await apiInstance.post(`/admin/instructor-request/${requestId}/reject/`, {
            rejection_reason: reason
        })
        // Show success message
        // Refresh list
        fetchPendingRequests()
    }
    
    return (
        <div className="instructor-requests-panel">
            <h2>Permintaan Menjadi Instruktur</h2>
            
            {/* List of pending requests */}
            {requests.map(req => (
                <div key={req.id} className="request-card">
                    <h4>{req.user_name}</h4>
                    <p>Email: {req.user_email}</p>
                    <p>Keahlian: {req.expertise_areas}</p>
                    <p>Bio: {req.bio}</p>
                    <p>Pengalaman: {req.experience_level}</p>
                    
                    <button onClick={() => handleApprove(req.id)} className="btn-success">
                        <i className="fas fa-check me-2"></i>Terima
                    </button>
                    
                    <button onClick={() => handleShowRejectForm(req.id)} className="btn-danger">
                        <i className="fas fa-times me-2"></i>Tolak
                    </button>
                </div>
            ))}
        </div>
    )
}
```

---

## 📋 IMPLEMENTATION CHECKLIST

### Backend
- [ ] Create `InstructorRequest` model in `backend/api/models.py`
- [ ] Create migrations: `python manage.py makemigrations`
- [ ] Create `InstructorRequestSerializer` in `backend/api/serializer.py`
- [ ] Create API views in `backend/api/views.py`:
  - [ ] `InstructorRequestCreateAPIView`
  - [ ] `AdminInstructorRequestListAPIView`
  - [ ] `AdminInstructorRequestApproveAPIView`
  - [ ] `AdminInstructorRequestRejectAPIView`
- [ ] Add URL routes in `backend/api/urls.py`
- [ ] Apply migrations: `python manage.py migrate`
- [ ] Test all endpoints with Postman/curl

### Frontend
- [ ] Create `InstructorRequestModal.jsx` component
- [ ] Create `InstructorRequestsReview.jsx` admin component
- [ ] Update `Search.jsx` to use modal instead of email
- [ ] Add menu item to admin header for requests review
- [ ] Test modal: login/logout flows
- [ ] Test admin approval/rejection
- [ ] Test student notification

### Testing
- [ ] Student creates request when logged in
- [ ] Student sees error if not logged in
- [ ] Student can't create duplicate pending request
- [ ] Admin sees pending requests list
- [ ] Admin can approve (confirms instructor role granted)
- [ ] Admin can reject with reason
- [ ] Rejected student sees reason and can reapply
- [ ] Approved student gets Teacher object created
- [ ] Approved student can access instructor menu

---

## 🔗 REFERENCES

### Existing Similar Systems
1. **Course Approval Workflow** (PHASE 4.36+)
   - Location: `backend/api/views.py` line 4306
   - Reference for: Status workflow, admin review pattern, rejection reasons

2. **Testimonial Approval** (PHASE 4.12)
   - Location: `backend/api/views.py` line 7208
   - Reference for: Admin curation pattern, approve/reject endpoints

3. **User Role System** (PHASE 4.10)
   - Location: `backend/userauths/models.py` line 45
   - Reference for: Role management, boolean role fields

4. **SelectRoleAPIView** (PHASE 4.20+)
   - Location: `backend/api/views.py` line 7636
   - Reference for: Role switching mechanism

---

## 📝 KEY DECISIONS

1. **Database Persistence**: Store in InstructorRequest model (not just email)
2. **Approval Workflow**: Structured like Course Approval (PHASE 4.36)
3. **Status Values**: PENDING → APPROVED/REJECTED (vs PENDING in courses)
4. **Teacher Creation**: Auto-create on approval (simplifies access)
5. **Role Granting**: Set `is_instructor=True` + add to roles field
6. **User Notification**: Show modal on rejection with reason + allow reapply
7. **Admin Access**: Requires admin role (same permission as course approval)

---

## ✅ SUCCESS CRITERIA

- ✅ Students can request instructor role through modal (not email)
- ✅ Request persisted in database with all details
- ✅ Admin has dedicated panel to review requests
- ✅ Admin can approve with one click (auto-grants role)
- ✅ Admin can reject with custom reason
- ✅ Rejected students see reason and can reapply
- ✅ Approved students get Teacher object + instructor menu access
- ✅ System prevents duplicate pending requests per user

---

**Next Steps**: Implement backend models and API views (PART 1)
