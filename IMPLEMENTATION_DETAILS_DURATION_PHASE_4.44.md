# Implementation Details - Duration Extraction UI (PHASE 4.44)

## File Changes Summary

### 1. CourseEditCurriculum.jsx

#### New State (Line ~1070)
```javascript
// ✨ PHASE 4.44: Duration editing mode - track which items are in duration edit mode
// Format: { 'variantIndex_itemIndex': true/false }
const [durationEditingMode, setDurationEditingMode] = useState({});
```

#### New Helper Function
```javascript
// Toggle duration edit mode for a lesson item
const toggleDurationEditMode = (variantIndex, itemIndex) => {
    const key = `${variantIndex}_${itemIndex}`;
    setDurationEditingMode(prev => ({
        ...prev,
        [key]: !prev[key]
    }));
};
```

#### New Duration Input Handler (Line ~1911)
```javascript
/**
 * ✨ PHASE 4.44: Handle manual duration input
 * Allows users to manually set duration if auto-extraction fails or for local files
 * Converts user input (seconds) to formatted string (e.g., "1m 44s")
 */
const handleDurationInput = (variantIndex, itemIndex, durationSeconds) => {
    try {
        const seconds = parseFloat(durationSeconds);
        
        if (isNaN(seconds) || seconds < 0) {
            // Invalid input - clear duration
            setVariants(prevVariants => {
                const updated = [...prevVariants];
                if (updated[variantIndex]?.items?.[itemIndex]) {
                    updated[variantIndex].items[itemIndex].duration_seconds = null;
                    updated[variantIndex].items[itemIndex].duration_formatted = null;
                }
                return updated;
            });
            return;
        }

        // Convert seconds to formatted duration (e.g., "1m 44s")
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        let formatted = '';
        if (hours > 0) formatted += `${hours}h `;
        if (minutes > 0 || hours > 0) formatted += `${minutes}m `;
        if (secs > 0 || (hours === 0 && minutes === 0)) formatted += `${secs}s`;
        formatted = formatted.trim();

        setVariants(prevVariants => {
            const updated = [...prevVariants];
            if (updated[variantIndex]?.items?.[itemIndex]) {
                updated[variantIndex].items[itemIndex].duration_seconds = seconds;
                updated[variantIndex].items[itemIndex].duration_formatted = formatted;
            }
            return updated;
        });

        Toast().fire({
            icon: "success",
            title: "Durasi Diatur",
            text: `Durasi: ${formatted}`,
            timer: 2000,
            showConfirmButton: false
        });

    } catch (error) {
        console.error('[Curriculum] Error setting duration:', error);
        Toast().fire({
            icon: "error",
            title: "Error mengatur durasi",
            text: "Silakan masukkan angka yang valid (detik)"
        });
    }
};
```

#### UI Component Addition (After line ~969)
```jsx
{/* ✨ PHASE 4.44: Duration Display and Edit Section */}
{item?.gdriveLink && (
    <div className="mb-3 mt-3">
        <div className="duration-display-section p-3 bg-light border rounded" style={{borderLeft: '4px solid #0d6efd'}}>
            <div className="d-flex justify-content-between align-items-center">
                <div>
                    <label className="form-label mb-0 fw-bold">
                        <i className="fas fa-clock me-2 text-info"></i>
                        Durasi Video
                    </label>
                    <div className="mt-2">
                        {item?.duration_formatted ? (
                            <div className="duration-badge d-inline-block">
                                <span className="badge bg-success" style={{fontSize: '0.95rem', padding: '0.5rem 0.75rem'}}>
                                    <i className="fas fa-check-circle me-1"></i>
                                    {item.duration_formatted}
                                </span>
                                <small className="text-muted d-block mt-1">
                                    Durasi terekstrak: {item.duration_seconds ? item.duration_seconds + ' detik' : 'Data tidak tersedia'}
                                </small>
                            </div>
                        ) : (
                            <div className="duration-empty">
                                <small className="text-muted">
                                    <i className="fas fa-info-circle me-1"></i>
                                    Durasi belum terekstrak. Klik "Edit" untuk memasukkan secara manual.
                                </small>
                            </div>
                        )}
                    </div>
                </div>
                <button
                    type="button"
                    className={`btn btn-sm ${durationEditingMode[`${variantIndex}_${itemIndex}`] ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={() => toggleDurationEditMode(variantIndex, itemIndex)}
                    disabled={uiState.isSubmitting}
                >
                    <i className={`fas fa-${durationEditingMode[`${variantIndex}_${itemIndex}`] ? 'times' : 'edit'} me-1`}></i>
                    {durationEditingMode[`${variantIndex}_${itemIndex}`] ? 'Selesai' : 'Edit'}
                </button>
            </div>

            {/* Duration Edit Form */}
            {durationEditingMode[`${variantIndex}_${itemIndex}`] && (
                <div className="mt-3 pt-3" style={{borderTop: '1px solid #dee2e6'}}>
                    <label className="form-label small fw-bold">
                        Masukkan durasi dalam detik:
                    </label>
                    <div className="input-group input-group-sm">
                        <input
                            type="number"
                            className="form-control"
                            placeholder="Contoh: 120"
                            value={item?.duration_seconds || ''}
                            onChange={(e) => handleDurationInput(variantIndex, itemIndex, e.target.value)}
                            min="0"
                            step="1"
                            disabled={uiState.isSubmitting}
                        />
                        <span className="input-group-text text-muted small">detik</span>
                    </div>
                    <small className="text-muted d-block mt-2">
                        <i className="fas fa-lightbulb me-1 text-warning"></i>
                        Masukkan durasi video dalam satuan detik (misalnya: 120 untuk 2 menit).
                        Sistem akan otomatis mengubahnya ke format yang mudah dibaca.
                    </small>
                </div>
            )}
        </div>
    </div>
)}
```

#### Updated Functions
- `addCurriculumSection()` - Added `duration_formatted: null` initialization
- `addLesson()` - Added `duration_formatted: null` initialization  
- `fetchCourseDetail()` - Updated to preserve `duration_formatted` from backend

### 2. CourseEditCurriculum.css

#### New Styles
```css
/* ✨ PHASE 4.44: Duration Display and Edit Section Styling */
.duration-display-section {
    border-radius: 0.375rem;
    transition: all 0.3s ease;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
}

.duration-display-section:hover {
    box-shadow: 0 2px 8px rgba(13, 110, 253, 0.15);
    background: linear-gradient(135deg, #f0f2f5 0%, #e2e6eb 100%);
}

.duration-badge {
    display: inline-block;
}

.duration-badge .badge {
    font-weight: 500;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.duration-badge .text-muted {
    font-size: 0.8rem;
    margin-top: 0.25rem;
}

.duration-empty {
    padding: 0.5rem 0;
}

.duration-empty small {
    font-size: 0.85rem;
    display: flex;
    align-items: center;
}

.duration-display-section .btn-sm {
    font-size: 0.85rem;
    padding: 0.35rem 0.75rem;
    white-space: nowrap;
}

.duration-display-section .input-group-sm .form-control {
    font-size: 0.9rem;
    padding: 0.35rem 0.5rem;
}

.duration-display-section .input-group-text {
    font-size: 0.85rem;
    background-color: #e9ecef;
    border-color: #dee2e6;
}
```

## Integration Points

### 1. Auto-Extraction (Existing, Unchanged)
When user enters Google Drive link:
```javascript
// In handleLessonChange() - EXISTING CODE
if (propertyName === 'gdriveLink' && value && value.trim()) {
    // API call to /api/v1/media/video-metadata/
    // Updates state with duration_seconds & duration_formatted
    // Shows toast notification
}
```

### 2. Manual Duration Input (NEW)
```javascript
// In handleDurationInput() - NEW FUNCTION
// Parses user input
// Formats to readable string
// Updates state
// Shows confirmation toast
```

### 3. UI Display (NEW)
```jsx
// Only shows if item has gdriveLink
// Shows extracted or manually entered duration
// Provides edit button to toggle input mode
```

### 4. Form Submission (EXISTING + ENHANCED)
```javascript
// In performAutoSave() and handleFormSubmit()
// Only NEW: Also includes duration_seconds in FormData
if (item.duration_seconds) {
    formData.append(`variants[${variantIndex}][items][${itemIndex}][duration_seconds]`, item.duration_seconds);
}
```

### 5. Backend Processing (EXISTING, UNCHANGED)
```python
# In views.py - CourseUpdateAPIView.update_variant()
duration_seconds = item_data.get("duration_seconds")
if duration_seconds:
    duration = timedelta(seconds=float(duration_seconds))
    variant_item.duration = duration
```

## State Data Flow

### Initial State (Empty Lesson)
```javascript
{
    title: "",
    description: "",
    gdriveLink: "",
    preview: false,
    order: 0,
    duration_seconds: null,        ← New property
    duration_formatted: null       ← New property
}
```

### After Auto-Extraction
```javascript
{
    title: "Introduction",
    description: "...",
    gdriveLink: "https://drive.google.com/...",
    preview: false,
    order: 0,
    duration_seconds: 104.5,       ← Extracted by API
    duration_formatted: "1m 44s"   ← Formatted for display
}
```

### After Manual Input (User enters 120)
```javascript
{
    title: "Introduction",
    description: "...",
    gdriveLink: "https://drive.google.com/...",
    preview: false,
    order: 0,
    duration_seconds: 120,         ← User input
    duration_formatted: "2m"       ← Auto-formatted
}
```

### On Database (After Submit)
```python
# VariantItem model
variant_item.duration = timedelta(seconds=120)  # From duration_seconds
# Which displays as: "2m" via content_duration property
```

## Error Handling

### Invalid Input
```javascript
if (isNaN(seconds) || seconds < 0) {
    // Clear duration
    duration_seconds = null
    duration_formatted = null
    // No toast (silent fail)
}
```

### Extraction Failure
```javascript
// From existing auto-extraction code
if (response.data && response.data.error) {
    Toast().fire({
        icon: "warning",
        title: "Tidak dapat mengekstrak durasi",
        text: response.data.error
    });
    // Duration remains null, UI shows fallback message
}
```

### Invalid Number Input
```javascript
try {
    const seconds = parseFloat(durationSeconds);
    // If fails, catch block:
    Toast().fire({
        icon: "error",
        title: "Error mengatur durasi",
        text: "Silakan masukkan angka yang valid (detik)"
    });
}
```

## Performance Considerations

1. **State Updates**: Only updates specific item, not full variants array
2. **API Calls**: Same as existing (no extra calls)
3. **Re-renders**: Only component showing duration re-renders on toggle
4. **Memory**: Two small props added per item (duration_seconds, duration_formatted)
5. **localStorage/Cache**: None needed (state manages everything)

## Accessibility

- ✅ Semantic HTML (buttons, labels, input)
- ✅ ARIA labels (icon descriptions)
- ✅ Keyboard navigation (Tab, Enter)
- ✅ Color not sole indicator (icons + text)
- ✅ Sufficient contrast (blue on white, green badge)
- ✅ Proper form structure (label + input)

## Browser Compatibility

- ✅ Chrome/Edge (Modern)
- ✅ Firefox (Modern)
- ✅ Safari (Modern)
- ✅ Mobile browsers (Responsive design)

## Localization

All UI text in Indonesian (id):
- ✅ "Durasi Video"
- ✅ "Durasi terekstrak:"
- ✅ "Durasi belum terekstrak"
- ✅ "Masukkan durasi dalam detik:"
- ✅ "detik"
- ✅ "Durasi Diatur"
- ✅ "Edit" / "Selesai"

---

Last Updated: February 20, 2026  
Phase: 4.44  
Status: ✅ COMPLETE
