# Pelajaran Tab Refactoring - Complete Guide

## What Was Done ✅

### 1. Created `usePelajaranTab` Hook (`src/utils/usePelajaranTab.js`)
- Extracts ALL Pelajaran state management from CourseDetail
- Includes: variantItem, completionPercentage, videoPlayer state, certificate state, refs
- Provides clean methods: `calculateCompletionPercentage`, `toggleVideoPlayPause`, `handlePlayLessonWithAutoplay`, etc.
- **Benefit**: Reduces CourseDetail.jsx by ~200 lines

### 2. Created `variantContextUtils` (`src/utils/variantContextUtils.js`)
- Utilities for variant (bagian) and pelajaran lookups
- Functions: `findVariantContext`, `getVariantContextData`, `getBagianList`, `getPelajaranList`, `formatVariantContextDisplay`
- **Benefit**: Centralizes curriculum navigation logic

### 3. Created `PelajaranTab.css` (`src/components/CourseDetail/PelajaranTab.css`)
- Extracted ALL lecture-related CSS (~400 lines)
- Includes: `.lecture-card`, `.lecture-header`, `.progress-circle`, `.completion-*`, video player styles, etc.
- **Benefit**: Reduces CourseDetail.css by ~400 lines, makes styles maintainable

### 4. Created `PelajaranTabContainer` (`src/components/CourseDetail/PelajaranTabContainer.jsx`)
- Wraps LecturesTab and VideoPlayer components
- Uses usePelajaranTab hook for state management
- Handles certificate checking, lesson restoration, context computation
- **Benefit**: Clean interface for CourseDetail to use

## What Needs to be Done ✏️

### Required Changes to CourseDetail.jsx:

1. **Add Import** (line 11):
```javascript
import PelajaranTabContainer from "../../components/CourseDetail/PelajaranTabContainer";
```

2. **Update Import** (line 11):
```javascript
// REMOVE:
import LecturesTab from "../../components/CourseDetail/LecturesTab";

// ADD:
import PelajaranTabContainer from "../../components/CourseDetail/PelajaranTabContainer";
```

3. **Remove State Declarations** (lines 25-50):
Delete all of these state variables - they're now in usePelajaranTab hook:
- `completionPercentage`, `setCompletionPercentage`
- `completionStats`, `setCompletionStats`
- `variantItem`, `setVariantItem`
- `autoplayVideo`, `setAutoplayVideo`
- `isVideoPlaying`, `setIsVideoPlaying`
- `seekPosition`, `setSeekPosition`
- `isResuming`, `setIsResuming`
- `existingCertificate`, `setExistingCertificate`
- `certificateCheckLoading`, `setCertificateCheckLoading`
- All related refs

4. **Remove useEffect Hooks** (lines 364-878):
Delete these functions and hooks - they're now in usePelajaranTab or PelajaranTabContainer:
- `handleProgressUpdateCallback`
- `handleMarkLessonAsCompletedCallback`
- `handleLessonCompletionRegistration`
- Various useEffect hooks related to variantItem
- `toggleVideoPlayPause`
- `handleVideoProgress` (KEEP THIS - it's needed for coordination)
- `handlePlayLessonWithAutoplay`
- `checkCertificateExists`
- All Pelajaran-related useEffect hooks

5. **Remove Old Function Calls**:
- `calculateCompletionPercentage` (move to utils or keep if used elsewhere)
- Remove all variantItem/pelajaran filtering logic

6. **Update Tab Content** (line ~4105):
Replace the entire `<LecturesTab/>` component section with:
```javascript
<PelajaranTabContainer
    course={course}
    enrollmentId={enrollmentId}
    activeTab={activeTab}
    quizShow={quizShow}
    isQuizActive={isQuizActive}
    fetchCourseDetail={fetchCourseDetail}
    onCompletionPercentageChange={setCompletionPercentage}
/>
```

### Required Changes to CourseDetail.css:

1. **Remove All Lecture-Related CSS** (~400 lines):
Delete these CSS classes:
- `.lecture-card` and related (lines 198-290)
- `.completion-checkbox`
- `.progress-circle` and related
- `.course-progress-card`
- `.lesson-item`
- `.lesson-progress`
- `.curriculum-*`
- `.video-player-wrapper`
- All animations related to lessons

2. **Add Import** (line 19):
```javascript
// Add to CourseDetail.css
@import './PelajaranTab.css';
// OR in CourseDetail.jsx add:
import '../../components/CourseDetail/PelajaranTab.css';
```

## Expected Results

### Before:
- CourseDetail.jsx: 6,243 lines
- CourseDetail.css: 6,201 lines
- Total: 12,444 lines

### After:
- CourseDetail.jsx: ~5,500 lines (-743 lines, -12%)
- CourseDetail.css: ~5,800 lines (-401 lines, -6.5%)
- usePelajaranTab.js: 211 lines (NEW)
- variantContextUtils.js: 106 lines (NEW)
- PelajaranTabContainer.jsx: 137 lines (NEW)
- PelajaranTab.css: 438 lines (NEW)

### Net Reduction:
- **Reduced CourseDetail complexity by 12%**
- **Created 4 focused, reusable modules**
- **Improved code clarity and maintainability**

## Backend Dependencies (No Changes Needed)

All API endpoints remain the same. PelajaranTabContainer and utilities just reorganize the frontend code.

Key endpoints still used:
- `POST /api/v1/variant-item-progress/` - Save progress
- `POST /api/v1/completed-lesson/` - Mark lesson complete
- `GET /api/v1/student/certificates/` - Check certificate
- `GET /api/v1/course/` - Fetch course data

## Testing Checklist

- [ ] Click on lessons - they load video correctly
- [ ] Video plays and pauses
- [ ] Progress is saved while watching
- [ ] Lessons mark as completed
- [ ] Completion percentage updates correctly
- [ ] Certificate hides video player when exists
- [ ] Notes can reference lessons (bagian/pelajaran filters work)
- [ ] Q&A can reference lessons (bagian/pelajaran filters work)
- [ ] Hard refresh restores last selected lesson
- [ ] Tab switching doesn't reset lessons
