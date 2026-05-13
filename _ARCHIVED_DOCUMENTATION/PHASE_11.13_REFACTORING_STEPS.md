# Pelajaran Tab Refactoring - Step-by-Step Implementation 

## ✨ PHASE 11.13: Complete Refactoring Guide

### Summary
This refactoring extracts ALL Pelajaran (Lectures) tab related code from the monolithic CourseDetail.jsx file into clean, focused modules.

---

## Files Created ✅

### 1. `/frontend/src/utils/usePelajaranTab.js` 
Custom hook with all Pelajaran state management
- **Status**: ✅ CREATED
- **Size**: 211 lines
- **What it exports**: All state and handlers for Pelajaran functionality

### 2. `/frontend/src/utils/variantContextUtils.js`
Utilities for variant (bagian) and lesson (pelajaran) management
- **Status**: ✅ CREATED
- **Size**: 106 lines
- **What it exports**: Helper functions for curriculum navigation

### 3. `/frontend/src/components/CourseDetail/PelajaranTab.css`
All lecture-related CSS styles
- **Status**: ✅ CREATED
- **Size**: 438 lines
- **Contains**: All `.lecture-*`, `.progress-*`, `.completion-*` styles

### 4. `/frontend/src/components/CourseDetail/PelajaranTabContainer.jsx`
Container component that wraps LecturesTab and VideoPlayer
- **Status**: ✅ CREATED
- **Size**: 137 lines
- **Handles**: Certificate checking, lesson restoration, progress coordination

---

## Files That Need Manual Updates ⚙️

### File 1: `frontend/src/views/student/CourseDetail.jsx`

**CHANGE 1: Update Imports (Line 11)**

**CURRENT CODE:**
```javascript
import LecturesTab from "../../components/CourseDetail/LecturesTab";
import VideoPlayer from "../../components/CourseDetail/VideoPlayer"; // ✨ PHASE 4.86: Inline video player (not modal)
```

**NEW CODE:**
```javascript
import PelajaranTabContainer from "../../components/CourseDetail/PelajaranTabContainer";  // ✨ PHASE 11.13: Refactored Pelajaran Tab
```

---

**CHANGE 2: Add CSS Import (Line 19)**

**CURRENT CODE:**
```javascript
import "./CourseDetail.css";
import apiInstance from "../../utils/axios";
```

**NEW CODE:**
```javascript
import "./CourseDetail.css";
import "../../components/CourseDetail/PelajaranTab.css";  // ✨ PHASE 11.13: Pelajaran Tab styles
import apiInstance from "../../utils/axios";
```

---

**CHANGE 3: Remove Pelajaran State Declarations (Lines 25-50)**

**DELETE THESE LINES:**
```javascript
// ✨ PHASE 4.86: Show/hide replaced with inline display based on variantItem
const [variantItem, setVariantItem] = useState(null);
const [autoplayVideo, setAutoplayVideo] = useState(false);  // ✨ PHASE 4.103: Track if video should autoplay
const [isVideoPlaying, setIsVideoPlaying] = useState(false);  // ✨ PHASE 4.105: Track if video is currently playing
const [seekPosition, setSeekPosition] = useState(null);  // ✨ PHASE 4.117: Position to seek to when video loads
const [isResuming, setIsResuming] = useState(false);  // ✨ PHASE 4.117: Flag to prevent progress saves during resume
const videoPlayerRef = useRef(null);  // ✨ PHASE 4.105: Ref to VideoPlayer component
const lecturesTabProgressRef = useRef(null);  // ✨ PHASE 4.115: Ref to external progress update callback
const lecturesTabCompletionRef = useRef(null);  // ✨ PHASE 4.133: Ref to lesson completion callback

// ✨ PHASE 4.146: Certificate state to hide video player when certificate exists
const [existingCertificate, setExistingCertificate] = useState(null);
const [certificateCheckLoading, setCertificateCheckLoading] = useState(false);

// ✨ PHASE 4.225+: Quiz state - declared early for useEffect dependency
const [quizzes, setQuizzes] = useState([]);
const [selectedQuiz, setSelectedQuiz] = useState(null);
const [quizShow, setQuizShow] = useState(false);
const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
const [timeRemaining, setTimeRemaining] = useState(60);
const [isQuizActive, setIsQuizActive] = useState(false);
const [isMouseInQuizArea, setIsMouseInQuizArea] = useState(true);  // ✨ PHASE 4.225+: Track if mouse is in quiz area
const [showLeftQuizNotification, setShowLeftQuizNotification] = useState(false);  // ✨ PHASE 4.225+: Show notification when leaving quiz area
const inlineQuizContainerRef = useRef(null);  // ✨ PHASE 4.225+: Ref for inline quiz container
```

**KEEP THESE** (they're not Pelajaran-specific):
```javascript
const [isProgressCardLoading, setIsProgressCardLoading] = useState(true);
const [completionPercentage, setCompletionPercentage] = useState(0);
const [completionStats, setCompletionStats] = useState({...});
const [activeTab, setActiveTab] = useState('lectures');
const [quizzes, setQuizzes] = useState([]);  // KEEP - Quiz related
const [selectedQuiz, setSelectedQuiz] = useState(null);  // KEEP - Quiz related
const [quizShow, setQuizShow] = useState(false);  // KEEP - Quiz related
const [isQuizActive, setIsQuizActive] = useState(false);  // KEEP - Quiz related
```

---

**CHANGE 4: Remove Pelajaran useEffect Hooks and Handlers**

**DELETE THESE FUNCTIONS/HOOKS** (Lines 364-878 approximately):

- `handleProgressUpdateCallback` function
- `handleMarkLessonAsCompletedCallback` function
- `handleLessonCompletionRegistration` function
- useEffect for variantItem changes
- useEffect for isVideoPlaying changes
- `toggleVideoPlayPause` function
- useEffect for ref syncing (variantItemRef)
- `handleVideoProgress` function (see note below)
- useEffect for auto-scroll to video
- useEffect for variant context computation
- `handlePlayLessonWithAutoplay` function
- useEffect for loading saved lesson
- `checkCertificateExists` function
- useEffect for certificate checking

**IMPORTANT**: Keep `handleVideoProgress` function but MOVE it to a separate location (see below)

---

**CHANGE 5: Update Lectures Tab Rendering (Around Line 4105)**

**FIND THIS CODE:**
```javascript
<LecturesTab
    course={course}
    enrollmentId={enrollmentId}
    fetchCourseDetail={fetchCourseDetail}
    completionPercentage={completionPercentage}
    variantItem={variantItem}
    setVariantItem={handlePlayLessonWithAutoplay}
    isVideoPlaying={isVideoPlaying}
    toggleVideoPlayPause={toggleVideoPlayPause}
    onProgressUpdate={handleProgressUpdateCallback}
    onLessonCompletion={handleLessonCompletionRegistration}
/>
```

**REPLACE WITH:**
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

---

**CHANGE 6: Remove Inline VideoPlayer**

**FIND AND DELETE THIS CODE** (probably around line 4040):
```javascript
{/* ✨ PHASE 4.86: Inline VideoPlayer - displays when variantItem is selected... */}
{variantItem && !(existingCertificate?.image_file_url && activeTab === 'certificate') && !(activeTab === 'quiz' && (quizShow || isQuizActive)) && (
    <div id="video-player-wrapper" className="video-player-wrapper mb-4">
        <VideoPlayer
            ref={videoPlayerRef}
            variantItem={variantItem}
            variantContext={variantContext}
            courseId={course?.course?.id}
            onClose={() => {
                setVariantItem(null);
                setAutoplayVideo(false);
                setIsVideoPlaying(false);
                setSeekPosition(null);
                setIsResuming(false);
            }}
            handleMarkLessonAsCompleted={handleMarkLessonAsCompletedCallback}
            autoplay={autoplayVideo}
            onPlayingChange={setIsVideoPlaying}
            onProgress={handleVideoProgress}
            seekPosition={seekPosition}
        />
    </div>
)}
```

This is now handled by `PelajaranTabContainer`!

---

### File 2: `frontend/src/views/student/CourseDetail.css`

**CHANGE 1: Remove All Lecture-Related CSS Classes**

Delete all CSS classes related to:
- `.lecture-card` (lines ~198-290)
- `.completion-checkbox`
- `.progress-circle` (lines ~60-93)
- `.course-progress-card` (lines ~33-43)
- `.progress-content` (lines ~55-58)
- `.progress-inner` (lines ~88-193)
- `.lesson-item`
- `.lesson-progress`
- `.lesson-progress-indicator`
- `.lesson-play-btn`
- `.curriculum-*` classes
- `.video-player-wrapper`
- `.video-completion-overlay`
- `.completion-notification` animation
- `.upload-progress`
- All related animations for lessons

**Count**: Approximately 400-450 lines to delete

---

## Critical Notes ⚠️

### About the `handleVideoProgress` Function

This function contains complex logic for:
- Tracking video watch time
- Saving progress to backend
- Throttling API calls
- Updating progress refs

**DECISION OPTIONS:**

**Option A (RECOMMENDED): Keep in CourseDetail**
If you need complex coordination between video progress and other tabs, keep `handleVideoProgress` in CourseDetail and pass it to PelajaranTabContainer.

**Option B: Move to PelajaranTabContainer**
If video player is fully isolated from other tabs, move it to PelajaranTabContainer.

### About Notes and Questions Filters

Discussion and Notes filters use `bagian` and `pelajaran` fields:
- They work across tabs
- Not touched by this refactoring
- Leave them as-is in CourseDetail

### About Quiz State

Quiz-related state must stay in CourseDetail because it's used across multiple tabs and has complex coordination logic.

---

## Testing Checklist ✓

After making these changes, test:

- [ ] Click lessons in Pelajaran tab → video loads
- [ ] Play/pause video works
- [ ] Scrolls to video player when lesson clicked
- [ ] Progress saved while watching
- [ ] Lessons mark as completed
- [ ] Completion percentage updates
- [ ] Hard refresh restores last selected lesson
- [ ] Note filters by lesson work (bagian/pelajaran)
- [ ] Q&A filters by lesson work (bagian/pelajaran)
- [ ] Switch to other tabs → video closes
- [ ] Quiz tab shows/hides video correctly
- [ ] Certificate displays instead of video when complete
- [ ] No console errors related to Pelajaran

---

## Expected File Size Reductions

**Before:**
- CourseDetail.jsx: 6,243 lines
- CourseDetail.css: 6,201 lines

**After:**
- CourseDetail.jsx: ~5,400-5,500 lines (-13-15%)
- CourseDetail.css: ~5,750-5,800 lines (-7-8%)

**New Files Added:**
- usePelajaranTab.js: 211 lines
- variantContextUtils.js: 106 lines  
- PelajaranTabContainer.jsx: 137 lines
- PelajaranTab.css: 438 lines

**Net Result**: Cleaner, more maintainable code structure
