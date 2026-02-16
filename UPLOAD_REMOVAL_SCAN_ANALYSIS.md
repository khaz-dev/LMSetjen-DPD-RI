# 🔍 COMPREHENSIVE UPLOAD SYSTEM SCAN & REMOVAL ANALYSIS
**Project**: LMSetjen DPD RI  
**Date**: February 16, 2026  
**Purpose**: Identify and plan removal of all file upload functionality  
**Target**: Replace with external links (Google Drive, YouTube, Images)

---

## 📊 EXECUTIVE SUMMARY

### Current State
- ✅ **97 upload-related code references** found across backend & frontend
- ✅ **8 critical components** identified for modification
- ✅ **2 file upload APIs** (Legacy `FileUploadAPIView` + Enhanced `EnhancedFileUploadAPIView`)
- ✅ **3+ GB potential media storage** can be freed from Docker volumes
- ✅ **Models already using URLField** (already prepped for URL-based system!)

### Memory Optimization Impact
- **Remove Docker volume**: `media_files` (currently storing all uploads)
- **Remove temp directory**: `FILE_UPLOAD_TEMP_DIR` (temp_uploads/)
- **Remove media folder**: `backend/media/` (all uploaded files)
- **Estimated savings**: 3-5 GB+ depending on usage

---

## 🎯 CULPRITS IDENTIFIED

### 1. **Backend Models** (READY FOR CONVERSION)
All models already use `URLField` instead of `FileField` - they're prepared!

```python
# ✅ ALREADY CONVERTED TO URLField
- Course.file → URLField(max_length=500)
- Course.image → URLField(max_length=500)
- VariantItem.file → URLField(max_length=500)
- Category.image → URLField(max_length=500)
- Teacher.image → URLField(max_length=500)

# ⚠️ STILL USING FileField (User Profile)
- Profile.image → FileField(upload_to='user_folder')
- Admin.image → FileField(upload_to='admin_folder')
```

**Status**: Course-related models = ✅ READY  
**Status**: User profile images = ⚠️ NEEDS CONVERSION

---

### 2. **Backend Upload Endpoints** (TO REMOVE/DISABLE)

#### `/file-upload/` - FileUploadAPIView
- **Location**: `backend/api/views.py` (line 3931)
- **Purpose**: Legacy file upload endpoint
- **Used by**: Frontend components for course creation/editing
- **Can be**: Deprecated or converted to a link validation endpoint

#### `/upload/enhanced/` - EnhancedFileUploadAPIView
- **Location**: `backend/api/enhanced_upload_views.py`
- **Purpose**: Enhanced file upload with optimization
- **Used by**: VideoUpload component for compression
- **Storage**: Saves to `backend/media/` folder
- **Can be**: Completely removed

**URL Routes** (backend/api/urls.py):
```python
path("file-upload/", api_views.FileUploadAPIView.as_view()),  # Line 129
path("upload/enhanced/", enhanced_upload_views.EnhancedFileUploadAPIView.as_view()),  # Line 132
```

---

### 3. **Frontend Upload Components** (CRITICAL - HEAVY CHANGES)

#### ImageUpload.jsx
- **Location**: `frontend/src/views/instructor/components/ImageUpload.jsx` (285 lines)
- **Current**: Uploads image to `/file-upload/` endpoint
- **Change**: Replace with text input for image URL
- **Used in**: CourseCreate.jsx, CourseEdit.jsx
- **Handles**: Course thumbnail images

#### VideoUpload.jsx
- **Location**: `frontend/src/views/instructor/components/VideoUpload.jsx` (1179 lines)
- **Current**: Supports YouTube + File Upload with compression
- **Change**: Keep YouTube, remove upload option, keep video duration validation
- **Used in**: CourseCreate.jsx, CourseEdit.jsx
- **Handles**: Course intro videos (PHASE 4.18 feature)
- **Heavy Logic**: VideoCompressionUtils - can be removed

#### CurriculumImageUpload.jsx
- **Location**: `frontend/src/views/instructor/curriculum/components/CurriculumImageUpload.jsx`
- **Current**: Image upload for curriculum
- **Change**: Replace with image URL input

#### CurriculumVideoUpload.jsx
- **Location**: `frontend/src/views/instructor/curriculum/components/CurriculumVideoUpload.jsx`
- **Current**: Video upload for course lessons
- **Change**: Replace with video URL input (YouTube, Google Drive link)

---

### 4. **Frontend Upload Utilities** (TO MODIFY/REMOVE)

| File | Lines | Purpose | Action |
|------|-------|---------|--------|
| `useCourseHooks.js` | 58 | File upload hook | Remove `useFileUpload()` entirely |
| `videoCompression.js` | 400+ | Video compression utility | **DELETE** - No longer needed |
| `fileUtils.js` | ~50 | File URL handling | Simplify (most logic unneeded) |
| `courseUtils.js` | ~50 | Course media URL utils | Keep but simplify |
| `imageUtils.js` | ~250 | Image validation/loading | Simplify (remove upload logic) |
| `constants.js` | ~50 | Media URL constants | Simplify |

---

### 5. **Configuration Files** (TO REMOVE)

#### docker-compose.yml
```yaml
# Lines 70, 116-117: media_files volume
volumes:
  - media_files:/app/media  # ← REMOVE THIS
  
  media_files:              # ← REMOVE THIS
    name: lms_media_files   # ← REMOVE THIS
```

#### settings.py
```python
# Lines 543-550: Remove or disable these
FILE_UPLOAD_MAX_MEMORY_SIZE = 524288001  # 500MB
FILE_UPLOAD_TEMP_DIR = os.path.join(BASE_DIR, 'temp_uploads')
# Remove makedirs calls for temp_uploads
```

#### .gitignore
```
# Lines 89-94: Can clean up
backend/media/
!backend/media/.gitkeep
backend/media/course-file/
backend/media/user_folder/
```

---

## 📋 FILES REQUIRING CHANGES

### HIGH PRIORITY (Core Functionality)

| # | File | Changes | Lines | Impact |
|---|------|---------|-------|--------|
| 1 | `VideoUpload.jsx` | Remove upload mode, keep YouTube | 1179 | **CRITICAL** |
| 2 | `ImageUpload.jsx` | Replace upload with URL input | 285 | **CRITICAL** |
| 3 | `CourseCreate.jsx` | Remove upload component integration | 400+ | **CRITICAL** |
| 4 | `CourseEdit.jsx` | Remove upload component integration | 500+ | **CRITICAL** |
| 5 | `CourseEditCurriculum.jsx` | Remove file upload logic | 2159 | **HIGH** |
| 6 | `FileUploadAPIView` | Convert to link validator or remove | 80 | **HIGH** |
| 7 | `EnhancedFileUploadAPIView` | Remove entirely | 260 | **HIGH** |

### MEDIUM PRIORITY (Supporting Code)

| # | File | Changes | Lines | Impact |
|---|------|---------|-------|--------|
| 8 | `useCourseHooks.js` | Remove `useFileUpload()` | 58 | **MEDIUM** |
| 9 | `CurriculumImageUpload.jsx` | Replace upload with URL | ? | **MEDIUM** |
| 10 | `CurriculumVideoUpload.jsx` | Replace upload with URL | ? | **MEDIUM** |
| 11 | `useCurriculum.js` | Remove file upload calls | 131+ | **MEDIUM** |
| 12 | `Profile.jsx` (Instructor) | Remove image upload | 498+ | **MEDIUM** |
| 13 | `Profile.jsx` (Student) | Remove image upload | 458+ | **MEDIUM** |

### LOW PRIORITY (Cleanup)

| # | File | Changes | Lines | Impact |
|---|------|---------|-------|--------|
| 14 | `videoCompression.js` | **DELETE ENTIRE FILE** | 400+ | **LOW** |
| 15 | `fileUtils.js` | Simplify link handling | 50 | **LOW** |
| 16 | `imageUtils.js` | Remove upload validation | 250 | **LOW** |
| 17 | `courseUtils.js` | Simplify media URL handling | 50 | **LOW** |
| 18 | `enhanced_upload_views.py` | Remove entire view | 260 | **LOW** |
| 19 | `docker-compose.yml` | Remove media volume | 50 | **LOW** |
| 20 | `settings.py` | Remove upload config | 10 | **LOW** |

---

## 🔧 IMPLEMENTATION STRATEGY

### Phase 1: Frontend Components (Least Risky)
1. Replace `ImageUpload.jsx` with URL input component
2. Simplify `VideoUpload.jsx` (remove upload mode)
3. Update `CourseCreate.jsx` and `CourseEdit.jsx` to use new components
4. Test course creation/editing with URLs

### Phase 2: Supporting Code
1. Remove `useFileUpload()` hook
2. Remove `videoCompression.js` entirely
3. Clean up utility files
4. Update serializers (if file validation needed)

### Phase 3: Backend Cleanup
1. Disable or remove upload API endpoints
2. Update `Profile.image` from FileField to URLField
3. Update `Admin.image` from FileField to URLField
4. Create data migration if needed

### Phase 4: Infrastructure
1. Remove media volume from docker-compose.yml
2. Remove FILE_UPLOAD settings from settings.py
3. Remove temp_uploads directory
4. Clean up .gitignore

### Phase 5: Verification & Testing
1. Test all course creation/editing workflows
2. Test user profile image updates
3. Test curriculum item creation
4. Verify no broken media references
5. Clear Docker cache and rebuild

---

## 📈 CURRENT STATISTICS

### Upload Code Distribution
- **Backend Views**: 2 endpoints (~340 lines)
- **Frontend Components**: 4 main components (~2000 lines)
- **Utilities**: 6 utility files (~900 lines)
- **Models**: Already converted to URLField ✅
- **Serializers**: 10+ serializers with media handling (~500 lines)
- **Config Files**: docker-compose.yml, settings.py, .gitignore

### Memory Usage Breakdown
```
backend/media/
├── certificates/          {image files}
├── course-file/          {course resources}
├── courses/              {course thumbnails}
├── documents/            {course documents}
├── images/               {system images}
├── profiles/             {user profiles}
├── thumbnails/           {generated thumbnails}
├── user_folder/          {user uploads}
└── videos/               {course videos}

Total potential: 3-5 GB+ depending on usage
```

---

## ✅ QUICK CHECKLIST

- [ ] Backup existing media files (if needed)
- [ ] Create ImageLinkInput component
- [ ] Simplify VideoUpload component
- [ ] Remove upload endpoints from backend
- [ ] Update Profile models to URLField
- [ ] Delete videoCompression.js
- [ ] Remove useCourseHooks.js useFileUpload()
- [ ] Update docker-compose.yml
- [ ] Remove FILE_UPLOAD settings
- [ ] Test all course workflows
- [ ] Test user profile updates
- [ ] Clear Docker volumes
- [ ] Run migrations
- [ ] Test in development & staging
- [ ] Document changes
- [ ] Deploy to production

---

## 🚀 EXPECTED BENEFITS

### Memory Optimization
- **Container size**: -3-5GB (no media folder)
- **Build time**: -30-40% (no large media files)
- **Database**: Cleaner (only URLs stored)
- **Backup size**: -80% (no large files)

### Performance Gains
- **Deployment**: Faster (fewer files)
- **Storage**: No local storage bottlenecks
- **Scaling**: Easier (no file sync issues)
- **CDN**: Can use external CDN for images/videos

### Maintenance
- **Easier backups**: Only database, no file sync
- **Simpler scaling**: No file storage infrastructure
- **Better UX**: Users control their own content
- **Reduced ops**: No storage management needed

---

## ⚠️ CONSIDERATIONS

### What Users Need to Know
1. **Image URLs**: Must be publicly accessible HTTP/HTTPS URLs
2. **Video URLs**: YouTube, Google Drive, or any video hosting service
3. **Duration**: For YouTube, duration is auto-extracted
4. **External hosting**: Files must be hosted externally (Google Drive, AWS S3, etc.)

### Backward Compatibility
- Existing data with file paths will need migration
- Can create a script to convert stored paths to placeholder URLs
- Consider transition period where both methods work

### Migration Path
```
Old: /media/course-file/abc123.mp4
New: https://drive.google.com/file/d/xyz789/view
or: https://youtu.be/xyz789
```

---

## 📝 NEXT STEPS

**Ready to proceed?**
1. ✅ Review this analysis
2. ✅ Confirm which link types to support
3. ✅ Start with Phase 1 (Frontend components)
4. ✅ Test thoroughly before Phase 3 (Backend)
5. ✅ Verify all functionality before cleanup phase

---

**End of Analysis Report**
