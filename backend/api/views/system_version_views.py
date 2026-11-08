import os
import re
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.utils import timezone
from django.db.models import Q

from api import models as api_models
from api import serializer as api_serializer
from api.permissions import IsAdminUser
from api.version import get_current_app_version, APP_NAME


def parse_semver(version_str: str):
    """Parse version string into (major, minor, patch) integers."""
    clean = re.sub(r'^[vV]', '', str(version_str).strip())
    match = re.match(r'^(\d+)\.(\d+)(?:\.(\d+))?', clean)
    if match:
        major = int(match.group(1))
        minor = int(match.group(2))
        patch = int(match.group(3)) if match.group(3) is not None else 0
        return major, minor, patch
    return 1, 0, 0


def bump_version(current_ver: str, bump_type: str = 'patch') -> str:
    """Calculate next version string based on bump type."""
    major, minor, patch = parse_semver(current_ver)
    if bump_type == 'major':
        return f"{major + 1}.0.0"
    elif bump_type == 'minor':
        return f"{major}.{minor + 1}.0"
    else:  # patch
        return f"{major}.{minor}.{patch + 1}"


class SystemVersionPublicAPIView(generics.GenericAPIView):
    """
    Public lightweight endpoint returning active LMS version and identity.
    Used across headers, footers, and feedback dialogs.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        current_ver = get_current_app_version()
        current_release = api_models.SystemRelease.objects.filter(is_current=True).first()
        
        return Response({
            "success": True,
            "version": current_ver,
            "version_label": f"{APP_NAME} v{current_ver}",
            "app_name": APP_NAME,
            "release_title": current_release.title if current_release else "Rilis Stabil LMSetjen DPD RI",
            "release_date": current_release.release_date if current_release else timezone.now(),
            "release_type": current_release.version_type if current_release else "patch",
            "summary": current_release.summary if current_release else "",
        }, status=status.HTTP_200_OK)


class SystemReleaseListCreateAPIView(generics.GenericAPIView):
    """
    GET: List all system releases and update logs (Public / Authenticated)
    POST: Create new system version / release note (Admin only)
    """
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated(), IsAdminUser()]

    def get(self, request):
        releases_qs = api_models.SystemRelease.objects.all().order_by('-release_date', '-created_at')

        # Optional search
        search_query = request.query_params.get('search', '').strip()
        if search_query:
            releases_qs = releases_qs.filter(
                Q(version__icontains=search_query) |
                Q(title__icontains=search_query) |
                Q(summary__icontains=search_query) |
                Q(raw_notes__icontains=search_query)
            )

        # Optional filter by version_type
        vtype = request.query_params.get('type', '').strip()
        if vtype in ['major', 'minor', 'patch']:
            releases_qs = releases_qs.filter(version_type=vtype)

        serialized = api_serializer.SystemReleaseSerializer(releases_qs, many=True).data

        current_ver = get_current_app_version()
        current_release_obj = api_models.SystemRelease.objects.filter(is_current=True).first()
        current_release_data = api_serializer.SystemReleaseSerializer(current_release_obj).data if current_release_obj else None

        # Calculate statistics
        all_count = api_models.SystemRelease.objects.count()
        major_count = api_models.SystemRelease.objects.filter(version_type='major').count()
        minor_count = api_models.SystemRelease.objects.filter(version_type='minor').count()
        patch_count = api_models.SystemRelease.objects.filter(version_type='patch').count()

        # Count total features, improvements, bugfixes, etc. across all releases
        total_features = 0
        total_improvements = 0
        total_fixes = 0
        total_security = 0
        total_ui = 0

        all_releases_for_stats = api_models.SystemRelease.objects.all()
        for rel in all_releases_for_stats:
            for item in (rel.changes or []):
                cat = str(item.get('category', '')).lower()
                if 'feat' in cat or 'fitur' in cat:
                    total_features += 1
                elif 'improv' in cat or 'tingkat' in cat:
                    total_improvements += 1
                elif 'bug' in cat or 'fix' in cat or 'perbaikan' in cat:
                    total_fixes += 1
                elif 'sec' in cat or 'aman' in cat:
                    total_security += 1
                elif 'ui' in cat or 'tampilan' in cat:
                    total_ui += 1

        # Suggested next versions for quick bump in UI
        suggested_next = {
            "patch": bump_version(current_ver, 'patch'),
            "minor": bump_version(current_ver, 'minor'),
            "major": bump_version(current_ver, 'major'),
        }

        # Real live server & repository telemetry
        import subprocess, platform, django
        from django.conf import settings
        
        git_hash = ""
        git_branch = ""
        git_commit_msg = ""
        git_date = ""
        try:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
            git_hash = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=base_dir, text=True, stderr=subprocess.DEVNULL).strip()
            git_branch = subprocess.check_output(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=base_dir, text=True, stderr=subprocess.DEVNULL).strip()
            git_commit_msg = subprocess.check_output(["git", "log", "-1", "--format=%s"], cwd=base_dir, text=True, stderr=subprocess.DEVNULL).strip()
            git_date = subprocess.check_output(["git", "log", "-1", "--format=%cd", "--date=relative"], cwd=base_dir, text=True, stderr=subprocess.DEVNULL).strip()
        except Exception:
            pass

        server_telemetry = {
            "git_commit": git_hash or "production",
            "git_branch": git_branch or "main",
            "git_commit_msg": git_commit_msg or "Stable release commit",
            "git_date": git_date or "Aktif saat ini",
            "django_version": django.get_version(),
            "python_version": platform.python_version(),
            "database_engine": settings.DATABASES['default']['ENGINE'].split('.')[-1].upper(),
            "server_time": timezone.now().strftime("%d %b %Y, %H:%M:%S WIB"),
            "active_env": "Pengembangan (Development)" if settings.DEBUG else "Produksi (Production)"
        }

        return Response({
            "success": True,
            "current_version": current_ver,
            "current_release": current_release_data,
            "suggested_next": suggested_next,
            "server_telemetry": server_telemetry,
            "stats": {
                "total_releases": all_count,
                "major_count": major_count,
                "minor_count": minor_count,
                "patch_count": patch_count,
                "total_features": total_features,
                "total_improvements": total_improvements,
                "total_fixes": total_fixes,
                "total_security": total_security,
                "total_ui": total_ui,
                "last_release_date": current_release_obj.release_date if current_release_obj else None
            },
            "results": serialized
        }, status=status.HTTP_200_OK)

    def post(self, request):
        data = request.data.copy()
        current_ver = get_current_app_version()

        # Determine version string
        version_input = str(data.get('version', '')).strip()
        bump_type = str(data.get('bump_type', '')).lower()

        if not version_input and bump_type in ['patch', 'minor', 'major']:
            version_input = bump_version(current_ver, bump_type)

        # Clean version prefix like 'v1.0.2' -> '1.0.2'
        version_input = re.sub(r'^[vV]', '', version_input).strip()

        if not version_input:
            return Response(
                {"error": "Nomor versi harus diisi atau pilih jenis peningkatan versi (patch, minor, major)."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check for duplicate version
        if api_models.SystemRelease.objects.filter(version=version_input).exists():
            return Response(
                {"error": f"Versi {version_input} sudah pernah diterbitkan. Harap gunakan nomor versi yang lebih baru."},
                status=status.HTTP_400_BAD_REQUEST
            )

        title = data.get('title', '').strip()
        if not title:
            title = f"Pembaruan Rilis Versi {version_input}"

        version_type = data.get('version_type', 'patch')
        if version_type not in ['major', 'minor', 'patch']:
            version_type = 'patch'

        release_date = data.get('release_date') or timezone.now()
        is_current = data.get('is_current', True)  # default: set new release as active
        if isinstance(is_current, str):
            is_current = is_current.lower() in ['true', '1', 'yes']

        summary = data.get('summary', '').strip()
        changes = data.get('changes', [])
        if not isinstance(changes, list):
            changes = []

        raw_notes = data.get('raw_notes', '').strip()

        release = api_models.SystemRelease.objects.create(
            version=version_input,
            title=title,
            version_type=version_type,
            release_date=release_date,
            is_current=is_current,
            summary=summary,
            changes=changes,
            raw_notes=raw_notes,
            created_by=request.user
        )

        serializer = api_serializer.SystemReleaseSerializer(release)
        return Response({
            "success": True,
            "message": f"Versi {release.version} berhasil diterbitkan dan log pembaruan berhasil dicatat.",
            "data": serializer.data
        }, status=status.HTTP_201_CREATED)


class SystemReleaseDetailAPIView(generics.GenericAPIView):
    """
    GET, PATCH, DELETE a specific system release record.
    """
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated(), IsAdminUser()]

    def get_object(self, pk):
        try:
            return api_models.SystemRelease.objects.get(pk=pk)
        except api_models.SystemRelease.DoesNotExist:
            return None

    def get(self, request, pk):
        release = self.get_object(pk)
        if not release:
            return Response({"error": "Release not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = api_serializer.SystemReleaseSerializer(release)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        release = self.get_object(pk)
        if not release:
            return Response({"error": "Release not found"}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        if 'title' in data:
            release.title = data['title']
        if 'summary' in data:
            release.summary = data['summary']
        if 'version_type' in data and data['version_type'] in ['major', 'minor', 'patch']:
            release.version_type = data['version_type']
        if 'release_date' in data:
            release.release_date = data['release_date']
        if 'changes' in data and isinstance(data['changes'], list):
            release.changes = data['changes']
        if 'raw_notes' in data:
            release.raw_notes = data['raw_notes']
        if 'is_current' in data:
            val = data['is_current']
            if isinstance(val, str):
                val = val.lower() in ['true', '1', 'yes']
            release.is_current = bool(val)

        release.save()
        serializer = api_serializer.SystemReleaseSerializer(release)
        return Response({
            "success": True,
            "message": f"Pembaruan log versi {release.version} berhasil disimpan.",
            "data": serializer.data
        }, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        release = self.get_object(pk)
        if not release:
            return Response({"error": "Release not found"}, status=status.HTTP_404_NOT_FOUND)

        was_current = release.is_current
        version_num = release.version
        release.delete()

        # If deleted release was current, promote the latest remaining release
        if was_current:
            latest = api_models.SystemRelease.objects.all().order_by('-release_date').first()
            if latest:
                latest.is_current = True
                latest.save()

        return Response({
            "success": True,
            "message": f"Log rilis versi {version_num} berhasil dihapus."
        }, status=status.HTTP_200_OK)


class SystemReleaseSetCurrentAPIView(generics.GenericAPIView):
    """
    POST: Promote an existing release as the active current version.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, pk):
        try:
            release = api_models.SystemRelease.objects.get(pk=pk)
        except api_models.SystemRelease.DoesNotExist:
            return Response({"error": "Release not found"}, status=status.HTTP_404_NOT_FOUND)

        release.is_current = True
        release.save()

        serializer = api_serializer.SystemReleaseSerializer(release)
        return Response({
            "success": True,
            "message": f"Versi {release.version} sekarang ditetapkan sebagai versi aktif LMSetjen DPD RI.",
            "current_version": release.version,
            "data": serializer.data
        }, status=status.HTTP_200_OK)

