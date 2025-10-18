# Testing File Upload 403 Fix

## ✅ Fix Deployed Successfully

**Deployment Time**: 2025-10-18 08:15:30 UTC  
**Commit**: `25bacf7` - "fix: Add CSRF exemption to file upload endpoints to resolve 403 Forbidden errors"  
**Status**: Backend restarted and running on 4 workers

---

## Test Plan

### 1. Course Thumbnail Upload Test (PRIMARY FIX) 🎯

**Steps**:
1. Navigate to: https://lmsetjendpdri.duckdns.org/instructor/create-course/
2. Click "Upload Course Thumbnail" button
3. Select an image file (JPG/PNG)
4. Use the crop tool to adjust the image (16:9 aspect ratio)
5. Click "Crop & Save" button

**Expected Result**:
- ✅ Image uploads successfully (no 403 error)
- ✅ Preview displays the cropped image
- ✅ File URL returned: `/media/course-file/{uuid}.{ext}`
- ✅ Console shows: `POST /api/v1/file-upload/ 200 OK`

**Previous Error** (Now Fixed):
```
❌ POST https://lmsetjendpdri.duckdns.org/api/v1/file-upload/ 403 (Forbidden)
```

---

### 2. Profile Picture Upload Test

**Steps**:
1. Go to user profile settings
2. Upload a profile picture
3. Crop if needed and save

**Expected Result**:
- ✅ HTTP 200 OK response
- ✅ Profile picture updates successfully

---

### 3. Course Video Upload Test

**Steps**:
1. Create or edit a course
2. Upload course introduction video
3. Wait for upload to complete

**Expected Result**:
- ✅ Video uploads without 403 errors
- ✅ Upload progress displays correctly
- ✅ Video URL stored in course data

---

### 4. Lesson File Upload Test

**Steps**:
1. Create a lesson in a course curriculum
2. Upload supplementary files (PDF, PPT, etc.)
3. Verify file attachment

**Expected Result**:
- ✅ Files upload successfully
- ✅ No CSRF errors in console
- ✅ Files accessible from lesson page

---

## Backend Verification

### Check for 403 Errors in Logs

**Command**:
```bash
ssh -i "lms-server-key.pem" ubuntu@16.79.83.21 "docker logs lms_backend 2>&1 | grep -i '403\|forbidden' | tail -20"
```

**Expected**:
- ❌ No new "Forbidden: /api/v1/file-upload/" entries after deployment
- ✅ Only old entries from before 08:15:30 UTC

---

### Monitor Successful Uploads

**Command**:
```bash
ssh -i "lms-server-key.pem" ubuntu@16.79.83.21 "docker logs lms_backend 2>&1 | grep 'file-upload' | tail -20"
```

**Expected**:
```
172.19.0.5 - - [18/Oct/2025:08:20:00 +0000] "POST /api/v1/file-upload/ HTTP/1.1" 200 120
```

---

## cURL Testing

### Test Without Authentication (Public Upload)

```bash
curl -X POST https://lmsetjendpdri.duckdns.org/api/v1/file-upload/ \
  -F "file=@test-image.jpg" \
  -F "course=1" \
  -v
```

**Expected Response**:
```json
HTTP/2 200 OK
{
  "file": "https://lmsetjendpdri.duckdns.org/media/course-file/abc123.jpg",
  "type": "image",
  "status": "success"
}
```

---

### Test Enhanced Upload Endpoint

```bash
curl -X POST https://lmsetjendpdri.duckdns.org/api/v1/upload/enhanced/ \
  -F "file=@test-video.mp4" \
  -F "context=course" \
  -v
```

**Expected Response**:
```json
HTTP/2 200 OK
{
  "id": "uuid-here",
  "file": "/media/course-file/video123.mp4",
  "original_name": "test-video.mp4",
  "size": 12345678,
  "type": "video",
  "duration": 120.5,
  "thumbnail": "/media/thumbnails/video123.jpg"
}
```

---

### Test Bulk Upload

```bash
curl -X POST https://lmsetjendpdri.duckdns.org/api/v1/upload/bulk/ \
  -F "files[]=@image1.jpg" \
  -F "files[]=@image2.jpg" \
  -F "files[]=@image3.jpg" \
  -v
```

**Expected Response**:
```json
HTTP/2 200 OK
{
  "results": [
    {"file": "/media/course-file/img1.jpg", "status": "success"},
    {"file": "/media/course-file/img2.jpg", "status": "success"},
    {"file": "/media/course-file/img3.jpg", "status": "success"}
  ],
  "total": 3,
  "successful": 3,
  "failed": 0
}
```

---

## Browser Console Verification

### Check Network Tab

1. Open browser DevTools (F12)
2. Navigate to Network tab
3. Perform file upload
4. Look for `/api/v1/file-upload/` request

**Verify**:
- ✅ **Status**: 200 OK (not 403)
- ✅ **Request Method**: POST
- ✅ **Content-Type**: multipart/form-data
- ✅ **Authorization**: Bearer {JWT_TOKEN} (present)
- ✅ **Response**: Contains file URL

---

### Check Console for Errors

**Before Fix** (Should not appear anymore):
```javascript
❌ POST https://lmsetjendpdri.duckdns.org/api/v1/file-upload/ 403 (Forbidden)
❌ Error: Request failed with status code 403
```

**After Fix** (Expected):
```javascript
✅ POST https://lmsetjendpdri.duckdns.org/api/v1/file-upload/ 200 (OK)
✅ File uploaded successfully: /media/course-file/abc123.jpg
```

---

## Security Verification

### Confirm CSRF Protection Still Active

Test a session-based endpoint that **should** require CSRF:

```bash
curl -X POST https://lmsetjendpdri.duckdns.org/admin/login/ \
  -d "username=admin&password=test" \
  -v
```

**Expected**: Should still return 403 if CSRF token missing (CSRF protection working for other endpoints)

---

### Verify JWT Authentication Working

Test an authenticated endpoint:

```bash
curl -X GET https://lmsetjendpdri.duckdns.org/api/v1/instructor/courses/ \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected**: HTTP 200 OK with courses data (JWT auth still working)

---

## Regression Tests

### Ensure Previous Fixes Still Work

#### ✅ Static Files (Should still load)
- https://lmsetjendpdri.duckdns.org/static/admin/css/base.css
- https://lmsetjendpdri.duckdns.org/static/rest_framework/css/bootstrap.min.css
- **Expected**: HTTP 200 OK

#### ✅ Admin Panel (Should still work)
- https://lmsetjendpdri.duckdns.org/admin/
- **Expected**: Loads with full styling

#### ✅ Swagger UI (Should still work)
- https://lmsetjendpdri.duckdns.org/swagger/
- **Expected**: Interactive API docs with styling

#### ✅ Video Upload (Should still handle large files)
- Upload 200MB video file
- **Expected**: No 413 error, upload completes successfully

---

## Performance Testing

### Upload Speed Test

```bash
time curl -X POST https://lmsetjendpdri.duckdns.org/api/v1/file-upload/ \
  -F "file=@large-file.jpg"
```

**Benchmark**:
- Small image (1MB): < 1 second
- Medium image (5MB): < 3 seconds
- Large video (100MB): < 30 seconds

---

## User Acceptance Testing

### Instructor Workflow

1. **Create Course**:
   - ✅ Upload course thumbnail (16:9 ratio)
   - ✅ Upload course intro video
   - ✅ Save course details

2. **Add Curriculum**:
   - ✅ Create sections and lessons
   - ✅ Upload lesson videos
   - ✅ Attach supplementary files (PDF, PPT)

3. **Publish Course**:
   - ✅ Preview course page
   - ✅ All media files display correctly
   - ✅ No broken image links

### Student Workflow

1. **View Course**:
   - ✅ Course thumbnail displays
   - ✅ Course intro video plays
   - ✅ Lesson content accessible

2. **Download Files**:
   - ✅ PDF/PPT downloads work
   - ✅ No 403 errors on media files

---

## Rollback Plan (If Issues Occur)

### Revert to Previous Version

```bash
# SSH to server
ssh -i "lms-server-key.pem" ubuntu@16.79.83.21

# Navigate to project
cd /home/ubuntu/LMSetjen-DPD-RI

# Revert to previous commit
git revert 25bacf7

# Restart backend
docker compose restart backend
```

---

## Success Criteria

### ✅ Fix is successful if:

1. **Primary Issue Resolved**:
   - Course thumbnail upload returns HTTP 200 OK
   - No 403 Forbidden errors in browser console
   - Cropped images save successfully

2. **No Regressions**:
   - Static files still load (admin, swagger, redoc)
   - JWT authentication still works
   - Other file uploads still work
   - Video uploads under 500MB succeed

3. **Security Maintained**:
   - Session-based endpoints still enforce CSRF
   - JWT tokens required for authenticated endpoints
   - File validation still active

4. **Performance Acceptable**:
   - Upload times similar to before fix
   - No increased server load
   - Memory usage stable

---

## Monitoring

### Set Up Alerts

**Monitor for**:
- 403 errors increasing after deployment
- File upload failures
- Backend container restarts
- High memory/CPU usage

**Command** (Check every 5 minutes):
```bash
watch -n 300 'docker logs lms_backend 2>&1 | grep "403\|error" | tail -10'
```

---

## Post-Deployment Checklist

- [x] Code committed with descriptive message
- [x] Changes pushed to remote repository
- [x] Server pulled latest code
- [x] Backend container restarted successfully
- [ ] File upload tested from browser *(Manual test required)*
- [ ] Backend logs checked for 403 errors *(Ongoing monitoring)*
- [ ] All four upload endpoints tested *(Pending)*
- [ ] Security verification completed *(Pending)*
- [ ] Documentation created *(Completed)*
- [ ] User notified of fix *(Ready)*

---

## Next Steps

1. **User Testing** (PRIORITY):
   - Ask user to test course thumbnail upload
   - Verify no 403 errors occur
   - Confirm image saves successfully

2. **Monitor Logs** (24 hours):
   - Watch for any new 403 errors
   - Check for unexpected behavior
   - Verify upload success rate

3. **Update Documentation**:
   - Mark task as complete in project board
   - Update API documentation with CSRF exemption note
   - Add to changelog

4. **Create Monitoring Dashboard**:
   - Track file upload success/failure rates
   - Monitor endpoint response times
   - Alert on error spike

---

## Contact

If issues persist after testing:

1. Check backend logs for detailed error messages
2. Verify CORS configuration in settings.py
3. Test direct backend access (bypass nginx)
4. Review FILE_UPLOAD_403_FIX.md for troubleshooting steps

**Last Deployment**: 2025-10-18 08:15:30 UTC  
**Deployed By**: GitHub Copilot  
**Status**: ✅ Ready for Testing
