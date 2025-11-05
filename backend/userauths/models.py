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
    external_id = models.IntegerField(unique=True, help_text="External system unit ID")
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
    external_id = models.IntegerField(unique=True, help_text="External system position ID")
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
    role = models.CharField(max_length=10, choices=USER_ROLE_CHOICES, default='student')
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
            models.Index(fields=['is_active']),
            models.Index(fields=['-date_joined']),
            models.Index(fields=['role', 'is_active']),
        ]

    def __str__(self):
        return self.email
    
    def is_admin(self):
        return self.role == 'admin'
    
    def is_teacher(self):
        return self.role == 'teacher'
    
    def is_student(self):
        return self.role == 'student'
    
    def save(self, *args, **kwargs):
        email_username, domain = self.email.split("@")
        if self.full_name == "" or self.full_name == None:
            self.full_name = email_username
        if self.username == "" or self.username == None:
            self.username = email_username
        super(User, self).save(*args, **kwargs)


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    image = models.FileField(upload_to="user_folder", null=True, blank=True)  # Removed invalid default
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
            self.full_name == self.user.username
        super(Profile, self).save(*args, **kwargs)


class Admin(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    image = models.FileField(upload_to="admin_folder", null=True, blank=True)  # Removed invalid default
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