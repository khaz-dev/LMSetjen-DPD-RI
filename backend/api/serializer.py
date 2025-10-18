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

        token['full_name'] = user.full_name
        token['email'] = user.email
        token['username'] = user.username
        token['role'] = user.role
        
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

        return token

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ['full_name', 'email', 'password', 'password2']

    def validate(self, attr):
        if attr['password'] != attr['password2']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})

        return attr
    
    def create(self, validated_data):
        user = User.objects.create(
            full_name=validated_data['full_name'],
            email=validated_data['email'],
        )

        email_username, _ = user.email.split("@")
        user.username = email_username
        user.set_password(validated_data['password'])
        user.save()

        return user
    
    
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'

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

    class Meta:
        fields = [
            'id', 'course', 'user', 'enrollment', 'certificate_id', 
            'is_valid', 'date', 'course_title', 'student_name', 'instructor_name'
        ]
        model = api_models.Certificate

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


    class Meta:
        fields = '__all__'
        model = api_models.EnrolledCourse

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
            if image_url.startswith('http://') or image_url.startsWith('https://'):
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
    created_at = serializers.CharField()
    updated_at = serializers.CharField()
    status = serializers.CharField()
    timezone = serializers.CharField()
    nip = serializers.CharField(allow_null=True, required=False)
    golongan = serializers.CharField(allow_null=True, required=False)
    kelas_jabatan = serializers.CharField(allow_null=True, required=False)
    jenis_jabatan = serializers.CharField(allow_null=True, required=False)
    unit_organisasi = serializers.DictField(allow_null=True, required=False)
    jabatan = serializers.DictField(allow_null=True, required=False)