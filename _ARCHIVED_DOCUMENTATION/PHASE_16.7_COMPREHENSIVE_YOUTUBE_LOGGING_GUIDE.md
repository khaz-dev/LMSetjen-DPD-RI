# PHASE 16.7: Comprehensive YouTube Pelajaran Logging Guide

**Date:** March 10, 2026  
**Status:** ✅ COMPLETE & VALIDATED  
**Purpose:** End-to-end diagnostic logging for YouTube video playback in Pelajaran (lessons)

---

## 📋 Executive Summary

Full logging trace has been implemented across the YouTube video player ecosystem to diagnose all issues related to video playback, progress tracking, and lesson completion flows.

**Frontend:** VideoPlayerYoutubeSimplified.jsx  
**Backend:** VideoProgressAPIView & VideoProgressDetailAPIView

All logging outputs are **timestamped** with format: `[HH:MM:SS.mmm]` for precise timing analysis.

---

## 🎯 Logging Coverage Areas

### Frontend Logging (VideoPlayerYoutubeSimplified.jsx)

#### 1. **YouTube API Initialization** ✅
```
[HH:MM:SS.mmm] 🎬 YouTube-Pelajaran [variant_id] Starting YouTube API initialization
[HH:MM:SS.mmm] ⏳ YouTube-Pelajaran [variant_id] Waiting for YouTube API to load from CDN...
[HH:MM:SS.mmm] ✅ YouTube-Pelajaran [variant_id] YouTube API loaded and available
[HH:MM:SS.mmm] 🎥 YouTube-Pelajaran [variant_id] Creating new YouTube API player
[HH:MM:SS.mmm] ✅ YouTube-Pelajaran [variant_id] YouTube player instance created
```

**Purpose:** Tracks YouTube IFrame API availability and player creation  
**Key Metrics:** API load time, player creation success/failure

#### 2. **Player Readiness Detection** ✅
```
[HH:MM:SS.mmm] ⏱️ Duration check #5: 150.25s
[HH:MM:SS.mmm] ✅ YouTube-Pelajaran [variant_id] Player ready! Video duration: 150.25s
[HH:MM:SS.mmm] ⚠️ YouTube-Pelajaran [variant_id] Could not get valid duration after max retries
```

**Purpose:** Detects when player has loaded video metadata  
**Key Metrics:** Duration value, retry attempts, time to readiness

**Max Retries:** 20 checks × 100ms = ~2 seconds before timeout

#### 3. **Progress Polling** ✅
```
[HH:MM:SS.mmm] 📊 VideoProgress CREATE: Starting progress polling (1s interval)
[HH:MM:SS.mmm] 📺 Poll #10: 45.2s / 150.3s (30.1%)
[HH:MM:SS.mmm] 📺 Poll #20: 95.7s / 150.3s (63.6%)
[HH:MM:SS.mmm] ⏹️ Polling stopped - lesson completed (347 total polls)
```

**Purpose:** Tracks real-time video progress at 1-second intervals  
**Key Metrics:** Current time, duration, percentage watched, total polls before completion

**Optimization:** Logs every 10th poll to avoid console spam (10 logs per 100 seconds)

#### 4. **Seek Operations** ✅
```
[HH:MM:SS.mmm] ⏩ YouTube-Pelajaran [variant_id] Seeking to saved position
[HH:MM:SS.mmm] ℹ️ Seek position already applied, skipping
[HH:MM:SS.mmm] ⏳ Attempting seek (retry queue started for position 45.30s)
[HH:MM:SS.mmm] ⏩ Executing seek: N/A → 45.30s
[HH:MM:SS.mmm] ✅ YouTube-Pelajaran [variant_id] Seek completed successfully
[HH:MM:SS.mmm] ❌ Seek failed after max retries
```

**Purpose:** Tracks resumed playback from saved position  
**Key Metrics:** Target seek position, retry attempts, success/failure

**Retry Strategy:** Exponential backoff (50ms → 500ms, max 15 retries)

#### 5. **Lesson Completion Detection** ✅
```
[HH:MM:SS.mmm] 🏁 YouTube-Pelajaran [variant_id] Video ENDED - checking for completion question
[HH:MM:SS.mmm] 🔍 Fetching completion question from backend
[HH:MM:SS.mmm] ❓ Completion question found, showing modal
[HH:MM:SS.mmm] 📝 Calling handleMarkLessonAsCompleted
[HH:MM:SS.mmm] ✅ Completion question answered correctly!
```

**Purpose:** Tracks when videos finish and completion flow triggers  
**Key Metrics:** Video end detection, question fetch, answer status

#### 6. **Access Mode Control** ✅
```
[HH:MM:SS.mmm] 🔄 Lesson changed, resetting state
[HH:MM:SS.mmm] Access mode set: FULL
[HH:MM:SS.mmm] 🔐 Lesson complete - switching to FULL mode
[HH:MM:SS.mmm] 🔒 Lesson not complete yet
[HH:MM:SS.mmm] 🔐 Modal closed - lesson complete, keeping FULL mode
[HH:MM:SS.mmm] 🔒 Modal closed - lesson not complete, resetting to LIMITED mode
```

**Purpose:** Tracks LIMITED (student is watching) vs FULL (student skipped ahead) mode transitions  
**Key Metrics:** Access level, mode changes, completion status

#### 7. **Playback Controls** ✅
```
[HH:MM:SS.mmm] ▶️ YouTube-Pelajaran [variant_id] Playing video
[HH:MM:SS.mmm] ⏸️ YouTube-Pelajaran [variant_id] Pausing video
[HH:MM:SS.mmm] ⏪ YouTube-Pelajaran [variant_id] Seek backward: 45.2s → 40.2s
```

**Purpose:** Tracks user control interactions (play, pause, seek)  
**Key Metrics:** Action type, timestamps

#### 8. **Component Lifecycle** ✅
```
[HH:MM:SS.mmm] 🛑 YouTube-Pelajaran [variant_id] Destroying old YouTube player
[HH:MM:SS.mmm] ✅ Old player destroyed
[HH:MM:SS.mmm] 🛑 Cleaning up progress polling (347 total polls)
[HH:MM:SS.mmm] 🛑 Destroying YouTube player in cleanup
[HH:MM:SS.mmm] ✅ Player destroyed in cleanup
```

**Purpose:** Tracks player cleanup when component unmounts or changes lessons  
**Key Metrics:** Total polls before cleanup, cleanup success/failure

---

### Backend Logging (VideoProgressAPIView)

#### 1. **Progress Retrieval** ✅
```
[HH:MM:SS.mmm] 🔍 VideoProgress GET: Looking up progress user_id=123, course_id=45, variant_item_id=abc123def456
[HH:MM:SS.mmm] ✅ VideoProgress GET: Found progress - 75.5% complete
[HH:MM:SS.mmm] ℹ️ VideoProgress GET: No progress found (returning default)
[HH:MM:SS.mmm] ❌ VideoProgress GET: Unexpected error - [error message]
```

**Purpose:** Tracks progress retrieval requests from frontend  
**Key Metrics:** User ID, course ID, variant item ID, progress percentage

#### 2. **Progress Creation/Update** ✅
```
[HH:MM:SS.mmm] 🎥 VideoProgress CREATE: Received request for user_id=123, variant_item_id=abc123def456
[HH:MM:SS.mmm] 📊 VideoProgress CREATE: Progress: 50.5%, Position: 75.2s, Duration: 150.0s
[HH:MM:SS.mmm] ✅ VideoProgress CREATE: Found user 'johndoe' (ID: 123)
[HH:MM:SS.mmm] ✅ VideoProgress CREATE: Found course 'Python Basics' (ID: 45)
[HH:MM:SS.mmm] ✅ VideoProgress CREATE: Found variant_item 'Introduction to Variables'
[HH:MM:SS.mmm] 💾 VideoProgress CREATE: Saving progress to database...
[HH:MM:SS.mmm] 🎯 VideoProgress CREATE: Video watched 95.5% - marking as FULLY_WATCHED
[HH:MM:SS.mmm] ✅ VideoProgress CREATE: Updated progress for 'johndoe' - 95.5% complete
```

**Purpose:** Tracks progress updates sent from frontend  
**Key Metrics:** Progress percentage, position, duration, user name, variant item name

**Auto-Complete:** When progress reaches 95%+, automatically marks as `is_fully_watched`

#### 3. **Data Validation** ✅
```
[HH:MM:SS.mmm] ❌ VideoProgress CREATE: Type conversion error - [error message]
[HH:MM:SS.mmm] ❌ VideoProgress CREATE: User 123 not found
[HH:MM:SS.mmm] ❌ VideoProgress CREATE: Course 45 not found
[HH:MM:SS.mmm] ❌ VideoProgress CREATE: VariantItem abc123def456 not found
```

**Purpose:** Detects data validation issues  
**Key Metrics:** Error type, missing resources

#### 4. **Database Operations** ✅
```
[HH:MM:SS.mmm] 💾 VideoProgress CREATE: Saving progress to database...
[HH:MM:SS.mmm] ✅ VideoProgress CREATE: Created progress for 'johndoe' - 45.2% complete
[HH:MM:SS.mmm] ✅ VideoProgress CREATE: Updated progress for 'johndoe' - 75.5% complete
```

**Purpose:** Tracks creates vs updates, shows final state  
**Key Metrics:** Operation type (create/update), final progress percentage

---

## 🔍 How to Read the Logs

### Browser Console (Frontend)

1. Open DevTools: `F12` or `Ctrl+Shift+I`
2. Go to **Console** tab
3. Filter by `YouTube-Pelajaran` to see all video logs
4. Each log line includes:
   - **Timestamp** `[HH:MM:SS.mmm]`
   - **Emoji indicator** (🎬 = init, ✅ = success, ❌ = error, etc.)
   - **Category** `YouTube-Pelajaran [variant_id]`
   - **Message** and optional data object

**Example flow to watch:**
```
[14:32:15.230] 🎬 YouTube-Pelajaran [var_123abc] Starting YouTube API initialization
[14:32:15.340] ⏳ YouTube-Pelajaran [var_123abc] Waiting for YouTube API to load from CDN...
[14:32:15.450] ✅ YouTube-Pelajaran [var_123abc] YouTube API loaded and available
[14:32:15.460] 🎥 YouTube-Pelajaran [var_123abc] Creating new YouTube API player
[14:32:15.480] ✅ YouTube-Pelajaran [var_123abc] YouTube player instance created
[14:32:15.550] ⏱️ Duration check #1: 0.00s
[14:32:15.650] ⏱️ Duration check #2: 150.25s
[14:32:15.660] ✅ YouTube-Pelajaran [var_123abc] Player ready! Video duration: 150.25s
[14:32:15.670] 📊 VideoProgress CREATE: Starting progress polling (1s interval)
```

### Terminal/Server Output (Backend)

1. Run Django server: `python manage.py runserver`
2. Watch terminal output as requests arrive
3. Each request logs all steps from receive → validate → save → respond

**Example flow to watch:**
```
[14:32:20.125] 🎥 VideoProgress CREATE: Received request for user_id=123, variant_item_id=var_123abc
[14:32:20.126] 📊 VideoProgress CREATE: Progress: 15.2%, Position: 22.8s, Duration: 150.0s
[14:32:20.127] ✅ VideoProgress CREATE: Found user 'student_john' (ID: 123)
[14:32:20.128] ✅ VideoProgress CREATE: Found course 'Python Mastery' (ID: 5)
[14:32:20.129] ✅ VideoProgress CREATE: Found variant_item 'Variables & Data Types'
[14:32:20.130] 💾 VideoProgress CREATE: Saving progress to database...
[14:32:20.135] ✅ VideoProgress CREATE: Updated progress for 'student_john' - 15.2% complete
```

---

## 📊 Troubleshooting Guide

### Issue: Video doesn't load
**Look for:**
- ❌ YouTube API load failure? Check if YouTube CDN is accessible
- ❌ Player creation error? Check browser console for JavaScript errors
- ⏳ Player stuck in readiness check? May indicate video ID extraction issue

**Sample logs:**
```
[HH:MM:SS.mmm] ⏳ Waiting for YouTube API to load from CDN...
[HH:MM:SS.mmm] ⏰ (10 seconds pass - no API loaded)
→ YouTube API CDN is blocked or unreachable
```

### Issue: Progress not saving
**Look for:**
- ❌ On frontend: "Fetching progress status from backend" followed by error?
- ❌ On backend: "User XXX not found" or "VariantItem XXX not found"?
- 🔍 Type mismatch? (variant_item_id should be string, not integer)

**Sample logs:**
```
[HH:MM:SS.mmm] 📡 Fetching progress status from backend
[HH:MM:SS.mmm] ❌ Failed to fetch progress status {"error": "User not found"}
→ User ID not matching database value, check authentication
```

### Issue: Video plays but doesn't track progress
**Look for:**
- ✅ Player ready and polling started?
- 📺 Poll logs showing 0% progress for entire video?
- 🎯 Video ends but completion question never appears?

**Sample logs:**
```
[HH:MM:SS.mmm] ✅ Player ready! Video duration: 150.25s
[HH:MM:SS.mmm] 📊 Starting progress polling (1s interval)
[HH:MM:SS.mmm] 📺 Poll #10: 0.0s / 150.3s (0.0%)
[HH:MM:SS.mmm] 📺 Poll #20: 0.0s / 150.3s (0.0%)
→ Player not actually playing, or progress callback not working
```

### Issue: Lesson not marked as complete
**Look for:**
- 🏁 "Video ENDED" event fired?
- 🔍 "Fetching completion question" succeeded?
- ❓ Question modal appeared?
- 📝 "handleMatchLessonAsCompleted" called?

**Sample logs:**
```
[HH:MM:SS.mmm] 🏁 Video ENDED - checking for completion question
[HH:MM:SS.mmm] 🔍 Fetching completion question from backend
[HH:MM:SS.mmm] ✅ Lesson already completed, skipping verification question
→ Lesson was already marked complete (likely on another device)
```

---

## 🔧 Log Filtering Tips

### Browser Console Filters

**Show only errors:**
```javascript
// Filter for error/warn levels
console.error = console.log; // or search for "❌" emoji
```

**Show only specific variant:**
```javascript
// Filter in console search (Ctrl+F)
YouTube-Pelajaran [your_variant_id_here]
```

**Show only progress polls (every 10th):**
```javascript
// Filter in console
📺 Poll #
```

### Backend Log Filtering

**Show only CREATE operations:**
```bash
grep "VideoProgress CREATE" django.log
```

**Show only errors:**
```bash
grep "❌" django.log
```

**Show specific user:**
```bash
grep "user_id=123" django.log
```

**Real-time tail with filtering:**
```bash
tail -f django.log | grep "VideoProgress"
```

---

## 📈 Performance Baseline

Typical timings from healthy system:

| Operation | Expected Duration | Range |
|-----------|------------------|-------|
| API Load | 100-200ms | 50-500ms |
| Player Creation | 20-50ms | 10-100ms |
| Duration Detection | 150-300ms | 50-1000ms* |
| First Progress Poll | ~1 second | 1-2s |
| Progress Save (API) | 100-300ms | 50-1000ms |
| Seek Operation | 100-200ms | 50-500ms |

*May take longer if video metadata slow to load

---

## 🚀 Example Complete Flow

**Student opens Pelajaran (lesson page):**
```
[14:32:15.230] 🎬 Starting YouTube API initialization
[14:32:15.450] ✅ YouTube API loaded and available
[14:32:15.480] ✅ YouTube player instance created
[14:32:15.670] ✅ Player ready! Video duration: 150.25s
[14:32:15.700] 📊 Starting progress polling (1s interval)
[14:32:20.125] 📡 Fetching progress status from backend
[14:32:20.250] ✅ Progress status received
```

**Student watches video for 30 seconds:**
```
[14:32:25.000] 📺 Poll #10: 30.2s / 150.3s (20.1%)  [backend: Progress saved]
[14:32:35.000] 📺 Poll #20: 40.5s / 150.3s (26.9%)  [backend: Progress saved]
```

**Student clicks play:**
```
[14:32:35.500] ▶️ Playing video
```

**Video reaches end (150s):**
```
[14:33:05.000] 📺 Poll #90: 150.3s / 150.3s (100.0%)
[14:33:06.000] 🏁 Video ENDED - checking for completion question
[14:33:06.050] 🔍 Fetching completion question from backend
[14:33:06.200] ❓ Completion question found, showing modal
[14:33:10.000] ✅ Completion question answered correctly!
[14:33:10.100] 🔐 Lesson complete - switching to FULL mode
[14:33:10.200] ⏹️ Polling stopped - lesson completed (90 total polls)
```

---

## 📝 Next Steps

1. **Run the application** with video playback
2. **Open browser console** (F12)
3. **Watch the log flow** to identify bottlenecks
4. **Compare with backend logs** to see request/response timing
5. **Report any anomalies** with log snippets

---

**Version:** PHASE 16.7  
**Last Updated:** March 10, 2026
