# Django Admin Access Guide

## 📋 Table of Contents
1. [Admin URL](#admin-url)
2. [Default Credentials](#default-credentials)
3. [Accessing Django Admin](#accessing-django-admin)
4. [Managing Course Categories](#managing-course-categories)
5. [Managing Other Models](#managing-other-models)
6. [Security Best Practices](#security-best-practices)

---

## 🔗 Admin URL

**Production URL:**
```
https://lmsetjendpdri.duckdns.org/admin/
```

**Local Development URL:**
```
http://localhost:8000/admin/
```

---

## 🔑 Default Credentials

The system creates default admin credentials automatically during deployment:

### Superuser Account (Full Admin Access)
- **Email**: `admin@lmsetjen.dpd.go.id`
- **Password**: `Admin@LMS2025!`
- **Role**: Superuser with full administrative privileges
- **Access**: Can manage all models, users, and system settings

### Regular User Account (Testing)
- **Email**: `lmsetjendpdri@gmail.com`
- **Password**: `Admin@LMS2025!`
- **Role**: Student (limited access to admin panel)

---

## 🚀 Accessing Django Admin

### Step 1: Navigate to Admin Panel
1. Open your browser
2. Go to: `https://lmsetjendpdri.duckdns.org/admin/`
3. You should see the Django administration login page

> **✅ VERIFIED WORKING** (as of October 18, 2025)
> - Admin URL properly proxied through nginx
> - SSL/HTTPS fully functional
> - Login page returns HTTP 200 OK

### Step 2: Login
1. Enter email: `admin@lmsetjen.dpd.go.id`
2. Enter password: `Admin@LMS2025!`
3. Click **"Log in"**

### Step 3: Admin Dashboard
After successful login, you'll see the Django admin dashboard with sections:
- **Authentication and Authorization** (Users, Groups)
- **API** (All course-related models)
- **Core** (File management)
- **Userauths** (User authentication models)

---

## 📚 Managing Course Categories

### Adding a New Category

1. **Login to Admin Panel**
   - URL: `https://lmsetjendpdri.duckdns.org/admin/`
   - Use superuser credentials

2. **Navigate to Categories**
   - Find **"API"** section in the admin dashboard
   - Click on **"Categories"** or **"Categorys"**
   - You'll see a list of existing categories

3. **Add New Category**
   - Click **"Add Category"** button (top right)
   - Fill in the form:
     - **Title**: Category name (e.g., "Web Development", "Data Science")
     - **Image**: Upload category thumbnail (optional)
     - **Active**: Check to make category visible to users
   - Click **"Save"**

4. **Edit Existing Category**
   - Click on any category in the list
   - Modify the fields as needed
   - Click **"Save"** or **"Save and continue editing"**

5. **Delete Category**
   - Select category/categories using checkboxes
   - Choose **"Delete selected categories"** from the Action dropdown
   - Click **"Go"**
   - Confirm deletion

### Category Fields Explained

| Field | Required | Description |
|-------|----------|-------------|
| **Title** | Yes | Display name of the category |
| **Image** | No | Thumbnail image for the category |
| **Active** | Yes | Whether category is visible to users |
| **Slug** | Auto | URL-friendly version of title (auto-generated) |

---

## 🗂️ Managing Other Models

The Django admin provides access to all system models:

### Users Management
**Path**: Admin → Authentication → Users

**What you can do:**
- Create new users
- Edit user profiles
- Assign roles (admin, student, teacher)
- Activate/deactivate accounts
- Reset passwords

### Courses Management
**Path**: Admin → API → Courses

**What you can do:**
- View all courses
- Edit course details
- Change course status (Draft, Published, Disabled)
- Manage course pricing
- View course enrollment statistics

### Teachers Management
**Path**: Admin → API → Teachers

**What you can do:**
- Create teacher profiles
- Link teachers to user accounts
- Manage teacher bio and qualifications
- View teacher courses

### Enrollments
**Path**: Admin → API → Enrolled Courses

**What you can do:**
- View all course enrollments
- Manually enroll users in courses
- Track course completion
- Generate enrollment reports

### Quiz System
**Paths:**
- Admin → API → Quizzes
- Admin → API → Quiz Questions
- Admin → API → Quiz Choices
- Admin → API → Quiz Attempts

**What you can do:**
- Create and manage quizzes
- Add/edit quiz questions
- Configure multiple choice answers
- Review quiz attempts and scores

### Notifications
**Path**: Admin → API → Notifications

**What you can do:**
- Create system-wide notifications
- Send targeted notifications to users
- View notification delivery status

---

## 🔐 Security Best Practices

### 1. Change Default Password Immediately
After first login, change the admin password:

**Via Command Line:**
```bash
# On server
ssh -i "lms-server-key.pem" ubuntu@16.79.83.21
cd /home/ubuntu/LMSetjen-DPD-RI
docker compose exec backend python manage.py changepassword admin@lmsetjen.dpd.go.id
```

**Via Admin Panel:**
1. Click your username (top right)
2. Select "Change password"
3. Enter old password
4. Enter new password twice
5. Click "Change my password"

### 2. Create Additional Admin Accounts
Don't share the superuser account. Create individual admin accounts:

1. Go to: Admin → Authentication → Users
2. Click "Add User"
3. Set email and password
4. Check **"Staff status"** to allow admin access
5. Check **"Superuser status"** for full permissions (optional)
6. Save

### 3. Use Strong Passwords
- Minimum 12 characters
- Mix of uppercase, lowercase, numbers, symbols
- Don't reuse passwords
- Use a password manager

### 4. Enable Two-Factor Authentication (Recommended)
Consider installing Django 2FA package for enhanced security.

### 5. Regular Security Audits
- Review admin access logs regularly
- Remove inactive admin accounts
- Monitor failed login attempts

---

## 🛠️ Troubleshooting

### Problem: Cannot Access Admin Panel
**Symptoms**: 404 error or "Page not found" when accessing `/admin/`

**Solutions:**
1. Verify the correct URL:
   - Production: `https://lmsetjendpdri.duckdns.org/admin/`
   - Development: `http://localhost:8000/admin/`
2. Check if backend service is running:
   ```bash
   docker ps | grep lms_backend
   ```
3. Verify URL configuration in `backend/backend/urls.py`

### Problem: Invalid Credentials
**Symptoms**: "Please enter a correct email and password" error

**Solutions:**
1. Verify you're using the correct email format:
   - Correct: `admin@lmsetjen.dpd.go.id`
   - Wrong: `admin` or `admin@lms.com`
2. Password is case-sensitive: `Admin@LMS2025!`
3. Reset password if forgotten:
   ```bash
   docker compose exec backend python manage.py changepassword admin@lmsetjen.dpd.go.id
   ```

### Problem: Permission Denied in Admin
**Symptoms**: Can login but can't see or edit certain models

**Solutions:**
1. Verify user has staff/superuser status:
   - Go to Users admin
   - Edit your user
   - Check "Staff status" and "Superuser status"
2. Check group permissions (for non-superusers)

### Problem: Categories Not Appearing on Frontend
**Symptoms**: Added categories in admin but they don't show on the website

**Solutions:**
1. Verify "Active" checkbox is checked
2. Clear browser cache (Ctrl+F5)
3. Check API endpoint: `https://lmsetjendpdri.duckdns.org/api/v1/course/category/`

---

## � Additional Admin URLs

### API Documentation (Swagger UI)
- **URL**: `https://lmsetjendpdri.duckdns.org/swagger/`
- **Purpose**: Interactive API documentation and testing
- **Access**: No authentication required (public API docs)
- **Features**:
  - Try API endpoints directly from browser
  - View request/response schemas
  - Test authentication flows

### API Documentation (Redoc)
- **URL**: `https://lmsetjendpdri.duckdns.org/redoc/`
- **Purpose**: Alternative API documentation (more readable)
- **Access**: No authentication required (public API docs)
- **Features**:
  - Clean, organized API documentation
  - Search functionality
  - Better for reading/understanding API structure

---

## �📝 Quick Reference

### Common Admin Tasks

| Task | Path | Action |
|------|------|--------|
| Add Category | API → Categories → Add | Fill form, click Save |
| Add Course | API → Courses → Add | Fill form, click Save |
| View Users | Authentication → Users | Click on any user |
| Reset Password | Users → Edit User → Change password | Enter new password |
| View Enrollments | API → Enrolled Courses | View list |
| Manage Quizzes | API → Quizzes | Add/Edit quizzes |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` or `Cmd+S` | Save current form |
| `Ctrl+K` | Go to search |
| `ESC` | Close popup |

---

## 📞 Support

If you encounter issues accessing the admin panel:

1. Check this guide first
2. Review Django admin documentation: https://docs.djangoproject.com/en/4.2/ref/contrib/admin/
3. Check application logs:
   ```bash
   docker compose logs backend --tail 100
   ```

---

## 📚 Additional Resources

- **Django Admin Documentation**: https://docs.djangoproject.com/en/4.2/ref/contrib/admin/
- **Django ModelAdmin Options**: https://docs.djangoproject.com/en/4.2/ref/contrib/admin/#modeladmin-options
- **Django Admin Actions**: https://docs.djangoproject.com/en/4.2/ref/contrib/admin/actions/

---

**Last Updated**: October 18, 2025
**Version**: 1.0
**Author**: LMSetjen DPD RI Development Team
