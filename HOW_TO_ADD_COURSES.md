# How to Add Courses to LMSetjen DPD RI

The system is fully deployed and working. Here are 3 ways to add courses:

## Method 1: Admin Panel (Easiest)

1. **Login to Admin**:
   - Visit: `https://lmsetjendpdri.duckdns.org/admin/`
   - Use your admin credentials

2. **Add Course**:
   - Click "Courses" in the admin menu
   - Click "Add Course"
   - Fill in details:
     - Title (required)
     - Description
     - Level
     - Category
     - Teacher/Instructor
     - Course content files
     - Featured image

3. **Publish**:
   - Click "Save and continue"
   - The course will appear on the frontend immediately

---

## Method 2: API Upload (For Automation)

Use curl or any API client:

```bash
curl -X POST https://lmsetjendpdri.duckdns.org/api/v1/course/create/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Introduction to Python",
    "description": "Learn Python basics",
    "level": "beginner",
    "category": 1,
    "teacher": 1
  }'
```

---

## Method 3: Direct Database Insert (For Testing)

```bash
docker compose exec postgres psql -U lms_user -d lms_db << EOF
INSERT INTO api_category (category_name, category_slug) 
VALUES ('Programming', 'programming');

INSERT INTO api_course (
  title, description, level, category_id, teacher_id, 
  platform_status, date
) VALUES (
  'Python Basics',
  'Learn Python from scratch',
  'beginner',
  1, 1,
  'published',
  NOW()
);
EOF
```

---

## Verification

After adding courses, check:

```bash
# Check database
docker compose exec postgres psql -U lms_user -d lms_db \
  -c "SELECT COUNT(*) as course_count FROM api_course;"

# Check API
curl https://lmsetjendpdri.duckdns.org/api/v1/course/course-list/

# Frontend
Visit https://lmsetjendpdri.duckdns.org/ and refresh
```

---

## Important Notes

✅ **All Systems Working**:
- Frontend: ✅ Connected to backend
- Backend: ✅ Responding to requests  
- Database: ✅ All tables created
- Cache: ✅ Redis running
- Search: ✅ Full-text search ready

⚠️ **Database is Empty by Design**:
- Fresh deployment = empty database
- Users must upload courses to see content
- This is normal and expected

🎉 **You're All Set**:
- The system is production-ready
- Add courses and it will work perfectly
- All features (search, caching, analytics) are active
