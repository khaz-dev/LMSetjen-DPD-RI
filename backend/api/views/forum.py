import os
from django.db.models import Q, Count, F
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.authentication import JWTAuthentication

from api import models as api_models
from api import serializer as api_serializer


class ForumCategoryListAPIView(generics.ListAPIView):
    """
    List active Forum Categories (Rumpun Jabatan / Kompetensi).
    Publicly accessible, displays topic and reply counts.
    """
    serializer_class = api_serializer.ForumCategorySerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        return (
            api_models.ForumCategory.objects.filter(is_active=True)
            .annotate(
                annotated_topics_count=Count('topics', distinct=True),
                annotated_posts_count=Count('topics__replies', distinct=True)
            )
            .order_by('order', 'name')
        )


class ForumTopicListCreateAPIView(generics.ListCreateAPIView):
    """
    List forum topics or create a new topic.
    Supports filtering by category, search query, status, and sorting.
    """
    serializer_class = api_serializer.ForumTopicSerializer
    authentication_classes = [JWTAuthentication]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = (
            api_models.ForumTopic.objects.select_related('category', 'user', 'user__profile')
            .prefetch_related('likes', 'replies', 'replies__likes')
            .annotate(
                annotated_replies_count=Count('replies', distinct=True),
                annotated_likes_count=Count('likes', distinct=True)
            )
        )

        # Filter by Category (slug or ID)
        category_param = self.request.query_params.get('category')
        if category_param and category_param != 'all':
            if str(category_param).isdigit():
                queryset = queryset.filter(category_id=category_param)
            else:
                queryset = queryset.filter(category__slug=category_param)

        # Search Query
        search = self.request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(content__icontains=search) |
                Q(category__name__icontains=search) |
                Q(user__full_name__icontains=search) |
                Q(user__username__icontains=search)
            )

        # Status Filter
        filter_status = self.request.query_params.get('filter')
        if filter_status == 'solved':
            queryset = queryset.filter(is_solved=True)
        elif filter_status == 'unanswered':
            queryset = queryset.filter(annotated_replies_count=0)
        elif filter_status == 'pinned':
            queryset = queryset.filter(is_pinned=True)
        elif filter_status == 'my_topics':
            if self.request.user and self.request.user.is_authenticated:
                queryset = queryset.filter(user=self.request.user)
            else:
                return api_models.ForumTopic.objects.none()
        elif filter_status == 'my_participated':
            if self.request.user and self.request.user.is_authenticated:
                queryset = queryset.filter(
                    Q(user=self.request.user) | Q(replies__user=self.request.user)
                ).distinct()
            else:
                return api_models.ForumTopic.objects.none()

        # Sorting
        sort = self.request.query_params.get('sort', 'newest')
        if sort == 'popular':
            queryset = queryset.order_by('-is_pinned', '-annotated_likes_count', '-views_count', '-created_at')
        elif sort == 'active':
            queryset = queryset.order_by('-is_pinned', '-updated_at', '-created_at')
        elif sort == 'oldest':
            queryset = queryset.order_by('-is_pinned', 'created_at')
        else:  # newest
            queryset = queryset.order_by('-is_pinned', '-created_at')

        return queryset

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        user = request.user if (request.user and request.user.is_authenticated) else None
        if not user:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        category_id = data.get('category')
        if not category_id:
            return Response({'error': 'Kategori/Rumpun wajib dipilih'}, status=status.HTTP_400_BAD_REQUEST)

        title = data.get('title', '').strip()
        content = data.get('content', '').strip()
        if not title:
            return Response({'error': 'Judul topik tidak boleh kosong'}, status=status.HTTP_400_BAD_REQUEST)
        if not content:
            return Response({'error': 'Konten topik tidak boleh kosong'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if str(category_id).isdigit():
                category = api_models.ForumCategory.objects.get(id=category_id)
            else:
                category = api_models.ForumCategory.objects.get(slug=category_id)
        except api_models.ForumCategory.DoesNotExist:
            return Response({'error': 'Kategori/Rumpun tidak valid'}, status=status.HTTP_400_BAD_REQUEST)

        topic = api_models.ForumTopic.objects.create(
            category=category,
            user=user,
            title=title,
            content=content,
            file=request.FILES.get('file'),
            file_name=data.get('file_name', '')
        )

        serializer = api_serializer.ForumTopicSerializer(topic, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ForumTopicDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update or delete a specific forum topic.
    Increments views count upon retrieval.
    """
    serializer_class = api_serializer.ForumTopicSerializer
    authentication_classes = [JWTAuthentication]
    lookup_field = 'topic_id'

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return api_models.ForumTopic.objects.select_related(
            'category', 'user', 'user__profile'
        ).prefetch_related('replies', 'likes')

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        # Increment views counter atomically
        api_models.ForumTopic.objects.filter(pk=instance.pk).update(views_count=F('views_count') + 1)
        instance.refresh_from_db()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.user != request.user and not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Anda tidak memiliki hak untuk mengubah topik ini'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.user != request.user and not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Anda tidak memiliki hak untuk menghapus topik ini'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class ForumTopicReplyCreateAPIView(generics.CreateAPIView):
    """
    Submit a reply to a forum topic.
    """
    serializer_class = api_serializer.ForumTopicMessageSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def create(self, request, *args, **kwargs):
        topic_id = self.kwargs.get('topic_id') or request.data.get('topic_id')
        message_text = request.data.get('message', '').strip()

        if not message_text:
            return Response({'error': 'Pesan balasan tidak boleh kosong'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            topic = api_models.ForumTopic.objects.get(topic_id=topic_id)
        except api_models.ForumTopic.DoesNotExist:
            return Response({'error': 'Topik tidak ditemukan'}, status=status.HTTP_404_NOT_FOUND)

        if topic.is_locked:
            return Response({'error': 'Topik ini telah dikunci dan tidak menerima balasan baru'}, status=status.HTTP_400_BAD_REQUEST)

        reply = api_models.ForumTopicMessage.objects.create(
            topic=topic,
            user=request.user,
            message=message_text,
            file=request.FILES.get('file'),
            file_name=request.data.get('file_name', '')
        )

        # Touch topic updated_at
        topic.updated_at = timezone.now()
        topic.save(update_fields=['updated_at'])

        serializer = api_serializer.ForumTopicMessageSerializer(reply, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ForumTopicLikeToggleAPIView(generics.GenericAPIView):
    """
    Toggle like on a forum topic.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, topic_id):
        try:
            topic = api_models.ForumTopic.objects.get(topic_id=topic_id)
        except api_models.ForumTopic.DoesNotExist:
            return Response({'error': 'Topik tidak ditemukan'}, status=status.HTTP_404_NOT_FOUND)

        like_obj = api_models.ForumTopicLike.objects.filter(topic=topic, user=request.user).first()
        if like_obj:
            like_obj.delete()
            liked = False
        else:
            api_models.ForumTopicLike.objects.create(topic=topic, user=request.user)
            liked = True

        total_likes = topic.likes.count()
        return Response({'liked': liked, 'total_likes': total_likes}, status=status.HTTP_200_OK)


class ForumTopicReplyLikeToggleAPIView(generics.GenericAPIView):
    """
    Toggle like on a forum reply message.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, message_id):
        try:
            message = api_models.ForumTopicMessage.objects.get(message_id=message_id)
        except api_models.ForumTopicMessage.DoesNotExist:
            return Response({'error': 'Balasan tidak ditemukan'}, status=status.HTTP_404_NOT_FOUND)

        like_obj = api_models.ForumTopicMessageLike.objects.filter(message=message, user=request.user).first()
        if like_obj:
            like_obj.delete()
            liked = False
        else:
            api_models.ForumTopicMessageLike.objects.create(message=message, user=request.user)
            liked = True

        total_likes = message.likes.count()
        return Response({'liked': liked, 'total_likes': total_likes}, status=status.HTTP_200_OK)


class ForumTopicToggleSolutionAPIView(generics.GenericAPIView):
    """
    Toggle accepted solution for a reply.
    Only topic owner, staff, or instructor can mark as solution.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, message_id):
        try:
            message = api_models.ForumTopicMessage.objects.select_related('topic').get(message_id=message_id)
        except api_models.ForumTopicMessage.DoesNotExist:
            return Response({'error': 'Balasan tidak ditemukan'}, status=status.HTTP_404_NOT_FOUND)

        topic = message.topic
        is_owner = topic.user == request.user
        is_authorized = is_owner or request.user.is_staff or request.user.is_superuser or getattr(request.user, 'is_instructor', False)

        if not is_authorized:
            return Response({'error': 'Hanya pembuat topik atau instruktur yang dapat menandai solusi'}, status=status.HTTP_403_FORBIDDEN)

        # Toggle solution state
        message.is_solution = not message.is_solution
        message.save(update_fields=['is_solution'])

        # Check if topic now has any solution
        has_any_solution = topic.replies.filter(is_solution=True).exists()
        topic.is_solved = has_any_solution
        topic.save(update_fields=['is_solved'])

        return Response({
            'is_solution': message.is_solution,
            'topic_is_solved': topic.is_solved,
            'message': 'Status solusi berhasil diperbarui'
        }, status=status.HTTP_200_OK)


class StudentAggregatedCourseDiscussionsAPIView(generics.ListAPIView):
    """
    Get aggregated course discussions/Q&A for students across enrolled courses (or all accessible courses).
    Supports filters:
    - course_id: specific course ShortUUID or PK
    - search: search keyword
    - filter: all | solved | unanswered | my_questions | my_participated
    - sort: newest | popular | oldest
    """
    serializer_class = api_serializer.Question_AnswerSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = (
            api_models.Question_Answer.objects.select_related(
                'course', 'user', 'user__profile', 'variant_item', 'variant_item__variant'
            )
            .prefetch_related('likes', 'reply_messages', 'reply_messages__user', 'reply_messages__likes')
        )

        # Enrolled courses limit: If student, show discussions from their enrolled courses (or all if not strictly restricted)
        enrolled_course_ids = api_models.EnrolledCourse.objects.filter(user=user).values_list('course_id', flat=True)
        if enrolled_course_ids:
            queryset = queryset.filter(course_id__in=enrolled_course_ids)

        # Filter by specific course
        course_param = self.request.query_params.get('course_id')
        if course_param and course_param != 'all':
            if str(course_param).isdigit():
                queryset = queryset.filter(course_id=course_param)
            else:
                queryset = queryset.filter(course__course_id=course_param)

        # Search Query
        search = self.request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(course__title__icontains=search) |
                Q(variant_item__title__icontains=search) |
                Q(user__full_name__icontains=search) |
                Q(user__username__icontains=search) |
                Q(reply_messages__message__icontains=search)
            ).distinct()

        # Filter Status
        filter_status = self.request.query_params.get('filter')
        if filter_status == 'solved':
            queryset = queryset.filter(is_solved=True)
        elif filter_status == 'unanswered':
            # replied messages only has original message (count <= 1)
            queryset = queryset.annotate(msg_count=Count('reply_messages')).filter(msg_count__lte=1)
        elif filter_status == 'pinned':
            queryset = queryset.filter(is_pinned=True)
        elif filter_status == 'my_questions':
            queryset = queryset.filter(user=user)
        elif filter_status == 'my_participated':
            queryset = queryset.filter(
                Q(user=user) | Q(reply_messages__user=user)
            ).distinct()

        # Sorting
        sort = self.request.query_params.get('sort', 'newest')
        if sort == 'popular':
            queryset = queryset.annotate(like_cnt=Count('likes')).order_by('-is_pinned', '-like_cnt', '-date')
        elif sort == 'oldest':
            queryset = queryset.order_by('-is_pinned', 'date')
        else:  # newest
            queryset = queryset.order_by('-is_pinned', '-date')

        return queryset

