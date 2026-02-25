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
    """User serializer with Multi Role support - PHASE 4.10"""
    enrollment_count = serializers.SerializerMethodField()
    course_count = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        # Only return essential fields for admin list view - OPTIMIZED
        fields = [
            'id',
            'username',
            'email',
            'full_name',
            'role',
            'is_student',
            'is_instructor',
            'is_admin',
            'is_active',
            'last_login',
            'date_joined',
            'enrollment_count',
            'course_count'
        ]
    
    def get_enrollment_count(self, obj):
        """Count enrollments if user is student - supports Multi Role system"""
        if obj.is_student or obj.role == 'student':
            from . import models as api_models
            return api_models.EnrolledCourse.objects.filter(user=obj).count()
        return 0
    
    def get_course_count(self, obj):
        """Count courses if user is instructor - supports Multi Role system"""
        if obj.is_instructor or obj.role == 'teacher':
            from . import models as api_models
            try:
                teacher = api_models.Teacher.objects.get(user=obj)
                return api_models.Course.objects.filter(teacher=teacher).count()
            except api_models.Teacher.DoesNotExist:
                return 0
        return 0

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
    nip = serializers.CharField(source='user.nip', read_only=True)
    golongan = serializers.CharField(source='user.golongan', read_only=True)
    kelas_jabatan = serializers.CharField(source='user.kelas_jabatan', read_only=True)
    jenis_jabatan = serializers.CharField(source='user.jenis_jabatan', read_only=True)
    
    # Computed fields for frontend display
    organization_unit_name = serializers.SerializerMethodField()
    position_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Profile
        fields = "__all__"
    
    def to_representation(self, instance):
        """✨ PHASE 4.42: Override to return image URL with default fallback if missing"""
        representation = super().to_representation(instance)
        
        # Return image URL directly - since image is a URLField, not FileField
        if instance.image and str(instance.image).strip():
            representation['image'] = str(instance.image)
        else:
            # Return default profile image if no image is set
            representation['image'] = "/images/placeholders/default-instructor.svg"
            
        return representation
    
    def update(self, instance, validated_data):
        """Handle image upload/deletion during update"""
        # Handle image field explicitly
        if 'image' in validated_data:
            image_data = validated_data.get('image')
            
            # If image is empty string or None, delete existing image
            if image_data in ['', None]:
                if instance.image:
                    instance.image.delete(save=False)
                instance.image = None
            else:
                # If new image provided, delete old one and save new
                if instance.image:
                    instance.image.delete(save=False)
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

    class Meta:
        fields = ['id', 'title', 'image', 'slug', 'course_count']
        model = api_models.Category


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
    
    def validate_title(self, value):
        """Ensure category title is not empty and unique"""
        if not value or not value.strip():
            raise serializers.ValidationError("Category title cannot be empty.")
        
        # Check for uniqueness excluding current instance
        instance = self.instance
        duplicate = api_models.Category.objects.filter(title__iexact=value.strip())
        if instance:
            duplicate = duplicate.exclude(id=instance.id)
        
        if duplicate.exists():
            raise serializers.ValidationError(f"Category with title '{value}' already exists.")
        
        return value.strip()
    
    def create(self, validated_data):
        """Create new category with slug auto-generation"""
        category = api_models.Category.objects.create(**validated_data)
        return category
    
    def update(self, instance, validated_data):
        """Update category details"""
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
    image = serializers.SerializerMethodField()
    # New fields for teacher stats and expertise
    expertise = TeacherExpertiseSerializer(many=True, read_only=True, required=False)
    average_rating = serializers.SerializerMethodField()
    total_students = serializers.SerializerMethodField()

    class Meta:
        fields = ["id", "user", "image", "full_name", "bio", "facebook", "twitter", "linkedin", "about", "country", "expertise", "average_rating", "total_students"]
        model = api_models.Teacher
    
    def get_image(self, obj):
        """✨ PHASE 4.42: Return image URL directly from URLField, with default fallback if missing"""
        # Since image is a URLField (not FileField), return string directly
        if obj.image and str(obj.image).strip():
            return str(obj.image)
        # Return default profile image if no image is set
        return "/images/placeholders/default-instructor.svg"
    
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


class BasicTeacherSerializer(serializers.ModelSerializer):
    """Simplified Teacher serializer for basic operations without related fields"""
    image = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()  # ✨ PHASE 4.39: Ensure full_name returns teacher name or user full_name fallback

    class Meta:
        fields = ["id", "image", "full_name", "bio", "facebook", "twitter", "linkedin", "about", "country"]
        model = api_models.Teacher
    
    def get_image(self, obj):
        """✨ PHASE 4.42: Return image URL directly from URLField, with default fallback if missing"""
        # Since image is a URLField (not FileField), return string directly
        if obj.image and str(obj.image).strip():
            return str(obj.image)
        # Return default profile image if no image is set
        return "/images/placeholders/default-instructor.svg"
    
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




class VariantItemSerializer(serializers.ModelSerializer):
    content_duration = serializers.ReadOnlyField()  # Include the property method
    file_type = serializers.ReadOnlyField()         # Include file type property
    file_icon = serializers.ReadOnlyField()         # Include file icon property
    duration_seconds = serializers.SerializerMethodField()  # ✨ PHASE 4.43.9: Extract duration in seconds for frontend
    completion_question = serializers.SerializerMethodField()  # ✨ PHASE 4.143: Include lesson completion question
    
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




class Question_Answer_MessageSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(many=False, read_only=True)

    class Meta:
        fields = '__all__'
        model = api_models.Question_Answer_Message


class Question_AnswerSerializer(serializers.ModelSerializer):
    messages = Question_Answer_MessageSerializer(many=True)
    profile = ProfileSerializer(many=False)
    course = serializers.SerializerMethodField()  # ✨ PHASE 4.16: Return full course object for QA
    
    class Meta:
        fields = '__all__'
        model = api_models.Question_Answer
    
    def get_course(self, obj):
        """Return full course object instead of just ID for better frontend filtering"""
        if obj.course:
            return {
                'id': obj.course.id,
                'title': obj.course.title,
                'course_id': obj.course.course_id,
            }
        return None



# Cart, CartOrder, and CartOrderItem serializers removed - not used in this LMS

class CertificateSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source='course.title', read_only=True)
    student_name = serializers.CharField(source='user.full_name', read_only=True)
    instructor_name = serializers.CharField(source='course.teacher.full_name', read_only=True)
    qr_code_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        fields = [
            'id', 'course', 'user', 'enrollment', 'certificate_id', 
            'validation_token', 'is_valid', 'date', 'course_title', 'student_name', 
            'instructor_name', 'qr_code_url', 'created_at', 'updated_at'
        ]
        model = api_models.Certificate

    def get_qr_code_url(self, obj):
        """Generate QR code URL for certificate validation (frontend route)"""
        request = self.context.get('request')
        if request:
            domain = request.get_host()
            protocol = 'https' if request.is_secure() else 'http'
            return f"{protocol}://{domain}/certificate/validate/{obj.validation_token}/"
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

    class Meta:
        fields = '__all__'
        model = api_models.Note



class ReviewSerializer(serializers.ModelSerializer):
    # Include user data with profile information
    user = serializers.SerializerMethodField()

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
                    user_data['image'] = profile.image.url if hasattr(profile.image, 'url') else str(profile.image)
                else:
                    user_data['image'] = None
            except Profile.DoesNotExist:
                user_data['image'] = None
            except Exception as e:
                user_data['image'] = None
            
            return user_data
        return None

class NotificationSerializer(serializers.ModelSerializer):

    class Meta:
        fields = '__all__'
        model = api_models.Notification


class CountrySerializer(serializers.ModelSerializer):

    class Meta:
        fields = '__all__'
        model = api_models.Country




class EnrolledCourseSerializer(serializers.ModelSerializer):
    lectures = VariantItemSerializer(many=True, read_only=True)
    completed_lesson = CompletedLessonSerializer(many=True, read_only=True)
    video_progress = VideoProgressSerializer(many=True, read_only=True)
    curriculum =  VariantSerializer(many=True, read_only=True)
    note = NoteSerializer(many=True, read_only=True)
    question_answer = Question_AnswerSerializer(many=True, read_only=True)
    review = ReviewSerializer(many=False, read_only=True)
    quiz_results = serializers.SerializerMethodField()
    qa_count = serializers.SerializerMethodField()  # ✨ PHASE 4.18: Add QA count for student QA page


    class Meta:
        fields = '__all__'
        model = api_models.EnrolledCourse

    def get_quiz_results(self, obj):
        """Return quiz results for this enrollment"""
        return obj.quiz_results()

    def get_qa_count(self, obj):
        """✨ PHASE 4.18: Count total questions for this course enrollment"""
        return api_models.Question_Answer.objects.filter(course=obj.course).count()

    def __init__(self, *args, **kwargs):
        super(EnrolledCourseSerializer, self).__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.method == "POST":
            self.Meta.depth = 0
        else:
            self.Meta.depth = 3


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
    # ✨ PHASE 4.71: Fix quizzes field to return array instead of count
    # Frontend checks: Array.isArray(courseData.quizzes) && courseData.quizzes.length > 0
    # So we must return the actual Quiz objects, not just a count
    quizzes = serializers.SerializerMethodField()  # ✨ PHASE 4.71: Return actual quiz objects for canPublish logic
    teacher = BasicTeacherSerializer(read_only=True)  # ✨ PHASE 4.39: Explicit teacher serialization with full details
    qa_count = serializers.SerializerMethodField()  # ✨ PHASE 4.16: Add QA count for instructor QA page
    
    class Meta:
        fields = ["id", "category", "teacher", "file", "image", "title", "description", "level", "platform_status", "teacher_course_status", "featured", "course_id", "slug", "date", "students", "curriculum", "lectures", "average_rating", "rating_count", "reviews", "features", "requirements", "learning_outcomes", "resources", "qa_count", "quizzes", "intro_video_source", "rejection_reason", "review_submitted_date"]
        model = api_models.Course
    
    def get_qa_count(self, obj):
        """✨ PHASE 4.16: Count total questions for this course"""
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

    def __init__(self, *args, **kwargs):
        super(CourseSerializer, self).__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.method == "POST":
            self.Meta.depth = 0
        else:
            self.Meta.depth = 1  # Reduced from 3 to 1 to avoid circular references
    
    def to_representation(self, instance):
        """Override to return full URL for image and file fields"""
        representation = super().to_representation(instance)
        request = self.context.get('request')
        
        # Handle image field - convert relative paths to full URLs
        if instance.image:
            image_url = str(instance.image)
            # If it's a Google Drive link, convert it to direct access format
            if 'drive.google.com' in image_url:
                from .url_utils import convert_google_drive_url_to_direct_image
                representation['image'] = convert_google_drive_url_to_direct_image(image_url)
            # If it's already a full URL, return as-is
            elif image_url.startswith('http://') or image_url.startswith('https://'):
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
    # ✨ PHASE 4.85: Added missing course metadata fields
    features = CourseFeatureSerializer(many=True, read_only=True, required=False)
    requirements = CourseRequirementSerializer(many=True, read_only=True, required=False)
    learning_outcomes = CourseLearningOutcomeSerializer(many=True, read_only=True, required=False)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True, allow_null=True)
    published_version = serializers.SerializerMethodField()  # ✨ PHASE 4.75: Include published version data
    
    class Meta:
        # ✨ PHASE 4.85: Added "features", "requirements", "learning_outcomes"
        fields = ["id", "category", "teacher", "file", "image", "title", "description", "level", "platform_status", "teacher_course_status", "featured", "course_id", "slug", "date", "curriculum", "lectures", "quizzes", "average_rating", "rating_count", "intro_video_source", "rejection_reason", "approved_by", "approved_by_name", "approval_date", "review_submitted_date", "features", "requirements", "learning_outcomes", "published_version"]
        model = api_models.Course
    
    def get_quizzes(self, obj):
        """✨ PHASE 4.38: Return full quiz data with questions and choices for admin review"""
        from . import serializer as ser  # Import to avoid circular reference
        quizzes = obj.quizzes.all()
        return ser.QuizSerializer(quizzes, many=True, read_only=True).data
    
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
                    'intro_video_source': published_copies.intro_video_source,
                    'level': published_copies.level,
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
                    # Include quiz count so frontend knows it exists
                    'quizzes_count': published_copies.quizzes.count()
                }
        return None
    
    def to_representation(self, instance):
        """Override to return full URL for image and file fields"""
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
        fields = ['quiz_id', 'title', 'description', 'is_active', 'date', 'questions', 'total_questions', 'course_title']

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
            'time_taken', 'date_attempted'
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


class FileUploadSerializer(serializers.Serializer):
    file = serializers.FileField(required=True)

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
    
    class Meta:
        model = api_models.StudentRiskAssessment
        fields = [
            'id', 'enrollment', 'enrollment_detail', 'risk_score', 'risk_level',
            'indicators', 'intervention_sent', 'intervention_date',
            'last_assessed', 'created_at'
        ]
        read_only_fields = ['last_assessed', 'created_at']
    
    def get_enrollment_detail(self, obj):
        return {
            'user': obj.enrollment.user.full_name,
            'course': obj.enrollment.course.title,
            'id': obj.enrollment.id
        }


class CourseRecommendationSerializer(serializers.ModelSerializer):
    """Serializer for course recommendations"""
    user_name = serializers.CharField(source='user.full_name', read_only=True)
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
    
    def get_course_detail(self, obj):
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
        fields = [
            'id', 'category', 'category_name', 'category_type',
            'total_searches', 'total_clicks', 'total_failures', 'unique_queries',
            'unique_users', 'avg_ctr', 'failed_rate', 'trending_score',
            'performance_indicator', 'last_updated'
        ]
        read_only_fields = ['id', 'last_updated']
    
    def get_performance_indicator(self, obj):
        """Determine category performance status"""
        if obj.avg_ctr >= 10:
            return 'EXCELLENT'
        elif obj.avg_ctr >= 5:
            return 'GOOD'
        elif obj.avg_ctr >= 1:
            return 'FAIR'
        else:
            return 'POOR'


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
    """
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_image = serializers.CharField(source='user.profile.image', read_only=True, allow_null=True)
    reviewed_by_name = serializers.CharField(
        source='reviewed_by.full_name', 
        read_only=True, 
        allow_null=True
    )
    
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
    """
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_image = serializers.CharField(source='user.profile.image', read_only=True, allow_null=True)
    user_nip = serializers.CharField(source='user.nip', read_only=True, allow_null=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.full_name', read_only=True, allow_null=True)
    
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


