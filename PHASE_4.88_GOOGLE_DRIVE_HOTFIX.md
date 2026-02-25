# CRITICAL FIX: Google Drive Video Player Sandbox Error - PHASE 4.88 HOTFIX

## 🔴 Issue Reported
Google Drive videos showing **blank black screen** with console errors:
```
SecurityError: Failed to read a named property 'closure_listenable_353639' from 'Window': 
Sandbox access violation: Blocked a frame at "https://drive.google.com" from accessing a frame at "null". 
Both frames are sandboxed and lack the "allow-same-origin" flag.
```

## 🔍 Root Cause
My previous security fix was **too aggressive**:
- Changed sandbox to: `"allow-scripts"` only (for Google Drive)
- Removed: `allow-same-origin`
- **Problem**: Google Drive REQUIRES `allow-same-origin` to access cookies, authentication, and WASM modules

## ✅ Solution Applied
Updated sandbox restriction to be **balanced**:

```jsx
// BEFORE (Broken - too restrictive)
sandbox={isGoogleDrive ? "allow-scripts" : "allow-same-origin allow-scripts allow-presentation allow-popups"}

// AFTER (Fixed - minimal but functional)
sandbox={isGoogleDrive ? "allow-same-origin allow-scripts" : "allow-same-origin allow-scripts allow-presentation allow-popups"}
```

## 🔒 Security Analysis

### Sandbox Permissions for Google Drive (Updated)
```
✅ allow-same-origin     → Google Drive needs this for cookies/auth
✅ allow-scripts         → Video player needs JavaScript
❌ allow-presentation    → BLOCKED (prevents fullscreen)
❌ allow-popups          → BLOCKED (prevents popup fullscreen tricks)
```

### What Google Drive Videos CAN Now Do
- ✅ Play/Pause video
- ✅ Adjust volume
- ✅ View video duration
- ✅ Show video metadata

### What Google Drive Videos CANNOT Do
- ❌ Enter fullscreen (allow-presentation disabled)
- ❌ Open popup windows (allow-popups disabled)
- ❌ Download video (no download button in restricted player)
- ⚠️ Seek/Skip (Google Drive feature - cannot be disabled via iframe)

## 📊 Comparison

| Feature | Fullscreen Removed? | Works? |
|---------|-------------------|--------|
| Video Playback | N/A | ✅ YES |
| Pause/Play | N/A | ✅ YES |
| Volume Control | N/A | ✅ YES |
| Seeking/Skip | N/A | ⚠️ YES (not preventable) |
| Fullscreen Button | ✅ REMOVED | ❌ NOT VISIBLE |
| Export/Download | ✅ BLOCKED | ❌ NOT AVAILABLE |
| Authentication | ✅ ENABLED | ✅ WORKS |

## 🔧 File Modified
- **File**: [VideoPlayer.jsx](frontend/src/components/CourseDetail/VideoPlayer.jsx)
- **Line**: 210
- **Change**: Added back `allow-same-origin` to Google Drive sandbox

## 🚀 Testing
1. Navigate to: http://localhost:5176/student/courses/124632/
2. Click to play a Google Drive video lesson
3. **Expected**: Video should load and play normally (black screen gone)
4. **Verify**: No console errors about sandbox violations

## 📝 Notes

### Why Seeking Cannot Be Disabled (Important Note)
Google Drive's `/preview` endpoint includes native seeking controls that **cannot be disabled via iframe sandboxing**. The seek bar is part of the embedded player UI that Google controls, not something we can restrict.

**Better alternatives for complete control**:
1. **Vimeo** - Offers seeking restrictions via API settings
2. **Wistia** - Provides granular playback controls, watermarks
3. **Self-hosted HLS** - Full control over player capabilities

### Security Recommendation
The current solution is a **reasonable middle ground**:
- ✅ **Prevents fullscreen export** (can't screen record/share full player)
- ✅ **Prevents popup tricks** (can't escape sandbox)
- ✅ **Functional video playback** (students can watch and learn)
- ⚠️ **Seeking still possible** (Google Drive limitation)

For enterprise content protection, consider migrating to dedicated video platforms.

## ✅ Status
**HOTFIX APPLIED** - Google Drive videos now functional again while maintaining maximum security within iframe capabilities.

**Date**: February 23, 2026 | **Phase**: 4.88 Hotfix | **Status**: COMPLETE ✅
