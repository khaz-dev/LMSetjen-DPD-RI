# Video Progress - Quick Reference Guide

## When Does Progress Load?

### 1. **Auto-Load on Page Load (InitLoad)** 
When user opens course page:
- LecturesTab.jsx triggers on mount
- Loads progress for ALL video lessons (YouTube + uploaded + Google Drive)
- Updates badges with percentages
- Happens in background (500ms delay for stability)

### 2. **Auto-Load When Clicking Lesson**
When user clicks a lesson to play:
- CourseDetail.jsx detects variantItem change
- Loads progress specifically for THAT lesson
- Shows toast notification if resuming
- Sets seekPosition and autoplay state
- VideoPlayer receives state and handles seek/play

### 3. **Auto-Restore on Hard Refresh**
When user Ctrl+Shift+R or closes/reopens tab:
- CourseDetail.jsx restores from localStorage
- Loads lesson back into player
- Progress load happens (same as #2 above)
- Shows "Melanjutkan Video" toast

---

## How Does Autoplay Work?

### Autoplay Enabled When:
```javascript
✅ Lesson has saved progress (percentage > 0)
✅ Progress is < 99.8% (not completed)
✅ CourseDetail explicitly sets setAutoplayVideo(true)
```

### Autoplay Disabled When:
```javascript
❌ Lesson has 0% progress (brand new)
❌ Lesson is 99.8%+ (already completed)
❌ Error loading progress
❌ User manually pauses
```

### HTML5 Autoplay Attribute:
```javascript
// Only use element autoPlay if NOT resuming from progress
autoPlay={autoplay && (!seekPosition || seekPosition <= 0)}

// If resuming (seekPosition > 0):
// → Skip element autoPlay
// → Use dedicated seek effect to play() after positioning
```

---

## Debug Console Commands

### View Lesson Loading Flow
```javascript
// Shows which lesson is being loaded
console.clear();
// → Open lesson
// → Look for: "📥 [CourseDetail.Progress] Loading progress for SPECIFIC lesson"
// → Check Lesson ID and Title match
```

### Check Progress API Response
```javascript
// Shows what backend returned for this lesson
console.clear();
// → Open lesson
// → Look for: "📊 [CourseDetail.Progress] API returned for lesson {ID}"
// → Shows: progress_percentage, last_watched_position, total_duration
```

### Monitor Seek Effect
```javascript
// Shows HTML5 seek and play
console.clear();
// → Play uploaded video
// → Look for: "⏩ [VideoPlayer.HTML5.onSeek]"
// → Check: "Seeking to saved position: X seconds"
// → Check: "▶️ [VideoPlayer.HTML5.onSeek] Playing after seek"
```

### Monitor YouTube Polling
```javascript
// Shows YouTube state every few seconds
// → Open YouTube video in player
// → Look for: "[VideoPlayer.YouTube] Player state: PLAYING|PAUSED"
// → Every ~1 second after video starts playing
```

---

## Common Issues & Fixes

### Issue: Badge Shows "Siap ditonton" After Hard Refresh
**Problem:** Progress not loading after hard refresh
**Check:**
1. Open console → look for localStorage restore logs
2. Check: "💾 [CourseDetail] Restoring lesson from localStorage"
3. If missing: localStorage data was cleared
4. Fix: Check `handlePlayLessonWithAutoplay` is being called (line 155)

### Issue: Video Doesn't Resume from Saved Position
**Problem:** Video starts from 0:00 instead of saved position
**Check:**
1. Does console show "⏩ [VideoPlayer.HTML5.onSeek]"?
   - If NO: seekPosition is null/undefined
   - Check: Did progress load? "📊 [CourseDetail.Progress] API returned..."?
   - Check: Did it set seekPosition? "⏳ [CourseDetail.Progress] Setting seekPosition"?
2. Does console show "❌ [VideoPlayer.HTML5.onSeek] Seek failed"?
   - If YES: videoRef not ready
   - Fix: Wait for onLoadedMetadata first (should be automatic)

### Issue: YouTube Doesn't Resume/Autoplay
**Problem:** YouTube videos don't resume from saved position
**Check:**
1. Is YouTube player fully loaded?
   - Look for: "[VideoPlayer.YouTube] Player state:"
   - If missing: Player not initialized (wait 1-2 seconds)
2. Did seek attempt happen?
   - Look for: "⏩ [YouTubePlayer] Seeking to saved position"
   - If missing: seekPosition is null or YouTube detection failed
3. Did seek fail after retries?
   - Look for: "⚠️ [YouTubePlayer] Seek failed after 10 retries"
   - Fix: Wait for player.getDuration() > 0 (try refreshing page)

### Issue: Autoplay Not Working
**Problem:** Video plays by itself even when autoplayVideo=false
**Check:**
1. Is autoplayVideo state correct?
   - Look for: "▶️ [CourseDetail.Progress] Enabling autoplay" or "⏹️ Disabling autoplay"
   - Should match whether lesson has saved progress
2. Did HTML5 element ignore the setting?
   - Check: `autoPlay={autoplay && (!seekPosition || seekPosition <= 0)}`
   - This should be FALSE when resuming (seekPosition exists)
3. Browser autoplay policy blocking?
   - Chrome/Firefox require user interaction before autoplay with sound
   - Adding `muted={false}` disables autoplay
   - Fix: Set `muted={true}` temporarily, then muted={false} in playing state

### Issue: Progress Badge Stuck at "Siap ditonton"
**Problem:** Badge never updates from 0% to actual percentage
**Check:**
1. Did InitLoad run?
   - Look for: "🔥 [LecturesTab.InitLoad] Starting..."
   - If missing: Check `course` prop exists in LecturesTab
2. Did InitLoad find any videos?
   - Look for: "📊 [LecturesTab.InitLoad] Found X video lessons"
   - If 0: No video detection. Check `isVideoContent()` function
3. Did InitLoad load this specific lesson?
   - Look for: "🔍 [LecturesTab.InitLoad] Loading progress for: [lesson name]"
   - If missing: Lesson not recognized as video (URL format issue?)
4. Did progress load succeed?
   - Look for: "✅ [LecturesTab.InitLoad] [ID] → X% watched"
   - If: "❌ [LecturesTab.InitLoad] Failed to load"
     - Check network tab for API errors
     - API endpoint: `/student/video-progress/{user}/{item}/`

### Issue: Lesson Autoplay State Carries Over
**Problem:** When switching lessons, old autoplay state persists
**Check:**
1. Does console show lesson-specific progress loading?
   - Look for: "📥 [CourseDetail.Progress] Loading progress for SPECIFIC lesson:"
   - Check Lesson ID changes between lessons
2. Does autoplay reset when no progress?
   - Look for: "⏹️ [CourseDetail.Progress] Disabling autoplay"
   - Should show when new lesson has 0% progress
3. Is variantItem dependency correct?
   - Check CourseDetail useEffect: `}, [variantItem?.variant_item_id])`
   - Should trigger NEW effect when lesson changes

---

## Testing Checklist

### Before Deployment
- [ ] Load course → badges show 0% for new lessons
- [ ] Click video with 0% → doesn't autoplay
- [ ] Click video with 50% → resumes + autoplays
- [ ] Hard refresh → lesson restores, resumes, autoplays
- [ ] YouTube video → resumes and autoplays
- [ ] Uploaded video → resumes and autoplays
- [ ] Rapid lesson switching → each loads own progress correctly
- [ ] Check Network tab → no 0% progress spam
- [ ] Console clear → no errors or warnings

### Manual Testing Scenarios

**Scenario 1: First Time User**
1. Open course with new video
2. Badge = "Siap ditonton" ✓
3. Click video, click play
4. Watch 30-40%
5. Refresh page
6. Badge = ~35% ✓
7. Click video, video resumes ✓

**Scenario 2: Completed Video**
1. Video at 99%+ progress
2. Badge shows "Selesai" or similar ✓
3. Click video
4. Does NOT resume (completed) ✓
5. Starts from beginning ✓

**Scenario 3: Mobile Browser**
1. Open on iPhone Safari
2. Click YouTube video
3. Does it open in native player or embedded?
4. If native: progress still saves ✓
5. Switch back to app: progress restored ✓

---

## API Reference

### Get Progress for Single Lesson
```
GET /student/video-progress/{user_id}/{variant_item_id}/

Response:
{
    "message": "Progress retrieved",
    "data": {
        "progress_percentage": 45.5,
        "last_watched_position": 450,
        "total_duration": 3600
    }
}
```

### Save Progress
```
POST /student/video-progress/

Body:
{
    "user_id": 42,
    "course_id": 1,
    "variant_item_id": 123,
    "progress_percentage": 45.5,
    "last_watched_position": 450,
    "total_duration": 3600
}
```

---

## State Flow Diagram

```
variantItem changes
      ↓
CourseDetail useEffect triggers
      ↓
Load progress for THAT lesson
      ↓
      [Resumable Progress Found]         [No Resumable Progress]
      ↓                                   ↓
setSeekPosition(position)           setSeekPosition(null)
setAutoplayVideo(true)              setAutoplayVideo(false)
      ↓                                   ↓
      [Only for HTML5]                   [All Video Types]
      ↓                                   ↓
seekEffect fires:                   VideoPlayer displays:
  currentTime = position              - Paused state
  play()                              - No autoplay
      ↓                                   ↓
Video resumes + autoplays           User clicks play to start
      ↓
onProgress reports every 500ms
  → Badge updates in LecturesTab
```

---

## Key Files Quick Links

| File | Purpose | Key Lines |
|------|---------|-----------|
| CourseDetail.jsx | Lesson selection + progress load | 155-258 |
| LecturesTab.jsx | Badges + InitLoad | 360-450, 1020-1090 |
| VideoPlayer.jsx | Seek + play logic | 500-528 (HTML5), 653-707 (YouTube), 573-650 (polling) |

---

## Feature Status

| Feature | Status | Notes |
|---------|---------|-------|
| Progress percentage on badges | ✅ Working | All video types |
| Progress loads on page load | ✅ Working | InitLoad + localStorage restore |
| Progress persists across refreshes | ✅ Working | API + localStorage backup |
| YouTube resume + autoplay | ✅ Working | Retry logic handles timing |
| HTML5 resume + autoplay | ✅ Working | Dedicated seek effect |
| Google Drive resume | ✅ Partial | Seek works, no autoplay (sandbox) |
| Lesson isolation (no state carryover) | ✅ Working | Autoplay resets per lesson |
| Progress reporting (no spam) | ✅ Working | Filter 0% updates |
| Toast notifications | ✅ Working | On resume events |

---

## Performance Notes

- InitLoad: 500ms delay after mount (allows component stability)
- YouTube polling: Every 500ms (conservative for battery)
- Progress save throttle: Every ~1 second (after 0% filter)
- Seek retry window: 1 second max (10 retries × 100ms)
- Resume lock: 1.5 seconds (prevents save during seek)

---

## Next Steps / Future Improvements

1. Add "Mark as Completed" button for <90% videos
2. Show estimated time remaining in player header
3. Add playback speed control for long videos
4. Implement video chapters/bookmarks
5. Add watch history timeline view
6. Implement adaptive streaming quality
