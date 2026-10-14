import os
import json
import zipfile
import xml.etree.ElementTree as ET
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse, HttpResponseForbidden
from django.views.decorators.http import require_POST, require_GET
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from django.utils import timezone
from django.conf import settings

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.parsers import MultiPartParser, FormParser

from api import models as api_models
from api.serializer import LearningModuleSerializer, UserProgressSerializer


class UploadElearningModuleAPIView(APIView):
    """
    API View untuk mengunggah paket e-learning SCORM 1.2 (.zip) atau H5P (.h5p).
    Mendukung upload hingga 500MB dengan ekstraksi otomatis dan deteksi manifest.
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response(
                {"error": "File paket e-learning (.zip atau .h5p) wajib diunggah."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validasi ekstensi
        ext = os.path.splitext(file_obj.name)[1].lower()
        if ext not in ['.zip', '.h5p']:
            return Response(
                {"error": "Format file tidak didukung. Harap unggah paket SCORM 1.2 (.zip) atau H5P (.h5p)."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validasi batas ukuran 500MB
        max_size = 500 * 1024 * 1024  # 500MB
        if file_obj.size > max_size:
            return Response(
                {"error": "Ukuran file melebihi batas maksimal 500MB."},
                status=status.HTTP_400_BAD_REQUEST
            )

        judul = request.data.get('title') or request.data.get('judul')
        deskripsi = request.data.get('description') or request.data.get('deskripsi', '')
        module_type = request.data.get('module_type')
        course_id = request.data.get('course_id')

        # Auto-deteksi tipe modul jika tidak ditentukan secara eksplisit
        if not module_type:
            if ext == '.h5p':
                module_type = 'h5p'
            else:
                module_type = 'scorm_12'

        # Auto-extract judul dari file jika tidak diisi
        if not judul:
            base_name = os.path.splitext(file_obj.name)[0]
            judul = base_name.replace('_', ' ').replace('-', ' ').title()

        course_obj = None
        if course_id:
            course_obj = api_models.Course.objects.filter(course_id=course_id).first()
            if not course_obj and str(course_id).isdigit():
                course_obj = api_models.Course.objects.filter(id=course_id).first()

        try:
            learning_module = api_models.LearningModule.objects.create(
                judul=judul,
                deskripsi=deskripsi,
                module_type=module_type,
                file_zip=file_obj,
                course=course_obj,
                author=request.user
            )

            # Jika berhasil diekstrak dan memiliki judul di imsmanifest.xml, update judul
            if module_type == 'scorm_12' and learning_module.extracted_path:
                extract_full_path = os.path.join(settings.MEDIA_ROOT, learning_module.extracted_path)
                manifest_path = os.path.join(extract_full_path, 'imsmanifest.xml')
                if os.path.exists(manifest_path):
                    try:
                        tree = ET.parse(manifest_path)
                        root = tree.getroot()
                        title_elem = root.find('.//{*}title')
                        if title_elem is not None and title_elem.text and not request.data.get('title'):
                            learning_module.judul = title_elem.text.strip()
                            learning_module.save(update_fields=['judul'])
                    except Exception as e:
                        print(f"[SCORM] Manifest title parse warning: {e}")

            serializer = LearningModuleSerializer(learning_module, context={'request': request})
            return Response({
                "message": f"Modul {learning_module.get_module_type_display()} berhasil diunggah dan diekstrak.",
                "module": serializer.data,
                "module_id": learning_module.id,
                "player_url": learning_module.player_url,
                "entry_file": learning_module.entry_file,
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                {"error": f"Gagal memproses dan mengekstrak paket: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SCORMTrackingAPIView(APIView):
    """
    API endpoint untuk menerima tracking status (LMSSetValue & LMSCommit) dari SCORM 1.2
    maupun interaksi H5P (xAPI / state completion).
    Mendukung JWT maupun Session/Cookie CSRF authentication.
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def post(self, request, module_id):
        learning_module = get_object_or_404(api_models.LearningModule, pk=module_id)

        try:
            if isinstance(request.data, dict):
                data = request.data
            else:
                data = json.loads(request.body.decode('utf-8'))
        except Exception:
            data = request.data or {}

        lesson_status = data.get('lesson_status')
        score_raw = data.get('score') or data.get('score_raw')
        lesson_location = data.get('lesson_location')
        session_time = data.get('session_time')
        suspend_data = data.get('suspend_data')
        course_id = data.get('course_id') or (learning_module.course_id if learning_module.course else None)
        variant_item_id = data.get('variant_item_id')

        # Dapatkan record progress user
        progress, created = api_models.UserProgress.objects.get_or_create(
            user=request.user,
            learning_module=learning_module,
            defaults={'lesson_status': 'incomplete'}
        )

        if course_id and not progress.course_id:
            course = api_models.Course.objects.filter(id=course_id).first()
            if not course:
                course = api_models.Course.objects.filter(course_id=course_id).first()
            if course:
                progress.course = course

        if variant_item_id and not progress.variant_item_id:
            variant_item = api_models.VariantItem.objects.filter(id=variant_item_id).first()
            if not variant_item:
                variant_item = api_models.VariantItem.objects.filter(variant_item_id=variant_item_id).first()
            if variant_item:
                progress.variant_item = variant_item

        # Update field jika dikirim
        is_completed_now = False
        if lesson_status:
            norm_status = str(lesson_status).lower()
            valid_statuses = dict(api_models.UserProgress.LESSON_STATUS_CHOICES)
            if norm_status in valid_statuses:
                progress.lesson_status = norm_status
                if norm_status in ['passed', 'completed']:
                    is_completed_now = True
                    if not progress.completed_at:
                        progress.completed_at = timezone.now()

        if score_raw is not None:
            try:
                progress.score_raw = float(score_raw)
            except (ValueError, TypeError):
                pass

        if lesson_location is not None:
            progress.lesson_location = str(lesson_location)[:255]

        if session_time is not None:
            progress.session_time = str(session_time)[:50]

        if suspend_data is not None:
            progress.suspend_data = str(suspend_data)

        progress.save()

        # Seamless LMS Integration: jika status passed/completed dan terhubung dengan course & variant_item,
        # otomatis buatkan CompletedLesson agar persentase kursus dan sertifikat ASN terupdate!
        if is_completed_now and progress.course:
            target_variant_item = progress.variant_item
            if not target_variant_item:
                target_variant_item = api_models.VariantItem.objects.filter(
                    learning_module=learning_module
                ).first()

            if target_variant_item:
                api_models.CompletedLesson.objects.get_or_create(
                    user=request.user,
                    course=progress.course,
                    variant_item=target_variant_item,
                    defaults={'date': timezone.now()}
                )

        return Response({
            "status": "success",
            "module_id": learning_module.id,
            "lesson_status": progress.lesson_status,
            "score_raw": progress.score_raw,
            "lesson_location": progress.lesson_location,
            "completed": progress.lesson_status in ['passed', 'completed']
        }, status=status.HTTP_200_OK)


class ModuleDetailAPIView(APIView):
    """
    Mengambil detail modul dan status progress user saat ini untuk render player SPA.
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request, module_id):
        module = get_object_or_404(api_models.LearningModule, pk=module_id)
        progress = api_models.UserProgress.objects.filter(
            user=request.user,
            learning_module=module
        ).first()

        module_data = LearningModuleSerializer(module, context={'request': request}).data
        progress_data = UserProgressSerializer(progress).data if progress else {
            "lesson_status": "not attempted",
            "score_raw": 0.0,
            "lesson_location": "",
            "session_time": "00:00:00",
            "suspend_data": ""
        }

        return Response({
            "module": module_data,
            "progress": progress_data
        }, status=status.HTTP_200_OK)

    def delete(self, request, module_id):
        """
        Menghapus modul dan berkas fisik (ZIP & folder ekstraksi) dari disk dan database.
        Mencegah penumpukan file orphan yang gagal atau dibatalkan oleh pengguna.
        """
        module = get_object_or_404(api_models.LearningModule, pk=module_id)

        # Validasi kepemilikan
        if module.author != request.user and not request.user.is_staff:
            return Response(
                {"error": "Anda tidak memiliki izin untuk menghapus modul ini."},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            if module.file_zip and hasattr(module.file_zip, 'path') and os.path.exists(module.file_zip.path):
                os.remove(module.file_zip.path)

            if module.extracted_path:
                full_extract_path = os.path.join(settings.MEDIA_ROOT, module.extracted_path)
                if os.path.exists(full_extract_path) and os.path.abspath(full_extract_path).startswith(os.path.abspath(settings.MEDIA_ROOT)):
                    import shutil
                    shutil.rmtree(full_extract_path, ignore_errors=True)
        except Exception as e:
            print(f"[LearningModule Delete] Warning cleaning up disk files: {e}")

        module.delete()
        return Response({
            "message": "Modul dan berkas fisik berhasil dibersihkan dari server."
        }, status=status.HTTP_200_OK)



@login_required
@ensure_csrf_cookie
@require_GET
def scorm_player_view(request, module_id):
    """
    Standalone Django HTML Player view untuk SCORM 1.2 dengan window.API wrapper.
    """
    module = get_object_or_404(api_models.LearningModule, pk=module_id)
    progress, _ = api_models.UserProgress.objects.get_or_create(
        user=request.user,
        learning_module=module,
        defaults={
            'lesson_status': 'incomplete',
            'lesson_location': '',
            'suspend_data': ''
        }
    )

    context = {
        'module': module,
        'progress': progress,
        'user': request.user,
    }
    return render(request, 'scorm/module_player.html', context)
