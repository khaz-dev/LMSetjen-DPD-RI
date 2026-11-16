import logging
import datetime
from django.utils import timezone
from django.db.models import Q, Count
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication

from api import models as api_models
from api import serializer as api_serializer
from api.permissions import IsAdminUser

logger = logging.getLogger(__name__)


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

            # Ambil status klaim hadiah harian jika user login
            user = request.user if request.user and request.user.is_authenticated else None
            user_reward_info = {
                "is_authenticated": bool(user),
                "has_claimed_today": False,
                "claimed_today_points": 0,
                "current_level": 1,
                "current_level_name": "Aparatur Pratama",
                "current_level_color": "#10b981",
                "current_level_icon": "fas fa-seedling",
                "current_xp": 0,
                "daily_base_xp": 50,
                "streak_days": 0,
            }

            if user:
                today = now.date()
                claim = api_models.MantaTypeDailyReward.objects.filter(user=user, claim_date=today).first()
                if claim:
                    user_reward_info["has_claimed_today"] = True
                    user_reward_info["claimed_today_points"] = claim.points_awarded

                try:
                    from api.views.ai_assistant import get_user_gamification_data
                    g_data = get_user_gamification_data(user)
                    user_reward_info["current_level"] = g_data.get("level", 1)
                    user_reward_info["current_level_name"] = g_data.get("level_name", "Aparatur Pratama")
                    user_reward_info["current_level_color"] = g_data.get("level_color", "#10b981")
                    user_reward_info["current_level_icon"] = g_data.get("level_icon", "fas fa-seedling")
                    user_reward_info["current_xp"] = g_data.get("xp", 0)
                    user_reward_info["streak_days"] = g_data.get("streak_days", 0)
                except Exception as g_err:
                    logger.warning(f"Error fetching gamification data for MantaType: {g_err}")

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


class MantaTypeAdminWordBulkCreateAPIView(generics.GenericAPIView):
    """
    📥 Admin Endpoint: Bulk Import Kosakata
    Menerima teks kata yang dipisahkan koma atau baris baru
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request):
        raw_text = request.data.get('words_text', '')
        difficulty = request.data.get('difficulty', 'medium')
        category = request.data.get('category', 'umum')
        meaning = request.data.get('meaning', '')

        if not raw_text:
            return Response({
                "status": "error",
                "message": "Silakan masukkan teks kata-kata yang akan diimpor!"
            }, status=status.HTTP_400_BAD_REQUEST)

        # Pisahkan berdasarkan baris baru atau koma
        raw_items = [
            part.strip().replace(' ', '').upper()
            for line in raw_text.splitlines()
            for part in line.split(',')
            if part.strip()
        ]

        if not raw_items:
            return Response({
                "status": "error",
                "message": "Tidak ada kata yang valid untuk diimpor."
            }, status=status.HTTP_400_BAD_REQUEST)

        created_count = 0
        skipped_count = 0

        for word_str in set(raw_items):
            if not word_str:
                continue

            # Otomatis tentukan difficulty jika tidak ditentukan
            target_diff = difficulty
            if not target_diff or target_diff == 'auto':
                length = len(word_str)
                if length <= 4:
                    target_diff = 'easy'
                elif length <= 7:
                    target_diff = 'medium'
                else:
                    target_diff = 'hard'

            obj, created = api_models.MantaTypeWord.objects.get_or_create(
                word=word_str,
                defaults={
                    'difficulty': target_diff,
                    'category': category or 'umum',
                    'meaning': meaning or None,
                    'is_active': True,
                }
            )
            if created:
                created_count += 1
            else:
                skipped_count += 1

        return Response({
            "status": "success",
            "message": f"Proses impor selesai! {created_count} kata baru berhasil ditambahkan ({skipped_count} kata dilewati karena sudah ada).",
            "created_count": created_count,
            "skipped_count": skipped_count,
            "total_words_now": api_models.MantaTypeWord.objects.count()
        }, status=status.HTTP_201_CREATED)


class MantaTypeAdminResetLeaderboardAPIView(generics.GenericAPIView):
    """
    🧹 Admin Endpoint: Reset Papan Peringkat MantaType
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request):
        mode = request.data.get('mode', 'all')  # 'all', 'guests_only', 'below_wave_3'
        
        if mode == 'guests_only':
            deleted_count, _ = api_models.MantaTypeLeaderboard.objects.filter(is_guest=True).delete()
            msg = f"{deleted_count} skor pemain tamu (Guest) berhasil dibersihkan."
        elif mode == 'test_scores':
            deleted_count, _ = api_models.MantaTypeLeaderboard.objects.filter(score__lte=100).delete()
            msg = f"{deleted_count} skor uji coba (<= 100) berhasil dibersihkan."
        else:
            deleted_count, _ = api_models.MantaTypeLeaderboard.objects.all().delete()
            msg = f"Seluruh papan peringkat MantaType ({deleted_count} entri) telah di-reset untuk musim baru."

        return Response({
            "status": "success",
            "message": msg,
            "deleted_count": deleted_count
        }, status=status.HTTP_200_OK)


class MantaTypeClaimRewardAPIView(generics.GenericAPIView):
    """
    🎁 Endpoint Klaim Bonus XP Harian MantaType
    Menghubungkan pencapaian bermain MantaType langsung ke akun profil pegawai LMS Setjen DPD RI:
    - Menambah StudentPoints (+50 XP, atau +75 XP jika Wave 5+)
    - Mencatat histori ke PointsAuditLog (activity_type='mantatype_reward')
    - Mencatat timeline ke ActivityLog (activity_type='points_earned')
    - Memicu pembukaan Lencana Milestone 'Jagoan Ketik Manta'
    - Memberikan respons progres level kompetensi ASN terbaru
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def post(self, request):
        user = request.user
        if not user or not user.is_authenticated:
            return Response({
                "status": "error",
                "message": "Anda harus login dengan akun pegawai LMS Setjen DPD RI untuk mengklaim bonus XP."
            }, status=status.HTTP_401_UNAUTHORIZED)

        data = request.data or {}
        score = int(data.get("score", 0))
        words_typed = int(data.get("words_typed", 0))
        accuracy = float(data.get("accuracy", 100.0))
        wpm = int(data.get("wpm", 0))
        wave_reached = int(data.get("wave_reached", 1))

        # 1. Validasi Syarat Minimal (Minimal Wave 3 atau Skor >= 1000)
        if wave_reached < 3 and score < 1000:
            return Response({
                "status": "error",
                "message": "Syarat belum terpenuhi. Raih minimal Wave 3 atau Skor 1.000 untuk mengklaim bonus XP harian.",
                "wave_reached": wave_reached,
                "score": score,
                "min_required_wave": 3,
                "min_required_score": 1000
            }, status=status.HTTP_400_BAD_REQUEST)

        # 2. Validasi Batas Klaim Harian (1x per hari kalender WIB)
        now = timezone.localtime(timezone.now())
        today = now.date()

        existing_claim = api_models.MantaTypeDailyReward.objects.filter(user=user, claim_date=today).first()
        if existing_claim:
            return Response({
                "status": "already_claimed",
                "message": f"Anda sudah mengklaim bonus XP harian MantaType (+{existing_claim.points_awarded} XP) hari ini. Silakan kembali lagi besok!",
                "claimed_at": existing_claim.created_at.strftime("%H:%M WIB"),
                "points_awarded": existing_claim.points_awarded
            }, status=status.HTTP_400_BAD_REQUEST)

        # 3. Hitung Poin yang Diberikan (Base 50 XP, bonus +25 jika Wave 5+)
        points_awarded = 75 if wave_reached >= 5 else 50

        # 4. Tambahkan ke StudentPoints
        try:
            api_models.StudentPoints.add_points(
                user=user,
                points=points_awarded,
                category='mantatype_reward',
                description=f"Bonus Harian MantaType Arcade: Skor {score:,}, WPM {wpm}, Wave {wave_reached}"
            )
        except Exception as pts_err:
            logger.error(f"Error awarding StudentPoints in MantaType: {pts_err}", exc_info=True)

        # 5. Simpan Record MantaTypeDailyReward
        daily_reward = api_models.MantaTypeDailyReward.objects.create(
            user=user,
            claim_date=today,
            points_awarded=points_awarded,
            score=score,
            words_typed=words_typed,
            accuracy=round(accuracy, 2),
            wpm=wpm,
            wave_reached=wave_reached
        )

        # 6. Catat ke ActivityLog
        try:
            api_models.ActivityLog.objects.create(
                user=user,
                activity_type='points_earned',
                title="Bonus Harian MantaType Arcade",
                description=f"Meraih bonus {points_awarded} XP pada arcade MantaType (Skor: {score:,}, Wave {wave_reached}).",
                points_awarded=points_awarded,
                metadata={
                    'source': 'mantatype',
                    'score': score,
                    'words_typed': words_typed,
                    'accuracy': accuracy,
                    'wpm': wpm,
                    'wave_reached': wave_reached,
                    'claim_date': str(today)
                }
            )
        except Exception as act_err:
            logger.warning(f"Error creating ActivityLog for MantaType: {act_err}")

        # 7. Ambil status gamifikasi dan leveling terbaru
        gamification_data = {}
        try:
            from api.views.ai_assistant import get_user_gamification_data
            gamification_data = get_user_gamification_data(user)
        except Exception as g_err:
            logger.warning(f"Error getting gamification data: {g_err}")

        return Response({
            "status": "success",
            "message": f"🎉 Selamat! Bonus +{points_awarded} XP berhasil ditambahkan ke profil akun LMS Setjen DPD RI Anda!",
            "points_awarded": points_awarded,
            "claim_date": today.strftime("%d %B %Y"),
            "gamification": {
                "total_xp": gamification_data.get("xp", 0),
                "level": gamification_data.get("level", 1),
                "level_name": gamification_data.get("level_name", "Aparatur Pratama"),
                "level_icon": gamification_data.get("level_icon", "fas fa-seedling"),
                "level_color": gamification_data.get("level_color", "#10b981"),
                "next_level_name": gamification_data.get("next_level_name", "Aparatur Muda"),
                "remaining_xp": gamification_data.get("remaining_xp", 0),
                "xp_progress_pct": gamification_data.get("xp_progress_pct", 0),
            }
        }, status=status.HTTP_201_CREATED)


