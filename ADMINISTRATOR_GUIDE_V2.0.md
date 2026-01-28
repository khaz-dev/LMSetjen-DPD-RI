# Administrator Guide: Multi-Role System (v2.0)

**Version:** 2.0  
**Release Date:** January 25, 2026  
**Target Audience:** System Administrators, Support Staff

---

## Table of Contents

1. [System Overview](#system-overview)
2. [User Management](#user-management)
3. [Role Configuration](#role-configuration)
4. [Monitoring & Analytics](#monitoring--analytics)
5. [Troubleshooting](#troubleshooting)
6. [User Support Guide](#user-support-guide)

---

## System Overview

### What is Multi-Role?

LMSetjen v2.0 introduces **multi-role support**, allowing single users to have multiple roles (e.g., student + instructor) and switch between them seamlessly.

### Before vs After

```
BEFORE (Single Role):
┌─────────────┐
│ User: Ahmad │
│ Role: Admin │
└─────────────┘
└─→ Can only access admin features
└─→ Cannot teach courses even if qualified

AFTER (Multi-Role):
┌──────────────────────┐
│ User: Ahmad          │
│ Roles: [Admin,       │
│         Instructor,  │
│         Student]     │
│ Current: Admin       │
└──────────────────────┘
└─→ Can access admin features (current role)
└─→ Can switch to Instructor to create courses
└─→ Can switch to Student to enroll in courses
```

### Key Features

✅ Single login for multiple roles  
✅ Seamless role switching via header dropdown  
✅ Role indicator displays in headers  
✅ Toast notifications on role switch  
✅ Backward compatible (single-role users unaffected)  
✅ No user action required (automatic role detection)  

---

## User Management

### Creating Multi-Role Users

#### Method 1: Django Admin Panel

```
1. Go to: Admin Dashboard → Users
2. Click "Add User"
3. Fill basic info:
   - Email: ahmad@example.com
   - Name: Ahmad Surahman
   - Password: (auto-generated or set)

4. Save user first
5. Then edit user:
   - Set "Roles" field to: ["student", "teacher", "admin"]
   - Set "Current Role" to: "student"

6. Save changes
```

#### Method 2: Django Management Command

```bash
# Create multi-role user via command line
python manage.py create_user \
    --email ahmad@example.com \
    --name "Ahmad Surahman" \
    --roles student,teacher,admin \
    --current-role student
```

#### Method 3: API Endpoint (Admin Only)

```bash
# POST /api/v1/admin/users/

curl -X POST https://example.com/api/v1/admin/users/ \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ahmad@example.com",
    "name": "Ahmad Surahman",
    "password": "SecurePassword123!",
    "roles": ["student", "teacher", "admin"],
    "current_role": "student"
  }'

# Response:
# {
#   "id": 42,
#   "email": "ahmad@example.com",
#   "name": "Ahmad Surahman",
#   "roles": ["student", "teacher", "admin"],
#   "current_role": "student",
#   "created_at": "2026-01-25T10:30:00Z"
# }
```

### Modifying User Roles

#### Add Role to Existing User

```bash
# Get current roles
GET /api/v1/admin/users/42/

# Response: roles: ["student", "teacher"]

# Add admin role
PUT /api/v1/admin/users/42/

curl -X PUT https://example.com/api/v1/admin/users/42/ \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "roles": ["student", "teacher", "admin"]
  }'
```

#### Remove Role from User

```bash
# Current roles: ["student", "teacher", "admin"]
# Remove "teacher" role

curl -X PUT https://example.com/api/v1/admin/users/42/ \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "roles": ["student", "admin"]
  }'

# User can no longer switch to teacher role
```

#### Change Current Role

```bash
# User currently in "student" role, switch to "teacher"

curl -X POST https://example.com/api/v1/auth/select-role/ \
  -H "Authorization: Bearer <user_token>" \
  -H "Content-Type: application/json" \
  -d '{"role": "teacher"}'

# Response:
# {
#   "current_role": "teacher",
#   "available_roles": ["student", "teacher", "admin"],
#   "access_token": "new_jwt_token",
#   "refresh_token": "new_refresh_token"
# }
```

### Listing Users by Role

```bash
# Get all administrators
GET /api/v1/admin/users/?roles=admin

# Get all teachers
GET /api/v1/admin/users/?roles=teacher

# Get all multi-role users
GET /api/v1/admin/users/?roles_count__gte=2

# Get users with both student and teacher roles
GET /api/v1/admin/users/?roles=student,teacher
```

---

## Role Configuration

### Available Roles

| Role | Permissions | Typical Uses |
|------|-------------|--------------|
| **student** | Enroll in courses, view materials, take quizzes, submit assignments | Learners, employees taking training |
| **teacher** | Create courses, upload materials, grade assignments, manage discussions | Instructors, subject matter experts |
| **admin** | User management, system settings, analytics, reporting | System administrators |

### Role-Based Access Control

```javascript
// These are automatically enforced:

// Student can access:
- /dashboard/student/
- /courses/ (enrolled courses)
- /courses/:id/materials/
- /courses/:id/quizzes/
- /courses/:id/assignments/
- /my-certificates/

// Teacher can access:
- /dashboard/instructor/
- /courses/create/
- /courses/:id/manage/
- /courses/:id/students/
- /courses/:id/grading/

// Admin can access:
- /admin/dashboard/
- /admin/users/
- /admin/courses/
- /admin/reports/
- /admin/settings/
```

### Preventing Unauthorized Access

The system automatically prevents:
- ✗ Student accessing `/admin/dashboard/`
- ✗ Non-teacher accessing course creation
- ✗ Non-admin accessing user management
- ✗ Switching to role not in available_roles
- ✗ Accessing endpoints without required role

---

## Monitoring & Analytics

### Dashboard Metrics

```
1. Role Distribution
   - Single-role users: 2,450
   - Multi-role users: 128
   - Multi-role percentage: 5.2%

2. Role Switching Activity
   - Switches today: 342
   - Switches this week: 2,104
   - Most common switch: student → teacher

3. System Health
   - Available roles endpoint: 99.95% uptime
   - Select role endpoint: 99.92% uptime
   - Average response time: 85ms

4. User Engagement
   - Users with active sessions: 1,204
   - Users who switched roles today: 89
   - Failed role switches: 3 (0.3% error rate)
```

### Viewing Role Switching Logs

```bash
# Get all role switches today
GET /api/v1/admin/analytics/role-switches/?date=2026-01-25

# Response:
# [
#   {
#     "user_id": 42,
#     "user_email": "ahmad@example.com",
#     "from_role": "student",
#     "to_role": "teacher",
#     "timestamp": "2026-01-25T10:30:00Z",
#     "success": true
#   },
#   ...
# ]

# Get failed switches
GET /api/v1/admin/analytics/role-switches/?status=failed

# Get switches for specific user
GET /api/v1/admin/analytics/role-switches/?user_id=42
```

### Performance Metrics

```python
# In Django shell:

from api.models import RoleSwitchLog
from django.utils import timezone
from datetime import timedelta

# Get switches in last 24 hours
today = timezone.now() - timedelta(hours=24)
switches = RoleSwitchLog.objects.filter(timestamp__gte=today)

print(f"Total switches: {switches.count()}")
print(f"Success rate: {switches.filter(success=True).count() / switches.count() * 100:.1f}%")

# Most common role switches
from django.db.models import Count
common = switches.values('from_role', 'to_role').annotate(count=Count('id')).order_by('-count')[:5]
for entry in common:
    print(f"{entry['from_role']} → {entry['to_role']}: {entry['count']} times")
```

### Alert Configuration

#### Alert: High Error Rate

```yaml
condition: error_rate > 1% for 5 minutes
action: 
  - Send email to admin-team@example.com
  - Page on-call engineer
  - Log to monitoring system
```

#### Alert: Slow Response Times

```yaml
condition: response_time_p95 > 500ms for 10 minutes
action:
  - Send email to backend-team@example.com
  - Check database queries
  - Scale backend if needed
```

---

## Troubleshooting

### User Reports: "I don't see the role selector"

**Possible Causes:**
1. User has only one role
2. Browser cache not cleared
3. Token expired

**Solution:**
```
1. Check user's available roles:
   GET /api/v1/admin/users/{user_id}/?include=roles
   
2. If only one role → Explain that role selector only appears for multi-role users

3. If multiple roles, ask user to:
   - Clear browser cache (Ctrl+Shift+Delete)
   - Logout and login again
   - Try different browser
```

### User Reports: "Role switch failed"

**Possible Causes:**
1. Invalid role selection
2. User's session expired
3. Backend API error

**Solution:**
```bash
# Check if role exists in available_roles
GET /api/v1/auth/available-roles/
# Response: available_roles: ["student", "teacher", "admin"]

# Check if user has the role they're trying to switch to
PUT /api/v1/admin/users/{user_id}/ 
# Verify roles field includes desired role

# If API error, check backend logs:
tail -f /var/log/lms/django.log | grep "role switch"

# Suggest user logout and try again
# If still fails, escalate to backend team
```

### Issue: Role Indicator Not Showing in Header

**Debugging:**
```javascript
// In browser console:
1. Check if user has multiple roles:
   localStorage.getItem('user_data')
   // Look for "roles" array length

2. Check RoleIndicator component is loaded:
   document.querySelector('[data-testid="role-indicator"]')
   // Should return an element

3. Check for JavaScript errors:
   console.log(document.querySelectorAll('.role-indicator'))

4. Check network requests:
   fetch('http://localhost:8000/api/v1/auth/available-roles/')
     .then(r => r.json())
     .then(d => console.log(d))
```

### Issue: Modal Shows Multiple Times

**Cause:** User cookie not stored properly

**Solution:**
```javascript
// Clear all LMS-related cookies
// User should manually:
1. Clear cookies (Ctrl+Shift+Delete)
2. Logout completely
3. Close browser
4. Login again
```

### Issue: Permission Denied After Role Switch

**Debugging:**
```bash
# 1. Check JWT token has new role
# Decode token from Authorization header:
# Header.Payload.Signature

# Decode payload (base64):
echo "eyJ...IjoidGVhY2hlciJ9" | base64 -d

# Should show: "current_role": "teacher"

# 2. Check endpoint has permission class set
# In views.py:
permission_classes = [IsTeacherUser]  # Validates current_role

# 3. If still fails, token might be cached
# Ask user to clear localStorage:
localStorage.clear()
```

---

## User Support Guide

### Common User Questions

**Q: "How do I switch roles?"**

A: 
```
If you have multiple roles available:
1. Look at the top-right of your screen (header)
2. Find your name / role indicator
3. Click on the role badge/button
4. A dropdown menu will appear
5. Click the role you want to switch to
6. A confirmation message will appear
7. The page will refresh and you're in the new role!
```

**Q: "Why don't I see other courses after switching to teacher role?"**

A:
```
Teacher and Student have different dashboards:
- Student view: Shows courses you're enrolled in
- Teacher view: Shows courses you created

If you were a student in a course, switching to teacher 
doesn't automatically show that course in teacher view.
You need to be added as an instructor to see it there.

Contact your admin to be added as an instructor to courses.
```

**Q: "Will I lose my progress if I switch roles?"**

A:
```
No! All your data is preserved:
- Student enrollments remain
- Course progress saved
- Grades and certificates persist
- Switching roles doesn't delete anything

You can freely switch back and forth anytime.
```

**Q: "I have a role I shouldn't have - what do I do?"**

A:
```
Contact your administrator and mention:
1. Your email address
2. Which role should be removed
3. When you noticed it

Your admin will review and update your access.
```

### Support Email Template

```
Subject: I need help with role switching

Hello Support Team,

I'm experiencing an issue with [describe problem]:

Error message: [if any]
Browser: [Chrome/Firefox/Safari/Edge]
Device: [Desktop/Mobile]
Affected role(s): [e.g., Student/Teacher]

Steps I took:
1. ...
2. ...
3. ...

What I expected: ...
What actually happened: ...

Please let me know how to resolve this.

Thank you,
[User Name]
```

### Escalation Path

```
Level 1 - User tries:
└─ Refresh browser
└─ Clear cache
└─ Logout/login

Level 2 - User contacts support:
└─ Support team checks user's available_roles
└─ Support verifies role in admin panel
└─ Support suggests solutions

Level 3 - Support escalates to backend team:
└─ Backend team checks logs
└─ Backend team checks JWT tokens
└─ Backend team checks database
└─ Issue is resolved and documented
```

### Knowledge Base Articles

Create these support articles:

1. **Getting Started with Multi-Role**
   - What is multi-role? How does it work?
   - How to see my available roles?

2. **Switching Between Roles**
   - Where is the role selector?
   - How do I switch roles?
   - What happens when I switch?

3. **Role Permissions Guide**
   - What can each role do?
   - Why can't I access something?

4. **Troubleshooting**
   - Role selector not showing?
   - Role switch failed?
   - Permission denied?

5. **Multi-Role FAQ**
   - Will I lose data?
   - Can I revert a role switch?
   - Who decides my roles?

---

## Quick Reference

### Common Admin Commands

```bash
# Create multi-role user
python manage.py create_user --email user@example.com --roles student,teacher --current-role student

# List all multi-role users
python manage.py shell -c "
from userauths.models import User
multi = User.objects.filter(roles__length__gte=2)
print(f'Found {multi.count()} multi-role users')
for u in multi:
    print(f'{u.email}: {u.roles} (current: {u.current_role})')
"

# Check role distribution
python manage.py shell -c "
from userauths.models import User
from django.db.models import Count
roles = User.objects.values('current_role').annotate(count=Count('id'))
for r in roles:
    print(f\"{r['current_role']}: {r['count']} users\")
"

# Export user data
python manage.py dumpdata userauths.User --format json > users_backup.json
```

### Monitoring Checklist

Daily:
- [ ] Error rate < 0.1%
- [ ] Response times normal
- [ ] No escalated issues
- [ ] Users reporting issues? (0 is good)

Weekly:
- [ ] Role switch success rate
- [ ] Multi-role user growth
- [ ] Performance trends
- [ ] Security audit

Monthly:
- [ ] Role distribution analysis
- [ ] User feedback review
- [ ] Capacity planning
- [ ] Documentation updates

---

**Document Version:** 1.0  
**Last Updated:** January 25, 2026  
**Status:** ✅ Ready for Administrator Use
