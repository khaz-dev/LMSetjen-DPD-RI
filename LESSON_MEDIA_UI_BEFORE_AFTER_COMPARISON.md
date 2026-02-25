# Lesson Media Source Selection - Before/After Comparison
**PHASE 4.172 UI Enhancement**

---

## Media Source Selector Buttons

### BEFORE (Simple, minimal guidance)
```
┌─ Pilih Sumber Media Pelajaran: ──────────────────────┐
│  ┌──────────┬─────────────┬────────────────────────┐  │
│  │ Google   │  YouTube    │  Upload                │  │
│  │ Drive    │             │  File                  │  │
│  └──────────┴─────────────┴────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### AFTER (Enhanced with icons and color coding)
```
┌─ Ubah Sumber Media Pelajaran: ───────────────────────┐
│  ┌──────────────┬──────────────┬────────────────────┐  │
│  │ 🔵 Google    │ 🔴 YouTube   │ 🟢 Upload File    │  │
│  │    Drive     │    Link      │                    │  │
│  └──────────────┴──────────────┴────────────────────┘  │
│                                                          │
│  Label changes based on state:                          │
│  - "Pilih..." when no source selected                   │
│  - "Ubah..." when source already selected              │
└──────────────────────────────────────────────────────┘
```

---

## Google Drive Input Section

### BEFORE (Basic input with minimal help)
```
Google Drive Link Input
↓
┌──────────────────────────────────────────────────────┐
│ https://drive.google.com/file/d/FILE_ID/view?usp... │
└──────────────────────────────────────────────────────┘
ℹ️ Format yang didukung: https://drive.google.com/file/d/FILE_ID/view
   (file harus dibagikan secara publik)
```

### AFTER (With validation button and step-by-step guide)
```
Google Drive Link Input with Real-Time Validation
↓
┌────────────────────────────────┬──────────┐
│ https://drive.google.com/file/ │ Tambahkan│
└────────────────────────────────┴──────────┘

ℹ️ Format yang didukung: https://drive.google.com/file/d/FILE_ID/view
   (file harus dibagikan secara publik)

📋 Cara Berbagi Video dari Google Drive:
   1. Upload video ke Google Drive Anda
   2. Klik kanan file → "Bagikan"
   3. Ubah akses ke "Siapa pun dengan tautan" atau "Publik"
   4. Salin link dan paste di sini
```

---

## YouTube Input Section

### BEFORE (Basic input with generic help)
```
YouTube Link Input
↓
┌──────────────────────────────────────────────────────┐
│ https://youtube.com/watch?v=VIDEO_ID atau youtu.be/ │
└──────────────────────────────────────────────────────┘
ℹ️ Format yang didukung: https://youtube.com/watch?v=VIDEO_ID
   atau https://youtu.be/VIDEO_ID
```

### AFTER (With validation button and format examples)
```
YouTube Link Input with Real-Time Validation
↓
┌────────────────────────────────┬──────────┐
│ https://www.youtube.com/watch? │ Tambahkan│
└────────────────────────────────┴──────────┘

ℹ️ Format yang didukung: https://youtube.com/watch?v=VIDEO_ID
   atau https://youtu.be/VIDEO_ID

Contoh URL YouTube yang didukung:
   • https://www.youtube.com/watch?v=dQw4w9WgXcQ
   • https://youtu.be/dQw4w9WgXcQ
   • https://www.youtube.com/embed/dQw4w9WgXcQ
   • dQw4w9WgXcQ (hanya ID video)
```

---

## File Upload Section

### BEFORE (Simple file input with minimal info)
```
File Upload Input
↓
┌───────────────────────────────────────────────────────┐
│ Choose File: [Select File Button]                     │
└───────────────────────────────────────────────────────┘
ℹ️ Format yang didukung: MP4, WebM, OGV, MOV, AVI
   (Ukuran maksimal: 500MB)
```

### AFTER (Enhanced with tips and better error messaging)
```
File Upload Input with Enhanced Docs
↓
┌──────────────────────────────────────────────────────┐
│ [Browse...] │ Pilih File                             │
└──────────────────────────────────────────────────────┘

ℹ️ Format yang didukung: MP4, WebM, OGV, MOV, AVI
📦 Ukuran maksimal: 500MB. Durasi akan dihitung otomatis.

💡 Tips Kompresi Video:
   • Gunakan format MP4 untuk kompatibilitas terbaik
   • Pastikan resolusi 720p atau 1080p untuk kualitas terbaik
   • Kompres video sebelum upload jika lebih dari 500MB
   • Gunakan tools seperti FFmpeg atau HandBrake untuk kompresi
```

---

## Validation Feedback - Error Messages

### YouTube URL Validation

```
INVALID INPUT:
┌─────────────────────────────────────────────┐
│ https://invalid-link.com                    │
│ [Tambahkan]                                 │
└─────────────────────────────────────────────┘
         ↓ (User clicks Tambahkan)
         
⚠️  URL Tidak Valid
    URL harus dari YouTube domain (youtube.com/youtu.be)
    
    Contoh URL yang valid:
    • https://www.youtube.com/watch?v=VIDEO_ID
    • https://youtu.be/VIDEO_ID
```

### Google Drive URL Validation

```
INVALID INPUT:
┌─────────────────────────────────────────────┐
│ https://docs.google.com/document/d/FILE_ID/ │
│ [Tambahkan]                                 │
└─────────────────────────────────────────────┘
         ↓ (User clicks Tambahkan)
         
⚠️  URL Tidak Valid
    URL harus dari Google Drive (drive.google.com)
    
    Format yang benar:
    • https://drive.google.com/file/d/FILE_ID/view
```

### Valid URL Success

```
VALID INPUT:
┌──────────────────────────────────────────────┐
│ https://www.youtube.com/watch?v=dQw4w9WgXcQ  │
│ [Tambahkan]                                  │
└──────────────────────────────────────────────┘
         ↓ (User clicks Tambahkan)
         
✅  Link YouTube Ditambahkan
    Link pelajaran dari YouTube telah ditambahkan!
```

---

## File Upload Error - File Size

### BEFORE (Generic error message)
```
❌ Upload Error
   File Terlalu Besar
   Ukuran file maksimal 500MB
```

### AFTER (Specific error with actual file size)
```
❌ Upload Error
   File Terlalu Besar
   Ukuran file maksimal 500MB. 
   Ukuran file Anda: 750.45MB
   
   [Shows actual file size so user knows how much to compress]
```

---

## Button State Transitions

### Google Drive / YouTube "Tambahkan" Button

```
STATE 1: Input Empty
┌──────────────────────────────────┬─────────────────┐
│                                  │ Tambahkan      │
│                                  │ (Disabled)     │
└──────────────────────────────────┴─────────────────┘
         ↓ (User types URL)

STATE 2: Input Has Text, URL Valid
┌──────────────────────────────────┬─────────────────┐
│ https://www.youtube.com/watch?v= │ Tambahkan      │
│                                  │ (Enabled)      │
└──────────────────────────────────┴─────────────────┘
         ↓ (User clicks or presses Enter)
         ✅ Success message
         URL is added and form marked dirty

STATE 3: Input Has Text, URL Invalid
┌──────────────────────────────────┬─────────────────┐
│ https://invalid-url.com          │ Tambahkan      │
│                                  │ (Enabled)      │
└──────────────────────────────────┴─────────────────┘
         ↓ (User clicks or presses Enter)
         ⚠️ Warning message with error details
         URL is not added, user can fix it
```

---

## Keyboard Interaction (NEW)

### Enter Key Support
```
User enters valid Google Drive URL
                ↓
        (presses Enter key)
                ↓
    URL is validated and added
                ↓
        Success toast appears
                ↓
    Form marks dirty for auto-save
```

---

## Visual Comparison: Complete Section

### Component Layout BEFORE
```
Pilih Sumber Media Pelajaran:
[Google Drive] [YouTube] [Upload]

{IF google_drive selected}
  Input Google Drive Link:
  ┌─────────────────────────┐
  │                         │
  └─────────────────────────┘
  ℹ️ Help text

{IF youtube selected}
  Input YouTube Link:
  ┌─────────────────────────┐
  │                         │
  └─────────────────────────┘
  ℹ️ Help text

{IF upload selected}
  Choose File:
  ┌─────────────────────────┐
  │ Select File             │
  └─────────────────────────┘
  ℹ️ Help text + progress bar
  
{IF Google Drive Link exists}
  Preview + Delete button
  
{IF YouTube Link exists}
  Preview + Delete button
  
{IF Uploaded File exists}
  Preview + Delete button
```

### Component Layout AFTER (More Guided)
```
Ubah Sumber Media Pelajaran:
[🔵 Google Drive] [🔴 YouTube] [🟢 Upload File]

{IF google_drive selected}
  Masukkan URL Google Drive Pelajaran:
  ┌─────────────────────────┬──────────────┐
  │ Placeholder with format │ Tambahkan   │
  │ example                 │ (smart button)
  └─────────────────────────┴──────────────┘
  
  ℹ️ Format yang didukung: https://drive.google.com/file/d/FILE_ID/view
  
  📋 Cara Berbagi Video dari Google Drive:
     1. Upload video ke Google Drive Anda
     2. Klik kanan file → "Bagikan"
     3. Ubah akses ke "Siapa pun dengan tautan"
     4. Salin link dan paste di sini

{IF youtube selected}
  Masukkan URL YouTube Pelajaran:
  ┌─────────────────────────┬──────────────┐
  │ Placeholder with formats│ Tambahkan   │
  │ (all 4 supported URLs)  │ (smart button)
  └─────────────────────────┴──────────────┘
  
  ℹ️ Format yang didukung: https://youtube.com/watch?v=VIDEO_ID
  
  Contoh URL YouTube yang didukung:
     • https://www.youtube.com/watch?v=dQw4w9WgXcQ
     • https://youtu.be/dQw4w9WgXcQ
     • https://www.youtube.com/embed/dQw4w9WgXcQ
     • dQw4w9WgXcQ (hanya ID video)

{IF upload selected}
  Unggah File Media Pelajaran
  ┌──────────────────────────┐
  │ Choose File │ Pilih File │
  └──────────────────────────┘
  
  ℹ️ Format yang didukung: MP4, WebM, OGV, MOV, AVI
  📦 Ukuran maksimal: 500MB
  
  💡 Tips Kompresi Video:
     • Gunakan format MP4 untuk kompatibilitas terbaik
     • Pastikan resolusi 720p atau 1080p untuk kualitas terbaik
     • Kompres video sebelum upload jika lebih dari 500MB
     • Gunakan tools seperti FFmpeg atau HandBrake

  {during upload: progress bar 0-100%}
  {after upload: success message with duration}
  
{IF Google Drive Link exists}
  Preview card with Open & Delete buttons + URL display
  
{IF YouTube Link exists}
  Preview card with Open & Delete buttons + URL display
  
{IF Uploaded File exists}
  Preview card with Open & Delete buttons + file info
```

---

## Key UX Improvements Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Media Source Selection** | Plain buttons | Color-coded buttons with icons |
| **Input Guidance** | Basic placeholder | Detailed placeholder with format examples |
| **Validation** | No validation shown | Real-time validation with button |
| **Error Messages** | Generic | Specific with helpful guidance |
| **Format Examples** | Text description | Clickable example URLs |
| **Help Content** | Minimal | Step-by-step guides |
| **File Size Errors** | Generic message | Shows actual file size |
| **Keyboard Support** | None | Enter key to confirm |
| **Visual Hierarchy** | Simple | Clear sections with icons |
| **User Guidance** | Minimal | Helpful tips and best practices |

---

## Interaction Flow Example: Adding YouTube Link

```
1. USER OPENS CURRICULUM EDITOR
   Screen shows: "Pilih Sumber Media Pelajaran:"
                
2. USER CLICKS YOUTUBE BUTTON
   Screen shows: YouTube input form
   - Placeholder: "https://www.youtube.com/watch?v=VIDEO_ID..."
   - "Tambahkan" button (disabled - grayed out)
   - Examples: 4 different YouTube URL formats displayed
   
3. USER PASTES: https://youtu.be/dQw4w9WgXcQ
   - Input field accepts text
   - "Tambahkan" button becomes ENABLED
   
4. USER PRESSES ENTER KEY
   - URL is validated
   - SUCCESS: Video ID extracted (dQw4w9WgXcQ)
   - Green toast: "Link YouTube Ditambahkan"
   - Form marked as dirty
   
5. AUTO-SAVE TRIGGERS (2-second debounce)
   - "Menyimpan..." spinner shows
   - After save: "✅ Tersimpan! pada HH:MM:SS"
   
6. USER NAVIGATES AWAY & RETURNS
   - YouTube link still there
   - Can see "Ubah Sumber Media Pelajaran:" label
   - Can delete link or switch source
```

---

**Result**: A much more intuitive, user-friendly interface that guides users to enter correct URLs on their first try, with clear visual feedback and helpful examples throughout the process.
