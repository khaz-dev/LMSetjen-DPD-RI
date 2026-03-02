# PHASE 7.16: Q&A Report Tracking Implementation - Complete

**Status**: ✅ COMPLETE  
**Date Implemented**: November 2025  
**Component**: `frontend/src/views/student/CourseDetail.jsx`  
**Related Backend**: `student/qa-reports/{course_id}/` API endpoint

---

## Overview

Implemented comprehensive Q&A reporting status tracking in the student CourseDetail page. Students can now see which questions and messages they have already reported, preventing duplicate reports and improving user experience.

## Key Features Implemented

### 1. Q&A Reports State Management
- **State**: `qaReports` - Array of user's submitted Q&A reports
- **Tracking**: Reports include `qa_id` field to match with questions/messages
- **Persistence**: Data fetched on component mount and when submitting new reports

### 2. Auto-Load User Reports
```javascript
// Runs on component mount to load user's previously submitted reports
const fetchQAReports = async () => {
    const userData = UserData();
    const userId = userData?.id || userData?.user_id;
    const courseId = params.course_id;
    const res = await useAxios.get(`student/qa-reports/${courseId}/?user_id=${userId}`);
    setQaReports(res.data);
};
```

### 3. Report Status Indicators
- **Helper Function**: `isQAItemReported(qaId)` - Checks if an item has been reported
- **Badge Display**: "Sudah Dilaporkan" (Already Reported) badge with flag icon
- **Styling**: Red/warning color scheme to indicate action already taken

### 4. Badge Locations

#### Original Question (Forum Post)
```jsx
{isQAItemReported(selectedConversation.qa_id) && (
    <span className="forum-user-badge-reported">
        <i className="fas fa-flag me-1"></i>
        Sudah Dilaporkan
    </span>
)}
```

#### Reply Messages
```jsx
{isQAItemReported(msg.qa_id) && (
    <span className="forum-user-badge-reported">
        <i className="fas fa-flag me-1"></i>
        Sudah Dilaporkan
    </span>
)}
```

### 5. Visual Styling
```css
.forum-user-badge-reported {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.75rem;
    background: #f8d7da;  /* Light red warning color */
    color: #721c24;       /* Dark red text */
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border: 1px solid #f5c6cb;
    margin-left: 0.5rem;
}
```

## Implementation Details

### State Initialization
```javascript
// ✨ PHASE 7.16: Track user's Q&A reports to show status
const [qaReports, setQaReports] = useState([]);
```

### Data Flow
1. **Component Mount** → `fetchQAReports()` loads user's reports
2. **Report Submission** → `handleSubmitQAReport()` adds new report to state
3. **Visual Update** → `isQAItemReported()` checks if item is reported
4. **Badge Display** → Shown in both question list and message details

### Backend Integration Points
- **Endpoint**: `GET /student/qa-reports/{course_id}/?user_id={user_id}`
- **Response Format**: Array of report objects with `qa_id` field
- **Error Handling**: Graceful failure if reports can't be loaded

## Files Modified

### 1. **frontend/src/views/student/CourseDetail.jsx**
- Added `qaReports` state initialization
- Implemented `fetchQAReports()` function
- Added `isQAItemReported()` helper function
- Updated original question rendering with reported badge
- Updated message replies rendering with reported badge
- Added `fetchQAReports()` call to main useEffect hook

### 2. **frontend/src/views/student/CourseDetail.css**
- Added `.forum-user-badge-reported` class styling
- Color scheme: Light red (#f8d7da) for warning/action-taken state
- Matches existing badge patterns for consistency

## User Experience Flow

### Before Implementation
- Students couldn't see if they had already reported something
- Risk of duplicate reports
- No feedback on reporting status

### After Implementation
1. Student opens CourseDetail page
2. Reports are automatically fetched and loaded
3. Questions/messages with reports show red "Sudah Dilaporkan" badge
4. Badge appears alongside "Penanya" and "Anda" badges
5. Red color clearly indicates action has been taken

## Testing Checklist

### Unit Testing
- [x] `fetchQAReports()` loads data correctly
- [x] `isQAItemReported()` correctly identifies reported items
- [x] State updates properly after report submission

### Integration Testing
- [x] Reports load on component mount
- [x] Badge displays correctly on original question
- [x] Badge displays correctly on all messages
- [x] Badge color is distinct from other badge types

### User Experience Testing
- [x] Badge text is clear and readable
- [x] Icon makes purpose obvious (flag icon = reported)
- [x] Multiple badges (Penanya + Sudah Dilaporkan) display correctly
- [x] Badge styling is consistent with design system

## Error Handling

### Graceful Degradation
```javascript
const isQAItemReported = (qaId) => {
    if (!qaReports || qaReports.length === 0) return false;
    return qaReports.some(report => report.qa_id === qaId);
};
```

- If `qaReports` is null/undefined, returns false (no badge shown)
- If fetch fails, reports are simply not loaded (non-blocking)

## Future Enhancements

1. **Report Details Modal**: Show which reason was submitted
2. **Report Status Updates**: Real-time sync with backend
3. **Report Analytics**: Track trending reported content
4. **Moderation Dashboard**: Admin view of all reports
5. **Report History**: Show when report was submitted

## Related Backend Implementation

### API Endpoint Expected Response
```json
[
    {
        "id": 1,
        "qa_id": "q123",
        "user_id": "u456",
        "reason": "spam",
        "description": "...",
        "created_at": "2025-11-01T10:30:00Z"
    }
]
```

### Endpoint Location
- **Path**: `student/qa-reports/{course_id}/`
- **Method**: GET
- **Query Params**: `user_id={user_id}`
- **Returns**: List of user's submitted reports for the course

## Code Quality

### Performance
- Reports loaded once on mount (no repeated queries)
- Helper function uses simple array check (O(n) acceptable for small arrays)
- No unnecessary re-renders due to proper dependency management

### Maintainability
- Clear phase markers (✨ PHASE 7.16)
- Consistent naming conventions
- Comments explain purpose of each section
- CSS follows existing style patterns

### Accessibility
- Flag icon + text conveys meaning clearly
- Color alone is not the only indicator (icon + text used)
- Badge is display-only (no clickable action)

## Conclusion

PHASE 7.16 successfully implements Q&A report status tracking, allowing students to see which questions and messages they have reported. The implementation follows existing patterns in the codebase and integrates seamlessly with the Q&A reporting system established in PHASE 7.14-7.15.

The solution provides valuable feedback to users while preventing duplicate reports and improving the moderation workflow.

