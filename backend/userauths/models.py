from django.db import models
from django.contrib.auth.models import AbstractUser
from django.db.models.signals import post_save
from django.apps import apps

# User role choices
USER_ROLE_CHOICES = (
    ('student', 'Student'),
    ('teacher', 'Teacher'),
    ('admin', 'Admin'),
)

class OrganizationUnit(models.Model):
    """Organization unit from external system"""
    external_id = models.CharField(max_length=50, unique=True, help_text="External system unit ID")
    name = models.CharField(max_length=200, help_text="Organization unit name")
    description = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
        verbose_name = "Organization Unit"
        verbose_name_plural = "Organization Units"
    
    def __str__(self):
        return self.name

class Position(models.Model):
    """Position/job from external system"""
    external_id = models.CharField(max_length=50, unique=True, help_text="External system position ID")
    name = models.CharField(max_length=200, help_text="Position name")
    description = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
        verbose_name = "Position"
        verbose_name_plural = "Positions"
    
    def __str__(self):
        return self.name

class User(AbstractUser):
    username = models.CharField(unique=True, max_length=100)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=100)
    # DEPRECATED: Use roles and current_role fields instead. Keep for backward compatibility during migration.
    role = models.CharField(max_length=10, choices=USER_ROLE_CHOICES, default='student', null=True, blank=True, help_text="DEPRECATED: Use roles field instead")
    # NEW: Multiple roles support (comma-separated: student,teacher,admin)
    roles = models.CharField(max_length=50, default='student', help_text="Comma-separated roles: student,teacher,admin")
    # NEW: Currently active role for this session
    current_role = models.CharField(max_length=10, choices=USER_ROLE_CHOICES, default='student', help_text="Currently active role for this session")
    
    # ✨ PHASE 4.10: BOOLEAN ROLE SYSTEM (new primary role mechanism)
    is_student = models.BooleanField(default=True, help_text="User can access student role features")
    is_instructor = models.BooleanField(default=False, help_text="User can access instructor/teacher role features")
    is_admin = models.BooleanField(default=False, help_text="User can access admin role features")
    
    otp = models.CharField(max_length=100, null=True, blank=True)
    refresh_token = models.CharField(max_length=1000, null=True, blank=True)
    
    # External API integration fields
    external_id = models.CharField(max_length=50, null=True, blank=True, unique=True, help_text="External system user ID")
    nip = models.CharField(max_length=50, null=True, blank=True, help_text="Employee ID number")
    golongan = models.CharField(max_length=20, null=True, blank=True, help_text="Employee grade/rank")
    kelas_jabatan = models.CharField(max_length=50, null=True, blank=True, help_text="Position class")
    jenis_jabatan = models.CharField(max_length=50, null=True, blank=True, help_text="Position type")
    timezone = models.CharField(max_length=50, default='Asia/Jakarta', help_text="User timezone")
    external_status = models.CharField(max_length=20, default='ACTIVE', help_text="External system status")
    external_created_at = models.DateTimeField(null=True, blank=True, help_text="External system creation date")
    external_updated_at = models.DateTimeField(null=True, blank=True, help_text="External system update date")
    last_sync_date = models.DateTimeField(null=True, blank=True, help_text="Last synchronization with external system")

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        # Add database indexes for frequently queried fields
        indexes = [
            models.Index(fields=['role']),
            models.Index(fields=['current_role']),
            models.Index(fields=['is_active']),
            models.Index(fields=['-date_joined']),
            models.Index(fields=['role', 'is_active']),
            models.Index(fields=['current_role', 'is_active']),
            # ✨ PHASE 4.10: New indexes for boolean role fields
            # Note: These will be added via migration once fields exist
        ]

    def __str__(self):
        return self.email
    
    # DEPRECATED: Use has_admin_role() instead
    # Renamed from is_admin() to is_admin_deprecated() to avoid conflict with is_admin field
    def is_admin_deprecated(self):
        """Deprecated: Check current_role first, fallback to role for backward compatibility"""
        if self.current_role == 'admin':
            return True
        if self.role == 'admin':
            return True
        return False
    
    # DEPRECATED: Use has_teacher_role() instead
    # Renamed from is_teacher() to is_teacher_deprecated() to avoid conflict
    def is_teacher_deprecated(self):
        """Deprecated: Check current_role first, fallback to role for backward compatibility"""
        if self.current_role == 'teacher':
            return True
        if self.role == 'teacher':
            return True
        return False
    
    # DEPRECATED: Use has_student_role() instead
    # Renamed from is_student() to is_student_deprecated() to avoid conflict with is_student field
    def is_student_deprecated(self):
        """Deprecated: Check current_role first, fallback to role for backward compatibility"""
        if self.current_role == 'student':
            return True
        if self.role == 'student':
            return True
        return False
    
    # NEW: Check if currently active role is admin
    def is_admin_current(self):
        return self.current_role == 'admin'
    
    # NEW: Check if user has admin role in their roles
    def has_admin_role(self):
        return 'admin' in self.get_available_roles()
    
    # NEW: Check if currently active role is teacher
    def is_teacher_current(self):
        return self.current_role == 'teacher'
    
    # NEW: Check if user has teacher role in their roles
    def has_teacher_role(self):
        return 'teacher' in self.get_available_roles()
    
    # NEW: Check if currently active role is student
    def is_student_current(self):
        return self.current_role == 'student'
    
    # NEW: Check if user has student role in their roles
    def has_student_role(self):
        return 'student' in self.get_available_roles()
    
    # NEW: Get list of available roles as a Python list
    def get_available_roles(self):
        """Returns a list of roles the user has"""
        return [r.strip() for r in self.roles.split(',') if r.strip()]
    
    # NEW: Check if user has a specific role
    def has_role(self, role):
        """Check if user has a specific role"""
        return role in self.get_available_roles()
    
    # NEW: Set current role with validation
    def set_current_role(self, role):
        """Set the current active role (must be in user's available roles)"""
        if not self.has_role(role):
            raise ValueError(f"User does not have {role} role. Available roles: {', '.join(self.get_available_roles())}")
        self.current_role = role
        self.save()
    
    # ✨ PHASE 4.10: BOOLEAN ROLE METHODS
    def get_available_boolean_roles(self):
        """Returns list of role names based on boolean fields"""
        roles = []
        if self.is_student:
            roles.append('student')
        if self.is_instructor:
            roles.append('instructor')
        if self.is_admin:
            roles.append('admin')
        return roles
    
    def has_boolean_role(self, role_name):
        """Check if user has a specific role using boolean fields"""
        if role_name == 'student':
            return self.is_student
        elif role_name in ['instructor', 'teacher']:
            return self.is_instructor
        elif role_name == 'admin':
            return self.is_admin
        return False
    
    def set_roles_from_boolean(self):
        """Sync the CSV roles field from boolean fields for backward compatibility"""
        roles = self.get_available_boolean_roles()
        self.roles = ','.join(roles) if roles else 'student'
        
        # Set role field to first available role or current_role if valid
        if self.current_role in roles:
            self.role = self.current_role
        elif roles:
            self.role = roles[0]
        else:
            self.role = 'student'
    
    def grant_role(self, role_name):
        """Grant a role to the user (uses boolean fields)"""
        if role_name == 'student':
            self.is_student = True
        elif role_name in ['instructor', 'teacher']:
            self.is_instructor = True
        elif role_name == 'admin':
            self.is_admin = True
        self.set_roles_from_boolean()
        self.save()
    
    def revoke_role(self, role_name):
        """Revoke a role from the user (uses boolean fields)"""
        if role_name == 'student':
            self.is_student = False
        elif role_name in ['instructor', 'teacher']:
            self.is_instructor = False
        elif role_name == 'admin':
            self.is_admin = False
        self.set_roles_from_boolean()
        # Ensure current_role is still valid after revoking
        if not self.has_boolean_role(self.current_role):
            available = self.get_available_boolean_roles()
            self.current_role = available[0] if available else 'student'
        self.save()
    
    def save(self, *args, **kwargs):
        # Safely split email with error handling
        try:
            email_username, domain = self.email.split("@")
        except (ValueError, AttributeError):
            email_username = self.email or "user"
        
        if self.full_name == "" or self.full_name == None:
            self.full_name = email_username
        if self.username == "" or self.username == None:
            self.username = email_username
        super(User, self).save(*args, **kwargs)


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    image = models.URLField(max_length=500, null=True, blank=True)  # ✨ PHASE 3: Changed from FileField to URLField for external URLs
    full_name = models.CharField(max_length=100)
    country = models.CharField(max_length=100, null=True, blank=True)
    about = models.TextField(null=True, blank=True)
    date = models.DateTimeField(auto_now_add=True)
    
    # External API integration fields
    organization_unit = models.ForeignKey(OrganizationUnit, on_delete=models.SET_NULL, null=True, blank=True, help_text="User's organization unit")
    position = models.ForeignKey(Position, on_delete=models.SET_NULL, null=True, blank=True, help_text="User's position/job")
    
    # Additional profile fields that might be useful
    bio = models.CharField(max_length=500, null=True, blank=True, help_text="Short bio")
    facebook = models.URLField(null=True, blank=True)
    twitter = models.URLField(null=True, blank=True)
    linkedin = models.URLField(null=True, blank=True)

    def __str__(self):
        if self.full_name:
            return str(self.full_name)
        else:
            return str(self.user.full_name)
        
    def create_teacher_instance(self):
        """
        Create a corresponding Teacher instance for this Profile.
        This method is useful when a user becomes an instructor.
        """
        try:
            # Get the Teacher model dynamically to avoid circular imports
            Teacher = apps.get_model('api', 'Teacher')
            
            teacher, created = Teacher.objects.get_or_create(
                user=self.user,
                defaults={
                    'image': self.image,
                    'full_name': self.full_name,
                    'country': self.country,
                    'about': self.about,
                    'bio': '',  # Teacher-specific field
                }
            )
            return teacher, created
        except Exception as e:
            print(f"Error creating Teacher instance: {e}")
            return None, False
    
    def save(self, *args, **kwargs):
        if self.full_name == "" or self.full_name == None:
            self.full_name = self.user.username
        super(Profile, self).save(*args, **kwargs)


class Admin(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    image = models.URLField(max_length=500, null=True, blank=True)  # ✨ PHASE 3: Changed from FileField to URLField for external URLs
    full_name = models.CharField(max_length=100)
    department = models.CharField(max_length=100, null=True, blank=True)
    permissions = models.TextField(null=True, blank=True, help_text="JSON field for admin permissions")
    is_super_admin = models.BooleanField(default=False)
    date_created = models.DateTimeField(auto_now_add=True)
    last_login_date = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        if self.full_name:
            return f"Admin: {self.full_name}"
        else:
            return f"Admin: {self.user.full_name}"
    
    def save(self, *args, **kwargs):
        if self.full_name == "" or self.full_name == None:
            self.full_name = self.user.full_name
        super(Admin, self).save(*args, **kwargs)


def create_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)
        # Create Admin instance if user role is admin
        if instance.role == 'admin':
            Admin.objects.create(user=instance)

def save_user_profile(sender, instance, **kwargs):
    instance.profile.save()

def create_admin_profile(sender, instance, **kwargs):
    """Create Admin instance when user role changes to admin"""
    if instance.role == 'admin':
        admin_instance, created = Admin.objects.get_or_create(
            user=instance,
            defaults={
                'full_name': instance.full_name,
                'image': instance.profile.image if hasattr(instance, 'profile') else None,
            }
        )

def sync_profile_with_teacher(sender, instance, created, **kwargs):
    """
    Synchronize Profile updates with Teacher model when profile is saved.
    This ensures that instructor profiles stay in sync with teacher data.
    """
    # Prevent infinite loops by checking if this is a sync operation
    if getattr(instance, '_syncing', False):
        return
        
    try:
        # Get the Teacher model dynamically to avoid circular imports
        Teacher = apps.get_model('api', 'Teacher')
        
        # Check if a Teacher instance exists for this user
        teacher_instance = Teacher.objects.filter(user=instance.user).first()
        
        if teacher_instance:
            # Set sync flag to prevent recursive updates
            teacher_instance._syncing = True
            
            # Update Teacher fields with Profile data
            teacher_instance.image = instance.image
            teacher_instance.full_name = instance.full_name
            teacher_instance.country = instance.country
            teacher_instance.about = instance.about
            
            # Save the teacher instance
            teacher_instance.save()
        elif created:
            # If no teacher instance exists but this is a new profile,
            # create a teacher instance for potential instructors
            # This will be created when a user becomes an instructor
            pass  # Teacher instances should be created explicitly when needed
            
    except Exception as e:
        # Log the error but don't break the profile save operation
        print(f"Error syncing Profile with Teacher: {e}")

post_save.connect(create_user_profile, sender=User)
post_save.connect(save_user_profile, sender=User)
post_save.connect(create_admin_profile, sender=User)
post_save.connect(sync_profile_with_teacher, sender=Profile)