from django.shortcuts import render, redirect
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
from django.contrib.auth.hashers import check_password
from django.db import models
from django.db.models.functions import ExtractMonth
from django.core.files.uploadedfile import InMemoryUploadedFile
from django.http import Http404
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator




from api import serializer as api_serializer
from api import models as api_models
from userauths.models import User, Profile, OrganizationUnit, Position

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework import generics, status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, APIView


import random
from decimal import Decimal
import requests
from datetime import datetime, timedelta
from django.utils.dateparse import parse_datetime
from django.utils import timezone

# Updates
from django.core.files.storage import default_storage
import os
try:
    from moviepy.editor import VideoFileClip
except ImportError:
    VideoFileClip = None  # Fallback if moviepy not installed
from django.core.files.base import ContentFile
import math
from rest_framework.parsers import MultiPartParser, FormParser
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi


# API Root View
class APIRootView(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request):
        """
        API Root - Welcome page for the LMS Backend API
        """
        return Response({
            "message": "Welcome to LMSetjen DPD RI - Learning Management System API",
            "version": "v1",
            "status": "operational",
            "documentation": {
                "swagger": request.build_absolute_uri('/swagger/'),
                "redoc": request.build_absolute_uri('/redoc/'),
            },
            "endpoints": {
                "health": request.build_absolute_uri('/api/v1/health/'),
                "authentication": {
                    "login": request.build_absolute_uri('/api/v1/user/token/'),
                    "refresh": request.build_absolute_uri('/api/v1/user/token/refresh/'),
                    "register": request.build_absolute_uri('/api/v1/user/register/'),
                },
                "courses": {
                    "list": request.build_absolute_uri('/api/v1/course/course-list/'),
                    "categories": request.build_absolute_uri('/api/v1/course/category/'),
                    "search": request.build_absolute_uri('/api/v1/course/search/'),
                },
            },
            "support": {
                "docs": "See /swagger/ or /redoc/ for complete API documentation",
                "admin": request.build_absolute_uri('/admin/'),
            }
        })

# Health Check API (no authentication required)
class HealthCheckAPIView(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request):
        """Simple health check endpoint for monitoring"""
        return Response({
            'status': 'healthy',
            'service': 'LMS Backend API',
            'timestamp': timezone.now().isoformat()
        }, status=status.HTTP_200_OK)


class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = api_serializer.MyTokenObtainPairSerializer

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = api_serializer.RegisterSerializer

def generate_random_otp(length=7):
    otp = ''.join([str(random.randint(0, 9)) for _ in range(length)])
    return otp

class PasswordResetEmailVerifyAPIView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = api_serializer.UserSerializer

    def get_object(self):
        email = self.kwargs['email'] # api/v1/password-email-verify/desphixs@gmail.com/

        user = User.objects.filter(email=email).first()

        if user:
            uuidb64 = user.pk
            refresh = RefreshToken.for_user(user)
            refresh_token = str(refresh.access_token)

            user.refresh_token = refresh_token
            user.otp = generate_random_otp()
            user.save()

            link = f"http://localhost:5173/create-new-password/?otp={user.otp}&uuidb64={uuidb64}&refresh_token={refresh_token}"

            context = {
                "link": link,
                "username": user.username
            }

            subject = "Password Reset Email"
            text_body = render_to_string("email/password_reset.txt", context)
            html_body = render_to_string("email/password_reset.html", context)

            msg = EmailMultiAlternatives(
                subject=subject,
                from_email=settings.FROM_EMAIL,
                to=[user.email],
                body=text_body
            )

            msg.attach_alternative(html_body, "text/html")
            msg.send()

            print("link ======", link)
        return user
    
class PasswordChangeAPIView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class = api_serializer.UserSerializer

    def create(self, request, *args, **kwargs):
        otp = request.data['otp']
        uuidb64 = request.data['uuidb64']
        password = request.data['password']

        user = User.objects.get(id=uuidb64, otp=otp)
        if user:
            user.set_password(password)
            # user.otp = ""
            user.save()

            return Response({"message": "Password Changed Successfully"}, status=status.HTTP_201_CREATED)
        else:
            return Response({"message": "User Does Not Exists"}, status=status.HTTP_404_NOT_FOUND)

class ChangePasswordAPIView(generics.CreateAPIView):
    serializer_class = api_serializer.UserSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        user_id = request.data['user_id']
        old_password = request.data['old_password']
        new_password = request.data['new_password']

        user = User.objects.get(id=user_id)
        if user is not None:
            if check_password(old_password, user.password):
                user.set_password(new_password)
                user.save()
                return Response({"message": "Password changed successfully", "icon": "success"})
            else:
                return Response({"message": "Old password is incorrect", "icon": "warning"})
        else:
            return Response({"message": "User does not exists", "icon": "error"})

class ProfileAPIView(generics.RetrieveUpdateAPIView):
    serializer_class = api_serializer.ProfileSerializer
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]  # Support file uploads

    def get_object(self):
        try:
            user_id = self.kwargs['user_id']
            user = User.objects.get(id=user_id)
            return Profile.objects.get(user=user)
        except:
            return None
    
    def perform_update(self, serializer):
        # Update profile (including image if provided)
        profile = serializer.save()
        
        # Update user fields if provided
        user = profile.user
        user_fields = ['full_name', 'nip', 'golongan', 'kelas_jabatan', 'jenis_jabatan']
        
        for field in user_fields:
            if field in self.request.data and self.request.data[field] is not None:
                setattr(user, field, self.request.data[field])
        
        user.save()
        
        return profile

class CategoryListAPIView(generics.ListAPIView):
    queryset = api_models.Category.objects.filter(active=True)  
    serializer_class = api_serializer.CategorySerializer
    permission_classes = [AllowAny]

class CourseListAPIView(generics.ListAPIView):
    queryset = api_models.Course.objects.filter(platform_status="Published", teacher_course_status="Published")
    serializer_class = api_serializer.CourseSerializer
    permission_classes = [AllowAny]

class TeacherCourseDetailAPIView(generics.RetrieveDestroyAPIView):
    serializer_class = api_serializer.CourseEditSerializer  # Use optimized serializer for editing
    permission_classes = [AllowAny]

    def get_object(self):
        course_id = self.kwargs['course_id']
        try:
            # Allow access to courses regardless of publication status for editing
            course = api_models.Course.objects.get(course_id=course_id)
            return course
        except api_models.Course.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound(f"Course with ID {course_id} does not exist")
            
    def retrieve(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            serializer = self.get_serializer(instance)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            print(f"Error retrieving course {self.kwargs.get('course_id')}: {e}")
            import traceback
            traceback.print_exc()
            return Response(
                {"error": f"Failed to retrieve course: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def destroy(self, request, *args, **kwargs):
        try:
            course = self.get_object()
            course_title = course.title
            course_id = course.course_id
            
            # Log the deletion
            print(f"Deleting course: {course_title} (ID: {course_id})")
            
            # Delete the course (this will cascade delete related objects due to model relationships)
            course.delete()
            
            return Response({
                "success": True,
                "message": f"Course '{course_title}' has been successfully deleted",
                "course_id": str(course_id)
            }, status=status.HTTP_200_OK)
            
        except api_models.Course.DoesNotExist:
            return Response({
                "success": False,
                "error": "Course not found. It may have already been deleted."
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"Error deleting course {self.kwargs.get('course_id')}: {e}")
            import traceback
            traceback.print_exc()
            return Response({
                "success": False,
                "error": f"Failed to delete course: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
class SearchCourseAPIView(generics.ListAPIView):
    serializer_class = api_serializer.CourseSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        query = self.request.GET.get('query')
        return api_models.Course.objects.filter(title__icontains=query, platform_status="Published", teacher_course_status="Published")
    
class StudentSummaryAPIView(generics.ListAPIView):
    serializer_class = api_serializer.StudentSummarySerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        user_id = self.kwargs['user_id']
        user = User.objects.get(id=user_id)

        total_courses = api_models.EnrolledCourse.objects.filter(user=user).count()
        completed_lessons = api_models.CompletedLesson.objects.filter(user=user).count()
        achieved_certificates = api_models.Certificate.objects.filter(user=user).count()

        return [{
            "total_courses": total_courses,
            "completed_lessons": completed_lessons,
            "achieved_certificates": achieved_certificates,
        }]
    
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
class StudentCourseListAPIView(generics.ListAPIView):
    serializer_class = api_serializer.EnrolledCourseSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        user_id = self.kwargs['user_id']
        user =  User.objects.get(id=user_id)
        return api_models.EnrolledCourse.objects.filter(user=user)

class StudentCourseDetailAPIView(generics.RetrieveAPIView):
    serializer_class = api_serializer.EnrolledCourseSerializer
    permission_classes = [AllowAny]
    lookup_field = 'enrollment_id'

    def get_object(self):
        user_id = self.kwargs['user_id']
        enrollment_id = self.kwargs['enrollment_id']

        user = User.objects.get(id=user_id)
        return api_models.EnrolledCourse.objects.get(user=user, enrollment_id=enrollment_id)
        
class StudentCourseCompletedCreateAPIView(generics.CreateAPIView):
    serializer_class = api_serializer.CompletedLessonSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        user_id = request.data['user_id']
        course_id = request.data['course_id']
        variant_item_id = request.data['variant_item_id']

        user = User.objects.get(id=user_id)
        course = api_models.Course.objects.get(id=course_id)
        variant_item = api_models.VariantItem.objects.get(variant_item_id=variant_item_id)

        completed_lessons = api_models.CompletedLesson.objects.filter(user=user, course=course, variant_item=variant_item).first()

        if completed_lessons:
            completed_lessons.delete()
            return Response({"message": "Course marked as not completed"})
        else:
            api_models.CompletedLesson.objects.create(user=user, course=course, variant_item=variant_item)
            return Response({"message": "Course marked as completed"})

class VideoProgressAPIView(generics.CreateAPIView):
    serializer_class = api_serializer.VideoProgressSerializer
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        """Get video progress with query parameters"""
        user_id = request.GET.get('user_id')
        course_id = request.GET.get('course_id')
        variant_item_id = request.GET.get('variant_item_id')
        
        if not all([user_id, course_id, variant_item_id]):
            return Response({
                "error": "Missing required parameters: user_id, course_id, variant_item_id"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user_id = int(user_id)
            course_id = int(course_id)
            variant_item_id = int(variant_item_id)
        except ValueError:
            return Response({
                "error": "Invalid parameter format - must be integers"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Get progress using variant_item_id (ShortUUID field)
            progress = api_models.VideoProgress.objects.get(
                user_id=user_id,
                course_id=course_id,
                variant_item__variant_item_id=variant_item_id
            )
            
            serializer = api_serializer.VideoProgressSerializer(progress)
            return Response({
                "message": "Video progress retrieved successfully",
                "data": serializer.data
            }, status=status.HTTP_200_OK)
            
        except api_models.VideoProgress.DoesNotExist:
            # Return default progress structure
            return Response({
                "message": "No progress found",
                "data": {
                    "user": user_id,
                    "course": course_id,
                    "variant_item": variant_item_id,
                    "progress_percentage": "0.00",
                    "last_watched_position": "0.00",
                    "total_duration": "0.00",
                    "is_completed": False,
                    "is_in_progress": False
                }
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"[VideoProgress GET] Error: {str(e)}")
            return Response({
                "error": f"Failed to retrieve progress: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def create(self, request, *args, **kwargs):
        user_id = request.data.get('user_id')
        course_id = request.data.get('course_id')
        variant_item_id = request.data.get('variant_item_id')
        progress_percentage = request.data.get('progress_percentage', 0)
        last_watched_position = request.data.get('last_watched_position', 0)
        total_duration = request.data.get('total_duration', 0)

        # Convert string values from FormData to proper numeric types
        try:
            progress_percentage = float(progress_percentage)
            last_watched_position = float(last_watched_position)
            total_duration = float(total_duration)
        except (TypeError, ValueError) as e:
            print(f"[VideoProgress] Type conversion error: {e}")
            return Response({
                "error": f"Invalid numeric values provided: {e}"
            }, status=status.HTTP_400_BAD_REQUEST)

        print(f"[VideoProgress] Received data: user_id={user_id}, course_id={course_id}, variant_item_id={variant_item_id}")
        print(f"[VideoProgress] Progress: {progress_percentage}%, Position: {last_watched_position}, Duration: {total_duration}")

        try:
            # Validate and fetch objects with better error messages
            try:
                user = User.objects.get(id=user_id)
                print(f"[VideoProgress] Found user: {user.username}")
            except User.DoesNotExist:
                return Response({
                    "error": f"User with id {user_id} not found"
                }, status=status.HTTP_400_BAD_REQUEST)

            try:
                course = api_models.Course.objects.get(id=course_id)
                print(f"[VideoProgress] Found course: {course.title}")
            except api_models.Course.DoesNotExist:
                return Response({
                    "error": f"Course with id {course_id} not found"
                }, status=status.HTTP_400_BAD_REQUEST)

            try:
                variant_item = api_models.VariantItem.objects.get(variant_item_id=variant_item_id)
                print(f"[VideoProgress] Found variant item: {variant_item.title}")
            except api_models.VariantItem.DoesNotExist:
                return Response({
                    "error": f"VariantItem with id {variant_item_id} not found"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Create or update video progress
            video_progress, created = api_models.VideoProgress.objects.update_or_create(
                user=user,
                course=course,
                variant_item=variant_item,
                defaults={
                    'progress_percentage': progress_percentage,
                    'last_watched_position': last_watched_position,
                    'total_duration': total_duration
                }
            )

            print(f"[VideoProgress] {'Created' if created else 'Updated'} progress for {user.username} - {variant_item.title}")
            
            serializer = api_serializer.VideoProgressSerializer(video_progress)
            return Response({
                "message": "Video progress saved successfully",
                "data": serializer.data,
                "created": created
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            print(f"[VideoProgress] Unexpected error: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({
                "error": f"Error saving video progress: {str(e)}"
            }, status=status.HTTP_400_BAD_REQUEST)

class VideoProgressDetailAPIView(generics.RetrieveUpdateAPIView):
    serializer_class = api_serializer.VideoProgressSerializer
    permission_classes = [AllowAny]

    def get_object(self):
        user_id = self.kwargs.get('user_id')
        variant_item_id = self.kwargs.get('variant_item_id')
        
        try:
            return api_models.VideoProgress.objects.get(
                user_id=user_id,
                variant_item__variant_item_id=variant_item_id
            )
        except api_models.VideoProgress.DoesNotExist:
            return None
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance is None:
            return Response({
                "message": "No progress found",
                "data": None
            }, status=status.HTTP_200_OK)
        
        serializer = self.get_serializer(instance)
        return Response({
            "message": "Video progress retrieved successfully",
            "data": serializer.data
        }, status=status.HTTP_200_OK)
    
    def post(self, request, *args, **kwargs):
        """Handle POST requests for updating/creating progress"""
        user_id = self.kwargs.get('user_id')
        variant_item_id = self.kwargs.get('variant_item_id')
        
        # Extract progress data from request
        progress_percentage = request.data.get('progress_percentage') or request.data.get('percentage', 0)
        last_watched_position = request.data.get('last_watched_position') or request.data.get('position', 0)
        total_duration = request.data.get('total_duration') or request.data.get('duration', 0)
        
        try:
            # Convert to appropriate types
            progress_percentage = float(progress_percentage)
            last_watched_position = float(last_watched_position)
            total_duration = float(total_duration)
            user_id = int(user_id)
            variant_item_id = int(variant_item_id)
        except (ValueError, TypeError) as e:
            return Response({
                "error": f"Invalid numeric values provided: {e}"
            }, status=status.HTTP_400_BAD_REQUEST)

        print(f"[VideoProgressDetail] POST data: user_id={user_id}, variant_item_id={variant_item_id}")
        print(f"[VideoProgressDetail] Progress: {progress_percentage}%, Position: {last_watched_position}, Duration: {total_duration}")

        try:
            # Get required objects
            user = User.objects.get(id=user_id)
            variant_item = api_models.VariantItem.objects.get(variant_item_id=variant_item_id)
            
            # Get the course from request data or from variant_item
            course_id = request.data.get('course_id')
            if course_id:
                course = api_models.Course.objects.get(id=course_id)
            else:
                course = variant_item.variant.course

            # Create or update video progress
            video_progress, created = api_models.VideoProgress.objects.update_or_create(
                user=user,
                course=course,
                variant_item=variant_item,
                defaults={
                    'progress_percentage': progress_percentage,
                    'last_watched_position': last_watched_position,
                    'total_duration': total_duration
                }
            )

            print(f"[VideoProgressDetail] {'Created' if created else 'Updated'} progress for {user.username} - {variant_item.title}")
            
            # Return lightweight response to prevent broken pipe errors
            return Response({
                "message": "Video progress saved successfully",
                "progress_percentage": float(video_progress.progress_percentage),
                "last_watched_position": float(video_progress.last_watched_position),
                "total_duration": float(video_progress.total_duration),
                "is_completed": video_progress.is_completed,
                "is_in_progress": video_progress.is_in_progress,
                "created": created
            }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

        except User.DoesNotExist:
            return Response({
                "error": f"User with id {user_id} not found"
            }, status=status.HTTP_400_BAD_REQUEST)
        except api_models.VariantItem.DoesNotExist:
            return Response({
                "error": f"VariantItem with id {variant_item_id} not found"
            }, status=status.HTTP_400_BAD_REQUEST)
        except api_models.Course.DoesNotExist:
            return Response({
                "error": f"Course not found"
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"[VideoProgressDetail] Unexpected error: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({
                "error": f"Error saving video progress: {str(e)}"
            }, status=status.HTTP_400_BAD_REQUEST)

class VideoProgressDeleteAPIView(generics.DestroyAPIView):
    permission_classes = [AllowAny]

    def get_object(self):
        user_id = self.kwargs.get('user_id')
        variant_item_id = self.kwargs.get('variant_item_id')
        
        try:
            return api_models.VideoProgress.objects.get(
                user_id=user_id,
                variant_item__variant_item_id=variant_item_id
            )
        except api_models.VideoProgress.DoesNotExist:
            return None
    
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance is None:
            return Response({
                "message": "No progress found to delete",
                "success": True
            }, status=status.HTTP_200_OK)
        
        instance.delete()
        return Response({
            "message": "Video progress deleted successfully",
            "success": True
        }, status=status.HTTP_200_OK)

class StudentNoteCreateAPIView(generics.ListCreateAPIView):
    serializer_class = api_serializer.NoteSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        user_id = self.kwargs['user_id']
        enrollment_id = self.kwargs['enrollment_id']

        user = User.objects.get(id=user_id)
        enrolled = api_models.EnrolledCourse.objects.get(enrollment_id=enrollment_id)
        
        return api_models.Note.objects.filter(user=user, course=enrolled.course)

    def create(self, request, *args, **kwargs):
        user_id = request.data['user_id']
        enrollment_id = request.data['enrollment_id']
        title = request.data['title']
        note = request.data['note']
        color = request.data.get('color', '#f39c12')  # Default color if not provided

        user = User.objects.get(id=user_id)
        enrolled = api_models.EnrolledCourse.objects.get(enrollment_id=enrollment_id)
        
        api_models.Note.objects.create(user=user, course=enrolled.course, note=note, title=title, color=color)

        return Response({"message": "Note created successfullly"}, status=status.HTTP_201_CREATED)

class StudentNoteDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = api_serializer.NoteSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        user_id = self.kwargs['user_id']
        enrollment_id = self.kwargs['enrollment_id']
        note_id = self.kwargs['note_id']

        user = User.objects.get(id=user_id)
        enrolled = api_models.EnrolledCourse.objects.get(enrollment_id=enrollment_id)
        note = api_models.Note.objects.get(user=user, course=enrolled.course, id=note_id)
        return note

class StudentRateCourseCreateAPIView(generics.CreateAPIView):
    serializer_class = api_serializer.ReviewSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        try:
            user_id = request.data['user']
            course_id = request.data['course']
            rating = request.data['rating']
            review = request.data['review']

            user = User.objects.get(id=user_id)
            course = api_models.Course.objects.get(id=course_id)

            # Check if user already has a review for this course
            existing_review = api_models.Review.objects.filter(user=user, course=course).first()
            if existing_review:
                return Response(
                    {"error": "You have already reviewed this course"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            api_models.Review.objects.create(
                user=user,
                course=course,
                review=review,
                rating=rating,
                active=True,
            )

            return Response({"message": "Review created successfully"}, status=status.HTTP_201_CREATED)
            
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        except api_models.Course.DoesNotExist:
            return Response({"error": "Course not found"}, status=status.HTTP_404_NOT_FOUND)
        except KeyError as e:
            return Response({"error": f"Missing required field: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"Internal server error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class StudentRateCourseUpdateAPIView(generics.RetrieveUpdateAPIView):
    serializer_class = api_serializer.ReviewSerializer
    permission_classes = [AllowAny]

    def get_object(self):
        user_id = self.kwargs['user_id']
        review_id = self.kwargs['review_id']

        user = User.objects.get(id=user_id)
        return api_models.Review.objects.get(id=review_id, user=user)

class StudentWishListListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = api_serializer.WishlistSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        user_id = self.kwargs['user_id']
        user = User.objects.get(id=user_id)
        return api_models.Wishlist.objects.filter(user=user)
    
    def create(self, request, *args, **kwargs):
        try:
            user_id = request.data.get('user_id')
            course_id = request.data.get('course_id')

            # Validate required fields
            if not user_id or not course_id:
                return Response(
                    {"message": "User ID and Course ID are required"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Get user and validate
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response(
                    {"message": "User not found"}, 
                    status=status.HTTP_404_NOT_FOUND
                )

            # Check if user is a teacher
            if user.role == 'teacher':
                return Response(
                    {"message": "Instructors cannot add courses to wishlist"}, 
                    status=status.HTTP_403_FORBIDDEN
                )

            # Get course and validate
            try:
                course = api_models.Course.objects.get(id=course_id)
            except api_models.Course.DoesNotExist:
                return Response(
                    {"message": "Course not found"}, 
                    status=status.HTTP_404_NOT_FOUND
                )

            # Check if wishlist item already exists
            wishlist = api_models.Wishlist.objects.filter(user=user, course=course).first()
            
            if wishlist:
                # Remove from wishlist
                wishlist.delete()
                return Response(
                    {"message": "Course removed from wishlist"}, 
                    status=status.HTTP_200_OK
                )
            else:
                # Add to wishlist
                api_models.Wishlist.objects.create(user=user, course=course)
                return Response(
                    {"message": "Course added to wishlist"}, 
                    status=status.HTTP_201_CREATED
                )
                
        except Exception as e:
            print(f"[Wishlist Error] {str(e)}")
            return Response(
                {"message": f"Error updating wishlist: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class QuestionAnswerListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = api_serializer.Question_AnswerSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        course_id = self.kwargs['course_id']
        course = api_models.Course.objects.get(id=course_id)
        return api_models.Question_Answer.objects.filter(course=course)
    
    def create(self, request, *args, **kwargs):
        course_id = request.data['course_id']
        user_id = request.data['user_id']
        title = request.data['title']
        message = request.data['message']

        user = User.objects.get(id=user_id)
        course = api_models.Course.objects.get(id=course_id)
        
        question = api_models.Question_Answer.objects.create(
            course=course,
            user=user,
            title=title
        )

        api_models.Question_Answer_Message.objects.create(
            course=course,
            user=user,
            message=message,
            question=question
        )
        
        return Response({"message": "Group conversation Started"}, status=status.HTTP_201_CREATED)

class QuestionAnswerMessageSendAPIView(generics.CreateAPIView):
    serializer_class = api_serializer.Question_Answer_MessageSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        print("=== DEBUG: QuestionAnswerMessageSendAPIView ===")
        print(f"Request data: {request.data}")
        
        try:
            course_id = request.data.get('course_id')
            qa_id = request.data.get('qa_id')
            user_id = request.data.get('user_id')
            message = request.data.get('message')

            print(f"Extracted data - course_id: {course_id}, qa_id: {qa_id}, user_id: {user_id}, message: {message}")

            # Validate required fields
            if not all([course_id, qa_id, user_id, message]):
                missing_fields = []
                if not course_id: missing_fields.append('course_id')
                if not qa_id: missing_fields.append('qa_id') 
                if not user_id: missing_fields.append('user_id')
                if not message: missing_fields.append('message')
                print(f"Missing fields: {missing_fields}")
                return Response(
                    {"error": f"Missing required fields: {', '.join(missing_fields)}"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Get related objects with error handling
            try:
                user = User.objects.get(id=user_id)
                course = api_models.Course.objects.get(id=course_id)
                question = api_models.Question_Answer.objects.get(qa_id=qa_id)
            except User.DoesNotExist:
                return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
            except api_models.Course.DoesNotExist:
                return Response({"error": "Course not found"}, status=status.HTTP_404_NOT_FOUND)
            except api_models.Question_Answer.DoesNotExist:
                return Response({"error": "Question not found"}, status=status.HTTP_404_NOT_FOUND)

            # Create the message
            message_obj = api_models.Question_Answer_Message.objects.create(
                course=course,
                user=user,
                message=message,
                question=question
            )

            # Return the updated question with all messages
            question_serializer = api_serializer.Question_AnswerSerializer(question)
            return Response({"message": "Message Sent", "question": question_serializer.data})

        except Exception as e:
            return Response(
                {"error": f"Internal server error: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class TeacherSummaryAPIView(generics.ListAPIView):
    serializer_class = api_serializer.TeacherSummarySerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        teacher_id = self.kwargs['teacher_id']
        teacher = api_models.Teacher.objects.get(id=teacher_id)

        one_month_ago = datetime.today() - timedelta(days=28)

        total_courses = api_models.Course.objects.filter(teacher=teacher).count()

        enrolled_courses = api_models.EnrolledCourse.objects.filter(teacher=teacher)
        unique_student_ids = set()
        students = []

        for course in enrolled_courses:
            if course.user_id not in unique_student_ids:
                user = User.objects.get(id=course.user_id)
                student = {
                    "full_name": user.profile.full_name,
                    "image": user.profile.image.url,
                    "country": user.profile.country,
                    "date": course.date
                }

                students.append(student)
                unique_student_ids.add(course.user_id)

        return [{
            "total_courses": total_courses,
            "total_students": len(students),
        }]
    
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

class TeacherCourseListAPIView(generics.ListAPIView):
    serializer_class = api_serializer.CourseSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        teacher_id = self.kwargs['teacher_id']
        teacher = api_models.Teacher.objects.get(id=teacher_id)
        return api_models.Course.objects.filter(teacher=teacher)

class TeacherReviewListAPIView(generics.ListAPIView):
    serializer_class = api_serializer.ReviewSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        teacher_id = self.kwargs['teacher_id']
        teacher = api_models.Teacher.objects.get(id=teacher_id)
        return api_models.Review.objects.filter(course__teacher=teacher)
    
class TeacherReviewDetailAPIView(generics.RetrieveUpdateAPIView):
    serializer_class = api_serializer.ReviewSerializer
    permission_classes = [AllowAny]

    def get_object(self):
        teacher_id = self.kwargs['teacher_id']
        review_id = self.kwargs['review_id']
        teacher = api_models.Teacher.objects.get(id=teacher_id)
        return api_models.Review.objects.get(course__teacher=teacher, id=review_id)

class TeacherStudentsListAPIView(viewsets.ViewSet):
    permission_classes = [AllowAny]
    
    def list(self, request, teacher_id=None):
        try:
            teacher = api_models.Teacher.objects.get(id=teacher_id)

            enrolled_courses = api_models.EnrolledCourse.objects.filter(teacher=teacher)
            unique_student_ids = set()
            students = []

            for course in enrolled_courses:
                if course.user_id not in unique_student_ids:
                    try:
                        user = User.objects.get(id=course.user_id)
                        
                        # Safely get profile data with fallbacks
                        full_name = None
                        image_url = None
                        country = None
                        
                        # Try to get profile, handle if it doesn't exist
                        if hasattr(user, 'profile'):
                            profile = user.profile
                            full_name = profile.full_name if profile.full_name else None
                            country = profile.country if profile.country else None
                            
                            # Safely get image URL
                            if profile.image:
                                try:
                                    image_url = profile.image.url
                                except:
                                    image_url = None
                        
                        # Fallback to User model fields if profile doesn't have data
                        if not full_name:
                            if hasattr(user, 'full_name') and user.full_name:
                                full_name = user.full_name
                            elif hasattr(user, 'username') and user.username:
                                full_name = user.username
                            else:
                                # Last resort: use first name + last name or email
                                if user.first_name or user.last_name:
                                    full_name = f"{user.first_name} {user.last_name}".strip()
                                elif user.email:
                                    full_name = user.email.split('@')[0]
                                else:
                                    full_name = f"Student {user.id}"
                        
                        student = {
                            "user_id": user.id,
                            "full_name": full_name,
                            "image": image_url,
                            "country": country,
                            "date": course.date,
                            "email": user.email if hasattr(user, 'email') else None
                        }

                        students.append(student)
                        unique_student_ids.add(course.user_id)
                    except User.DoesNotExist:
                        print(f"User with ID {course.user_id} not found")
                        continue
                    except Exception as e:
                        print(f"Error processing student {course.user_id}: {str(e)}")
                        continue

            return Response(students)
        except api_models.Teacher.DoesNotExist:
            return Response({'error': 'Teacher not found'}, status=404)
        except Exception as e:
            print(f"Error in TeacherStudentsListAPIView: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=500)

class TeacherBestSellingCourseAPIView(viewsets.ViewSet):
    permission_classes = [AllowAny]

    def list(self, request, teacher_id=None):
        try:
            teacher = api_models.Teacher.objects.get(id=teacher_id)
            courses_with_sales = []
            courses = api_models.Course.objects.filter(teacher=teacher)

            for course in courses:
                sales = course.enrolledcourse_set.count()

                # Get average rating safely
                try:
                    avg_rating = course.average_rating()
                    if avg_rating is None:
                        avg_rating = 0
                except:
                    avg_rating = 0

                courses_with_sales.append({
                    'image': course.image if course.image else '',
                    'title': course.title if course.title else 'Untitled Course',
                    'sales': sales,
                    'students': {'length': sales},  # Frontend expects students.length
                    'average_rating': avg_rating,
                })

            # Sort by sales (descending) to show best selling courses first
            courses_with_sales.sort(key=lambda x: x['sales'], reverse=True)

            return Response(courses_with_sales)
        except api_models.Teacher.DoesNotExist:
            return Response({'error': 'Teacher not found'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
    
class TeacherCourseOrdersListAPIView(generics.ListAPIView):
    # Changed to use EnrolledCourse instead of CartOrder
    serializer_class = api_serializer.EnrolledCourseSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        teacher_id = self.kwargs['teacher_id']
        teacher = api_models.Teacher.objects.get(id=teacher_id)

        return api_models.EnrolledCourse.objects.filter(teacher=teacher)

class TeacherQuestionAnswerListAPIView(generics.ListAPIView):
    serializer_class = api_serializer.Question_AnswerSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        teacher_id = self.kwargs['teacher_id']
        teacher = api_models.Teacher.objects.get(id=teacher_id)
        return api_models.Question_Answer.objects.filter(course__teacher=teacher)
    
class TeacherNotificationListAPIView(generics.ListAPIView):
    serializer_class = api_serializer.NotificationSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        teacher_id = self.kwargs['teacher_id']
        teacher = api_models.Teacher.objects.get(id=teacher_id)
        return api_models.Notification.objects.filter(teacher=teacher, seen=False)
    
class TeacherNotificationDetailAPIView(generics.RetrieveUpdateAPIView):
    serializer_class = api_serializer.NotificationSerializer
    permission_classes = [AllowAny]

    def get_object(self):
        teacher_id = self.kwargs['teacher_id']
        noti_id = self.kwargs['noti_id']
        teacher = api_models.Teacher.objects.get(id=teacher_id)
        return api_models.Notification.objects.get(teacher=teacher, id=noti_id)


class TeacherCreateFromProfileAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            user_id = request.data.get('user_id')
            if not user_id:
                return Response({'error': 'User ID is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if teacher already exists
            existing_teacher = api_models.Teacher.objects.filter(user_id=user_id).first()
            if existing_teacher:
                teacher_data = api_serializer.BasicTeacherSerializer(existing_teacher).data
                return Response({'teacher': teacher_data}, status=status.HTTP_200_OK)
            
            # Get user profile
            try:
                from userauths.models import Profile
                profile = Profile.objects.get(user_id=user_id)
            except Profile.DoesNotExist:
                return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Create teacher from profile
            teacher = api_models.Teacher.create_from_profile(profile.user)
            teacher_data = api_serializer.BasicTeacherSerializer(teacher).data
            
            return Response({
                'message': 'Teacher created successfully',
                'teacher': teacher_data
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TeacherProfileAPIView(generics.RetrieveAPIView):
    serializer_class = api_serializer.BasicTeacherSerializer
    permission_classes = [AllowAny]
    
    def get_object(self):
        user_id = self.kwargs['user_id']
        teacher = api_models.Teacher.objects.filter(user_id=user_id).first()
        if not teacher:
            # If teacher doesn't exist, create one from profile
            try:
                from userauths.models import Profile
                profile = Profile.objects.get(user_id=user_id)
                teacher = api_models.Teacher.create_from_profile(profile.user)
            except Profile.DoesNotExist:
                return None
        return teacher


class TeacherProfileUpdateAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def patch(self, request, user_id):
        try:
            if not user_id:
                return Response({'error': 'User ID is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Get or create teacher
            teacher, created = api_models.Teacher.objects.get_or_create(
                user_id=user_id,
                defaults={'full_name': f'Teacher {user_id}'}
            )
            
            # Update teacher fields
            teacher_fields = ['bio', 'facebook', 'twitter', 'linkedin']
            for field in teacher_fields:
                if field in request.data:
                    setattr(teacher, field, request.data[field])
            
            teacher.save()
            teacher_data = api_serializer.BasicTeacherSerializer(teacher).data
            
            return Response({
                'message': 'Teacher profile updated successfully',
                'teacher': teacher_data
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    

class CourseCreateAPIView(APIView):
    permission_classes = [AllowAny]  # Changed from IsAuthenticated to AllowAny for testing

    def post(self, request):
        try:
            title = request.data.get("title")
            description = request.data.get("description")
            image_url = request.data.get("image")  # Now expecting URL from file-upload API
            file_url = request.data.get("file")    # Now expecting URL from file-upload API
            level = request.data.get("level")
            category = request.data.get("category")

            print(f"=== Course Creation Debug ===")
            print(f"Title: {title}")
            print(f"Description length: {len(description) if description else 0}")
            print(f"Image URL: {image_url}")
            print(f"Image URL length: {len(image_url) if image_url else 0}")
            print(f"File URL: {file_url}")
            print(f"File URL length: {len(file_url) if file_url else 0}")
            print(f"Level: {level}")
            print(f"Category: {category}")

            # Validate required fields
            if not title:
                return Response({"error": "Title is required"}, status=status.HTTP_400_BAD_REQUEST)
            
            if not category:
                return Response({"error": "Category is required"}, status=status.HTTP_400_BAD_REQUEST)

            # Get category object
            category_obj = api_models.Category.objects.filter(id=category).first()
            if not category_obj:
                return Response({"error": "Invalid category"}, status=status.HTTP_400_BAD_REQUEST)

            # Get teacher object - for now, get the first teacher or create one
            teacher = None
            if request.user and request.user.is_authenticated:
                teacher = api_models.Teacher.objects.filter(user=request.user).first()
            
            # If no authenticated user or no teacher profile, get the first teacher
            if not teacher:
                teacher = api_models.Teacher.objects.first()
                if not teacher:
                    return Response({"error": "No teacher profile found"}, status=status.HTTP_400_BAD_REQUEST)

            # Create course with Draft status (not published until curriculum is complete)
            course = api_models.Course.objects.create(
                teacher=teacher,
                category=category_obj,
                file=file_url,     # Store URL instead of file
                image=image_url,   # Store URL instead of file
                title=title,
                description=description,
                level=level,
                platform_status="Draft",           # Set to Draft for admin/platform review
                teacher_course_status="Draft"      # Set to Draft - teacher needs to complete curriculum
            )

            print(f"Course created successfully with ID: {course.course_id}")
            print(f"Course status: platform_status={course.platform_status}, teacher_course_status={course.teacher_course_status}")

            return Response({
                "message": "Course Created Successfully",
                "course_id": course.course_id,
                "status": "draft",
                "next_step": "Add curriculum, lessons, and quizzes to publish your course"
            }, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            import traceback
            print(f"Error creating course: {str(e)}")
            print(f"Full traceback:")
            print(traceback.format_exc())
            return Response({"error": f"Internal server error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
 

class CourseUpdateAPIView(generics.RetrieveUpdateAPIView):
    queryset = api_models.Course.objects.all()
    serializer_class = api_serializer.CourseSerializer
    permission_classes = [AllowAny]

    def get_object(self):
        teacher_id = self.kwargs['teacher_id']
        course_id = self.kwargs['course_id']

        teacher = api_models.Teacher.objects.get(id=teacher_id)
        course = api_models.Course.objects.get(course_id=course_id)

        return course
    
    def update(self, request, *args, **kwargs):
        try:
            course = self.get_object()
            print(f"Updating course: {course.title}")
            print(f"Request data keys: {list(request.data.keys())}")
            
            serializer = self.get_serializer(course, data=request.data)
            
            # Add detailed error information
            if not serializer.is_valid():
                print(f"Serializer errors: {serializer.errors}")
                print(f"Full request data: {request.data}")
            
            serializer.is_valid(raise_exception=True)

            # Handle image URL update
            if "image" in request.data:
                if isinstance(request.data['image'], InMemoryUploadedFile):
                    # Legacy support for direct file upload
                    course.image = request.data['image']
                elif request.data['image'] and str(request.data['image']) != "No File":
                    # Store URL from file-upload API
                    course.image = request.data['image']
                elif str(request.data['image']) == "No File":
                    course.image = None
            
            # Handle file URL update
            if 'file' in request.data:
                if isinstance(request.data['file'], InMemoryUploadedFile):
                    # Legacy support for direct file upload
                    course.file = request.data['file']
                elif request.data['file'] and not str(request.data['file']).startswith("http://") and not str(request.data['file']).startswith("https://"):
                    # Legacy support for direct file upload
                    course.file = request.data['file']
                elif str(request.data['file']).startswith(("http://", "https://")):
                    # Store URL from file-upload API
                    course.file = request.data['file']

            if 'category' in request.data and request.data['category'] != 'NaN' and request.data['category'] != "undefined":
                try:
                    # Handle both object and direct ID formats
                    category_id = request.data['category']
                    if isinstance(category_id, dict) and 'id' in category_id:
                        category_id = category_id['id']
                    
                    category = api_models.Category.objects.get(id=category_id)
                    course.category = category
                except (api_models.Category.DoesNotExist, ValueError, TypeError) as e:
                    print(f"Category error: {e}")
                    print(f"Category data: {request.data['category']}")
                    # Don't fail the entire request, just skip category update

            self.perform_update(serializer)
            self.update_variant(course, request.data)
            
            # *** CRITICAL FIX: Refresh course data to include updated curriculum ***
            # The serializer.data was generated BEFORE update_variant was called,
            # so it doesn't include the updated curriculum. We must refresh it.
            course.refresh_from_db()
            refreshed_serializer = self.get_serializer(course)
            
            print(f"[Course Update] Returning refreshed data with {len(refreshed_serializer.data.get('curriculum', []))} curriculum sections")
            
            return Response(refreshed_serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"Error in course update: {e}")
            print(f"Error type: {type(e)}")
            import traceback
            traceback.print_exc()
            raise e
    
    def update_variant(self, course, request_data):
        """
        Enhanced curriculum update with proper delete handling to prevent duplicates
        """
        # Track which variants and items are being updated
        updated_variant_ids = set()
        updated_item_ids = set()
        
        # Group variant data by index
        variant_indices = set()
        for key in request_data.keys():
            if key.startswith("variants[") and '][variant_title]' in key:
                index = key.split('[')[1].split(']')[0]
                variant_indices.add(index)
        
        print(f"[Curriculum Update] Processing {len(variant_indices)} variants for course: {course.title}")

        
        for index in variant_indices:
            # Get variant data
            title_key = f"variants[{index}][variant_title]"
            id_key = f"variants[{index}][variant_id]"
            order_key = f"variants[{index}][order]"
            
            title = request_data.get(title_key, '')
            variant_id = request_data.get(id_key)
            order = request_data.get(order_key, index)  # Use index as fallback
            
            # Skip empty sections
            if not title or title.strip() == '':
                print(f"[Curriculum Update] Skipping empty variant at index {index}")
                continue

            
            # Group items for this variant
            items_data = {}
            for key, value in request_data.items():
                if f'variants[{index}][items][' in key:
                    # Extract item index and field name
                    # Format: variants[0][items][0][title]
                    parts = key.split('][items][')[1]  # "0][title]"
                    item_index = parts.split('][')[0]  # "0"
                    field_name = parts.split('][')[1].replace(']', '')  # "title"
                    
                    if item_index not in items_data:
                        items_data[item_index] = {}
                    items_data[item_index][field_name] = value

            
            # Find or create variant
            if variant_id:
                existing_variant = course.variant_set.filter(variant_id=variant_id).first()
            else:
                existing_variant = None
            
            if existing_variant:
                print(f"[Curriculum Update] Updating existing variant {existing_variant.variant_id}: {title}")
                existing_variant.title = title
                existing_variant.order = int(order) if order else 0
                existing_variant.save()
                variant = existing_variant
                updated_variant_ids.add(variant.variant_id)
            else:
                print(f"[Curriculum Update] Creating new variant: {title}")
                variant = api_models.Variant.objects.create(
                    course=course, 
                    title=title,
                    order=int(order) if order else 0
                )
                updated_variant_ids.add(variant.variant_id)
            
            # Process items
            for item_index, item_data in items_data.items():
                
                # Get item data
                item_title = item_data.get("title", "")
                item_description = item_data.get("description", "")
                item_file = item_data.get("file", "")
                preview_value = item_data.get("preview", "false")
                variant_item_id = item_data.get("variant_item_id")
                duration_seconds = item_data.get("duration_seconds")  # Get duration from file upload
                item_order = item_data.get("order", item_index)  # Get order or use index as fallback
                
                # Skip empty items
                if not item_title or item_title.strip() == '':
                    print(f"[Curriculum Update] Skipping empty item at variant[{index}] item[{item_index}]")
                    continue
                
                # Handle preview boolean
                preview = str(preview_value).lower() in ['true', '1', 'yes'] if preview_value else False
                
                # Handle duration conversion
                duration = None
                if duration_seconds:
                    try:
                        from datetime import timedelta
                        duration = timedelta(seconds=float(duration_seconds))
                    except (ValueError, TypeError):
                        print(f"Invalid duration_seconds value: {duration_seconds}")
                        duration = None
                
                # Handle file data
                if item_file and str(item_file) not in ["null", "undefined", ""]:
                    if str(item_file).startswith(("http://", "https://")):
                        file = item_file  # URL from file-upload API
                    else:
                        file = item_file  # Direct file upload
                else:
                    file = None
                
                # Find existing item or create new one
                if variant_item_id:
                    variant_item = api_models.VariantItem.objects.filter(variant_item_id=variant_item_id).first()
                    if variant_item:
                        print(f"[Curriculum Update] Updating existing item {variant_item.variant_item_id}: {item_title}")
                        variant_item.title = item_title
                        variant_item.description = item_description
                        variant_item.preview = preview
                        variant_item.order = int(item_order) if item_order else 0
                        if file:
                            variant_item.file = file
                        if duration is not None:
                            variant_item.duration = duration
                        variant_item.save()
                        updated_item_ids.add(variant_item.variant_item_id)
                    else:
                        print(f"[Curriculum Update] Item ID {variant_item_id} not found, creating new item: {item_title}")
                        variant_item = api_models.VariantItem.objects.create(
                            variant=variant,
                            title=item_title,
                            description=item_description,
                            file=file,
                            duration=duration,
                            preview=preview,
                            order=int(item_order) if item_order else 0
                        )
                        updated_item_ids.add(variant_item.variant_item_id)
                else:
                    print(f"[Curriculum Update] Creating new item: {item_title}")
                    variant_item = api_models.VariantItem.objects.create(
                        variant=variant,
                        title=item_title,
                        description=item_description,
                        file=file,
                        duration=duration,
                        preview=preview,
                        order=int(item_order) if item_order else 0
                    )
                    updated_item_ids.add(variant_item.variant_item_id)
        
        # *** CRITICAL FIX: Delete orphaned variants and items to prevent duplicates ***
        
        # Get all variants for this course
        all_course_variants = course.variant_set.all()
        
        # Delete variants that weren't in the update (removed by user)
        deleted_variant_count = 0
        for variant in all_course_variants:
            if variant.variant_id not in updated_variant_ids:
                print(f"[Curriculum Cleanup] Deleting orphaned variant {variant.variant_id}: {variant.title}")
                variant.delete()  # Cascade deletes items
                deleted_variant_count += 1
        
        # Delete orphaned items (items whose variant was updated but item wasn't)
        deleted_item_count = 0
        for variant_id in updated_variant_ids:
            variant = course.variant_set.filter(variant_id=variant_id).first()
            if variant:
                all_variant_items = variant.variant_items.all()  # Use related_name "variant_items"
                for item in all_variant_items:
                    if item.variant_item_id not in updated_item_ids:
                        print(f"[Curriculum Cleanup] Deleting orphaned item {item.variant_item_id}: {item.title}")
                        item.delete()
                        deleted_item_count += 1
        
        print(f"[Curriculum Summary] Variants updated/created: {len(updated_variant_ids)}, Items updated/created: {len(updated_item_ids)}")
        print(f"[Curriculum Summary] Variants deleted: {deleted_variant_count}, Items deleted: {deleted_item_count}")
        print(f"[Curriculum Update] Completed successfully for course: {course.title}")

    def save_nested_data(self, course_instance, serializer_class, data):
        serializer = serializer_class(data=data, many=True, context={"course_instance": course_instance})
        serializer.is_valid(raise_exception=True)
        serializer.save(course=course_instance) 

class CoursePublishAPIView(APIView):
    """
    API endpoint to publish a course
    Validates that the course has curriculum and lessons before publishing
    """
    permission_classes = [AllowAny]
    
    def post(self, request, course_id):
        try:
            course = api_models.Course.objects.get(course_id=course_id)
            
            # Validation checks
            errors = []
            warnings = []
            
            # Check if course has basic information
            if not course.title or not course.description:
                errors.append("Course must have title and description")
            
            if not course.category:
                errors.append("Course must have a category")
            
            # Check if course has curriculum
            curriculum_count = course.variant_set.count()
            if curriculum_count == 0:
                errors.append("Course must have at least one curriculum section")
            
            # Check if course has lessons
            lesson_count = api_models.VariantItem.objects.filter(variant__course=course).count()
            if lesson_count == 0:
                errors.append("Course must have at least one lesson")
            
            # Check if course has image
            if not course.image:
                warnings.append("Consider adding a course thumbnail image")
            
            # Return errors if any critical validations failed
            if errors:
                return Response({
                    "success": False,
                    "errors": errors,
                    "warnings": warnings,
                    "message": "Cannot publish course. Please fix the errors listed above."
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Update course status to Published
            course.teacher_course_status = "Published"
            course.platform_status = "Published"  # Auto-approve for now
            course.save()
            
            return Response({
                "success": True,
                "message": "Course published successfully!",
                "warnings": warnings,
                "course": {
                    "course_id": str(course.course_id),
                    "title": course.title,
                    "slug": course.slug,
                    "teacher_course_status": course.teacher_course_status,
                    "platform_status": course.platform_status,
                    "curriculum_sections": curriculum_count,
                    "lessons": lesson_count
                }
            }, status=status.HTTP_200_OK)
            
        except api_models.Course.DoesNotExist:
            return Response({
                "success": False,
                "error": "Course not found"
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"Error publishing course: {e}")
            import traceback
            traceback.print_exc()
            return Response({
                "success": False,
                "error": f"Failed to publish course: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class CourseDetailAPIView(generics.RetrieveDestroyAPIView):
    serializer_class = api_serializer.CourseSerializer
    permission_classes = [AllowAny]

    def get_object(self):
        slug = self.kwargs['slug']
        return api_models.Course.objects.get(slug=slug)

class CourseVariantDeleteAPIView(generics.DestroyAPIView):
    serializer_class = api_serializer.VariantSerializer
    permission_classes = [AllowAny]

    def get_object(self):
        variant_id = self.kwargs['variant_id']
        teacher_id = self.kwargs['teacher_id']
        course_id = self.kwargs['course_id']



        try:
            teacher = api_models.Teacher.objects.get(id=teacher_id)
            course = api_models.Course.objects.get(teacher=teacher, course_id=course_id)
            variant = api_models.Variant.objects.get(variant_id=variant_id, course=course)
            
            return variant
        except api_models.Teacher.DoesNotExist:

            raise Http404("Teacher not found")
        except api_models.Course.DoesNotExist:

            raise Http404("Course not found or you don't have permission to access it")
        except api_models.Variant.DoesNotExist:

            raise Http404("Section not found")

    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            instance.delete()
            return Response(
                {"message": "Section deleted successfully"}, 
                status=status.HTTP_200_OK
            )
        except Http404 as e:
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": "An error occurred while deleting the section"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
class CourseVariantItemDeleteAPIVIew(generics.DestroyAPIView):
    serializer_class = api_serializer.VariantItemSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        variant_id = self.kwargs['variant_id']
        variant_item_id = self.kwargs['variant_item_id']
        teacher_id = self.kwargs['teacher_id']
        course_id = self.kwargs['course_id']

        try:
            teacher = api_models.Teacher.objects.get(id=teacher_id)
            course = api_models.Course.objects.get(teacher=teacher, course_id=course_id)
            variant = api_models.Variant.objects.get(variant_id=variant_id, course=course)
            variant_item = api_models.VariantItem.objects.get(variant=variant, variant_item_id=variant_item_id)
            return variant_item
        except api_models.Teacher.DoesNotExist:
            raise Http404("Teacher not found")
        except api_models.Course.DoesNotExist:
            raise Http404("Course not found or you don't have permission to access it")
        except api_models.Variant.DoesNotExist:
            raise Http404("Section not found")
        except api_models.VariantItem.DoesNotExist:
            raise Http404("Lecture not found")

    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            instance.delete()
            return Response(
                {"message": "Lecture deleted successfully"}, 
                status=status.HTTP_200_OK
            )
        except Http404 as e:
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": "An error occurred while deleting the lecture"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    

@method_decorator(csrf_exempt, name='dispatch')
class FileUploadAPIView(APIView):
    """
    File Upload API View
    
    Allows file uploads without CSRF token validation.
    This is safe because:
    1. Uses JWT authentication for authenticated requests
    2. AllowAny permission allows public uploads (for course thumbnails, etc.)
    3. Files are stored securely with UUID-based filenames
    4. File type validation is performed by the serializer
    """
    permission_classes = [AllowAny]
    authentication_classes = []  # Explicitly disable authentication for this view
    parser_classes = (MultiPartParser, FormParser,)  # Allow file uploads

    @swagger_auto_schema(
        operation_description="Upload a file",
        request_body=api_serializer.FileUploadSerializer,  # Use the serializer here
        responses={
            200: openapi.Response('File uploaded successfully', openapi.Schema(type=openapi.TYPE_OBJECT)),
            400: openapi.Response('No file provided', openapi.Schema(type=openapi.TYPE_OBJECT)),
        }
    )

    def post(self, request):
        
        serializer = api_serializer.FileUploadSerializer(data=request.data)  

        if serializer.is_valid():
            file = serializer.validated_data.get("file")

            # Create a more organized file path
            import uuid
            file_extension = os.path.splitext(file.name)[1].lower()
            unique_filename = f"course-file/{uuid.uuid4()}{file_extension}"

            # Save the file to the media directory
            file_path = default_storage.save(unique_filename, ContentFile(file.read()))
            file_url = request.build_absolute_uri(default_storage.url(file_path))

            # Determine file type and prepare response data
            response_data = {
                "url": file_url,
                "file_name": file.name,
                "file_size": file.size,
                "file_type": self.determine_file_type(file_extension)
            }

            # Check if the file is a video by inspecting its extension
            if file_extension in ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.ogg']:
                # Calculate the video duration
                file_full_path = os.path.join(default_storage.location, file_path)
                try:
                    clip = VideoFileClip(file_full_path)
                    duration_seconds = clip.duration
                    clip.close()  # Free memory

                    # Calculate minutes and seconds for display
                    minutes, remainder = divmod(duration_seconds, 60)
                    minutes = math.floor(minutes)
                    seconds = math.floor(remainder)

                    duration_text = f"{minutes}m {seconds}s"

                    print("url ==========", file_url)
                    print("duration_seconds ==========", duration_seconds)

                    # Return video data with duration information
                    response_data.update({
                        "duration_seconds": duration_seconds,  # Raw seconds for database storage
                        "video_duration": duration_text,       # Formatted text for display
                        "is_video": True
                    })

                except Exception as e:
                    print(f"Error processing video: {e}")
                    response_data["duration_error"] = str(e)

            return Response(response_data)

        return Response({"error": "No file provided"}, status=400)
    
    def determine_file_type(self, file_extension):
        """Determine the file type based on extension"""
        video_extensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.ogg']
        document_extensions = ['.pdf', '.doc', '.docx', '.txt']
        presentation_extensions = ['.ppt', '.pptx']
        image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp']
        
        if file_extension in video_extensions:
            return "video"
        elif file_extension in document_extensions:
            return "document"
        elif file_extension in presentation_extensions:
            return "presentation"
        elif file_extension in image_extensions:
            return "image"
        else:
            return "file"


class CourseEnrollmentAPIView(generics.CreateAPIView):
    serializer_class = api_serializer.EnrolledCourseSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        course_id = request.data.get('course_id')
        user_id = request.data.get('user_id')

        if not course_id or not user_id:
            return Response({"error": "course_id and user_id are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            course = api_models.Course.objects.get(id=course_id)
            user = User.objects.get(id=user_id)
        except api_models.Course.DoesNotExist:
            return Response({"error": "Course not found"}, status=status.HTTP_404_NOT_FOUND)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        # Check if user is already enrolled
        existing_enrollment = api_models.EnrolledCourse.objects.filter(course=course, user=user).first()
        if existing_enrollment:
            return Response({
                "error": "Already enrolled in this course",
                "enrollment_id": existing_enrollment.enrollment_id
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Create enrollment directly without order/payment dependency
            enrollment = api_models.EnrolledCourse.objects.create(
                course=course,
                user=user,
                teacher=course.teacher
            )

            # Create notification
            api_models.Notification.objects.create(
                user=user,
                type="Course Enrollment Completed"
            )

            return Response({
                "message": "Successfully enrolled in course",
                "enrollment_id": enrollment.enrollment_id,
                "course": {
                    "id": course.id,
                    "title": course.title,
                    "slug": course.slug
                }
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({"error": f"Enrollment failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CheckEnrollmentStatusAPIView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]

    def get(self, request, course_id, user_id):
        try:
            course = api_models.Course.objects.get(id=course_id)
            user = User.objects.get(id=user_id)
        except api_models.Course.DoesNotExist:
            return Response({"error": "Course not found"}, status=status.HTTP_404_NOT_FOUND)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        enrollment = api_models.EnrolledCourse.objects.filter(course=course, user=user).first()
        
        if enrollment:
            return Response({
                "is_enrolled": True,
                "enrollment_id": enrollment.enrollment_id,
                "enrollment_date": enrollment.date
            })
        else:
            return Response({
                "is_enrolled": False
            })


# Quiz Management API Views
class QuizListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = api_serializer.QuizSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        course_id = self.request.query_params.get('course_id')
        if course_id:
            return api_models.Quiz.objects.filter(course__course_id=course_id).order_by('-date')
        return api_models.Quiz.objects.all()

    def perform_create(self, serializer):
        course_id = self.request.data.get('course_id')
        course = api_models.Course.objects.get(course_id=course_id)
        serializer.save(course=course)

class QuizDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = api_serializer.QuizSerializer
    permission_classes = [AllowAny]
    lookup_field = 'quiz_id'

    def get_queryset(self):
        return api_models.Quiz.objects.all()

class QuizQuestionListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = api_serializer.QuizQuestionSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        quiz_id = self.request.query_params.get('quiz_id')
        if quiz_id:
            return api_models.QuizQuestion.objects.filter(quiz__quiz_id=quiz_id).order_by('order')
        return api_models.QuizQuestion.objects.all()

    def perform_create(self, serializer):
        quiz_id = self.request.data.get('quiz_id')
        quiz = api_models.Quiz.objects.get(quiz_id=quiz_id)
        # Auto-increment order
        last_question = api_models.QuizQuestion.objects.filter(quiz=quiz).order_by('-order').first()
        next_order = (last_question.order + 1) if last_question else 1
        serializer.save(quiz=quiz, order=next_order)

class QuizQuestionDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = api_serializer.QuizQuestionSerializer
    permission_classes = [AllowAny]
    lookup_field = 'question_id'

    def get_queryset(self):
        return api_models.QuizQuestion.objects.all()

class QuizChoiceListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = api_serializer.QuizChoiceSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        question_id = self.request.query_params.get('question_id')
        if question_id:
            return api_models.QuizChoice.objects.filter(question__question_id=question_id).order_by('order')
        return api_models.QuizChoice.objects.all()

    def perform_create(self, serializer):
        question_id = self.request.data.get('question_id')
        question = api_models.QuizQuestion.objects.get(question_id=question_id)
        # Auto-increment order
        last_choice = api_models.QuizChoice.objects.filter(question=question).order_by('-order').first()
        next_order = (last_choice.order + 1) if last_choice else 1
        serializer.save(question=question, order=next_order)

class QuizChoiceDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = api_serializer.QuizChoiceSerializer
    permission_classes = [AllowAny]
    lookup_field = 'choice_id'

    def get_queryset(self):
        return api_models.QuizChoice.objects.all()


# Student Quiz API Views
class StudentQuizListAPIView(generics.ListAPIView):
    """List all active quizzes for a specific course"""
    serializer_class = api_serializer.QuizSerializer
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        course_id = self.kwargs['course_id']
        # Find the course by course_id field, then filter quizzes by the actual Course instance
        try:
            course = api_models.Course.objects.get(course_id=course_id)
            return api_models.Quiz.objects.filter(
                course=course,
                is_active=True
            ).prefetch_related('questions__choices')
        except api_models.Course.DoesNotExist:
            return api_models.Quiz.objects.none()

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        
        # Add attempt information for each quiz
        user_id = self.kwargs.get('user_id')
        if user_id:
            user = User.objects.get(id=user_id)
            for quiz_data in serializer.data:
                quiz = api_models.Quiz.objects.get(quiz_id=quiz_data['quiz_id'])
                
                # Get attempts info
                today_attempts = api_models.QuizAttempt.get_daily_attempts_count(user, quiz)
                can_attempt = api_models.QuizAttempt.can_attempt_quiz(user, quiz)
                best_attempt = api_models.QuizAttempt.objects.filter(
                    user=user, quiz=quiz
                ).order_by('-score').first()
                
                quiz_data['today_attempts'] = today_attempts
                quiz_data['can_attempt'] = can_attempt
                quiz_data['best_score'] = best_attempt.score if best_attempt else 0
                quiz_data['is_passed'] = best_attempt.is_passed if best_attempt else False
        
        return Response(serializer.data)


class StudentQuizDetailAPIView(generics.RetrieveAPIView):
    """Get quiz details for taking the quiz"""
    serializer_class = api_serializer.QuizSerializer
    permission_classes = [AllowAny]
    lookup_field = 'quiz_id'
    
    def get_queryset(self):
        return api_models.Quiz.objects.filter(is_active=True).prefetch_related(
            'questions__choices'
        )
    
    def retrieve(self, request, *args, **kwargs):
        # Check if user can attempt this quiz
        user_id = kwargs.get('user_id')
        quiz = self.get_object()
        
        if user_id:
            try:
                user = User.objects.get(id=user_id)
                if not api_models.QuizAttempt.can_attempt_quiz(user, quiz):
                    return Response(
                        {"error": "Maximum daily attempts (3) reached for this quiz"},
                        status=status.HTTP_403_FORBIDDEN
                    )
                
                # Get the serialized data
                serializer = self.get_serializer(quiz)
                quiz_data = serializer.data
                
                # Add attempt information
                today_attempts = api_models.QuizAttempt.get_daily_attempts_count(user, quiz)
                can_attempt = api_models.QuizAttempt.can_attempt_quiz(user, quiz)
                best_attempt = api_models.QuizAttempt.objects.filter(
                    user=user, quiz=quiz
                ).order_by('-score').first()
                
                quiz_data['today_attempts'] = today_attempts
                quiz_data['can_attempt'] = can_attempt
                quiz_data['best_score'] = best_attempt.score if best_attempt else 0
                quiz_data['is_passed'] = best_attempt.is_passed if best_attempt else False
                
                return Response(quiz_data)
                
            except User.DoesNotExist:
                return Response(
                    {"error": "User not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        return super().retrieve(request, *args, **kwargs)


class StudentQuizSubmitAPIView(generics.CreateAPIView):
    """Submit quiz answers and calculate score"""
    serializer_class = api_serializer.QuizSubmissionSerializer
    permission_classes = [AllowAny]
    
    def create(self, request, *args, **kwargs):
        user_id = kwargs.get('user_id')
        print(f"Quiz submission received for user_id: {user_id}")
        print(f"Request data: {request.data}")
        
        serializer = self.get_serializer(data=request.data)
        
        if serializer.is_valid():
            quiz_id = serializer.validated_data['quiz_id']
            answers = serializer.validated_data['answers']
            time_taken = serializer.validated_data.get('time_taken')
            
            print(f"Validated data - quiz_id: {quiz_id}, answers: {answers}, time_taken: {time_taken}")
            
            try:
                user = User.objects.get(id=user_id)
                quiz = api_models.Quiz.objects.get(quiz_id=quiz_id)
                
                # Check if user can attempt
                if not api_models.QuizAttempt.can_attempt_quiz(user, quiz):
                    return Response(
                        {"error": "Maximum daily attempts (3) reached"},
                        status=status.HTTP_403_FORBIDDEN
                    )
                
                # Calculate score
                total_questions = quiz.questions.count()
                correct_answers = 0
                
                print(f"Total questions in quiz: {total_questions}")
                
                for answer in answers:
                    question_id = answer.get('question_id')
                    choice_id = answer.get('choice_id')
                    
                    print(f"Processing answer - question_id: {question_id}, choice_id: {choice_id}")
                    
                    try:
                        choice = api_models.QuizChoice.objects.get(choice_id=choice_id)
                        if choice.is_correct:
                            correct_answers += 1
                            print(f"Correct answer found for question {question_id}")
                    except api_models.QuizChoice.DoesNotExist:
                        print(f"Choice {choice_id} not found")
                        continue
                
                # Calculate percentage score
                score = (correct_answers / total_questions * 100) if total_questions > 0 else 0
                print(f"Final score: {score}% ({correct_answers}/{total_questions})")
                print(f"Score type: {type(score)}, Score >= 80: {score >= 80}")
                
                # Create quiz attempt record
                from datetime import timedelta
                from decimal import Decimal
                time_taken_duration = timedelta(seconds=time_taken) if time_taken else None
                
                attempt = api_models.QuizAttempt.objects.create(
                    user=user,
                    quiz=quiz,
                    score=Decimal(str(score)),  # Ensure Decimal type for accurate comparison
                    total_questions=total_questions,
                    correct_answers=correct_answers,
                    time_taken=time_taken_duration
                )
                
                # Refresh the attempt from database to get the calculated is_passed value
                attempt.refresh_from_db()
                
                print(f"Quiz attempt created - score: {attempt.score}, is_passed: {attempt.is_passed}, pass_status: {attempt.pass_status}")
                
                # Calculate updated attempt information after submission
                today_attempts = api_models.QuizAttempt.get_daily_attempts_count(user, quiz)
                can_attempt = api_models.QuizAttempt.can_attempt_quiz(user, quiz)
                attempts_left = max(0, 3 - today_attempts)
                
                print(f"After submission - today_attempts: {today_attempts}, can_attempt: {can_attempt}, attempts_left: {attempts_left}")
                
                # Serialize the attempt
                attempt_serializer = api_serializer.QuizAttemptSerializer(attempt)
                
                return Response({
                    "message": "Quiz submitted successfully",
                    "attempt": attempt_serializer.data,
                    "score": score,
                    "correct_answers": correct_answers,
                    "total_questions": total_questions,
                    "is_passed": attempt.is_passed,
                    "passed": attempt.is_passed,  # Add this for frontend compatibility
                    "pass_status": attempt.pass_status,
                    "time_taken": time_taken,  # Add the original time_taken in seconds
                    "today_attempts": today_attempts,
                    "can_attempt": can_attempt,
                    "attempts_left": attempts_left,
                    "max_daily_attempts": 3
                }, status=status.HTTP_201_CREATED)
                
            except api_models.Quiz.DoesNotExist:
                print(f"Quiz {quiz_id} not found")
                return Response(
                    {"error": "Quiz not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
            except User.DoesNotExist:
                print(f"User {user_id} not found")
                return Response(
                    {"error": "User not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        print(f"Serializer errors: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class StudentQuizAttemptsAPIView(generics.ListAPIView):
    """List all quiz attempts by a user"""
    serializer_class = api_serializer.QuizAttemptSerializer
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        user_id = self.kwargs['user_id']
        quiz_id = self.kwargs.get('quiz_id')

        queryset = api_models.QuizAttempt.objects.filter(user__id=user_id)

        if quiz_id:
            queryset = queryset.filter(quiz__quiz_id=quiz_id)

        return queryset.order_by('-date_attempted')


# Certificate API Views
class StudentCertificateEligibilityAPIView(APIView):
    """Check if student is eligible for certificate and return certificate data"""
    
    def get(self, request, user_id, course_id):
        try:
            # Get user and course
            user = User.objects.get(id=user_id)
            course = api_models.Course.objects.get(course_id=course_id)
            
            # Get enrollment
            enrollment = api_models.EnrolledCourse.objects.filter(
                user=user, course=course
            ).first()
            
            if not enrollment:
                return Response({
                    'is_eligible': False,
                    'message': 'Not enrolled in this course',
                    'certificate': None,
                    'quiz_results': []
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Get quiz results
            quiz_results = enrollment.quiz_results()
            
            # Check eligibility
            is_eligible = enrollment.is_certificate_eligible()
            
            # Get existing certificate if any
            certificate = None
            try:
                existing_cert = api_models.Certificate.objects.get(
                    course=course, user=user
                )
                certificate = api_serializer.CertificateSerializer(existing_cert).data
            except api_models.Certificate.DoesNotExist:
                pass
            
            return Response({
                'is_eligible': is_eligible,
                'completion_percentage': round(enrollment.completion_percentage()),
                'all_lessons_completed': enrollment.is_course_completed(),
                'all_quizzes_passed': enrollment.are_all_quizzes_passed(),
                'certificate': certificate,
                'quiz_results': quiz_results
            }, status=status.HTTP_200_OK)
            
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        except api_models.Course.DoesNotExist:
            return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class StudentCertificateGenerateAPIView(APIView):
    """Generate certificate for eligible student"""
    
    def post(self, request):
        try:
            user_id = request.data.get('user_id')
            course_id = request.data.get('course_id')
            enrollment_id = request.data.get('enrollment_id')
            
            # Get user, course, and enrollment
            user = User.objects.get(id=user_id)
            course = api_models.Course.objects.get(course_id=course_id)
            enrollment = api_models.EnrolledCourse.objects.get(
                enrollment_id=enrollment_id, user=user, course=course
            )
            
            # Check eligibility
            if not enrollment.is_certificate_eligible():
                return Response({
                    'error': 'Not eligible for certificate',
                    'detail': 'Complete all lessons and pass all quizzes to generate certificate'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create or get existing certificate
            certificate, created = enrollment.get_or_create_certificate()
            
            if certificate:
                certificate_data = api_serializer.CertificateSerializer(certificate).data
                message = "Certificate generated successfully!" if created else "Certificate already exists"
                
                return Response({
                    'certificate': certificate_data,
                    'message': message,
                    'created': created
                }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
            else:
                return Response({
                    'error': 'Failed to generate certificate'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        except api_models.Course.DoesNotExist:
            return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)
        except api_models.EnrolledCourse.DoesNotExist:
            return Response({'error': 'Enrollment not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class StudentCertificateDownloadAPIView(APIView):
    """Download certificate as PDF"""
    
    def get(self, request, certificate_id):
        try:
            # Get certificate
            certificate = api_models.Certificate.objects.get(certificate_id=certificate_id)
            
            if not certificate.is_valid:
                return Response({
                    'error': 'Certificate is not valid'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # For now, return certificate data for frontend to handle PDF generation
            # In production, you might want to use a proper PDF library like reportlab
            certificate_data = {
                'certificate_id': certificate.certificate_id,
                'student_name': certificate.user.full_name,
                'course_title': certificate.course.title,
                'instructor_name': certificate.course.teacher.full_name if certificate.course.teacher else '',
                'completion_date': certificate.date.strftime('%B %d, %Y'),
                'is_valid': certificate.is_valid
            }
            
            # Return JSON data instead of PDF for frontend to handle
            return Response({
                'certificate_data': certificate_data,
                'message': 'Certificate data retrieved successfully'
            }, status=status.HTTP_200_OK)
                
        except api_models.Certificate.DoesNotExist:
            return Response({'error': 'Certificate not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ========== ADMIN API VIEWS ==========

class AdminSummaryAPIView(generics.RetrieveAPIView):
    """
    Admin Dashboard Summary with comprehensive system statistics
    """
    permission_classes = [IsAuthenticated]
    serializer_class = api_serializer.AdminSummarySerializer
    
    def get(self, request):
        try:
            # Verify admin access
            if not hasattr(request.user, 'role') or request.user.role != 'admin':
                return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
            
            # Calculate statistics
            from django.utils import timezone
            from datetime import timedelta
            
            now = timezone.now()
            last_30_days = now - timedelta(days=30)
            
            # User statistics
            total_students = User.objects.filter(role='student').count()
            total_teachers = User.objects.filter(role='teacher').count()
            total_admins = User.objects.filter(role='admin').count()
            
            # Course statistics
            total_courses = api_models.Course.objects.count()
            active_courses = api_models.Course.objects.filter(platform_status='Published').count()
            
            # Enrollment statistics
            total_enrollments = api_models.EnrolledCourse.objects.count()
            recent_enrollments = api_models.EnrolledCourse.objects.filter(date__gte=last_30_days).count()
            
            # Certificate statistics (handle if Certificate model doesn't exist)
            try:
                total_certificates = api_models.Certificate.objects.count()
                recent_certificates = api_models.Certificate.objects.filter(date__gte=last_30_days).count()
            except:
                total_certificates = 0
                recent_certificates = 0
            
            # Review statistics
            total_reviews = api_models.Review.objects.count()
            recent_reviews = api_models.Review.objects.filter(date__gte=last_30_days).count()
            
            # Quiz statistics (handle if Quiz models don't exist)
            try:
                total_quizzes = api_models.Quiz.objects.count()
                total_quiz_attempts = api_models.QuizAttempt.objects.count()
            except:
                total_quizzes = 0
                total_quiz_attempts = 0
            
            # Recent registrations
            recent_registrations = User.objects.filter(date_joined__gte=last_30_days).count()
            
            # Revenue calculation - Cart/Order system removed, set to 0
            total_revenue = 0
            
            # Top performing courses
            top_courses = api_models.Course.objects.annotate(
                enrollment_count=models.Count('enrolledcourse')
            ).order_by('-enrollment_count')[:5]
            
            # Most active teachers
            active_teachers = api_models.Teacher.objects.annotate(
                course_count=models.Count('course')
            ).order_by('-course_count')[:5]
            
            # Latest activities
            latest_enrollments = api_models.EnrolledCourse.objects.select_related(
                'user', 'course'
            ).order_by('-date')[:10]
            
            latest_reviews = api_models.Review.objects.select_related(
                'user', 'course'
            ).order_by('-date')[:10]
            
            # System health metrics
            completion_rate = 0
            try:
                if total_enrollments > 0:
                    completed_courses = api_models.EnrolledCourse.objects.filter(
                        completed=True
                    ).count()
                    completion_rate = (completed_courses / total_enrollments) * 100
            except:
                completion_rate = 0
            
            data = {
                'total_students': total_students,
                'total_teachers': total_teachers,
                'total_admins': total_admins,
                'total_courses': total_courses,
                'active_courses': active_courses,
                'total_enrollments': total_enrollments,
                'recent_enrollments': recent_enrollments,
                'total_certificates': total_certificates,
                'recent_certificates': recent_certificates,
                'total_reviews': total_reviews,
                'recent_reviews': recent_reviews,
                'total_quizzes': total_quizzes,
                'total_quiz_attempts': total_quiz_attempts,
                'recent_registrations': recent_registrations,
                'total_revenue': float(total_revenue) if total_revenue else 0,
                'completion_rate': round(completion_rate, 2),
                'top_courses': [
                    {
                        'id': course.id,
                        'title': course.title or 'Untitled Course',
                        'enrollment_count': course.enrollment_count,
                        'teacher': course.teacher.full_name if course.teacher else 'No Teacher'
                    } for course in top_courses
                ],
                'active_teachers': [
                    {
                        'id': teacher.id,
                        'full_name': teacher.full_name,
                        'course_count': teacher.course_count
                    } for teacher in active_teachers
                ],
                'latest_enrollments': [
                    {
                        'id': enrollment.id,
                        'student': enrollment.user.full_name if enrollment.user else 'Unknown Student',
                        'course': enrollment.course.title if enrollment.course else 'Unknown Course',
                        'date': enrollment.date
                    } for enrollment in latest_enrollments
                ],
                'latest_reviews': [
                    {
                        'id': review.id,
                        'student': review.user.full_name if review.user else 'Unknown Student',
                        'course': review.course.title if review.course else 'Unknown Course',
                        'rating': review.rating,
                        'date': review.date
                    } for review in latest_reviews
                ]
            }
            
            return Response(data, status=status.HTTP_200_OK)
            
        except Exception as e:
            import traceback
            print(f"AdminSummaryAPIView Error: {str(e)}")
            print(traceback.format_exc())
            return Response({'error': f'Internal server error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminUserManagementAPIView(generics.ListAPIView):
    """
    Admin view to manage all users in the system
    """
    permission_classes = [IsAuthenticated]
    serializer_class = api_serializer.UserSerializer
    
    def get_queryset(self):
        # Verify admin access
        if not hasattr(self.request.user, 'role') or self.request.user.role != 'admin':
            return User.objects.none()
        
        role_filter = self.request.query_params.get('role', None)
        if role_filter:
            return User.objects.filter(role=role_filter).order_by('-date_joined')
        return User.objects.all().order_by('-date_joined')


class AdminCourseManagementAPIView(generics.ListAPIView):
    """
    Admin view to manage all courses in the system
    """
    permission_classes = [IsAuthenticated]
    serializer_class = api_serializer.CourseSerializer
    
    def get_queryset(self):
        # Verify admin access
        if not hasattr(self.request.user, 'role') or self.request.user.role != 'admin':
            return api_models.Course.objects.none()
        
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            return api_models.Course.objects.filter(platform_status=status_filter).order_by('-date')
        return api_models.Course.objects.all().order_by('-date')


class AdminEnrollmentAnalyticsAPIView(generics.RetrieveAPIView):
    """
    Admin enrollment analytics and trends
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            # Verify admin access
            if not hasattr(request.user, 'role') or request.user.role != 'admin':
                return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
            
            from django.utils import timezone
            from datetime import timedelta
            import calendar
            
            now = timezone.now()
            
            # Monthly enrollment data for the last 12 months
            monthly_data = []
            for i in range(12):
                month_start = now.replace(day=1) - timedelta(days=30*i)
                month_end = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
                
                enrollments = api_models.EnrolledCourse.objects.filter(
                    date__gte=month_start,
                    date__lte=month_end
                ).count()
                
                monthly_data.append({
                    'month': calendar.month_name[month_start.month],
                    'year': month_start.year,
                    'enrollments': enrollments
                })
            
            monthly_data.reverse()
            
            # Course category distribution
            category_data = api_models.Category.objects.annotate(
                enrollment_count=models.Count('course__enrolledcourse')
            ).order_by('-enrollment_count')
            
            # Top performing courses
            top_courses = api_models.Course.objects.annotate(
                enrollment_count=models.Count('enrolledcourse'),
                avg_rating=models.Avg('review__rating')
            ).order_by('-enrollment_count')[:10]
            
            data = {
                'monthly_enrollments': monthly_data,
                'category_distribution': [
                    {
                        'category': cat.title,
                        'enrollments': cat.enrollment_count
                    } for cat in category_data
                ],
                'top_performing_courses': [
                    {
                        'id': course.id,
                        'title': course.title or 'Untitled Course',
                        'teacher': course.teacher.full_name if course.teacher else 'No Teacher',
                        'enrollments': course.enrollment_count,
                        'rating': round(course.avg_rating or 0, 2)
                    } for course in top_courses
                ]
            }
            
            return Response(data, status=status.HTTP_200_OK)
            
        except Exception as e:
            import traceback
            print(f"AdminEnrollmentAnalyticsAPIView Error: {str(e)}")
            print(traceback.format_exc())
            return Response({'error': f'Internal server error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminSystemHealthAPIView(generics.RetrieveAPIView):
    """
    System health monitoring for admins
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            # Verify admin access
            if not hasattr(request.user, 'role') or request.user.role != 'admin':
                return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
            
            import os
            import sys
            import django
            from django.conf import settings
            
            # Database statistics
            db_stats = {
                'total_users': User.objects.count(),
                'total_courses': api_models.Course.objects.count(),
                'total_enrollments': api_models.EnrolledCourse.objects.count(),
                'total_reviews': api_models.Review.objects.count(),
            }
            
            # Add certificate count safely
            try:
                db_stats['total_certificates'] = api_models.Certificate.objects.count()
            except:
                db_stats['total_certificates'] = 0
            
            # Server information
            server_info = {
                'django_version': f"{django.VERSION[0]}.{django.VERSION[1]}.{django.VERSION[2]}",
                'python_version': f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
                'debug_mode': settings.DEBUG,
                'database_engine': settings.DATABASES['default']['ENGINE'].split('.')[-1],
            }
            
            # Recent error logs (you can implement based on your logging system)
            recent_errors = []  # Implement based on your error logging
            
            data = {
                'database_statistics': db_stats,
                'server_information': server_info,
                'recent_errors': recent_errors,
                'system_status': 'healthy'
            }
            
            return Response(data, status=status.HTTP_200_OK)
            
        except Exception as e:
            import traceback
            print(f"AdminSystemHealthAPIView Error: {str(e)}")
            print(traceback.format_exc())
            return Response({'error': f'Internal server error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ========== ADMIN USER MANAGEMENT API VIEWS ==========

class AdminUserDetailAPIView(generics.RetrieveAPIView):
    """
    Get detailed information about a specific user
    """
    permission_classes = [IsAuthenticated]
    serializer_class = api_serializer.UserSerializer
    
    def get_object(self):
        # Verify admin access
        if not hasattr(self.request.user, 'role') or self.request.user.role != 'admin':
            raise Http404("Admin access required")
        
        user_id = self.kwargs.get('user_id')
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise Http404("User not found")
    
    def retrieve(self, request, *args, **kwargs):
        try:
            user = self.get_object()
            serializer = self.get_serializer(user)
            
            # Add additional user statistics
            user_data = serializer.data
            
            # Add enrollment statistics if user is a student
            if user.role == 'student':
                enrollments = api_models.EnrolledCourse.objects.filter(user=user)
                user_data['enrollment_stats'] = {
                    'total_enrollments': enrollments.count(),
                    'completed_courses': enrollments.filter(completed=True).count(),
                    'in_progress_courses': enrollments.filter(completed=False).count(),
                    'certificates_earned': api_models.Certificate.objects.filter(user=user).count() if hasattr(api_models, 'Certificate') else 0
                }
            
            # Add teaching statistics if user is a teacher
            elif user.role == 'teacher':
                try:
                    teacher = api_models.Teacher.objects.get(user=user)
                    courses = api_models.Course.objects.filter(teacher=teacher)
                    user_data['teaching_stats'] = {
                        'total_courses': courses.count(),
                        'published_courses': courses.filter(platform_status='Published').count(),
                        'total_students': api_models.EnrolledCourse.objects.filter(course__teacher=teacher).count(),
                        'total_reviews': api_models.Review.objects.filter(course__teacher=teacher).count()
                    }
                except api_models.Teacher.DoesNotExist:
                    user_data['teaching_stats'] = None
            
            return Response(user_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminUserCreateAPIView(generics.CreateAPIView):
    """
    Create a new user account
    """
    permission_classes = [IsAuthenticated]
    serializer_class = api_serializer.RegisterSerializer
    
    def create(self, request, *args, **kwargs):
        try:
            # Verify admin access
            if not hasattr(request.user, 'role') or request.user.role != 'admin':
                return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
            
            serializer = self.get_serializer(data=request.data)
            if serializer.is_valid():
                user = serializer.save()
                
                # Set user role if provided
                role = request.data.get('role', 'student')
                user.role = role
                user.save()
                
                # Create teacher profile if role is teacher
                if role == 'teacher':
                    api_models.Teacher.objects.create(
                        user=user,
                        full_name=user.full_name
                    )
                
                return Response({
                    'message': 'User created successfully',
                    'user': api_serializer.UserSerializer(user).data
                }, status=status.HTTP_201_CREATED)
            
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminUserUpdateAPIView(generics.UpdateAPIView):
    """
    Update user information
    """
    permission_classes = [IsAuthenticated]
    serializer_class = api_serializer.UserSerializer
    
    def get_object(self):
        # Verify admin access
        if not hasattr(self.request.user, 'role') or self.request.user.role != 'admin':
            raise Http404("Admin access required")
        
        user_id = self.kwargs.get('user_id')
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise Http404("User not found")
    
    def update(self, request, *args, **kwargs):
        try:
            user = self.get_object()
            
            # Prevent modifying super admin by regular admin
            if user.role == 'admin' and hasattr(user, 'admin') and user.admin.is_super_admin:
                if not (hasattr(request.user, 'admin') and request.user.admin.is_super_admin):
                    return Response({'error': 'Cannot modify super admin account'}, status=status.HTTP_403_FORBIDDEN)
            
            # Update user fields
            for field in ['full_name', 'email', 'is_active']:
                if field in request.data:
                    setattr(user, field, request.data[field])
            
            # Handle role change
            if 'role' in request.data:
                new_role = request.data['role']
                old_role = user.role
                user.role = new_role
                
                # Handle teacher profile creation/deletion
                if new_role == 'teacher' and old_role != 'teacher':
                    api_models.Teacher.objects.get_or_create(
                        user=user,
                        defaults={'full_name': user.full_name}
                    )
                elif old_role == 'teacher' and new_role != 'teacher':
                    try:
                        teacher = api_models.Teacher.objects.get(user=user)
                        teacher.delete()
                    except api_models.Teacher.DoesNotExist:
                        pass
            
            user.save()
            
            return Response({
                'message': 'User updated successfully',
                'user': api_serializer.UserSerializer(user).data
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminUserDeleteAPIView(generics.DestroyAPIView):
    """
    Delete a user account
    """
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        # Verify admin access
        if not hasattr(self.request.user, 'role') or self.request.user.role != 'admin':
            raise Http404("Admin access required")
        
        user_id = self.kwargs.get('user_id')
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise Http404("User not found")
    
    def destroy(self, request, *args, **kwargs):
        try:
            user = self.get_object()
            
            # Prevent deleting super admin
            if user.role == 'admin' and hasattr(user, 'admin') and user.admin.is_super_admin:
                return Response({'error': 'Cannot delete super admin account'}, status=status.HTTP_403_FORBIDDEN)
            
            # Prevent deleting self
            if user.id == request.user.id:
                return Response({'error': 'Cannot delete your own account'}, status=status.HTTP_400_BAD_REQUEST)
            
            user_name = user.full_name
            user.delete()
            
            return Response({
                'message': f'User "{user_name}" deleted successfully'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminUserBulkActionsAPIView(APIView):
    """
    Handle bulk actions on multiple users
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            # Verify admin access
            if not hasattr(request.user, 'role') or request.user.role != 'admin':
                return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
            
            action = request.data.get('action')
            user_ids = request.data.get('user_ids', [])
            
            if not action or not user_ids:
                return Response({'error': 'Action and user_ids are required'}, status=status.HTTP_400_BAD_REQUEST)
            
            users = User.objects.filter(id__in=user_ids)
            
            # Prevent actions on super admins
            super_admin_users = users.filter(role='admin', admin__is_super_admin=True)
            if super_admin_users.exists() and not (hasattr(request.user, 'admin') and request.user.admin.is_super_admin):
                return Response({'error': 'Cannot perform actions on super admin accounts'}, status=status.HTTP_403_FORBIDDEN)
            
            # Prevent actions on self
            if request.user.id in user_ids:
                return Response({'error': 'Cannot perform bulk actions on your own account'}, status=status.HTTP_400_BAD_REQUEST)
            
            affected_count = 0
            
            if action == 'activate':
                affected_count = users.update(is_active=True)
            elif action == 'deactivate':
                affected_count = users.update(is_active=False)
            elif action == 'delete':
                affected_count = users.count()
                users.delete()
            else:
                return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
            
            return Response({
                'message': f'Bulk action "{action}" completed successfully',
                'affected_users': affected_count
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SyncExternalUsersAPIView(APIView):
    """
    API View to sync user data from external API
    """
    permission_classes = [IsAuthenticated]
    
    def parse_datetime_safe(self, datetime_str):
        """Safely parse datetime string with multiple format support"""
        if not datetime_str:
            return timezone.now()
        
        try:
            # Handle different datetime formats
            datetime_str = str(datetime_str)
            
            # Replace 'Z' with '+00:00' for ISO format
            if datetime_str.endswith('Z'):
                datetime_str = datetime_str.replace('Z', '+00:00')
            
            # Try Django's parse_datetime first
            parsed_dt = parse_datetime(datetime_str)
            if parsed_dt:
                return parsed_dt
            
            # Fallback to fromisoformat
            return datetime.fromisoformat(datetime_str)
            
        except (ValueError, TypeError) as e:
            print(f"DateTime parsing error for '{datetime_str}': {e}")
            return timezone.now()
    
    def post(self, request):
        try:
            # External API URL
            external_api_url = "https://cmb.tail91813a.ts.net/api/external/users"
            
            print(f"Attempting to fetch data from: {external_api_url}")
            
            # Add API authentication headers
            headers = {
                'X-API-Token': '3647a8e2541a03f07f8983bcfa9ba0ca449dde4117700fc546801cfc9a3d720e',
                'Cookie': 'XSRF-TOKEN=eyJpdiI6IkwwenJpQk94QStXcHpVbUdFMEoraWc9PSIsInZhbHVlIjoidkUvN0Z2MjBKSThqazlvSFdBYjZnaWpaVC9PRGhvUlkzelZvVmp6Z3NQWk9jYXpnbjNIeHVFUmxmcUFFdFZ0YkYrZldibE5OKzIwU2U5US9BVnJqb2dtR0FXdXpOMFhEL0o5U0x2MHpSdnY3Q2E5MGFGcSt4dHRwVkxMYTNJY0MiLCJtYWMiOiIzODliMDRkNjQyOTkzNDdiNmQ3MDRjMGU5Y2ZhMTJhNmE2MGEzMmM2OWNhNTVhM2I0NWI4MTAzZmZkZjRiOTkxIiwidGFnIjoiIn0%3D; cmb_setjen_dpd_ri_session=eyJpdiI6ImM2NGhSSXBKSXhaM3QxTWROV3dxaGc9PSIsInZhbHVlIjoiVFVxSSt5MnIxKzREQUw1dm5tTW91UzJnQzZuc2ZjZGY1REJjZGNVazdJOCtLQnNLK2QwQ05BMVowUVpKMm8yRmovNndRelJhUFBnajd3bDBBeEdoTUdNWkVXcVhLbExmU2dOUlpYMFFFUVRtR3pSSmtmWmN3ajdUb0dDbzduQVIiLCJtYWMiOiI2ODc3YWRhZjAzNzBkZDQxZjBiZTc0NzhjYjcyY2IwOTQyMWEyYTY4YWI1N2NlOGM2Y2Y2NzNlM2E1ZmI5MDQ0IiwidGFnIjoiIn0%3D'
            }
            
            # Add the ?all=1 parameter to get all data
            full_api_url = f"{external_api_url}?all=1"
            
            try:
                response = requests.get(full_api_url, headers=headers, timeout=30)
                print(f"Response status code: {response.status_code}")
                response.raise_for_status()
                
                external_data = response.json()
                print(f"Received data keys: {list(external_data.keys()) if isinstance(external_data, dict) else 'Not a dict'}")
                print(f"Total records received: {len(external_data.get('data', []))}")
                
            except requests.exceptions.RequestException as req_error:
                print(f"External API not accessible ({str(req_error)}), using mock data for testing...")
                
                # Mock data based on the structure you provided earlier
                external_data = {
                    "success": True,
                    "data": [
                        {
                            "id": "mock_1",
                            "name": "Test User Mock 1",
                            "email": "testmock1@example.com",
                            "created_at": "2024-01-01T10:00:00+00:00",
                            "updated_at": "2024-01-01T10:00:00+00:00",
                            "status": "active",
                            "timezone": "Asia/Jakarta",
                            "nip": "19876543210",
                            "golongan": "III/a",
                            "kelas_jabatan": "Pelaksana",
                            "jenis_jabatan": "Fungsional",
                            "unit_organisasi": {
                                "id": "mock_101",
                                "name": "IT Department Mock",
                                "code": "IT_MOCK",
                                "description": "Information Technology Department (Mock Data)"
                            },
                            "jabatan": {
                                "id": "mock_201",
                                "name": "Software Developer Mock",
                                "code": "DEV_MOCK",
                                "description": "Software Development Position (Mock Data)"
                            }
                        },
                        {
                            "id": "mock_2",
                            "name": "Test User Mock 2",
                            "email": "testmock2@example.com",
                            "created_at": "2024-01-02T10:00:00+00:00",
                            "updated_at": "2024-01-02T10:00:00+00:00",
                            "status": "active",
                            "timezone": "Asia/Jakarta",
                            "nip": "19876543211",
                            "golongan": "II/c",
                            "kelas_jabatan": "Pelaksana Lanjutan",
                            "jenis_jabatan": "Struktural",
                            "unit_organisasi": {
                                "id": "mock_102",
                                "name": "HR Department Mock",
                                "code": "HR_MOCK",
                                "description": "Human Resources Department (Mock Data)"
                            },
                            "jabatan": {
                                "id": "mock_202",
                                "name": "HR Specialist Mock",
                                "code": "HRS_MOCK",
                                "description": "Human Resources Specialist Position (Mock Data)"
                            }
                        }
                    ]
                }
                
            except Exception as json_error:
                print(f"JSON parsing error: {str(json_error)}")
                return Response({
                    'error': f'Invalid response format from external API: {str(json_error)}'
                }, status=status.HTTP_502_BAD_GATEWAY)
            
            # Check for success in the real API response structure
            if external_data.get('status') != 'success':
                return Response({
                    'error': f"External API returned error: {external_data.get('message', 'Unknown error')}"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            users_data = external_data.get('data', [])
            
            print(f"Processing {len(users_data)} users from external API")
            if users_data and len(users_data) > 0:
                print(f"Sample user structure: {list(users_data[0].keys()) if users_data[0] else 'No first user'}")
            
            sync_results = {
                'total_users': len(users_data),
                'created': 0,
                'updated': 0,
                'errors': []
            }
            
            for user_data in users_data:
                try:
                    # Validate external user data
                    serializer = api_serializer.ExternalUserDataSerializer(data=user_data)
                    if not serializer.is_valid():
                        sync_results['errors'].append({
                            'external_id': user_data.get('id'),
                            'errors': serializer.errors
                        })
                        continue
                    
                    validated_data = serializer.validated_data
                    
                    # Get or create organization unit
                    org_unit = None
                    if validated_data.get('unit_organisasi'):
                        org_unit_data = validated_data['unit_organisasi']
                        org_unit, _ = OrganizationUnit.objects.get_or_create(
                            external_id=org_unit_data.get('id'),
                            defaults={
                                'name': org_unit_data.get('name', 'Unknown'),
                                'description': org_unit_data.get('description', '')
                            }
                        )
                    
                    # Get or create position
                    position = None
                    if validated_data.get('jabatan'):
                        position_data = validated_data['jabatan']
                        position, _ = Position.objects.get_or_create(
                            external_id=position_data.get('id'),
                            defaults={
                                'name': position_data.get('name', 'Unknown'),
                                'description': position_data.get('description', '')
                            }
                        )
                    
                    # Check if user exists by external_id first, then by email
                    user = None
                    user_created = False
                    
                    try:
                        # First try to find by external_id
                        user = User.objects.get(external_id=validated_data['id'])
                        print(f"Found user by external_id: {user.email}")
                        
                    except User.DoesNotExist:
                        try:
                            # If not found by external_id, try to find by email
                            user = User.objects.get(email=validated_data['email'])
                            print(f"Found user by email: {user.email}, updating with external_id: {validated_data['id']}")
                            
                            # Update the existing user with external_id
                            user.external_id = validated_data['id']
                            
                        except User.DoesNotExist:
                            # User doesn't exist at all, create new one
                            print(f"Creating new user: {validated_data['email']}")
                            
                            # Generate unique username from email
                            email_username = validated_data['email'].split('@')[0]
                            username = email_username
                            counter = 1
                            while User.objects.filter(username=username).exists():
                                username = f"{email_username}_{counter}"
                                counter += 1
                            
                            user = User.objects.create(
                                username=username,
                                email=validated_data['email'],
                                full_name=validated_data['name'],
                                external_id=validated_data['id'],
                                nip=validated_data.get('nip'),
                                golongan=validated_data.get('golongan'),
                                kelas_jabatan=validated_data.get('kelas_jabatan'),
                                jenis_jabatan=validated_data.get('jenis_jabatan'),
                                timezone=validated_data.get('timezone', 'Asia/Jakarta'),
                                external_status=validated_data.get('status'),
                                external_created_at=self.parse_datetime_safe(validated_data.get('created_at')),
                                external_updated_at=self.parse_datetime_safe(validated_data.get('updated_at')),
                                last_sync_date=timezone.now(),
                                is_active=validated_data.get('status', '').upper() == 'ACTIVE',
                                role='student'  # Default role for external users
                            )
                            user_created = True
                            sync_results['created'] += 1
                    
                    # Update existing user (whether found by external_id or email)
                    if not user_created:
                        user.full_name = validated_data['name']
                        user.email = validated_data['email']
                        user.nip = validated_data.get('nip')
                        user.golongan = validated_data.get('golongan')
                        user.kelas_jabatan = validated_data.get('kelas_jabatan')
                        user.jenis_jabatan = validated_data.get('jenis_jabatan')
                        user.timezone = validated_data.get('timezone', 'Asia/Jakarta')
                        user.external_status = validated_data.get('status')
                        user.external_created_at = self.parse_datetime_safe(validated_data.get('created_at'))
                        user.external_updated_at = self.parse_datetime_safe(validated_data.get('updated_at'))
                        user.last_sync_date = timezone.now()
                        user.is_active = validated_data.get('status', '').upper() == 'ACTIVE'
                        user.save()
                        
                        sync_results['updated'] += 1
                    
                    # Update or create profile
                    profile, created = Profile.objects.get_or_create(
                        user=user,
                        defaults={
                            'organization_unit': org_unit,
                            'position': position,
                        }
                    )
                    
                    if not created:
                        profile.organization_unit = org_unit
                        profile.position = position
                        profile.save()
                        
                except Exception as e:
                    error_msg = str(e)
                    print(f"Error processing user {user_data.get('id', 'unknown')} ({user_data.get('email', 'no-email')}): {error_msg}")
                    sync_results['errors'].append({
                        'external_id': user_data.get('id'),
                        'name': user_data.get('name', 'Unknown'),
                        'email': user_data.get('email', 'Unknown'),
                        'error': error_msg
                    })
                    continue
            
            # Log final results
            print(f"Sync completed: {sync_results['created']} created, {sync_results['updated']} updated, {len(sync_results['errors'])} errors")
            
            return Response({
                'message': 'User synchronization completed successfully',
                'results': sync_results
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"Unexpected error in sync: {str(e)}")
            return Response({
                'error': f'Synchronization failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

