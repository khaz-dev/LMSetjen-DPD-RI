import logging
import datetime
import csv
import io
import json
import re
from django.utils import timezone
from django.db.models import Q, Count
from django.http import HttpResponse
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from api import models as api_models
from api import serializer as api_serializer
from api.permissions import IsAdminUser

logger = logging.getLogger(__name__)


def normalize_difficulty(val, word_str=""):
    """
    Normalisasi tingkat kesulitan: 'easy', 'medium', 'hard'.
    Mendukung input Bahasa Indonesia dan angka level.
    Jika 'auto' atau kosong, otomatis hitung dari panjang kata.
    """
    if not val or str(val).strip().lower() in ('auto', 'otomatis', ''):
        length = len(word_str) if word_str else 5
        if length <= 4:
            return 'easy'
        elif length <= 7:
            return 'medium'
        else:
            return 'hard'

    val_clean = str(val).strip().lower()
    if val_clean in ('easy', 'mudah', '1', 'wave 1', 'wave1'):
        return 'easy'
    elif val_clean in ('medium', 'menengah', 'sedang', '2', '3', 'wave 2', 'wave 3', 'wave2', 'wave3'):
        return 'medium'
    elif val_clean in ('hard', 'mahir', 'sulit', 'tinggi', '4', 'wave 4', 'wave4'):
        return 'hard'

    length = len(word_str) if word_str else 5
    if length <= 4:
        return 'easy'
    elif length <= 7:
        return 'medium'
    return 'hard'


def normalize_category(val, default_category='umum'):
    """
    Normalisasi kategori: 'berakhlak', 'keparlemenan', 'lms', 'umum'
    """
    if not val or not str(val).strip():
        return default_category or 'umum'

    val_clean = str(val).strip().lower()
    if any(k in val_clean for k in ['akhlak', 'berakhlak', 'core value', 'asn', 'corevalues']):
        return 'berakhlak'
    elif any(k in val_clean for k in ['parlemen', 'keparlemenan', 'dpd', 'senator', 'sidang', 'ruu', 'komite', 'bap', 'purt']):
        return 'keparlemenan'
    elif any(k in val_clean for k in ['lms', 'digital', 'elearning', 'e-learning', 'belajar', 'modul', 'manta', 'kuis', 'kursus', 'scorm', 'video']):
        return 'lms'
    elif 'umum' in val_clean or 'kerja' in val_clean or 'budaya' in val_clean:
        return 'umum'
    elif val_clean in ('berakhlak', 'keparlemenan', 'lms', 'umum'):
        return val_clean
    return default_category or 'umum'


def normalize_boolean(val, default=True):
    if val is None or val == '':
        return default
    if isinstance(val, bool):
        return val
    str_val = str(val).strip().lower()
    if str_val in ('true', '1', 'yes', 'ya', 'aktif', 'active', 't', 'y'):
        return True
    if str_val in ('false', '0', 'no', 'tidak', 'nonaktif', 'inactive', 'f', 'n', 'mati'):
        return False
    return default


def check_is_accessible(setting):
    """
    Evaluasi apakah MantaType saat ini dapat diakses oleh pemain
    berdasarkan konfigurasi jadwal dan zona waktu lokal Indonesia (WIB).
    """
    if not setting.is_enabled:
        return False, setting.offline_custom_message or "MantaType saat ini sedang dinonaktifkan oleh Administrator."

    if not setting.restrict_to_break_hours:
        return True, "Akses dibuka 24 jam."

    # Waktu server sekarang dalam zona waktu lokal
    now = timezone.localtime(timezone.now())
    current_time = now.time()
    weekday = now.weekday()  # 0=Monday, 4=Friday, 5=Saturday, 6=Sunday

    # Akhir pekan (Sabtu & Minggu)
    if weekday in (5, 6):
        if setting.allow_weekend:
            return True, "MantaType dibuka penuh pada akhir pekan."
        else:
            return False, "MantaType ditutup pada akhir pekan sesuai kebijakan kedinasan."

    # Hari Kerja (Senin - Jumat)
    work_start = setting.work_start or datetime.time(8, 0)
    break_start = setting.break_start or datetime.time(12, 0)
    break_end = setting.break_end or datetime.time(13, 0)
    after_work = setting.after_work_start or datetime.time(16, 30)

    # 1. Sebelum jam kerja (sebelum 08:00) -> Boleh
    if current_time < work_start:
        return True, "Akses dibuka: Sebelum Jam Dinas Kantor."

    # 2. Jam istirahat siang (12:00 - 13:00) -> Boleh
    if break_start <= current_time <= break_end:
        return True, "Akses dibuka: Waktu Istirahat Siang Kedinasan."

    # 3. Setelah jam kerja kantor (setelah 16:30) -> Boleh
    if current_time >= after_work:
        return True, "Akses dibuka: Di Luar Jam Dinas Kantor."

    # 4. Dalam jam kerja produktif (08:00-12:00 dan 13:00-16:30) -> Tidak Boleh
    return False, setting.offline_custom_message or "MantaType saat ini tidak dapat dimainkan karena sedang dalam Jam Kerja Kedinasan DPD RI."


def get_manta_season_info(setting=None):
    """
    🏆 Menghitung info musim kompetisi MantaType saat ini (Siklus 3 Bulan / Triwulan),
    jadwal reset musim berikutnya, dan sisa hari/jam.
    """
    if setting is None:
        setting = api_models.MantaTypeSetting.get_settings()

    now = timezone.localtime(timezone.now())
    year = now.year
    month = now.month

    # Tentukan kuartal (1: Jan-Mar, 2: Apr-Jun, 3: Jul-Sep, 4: Okt-Des)
    quarter = (month - 1) // 3 + 1

    quarter_meta = {
        1: ("Triwulan I", datetime.date(year, 1, 1), datetime.date(year, 3, 31), datetime.date(year, 4, 1)),
        2: ("Triwulan II", datetime.date(year, 4, 1), datetime.date(year, 6, 30), datetime.date(year, 7, 1)),
        3: ("Triwulan III", datetime.date(year, 7, 1), datetime.date(year, 9, 30), datetime.date(year, 10, 1)),
        4: ("Triwulan IV", datetime.date(year, 10, 1), datetime.date(year, 12, 31), datetime.date(year + 1, 1, 1)),
    }

    q_label, start_date, end_date, next_reset_date = quarter_meta[quarter]
    season_name = f"Musim {q_label} {year}"

    tz = timezone.get_current_timezone()
    next_reset_dt = timezone.make_aware(datetime.datetime.combine(next_reset_date, datetime.time.min), tz)
    start_dt = timezone.make_aware(datetime.datetime.combine(start_date, datetime.time.min), tz)

    delta = next_reset_dt - now
    days_left = max(0, delta.days)
    hours_left = max(0, int(delta.seconds // 3600))

    auto_reset = getattr(setting, 'auto_season_reset', True)
    last_reset = getattr(setting, 'last_season_reset_at', None)
    season_num = getattr(setting, 'season_number', 1)

    return {
        "season_name": season_name,
        "quarter": quarter,
        "quarter_label": q_label,
        "year": year,
        "season_number": season_num,
        "start_date": start_date.strftime("%d %b %Y"),
        "end_date": end_date.strftime("%d %b %Y"),
        "period_label": f"{start_date.strftime('%d %b')} - {end_date.strftime('%d %b %Y')}",
        "next_reset_at": next_reset_dt.isoformat(),
        "next_reset_formatted": next_reset_date.strftime("%d %B %Y 00:00 WIB"),
        "days_left": days_left,
        "hours_left": hours_left,
        "auto_season_reset": auto_reset,
        "last_season_reset_at": last_reset.isoformat() if last_reset else None,
        "last_reset_formatted": timezone.localtime(last_reset).strftime("%d %B %Y %H:%M WIB") if last_reset else None,
        "season_interval_months": 3
    }


def check_and_perform_auto_season_reset():
    """
    🔄 Otomatis memeriksa apakah siklus musim 3 bulan (Triwulan) telah berakhir.
    Jika ya dan auto_season_reset aktif, maka leaderboard di-reset secara otomatis.
    """
    setting = api_models.MantaTypeSetting.get_settings()
    if not getattr(setting, 'auto_season_reset', True):
        return False, 0

    now = timezone.localtime(timezone.now())
    current_quarter = (now.month - 1) // 3 + 1
    current_year = now.year

    last_reset = getattr(setting, 'last_season_reset_at', None)
    needs_reset = False

    if last_reset is None:
        # Inisialisasi awal kuartal aktif saat ini
        quarter_start_month = (current_quarter - 1) * 3 + 1
        tz = timezone.get_current_timezone()
        setting.last_season_reset_at = timezone.make_aware(
            datetime.datetime(current_year, quarter_start_month, 1, 0, 0, 0), tz
        )
        setting.save()
        return False, 0
    else:
        last_reset_local = timezone.localtime(last_reset)
        last_quarter = (last_reset_local.month - 1) // 3 + 1
        last_year = last_reset_local.year

        if (current_year > last_year) or (current_year == last_year and current_quarter > last_quarter):
            needs_reset = True

    if needs_reset:
        old_season = getattr(setting, 'season_number', 1)
        setting.last_season_reset_at = now
        setting.season_number = old_season + 1
        setting.save()
        logger.info(
            f"🔄 [MantaType Auto Season Reset] Siklus 3 bulan berganti: Memulai Musim Baru #{setting.season_number}. Seasonal Ranked di-reset baru, Lifetime Ranked tetap utuh sepanjang masa."
        )
        return True, 0

    return False, 0
    if current_time < work_start:
        return True, f"MantaType aktif sebelum jam dinas dimulai (pukul {work_start.strftime('%H:%M')} WIB)."

    # 2. Jam Istirahat (12:00 - 13:00) -> Boleh
    if break_start <= current_time <= break_end:
        return True, f"Selamat istirahat! MantaType aktif selama jam istirahat ({break_start.strftime('%H:%M')} - {break_end.strftime('%H:%M')} WIB)."

    # 3. Setelah jam kerja dinas (setelah 16:30) -> Boleh
    if current_time >= after_work:
        return True, f"Jam dinas telah selesai ({after_work.strftime('%H:%M')} WIB). Selamat menikmati MantaType Arcade!"

    # 4. Dalam rentang jam kerja dinas aktif -> Terkunci
    return False, (
        f"Saat ini sedang jam kerja dinas aktif Setjen DPD RI ({work_start.strftime('%H:%M')} - {after_work.strftime('%H:%M')} WIB). "
        f"MantaType akan dibuka pada jam istirahat siang ({break_start.strftime('%H:%M')} - {break_end.strftime('%H:%M')} WIB) "
        f"atau setelah jam dinas berakhir pukul {after_work.strftime('%H:%M')} WIB. Mari fokus belajar dan bertugas!"
    )


class MantaTypePublicConfigAPIView(generics.GenericAPIView):
    """
    🎮 Endpoint Publik MantaType Arcade:
    Menyediakan status akses, jadwal jam operasional, Bank Kosakata dinamis,
    dan status klaim XP Harian pemain (jika login).
    """
    permission_classes = [AllowAny]
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        try:
            setting = api_models.MantaTypeSetting.get_settings()
            is_accessible, access_msg = check_is_accessible(setting)
            now = timezone.localtime(timezone.now())

            # Poin XP dari MantaType dinonaktifkan (fokus murni arcade & leaderboard)
            user_reward_info = None

            # Ambil kosakata aktif dari database
            words_qs = api_models.MantaTypeWord.objects.filter(is_active=True).values(
                'id', 'word', 'difficulty', 'category', 'meaning'
            )

            easy_words = []
            medium_words = []
            hard_words = []
            word_meanings = {}

            for item in words_qs:
                w = item['word'].strip().upper()
                diff = item['difficulty']
                meaning = item['meaning']

                if meaning:
                    word_meanings[w] = meaning

                if diff == 'easy':
                    easy_words.append(w)
                elif diff == 'medium':
                    medium_words.append(w)
                elif diff == 'hard':
                    hard_words.append(w)

            return Response({
                "status": "success",
                "is_enabled": setting.is_enabled,
                "is_accessible": is_accessible,
                "access_message": access_msg,
                "server_time": now.strftime("%H:%M WIB"),
                "server_date": now.strftime("%d %B %Y"),
                "schedule_info": {
                    "restrict_to_break_hours": setting.restrict_to_break_hours,
                    "work_start": setting.work_start.strftime("%H:%M") if setting.work_start else "08:00",
                    "break_start": setting.break_start.strftime("%H:%M") if setting.break_start else "12:00",
                    "break_end": setting.break_end.strftime("%H:%M") if setting.break_end else "13:00",
                    "after_work_start": setting.after_work_start.strftime("%H:%M") if setting.after_work_start else "16:30",
                    "allow_weekend": setting.allow_weekend,
                    "daily_play_limit": setting.daily_play_limit,
                },
                "words": {
                    "easy": easy_words,
                    "medium": medium_words,
                    "hard": hard_words,
                },
                "word_meanings": word_meanings,
                "total_words": len(easy_words) + len(medium_words) + len(hard_words),
                "user_reward_status": user_reward_info,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error fetching MantaType public config: {e}", exc_info=True)
            return Response({
                "status": "error",
                "message": f"Gagal memuat konfigurasi MantaType: {str(e)}",
                "is_enabled": True,
                "is_accessible": True,
                "words": {"easy": [], "medium": [], "hard": []},
                "word_meanings": {},
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class MantaTypeAdminSettingAPIView(generics.GenericAPIView):
    """
    ⚙️ Admin Endpoint: Mengelola Pengaturan Global & Jam Akses MantaType
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        setting = api_models.MantaTypeSetting.get_settings()
        serializer = api_serializer.MantaTypeSettingSerializer(setting)
        
        # Tambahan info statistik cepat
        now = timezone.localtime(timezone.now())
        is_accessible, access_msg = check_is_accessible(setting)
        
        words_count = api_models.MantaTypeWord.objects.count()
        active_words_count = api_models.MantaTypeWord.objects.filter(is_active=True).count()
        total_plays = api_models.MantaTypeLeaderboard.objects.count()

        return Response({
            "status": "success",
            "settings": serializer.data,
            "season_info": get_manta_season_info(setting),
            "runtime_telemetry": {
                "server_time": now.strftime("%H:%M:%S WIB"),
                "is_accessible_now": is_accessible,
                "access_message": access_msg,
                "total_words": words_count,
                "active_words": active_words_count,
                "total_plays": total_plays,
            }
        }, status=status.HTTP_200_OK)

    def put(self, request):
        setting = api_models.MantaTypeSetting.get_settings()
        serializer = api_serializer.MantaTypeSettingSerializer(setting, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({
                "status": "success",
                "message": "Pengaturan MantaType berhasil diperbarui!",
                "settings": serializer.data
            }, status=status.HTTP_200_OK)
        return Response({
            "status": "error",
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class MantaTypeAdminWordListCreateAPIView(generics.GenericAPIView):
    """
    📚 Admin Endpoint: Daftar Bank Kosakata & Penambahan Kata Baru
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        search = request.GET.get('search', '').strip()
        difficulty = request.GET.get('difficulty', '').strip()
        category = request.GET.get('category', '').strip()
        is_active = request.GET.get('is_active', '').strip()

        qs = api_models.MantaTypeWord.objects.all()

        if search:
            qs = qs.filter(Q(word__icontains=search) | Q(meaning__icontains=search))
        if difficulty in ('easy', 'medium', 'hard'):
            qs = qs.filter(difficulty=difficulty)
        if category:
            qs = qs.filter(category=category)
        if is_active.lower() in ('true', '1'):
            qs = qs.filter(is_active=True)
        elif is_active.lower() in ('false', '0'):
            qs = qs.filter(is_active=False)

        words_data = api_serializer.MantaTypeWordSerializer(qs, many=True).data

        # Statistik per tingkat kesulitan
        counts = api_models.MantaTypeWord.objects.aggregate(
            total=Count('id'),
            easy=Count('id', filter=Q(difficulty='easy')),
            medium=Count('id', filter=Q(difficulty='medium')),
            hard=Count('id', filter=Q(difficulty='hard')),
            active=Count('id', filter=Q(is_active=True)),
        )

        return Response({
            "status": "success",
            "words": words_data,
            "counts": counts,
        }, status=status.HTTP_200_OK)

    def post(self, request):
        data = request.data.copy()
        raw_word = data.get('word', '')
        if not raw_word:
            return Response({"status": "error", "message": "Kata tidak boleh kosong!"}, status=status.HTTP_400_BAD_REQUEST)

        clean_word = str(raw_word).strip().replace(' ', '').upper()
        data['word'] = clean_word

        if api_models.MantaTypeWord.objects.filter(word=clean_word).exists():
            return Response({
                "status": "error", 
                "message": f"Kata '{clean_word}' sudah terdaftar dalam Bank Kosakata!"
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = api_serializer.MantaTypeWordSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response({
                "status": "success",
                "message": f"Kata '{clean_word}' berhasil ditambahkan!",
                "word": serializer.data
            }, status=status.HTTP_201_CREATED)
        return Response({"status": "error", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


class MantaTypeAdminWordDetailAPIView(generics.GenericAPIView):
    """
    🔍 Admin Endpoint: Detail, Edit, & Hapus Kosakata
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_object(self, pk):
        try:
            return api_models.MantaTypeWord.objects.get(pk=pk)
        except api_models.MantaTypeWord.DoesNotExist:
            return None

    def get(self, request, pk):
        word_obj = self.get_object(pk)
        if not word_obj:
            return Response({"status": "error", "message": "Kata tidak ditemukan!"}, status=status.HTTP_404_NOT_FOUND)
        serializer = api_serializer.MantaTypeWordSerializer(word_obj)
        return Response({"status": "success", "word": serializer.data}, status=status.HTTP_200_OK)

    def put(self, request, pk):
        word_obj = self.get_object(pk)
        if not word_obj:
            return Response({"status": "error", "message": "Kata tidak ditemukan!"}, status=status.HTTP_404_NOT_FOUND)

        data = request.data.copy()
        if 'word' in data and data['word']:
            data['word'] = str(data['word']).strip().replace(' ', '').upper()

        serializer = api_serializer.MantaTypeWordSerializer(word_obj, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({
                "status": "success",
                "message": f"Kata '{word_obj.word}' berhasil diperbarui!",
                "word": serializer.data
            }, status=status.HTTP_200_OK)
        return Response({"status": "error", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        word_obj = self.get_object(pk)
        if not word_obj:
            return Response({"status": "error", "message": "Kata tidak ditemukan!"}, status=status.HTTP_404_NOT_FOUND)
        word_text = word_obj.word
        word_obj.delete()
        return Response({
            "status": "success",
            "message": f"Kata '{word_text}' berhasil dihapus dari Bank Kosakata!"
        }, status=status.HTTP_200_OK)


from rest_framework.renderers import BaseRenderer
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

class MantaTypeExportPassthroughRenderer(BaseRenderer):
    """Renderer passthrough agar file biner Excel/CSV tidak dicegat content negotiation default DRF"""
    media_type = '*/*'
    format = 'any'

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


class MantaTypeAdminWordExportAPIView(generics.GenericAPIView):
    """
    📤 Admin Endpoint: Ekspor Bank Kosakata MantaType (Excel .xlsx, CSV, atau JSON)
    Mendukung ekspor seluruh kata, filter saat ini, dan unduh template siap pakai.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]
    renderer_classes = [MantaTypeExportPassthroughRenderer]

    def perform_content_negotiation(self, request, force=False):
        return (MantaTypeExportPassthroughRenderer(), '*/*')

    def get(self, request):
        export_format = (request.GET.get('export_type') or request.GET.get('format') or 'xlsx').lower()
        is_template = request.GET.get('template', '').lower() in ('1', 'true', 'yes')

        now = timezone.localtime(timezone.now())
        timestamp_str = now.strftime("%Y%m%d_%H%M%S")

        # 1. UNDUH TEMPLATE SIAP PAKAI
        if is_template:
            template_rows = [
                ("LEGISLASI", "medium", "keparlemenan", "Fungsi perancangan dan pembentukan undang-undang", "TRUE"),
                ("BERAKHLAK", "hard", "berakhlak", "Core Values ASN Berorientasi Pelayanan, Akuntabel, Kompeten, Harmonis, Loyal, Adaptif, Kolaboratif", "TRUE"),
                ("DPD", "easy", "keparlemenan", "Dewan Perwakilan Daerah Republik Indonesia", "TRUE"),
                ("MODUL", "easy", "lms", "Unit materi pembelajaran mandiri pada platform LMS", "TRUE"),
                ("INTEGRITAS", "hard", "umum", "Konsistensi dan keteguhan memegang prinsip moral kedinasan", "TRUE"),
            ]

            if export_format == 'csv':
                response = HttpResponse(content_type='text/csv; charset=utf-8')
                response['Content-Disposition'] = f'attachment; filename="Template_Bank_Kosakata_MantaType_{timestamp_str}.csv"'
                response.write('\ufeff')
                writer = csv.writer(response)
                writer.writerow(["word", "difficulty", "category", "meaning", "is_active"])
                for r in template_rows:
                    writer.writerow(r)
                return response
            else:
                # Default Excel Template (.xlsx)
                wb = openpyxl.Workbook()
                ws = wb.active
                ws.title = "Template Kosakata"

                header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
                header_fill = PatternFill(start_color="0D9488", end_color="0D9488", fill_type="solid")
                sub_font = Font(name="Calibri", size=9, italic=True, color="475569")
                center_align = Alignment(horizontal="center", vertical="center")
                left_align = Alignment(horizontal="left", vertical="center")
                thin_border = Border(
                    left=Side(style='thin', color='E2E8F0'),
                    right=Side(style='thin', color='E2E8F0'),
                    top=Side(style='thin', color='E2E8F0'),
                    bottom=Side(style='thin', color='E2E8F0')
                )

                headers = [
                    "Kata (word)*",
                    "Kesulitan (difficulty)",
                    "Kategori (category)",
                    "Arti / Glosarium (meaning)",
                    "Status Aktif (is_active)"
                ]
                ws.append(headers)

                for col_num in range(1, len(headers) + 1):
                    cell = ws.cell(row=1, column=col_num)
                    cell.font = header_font
                    cell.fill = header_fill
                    cell.alignment = center_align

                for row_idx, r in enumerate(template_rows, 2):
                    ws.append(list(r))
                    for col_num in range(1, len(r) + 1):
                        c = ws.cell(row=row_idx, column=col_num)
                        c.border = thin_border
                        if col_num in (2, 3, 5):
                            c.alignment = center_align
                        else:
                            c.alignment = left_align

                note_row = len(template_rows) + 3
                ws.cell(row=note_row, column=1, value="PANDUAN PENGISIAN TEMPLATE BANK KOSAKATA:").font = Font(bold=True, color="0F172A")
                ws.cell(row=note_row + 1, column=1, value="1. Kolom 'Kata': Wajib diisi tanpa spasi. Otomatis diubah ke huruf kapital saat diimpor.").font = sub_font
                ws.cell(row=note_row + 2, column=1, value="2. Kolom 'Kesulitan': Pilihan 'easy' (3-4 huruf), 'medium' (5-7 huruf), 'hard' (8+ huruf), atau kosongkan untuk otomatis.").font = sub_font
                ws.cell(row=note_row + 3, column=1, value="3. Kolom 'Kategori': Pilihan 'keparlemenan', 'berakhlak', 'lms', atau 'umum' (default).").font = sub_font
                ws.cell(row=note_row + 4, column=1, value="4. Kolom 'Arti / Glosarium': Penjelasan singkat edukatif ASN (maksimal 255 karakter, opsional).").font = sub_font
                ws.cell(row=note_row + 5, column=1, value="5. Kolom 'Status Aktif': TRUE (bisa muncul di game) atau FALSE (dinonaktifkan sementara).").font = sub_font

                col_widths = {'A': 22, 'B': 24, 'C': 24, 'D': 45, 'E': 20}
                for col_letter, width in col_widths.items():
                    ws.column_dimensions[col_letter].width = width

                stream = io.BytesIO()
                wb.save(stream)
                stream.seek(0)

                response = HttpResponse(
                    stream.getvalue(),
                    content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                )
                response['Content-Disposition'] = f'attachment; filename="Template_Bank_Kosakata_MantaType_{timestamp_str}.xlsx"'
                return response

        # 2. EKSPOR DATA REAL (SEMUA ATAU SESUAI FILTER)
        qs = api_models.MantaTypeWord.objects.all().order_by('difficulty', 'word')

        search = request.GET.get('search', '').strip()
        difficulty = request.GET.get('difficulty', '').strip()
        category = request.GET.get('category', '').strip()
        is_active = request.GET.get('is_active', '').strip()

        if search:
            qs = qs.filter(Q(word__icontains=search) | Q(meaning__icontains=search))
        if difficulty in ('easy', 'medium', 'hard'):
            qs = qs.filter(difficulty=difficulty)
        if category:
            qs = qs.filter(category=category)
        if is_active.lower() in ('true', '1'):
            qs = qs.filter(is_active=True)
        elif is_active.lower() in ('false', '0'):
            qs = qs.filter(is_active=False)

        # 2A. FORMAT JSON
        if export_format == 'json':
            words_list = []
            for item in qs:
                words_list.append({
                    "id": item.id,
                    "word": item.word,
                    "difficulty": item.difficulty,
                    "difficulty_display": item.get_difficulty_display(),
                    "category": item.category,
                    "category_display": item.get_category_display(),
                    "meaning": item.meaning or "",
                    "is_active": item.is_active,
                    "created_at": item.created_at.strftime("%Y-%m-%d %H:%M:%S") if item.created_at else None,
                })

            export_payload = {
                "system": "LMSetjen DPD RI - MantaType Arcade Word Bank",
                "exported_at": now.strftime("%Y-%m-%d %H:%M:%S WIB"),
                "total_records": len(words_list),
                "words": words_list
            }

            response = HttpResponse(
                json.dumps(export_payload, ensure_ascii=False, indent=2),
                content_type='application/json; charset=utf-8'
            )
            response['Content-Disposition'] = f'attachment; filename="Bank_Kosakata_MantaType_DPD_RI_{timestamp_str}.json"'
            return response

        # 2B. FORMAT CSV
        elif export_format == 'csv':
            response = HttpResponse(content_type='text/csv; charset=utf-8')
            response['Content-Disposition'] = f'attachment; filename="Bank_Kosakata_MantaType_DPD_RI_{timestamp_str}.csv"'
            response.write('\ufeff')  # BOM for Excel compatibility
            writer = csv.writer(response)
            writer.writerow(["No", "Kata", "Tingkat Kesulitan", "Kategori", "Arti / Glosarium", "Status", "difficulty_code", "category_code", "is_active"])

            for idx, item in enumerate(qs, 1):
                writer.writerow([
                    idx,
                    item.word,
                    item.get_difficulty_display(),
                    item.get_category_display(),
                    item.meaning or "",
                    "AKTIF" if item.is_active else "NONAKTIF",
                    item.difficulty,
                    item.category,
                    "TRUE" if item.is_active else "FALSE"
                ])
            return response

        # 2C. FORMAT EXCEL (.xlsx) - DEFAULT
        else:
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = "Bank Kosakata MantaType"

            title_font = Font(name="Calibri", size=13, bold=True, color="0F172A")
            meta_font = Font(name="Calibri", size=9, italic=True, color="64748B")
            header_font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
            header_fill = PatternFill(start_color="0D9488", end_color="0D9488", fill_type="solid")
            row_alt_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

            center_align = Alignment(horizontal="center", vertical="center")
            left_align = Alignment(horizontal="left", vertical="center")

            thin_border = Border(
                left=Side(style='thin', color='E2E8F0'),
                right=Side(style='thin', color='E2E8F0'),
                top=Side(style='thin', color='E2E8F0'),
                bottom=Side(style='thin', color='E2E8F0')
            )

            # Metadata Header
            ws.cell(row=1, column=1, value="BANK KOSAKATA MANTATYPE ARCADE - SETJEN DPD RI").font = title_font
            ws.cell(row=2, column=1, value=f"Tanggal Ekspor: {now.strftime('%d %B %Y, %H:%M:%S WIB')} | Total Kosakata: {qs.count()} kata").font = meta_font

            headers = [
                "No",
                "Kata (Word)",
                "Panjang",
                "Tingkat Kesulitan",
                "Kategori / Tema",
                "Arti / Glosarium Edukatif",
                "Status",
                "difficulty_key",
                "category_key"
            ]
            header_row = 4
            ws.append([])
            ws.append(headers)

            for col_num in range(1, len(headers) + 1):
                cell = ws.cell(row=header_row, column=col_num)
                cell.font = header_font
                cell.fill = header_fill
                cell.alignment = center_align

            for idx, item in enumerate(qs, 1):
                current_row = header_row + idx
                row_data = [
                    idx,
                    item.word,
                    len(item.word),
                    item.get_difficulty_display(),
                    item.get_category_display(),
                    item.meaning or "-",
                    "Aktif" if item.is_active else "Nonaktif",
                    item.difficulty,
                    item.category
                ]
                ws.append(row_data)

                for col_num in range(1, len(row_data) + 1):
                    c = ws.cell(row=current_row, column=col_num)
                    c.border = thin_border
                    if idx % 2 == 0:
                        c.fill = row_alt_fill

                    if col_num in (1, 3, 7, 8, 9):
                        c.alignment = center_align
                    elif col_num in (2, 4, 5, 6):
                        c.alignment = left_align

            col_widths = {
                'A': 8,   # No
                'B': 22,  # Kata
                'C': 10,  # Panjang
                'D': 25,  # Kesulitan
                'E': 25,  # Kategori
                'F': 48,  # Glosarium
                'G': 12,  # Status
                'H': 15,  # difficulty_key
                'I': 15   # category_key
            }
            for col_letter, width in col_widths.items():
                ws.column_dimensions[col_letter].width = width

            ws.freeze_panes = "A5"

            stream = io.BytesIO()
            wb.save(stream)
            stream.seek(0)

            response = HttpResponse(
                stream.getvalue(),
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            response['Content-Disposition'] = f'attachment; filename="Bank_Kosakata_MantaType_DPD_RI_{timestamp_str}.xlsx"'
            return response


class MantaTypeAdminWordImportAPIView(generics.GenericAPIView):
    """
    📥 Admin Endpoint: Impor Bank Kosakata MantaType Terintegrasi
    Mendukung upload file (.xlsx, .csv, .json, .txt), JSON payload, atau teks massal.
    Menyediakan opsi pembaruan data kata yang sudah ada (update existing),
    auto-klasifikasi kesulitan, dan pelaporan hasil rinci.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        update_existing = normalize_boolean(request.data.get('update_existing', True), default=True)
        default_difficulty = request.data.get('default_difficulty', 'auto')
        default_category = request.data.get('default_category', 'umum')
        default_is_active = normalize_boolean(request.data.get('default_is_active', True), default=True)

        rows_to_process = []
        errors = []

        # 1. CEK UPLOAD FILE (MULTIPART)
        uploaded_file = request.FILES.get('file')
        if uploaded_file:
            filename = uploaded_file.name.lower()
            try:
                # 1A. EXCEL (.xlsx / .xlsm / .xltx)
                if filename.endswith(('.xlsx', '.xlsm', '.xltx')):
                    wb = openpyxl.load_workbook(uploaded_file, data_only=True)
                    ws = wb.active

                    header_map = {}
                    first_row = True
                    for row_idx, row in enumerate(ws.iter_rows(values_only=True), 1):
                        if not row or all(v is None or str(v).strip() == '' for v in row):
                            continue

                        if first_row:
                            first_row = False
                            for col_idx, val in enumerate(row):
                                if not val:
                                    continue
                                h_clean = str(val).strip().lower()
                                if any(k in h_clean for k in ['word', 'kata']):
                                    header_map['word'] = col_idx
                                elif any(k in h_clean for k in ['diff', 'sulit', 'kesulitan']):
                                    header_map['difficulty'] = col_idx
                                elif any(k in h_clean for k in ['cat', 'kategori', 'tema']):
                                    header_map['category'] = col_idx
                                elif any(k in h_clean for k in ['mean', 'arti', 'makna', 'glosarium', 'penjelasan']):
                                    header_map['meaning'] = col_idx
                                elif any(k in h_clean for k in ['active', 'status', 'aktif']):
                                    header_map['is_active'] = col_idx
                            continue

                        word_val = row[header_map.get('word', 0)] if 'word' in header_map and header_map['word'] < len(row) else (row[0] if len(row) > 0 else None)
                        if not word_val or str(word_val).strip() == '':
                            continue

                        # Lewati jika baris petunjuk panduan atau baris header berulang
                        str_word = str(word_val).strip().lower()
                        if str_word in ('kata', 'word', 'panduan', 'panduan pengisian template bank kosakata:'):
                            continue
                        if str_word.startswith(('1.', '2.', '3.', '4.', '5.')):
                            continue

                        diff_val = row[header_map['difficulty']] if 'difficulty' in header_map and header_map['difficulty'] < len(row) else (row[1] if len(row) > 1 else None)
                        cat_val = row[header_map['category']] if 'category' in header_map and header_map['category'] < len(row) else (row[2] if len(row) > 2 else None)
                        mean_val = row[header_map['meaning']] if 'meaning' in header_map and header_map['meaning'] < len(row) else (row[3] if len(row) > 3 else None)
                        act_val = row[header_map['is_active']] if 'is_active' in header_map and header_map['is_active'] < len(row) else (row[4] if len(row) > 4 else None)

                        rows_to_process.append({
                            'word': str(word_val),
                            'difficulty': diff_val,
                            'category': cat_val,
                            'meaning': mean_val,
                            'is_active': act_val,
                            'line': row_idx
                        })

                # 1B. CSV (.csv)
                elif filename.endswith('.csv'):
                    content = uploaded_file.read().decode('utf-8-sig', errors='replace')
                    sample = content[:4096]
                    delimiter = ';' if (';' in sample and sample.count(';') > sample.count(',')) else ','
                    try:
                        dialect = csv.Sniffer().sniff(sample)
                        delimiter = dialect.delimiter
                    except Exception:
                        pass

                    reader = csv.reader(io.StringIO(content), delimiter=delimiter)
                    header_map = {}
                    first_row = True
                    for row_idx, row in enumerate(reader, 1):
                        if not row or all(str(v).strip() == '' for v in row):
                            continue
                        if first_row:
                            first_row = False
                            for col_idx, val in enumerate(row):
                                if not val:
                                    continue
                                h_clean = str(val).strip().lower()
                                if any(k in h_clean for k in ['word', 'kata']):
                                    header_map['word'] = col_idx
                                elif any(k in h_clean for k in ['diff', 'sulit', 'kesulitan']):
                                    header_map['difficulty'] = col_idx
                                elif any(k in h_clean for k in ['cat', 'kategori', 'tema']):
                                    header_map['category'] = col_idx
                                elif any(k in h_clean for k in ['mean', 'arti', 'makna', 'glosarium']):
                                    header_map['meaning'] = col_idx
                                elif any(k in h_clean for k in ['active', 'status', 'aktif']):
                                    header_map['is_active'] = col_idx
                            continue

                        word_val = row[header_map.get('word', 0)] if 'word' in header_map and header_map['word'] < len(row) else (row[0] if len(row) > 0 else None)
                        if not word_val or str(word_val).strip() == '':
                            continue

                        str_word = str(word_val).strip().lower()
                        if str_word in ('kata', 'word', 'panduan'):
                            continue

                        diff_val = row[header_map['difficulty']] if 'difficulty' in header_map and header_map['difficulty'] < len(row) else (row[1] if len(row) > 1 else None)
                        cat_val = row[header_map['category']] if 'category' in header_map and header_map['category'] < len(row) else (row[2] if len(row) > 2 else None)
                        mean_val = row[header_map['meaning']] if 'meaning' in header_map and header_map['meaning'] < len(row) else (row[3] if len(row) > 3 else None)
                        act_val = row[header_map['is_active']] if 'is_active' in header_map and header_map['is_active'] < len(row) else (row[4] if len(row) > 4 else None)

                        rows_to_process.append({
                            'word': str(word_val),
                            'difficulty': diff_val,
                            'category': cat_val,
                            'meaning': mean_val,
                            'is_active': act_val,
                            'line': row_idx
                        })

                # 1C. JSON (.json)
                elif filename.endswith('.json'):
                    content = uploaded_file.read().decode('utf-8', errors='replace')
                    json_data = json.loads(content)
                    raw_list = json_data.get('words', json_data) if isinstance(json_data, dict) else json_data
                    if isinstance(raw_list, list):
                        for idx, item in enumerate(raw_list, 1):
                            if isinstance(item, str):
                                rows_to_process.append({'word': item, 'line': idx})
                            elif isinstance(item, dict) and 'word' in item:
                                rows_to_process.append({
                                    'word': item.get('word'),
                                    'difficulty': item.get('difficulty'),
                                    'category': item.get('category'),
                                    'meaning': item.get('meaning'),
                                    'is_active': item.get('is_active'),
                                    'line': idx
                                })

                # 1D. TXT (.txt)
                else:
                    content = uploaded_file.read().decode('utf-8-sig', errors='replace')
                    for row_idx, line in enumerate(content.splitlines(), 1):
                        line_str = line.strip()
                        if not line_str or line_str.startswith('#'):
                            continue
                        parts = [p.strip() for p in re.split(r'[,|;]', line_str) if p.strip()]
                        if parts:
                            rows_to_process.append({
                                'word': parts[0],
                                'difficulty': parts[1] if len(parts) > 1 else None,
                                'category': parts[2] if len(parts) > 2 else None,
                                'meaning': parts[3] if len(parts) > 3 else None,
                                'line': row_idx
                            })

            except Exception as file_err:
                logger.error(f"Error parsing uploaded file for MantaType words: {file_err}", exc_info=True)
                return Response({
                    "status": "error",
                    "message": f"Gagal membaca file '{uploaded_file.name}': {str(file_err)}"
                }, status=status.HTTP_400_BAD_REQUEST)

        # 2. ATAU DARI JSON ARRAY / WORDS LIST
        elif 'words_list' in request.data and isinstance(request.data['words_list'], list):
            for idx, item in enumerate(request.data['words_list'], 1):
                if isinstance(item, str):
                    rows_to_process.append({'word': item, 'line': idx})
                elif isinstance(item, dict) and 'word' in item:
                    rows_to_process.append({
                        'word': item.get('word'),
                        'difficulty': item.get('difficulty'),
                        'category': item.get('category'),
                        'meaning': item.get('meaning'),
                        'is_active': item.get('is_active'),
                        'line': idx
                    })

        # 3. ATAU DARI TEXTAREA / WORDS TEXT
        elif 'words_text' in request.data and str(request.data['words_text']).strip():
            raw_text = str(request.data['words_text']).strip()
            for row_idx, line in enumerate(raw_text.splitlines(), 1):
                line_str = line.strip()
                if not line_str or line_str.startswith('#'):
                    continue
                if '|' in line_str:
                    parts = [p.strip() for p in line_str.split('|') if p.strip()]
                    rows_to_process.append({
                        'word': parts[0],
                        'difficulty': parts[1] if len(parts) > 1 else None,
                        'category': parts[2] if len(parts) > 2 else None,
                        'meaning': parts[3] if len(parts) > 3 else None,
                        'line': row_idx
                    })
                elif ',' in line_str and any(d in line_str.lower() for d in ['easy', 'medium', 'hard', 'umum', 'lms', 'berakhlak', 'keparlemenan']):
                    parts = [p.strip() for p in line_str.split(',') if p.strip()]
                    rows_to_process.append({
                        'word': parts[0],
                        'difficulty': parts[1] if len(parts) > 1 else None,
                        'category': parts[2] if len(parts) > 2 else None,
                        'meaning': parts[3] if len(parts) > 3 else None,
                        'line': row_idx
                    })
                else:
                    for part in line_str.split(','):
                        if part.strip():
                            rows_to_process.append({
                                'word': part.strip(),
                                'line': row_idx
                            })

        if not rows_to_process:
            return Response({
                "status": "error",
                "message": "Tidak ada data kosakata yang ditemukan untuk diproses. Silakan pilih file atau tempel daftar kata!"
            }, status=status.HTTP_400_BAD_REQUEST)

        # 4. DATABASE PROCESSING (CREATE / UPDATE / SKIP)
        created_count = 0
        updated_count = 0
        skipped_count = 0
        processed_words = set()

        for row in rows_to_process:
            raw_w = row.get('word', '')
            if not raw_w:
                continue

            clean_word = str(raw_w).strip().replace(' ', '').replace('\t', '').upper()
            if not clean_word or len(clean_word) < 2:
                errors.append(f"Baris {row.get('line', '?')}: Kata '{raw_w}' terlalu pendek / tidak valid.")
                continue

            if clean_word in processed_words:
                continue
            processed_words.add(clean_word)

            raw_diff = row.get('difficulty') or default_difficulty
            final_diff = normalize_difficulty(raw_diff, clean_word)

            raw_cat = row.get('category') or default_category
            final_cat = normalize_category(raw_cat, default_category)

            raw_meaning = row.get('meaning')
            final_meaning = str(raw_meaning).strip()[:255] if raw_meaning and str(raw_meaning).strip() not in ('-', 'None', '') else None

            raw_active = row.get('is_active')
            final_active = normalize_boolean(raw_active, default=default_is_active)

            existing = api_models.MantaTypeWord.objects.filter(word=clean_word).first()
            if existing:
                if update_existing:
                    is_changed = False
                    if existing.difficulty != final_diff:
                        existing.difficulty = final_diff
                        is_changed = True
                    if existing.category != final_cat:
                        existing.category = final_cat
                        is_changed = True
                    if final_meaning and existing.meaning != final_meaning:
                        existing.meaning = final_meaning
                        is_changed = True
                    if existing.is_active != final_active:
                        existing.is_active = final_active
                        is_changed = True

                    if is_changed:
                        existing.save()
                        updated_count += 1
                    else:
                        skipped_count += 1
                else:
                    skipped_count += 1
            else:
                api_models.MantaTypeWord.objects.create(
                    word=clean_word,
                    difficulty=final_diff,
                    category=final_cat,
                    meaning=final_meaning,
                    is_active=final_active
                )
                created_count += 1

        total_words = api_models.MantaTypeWord.objects.count()

        msg_parts = []
        if created_count > 0:
            msg_parts.append(f"{created_count} kata baru berhasil ditambahkan")
        if updated_count > 0:
            msg_parts.append(f"{updated_count} kata diperbarui")
        if skipped_count > 0:
            msg_parts.append(f"{skipped_count} kata dilewati (sudah sesuai/ada)")

        summary_msg = f"Impor selesai! {', '.join(msg_parts)}." if msg_parts else "Impor selesai. Tidak ada perubahan kata."

        return Response({
            "status": "success",
            "message": summary_msg,
            "created_count": created_count,
            "updated_count": updated_count,
            "skipped_count": skipped_count,
            "error_count": len(errors),
            "errors": errors[:15],
            "total_words_now": total_words
        }, status=status.HTTP_200_OK if (created_count > 0 or updated_count > 0) else status.HTTP_200_OK)


class MantaTypeAdminWordBulkCreateAPIView(MantaTypeAdminWordImportAPIView):
    """
    📥 Alias mundur untuk endpoint bulk import kosakata lama
    """
    pass


class MantaTypeAdminResetLeaderboardAPIView(generics.GenericAPIView):
    """
    🧹 Admin Endpoint: Reset Papan Peringkat MantaType & Konfigurasi Reset Musim Otomatis Per 3 Bulan
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        check_and_perform_auto_season_reset()
        setting = api_models.MantaTypeSetting.get_settings()
        return Response({
            "status": "success",
            "season_info": get_manta_season_info(setting)
        }, status=status.HTTP_200_OK)

    def post(self, request):
        mode = request.data.get('mode', 'all')  # 'all', 'guests_only', 'test_scores', 'toggle_auto_reset'
        setting = api_models.MantaTypeSetting.get_settings()
        deleted_count = 0

        if mode == 'toggle_auto_reset':
            new_val = request.data.get('auto_season_reset')
            if new_val is None:
                new_val = not getattr(setting, 'auto_season_reset', True)
            else:
                new_val = bool(new_val)
            setting.auto_season_reset = new_val
            setting.save()
            return Response({
                "status": "success",
                "message": f"Sistem Reset Musim Otomatis per 3 bulan berhasil {'diaktifkan' if new_val else 'dinonaktifkan'}.",
                "season_info": get_manta_season_info(setting)
            }, status=status.HTTP_200_OK)

        elif mode == 'guests_only':
            deleted_count, _ = api_models.MantaTypeLeaderboard.objects.filter(is_guest=True).delete()
            msg = f"{deleted_count} skor pemain tamu (Guest) berhasil dibersihkan."
        elif mode == 'test_scores':
            deleted_count, _ = api_models.MantaTypeLeaderboard.objects.filter(score__lte=100).delete()
            msg = f"{deleted_count} skor uji coba (<= 100) berhasil dibersihkan."
        elif mode == 'purge_all':
            deleted_count, _ = api_models.MantaTypeLeaderboard.objects.all().delete()
            msg = f"Seluruh data papan peringkat ({deleted_count} entri) telah dihapus dari database."
        else:
            # Default 'all' or 'new_season': Majukan nomor musim baru!
            # Seasonal rank di-reset bersih, Lifetime rank tetap terjaga selamanya
            now = timezone.localtime(timezone.now())
            setting.last_season_reset_at = now
            setting.season_number = getattr(setting, 'season_number', 1) + 1
            setting.save()
            msg = f"Musim baru (Edisi #{setting.season_number}) berhasil dimulai! Peringkat Seasonal telah di-reset, dan peringkat Lifetime tetap tersimpan sepanjang masa."

        return Response({
            "status": "success",
            "message": msg,
            "deleted_count": deleted_count,
            "season_info": get_manta_season_info(setting)
        }, status=status.HTTP_200_OK)


class MantaTypeClaimRewardAPIView(generics.GenericAPIView):
    """
    🎁 Endpoint Klaim Bonus XP Harian MantaType (DINONAKTIFKAN).
    Poin bermain MantaType tidak lagi dijadikan XP tambahan / ranking peserta di LMS Setjen DPD RI.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        return Response({
            "status": "disabled",
            "message": "Poin XP dari game MantaType telah dinonaktifkan. MantaType kini berfokus pada ketangkasan mengetik dan Papan Peringkat (Ranked)."
        }, status=status.HTTP_200_OK)


