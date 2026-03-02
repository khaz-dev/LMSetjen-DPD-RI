# Instructor Report Button Behavior - Before vs After Comparison

## Visual Flow Comparison

### BEFORE (Problem): Always Shows Form
```
User clicks report button
        ↓
Modal opens with FORM
(even if report already exists)
        ↓
User fills form again
        ↓
Report gets replaced/duplicated
        ↓
NO indication of previous report
```

### AFTER (Solution): Shows Status or Form Based on Existence
```
User clicks report button
        ↓
Check if report exists in qaReports.question_reports
        ├─ YES → Modal shows STATUS PAGE
        │         ├─ Status badge (pending/reviewed/action_taken/dismissed)
        │         ├─ Report reason & description  
        │         ├─ Report date
        │         ├─ Admin feedback (if reviewed)
        │         └─ "Edit Laporan" button (if pending)
        │
        └─ NO → Modal shows FORM
                  ├─ Reason dropdown
                  ├─ Description textarea
                  └─ "Kirim Laporan" button

                    After submission:
                    Modal closes → Refetch reports → Modal reopens
                    Now shows STATUS PAGE with "Menunggu Tinjauan"
```

---

## Implementation Components

### 1. State Variables
```
BEFORE:
- showReportModal ✓
- reportingQuestion ✓
- reportReason ✓
- reportDescription ✓
- isSubmittingReport ✓
- qaReports ✓

AFTER: Added
+ currentReportData (holds existing report object)
+ editingReportId (tracks if editing mode)
+ closedReports (prevents re-editing finalized reports)
```

### 2. Modal Opening Logic
```
BEFORE:
handleOpenReportModal(question) {
    setShowReportModal(true)
    // No check for existing reports
}

AFTER:
handleOpenReportModal(question) {
    const existingReport = qaReports?.question_reports?.find(
        r => r.question__qa_id === question.qa_id
    )
    if (existingReport) {
        setCurrentReportData(existingReport)  // Show status page
    } else {
        setCurrentReportData(null)             // Show form
    }
}
```

### 3. Report Submission
```
BEFORE:
handleSubmitReport() {
    POST /api/.../question-answer-report/{qaId}/
    Toast success
    Close modal
    // Report could be created multiple times
}

AFTER:
handleSubmitReport() {
    if (editingReportId) {
        PUT (update existing)
    } else {
        POST (create new)
    }
    Toast success (different message for edit vs new)
    Close modal
    Refetch reports   ← KEY: Get fresh data from server
    Reopen modal      ← SO: User sees status page, not form
}
```

### 4. Modal Content Rendering
```
BEFORE JSX:
<Modal header>Laporkan Pertanyaan</Modal header>
<Modal body>
  <Form reason + description fields>
</Modal body>
<Modal footer>
  <Button>Batal</Button>
  <Button>Kirim Laporan</Button>
</Modal footer>

AFTER JSX:
<Modal header>
  {currentReportData ? "Status Laporan" : "Laporkan Pertanyaan"}
</Modal header>
<Modal body>
  {currentReportData && !editingReportId ? (
    <>
      <StatusSection>
        <StatusBadge status={status} />
        <ReasonDisplay />
        <DescriptionDisplay />
        <ReportDateDisplay />
        {reviewed_at && <AdminFeedbackSection />}
      </StatusSection>
    </>
  ) : (
    <>
      <FormSection>
        <ReasonSelect />
        <DescriptionTextarea />
      </FormSection>
    </>
  )}
</Modal body>
<Modal footer>
  {currentReportData && !editingReportId ? (
    <>
      <Button>Tutup</Button>
      {status === 'pending' && <Button onClick={handleEditQAReport}>Edit Laporan</Button>}
    </>
  ) : (
    <>
      <Button>Batal</Button>
      <Button onClick={handleSubmitReport}>Kirim/Perbarui Laporan</Button>
    </>
  )}
</Modal footer>
```

---

## Key Feature: Modal Reopening Logic

### Why This Is Important

**Problem Scenario (Before)**:
1. User submits new report
2. Toast success appears
3. Modal closes
4. User clicks report button again
5. **Modal shows FORM again** ❌
6. User confused: "Did my report get saved?"

**Solution (After)**:
1. User submits new report
2. Toast success appears
3. Modal closes
4. Page calls `fetchQAReports(selectedCourse)` → Refresh from server
5. Modal automatically reopens
6. **Modal shows STATUS PAGE** ✅
7. User sees "Menunggu Tinjauan" - Proof report was saved!

### Implementation

```javascript
// After successful submission:
setTimeout(() => {
    // 100ms delay
    fetchQAReports(selectedCourse);  // Fetch fresh from server
    
    setTimeout(() => {
        // 600ms delay (total 700ms)
        setShowReportModal(true);    // Reopen modal
        // At this point, qaReports has been updated
        // So handleOpenReportModal will find currentReportData
    }, 600);
}, 100);
```

---

## Modal Display Modes

### Mode 1: Status Page (When Report Exists)

**Example Header**:
```
Status Laporan Pertanyaan
╳ (close button)
```

**Example Body**:
```
Status Laporan: [🕐 Menunggu Tinjauan]

┌─────────────────────────────────┐
│ Alasan yang Dilaporkan:         │
│ 🚫 Spam                         │
│                                  │
│ Deskripsi Laporan:              │
│ Konten ini mempromosikan produk │
│ yang tidak relevan dengan kursus │
│                                  │
│ Tanggal Lapor:                  │
│ 2 Maret 2024 14:30              │
└─────────────────────────────────┘

ℹ️ Laporan ini sedang dalam proses tinjauan. 
   Tim Admin kami akan memberikan umpan balik...
```

**Example Footer (Pending)**:
```
[Tutup]  [Edit Laporan]
```

**Example Footer (Reviewed)**:
```
[Tutup]
(No Edit button for reviewed reports)
```

---

### Mode 2: Report Form (When No Report Exists)

**Example Header**:
```
Laporkan Pertanyaan
╳ (close button)
```

**Example Body**:
```
Bantu kami menjaga kualitas komunitas dengan 
melaporkan konten yang tidak sesuai.

Alasan Laporan *
[-- Pilih Alasan ▼]
  · Spam
  · Konten Tidak Pantas
  · Konten Menyinggung
  · Informasi Salah
  · Lainnya

Penjelasan Tambahan (Opsional)
┌──────────────────────────────────┐
│                                   │
│ (3 lines textarea)                │
│                                   │
└──────────────────────────────────┘
Maksimal 500 karakter

ℹ️ Tim Admin kami akan meninjau laporan ini 
   dan mengambil tindakan yang sesuai.
```

**Example Footer (New Report Form)**:
```
[Batal]  [🚩 Kirim Laporan]
```

**Example Footer (Editing Existing Report)**:
```
[Batal]  [🚩 Perbarui Laporan]
With blue info box: "Anda sedang mengedit laporan Anda..."
```

---

## Status Badges

The modal shows different badges based on report status:

### Status: Pending (Yellow)
```
🕐 Menunggu Tinjauan
Message: "Laporan ini sedang dalam proses tinjauan. Tim Admin kami akan memberikan umpan balik dalam waktu singkat."
Can Edit: YES
```

### Status: Reviewed (Blue)
```
👁️ Sudah Ditinjau
Admin Feedback Section Shows:
  - Ditinjau Pada: [date]
  - Ditinjau Oleh: [admin name]
  - Catatan Admin: [feedback text]
Can Edit: NO
```

### Status: Action Taken (Green)
```
✓ Tindakan Diambil
(Shows admin feedback section)
Can Edit: NO
```

### Status: Dismissed (Gray)
```
✗ Ditolak
(Shows admin feedback section explaining why)
Can Edit: NO
```

---

## Complete User Journey - Happy Path

### User Experience Flow

```
📱 STEP 1: Initial Report
┌────────────────────────────────┐
│ Instructor Q&A Page            │
│ [Question Card 1]              │
│ ├─ Like Button                 │
│ └─ [🚩 Report Button]  ← User clicks
│ [Question Card 2]              │
└────────────────────────────────┘
           ↓
┌────────────────────────────────┐
│ 📋 Modal Opens                  │
│ Title: Laporkan Pertanyaan      │
│ Body: [Form with dropdown]      │
│ ├─ Reason: [-- Pilih Alasan --] ← User selects "Spam"
│ ├─ Description: [textarea]      ← User enters details
│ Footer: [Batal] [Kirim Laporan] ← User clicks submit
└────────────────────────────────┘
           ↓
┌────────────────────────────────┐
│ ✅ Success Toast                │
│ "Laporan berhasil dikirim!"     │
│ "Admin akan meninjau..."        │
│ (auto-dismiss after 3s)         │
└────────────────────────────────┘
           ↓
        (Backend: POST /api/.../question-answer-report/)
           ↓
    (Frontend: fetchQAReports() + wait 100ms)
           ↓
    (Frontend: close & reopen modal + wait 600ms)
           ↓
┌────────────────────────────────┐
│ 📋 Modal Reopens (NEW STATE!)   │
│ Title: Status Laporan Pertanyaan│
│ Body: [Status Display]          │
│ ├─ Status: [🕐 Menunggu Tinjauan]
│ ├─ Reason: 🚫 Spam             │
│ ├─ Description: (user text)     │
│ ├─ Tanggal Lapor: 2 Mar 2024    │
│ ├─ Info Message: "Laporan...    │
│ │   dalam proses tinjauan..."   │
│ │                               │
│ Footer: [Tutup] [Edit Laporan]  │
└────────────────────────────────┘
           ↓
📱 STEP 2: View Same Report Again
      (User clicks report button on same question)
           ↓
┌────────────────────────────────┐
│ 📋 Modal Opens DIRECTLY         │
│    to STATUS PAGE               │
│ (Same display as Step 1 end)    │
│                                 │
│ Footer: [Tutup] [Edit Laporan]  │
└────────────────────────────────┘
           ↓
📱 STEP 3: Edit Report (Optional)
    (User clicks Edit Laporan button)
           ↓
┌────────────────────────────────┐
│ 📋 Modal Changes to FORM        │
│ Title: Laporkan Pertanyaan      │
│ Info: "Anda sedang mengedit..." │
│ ├─ Reason: [Spam] (pre-filled)  │
│ ├─ Description: (pre-filled)    │
│ Footer: [Batal] [Perbarui...]   │
└────────────────────────────────┘
           ↓
        (User modifies reason/description)
           ↓
    (Backend: PUT /api/.../question-answer-report/{id}/)
           ↓
    (Same flow as initial report)
           ↓
┌────────────────────────────────┐
│ ✅ Success Toast                │
│ "Laporan berhasil diperbarui!"  │
│ "menunggu tinjauan ulang..."    │
└────────────────────────────────┘
           ↓
    (Modal closes & reopens with fresh data)
```

---

## The Key Insight: currentReportData

The entire feature hinges on one state variable:

```javascript
const [currentReportData, setCurrentReportData] = useState(null);

// When modal opens:
if (existingReport) {
    setCurrentReportData(existingReport)  // Not null
    // → Modal renders STATUS PAGE
} else {
    setCurrentReportData(null)             // Is null
    // → Modal renders FORM
}

// This single variable gates 2 completely different UI modes
// Eliminates all confusion about which view to show
```

---

## Direct Comparison Table

| Behavior | Before | After |
|----------|--------|-------|
| First report submission | Form → Submit → Close | Form → Submit → Close → Reopen showing status |
| Click report again | Same question opens form | Same question shows status page |
| Can see report is saved | No | Yes (status page is proof) |
| Can edit pending report | No | Yes (Edit Laporan button) |
| Can see admin feedback | No | Yes (full feedback section) |
| Can see when reviewed | No | Yes (reviewed_at timestamp) |
| User confusion risk | Very high | Very low |
| Lines of code | ~95 lines | ~360 lines (+265) |

---

## Testing Tips

1. **Test Rapid Clicks**: Click report button multiple times rapidly
   - Should always show status page for same question
   - Should never duplicate reports

2. **Test Edit Functionality**: Edit a pending report twice
   - Second edit should show fresh data from first edit
   - Modal should reopen showing updated content

3. **Test Different Questions**: Report 3 different questions
   - Each should track separately
   - Clicking each should show their own status

4. **Test Network Issues**: Edit report while offline
   - Should show error toast
   - Modal should remain open so user can retry
   - No phantom updates

5. **Test Status Transitions**: If you have backend access
   - Mark report as "reviewed" in database
   - Click report button
   - Should show "Sudah Ditinjau" badge + feedback section
   - "Edit Laporan" button should disappear

---

**Summary**: The implementation adds **intelligent modal logic** that makes the report feature feel responsive and confirms to users that their reports are being tracked by the system. This brings the instructor experience to full parity with the student Q&A page.
