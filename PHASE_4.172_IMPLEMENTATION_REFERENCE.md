# PHASE 4.172 Implementation Reference
**Lesson Media Source UI Enhancement**

---

## Quick Navigation

| Component | Lines | Purpose |
|-----------|-------|---------|
| Media Source Buttons | 1040-1086 | Google Drive, YouTube, Upload selector |
| Google Drive Input Section | 1089-1141 | URL input with validation |
| YouTube Input Section | 1144-1196 | URL input with format examples |
| File Upload Section | 1369-1419 | File picker with compression tips |
| Helper Functions | 1750-1850 | URL validation and extraction |

---

## Validation Function Reference

### `validateGoogleDriveLessonUrl(url)`
**Location**: Helper functions section in CourseEditCurriculum.jsx

**Parameters:**
- `url` (string): Google Drive sharing URL

**Returns:**
```javascript
{
  isValid: boolean,
  error?: string,        // Error message if not valid
  fileId?: string        // Extracted file ID if valid
}
```

**Accepts:**
- `https://drive.google.com/file/d/FILE_ID/view?usp=sharing`
- `https://drive.google.com/file/d/FILE_ID/view`
- Direct file ID (FILE_ID only)

**Error Cases:**
- Empty or whitespace-only URL
- URL doesn't contain `drive.google.com`
- Missing or invalid FILE_ID format

**Example Usage:**
```javascript
const result = validateGoogleDriveLessonUrl('https://drive.google.com/file/d/1a2b3c/view');
if (result.isValid) {
  console.log('File ID:', result.fileId);  // 1a2b3c
  handleLessonChange(variantIndex, itemIndex, "gdriveLink", url);
} else {
  Toast().fire({
    icon: "warning",
    title: "URL Tidak Valid",
    text: result.error
  });
}
```

---

### `validateYoutubeLessonUrl(url)`
**Location**: Helper functions section in CourseEditCurriculum.jsx

**Parameters:**
- `url` (string): YouTube video URL

**Returns:**
```javascript
{
  isValid: boolean,
  error?: string,        // Error message if not valid
  videoId?: string       // Extracted video ID if valid
}
```

**Accepts:**
- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`
- `https://www.youtube.com/v/VIDEO_ID`
- Direct video ID (11 chars)

**Error Cases:**
- Empty or whitespace-only URL
- URL doesn't contain YouTube domain
- Invalid video ID format
- Video ID length not 11 characters

**Example Usage:**
```javascript
const result = validateYoutubeLessonUrl('https://youtu.be/dQw4w9WgXcQ');
if (result.isValid) {
  console.log('Video ID:', result.videoId);  // dQw4w9WgXcQ
  handleLessonChange(variantIndex, itemIndex, "youtubeLink", url);
  setUiState(prev => ({ ...prev, isDirty: true }));  // Trigger auto-save
} else {
  Toast().fire({
    icon: "warning",
    title: "URL Tidak Valid",
    text: result.error
  });
}
```

---

### `extractYoutubeIdLesson(url)`
**Location**: Helper functions section in CourseEditCurriculum.jsx

**Parameters:**
- `url` (string): YouTube video URL or ID

**Returns:**
- `string`: 11-character video ID, or `null` if not found

**Regex Patterns Used:**
1. `youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})`
2. `youtu\.be\/([a-zA-Z0-9_-]{11})`
3. `youtube\.com\/embed\/([a-zA-Z0-9_-]{11})`
4. `youtube\.com\/v\/([a-zA-Z0-9_-]{11})`
5. `^([a-zA-Z0-9_-]{11})$` (plain ID)

**Example Usage:**
```javascript
const videoIds = [
  'dQw4w9WgXcQ',                                    // Pattern 5
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',  // Pattern 1
  'https://youtu.be/dQw4w9WgXcQ',                 // Pattern 2
  'https://www.youtube.com/embed/dQw4w9WgXcQ',   // Pattern 3
  'https://www.youtube.com/v/dQw4w9WgXcQ'        // Pattern 4
];

videoIds.forEach(url => {
  const id = extractYoutubeIdLesson(url);
  console.log(`Extracted: ${id}`);  // All output: dQw4w9WgXcQ
});
```

---

### `extractGoogleDriveFileIdLesson(url)`
**Location**: Helper functions section in CourseEditCurriculum.jsx

**Parameters:**
- `url` (string): Google Drive file URL

**Returns:**
- `string`: File ID, or `null` if not found

**Formats Supported:**
1. `/d/FILE_ID` (from `...file/d/FILE_ID/view`)
2. `?id=FILE_ID` (from query parameter)

**Example Usage:**
```javascript
const fileIds = [
  'https://drive.google.com/file/d/1a2b3c/view',
  'https://drive.google.com/file/d/1a2b3c/view?usp=sharing',
  'https://drive.google.com/uc?id=1a2b3c'
];

fileIds.forEach(url => {
  const id = extractGoogleDriveFileIdLesson(url);
  console.log(`Extracted: ${id}`);  // All output: 1a2b3c
});
```

---

## State Management

### Lesson Item Object Structure
```javascript
{
  // Basic fields
  title: string,
  description: string,
  urutan: number,
  
  // Media source fields (only one should be populated)
  gdriveLink: string | null,      // Google Drive sharing URL
  youtubeLink: string | null,     // YouTube video URL
  uploadedFile: string | null,    // File path from upload
  
  // Duration tracking
  duration_seconds: number | null,  // Auto-extracted from video
  
  // Content
  content: string  // Lesson content/description
}
```

### Form Dirty Flag
```javascript
// When URL is successfully added
setUiState(prev => ({ ...prev, isDirty: true }));

// This triggers the auto-save debounce
// 2-second delay allows batching multiple changes
// Then performAutoSave() is called automatically
```

---

## Event Handlers Integration

### On Input Change
```javascript
onChange={(e) => {
  handleLessonChange(
    variantIndex, 
    itemIndex, 
    "gdriveLink",  // or "youtubeLink"
    e.target.value
  );
}}
```

### On Enter Key (URL Inputs)
```javascript
onKeyPress={(e) => {
  if (e.key === 'Enter' && item?.youtubeLink?.trim()) {
    const validation = validateYoutubeLessonUrl(item.youtubeLink);
    if (validation.isValid) {
      setUiState(prev => ({ ...prev, isDirty: true }));
      // Toast notification
    }
  }
}}
```

### On Validate Button Click
```javascript
onClick={() => {
  const validation = validateGoogleDriveLessonUrl(item?.gdriveLink || '');
  if (validation.isValid) {
    setUiState(prev => ({ ...prev, isDirty: true }));
    // Toast notification
  } else {
    // Error toast with validation.error
  }
}}
```

### File Upload Progress
```javascript
onUploadProgress: (progressEvent) => {
  const percentCompleted = Math.round(
    (progressEvent.loaded * 100) / progressEvent.total
  );
  setCurriculumUploadProgress(prev => ({
    ...prev,
    [progressKey]: { percentage: percentCompleted, isUploading: true }
  }));
}
```

---

## Toast Notification Reference

### Success Cases
```javascript
// Google Drive / YouTube URL added
Toast().fire({
  icon: "success",
  title: "Link [Source] Ditambahkan",
  text: "Link pelajaran dari [Source] telah ditambahkan!",
  timer: 2000,
  showConfirmButton: false
});

// File upload successful
Toast().fire({
  icon: "success",
  title: "File Berhasil Diunggah",
  text: `File media pelajaran berhasil diunggah! Durasi: ${response.data.video_duration}`,
  timer: 2000,
  showConfirmButton: false
});
```

### Error/Warning Cases
```javascript
// Invalid URL format
Toast().fire({
  icon: "warning",
  title: "URL Tidak Valid",
  text: validation.error,  // Specific error message from validator
});

// File type not supported
Toast().fire({
  icon: "error",
  title: "Tipe File Tidak Valid",
  text: "Silakan unggah file video (MP4, WebM, OGV, MOV, AVI)",
});

// File too large
Toast().fire({
  icon: "error",
  title: "File Terlalu Besar",
  text: `Ukuran file maksimal 500MB. Ukuran file Anda: ${fileSize}MB`,
});

// Upload failed
Toast().fire({
  icon: "error",
  title: "Unggahan Gagal",
  text: error.response?.data?.message || "Gagal mengunggah file. Silakan coba lagi.",
});
```

---

## CSS Classes Reference

| Element | Class | Purpose |
|---------|-------|---------|
| Media source selector | `btn-group w-100 mb-3` | Button group styling |
| Google Drive button | `btn btn-outline-primary` | Primary style (blue) |
| YouTube button | `btn btn-outline-danger` | Danger style (red) |
| Upload button | `btn btn-outline-success` | Success style (green) |
| URL input field | `form-control` | Standard input styling |
| Validate button | `btn btn-primary/danger/success` | Color matches source |
| Label | `form-label fw-bold` | Bold label styling |
| Helper section | `mt-2 p-3 bg-light rounded` | Light background box |
| Small text | `text-muted d-block` | Muted helper text |
| File size badge | `badge bg-info` | Info-colored badge |

---

## Auto-Save Integration Flow

```
User enters URL or uploads file
         ↓
onChange/onUploadProgress triggers
         ↓
handleLessonChange() updates state
         ↓
setUiState({ isDirty: true })
         ↓
useEffect detects isDirty change
         ↓
debouncedAutoSave called (2-second timer)
         ↓
After 2 seconds or last change + 2 seconds:
  performAutoSave() executes
         ↓
Auto-save status updates:
  1. "Menyimpan..." (spinner)
  2. "✅ Tersimpan!" (checkmark + timestamp)
  3. Back to "idle" after 3 seconds
```

---

## Testing Checklist

### Google Drive Input Testing
- [ ] Input field shows correct placeholder
- [ ] "Tambahkan" button disabled when empty
- [ ] "Tambahkan" button enabled when URL entered
- [ ] Enter key triggers validation
- [ ] Valid URL shows success toast
- [ ] Invalid URL shows warning toast with error message
- [ ] Validation prevents form submission for invalid URLs
- [ ] Helper section shows 4 sharing steps
- [ ] Form dirty flag set on successful add
- [ ] Auto-save triggers after validation
- [ ] URL persists after page reload

### YouTube Input Testing
- [ ] Input field shows correct placeholder
- [ ] "Tambahkan" button disabled when empty
- [ ] "Tambahkan" button enabled when URL entered
- [ ] Enter key triggers validation
- [ ] Valid URL shows success toast
- [ ] Invalid URL shows warning toast
- [ ] Example formats displayed correctly
- [ ] All 5 URL formats are accepted
- [ ] Form dirty flag set on successful add
- [ ] Auto-save triggers after validation
- [ ] URL persists after page reload

### File Upload Testing
- [ ] File input accepts video files only
- [ ] Non-video files show error toast
- [ ] Files > 500MB show error with actual size
- [ ] Valid file shows upload progress bar
- [ ] Progress bar updates 0-100%
- [ ] Success message shows extracted duration
- [ ] Auto-save triggers after upload completes
- [ ] File persists after page reload
- [ ] Compression tips are visible and helpful

### Keyboard Interaction Testing
- [ ] Tab key navigates through inputs
- [ ] Enter key submits URL validation
- [ ] Shift+Tab goes back in tab order
- [ ] Arrow keys not interfering with inputs

### Integration Testing
- [ ] Switching sources clears previous input
- [ ] Multiple lessons can have different sources
- [ ] Auto-save doesn't cause excessive API calls
- [ ] Changes save correctly to database
- [ ] Published courses show correct preview

---

## Common Errors & Solutions

### Error: "validateYoutubeLessonUrl is not defined"
**Solution**: Ensure helper functions are defined before use. Check line ~1750 in CourseEditCurriculum.jsx.

### Error: "URL format not recognized"
**Solution**: User might have trailing spaces. Validation uses `.trim()` internally - this should handle it.

### Error: "Toast is not imported"
**Solution**: Ensure `Toast` is imported from views/plugin/Toast at top of file:
```javascript
import Toast from '../../views/plugin/Toast';
```

### File doesn't upload after validation
**Solution**: Check that:
1. File passes validation (correct type and size)
2. Course ID is available
3. Backend endpoint `/file-upload/` is accessible
4. Network not blocked

### Auto-save not triggering
**Solution**: Ensure:
1. `setUiState(prev => ({ ...prev, isDirty: true }))` is called
2. `debouncedAutoSave` is properly defined
3. 2-second debounce delay has passed
4. No errors in browser console

---

## Performance Tips

1. **Validation is Synchronous**: URL validation happens immediately, no API calls
2. **Auto-save Debounced**: 2-second delay prevents excessive saves
3. **No Real-Time Validation**: URLs only validated on explicit action (Enter or button click)
4. **Helper Functions Lightweight**: Regex patterns are pre-compiled for speed
5. **Toast Notifications**: Auto-close after 2 seconds to keep DOM clean

---

## Accessibility Notes

✅ **Keyboard Support**
- All interactive elements keyboard accessible
- Tab order is logical
- Enter key submits URL validation

✅ **Screen Reader Support**
- Form labels properly associated with inputs
- Button text describes action
- Error messages read aloud

✅ **Visual Indicators**
- Disabled buttons grayed out
- Required fields clearly marked
- Success/error states visually distinct

✅ **Color Not Only Cue**
- Icons used in addition to button colors
- Text descriptions accompany colors
- Error messages in text, not just red

---

**Last Updated**: November 2025 | **Phase**: 4.172 | **Status**: ✅ Complete
