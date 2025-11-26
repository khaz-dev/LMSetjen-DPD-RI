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
        token['full_name'] = user.full_name
        token['email'] = user.email
        token['username'] = user.username
        token['role'] = user.role
        token['nip'] = user.nip  # Add NIP field for SSO identity
        
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
    class Meta:
        model = User
        # Only return essential fields for admin list view - OPTIMIZED
        fields = [
            'id',
            'username',
            'email',
            'full_name',
            'role',
            'is_active',
            'last_login',
            'date_joined'
        ]

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
        """Override to return full URL for image in GET requests"""
        representation = super().to_representation(instance)
        
        # Return full URL for image if it exists
        if instance.image and hasattr(instance.image, 'url'):
            request = self.context.get('request')
            if request:
                representation['image'] = request.build_absolute_uri(instance.image.url)
            else:
                representation['image'] = instance.image.url
        else:
            representation['image'] = None
            
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
    """Enhanced User serializer for admin user management"""
    enrollment_count = serializers.SerializerMethodField()
    course_count = serializers.SerializerMethodField()
    last_login_display = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'full_name', 'role', 'is_active', 
            'date_joined', 'last_login', 'enrollment_count', 'course_count',
            'last_login_display', 'status_display'
        ]
    
    def get_enrollment_count(self, obj):
        if obj.role == 'student':
            return api_models.EnrolledCourse.objects.filter(user=obj).count()
        return 0
    
    def get_course_count(self, obj):
        if obj.role == 'teacher':
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
        """Get count of courses in this category"""
        return api_models.Course.objects.filter(category=obj).count()
    
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
        """Return full URL for image or None if not available"""
        if obj.image and hasattr(obj.image, 'url'):
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None
    
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

    class Meta:
        fields = ["id", "user", "image", "full_name", "bio", "facebook", "twitter", "linkedin", "about", "country"]
        model = api_models.Teacher
    
    def get_image(self, obj):
        """Return full URL for image or None if not available"""
        if obj.image and hasattr(obj.image, 'url'):
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None




class VariantItemSerializer(serializers.ModelSerializer):
    content_duration = serializers.ReadOnlyField()  # Include the property method
    file_type = serializers.ReadOnlyField()         # Include file type property
    file_icon = serializers.ReadOnlyField()         # Include file icon property
    
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
    
    def to_representation(self, instance):
        """Override to return full URL for file field"""
        representation = super().to_representation(instance)
        request = self.context.get('request')
        
        # Handle file field - convert relative paths to full URLs
        if instance.file:
            file_url = str(instance.file)
            # If it's already a full URL, return as-is
            if file_url.startswith('http://') or file_url.startswith('https://'):
                representation['file'] = file_url
            # Otherwise, construct full URL with /media/ prefix
            elif request:
                if not file_url.startswith('/'):
                    file_url = f"/media/{file_url}"
                representation['file'] = request.build_absolute_uri(file_url)
            else:
                # Fallback if no request context
                if not file_url.startswith('/'):
                    representation['file'] = f"/media/{file_url}"
                else:
                    representation['file'] = file_url
        
        return representation


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
    
    class Meta:
        fields = '__all__'
        model = api_models.Question_Answer



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
    profile = ProfileSerializer(many=False)

    class Meta:
        fields = '__all__'
        model = api_models.Review

    def __init__(self, *args, **kwargs):
        super(ReviewSerializer, self).__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.method == "POST":
            self.Meta.depth = 0
        else:
            self.Meta.depth = 3

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


    class Meta:
        fields = '__all__'
        model = api_models.EnrolledCourse

    def get_quiz_results(self, obj):
        """Return quiz results for this enrollment"""
        return obj.quiz_results()

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
    """✨ PHASE 2: Lightweight serializer for search results - only essential fields (~500B per course vs 5KB)"""
    category_name = serializers.CharField(source='category.title', read_only=True)
    teacher_name = serializers.CharField(source='teacher.user.full_name', read_only=True)
    students_count = serializers.SerializerMethodField()
    rating = serializers.SerializerMethodField()
    number_of_rating = serializers.SerializerMethodField()
    
    class Meta:
        model = api_models.Course
        # Only return fields needed for search modal - 70% smaller response
        fields = ['id', 'title', 'slug', 'image', 'level', 'category_name', 'teacher_name', 
                  'students_count', 'rating', 'number_of_rating', 'featured']
    
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
    
    class Meta:
        fields = ["id", "category", "teacher", "file", "image", "title", "description", "level", "platform_status", "teacher_course_status", "featured", "course_id", "slug", "date", "students", "curriculum", "lectures", "average_rating", "rating_count", "reviews", "features", "requirements", "learning_outcomes", "resources"]
        model = api_models.Course

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
        
        return representation

class CourseEditSerializer(serializers.ModelSerializer):
    """
    Simplified course serializer for editing operations to avoid circular references
    and improve performance
    """
    category = CategorySerializer(read_only=True)
    teacher = BasicTeacherSerializer(read_only=True)
    curriculum = VariantSerializer(many=True, required=False, read_only=True)
    lectures = VariantItemSerializer(many=True, required=False, read_only=True)
    quizzes = serializers.SerializerMethodField()
    
    class Meta:
        fields = ["id", "category", "teacher", "file", "image", "title", "description", "level", "platform_status", "teacher_course_status", "featured", "course_id", "slug", "date", "curriculum", "lectures", "quizzes", "average_rating", "rating_count"]
        model = api_models.Course
    
    def get_quizzes(self, obj):
        """Return lightweight quiz data for workflow stepper"""
        return obj.quizzes.values('quiz_id', 'title', 'is_active')
    
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
    email = serializers.EmailField()
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


class QueryTaxonomyReportSerializer(serializers.Serializer):
    """Serialize comprehensive query taxonomy report"""
    total_searches = serializers.IntegerField()
    unique_queries = serializers.IntegerField()
    unique_users = serializers.IntegerField()
    avg_ctr = serializers.FloatField()
    avg_failed_rate = serializers.FloatField()
    categories = SearchTaxonomyAnalyticsSerializer(many=True, read_only=True)

