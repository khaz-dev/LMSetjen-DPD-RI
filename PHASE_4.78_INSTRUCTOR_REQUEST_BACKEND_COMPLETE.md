# PHASE 4.78: Instructor Request System - Implementation Complete (BACKEND)

**Date**: February 22, 2026
**Status**: ✅ BACKEND COMPLETE | ⏳ FRONTEND PENDING
**Implementation**: Deep scan + Analysis + Backend coding

---

## 📊 COMPLETE ISSUE ANALYSIS

### Problem Identified
On `/search/` page, clicking "Mulai Mengajar" button shows a SweetAlert2 popup asking user to send email manually. 

**Issues**:
- ❌ No database persistence of requests
- ❌ No admin approval/rejection system
- ❌ No role automatic granting
- ❌ No tracking or notifications
- ❌ Doesn't check if user is logged in first
- ❌ Not scalable (manual email handling)

### Root Cause
- `handleStartTeaching()` function in Search.jsx only triggers an email client
- No backend model, serializers, or views to handle role requests
- No admin panel to review requests

---

## ✅ BACKEND IMPLEMENTATION COMPLETE

### 1. Database Model Created
**File**: `backend/api/models.py` (lines 2638-2785)
**Class**: `InstructorRequest`

Features:
- ✅ User ForeignKey (student requesting to be instructor)
- ✅ Status tracking: PENDING → APPROVED/REJECTED
- ✅ Fields: expertise_areas, bio, experience_level
- ✅ Admin review fields: reviewed_by, reviewed_date, rejection_reason
- ✅ Methods:
  - `approve(reviewed_by)` - Auto-grants instructor role + creates Teacher object
  - `reject(reviewed_by, reason)` - Stores rejection reason
  - `can_user_request()` - Prevents duplicate pending requests

### 2. Database Migration Applied
**File**: `backend/api/migrations/0041_instructorrequest.py`
- ✅ Migration created automatically
- ✅ Migration applied to PostgreSQL database successfully

### 3. Serializers Created
**File**: `backend/api/serializer.py` (lines 1698-1812)

3 Serializer Classes:
1. **InstructorRequestCreateSerializer**
   - Use: Student creates new request
   - Fields: expertise_areas, bio, experience_level
   - Validation: Checks if user can request (not instructor, no pending request)

2. **InstructorRequestDetailSerializer**
   - Use: Student views their own request status
   - Fields: Full request details + user info
   - Read-only: Prevents students from modifying request

3. **AdminInstructorRequestListSerializer**
   - Use: Admin views pending requests
   - Fields: All request details + admin review fields
   - Includes: reviewed_by_name, reviewed_date, rejection_reason

4. **AdminInstructorRequestActionSerializer**
   - Use: Validation for admin approve/reject actions
   - Fields: action (approve/reject), rejection_reason
   - Validation: Ensures rejection_reason provided if action=reject

### 4. API Views Implemented
**File**: `backend/api/views.py` (lines 8185-8388)

**5 API Views**:

#### 1. **InstructorRequestCreateAPIView** (POST)
```
POST /api/v1/instructor-request/
Authenticated: Required
Role: Any authenticated user

Request Body:
{
  "expertise_areas": "Python, Django, REST APIs",
  "bio": "5 years of full-stack development experience",
  "experience_level": "ADVANCED"
}

Response: 201 Created
{
  "id": 1,
  "expertise_areas": "...",
  "bio": "...",
  "experience_level": "ADVANCED",
  "request_date": "2026-02-22T10:30:00Z",
  "status": "PENDING"
}
```

#### 2. **InstructorRequestDetailAPIView** (GET)
```
GET /api/v1/instructor-request/{request_id}/
Authenticated: Required
Role: Only student can view their own request

Response: 200 OK
{
  "id": 1,
  "user_id": 123,
  "user_name": "John Doe",
  "user_email": "john@example.com",
  "expertise_areas": "...",
  "bio": "...",
  "request_date": "2026-02-22T10:30:00Z",
  "status": "PENDING",
  "rejection_reason": null
}
```

#### 3. **AdminInstructorRequestListAPIView** (GET)
```
GET /api/v1/admin/instructor-requests/?status=PENDING
Authenticated: Required
Role: Admin only

Query Parameters:
- status: PENDING (default), APPROVED, REJECTED

Response: 200 OK
{
  "count": 5,
  "next": "...",
  "previous": null,
  "results": [
    {
      "id": 1,
      "user_id": 123,
      "user_name": "John Doe",
      "expertise_areas": "...",
      "status": "PENDING",
      "request_date": "2026-02-22T10:30:00Z",
      ...
    },
    ...
  ]
}
```

#### 4. **AdminInstructorRequestApproveAPIView** (POST)
```
POST /api/v1/admin/instructor-request/{request_id}/approve/
Authenticated: Required
Role: Admin only

Response: 200 OK
{
  "success": true,
  "message": "Permintaan instruktur dari John Doe telah disetujui",
  "request": {
    "id": 1,
    "status": "APPROVED",
    "reviewed_by": 5,
    "reviewed_by_name": "Admin User",
    "reviewed_date": "2026-02-22T11:00:00Z",
    ...
  }
}

Side Effects:
- User.is_instructor = True
- User.roles += 'teacher'
- Teacher object created (or existing one kept)
- Status: PENDING → APPROVED
```

#### 5. **AdminInstructorRequestRejectAPIView** (POST)
```
POST /api/v1/admin/instructor-request/{request_id}/reject/
Authenticated: Required
Role: Admin only

Request Body:
{
  "rejection_reason": "Pengalaman masih kurang. Silahkan coba lagi setelah 1 tahun."
}

Response: 200 OK
{
  "success": true,
  "message": "Permintaan instruktur dari John Doe telah ditolak",
  "request": {
    "id": 1,
    "status": "REJECTED",
    "rejection_reason": "...",
    "reviewed_by": 5,
    "reviewed_date": "2026-02-22T11:00:00Z",
    ...
  }
}

Side Effects:
- User role unchanged (still student)
- Status: PENDING → REJECTED
- Reason stored for student to see
```

### 5. URL Routes Registered  
**File**: `backend/api/urls.py` (lines 218-223)

```python
# ✨ PHASE 4.78: Instructor Request System endpoints
path("instructor-request/", InstructorRequestCreateAPIView.as_view()),
path("instructor-request/<int:request_id>/", InstructorRequestDetailAPIView.as_view()),
path("admin/instructor-requests/", AdminInstructorRequestListAPIView.as_view()),
path("admin/instructor-request/<int:request_id>/approve/", AdminInstructorRequestApproveAPIView.as_view()),
path("admin/instructor-request/<int:request_id>/reject/", AdminInstructorRequestRejectAPIView.as_view()),
```

---

## 🔄 COMPLETE WORKFLOW

### User Journey - Student (Frontend TBD)

1. **Not Logged In**
   - Clicks "Mulai Mengajar" button
   - Shows: "Silahkan login terlebih dahulu" (Login first)
   - Redirected to login modal

2. **Logged In - First Time**
   - Clicks "Mulai Mengajar" button
   - Shows: Form with fields:
     - "Bidang Keahlian" (text field)
     - "Biografi Singkat" (textarea)
     - "Tingkat Pengalaman" (dropdown: Pemula/Menengah/Lanjutan)
     - Submit button
   - Backend: POST /api/v1/instructor-request/
   - Response: status=PENDING, stored in database
   - Toast: "Permintaan Anda telah dikirim. Admin akan meninjau dalam 1-2 hari kerja"

3. **Has Pending Request**
   - Clicks "Mulai Mengajar" button
   - Shows: "Anda sudah memiliki permintaan yang menunggu review"
   - Cannot submit new request (backend validation)

4. **Request Rejected**
   - Sees: Status page with rejection reason
   - Can reapply: Rejection reason shows why, can fix and resubmit

5. **Request Approved**
   - Notification: Email + dashboard notification
   - Dashboard update: Can now see "Buat Materi" button
   - Menu: Access instructor-only menu items
   - Teacher object created in database

### Admin Journey - Review Panel (Frontend TBD)

1. **Access Panel**
   - Navigate to: /admin/instructor-requests/
   - See: List of pending requests
   - API: GET /api/v1/admin/instructor-requests/?status=PENDING

2. **Review Request**
   - Click on request card
   - See: Full student details:
     - Name, email, NIP (if applicable)
     - Expertise areas, bio, experience level
     - Request date

3. **Approve Request**
   - Click "Terima" button
   - Confirmation dialog: "Setujui permintaan ini?"
   - API: POST /api/v1/admin/instructor-request/{id}/approve/
   - Auto-result:
     - User.is_instructor = True
     - User.roles updated
     - Teacher object created
     - Request.status = APPROVED
   - Toast: "Instruktur berhasil ditambahkan"

4. **Reject Request**
   - Click "Tolak" button
   - Dialog opens: "Alasan penolakan?"
   - Text field for reason
   - API: POST /api/v1/admin/instructor-request/{id}/reject/ + reason
   - Student can see reason + reapply

5. **View History**
   - Filter: ?status=APPROVED (approved requests)
   - Filter: ?status=REJECTED (rejected requests)
   - View who approved/rejected and when

---

## 🧪 TESTING THE BACKEND

### Test 1: Create Instructor Request
```bash
curl -X POST http://localhost:8001/api/v1/instructor-request/ \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "expertise_areas": "Python, Django",
    "bio": "5 years experience",
    "experience_level": "ADVANCED"
  }'

Expected: 201 Created
```

### Test 2: List Pending Requests (Admin)
```bash
curl -X GET http://localhost:8001/api/v1/admin/instructor-requests/?status=PENDING \
  -H "Authorization: Bearer {ADMIN_JWT_TOKEN}"

Expected: 200 OK with list of pending requests
```

### Test 3: Approve Request (Admin)
```bash
curl -X POST http://localhost:8001/api/v1/admin/instructor-request/1/approve/ \
  -H "Authorization: Bearer {ADMIN_JWT_TOKEN}"

Expected: 200 OK, user gets instructor role
```

### Test 4: Reject Request (Admin)
```bash
curl -X POST http://localhost:8001/api/v1/admin/instructor-request/1/reject/ \
  -H "Authorization: Bearer {ADMIN_JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"rejection_reason": "Pengalaman kurang"}'

Expected: 200 OK, reason stored
```

---

## 📋 BACKEND CHECKLIST ✅

- ✅ InstructorRequest model created with all fields
- ✅ Model validation methods (approve, reject, can_user_request)
- ✅ Database migration created and applied
- ✅ 4 serializers for different use cases
- ✅ 5 API views for complete CRUD operations
- ✅ Permission classes (IsAuthenticated, IsAdminUser)
- ✅ URL routes registered
- ✅ Django check: No errors
- ✅ All imports correct
- ✅ Response formats documented

---

## ⏳ NEXT STEPS (FRONTEND - PHASE 4.78 PART 2)

### Components to Build:

1. **InstructorRequestModal.jsx**
   - Form to collect: expertise_areas, bio, experience_level
   - Validation
   - API call to POST /api/v1/instructor-request/
   - Success/error handling

2. **InstructorRequestStatus.jsx**
   - Show request status
   - Display rejection reason if rejected
   - Reapply button

3. **AdminInstructorRequestPanel.jsx** (in admin section)
   - List of pending requests in card format
   - Approve button
   - Reject button with modal for reason
   - Filter by status

4. **Update Search.jsx**
   - Replace email logic with modal
   - Check if user logged in first
   - Handle not-logged-in case

### Files to Modify:

- `frontend/src/views/base/Search.jsx` - handleStartTeaching function
- `frontend/src/components/InstructorRequestModal.jsx` - NEW
- `frontend/src/views/admin/InstructorRequestsReview.jsx` - NEW (or add to ContentManagement)
- Update admin menu to include link

---

## 📊 SUMMARY

### What Was Done
✅ **Deep Scan Complete** - Found exact cause: no backend system for requests
✅ **Comprehensive Analysis** - Created PHASE_4.78_INSTRUCTOR_REQUEST_SYSTEM_ANALYSIS.md
✅ **Backend Implementation** - Full CRUD system with approval workflow
✅ **Database Schema** - InstructorRequest model with relationships
✅ **API Complete** - 5 endpoints for create, read, approve, reject
✅ **Serializers** - 4 serializers for different use cases
✅ **Validation** - Permission checks, form validation, status workflows
✅ **Documentation** - All endpoints and flows documented

### What's Remaining
⏳ **Frontend Components** - Modal, admin panel, status display
⏳ **Integration** - Connect frontend to backend APIs
⏳ **Testing** - End-to-end testing

---

## 🔗 KEY FILES

**Created/Modified**:
- ✅ `backend/api/models.py` - InstructorRequest model
- ✅ `backend/api/migrations/0041_instructorrequest.py` - Database migration
- ✅ `backend/api/serializer.py` - 4 serializer classes
- ✅ `backend/api/views.py` - 5 API view classes
- ✅ `backend/api/urls.py` - 5 URL routes
- ✅ `PHASE_4.78_INSTRUCTOR_REQUEST_SYSTEM_ANALYSIS.md` - Full analysis doc

---

**Status**: Backend ✅ READY | Frontend ⏳ NEXT
