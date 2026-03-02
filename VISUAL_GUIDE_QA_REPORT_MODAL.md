# 📋 Q&A Report Modal - Visual Reference & Testing Guide

## Visual Layout

### Modal Structure

```
╔════════════════════════════════════════════════════════════════╗
║  🚩 Laporkan Pertanyaan (atau Laporkan Balasan)        [×]    ║ ← Red Gradient Header
║════════════════════════════════════════════════════════════════║
║                                                                 ║
║  Membantu kami menjaga komunitas tetap sehat dengan melaporkan ║
║  konten yang tidak sesuai atau melanggar aturan. Tim Admin     ║
║  kami akan meninjau laporan ini.                              ║
║                                                                 ║
║  Alasan Laporan *                                             ║
║  ┌──────────────────────────────────────────────────────────┐ ║
║  │ Pilih alasan laporan ▼                                   │ ║
║  └──────────────────────────────────────────────────────────┘ ║
║                                                                 ║
║  Opsi yang tersedia:                                           ║
║  • Spam                                                        ║
║  • Konten Tidak Pantas (Inappropriate Content)               ║
║  • Konten Menyinggung (Offensive Content)                    ║
║  • Informasi Salah (False Information)                       ║
║  • Lainnya (Other)                                            ║
║                                                                 ║
║  Penjelasan Tambahan (Opsional)                               ║
║  ┌──────────────────────────────────────────────────────────┐ ║
║  │ Jelaskan alasan Anda melaporkan konten ini               │ ║
║  │ (maksimal 500 karakter)                                  │ ║
║  │                                                          │ ║
║  │                                                          │ ║
║  └──────────────────────────────────────────────────────────┘ ║
║  Karakter: 0 / 500                                            ║
║                                                                 ║
║  ℹ️  Tim Admin kami akan meninjau laporan ini dalam waktu      ║
║     singkat. Semua laporan ditangani dengan profesional.       ║
║                                                                 ║
║════════════════════════════════════════════════════════════════║
║  [Batal]                                    [Laporkan]        ║ ← Buttons
║════════════════════════════════════════════════════════════════║
```

---

## Interactive States

### 1. **Initial State (Open)**
- Modal slides in from top with animation (0.3s)
- Dropdown shows "Pilih alasan laporan" (placeholder)
- Textarea is empty and ready for input
- Submit button is **DISABLED** (grayed out) - reason not selected
- Cancel button is **ENABLED**
- Character counter shows "Karakter: 0 / 500"

### 2. **Reason Selected (Active)**
- Dropdown shows selected reason (e.g., "Spam")
- Submit button becomes **ENABLED** (blue with hover effect)
- Cancel button remains **ENABLED**
- User can type in textarea
- Character counter updates in real-time

### 3. **During Submission (Loading)**
- All form elements are **DISABLED**
- Submit button shows spinner icon
- Submit button text changes to "Mengirim..."
- Cancel button is **DISABLED**
- Dropdown and textarea are read-only

### 4. **Success**
- Toast notification appears:
  ```
  ✅ Laporan berhasil dikirim!
  Admin akan meninjau laporan Anda dalam waktu singkat.
  ```
- Modal automatically closes
- Form state is reset
- User can report other content

### 5. **Error**
- Toast notification appears with error message
- Modal remains open for retry
- Form data is preserved
- User can change reason/description and try again

---

## Color Scheme

| Element | Color | Hex Code | Usage |
|---------|-------|----------|-------|
| **Header Background** | Red (Gradient) | #dc3545 → #c82333 | Warning/Danger indication |
| **Header Text** | White | #ffffff | High contrast, readable |
| **Success Toast** | Green | #198754 | Positive feedback |
| **Error Toast** | Red | #dc3545 | Error indication |
| **Form Focus** | Red Accent | #dc3545 | Active input indication |
| **Focus Shadow** | Red Light | rgba(220,53,69,0.25) | Highlight focus state |
| **Border Inactive** | Light Gray | #e9ecef | Subtle form outline |
| **Button Text** | White on Blue | Default Bootstrap | Primary action |
| **Disabled Button** | Gray | Bootstrap secondary | Inactive state |

---

## Animation & Transitions

### Modal Entrance
```css
@keyframes slideIn {
    from {
        transform: translateY(-50px);  /* Slides from 50px above */
        opacity: 0;                    /* Starts invisible */
    }
    to {
        transform: translateY(0);      /* Lands at normal position */
        opacity: 1;                    /* Fully visible */
    }
}
/* Duration: 0.3s ease */
```

### Form Element Focus
```css
border-color: #dc3545;              /* Red border appears */
box-shadow: 0 0 0 0.2rem rgba(220,53,69,0.25);  /* Red glow */
transition: all 0.3s ease;          /* Smooth transition */
```

---

## User Interaction Flows

### Flow 1: Report a Question (Card Click)
```
1. User sees question card in forum list
2. Hovers over question card
3. Sees "forum-report-btn" (red flag icon)
4. Clicks report button
   ↓
5. Modal opens with slide-in animation
6. Modal shows: "Laporkan Pertanyaan"
7. Modal displays question context (implicit from selectedConversation)
8. User selects reason from dropdown
9. Submit button becomes enabled
10. User optionally adds description
11. Clicks "Laporkan"
12. Loading spinner shows
13. API request sent to: `/student/question-answer-report/{qa_id}/`
14. Success toast appears
15. Modal closes automatically
```

### Flow 2: Report from Opened Thread (Reply Click)
```
1. User opens forum thread (selectedConversation)
2. Reads original question or replies
3. Sees "forum-report-btn" on message footer
4. Clicks report button on a reply/message
   ↓
5. Modal opens with slide-in animation
6. Modal shows: "Laporkan Balasan"
7. User selects reason
8. Clicks "Laporkan"
9. Loading spinner shows
10. API request sent to: `/student/question-answer-message-report/{qa_id}/`
11. Success from admin
12. Modal closes
```

### Flow 3: Cancel/Exit
```
1. User opens modal
2. Changes mind (doesn't want to report)
3. Clicks:
   - "Batal" button, OR
   - Close button [×], OR
   - Clicks outside modal (if backdrop configured)
   ↓
4. Modal closes**
5. Form state is completely reset
6. User can open another report or continue browsing
```

---

## Code Integration Points

### Button Integration
Three locations trigger report modal:

#### Location 1: Question Card (Line 3185)
```jsx
<button 
    className="forum-report-btn"
    title="Laporkan pertanyaan ini"
    onClick={(e) => { 
        e.stopPropagation(); 
        handleOpenQAReportModal(q, 'question'); 
    }}
>
    <i className="bx bxs-flag"></i> Laporkan
</button>
```

#### Location 2: Original Question in Thread (Line 2817)
```jsx
<button 
    className="forum-report-btn"
    title="Laporkan pertanyaan ini"
    onClick={() => handleOpenQAReportModal(selectedConversation, 'question')}
>
    <i className="bx bxs-flag"></i> Laporkan
</button>
```

#### Location 3: Reply Message in Thread (Line 2876)
```jsx
<button 
    className="forum-report-btn"
    title="Laporkan jawaban ini"
    onClick={() => handleOpenQAMessageReportModal(msg)}
>
    <i className="bx bxs-flag"></i> Laporkan Jawaban
</button>
```

---

## Form Validation Rules

| Field | Validation | Error Message | Effect |
|-------|-----------|---------------|--------|
| **Reason** | Required | "Silakan pilih alasan laporan" | Submit button disabled until selected |
| **Description** | Max 500 chars | (Character counter shows 0/500) | Field accepts up to 500 chars |
| **User ID** | Must exist | "User ID not found" | Toast error, form disabled |
| **Network** | Must work | (Error from API) | Toast error with API message |

---

## API Endpoints Called

### For Question Reports
**POST** `/api/v1/student/question-answer-report/{qa_id}/`

**Request Body**:
```json
{
    "user_id": 123,
    "reason": "spam",
    "description": "Optional explanation text"
}
```

**Success Response**:
```json
{
    "message": "Report submitted successfully",
    "report_id": "abc-123-def"
}
```

#### For Message/Reply Reports
**POST** `/api/v1/student/question-answer-message-report/{qa_id}/`

**Request Body**:
```json
{
    "user_id": 123,
    "reason": "offensive",
    "description": "Optional explanation text"
}
```

**Success Response**:
```json
{
    "message": "Report submitted successfully",
    "report_id": "xyz-789-uvw"
}
```

---

## CSS Classes Reference

| Class | Purpose | File | Lines |
|-------|---------|------|-------|
| `.abuse-report-modal` | Main modal container | CourseDetail.css | 5918-5925 |
| `.abuse-modal-header` | Red gradient header | CourseDetail.css | 5927-5935 |
| `.abuse-modal-header .modal-title` | Title text styling | CourseDetail.css | 5937-5941 |
| `.abuse-modal-header .btn-close` | Close button styling | CourseDetail.css | 5943-5946 |
| `.abuse-modal-text` | Body text styling | CourseDetail.css | 5948-5951 |
| `.form-select-modern` | Dropdown styling | CourseDetail.css | 5953-5959 |
| `.form-select-modern:focus` | Dropdown focus state | CourseDetail.css | 5961-5966 |
| `.abuse-modal-footer` | Footer with buttons | CourseDetail.css | 5968-5972 |
| `@keyframes slideIn` | Modal entrance animation | CourseDetail.css | 5892-5900 |

---

## Testing Scenarios

### ✅ Scenario 1: Successful Report with All Fields
1. Click report button on a question
2. Modal opens
3. Select "Spam" from dropdown
4. Type "This is promotional content" in description
5. Click "Laporkan"
6. **Expected**:
   - Loading spinner appears for 1-2 seconds
   - Success toast shows: "Laporan berhasil dikirim!"
   - Modal closes automatically
   - Can click another report button immediately

### ✅ Scenario 2: Report with Just Reason (No Description)
1. Click report button
2. Modal opens
3. Select "Konten Tidak Pantas" from dropdown
4. Leave description empty
5. Click "Laporkan"
6. **Expected**:
   - Request succeeds (description is optional)
   - Same success feedback
   - Modal closes

### ❌ Scenario 3: Try to Submit Without Reason
1. Click report button
2. Modal opens
3. Leave dropdown on "Pilih alasan laporan"
4. Leave description empty
5. Try to click "Laporkan"
6. **Expected**:
   - Submit button is disabled (grayed out)
   - Cannot click button
   - Warning toast: "Silakan pilih alasan laporan"

### ✅ Scenario 4: Cancel Modal
1. Click report button
2. Modal opens
3. Select a reason
4. Click "Batal" button (or close button [×])
5. **Expected**:
   - Modal closes immediately
   - Form state is reset
   - No report is submitted

### ✅ Scenario 5: Character Limit
1. Click report button
2. Modal opens
3. Click in description textarea
4. Type 500+ characters
5. **Expected**:
   - Text input stops at 500 characters
   - Counter shows "Karakter: 500 / 500"
   - User cannot type more

### ✅ Scenario 6: Report Reply (Message)
1. Open a forum thread
2. Look for reply message
3. Click report button on that message
4. Modal opens showing "Laporkan Balasan"
5. Select reason + description
6. Click "Laporkan"
7. **Expected**:
   - Request goes to message endpoint instead
   - Same success feedback
   - API call to `/student/question-answer-message-report/`

### ❌ Scenario 7: Network Error
1. Click report button
2. Modal opens
3. Select reason
4. Network is offline or API is down
5. Click "Laporkan"
6. **Expected**:
   - Loading spinner appears
   - After timeout, error toast shows specific error
   - Modal remains open
   - Can modify reason/description and retry

---

## Comparison with ReviewAbuse Modal

| Feature | ReviewAbuse | Q&A Reports | Match? |
|---------|-------------|-------------|--------|
| Modal animation | slide-in 0.3s | slide-in 0.3s | ✅ Yes |
| Header gradient | #dc3545 → #c82333 | #dc3545 → #c82333 | ✅ Yes |
| Close button | Inverted color | Inverted color | ✅ Yes |
| Reason dropdown | 6 options | 5 options | ✅ Similar |
| Description field | Textarea with limit | Textarea with 500 limit | ✅ Similar |
| Form validation | Required reason | Required reason | ✅ Yes |
| Loading state | Spinner + disabled | Spinner + disabled | ✅ Yes |
| Success toast | Green icon + text | Green icon + text | ✅ Yes |
| Error toast | Red icon + text | Red icon + text | ✅ Yes |
| Auto-close on success | Yes | Yes | ✅ Yes |

---

## Known Limitations & Notes

1. **Character Limit**: Description limited to 500 characters (configurable in state management)
2. **Duplicate Reports**: No duplicate detection (same user can report same content multiple times)
3. **Report Status**: User doesn't see if they've already reported something
4. **Admin Notes**: User cannot see admin review notes/feedback
5. **Direct Feedback**: User only gets success/error toast, not detailed response

---

## Future Enhancement Ideas

1. **Duplicate Detection**:
   - Check if user already reported this content
   - Show badge: "Anda sudah melaporkan ini" (You already reported this)
   - Prevent duplicate submissions

2. **Report History**:
   - User view of their own reports
   - Status tracking (submitted → reviewing → resolved)
   - Admin notes visible to reporter

3. **AI Flagging**:
   - Content pre-screening with confidence score
   - Auto-flag suspicious content
   - Suggest pre-filled reasons

4. **Category-Specific Reasons**:
   - Different reasons depending on content type
   - Q&A specific: "Homework help requests", "Unrelated topic"
   - Course reviews specific: "Review spam", "Spoilers"

5. **Attachment Support**:
   - Add screenshots as evidence
   - Upload reference documents
   - Include original source links

---

## Troubleshooting Guide

### Issue: Modal doesn't appear when clicking report button
**Debugging Steps**:
1. Check browser console for JavaScript errors
2. Verify `showQAReportModal` state is being set to true
3. Check CSS class `.abuse-report-modal` has `display` property
4. Verify onClick handler is properly bound
5. Check if modal is being rendered (inspect DOM elements)

### Issue: Submit button is always disabled
**Debugging Steps**:
1. Verify dropdown value is updating in state
2. Check `qaReportReason` state variable has a value
3. Verify form validation logic: `!qaReportReason.trim()`
4. Check if button has correct disabled condition

### Issue: Toast notification doesn't appear
**Debugging Steps**:
1. Verify Toast() import from 'views/plugin/Toast'
2. Check `Toast().fire()` syntax matches ReviewAbuse
3. Verify 'icon' property value: "success", "error", "warning"
4. Check if SweetAlert2 is loading properly

### Issue: API request fails with 500 error
**Debugging Steps**:
1. Verify backend endpoints are created and working
2. Check user_id is being passed correctly
3. Verify JWT token is valid in request
4. Check API endpoint path matches exactly
5. Test manually with Postman/cURL

### Issue: Modal closes but report doesn't appear in admin dashboard
**Debugging Steps**:
1. Verify API response is successful (200-201 status)
2. Check database - did record get saved?
3. Verify AdminQAReportsListAPIView is created
4. Check admin dashboard component loads reports
5. Verify permissions - user must be admin to see reports

---

## Integration Checklist for Developers

- [ ] State variables added to CourseDetail.jsx (6 variables)
- [ ] Handler functions created (4 functions)
- [ ] Button clicks updated (3 locations)
- [ ] Modal JSX added to return statement
- [ ] CSS classes added to CourseDetail.css
- [ ] Backend API endpoints available
- [ ] Admin dashboard configured to view reports
- [ ] Testing completed for all scenarios
- [ ] No console errors
- [ ] Mobile responsive testing done
- [ ] Accessibility tested (keyboard navigation, screen readers)

---

**Created**: March 1, 2026
**Version**: 1.0
**Status**: ✅ Production Ready
