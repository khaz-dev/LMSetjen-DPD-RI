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


def is_internal_setjen_user(user):
    """
    Check if a user is an internal employee of Sekretariat Jenderal DPD RI
    or has privileged staff/admin access.
    """
    if not user or not user.is_authenticated:
        return False
    return bool(
        getattr(user, 'is_internal', False) or 
        getattr(user, 'user_type', '') == 'INTERNAL' or 
        user.is_staff or 
        user.is_superuser or 
        (user.email and user.email.lower().endswith('@dpd.go.id'))
    )


def is_admin_or_staff(user):
    """
    Check if a user is an Administrator or Staff with system management rights.
    Note: Instructors do NOT have moderation rights in the general Learning Forum;
    in the Learning Forum, there are only regular participants and Admins.
    Instructors only moderate discussions in their own specific courses.
    """
    if not user or not user.is_authenticated:
        return False
    return bool(
        user.is_staff or 
        user.is_superuser or 
        getattr(user, 'is_admin', False) or
        getattr(user, 'current_role', '') == 'admin' or
        getattr(user, 'role', '') == 'admin' or
        (hasattr(user, 'has_role') and user.has_role('admin'))
    )


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
            .prefetch_related('likes', 'bookmarks', 'replies', 'replies__likes')
            .annotate(
                annotated_replies_count=Count('replies', distinct=True),
                annotated_likes_count=Count('likes', distinct=True),
                annotated_bookmarks_count=Count('bookmarks', distinct=True)
            )
        )

        # Enforce Visibility: Topics marked 'internal_setjen' can only be seen by Setjen DPD RI employees
        if not is_internal_setjen_user(self.request.user):
            queryset = queryset.filter(visibility='public')

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

        # Status & Special Filter
        filter_status = self.request.query_params.get('filter')
        if filter_status == 'solved':
            queryset = queryset.filter(is_solved=True)
        elif filter_status == 'unanswered':
            queryset = queryset.filter(annotated_replies_count=0)
        elif filter_status == 'pinned':
            queryset = queryset.filter(is_pinned=True)
        elif filter_status == 'bookmarked':
            if self.request.user and self.request.user.is_authenticated:
                queryset = queryset.filter(bookmarks__user=self.request.user)
            else:
                return api_models.ForumTopic.objects.none()
        elif filter_status == 'internal':
            queryset = queryset.filter(visibility='internal_setjen')
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

        visibility = data.get('visibility', 'public')
        if visibility == 'internal_setjen' and not is_internal_setjen_user(user):
            return Response({'error': 'Hanya pegawai internal Setjen DPD RI yang dapat membuat topik dengan akses khusus internal'}, status=status.HTTP_403_FORBIDDEN)
        if visibility not in ['public', 'internal_setjen']:
            visibility = 'public'

        topic = api_models.ForumTopic.objects.create(
            category=category,
            user=user,
            title=title,
            content=content,
            visibility=visibility,
            file=request.FILES.get('file'),
            file_name=data.get('file_name', '')
        )

        # Process Mini-Poll if submitted with new topic
        poll_question = data.get('poll_question', '').strip()
        poll_options = data.get('poll_options')
        if poll_question and poll_options:
            if isinstance(poll_options, str):
                try:
                    import json
                    poll_options = json.loads(poll_options)
                except Exception:
                    poll_options = [opt.strip() for opt in poll_options.split('\n') if opt.strip()]
            if isinstance(poll_options, list):
                valid_options = [str(o).strip() for o in poll_options if str(o).strip()]
                if len(valid_options) >= 2:
                    poll = api_models.ForumPoll.objects.create(topic=topic, question=poll_question)
                    for idx, opt_text in enumerate(valid_options):
                        api_models.ForumPollOption.objects.create(poll=poll, option_text=opt_text, order=idx)

        # Gamification reward: award points for initiating a discussion topic
        try:
            api_models.StudentPoints.add_points(
                user=user,
                points=5,
                category='forum_topic_create',
                description=f"Membuat topik diskusi forum: {title[:50]}"
            )
        except Exception:
            pass

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
        if instance.visibility == 'internal_setjen' and not is_internal_setjen_user(request.user):
            return Response({'error': 'Topik ini khusus untuk internal pegawai Setjen DPD RI'}, status=status.HTTP_403_FORBIDDEN)
        # Increment views counter atomically
        api_models.ForumTopic.objects.filter(pk=instance.pk).update(views_count=F('views_count') + 1)
        instance.refresh_from_db()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        # Hanya pembuat topik yang berhak mengedit konten topik miliknya
        if instance.user != request.user:
            return Response({'error': 'Anda hanya dapat mengedit topik milik Anda sendiri'}, status=status.HTTP_403_FORBIDDEN)

        data = request.data.copy()
        
        # Support updating category either via id or slug if provided
        category_val = data.get('category')
        if category_val:
            try:
                if str(category_val).isdigit():
                    category_obj = api_models.ForumCategory.objects.get(id=category_val)
                else:
                    category_obj = api_models.ForumCategory.objects.get(slug=category_val)
                instance.category = category_obj
            except api_models.ForumCategory.DoesNotExist:
                pass

        title = data.get('title', '').strip()
        if title:
            instance.title = title

        content = data.get('content', '').strip()
        if content:
            instance.content = content

        visibility = data.get('visibility')
        if visibility in ['public', 'internal_setjen']:
            if visibility == 'internal_setjen' and not is_internal_setjen_user(request.user):
                return Response({'error': 'Hanya pegawai internal Setjen DPD RI yang dapat mengatur akses khusus internal'}, status=status.HTTP_403_FORBIDDEN)
            instance.visibility = visibility

        # Optional new file attachment
        if 'file' in request.FILES:
            instance.file = request.FILES.get('file')
            instance.file_name = data.get('file_name', instance.file.name)

        instance.updated_at = timezone.now()
        instance.save()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        is_owner = instance.user == request.user
        is_admin = is_admin_or_staff(request.user)
        if not is_owner and not is_admin:
            return Response({'error': 'Hanya pembuat topik atau Administrator yang dapat menghapus topik ini'}, status=status.HTTP_403_FORBIDDEN)
        instance.delete()
        return Response({'message': 'Topik diskusi berhasil dihapus'}, status=status.HTTP_200_OK)


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

        # Create in-app notification for topic owner if replier is someone else
        if topic.user and topic.user != request.user:
            try:
                author_name = request.user.full_name or request.user.username or "Rekan Pembelajar"
                topic_snippet = f"'{topic.title[:50]}...'" if len(topic.title) > 50 else f"'{topic.title}'"
                api_models.Notification.objects.create(
                    user=topic.user,
                    type="Forum Reply",
                    title="Tanggapan Baru di Forum Pembelajaran",
                    message=f"{author_name} memberikan tanggapan baru pada topik Anda: {topic_snippet}.",
                )
            except Exception:
                pass

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


class ForumTopicBookmarkToggleAPIView(generics.GenericAPIView):
    """
    Toggle bookmark / simpan favorit untuk topik forum pembelajaran.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, topic_id):
        try:
            topic = api_models.ForumTopic.objects.get(topic_id=topic_id)
        except api_models.ForumTopic.DoesNotExist:
            return Response({'error': 'Topik tidak ditemukan'}, status=status.HTTP_404_NOT_FOUND)

        bookmark_obj = api_models.ForumTopicBookmark.objects.filter(topic=topic, user=request.user).first()
        if bookmark_obj:
            bookmark_obj.delete()
            bookmarked = False
        else:
            api_models.ForumTopicBookmark.objects.create(topic=topic, user=request.user)
            bookmarked = True

        total_bookmarks = topic.bookmarks.count()
        return Response({'bookmarked': bookmarked, 'total_bookmarks': total_bookmarks}, status=status.HTTP_200_OK)


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
        is_admin = is_admin_or_staff(request.user)

        if not is_owner and not is_admin:
            return Response({'error': 'Hanya pembuat topik atau Administrator yang dapat menandai solusi'}, status=status.HTTP_403_FORBIDDEN)

        # Toggle solution state
        message.is_solution = not message.is_solution
        message.save(update_fields=['is_solution'])

        # Check if topic now has any solution
        has_any_solution = topic.replies.filter(is_solution=True).exists()
        topic.is_solved = has_any_solution
        topic.save(update_fields=['is_solved'])

        # Notify reply author if marked as accepted solution & award reputation points
        if message.is_solution and message.user and message.user != request.user:
            try:
                # Award 20 gamification points to solution author
                api_models.StudentPoints.add_points(
                    user=message.user,
                    points=20,
                    category='forum_solution_marked',
                    description=f"Jawaban ditandai sebagai solusi terbaik: {topic.title[:50]}"
                )
            except Exception:
                pass

            try:
                marker_name = request.user.full_name or request.user.username or "Pembuat Topik"
                topic_snippet = f"'{topic.title[:50]}...'" if len(topic.title) > 50 else f"'{topic.title}'"
                api_models.Notification.objects.create(
                    user=message.user,
                    type="Forum Solution",
                    title="Jawaban Anda Ditandai Sebagai Solusi! (+20 XP)",
                    message=f"Tanggapan Anda pada topik {topic_snippet} telah ditandai sebagai Solusi Terbaik oleh {marker_name}. Anda memperoleh +20 Poin Pembelajar!",
                )
            except Exception:
                pass

        return Response({
            'is_solution': message.is_solution,
            'topic_is_solved': topic.is_solved,
            'message': 'Status solusi berhasil diperbarui'
        }, status=status.HTTP_200_OK)


class ForumTopicMessageDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update or delete a specific forum reply message.
    """
    serializer_class = api_serializer.ForumTopicMessageSerializer
    authentication_classes = [JWTAuthentication]
    lookup_field = 'message_id'

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return api_models.ForumTopicMessage.objects.select_related('topic', 'user', 'user__profile')

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        # Hanya pembuat balasan yang dapat mengedit tanggapannya sendiri
        if instance.user != request.user:
            return Response({'error': 'Anda hanya dapat mengedit tanggapan yang Anda tulis sendiri'}, status=status.HTTP_403_FORBIDDEN)

        if instance.topic.is_locked:
            return Response({'error': 'Topik ini telah dikunci sehingga balasan tidak dapat diedit lagi'}, status=status.HTTP_400_BAD_REQUEST)

        message_text = request.data.get('message', '').strip()
        if not message_text:
            return Response({'error': 'Pesan balasan tidak boleh kosong'}, status=status.HTTP_400_BAD_REQUEST)

        instance.message = message_text
        instance.updated_at = timezone.now()
        instance.save(update_fields=['message', 'updated_at'])

        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        is_owner = instance.user == request.user
        is_admin = is_admin_or_staff(request.user)
        if not is_owner and not is_admin:
            return Response({'error': 'Hanya pembuat tanggapan atau Administrator yang dapat menghapus tanggapan ini'}, status=status.HTTP_403_FORBIDDEN)

        topic = instance.topic
        was_solution = instance.is_solution
        instance.delete()

        # If deleted message was solution, check if topic still has any solution
        if was_solution:
            topic.is_solved = topic.replies.filter(is_solution=True).exists()
            topic.save(update_fields=['is_solved'])

        return Response({'message': 'Tanggapan berhasil dihapus'}, status=status.HTTP_200_OK)


class ForumTopicTogglePinAPIView(generics.GenericAPIView):
    """
    Toggle pinned status for a forum topic.
    Allowed EXCLUSIVELY for Administrators / Staff.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, topic_id):
        if not is_admin_or_staff(request.user):
            return Response({'error': 'Hanya Administrator/Pengelola yang dapat menyematkan topik di Forum Pembelajaran'}, status=status.HTTP_403_FORBIDDEN)

        try:
            topic = api_models.ForumTopic.objects.get(topic_id=topic_id)
        except api_models.ForumTopic.DoesNotExist:
            return Response({'error': 'Topik tidak ditemukan'}, status=status.HTTP_404_NOT_FOUND)

        topic.is_pinned = not topic.is_pinned
        topic.save(update_fields=['is_pinned'])

        return Response({
            'is_pinned': topic.is_pinned,
            'message': 'Topik berhasil disematkan di bagian atas' if topic.is_pinned else 'Sematkan topik dibatalkan'
        }, status=status.HTTP_200_OK)


class ForumTopicToggleLockAPIView(generics.GenericAPIView):
    """
    Toggle locked status for a forum topic.
    Allowed for Topic Author (to close finished discussions) and Administrators (for moderation).
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, topic_id):
        try:
            topic = api_models.ForumTopic.objects.get(topic_id=topic_id)
        except api_models.ForumTopic.DoesNotExist:
            return Response({'error': 'Topik tidak ditemukan'}, status=status.HTTP_404_NOT_FOUND)

        is_owner = topic.user == request.user
        is_admin = is_admin_or_staff(request.user)

        if not is_owner and not is_admin:
            return Response({'error': 'Hanya pembuat topik atau Administrator yang dapat mengunci atau membuka kunci topik ini'}, status=status.HTTP_403_FORBIDDEN)

        topic.is_locked = not topic.is_locked
        topic.save(update_fields=['is_locked'])

        return Response({
            'is_locked': topic.is_locked,
            'message': 'Topik berhasil dikunci. Diskusi ditutup.' if topic.is_locked else 'Topik berhasil dibuka kembali'
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

        # Enrolled courses limit: If student, show discussions from their enrolled courses (or all if staff/admin)
        if not is_admin_or_staff(user):
            enrolled_course_ids = api_models.EnrolledCourse.objects.filter(user=user).values_list('course_id', flat=True)
            if enrolled_course_ids:
                queryset = queryset.filter(course_id__in=enrolled_course_ids)
            else:
                return api_models.Question_Answer.objects.none()

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


class ForumLeaderboardAPIView(generics.GenericAPIView):
    """
    Returns top contributors in the Learning Forum based on verified solutions,
    total replies, and topics created.
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        from django.contrib.auth import get_user_model
        User = get_user_model()

        contributors = (
            User.objects.filter(
                Q(forum_replies__isnull=False) | Q(forum_topics__isnull=False)
            )
            .distinct()
            .annotate(
                solutions_count=Count('forum_replies', filter=Q(forum_replies__is_solution=True), distinct=True),
                replies_count=Count('forum_replies', distinct=True),
                topics_count=Count('forum_topics', distinct=True),
            )
            .select_related('profile')
            .order_by('-solutions_count', '-replies_count', '-topics_count')[:10]
        )

        leaderboard_data = []
        for rank, user in enumerate(contributors, start=1):
            profile = getattr(user, 'profile', None)
            avatar_url = ""
            if profile and profile.image:
                try:
                    avatar_url = profile.image.url
                except Exception:
                    avatar_url = ""

            full_name = ""
            if profile and profile.full_name:
                full_name = profile.full_name
            elif hasattr(user, 'full_name') and user.full_name:
                full_name = user.full_name
            else:
                full_name = user.username

            position_name = getattr(profile, 'position_name', '') or getattr(profile, 'organization_unit_name', '') or 'Pegawai Setjen DPD RI'

            # Calculate forum score (Solutions weighted x20, topics x5, replies x2)
            score = (user.solutions_count * 20) + (user.topics_count * 5) + (user.replies_count * 2)

            leaderboard_data.append({
                "rank": rank,
                "user_id": user.id,
                "full_name": full_name,
                "avatar": avatar_url,
                "position_name": position_name,
                "organization_unit_name": getattr(profile, 'organization_unit_name', ''),
                "solutions_count": user.solutions_count,
                "replies_count": user.replies_count,
                "topics_count": user.topics_count,
                "score": score,
            })

        return Response(leaderboard_data, status=status.HTTP_200_OK)


class ForumPollVoteAPIView(generics.GenericAPIView):
    """
    Submit or update a vote in a Forum Mini-Poll (1 vote per user).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, poll_id, *args, **kwargs):
        user = request.user
        option_id = request.data.get('option_id')
        if not option_id:
            return Response({'error': 'Pilihan opsi voting wajib ditentukan'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            poll = api_models.ForumPoll.objects.select_related('topic').get(id=poll_id)
        except api_models.ForumPoll.DoesNotExist:
            return Response({'error': 'Polling tidak ditemukan'}, status=status.HTTP_404_NOT_FOUND)

        if poll.is_closed or poll.topic.is_locked:
            return Response({'error': 'Polling ini telah ditutup'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            option = api_models.ForumPollOption.objects.get(id=option_id, poll=poll)
        except api_models.ForumPollOption.DoesNotExist:
            return Response({'error': 'Opsi tidak valid untuk polling ini'}, status=status.HTTP_400_BAD_REQUEST)

        # Update or create vote
        api_models.ForumPollVote.objects.update_or_create(
            poll=poll,
            user=user,
            defaults={'option': option}
        )

        serializer = api_serializer.ForumPollSerializer(poll, context={'request': request})
        return Response({
            'message': 'Suara Anda berhasil dicatat!',
            'poll': serializer.data
        }, status=status.HTTP_200_OK)


class ForumPollToggleCloseAPIView(generics.GenericAPIView):
    """
    Toggle lock / close on a Forum Poll (Topic Owner or Admin only).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, poll_id, *args, **kwargs):
        try:
            poll = api_models.ForumPoll.objects.select_related('topic').get(id=poll_id)
        except api_models.ForumPoll.DoesNotExist:
            return Response({'error': 'Polling tidak ditemukan'}, status=status.HTTP_404_NOT_FOUND)

        is_owner = poll.topic.user == request.user
        is_admin = is_admin_or_staff(request.user)
        if not (is_owner or is_admin):
            return Response({'error': 'Anda tidak memiliki hak untuk menutup/membuka polling ini'}, status=status.HTTP_403_FORBIDDEN)

        poll.is_closed = not poll.is_closed
        poll.save(update_fields=['is_closed'])

        return Response({
            'is_closed': poll.is_closed,
            'message': 'Polling telah ditutup' if poll.is_closed else 'Polling kembali dibuka'
        }, status=status.HTTP_200_OK)


class ForumReportCreateAPIView(generics.CreateAPIView):
    """
    Submit a report for inappropriate content, spam, or ethics violation in forum.
    """
    serializer_class = api_serializer.ForumReportSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        user = request.user
        topic_id = request.data.get('topic_id')
        message_id = request.data.get('message_id')
        reason = request.data.get('reason')
        description = request.data.get('description', '').strip()

        if not reason:
            return Response({'error': 'Alasan pelaporan wajib dipilih'}, status=status.HTTP_400_BAD_REQUEST)

        topic = None
        message = None

        if message_id:
            try:
                if str(message_id).isdigit():
                    message = api_models.ForumTopicMessage.objects.get(id=message_id)
                else:
                    message = api_models.ForumTopicMessage.objects.get(message_id=message_id)
                topic = message.topic
            except api_models.ForumTopicMessage.DoesNotExist:
                return Response({'error': 'Tanggapan yang dilaporkan tidak ditemukan'}, status=status.HTTP_404_NOT_FOUND)

            # Prevent reporting own message
            if message.user == user:
                return Response({'error': 'Anda tidak dapat melaporkan tanggapan Anda sendiri'}, status=status.HTTP_400_BAD_REQUEST)

            # Prevent duplicate pending report from same user
            existing = api_models.ForumReport.objects.filter(
                reporter=user, message=message, status='pending'
            ).first()
            if existing:
                return Response({
                    'message': 'Laporan Anda sedang dalam antrean tinjauan oleh Admin.',
                    'already_reported': True,
                    'report': {
                        'id': existing.id,
                        'reason': existing.reason,
                        'reason_display': existing.get_reason_display(),
                        'description': existing.description,
                        'status': existing.status,
                        'status_display': existing.get_status_display(),
                        'admin_notes': existing.admin_notes,
                        'created_at': existing.created_at,
                        'updated_at': existing.updated_at,
                    }
                }, status=status.HTTP_200_OK)

        elif topic_id:
            try:
                if str(topic_id).isdigit():
                    topic = api_models.ForumTopic.objects.get(id=topic_id)
                else:
                    topic = api_models.ForumTopic.objects.get(topic_id=topic_id)
            except api_models.ForumTopic.DoesNotExist:
                return Response({'error': 'Topik yang dilaporkan tidak ditemukan'}, status=status.HTTP_404_NOT_FOUND)

            # Prevent reporting own topic
            if topic.user == user:
                return Response({'error': 'Anda tidak dapat melaporkan topik Anda sendiri'}, status=status.HTTP_400_BAD_REQUEST)

            existing = api_models.ForumReport.objects.filter(
                reporter=user, topic=topic, message__isnull=True, status='pending'
            ).first()
            if existing:
                return Response({
                    'message': 'Laporan Anda sedang dalam antrean tinjauan oleh Admin.',
                    'already_reported': True,
                    'report': {
                        'id': existing.id,
                        'reason': existing.reason,
                        'reason_display': existing.get_reason_display(),
                        'description': existing.description,
                        'status': existing.status,
                        'status_display': existing.get_status_display(),
                        'admin_notes': existing.admin_notes,
                        'created_at': existing.created_at,
                        'updated_at': existing.updated_at,
                    }
                }, status=status.HTTP_200_OK)
        else:
            return Response({'error': 'Target laporan (Topik atau Balasan) wajib ditentukan'}, status=status.HTTP_400_BAD_REQUEST)

        report = api_models.ForumReport.objects.create(
            reporter=user,
            topic=topic,
            message=message,
            reason=reason,
            description=description,
            status='pending'
        )

        # Notify Admin / Staff
        try:
            from userauths.models import User as AuthUser
            admins = AuthUser.objects.filter(Q(is_superuser=True) | Q(is_staff=True) | Q(role='admin'))[:5]
            for admin_user in admins:
                target_desc = f"Balasan pada #{topic.topic_id}" if message else f"Topik #{topic.topic_id}"
                api_models.Notification.objects.create(
                    user=admin_user,
                    type='moderation',
                    title='Laporan Konten Forum Pembelajaran',
                    content=f"Pengguna {user.username} melaporkan {target_desc} karena: {report.get_reason_display()}"
                )
        except Exception:
            pass

        return Response({
            'message': 'Terima kasih atas laporan Anda. Pengelola forum akan segera meninjau konten terkait.',
            'report_id': report.id,
            'report': {
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
        }, status=status.HTTP_201_CREATED)


class ForumReportCancelAPIView(generics.GenericAPIView):
    """
    Allow a reporter to cancel/withdraw their pending report
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        try:
            report = api_models.ForumReport.objects.get(id=pk, reporter=user)
        except api_models.ForumReport.DoesNotExist:
            return Response({'error': 'Laporan tidak ditemukan atau Anda tidak memiliki akses.'}, status=status.HTTP_404_NOT_FOUND)

        if report.status != 'pending':
            return Response({'error': 'Laporan yang telah diproses oleh Admin tidak dapat dibatalkan.'}, status=status.HTTP_400_BAD_REQUEST)

        report.delete()
        return Response({'message': 'Laporan aduan Anda berhasil dibatalkan.'}, status=status.HTTP_200_OK)


class AdminForumReportsListAPIView(generics.ListAPIView):
    """
    List all reports submitted for Forum Pembelajaran (Topics & Messages).
    Accessible only to Administrators and Staff.
    Supports status filters, target type filters, and keyword search.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = api_serializer.AdminForumReportSerializer
    pagination_class = None

    def list(self, request, *args, **kwargs):
        if not is_admin_or_staff(request.user):
            return Response(
                {'error': 'Akses khusus Administrator atau Pengelola Forum.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        user = self.request.user
        if not is_admin_or_staff(user):
            return api_models.ForumReport.objects.none()

        status_filter = self.request.query_params.get('status', '').strip()
        target_type = self.request.query_params.get('type', '').strip()
        search_query = self.request.query_params.get('search', '').strip()

        queryset = api_models.ForumReport.objects.all().select_related(
            'reporter',
            'reporter__profile',
            'topic',
            'topic__category',
            'topic__user',
            'topic__user__profile',
            'message',
            'message__user',
            'message__user__profile'
        ).order_by('-created_at')

        if status_filter and status_filter != 'all':
            queryset = queryset.filter(status=status_filter)

        if target_type == 'topic':
            queryset = queryset.filter(message__isnull=True)
        elif target_type == 'message':
            queryset = queryset.filter(message__isnull=False)

        if search_query:
            queryset = queryset.filter(
                Q(topic__title__icontains=search_query) |
                Q(topic__topic_id__icontains=search_query) |
                Q(message__message__icontains=search_query) |
                Q(reporter__username__icontains=search_query) |
                Q(reporter__full_name__icontains=search_query) |
                Q(description__icontains=search_query) |
                Q(reason__icontains=search_query)
            )

        return queryset


class AdminForumReportDetailAPIView(generics.RetrieveUpdateAPIView):
    """
    Retrieve, update, and moderate individual reports submitted for Forum Pembelajaran.
    Supports updating status ('reviewed', 'resolved', 'dismissed'), admin notes,
    and executing direct moderation actions ('lock_topic', 'unlock_topic', 'delete_message', 'delete_topic').
    """
    permission_classes = [IsAuthenticated]
    serializer_class = api_serializer.AdminForumReportSerializer

    def get_object(self):
        report_id = self.kwargs.get('report_id') or self.kwargs.get('pk')
        try:
            return api_models.ForumReport.objects.select_related(
                'reporter',
                'topic',
                'message'
            ).get(id=report_id)
        except api_models.ForumReport.DoesNotExist:
            return None

    def retrieve(self, request, *args, **kwargs):
        if not is_admin_or_staff(request.user):
            return Response(
                {'error': 'Akses khusus Administrator.'},
                status=status.HTTP_403_FORBIDDEN
            )
        instance = self.get_object()
        if not instance:
            return Response({'error': 'Laporan tidak ditemukan'}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        if not is_admin_or_staff(request.user):
            return Response(
                {'error': 'Akses khusus Administrator.'},
                status=status.HTTP_403_FORBIDDEN
            )

        report = self.get_object()
        if not report:
            return Response({'error': 'Laporan tidak ditemukan'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        new_status = data.get('status')
        admin_notes = data.get('admin_notes')
        action = data.get('action')

        if new_status:
            report.status = new_status
        if admin_notes is not None:
            report.admin_notes = admin_notes

        # Execute direct moderation actions if provided
        action_performed_msg = ""
        if action == 'lock_topic' and report.topic:
            report.topic.is_locked = True
            report.topic.save(update_fields=['is_locked'])
            report.status = 'resolved'
            action_performed_msg = "Topik berhasil dikunci dan laporan diselesaikan."
            note_append = f"\n[Admin {request.user.username}]: Mengunci topik #{report.topic.topic_id}"
            report.admin_notes = (report.admin_notes or '') + note_append

        elif action == 'unlock_topic' and report.topic:
            report.topic.is_locked = False
            report.topic.save(update_fields=['is_locked'])
            action_performed_msg = "Topik berhasil dibuka kembali."
            note_append = f"\n[Admin {request.user.username}]: Membuka kunci topik #{report.topic.topic_id}"
            report.admin_notes = (report.admin_notes or '') + note_append

        elif action == 'delete_message' and report.message:
            msg = report.message
            msg_id = msg.message_id
            msg.delete()
            report.status = 'resolved'
            action_performed_msg = "Balasan yang dilaporkan berhasil dihapus dari forum dan laporan diselesaikan."
            note_append = f"\n[Admin {request.user.username}]: Menghapus balasan #{msg_id}"
            report.admin_notes = (report.admin_notes or '') + note_append

        elif action == 'delete_topic' and report.topic:
            topic = report.topic
            topic_code = topic.topic_id
            topic.delete()
            report.status = 'resolved'
            action_performed_msg = "Topik yang dilaporkan berhasil dihapus dari forum dan laporan diselesaikan."
            note_append = f"\n[Admin {request.user.username}]: Menghapus topik #{topic_code}"
            report.admin_notes = (report.admin_notes or '') + note_append

        report.save()

        serializer = self.get_serializer(report)
        return Response({
            'message': action_performed_msg or 'Status laporan moderasi berhasil diperbarui.',
            'report': serializer.data
        }, status=status.HTTP_200_OK)


class AdminForumCategoryListCreateAPIView(generics.ListCreateAPIView):
    """
    List all Forum Categories (active & inactive) or create a new Category.
    Restricted to Administrator and Staff.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = api_serializer.ForumCategorySerializer
    pagination_class = None

    def list(self, request, *args, **kwargs):
        if not is_admin_or_staff(request.user):
            return Response({'error': 'Akses khusus Administrator.'}, status=status.HTTP_403_FORBIDDEN)
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        if not is_admin_or_staff(request.user):
            return Response({'error': 'Akses khusus Administrator.'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def get_queryset(self):
        if not is_admin_or_staff(self.request.user):
            return api_models.ForumCategory.objects.none()
        return (
            api_models.ForumCategory.objects.all()
            .annotate(
                annotated_topics_count=Count('topics', distinct=True),
                annotated_posts_count=Count('topics__replies', distinct=True)
            )
            .order_by('order', 'name')
        )


class AdminForumCategoryDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, Update, or Delete a Forum Category.
    Restricted to Administrator and Staff.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = api_serializer.ForumCategorySerializer
    lookup_field = 'id'

    def get_queryset(self):
        if not is_admin_or_staff(self.request.user):
            return api_models.ForumCategory.objects.none()
        return api_models.ForumCategory.objects.all().annotate(
            annotated_topics_count=Count('topics', distinct=True),
            annotated_posts_count=Count('topics__replies', distinct=True)
        )

    def retrieve(self, request, *args, **kwargs):
        if not is_admin_or_staff(request.user):
            return Response({'error': 'Akses khusus Administrator.'}, status=status.HTTP_403_FORBIDDEN)
        return super().retrieve(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not is_admin_or_staff(request.user):
            return Response({'error': 'Akses khusus Administrator.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not is_admin_or_staff(request.user):
            return Response({'error': 'Akses khusus Administrator.'}, status=status.HTTP_403_FORBIDDEN)
        instance = self.get_object()
        topics_count = instance.topics.count()
        if topics_count > 0:
            return Response(
                {'error': f'Rumpun ini masih memiliki {topics_count} topik aktif. Pindahkan atau hapus topik terlebih dahulu sebelum menghapus rumpun ini.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        instance.delete()
        return Response({'message': 'Rumpun forum berhasil dihapus.'}, status=status.HTTP_200_OK)


class AdminForumTopicListAPIView(generics.ListAPIView):
    """
    List all Forum Topics for Administrator audit and moderation.
    Supports filtering by category, status (pinned, locked, solved), and keyword search.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = api_serializer.ForumTopicSerializer
    pagination_class = None

    def list(self, request, *args, **kwargs):
        if not is_admin_or_staff(request.user):
            return Response({'error': 'Akses khusus Administrator.'}, status=status.HTTP_403_FORBIDDEN)
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        user = self.request.user
        if not is_admin_or_staff(user):
            return api_models.ForumTopic.objects.none()

        category_id = self.request.query_params.get('category_id')
        status_filter = self.request.query_params.get('status')
        search_query = self.request.query_params.get('search', '').strip()

        queryset = (
            api_models.ForumTopic.objects.select_related('category', 'user', 'user__profile')
            .prefetch_related('replies', 'likes', 'bookmarks')
            .annotate(
                annotated_replies_count=Count('replies', distinct=True),
                annotated_likes_count=Count('likes', distinct=True)
            )
            .order_by('-is_pinned', '-updated_at', '-created_at')
        )

        if category_id and category_id != 'all':
            if str(category_id).isdigit():
                queryset = queryset.filter(category_id=category_id)
            else:
                queryset = queryset.filter(category__slug=category_id)

        if status_filter == 'pinned':
            queryset = queryset.filter(is_pinned=True)
        elif status_filter == 'locked':
            queryset = queryset.filter(is_locked=True)
        elif status_filter == 'solved':
            queryset = queryset.filter(is_solved=True)

        if search_query:
            queryset = queryset.filter(
                Q(title__icontains=search_query) |
                Q(content__icontains=search_query) |
                Q(topic_id__icontains=search_query) |
                Q(user__full_name__icontains=search_query) |
                Q(user__username__icontains=search_query)
            )

        return queryset




