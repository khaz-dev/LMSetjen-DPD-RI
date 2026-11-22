from django.contrib.auth.password_validation import validate_password
from api import models as api_models

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from userauths.models import Profile, User, Admin, OrganizationUnit, Position
from django.conf import settings

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        cls._add_user_fields(token, user)
        return token
    
    @staticmethod
    def _add_user_fields(token, user):
        """Add custom user fields to JWT token - used by both normal login and SSO"""
        token['user_id'] = user.id  # ✨ PHASE 4.10: Add user ID for frontend operations
        token['id'] = user.id  # Also add as 'id' for compatibility
        token['full_name'] = user.full_name
        token['email'] = user.email
        token['username'] = user.username
        # CRITICAL FIX: Use current_role (for multi-role) instead of deprecated role field
        # user.role is always 'student' for multi-role users, so we must use current_role
        token['role'] = user.current_role if hasattr(user, 'current_role') and user.current_role else user.role
        token['current_role'] = user.current_role if hasattr(user, 'current_role') else user.role
        token['nip'] = user.nip  # Add NIP field for SSO identity
        
        # 3 Jenis Peserta: INTERNAL, ASN, UMUM
        token['user_type'] = getattr(user, 'user_type', 'UMUM')
        token['instansi_asal'] = getattr(user, 'instansi_asal', '') or ''
        token['provinsi'] = getattr(user, 'provinsi', '') or ''
        token['kota_kabupaten'] = getattr(user, 'kota_kabupaten', '') or ''
        token['pekerjaan'] = getattr(user, 'pekerjaan', '') or ''
        token['negara'] = getattr(user, 'negara', 'Indonesia') or 'Indonesia'
        token['onboarding_completed'] = getattr(user, 'onboarding_completed', False)
        
        # ✨ PHASE 4.10: Add boolean role fields to JWT
        # These new fields allow frontend to properly detect which roles user has
        token['is_student'] = getattr(user, 'is_student', True)
        token['is_instructor'] = getattr(user, 'is_instructor', False)
        token['is_admin'] = getattr(user, 'is_admin', False)
        
        # Return available roles based on boolean fields
        available_roles = []
        if token['is_student']:
            available_roles.append('student')
        if token['is_instructor']:
            available_roles.append('instructor')
        if token['is_admin']:
            available_roles.append('admin')
        
        token['available_roles'] = available_roles
        token['has_multiple_roles'] = len(available_roles) > 1
        token['roles'] = ','.join(available_roles) if available_roles else 'student'
        
        # Auto-create Teacher object if user is instructor/teacher but doesn't have one yet
        # Updated to check boolean is_instructor field first
        if getattr(user, 'is_instructor', False) or user.role in ['instructor', 'teacher']:
            try:
                # Try to get existing teacher
                teacher_id = user.teacher.id
                token['teacher_id'] = teacher_id
            except:
                # Teacher doesn't exist - create it from profile
                try:
                    from userauths.models import Profile
                    profile = Profile.objects.get(user=user)
                    teacher = api_models.Teacher.create_from_profile(user)
                    token['teacher_id'] = teacher.id
                except:
                    # Profile doesn't exist either - create a minimal teacher object
                    try:
                        teacher = api_models.Teacher.objects.create(
                            user=user,
                            full_name=user.full_name,
                            image='',
                            country=''
                        )
                        token['teacher_id'] = teacher.id
                    except:
                        token['teacher_id'] = 0
        else:
            try:
                token['teacher_id'] = user.teacher.id
            except:
                token['teacher_id'] = 0
            
        # Auto-create/ensure Admin object if user is admin, superuser, or khairilazmiashari@gmail.com
        is_khairil = getattr(user, 'email', '') and user.email.strip().lower() == 'khairilazmiashari@gmail.com'
        if getattr(user, 'is_admin', False) or getattr(user, 'is_superuser', False) or is_khairil:
            try:
                from userauths.models import Admin
                admin_obj, _ = Admin.objects.get_or_create(
                    user=user,
                    defaults={
                        'full_name': user.full_name or user.username,
                        'is_super_admin': bool(getattr(user, 'is_superuser', False) or is_khairil)
                    }
                )
                if is_khairil or getattr(user, 'is_superuser', False):
                    if not admin_obj.is_super_admin:
                        admin_obj.is_super_admin = True
                        admin_obj.save(update_fields=['is_super_admin'])
                token['admin_id'] = admin_obj.id
                token['is_super_admin'] = admin_obj.is_super_admin
            except Exception:
                token['admin_id'] = getattr(user, 'admin', None).id if hasattr(user, 'admin') else 0
                token['is_super_admin'] = bool(getattr(user, 'is_superuser', False) or is_khairil)
        else:
            try:
                token['admin_id'] = user.admin.id if hasattr(user, 'admin') else 0
                token['is_super_admin'] = user.admin.is_super_admin if hasattr(user, 'admin') else False
            except:
                token['admin_id'] = 0
                token['is_super_admin'] = False

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ['full_name', 'email', 'password', 'password2']

    def validate(self, attr):
        if attr['password'] != attr['password2']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        
        # Validate email format
        email = attr.get('email', '')
        if '@' not in email:
            raise serializers.ValidationError({"email": "Please provide a valid email address."})
        
        # Check if user already exists
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError({"email": "A user with this email already exists."})

        return attr
    
    def create(self, validated_data):
        try:
            email = validated_data['email']
            full_name = validated_data.get('full_name', '')
            password = validated_data['password']
            
            # Split email safely
            try:
                email_username, email_domain = email.split("@")
            except ValueError:
                raise serializers.ValidationError({"email": "Invalid email format"})
            
            # Create user
            user = User.objects.create(
                full_name=full_name or email_username,
                email=email,
                username=email_username,  # Set username here to avoid issues
            )
            
            # Set password
            user.set_password(password)
            user.save()
            
            return user
        except Exception as e:
            print(f"Error in RegisterSerializer.create: {str(e)}")
            raise serializers.ValidationError({"error": f"Registration failed: {str(e)}"})

    
    
class UserSerializer(serializers.ModelSerializer):
    """User serializer with Multi Role support - PHASE 4.10
    ✨ SPRINT 1 OPTIMIZATION: Uses pre-calculated annotations instead of N+1 queries
    """
    # ✨ SPRINT 1: Use pre-calculated fields from queryset annotations instead of calling methods
    enrollment_count = serializers.IntegerField(read_only=True, source='_enrollment_count')
    course_count = serializers.IntegerField(read_only=True, source='_course_count')
    phone = serializers.CharField(source='profile.phone', read_only=True, allow_null=True, required=False)
    image = serializers.SerializerMethodField()
    is_super_admin = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        # Only return essential fields for admin list view - OPTIMIZED
        fields = [
            'id',
            'username',
            'email',
            'full_name',
            'image',
            'phone',
            'role',
            'is_internal',
            'user_type',
            'nip',
            'jenis_jabatan',
            'golongan',
            'kelas_jabatan',
            'instansi_asal',
            'provinsi',
            'kota_kabupaten',
            'pekerjaan',
            'negara',
            'onboarding_completed',
            'is_student',
            'is_instructor',
            'is_admin',
            'is_super_admin',
            'is_active',
            'last_login',
            'date_joined',
            'enrollment_count',
            'course_count'
        ]
    
    def get_image(self, obj):
        try:
            profile = getattr(obj, 'profile', None)
            if profile and profile.image:
                try:
                    url = profile.image.url
                except Exception:
                    url = str(profile.image)
                if not url:
                    return None
                url_str = str(url).strip()
                if not url_str or url_str in ('default-user.jpg', 'default.jpg', 'placeholder.jpg', '/media/default-user.jpg'):
                    return None
                if url_str.startswith('http://') or url_str.startswith('https://') or url_str.startswith('data:image/'):
                    return url_str
                if not url_str.startswith('/'):
                    url_str = f"/media/{url_str}"
                request = self.context.get('request')
                if request:
                    return request.build_absolute_uri(url_str)
                return url_str
        except Exception:
            return None
        return None
    
    def get_is_super_admin(self, obj):
        try:
            if obj.email and obj.email.strip().lower() == 'khairilazmiashari@gmail.com':
                return True
            if getattr(obj, 'is_superuser', False):
                return True
            return bool(hasattr(obj, 'admin') and obj.admin.is_super_admin)
        except Exception:
            return False
    
    def to_representation(self, instance):
        """Override to provide default values if annotations not present"""
        data = super().to_representation(instance)
        # ✨ SPRINT 1: Fallback to 0 if annotations not available (backward compatibility)
        data['enrollment_count'] = getattr(instance, '_enrollment_count', 0) or 0
        data['course_count'] = getattr(instance, '_course_count', 0) or 0
        return data

class OrganizationUnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrganizationUnit
        fields = ['id', 'external_id', 'name', 'description']

class PositionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Position
        fields = ['id', 'external_id', 'name', 'description']

class ProfileSerializer(serializers.ModelSerializer):
    organization_unit = OrganizationUnitSerializer(read_only=True)
    position = PositionSerializer(read_only=True)
    
    # User fields for easy access in frontend
    full_name = serializers.CharField(source='user.full_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    phone = serializers.CharField(source='user.phone', read_only=True, allow_null=True)
    user_type = serializers.CharField(source='user.user_type', read_only=True, allow_null=True)
    is_internal = serializers.BooleanField(source='user.is_internal', read_only=True)
    nip = serializers.CharField(source='user.nip', read_only=True, allow_null=True)
    golongan = serializers.CharField(source='user.golongan', read_only=True, allow_null=True)
    kelas_jabatan = serializers.CharField(source='user.kelas_jabatan', read_only=True, allow_null=True)
    # ✨ PHASE 4.12.5: Allow null values for jenis_jabatan field
    jenis_jabatan = serializers.CharField(source='user.jenis_jabatan', read_only=True, allow_null=True)
    # ✨ PHASE 7.20: Include user_id for instructor badge comparison in forums
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    last_login = serializers.DateTimeField(source='user.last_login', read_only=True)
    
    # ✨ PHASE 11.5: CRITICAL FIX - Uses FileField NOT SerializerMethodField
    # SerializerMethodField is read-only (GET only), but we need to support write (PATCH)
    # FileField automatically handles both reading URLs and writing file uploads
    image = serializers.FileField(required=False, allow_null=True)
    
    # 🔒 Security: Expose role & admin flags as read-only, preventing Mass-Assignment
    role = serializers.CharField(source='user.role', read_only=True)
    is_admin = serializers.BooleanField(source='user.is_admin', read_only=True)
    is_super_admin = serializers.SerializerMethodField()
    
    # Computed fields for frontend display
    organization_unit_name = serializers.SerializerMethodField()
    position_name = serializers.SerializerMethodField()
    gamification = serializers.SerializerMethodField()
    
    class Meta:
        model = Profile
        fields = "__all__"
        read_only_fields = ['role', 'is_admin', 'is_super_admin', 'nip', 'email']
    

    def to_representation(self, instance):
        """✨ PHASE 11.3: Return proper representation with image URL"""
        representation = super().to_representation(instance)
        
        # ✨ PHASE 4.12.5: Ensure jenis_jabatan is properly returned (could be null from database)
        if 'jenis_jabatan' in representation and representation['jenis_jabatan'] is None:
            representation['jenis_jabatan'] = ""
        
        # Also ensure other nullable user fields are properly converted
        nullable_fields = ['nip', 'golongan', 'kelas_jabatan', 'phone']
        for field in nullable_fields:
            if field in representation and representation[field] is None:
                representation[field] = ""
            
        # Fallbacks for participant demographic fields from user
        if instance.user:
            if not representation.get('user_type'):
                representation['user_type'] = getattr(instance.user, 'user_type', 'UMUM') or 'UMUM'
            if not representation.get('instansi_asal'):
                representation['instansi_asal'] = getattr(instance.user, 'instansi_asal', '') or ''
            if not representation.get('pekerjaan'):
                representation['pekerjaan'] = getattr(instance.user, 'pekerjaan', '') or ''
            if not representation.get('provinsi'):
                representation['provinsi'] = getattr(instance.user, 'provinsi', '') or ''
            if not representation.get('kota_kabupaten'):
                representation['kota_kabupaten'] = getattr(instance.user, 'kota_kabupaten', '') or ''
            if not representation.get('country'):
                representation['country'] = getattr(instance.user, 'negara', '') or ''
            if not representation.get('phone'):
                representation['phone'] = getattr(instance.user, 'phone', '') or ''
            representation['is_internal'] = getattr(instance.user, 'is_internal', False)

        return representation
    
    def update(self, instance, validated_data):
        """Handle image upload/deletion during update"""
        # Handle image field explicitly
        if 'image' in validated_data:
            image_data = validated_data.get('image')
            
            # If image is empty string or None, delete existing image
            if image_data in ['', None]:
                # Only call delete() if this is a FileField (has delete method)
                if instance.image and hasattr(instance.image, 'delete'):
                    try:
                        instance.image.delete(save=False)
                    except Exception as e:
                        print(f"Error deleting image file: {e}")
                instance.image = None
            else:
                # If new image provided, delete old one and save new
                if instance.image and hasattr(instance.image, 'delete'):
                    try:
                        instance.image.delete(save=False)
                    except Exception as e:
                        print(f"Error deleting old image file: {e}")
                instance.image = image_data
        
        # Update other fields
        for attr, value in validated_data.items():
            if attr != 'image':
                setattr(instance, attr, value)
        
        instance.save()
        return instance
        
    def get_organization_unit_name(self, obj):
        return obj.organization_unit.name if obj.organization_unit else ""
        
    def get_position_name(self, obj):
        return obj.position.name if obj.position else ""

    def get_gamification(self, obj):
        try:
            if obj.user:
                from api.views.ai_assistant import get_user_gamification_data
                return get_user_gamification_data(obj.user)
        except Exception:
            pass
        return None

    def get_is_super_admin(self, obj):
        try:
            if obj.user.email and obj.user.email.strip().lower() == 'khairilazmiashari@gmail.com':
                return True
            if getattr(obj.user, 'is_superuser', False):
                return True
            return bool(hasattr(obj.user, 'admin') and obj.user.admin.is_super_admin)
        except Exception:
            return False


class AdminSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = Admin
        fields = "__all__"


class AdminSummarySerializer(serializers.Serializer):
    total_students = serializers.IntegerField()
    total_teachers = serializers.IntegerField()
    total_courses = serializers.IntegerField()
    total_enrollments = serializers.IntegerField()
    total_reviews = serializers.IntegerField()
    total_revenue = serializers.DecimalField(max_digits=12, decimal_places=2)
    active_courses = serializers.IntegerField()
    completed_courses = serializers.IntegerField()
    recent_enrollments = serializers.IntegerField()
    recent_registrations = serializers.IntegerField()


class AdminUserManagementSerializer(serializers.ModelSerializer):
    """Enhanced User serializer for admin user management - PHASE 4.10: Updated for Multi Role support"""
    enrollment_count = serializers.SerializerMethodField()
    course_count = serializers.SerializerMethodField()
    last_login_display = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'full_name', 'role', 'is_active', 
            'date_joined', 'last_login', 'enrollment_count', 'course_count',
            'last_login_display', 'status_display', 'is_student', 'is_instructor', 'is_admin'
        ]
    
    def get_enrollment_count(self, obj):
        # Support both legacy single-role and new multi-role system
        if obj.is_student or obj.role == 'student':
            return api_models.EnrolledCourse.objects.filter(user=obj).count()
        return 0
    
    def get_course_count(self, obj):
        # Support both legacy single-role and new multi-role system
        if obj.is_instructor or obj.role == 'teacher':
            try:
                teacher = api_models.Teacher.objects.get(user=obj)
                return api_models.Course.objects.filter(teacher=teacher).count()
            except api_models.Teacher.DoesNotExist:
                return 0
        return 0
    
    def get_last_login_display(self, obj):
        if obj.last_login:
            return obj.last_login.strftime('%Y-%m-%d %H:%M')
        return 'Never'
    
    def get_status_display(self, obj):
        return 'Active' if obj.is_active else 'Inactive'


class AdminUserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new users by admin"""
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)
    
    class Meta:
        model = User
        fields = ['full_name', 'email', 'role', 'password', 'password2']
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password2')
        password = validated_data.pop('password')
        
        user = User.objects.create(**validated_data)
        user.set_password(password)
        
        # Generate username from email
        email_username, _ = user.email.split("@")
        user.username = email_username
        user.save()
        
        return user


class CategorySerializer(serializers.ModelSerializer):
    enrollment_count = serializers.SerializerMethodField()
    material_count = serializers.SerializerMethodField()

    class Meta:
        fields = ['id', 'title', 'image', 'slug', 'course_count', 'enrollment_count', 'material_count']
        model = api_models.Category

    def get_enrollment_count(self, obj):
        return api_models.EnrolledCourse.objects.filter(
            course__category=obj,
            course__platform_status="Published",
            course__is_published_version=True
        ).count()

    def get_material_count(self, obj):
        return api_models.VariantItem.objects.filter(
            variant__course__category=obj,
            variant__course__platform_status="Published",
            variant__course__is_published_version=True
        ).count()


class CategoryManagementSerializer(serializers.ModelSerializer):
    """✨ PHASE 4.11: Serializer for admin category management with full CRUD support"""
    course_count = serializers.SerializerMethodField()
    
    class Meta:
        fields = ['id', 'title', 'image', 'slug', 'active', 'course_count']
        model = api_models.Category
        read_only_fields = ['id', 'slug', 'course_count']
    
    def get_course_count(self, obj):
        """Get count of published courses in this category
        ✨ PHASE 4+: Only count published courses for public consistency
        [*] PHASE 4.77 FIX: Filter by is_published_version=True to avoid double counting
        In dual-copy versioning: draft has is_published_version=False, published copy has is_published_version=True"""
        return api_models.Course.objects.filter(
            category=obj,
            platform_status="Published",
            is_published_version=True  # [*] PHASE 4.77: Count only published copies, not drafts
        ).count()


class TagSerializer(serializers.ModelSerializer):
    """✨ PHASE X: Serializer for course tags"""
    course_count = serializers.SerializerMethodField()
    
    class Meta:
        fields = ['id', 'title', 'slug', 'course_count']
        model = api_models.Tag
    
    def get_course_count(self, obj):
        """Get count of published courses with this tag"""
        return api_models.Course.objects.filter(
            tags=obj,
            platform_status="Published",
            is_published_version=True
        ).count()


class TagManagementSerializer(serializers.ModelSerializer):
    """✨ PHASE X: Serializer for admin tag management with full CRUD support"""
    course_count = serializers.SerializerMethodField()
    
    class Meta:
        fields = ['id', 'title', 'slug', 'active', 'course_count']
        model = api_models.Tag
        read_only_fields = ['id', 'slug', 'course_count']
    
    def get_course_count(self, obj):
        """Get count of published courses with this tag"""
        return api_models.Course.objects.filter(
            tags=obj,
            platform_status="Published",
            is_published_version=True
        ).count()
    
    def validate_title(self, value):
        """Ensure tag title is not empty and unique"""
        if not value or not value.strip():
            raise serializers.ValidationError("Tag title cannot be empty.")
        
        # Check for uniqueness excluding current instance
        instance = self.instance
        duplicate = api_models.Tag.objects.filter(title__iexact=value.strip())
        if instance:
            duplicate = duplicate.exclude(id=instance.id)
        
        if duplicate.exists():
            raise serializers.ValidationError(f"Tag with title '{value}' already exists.")
        
        return value.strip()
    
    def create(self, validated_data):
        """Create new tag with slug auto-generation"""
        tag = api_models.Tag.objects.create(**validated_data)
        return tag
    
    def update(self, instance, validated_data):
        """Update tag details"""
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class TeacherExpertiseSerializer(serializers.ModelSerializer):
    """Serializer for teacher expertise/skills"""
    class Meta:
        model = api_models.TeacherExpertise
        fields = ['id', 'skill', 'proficiency_level', 'color_gradient', 'text_color', 'border_color', 'order']


class TeacherSerializer(serializers.ModelSerializer):
    # ✨ PHASE 11.5: CRITICAL FIX - Uses FileField NOT SerializerMethodField
    # SerializerMethodField is read-only (GET only), we need to support write (PATCH)
    image = serializers.FileField(required=False, allow_null=True)
    # New fields for teacher stats and expertise
    expertise = TeacherExpertiseSerializer(many=True, read_only=True, required=False)
    average_rating = serializers.SerializerMethodField()
    total_students = serializers.SerializerMethodField()

    class Meta:
        fields = ["id", "user", "image", "full_name", "bio", "facebook", "twitter", "linkedin", "about", "country", "expertise", "average_rating", "total_students"]
        model = api_models.Teacher
    
    def get_average_rating(self, obj):
        """Calculate average rating across all teacher's courses"""
        from django.db.models import Avg
        teacher_courses = api_models.Course.objects.filter(teacher=obj)
        all_reviews = api_models.Review.objects.filter(
            course__in=teacher_courses,
            active=True
        )
        avg_rating = all_reviews.aggregate(avg=Avg('rating'))['avg']
        return round(avg_rating, 1) if avg_rating else 0.0
    
    def get_total_students(self, obj):
        """Calculate total unique students across all teacher's courses"""
        teacher_courses = api_models.Course.objects.filter(teacher=obj)
        total = api_models.EnrolledCourse.objects.filter(
            course__in=teacher_courses
        ).values('user').distinct().count()
        return total

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.user:
            data['email'] = instance.user.email
            data['phone'] = getattr(instance.user, 'phone', '') or ''
            data['nip'] = getattr(instance.user, 'nip', '') or ''
            data['user_type'] = getattr(instance.user, 'user_type', 'UMUM') or 'UMUM'
            data['is_internal'] = getattr(instance.user, 'is_internal', False)
            data['instansi_asal'] = getattr(instance.user, 'instansi_asal', '') or ''
            data['pekerjaan'] = getattr(instance.user, 'pekerjaan', '') or ''
            data['provinsi'] = getattr(instance.user, 'provinsi', '') or ''
            data['kota_kabupaten'] = getattr(instance.user, 'kota_kabupaten', '') or ''
        return data


class BasicTeacherSerializer(serializers.ModelSerializer):
    """Simplified Teacher serializer for basic operations without related fields"""
    # ✨ PHASE 11.5: CRITICAL FIX - Uses FileField NOT SerializerMethodField  
    image = serializers.FileField(required=False, allow_null=True)
    full_name = serializers.SerializerMethodField()  # ✨ PHASE 4.39: Ensure full_name returns teacher name or user full_name fallback
    user_id = serializers.IntegerField(source='user.id', read_only=True)  # ✨ PHASE 7.20: Include user_id for instructor badge comparison
    last_login = serializers.DateTimeField(source='user.last_login', read_only=True)

    class Meta:
        fields = ["id", "user_id", "image", "full_name", "bio", "facebook", "twitter", "linkedin", "youtube", "instagram", "tiktok", "about", "country", "last_login"]
        model = api_models.Teacher
    
    def get_full_name(self, obj):
        """
        ✨ PHASE 4.39: Always return user's full_name as source of truth
        User.full_name is the authoritative source for instructor names
        """
        if obj.user and obj.user.full_name:
            return obj.user.full_name  # Always prefer user.full_name (source of truth)
        # Fallback to teacher's full_name if user's is empty
        if obj.full_name and obj.full_name.strip():
            return obj.full_name
        return "Instruktur"

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.user:
            data['email'] = instance.user.email
            data['phone'] = getattr(instance.user, 'phone', '') or ''
            data['nip'] = getattr(instance.user, 'nip', '') or ''
            data['user_type'] = getattr(instance.user, 'user_type', 'UMUM') or 'UMUM'
            data['is_internal'] = getattr(instance.user, 'is_internal', False)
            data['instansi_asal'] = getattr(instance.user, 'instansi_asal', '') or ''
            data['pekerjaan'] = getattr(instance.user, 'pekerjaan', '') or ''
            data['provinsi'] = getattr(instance.user, 'provinsi', '') or ''
            data['kota_kabupaten'] = getattr(instance.user, 'kota_kabupaten', '') or ''
            data['jenis_jabatan'] = getattr(instance.user, 'jenis_jabatan', '') or ''
            data['golongan'] = getattr(instance.user, 'golongan', '') or ''
            data['kelas_jabatan'] = getattr(instance.user, 'kelas_jabatan', '') or ''
        return data


class LearningModuleSerializer(serializers.ModelSerializer):
    player_url = serializers.ReadOnlyField()

    class Meta:
        model = api_models.LearningModule
        fields = [
            'id', 'judul', 'deskripsi', 'module_type', 
            'file_zip', 'extracted_path', 'entry_file', 
            'player_url', 'course', 'author', 
            'tanggal_dibuat', 'tanggal_diperbarui'
        ]
        read_only_fields = ['extracted_path', 'entry_file', 'player_url', 'tanggal_dibuat', 'tanggal_diperbarui']


class UserProgressSerializer(serializers.ModelSerializer):
    learning_module_judul = serializers.CharField(source='learning_module.judul', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)

    class Meta:
        model = api_models.UserProgress
        fields = [
            'id', 'user', 'user_name', 'learning_module', 
            'learning_module_judul', 'course', 'variant_item',
            'lesson_status', 'score_raw', 'lesson_location', 
            'session_time', 'suspend_data', 'last_accessed', 'completed_at'
        ]
        read_only_fields = ['last_accessed', 'completed_at']


class VariantItemSerializer(serializers.ModelSerializer):
    content_duration = serializers.ReadOnlyField()  # Include the property method
    file_type = serializers.ReadOnlyField()         # Include file type property
    file_icon = serializers.ReadOnlyField()         # Include file icon property
    duration_seconds = serializers.SerializerMethodField()  # ✨ PHASE 4.43.9: Extract duration in seconds for frontend
    completion_question = serializers.SerializerMethodField()  # ✨ PHASE 4.143: Include lesson completion question
    is_fully_watched = serializers.SerializerMethodField()  # ✨ PHASE 11.178: Track if student watched 100%
    is_completed = serializers.SerializerMethodField()  # ✨ PHASE 11.178: Track if student finished (watched + answered correctly)
    learning_module_info = serializers.SerializerMethodField()
    quiz_detail = serializers.SerializerMethodField()
    quiz_id = serializers.SerializerMethodField()
    
    class Meta:
        fields = '__all__'
        model = api_models.VariantItem


    def __init__(self, *args, **kwargs):
        super(VariantItemSerializer, self).__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.method == "POST":
            self.Meta.depth = 0
        else:
            self.Meta.depth = 1  # Reduced from 3 to 1
    
    def get_quiz_id(self, obj):
        if obj.quiz_id and obj.quiz:
            return obj.quiz.quiz_id
        return None

    def get_quiz_detail(self, obj):
        if obj.quiz_id and obj.quiz:
            quiz = obj.quiz
            user = None
            request = self.context.get('request')
            if request and hasattr(request, 'user') and request.user and not request.user.is_anonymous:
                user = request.user
            else:
                user = self.context.get('current_user')

            best_attempt = None
            if user:
                best_attempt = api_models.QuizAttempt.objects.filter(user=user, quiz=quiz).order_by('-score').first()

            return {
                'id': quiz.id,
                'quiz_id': quiz.quiz_id,
                'title': quiz.title,
                'description': quiz.description,
                'quiz_type': quiz.quiz_type,
                'presentation_mode': quiz.presentation_mode,
                'total_questions': quiz.questions.count(),
                'is_active': quiz.is_active,
                'is_passed': best_attempt.is_passed if best_attempt else False,
                'best_score': best_attempt.score if best_attempt else 0,
            }
        return None

    def get_duration_seconds(self, obj):
        """✨ PHASE 4.43.9: Extract duration in seconds from DurationField for frontend"""
        if obj.duration:
            return int(obj.duration.total_seconds())
        return None
    
    def get_completion_question(self, obj):
        """✨ PHASE 4.143: Return completion question if it exists for this variant item"""
        if hasattr(obj, 'completion_question') and obj.completion_question:
            return LessonCompletionQuestionSerializer(obj.completion_question).data
        return None
    
    def get_is_fully_watched(self, obj):
        """✨ PHASE 11.178: Check if current user has fully watched this lesson
        ✨ PHASE 11.182: Support both request.user and context['current_user']"""
        # Try to get user from request first, then fallback to context
        user = None
        
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user and not request.user.is_anonymous:
            user = request.user
        else:
            # Fallback to current_user from context (used in StudentCourseDetailAPIView)
            user = self.context.get('current_user')
        
        if not user:
            return False
        
        try:
            # Check if this item is a quiz item
            if getattr(obj, 'item_type', 'lesson') == 'quiz' or obj.quiz_id:
                if obj.quiz:
                    best_attempt = api_models.QuizAttempt.objects.filter(
                        user=user,
                        quiz=obj.quiz
                    ).order_by('-score').first()
                    return bool(best_attempt and best_attempt.is_passed and best_attempt.score >= 70)
                return False

            # Get current user's course
            course = obj.variant.course
            
            # Check VideoProgress for this user-course-lesson
            video_progress = api_models.VideoProgress.objects.filter(
                user=user,
                course=course,
                variant_item=obj
            ).first()
            
            if video_progress:
                return video_progress.is_fully_watched
            return False
        except Exception as e:
            return False
    
    def get_is_completed(self, obj):
        """✨ PHASE 11.202+: Check if current user completed this lesson (watched + passed verification)
        ✨ PHASE 11.202: FIXED - Now validates completion against verification questions
        ✨ PHASE 11.182: Support both request.user and context['current_user']
        ✨ PHASE 11.187: Improved context handling for nested serializers
        ✨ PHASE 12.1: Enhanced logging for debugging completion display issues
        
        ROOT CAUSE FIX: Previously returned True if ANY CompletedLesson record existed,
        even if the lesson had an unanswered verification question. Now validates the completion.
        """
        user = None
        
        # Try multiple ways to get the user, as context may not propagate through all nested serializers
        try:
            request = self.context.get('request')
            if request and hasattr(request, 'user') and request.user and not request.user.is_anonymous:
                user = request.user
        except (AttributeError, TypeError):
            pass
        
        # If request.user not available, try current_user from context
        if not user:
            try:
                user = self.context.get('current_user')
            except (AttributeError, TypeError):
                pass
        
        # If still no user, try to get from parent serializer's context
        # This handles the case where context wasn't passed to nested serializers
        if not user and hasattr(self, 'parent') and self.parent:
            try:
                parent_context = getattr(self.parent, 'context', {})
                user = parent_context.get('current_user') if parent_context else None
                if not user:
                    parent_request = parent_context.get('request') if parent_context else None
                    if parent_request and hasattr(parent_request, 'user') and parent_request.user and not parent_request.user.is_anonymous:
                        user = parent_request.user
            except (AttributeError, TypeError):
                pass
        
        if not user:
            return False
        
        try:
            # Check if this item is a quiz item
            if getattr(obj, 'item_type', 'lesson') == 'quiz' or obj.quiz_id:
                if obj.quiz:
                    best_attempt = api_models.QuizAttempt.objects.filter(
                        user=user,
                        quiz=obj.quiz
                    ).order_by('-score').first()
                    return bool(best_attempt and best_attempt.is_passed and best_attempt.score >= 70)
                return False

            # Get current user's course
            course = obj.variant.course
            lesson_title = obj.title if obj else "Unknown"
            variant_item_id = obj.variant_item_id if obj else "Unknown"
            
            # Check if a completed lesson record exists
            completed_lesson = api_models.CompletedLesson.objects.filter(
                user=user,
                course=course,
                variant_item=obj
            ).first()
            
            if not completed_lesson:
                # Juga periksa jika modul SCORM / H5P telah diselesaikan dengan status passed atau completed
                if obj.learning_module and user:
                    scorm_done = api_models.UserProgress.objects.filter(
                        user=user,
                        learning_module=obj.learning_module,
                        lesson_status__in=['passed', 'completed']
                    ).exists()
                    if scorm_done:
                        return True

                # No completion record exists = not completed
                # Log for target lesson to help debugging
                if variant_item_id == 254517:
                    print(f"\n[VariantItemSerializer.get_is_completed] Lesson {lesson_title} (ID={variant_item_id})")
                    print(f"   ❌ NO CompletedLesson record = return False")
                return False
            
            # ✨ PHASE 11.202: Validate the completion - only return True if it's a VALID completion
            # A completion is valid if:
            # 1. The lesson has NO verification question (auto-complete allowed), OR
            # 2. The lesson HAS a verification question AND student answered it CORRECTLY
            
            verification_question = api_models.LessonCompletionQuestion.objects.filter(
                variant_item=obj
            ).first()
            
            if not verification_question:
                # No verification question = this is a valid completion (auto-complete)
                if variant_item_id == 254517:
                    print(f"\n[VariantItemSerializer.get_is_completed] Lesson {lesson_title} (ID={variant_item_id})")
                    print(f"   ✅ CompletedLesson exists + NO verification question = return True (VALID)")
                return True
            
            # Verification question exists = check if student answered correctly
            correct_answer = api_models.LessonCompletionQuestionAnswer.objects.filter(
                user=user,
                question=verification_question,
                is_correct=True
            ).exists()
            
            # Log for target lesson to help debugging
            if variant_item_id == 254517:
                print(f"\n[VariantItemSerializer.get_is_completed] Lesson {lesson_title} (ID={variant_item_id})")
                print(f"   CompletedLesson exists + verification question exists")
                print(f"   Student answered correctly: {correct_answer}")
                print(f"   Return: {correct_answer}")
            
            # Only return True if student has correct answer
            return correct_answer
            
        except Exception as e:
            print(f"\n[VariantItemSerializer.get_is_completed] ERROR: {e}")
            return False

    def get_learning_module_info(self, obj):
        """Include SCORM / H5P metadata, player url, and user progress/score if learning_module is linked"""
        if obj.learning_module:
            request = self.context.get('request')
            user = self.context.get('user') or self.context.get('current_user') or (request.user if request and request.user.is_authenticated else None)
            user_progress = None
            if user:
                user_progress = api_models.UserProgress.objects.filter(
                    user=user,
                    learning_module=obj.learning_module,
                    variant_item=obj
                ).first()
                if not user_progress and obj.variant and obj.variant.course:
                    user_progress = api_models.UserProgress.objects.filter(
                        user=user,
                        learning_module=obj.learning_module,
                        course=obj.variant.course
                    ).first()
                if not user_progress:
                    user_progress = api_models.UserProgress.objects.filter(
                        user=user,
                        learning_module=obj.learning_module
                    ).first()
            return {
                "id": obj.learning_module.id,
                "judul": obj.learning_module.judul,
                "module_type": obj.learning_module.module_type,
                "player_url": obj.learning_module.player_url,
                "entry_file": obj.learning_module.entry_file,
                "score_raw": user_progress.score_raw if user_progress else 0.0,
                "lesson_status": user_progress.lesson_status if user_progress else 'not attempted',
                "completed_at": user_progress.completed_at if user_progress else None,
            }
        return None



class VariantSerializer(serializers.ModelSerializer):
    variant_items = VariantItemSerializer(many=True, read_only=True)
    items = VariantItemSerializer(many=True, read_only=True)
    
    class Meta:
        fields = '__all__'
        model = api_models.Variant

    def __init__(self, *args, **kwargs):
        super(VariantSerializer, self).__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.method == "POST":
            self.Meta.depth = 0
        else:
            self.Meta.depth = 1  # Reduced from 3 to 1
        
        # ✨ PHASE 11.187: Re-bind nested VariantItemSerializers with parent context
        # This ensures context is available in get_is_completed() for nested items
        # We need to do this because class-level attributes are created once at class def time
        # but we need fresh instances with the current context for each serializer instance
        try:
            if 'variant_items' in self.fields:
                self.fields['variant_items'] = VariantItemSerializer(many=True, context=self.context)
            if 'items' in self.fields:
                self.fields['items'] = VariantItemSerializer(many=True, context=self.context)
        except Exception as e:
            # If field rebinding fails, continue with original fields
            # This ensures backward compatibility
            pass





# Cart, CartOrder, and CartOrderItem serializers removed - not used in this LMS
# Q&A serializers removed - Course forum available in each course detail page

class CertificateSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source='course.title', read_only=True)
    course_slug = serializers.CharField(source='course.slug', read_only=True, default='')
    course_level = serializers.CharField(source='course.level', read_only=True, default='')
    course_category = serializers.CharField(source='course.category.title', read_only=True, default='')
    course_image = serializers.SerializerMethodField(read_only=True)
    student_name = serializers.CharField(source='user.full_name', read_only=True)
    student_nip = serializers.CharField(source='user.nip', read_only=True, default='')
    student_position = serializers.SerializerMethodField(read_only=True)
    student_organization_unit = serializers.SerializerMethodField(read_only=True)
    instructor_name = serializers.CharField(source='course.teacher.full_name', read_only=True)
    qr_code_url = serializers.SerializerMethodField(read_only=True)
    image_file_url = serializers.SerializerMethodField(read_only=True)  # ✨ PHASE 4.221: Image URL for display
    pdf_file_url = serializers.SerializerMethodField(read_only=True)  # ✨ PHASE 4.220: PDF file URL (kept for download)
    formatted_certificate_id = serializers.SerializerMethodField(read_only=True)  # ✨ PHASE 4.227: Professional certificate ID format

    class Meta:
        fields = [
            'id', 'course', 'user', 'enrollment', 'certificate_id', 'formatted_certificate_id',
            'validation_token', 'is_valid', 'integrity_status', 'date', 'course_title', 'course_slug', 'course_level',
            'course_category', 'course_image', 'student_name', 'student_nip', 'student_position', 'student_organization_unit',
            'instructor_name', 'qr_code_url', 'image_file_url', 'pdf_file_url', 'created_at', 'updated_at'
        ]
        model = api_models.Certificate

    def get_student_position(self, obj):
        try:
            profile = getattr(obj.user, 'profile', None)
            if profile and profile.position:
                return getattr(profile.position, 'name', None) or getattr(profile.position, 'title', None) or str(profile.position)
            return ''
        except Exception:
            return ''

    def get_student_organization_unit(self, obj):
        try:
            profile = getattr(obj.user, 'profile', None)
            if profile and profile.organization_unit:
                return getattr(profile.organization_unit, 'name', None) or str(profile.organization_unit)
            return ''
        except Exception:
            return ''

    def get_course_image(self, obj):
        if obj.course and obj.course.image:
            return obj.course.image
        return None

    def get_formatted_certificate_id(self, obj):
        """✨ PHASE 4.227: Get professionally formatted certificate ID"""
        return obj.get_formatted_certificate_id()

    def get_qr_code_url(self, obj):
        """Generate QR code URL for certificate validation (frontend route)"""
        request = self.context.get('request')
        if request:
            domain = request.get_host()
            protocol = 'https' if request.is_secure() else 'http'
            return f"{protocol}://{domain}/certificate/validate/{obj.validation_token}/"
        return None

    def get_image_file_url(self, obj):
        """✨ PHASE 4.221: Return image file URL for display (PNG/JPG image of certificate)"""
        request = self.context.get('request')
        
        # Return API endpoint URL for image display
        if obj.image_file and request:
            try:
                # Use dedicated image display endpoint
                image_url = request.build_absolute_uri(f'/api/v1/student/certificate-image/{obj.certificate_id}/')
                return image_url
            except Exception as e:
                return f'/api/v1/student/certificate-image/{obj.certificate_id}/'
        elif obj.image_file:
            return f'/api/v1/student/certificate-image/{obj.certificate_id}/'
        
        return None

    def get_pdf_file_url(self, obj):
        """✨ PHASE 4.220: Return PDF file URL for server-stored certificates via iframe-safe API endpoint"""
        request = self.context.get('request')
        
        # Return API endpoint URL instead of direct media URL to avoid X-Frame-Options header blocking
        if obj.pdf_file and request:
            try:
                # Use the iframe-safe certificate download endpoint
                pdf_url = request.build_absolute_uri(f'/api/v1/student/certificate-download/{obj.certificate_id}/')
                return pdf_url
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"[CertificateSerializer] ERROR building PDF URL: {e}")
                return None
        
        return None

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if request and request.parser_context.get('kwargs'):
            fields_param = request.parser_context['kwargs'].get('fields')
            if fields_param:
                fields = fields_param.split(',')
                allowed = set(fields)
                existing = set(self.fields)
                for field_name in existing - allowed:
                    self.fields.pop(field_name)

class CertificateTemplateConfigSerializer(serializers.ModelSerializer):
    """
    Serializer konfigurasi template sertifikat dinamis (Admin Setjen DPD RI & Instruktur Kursus).
    """
    pptx_template_url = serializers.SerializerMethodField(read_only=True)
    custom_background_url = serializers.SerializerMethodField(read_only=True)
    instructor_signature_url = serializers.SerializerMethodField(read_only=True)
    course_id_str = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = api_models.CertificateTemplateConfig
        fields = [
            'id', 'course', 'course_id_str', 'use_system_default', 'template_name', 'is_active',
            'pptx_template', 'pptx_template_url',
            'custom_background', 'custom_background_url',
            'primary_color', 'accent_color', 'title_font', 'body_font',
            'agency_sup', 'agency_main', 'agency_sub',
            'certificate_title', 'certificate_subtitle', 'statement_text',
            'signatory_title', 'signatory_sub_title', 'signatory_name', 'signatory_nip',
            'instructor_signature_image', 'instructor_signature_url', 'instructor_title', 'show_instructor_signature',
            'show_gold_seal', 'show_watermark', 'show_bpsdm_logo', 'show_qr_code',
            'created_at', 'updated_at'
        ]

    def get_pptx_template_url(self, obj):
        request = self.context.get('request')
        if obj.pptx_template:
            if request:
                return request.build_absolute_uri(obj.pptx_template.url)
            return obj.pptx_template.url
        return None

    def get_custom_background_url(self, obj):
        request = self.context.get('request')
        if obj.custom_background:
            if request:
                return request.build_absolute_uri(obj.custom_background.url)
            return obj.custom_background.url
        return None

    def get_instructor_signature_url(self, obj):
        request = self.context.get('request')
        if getattr(obj, 'instructor_signature_image', None):
            if request:
                return request.build_absolute_uri(obj.instructor_signature_image.url)
            return obj.instructor_signature_image.url
        return None

    def get_course_id_str(self, obj):
        if getattr(obj, 'course', None):
            return obj.course.course_id
        return None




class CompletedLessonSerializer(serializers.ModelSerializer):

    class Meta:
        fields = '__all__'
        model = api_models.CompletedLesson


    def __init__(self, *args, **kwargs):
        super(CompletedLessonSerializer, self).__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.method == "POST":
            self.Meta.depth = 0
        else:
            self.Meta.depth = 3

class VideoProgressSerializer(serializers.ModelSerializer):
    is_completed = serializers.ReadOnlyField()
    is_in_progress = serializers.ReadOnlyField()
    formatted_position = serializers.ReadOnlyField()
    formatted_duration = serializers.ReadOnlyField()
    # ✨ PHASE 52: Include variant_item details for activity tracking (show video title)
    variant_item = VariantItemSerializer(read_only=True)
    
    class Meta:
        fields = '__all__'
        model = api_models.VideoProgress

    def validate(self, attrs):
        """Ensure all numeric fields are properly converted from FormData strings"""
        numeric_fields = ['progress_percentage', 'last_watched_position', 'total_duration']
        for field in numeric_fields:
            value = attrs.get(field)
            if value is not None:
                try:
                    attrs[field] = float(value)
                except (TypeError, ValueError):
                    attrs[field] = 0.0
        return attrs

    def __init__(self, *args, **kwargs):
        super(VideoProgressSerializer, self).__init__(*args, **kwargs)
        request = self.context.get("request")
        # Always use depth=0 for video progress to avoid large nested responses
        # This prevents "broken pipe" errors from oversized responses
        self.Meta.depth = 0

class NoteSerializer(serializers.ModelSerializer):
    # ✨ PHASE 7.26+: Student course notes serializer
    user_name = serializers.CharField(source='user.full_name', read_only=True, allow_null=True)
    # ✨ PHASE 11.160: Include nested lesson context for filtering
    variant = VariantSerializer(read_only=True)
    variant_item = VariantItemSerializer(read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True, allow_null=True)
    course_slug = serializers.CharField(source='course.slug', read_only=True, allow_null=True)
    course_image = serializers.SerializerMethodField()
    enrollment_id = serializers.SerializerMethodField()

    class Meta:
        fields = [
            'id', 'user', 'user_name', 'course', 'course_title', 'course_slug', 'course_image',
            'enrollment_id', 'title', 'note', 'color', 'note_id', 'is_pinned', 'date', 'variant', 'variant_item'
        ]
        model = api_models.Note
        # ✨ PHASE 9.4: Mark non-editable fields as read-only to fix PUT/PATCH validation
        read_only_fields = ['user', 'course', 'note_id', 'date', 'variant', 'variant_item']

    def get_course_image(self, obj):
        if obj.course and obj.course.image:
            try:
                return obj.course.image.url
            except Exception:
                return str(obj.course.image)
        return None

    def get_enrollment_id(self, obj):
        if obj.course and obj.user:
            try:
                enrolled = api_models.EnrolledCourse.objects.filter(user=obj.user, course=obj.course).first()
                if enrolled:
                    return enrolled.enrollment_id
            except Exception:
                pass
        return None



class ReviewSerializer(serializers.ModelSerializer):
    # Include user data with profile information
    user = serializers.SerializerMethodField()
    course = serializers.SerializerMethodField()

    class Meta:
        fields = ['id', 'user', 'course', 'role', 'review', 'rating', 'reply', 'active', 'date']
        model = api_models.Review

    def get_user(self, obj):
        """Get user with profile information"""
        if obj.user:
            user_data = {
                'id': obj.user.id,
                'full_name': obj.user.full_name,
                'email': obj.user.email,
                'golongan': obj.user.golongan,
                'jenis_jabatan': obj.user.jenis_jabatan,
            }
            
            # Try to get image from related Profile
            try:
                profile = Profile.objects.get(user=obj.user)
                if profile.image:
                    # ✨ PHASE 11.10: Convert relative image URLs to absolute + cache-busting
                    image_str = str(profile.image)
                    request = self.context.get('request')
                    
                    # Check if already absolute URL
                    if image_str.startswith('http://') or image_str.startswith('https://'):
                        user_data['image'] = image_str
                    elif request:
                        # Convert relative path to absolute URL with cache-busting timestamp
                        if not image_str.startswith('/'):
                            image_str = f"/media/{image_str}"
                        from datetime import datetime
                        timestamp = int(datetime.now().timestamp() * 1000) // 3600000  # Cache-bust per hour
                        absolute_url = request.build_absolute_uri(image_str)
                        user_data['image'] = f"{absolute_url}?v={timestamp}"
                    else:
                        # Fallback if no request context
                        if not image_str.startswith('/'):
                            user_data['image'] = f"/media/{image_str}"
                        else:
                            user_data['image'] = image_str
                else:
                    user_data['image'] = None
            except Profile.DoesNotExist:
                user_data['image'] = None
            except Exception as e:
                user_data['image'] = None
            
            return user_data
        return None

    def get_course(self, obj):
        """Get course with essential details"""
        if obj.course:
            return {
                'id': obj.course.id,
                'title': obj.course.title,
                'slug': obj.course.slug,
            }
        return None

# ✨ PHASE 4.210: Review Abuse Serializer
class ReviewAbuseSerializer(serializers.ModelSerializer):
    reported_by_name = serializers.CharField(source='reported_by.full_name', read_only=True)
    review = ReviewSerializer(read_only=True)  # ✨ PHASE 4.210: Include full review details

    class Meta:
        fields = ['id', 'review', 'reported_by', 'reported_by_name', 'reason', 'description', 'status', 'reported_at', 'reviewed_at', 'review_notes', 'closed_by_reporter', 'closed_by_reporter_at']
        model = api_models.ReviewAbuse
        read_only_fields = ['review', 'reported_by', 'reported_by_name', 'reported_at', 'status', 'reviewed_at', 'review_notes', 'closed_by_reporter_at']


# ✨ PHASE 7.16: Q&A Report Serializers
class QuestionAnswerReportSerializer(serializers.ModelSerializer):
    reported_by_name = serializers.CharField(source='reported_by.full_name', read_only=True)
    question_title = serializers.CharField(source='question.title', read_only=True)
    question_user = serializers.CharField(source='question.user.full_name', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.full_name', read_only=True, required=False)
    
    class Meta:
        fields = ['id', 'question', 'question_title', 'question_user', 'reported_by', 'reported_by_name', 'reason', 'description', 'status', 'reported_at', 'reviewed_at', 'reviewed_by', 'reviewed_by_name', 'review_notes']
        model = api_models.Question_Answer_Report
        read_only_fields = ['question', 'reported_by', 'reported_by_name', 'reported_at']


class QuestionAnswerMessageReportSerializer(serializers.ModelSerializer):
    reported_by_name = serializers.CharField(source='reported_by.full_name', read_only=True)
    message_content = serializers.CharField(source='message.message', read_only=True)
    message_user = serializers.CharField(source='message.user.full_name', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.full_name', read_only=True, required=False)
    
    class Meta:
        fields = ['id', 'message', 'message_content', 'message_user', 'reported_by', 'reported_by_name', 'reason', 'description', 'status', 'reported_at', 'reviewed_at', 'reviewed_by', 'reviewed_by_name', 'review_notes']
        model = api_models.Question_Answer_Message_Report
        read_only_fields = ['message', 'reported_by', 'reported_by_name', 'reported_at']


class NotificationSerializer(serializers.ModelSerializer):
    course_data = serializers.SerializerMethodField()
    manta_prompt = serializers.SerializerMethodField()

    class Meta:
        fields = '__all__'
        model = api_models.Notification

    def get_course_data(self, obj):
        if getattr(obj, 'course', None):
            enrollment_id = None
            if getattr(obj, 'user', None):
                related_ids = obj.course.get_related_course_ids() if hasattr(obj.course, 'get_related_course_ids') else {obj.course.id}
                enr = api_models.EnrolledCourse.objects.filter(user=obj.user, course_id__in=related_ids).first()
                if enr:
                    enrollment_id = enr.enrollment_id
            return {
                "id": obj.course.id,
                "course_id": getattr(obj.course, 'course_id', obj.course.id),
                "title": obj.course.title,
                "slug": getattr(obj.course, 'slug', None),
                "enrollment_id": enrollment_id
            }
        return None

    def get_manta_prompt(self, obj):
        noti_type = str(getattr(obj, 'type', ''))
        if noti_type.startswith("AI "):
            if noti_type == "AI Learning Nudge":
                c_title = obj.course.title if getattr(obj, 'course', None) else "materi pelatihan aktif saya"
                return f"Manta, tolong rangkum materi penting dan langkah selanjutnya dari pelatihan '{c_title}'"
            elif noti_type == "AI JP Target Reminder":
                return "Manta, bagaimana progres pemenuhan 20 JP belajar saya dan rekomendasikan pelatihan untuk mencapainya"
            elif noti_type == "AI Microlearning Digest":
                return f"Manta, jelaskan lebih mendalam wawasan tentang '{obj.title}' dan relevansinya bagi ASN Setjen DPD RI"
            elif noti_type == "AI Flashcard Challenge":
                return "Manta, buatkan flashcard dan latihan kuis pemahaman materi ini"
            return f"Manta, saya ingin berdiskusi tentang: {obj.title}"
        return None


class CountrySerializer(serializers.ModelSerializer):

    class Meta:
        fields = '__all__'
        model = api_models.Country




class EnrolledCourseSerializer(serializers.ModelSerializer):
    # ✨ PHASE 4.228: Explicitly define course serializer to include total_jam_pelatihan
    course = serializers.SerializerMethodField()
    lectures = VariantItemSerializer(many=True, read_only=True)
    # ✨ PHASE 11.202: Use SerializerMethodField to validate completed lessons
    # Only include completions where no verification question exists OR student answered correctly
    completed_lesson = serializers.SerializerMethodField()
    video_progress = VideoProgressSerializer(many=True, read_only=True)
    curriculum =  VariantSerializer(many=True, read_only=True)
    note = NoteSerializer(many=True, read_only=True)
    # ✨ RESTORED: question_answer field - needed for Discussion Forum in course detail view
    question_answer = serializers.SerializerMethodField()
    review = ReviewSerializer(many=False, read_only=True)
    quiz_results = serializers.SerializerMethodField()
    qa_count = serializers.SerializerMethodField()  # ✨ PHASE 4.18: QA count - kept for forum stats
    # ✨ PHASE 52: Add certificate data for activity tracking (Quiz, Video, Certificate activities)
    certificate = serializers.SerializerMethodField()
    completion_percentage = serializers.SerializerMethodField()
    completion_metrics = serializers.SerializerMethodField()


    class Meta:
        fields = '__all__'
        model = api_models.EnrolledCourse

    def get_course(self, obj):
        """✨ PHASE 4.228: Return course with total_jam_pelatihan calculated
        
        Avoids circular references by returning only essential fields without nested relationships.
        Manually calculates total_jam_pelatihan (JP) from course curriculum.
        Includes quizzes for student quiz tab display.
        Converts all values to JSON-serializable types (Decimal→float, etc).
        """
        import math
        from decimal import Decimal
        
        course = obj.course
        
        # Calculate total_jam_pelatihan (JP) from all curriculum items
        total_seconds = 0
        for variant in course.curriculum.all():
            for item in variant.variant_items.all():
                if item.duration:
                    total_seconds += int(item.duration.total_seconds())
        
        # 1 JP = 2700 seconds (45 minutes)
        total_jp = math.ceil(total_seconds / 2700) if total_seconds > 0 else 0
        
        # Serialize quizzes for student quiz tab
        quizzes = []
        try:
            from . import serializer as ser
            quiz_objs = course.quizzes.all()
            if quiz_objs.exists():
                quizzes = ser.QuizSerializer(quiz_objs, many=True).data
        except Exception as e:
            # If quiz serialization fails, continue without quizzes
            pass

        # Serialize games for student gamification tab
        games = []
        try:
            from . import serializer as ser
            game_objs = course.games.filter(is_active=True).order_by('order', 'date')
            if game_objs.exists():
                games = ser.CourseGameSerializer(game_objs, many=True, context=self.context).data
        except Exception as e:
            pass
        
        # Serialize teacher for instructor info display
        teacher = None
        try:
            from . import serializer as ser
            if course.teacher:
                teacher = ser.BasicTeacherSerializer(course.teacher).data
        except Exception as e:
            # If teacher serialization fails, continue without teacher
            pass
        
        # ✨ PHASE 4.231: Serialize category for student course detail display
        category = None
        try:
            from . import serializer as ser
            if course.category:
                category = ser.CategorySerializer(course.category).data
        except Exception as e:
            # If category serialization fails, continue without category
            pass
        
        # ✨ PHASE 7.5h FIX: Serialize tags for course card display
        tags = None
        try:
            from . import serializer as ser
            if course.tags.exists():
                tags = ser.TagSerializer(course.tags.all(), many=True).data
        except Exception as e:
            # If tag serialization fails, continue without tags
            pass
        
        # Safe conversion function for JSON serialization
        def safe_value(val):
            """Convert any value to JSON-serializable type"""
            if val is None:
                return None
            if isinstance(val, Decimal):
                return float(val)
            if isinstance(val, bool):
                return val
            if isinstance(val, (int, float)):
                return val
            return str(val)
        
        # Return essential course data safely
        try:
            return {
                'id': safe_value(course.id),
                'course_id': safe_value(course.course_id),  # ✨ PHASE 4.229: Add course_id for quiz operations
                'title': safe_value(course.title) if course.title else '',
                'slug': safe_value(course.slug) if hasattr(course, 'slug') else '',
                'description': safe_value(course.description) if course.description else '',
                'image': safe_value(course.image) if course.image else None,
                'level': safe_value(course.level) if course.level else None,
                'date': safe_value(course.date) if hasattr(course, 'date') and course.date else None,
                'featured': bool(course.featured) if hasattr(course, 'featured') else False,
                'platform_status': safe_value(course.platform_status) if hasattr(course, 'platform_status') else None,
                'category': category,  # ✨ PHASE 4.231: Include category for progress card display
                # ✨ PHASE 7.5h FIX: Include tags for course card display
                'tags': tags or [],
                'total_jam_pelatihan': int(total_jp),  # ✨ PHASE 4.228: Include calculated JP
                'quizzes': quizzes,  # ✨ PHASE 4.229: Include quizzes for student quiz tab
                'games': games,  # Gamification games
                'teacher': teacher,  # ✨ PHASE 4.230: Include teacher for instructor info display
            }
        except Exception as e:
            # Fallback: return minimal data with just JP in case of any field access errors
            return {
                'id': safe_value(course.id),
                'title': safe_value(course.title) if course.title else 'Course',
                'category': category,  # ✨ PHASE 4.231: Include category in fallback
                'tags': tags or [],  # ✨ PHASE 7.5h FIX: Include tags in fallback
                'total_jam_pelatihan': int(total_jp),
                'quizzes': quizzes,
                'games': games,
                'teacher': teacher,
            }

    def get_quiz_results(self, obj):
        """Return quiz results for this enrollment"""
        return obj.quiz_results()

    def get_qa_count(self, obj):
        """✨ PHASE 4.18: Count total questions for this course enrollment"""
        return api_models.Question_Answer.objects.filter(course=obj.course).count()

    def get_question_answer(self, obj):
        """✨ RESTORED: Return all questions for this course enrollment - needed for Discussion Forum"""
        questions = api_models.Question_Answer.objects.filter(course=obj.course).order_by('-date')
        serializer = Question_AnswerSerializer(questions, many=True, context=self.context)
        return serializer.data

    def get_completed_lesson(self, obj):
        """✨ PHASE 11.202: Return only VALID completed lessons
        ✨ PHASE 12.16: Added detailed logging for troubleshooting
        ✨ PHASE 13.3: SUPER DETAILED LOGGING for completion filtering
        ✨ PHASE 13.4: Force fresh database query to avoid stale cache
        ✨ PHASE 37.1: Added raw SQL verification to debug missing lessons
        ✨ PHASE 66.2: Removed all debug prints to clean terminal output
        
        A completed lesson is VALID if:
        1. The lesson has NO verification question (auto-complete allowed), OR
        2. The lesson HAS a verification question AND student answered it CORRECTLY
        
        Fixes: Lessons showing as "Diselesaikan" even when verification question was NOT answered
        """
        user_id = obj.user.id if obj.user else None
        course_id = obj.course.id if obj.course else None
        
        # Get all completed lessons for this enrollment (course + user)
        # Use list() and select_related() to force FRESH database query
        all_completed = list(api_models.CompletedLesson.objects.filter(
            course=obj.course,
            user=obj.user
        ).select_related('variant_item'))  # Force evaluation NOW to get fresh data
        
        valid_completions = []
        
        for completion in all_completed:
            variant_item = completion.variant_item
            
            # Check if this lesson has a verification/completion question
            verification_question = api_models.LessonCompletionQuestion.objects.filter(
                variant_item=variant_item
            ).first()
            
            if not verification_question:
                # ✅ No verification question = lesson allows auto-completion
                valid_completions.append(completion)
            else:
                # ⚠️ Verification question EXISTS = student must answer correctly
                if user_id:
                    # Check for correct answer
                    correct_answer = api_models.LessonCompletionQuestionAnswer.objects.filter(
                        user_id=user_id,
                        question=verification_question,
                        is_correct=True
                    ).exists()
                    
                    if correct_answer:
                        # ✅ Student answered correctly = completion is VALID
                        valid_completions.append(completion)
        
        # Serialize only unique valid completions (strictly deduplicated by variant_item_id)
        seen_items = set()
        unique_valid_completions = []
        for completion in valid_completions:
            v_id = completion.variant_item_id
            if v_id not in seen_items:
                seen_items.add(v_id)
                unique_valid_completions.append(completion)

        serializer = CompletedLessonSerializer(
            unique_valid_completions, 
            many=True, 
            context=self.context
        )
        return serializer.data

    def get_completion_percentage(self, obj):
        """Return overall completion percentage (0-100)"""
        return obj.completion_percentage()

    def get_completion_metrics(self, obj):
        """Return comprehensive breakdown of completion items"""
        return obj.completion_metrics()

    def get_certificate(self, obj):
        """✨ PHASE 52: Return certificate data for activity tracking (Quiz, Video, Certificate activities)
        
        Retrieves the certificate for this enrollment if it exists.
        Used by Dashboard to show "Certificate Earned" activity.
        """
        try:
            certificate = api_models.Certificate.objects.filter(
                course=obj.course,
                user=obj.user
            ).first()
            
            if certificate:
                return {
                    'id': certificate.id,
                    'certificate_id': certificate.certificate_id,
                    'created_at': certificate.created_at,
                    'date': certificate.date,
                    'is_valid': certificate.is_valid
                }
            return None
        except api_models.Certificate.DoesNotExist:
            return None
        except Exception as e:
            return None

    def __init__(self, *args, **kwargs):
        super(EnrolledCourseSerializer, self).__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.method == "POST":
            self.Meta.depth = 0
        else:
            self.Meta.depth = 0  # ✨ PHASE 4.228: Reduced to 0 to avoid Decimal serialization issues

    def to_representation(self, instance):
        """Override to convert all non-JSON-serializable values for JSON serialization"""
        from decimal import Decimal
        from datetime import datetime, date, time
        import uuid
        
        representation = super().to_representation(instance)
        
        def convert_non_serializable(obj):
            """Recursively convert non-JSON-serializable types to JSON-safe types"""
            if isinstance(obj, dict):
                return {k: convert_non_serializable(v) for k, v in obj.items()}
            elif isinstance(obj, (list, tuple)):
                return [convert_non_serializable(item) for item in obj]
            elif isinstance(obj, Decimal):
                return float(obj)
            elif isinstance(obj, (datetime, date, time)):
                return obj.isoformat()
            elif isinstance(obj, uuid.UUID):
                return str(obj)
            return obj
        
        return convert_non_serializable(representation)


# ==================== NEW SERIALIZERS FOR COURSE DETAIL ENHANCEMENTS ====================

class CourseFeatureSerializer(serializers.ModelSerializer):
    """Serializer for course features"""
    class Meta:
        model = api_models.CourseFeature
        fields = ['id', 'icon', 'text', 'order', 'highlight']


class CourseRequirementSerializer(serializers.ModelSerializer):
    """Serializer for course requirements"""
    class Meta:
        model = api_models.CourseRequirement
        fields = ['id', 'requirement', 'order']


class CourseLearningOutcomeSerializer(serializers.ModelSerializer):
    """Serializer for course learning outcomes"""
    class Meta:
        model = api_models.CourseLearningOutcome
        fields = ['id', 'outcome', 'order']


class CourseResourceSerializer(serializers.ModelSerializer):
    """Serializer for course downloadable resources"""
    class Meta:
        model = api_models.CourseResource
        fields = ['id', 'name', 'file_type', 'file_size', 'file_url', 'order']

# ==================== END NEW SERIALIZERS ====================

class SearchCourseSerializer(serializers.ModelSerializer):
    """✨ PHASE 2: Lightweight serializer for search results - only essential fields (~500B per course vs 5KB)
    ✨ PHASE 4.77+: Fixed category field to return object with title property (was returning only string)
    """
    category = serializers.SerializerMethodField()  # ✨ PHASE 4.77: Return category as object
    category_name = serializers.CharField(source='category.title', read_only=True)  # Keep for backwards compatibility
    teacher_name = serializers.CharField(source='teacher.user.full_name', read_only=True)
    students_count = serializers.SerializerMethodField()
    rating = serializers.SerializerMethodField()
    number_of_rating = serializers.SerializerMethodField()
    
    class Meta:
        model = api_models.Course
        # Only return fields needed for search modal - 70% smaller response
        fields = ['id', 'title', 'slug', 'image', 'level', 'category', 'category_name', 'teacher_name', 
                  'students_count', 'rating', 'number_of_rating', 'featured']
    
    def get_category(self, obj):
        """✨ PHASE 4.77: Return category as object with title property
        Frontend expects: course.category?.title
        This returns: { "title": "Category Name", "id": 123 }
        """
        if obj.category:
            return {
                'id': obj.category.id,
                'title': obj.category.title,
                'slug': obj.category.slug
            }
        return None
    
    def get_students_count(self, obj):
        """Count enrolled students efficiently"""
        return api_models.EnrolledCourse.objects.filter(course=obj).count()
    
    def get_rating(self, obj):
        """Get average rating"""
        rating = obj.average_rating()
        return round(rating, 1) if rating else None
    
    def get_number_of_rating(self, obj):
        """Get number of ratings"""
        return obj.rating_count()

class CourseSerializer(serializers.ModelSerializer):
    students = EnrolledCourseSerializer(many=True, required=False, read_only=True,)
    curriculum = VariantSerializer(many=True, required=False, read_only=True,)
    lectures = VariantItemSerializer(many=True, required=False, read_only=True,)
    reviews = ReviewSerializer(many=True, read_only=True, required=False)
    # New related fields for course detail enhancements
    features = CourseFeatureSerializer(many=True, read_only=True, required=False)
    requirements = CourseRequirementSerializer(many=True, read_only=True, required=False)
    learning_outcomes = CourseLearningOutcomeSerializer(many=True, read_only=True, required=False)
    resources = CourseResourceSerializer(many=True, read_only=True, required=False)
    # ✨ PHASE X: Tags for course categorization
    # ✨ PHASE X.1 FIX: Changed from read_only=True to writable PrimaryKeyRelatedField
    # This allows instructors to assign/update tags when editing courses
    # to_representation() converts IDs to full tag objects for display
    tags = serializers.PrimaryKeyRelatedField(
        queryset=api_models.Tag.objects.all(), 
        many=True, 
        required=False
    )
    
    # ✨ PHASE 11.202+: Validate completed lessons - return only VALID completions
    # FIXED: Previously returned ALL CompletedLesson records including orphaned ones
    # Now validates each completion against its verification question requirement
    completed_lesson = serializers.SerializerMethodField()
    # ✨ PHASE 4.71: Fix quizzes field to return array instead of count
    # Frontend checks: Array.isArray(courseData.quizzes) && courseData.quizzes.length > 0
    # So we must return the actual Quiz objects, not just a count
    quizzes = serializers.SerializerMethodField()
    games = serializers.SerializerMethodField()  # ✨ PHASE 4.71: Return actual quiz objects for canPublish logic
    games = serializers.SerializerMethodField()  # Course Gamification activities
    teacher = BasicTeacherSerializer(read_only=True)  # ✨ PHASE 4.39: Explicit teacher serialization with full details
    qa_count = serializers.SerializerMethodField()  # ✨ PHASE 4.16: Add QA count for instructor QA page
    # ✨ PHASE 4.228: Add total_jam_pelatihan (JP) calculated from course lectures
    total_jam_pelatihan = serializers.SerializerMethodField()
    learning_module = LearningModuleSerializer(read_only=True)
    curriculum_summary = serializers.SerializerMethodField()  # ✨ Accurate sections, lessons, and curriculum quizzes summary
    
    class Meta:
        fields = ["id", "category", "tags", "teacher", "file", "image", "title", "description", "level", "target_audience", "platform_status", "teacher_course_status", "featured", "course_id", "slug", "date", "students", "curriculum", "lectures", "average_rating", "rating_count", "reviews", "features", "requirements", "learning_outcomes", "resources", "completed_lesson", "qa_count", "quizzes", "rejection_reason", "review_submitted_date", "total_jam_pelatihan", "course_type", "learning_module", "games", "curriculum_summary"]
        model = api_models.Course

    
    def get_qa_count(self, obj):
        """✨ PHASE 4.16 + PHASE 7.13 FIX: Count total questions from published version if exists
        
        CRITICAL FIX: When returning draft courses, check if published version exists.
        If yes, count questions from published version (where they're actually stored).
        This ensures instructor Q&A shows correct question counts even for draft courses.
        
        Logic:
        1. If this is a draft course with published copies → count from published
        2. If this is a published course → count from this course
        3. If this is draft with no published yet → count from draft (0)
        """
        # Check if this course has published copies
        if not obj.is_published_version:
            published_copy = obj.published_copies.filter(is_published_version=True).first()
            if published_copy:
                # Count questions from the published version
                return api_models.Question_Answer.objects.filter(course=published_copy).count()
        
        # Either it's a published course, or draft with no published copies yet
        return api_models.Question_Answer.objects.filter(course=obj).count()
    
    def get_quizzes(self, obj):
        """✨ PHASE 4.71: Return array of quiz objects, not count
        Frontend checks: Array.isArray(courseData.quizzes) && courseData.quizzes.length > 0
        This was returning only count (number), which failed the Array.isArray() check.
        Now returns full Quiz objects as array so canPublish logic works correctly.
        """
        from . import serializer as ser  # Lazy import to avoid circular reference
        quizzes = obj.quizzes.all()
        return ser.QuizSerializer(quizzes, many=True).data if quizzes.exists() else []

    def get_curriculum_summary(self, obj):
        """✨ Accurate summary of sections, lessons (non-quiz), and curriculum quizzes"""
        sections_count = obj.curriculum.count()
        lessons_count = api_models.VariantItem.objects.filter(variant__course=obj).exclude(item_type='quiz').count()
        curriculum_quizzes_count = api_models.VariantItem.objects.filter(variant__course=obj, item_type='quiz').count()
        if curriculum_quizzes_count == 0:
            curriculum_quizzes_count = obj.quizzes.filter(quiz_type='quiz').count()

        return {
            'sections_count': sections_count,
            'lessons_count': lessons_count,
            'quizzes_count': curriculum_quizzes_count,
        }

    def get_games(self, obj):
        """Return array of course game objects for instructor & student view"""
        from . import serializer as ser
        games = obj.games.filter(is_active=True).order_by('order', 'date')
        return ser.CourseGameSerializer(games, many=True, context=self.context).data if games.exists() else []

    def get_completed_lesson(self, obj):
        """✨ PHASE 11.202+: Return only VALID completed lessons
        
        A completed lesson is VALID if:
        1. The lesson has NO verification question (auto-complete allowed), OR
        2. The lesson HAS a verification question AND student has correct answer
        
        Similar validation to EnrolledCourseSerializer but for Course context.
        Returns all completions for this course (used in admin/analytics APIs).
        """
        # Get all completed lessons for this course
        all_completed = api_models.CompletedLesson.objects.filter(course=obj)
        
        valid_completions = []
        
        for completion in all_completed:
            variant_item = completion.variant_item
            item_title = variant_item.title if variant_item else "Unknown"
            variant_item_id = variant_item.variant_item_id if variant_item else "Unknown"
            user = completion.user
            username = user.username if user else "Unknown"
            
            # Check if this lesson has a verification/completion question
            verification_question = api_models.LessonCompletionQuestion.objects.filter(
                variant_item=variant_item
            ).first()
            
            if not verification_question:
                # ✅ No verification question = lesson allows auto-completion
                # This completion is VALID
                valid_completions.append(completion)
            else:
                # ⚠️ Verification question EXISTS = student must answer correctly
                if user:
                    correct_answer = api_models.LessonCompletionQuestionAnswer.objects.filter(
                        user=user,
                        question=verification_question,
                        is_correct=True
                    ).exists()
                    
                    if correct_answer:
                        # ✅ Student answered correctly = completion is VALID
                        valid_completions.append(completion)
        
        # Serialize only unique valid completions (strictly deduplicated by variant_item_id)
        seen_items = set()
        unique_valid_completions = []
        for completion in valid_completions:
            v_id = completion.variant_item_id
            if v_id not in seen_items:
                seen_items.add(v_id)
                unique_valid_completions.append(completion)

        serializer = CompletedLessonSerializer(
            unique_valid_completions, 
            many=True, 
            context=self.context
        )
        return serializer.data

    def get_total_jam_pelatihan(self, obj):
        """
        ✨ PHASE 4.228: Calculate total JP (Jam Pelajaran) from all course lectures
        1 JP = 45 minutes = 2700 seconds
        Formula: Math.ceil(totalSeconds / 2700)
        
        Returns the total hours of training (JP) for the course
        """
        import math
        total_seconds = 0
        
        # Get all curriculum sections (variants) for this course
        curriculum = obj.curriculum.all()
        
        # Iterate through each section and sum up all item durations
        for variant in curriculum:
            # Use .all() to properly access the RelatedManager queryset
            variant_items = variant.variant_items.all()
            for item in variant_items:
                if item.duration:
                    total_seconds += int(item.duration.total_seconds())
        
        # 1 JP = 2700 seconds (45 minutes)
        # Use ceiling division to round up (e.g., 1 second = 1 JP)
        if total_seconds > 0:
            jp_value = math.ceil(total_seconds / 2700)
        else:
            # If course has curriculum or lectures (e.g. SCORM package, text, H5P), default to minimum 1 JP
            has_items = api_models.VariantItem.objects.filter(variant__course=obj).exists()
            jp_value = 1 if has_items else 1
        
        return jp_value

    def __init__(self, *args, **kwargs):
        super(CourseSerializer, self).__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.method == "POST":
            self.Meta.depth = 0
        else:
            self.Meta.depth = 1  # Reduced from 3 to 1 to avoid circular references
    
    def to_representation(self, instance):
        """Override to return full URL for image and file fields + tags as full objects"""
        representation = super().to_representation(instance)
        request = self.context.get('request')
        
        # Handle image field - convert relative paths to full URLs
        if instance.image:
            image_url = str(instance.image)
            # If it's already a full URL, return as-is
            if image_url.startswith('http://') or image_url.startswith('https://'):
                representation['image'] = image_url
            # Otherwise, construct full URL with /media/ prefix
            elif request:
                from django.conf import settings
                if not image_url.startswith('/'):
                    image_url = f"/media/{image_url}"
                representation['image'] = request.build_absolute_uri(image_url)
            else:
                # Fallback if no request context
                if not image_url.startswith('/'):
                    representation['image'] = f"/media/{image_url}"
                else:
                    representation['image'] = image_url
        
        # Handle file field similarly
        if instance.file:
            file_url = str(instance.file)
            if file_url.startswith('http://') or file_url.startswith('https://'):
                representation['file'] = file_url
            elif request:
                if not file_url.startswith('/'):
                    file_url = f"/media/{file_url}"
                representation['file'] = request.build_absolute_uri(file_url)
            else:
                if not file_url.startswith('/'):
                    representation['file'] = f"/media/{file_url}"
                else:
                    representation['file'] = file_url
        
        # ✨ PHASE X.1: Convert tag IDs to full tag objects for API responses
        # PrimaryKeyRelatedField returns IDs by default, but we want full objects
        if 'tags' in representation and isinstance(representation['tags'], list):
            representation['tags'] = TagSerializer(instance.tags.all(), many=True).data
        
        return representation

class CourseEditSerializer(serializers.ModelSerializer):
    """
    Simplified course serializer for editing operations to avoid circular references
    and improve performance
    
    ✨ PHASE 4.75: Publish versioning fix
    - Now includes published_version data so frontend can show "what's published to students"
    - When course.platform_status="Review", published_version contains the current published curriculum
    - This prevents draft changes from appearing as published before admin approval
    
    ✨ PHASE 4.85: Added missing course metadata
    - Added features, requirements, and learning_outcomes for admin review page
    - These were missing from serializer causing blank sections in admin UI
    """
    category = CategorySerializer(read_only=True)
    teacher = BasicTeacherSerializer(read_only=True)
    curriculum = VariantSerializer(many=True, required=False, read_only=True)
    lectures = VariantItemSerializer(many=True, required=False, read_only=True)
    quizzes = serializers.SerializerMethodField()
    games = serializers.SerializerMethodField()
    # ✨ PHASE 4.85: Added missing course metadata fields
    features = CourseFeatureSerializer(many=True, read_only=True, required=False)
    requirements = CourseRequirementSerializer(many=True, read_only=True, required=False)
    learning_outcomes = CourseLearningOutcomeSerializer(many=True, read_only=True, required=False)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True, allow_null=True)
    published_version = serializers.SerializerMethodField()  # ✨ PHASE 4.75: Include published version data
    qa_count = serializers.SerializerMethodField()  # ✨ PHASE 7.13: Add QA count for course detail pages
    # ✨ PHASE 7.5 FIX: Add tags field - convert to full objects in to_representation()
    tags = serializers.PrimaryKeyRelatedField(
        queryset=api_models.Tag.objects.all(),
        many=True,
        required=False
    )
    
    class Meta:
        # ✨ PHASE 4.85: Added "features", "requirements", "learning_outcomes"
        # ✨ PHASE 7.13: Added "qa_count" to CourseEditSerializer
        # ✨ PHASE 7.5 FIX: Added "tags" to return saved tags in edit form
        # ✨ PHASE 7.6 FIX: Added "target_audience" and "course_type" for live course review
        fields = ["id", "category", "tags", "teacher", "file", "image", "title", "description", "level", "target_audience", "course_type", "platform_status", "teacher_course_status", "featured", "course_id", "slug", "date", "curriculum", "lectures", "quizzes", "games", "average_rating", "rating_count", "rejection_reason", "approved_by", "approved_by_name", "approval_date", "review_submitted_date", "features", "requirements", "learning_outcomes", "published_version", "qa_count"]
        model = api_models.Course
    
    def get_quizzes(self, obj):
        """✨ PHASE 4.38: Return full quiz data with questions and choices for admin review"""
        from . import serializer as ser  # Import to avoid circular reference
        quizzes = obj.quizzes.all()
        return ser.QuizSerializer(quizzes, many=True, read_only=True).data

    def get_games(self, obj):
        """Return array of course game objects for instructor preview and editing"""
        from . import serializer as ser
        games = obj.games.all().order_by('order', 'date')
        return ser.CourseGameSerializer(games, many=True, context=self.context).data if games.exists() else []
    
    def get_published_version(self, obj):
        """
        ✨ PHASE 4.75: Return the published version of this course if it exists
        
        This is used by the frontend to show:
        1. For draft in Review status: what's CURRENTLY published to students
        2. For normal viewing: null (no published version)
        3. For admins reviewing: the current live version to compare with draft
        
        Returns: Full serialized published course data or None
        """
        # Check if this is a draft course with published copies
        if not obj.is_published_version:
            published_copies = obj.published_copies.filter(is_published_version=True).first()
            if published_copies:
                # Return full published version data including curriculum
                from . import serializer as ser
                from api.models import VariantItem
                
                # Get lectures using the model method
                published_lectures = VariantItem.objects.filter(variant__course=published_copies)
                
                return {
                    'id': published_copies.id,
                    'course_id': published_copies.course_id,
                    'title': published_copies.title,
                    'description': published_copies.description,
                    'file': published_copies.file,
                    'image': published_copies.image,
                    'platform_status': published_copies.platform_status,
                    'teacher_course_status': published_copies.teacher_course_status,
                    'level': published_copies.level,
                    # ✨ PHASE 7.5g FIX: Include category (was missing, causing N/A display)
                    'category': CategorySerializer(published_copies.category).data if published_copies.category else None,
                    'curriculum': ser.VariantSerializer(
                        published_copies.curriculum.all(), 
                        many=True, 
                        read_only=True
                    ).data,
                    'lectures': ser.VariantItemSerializer(
                        published_lectures,
                        many=True,
                        read_only=True
                    ).data,
                    'quizzes': ser.QuizSerializer(
                        published_copies.quizzes.all(),
                        many=True,
                        read_only=True
                    ).data,
                    'games': ser.CourseGameSerializer(
                        published_copies.games.filter(is_active=True).order_by('order', 'date'),
                        many=True,
                        read_only=True
                    ).data if published_copies.games.exists() else [],
                    # ✨ Features, Requirements, and Learning Outcomes for published preview
                    'features': ser.CourseFeatureSerializer(
                        published_copies.features.all(),
                        many=True,
                        read_only=True
                    ).data if published_copies.features.exists() else [],
                    'requirements': ser.CourseRequirementSerializer(
                        published_copies.requirements.all(),
                        many=True,
                        read_only=True
                    ).data if published_copies.requirements.exists() else [],
                    'learning_outcomes': ser.CourseLearningOutcomeSerializer(
                        published_copies.learning_outcomes.all(),
                        many=True,
                        read_only=True
                    ).data if published_copies.learning_outcomes.exists() else [],
                    # ✨ PHASE 7.13: Add qa_count for published version
                    # Frontend needs correct question count from published course, not draft
                    'qa_count': api_models.Question_Answer.objects.filter(course=published_copies).count(),
                    # ✨ PHASE 7.5g FIX: Include tags from published version (not draft)
                    # When viewing published version, show what's CURRENTLY published to students
                    # Tags are copied to published_copies during publication, so use those
                    'tags': TagSerializer(
                        published_copies.tags.all(),
                        many=True
                    ).data if published_copies.tags.exists() else []
                }
        return None
    
    def get_qa_count(self, obj):
        """✨ PHASE 7.13: Count total questions from published version if exists
        
        Same logic as CourseSerializer but for course detail/editing pages.
        Ensures instructor sees correct question counts when editing draft courses.
        """
        # Check if this course has published copies
        if not obj.is_published_version:
            published_copy = obj.published_copies.filter(is_published_version=True).first()
            if published_copy:
                # Count questions from the published version
                return api_models.Question_Answer.objects.filter(course=published_copy).count()
        
        # Either it's a published course, or draft with no published copies yet
        return api_models.Question_Answer.objects.filter(course=obj).count()
    
    def to_representation(self, instance):
        """Override to return full URL for image and file fields + tags as full objects"""
        representation = super().to_representation(instance)
        request = self.context.get('request')
        
        # Handle image field - convert relative paths to full URLs
        if instance.image:
            image_url = str(instance.image)
            if image_url.startswith('http://') or image_url.startswith('https://'):
                representation['image'] = image_url
            elif request:
                if not image_url.startswith('/'):
                    image_url = f"/media/{image_url}"
                representation['image'] = request.build_absolute_uri(image_url)
            else:
                if not image_url.startswith('/'):
                    representation['image'] = f"/media/{image_url}"
                else:
                    representation['image'] = image_url
        
        # Handle file field similarly
        if instance.file:
            file_url = str(instance.file)
            if file_url.startswith('http://') or file_url.startswith('https://'):
                representation['file'] = file_url
            elif request:
                if not file_url.startswith('/'):
                    file_url = f"/media/{file_url}"
                representation['file'] = request.build_absolute_uri(file_url)
            else:
                if not file_url.startswith('/'):
                    representation['file'] = f"/media/{file_url}"
                else:
                    representation['file'] = file_url
        
        # ✨ PHASE 7.5 FIX: Convert tag IDs to full tag objects for frontend display
        # PrimaryKeyRelatedField returns IDs by default, but we need full objects
        if 'tags' in representation and isinstance(representation['tags'], list):
            representation['tags'] = TagSerializer(instance.tags.all(), many=True).data
        
        return representation

class WishlistSerializer(serializers.ModelSerializer):
    course = CourseSerializer()

    class Meta:
        fields = '__all__'
        model = api_models.Wishlist

    def __init__(self, *args, **kwargs):
        super(WishlistSerializer, self).__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.method == "POST":
            self.Meta.depth = 0
        else:
            self.Meta.depth = 3

class StudentSummarySerializer(serializers.Serializer):
    total_courses = serializers.IntegerField(default=0)
    completed_lessons = serializers.IntegerField(default=0)
    achieved_certificates = serializers.IntegerField(default=0)

class TeacherSummarySerializer(serializers.Serializer):
    total_courses = serializers.IntegerField(default=0)
    total_students = serializers.IntegerField(default=0)

# Quiz System Serializers
class QuizChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = api_models.QuizChoice
        fields = ['choice_id', 'choice_text', 'is_correct', 'order']

    def __init__(self, *args, **kwargs):
        super(QuizChoiceSerializer, self).__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.method == "POST":
            self.Meta.depth = 0
        else:
            self.Meta.depth = 1

class QuizQuestionSerializer(serializers.ModelSerializer):
    choices = QuizChoiceSerializer(many=True, read_only=True)
    correct_answer = QuizChoiceSerializer(read_only=True)
    
    class Meta:
        model = api_models.QuizQuestion
        fields = ['question_id', 'question_text', 'order', 'date', 'choices', 'correct_answer']

    def __init__(self, *args, **kwargs):
        super(QuizQuestionSerializer, self).__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.method == "POST":
            self.Meta.depth = 0
        else:
            self.Meta.depth = 1

class QuizSerializer(serializers.ModelSerializer):
    questions = QuizQuestionSerializer(many=True, read_only=True)
    total_questions = serializers.ReadOnlyField()
    course_title = serializers.SerializerMethodField()
    
    class Meta:
        model = api_models.Quiz
        fields = ['quiz_id', 'title', 'description', 'quiz_type', 'presentation_mode', 'is_active', 'date', 'questions', 'total_questions', 'course_title']

    def get_course_title(self, obj):
        return obj.course.title if obj.course else None

    def __init__(self, *args, **kwargs):
        super(QuizSerializer, self).__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.method == "POST":
            self.Meta.depth = 0
        else:
            self.Meta.depth = 1


class QuizAttemptSerializer(serializers.ModelSerializer):
    quiz_title = serializers.SerializerMethodField()
    pass_status = serializers.ReadOnlyField()
    percentage_display = serializers.ReadOnlyField()
    
    class Meta:
        model = api_models.QuizAttempt
        fields = [
            'attempt_id', 'quiz', 'quiz_title', 'score', 'total_questions', 
            'correct_answers', 'is_passed', 'pass_status', 'percentage_display',
            'time_taken', 'date_attempted', 'attempt_type'
        ]
        read_only_fields = ['attempt_id', 'is_passed', 'date_attempted']

    def get_quiz_title(self, obj):
        return obj.quiz.title if obj.quiz else None

    def __init__(self, *args, **kwargs):
        super(QuizAttemptSerializer, self).__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.method == "POST":
            self.Meta.depth = 0
        else:
            self.Meta.depth = 1


class QuizSubmissionSerializer(serializers.Serializer):
    """Serializer for quiz submission with answers"""
    quiz_id = serializers.CharField()
    answers = serializers.ListField(
        child=serializers.DictField(
            child=serializers.CharField()
        )
    )
    time_taken = serializers.IntegerField(required=False)  # Changed from DurationField to IntegerField for seconds
    attempt_type = serializers.CharField(required=False, allow_blank=True, default='quiz')


class FileUploadSerializer(serializers.Serializer):
    file = serializers.FileField(required=True)

    def validate_file(self, value):
        """
        Validate file extension against strict whitelist (T-01 Pentest Fix)
        Supports media formats:
        - Documents: .pdf, .doc, .docx, .txt
        - Presentations: .ppt, .pptx
        - Images: .png, .jpg, .jpeg, .webp
        - Videos: .mp4, .webm, .ogv, .mov, .avi, .mkv
        - Audio: .mp3, .wav, .ogg, .m4a, .aac
        """
        import os
        allowed_extensions = {
            '.pdf', '.png', '.jpg', '.jpeg', '.webp',
            '.mp4', '.webm', '.ogv', '.mov', '.avi', '.mkv',
            '.ppt', '.pptx',
            '.doc', '.docx', '.txt',
            '.mp3', '.wav', '.ogg', '.m4a', '.aac'
        }
        dangerous_extensions = {
            '.html', '.htm', '.svg', '.php', '.phtml', '.php3', '.php4', '.php5',
            '.phps', '.phar', '.sh', '.bash', '.exe', '.bat', '.cmd', '.js',
            '.jsx', '.ts', '.tsx', '.py', '.pl', '.cgi', '.asp', '.aspx',
            '.jsp', '.jspx', '.htaccess', '.env', '.config', '.war'
        }
        
        ext = os.path.splitext(value.name)[1].lower()
        if ext in dangerous_extensions or ext not in allowed_extensions:
            raise serializers.ValidationError(
                f"Format file '{ext}' tidak diizinkan. Ekstensi yang didukung: Dokumen (PDF, PPT/PPTX, DOC/DOCX, TXT), Video (MP4, WebM, dll), Audio (MP3, WAV, dll), dan Gambar."
            )
        return value

class ExternalUserDataSerializer(serializers.Serializer):
    """Serializer for external API user data"""
    id = serializers.CharField()
    name = serializers.CharField()
    email = serializers.CharField(allow_null=True, required=False, allow_blank=True)
    created_at = serializers.CharField(allow_null=True, required=False)
    updated_at = serializers.CharField(allow_null=True, required=False)
    status = serializers.CharField(allow_null=True, required=False)
    timezone = serializers.CharField(allow_null=True, required=False, default='Asia/Jakarta')
    nip = serializers.CharField(allow_null=True, required=False)
    golongan = serializers.CharField(allow_null=True, required=False)
    kelas_jabatan = serializers.CharField(allow_null=True, required=False)
    jenis_jabatan = serializers.CharField(allow_null=True, required=False)
    unit_organisasi = serializers.DictField(allow_null=True, required=False)
    jabatan = serializers.DictField(allow_null=True, required=False)


class SearchAnalyticsSerializer(serializers.ModelSerializer):
    """Serializer for trending search queries"""
    class Meta:
        model = api_models.SearchAnalytics
        fields = ['id', 'query', 'search_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'search_count']


# ✨ PHASE 4: Full-Text Search related serializers

class FullTextSearchResultSerializer(serializers.ModelSerializer):
    """Serializer for FTS results - includes ranking"""
    rank = serializers.FloatField(read_only=True)
    teacher_name = serializers.CharField(source='teacher.full_name', read_only=True)
    category_name = serializers.CharField(source='category.title', read_only=True)
    rating = serializers.SerializerMethodField()
    rating_count = serializers.SerializerMethodField()
    
    class Meta:
        model = api_models.Course
        fields = [
            'id', 'slug', 'title', 'description', 'image',
            'level', 'rank', 'teacher_name', 'category_name',
            'rating', 'rating_count', 'featured', 'date'
        ]
    
    def get_rating(self, obj):
        return obj.average_rating() or 0
    
    def get_rating_count(self, obj):
        return obj.rating_count() or 0


class SearchLogSerializer(serializers.ModelSerializer):
    """Serializer for search logs"""
    class Meta:
        model = api_models.SearchLog
        fields = ['id', 'query', 'results_count', 'created_at']
        read_only_fields = ['id', 'created_at']


class CourseSearchAnalyticsSerializer(serializers.ModelSerializer):
    """Serializer for per-course search analytics"""
    course_title = serializers.CharField(source='course.title', read_only=True)
    
    class Meta:
        model = api_models.CourseSearchAnalytics
        fields = [
            'id', 'course', 'course_title', 'search_impressions',
            'search_clicks', 'click_through_rate', 'updated_at'
        ]
        read_only_fields = ['id', 'updated_at']


# ✨ PHASE 4.3: Analytics serializers
class TrendingSearchSerializer(serializers.Serializer):
    """Serializer for trending searches"""
    query = serializers.CharField()
    count = serializers.IntegerField()
    unique_users = serializers.IntegerField()
    avg_results = serializers.FloatField()


class FailedSearchSerializer(serializers.Serializer):
    """Serializer for failed searches (zero results)"""
    query = serializers.CharField()
    attempt_count = serializers.IntegerField()
    last_attempted = serializers.DateTimeField()


class SearchVolumeSerializer(serializers.Serializer):
    """Serializer for daily search volume"""
    date = serializers.DateField()
    count = serializers.IntegerField()


class SearchStatsSerializer(serializers.Serializer):
    """Serializer for aggregate search statistics"""
    total_searches = serializers.IntegerField()
    unique_searchers = serializers.IntegerField()
    avg_results = serializers.FloatField()
    unique_queries = serializers.IntegerField()


class CourseSearchMetricsSerializer(serializers.ModelSerializer):
    """Serializer for course search metrics"""
    course_title = serializers.CharField(source='course.title', read_only=True)
    teacher_name = serializers.CharField(source='course.teacher.full_name', read_only=True)
    category_name = serializers.CharField(source='course.category.title', read_only=True)
    
    class Meta:
        model = api_models.CourseSearchAnalytics
        fields = [
            'course', 'course_title', 'teacher_name', 'category_name',
            'search_impressions', 'search_clicks', 'click_through_rate'
        ]
        read_only_fields = fields


# ✨ PHASE 4.4: Dashboard Serializers
class DashboardOverviewSerializer(serializers.Serializer):
    """Overall dashboard metrics and KPIs"""
    total_searches = serializers.IntegerField()
    unique_searchers = serializers.IntegerField()
    unique_queries = serializers.IntegerField()
    avg_results_per_search = serializers.FloatField()
    avg_ctr = serializers.FloatField()
    period_days = serializers.IntegerField()
    search_quality_score = serializers.FloatField()  # Custom calculated score


class DashboardTrendingSerializer(serializers.Serializer):
    """Trending searches data for dashboard"""
    trending_searches = TrendingSearchSerializer(many=True)
    failed_searches = FailedSearchSerializer(many=True)
    search_volume_trend = SearchVolumeSerializer(many=True)


class DashboardCoursePerformanceSerializer(serializers.Serializer):
    """Course search performance metrics"""
    total_courses = serializers.IntegerField()
    top_courses = CourseSearchMetricsSerializer(many=True)
    avg_metrics = serializers.DictField()  # avg_impressions, avg_clicks, avg_ctr


class DashboardCompleteSerializer(serializers.Serializer):
    """Complete dashboard data combining all metrics"""
    overview = DashboardOverviewSerializer()
    trending = DashboardTrendingSerializer()
    course_performance = DashboardCoursePerformanceSerializer()
    timestamp = serializers.DateTimeField()
    period = serializers.CharField()  # 'daily', 'weekly', 'monthly'


# ✨ PHASE 4.5: Advanced Filters Serializers

class FilterOptionSerializer(serializers.Serializer):
    """Generic filter option serializer"""
    id = serializers.IntegerField()
    label = serializers.CharField()
    count = serializers.IntegerField()


class CategoryFilterSerializer(serializers.Serializer):
    """Serializer for category filter options"""
    id = serializers.IntegerField()
    title = serializers.CharField()
    course_count = serializers.IntegerField()
    slug = serializers.CharField()


class LevelFilterSerializer(serializers.Serializer):
    """Serializer for course level filter options"""
    level = serializers.CharField()
    count = serializers.IntegerField()
    description = serializers.CharField(required=False)


class RatingFilterSerializer(serializers.Serializer):
    """Serializer for rating range filter options"""
    min_rating = serializers.FloatField()
    max_rating = serializers.FloatField()
    count = serializers.IntegerField()
    percentage = serializers.FloatField()


class TeacherFilterSerializer(serializers.Serializer):
    """Serializer for teacher filter options"""
    id = serializers.IntegerField()
    full_name = serializers.CharField()
    image = serializers.URLField(required=False, allow_null=True)
    course_count = serializers.IntegerField()
    avg_rating = serializers.FloatField()


class FilterOptionsResponseSerializer(serializers.Serializer):
    """Response serializer containing all filter options"""
    categories = CategoryFilterSerializer(many=True)
    levels = LevelFilterSerializer(many=True)
    ratings = RatingFilterSerializer(many=True)
    teachers = TeacherFilterSerializer(many=True)


# ✨ PHASE 4.6: Integrated Search Serializers

class AdvancedSearchFiltersSerializer(serializers.Serializer):
    """Request serializer for advanced search filters"""
    category_id = serializers.IntegerField(required=False, allow_null=True)
    level = serializers.CharField(required=False, allow_null=True)
    min_rating = serializers.FloatField(required=False, allow_null=True)
    max_rating = serializers.FloatField(required=False, allow_null=True)
    teacher_id = serializers.IntegerField(required=False, allow_null=True)


class AdvancedSearchRequestSerializer(serializers.Serializer):
    """Request serializer for advanced search endpoint"""
    query = serializers.CharField(max_length=500, required=True)
    filters = AdvancedSearchFiltersSerializer(required=False, allow_null=True)
    page = serializers.IntegerField(required=False, default=1, min_value=1)
    per_page = serializers.IntegerField(required=False, default=10, min_value=1, max_value=100)


class AdvancedSearchResultSerializer(serializers.ModelSerializer):
    """Serializer for individual search results with filter info"""
    rank = serializers.FloatField(read_only=True)
    teacher_name = serializers.CharField(source='teacher.full_name', read_only=True)
    category_name = serializers.CharField(source='category.title', read_only=True)
    rating = serializers.SerializerMethodField()
    rating_count = serializers.SerializerMethodField()
    matched_filters = serializers.SerializerMethodField()
    
    class Meta:
        model = api_models.Course
        fields = [
            'id', 'slug', 'title', 'description', 'image', 'level',
            'rank', 'teacher_name', 'category_name', 'rating', 'rating_count',
            'featured', 'date', 'matched_filters'
        ]
    
    def get_rating(self, obj):
        return obj.average_rating() or 0
    
    def get_rating_count(self, obj):
        return obj.rating_count() or 0
    
    def get_matched_filters(self, obj):
        """Return which filters this course matched"""
        request_filters = self.context.get('filters', {})
        matched = []
        
        if request_filters.get('category_id') and obj.category_id == request_filters['category_id']:
            matched.append('category')
        if request_filters.get('level') and obj.level == request_filters['level']:
            matched.append('level')
        if request_filters.get('teacher_id') and obj.teacher_id == request_filters['teacher_id']:
            matched.append('teacher')
        
        # Check rating filter
        if request_filters.get('min_rating'):
            avg_rating = obj.average_rating() or 0
            min_rating = request_filters.get('min_rating', 0)
            if avg_rating >= min_rating:
                matched.append('rating')
        
        return matched


class AdvancedSearchResponseSerializer(serializers.Serializer):
    """Response serializer for advanced search results"""
    query = serializers.CharField()
    filters_applied = AdvancedSearchFiltersSerializer()
    total_results = serializers.IntegerField()
    page = serializers.IntegerField()
    per_page = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    results = AdvancedSearchResultSerializer(many=True)
    execution_time_ms = serializers.FloatField()
    search_quality_score = serializers.FloatField()  # Based on results quality


# ==================== TIER 1: SERIALIZERS ====================

class ContentGapSerializer(serializers.ModelSerializer):
    """Serializer for content gap analysis"""
    class Meta:
        model = api_models.ContentGap
        fields = [
            'id', 'search_query', 'attempt_count', 'unique_users',
            'priority_score', 'suggested_course_title', 'suggested_category',
            'last_searched', 'created_at'
        ]
        read_only_fields = ['priority_score', 'created_at', 'last_searched']


class StudentRiskAssessmentSerializer(serializers.ModelSerializer):
    """Serializer for at-risk student detection"""
    enrollment_detail = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()
    course_title = serializers.SerializerMethodField()
    
    class Meta:
        model = api_models.StudentRiskAssessment
        fields = [
            'id', 'enrollment', 'enrollment_detail', 'student_name', 'course_title',
            'risk_score', 'risk_level',
            'indicators', 'intervention_sent', 'intervention_date',
            'last_assessed', 'created_at'
        ]
        read_only_fields = ['last_assessed', 'created_at']
    
    def get_enrollment_detail(self, obj):
        user_name = "Peserta"
        course_name = "Kursus"
        enrollment_id = None
        if obj.enrollment:
            enrollment_id = obj.enrollment.id
            if obj.enrollment.user:
                user_name = getattr(obj.enrollment.user, 'full_name', '') or obj.enrollment.user.username
            if obj.enrollment.course:
                course_name = obj.enrollment.course.title
        return {
            'user': user_name,
            'course': course_name,
            'id': enrollment_id
        }

    def get_student_name(self, obj):
        if obj.enrollment and obj.enrollment.user:
            return getattr(obj.enrollment.user, 'full_name', '') or obj.enrollment.user.username
        return "Peserta"

    def get_course_title(self, obj):
        if obj.enrollment and obj.enrollment.course:
            return obj.enrollment.course.title
        return "Kursus"


class CourseRecommendationSerializer(serializers.ModelSerializer):
    """Serializer for course recommendations"""
    user_name = serializers.SerializerMethodField()
    course_detail = serializers.SerializerMethodField()
    conversion_rate = serializers.SerializerMethodField()
    
    class Meta:
        model = api_models.CourseRecommendation
        fields = [
            'id', 'user', 'user_name', 'course', 'course_detail',
            'score', 'reason', 'clicked', 'enrolled', 'click_date',
            'enroll_date', 'conversion_rate', 'created_at'
        ]
        read_only_fields = ['created_at', 'click_date', 'enroll_date']

    def get_user_name(self, obj):
        if obj.user:
            return getattr(obj.user, 'full_name', '') or obj.user.username
        return "Pengguna"
    
    def get_course_detail(self, obj):
        if not obj.course:
            return {'id': None, 'title': 'Kursus', 'image': None}
        return {
            'id': obj.course.id,
            'title': obj.course.title,
            'image': str(obj.course.image) if obj.course.image else None
        }
    
    def get_conversion_rate(self, obj):
        return obj.conversion_rate


# ==================== TIER 2: SERIALIZERS ====================

class InstructorPerformanceSerializer(serializers.ModelSerializer):
    """Serializer for instructor performance analytics"""
    teacher_name = serializers.CharField(source='teacher.full_name', read_only=True)
    
    class Meta:
        model = api_models.InstructorPerformance
        fields = [
            'id', 'teacher', 'teacher_name', 'avg_rating', 'total_ratings',
            'course_count', 'total_students', 'avg_completion_rate',
            'avg_qa_response_time_hours', 'qa_response_rate',
            'positive_reviews_pct', 'teaching_effectiveness_score',
            'period_start', 'period_end'
        ]
        read_only_fields = ['teaching_effectiveness_score', 'period_start', 'period_end']


class LearningPathSerializer(serializers.ModelSerializer):
    """Serializer for learning paths"""
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    
    class Meta:
        model = api_models.LearningPath
        fields = [
            'id', 'user', 'user_name', 'title', 'description',
            'difficulty_progression', 'estimated_duration_hours',
            'completion_percentage', 'courses_completed', 'courses_total',
            'effectiveness_score', 'success_probability',
            'created_at', 'started_at', 'estimated_completion', 'completed_at'
        ]
        read_only_fields = ['created_at']


class ChurnPredictionSerializer(serializers.ModelSerializer):
    """Serializer for churn predictions"""
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    
    class Meta:
        model = api_models.ChurnPrediction
        fields = [
            'id', 'user', 'user_name', 'user_email', 'churn_probability',
            'risk_signals', 'intervention_status', 'intervention_date',
            'created_at', 'last_updated'
        ]
        read_only_fields = ['created_at', 'last_updated']


# ==================== TIER 3: SERIALIZERS ====================

class SearchIntentSerializer(serializers.ModelSerializer):
    """Serializer for search intent classification"""
    best_courses_count = serializers.SerializerMethodField()
    
    class Meta:
        model = api_models.SearchIntent
        fields = [
            'id', 'query', 'intent_type', 'related_keywords',
            'best_courses_count', 'created_at'
        ]
        read_only_fields = ['created_at']
    
    def get_best_courses_count(self, obj):
        return obj.best_courses.count()


class QuizMetricsSerializer(serializers.ModelSerializer):
    """Serializer for quiz metrics"""
    quiz_title = serializers.CharField(source='quiz.title', read_only=True)
    calibration_recommendations = serializers.SerializerMethodField()
    
    class Meta:
        model = api_models.QuizMetrics
        fields = [
            'id', 'quiz', 'quiz_title', 'avg_score', 'pass_rate',
            'discrimination_index', 'difficulty_rating', 'avg_time_minutes',
            'calibration_recommendations', 'last_calibrated'
        ]
        read_only_fields = ['last_calibrated']
    
    def get_calibration_recommendations(self, obj):
        return obj.get_calibration_recommendations()


# ✨ PHASE 4.10: Search Quality Metrics Serializers

class CourseSearchQualitySerializer(serializers.ModelSerializer):
    """
    Serialize course search quality metrics for Super Admin dashboard.
    Shows impressions, clicks, CTR, and performance indicators.
    """
    course_title = serializers.CharField(source='course.title', read_only=True)
    course_slug = serializers.CharField(source='course.slug', read_only=True)
    category = serializers.CharField(source='course.category.title', read_only=True)
    level = serializers.CharField(source='course.level', read_only=True)
    performance_indicator = serializers.SerializerMethodField()
    
    class Meta:
        model = api_models.CourseSearchAnalytics
        fields = [
            'id', 'course_title', 'course_slug', 'category', 'level',
            'search_impressions', 'search_clicks', 'click_through_rate',
            'performance_indicator', 'updated_at'
        ]
        read_only_fields = ['id', 'updated_at']
    
    def get_performance_indicator(self, obj):
        """Return performance status based on CTR"""
        if obj.search_impressions == 0:
            return 'HIDDEN'
        elif obj.click_through_rate >= 5.0:
            return 'HIGH'
        elif obj.click_through_rate >= 1.0:
            return 'NORMAL'
        else:
            return 'LOW'


class SearchQualityReportSerializer(serializers.Serializer):
    """Serialize comprehensive search quality report for dashboard"""
    total_courses = serializers.IntegerField()
    total_impressions = serializers.IntegerField()
    total_clicks = serializers.IntegerField()
    avg_impressions = serializers.FloatField()
    avg_clicks = serializers.FloatField()
    avg_ctr = serializers.FloatField()
    no_impression_courses = serializers.IntegerField()
    high_performers = serializers.IntegerField()
    low_performers = serializers.IntegerField()
    overall_ctr = serializers.FloatField()


class CTRDistributionSerializer(serializers.Serializer):
    """Serialize CTR distribution for histogram visualization"""
    range_0_1 = serializers.IntegerField()
    range_1_3 = serializers.IntegerField()
    range_3_5 = serializers.IntegerField()
    range_5_10 = serializers.IntegerField()
    range_10_plus = serializers.IntegerField()


class QualityRecommendationSerializer(serializers.Serializer):
    """Serialize quality recommendations"""
    priority = serializers.CharField()
    action = serializers.CharField()
    description = serializers.CharField()
    affected_count = serializers.IntegerField()


# ✨ PHASE 4.10 TIER 1.2: Search Query Taxonomy Serializers

class SearchQueryCategorySerializer(serializers.ModelSerializer):
    """Serialize search query categories"""
    category_type_display = serializers.CharField(source='get_category_type_display', read_only=True)
    
    class Meta:
        model = api_models.SearchQueryCategory
        fields = [
            'id', 'category_type', 'category_type_display', 'category_name',
            'query_patterns', 'description', 'trending', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class SearchQueryTaxonomySerializer(serializers.ModelSerializer):
    """Serialize individual search query taxonomy entries"""
    category_name = serializers.CharField(source='category.category_name', read_only=True)
    category_type = serializers.CharField(source='category.category_type', read_only=True)
    ctr_percent = serializers.SerializerMethodField()
    failed_rate_percent = serializers.SerializerMethodField()
    
    class Meta:
        model = api_models.SearchQueryTaxonomy
        fields = [
            'id', 'search_query', 'category', 'category_name', 'category_type',
            'search_count', 'click_through_count', 'failed_count', 'unique_users',
            'ctr_percent', 'failed_rate_percent', 'last_searched', 'created_at'
        ]
        read_only_fields = ['id', 'last_searched', 'created_at']
    
    def get_ctr_percent(self, obj):
        """Calculate CTR percentage"""
        if obj.search_count == 0:
            return 0.0
        return round((obj.click_through_count / obj.search_count) * 100, 2)
    
    def get_failed_rate_percent(self, obj):
        """Calculate failure rate percentage"""
        if obj.search_count == 0:
            return 0.0
        return round((obj.failed_count / obj.search_count) * 100, 2)


class SearchTaxonomyAnalyticsSerializer(serializers.ModelSerializer):
    """Serialize taxonomy analytics data"""
    category_name = serializers.CharField(source='category.category_name', read_only=True)
    category_type = serializers.CharField(source='category.category_type', read_only=True)
    performance_indicator = serializers.SerializerMethodField()
    
    class Meta:
        model = api_models.SearchTaxonomyAnalytics
        fields = ['id', 'category', 'category_name', 'category_type', 'performance_indicator']
    
    def get_performance_indicator(self, obj):
        """Return performance status"""
        return 'NORMAL'




# ✨ PHASE 4.78: Instructor Request Serializers
class InstructorRequestCreateSerializer(serializers.ModelSerializer):
    """
    ✨ PHASE 4.78: Serializer for creating instructor requests
    Student submits request with expertise areas, bio, and experience level
    Also returns rejection info if request was rejected
    """
    reviewed_by_name = serializers.CharField(
        source='reviewed_by.full_name', 
        read_only=True, 
        allow_null=True
    )
    
    class Meta:
        model = api_models.InstructorRequest
        fields = ['id', 'expertise_areas', 'bio', 'experience_level', 'request_date', 'status', 'rejection_reason', 'reviewed_date', 'reviewed_by_name']
        read_only_fields = ['id', 'request_date', 'status', 'rejection_reason', 'reviewed_date', 'reviewed_by_name']
    
    def create(self, validated_data):
        """Create new instructor request for current user or update rejected one
        
        ✨ PHASE 4.79: Handles both new submissions and reapplications
        - New submission: Creates new PENDING request
        - Reapplication: Updates existing REJECTED request back to PENDING
        """
        user = self.context['request'].user
        
        # Check if user can request
        can_request, reason = api_models.InstructorRequest.can_user_request(user)
        if not can_request:
            raise serializers.ValidationError(reason)
        
        # Get or create request (returns existing REJECTED or new instance)
        request_obj, created = api_models.InstructorRequest.get_or_create_for_user(user)
        
        # Update fields
        request_obj.expertise_areas = validated_data.get('expertise_areas', request_obj.expertise_areas)
        request_obj.bio = validated_data.get('bio', request_obj.bio)
        request_obj.experience_level = validated_data.get('experience_level', request_obj.experience_level)
        
        # If this is a reapplication (was rejected), reset to PENDING
        if request_obj.status == 'REJECTED':
            request_obj.status = 'PENDING'
            request_obj.rejection_reason = None  # Clear rejection reason
            request_obj.reviewed_by = None
            request_obj.reviewed_date = None
        
        # Set user if new
        if created:
            request_obj.user = user
        
        # Save and return
        request_obj.save()
        return request_obj


class InstructorRequestDetailSerializer(serializers.ModelSerializer):
    """
    ✨ PHASE 4.78: Detailed serializer for instructor requests
    Used for student to view their request status and admin to review
    ✨ PHASE X+6: Fixed user_image to return absolute URLs with cache busting
    """
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_image = serializers.SerializerMethodField(read_only=True)  # ✨ PHASE X+6: Convert relative paths to absolute URLs
    reviewed_by_name = serializers.CharField(
        source='reviewed_by.full_name', 
        read_only=True, 
        allow_null=True
    )
    
    def get_user_image(self, obj):
        """✨ PHASE X+6: Convert user profile image to absolute URL with cache busting"""
        if not obj.user:
            return None
        
        try:
            profile = Profile.objects.get(user=obj.user)
            if profile.image:
                image_str = str(profile.image)
                request = self.context.get('request')
                
                # Check if already absolute URL
                if image_str.startswith('http://') or image_str.startswith('https://'):
                    return image_str
                elif request:
                    # Convert relative path to absolute URL with cache-busting
                    if not image_str.startswith('/'):
                        image_str = f"/media/{image_str}"
                    from datetime import datetime
                    timestamp = int(datetime.now().timestamp() * 1000) // 3600000  # Cache-bust per hour
                    absolute_url = request.build_absolute_uri(image_str)
                    return f"{absolute_url}?v={timestamp}"
                else:
                    # Fallback if no request context
                    if not image_str.startswith('/'):
                        return f"/media/{image_str}"
                    return image_str
        except Profile.DoesNotExist:
            pass
        
        return None
    
    class Meta:
        model = api_models.InstructorRequest
        fields = [
            'id',
            'user_id', 'user_name', 'user_email', 'user_image',
            'expertise_areas', 'bio', 'experience_level',
            'request_date', 'status', 'rejection_reason',
            'reviewed_by_name', 'reviewed_date'
        ]
        read_only_fields = [
            'id', 'user_id', 'user_name', 'user_email', 'user_image',
            'request_date', 'status', 'rejection_reason',
            'reviewed_by_name', 'reviewed_date'
        ]


class AdminInstructorRequestListSerializer(serializers.ModelSerializer):
    """
    ✨ PHASE 4.78: Admin serializer for listing pending requests
    Includes all details needed for admin review
    ✨ PHASE X+6: Fixed user_image to return absolute URLs with cache busting
    """
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_image = serializers.SerializerMethodField(read_only=True)  # ✨ PHASE X+6: Convert relative paths to absolute URLs
    user_nip = serializers.CharField(source='user.nip', read_only=True, allow_null=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.full_name', read_only=True, allow_null=True)
    
    def get_user_image(self, obj):
        """✨ PHASE X+6: Convert user profile image to absolute URL with cache busting"""
        if not obj.user:
            return None
        
        try:
            profile = Profile.objects.get(user=obj.user)
            if profile.image:
                image_str = str(profile.image)
                request = self.context.get('request')
                
                # Check if already absolute URL
                if image_str.startswith('http://') or image_str.startswith('https://'):
                    return image_str
                elif request:
                    # Convert relative path to absolute URL with cache-busting
                    if not image_str.startswith('/'):
                        image_str = f"/media/{image_str}"
                    from datetime import datetime
                    timestamp = int(datetime.now().timestamp() * 1000) // 3600000  # Cache-bust per hour
                    absolute_url = request.build_absolute_uri(image_str)
                    return f"{absolute_url}?v={timestamp}"
                else:
                    # Fallback if no request context
                    if not image_str.startswith('/'):
                        return f"/media/{image_str}"
                    return image_str
        except Profile.DoesNotExist:
            pass
        
        return None
    
    class Meta:
        model = api_models.InstructorRequest
        fields = [
            'id',
            'user_id', 'user_name', 'user_email', 'user_image', 'user_nip',
            'expertise_areas', 'bio', 'experience_level',
            'request_date', 'status', 'rejection_reason',
            'reviewed_by', 'reviewed_by_name', 'reviewed_date'
        ]
        read_only_fields = [
            'id', 'user_id', 'user_name', 'user_email', 'user_image', 'user_nip',
            'request_date', 'reviewed_date'
        ]


class AdminInstructorRequestActionSerializer(serializers.Serializer):
    """
    ✨ PHASE 4.78: Serializer for admin approve/reject actions
    """
    action = serializers.ChoiceField(choices=['approve', 'reject'])
    rejection_reason = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=500,
        help_text="Required if action='reject'"
    )
    
    def validate(self, data):
        """Validate that rejection_reason is provided for reject action"""
        if data['action'] == 'reject' and not data.get('rejection_reason', '').strip():
            raise serializers.ValidationError({
                'rejection_reason': 'Alasan penolakan diperlukan saat menolak permintaan'
            })
        return data


class QueryTaxonomyReportSerializer(serializers.Serializer):
    """Serialize comprehensive query taxonomy report"""
    total_searches = serializers.IntegerField()
    unique_queries = serializers.IntegerField()
    unique_users = serializers.IntegerField()
    avg_ctr = serializers.FloatField()
    avg_failed_rate = serializers.FloatField()
    categories = SearchTaxonomyAnalyticsSerializer(many=True, read_only=True)


# ✨ PHASE 4.143: Lesson Completion Question Serializers

class LessonCompletionQuestionChoiceSerializer(serializers.ModelSerializer):
    """Serializer for completion question choices (multiple choice/multi-select)"""
    
    class Meta:
        model = api_models.LessonCompletionQuestionChoice
        fields = ['choice_id', 'choice_text', 'is_correct', 'order']
        read_only_fields = ['choice_id']


class LessonCompletionQuestionSerializer(serializers.ModelSerializer):
    """Serializer for lesson completion questions with nested choices"""
    choices = LessonCompletionQuestionChoiceSerializer(many=True, read_only=True)
    variant_item_title = serializers.CharField(source='variant_item.title', read_only=True)
    question_type_display = serializers.CharField(source='get_question_type_display', read_only=True)
    
    class Meta:
        model = api_models.LessonCompletionQuestion
        fields = [
            'question_id', 'question_text', 'question_type', 'question_type_display',
            'correct_answer_text', 'case_sensitive', 'choices', 'variant_item_title',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['question_id', 'created_at', 'updated_at']


class LessonCompletionQuestionCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating completion questions with choices data"""
    choices = LessonCompletionQuestionChoiceSerializer(many=True, required=False)
    
    class Meta:
        model = api_models.LessonCompletionQuestion
        fields = [
            'question_text', 'question_type', 'correct_answer_text', 'case_sensitive', 'choices'
        ]
    
    def create(self, validated_data):
        """Create question and associated choices"""
        choices_data = validated_data.pop('choices', [])
        question = api_models.LessonCompletionQuestion.objects.create(**validated_data)
        
        # Create choices if provided and question type is multiple choice/multi-select
        if question.question_type in ['multiple_choice', 'multi_select'] and choices_data:
            for choice_data in choices_data:
                api_models.LessonCompletionQuestionChoice.objects.create(
                    question=question,
                    **choice_data
                )
        
        return question
    
    def update(self, instance, validated_data):
        """Update question and choices"""
        choices_data = validated_data.pop('choices', None)
        
        # Update question fields
        instance.question_text = validated_data.get('question_text', instance.question_text)
        instance.question_type = validated_data.get('question_type', instance.question_type)
        instance.correct_answer_text = validated_data.get('correct_answer_text', instance.correct_answer_text)
        instance.case_sensitive = validated_data.get('case_sensitive', instance.case_sensitive)
        instance.save()
        
        # Update choices if provided
        if choices_data is not None:
            # Delete old choices
            instance.choices.all().delete()
            
            # Create new choices
            if instance.question_type in ['multiple_choice', 'multi_select']:
                for choice_data in choices_data:
                    api_models.LessonCompletionQuestionChoice.objects.create(
                        question=instance,
                        **choice_data
                    )
        
        return instance


# ✨ PHASE 11.198: Student's Answer to Completion Question Serializer
class LessonCompletionQuestionAnswerSerializer(serializers.ModelSerializer):
    """Serializer for storing student's answer to lesson completion questions"""
    question_text = serializers.CharField(source='question.question_text', read_only=True)
    question_type = serializers.CharField(source='question.question_type', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    answer_choice_text = serializers.CharField(source='answer_choice.choice_text', read_only=True, allow_null=True)
    answer_choices_text = serializers.SerializerMethodField()
    
    class Meta:
        model = api_models.LessonCompletionQuestionAnswer
        fields = [
            'id', 'user', 'username', 'question', 'question_text', 'question_type',
            'answer_choice', 'answer_choice_text', 'answer_choices', 'answer_choices_text',
            'answer_text', 'is_correct', 'answered_at'
        ]
        read_only_fields = ['id', 'user', 'username', 'answered_at']
    
    def get_answer_choices_text(self, obj):
        """Get text of all selected choices for multi_select questions"""
        return [choice.choice_text for choice in obj.answer_choices.all()]


# ✨ PHASE 7.7: Question Answer Serializers
# ✨ Minimal Variant Serializer for Q&A thread display (Bagian)
class MinimalVariantSerializer(serializers.ModelSerializer):
    """Minimal variant serializer for Q&A display"""
    class Meta:
        model = api_models.Variant
        fields = ['variant_id', 'title']


# ✨ Minimal VariantItem Serializer for Q&A thread display (Pelajaran)
class MinimalVariantItemSerializer(serializers.ModelSerializer):
    """Minimal variant item serializer for Q&A display"""
    class Meta:
        model = api_models.VariantItem
        fields = ['variant_item_id', 'title']


# ✨ Question Answer Message Serializer (moved before Question_AnswerSerializer for dependencies)
class Question_Answer_MessageSerializer(serializers.ModelSerializer):
    """Serializer for Q&A replies/messages"""
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    profile = serializers.SerializerMethodField(read_only=True)
    likes_count = serializers.SerializerMethodField(read_only=True)
    user_liked = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = api_models.Question_Answer_Message
        fields = ['id', 'qam_id', 'qa_id', 'question', 'message', 'user', 'user_id', 'profile', 'date', 'likes_count', 'user_liked', 'is_solution', 'file', 'file_name']
        read_only_fields = ['id', 'qam_id', 'qa_id', 'date']
    
    def get_profile(self, obj):
        """Get user profile with all details"""
        try:
            if obj.user:
                profile = getattr(obj.user, 'profile', None)
                image_url = None
                if profile and profile.image:
                    try:
                        image_url = profile.image.url
                    except Exception:
                        raw_name = getattr(profile.image, 'name', '') or str(profile.image)
                        if raw_name:
                            image_url = f"/media/{raw_name}" if not raw_name.startswith(('/media/', 'http://', 'https://')) else raw_name
                
                request = self.context.get('request')
                if request and image_url and not image_url.startswith(('http://', 'https://')):
                    image_url = request.build_absolute_uri(image_url)

                return {
                    'user_id': obj.user.id,
                    'full_name': obj.user.full_name or 'Anonim',
                    'image': image_url,
                    'position_name': profile.position.name if profile and profile.position else None,
                    'organization_unit_name': profile.organization_unit.name if profile and profile.organization_unit else None,
                    'country': profile.country if profile else None,
                    'is_staff': bool(obj.user.is_staff or obj.user.is_superuser) if obj.user else False,
                }
        except:
            pass
        return {
            'user_id': obj.user.id if obj.user else None,
            'full_name': obj.user.full_name if obj.user else 'Anonim',
            'image': None,
            'position_name': None,
            'organization_unit_name': None,
            'country': None,
            'is_staff': bool(obj.user.is_staff or obj.user.is_superuser) if obj.user else False,
        }
    
    def get_likes_count(self, obj):
        """Count total likes on this message"""
        return api_models.Question_Answer_Message_Like.objects.filter(message=obj).count()
    
    def get_user_liked(self, obj):
        """Check if current user has liked this message"""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return api_models.Question_Answer_Message_Like.objects.filter(
                message=obj, user=request.user
            ).exists()
        return False


# ✨ Expanded Question Answer Serializer with all forum data
class Question_AnswerSerializer(serializers.ModelSerializer):
    """Serializer for Q&A questions with full replies, variant context, and user profile"""
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    
    # ✨ PHASE N.X FIX: Return course_id (ShortUUID string) instead of integer PK
    # Frontend filters questions by matching course_id, not the Django PK
    course = serializers.CharField(source='course.course_id', read_only=True)
    
    # User profile data (not just name)
    profile = serializers.SerializerMethodField(read_only=True)
    
    # Variant context (Bagian/Pelajaran)
    variant = serializers.SerializerMethodField(read_only=True)
    variant_item = MinimalVariantItemSerializer(read_only=True)
    
    # Messages/replies (all responses to this question)
    messages = serializers.SerializerMethodField(read_only=True)
    
    # ✨ PHASE 7.26: Reply count (excluding original message)
    replies_count = serializers.SerializerMethodField(read_only=True)
    
    # Like metadata
    likes_count = serializers.SerializerMethodField(read_only=True)
    user_liked = serializers.SerializerMethodField(read_only=True)
    
    # Course Context (For Forum & Aggregated QA feeds)
    course_title = serializers.CharField(source='course.title', read_only=True)
    course_slug = serializers.CharField(source='course.slug', read_only=True)
    course_pk = serializers.IntegerField(source='course.id', read_only=True)
    course_image = serializers.SerializerMethodField(read_only=True)
    enrollment_id = serializers.SerializerMethodField(read_only=True)
    user_enrolled = serializers.SerializerMethodField(read_only=True)

    # Solved & Instructor status
    has_instructor_reply = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = api_models.Question_Answer
        fields = [
            'id', 'qa_id', 'course', 'course_title', 'course_slug', 'course_pk', 'course_image',
            'enrollment_id', 'user_enrolled',
            'title', 'user', 'user_id',
            'profile', 'variant', 'variant_item',
            'date', 'messages', 'replies_count', 'likes_count', 'user_liked',
            'is_solved', 'has_instructor_reply', 'video_timestamp', 'is_pinned',
            'file', 'file_name'
        ]
        read_only_fields = ['id', 'qa_id', 'date', 'messages', 'replies_count', 'has_instructor_reply', 'enrollment_id', 'user_enrolled']

    def get_enrollment_id(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            try:
                enr = api_models.EnrolledCourse.objects.filter(
                    user=request.user,
                    course=obj.course
                ).first()
                if enr:
                    return enr.enrollment_id
            except Exception:
                pass
        return None

    def get_user_enrolled(self, obj):
        return bool(self.get_enrollment_id(obj))
    
    def get_course_image(self, obj):
        try:
            if obj.course and obj.course.image:
                return str(obj.course.image)
        except Exception:
            pass
        return None
    
    def get_profile(self, obj):
        """Get user profile with all details"""
        try:
            if obj.user:
                profile = getattr(obj.user, 'profile', None)
                image_url = None
                if profile and profile.image:
                    try:
                        image_url = profile.image.url
                    except Exception:
                        raw_name = getattr(profile.image, 'name', '') or str(profile.image)
                        if raw_name:
                            image_url = f"/media/{raw_name}" if not raw_name.startswith(('/media/', 'http://', 'https://')) else raw_name
                
                request = self.context.get('request')
                if request and image_url and not image_url.startswith(('http://', 'https://')):
                    image_url = request.build_absolute_uri(image_url)

                return {
                    'user_id': obj.user.id,
                    'full_name': obj.user.full_name or 'Anonim',
                    'image': image_url,
                    'position_name': profile.position.name if profile and profile.position else None,
                    'organization_unit_name': profile.organization_unit.name if profile and profile.organization_unit else None,
                    'country': profile.country if profile else None,
                    'is_staff': bool(obj.user.is_staff or obj.user.is_superuser) if obj.user else False,
                }
        except:
            pass
        return {
            'user_id': obj.user.id if obj.user else None,
            'full_name': obj.user.full_name if obj.user else 'Anonim',
            'image': None,
            'position_name': None,
            'organization_unit_name': None,
            'country': None,
            'is_staff': bool(obj.user.is_staff or obj.user.is_superuser) if obj.user else False,
        }
    
    def get_variant(self, obj):
        """Get Bagian (section) from variant_item.variant"""
        try:
            if obj.variant_item and obj.variant_item.variant:
                return {
                    'variant_id': obj.variant_item.variant.variant_id,
                    'title': obj.variant_item.variant.title
                }
        except:
            pass
        return None
    
    def get_messages(self, obj):
        """Get all replies/messages for this question"""
        messages = obj.reply_messages.all().order_by('date')
        serializer = Question_Answer_MessageSerializer(messages, many=True, context=self.context)
        return serializer.data
    
    def get_replies_count(self, obj):
        """Count only actual replies (excluding original question message)
        
        When a question is created, a Question_Answer_Message is created along with it.
        This original message is the first message and should NOT be counted as a "reply".
        replies_count = total messages - 1 (the original message)
        """
        total_messages = obj.reply_messages.all().count()
        # Subtract 1 to exclude the original message
        replies_count = max(0, total_messages - 1)
        return replies_count
    
    def get_likes_count(self, obj):
        """Count total likes on this question"""
        return api_models.Question_Answer_Like.objects.filter(question=obj).count()
    
    def get_user_liked(self, obj):
        """Check if current user has liked this question"""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return api_models.Question_Answer_Like.objects.filter(
                question=obj, user=request.user
            ).exists()
        return False

    def get_has_instructor_reply(self, obj):
        """Check if any reply in this thread was posted by the course instructor"""
        try:
            teacher_user_id = obj.course.teacher.user_id if obj.course and obj.course.teacher else None
            if not teacher_user_id:
                return False
            messages = list(obj.reply_messages.all().order_by('date'))
            if len(messages) > 1:
                return any(m.user_id == teacher_user_id for m in messages[1:])
        except Exception:
            pass
        return False


# ✨ PHASE 11.1: Feedback System Serializers
# NOTE: Feedback model not currently implemented
# These serializers are commented out until the Feedback model is added to models.py
#

# ✨ PHASE 11.1: Feedback System Serializers
class FeedbackListSerializer(serializers.ModelSerializer):
    """Serializer for listing feedback items (admin dashboard)"""
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_role = serializers.SerializerMethodField()
    course_title = serializers.CharField(source='related_course.title', read_only=True, allow_null=True)
    assigned_to_name = serializers.CharField(source='assigned_to.full_name', read_only=True, allow_null=True)
    
    class Meta:
        model = api_models.Feedback
        fields = [
            'id',
            'feedback_type',
            'title',
            'description',
            'status',
            'priority',
            'user_name',
            'user_role',
            'course_title',
            'affected_area',
            'assigned_to_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields
    
    def get_user_role(self, obj):
        """Get user role"""
        return obj.get_user_role()


class FeedbackDetailSerializer(serializers.ModelSerializer):
    """Serializer for detailed feedback view/editing"""
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_role = serializers.SerializerMethodField()
    course_title = serializers.CharField(source='related_course.title', read_only=True, allow_null=True)
    assigned_to_name = serializers.CharField(source='assigned_to.full_name', read_only=True, allow_null=True)
    
    class Meta:
        model = api_models.Feedback
        fields = [
            'id',
            'feedback_type',
            'title',
            'description',
            'status',
            'priority',
            'related_course',
            'course_title',
            'related_url',
            'affected_area',
            'attachments',
            'admin_notes',
            'assigned_to',
            'assigned_to_name',
            'user_name',
            'user_email',
            'user_role',
            'created_at',
            'updated_at',
            'resolved_at',
        ]
        read_only_fields = [
            'id',
            'created_at',
            'updated_at',
            'user_name',
            'user_email',
            'user_role',
            'course_title',
            'assigned_to_name',
        ]
    
    def get_user_role(self, obj):
        """Get user role"""
        return obj.get_user_role()


class FeedbackCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating feedback (user submission)"""
    
    class Meta:
        model = api_models.Feedback
        fields = [
            'id',
            'feedback_type',
            'title',
            'description',
            'related_course',
            'related_url',
            'affected_area',
            'attachments',
        ]
        read_only_fields = ['id']
    
    def validate_title(self, value):
        """Validate title is provided and not too short"""
        if not value or len(value.strip()) < 3:
            raise serializers.ValidationError("Title must be at least 3 characters long.")
        return value
    
    def validate_description(self, value):
        """Validate description is provided and not too short"""
        if not value or len(value.strip()) < 10:
            raise serializers.ValidationError("Description must be at least 10 characters long.")
        return value
    
    def create(self, validated_data):
        """Create feedback with current user and capture role at submission time
        ✨ PHASE 11.2: Store user role at submission to prevent changes from affecting past feedback
        """
        request = self.context.get('request')
        validated_data['user'] = request.user
        
        # ✨ PHASE 11.2: Capture the user's current role at submission time (immutable)
        if request.user:
            # Prefer current_role (active session role at submission time)
            if hasattr(request.user, 'current_role') and request.user.current_role:
                validated_data['user_role_at_submission'] = request.user.current_role
            # Fallback to role field
            elif hasattr(request.user, 'role') and request.user.role:
                validated_data['user_role_at_submission'] = request.user.role
            else:
                validated_data['user_role_at_submission'] = 'student'  # Default
        
        return super().create(validated_data)


class FeedbackUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating feedback (admin only)"""
    
    class Meta:
        model = api_models.Feedback
        fields = [
            'status',
            'priority',
            'admin_notes',
            'assigned_to',
            'resolved_at',
        ]


class FeedbackStatsSerializer(serializers.Serializer):
    """Serializer for feedback statistics"""
    total_feedback = serializers.IntegerField()
    open_count = serializers.IntegerField()
    in_progress_count = serializers.IntegerField()
    resolved_count = serializers.IntegerField()
    bug_reports = serializers.IntegerField()
    feature_requests = serializers.IntegerField()
    critical_priority = serializers.IntegerField()
    high_priority = serializers.IntegerField()
    avg_resolution_time_days = serializers.FloatField(allow_null=True)


# ✨ PHASE 10.1: Ranking System Serializers

class RankedStudentSerializer(serializers.Serializer):
    """
    Serializer for ranking students by points.
    Includes user profile info and ranking badges without exposing sensitive data.
    ✨ PHASE 11.10: Fixed image URL handling - returns absolute URLs with cache-busting
    """
    id = serializers.SerializerMethodField()
    user_id = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    position_name = serializers.SerializerMethodField()
    organization_unit_name = serializers.SerializerMethodField()
    country = serializers.SerializerMethodField()
    lifetime_points = serializers.IntegerField()
    yearly_points = serializers.SerializerMethodField()
    monthly_points = serializers.SerializerMethodField()
    rank = serializers.SerializerMethodField()
    rank_position = serializers.SerializerMethodField()
    manta_level = serializers.SerializerMethodField()
    manta_level_name = serializers.SerializerMethodField()
    manta_level_color = serializers.SerializerMethodField()
    manta_level_icon = serializers.SerializerMethodField()
    
    def _get_level_info(self, obj):
        pts = getattr(obj, 'lifetime_points', 0) or 0
        if pts < 250:
            return 1, "Aparatur Pratama", "#10b981", "fas fa-seedling"
        elif pts < 600:
            return 2, "Aparatur Muda", "#0ea5e9", "fas fa-shield-halved"
        elif pts < 1200:
            return 3, "Aparatur Madya", "#6366f1", "fas fa-gem"
        elif pts < 2500:
            return 4, "Aparatur Utama", "#8b5cf6", "fas fa-medal"
        elif pts < 4500:
            return 5, "Ksatria Parlemen", "#f59e0b", "fas fa-crown"
        else:
            return 6, "Pakar Reformasi Birokrasi", "#eab308", "fas fa-trophy"

    def get_manta_level(self, obj):
        return self._get_level_info(obj)[0]

    def get_manta_level_name(self, obj):
        return self._get_level_info(obj)[1]

    def get_manta_level_color(self, obj):
        return self._get_level_info(obj)[2]

    def get_manta_level_icon(self, obj):
        return self._get_level_info(obj)[3]
    
    def get_yearly_points(self, obj):
        from django.utils import timezone
        now = timezone.now()
        if getattr(obj, 'yearly_year', 0) == now.year:
            return obj.yearly_points
        return 0

    def get_monthly_points(self, obj):
        from django.utils import timezone
        now = timezone.now()
        if getattr(obj, 'monthly_year', 0) == now.year and getattr(obj, 'monthly_month', 0) == now.month:
            return obj.monthly_points
        return 0
    
    def get_id(self, obj):
        return obj.id
    
    def get_user_id(self, obj):
        return obj.user.id if obj.user else None
    
    def get_full_name(self, obj):
        return obj.user.full_name if obj.user else "Unknown"
    
    def get_image(self, obj):
        """
        Get image from Profile.
        Returns relative path which will be converted to absolute URL in to_representation.
        """
        try:
            # Check Profile.image
            if obj.user and hasattr(obj.user, 'profile') and obj.user.profile and obj.user.profile.image:
                return str(obj.user.profile.image)
        except Exception as e:
            pass
        
        return None
    
    def to_representation(self, instance):
        """
        ✨ PHASE 11.10: Convert relative image URLs to absolute URLs
        Also applies cache-busting for image reloads
        """
        representation = super().to_representation(instance)
        
        # Handle image URL - convert to absolute URL
        if representation.get('image'):
            image_url = representation['image']
            request = self.context.get('request')
            
            try:
                # If already a full URL, return as-is
                if image_url.startswith('http://') or image_url.startswith('https://'):
                    representation['image'] = image_url
                # If relative path, make it absolute
                elif request:
                    # Ensure /media/ prefix for relative paths
                    if not image_url.startswith('/'):
                        image_url = f"/media/{image_url}"
                    # Add cache-busting timestamp to force fresh image loads
                    from datetime import datetime
                    timestamp = int(datetime.now().timestamp() * 1000) // 3600000  # Cache-bust per hour
                    absolute_url = request.build_absolute_uri(image_url)
                    representation['image'] = f"{absolute_url}?v={timestamp}"
                else:
                    # Fallback if no request context
                    if not image_url.startswith('/'):
                        representation['image'] = f"/media/{image_url}"
            except Exception as e:
                # If any error, keep image as-is
                pass
        
        return representation
    
    def get_position_name(self, obj):
        try:
            if obj.user and hasattr(obj.user, 'profile') and obj.user.profile and obj.user.profile.position:
                return getattr(obj.user.profile.position, 'name', None) or getattr(obj.user.profile.position, 'title', None) or str(obj.user.profile.position)
        except:
            pass
        return None
    
    def get_organization_unit_name(self, obj):
        try:
            if obj.user and hasattr(obj.user, 'profile') and obj.user.profile and obj.user.profile.organization_unit:
                return obj.user.profile.organization_unit.name
        except:
            pass
        return None
    
    def get_country(self, obj):
        try:
            if obj.user and hasattr(obj.user, 'profile') and obj.user.profile:
                return obj.user.profile.country
        except:
            pass
        return None
    
    def get_rank(self, obj):
        """Get rank badge emoji based on position"""
        position = getattr(self, '_rank_position', None)
        if position == 1:
            return "🥇"
        elif position == 2:
            return "🥈"
        elif position == 3:
            return "🥉"
        return None
    
    def get_rank_position(self, obj):
        """Get rank position (1-based)"""
        request = self.context.get('request')
        if not request:
            return 1
        
        # Store in context for use by get_rank()
        if not hasattr(self, '_rank_position'):
            self._rank_position = 1
        
        return getattr(self, '_rank_position', 1)
    
    class Meta:
        fields = [
            'id', 'user_id', 'full_name', 'image', 'position_name',
            'organization_unit_name', 'country', 'lifetime_points',
            'yearly_points', 'monthly_points', 'rank', 'rank_position'
        ]


class RankedInstructorSerializer(serializers.Serializer):
    """
    Serializer for ranking instructors by points.
    Includes user profile info and ranking badges without exposing sensitive data.
    ✨ PHASE 11.10: Fixed image URL handling - returns absolute URLs with cache-busting
    """
    id = serializers.SerializerMethodField()
    user_id = serializers.SerializerMethodField()
    teacher_id = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    position_name = serializers.SerializerMethodField()
    organization_unit_name = serializers.SerializerMethodField()
    country = serializers.SerializerMethodField()
    lifetime_points = serializers.IntegerField()
    yearly_points = serializers.SerializerMethodField()
    monthly_points = serializers.SerializerMethodField()
    rank = serializers.SerializerMethodField()
    rank_position = serializers.SerializerMethodField()
    
    def get_teacher_id(self, obj):
        if getattr(obj, 'teacher', None):
            return obj.teacher.id
        if obj.user and hasattr(obj.user, 'teacher') and obj.user.teacher:
            return obj.user.teacher.id
        return None
    
    def get_yearly_points(self, obj):
        from django.utils import timezone
        now = timezone.now()
        if getattr(obj, 'yearly_year', 0) == now.year:
            return obj.yearly_points
        return 0

    def get_monthly_points(self, obj):
        from django.utils import timezone
        now = timezone.now()
        if getattr(obj, 'monthly_year', 0) == now.year and getattr(obj, 'monthly_month', 0) == now.month:
            return obj.monthly_points
        return 0
    
    def get_id(self, obj):
        return obj.id
    
    def get_user_id(self, obj):
        return obj.user.id if obj.user else None
    
    def get_full_name(self, obj):
        return obj.user.full_name if obj.user else "Unknown"
    
    def get_image(self, obj):
        """
        Get image from Profile or Teacher model.
        Returns relative path which will be converted to absolute URL in to_representation.
        ✨ PHASE 11.10: Check both Profile and Teacher image sources
        """
        try:
            # Check Profile.image first (user uploads via profile endpoints)
            if obj.user and hasattr(obj.user, 'profile') and obj.user.profile and obj.user.profile.image:
                return str(obj.user.profile.image)
            
            # Fallback to Teacher.image (instructor might upload via teacher endpoints)
            if obj.teacher and obj.teacher.image:
                return str(obj.teacher.image)
            
            # Also check User -> Teacher relationship
            if obj.user and hasattr(obj.user, 'teacher') and obj.user.teacher and obj.user.teacher.image:
                return str(obj.user.teacher.image)
        except Exception as e:
            pass
        
        return None
    
    def to_representation(self, instance):
        """
        ✨ PHASE 11.10: Convert relative image URLs to absolute URLs
        Also applies cache-busting for image reloads
        """
        representation = super().to_representation(instance)
        
        # Handle image URL - convert to absolute URL
        if representation.get('image'):
            image_url = representation['image']
            request = self.context.get('request')
            
            try:
                # If already a full URL, return as-is
                if image_url.startswith('http://') or image_url.startswith('https://'):
                    representation['image'] = image_url
                # If relative path, make it absolute
                elif request:
                    # Ensure /media/ prefix for relative paths
                    if not image_url.startswith('/'):
                        image_url = f"/media/{image_url}"
                    # Add cache-busting timestamp to force fresh image loads
                    from datetime import datetime
                    timestamp = int(datetime.now().timestamp() * 1000) // 3600000  # Cache-bust per hour
                    absolute_url = request.build_absolute_uri(image_url)
                    representation['image'] = f"{absolute_url}?v={timestamp}"
                else:
                    # Fallback if no request context
                    if not image_url.startswith('/'):
                        representation['image'] = f"/media/{image_url}"
            except Exception as e:
                # If any error, keep image as-is
                pass
        
        return representation
    
    def get_position_name(self, obj):
        try:
            if obj.user and hasattr(obj.user, 'profile') and obj.user.profile and obj.user.profile.position:
                return getattr(obj.user.profile.position, 'name', None) or getattr(obj.user.profile.position, 'title', None) or str(obj.user.profile.position)
        except:
            pass
        return None
    
    def get_organization_unit_name(self, obj):
        try:
            if obj.user and hasattr(obj.user, 'profile') and obj.user.profile and obj.user.profile.organization_unit:
                return obj.user.profile.organization_unit.name
        except:
            pass
        return None
    
    def get_country(self, obj):
        try:
            if obj.user and hasattr(obj.user, 'profile') and obj.user.profile:
                return obj.user.profile.country
        except:
            pass
        return None
    
    def get_rank(self, obj):
        """Get rank badge emoji based on position"""
        position = getattr(self, '_rank_position', None)
        if position == 1:
            return "🥇"
        elif position == 2:
            return "🥈"
        elif position == 3:
            return "🥉"
        return None
    
    def get_rank_position(self, obj):
        """Get rank position (1-based)"""
        if not hasattr(self, '_rank_position'):
            self._rank_position = 1
        
        return getattr(self, '_rank_position', 1)
    
    class Meta:
        fields = [
            'id', 'user_id', 'full_name', 'image', 'position_name',
            'organization_unit_name', 'country', 'lifetime_points',
            'yearly_points', 'monthly_points', 'rank', 'rank_position'
        ]


# ==================== PHASE 53: ACTIVITY LOG SERIALIZERS ====================

class ActivityLogSerializer(serializers.ModelSerializer):
    """✨ PHASE 53: Serializer for ActivityLog with related object details"""
    activity_type_display = serializers.CharField(source='get_activity_type_display', read_only=True)
    role_display = serializers.CharField(source='get_role_at_time_display', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True, allow_null=True)
    lesson_title = serializers.CharField(source='lesson.title', read_only=True, allow_null=True)
    quiz_title = serializers.CharField(source='quiz.title', read_only=True, allow_null=True)
    
    class Meta:
        model = api_models.ActivityLog
        fields = [
            'id', 'user', 'user_name', 'activity_type', 'activity_type_display',
            'role_at_time', 'role_display', 'course', 'course_title',
            'lesson', 'lesson_title', 'quiz', 'quiz_title',
            'title', 'description', 'metadata', 'duration_seconds',
            'points_awarded', 'success', 'is_verified', 'activity_score',
            'created_at', 'updated_at', 'activity_date', 'related_content_id'
        ]
        read_only_fields = [
            'id', 'user_name', 'course_title', 'lesson_title', 'quiz_title',
            'activity_type_display', 'role_display', 'activity_score',
            'created_at', 'updated_at'
        ]


class ActivityLogListSerializer(serializers.ModelSerializer):
    """✨ PHASE 53: Lightweight serializer for activity list views (Dashboard)"""
    activity_type_display = serializers.CharField(source='get_activity_type_display', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True, allow_null=True)
    
    class Meta:
        model = api_models.ActivityLog
        fields = [
            'id', 'user', 'user_name', 'activity_type', 'activity_type_display',
            'title', 'description', 'course', 'course_title',
            'points_awarded', 'success', 'activity_score',
            'activity_date', 'created_at', 'role_at_time'
        ]


class ActivityFilterSerializer(serializers.ModelSerializer):
    """✨ PHASE 53: Serializer for ActivityFilter user preferences"""
    
    class Meta:
        model = api_models.ActivityFilter
        fields = [
            'id', 'user', 'activity_types', 'include_system_activities',
            'include_failed_activities', 'max_activities_display',
            'sort_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']


class ActivityAggregateSerializer(serializers.ModelSerializer):
    """✨ PHASE 53: Serializer for ActivityAggregate analytics data"""
    activity_type_display = serializers.CharField(source='get_activity_type_display', read_only=True)
    
    class Meta:
        model = api_models.ActivityAggregate
        fields = [
            'id', 'date', 'period', 'user', 'course',
            'activity_type', 'activity_type_display', 'count', 'total_points',
            'total_duration_seconds', 'success_rate', 'updated_at'
        ]
        read_only_fields = ['id', 'updated_at']


class ActivityStatsSerializer(serializers.Serializer):
    """✨ PHASE 53: Serializer for user activity statistics"""
    total_activities = serializers.IntegerField()
    activities_this_week = serializers.IntegerField()
    activities_this_month = serializers.IntegerField()
    points_earned = serializers.IntegerField()
    most_active_course = serializers.SerializerMethodField()
    top_activity_types = serializers.ListField(child=serializers.DictField())
    recent_activities = ActivityLogListSerializer(many=True, read_only=True)
    
    def get_most_active_course(self, obj):
        """Get the course with most activity"""
        if obj.get('most_active_course'):
            course = obj['most_active_course']
            return {
                'id': course.id,
                'title': course.title,
                'activity_count': obj.get('course_activity_count', 0)
            }
        return None


class InstructorActivityStatsSerializer(serializers.Serializer):
    """✨ PHASE 53: Serializer for instructor dashboard activity metrics"""
    total_student_activities = serializers.IntegerField()
    activities_this_week = serializers.IntegerField()
    avg_engagement_score = serializers.FloatField()
    students_active_today = serializers.IntegerField()
    completion_rate = serializers.FloatField()
    course_activity_breakdown = serializers.ListField(child=serializers.DictField())
    recent_student_activities = ActivityLogListSerializer(many=True, read_only=True)


# =====================================================================
# Gamification Serializers: CourseGame & CourseGameAttempt
# =====================================================================

class CourseGameSerializer(serializers.ModelSerializer):
    course_id = serializers.SerializerMethodField()
    course_title = serializers.SerializerMethodField()
    user_attempts_count = serializers.SerializerMethodField()
    user_best_score = serializers.SerializerMethodField()
    user_can_attempt = serializers.SerializerMethodField()
    user_is_passed = serializers.SerializerMethodField()
    attempts = serializers.SerializerMethodField()
    
    class Meta:
        model = api_models.CourseGame
        fields = [
            'game_id', 'title', 'description', 'game_type', 'game_data',
            'max_attempts', 'points_reward', 'time_limit_seconds',
            'is_active', 'order', 'date', 'course_id', 'course_title',
            'user_attempts_count', 'user_best_score', 'user_can_attempt',
            'user_is_passed', 'attempts'
        ]

    def _get_user(self):
        user = self.context.get('user')
        if user and user.is_authenticated:
            return user
        current_user = self.context.get('current_user')
        if current_user and current_user.is_authenticated:
            return current_user
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user and request.user.is_authenticated:
            return request.user
        return None

    def get_course_id(self, obj):
        return obj.course.course_id if obj.course else None

    def get_course_title(self, obj):
        return obj.course.title if obj.course else None

    def get_user_attempts_count(self, obj):
        user = self._get_user()
        if user:
            return obj.get_user_attempts_count(user)
        return 0

    def get_user_best_score(self, obj):
        user = self._get_user()
        if user:
            best = obj.get_user_best_attempt(user)
            return float(best.score) if best else 0
        return 0

    def get_user_can_attempt(self, obj):
        user = self._get_user()
        if user:
            return obj.can_user_attempt(user)
        return True

    def get_user_is_passed(self, obj):
        user = self._get_user()
        if user:
            return obj.attempts.filter(user=user, is_passed=True).exists()
        return False

    def get_attempts(self, obj):
        user = self._get_user()
        if user:
            user_attempts = obj.attempts.filter(user=user).order_by('attempt_number')
            return CourseGameAttemptSerializer(user_attempts, many=True).data
        return []


class CourseGameAttemptSerializer(serializers.ModelSerializer):
    game_title = serializers.SerializerMethodField()
    game_type = serializers.SerializerMethodField()
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = api_models.CourseGameAttempt
        fields = [
            'attempt_id', 'game', 'game_title', 'game_type', 'attempt_number',
            'score', 'is_passed', 'time_taken', 'answers_data', 'points_awarded',
            'date_attempted', 'user_name'
        ]
        read_only_fields = ['attempt_id', 'date_attempted', 'points_awarded']

    def get_game_title(self, obj):
        return obj.game.title if obj.game else None

    def get_game_type(self, obj):
        return obj.game.game_type if obj.game else None

    def get_user_name(self, obj):
        return obj.user.full_name or obj.user.username if obj.user else None


class SystemReleaseSerializer(serializers.ModelSerializer):
    """
    ✨ Serializer for System Releases & Update Logs
    """
    created_by_name = serializers.SerializerMethodField()
    version_type_display = serializers.CharField(source='get_version_type_display', read_only=True)

    class Meta:
        model = api_models.SystemRelease
        fields = [
            'id',
            'version',
            'title',
            'version_type',
            'version_type_display',
            'release_date',
            'is_current',
            'summary',
            'changes',
            'raw_notes',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'version_type_display']

    def get_created_by_name(self, obj):
        if obj.created_by:
            name = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
            return name or obj.created_by.username
        return "Tim Pengembang DPD RI"


# =====================================================================
# 🎮 MantaType Arcade Typing Game Serializers
# =====================================================================

class MantaTypeSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = api_models.MantaTypeSetting
        fields = '__all__'


class MantaTypeWordSerializer(serializers.ModelSerializer):
    difficulty_display = serializers.CharField(source='get_difficulty_display', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = api_models.MantaTypeWord
        fields = [
            'id',
            'word',
            'difficulty',
            'difficulty_display',
            'category',
            'category_display',
            'meaning',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'difficulty_display', 'category_display']


class MantaTypeDailyRewardSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = api_models.MantaTypeDailyReward
        fields = [
            'id',
            'user',
            'user_name',
            'username',
            'claim_date',
            'points_awarded',
            'score',
            'words_typed',
            'accuracy',
            'wpm',
            'wave_reached',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'claim_date', 'user_name', 'username']


# ============================================================================
# FORUM PEMBELAJARAN SERIALIZERS
# ============================================================================

class ForumCategorySerializer(serializers.ModelSerializer):
    topics_count = serializers.IntegerField(read_only=True)
    posts_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = api_models.ForumCategory
        fields = [
            'id',
            'name',
            'slug',
            'description',
            'icon',
            'badge_color',
            'order',
            'is_active',
            'topics_count',
            'posts_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'topics_count', 'posts_count']

    def create(self, validated_data):
        from django.utils.text import slugify
        if not validated_data.get('slug'):
            base_slug = slugify(validated_data.get('name', 'rumpun'))
            slug = base_slug
            counter = 1
            while api_models.ForumCategory.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            validated_data['slug'] = slug
        return super().create(validated_data)


class ForumTopicMessageSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    profile = serializers.SerializerMethodField(read_only=True)
    likes_count = serializers.IntegerField(read_only=True)
    user_liked = serializers.SerializerMethodField(read_only=True)
    user_report = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = api_models.ForumTopicMessage
        fields = [
            'id',
            'message_id',
            'topic',
            'user',
            'user_id',
            'profile',
            'message',
            'is_solution',
            'file',
            'file_name',
            'likes_count',
            'user_liked',
            'user_report',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'message_id', 'created_at', 'updated_at', 'likes_count', 'user_liked', 'user_report', 'profile']

    def get_profile(self, obj):
        try:
            if obj.user:
                profile = getattr(obj.user, 'profile', None)
                image_url = None
                if profile and profile.image:
                    try:
                        image_url = profile.image.url
                    except Exception:
                        raw_name = getattr(profile.image, 'name', '') or str(profile.image)
                        if raw_name:
                            image_url = f"/media/{raw_name}" if not raw_name.startswith(('/media/', 'http://', 'https://')) else raw_name
                
                request = self.context.get('request')
                if request and image_url and not image_url.startswith(('http://', 'https://')):
                    image_url = request.build_absolute_uri(image_url)

                is_internal = bool(
                    getattr(obj.user, 'is_internal', False) or 
                    getattr(obj.user, 'user_type', '') == 'INTERNAL' or 
                    obj.user.is_staff or 
                    obj.user.is_superuser or 
                    (obj.user.email and obj.user.email.lower().endswith('@dpd.go.id'))
                )

                role_badges = []
                if obj.user.is_superuser or obj.user.is_staff or getattr(obj.user, 'is_admin', False):
                    role_badges.append({'key': 'admin', 'label': 'Administrator', 'color': 'red'})
                if getattr(obj.user, 'is_instructor', False):
                    role_badges.append({'key': 'instructor', 'label': 'Instruktur', 'color': 'teal'})
                if is_internal:
                    role_badges.append({'key': 'internal', 'label': 'Setjen DPD RI', 'color': 'indigo'})
                elif getattr(obj.user, 'user_type', '') == 'ASN':
                    role_badges.append({'key': 'asn', 'label': 'ASN Mitra', 'color': 'blue'})

                return {
                    'user_id': obj.user.id,
                    'full_name': obj.user.full_name or obj.user.username or 'Anonim',
                    'image': image_url,
                    'position_name': profile.position.name if profile and profile.position else None,
                    'organization_unit_name': profile.organization_unit.name if profile and profile.organization_unit else None,
                    'user_type': getattr(obj.user, 'user_type', 'UMUM'),
                    'is_staff': bool(obj.user.is_staff or obj.user.is_superuser),
                    'is_instructor': bool(getattr(obj.user, 'is_instructor', False)),
                    'is_internal': is_internal,
                    'role_badges': role_badges,
                }
        except Exception:
            pass
        return None

    def get_user_liked(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            return api_models.ForumTopicMessageLike.objects.filter(message=obj, user=request.user).exists()
        return False

    def get_user_report(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            try:
                report = api_models.ForumReport.objects.filter(
                    reporter=request.user,
                    message=obj
                ).order_by('-created_at').first()
                if report:
                    return {
                        'id': report.id,
                        'reason': report.reason,
                        'reason_display': report.get_reason_display(),
                        'description': report.description,
                        'status': report.status,
                        'status_display': report.get_status_display(),
                        'admin_notes': report.admin_notes,
                        'created_at': report.created_at,
                        'updated_at': report.updated_at,
                    }
            except Exception:
                pass
        return None


class ForumPollOptionSerializer(serializers.ModelSerializer):
    votes_count = serializers.IntegerField(read_only=True)
    percentage = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = api_models.ForumPollOption
        fields = ['id', 'option_text', 'order', 'votes_count', 'percentage']

    def get_percentage(self, obj):
        total = obj.poll.total_votes
        if total == 0:
            return 0
        return round((obj.votes.count() / total) * 100, 1)


class ForumPollSerializer(serializers.ModelSerializer):
    options = serializers.SerializerMethodField(read_only=True)
    total_votes = serializers.IntegerField(read_only=True)
    user_voted_option_id = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = api_models.ForumPoll
        fields = ['id', 'question', 'is_closed', 'total_votes', 'options', 'user_voted_option_id', 'created_at']

    def get_options(self, obj):
        total = obj.total_votes
        options_data = []
        for opt in obj.options.all().order_by('order', 'id'):
            v_count = opt.votes.count()
            pct = round((v_count / total) * 100, 1) if total > 0 else 0
            options_data.append({
                'id': opt.id,
                'option_text': opt.option_text,
                'votes_count': v_count,
                'percentage': pct,
            })
        return options_data

    def get_user_voted_option_id(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            vote = api_models.ForumPollVote.objects.filter(poll=obj, user=request.user).first()
            if vote:
                return vote.option_id
        return None


class ForumReportSerializer(serializers.ModelSerializer):
    reporter_name = serializers.CharField(source='reporter.full_name', read_only=True)

    class Meta:
        model = api_models.ForumReport
        fields = [
            'id', 'reporter', 'reporter_name', 'topic', 'message',
            'reason', 'description', 'status', 'admin_notes', 'created_at'
        ]
        read_only_fields = ['id', 'reporter', 'status', 'admin_notes', 'created_at']


class AdminForumReportSerializer(serializers.ModelSerializer):
    reporter_details = serializers.SerializerMethodField(read_only=True)
    reason_display = serializers.CharField(source='get_reason_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    target_type = serializers.SerializerMethodField(read_only=True)
    topic_details = serializers.SerializerMethodField(read_only=True)
    message_details = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = api_models.ForumReport
        fields = [
            'id', 'reporter', 'reporter_details', 'topic', 'topic_details',
            'message', 'message_details', 'target_type',
            'reason', 'reason_display', 'description',
            'status', 'status_display', 'admin_notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'reporter', 'created_at', 'updated_at']

    def get_reporter_details(self, obj):
        if not obj.reporter:
            return None
        profile = getattr(obj.reporter, 'profile', None)
        image_url = None
        if profile and profile.image:
            try:
                image_url = profile.image.url
            except Exception:
                image_url = None
        full_name = getattr(obj.reporter, 'full_name', '') or obj.reporter.get_full_name() or obj.reporter.username
        return {
            'id': obj.reporter.id,
            'username': obj.reporter.username,
            'full_name': full_name,
            'email': obj.reporter.email,
            'avatar': image_url
        }

    def get_target_type(self, obj):
        return 'message' if obj.message_id else 'topic'

    def get_topic_details(self, obj):
        topic = obj.topic
        if not topic and obj.message:
            topic = getattr(obj.message, 'topic', None)
        if not topic:
            return None
        
        user_profile = getattr(topic.user, 'profile', None) if topic.user else None
        avatar_url = None
        if user_profile and user_profile.image:
            try:
                avatar_url = user_profile.image.url
            except Exception:
                avatar_url = None

        category_title = 'Umum'
        if topic.category:
            category_title = getattr(topic.category, 'title', None) or getattr(topic.category, 'name', 'Umum')

        author_name = 'Anonim'
        author_email = ''
        if topic.user:
            author_name = getattr(topic.user, 'full_name', '') or topic.user.get_full_name() or topic.user.username
            author_email = topic.user.email

        try:
            replies_count = getattr(topic, 'replies_count', None) or topic.replies.count()
        except Exception:
            replies_count = 0

        return {
            'id': topic.id,
            'topic_id': topic.topic_id,
            'title': topic.title,
            'content': topic.content,
            'category_id': topic.category_id,
            'category_title': category_title,
            'is_pinned': topic.is_pinned,
            'is_locked': topic.is_locked,
            'author_id': topic.user_id,
            'author_name': author_name,
            'author_email': author_email,
            'author_avatar': avatar_url,
            'replies_count': replies_count,
            'created_at': topic.created_at
        }

    def get_message_details(self, obj):
        msg = obj.message
        if not msg:
            return None

        user_profile = getattr(msg.user, 'profile', None) if msg.user else None
        avatar_url = None
        if user_profile and user_profile.image:
            try:
                avatar_url = user_profile.image.url
            except Exception:
                avatar_url = None

        author_name = 'Anonim'
        author_email = ''
        if msg.user:
            author_name = getattr(msg.user, 'full_name', '') or msg.user.get_full_name() or msg.user.username
            author_email = msg.user.email

        file_url = None
        if msg.file:
            try:
                file_url = msg.file.url
            except Exception:
                file_url = None

        return {
            'id': msg.id,
            'message_id': msg.message_id,
            'message': msg.message,
            'author_id': msg.user_id,
            'author_name': author_name,
            'author_email': author_email,
            'author_avatar': avatar_url,
            'file_attachment': file_url,
            'created_at': msg.created_at
        }


class ForumTopicSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    profile = serializers.SerializerMethodField(read_only=True)
    category_detail = ForumCategorySerializer(source='category', read_only=True)
    replies = serializers.SerializerMethodField(read_only=True)
    replies_count = serializers.IntegerField(read_only=True)
    likes_count = serializers.IntegerField(read_only=True)
    user_liked = serializers.SerializerMethodField(read_only=True)
    bookmarks_count = serializers.IntegerField(read_only=True)
    user_bookmarked = serializers.SerializerMethodField(read_only=True)
    poll = serializers.SerializerMethodField(read_only=True)
    user_report = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = api_models.ForumTopic
        fields = [
            'id',
            'topic_id',
            'category',
            'category_detail',
            'user',
            'user_id',
            'profile',
            'title',
            'content',
            'views_count',
            'visibility',
            'is_pinned',
            'is_solved',
            'is_locked',
            'file',
            'file_name',
            'poll',
            'replies',
            'replies_count',
            'likes_count',
            'user_liked',
            'bookmarks_count',
            'user_bookmarked',
            'user_report',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'topic_id',
            'views_count',
            'created_at',
            'updated_at',
            'replies_count',
            'likes_count',
            'user_liked',
            'bookmarks_count',
            'user_bookmarked',
            'user_report',
            'profile',
            'category_detail',
            'replies',
            'poll',
        ]

    def get_replies(self, obj):
        # Return serialized replies ordered by created_at
        replies = obj.replies.all().order_by('created_at')
        return ForumTopicMessageSerializer(replies, many=True, context=self.context).data

    def get_profile(self, obj):
        try:
            if obj.user:
                profile = getattr(obj.user, 'profile', None)
                image_url = None
                if profile and profile.image:
                    try:
                        image_url = profile.image.url
                    except Exception:
                        raw_name = getattr(profile.image, 'name', '') or str(profile.image)
                        if raw_name:
                            image_url = f"/media/{raw_name}" if not raw_name.startswith(('/media/', 'http://', 'https://')) else raw_name
                
                request = self.context.get('request')
                if request and image_url and not image_url.startswith(('http://', 'https://')):
                    image_url = request.build_absolute_uri(image_url)

                is_internal = bool(
                    getattr(obj.user, 'is_internal', False) or 
                    getattr(obj.user, 'user_type', '') == 'INTERNAL' or 
                    obj.user.is_staff or 
                    obj.user.is_superuser or 
                    (obj.user.email and obj.user.email.lower().endswith('@dpd.go.id'))
                )

                role_badges = []
                if obj.user.is_superuser or obj.user.is_staff or getattr(obj.user, 'is_admin', False):
                    role_badges.append({'key': 'admin', 'label': 'Administrator', 'color': 'red'})
                if getattr(obj.user, 'is_instructor', False):
                    role_badges.append({'key': 'instructor', 'label': 'Instruktur', 'color': 'teal'})
                if is_internal:
                    role_badges.append({'key': 'internal', 'label': 'Setjen DPD RI', 'color': 'indigo'})
                elif getattr(obj.user, 'user_type', '') == 'ASN':
                    role_badges.append({'key': 'asn', 'label': 'ASN Mitra', 'color': 'blue'})

                return {
                    'user_id': obj.user.id,
                    'full_name': obj.user.full_name or obj.user.username or 'Anonim',
                    'image': image_url,
                    'position_name': profile.position.name if profile and profile.position else None,
                    'organization_unit_name': profile.organization_unit.name if profile and profile.organization_unit else None,
                    'user_type': getattr(obj.user, 'user_type', 'UMUM'),
                    'is_staff': bool(obj.user.is_staff or obj.user.is_superuser),
                    'is_instructor': bool(getattr(obj.user, 'is_instructor', False)),
                    'is_internal': is_internal,
                    'role_badges': role_badges,
                }
        except Exception:
            pass
        return None

    def get_user_liked(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            return api_models.ForumTopicLike.objects.filter(topic=obj, user=request.user).exists()
        return False

    def get_user_bookmarked(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            return api_models.ForumTopicBookmark.objects.filter(topic=obj, user=request.user).exists()
        return False

    def get_poll(self, obj):
        poll = getattr(obj, 'poll', None)
        if poll:
            return ForumPollSerializer(poll, context=self.context).data
        return None

    def get_user_report(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            try:
                report = api_models.ForumReport.objects.filter(
                    reporter=request.user,
                    topic=obj,
                    message__isnull=True
                ).order_by('-created_at').first()
                if report:
                    return {
                        'id': report.id,
                        'reason': report.reason,
                        'reason_display': report.get_reason_display(),
                        'description': report.description,
                        'status': report.status,
                        'status_display': report.get_status_display(),
                        'admin_notes': report.admin_notes,
                        'created_at': report.created_at,
                        'updated_at': report.updated_at,
                    }
            except Exception:
                pass
        return None





