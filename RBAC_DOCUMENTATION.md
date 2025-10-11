# 🔒 Role-Based Access Control (RBAC) System

## Overview

The LMSetjen DPD RI platform now features a comprehensive Role-Based Access Control system that ensures users can only access pages and features appropriate to their role level.

## System Architecture

### 1. **RoleRoute Component** (`/layouts/RoleRoute.jsx`)

A smart routing wrapper that checks user authentication and role permissions before rendering protected pages.

**Features:**
- ✅ Authentication verification
- ✅ Role-based authorization
- ✅ Informative error messages
- ✅ Automatic redirection to home page
- ✅ Loading states during verification
- ✅ SweetAlert2 notifications for access denial

**Usage:**
```jsx
<RoleRoute allowedRoles={['student']}>
    <StudentDashboard />
</RoleRoute>
```

### 2. **NotFound Component** (`/views/base/NotFound.jsx`)

A professional 404 error page with complete navigation options.

**Features:**
- ✅ BaseHeader and BaseFooter integration
- ✅ Beautiful gradient design
- ✅ Multiple navigation options
- ✅ Help and support links
- ✅ Informative error explanation
- ✅ SEO-friendly structure

## Role Definitions

### 🎓 **Student Role**
**Access Level:** Basic User

**Allowed Pages:**
- `/student/dashboard/` - Student dashboard with enrolled courses
- `/student/courses/` - List of enrolled courses
- `/student/courses/:enrollment_id/` - Course learning interface
- `/student/wishlist/` - Saved courses wishlist
- `/student/question-answer/` - Q&A forum
- `/student/profile/` - Personal profile management
- `/student/change-password/` - Password change form

**Restrictions:**
- ❌ Cannot access Instructor pages
- ❌ Cannot access Admin pages
- ❌ Cannot create or manage courses

### 👨‍🏫 **Instructor/Teacher Role**
**Access Level:** Course Creator & Manager

**Allowed Pages:**
- `/instructor/dashboard/` - Instructor analytics dashboard
- `/instructor/courses/` - Manage created courses
- `/instructor/reviews/` - View course reviews
- `/instructor/students/` - View enrolled students
- `/instructor/notifications/` - Course-related notifications
- `/instructor/question-answer/` - Answer student questions
- `/instructor/profile/` - Profile management
- `/instructor/change-password/` - Password change form
- `/instructor/create-course/` - Create new courses
- `/instructor/edit-course/:course_id/` - Edit course details
- `/instructor/edit-course/:course_id/curriculum/` - Manage course curriculum
- `/instructor/edit-course/:course_id/quiz/` - Create course quizzes

**Restrictions:**
- ❌ Cannot access Student-specific pages (wishlist, enrollments)
- ❌ Cannot access Admin pages
- ❌ Cannot manage other instructors' courses

### 👑 **Admin Role**
**Access Level:** Full System Access

**Allowed Pages:**
- `/admin/dashboard/` - System-wide analytics and metrics
- `/admin/users/` - User management (CRUD operations)

**Restrictions:**
- ⚠️ Admin pages are strictly restricted to admin role only

## Public Pages

These pages are accessible to everyone (no authentication required):

- `/` - Landing page
- `/login/` - User login
- `/register/` - User registration
- `/forgot-password/` - Password recovery
- `/create-new-password/` - Password reset
- `/course-detail/:slug/` - Public course details
- `/search/` - Course search and browse
- `*` (404) - Not found page

## Access Control Flow

```
User Attempts to Access Page
        ↓
┌───────────────────┐
│  Authentication   │ → Not Logged In → Redirect to /login/
│     Check         │
└───────────────────┘
        ↓ Logged In
┌───────────────────┐
│  Role Permission  │ → No Permission → Show Error Toast
│     Check         │                 → Redirect to Home (/)
└───────────────────┘
        ↓ Has Permission
┌───────────────────┐
│   Render Page     │
└───────────────────┘
```

## Error Messages

### Access Denied Message
When a user tries to access a page they don't have permission for:

```
🚫 Access Denied

You don't have permission to access this page.

Your current role: Student
Required role: Instructor or Admin

You are being redirected to the home page...
```

### 404 Not Found Page
When a user visits a non-existent URL:

- Clear 404 error display
- Explanation of possible causes
- Multiple navigation options:
  - Return to Home
  - Go back to previous page
  - Explore courses
- Contact support link

## Implementation Details

### App.jsx Route Protection

```jsx
// Student Route Example
<Route
    path="/student/dashboard/"
    element={
        <PrivateRoute>
            <RoleRoute allowedRoles={['student']}>
                <StudentDashboard />
            </RoleRoute>
        </PrivateRoute>
    }
/>

// Instructor Route Example (supports multiple role names)
<Route
    path="/instructor/dashboard/"
    element={
        <PrivateRoute>
            <RoleRoute allowedRoles={['teacher', 'instructor']}>
                <Dashboard />
            </RoleRoute>
        </PrivateRoute>
    }
/>

// Admin Route Example
<Route
    path="/admin/dashboard/"
    element={
        <PrivateRoute>
            <RoleRoute allowedRoles={['admin']}>
                <DashboardAdmin />
            </RoleRoute>
        </PrivateRoute>
    }
/>
```

### Double-Layer Protection

1. **PrivateRoute**: Checks if user is logged in
2. **RoleRoute**: Checks if user has the required role

This ensures maximum security with both authentication and authorization checks.

## User Experience Features

### Loading States
- Professional loading spinner during authentication check
- Loading spinner during role verification
- Prevents flash of unauthorized content

### Informative Notifications
- Clear error messages explaining why access is denied
- Shows current user role
- Shows required role
- Auto-redirect after 4 seconds

### 404 Page Experience
- Beautiful, professional design
- Matches platform branding
- Multiple action options
- Help and support information
- Consistent header/footer navigation

## Security Benefits

✅ **Separation of Concerns**: Each role has clearly defined boundaries
✅ **Unauthorized Access Prevention**: Automatic redirect for unauthorized users
✅ **Session Validation**: Checks authentication on every protected route
✅ **Role Verification**: Validates user role from JWT token
✅ **User-Friendly**: Clear error messages instead of blank pages
✅ **Professional Appearance**: Enhances platform credibility
✅ **SEO Friendly**: Proper 404 handling for search engines

## Testing Access Control

### As a Student:
1. Log in with student credentials
2. Try accessing `/instructor/dashboard/`
3. **Expected**: Access denied with message, redirect to home
4. Try accessing `/student/dashboard/`
5. **Expected**: Successful access

### As an Instructor:
1. Log in with instructor credentials
2. Try accessing `/student/wishlist/`
3. **Expected**: Access denied with message, redirect to home
4. Try accessing `/instructor/dashboard/`
5. **Expected**: Successful access

### As an Admin:
1. Log in with admin credentials
2. Try accessing `/admin/dashboard/`
3. **Expected**: Successful access
4. Try accessing `/student/dashboard/`
5. **Expected**: Access denied with message, redirect to home

### 404 Testing:
1. Visit any non-existent URL (e.g., `/this-page-does-not-exist`)
2. **Expected**: Professional 404 page with navigation options

## Maintenance Notes

### Adding New Protected Routes

1. Determine which role should have access
2. Wrap route with both `<PrivateRoute>` and `<RoleRoute>`
3. Specify allowed roles in `allowedRoles` prop

```jsx
<Route
    path="/new-feature/"
    element={
        <PrivateRoute>
            <RoleRoute allowedRoles={['student', 'teacher']}>
                <NewFeature />
            </RoleRoute>
        </PrivateRoute>
    }
/>
```

### Adding New Roles

1. Update backend to include new role in JWT token
2. Add role to `allowedRoles` arrays as needed
3. Update error message formatting in RoleRoute.jsx if needed
4. Update this documentation

## Best Practices

1. **Always Use Double Protection**: Combine `PrivateRoute` + `RoleRoute`
2. **Least Privilege Principle**: Only grant minimum necessary access
3. **Clear Role Names**: Use descriptive, consistent role names
4. **User-Friendly Messages**: Always explain why access is denied
5. **Graceful Degradation**: Redirect instead of showing errors
6. **Test All Paths**: Verify both allowed and denied access scenarios

## Troubleshooting

### Issue: User sees blank page instead of access denied
**Solution**: Check that JWT token contains valid role field

### Issue: Admin can't access admin pages
**Solution**: Verify role in token is exactly 'admin' (case-sensitive)

### Issue: 404 page not showing
**Solution**: Ensure `<Route path="*">` is the LAST route in Routes

### Issue: User stuck in redirect loop
**Solution**: Check that home page (`/`) is not protected by RoleRoute

## Future Enhancements

- [ ] Add role hierarchy (admin can access all pages)
- [ ] Add permission-based access (granular controls)
- [ ] Add audit logging for access attempts
- [ ] Add rate limiting for failed access attempts
- [ ] Add custom 403 Forbidden page separate from 404

---

**Version:** 1.0.0  
**Last Updated:** October 11, 2025  
**Status:** ✅ Production Ready
