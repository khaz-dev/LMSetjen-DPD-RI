"""
Backend AI Assistant untuk LMS Sekretariat Jenderal DPD RI (Manta)
Dirancang dengan prinsip:
1. Smart Intent & Context Scoring: Memahami pertanyaan santai, formal, maupun spesifik.
2. Personalisasi Terpadu: Mengenali nama, kursus terdaftar, progres aktif, dan sertifikat pengguna.
3. Tombol Aksi Cepat (Quick Actions): Navigasi instan ke kursus, sertifikat, atau modal pelaporan.
4. Live Database Search: Merekomendasikan kursus aktif langsung dari database LMS.
5. Plug-and-Play LLM: Mengintegrasikan Google Gemini API dengan prompt yang dipersonalisasi.
"""

import os
import re
import json
import logging
import hashlib
import random
import uuid
import copy
import math
from typing import Dict, Any, List, Tuple

from django.conf import settings
from django.utils import timezone
from django.core.cache import cache
from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status
import requests

from api import models as api_models

logger = logging.getLogger('api')

# ==============================================================================
# BASIS PENGETAHUAN LENGKAP & CERDAS (LMS SETJEN DPD RI)
# ==============================================================================
KNOWLEDGE_BASE = [
    {
        "id": "greetings",
        "keywords": [
            "halo", "hai", "hei", "hello", "hi", "hey", "selamat pagi", "selamat siang",
            "selamat sore", "selamat malam", "assalamualaikum", "pagi", "siang", "sore", "malam"
        ],
        "regex": r"\b(halo+|hai+|hei+|hello+|hi+|hey+|selamat\s+(pagi|siang|sore|malam)|assalamu\s*['a-z]*)\b",
        "reply": (
            "Halo! Senang menyapa Anda 👋 Saya **Manta**, Asisten AI Virtual LMS Sekretariat Jenderal DPD RI.\n\n"
            "Saya siap membantu Anda dengan informasi seputar kursus keparlemenan, modul SCORM, panduan sertifikat digital resmi, hingga bantuan akun SSO.\n\n"
            "Ada yang bisa Manta bantu untuk kegiatan belajar Anda hari ini?"
        ),
        "suggestions": [
            "Apa itu LMS Setjen DPD RI?",
            "Bagaimana cara mulai belajar?",
            "Bagaimana cara unduh sertifikat?",
            "Rekomendasi kursus populer"
        ],
        "actions": [
            {"label": "🔍 Jelajahi Katalog Kursus", "url": "/search/", "type": "route"},
            {"label": "🔐 Masuk SSO", "url": "/login/", "type": "route"}
        ]
    },
    {
        "id": "about_lms_dpd",
        "keywords": [
            "apa itu lms", "tentang lms", "apa itu lmsetjen", "apa itu dpd",
            "fungsi lms", "tujuan lms", "profil lms", "visi misi lms", "mengenal lms"
        ],
        "regex": r"\b(apa\s+itu\s+(lms|lmsetjen|dpd|setjen)|tentang\s+lms|mengenal\s+lms|profil\s+lms)\b",
        "reply": (
            "🏛️ **Mengenal LMS Sekretariat Jenderal DPD RI:**\n\n"
            "**LMS Setjen DPD RI** (Learning Management System) adalah platform pembelajaran terpadu berbasis digital "
            "yang dikembangkan khusus untuk mendukung peningkatan kompetensi, profesionalitas, dan kapasitas aparatur "
            "di lingkungan Sekretariat Jenderal Dewan Perwakilan Daerah Republik Indonesia.\n\n"
            "**Fitur & Layanan Utama:**\n"
            "1. 📚 **Katalog Kursus Terstruktur:** Pelatihan keparlemenan, tata naskah dinas, kepegawaian, hukum, kepemimpinan, dan teknologi informasi.\n"
            "2. 🎬 **E-Learning Interaktif:** Mendukung modul standar SCORM 1.2, video pembelajaran interaktif, dan kuis pemahaman.\n"
            "3. 📜 **Sertifikasi Digital Resmi:** Penerbitan sertifikat kelulusan ber-QR Code keabsahan resmi yang terverifikasi.\n"
            "4. 🔐 **Integrasi SSO Terpadu:** Akses terpusat bagi seluruh pegawai Setjen DPD RI."
        ),
        "suggestions": [
            "Bagaimana cara mulai belajar?",
            "Kursus apa saja yang tersedia?",
            "Cara unduh sertifikat kelulusan"
        ],
        "actions": [
            {"label": "🔍 Jelajahi Katalog Kursus", "url": "/search/", "type": "route"},
            {"label": "✨ Capaian Belajar", "url": "/capaian/", "type": "route"}
        ]
    },
    {
        "id": "how_to_start",
        "keywords": [
            "bagaimana cara mulai", "cara memulai belajar", "langkah awal belajar",
            "alur mulai belajar", "cara ikut kursus", "daftar kursus", "mulai kursus", "panduan pemula"
        ],
        "regex": r"\b(cara\s+(mulai(\s+belajar)?|daftar\s*kursus|mengambil\s*kursus)|langkah\s*awal|panduan\s*pemula|bagaimana\s+mulai)\b",
        "reply": (
            "🚀 **Panduan Langkah Mudah Memulai Belajar di LMS Setjen DPD RI:**\n\n"
            "1. **Masuk ke Akun Anda:** Pastikan Anda sudah login menggunakan akun SSO Setjen DPD RI atau akun terdaftar Anda.\n"
            "2. **Jelajahi Katalog Kursus:** Klik menu **Kursus** di navigasi atas untuk melihat daftar pelatihan yang tersedia sesuai bidang kerja Anda.\n"
            "3. **Pilih & Daftarkan Diri:** Klik kursus yang diminati, baca silabus serta tujuan pembelajaran, lalu klik tombol **Daftar Kursus / Mulai Belajar**.\n"
            "4. **Pelajari Modul:** Tonton video materi atau jalankan modul interaktif SCORM sesuai urutan bab.\n"
            "5. **Selesaikan Evaluasi & Unduh Sertifikat:** Kerjakan kuis akhir hingga mencapai batas nilai kelulusan (*passing grade*) untuk otomatis memperoleh sertifikat resmi."
        ),
        "suggestions": [
            "Rekomendasi kursus populer",
            "Berapa batas nilai kelulusan kuis?",
            "Di mana sertifikat saya?"
        ],
        "actions": [
            {"label": "📚 Buka Katalog Kursus", "url": "/search/", "type": "route"},
            {"label": "📖 Panduan Pengguna", "url": "/user-guide/", "type": "route"}
        ]
    },
    {
        "id": "certificate_guide",
        "keywords": [
            "sertifikat", "unduh sertifikat", "cetak sertifikat", "klaim sertifikat",
            "piagam", "kelulusan", "qr code", "verifikasi sertifikat", "passing grade", "syarat lulus"
        ],
        "regex": r"\b(sertifikat|piagam|kelulusan|lulus|unduh\s*sertifikat|cetak\s*sertifikat|klaim\s*sertifikat)\b",
        "reply": (
            "📜 **Panduan Lengkap Sertifikat Kelulusan:**\n\n"
            "• **Syarat Penerbitan:** Anda harus menuntaskan 100% materi pembelajaran (video/SCORM) serta mencapai nilai minimal (*passing grade*) pada kuis/evaluasi akhir.\n"
            "• **Cara Mengunduh:** Masuk ke menu **Siswa / Profil** di pojok kanan atas, pilih **Sertifikat Kursus**, lalu klik tombol **Unduh PDF** pada kursus yang telah Anda selesaikan.\n"
            "• **Keabsahan & Verifikasi:** Setiap lembar sertifikat dilengkapi tanda tangan elektronik resmi dan **QR-Code unik**. Siapapun dapat memindai QR tersebut untuk memvalidasi keaslian dokumen di portal resmi Setjen DPD RI."
        ),
        "suggestions": [
            "Bagaimana jika nilai kuis saya belum lulus?",
            "Halaman verifikasi sertifikat publik",
            "Tanya kendala teknis"
        ],
        "actions": [
            {"label": "📜 Sertifikat Saya", "url": "/student/sertifikat/", "type": "route"},
            {"label": "📚 Kursus Saya", "url": "/student/courses/", "type": "route"}
        ]
    },
    {
        "id": "sso_and_account",
        "keywords": [
            "sso", "login", "masuk", "akun", "kata sandi", "password", "lupa sandi",
            "profil", "nip", "unit kerja", "jabatan", "ganti foto", "daftar akun"
        ],
        "regex": r"\b(sso|login|masuk\s*sso|akun|kata\s*sandi|password|lupa\s*password|nip|profil)\b",
        "reply": (
            "🔐 **Panduan Akun & Layanan SSO Setjen DPD RI:**\n\n"
            "• **Login Pegawai (SSO):** Pegawai Sekretariat Jenderal DPD RI dapat langsung masuk menggunakan kredensial **Single Sign-On (SSO)** resmi kepegawaian tanpa perlu registrasi manual.\n"
            "• **Profil & Data Jabatan:** Data NIP, unit organisasi, dan jabatan otomatis terintegrasi. Anda dapat memperbarui foto profil dan preferensi akun melalui menu **Pengaturan Profil**.\n"
            "• **Kendala Akses / Lupa Sandi:** Jika akun SSO Anda terkendala, silakan gunakan fitur pemulihan kata sandi portal SSO DPD RI atau hubungi tim administrator Bagian TI Setjen DPD RI."
        ),
        "suggestions": [
            "Bagaimana cara ubah profil?",
            "Hubungi administrator helpdesk",
            "Kembali ke panduan kursus"
        ],
        "actions": [
            {"label": "🔐 Halaman Login SSO", "url": "/login/", "type": "route"},
            {"label": "👤 Profil Akun", "url": "/student/profile/", "type": "route"}
        ]
    },
    {
        "id": "troubleshooting_scorm_video",
        "keywords": [
            "scorm", "video", "macet", "player", "buffering", "loading terus",
            "tidak bisa dibuka", "error video", "h5p", "kuis macet", "progres tidak tersimpan"
        ],
        "regex": r"\b(scorm\s*macet|video\s*macet|tidak\s*bisa\s*(dibuka|diputar)|loading\s*terus|error\s*(video|scorm|kuis)|progres\s*hilang)\b",
        "reply": (
            "⚡ **Solusi Kendala Pemutar Video & Paket SCORM:**\n\n"
            "Jika materi video atau modul SCORM mengalami kendala loading/macet, berikut langkah penanganannya:\n"
            "1. **Segarkan Halaman (*Hard Refresh*):** Tekan kombinasi tombol `Ctrl + F5` (Windows) atau `Cmd + Shift + R` (Mac) untuk membersihkan cache skrip pemutar.\n"
            "2. **Cek Ekstensi Peramban:** Beberapa modul SCORM menggunakan popup/frame interaktif. Nonaktifkan sementara *AdBlocker* atau ekstensi pengubah skrip di peramban Anda.\n"
            "3. **Gunakan Peramban Rekomendasi:** Disarankan menggunakan Google Chrome, Microsoft Edge, atau Mozilla Firefox versi terbaru.\n"
            "4. **Koneksi Jaringan:** Pastikan kuota dan stabilitas jaringan mencukupi untuk streaming media berkualitas tinggi.\n\n"
            "Jika kendala berlanjut, Anda dapat langsung mengklik tombol **Laporkan Kendala** di bawah untuk mengirim pesan ke tim admin!"
        ),
        "suggestions": [
            "Cara lapor kendala ke admin",
            "Bagaimana progres kursus disimpan?",
            "Panduan sertifikat"
        ],
        "actions": [
            {"label": "💬 Laporkan Kendala", "action": "open_feedback", "type": "event"},
            {"label": "📞 Kontak Helpdesk", "url": "/contact/", "type": "route"}
        ]
    },
    {
        "id": "quiz_and_passing_grade",
        "keywords": [
            "kuis", "quiz", "ujian", "evaluasi", "passing grade", "batas nilai",
            "mengulang kuis", "remedial", "nilai kuis", "soal", "gagal kuis"
        ],
        "regex": r"\b(kuis|quiz|ujian|evaluasi|passing\s*grade|batas\s*nilai|remedial|mengulang\s*kuis)\b",
        "reply": (
            "📝 **Informasi Kuis & Nilai Kelulusan:**\n\n"
            "• **Tujuan Kuis:** Mengukur pemahaman Anda terhadap kompetensi modul yang telah dipelajari.\n"
            "• **Passing Grade:** Nilai kelulusan standar pada umumnya adalah **70% - 80%** (disesuaikan dengan ketentuan silabus pelatihan).\n"
            "• **Kesempatan Mengulang:** Anda dapat mengulang kuis jika nilai pertama belum mencukupi. Sangat disarankan meninjau kembali tayangan materi sebelum mengulang kuis evaluasi."
        ),
        "suggestions": [
            "Syarat klaim sertifikat",
            "Rekomendasi kursus populer",
            "Tanya kendala teknis"
        ],
        "actions": [
            {"label": "📚 Kembali ke Kursus", "url": "/student/courses/", "type": "route"},
            {"label": "📜 Cek Sertifikat", "url": "/student/sertifikat/", "type": "route"}
        ]
    },
    {
        "id": "helpdesk_contact",
        "keywords": [
            "helpdesk", "kontak admin", "hubungi admin", "call center", "cs", "customer service",
            "bantuan teknis", "lapor bug", "kontak lms", "bantuan lms", "email lms"
        ],
        "regex": r"\b(helpdesk|kontak\s*admin|hubungi\s*admin|call\s*center|customer\s*service|bantuan\s*teknis|lapor\s*kendala)\b",
        "reply": (
            "📞 **Layanan Bantuan & Helpdesk Setjen DPD RI:**\n\n"
            "Jika Anda mengalami kendala teknis sistem atau memiliki pertanyaan khusus kepegawaian:\n"
            "• **Fitur Laporkan Kendala:** Klik tombol di bawah untuk langsung membuka formulir pengaduan teknis ke tim admin.\n"
            "• **Unit Pengelola:** Pusat Pelatihan & Pengembangan ASN / Bagian TI Sekretariat Jenderal DPD RI, Gedung DPD RI Kompleks Parlemen Senayan, Jakarta.\n"
            "• **Jam Layanan:** Senin – Jumat, pukul 08:00 – 16:30 WIB."
        ),
        "suggestions": [
            "Video atau modul SCORM macet",
            "Cara unduh sertifikat",
            "Kembali ke katalog kursus"
        ],
        "actions": [
            {"label": "💬 Laporkan Kendala", "action": "open_feedback", "type": "event"},
            {"label": "📞 Kontak Helpdesk", "url": "/contact/", "type": "route"}
        ]
    },
    {
        "id": "casual_and_slang",
        "keywords": [
            "walawe", "wkwk", "haha", "hehe", "mantap", "keren", "keren bgt", "ok",
            "oke", "siap", "makasih", "terima kasih", "thanks", "thx", "waduh", "anjir", "gokil"
        ],
        "regex": r"\b(walawe|wkwk+|haha+|hehe+|mantap|keren|gokil|waduh|makasih|terima\s*kasih|thanks|thx|ok|oke|siap)\b",
        "reply": (
            "Haha, siap! 😄 Senang bisa nemenin dan bantu Anda di LMS Setjen DPD RI.\n\n"
            "Ada materi pelatihan atau informasi seputar kursus dan sertifikat yang mau Manta bantu carikan lagi?"
        ),
        "suggestions": [
            "Cari kursus populer",
            "Cara unduh sertifikat",
            "Apa itu LMS Setjen DPD RI?"
        ],
        "actions": [
            {"label": "🔍 Cari Pelatihan Baru", "url": "/search/", "type": "route"},
            {"label": "📜 Sertifikat Saya", "url": "/student/sertifikat/", "type": "route"}
        ]
    },
    {
        "id": "who_is_manta",
        "keywords": [
            "siapa kamu", "siapa manta", "siapakah kamu", "manta itu apa", "kamu siapa", "profil manta"
        ],
        "regex": r"\b(siapa\s*(kamu|anda|manta)|kamu\s*siapa|tentang\s*manta|apa\s*itu\s*manta)\b",
        "reply": (
            "Saya adalah **Manta**, maskot resmi sekaligus Asisten AI Virtual di LMS Sekretariat Jenderal DPD RI! 🌊\n\n"
            "Karakter saya terinspirasi dari keindahan dan kecerdasan Ikan Pari Manta di perairan Indonesia yang lincah dan berwawasan luas. "
            "Saya di sini bertugas memandu seluruh aparatur dan pembelajar Setjen DPD RI agar proses belajar daring menjadi lebih mudah, interaktif, dan menyenangkan!"
        ),
        "suggestions": [
            "Apa saja yang bisa Manta bantu?",
            "Bagaimana cara mulai kursus?",
            "Apa itu LMS Setjen DPD RI?"
        ],
        "actions": [
            {"label": "🚀 Mulai Belajar", "url": "/search/", "type": "route"},
            {"label": "🏛️ Tentang LMS", "url": "/tentang/", "type": "route"}
        ]
    }
]


def get_user_gamification_data(user: Any) -> Dict[str, Any]:
    """
    Menghitung metrik gamifikasi terpadu ASN Setjen DPD RI:
    - Level Kompetensi ASN (6 Jenjang Dikalibrasi Berimbang):
        Level 1: Aparatur Pratama (0 – 249 XP) | #10b981
        Level 2: Aparatur Muda (250 – 599 XP) | #0ea5e9
        Level 3: Aparatur Madya (600 – 1.199 XP) | #6366f1
        Level 4: Aparatur Utama (1.200 – 2.499 XP) | #8b5cf6
        Level 5: Ksatria Parlemen (2.500 – 4.499 XP) | #f59e0b
        Level 6: Pakar Reformasi Birokrasi (4.500+ XP) | #eab308
    - Study Streak (Hari Belajar Berurutan)
    - Total JP Terkumpul (terhadap target 20 JP LAN RI)
    - 8 Lencana Prestasi Belajar (Milestone Badges)
    """
    import datetime

    default_badges = [
        {"id": "first_step", "title": "Langkah Perdana", "category": "Dasar", "icon": "fas fa-seedling", "color": "#10b981", "description": "Menyelesaikan materi pembelajaran pertama di LMS Setjen DPD RI.", "is_unlocked": False, "progress": "0/1 Materi", "progress_pct": 0},
        {"id": "study_streak", "title": "Pembelajar Tangguh", "category": "Kedisiplinan", "icon": "fas fa-fire-flame-curved", "color": "#f97316", "description": "Menjaga ritme belajar aktif selama minimal 3 hari berurutan.", "is_unlocked": False, "progress": "0/3 Hari", "progress_pct": 0},
        {"id": "quiz_ace", "title": "Jawara Evaluasi", "category": "Penguasaan", "icon": "fas fa-award", "color": "#6366f1", "description": "Meraih nilai sempurna 100% pada evaluasi pemahaman materi.", "is_unlocked": False, "progress": "Perlu skor 100", "progress_pct": 0},
        {"id": "course_finisher", "title": "Lulusan Kompeten", "category": "Penyelesaian", "icon": "fas fa-graduation-cap", "color": "#0ea5e9", "description": "Menuntaskan kursus penuh dan memperoleh sertifikat resmi kelulusan.", "is_unlocked": False, "progress": "0/1 Kursus", "progress_pct": 0},
        {"id": "jp_champion", "title": "Ksatria 20 JP ASN", "category": "Mandat Regulasi", "icon": "fas fa-trophy", "color": "#eab308", "description": "Memenuhi target tahunan minimal 20 JP sesuai standar LAN RI.", "is_unlocked": False, "progress": "0/20 JP", "progress_pct": 0},
        {"id": "manta_explorer", "title": "Penjelajah Pengetahuan", "category": "Keaktifan AI", "icon": "fas fa-compass", "color": "#0d9488", "description": "Berdiskusi aktif dan menggali materi bersama Asisten AI Manta.", "is_unlocked": True, "progress": "Aktif & Terbuka", "progress_pct": 100},
        {"id": "flashcard_master", "title": "Maestro Active Recall", "category": "Metode Belajar", "icon": "fas fa-layer-group", "color": "#8b5cf6", "description": "Menguji daya ingat konsep kunci dengan Flashcard & Self-Quiz Manta.", "is_unlocked": True, "progress": "Siap Digunakan", "progress_pct": 100},
        {"id": "multi_course", "title": "Multitalenta Parlemen", "category": "Keberagaman", "icon": "fas fa-crown", "color": "#ec4899", "description": "Menyelesaikan 3 kursus pelatihan atau lebih di lingkungan Setjen DPD RI.", "is_unlocked": False, "progress": "0/3 Kursus", "progress_pct": 0}
    ]

    if not user or not getattr(user, 'is_authenticated', False):
        return {
            "is_guest": True,
            "user_id": None,
            "user_name": "Tamu LMS",
            "level": 1,
            "level_name": "Aparatur Pratama",
            "level_icon": "fas fa-seedling",
            "level_color": "#10b981",
            "xp": 0,
            "min_xp": 0,
            "next_level_xp": 250,
            "next_level_name": "Aparatur Muda",
            "xp_progress_pct": 0,
            "remaining_xp": 250,
            "streak_days": 0,
            "total_jp": 0,
            "target_jp": 20,
            "jp_progress_pct": 0,
            "unlocked_count": 2,
            "total_badges": len(default_badges),
            "badges": default_badges,
            "completed_lessons_count": 0,
            "certificates_count": 0,
            "quizzes_passed_count": 0,
            "has_new_celebration": False
        }

    # 1. Poin Aktual (XP)
    student_pts = api_models.StudentPoints.objects.filter(user=user).first()
    points = student_pts.lifetime_points if student_pts else 0

    completed_lessons_count = api_models.CompletedLesson.objects.filter(user=user).count()
    certificates_count = api_models.Certificate.objects.filter(user=user, is_valid=True).count()
    quizzes_passed = api_models.QuizAttempt.objects.filter(user=user, is_passed=True)
    quizzes_passed_count = quizzes_passed.count()
    has_perfect_quiz = quizzes_passed.filter(score__gte=99.9).exists()

    if points == 0:
        points = (completed_lessons_count * 15) + (certificates_count * 100) + (quizzes_passed_count * 25)

    # 2. Skala 6 Tingkat Kompetensi ASN (Calibrated Progression Curve)
    if points < 250:
        level = 1
        level_name = "Aparatur Pratama"
        level_icon = "fas fa-seedling"
        level_color = "#10b981"
        min_xp = 0
        next_level_xp = 250
        next_level_name = "Aparatur Muda"
        xp_progress_pct = min(100, int((points / 250.0) * 100))
        remaining_xp = max(0, next_level_xp - points)
    elif points < 600:
        level = 2
        level_name = "Aparatur Muda"
        level_icon = "fas fa-shield-halved"
        level_color = "#0ea5e9"
        min_xp = 250
        next_level_xp = 600
        next_level_name = "Aparatur Madya"
        xp_progress_pct = min(100, int(((points - 250) / 350.0) * 100))
        remaining_xp = max(0, next_level_xp - points)
    elif points < 1200:
        level = 3
        level_name = "Aparatur Madya"
        level_icon = "fas fa-gem"
        level_color = "#6366f1"
        min_xp = 600
        next_level_xp = 1200
        next_level_name = "Aparatur Utama"
        xp_progress_pct = min(100, int(((points - 600) / 600.0) * 100))
        remaining_xp = max(0, next_level_xp - points)
    elif points < 2500:
        level = 4
        level_name = "Aparatur Utama"
        level_icon = "fas fa-medal"
        level_color = "#8b5cf6"
        min_xp = 1200
        next_level_xp = 2500
        next_level_name = "Ksatria Parlemen"
        xp_progress_pct = min(100, int(((points - 1200) / 1300.0) * 100))
        remaining_xp = max(0, next_level_xp - points)
    elif points < 4500:
        level = 5
        level_name = "Ksatria Parlemen"
        level_icon = "fas fa-crown"
        level_color = "#f59e0b"
        min_xp = 2500
        next_level_xp = 4500
        next_level_name = "Pakar Reformasi Birokrasi"
        xp_progress_pct = min(100, int(((points - 2500) / 2000.0) * 100))
        remaining_xp = max(0, next_level_xp - points)
    else:
        level = 6
        level_name = "Pakar Reformasi Birokrasi"
        level_icon = "fas fa-trophy"
        level_color = "#eab308"
        min_xp = 4500
        next_level_xp = points
        next_level_name = "Puncak Prestasi ASN"
        xp_progress_pct = 100
        remaining_xp = 0

    # 3. Hitung Hari Belajar Berurutan (Study Streak)
    today = timezone.now().date()
    yesterday = today - datetime.timedelta(days=1)
    active_dates = set()

    for d in api_models.ActivityLog.objects.filter(user=user).values_list('activity_date', flat=True):
        if d:
            active_dates.add(d.date())
    for d in api_models.CompletedLesson.objects.filter(user=user).values_list('date', flat=True):
        if d:
            active_dates.add(d.date())

    streak_days = 0
    if today in active_dates or yesterday in active_dates:
        check_date = today if today in active_dates else yesterday
        while check_date in active_dates:
            streak_days += 1
            check_date = check_date - datetime.timedelta(days=1)
    else:
        streak_days = 0

    # 4. Hitung Total JP ASN
    enrollments = api_models.EnrolledCourse.objects.filter(user=user).select_related('course')
    completed_enrollments = [e for e in enrollments if getattr(e, 'completed', False) or (hasattr(e, 'completion_percentage') and e.completion_percentage() >= 100)]
    total_jp = 0
    for ce in completed_enrollments:
        c = ce.course
        dur_secs = 0
        lectures = api_models.VariantItem.objects.filter(variant__course=c)
        for vi in lectures:
            if getattr(vi, 'duration', None):
                dur_secs += vi.duration.total_seconds()
            elif getattr(vi, 'duration_seconds', None):
                dur_secs += vi.duration_seconds
        course_jp = max(2, min(12, round((dur_secs / 60.0) / 45.0))) if dur_secs > 0 else 2
        total_jp += course_jp

    jp_progress_pct = min(100, int((total_jp / 20.0) * 100))

    # 5. Evaluasi 8 Lencana Prestasi Belajar
    badges = [
        {
            "id": "first_step",
            "title": "Langkah Perdana",
            "category": "Dasar",
            "icon": "fas fa-seedling",
            "color": "#10b981",
            "description": "Menyelesaikan materi pembelajaran pertama di LMS Setjen DPD RI.",
            "is_unlocked": completed_lessons_count >= 1,
            "progress": f"{min(1, completed_lessons_count)}/1 Materi",
            "progress_pct": 100 if completed_lessons_count >= 1 else 0
        },
        {
            "id": "study_streak",
            "title": "Pembelajar Tangguh",
            "category": "Kedisiplinan",
            "icon": "fas fa-fire-flame-curved",
            "color": "#f97316",
            "description": "Menjaga ritme belajar aktif selama minimal 3 hari berurutan.",
            "is_unlocked": streak_days >= 3,
            "progress": f"{min(3, streak_days)}/3 Hari Beruntun",
            "progress_pct": min(100, int((streak_days / 3.0) * 100))
        },
        {
            "id": "quiz_ace",
            "title": "Jawara Evaluasi",
            "category": "Penguasaan",
            "icon": "fas fa-award",
            "color": "#6366f1",
            "description": "Meraih nilai sempurna 100% pada evaluasi kuis pemahaman materi.",
            "is_unlocked": has_perfect_quiz,
            "progress": "Sempurna 100%" if has_perfect_quiz else ("Lulus Kuis" if quizzes_passed_count > 0 else "Belum Kuis"),
            "progress_pct": 100 if has_perfect_quiz else (50 if quizzes_passed_count > 0 else 0)
        },
        {
            "id": "course_finisher",
            "title": "Lulusan Kompeten",
            "category": "Penyelesaian",
            "icon": "fas fa-graduation-cap",
            "color": "#0ea5e9",
            "description": "Menuntaskan kursus penuh dan memperoleh sertifikat resmi kelulusan.",
            "is_unlocked": certificates_count >= 1,
            "progress": f"{min(1, certificates_count)}/1 Kursus Lulus",
            "progress_pct": 100 if certificates_count >= 1 else 0
        },
        {
            "id": "jp_champion",
            "title": "Ksatria 20 JP ASN",
            "category": "Mandat Regulasi",
            "icon": "fas fa-trophy",
            "color": "#eab308",
            "description": "Memenuhi target tahunan minimal 20 JP sesuai standar LAN RI.",
            "is_unlocked": total_jp >= 20,
            "progress": f"{total_jp}/20 JP",
            "progress_pct": jp_progress_pct
        },
        {
            "id": "manta_explorer",
            "title": "Penjelajah Pengetahuan",
            "category": "Keaktifan AI",
            "icon": "fas fa-compass",
            "color": "#0d9488",
            "description": "Berdiskusi aktif dan menggali materi bersama Asisten AI Manta.",
            "is_unlocked": True,
            "progress": "Aktif & Terbuka",
            "progress_pct": 100
        },
        {
            "id": "flashcard_master",
            "title": "Maestro Active Recall",
            "category": "Metode Belajar",
            "icon": "fas fa-layer-group",
            "color": "#8b5cf6",
            "description": "Menguji daya ingat konsep kunci dengan Flashcard & Self-Quiz Manta.",
            "is_unlocked": True,
            "progress": "Siap Digunakan",
            "progress_pct": 100
        },
        {
            "id": "multi_course",
            "title": "Multitalenta Parlemen",
            "category": "Keberagaman",
            "icon": "fas fa-crown",
            "color": "#ec4899",
            "description": "Menyelesaikan 3 kursus pelatihan atau lebih di lingkungan Setjen DPD RI.",
            "is_unlocked": certificates_count >= 3,
            "progress": f"{min(3, certificates_count)}/3 Kursus",
            "progress_pct": min(100, int((certificates_count / 3.0) * 100))
        }
    ]

    unlocked_count = sum(1 for b in badges if b["is_unlocked"])
    user_name = user.full_name or user.username or "Rekan ASN"

    return {
        "is_guest": False,
        "user_id": user.id,
        "user_name": user_name,
        "level": level,
        "level_name": level_name,
        "level_icon": level_icon,
        "level_color": level_color,
        "xp": points,
        "min_xp": min_xp,
        "next_level_xp": next_level_xp,
        "next_level_name": next_level_name,
        "xp_progress_pct": xp_progress_pct,
        "remaining_xp": remaining_xp,
        "streak_days": streak_days,
        "total_jp": total_jp,
        "target_jp": 20,
        "jp_progress_pct": jp_progress_pct,
        "unlocked_count": unlocked_count,
        "total_badges": len(badges),
        "badges": badges,
        "completed_lessons_count": completed_lessons_count,
        "certificates_count": certificates_count,
        "quizzes_passed_count": quizzes_passed_count,
        "has_new_celebration": unlocked_count > 0
    }


class AIAssistantChatAPIView(APIView):
    """
    Endpoint Backend AI Asisten Manta:
    POST /api/v1/ai/chat/
    
    Fitur:
    - Smart Multi-Tier Intent Matching (memahami pertanyaan natural, formal, hingga santai).
    - Personalisasi Data Pengguna (Nama, Kursus Diikuti, Progres Belajar, Sertifikat).
    - Tombol Aksi Cepat (Quick Action Buttons) untuk navigasi instan.
    - Terintegrasi Database Kursus Aktif LMS Setjen DPD RI secara real-time.
    - User-Isolated Caching untuk respons kilat (< 2ms).
    - Plug-and-Play LLM: Memanggil Gemini Flash / OpenAI jika API key dikonfigurasi.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        user_message = request.data.get("message", "").strip()
        history = request.data.get("history", [])

        if not user_message:
            return Response(
                {"status": "error", "message": "Pesan tidak boleh kosong."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 1. Ekstraksi Konteks Pengguna (Personalisasi) & Halaman Aktif (Page Awareness)
        user_ctx = self._get_user_context(request)
        user_id_str = str(user_ctx.get("user_id") or "guest")

        page_ctx = request.data.get("page_context") or {}
        course_slug = page_ctx.get("course_slug")
        pathname = page_ctx.get("pathname") or request.data.get("current_path") or ""
        if not course_slug and "/course-detail/" in pathname:
            slug_match = re.search(r"/course-detail/([^/]+)/?", pathname)
            if slug_match:
                course_slug = slug_match.group(1)

        current_course = None
        if course_slug:
            try:
                current_course = api_models.Course.objects.filter(slug=course_slug, platform_status="Published").first()
            except Exception:
                current_course = None

        # 2. Normalisasi teks & User-Isolated Caching (termasuk course_slug jika ada)
        norm_query = re.sub(r"[^\w\s]", "", user_message.lower()).strip()
        course_slug_key = f"_{course_slug}" if course_slug else ""
        cache_key = f"ai_manta_chat_{user_id_str}{course_slug_key}_{hashlib.md5(norm_query.encode('utf-8')).hexdigest()}"
        cached_result = cache.get(cache_key)
        if cached_result:
            return Response(cached_result, status=status.HTTP_200_OK)

        # 3. Handle Pertanyaan Kontekstual Khusus Halaman Kursus yang Sedang Dilihat
        if current_course:
            is_course_context_query = bool(re.search(
                r"\b(kursus\s*ini|pelatihan\s*ini|materi\s*ini|silabus|modul\s*ini|bab\s*ini|instruktur(\s*ini)?|pengajar(\s*ini)?|prasyarat|syarat\s*lulus|evaluasi|tentang\s*kursus\s*ini|ringkasan\s*kursus|jadwal\s*kursus)\b",
                norm_query
            ))
            if is_course_context_query:
                response_data = self._handle_current_course_query(current_course, user_message, norm_query, user_ctx)
                cache.set(cache_key, response_data, timeout=180)
                return Response(response_data, status=status.HTTP_200_OK)

        # 4. Handle Pertanyaan Terpersonalisasi Khusus (Kursus Saya & Progres Belajar)
        is_my_courses_query = re.search(
            r"\b(kursus\s*saya|kelas\s*saya|progres\s*belajar|progres\s*saya|pelatihan\s*saya|daftar\s*kursus\s*saya|lanjut\s*belajar)\b",
            norm_query
        )
        if is_my_courses_query:
            response_data = self._handle_personalized_courses(user_ctx)
            cache.set(cache_key, response_data, timeout=60)
            return Response(response_data, status=status.HTTP_200_OK)

        # 4.5. Handle Smart Learning Reminder / Nudge Query
        is_nudge_query = re.search(
            r"\b(pengingat\s*belajar|tugas\s*belum\s*selesai|kursus\s*belum\s*selesai|ingatkan\s*(saya)?|materi\s*tersisa|progres\s*tertunda)\b",
            norm_query
        )
        if is_nudge_query and not re.search(r"\b(20\s*jp|jam\s*pelajaran|target\s*jp|pemenuhan\s*jp|jadwal\s*belajar|rencana\s*belajar)\b", norm_query):
            response_data = self._handle_learning_nudge_query(user_ctx)
            cache.set(cache_key, response_data, timeout=60)
            return Response(response_data, status=status.HTTP_200_OK)

        # 4.6. AI Study Coach & Pemenuhan 20 JP ASN Tracker (Personalized Learning Plan)
        is_jp_coach_query = bool(re.search(
            r"\b(20\s*jp|jam\s*pelajaran|target\s*jp|pemenuhan\s*jp|status\s*jp|study\s*coach|rencana\s*belajar|jadwal\s*belajar|roadmap\s*belajar|kewajiban\s*(asn|belajar)|progress\s*jp|cek\s*jp|hitung\s*jp|target\s*belajar|jam\s*belajar|jp\s*saya)\b",
            norm_query
        ))
        if is_jp_coach_query:
            jp_response = self._handle_asn_jp_tracker(user_ctx, norm_query)
            if jp_response:
                cache.set(cache_key, jp_response, timeout=60)
                return Response(jp_response, status=status.HTTP_200_OK)

        # 4.7. AI Learning Journey Milestone Badges & Gamifikasi Progres Belajar
        is_gamification_badges_query = bool(re.search(
            r"\b(lencana|badge|lencana\s*saya|badge\s*saya|gamifikasi|milestone|pencapaian|prestasi|level\s*(saya|belajar)?|xp(\s*saya)?|streak|hari\s*beruntun|peringkat\s*saya|poin\s*saya|tampilkan\s*lencana|lihat\s*badge|koleksi\s*lencana)\b",
            norm_query
        ))
        if is_gamification_badges_query:
            badges_response = self._handle_learning_journey_badges(user_ctx, norm_query)
            if badges_response:
                cache.set(cache_key, badges_response, timeout=30)
                return Response(badges_response, status=status.HTTP_200_OK)

        # 5. Handle Pertanyaan Terpersonalisasi Khusus (Sertifikat Saya)
        is_my_cert_query = re.search(
            r"\b(sertifikat\s*(saya|ku|milik\s*saya)|unduh\s*sertifikat\s*saya|lihat\s*sertifikat|piagam\s*saya)\b",
            norm_query
        )
        if is_my_cert_query:
            response_data = self._handle_personalized_certificates(user_ctx)
            cache.set(cache_key, response_data, timeout=60)
            return Response(response_data, status=status.HTTP_200_OK)

        # 6. Handle Sapaan Ramah Terpersonalisasi (Greeting)
        is_greeting_match = re.search(
            r"\b(halo+|hai+|hei+|hello+|hi+|hey+|selamat\s+(pagi|siang|sore|malam)|assalamu\s*['a-z]*)\b",
            norm_query
        )
        if is_greeting_match and len(norm_query.split()) <= 4:
            response_data = self._handle_personalized_greeting(user_ctx)
            cache.set(cache_key, response_data, timeout=120)
            return Response(response_data, status=status.HTTP_200_OK)

        # 6.5. Smart Helpdesk & Auto-Diagnostic Kendala Teknis
        is_tech_issue = bool(re.search(
            r"\b(macet|error|kendala|masalah|tidak\s*(bisa|jalan|putar|simpan|play|buka|submit|unduh|muncul)|blank|layar\s*hitam|loading\s*terus|gagal\s*(submit|simpan|unduh|login)|buffering|rusak|freeze|hang|lapor\s*(bug|kendala)|bantuan\s*teknis|helpdesk)\b",
            norm_query
        ))
        if is_tech_issue and not re.search(r"\b(jadwal|sertifikat\s*saya|kursus\s*saya|progres\s*saya)\b", norm_query):
            tech_response = self._handle_smart_helpdesk_diagnostic(user_message, norm_query, user_ctx, current_course)
            if tech_response:
                cache.set(cache_key, tech_response, timeout=120)
                return Response(tech_response, status=status.HTTP_200_OK)

        # 6.8. Instant Course & Chapter AI Summarizer with Smart Note Export
        is_summary_query = bool(re.search(
            r"\b(rangkum(an)?|ringkas(an)?|kesimpulan|poin\s*penting|key\s*takeaways?|takeaways?|garis\s*besar|intisari|resume|apa\s*inti\s*(dari)?|ulasan\s*singkat)\b",
            norm_query
        ))
        if is_summary_query:
            summary_response = self._handle_course_summarizer(user_message, norm_query, user_ctx, current_course)
            if summary_response:
                cache.set(cache_key, summary_response, timeout=120)
                return Response(summary_response, status=status.HTTP_200_OK)

        # 6.9. User Saved Notes Navigator & Locator (Pencarian & Penunjuk Lokasi Catatan Belajar)
        is_notes_query = bool(re.search(
            r"\b(catatan(\s*saya|\s*belajar|\s*tersimpan)?|di\s*mana\s*catatan|buka\s*catatan|lihat\s*catatan|tampilkan\s*catatan|temukan\s*catatan|cari\s*catatan|tidak\s*(bisa\s*)?menemukan\s*catatan|note(\s*saya)?|my\s*notes)\b",
            norm_query
        )) and not bool(re.search(r"\b(rangkum|ringkas|simpan\s*ke\s*catatan)\b", norm_query))
        if is_notes_query:
            notes_response = self._handle_user_notes_query(user_message, norm_query, user_ctx, current_course)
            if notes_response:
                cache.set(cache_key, notes_response, timeout=60)
                return Response(notes_response, status=status.HTTP_200_OK)

        # 6.95. AI Contextual Video Milestone & Timestamp Jumper
        is_video_jump_query = bool(re.search(
            r"\b(menit|detik|timestamp|lompat|tonton|putar|seek|milestone|chapter|bagian\s*mana|posisi\s*video|di\s*menit\s*berapa)\b",
            norm_query
        )) and not bool(re.search(r"\b(20\s*jp|jam\s*pelajaran|target\s*jp|jadwal\s*belajar)\b", norm_query))
        if is_video_jump_query:
            video_jump_response = self._handle_video_timestamp_jumper(user_message, norm_query, user_ctx, current_course)
            if video_jump_response:
                cache.set(cache_key, video_jump_response, timeout=60)
                return Response(video_jump_response, status=status.HTTP_200_OK)

        # 7. Deep Syllabus & Lesson Search (Pencarian Isi Modul, Bab, & Materi Pembelajaran Spesifik)
        is_lesson_search = bool(re.search(
            r"\b(materi\s*(apa|mana)|modul\s*(apa|mana)|bab\s*(apa|mana)|pelajaran\s*(apa|mana)|isi\s*modul|isi\s*bab|silabus|topik\s*apa|bahas(an)?\s*tentang|ada\s*materi|cari\s*materi|cari\s*modul|pembahasan\s*tentang|apakah\s*ada\s*materi|di\s*materi\s*apa|ada\s*bab|materi\s*tentang|modul\s*tentang)\b",
            norm_query
        ))
        if is_lesson_search:
            lesson_response = self._search_lessons_response(user_message, norm_query, user_ctx, current_course)
            if lesson_response:
                cache.set(cache_key, lesson_response, timeout=180)
                return Response(lesson_response, status=status.HTTP_200_OK)

        # 7.5. Role & Unit-Based Competency Recommender (Rekomendasi Berbasis Unit Kerja Setjen DPD RI atau Jabatan)
        role_unit_keywords = (
            r"(persidangan|risalah|perisalah|paripurna|rapat|notulen|"
            r"hukum|perundang|legislatif|legislasi|perancang|telaahan|advokasi|"
            r"protokol|humas|hubungan\s*masyarakat|pemberitaan|media\s*parlemen|"
            r"keuangan|anggaran|perbendaharaan|akuntansi|pengadaan|pbj|bmn|"
            r"kepegawaian|sdm|ortala|tata\s*laksana|reformasi\s*birokrasi|kearsipan|arsip|"
            r"ti|teknologi\s*informasi|sistem\s*informasi|keanggotaan)"
        )
        is_role_unit_query = bool(re.search(
            rf"\b(kursus|pelatihan|materi|rekomendasi|kompetensi)\b.*\b{role_unit_keywords}\b",
            norm_query
        )) or bool(re.search(
            r"\b(kursus\s*untuk\s*(saya|unit|bidang|staf|tim|jabatan|bagian|biro)|rekomendasi\s*(unit|jabatan|kompetensi|tupoksi|karier|bidang|bagian|biro|peran|staf|tim)|rekomendasi\s*pelatihan\s*(saya|untuk\s*saya)?|kompetensi\s*(jabatan|saya|unit)|sesuai\s*(unit|jabatan|posisi|tupoksi)|rekomendasi\s*tupoksi|tupoksi\s*saya|rekomendasi\s*karier)\b",
            norm_query
        )) or (
            bool(re.search(r"\b(rekomendasi|cocok|sesuai)\b", norm_query)) and
            bool(re.search(r"\b(jabatan|posisi|unit|bagian|biro|subbagian|tupoksi|staf|tim|pegawai|aparatur)\b", norm_query))
        )
        if is_role_unit_query:
            role_rec_response = self._handle_role_unit_competency_recommendation(user_message, norm_query, user_ctx)
            if role_rec_response:
                cache.set(cache_key, role_rec_response, timeout=180)
                return Response(role_rec_response, status=status.HTTP_200_OK)

        # 7.8. AI Interactive Quiz Prep & Knowledge Flashcards (Simulasi Uji Pemahaman Mandiri)
        is_quiz_prep_query = bool(re.search(
            r"\b(flashcard|flash\s*card|kartu\s*(belajar|konsep|hafalan|pintar|materi|pemahaman)|kartu|deck)\b",
            norm_query
        )) or bool(re.search(
            r"\b(latihan|simulasi|flashcard|uji\s*pemahaman|tes\s*pemahaman)\b.*\b(kuis|soal|ujian|evaluasi|materi|kartu)\b",
            norm_query
        )) or bool(re.search(
            r"\b(kuis|soal|pertanyaan|kartu)\b.*\b(latihan|simulasi|interaktif|flashcard|pemahaman|persidangan|design\s*thinking|berakhlak|hukum|legislasi|tata\s*tertib|berikutnya|lain)\b",
            norm_query
        )) or bool(re.search(
            r"\b(latihan\s*(kuis|soal|ujian|evaluasi)|uji\s*pemahaman|simulasi\s*(kuis|soal|ujian)|flashcard|tanya\s*jawab|tes\s*kemampuan|beri\s*(saya\s*)?(latihan|soal|kuis|flashcard)|kuis\s*interaktif|soal\s*(berikutnya|lain)|kuis\s*berikutnya)\b",
            norm_query
        ))
        if is_quiz_prep_query:
            quiz_prep_response = self._handle_quiz_prep_simulator(user_message, norm_query, user_ctx, current_course)
            if quiz_prep_response:
                return Response(quiz_prep_response, status=status.HTTP_200_OK)

        # 8. Periksa apakah pertanyaan eksplisit mencari / meminta rekomendasi Kursus
        explicit_course_search = re.search(
            r"\b(rekomendasi\s*kursus|kursus\s*populer|cari\s*kursus|katalog\s*kursus|daftar\s*kursus|ada\s*kursus|kursus\s*terbaru|pilihan\s*kursus)\b",
            norm_query
        )
        if explicit_course_search:
            course_response = self._search_courses_response(user_message, norm_query, user_ctx)
            if course_response:
                cache.set(cache_key, course_response, timeout=180)
                return Response(course_response, status=status.HTTP_200_OK)

        # 9. Smart Intent Scoring terhadap Basis Pengetahuan Lokal
        best_rule, score = self._find_best_knowledge_match(user_message, norm_query)
        if best_rule and score >= 3:
            actions = list(best_rule.get("actions", []))
            # Jika user terautentikasi dan ada kursus aktif, sertakan tombol lanjut belajar jika relevan
            if user_ctx["is_authenticated"] and user_ctx.get("latest_course"):
                latest = user_ctx["latest_course"]
                if not latest.get("is_completed") and latest.get("enrollment_id"):
                    # Tambahkan jika belum ada aksi lanjut belajar
                    if not any(a.get("url", "").startswith("/student/courses/") for a in actions):
                        actions.insert(0, {
                            "label": "▶️ Lanjut Belajar",
                            "url": f"/student/courses/{latest['enrollment_id']}/",
                            "type": "route"
                        })

            result = {
                "status": "success",
                "reply": best_rule["reply"],
                "source": "knowledge_engine",
                "confidence": score,
                "suggested_questions": best_rule["suggestions"],
                "actions": actions,
                "recommended_courses": []
            }
            cache.set(cache_key, result, timeout=300)
            return Response(result, status=status.HTTP_200_OK)

        # 8. Periksa apakah pertanyaan terkait pencarian Kursus umum (topik tertentu)
        course_query_pattern = re.search(
            r"\b(kursus|materi|pelatihan|kelas|belajar\s*apa)\b",
            norm_query
        )
        if course_query_pattern and not re.search(r"\b(cara\s*mulai|langkah\s*awal|panduan|sertifikat|piagam)\b", norm_query):
            course_response = self._search_courses_response(user_message, norm_query, user_ctx)
            if course_response:
                cache.set(cache_key, course_response, timeout=180)
                return Response(course_response, status=status.HTTP_200_OK)

        # 10. Cloud AI Engine (Google Gemini / OpenAI) jika tersedia di .env
        ai_api_key = os.environ.get("GEMINI_API_KEY") or getattr(settings, "GEMINI_API_KEY", None)
        if ai_api_key:
            # Ambil konteks silabus/modul terkait untuk memperkaya pemahaman LLM
            matched_lessons_ctx = None
            try:
                base_tokens = [t for t in norm_query.split() if len(t) > 2]
                if base_tokens:
                    q_ctx = Q()
                    for t in base_tokens[:3]:
                        q_ctx |= Q(title__icontains=t) | Q(variant__title__icontains=t)
                    ctx_items = api_models.VariantItem.objects.filter(
                        variant__course__platform_status="Published",
                        variant__course__is_published_version=True
                    ).filter(q_ctx).select_related('variant', 'variant__course')[:4]
                    if ctx_items.exists():
                        matched_lessons_ctx = [
                            {"title": it.title, "chapter": it.variant.title, "course_title": it.variant.course.title}
                            for it in ctx_items
                        ]
            except Exception:
                matched_lessons_ctx = None

            cloud_reply = self._call_gemini_api(user_message, history, ai_api_key, user_ctx, current_course, matched_lessons_ctx)
            if cloud_reply:
                actions = [
                    {"label": "🔍 Katalog Kursus", "url": "/search/", "type": "route"},
                    {"label": "📜 Sertifikat Saya", "url": "/student/sertifikat/", "type": "route"}
                ]
                if current_course:
                    actions.insert(0, {
                        "label": f"📖 Kursus: {current_course.title[:20]}...",
                        "url": f"/course-detail/{current_course.slug}/",
                        "type": "route"
                    })
                elif user_ctx["is_authenticated"] and user_ctx.get("latest_course"):
                    latest = user_ctx["latest_course"]
                    if not latest.get("is_completed") and latest.get("enrollment_id"):
                        actions.insert(0, {
                            "label": "▶️ Lanjut Belajar",
                            "url": f"/student/courses/{latest['enrollment_id']}/",
                            "type": "route"
                        })

                result = {
                    "status": "success",
                    "reply": cloud_reply,
                    "source": "cloud_llm",
                    "suggested_questions": [
                        "Bagaimana cara unduh sertifikat?",
                        "Cari kursus terbaru",
                        "Apa itu LMS Setjen DPD RI?"
                    ],
                    "actions": actions,
                    "recommended_courses": []
                }
                cache.set(cache_key, result, timeout=300)
                return Response(result, status=status.HTTP_200_OK)

        # 10. Smart Contextual Fallback (Sopan, Ramah, Membantu & Tidak Monoton)
        featured_courses = self._get_featured_courses()
        fallback_reply = (
            f"Terima kasih atas pertanyaan Anda: *\"{user_message}\"*.\n\n"
            "Sebagai **Manta**, Asisten AI Virtual LMS Setjen DPD RI, saya siap membantu seluruh kebutuhan "
            "pembelajaran daring Anda. Anda dapat menanyakan topik-topik berikut:\n\n"
            "• **Panduan Memulai Belajar & Mendaftar Kursus**\n"
            "• **Penerbitan & Unduh Sertifikat Ber-QR Code**\n"
            "• **Akses Akun & Integrasi SSO Pegawai DPD RI**\n"
            "• **Penanganan Kendala Video atau Modul SCORM**\n\n"
            "Silakan pilih tombol aksi cepat di bawah atau buka katalog kursus pelatihan kami!"
        )

        default_actions = [
            {"label": "🔍 Jelajahi Katalog Kursus", "url": "/search/", "type": "route"},
            {"label": "📜 Sertifikat Saya", "url": "/student/sertifikat/", "type": "route"}
        ]
        if user_ctx["is_authenticated"] and user_ctx.get("latest_course"):
            latest = user_ctx["latest_course"]
            if not latest.get("is_completed") and latest.get("enrollment_id"):
                default_actions.insert(0, {
                    "label": "▶️ Lanjut Belajar",
                    "url": f"/student/courses/{latest['enrollment_id']}/",
                    "type": "route"
                })

        result = {
            "status": "success",
            "reply": fallback_reply,
            "source": "smart_fallback",
            "suggested_questions": [
                "Apa itu LMS Setjen DPD RI?",
                "Bagaimana cara mulai belajar?",
                "Cara unduh sertifikat kelulusan",
                "Rekomendasi kursus populer"
            ],
            "actions": default_actions,
            "recommended_courses": featured_courses
        }
        cache.set(cache_key, result, timeout=120)
        return Response(result, status=status.HTTP_200_OK)

    def _get_user_context(self, request) -> Dict[str, Any]:
        """Ekstraksi konteks pengguna aktif (profil, kursus, dan sertifikat)."""
        user = None
        if request.user and request.user.is_authenticated:
            user = request.user
        else:
            uid = request.data.get("user_id")
            if uid:
                try:
                    user = api_models.User.objects.filter(id=uid).first()
                except Exception:
                    user = None

        if not user:
            client_name = (request.data.get("user_name") or "").strip()
            return {
                "is_authenticated": False,
                "user_id": None,
                "name": client_name or "Rekan Pembelajar",
                "organization_unit": None,
                "position": None,
                "jenis_jabatan": None,
                "golongan": None,
                "nip": None,
                "enrolled_count": 0,
                "certificates_count": 0,
                "active_courses": [],
                "completed_courses_count": 0,
                "latest_course": None
            }

        display_name = user.full_name or user.first_name or user.username or "Rekan ASN"

        # Ekstraksi Unit Kerja, Jabatan, Jenis Jabatan, dan Golongan ASN Setjen DPD RI
        org_unit_name = None
        position_name = None
        jenis_jabatan = getattr(user, 'jenis_jabatan', None)
        golongan = getattr(user, 'golongan', None)
        nip = getattr(user, 'nip', None)

        try:
            profile = getattr(user, 'profile', None)
            if profile:
                if getattr(profile, 'organization_unit', None):
                    org_unit_name = getattr(profile.organization_unit, 'name', None) or str(profile.organization_unit)
                if getattr(profile, 'position', None):
                    position_name = getattr(profile.position, 'name', None) or str(profile.position)
        except Exception:
            pass

        # Ambil riwayat kursus terdaftar
        enrollments = api_models.EnrolledCourse.objects.filter(user=user).select_related('course').order_by('-date')
        enrolled_count = enrollments.count()

        active_courses = []
        completed_courses_count = 0
        latest_course = None

        for enr in enrollments[:5]:
            try:
                pct = round(enr.completion_percentage(), 1)
            except Exception:
                pct = 0.0
            is_completed = pct >= 100
            if is_completed:
                completed_courses_count += 1
            course_data = {
                "id": enr.course.id,
                "enrollment_id": enr.enrollment_id,
                "title": enr.course.title,
                "slug": enr.course.slug,
                "progress": pct,
                "is_completed": is_completed
            }
            active_courses.append(course_data)
            if not latest_course:
                latest_course = course_data

        cert_count = api_models.Certificate.objects.filter(user=user).count()

        return {
            "is_authenticated": True,
            "user_id": user.id,
            "name": display_name,
            "organization_unit": org_unit_name,
            "position": position_name,
            "jenis_jabatan": jenis_jabatan,
            "golongan": golongan,
            "nip": nip,
            "enrolled_count": enrolled_count,
            "certificates_count": cert_count,
            "active_courses": active_courses,
            "completed_courses_count": completed_courses_count,
            "latest_course": latest_course
        }

    def _handle_personalized_greeting(self, user_ctx: Dict[str, Any]) -> Dict[str, Any]:
        """Menghasilkan sapaan cerdas dan terpersonalisasi sesuai data pengguna."""
        if user_ctx["is_authenticated"]:
            name = user_ctx["name"]
            enrolled_count = user_ctx["enrolled_count"]
            cert_count = user_ctx["certificates_count"]
            latest = user_ctx["latest_course"]

            reply = f"Halo, Bapak/Ibu **{name}**! 👋 Senang bertemu kembali di LMS Sekretariat Jenderal DPD RI.\n\n"
            actions = []

            if enrolled_count > 0 and latest:
                reply += (
                    f"Saat ini Anda terdaftar dalam **{enrolled_count} pelatihan**. Kursus aktif terakhir Anda adalah "
                    f"**{latest['title']}** dengan progres belajar **{latest['progress']}%**.\n\n"
                )
                if not latest.get("is_completed") and latest.get("enrollment_id"):
                    actions.append({
                        "label": "▶️ Lanjut Belajar",
                        "url": f"/student/courses/{latest['enrollment_id']}/",
                        "type": "route"
                    })
                actions.append({
                    "label": "📚 Kursus Saya",
                    "url": "/student/courses/",
                    "type": "route"
                })
            else:
                reply += (
                    "Anda belum memiliki kursus yang sedang aktif. Manta siap membantu merekomendasikan pelatihan "
                    "terbaik untuk peningkatan kompetensi Anda hari ini!\n\n"
                )
                actions.append({
                    "label": "🔍 Jelajahi Katalog Kursus",
                    "url": "/search/",
                    "type": "route"
                })

            if cert_count > 0:
                actions.append({
                    "label": f"📜 Sertifikat Saya ({cert_count})",
                    "url": "/student/sertifikat/",
                    "type": "route"
                })

            reply += "Ada materi pembelajaran atau informasi yang ingin Manta bantu carikan?"

            return {
                "status": "success",
                "reply": reply,
                "source": "personalized_greeting",
                "suggested_questions": [
                    "Progres kursus saya",
                    "Bagaimana cara unduh sertifikat?",
                    "Rekomendasi kursus populer",
                    "Apa itu LMS Setjen DPD RI?"
                ],
                "actions": actions,
                "recommended_courses": []
            }
        else:
            return {
                "status": "success",
                "reply": (
                    "Halo! Senang menyapa Anda 👋 Saya **Manta**, Asisten AI Virtual LMS Sekretariat Jenderal DPD RI.\n\n"
                    "Saya siap membantu Anda dengan informasi seputar kursus keparlemenan, modul SCORM, panduan sertifikat digital resmi, hingga panduan akses akun SSO.\n\n"
                    "Ada yang bisa Manta bantu untuk kegiatan belajar Anda hari ini?"
                ),
                "source": "general_greeting",
                "suggested_questions": [
                    "Apa itu LMS Setjen DPD RI?",
                    "Bagaimana cara mulai belajar?",
                    "Bagaimana cara unduh sertifikat?",
                    "Rekomendasi kursus populer"
                ],
                "actions": [
                    {"label": "🔍 Jelajahi Katalog Kursus", "url": "/search/", "type": "route"},
                    {"label": "🔐 Masuk SSO", "url": "/login/", "type": "route"}
                ],
                "recommended_courses": []
            }

    def _handle_personalized_courses(self, user_ctx: Dict[str, Any]) -> Dict[str, Any]:
        """Menampilkan daftar kursus dan progres belajar pengguna secara personal."""
        if not user_ctx["is_authenticated"]:
            return {
                "status": "success",
                "reply": (
                    "Untuk melihat daftar dan progres kursus pribadi Anda, silakan masuk terlebih dahulu menggunakan akun SSO Setjen DPD RI."
                ),
                "source": "user_context_courses",
                "suggested_questions": [
                    "Bagaimana cara masuk menggunakan SSO Setjen DPD RI?",
                    "Apa itu LMS Setjen DPD RI?",
                    "Rekomendasi kursus populer"
                ],
                "actions": [
                    {"label": "🔐 Masuk Akun SSO", "url": "/login/", "type": "route"},
                    {"label": "🔍 Jelajahi Katalog Kursus", "url": "/search/", "type": "route"}
                ],
                "recommended_courses": []
            }

        enrolled_count = user_ctx["enrolled_count"]
        name = user_ctx["name"]
        courses = user_ctx["active_courses"]

        if enrolled_count > 0:
            reply = f"📚 **Progres Belajar Anda, Bapak/Ibu {name}:**\n\n"
            reply += f"Saat ini Anda terdaftar pada **{enrolled_count} pelatihan** di LMS Setjen DPD RI:\n\n"
            for i, c in enumerate(courses, 1):
                status_str = "✅ *Selesai 100%*" if c["is_completed"] else f"⏳ *Progres: {c['progress']}%*"
                reply += f"{i}. **{c['title']}** — {status_str}\n"

            actions = []
            latest = user_ctx["latest_course"]
            if latest and not latest["is_completed"] and latest.get("enrollment_id"):
                actions.append({
                    "label": f"▶️ Lanjut: {latest['title'][:20]}...",
                    "url": f"/student/courses/{latest['enrollment_id']}/",
                    "type": "route"
                })
            actions.append({
                "label": "📚 Buka Kursus Saya",
                "url": "/student/courses/",
                "type": "route"
            })
            if user_ctx["certificates_count"] > 0:
                actions.append({
                    "label": f"📜 Sertifikat Saya ({user_ctx['certificates_count']})",
                    "url": "/student/sertifikat/",
                    "type": "route"
                })

            reply += "\nSilakan klik tombol di bawah untuk melanjutkan pembelajaran atau melihat seluruh daftar kursus Anda!"

            return {
                "status": "success",
                "reply": reply,
                "source": "user_context_courses",
                "suggested_questions": [
                    "Bagaimana cara unduh sertifikat?",
                    "Rekomendasi kursus populer",
                    "Tanya kendala teknis"
                ],
                "actions": actions,
                "recommended_courses": []
            }
        else:
            return {
                "status": "success",
                "reply": (
                    f"Bapak/Ibu **{name}**, Anda saat ini belum terdaftar di kursus manapun.\n\n"
                    "Silakan buka katalog kursus untuk memilih dan mendaftar pelatihan kompetensi resmi Setjen DPD RI yang Anda minati!"
                ),
                "source": "user_context_courses",
                "suggested_questions": [
                    "Rekomendasi kursus populer",
                    "Bagaimana cara mulai belajar?",
                    "Apa itu LMS Setjen DPD RI?"
                ],
                "actions": [
                    {"label": "🔍 Jelajahi Katalog Kursus", "url": "/search/", "type": "route"}
                ],
                "recommended_courses": self._get_featured_courses()
            }

    def _handle_personalized_certificates(self, user_ctx: Dict[str, Any]) -> Dict[str, Any]:
        """Menampilkan status sertifikat terpersonalisasi untuk pengguna aktif."""
        if not user_ctx["is_authenticated"]:
            return {
                "status": "success",
                "reply": (
                    "Untuk melihat dan mengunduh sertifikat resmi Anda, silakan masuk terlebih dahulu menggunakan akun SSO Setjen DPD RI."
                ),
                "source": "user_context_certificates",
                "suggested_questions": [
                    "Bagaimana cara masuk menggunakan SSO Setjen DPD RI?",
                    "Syarat memperoleh sertifikat",
                    "Apa itu LMS Setjen DPD RI?"
                ],
                "actions": [
                    {"label": "🔐 Masuk Akun SSO", "url": "/login/", "type": "route"},
                    {"label": "🔍 Cari Pelatihan Baru", "url": "/search/", "type": "route"}
                ],
                "recommended_courses": []
            }

        cert_count = user_ctx["certificates_count"]
        name = user_ctx["name"]

        if cert_count > 0:
            reply = (
                f"📜 **Sertifikat Anda, Bapak/Ibu {name}:**\n\n"
                f"Selamat! Anda telah berhasil meraih **{cert_count} sertifikat kelulusan resmi** ber-QR Code di LMS Setjen DPD RI.\n\n"
                "Setiap sertifikat telah dilengkapi tanda tangan elektronik resmi dan kode verifikasi keabsahan. "
                "Anda dapat langsung melihat daftar dan mengunduh berkas PDF sertifikat Anda melalui tombol di bawah:"
            )
            actions = [
                {"label": f"📜 Unduh Sertifikat ({cert_count})", "url": "/student/sertifikat/", "type": "route"},
                {"label": "📚 Kursus Saya", "url": "/student/courses/", "type": "route"}
            ]
        else:
            reply = (
                f"Bapak/Ibu **{name}**, saat ini Anda belum memiliki sertifikat yang diterbitkan.\n\n"
                "**Syarat Memperoleh Sertifikat Resmi:**\n"
                "1. Tuntaskan seluruh materi modul/video hingga 100%.\n"
                "2. Kerjakan kuis evaluasi akhir hingga mencapai batas nilai kelulusan (*passing grade*).\n\n"
                "Setelah syarat terpenuhi, sertifikat digital resmi otomatis terbit di menu **Sertifikat Saya**!"
            )
            actions = [
                {"label": "📚 Lanjut Kursus Saya", "url": "/student/courses/", "type": "route"},
                {"label": "🔍 Cari Pelatihan Baru", "url": "/search/", "type": "route"}
            ]

        return {
            "status": "success",
            "reply": reply,
            "source": "user_context_certificates",
            "suggested_questions": [
                "Berapa batas nilai kelulusan kuis?",
                "Bagaimana jika nilai kuis belum lulus?",
                "Rekomendasi kursus populer"
            ],
            "actions": actions,
            "recommended_courses": []
        }

    def _handle_learning_nudge_query(self, user_ctx: Dict[str, Any]) -> Dict[str, Any]:
        """Menghasilkan respon pengingat belajar cerdas (Smart Learning Reminder) saat ditanyakan di chat."""
        if not user_ctx["is_authenticated"]:
            return {
                "status": "success",
                "reply": (
                    "Untuk melihat pengingat belajar dan tugas materi aktif Anda, silakan masuk terlebih dahulu menggunakan akun SSO Setjen DPD RI."
                ),
                "source": "smart_learning_reminder",
                "suggested_questions": [
                    "Bagaimana cara masuk menggunakan SSO Setjen DPD RI?",
                    "Rekomendasi kursus populer",
                    "Apa itu LMS Setjen DPD RI?"
                ],
                "actions": [
                    {"label": "🔐 Masuk Akun SSO", "url": "/login/", "type": "route"},
                    {"label": "🔍 Katalog Kursus", "url": "/search/", "type": "route"}
                ],
                "recommended_courses": []
            }

        user = api_models.User.objects.filter(id=user_ctx["user_id"]).first()
        nudge = get_user_learning_nudge(user)

        name = user_ctx["name"]
        actions = []

        if nudge["nudge_type"] == "in_progress":
            reply = (
                f"⏰ **Pengingat Belajar Pribadi untuk Bapak/Ibu {name}:**\n\n"
                f"Anda sedang aktif mempelajari kursus:\n"
                f"📌 **{nudge['course_title']}**\n\n"
                f"• **Capaian Progres:** {nudge['progress']}%\n"
                f"• **Materi Tersisa:** {nudge['remaining_lessons']} materi lagi untuk memenuhi syarat penerbitan sertifikat digital resmi.\n\n"
                "Mari luangkan waktu sejenak untuk menuntaskan bab pembelajaran berikutnya hari ini!"
            )
            actions = [
                {"label": nudge["action_label"], "url": nudge["action_url"], "type": "route"},
                {"label": "📚 Semua Kursus Saya", "url": "/student/courses/", "type": "route"}
            ]
        elif nudge["nudge_type"] == "not_started":
            reply = (
                f"⏰ **Pengingat Belajar Pribadi untuk Bapak/Ibu {name}:**\n\n"
                f"Anda telah terdaftar pada kursus:\n"
                f"📌 **{nudge['course_title']}**\n\n"
                f"Namun Anda belum memulai bab pembelajaran pertama (Progres: 0%). "
                f"Tersedia {nudge['remaining_lessons']} materi yang siap dipelajari untuk meningkatkan kompetensi Anda."
            )
            actions = [
                {"label": "▶️ Mulai Belajar Sekarang", "url": nudge["action_url"], "type": "route"},
                {"label": "📚 Kursus Saya", "url": "/student/courses/", "type": "route"}
            ]
        elif nudge["nudge_type"] == "all_completed":
            reply = (
                f"🎉 **Status Belajar Bapak/Ibu {name}:**\n\n"
                "Luar biasa! Seluruh pelatihan yang Anda ambil telah diselesaikan hingga **100%**.\n\n"
                "Anda dapat mengunduh seluruh sertifikat resmi kelulusan ber-QR Code di menu **Sertifikat Saya**, "
                "atau memilih pelatihan kompetensi baru di katalog kursus kami."
            )
            actions = [
                {"label": "📜 Unduh Sertifikat", "url": "/student/sertifikat/", "type": "route"},
                {"label": "🔍 Cari Pelatihan Baru", "url": "/search/", "type": "route"}
            ]
        else:
            reply = (
                f"Bapak/Ibu **{name}**, saat ini Anda belum memiliki kursus yang sedang berjalan.\n\n"
                "Silakan buka katalog kursus untuk memilih pelatihan kompetensi resmi Setjen DPD RI yang Anda minati!"
            )
            actions = [
                {"label": "🔍 Jelajahi Katalog Kursus", "url": "/search/", "type": "route"}
            ]

        return {
            "status": "success",
            "reply": reply,
            "source": "smart_learning_reminder",
            "suggested_questions": [
                "Bagaimana cara unduh sertifikat?",
                "Rekomendasi kursus populer",
                "Tanya kendala teknis"
            ],
            "actions": actions,
            "nudge_data": nudge,
            "recommended_courses": []
        }

    def _handle_smart_helpdesk_diagnostic(self, raw_message: str, norm_query: str, user_ctx: Dict[str, Any], current_course: Any = None) -> Dict[str, Any]:
        """
        Smart Helpdesk & Auto-Diagnostic Kendala Teknis:
        Mendiagnosis kendala peramban, modul SCORM, video pemutar, evaluasi kuis, atau akun,
        serta menyediakan tombol tiket bantuan otomatis dengan data prefill lengkap.
        """
        course_title_str = f" pada kursus '{current_course.title}'" if current_course else ""
        course_id = current_course.id if current_course else None

        # 1. Kendala Video / SCORM Pemutar
        if re.search(r"\b(video|scorm|h5p|materi|player|pemutar|modul|putar|play|layar\s*hitam|loading\s*terus|buffering|freeze|hang)\b", norm_query):
            reply = (
                "🛠️ **Auto-Diagnostic Manta: Kendala Pemutaran Video & Modul SCORM**\n\n"
                f"Manta mendeteksi kendala pada pemutaran media pembelajaran{course_title_str}. "
                "Berikut langkah diagnosis dan perbaikan mandiri cepat:\n\n"
                "1. 🔄 **Segarkan Halaman (*Hard Refresh*):** Tekan `Ctrl + F5` (Windows) atau `Cmd + Shift + R` (Mac) untuk memuat ulang skrip pemutar SCORM.\n"
                "2. 🛡️ **Nonaktifkan AdBlocker & Ekstensi:** Ekstensi pemblokir iklan seringkali menahan skrip tracking SCORM/video interaktif.\n"
                "3. 🍪 **Izinkan Third-Party Cookies:** Pastikan peramban mengizinkan cookie untuk portal LMS Setjen DPD RI.\n"
                "4. 🌐 **Gunakan Peramban Rekomendasi:** Disarankan menggunakan Google Chrome atau Microsoft Edge versi terbaru.\n\n"
                "Jika materi masih belum dapat berputar, klik tombol **Laporkan Tiket ke Helpdesk** di bawah. "
                "Data halaman, materi, dan spesifikasi peramban Anda akan terisi otomatis untuk ditindaklanjuti tim TI Setjen DPD RI!"
            )
            actions = [
                {
                    "label": "💬 Laporkan Tiket ke Helpdesk",
                    "action": "open_feedback",
                    "affected_area": "video",
                    "course_id": course_id,
                    "report_title": f"Kendala Pemutaran Video/SCORM{course_title_str}",
                    "category_desc": "Pemutaran Video & Modul SCORM",
                    "user_problem": raw_message,
                    "type": "event"
                },
                {"label": "📞 Kontak Helpdesk TI", "url": "/contact/", "type": "route"},
                {"label": "📖 Panduan Pengguna", "url": "/user-guide/", "type": "route"}
            ]
            area = "video"

        # 2. Kendala Kuis / Evaluasi
        elif re.search(r"\b(kuis|quiz|ujian|soal|evaluasi|submit|nilai|skor|passing\s*grade)\b", norm_query):
            reply = (
                "📝 **Auto-Diagnostic Manta: Kendala Sistem Evaluasi & Kuis**\n\n"
                f"Manta mendeteksi kendala pada sistem kuis/evaluasi pemahaman{course_title_str}:\n\n"
                "1. ⚠️ **Koneksi Terputus:** Saat mengerjakan kuis, pastikan koneksi internet stabil agar jawaban terkirim ke server secara berkala.\n"
                "2. 🔄 **Jangan Tutup Tab Sebelum Nilai Muncul:** Sistem memerlukan waktu 1-3 detik untuk memvalidasi seluruh butir jawaban.\n"
                "3. ⏳ **Sesi SSO Habis:** Jika Anda berada di halaman ujian terlalu lama tanpa interaksi, sesi login mungkin kedaluwarsa.\n\n"
                "Jika nilai kuis Anda tidak terekam atau gagal disubmit, klik tombol di bawah untuk melaporkan langsung ke administrator sistem!"
            )
            actions = [
                {
                    "label": "💬 Laporkan Kendala Kuis ke Helpdesk",
                    "action": "open_feedback",
                    "affected_area": "quiz",
                    "course_id": course_id,
                    "report_title": f"Kendala Sistem Kuis/Evaluasi{course_title_str}",
                    "category_desc": "Sistem Kuis & Evaluasi",
                    "user_problem": raw_message,
                    "type": "event"
                },
                {"label": "📞 Kontak Helpdesk TI", "url": "/contact/", "type": "route"}
            ]
            area = "quiz"

        # 3. Kendala Sertifikat
        elif re.search(r"\b(sertifikat|piagam|unduh|download|pdf|qr\s*code)\b", norm_query):
            reply = (
                "📜 **Auto-Diagnostic Manta: Kendala Penerbitan & Unduh Sertifikat**\n\n"
                "Berikut hal-hal yang perlu dipastikan terkait sertifikat kelulusan digital resmi:\n\n"
                "1. ✅ **Syarat Kelulusan:** Seluruh materi harus berstatus tuntas 100% dan nilai kuis akhir memenuhi *passing grade*.\n"
                "2. 🛡️ **Blokir Pop-up Download:** Beberapa peramban memblokir unduhan file PDF baru secara otomatis. Cek ikon pop-up di bilah alamat (*address bar*) dan pilih 'Selalu Izinkan'.\n"
                "3. 🔍 **Validasi QR Code:** Setiap sertifikat memiliki kode unik keabsahan yang dapat diverifikasi di portal resmi Setjen DPD RI.\n\n"
                "Jika syarat sudah terpenuhi namun tombol unduh belum muncul, silakan kirim laporan bantuan di bawah:"
            )
            actions = [
                {
                    "label": "💬 Laporkan Kendala Sertifikat",
                    "action": "open_feedback",
                    "affected_area": "other",
                    "course_id": course_id,
                    "report_title": "Kendala Unduh Sertifikat Digital Resmi",
                    "category_desc": "Penerbitan & Unduh Sertifikat",
                    "user_problem": raw_message,
                    "type": "event"
                },
                {"label": "📜 Buka Sertifikat Saya", "url": "/student/sertifikat/", "type": "route"}
            ]
            area = "certificate"

        # 4. Kendala Akun / SSO
        elif re.search(r"\b(sso|login|masuk|akun|password|sandi|nip|profil)\b", norm_query):
            reply = (
                "🔐 **Auto-Diagnostic Manta: Kendala Akun & Layanan SSO**\n\n"
                "Panduan penanganan kendala autentikasi akun pegawai Setjen DPD RI:\n\n"
                "1. 🔑 **Single Sign-On (SSO):** Pastikan Anda menggunakan NIP dan kata sandi portal SSO Nusa DPD yang masih aktif.\n"
                "2. 🧹 **Hapus Cache Sesi:** Lakukan *logout* lalu bersihkan cookies peramban sebelum mencoba masuk kembali.\n"
                "3. 📱 **Bantuan Administrator:** Jika akun Anda terblokir atau lupa sandi SSO, silakan hubungi tim Helpdesk TI Setjen DPD RI."
            )
            actions = [
                {
                    "label": "💬 Laporkan Kendala Akun ke Helpdesk",
                    "action": "open_feedback",
                    "affected_area": "account",
                    "course_id": None,
                    "report_title": "Kendala Akun & Autentikasi SSO Pegawai",
                    "category_desc": "Akun & SSO Pegawai",
                    "user_problem": raw_message,
                    "type": "event"
                },
                {"label": "🔐 Halaman Login SSO", "url": "/login/", "type": "route"},
                {"label": "📞 Kontak Helpdesk TI", "url": "/contact/", "type": "route"}
            ]
            area = "account"

        # 5. Kendala Umum / Sistem / Bug
        else:
            reply = (
                "🛠️ **Layanan Bantuan & Laporan Kendala Sistem LMS:**\n\n"
                f"Mohon maaf atas ketidaknyamanan yang Anda alami{course_title_str}. "
                "Tim Helpdesk Bagian TI Sekretariat Jenderal DPD RI siap membantu menyelesaikan kendala Anda.\n\n"
                "Silakan klik tombol **Laporkan ke Helpdesk** di bawah. Laporan akan otomatis mencakup URL halaman aktif "
                "serta deskripsi perangkat Anda sehingga tim teknis dapat segera menindaklanjuti!"
            )
            actions = [
                {
                    "label": "💬 Laporkan ke Helpdesk",
                    "action": "open_feedback",
                    "affected_area": "ui",
                    "course_id": course_id,
                    "report_title": "Laporan Kendala Sistem LMS Setjen DPD RI",
                    "category_desc": "Kendala Sistem & Antarmuka",
                    "user_problem": raw_message,
                    "type": "event"
                },
                {"label": "📞 Kontak Helpdesk TI", "url": "/contact/", "type": "route"},
                {"label": "📖 Panduan Pengguna", "url": "/user-guide/", "type": "route"}
            ]
            area = "general"

        return {
            "status": "success",
            "reply": reply,
            "source": "smart_helpdesk_diagnostic",
            "suggested_questions": [
                "Bagaimana cara unduh sertifikat?",
                "Panduan login SSO DPD",
                "Rekomendasi kursus populer"
            ],
            "actions": actions,
            "diagnostic_area": area,
            "recommended_courses": []
        }

    def _handle_current_course_query(self, course: Any, raw_message: str, norm_query: str, user_ctx: Dict[str, Any]) -> Dict[str, Any]:
        """Menjawab pertanyaan spesifik mengenai kursus yang sedang dibuka pengguna di layar."""
        teacher_name = getattr(course.teacher, "full_name", None) or getattr(course.teacher, "name", None) or "Instruktur BPSDM Setjen DPD RI"
        cat_title = course.category.title if course.category else "Kompetensi Umum"
        level_name = getattr(course, "level", "Semua Tingkatan")

        try:
            if hasattr(course, "curriculum"):
                variants_qs = course.curriculum.all() if hasattr(course.curriculum, "all") else course.curriculum()
            else:
                variants_qs = api_models.Variant.objects.filter(course=course)
            variant_count = variants_qs.count()
            variant_list = list(variants_qs.order_by("order")[:4])
        except Exception:
            variant_count = 0
            variant_list = []

        try:
            lecture_items = list(api_models.VariantItem.objects.filter(variant__course=course).select_related('variant').order_by('order')[:6])
            lecture_count = api_models.VariantItem.objects.filter(variant__course=course).count()
        except Exception:
            lecture_items = []
            lecture_count = 0

        try:
            quiz_count = course.quizzes().count() if hasattr(course, 'quizzes') and callable(course.quizzes) else api_models.Quiz.objects.filter(course=course).count()
        except Exception:
            quiz_count = 0

        # Cek status enrollment pengguna untuk kursus ini
        user_enrolled = None
        if user_ctx["is_authenticated"]:
            user_enrolled = api_models.EnrolledCourse.objects.filter(
                user_id=user_ctx["user_id"],
                course=course
            ).first()

        reply = f"📖 **Informasi Kursus: {course.title}**\n\n"

        # Ringkasan deskripsi (bersihkan tag html)
        clean_desc = re.sub(r'<[^>]+>', '', course.description or "").strip()
        if clean_desc:
            short_desc = clean_desc[:250] + ("..." if len(clean_desc) > 250 else "")
            reply += f"*{short_desc}*\n\n"

        reply += "📋 **Rincian Pelatihan:**\n"
        reply += f"• **Kategori:** {cat_title}\n"
        reply += f"• **Tingkat Kesulitan:** {level_name}\n"
        reply += f"• **Instruktur:** {teacher_name}\n"
        reply += f"• **Struktur Modul:** {variant_count} Bab ({lecture_count} Modul/Materi Pembelajaran)\n"
        if quiz_count > 0:
            reply += f"• **Evaluasi:** {quiz_count} Kuis / Ujian Pemahaman\n"
        reply += "• **Sertifikasi:** Sertifikat Digital Resmi ber-QR Code otomatis terbit setelah selesai 100% dan lulus kuis.\n\n"

        if variant_list:
            reply += "📑 **Silabus Bab Pembelajaran:**\n"
            for v in variant_list:
                item_count = v.variant_items.count() if hasattr(v, 'variant_items') else 0
                order_num = f"Bab {v.order}: " if v.order is not None else "• "
                reply += f"{order_num}**{v.title}** ({item_count} materi)\n"
            if variant_count > len(variant_list):
                reply += f"*...dan {variant_count - len(variant_list)} bab lainnya.*\n"
            reply += "\n"

        actions = []
        matched_lessons = []
        is_enrolled_flag = bool(user_enrolled)
        enrollment_id_val = user_enrolled.enrollment_id if user_enrolled else None

        for item in lecture_items[:4]:
            dur_str = ""
            if item.duration:
                total_sec = int(item.duration.total_seconds())
                if total_sec > 0:
                    m, s = divmod(total_sec, 60)
                    dur_str = f"{m} menit" if m > 0 else f"{s} dtk"

                action_url = f"/student/courses/{enrollment_id_val}/" if is_enrolled_flag else f"/course-detail/{course.slug}/"
                matched_lessons.append({
                    "id": item.id,
                    "title": item.title,
                    "chapter": item.variant.title,
                    "course_title": course.title,
                    "course_slug": course.slug,
                    "item_type": item.item_type,
                    "duration": dur_str,
                    "is_enrolled": is_enrolled_flag,
                    "action_url": action_url
                })

        if user_enrolled:
            pct = round(user_enrolled.completion_percentage(), 1)
            if pct >= 100:
                reply += "🎉 **Status Anda:** Anda telah menyelesaikan pelatihan ini (*Kelulusan 100%*)!"
                actions.append({
                    "label": "📜 Unduh Sertifikat",
                    "url": "/student/sertifikat/",
                    "type": "route"
                })
            else:
                reply += f"⏳ **Status Anda:** Anda telah terdaftar dengan progres **{pct}%**."
                actions.append({
                    "label": "▶️ Lanjut Belajar Sekarang",
                    "url": f"/student/courses/{user_enrolled.enrollment_id}/",
                    "type": "route"
                })
            actions.append({
                "label": "📚 Kursus Saya",
                "url": "/student/courses/",
                "type": "route"
            })
        else:
            if user_ctx["is_authenticated"]:
                reply += "💡 **Status Anda:** Anda belum terdaftar di kursus ini. Silakan klik tombol **Mulai Belajar / Daftar** di halaman ini untuk memulai pelatihan resmi Setjen DPD RI secara gratis!"
            else:
                reply += "💡 **Status Anda:** Silakan masuk menggunakan akun SSO Setjen DPD RI untuk mendaftar dan mengikuti pelatihan ini secara gratis."
                actions.append({
                    "label": "🔐 Masuk SSO",
                    "url": "/login/",
                    "type": "route"
                })
            actions.append({
                "label": "🔍 Cari Kursus Lain",
                "url": "/search/",
                "type": "route"
            })

        return {
            "status": "success",
            "reply": reply,
            "source": "contextual_course_details",
            "suggested_questions": [
                "Berapa batas nilai kelulusan kuis?",
                "Bagaimana cara unduh sertifikat?",
                "Rekomendasi kursus populer lainnya"
            ],
            "actions": actions,
            "matched_lessons": matched_lessons,
            "recommended_courses": []
        }

    def _search_lessons_response(self, raw_message: str, norm_query: str, user_ctx: Dict[str, Any], current_course: Any = None) -> Dict[str, Any]:
        """
        Deep Syllabus & Lesson Search:
        Mencari modul, bab, dan materi pembelajaran spesifik di database LMS Setjen DPD RI.
        Menjelajahi Variant (Bab/Bagian) dan VariantItem (Modul/Materi).
        """
        try:
            stop_words = {
                "materi", "modul", "bab", "pelajaran", "topik", "bahasan", "pembahasan",
                "tentang", "mengenai", "ada", "apa", "mana", "yang", "di", "kursus",
                "kelas", "lms", "setjen", "dpd", "ri", "tolong", "bantu", "cari",
                "carikan", "apakah", "bagaimana", "bisa", "sebutkan", "daftar", "isi",
                "adakah", "atau", "pada", "dalam", "dan", "untuk", "pelatihan",
                "ini", "itu", "tersebut", "jelaskan", "info", "informasi", "ringkasan", "ulasan"
            }
            tokens = [t for t in norm_query.split() if t not in stop_words and len(t) > 1]

            base_qs = api_models.VariantItem.objects.filter(
                variant__course__platform_status="Published",
                variant__course__is_published_version=True
            ).select_related('variant', 'variant__course')

            # Jika user sedang membuka kursus tertentu, prioritaskan materi dari kursus tersebut
            is_referring_to_current = bool(current_course and re.search(
                r"\b(kursus\s*ini|pelatihan\s*ini|materi\s*ini|di\s*kursus\s*ini|di\s*sini|pada\s*kursus\s*ini)\b",
                norm_query
            ))

            if current_course:
                current_course_items = base_qs.filter(variant__course=current_course)
                if current_course_items.exists():
                    if is_referring_to_current or not tokens:
                        base_qs = current_course_items
                    else:
                        q_course = Q()
                        for t in tokens:
                            q_course |= Q(title__icontains=t) | Q(description__icontains=t) | Q(variant__title__icontains=t)
                        matched_in_current = current_course_items.filter(q_course)
                        if matched_in_current.exists():
                            base_qs = matched_in_current

            matched_items = []
            if tokens:
                q_or = Q()
                for t in tokens:
                    q_or |= Q(title__icontains=t) | Q(description__icontains=t) | Q(variant__title__icontains=t) | Q(variant__course__title__icontains=t)

                candidate_items = list(base_qs.filter(q_or).order_by('order')[:20])

                # Hitung bobot relevansi: kemunculan pada judul materi > bab > deskripsi > judul kursus
                scored_items = []
                for item in candidate_items:
                    score = 0
                    t_lower = (item.title or "").lower()
                    v_lower = (item.variant.title or "").lower()
                    c_lower = (item.variant.course.title or "").lower()
                    d_lower = (item.description or "").lower()

                    for t in tokens:
                        if t in t_lower:
                            score += 5
                        if t in v_lower:
                            score += 3
                        if t in d_lower:
                            score += 2
                        if t in c_lower:
                            score += 2

                    scored_items.append((score, item))

                scored_items.sort(key=lambda x: x[0], reverse=True)

                # Deduplikasi materi berdasarkan judul dan ID kursus
                seen = set()
                for _, it in scored_items:
                    key = (it.title.strip().lower(), it.variant.course_id)
                    if key not in seen:
                        seen.add(key)
                        matched_items.append(it)
                    if len(matched_items) >= 4:
                        break

            # Fallback jika tidak ada hasil spesifik dengan token
            if not matched_items:
                if current_course:
                    matched_items = list(base_qs.filter(variant__course=current_course).order_by('order')[:4])
                else:
                    matched_items = list(base_qs.order_by('-variant__course__id', 'order')[:4])

            if not matched_items:
                return None

            # Ambil peta enrollment pengguna jika login
            user_enrolled_map = {}
            if user_ctx.get("is_authenticated") and user_ctx.get("user_id"):
                enrolled_records = api_models.EnrolledCourse.objects.filter(
                    user_id=user_ctx["user_id"]
                ).values('course_id', 'enrollment_id')
                for er in enrolled_records:
                    user_enrolled_map[er['course_id']] = er['enrollment_id']

            lesson_list = []
            for item in matched_items:
                c = item.variant.course
                dur_str = ""
                if item.duration:
                    total_sec = int(item.duration.total_seconds())
                    if total_sec > 0:
                        m, s = divmod(total_sec, 60)
                        dur_str = f"{m} menit" if m > 0 else f"{s} dtk"

                enrollment_id = user_enrolled_map.get(c.id)
                is_enrolled = bool(enrollment_id)
                action_url = f"/student/courses/{enrollment_id}/" if is_enrolled else f"/course-detail/{c.slug}/"

                lesson_list.append({
                    "id": item.id,
                    "title": item.title,
                    "chapter": item.variant.title,
                    "course_title": c.title,
                    "course_slug": c.slug,
                    "item_type": item.item_type,
                    "duration": dur_str,
                    "is_enrolled": is_enrolled,
                    "action_url": action_url
                })

            search_desc = f"*{' '.join(tokens)}*" if tokens else "pembelajaran terkait"
            reply = "🎯 **Hasil Pencarian Modul & Materi Pembelajaran:**\n\n"
            reply += f"Manta menemukan materi di database LMS Setjen DPD RI yang membahas tentang {search_desc}:\n\n"

            for i, l in enumerate(lesson_list, 1):
                type_icon = "📝 Kuis Evaluasi" if l["item_type"] == "quiz" else "🎬 Modul Materi"
                dur_info = f" • ⏱️ {l['duration']}" if l["duration"] else ""
                reply += f"{i}. 📌 **{l['title']}**\n"
                reply += f"   • **Bab:** {l['chapter']}\n"
                reply += f"   • **Pelatihan:** [{l['course_title']}](/course-detail/{l['course_slug']}/)\n"
                reply += f"   • **Tipe:** {type_icon}{dur_info}\n\n"

            reply += "Silakan klik tombol di bawah untuk langsung membuka materi atau membaca silabus lengkapnya!"

            actions = []
            seen_courses = set()
            for l in lesson_list:
                if l["course_slug"] not in seen_courses:
                    seen_courses.add(l["course_slug"])
                    if l["is_enrolled"]:
                        actions.append({
                            "label": f"▶️ Lanjut: {l['title'][:22]}...",
                            "url": l["action_url"],
                            "type": "route"
                        })
                    else:
                        actions.append({
                            "label": f"📖 Silabus: {l['course_title'][:22]}...",
                            "url": l["action_url"],
                            "type": "route"
                        })
                if len(actions) >= 3:
                    break

            actions.append({
                "label": "🔍 Katalog Semua Kursus",
                "url": "/search/",
                "type": "route"
            })

            return {
                "status": "success",
                "reply": reply,
                "source": "deep_lesson_search",
                "suggested_questions": [
                    "Rekomendasi kursus populer",
                    "Bagaimana cara mulai belajar?",
                    "Bagaimana cara unduh sertifikat?"
                ],
                "actions": actions,
                "matched_lessons": lesson_list,
                "recommended_courses": [
                    {"id": l["id"], "title": l["course_title"], "slug": l["course_slug"], "category": "Pelatihan Terkait"}
                    for l in lesson_list[:2]
                ]
            }
        except Exception as e:
            logger.warning(f"Deep lesson search error: {e}", exc_info=True)
            return None

    def _handle_role_unit_competency_recommendation(
        self, raw_message: str, norm_query: str, user_ctx: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Role & Unit-Based Competency Recommender:
        Memberikan rekomendasi pelatihan, klaster kompetensi, dan jalur pembelajaran
        berdasarkan Unit Kerja (Subbagian/Bagian/Biro) dan Jabatan ASN di lingkungan
        Sekretariat Jenderal Dewan Perwakilan Daerah Republik Indonesia (Setjen DPD RI).
        """
        clusters_def = {
            "ti_digital": {
                "title": "Transformasi Digital, TI & Manajemen Keanggotaan",
                "badge": "💻 Klaster Teknologi Informasi & Keanggotaan Parlemen",
                "keywords": [
                    "ti", "it", "teknologi", "sistem informasi", "keanggotaan", "komputer",
                    "jaringan", "siber", "cyber", "data", "software", "programmer",
                    "pranata komputer", "penata kelola sistem", "infrastruktur ti", "aplikasi"
                ],
                "tupoksi": "Mendukung penyelenggaraan sistem informasi keanggotaan dewan, pemeliharaan infrastruktur digital parlemen, dan penerapan teknologi modern untuk transparansi serta efisiensi kelembagaan DPD RI.",
                "competencies": [
                    "Penerapan Metodologi Design Thinking untuk Inovasi Layanan ASN & Birokrasi Adaptif",
                    "Keamanan Informasi, Proteksi Data Keanggotaan & Kesadaran Siber (Cybersecurity Awareness)",
                    "Manajemen Basis Data, Integrasi API, dan Digitalisasi Layanan Parlemen Modern",
                    "Service Excellence Digital bagi Anggota Dewan, Stakeholder Daerah, dan Publik"
                ],
                "learning_path": [
                    "Tahap 1: Mindset & Inovasi Layanan (Design Thinking ASN)",
                    "Tahap 2: Literasi Keamanan Informasi & Privasi Data Parlemen",
                    "Tahap 3: Optimalisasi Tata Kelola Sistem Informasi Terintegrasi"
                ],
                "search_tags": ["design thinking", "inovasi", "sistem", "digital"]
            },
            "persidangan_risalah": {
                "title": "Dukungan Substansi Persidangan & Manajemen Risalah Parlemen",
                "badge": "🏛️ Klaster Persidangan & Risalah Sidang Dewan",
                "keywords": [
                    "persidangan", "risalah", "rapat", "sidang", "notulen", "notulensi",
                    "perisalah", "paripurna", "komite", "puld", "purw", "bap", "musyawarah",
                    "acara persidangan", "alat kelengkapan"
                ],
                "tupoksi": "Menyiapkan kelengkapan administrasi persidangan, menyusun risalah resmi rapat paripurna dan alat kelengkapan dewan, serta memastikan kepatuhan tata tertib persidangan DPD RI.",
                "competencies": [
                    "Teknik Transkripsi Cepat & Notulensi Akurat Risalah Resmi Parlemen",
                    "Penguasaan Mendalam Tata Tertib Persidangan & Mekanisme Pengambilan Keputusan DPD RI",
                    "Manajemen Administrasi & Penyiapan Dokumen Sidang Komite / Alat Kelengkapan Dewan",
                    "Digitalisasi Tata Kelola Arsip Risalah dan Kerahasiaan Dokumen Persidangan Negara"
                ],
                "learning_path": [
                    "Tahap 1: Penguasaan Tata Tertib & Mekanisme Sidang Paripurna DPD RI",
                    "Tahap 2: Teknik Penyusunan Risalah Rapat Legislatif yang Terstandarisasi",
                    "Tahap 3: Inovasi Alur Kerja & Manajemen Dokumen Persidangan Adaptif"
                ],
                "search_tags": ["persidangan", "parlemen", "risalah", "inovasi"]
            },
            "hukum_legislasi": {
                "title": "Perancangan Peraturan Perundang-undangan & Analisis Legislasi",
                "badge": "⚖️ Klaster Hukum & Analisis Kebijakan Legislatif",
                "keywords": [
                    "hukum", "legislasi", "legislatif", "perundang", "perancang",
                    "telaahan", "advokasi", "regulasi", "naskah akademik", "kebijakan",
                    "legal drafting", "opini hukum", "ppuu", "uji sahih"
                ],
                "tupoksi": "Menyusun dan menganalisis rancangan undang-undang inisiatif DPD RI, naskah akademik, telaahan staf, serta memberikan pertimbangan hukum dan advokasi konstitusional kelembagaan.",
                "competencies": [
                    "Teknik Legal Drafting & Harmonisasi Rancangan Peraturan Perundang-undangan",
                    "Penyusunan Naskah Akademik Berbasis Bukti (Evidence-Based Policy Analysis)",
                    "Teknik Penyusunan Telaahan Staf (Staff Paper) & Pertimbangan Hukum (Legal Opinion)",
                    "Analisis Dampak Regulasi (Regulatory Impact Assessment/RIA) bagi Kepentingan Daerah"
                ],
                "learning_path": [
                    "Tahap 1: Penguatan Prinsip-Prinsip Pembentukan Peraturan Perundang-Undangan",
                    "Tahap 2: Metodologi Penyusunan Telaahan Staf & Rekomendasi Kebijakan Daerah",
                    "Tahap 3: Pemikiran Desain Kebijakan (Policy Design) & Inovasi Regulasi Daerah"
                ],
                "search_tags": ["hukum", "kebijakan", "legislasi", "inovasi"]
            },
            "protokol_humas": {
                "title": "Keprotokolan Pejabat Negara, Media & Komunikasi Publik Parlemen",
                "badge": "🎙️ Klaster Keprotokolan & Komunikasi Publik Parlemen",
                "keywords": [
                    "protokol", "humas", "hubungan masyarakat", "komunikasi", "media",
                    "pemberitaan", "pimpinan", "audiensi", "peliputan", "siaran", "acara",
                    "keprotokolan", "tata usaha pimpinan"
                ],
                "tupoksi": "Mengelola tata tempat, tata upacara, dan tata penghormatan pejabat negara, serta mempublikasikan kebijakan dan kinerja kelembagaan DPD RI ke media massa dan publik secara transparan.",
                "competencies": [
                    "Standar Etiket Keprotokolan Resmi Pejabat Tinggi Negara & Lembaga Parlemen",
                    "Service Excellence & Pelayanan Prima dalam Fasilitasi Kegiatan Pimpinan Dewan",
                    "Strategi Komunikasi Publik & Manajemen Isu Parlemen di Media Konvensional dan Digital",
                    "Teknik Produksi Siaran Pers, Berita Parlemen & Konten Edukasi Publik Terpercaya"
                ],
                "learning_path": [
                    "Tahap 1: Fundamental Tata Keprotokolan Lembaga Negara & Etiket Resmi",
                    "Tahap 2: Komunikasi Publik Efektif & Strategi Relasi Media Parlemen",
                    "Tahap 3: Transformasi Digital Konten Komunikasi & Pelayanan Publik Adaptif"
                ],
                "search_tags": ["protokol", "komunikasi", "humas", "inovasi"]
            },
            "keuangan_pengadaan": {
                "title": "Pengelolaan Keuangan Negara, PBJ & Akuntabilitas Anggaran",
                "badge": "💰 Klaster Keuangan & Pengadaan Barang/Jasa Negara",
                "keywords": [
                    "keuangan", "anggaran", "perbendaharaan", "akuntansi", "gaji",
                    "tunjangan", "pengadaan", "pbj", "bmn", "perlengkapan", "belanja",
                    "perbendaharaan belanja dewan", "bendahara"
                ],
                "tupoksi": "Mengelola perbendaharaan belanja dewan, verifikasi anggaran, akuntansi pelaporan keuangan negara, serta pengadaan barang dan jasa pemerintah secara efisien dan akuntabel.",
                "competencies": [
                    "Kepatuhan Tata Kelola Keuangan Negara & Pengelolaan Perbendaharaan APBN",
                    "Prinsip Pengadaan Barang/Jasa Pemerintah (PBJ) Berintegritas Sesuai Standar LKPP",
                    "Pengelolaan, Pencatatan, dan Pengamanan Barang Milik Negara (BMN) Parlemen",
                    "Pencegahan Fraud, Manajemen Risiko, dan Pengendalian Internal Pemerintah (SPIP)"
                ],
                "learning_path": [
                    "Tahap 1: Kepatuhan Regulasi Keuangan & Perbendaharaan Belanja APBN",
                    "Tahap 2: Akuntabilitas Pengadaan Barang/Jasa & Manajemen Aset BMN",
                    "Tahap 3: Inovasi Efisiensi Anggaran & Budaya Kerja BerAKHLAK"
                ],
                "search_tags": ["keuangan", "anggaran", "pengadaan", "inovasi"]
            },
            "sdm_organisasi": {
                "title": "Manajemen ASN, Budaya Kerja BerAKHLAK & Reformasi Birokrasi",
                "badge": "👥 Klaster SDM Aparatur, Ortala & Tata Laksana",
                "keywords": [
                    "kepegawaian", "sdm", "organisasi", "ketatalaksanaan", "ortala",
                    "reformasi birokrasi", "arsip", "kearsipan", "tata usaha", "kinerja",
                    "aparatur", "analis sdm", "arsiparis"
                ],
                "tupoksi": "Mengembangkan kompetensi aparatur, mengelola administrasi kepegawaian, memfasilitasi penataan organisasi dan tata laksana, serta memperkuat reformasi birokrasi internal DPD RI.",
                "competencies": [
                    "Internalisasi & Implementasi Core Values ASN BerAKHLAK dan Budaya Kerja Adaptif",
                    "Penerapan Metodologi Design Thinking untuk Birokrasi yang Adaptif & Agile",
                    "Tata Kelola Kearsipan Modern & Transformasi Arsip Digital Terintegrasi (SRIKANDI)",
                    "Penyusunan Analisis Jabatan (Anjab), Analisis Beban Kerja (ABK), dan Evaluasi Kelembagaan"
                ],
                "learning_path": [
                    "Tahap 1: Budaya Kerja ASN BerAKHLAK & Disiplin Aparatur Modern",
                    "Tahap 2: Metodologi Inovasi Design Thinking untuk Layanan Birokrasi Adaptif",
                    "Tahap 3: Digitalisasi Kearsipan Dinamis & Manajemen Kinerja Berkelanjutan"
                ],
                "search_tags": ["design thinking", "inovasi", "sdm", "arsip"]
            }
        }

        # 1. Tentukan Klaster Target
        chosen_cluster_key = None
        is_user_personal = False

        user_pos = (user_ctx.get("position") or "").strip()
        user_unit = (user_ctx.get("organization_unit") or "").strip()
        user_jenis_jab = (user_ctx.get("jenis_jabatan") or "").strip()
        user_gol = (user_ctx.get("golongan") or "").strip()

        # Deteksi apakah user menanyakan untuk dirinya sendiri
        asking_for_self = bool(re.search(
            r"\b(saya|untuk\s*saya|jabatan\s*saya|unit\s*saya|posisi\s*saya|pekerjaan\s*saya|tupoksi\s*saya|profil\s*saya|rekomendasi\s*pelatihan\s*saya|rekomendasi\s*kursus\s*saya)\b",
            norm_query
        ))

        if (asking_for_self or not any(kw in norm_query for c in clusters_def.values() for kw in c["keywords"][:4])) and (user_pos or user_unit):
            # Coba cocokkan berdasarkan profil ASN pengguna
            is_user_personal = True
            combined_profile = f"{user_pos} {user_unit}".lower()
            best_score = 0
            for ckey, cinfo in clusters_def.items():
                score = 0
                for kw in cinfo["keywords"]:
                    if kw in combined_profile:
                        score += 2
                if score > best_score:
                    best_score = score
                    chosen_cluster_key = ckey

        # Jika belum terpilih atau pengguna menyebutkan unit/bidang tertentu secara eksplisit di pertanyaan
        if not chosen_cluster_key:
            best_score = 0
            for ckey, cinfo in clusters_def.items():
                score = 0
                for kw in cinfo["keywords"]:
                    # Gunakan regex word boundary
                    if re.search(rf"\b{re.escape(kw)}\b", norm_query):
                        score += 3
                if score > best_score:
                    best_score = score
                    chosen_cluster_key = ckey

        # Fallback klaster default jika masih umum
        if not chosen_cluster_key:
            if user_pos or user_unit:
                chosen_cluster_key = "ti_digital" if "sistem" in (user_pos + user_unit).lower() else "sdm_organisasi"
                is_user_personal = True
            else:
                chosen_cluster_key = "sdm_organisasi"

        cluster = clusters_def[chosen_cluster_key]

        # 2. Cari Kursus Aktif Terkait di LMS
        matched_courses = []
        try:
            q_filter = Q(platform_status="Published")
            tag_filter = Q()
            for tag in cluster["search_tags"]:
                tag_filter |= Q(title__icontains=tag) | Q(description__icontains=tag)
            
            c_qs = api_models.Course.objects.filter(q_filter).filter(tag_filter).distinct()
            if not c_qs.exists():
                c_qs = api_models.Course.objects.filter(platform_status="Published").order_by("-id")[:3]
            
            for c in c_qs[:3]:
                matched_courses.append({
                    "id": c.id,
                    "title": c.title,
                    "slug": c.slug,
                    "category": c.category.title if c.category else "Kompetensi Utama",
                    "level": getattr(c, "level", "Semua Tingkat")
                })
        except Exception as e:
            logger.warning(f"Error fetching cluster courses: {e}")
            matched_courses = []

        # 3. Bentuk Balasan Cerdas & Menarik (Markdown)
        reply = f"🎯 **Rekomendasi Jalur Pembelajaran & Kompetensi ASN DPD RI**\n\n"

        if is_user_personal and (user_pos or user_unit):
            user_name = user_ctx.get("name") or "Rekan ASN"
            reply += f"Halo **{user_name}**! Berdasarkan profil kepegawaian Anda di lingkungan Sekretariat Jenderal DPD RI:\n\n"
            if user_pos:
                reply += f"• **Jabatan:** {user_pos}\n"
            if user_unit:
                reply += f"• **Unit Kerja:** {user_unit}\n"
            if user_jenis_jab or user_gol:
                jab_info = f"{user_jenis_jab or 'Aparatur Sipil Negara'}"
                if user_gol:
                    jab_info += f" (Golongan {user_gol})"
                reply += f"• **Klasifikasi:** {jab_info}\n"
            reply += "\n"
            reply += f"Tupoksi Anda selaras dengan **{cluster['badge']}**:\n"
            reply += f"> *\"{cluster['tupoksi']}\"*\n\n"
        else:
            reply += f"Berikut rekomendasi kompetensi untuk **{cluster['badge']}**:\n"
            reply += f"> *\"{cluster['tupoksi']}\"*\n\n"

        reply += "📌 **Fokus Kebutuhan Kompetensi Utama:**\n"
        for i, comp in enumerate(cluster["competencies"], 1):
            reply += f"{i}. {comp}\n"
        reply += "\n"

        reply += "🗺️ **Jalur Pembelajaran Terstruktur (*Recommended Learning Pathway*):**\n"
        for step in cluster["learning_path"]:
            reply += f"• {step}\n"
        reply += "\n"

        if matched_courses:
            reply += "🚀 **Pelatihan Tersedia di LMS Setjen DPD RI Saat Ini:**\n"
            reply += "Anda dapat langsung mendaftar atau melanjutkan pelatihan relevan di bawah ini:"
        else:
            reply += "Silakan jelajahi katalog lengkap untuk melihat seluruh modul pelatihan yang siap diakses!"

        # 4. Susun Aksi Interaktif
        actions = []
        if matched_courses:
            first_c = matched_courses[0]
            actions.append({
                "label": f"📖 Mulai: {first_c['title'][:22]}...",
                "url": f"/course-detail/{first_c['slug']}/",
                "type": "route"
            })
        actions.append({
            "label": "🔍 Katalog Semua Kursus",
            "url": "/search/",
            "type": "route"
        })
        if user_ctx.get("is_authenticated"):
            actions.append({
                "label": "📜 Sertifikat Saya",
                "url": "/student/sertifikat/",
                "type": "route"
            })

        # 5. Suggested Questions Tindak Lanjut
        suggested = [
            f"Silabus materi {matched_courses[0]['title'][:25]}..." if matched_courses else "Cari kursus keparlemenan",
            "Bagaimana cara mendapatkan sertifikat kelulusan?",
            "Rekomendasi pelatihan untuk bagian persidangan" if chosen_cluster_key != "persidangan_risalah" else "Rekomendasi untuk bagian hukum dan legislasi"
        ]

        return {
            "status": "success",
            "reply": reply,
            "source": "role_unit_competency_recommender",
            "cluster_key": chosen_cluster_key,
            "suggested_questions": suggested,
            "actions": actions,
            "recommended_courses": matched_courses
        }

    def _handle_quiz_prep_simulator(
        self, raw_message: str, norm_query: str, user_ctx: Dict[str, Any], current_course: Any = None
    ) -> Dict[str, Any]:
        """
        AI Interactive Flashcards & Self-Quiz Generator (Latihan Mandiri Interaktif di Chat):
        Menyajikan:
        1. Kuis interaktif pilihan ganda (A, B, C, D) dengan instant rationale & pembahasan
        2. Flashcards pembelajaran 3D (kartu bolak-balik: konsep kunci, intisari, dan takeaways)
        3. Opsi simpan ke Catatan Belajar & audio narration (TTS).
        """
        curated_flashcard_decks = {
            "design_thinking": {
                "deck_id": "deck_design_thinking",
                "topic": "Metodologi Design Thinking & Inovasi ASN",
                "course_title": "Rabuan IV - Design Thinking: Kunci ASN Inovatif dan Birokrasi Adaptif",
                "course_slug": "rabuan-iv-design-thinking-kunci-asn-inovatif-dan-birokrasi-yang-lebih-adaptif-46",
                "cards": [
                    {
                        "id": "dt_c1",
                        "front_title": "Human-Centered Design (Desain Berpusat Manusia)",
                        "front_prompt": "Apa esensi dan prinsip utama dari Human-Centered Design dalam konteks inovasi pelayanan birokrasi ASN Setjen DPD RI?",
                        "back_summary": "Pendekatan inovasi yang menempatkan kebutuhan, empati, dan aspirasi pengguna layanan publik sebagai pusat perancangan solusi. Bukan sekadar membuat aplikasi baru, melainkan memahami keresahan riil (pain points) stakeholder dan aparatur secara mendalam sebelum menyusun solusi.",
                        "key_takeaway": "Mulailah dari 'Empati' (mendengar kebutuhan pengguna), bukan dari asumsi internal birokrasi.",
                        "tag": "Konsep Utama"
                    },
                    {
                        "id": "dt_c2",
                        "front_title": "Three Lenses of Innovation (Tiga Lensa Inovasi)",
                        "front_prompt": "Sebutkan dan jelaskan 3 lensa inovasi yang wajib seimbang agar inovasi pelayanan publik dapat berkelanjutan!",
                        "back_summary": "Inovasi berkelanjutan berada di titik temu 3 lensa:\n1. Desirability (Dibutuhkan dan diinginkan pengguna layanan)\n2. Feasibility (Layak secara teknologi dan kapasitas organisasi)\n3. Viability (Berkelanjutan secara regulasi hukum dan efisiensi anggaran negara).",
                        "key_takeaway": "Inovasi yang hebat harus legal, aplikatif, dan benar-benar menyelesaikan masalah masyarakat/daerah.",
                        "tag": "Kerangka Kerja"
                    },
                    {
                        "id": "dt_c3",
                        "front_title": "Rapid Prototyping (Pembuatan Prototipe Cepat)",
                        "front_prompt": "Mengapa prinsip 'Fail Fast, Learn Cheap' sangat penting dalam tahapan prototyping inovasi ASN?",
                        "back_summary": "Prototipe cepat dibuat dengan sumber daya sederhana untuk menguji asumsi solusi langsung kepada pengguna. Tujuannya adalah mendeteksi kelemahan lebih awal sehingga perbaikan dapat dilakukan tanpa membuang anggaran besar dan waktu berbulan-bulan.",
                        "key_takeaway": "Uji coba solusi dalam skala kecil sebelum meluncurkan kebijakan atau sistem dalam skala penuh.",
                        "tag": "Tahapan Aksi"
                    },
                    {
                        "id": "dt_c4",
                        "front_title": "Mindset ASN Adaptif dalam Design Thinking",
                        "front_prompt": "Bagaimana mengubah pola pikir birokrasi dari 'Rutinitas Administratif' menuju 'Problem Solver Kolaboratif'?",
                        "back_summary": "ASN adaptif memandang masalah sebagai peluang perbaikan (opportunity), terbuka terhadap masukan dari berbagai jenjang, tidak takut bereksperimen dalam koridor aturan, dan selalu mengutamakan kemudahan layanan publik.",
                        "key_takeaway": "Fokus pada 'Dampak (Outcome)' dan 'Kepuasan Pengguna', bukan sekadar menggugurkan kewajiban serapan anggaran.",
                        "tag": "Budaya Kerja"
                    }
                ]
            },
            "berakhlak": {
                "deck_id": "deck_berakhlak",
                "topic": "Core Values ASN BerAKHLAK & Budaya Kerja Parlemen",
                "course_title": "Core Values ASN BerAKHLAK Setjen DPD RI",
                "course_slug": "rabuan-iv-design-thinking-kunci-asn-inovatif-dan-birokrasi-yang-lebih-adaptif-46",
                "cards": [
                    {
                        "id": "akhlak_c1",
                        "front_title": "Berorientasi Pelayanan",
                        "front_prompt": "Apa komitmen dasar nilai 'Berorientasi Pelayanan' bagi pegawai di lingkungan Sekretariat Jenderal DPD RI?",
                        "back_summary": "Berkomitmen memberikan pelayanan prima demi kepuasan masyarakat, Anggota DPD RI, dan pemangku kepentingan daerah, dengan panduan perilaku: memahami & memenuhi kebutuhan, ramah, cekatan, solutif, serta melakukan perbaikan tiada henti.",
                        "key_takeaway": "Pelayanan parlemen yang responsif memperkuat legitimasi dan peran DPD RI di mata publik.",
                        "tag": "Core Values"
                    },
                    {
                        "id": "akhlak_c2",
                        "front_title": "Akuntabel & Kompeten",
                        "front_prompt": "Bagaimana mengintegrasikan nilai Akuntabel dan Kompeten dalam pengelolaan administrasi kedinasan?",
                        "back_summary": "Akuntabel: Bertanggung jawab atas kepercayaan yang diberikan dengan bekerja jujur, cermat, disiplin, dan tidak menyalahgunakan kewenangan jabatan. Kompeten: Terus belajar meningkatkan kapabilitas diri (memenuhi minimal 20 JP/tahun) dan memberikan kinerja terbaik.",
                        "key_takeaway": "Integritas moral dan kapabilitas teknis adalah dua pilar profesionalisme ASN DPD RI.",
                        "tag": "Core Values"
                    },
                    {
                        "id": "akhlak_c3",
                        "front_title": "Adaptif & Kolaboratif",
                        "front_prompt": "Apa wujud nyata implementasi nilai Adaptif dan Kolaboratif di era transformasi digital DPD RI?",
                        "back_summary": "Adaptif: Cepat menyesuaikan diri terhadap perubahan zaman, proaktif berinovasi, dan memanfaatkan teknologi digital (LMS, persidangan elektronik). Kolaboratif: Membuka kesempatan berbagai pihak (lintas biro/bagian dan pemerintah daerah) untuk bersinergi.",
                        "key_takeaway": "Sinergi lintas unit kerja meruntuhkan ego sektoral demi efektivitas dukungan kelembagaan DPD RI.",
                        "tag": "Core Values"
                    }
                ]
            },
            "tata_tertib": {
                "deck_id": "deck_tata_tertib",
                "topic": "Tata Tertib, Risalah & Administrasi Persidangan DPD RI",
                "course_title": "Dukungan Keahlian & Administrasi Persidangan Parlemen",
                "course_slug": "rabuan-iv-design-thinking-kunci-asn-inovatif-dan-birokrasi-yang-lebih-adaptif-46",
                "cards": [
                    {
                        "id": "tatib_c1",
                        "front_title": "Kuorum Sidang Paripurna DPD RI",
                        "front_prompt": "Kapan suatu Sidang Paripurna DPD RI dinyatakan memenuhi kuorum untuk pengambilan keputusan yang sah?",
                        "back_summary": "Berdasarkan Peraturan Tata Tertib DPD RI, kuorum pengambilan keputusan sah apabila dihadiri oleh lebih dari separuh (1/2) jumlah seluruh Anggota DPD RI yang mewakili lebih dari separuh (1/2) jumlah provinsi di Indonesia.",
                        "key_takeaway": "Representasi ganda (jumlah anggota dan keterwakilan daerah provinsi) adalah ciri khas kuorum perwakilan daerah.",
                        "tag": "Tata Tertib"
                    },
                    {
                        "id": "tatib_c2",
                        "front_title": "Naskah Akademik RUU Inisiatif DPD RI",
                        "front_prompt": "Apa fungsi fundamental Naskah Akademik dalam proses pembentukan RUU inisiatif DPD RI?",
                        "back_summary": "Sebagai dokumen pertanggungjawaban ilmiah yang memuat telaah landasan filosofis, sosiologis, dan yuridis mengenai urgensi, jangkauan, dan arah materi muatan suatu RUU sebelum diajukan dalam Program Legislasi Nasional (Prolegnas).",
                        "key_takeaway": "Naskah Akademik menjamin setiap pasal RUU inisiatif berakar kuat pada data empiris dan kajian hukum.",
                        "tag": "Legislasi"
                    },
                    {
                        "id": "tatib_c3",
                        "front_title": "Risalah Resmi Persidangan (Verbatim)",
                        "front_prompt": "Apa perbedaan dokumen 'Risalah Resmi Persidangan' dengan 'Notula Rapat' di Setjen DPD RI?",
                        "back_summary": "Risalah adalah catatan resmi persidangan yang disusun secara kata demi kata (verbatim) dari rekaman audio sidang sebagai dokumen otentik kenegaraan. Notula adalah catatan ringkas pokok-pokok bahasan dan kesimpulan rapat.",
                        "key_takeaway": "Risalah verbatim merupakan arsip otentik yang menjadi rujukan original intent kebijakan negara.",
                        "tag": "Tata Naskah Dinas"
                    }
                ]
            }
        }

        # Format teks siap simpan ke Catatan Belajar untuk setiap kartu
        for deck_key, d in curated_flashcard_decks.items():
            for c in d["cards"]:
                c["plain_text_note"] = (
                    f"📌 FLASHCARD BELAJAR: {c['front_title']}\n"
                    f"Topik: {d['topic']}\n"
                    f"Pelatihan: {d['course_title']}\n\n"
                    f"❓ Pertanyaan / Konsep Kunci:\n{c['front_prompt']}\n\n"
                    f"💡 Intisari Penjelasan:\n{c['back_summary']}\n\n"
                    f"🎯 Poin Aksi ASN:\n{c.get('key_takeaway', '')}\n\n"
                    f"(Disimpan dari Manta AI - LMS Setjen DPD RI)"
                )

        # Pilih deck flashcard yang sesuai
        if "persidangan" in norm_query or "sidang" in norm_query or "paripurna" in norm_query or "tatib" in norm_query:
            selected_deck = copy.deepcopy(curated_flashcard_decks["tata_tertib"])
        elif "berakhlak" in norm_query or "asn" in norm_query or "nilai" in norm_query or "akhlak" in norm_query:
            selected_deck = copy.deepcopy(curated_flashcard_decks["berakhlak"])
        else:
            selected_deck = copy.deepcopy(curated_flashcard_decks["design_thinking"])

        if current_course:
            selected_deck["course_title"] = current_course.title
            selected_deck["course_slug"] = current_course.slug

        curated_quiz_bank = [
            {
                "id": "quiz_dt_definition",
                "course_title": "Rabuan IV - Design Thinking: Kunci ASN Inovatif dan Birokrasi Adaptif",
                "course_slug": "rabuan-iv-design-thinking-kunci-asn-inovatif-dan-birokrasi-yang-lebih-adaptif",
                "topic": "Konsep Dasar Design Thinking",
                "question": "Menurut materi pelatihan inovasi ASN, apa esensi dan definisi utama dari metodologi Design Thinking?",
                "choices": [
                    {"key": "A", "text": "Metode teknis untuk menyusun laporan keuangan otomatis"},
                    {"key": "B", "text": "Pendekatan inovasi berpusat pada manusia (Human-Centered) yang diawali dengan empati"},
                    {"key": "C", "text": "Alat restrukturisasi kelembagaan secara formalistik"},
                    {"key": "D", "text": "Aplikasi komputasi awan untuk digitalisasi arsip"}
                ],
                "correct_key": "B",
                "explanation": "Design Thinking adalah pendekatan inovasi yang berpusat pada manusia (Human-Centered Design). Pendekatan ini memprioritaskan pemahaman mendalam terhadap kebutuhan, keresahan, dan harapan pengguna layanan sebelum merancang solusi inovatif."
            },
            {
                "id": "quiz_dt_three_lenses",
                "course_title": "Rabuan IV - Design Thinking: Kunci ASN Inovatif dan Birokrasi Adaptif",
                "course_slug": "rabuan-iv-design-thinking-kunci-asn-inovatif-dan-birokrasi-yang-lebih-adaptif",
                "topic": "Tiga Lensa Inovasi (Three Lenses of Innovation)",
                "question": "Tiga lensa utama (Three Lenses of Innovation) yang harus seimbang agar inovasi birokrasi berkelanjutan adalah...",
                "choices": [
                    {"key": "A", "text": "Desirability (Keinginan Pengguna), Feasibility (Kelayakan Teknis), dan Viability (Keberlanjutan Organisasi)"},
                    {"key": "B", "text": "Besaran Anggaran, Jumlah Staf, dan Fasilitas Kantor"},
                    {"key": "C", "text": "Kecepatan Viral di Media Sosial, Jumlah Pengikut, dan Desain Grafis"},
                    {"key": "D", "text": "Regulasi Lama, Kebiasaan Rutin, dan Instruksi Lisan"}
                ],
                "correct_key": "A",
                "explanation": "Inovasi yang sukses dan berdampak harus berada di titik iris ketiga lensa: Desirability (apakah solusi ini benar-benar diinginkan pengguna?), Feasibility (apakah layak secara teknis/organisasi?), dan Viability (apakah berkelanjutan secara sumber daya dan aturan?)."
            },
            {
                "id": "quiz_dt_prototype",
                "course_title": "Rabuan IV - Design Thinking: Kunci ASN Inovatif dan Birokrasi Adaptif",
                "course_slug": "rabuan-iv-design-thinking-kunci-asn-inovatif-dan-birokrasi-yang-lebih-adaptif",
                "topic": "Tahap Prototyping Cepat",
                "question": "Tujuan utama pembuatan prototipe (rapid prototyping) dalam pelayanan publik adalah...",
                "choices": [
                    {"key": "A", "text": "Menghabiskan alokasi anggaran riset sebelum akhir tahun anggaran"},
                    {"key": "B", "text": "Menguji asumsi solusi lebih awal kepada pengguna dengan risiko dan biaya minimal"},
                    {"key": "C", "text": "Menggantikan dokumen resmi peraturan perundang-undangan"},
                    {"key": "D", "text": "Menunda waktu peluncuran layanan kepada publik"}
                ],
                "correct_key": "B",
                "explanation": "Pembuatan prototipe cepat bertujuan untuk 'gagal lebih awal dan murah' (fail fast, learn cheap), sehingga asumsi dan kelemahan solusi dapat diverifikasi langsung oleh pengguna nyata sebelum diimplementasikan dalam skala besar."
            },
            {
                "id": "quiz_asn_adaptif",
                "course_title": "Core Values ASN BerAKHLAK",
                "course_slug": "rabuan-iv-design-thinking-kunci-asn-inovatif-dan-birokrasi-yang-lebih-adaptif",
                "topic": "Budaya Kerja ASN BerAKHLAK",
                "question": "Perilaku 'Cepat menyesuaikan diri menghadapi perubahan, terus berinovasi, dan bertindak proaktif' merupakan panduan perilaku dari nilai dasar...",
                "choices": [
                    {"key": "A", "text": "Akuntabel"},
                    {"key": "B", "text": "Harmonis"},
                    {"key": "C", "text": "Adaptif"},
                    {"key": "D", "text": "Loyal"}
                ],
                "correct_key": "C",
                "explanation": "Nilai Adaptif dalam Core Values ASN BerAKHLAK menuntut aparatur negara untuk tidak resistan terhadap perubahan zaman, melainkan proaktif berinovasi dan adaptif terhadap perkembangan teknologi dan dinamika kebutuhan masyarakat."
            },
            {
                "id": "quiz_parlemen_kuorum",
                "course_title": "Tata Tertib & Persidangan Parlemen DPD RI",
                "course_slug": "rabuan-iv-design-thinking-kunci-asn-inovatif-dan-birokrasi-yang-lebih-adaptif",
                "topic": "Tata Tertib Persidangan Parlemen",
                "question": "Berdasarkan tata tertib DPD RI, kuorum pengambilan keputusan dalam sidang paripurna dinyatakan sah apabila...",
                "choices": [
                    {"key": "A", "text": "Dihadiri sekurang-kurangnya 1/3 dari jumlah Anggota DPD RI"},
                    {"key": "B", "text": "Dihadiri lebih dari 1/2 jumlah Anggota DPD RI yang mewakili lebih dari 1/2 jumlah provinsi"},
                    {"key": "C", "text": "Dihadiri seluruh Pimpinan Komite dan Pimpinan Lembaga"},
                    {"key": "D", "text": "Mendapat persetujuan bulat dari Pimpinan Badan Urusan Rumah Tangga"}
                ],
                "correct_key": "B",
                "explanation": "Tata Tertib DPD RI menetapkan bahwa pengambilan keputusan dalam Sidang Paripurna sah jika dihadiri oleh lebih dari separuh (1/2) jumlah seluruh Anggota DPD RI yang mewakili lebih dari separuh (1/2) jumlah provinsi di Indonesia."
            },
            {
                "id": "quiz_legal_naskah_akademik",
                "course_title": "Perancangan Perundang-Undangan & Analisis Legislasi",
                "course_slug": "rabuan-iv-design-thinking-kunci-asn-inovatif-dan-birokrasi-yang-lebih-adaptif",
                "topic": "Pembentukan RUU Inisiatif DPD RI",
                "question": "Dokumen penelitian ilmiah yang memuat landasan filosofis, sosiologis, dan yuridis sebagai dasar perumusan draf RUU inisiatif DPD RI adalah...",
                "choices": [
                    {"key": "A", "text": "Naskah Akademik"},
                    {"key": "B", "text": "Risalah Rapat Panitia Perancang Undang-Undang"},
                    {"key": "C", "text": "Catatan Audiensi Publik"},
                    {"key": "D", "text": "Surat Edaran Sekretaris Jenderal"}
                ],
                "correct_key": "A",
                "explanation": "Naskah Akademik adalah naskah hasil penelitian atau pengkajian hukum dan hasil penelitian lainnya terhadap suatu masalah tertentu yang dapat dipertanggungjawabkan secara ilmiah mengenai pengaturan masalah tersebut dalam suatu RUU inisiatif DPD RI."
            },
            {
                "id": "quiz_risalah_verbatim",
                "course_title": "Dukungan Administrasi Risalah & Notulensi Parlemen",
                "course_slug": "rabuan-iv-design-thinking-kunci-asn-inovatif-dan-birokrasi-yang-lebih-adaptif",
                "topic": "Manajemen Risalah Parlemen",
                "question": "Catatan resmi persidangan parlemen yang memuat seluruh pembicaraan dan perdebatan secara kata demi kata (verbatim) adalah...",
                "choices": [
                    {"key": "A", "text": "Notula Rapat Ringkas"},
                    {"key": "B", "text": "Risalah Resmi Persidangan"},
                    {"key": "C", "text": "Laporan Pandangan Fraksi/Kelompok"},
                    {"key": "D", "text": "Ringkasan Eksekutif Rapat"}
                ],
                "correct_key": "B",
                "explanation": "Risalah Resmi Persidangan memuat transkripsi utuh kata demi kata (verbatim) dari seluruh rekaman jalannya sidang paripurna atau rapat alat kelengkapan DPD RI, yang disusun oleh Perisalah Legislatif sebagai dokumen otentik negara."
            }
        ]

        # Ambil pertanyaan dari database kuis nyata LMS jika tersedia
        db_candidates = []
        try:
            q_filter = Q(quiz__course__platform_status="Published")
            if current_course:
                q_filter &= Q(quiz__course=current_course)
            elif "design" in norm_query or "inovasi" in norm_query:
                q_filter &= Q(quiz__course__title__icontains="design")

            db_qq_list = api_models.QuizQuestion.objects.filter(q_filter).select_related('quiz', 'quiz__course')
            for qq in db_qq_list:
                if len(qq.question_text.strip()) < 15 or "asas" in qq.question_text.lower() or "waqq" in qq.question_text.lower():
                    continue
                choices = list(api_models.QuizChoice.objects.filter(question=qq).order_by('id'))
                if len(choices) >= 3 and any(c.is_correct for c in choices):
                    letters = ["A", "B", "C", "D", "E"]
                    formatted_choices = []
                    correct_key = "A"
                    correct_text = ""
                    for idx, c in enumerate(choices[:4]):
                        key = letters[idx]
                        formatted_choices.append({"key": key, "text": c.choice_text})
                        if c.is_correct:
                            correct_key = key
                            correct_text = c.choice_text

                    c_title = qq.quiz.course.title if qq.quiz and qq.quiz.course else "Pelatihan LMS Setjen DPD RI"
                    c_slug = qq.quiz.course.slug if qq.quiz and qq.quiz.course else "search"
                    db_candidates.append({
                        "id": f"db_qq_{qq.id}",
                        "course_title": c_title,
                        "course_slug": c_slug,
                        "topic": qq.quiz.title,
                        "question": qq.question_text,
                        "choices": formatted_choices,
                        "correct_key": correct_key,
                        "explanation": f"Jawaban yang tepat adalah opsi {correct_key}: '{correct_text}'. Pemahaman materi ini menjadi indikator penting dalam evaluasi kompetensi pada modul {qq.quiz.title}."
                    })
        except Exception as e:
            logger.warning(f"Error fetching database quiz questions: {e}")

        # Gabungkan bank soal
        pool = []
        if "persidangan" in norm_query or "sidang" in norm_query or "paripurna" in norm_query:
            pool = [q for q in curated_quiz_bank if "parlemen" in q["id"] or "risalah" in q["id"]]
        elif "hukum" in norm_query or "naskah" in norm_query or "legislasi" in norm_query:
            pool = [q for q in curated_quiz_bank if "legal" in q["id"]]
        elif "berakhlak" in norm_query or "asn" in norm_query or "nilai" in norm_query:
            pool = [q for q in curated_quiz_bank if "asn" in q["id"]]
        elif "design" in norm_query or "inovasi" in norm_query:
            pool = db_candidates + [q for q in curated_quiz_bank if "dt_" in q["id"]]

        if not pool:
            pool = db_candidates + curated_quiz_bank

        quiz_item = random.choice(pool)

        is_flashcard_mode = bool(re.search(r"\b(flashcard|flash\s*card|kartu|hafalan|deck)\b", norm_query))
        active_mode = "flashcards" if is_flashcard_mode else "quiz"

        if is_flashcard_mode:
            reply = (
                f"🗂️ **Flashcard Pemahaman Mandiri (Self-Study Knowledge Deck):**\n\n"
                f"Topik: **{selected_deck['topic']}**\n"
                f"Pelatihan: *{selected_deck['course_title']}*\n"
                f"Total Kartu: **{len(selected_deck['cards'])} Kartu Konsep**\n\n"
                f"Silakan klik tombol **'Balik Kartu'** untuk mempelajari intisari konsep dan poin pentingnya. "
                f"Anda juga dapat beralih ke mode **Kuis Pilihan Ganda** atau menyimpan kartu ke **Catatan Belajar**!"
            )
        else:
            reply = (
                f"🧠 **Simulasi Uji Pemahaman Mandiri (Quiz Prep & Flashcard):**\n\n"
                f"Topik: **{quiz_item['topic']}**\n"
                f"Pelatihan: *{quiz_item['course_title']}*\n\n"
                f"📌 **Pertanyaan:**\n"
                f"> {quiz_item['question']}\n\n"
                f"Silakan klik salah satu opsi jawaban di bawah untuk melihat pembahasan instan dari Manta!"
            )

        actions = [
            {"label": "🔄 Soal / Kartu Lain", "action": "next_quiz", "type": "event"},
            {"label": "🔍 Katalog Semua Kursus", "url": "/search/", "type": "route"}
        ]
        if selected_deck.get("course_slug"):
            actions.insert(1, {
                "label": "📖 Buka Silabus Kursus",
                "url": f"/course-detail/{selected_deck['course_slug']}/",
                "type": "route"
            })
        if user_ctx.get("is_authenticated"):
            actions.append({
                "label": "📜 Cek Sertifikat Saya",
                "url": "/student/sertifikat/",
                "type": "route"
            })

        return {
            "status": "success",
            "reply": reply,
            "source": "quiz_prep_simulator",
            "active_mode": active_mode,
            "interactive_quiz": quiz_item,
            "flashcard_deck": selected_deck,
            "suggested_questions": [
                "🗂️ Buka Flashcard materi ini" if active_mode == "quiz" else "🧠 Latihan Kuis Pilihan Ganda",
                "Latihan kuis soal berikutnya",
                "Apa itu Tiga Lensa Inovasi (Three Lenses)?",
                "Beri saya latihan kuis tata tertib persidangan"
            ],
            "actions": actions,
            "recommended_courses": []
        }

    def _handle_course_summarizer(
        self, raw_message: str, norm_query: str, user_ctx: Dict[str, Any], current_course: Any = None
    ) -> Dict[str, Any]:
        """
        Instant Course & Chapter AI Summarizer:
        Menghasilkan rangkuman intisari materi pelatihan/bab secara instan, 3-4 golden key takeaways,
        dan langkah implementasi aksi di lingkungan kerja Sekretariat Jenderal DPD RI.
        Menyediakan payload ringkasan siap ekspor ke model Note (Catatan Belajar) mahasiswa.
        """
        # 1. Tentukan target course
        target_course = current_course
        user_enrollment = None
        if user_ctx.get("is_authenticated") and user_ctx.get("user_id"):
            uid = user_ctx["user_id"]
            enrolled_qs = api_models.EnrolledCourse.objects.filter(user_id=uid).select_related("course")
            # Jika user belum di halaman kursus tertentu, cek kursus yang diikuti user yang paling relevan
            if not target_course:
                if "design" in norm_query or "inovasi" in norm_query or "thinking" in norm_query:
                    match_enr = enrolled_qs.filter(course__title__icontains="design").first() or enrolled_qs.filter(course__title__icontains="inovasi").first()
                    if match_enr:
                        target_course = match_enr.course
                        user_enrollment = match_enr
                elif "persidangan" in norm_query or "sidang" in norm_query or "risalah" in norm_query:
                    match_enr = enrolled_qs.filter(course__title__icontains="persidangan").first() or enrolled_qs.filter(course__title__icontains="risalah").first()
                    if match_enr:
                        target_course = match_enr.course
                        user_enrollment = match_enr

            if target_course and not user_enrollment:
                user_enrollment = enrolled_qs.filter(course=target_course).first() or enrolled_qs.filter(course__title__iexact=target_course.title).first()
                if user_enrollment and user_enrollment.course != target_course:
                    target_course = user_enrollment.course

        if not target_course:
            # Cari dari seluruh kursus Published
            if "design" in norm_query or "inovasi" in norm_query or "thinking" in norm_query:
                target_course = api_models.Course.objects.filter(platform_status="Published", title__icontains="design").order_by("-id").first()
            elif "persidangan" in norm_query or "sidang" in norm_query or "risalah" in norm_query:
                target_course = api_models.Course.objects.filter(platform_status="Published", title__icontains="persidangan").order_by("-id").first()

            # Jika user punya kursus aktif terakhir
            if not target_course and user_ctx.get("latest_course"):
                target_course = api_models.Course.objects.filter(id=user_ctx["latest_course"]["id"]).first()

            # Fallback ke kursus unggulan terbitan
            if not target_course:
                target_course = api_models.Course.objects.filter(platform_status="Published").order_by("-id").first()

        course_title = target_course.title if target_course else "Pelatihan Inovasi Birokrasi ASN"
        course_slug = target_course.slug if target_course else "search"
        course_id = target_course.id if target_course else None

        # 2. Cek apakah ada bab / materi spesifik yang disebut di query
        chapter_title = None
        variants = []
        if target_course:
            try:
                variants = list(api_models.Variant.objects.filter(course=target_course).order_by("order"))
            except Exception:
                variants = []

        if "bab 1" in norm_query or "pendahuluan" in norm_query or "definisi" in norm_query:
            chapter_title = variants[0].title if variants else "Bab 1: Konsep Dasar & Mindset Inovasi"
        elif "bab 2" in norm_query or "tiga lensa" in norm_query or "three lenses" in norm_query:
            chapter_title = variants[1].title if len(variants) > 1 else "Bab 2: Tiga Lensa Inovasi (Three Lenses)"
        elif "bab 3" in norm_query or "prototipe" in norm_query or "prototype" in norm_query:
            chapter_title = variants[2].title if len(variants) > 2 else "Bab 3: Prototyping Cepat & Validasi Solusi"

        # 3. Bentuk konten Golden Takeaways & Action Steps
        if target_course and "design" in target_course.title.lower():
            topic_label = chapter_title or "Intisari Lengkap Design Thinking ASN"
            takeaways = [
                "Human-Centered Mindset (Empati Pengguna): Inovasi birokrasi sejati selalu diawali dengan empati mendalam terhadap kebutuhan, keresahan, dan harapan pengguna layanan (Anggota Dewan, publik, dan sesama rekan ASN), bukan sekadar kepatuhan prosedur administratif yang kaku.",
                "Tiga Lensa Inovasi (Three Lenses of Innovation): Solusi pelayanan publik harus berada di titik iris seimbang antara Desirability (apakah solusi diinginkan pengguna?), Feasibility (apakah layak dan dapat dieksekusi secara teknis?), dan Viability (apakah berkelanjutan secara sumber daya, regulasi, dan organisasi?).",
                "Fail Fast, Learn Cheap (Prototyping Cepat): Jangan menunggu draf sistem atau regulasi sempurna berbulan-bulan. Uji coba asumsi lebih awal melalui simulasi atau alur kerja mini agar kelemahan terdeteksi sejak dini dengan risiko dan biaya minimal.",
                "Budaya Kerja Agile & Kolaborasi Lintas Silo: Memecah sekat birokrasi konvensional antarsubbagian demi menghasilkan layanan parlemen yang adaptif, transparan, dan berorientasi hasil nyata (outcomes)."
            ]
            action_steps = [
                "Lakukan wawancara empati singkat (5–10 menit) dengan staf atau pengguna layanan sebelum merancang formulir atau alur kerja baru.",
                "Buat sketsa alur dokumen atau mock-up sederhana (low-fidelity prototype) untuk mendapatkan masukan awal sebelum menyusun draf SOP final.",
                "Tinjau kembali efektivitas layanan subbagian secara berkala menggunakan kotak masukan dan evaluasi kepuasan pengguna (user feedback loop)."
            ]
        elif target_course and ("persidangan" in target_course.title.lower() or "risalah" in target_course.title.lower()):
            topic_label = chapter_title or "Intisari Tata Tertib & Manajemen Persidangan Parlemen"
            takeaways = [
                "Prinsip Kuorum Sah Sidang Paripurna: Pengambilan keputusan sah mensyaratkan kehadiran lebih dari separuh (1/2) jumlah seluruh Anggota DPD RI yang mewakili lebih dari separuh (1/2) jumlah provinsi di Indonesia.",
                "Autentisitas Risalah Resmi Persidangan: Risalah adalah dokumen negara verbatim yang mencatat setiap kata dan dinamika musyawarah dewan secara akurat oleh Perisalah Legislatif sebagai arsip ketatanegaraan.",
                "Hierarki & Mekanisme Pengambilan Keputusan: Mengutamakan musyawarah mufakat, dan apabila tidak tercapai, dilakukan pemungutan suara (voting) sesuai koridor tata tertib dewan."
            ]
            action_steps = [
                "Lakukan verifikasi daftar hadir dan surat mandat anggota dewan secara terintegrasi sebelum sidang paripurna dimulai.",
                "Lakukan pengarsipan digital ganda terhadap rekaman audio dan naskah risalah sidang demi integritas data ketatanegaraan."
            ]
        else:
            clean_desc = re.sub(r'<[^>]+>', '', target_course.description or "").strip() if target_course else ""
            topic_label = chapter_title or f"Intisari Pelatihan {course_title}"
            takeaways = [
                f"Penguasaan Kompetensi Inti: Memahami prinsip fundamental dan metodologi utama yang diajarkan dalam pelatihan {course_title}.",
                "Peningkatan Kapasitas ASN: Menerapkan standar operasional dan etika pelayanan publik modern yang selaras dengan nilai BerAKHLAK.",
                "Efisiensi Tata Kelola Dokumen: Mengoptimalkan penggunaan teknologi informasi untuk mempercepat alur koordinasi dan pelaporan kerja di Setjen DPD RI."
            ]
            if clean_desc and len(clean_desc) > 30:
                takeaways.insert(0, f"Fokus Pembelajaran: {clean_desc[:140]}...")
            action_steps = [
                "Terapkan materi modul ini dalam tugas pokok dan fungsi harian di unit kerja masing-masing.",
                "Diskusikan poin pembelajaran ini bersama rekan kerja satu tim untuk harmonisasi prosedur pelayanan."
            ]

        # 4. Susun plain text untuk Note ekspor
        date_now_str = timezone.now().strftime("%d %b %Y, %H:%M WIB")
        plain_text_lines = [
            f"# {topic_label}",
            f"Pelatihan: {course_title}",
            f"Waktu Rangkuman: {date_now_str}",
            "",
            "## 🎯 Poin Kunci Utama (Key Takeaways):"
        ]
        for i, t in enumerate(takeaways, 1):
            plain_text_lines.append(f"{i}. {t}")
        plain_text_lines.append("")
        plain_text_lines.append("## ⚡ Langkah Implementasi di Tempat Kerja (Setjen DPD RI):")
        for step in action_steps:
            plain_text_lines.append(f"• {step}")
        plain_text_lines.append("")
        plain_text_lines.append("---")
        plain_text_lines.append("Catatan ini dirangkum secara otomatis oleh Manta AI - Asisten Virtual LMS Setjen DPD RI")
        plain_text_note = "\n".join(plain_text_lines)

        # 5. Susun teks balasan Manta (Markdown)
        reply = (
            f"📑 **Rangkuman Cerdas & Key Takeaways Materi:**\n\n"
            f"Pelatihan: **{course_title}**\n"
            f"Topik: *{topic_label}*\n\n"
            f"🎯 **Poin Kunci Utama (Golden Takeaways):**\n"
        )
        for i, t in enumerate(takeaways, 1):
            reply += f"{i}. {t}\n\n"

        reply += "⚡ **Langkah Aksi di Lingkungan Kerja Setjen DPD RI:**\n"
        for step in action_steps:
            reply += f"• {step}\n"
        reply += "\n"
        reply += "💡 *Anda dapat langsung mengekspor rangkuman ini ke **Catatan Belajar** akun Anda dengan mengklik tombol aksi di bawah!*"

        enrollment_id = user_enrollment.enrollment_id if user_enrollment else None
        if not enrollment_id and user_ctx.get("is_authenticated") and user_ctx.get("user_id") and target_course:
            enr = api_models.EnrolledCourse.objects.filter(user_id=user_ctx["user_id"], course=target_course).first()
            if not enr:
                enr = api_models.EnrolledCourse.objects.filter(user_id=user_ctx["user_id"], course__title__iexact=target_course.title).first()
            if enr:
                enrollment_id = enr.enrollment_id

        summary_card = {
            "id": f"summary_{course_id or 'gen'}",
            "course_id": course_id,
            "course_title": course_title,
            "course_slug": course_slug,
            "enrollment_id": enrollment_id,
            "course_player_url": f"/student/courses/{enrollment_id}/" if enrollment_id else None,
            "topic": topic_label,
            "title": f"Rangkuman: {topic_label}",
            "takeaways": takeaways,
            "action_steps": action_steps,
            "plain_text_note": plain_text_note
        }

        actions = [
            {
                "label": "📝 Simpan ke Catatan Belajar",
                "action": "save_to_notes",
                "summary_id": summary_card["id"],
                "course_id": course_id,
                "course_slug": course_slug,
                "enrollment_id": enrollment_id,
                "title": f"Rangkuman: {topic_label[:40]}",
                "content": plain_text_note,
                "type": "event"
            },
            {
                "label": "🧠 Latihan Kuis Materi Ini",
                "action": "next_quiz",
                "type": "event"
            }
        ]
        if enrollment_id:
            actions.append({
                "label": "🎓 Buka Ruang Belajar Kursus",
                "url": f"/student/courses/{enrollment_id}/",
                "type": "route"
            })
        elif course_slug:
            actions.append({
                "label": "📖 Buka Silabus Kursus",
                "url": f"/course-detail/{course_slug}/",
                "type": "route"
            })

        return {
            "status": "success",
            "reply": reply,
            "source": "instant_course_summarizer",
            "summary_card": summary_card,
            "suggested_questions": [
                "Di mana catatan saya?",
                "Latihan kuis materi ini",
                "Rangkum bab lainnya"
            ],
            "actions": actions,
            "recommended_courses": [
                {"id": course_id or 1, "title": course_title, "slug": course_slug, "category": "Materi Dirangkum"}
            ]
        }

    def _handle_user_notes_query(
        self, raw_message: str, norm_query: str, user_ctx: Dict[str, Any], current_course: Any = None
    ) -> Dict[str, Any]:
        """
        Membantu pengguna menemukan dan melihat Catatan Belajar mereka di LMS Setjen DPD RI.
        Menjelaskan letak catatan di Ruang Belajar (Tab Catatan) dan menampilkan daftar catatan aktif.
        """
        if not user_ctx.get("is_authenticated") or not user_ctx.get("user_id"):
            return {
                "status": "success",
                "reply": (
                    "Untuk melihat dan mengelola **Catatan Belajar** pribadi Anda, silakan masuk terlebih dahulu menggunakan akun SSO Setjen DPD RI."
                ),
                "source": "user_notes_locator",
                "suggested_questions": [
                    "Bagaimana cara login?",
                    "Rekomendasi kursus populer",
                    "Apa itu LMS Setjen DPD RI?"
                ],
                "actions": [
                    {"label": "🔐 Masuk Akun SSO", "url": "/login/", "type": "route"},
                    {"label": "🔍 Katalog Kursus", "url": "/search/", "type": "route"}
                ],
                "recommended_courses": []
            }

        user = api_models.User.objects.filter(id=user_ctx["user_id"]).first()
        if not user:
            return {
                "status": "success",
                "reply": "Profil pengguna tidak ditemukan.",
                "source": "user_notes_locator",
                "actions": [{"label": "📚 Kursus Saya", "url": "/student/courses/", "type": "route"}]
            }

        # Ambil seluruh catatan milik user
        notes_qs = api_models.Note.objects.filter(user=user).select_related("course").order_by("-id")
        notes_count = notes_qs.count()

        if notes_count == 0:
            reply = (
                f"Halo Bapak/Ibu **{user_ctx.get('name', 'Pegawai')}**,\n\n"
                "Anda saat ini belum memiliki catatan pembelajaran yang tersimpan.\n\n"
                "💡 **Cara membuat dan menyimpan catatan di LMS Setjen DPD RI:**\n"
                "1. **Melalui Manta AI:** Minta rangkuman materi (misal: *'Rangkumkan materi Design Thinking'*), lalu klik tombol **📝 Simpan ke Catatan Belajar**.\n"
                "2. **Melalui Ruang Belajar:** Buka kursus yang Anda ikuti di menu [Kursus Saya](/student/courses/), pilih tab **Catatan Saya**, lalu klik tombol **+ Tambah Catatan**."
            )
            return {
                "status": "success",
                "reply": reply,
                "source": "user_notes_locator",
                "suggested_questions": [
                    "Rangkumkan materi Design Thinking",
                    "Rangkum materi tata tertib persidangan",
                    "Lihat kemajuan kursus saya"
                ],
                "actions": [
                    {"label": "📚 Buka Kursus Saya", "url": "/student/courses/", "type": "route"},
                    {"label": "📑 Rangkum Design Thinking", "action": "quick_query", "query": "Rangkumkan poin penting materi Design Thinking", "type": "event"}
                ]
            }

        recent_notes = list(notes_qs[:5])
        
        reply = (
            f"📌 **Lokasi Catatan Belajar Anda di LMS Setjen DPD RI:**\n\n"
            f"Di LMS Setjen DPD RI, setiap catatan pembelajaran tersimpan dan terintegrasi di dalam **Ruang Belajar Kursus** pada tab **Catatan Saya** (terletak di bagian bawah pemutar video materi).\n\n"
            f"Anda memiliki total **{notes_count} catatan tersimpan**. Berikut adalah daftar catatan terbaru Anda:\n\n"
        )

        user_notes_data = []
        actions = []

        for idx, n in enumerate(recent_notes, 1):
            c_title = n.course.title if n.course else "Umum"
            # Cari enrollment
            enr = api_models.EnrolledCourse.objects.filter(user=user, course=n.course).first()
            if not enr and n.course:
                enr = api_models.EnrolledCourse.objects.filter(user=user, course__title__iexact=n.course.title).first()
            
            enr_id = enr.enrollment_id if enr else None
            open_url = f"/student/courses/{enr_id}/" if enr_id else (f"/course-detail/{n.course.slug}/" if n.course else "/student/courses/")
            date_str = n.date.strftime("%d %b %Y, %H:%M WIB") if hasattr(n, 'date') and n.date else "Tersimpan"

            reply += f"**{idx}. {n.title}**\n"
            reply += f"   • **Pelatihan:** {c_title}\n"
            reply += f"   • **Waktu Simpan:** {date_str}\n"
            if n.note:
                snippet = n.note[:140].replace("\n", " ").strip()
                reply += f"   • **Cuplikan:** _{snippet}..._\n\n"

            user_notes_data.append({
                "id": n.id,
                "note_id": n.note_id,
                "title": n.title,
                "course_title": c_title,
                "date": date_str,
                "enrollment_id": enr_id,
                "open_url": open_url,
                "content": n.note
            })

            if enr_id and len(actions) < 2:
                short_title = c_title[:24]
                actions.append({
                    "label": f"📖 Buka Catatan di {short_title}... ↗",
                    "url": open_url,
                    "type": "route"
                })

        actions.append({
            "label": "📚 Daftar Semua Kursus Saya",
            "url": "/student/courses/",
            "type": "route"
        })

        reply += (
            "👉 **Cara Menemukan Catatan:** Klik salah satu tombol di bawah atau buka menu **Kursus Saya**, pilih kursus yang bersangkutan, dan Anda akan langsung melihat tab **Catatan Saya** aktif dengan seluruh poin rangkuman yang telah tersimpan!"
        )

        return {
            "status": "success",
            "reply": reply,
            "source": "user_notes_locator",
            "user_notes": user_notes_data,
            "suggested_questions": [
                "Rangkum materi lainnya",
                "Latihan kuis materi kursus saya",
                "Bagaimana cara unduh sertifikat?"
            ],
            "actions": actions
        }

    def _calculate_course_jp(self, course: api_models.Course) -> int:
        """
        Menghitung bobot Jam Pelajaran (JP) resmi e-learning untuk kursus LMS Setjen DPD RI
        berdasarkan standar LAN RI (1 JP = 45 menit e-learning / pembelajaran mandiri).
        """
        if not course:
            return 2

        try:
            total_seconds = 0
            lectures = api_models.VariantItem.objects.filter(variant__course=course)
            lecture_count = lectures.count()
            for item in lectures:
                if getattr(item, 'duration', None):
                    total_seconds += item.duration.total_seconds()
                elif getattr(item, 'duration_seconds', None):
                    total_seconds += item.duration_seconds

            if total_seconds > 0:
                minutes = total_seconds / 60.0
                calc_jp = max(2, round(minutes / 45.0))
                return min(12, int(calc_jp))

            # Hitung berdasarkan level & jumlah modul
            if course.level == "Advanced":
                return max(4, min(8, round(lecture_count * 1.2 + 2)))
            elif course.level == "Intermediate":
                return max(3, min(6, round(lecture_count * 1.0 + 1)))
            else:
                return max(2, min(4, round(lecture_count * 0.8 + 1)))
        except Exception:
            return 2

    def _handle_asn_jp_tracker(self, user_ctx: Dict[str, Any], norm_query: str) -> Dict[str, Any]:
        """
        AI Study Coach & Pemenuhan 20 JP ASN Tracker:
        Memantau akumulasi Jam Pelajaran (JP) tahunan pegawai Setjen DPD RI sesuai mandat LAN RI (minimal 20 JP/tahun),
        menghitung sisa kebutuhan JP, menyusun rencana belajar mingguan cerdas (AI Weekly Study Schedule),
        dan merekomendasikan kursus-kursus pengejar JP yang tepat.
        """
        import math
        current_year = timezone.now().year
        target_jp = 20
        name = user_ctx.get("name") or "Rekan ASN"

        if not user_ctx.get("is_authenticated"):
            # Tamu / Pengguna belum login
            return {
                "status": "success",
                "reply": (
                    f"🎯 **Standar Pemenuhan Kewajiban 20 JP ASN Setjen DPD RI (Tahun {current_year}):**\n\n"
                    "Berdasarkan **Peraturan LAN RI No. 10 Tahun 2018** tentang Pengembangan Kompetensi PNS, "
                    "setiap Aparatur Sipil Negara diwajibkan memenuhi hak & kewajiban minimal **20 Jam Pelajaran (JP)** per tahun anggaran.\n\n"
                    "• **Ketentuan JP:** 1 JP setara dengan 45 menit pembelajaran daring / e-learning mandiri.\n"
                    "• **Pemanfaatan:** Perolehan JP dan sertifikat digital LMS terintegrasi langsung dengan Sasaran Kinerja Pegawai (SKP) dan rekam jejak kompetensi BPSDM Setjen DPD RI.\n\n"
                    "👉 **Silakan masuk menggunakan akun SSO Setjen DPD RI** untuk memantau akumulasi JP Anda secara real-time dan mendapatkan rekomendasi jadwal belajar mingguan dari Manta AI!"
                ),
                "source": "asn_jp_tracker",
                "jp_tracker": {
                    "target_jp": target_jp,
                    "achieved_jp": 0,
                    "in_progress_jp": 0,
                    "remaining_jp": target_jp,
                    "completion_pct": 0,
                    "projected_pct": 0,
                    "status_code": "LOGIN_REQUIRED",
                    "status_label": "Masuk SSO Diperlukan",
                    "status_badge_theme": "amber",
                    "year": current_year,
                    "user_name": name,
                    "weekly_plan": [],
                    "needed_weeks": 10,
                    "recommended_courses": []
                },
                "suggested_questions": [
                    "Bagaimana cara login dengan SSO Setjen DPD RI?",
                    "Rekomendasi kursus populer",
                    "Apa itu LMS Setjen DPD RI?"
                ],
                "actions": [
                    {"label": "🔐 Masuk Akun SSO", "url": "/login/", "type": "route"},
                    {"label": "🔍 Katalog Kursus Pemenuhan JP", "url": "/search/", "type": "route"}
                ]
            }

        user = api_models.User.objects.filter(id=user_ctx["user_id"]).first()
        enrollments = api_models.EnrolledCourse.objects.filter(user=user).select_related('course') if user else []

        completed_courses = []
        active_courses = []
        enrolled_course_ids = set()
        achieved_jp = 0
        in_progress_jp = 0

        for enr in enrollments:
            course = enr.course
            enrolled_course_ids.add(course.id)
            course_jp = self._calculate_course_jp(course)

            has_cert = api_models.Certificate.objects.filter(user=user, course=course).exists()
            pct = 0.0
            try:
                pct = round(enr.completion_percentage(), 1)
            except Exception:
                pct = 0.0

            if has_cert or pct >= 100:
                achieved_jp += course_jp
                completed_courses.append({
                    "id": course.id,
                    "title": course.title,
                    "jp": course_jp,
                    "level": getattr(course, "level", "Umum"),
                    "date": enr.date.strftime("%d %b %Y") if enr.date else ""
                })
            else:
                in_progress_jp += course_jp
                active_courses.append({
                    "id": course.id,
                    "title": course.title,
                    "jp": course_jp,
                    "level": getattr(course, "level", "Umum"),
                    "progress": pct,
                    "enrollment_id": enr.enrollment_id
                })

        remaining_jp = max(0, target_jp - achieved_jp)
        completion_pct = min(100.0, round((achieved_jp / target_jp) * 100, 1))
        projected_pct = min(100.0, round(((achieved_jp + in_progress_jp) / target_jp) * 100, 1))

        # Penentuan status level
        if achieved_jp >= target_jp:
            status_code = "COMPLETED"
            status_label = "Target 20 JP Terpenuhi! 🏆"
            status_badge_theme = "emerald"
        elif achieved_jp + in_progress_jp >= target_jp:
            status_code = "ON_TRACK"
            status_label = "Di Jalur Tepat (On Track) 🚀"
            status_badge_theme = "cyan"
        elif achieved_jp >= 10:
            status_code = "HALF_WAY"
            status_label = "Separuh Tercapai (50%+) ⏳"
            status_badge_theme = "amber"
        else:
            status_code = "NEEDS_BOOST"
            status_label = "Perlu Akselerasi Belajar ⚡"
            status_badge_theme = "orange"

        # AI Weekly Study Schedule (Rencana Belajar Mingguan Cerdas)
        needed_weeks = max(1, math.ceil(remaining_jp / 2)) if remaining_jp > 0 else 0
        weekly_plan = [
            {
                "day": "Rabu",
                "time": "15:30 - 16:15 WIB (1 JP / 45 mnt)",
                "focus": "Fokus modul video atau pembelajaran interaktif SCORM di sela-sela jam tenang tanpa rapat dinas.",
                "tag": "Program Rabuan ASN"
            },
            {
                "day": "Jumat",
                "time": "14:00 - 14:45 WIB (1 JP / 45 mnt)",
                "focus": "Uji pemahaman mandiri, kerjakan kuis evaluasi, dan terbitkan sertifikat digital resmi ber-QR Code.",
                "tag": "Review Akhir Pekan"
            }
        ]

        # Rekomendasi Kursus Pengejar JP (Kursus yang belum diambil oleh pengguna)
        recommended_courses_qs = api_models.Course.objects.filter(
            platform_status="Published"
        ).exclude(id__in=enrolled_course_ids)

        recommended_courses = []
        for rc in recommended_courses_qs[:8]:
            rc_jp = self._calculate_course_jp(rc)
            recommended_courses.append({
                "id": rc.id,
                "title": rc.title,
                "slug": rc.slug,
                "level": getattr(rc, "level", "Umum"),
                "jp": rc_jp,
                "category": rc.category.title if getattr(rc, "category", None) else "Kompetensi ASN"
            })

        # Urutkan agar kursus dengan bobot JP optimal muncul terlebih dahulu
        recommended_courses.sort(key=lambda x: x["jp"], reverse=True)
        recommended_courses = recommended_courses[:3]

        # Susun narasi personalisasi untuk pegawai
        unit_info = f" ({user_ctx.get('organization_unit')})" if user_ctx.get('organization_unit') else ""
        position_info = f" selaku **{user_ctx.get('position')}**" if user_ctx.get('position') else ""

        reply = f"🎯 **Laporan Pemenuhan 20 JP ASN & AI Study Coach (Tahun {current_year})**\n\n"
        reply += f"Yth. Bapak/Ibu **{name}**{position_info}{unit_info},\n\n"

        if status_code == "COMPLETED":
            reply += (
                f"🎉 **Selamat! Target minimal tahunan 20 JP Anda telah TERPENUHI ({achieved_jp}/{target_jp} JP - {completion_pct}%).**\n\n"
                f"Anda telah mengumpulkan total **{achieved_jp} JP** dari {len(completed_courses)} kursus bersertifikat resmi. "
                "Capaian ini menjadi portofolio kompetensi yang sangat berharga dalam mendukung sasaran kinerja pegawai (SKP) di Setjen DPD RI.\n\n"
                "💡 Anda tetap dapat mengambil kursus pengayaan (*masterclass / elective courses*) di bawah untuk terus mengasah spesialisasi keahlian."
            )
        elif status_code == "ON_TRACK":
            reply += (
                f"🚀 **Kabar Baik! Anda berada di jalur yang sangat tepat (On Track).**\n\n"
                f"• **JP Terverifikasi Selesai:** **{achieved_jp} JP** ({completion_pct}%)\n"
                f"• **JP Sedang Dipelajari:** **+{in_progress_jp} JP** (Potensi Proyeksi: **{projected_pct}%**)\n"
                f"• **Kekurangan Kebutuhan:** **{remaining_jp} JP lagi**\n\n"
                f"Jika Anda menyelesaikan kursus aktif Anda saat ini, target 20 JP tahunan Anda akan otomatis terpenuhi! "
                f"Manta AI merekomendasikan komitmen 45 menit pada hari Rabu & Jumat untuk segera menuntaskannya."
            )
        else:
            reply += (
                f"📊 **Ringkasan Capaian Jam Pelajaran (JP) Anda:**\n\n"
                f"• **JP Terselesaikan:** **{achieved_jp}** dari target 20 JP ({completion_pct}%)\n"
                f"• **JP Sedang Berjalan:** **+{in_progress_jp} JP** di kursus aktif\n"
                f"• **Kekurangan Target:** **{remaining_jp} JP lagi**\n\n"
                f"💡 **AI Study Coach Recommendation:**\n"
                f"Untuk menuntaskan sisa **{remaining_jp} JP** dengan santai dan tanpa mengganggu rutinitas dinas, "
                f"Manta AI telah menyusun rencana belajar **2 sesi per minggu** (masing-masing 45 menit / 1 JP). "
                f"Dengan ritme ini, target Anda diproyeksikan tuntas dalam **{needed_weeks} minggu ke depan**!"
            )

        actions = [
            {"label": "📚 Buka Kursus Saya", "url": "/student/courses/", "type": "route"},
            {"label": "🔍 Katalog Kursus Pengejar JP", "url": "/search/", "type": "route"}
        ]
        if user_ctx.get("certificates_count", 0) > 0:
            actions.append({
                "label": f"📜 Bukti Sertifikat ({user_ctx['certificates_count']})",
                "url": "/student/sertifikat/",
                "type": "route"
            })

        return {
            "status": "success",
            "reply": reply,
            "source": "asn_jp_tracker",
            "jp_tracker": {
                "target_jp": target_jp,
                "achieved_jp": achieved_jp,
                "in_progress_jp": in_progress_jp,
                "remaining_jp": remaining_jp,
                "completion_pct": completion_pct,
                "projected_pct": projected_pct,
                "status_code": status_code,
                "status_label": status_label,
                "status_badge_theme": status_badge_theme,
                "year": current_year,
                "user_name": name,
                "organization_unit": user_ctx.get("organization_unit"),
                "position": user_ctx.get("position"),
                "completed_courses": completed_courses,
                "active_courses": active_courses,
                "weekly_plan": weekly_plan,
                "needed_weeks": needed_weeks,
                "recommended_courses": recommended_courses
            },
            "suggested_questions": [
                "Bagaimana cara unduh sertifikat setelah selesai?",
                "Rekomendasi kursus sesuai unit kerja saya",
                "Latihan kuis materi kursus saya"
            ],
            "actions": actions
        }

    def _handle_learning_journey_badges(self, user_ctx: Dict[str, Any], norm_query: str) -> Dict[str, Any]:
        """
        AI Learning Journey Milestone Badges & Gamifikasi Progres Belajar:
        Menghitung level dan XP ASN Setjen DPD RI, menghitung streak hari belajar aktif,
        mengevaluasi status 8 Lencana Prestasi (unlocked vs locked), dan menghasilkan
        kartu gamifikasi interaktif lengkap dengan perayaan milestone (confetti).
        """
        name = user_ctx.get("name") or "Rekan ASN"

        # Tamu / Belum login
        if not user_ctx.get("is_authenticated"):
            guest_gamification = get_user_gamification_data(None)
            guest_gamification["user_name"] = name
            return {
                "status": "success",
                "reply": (
                    f"🏆 **Sistem Gamifikasi & Lencana Prestasi Belajar ASN Setjen DPD RI:**\n\n"
                    "LMS Setjen DPD RI dilengkapi sistem gamifikasi terintegrasi untuk mengapresiasi setiap capaian belajar Anda:\n\n"
                    "• **Level Kompetensi ASN:** Dari *Aparatur Pratama* (Level 1) hingga *Pakar Reformasi Birokrasi* (Level 6).\n"
                    "• **Study Streak:** Penghitungan konsistensi hari belajar tanpa putus.\n"
                    "• **Lencana Prestasi (Milestone Badges):** 8 lencana eksklusif untuk pencapaian materi perdana, evaluasi kuis 100%, kelulusan kursus, dan pemenuhan 20 JP ASN.\n\n"
                    "👉 **Silakan masuk menggunakan akun SSO Setjen DPD RI** untuk melihat lencana yang sudah Anda raih dan melacak progres kenaikan level Anda!"
                ),
                "source": "learning_milestone_badges",
                "milestone_gamification": guest_gamification,
                "actions": [
                    {"label": "🔐 Masuk Akun SSO", "url": "/login/", "type": "route"},
                    {"label": "🔍 Jelajahi Kursus", "url": "/search/", "type": "route"}
                ],
                "suggested_questions": [
                    "Bagaimana cara login dengan SSO Setjen DPD RI?",
                    "Rekomendasi kursus populer",
                    "Apa itu 20 JP ASN?"
                ]
            }

        user = api_models.User.objects.filter(id=user_ctx["user_id"]).first()
        if not user:
            return None

        gamification = get_user_gamification_data(user)
        level = gamification["level"]
        level_name = gamification["level_name"]
        points = gamification["xp"]
        next_level_xp = gamification["next_level_xp"]
        next_level_name = gamification["next_level_name"]
        remaining_xp = gamification["remaining_xp"]
        streak_days = gamification["streak_days"]
        badges = gamification["badges"]
        unlocked_count = gamification["unlocked_count"]

        # Pesan Manta yang memotivasi dan personal
        reply_lines = [
            f"Selamat datang di Galeri Prestasi Belajar, Bapak/Ibu **{name}**! 🎖️\n",
            f"Saat ini Anda berada di **Level {level}: {level_name}** dengan akumulasi **{points:,} XP**.",
        ]
        if level < 6:
            reply_lines.append(f"Tersisa **{remaining_xp:,} XP** lagi untuk naik ke tingkat *{next_level_name}*.")
        else:
            reply_lines.append("Luar biasa! Anda telah mencapai tingkat kompetensi tertinggi (*Pakar Reformasi Birokrasi*) di portal LMS Setjen DPD RI.")

        if streak_days > 0:
            reply_lines.append(f"\n🔥 **Study Streak:** Anda telah aktif belajar **{streak_days} hari beruntun**! Pertahankan konsistensi ini.")
        else:
            reply_lines.append("\n💡 **Tips Manta:** Selesaikan 1 materi hari ini untuk memulai rekor hari beruntun (*Study Streak*) Anda!")

        reply_lines.append(f"\n🏆 **Koleksi Lencana:** **{unlocked_count} dari {len(badges)}** lencana telah berhasil Anda raih. Jelajahi detail kartu di bawah:")

        return {
            "status": "success",
            "reply": "\n".join(reply_lines),
            "source": "learning_milestone_badges",
            "milestone_gamification": gamification,
            "actions": [
                {"label": "🎯 Cek Target 20 JP", "query": "Bagaimana status pemenuhan 20 JP saya?", "type": "query"},
                {"label": "🧠 Latihan Kuis Mandiri", "query": "Beri saya latihan kuis dan uji pemahaman", "type": "query"},
                {"label": "📚 Kursus Saya", "url": "/student/courses/", "type": "route"}
            ],
            "suggested_questions": [
                "Bagaimana cara menaikkan level ASN saya?",
                "Beri saya latihan kuis untuk menambah poin",
                "Bagaimana status pemenuhan 20 JP saya?",
                "Rekomendasi kursus populer"
            ]
        }

    def _get_learning_media_info(self, variant_item: Any) -> Dict[str, Any]:
        """
        Mengidentifikasi jenis media pembelajaran di LMS Setjen DPD RI:
        - video: MP4, WebM, streaming video
        - presentation: PPT, PPTX, Google Slides
        - document: PDF, DOCX, naskah kajian
        - audio: MP3, WAV, podcast pembelajaran
        - scorm: SCORM 1.2, H5P modul interaktif
        - general: Materi umum
        """
        if not variant_item:
            return {
                "media_type": "general",
                "label": "Materi Pembelajaran",
                "icon": "fas fa-book-open",
                "action_verb": "Buka Materi",
                "is_playable_media": False
            }

        # Cek SCORM / H5P
        if getattr(variant_item, 'learning_module_id', None) or getattr(variant_item, 'item_type', None) in ['scorm', 'h5p']:
            return {
                "media_type": "scorm",
                "label": "Modul Interaktif SCORM / H5P",
                "icon": "fas fa-cube",
                "action_verb": "Buka Modul Interaktif",
                "is_playable_media": False
            }

        file_val = str(getattr(variant_item, 'file', '') or '').lower()

        # Cek Video
        video_exts = ['.mp4', '.webm', '.avi', '.mov', '.mkv']
        if any(file_val.endswith(ext) or ext in file_val for ext in video_exts) or 'youtube.com' in file_val or 'youtu.be' in file_val:
            return {
                "media_type": "video",
                "label": "Video Pembelajaran",
                "icon": "fas fa-play-circle",
                "action_verb": "Tonton Video",
                "is_playable_media": True
            }

        # Cek Audio
        audio_exts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac']
        if any(file_val.endswith(ext) or ext in file_val for ext in audio_exts):
            return {
                "media_type": "audio",
                "label": "Audio Pembelajaran / Podcast",
                "icon": "fas fa-headphones",
                "action_verb": "Dengarkan Audio",
                "is_playable_media": True
            }

        # Cek Presentasi PPT / PPTX / Google Slides
        ppt_exts = ['.ppt', '.pptx', '.odp']
        if any(file_val.endswith(ext) or ext in file_val for ext in ppt_exts) or 'docs.google.com/presentation' in file_val:
            return {
                "media_type": "presentation",
                "label": "Paparan Presentasi (PPT/PPTX)",
                "icon": "fas fa-file-powerpoint",
                "action_verb": "Buka Paparan Slide",
                "is_playable_media": False
            }

        # Cek Dokumen PDF / Word
        doc_exts = ['.pdf', '.doc', '.docx', '.odt', '.txt']
        if any(file_val.endswith(ext) or ext in file_val for ext in doc_exts) or 'docs.google.com/document' in file_val:
            return {
                "media_type": "document",
                "label": "Dokumen / Naskah PDF",
                "icon": "fas fa-file-pdf",
                "action_verb": "Buka Dokumen PDF",
                "is_playable_media": False
            }

        return {
            "media_type": "general",
            "label": "Materi Pembelajaran",
            "icon": "fas fa-book-open",
            "action_verb": "Buka Materi",
            "is_playable_media": False
        }

    def _check_lesson_lock_status(self, user: Any, course: Any, target_item: Any) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Memeriksa apakah materi/lesson dalam kursus masih terkunci (locked)
        berdasarkan aturan sequential progression LMS Setjen DPD RI:
        1. Pre-test wajib diselesaikan (jika kursus memiliki Pre-test).
        2. Materi/kuis sebelumnya dalam kurikulum wajib dituntaskan (CompletedLesson / QuizAttempt passed).
        """
        if not user or not course or not target_item:
            return False, "", None

        # 1. Cek Pre-test
        pre_test = api_models.Quiz.objects.filter(course=course, quiz_type='pre_post_test').first()
        if not pre_test and getattr(course, 'parent_course', None):
            pre_test = api_models.Quiz.objects.filter(course=course.parent_course, quiz_type='pre_post_test').first()

        if pre_test:
            has_pretest_done = api_models.QuizAttempt.objects.filter(user=user, quiz=pre_test, attempt_type='pre_test').exists()
            if not has_pretest_done:
                return True, "Selesaikan Pre-test terlebih dahulu untuk membuka kurikulum pembelajaran.", {
                    "type": "pretest",
                    "title": "Pre-test Kursus",
                    "variant_item_id": None
                }

        # 2. Urutkan seluruh item kurikulum dalam kursus
        curriculum_items = list(api_models.VariantItem.objects.filter(
            variant__course=course
        ).select_related('variant', 'quiz').order_by('variant__id', 'order', 'id'))

        if not curriculum_items and getattr(course, 'parent_course', None):
            curriculum_items = list(api_models.VariantItem.objects.filter(
                variant__course=course.parent_course
            ).select_related('variant', 'quiz').order_by('variant__id', 'order', 'id'))

        target_idx = -1
        for idx, item in enumerate(curriculum_items):
            if item.variant_item_id == target_item.variant_item_id or item.id == target_item.id:
                target_idx = idx
                break

        # Jika materi pertama (idx 0), otomatis terbuka
        if target_idx <= 0:
            return False, "", None

        # Cek seluruh materi/kuis sebelumnya
        for p_idx in range(target_idx):
            prev_item = curriculum_items[p_idx]
            if prev_item.item_type == 'quiz' or getattr(prev_item, 'quiz_id', None):
                quiz_obj = prev_item.quiz
                if quiz_obj:
                    is_quiz_passed = api_models.QuizAttempt.objects.filter(user=user, quiz=quiz_obj, is_passed=True).exists()
                    if not is_quiz_passed:
                        return True, f'Luluskan kuis "{prev_item.title}" terlebih dahulu.', {
                            "type": "quiz",
                            "title": prev_item.title,
                            "variant_item_id": prev_item.variant_item_id
                        }
            else:
                is_lesson_done = api_models.CompletedLesson.objects.filter(
                    user=user,
                    variant_item__variant_item_id=prev_item.variant_item_id
                ).exists()
                if not is_lesson_done:
                    return True, f'Selesaikan pembelajaran "{prev_item.title}" terlebih dahulu.', {
                        "type": "lesson",
                        "title": prev_item.title,
                        "variant_item_id": prev_item.variant_item_id
                    }

        return False, "", None

    def _handle_video_timestamp_jumper(
        self,
        raw_message: str,
        norm_query: str,
        user_ctx: Dict[str, Any],
        current_course: Any
    ) -> Dict[str, Any]:
        """
        AI Contextual Learning Navigator & Milestone Jumper:
        Membantu siswa menemukan letak topik/pembahasan spesifik dalam berbagai bentuk materi
        (Video, Paparan Presentasi PPTX/PPT, Dokumen PDF, Audio, atau Modul SCORM),
        mengevaluasi status kuncian kurikulum (sequential locking), dan menyediakan tombol aksi langsung
        yang aman dan selaras dengan progres belajar pengguna.
        """
        import re

        user = api_models.User.objects.filter(id=user_ctx.get("user_id")).first() if user_ctx.get("is_authenticated") else None

        # 1. Resolusi Target Kursus & Penyelarasan Versi Draft vs Published
        target_course = current_course
        if not target_course:
            # Deteksi apakah query merujuk pada topik/kursus tertentu
            if any(k in norm_query for k in ["design", "thinking", "empathize", "emphatize", "elemen", "art"]):
                target_course = api_models.Course.objects.filter(
                    platform_status="Published",
                    title__icontains="Design Thinking"
                ).order_by('-id').first()

        if not target_course and user:
            # Ambil dari kursus terdaftar pengguna yang memiliki materi
            for enr in api_models.EnrolledCourse.objects.filter(user=user).select_related('course').order_by('-date'):
                if api_models.VariantItem.objects.filter(variant__course=enr.course, item_type='lesson').exists():
                    target_course = enr.course
                    break

        if not target_course:
            target_course = api_models.Course.objects.filter(
                platform_status="Published",
                title__icontains="Design Thinking"
            ).order_by('-id').first() or api_models.Course.objects.filter(platform_status="Published").order_by('-id').first()

        if not target_course:
            return None

        # 2. Resolusi Enrollment: Hubungkan relasi draft/parent dan published copy
        related_course_ids = [target_course.id]
        if getattr(target_course, 'parent_course_id', None):
            related_course_ids.append(target_course.parent_course_id)
        child_ids = list(api_models.Course.objects.filter(parent_course=target_course).values_list('id', flat=True))
        related_course_ids.extend(child_ids)

        enrollment_id = None
        user_enrolled_course = None
        if user:
            user_enr = api_models.EnrolledCourse.objects.filter(user=user, course_id__in=related_course_ids).first()
            if user_enr:
                user_enrolled_course = user_enr.course
                enrollment_id = user_enr.enrollment_id
                target_course = user_enrolled_course

        # 3. Ambil seluruh materi kurikulum dalam kursus target (atau parent jika copy kosong)
        all_lessons = api_models.VariantItem.objects.filter(
            variant__course=target_course,
            item_type='lesson'
        ).select_related('variant').order_by('variant__id', 'order', 'id')

        if not all_lessons.exists() and getattr(target_course, 'parent_course', None):
            all_lessons = api_models.VariantItem.objects.filter(
                variant__course=target_course.parent_course,
                item_type='lesson'
            ).select_related('variant').order_by('variant__id', 'order', 'id')

        if not all_lessons.exists():
            return None

        # 4. Cari lesson yang paling sesuai dengan topik yang ditanyakan user
        matched_lesson = None
        highest_score = 0
        for lsn in all_lessons:
            score = 0
            lsn_title_norm = lsn.title.lower()
            for word in lsn_title_norm.split():
                if len(word) > 2 and word in norm_query:
                    score += 3
            if "empathize" in norm_query and ("emphatize" in lsn_title_norm or "empathize" in lsn_title_norm):
                score += 15
            elif ("desain" in norm_query or "art" in norm_query) and "art" in lsn_title_norm:
                score += 15
            elif "elemen" in norm_query and "elemen" in lsn_title_norm:
                score += 15
            elif "pengenalan" in norm_query and "pengenalan" in lsn_title_norm:
                score += 15

            if score > highest_score:
                highest_score = score
                matched_lesson = lsn

        if not matched_lesson:
            matched_lesson = all_lessons.first()

        # 5. Identifikasi jenis media pembelajaran (Video, Audio, PPTX, PDF, SCORM)
        media_info = self._get_learning_media_info(matched_lesson)

        # 6. Evaluasi Status Kuncian Kurikulum (Sequential Locking Integrity)
        is_locked = False
        lock_reason = ""
        prereq_info = None
        if user:
            is_locked, lock_reason, prereq_info = self._check_lesson_lock_status(user, target_course, matched_lesson)

        # 7. Deteksi Timestamp / Menit (untuk media playable: Video & Audio)
        requested_seconds = None
        time_match = re.search(r"\b(\d{1,2}):(\d{2})\b", raw_message)
        if time_match:
            requested_seconds = int(time_match.group(1)) * 60 + int(time_match.group(2))
        else:
            min_match = re.search(r"\bmenit\s*(ke\s*)?(\d+)\b", norm_query)
            if min_match:
                requested_seconds = int(min_match.group(2)) * 60
            else:
                sec_match = re.search(r"\bdetik\s*(ke\s*)?(\d+)\b", norm_query)
                if sec_match:
                    requested_seconds = int(sec_match.group(2))

        # 8. Milestones Tematik Berbasis Topik Modul (bekerja pada semua versi kursus)
        CURATED_TOPIC_MILESTONES = {
            "pengenalan": [
                {"seconds": 0, "label": "00:00", "title": "Pengenalan Paradigma Design Thinking"},
                {"seconds": 30, "label": "00:30", "title": "Urgensi ASN Inovatif & Birokrasi Adaptif"},
                {"seconds": 65, "label": "01:05", "title": "5 Tahapan Kunci Design Thinking (Empathize s/d Test)"}
            ],
            "elemen": [
                {"seconds": 0, "label": "00:00", "title": "3 Pilar Inti: Human-Centered, Kolaboratif, Iteratif"},
                {"seconds": 25, "label": "00:25", "title": "Mengapa Kolaborasi Lintas Unit Diperlukan"},
                {"seconds": 45, "label": "00:45", "title": "Menghilangkan Asumsi & Bias Birokrasi"}
            ],
            "art": [
                {"seconds": 0, "label": "00:00", "title": "Perbedaan Mendasar Seni vs Desain Solutif"},
                {"seconds": 45, "label": "00:45", "title": "Desain Berorientasi Pemecahan Masalah Publik"},
                {"seconds": 90, "label": "01:30", "title": "Menyelaraskan Estetika dan Efektivitas Regulasi"},
                {"seconds": 130, "label": "02:10", "title": "Penerapan pada Tata Kelola Parlemen DPD RI"}
            ],
            "emphatize": [
                {"seconds": 0, "label": "00:00", "title": "Pengantar Tahap Empathize (Mendengar Suara Publik)"},
                {"seconds": 35, "label": "00:35", "title": "Memahami Sudut Pandang Pengguna Layanan DPD RI"},
                {"seconds": 75, "label": "01:15", "title": "Teknik Wawancara & Observasi Langsung ASN"},
                {"seconds": 110, "label": "01:50", "title": "Sintesis Temuan Empati ke Problem Statement"}
            ]
        }

        total_seconds = 120
        if getattr(matched_lesson, 'duration', None):
            try:
                total_seconds = int(matched_lesson.duration.total_seconds())
            except Exception:
                total_seconds = 120

        matched_title_lower = matched_lesson.title.lower()
        milestones = None
        for key, ms_list in CURATED_TOPIC_MILESTONES.items():
            if key in matched_title_lower:
                milestones = ms_list
                break

        if not milestones:
            s1 = 0
            s2 = max(10, int(total_seconds * 0.35))
            s3 = max(20, int(total_seconds * 0.70))
            def fmt(s):
                m = s // 60
                sec = s % 60
                return f"{m:02d}:{sec:02d}"
            milestones = [
                {"seconds": s1, "label": fmt(s1), "title": f"Pengantar & Konsep Pokok {matched_lesson.title}"},
                {"seconds": s2, "label": fmt(s2), "title": "Pembahasan Inti & Teori Utama"},
                {"seconds": s3, "label": fmt(s3), "title": "Studi Kasus & Penerapan di Setjen DPD RI"}
            ]

        # Tentukan target detik dan milestone aktif
        if requested_seconds is not None:
            target_seconds = min(total_seconds, max(0, requested_seconds))
            active_milestone = milestones[0]
            for ms in milestones:
                if ms["seconds"] <= target_seconds:
                    active_milestone = ms
        else:
            active_milestone = milestones[0]
            for ms in milestones:
                ms_title_norm = ms["title"].lower()
                for token in norm_query.split():
                    if len(token) > 3 and token in ms_title_norm:
                        active_milestone = ms
                        break
            target_seconds = active_milestone["seconds"]

        target_minutes = target_seconds // 60
        target_secs_rem = target_seconds % 60
        timestamp_label = f"{target_minutes:02d}:{target_secs_rem:02d}"

        # URL Ruang Belajar Mahasiswa
        player_url = f"/student/courses/{enrollment_id}/" if enrollment_id else f"/course-detail/{target_course.slug}/"

        # 9. Susun Narasi Respon & Tombol Aksi Cerdas
        actions = []

        if is_locked:
            reply = (
                f"🔒 **Materi Pembelajaran Masih Terkunci:**\n\n"
                f"Topik yang Anda tanyakan berada pada modul **{matched_lesson.title}** ({media_info['label']}) "
                f"di pelatihan *{target_course.title}*.\n\n"
                f"Namun, kurikulum LMS Setjen DPD RI menerapkan prinsip **pembelajaran berurutan (*sequential progression*)** "
                f"untuk memastikan pemahaman menyeluruh sebelum melangkah ke bab berikutnya.\n\n"
                f"⚠️ **Prasyarat yang Perlu Diselesaikan Terlebih Dahulu:**\n"
                f"• {lock_reason}\n\n"
                f"👉 Silakan selesaikan pembelajaran/kuis prasyarat tersebut terlebih dahulu agar materi ini otomatis terbuka dan dapat diakses."
            )
            if enrollment_id:
                actions.append({
                    "label": f"🔓 Buka Pembelajaran Prasyarat ↗",
                    "url": f"/student/courses/{enrollment_id}/",
                    "type": "route"
                })
            else:
                actions.append({
                    "label": "📚 Buka Kursus Saya",
                    "url": "/student/courses/",
                    "type": "route"
                })
        else:
            # Kondisi materi sudah terbuka (unlocked)
            if media_info["is_playable_media"]:
                # Media Video / Audio
                reply = (
                    f"🎬 **AI {media_info['label']} Milestone & Timestamp Jumper:**\n\n"
                    f"Materi yang Anda tanyakan berada pada {media_info['label'].lower()} **{matched_lesson.title}** "
                    f"(Pelatihan *{target_course.title}*).\n\n"
                    f"📌 **Poin Pembahasan Terkait:**\n"
                    f"• **Topik:** {active_milestone['title']}\n"
                    f"• **Posisi Pembahasan:** Menit **{timestamp_label}**\n\n"
                    f"👉 Klik tombol **{media_info['action_verb']} di Menit {timestamp_label}** di bawah untuk langsung menuju detik pembahasan tersebut!"
                )
                actions.append({
                    "label": f"▶️ {media_info['action_verb']} di Menit {timestamp_label}",
                    "action": "jump_to_video",
                    "seconds": target_seconds,
                    "variant_item_id": matched_lesson.variant_item_id,
                    "milestone_title": active_milestone["title"],
                    "course_slug": target_course.slug,
                    "enrollment_id": enrollment_id,
                    "timestamp_label": timestamp_label,
                    "media_type": media_info["media_type"],
                    "type": "video_jump"
                })
            else:
                # Media Non-Playable (PPT/PPTX, Dokumen PDF, Modul SCORM)
                reply = (
                    f"📚 **AI Learning Navigator ({media_info['label']}):**\n\n"
                    f"Materi yang Anda tanyakan dibahas pada modul **{matched_lesson.title}** "
                    f"dalam format **{media_info['label']}** (Pelatihan *{target_course.title}*).\n\n"
                    f"📌 **Detail Materi:**\n"
                    f"• **Tipe Media:** {media_info['label']}\n"
                    f"• **Topik Pokok:** {active_milestone['title']}\n\n"
                    f"👉 Klik tombol **{media_info['action_verb']}** di bawah untuk langsung membuka materi ini di Ruang Belajar!"
                )
                actions.append({
                    "label": f"📖 {media_info['action_verb']} ↗",
                    "action": "jump_to_video",
                    "seconds": 0,
                    "variant_item_id": matched_lesson.variant_item_id,
                    "milestone_title": active_milestone["title"],
                    "course_slug": target_course.slug,
                    "enrollment_id": enrollment_id,
                    "timestamp_label": "Awal Modul",
                    "media_type": media_info["media_type"],
                    "type": "video_jump"
                })

            if enrollment_id:
                actions.append({
                    "label": "📖 Buka Ruang Belajar Kursus",
                    "url": player_url,
                    "type": "route"
                })
            else:
                actions.append({
                    "label": "🔍 Silabus & Info Kursus",
                    "url": f"/course-detail/{target_course.slug}/",
                    "type": "route"
                })

        return {
            "status": "success",
            "reply": reply,
            "source": "video_timestamp_jumper",
            "video_jumper": {
                "course_id": target_course.id,
                "course_title": target_course.title,
                "course_slug": target_course.slug,
                "enrollment_id": enrollment_id,
                "lesson_id": matched_lesson.id,
                "variant_item_id": matched_lesson.variant_item_id,
                "lesson_title": matched_lesson.title,
                "target_seconds": target_seconds,
                "timestamp_label": timestamp_label,
                "milestone_title": active_milestone["title"],
                "milestones": milestones if media_info["is_playable_media"] else [],
                "player_url": player_url,
                "media_type": media_info["media_type"],
                "media_label": media_info["label"],
                "media_icon": media_info["icon"],
                "action_verb": media_info["action_verb"],
                "is_locked": is_locked,
                "lock_reason": lock_reason,
                "prerequisite": prereq_info
            },
            "suggested_questions": [
                "Bagaimana cara menyelesaikan kursus ini?",
                "Rangkum materi ini ke catatan belajar",
                "Latihan kuis materi kursus saya"
            ],
            "actions": actions
        }

    def _find_best_knowledge_match(self, raw_message: str, norm_query: str) -> Tuple[Dict[str, Any], int]:
        """Menghitung skor kesesuaian antara pertanyaan pengguna dengan basis pengetahuan."""
        best_match = None
        highest_score = 0
        query_tokens = set(norm_query.split())

        for rule in KNOWLEDGE_BASE:
            score = 0
            
            # Cek Regex Match (Bobot tinggi: +5 poin)
            if re.search(rule["regex"], norm_query, re.IGNORECASE):
                score += 5

            # Cek Kemunculan Kata Kunci
            for kw in rule["keywords"]:
                # Cocokkan kata utuh menggunakan word boundary agar kata pendek tidak salah mencocokkan potongan kata (mis. 'ok' dalam 'birokrasi')
                if re.search(rf"\b{re.escape(kw)}\b", norm_query):
                    score += 4
                else:
                    kw_tokens = set(kw.split())
                    matched_tokens = query_tokens.intersection(kw_tokens)
                    if len(matched_tokens) >= 2 and (len(matched_tokens) / len(kw_tokens)) >= 0.5:
                        score += len(matched_tokens) * 2

            if score > highest_score:
                highest_score = score
                best_match = rule

        return best_match, highest_score

    def _search_courses_response(self, raw_message: str, norm_query: str, user_ctx: Dict[str, Any]) -> Dict[str, Any]:
        """Mencari kursus aktif di database LMS secara instan dan efisien."""
        try:
            stop_words = {"kursus", "materi", "pelatihan", "kelas", "rekomendasi", "cari", "ada", "apa", "saja", "yang", "di", "lms", "tentang", "minta", "tolong"}
            tokens = [t for t in norm_query.split() if t not in stop_words and len(t) > 2]
            
            qs = api_models.Course.objects.filter(platform_status="Published")
            
            if tokens:
                q_filters = Q()
                for token in tokens:
                    q_filters |= Q(title__icontains=token) | Q(description__icontains=token)
                matched_courses = qs.filter(q_filters)[:4]
            else:
                matched_courses = qs.order_by("-id")[:4]

            if not matched_courses.exists():
                matched_courses = qs.order_by("-id")[:3]

            course_list = []
            for c in matched_courses:
                course_list.append({
                    "id": c.id,
                    "title": c.title,
                    "slug": c.slug,
                    "category": c.category.title if c.category else "Umum",
                    "level": getattr(c, "level", "Semua Tingkat")
                })

            if tokens and matched_courses.exists():
                reply = (
                    f"Berikut adalah beberapa kursus di **LMS Setjen DPD RI** yang sesuai dengan pencarian Anda "
                    f"(*{', '.join(tokens)}*):\n\n"
                )
            else:
                reply = (
                    "Berikut adalah beberapa pelatihan aktif pilihan di **LMS Setjen DPD RI** yang siap Anda ikuti:\n\n"
                )

            for i, c in enumerate(course_list, 1):
                reply += f"{i}. **{c['title']}** (Kategori: {c['category']})\n"

            reply += "\nAnda dapat langsung mengklik kartu kursus di bawah ini untuk melihat silabus lengkapnya!"

            actions = [
                {"label": "🔍 Semua Kursus di Katalog", "url": "/search/", "type": "route"}
            ]
            if user_ctx["is_authenticated"]:
                actions.append({
                    "label": "📚 Kursus Saya",
                    "url": "/student/courses/",
                    "type": "route"
                })

            return {
                "status": "success",
                "reply": reply,
                "source": "database_search",
                "suggested_questions": [
                    "Bagaimana cara mendaftar kursus?",
                    "Cara unduh sertifikat setelah lulus",
                    "Apa itu LMS Setjen DPD RI?"
                ],
                "actions": actions,
                "recommended_courses": course_list
            }
        except Exception as e:
            logger.warning(f"AI Assistant course search error: {e}")
            return None

    def _get_featured_courses(self) -> List[Dict[str, Any]]:
        """Mengambil kursus unggulan secara cepat dan ringan."""
        try:
            courses = api_models.Course.objects.filter(
                platform_status="Published"
            ).order_by("-id")[:3]
            
            return [
                {
                    "id": c.id,
                    "title": c.title,
                    "slug": c.slug,
                    "category": c.category.title if c.category else "Umum"
                }
                for c in courses
            ]
        except Exception:
            return []

    def _call_gemini_api(self, message: str, history: List[Dict[str, Any]], api_key: str, user_ctx: Dict[str, Any], current_course: Any = None, matched_lessons_context: List[Dict[str, Any]] = None) -> str:
        """Panggilan ke Google Gemini API dengan prompt terpersonalisasi, peka konteks kursus, dan silabus aktual."""
        try:
            user_name = user_ctx.get("name", "Rekan Pembelajar")
            auth_status = "Pengguna Terdaftar / Login" if user_ctx.get("is_authenticated") else "Tamu / Belum Login"
            enrolled_info = f"{user_ctx.get('enrolled_count', 0)} kursus terdaftar"
            cert_info = f"{user_ctx.get('certificates_count', 0)} sertifikat diperoleh"
            latest = user_ctx.get("latest_course")
            latest_info = f"Kursus aktif terakhir: {latest['title']} ({latest['progress']}%)" if latest else "Belum ada kursus aktif"

            course_context_str = ""
            if current_course:
                teacher_disp = getattr(current_course.teacher, "full_name", None) or getattr(current_course.teacher, "name", "Instruktur")
                cat_disp = current_course.category.title if current_course.category else "Kompetensi Umum"
                course_context_str = (
                    f"\n- Halaman Kursus Yang Sedang Dibuka Pengguna:\n"
                    f"  Judul: {current_course.title}\n"
                    f"  Kategori: {cat_disp}\n"
                    f"  Instruktur: {teacher_disp}\n"
                    f"  Tingkat: {current_course.level}\n"
                )

            syllabus_context_str = ""
            if matched_lessons_context:
                syllabus_context_str = "\n- Modul & Materi Terkait di Database LMS:\n" + "\n".join([
                    f"  * Modul '{item['title']}' di Bab '{item['chapter']}' (Pelatihan: '{item['course_title']}')"
                    for item in matched_lessons_context[:4]
                ])

            system_instruction = (
                "Anda adalah Manta, maskot resmi sekaligus Asisten AI Virtual LMS Sekretariat Jenderal "
                "Dewan Perwakilan Daerah Republik Indonesia (Setjen DPD RI). Jawablah pertanyaan pengguna "
                "dengan ramah, cerdas, solutif, dan rapi dalam Bahasa Indonesia yang santun.\n\n"
                f"Konteks Pengguna Saat Ini:\n"
                f"- Nama: {user_name}\n"
                f"- Status Akun: {auth_status}\n"
                f"- Riwayat: {enrolled_info}, {cert_info}\n"
                f"- {latest_info}"
                f"{course_context_str}"
                f"{syllabus_context_str}\n\n"
                "Pedoman Balasan:\n"
                "- Sapalah pengguna dengan hormat (misalnya 'Bapak/Ibu ' diikuti nama jika pengguna terdaftar).\n"
                "- Gunakan Markdown tebal (**teks**), poin bernomor/bullet, dan emoji yang relevan.\n"
                "- Jika pengguna bertanya tentang 'kursus ini', materi, bab, atau silabus, manfaatkan informasi di atas secara akurat dan faktual.\n"
                "- Selalu berorientasi mendukung peningkatan kompetensi aparatur di lingkungan Setjen DPD RI."
            )

            models_to_try = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.1-flash-lite"]
            
            contents = []
            for h in (history or [])[-4:]:
                role = "user" if h.get("role") == "user" else "model"
                text = h.get("content", "").strip()
                if text:
                    contents.append({"role": role, "parts": [{"text": text}]})

            contents.append({
                "role": "user",
                "parts": [{"text": f"Instruksi Sistem: {system_instruction}\n\nPertanyaan Pengguna: {message}"}]
            })

            payload = {
                "contents": contents,
                "generationConfig": {
                    "temperature": 0.6,
                    "maxOutputTokens": 650
                }
            }

            for model_name in models_to_try:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
                    resp = requests.post(url, json=payload, timeout=12.0)
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if candidates and "content" in candidates[0]:
                            parts = candidates[0]["content"].get("parts", [])
                            if parts and "text" in parts[0]:
                                return parts[0]["text"].strip()
                    else:
                        logger.info(f"Gemini model {model_name} returned {resp.status_code}: {resp.text[:150]}")
                except Exception as inner_e:
                    logger.warning(f"Gemini model {model_name} call error: {inner_e}")
                    continue
        except Exception as e:
            logger.info(f"Gemini API fallback skipped: {e}")
        return None


def get_user_learning_nudge(user: Any) -> Dict[str, Any]:
    """Menghitung dan menghasilkan pengingat belajar cerdas (Smart Learning Nudge) untuk pengguna."""
    if not user:
        return {
            "has_nudge": False,
            "nudge_type": "guest",
            "bubble_text": "Halo! Saya Manta 👋 Ada yang bisa Manta bantu hari ini?",
            "title": "Selamat Datang di LMS Setjen DPD RI",
            "message": "Silakan masuk menggunakan akun SSO Setjen DPD RI untuk melacak progres belajar dan sertifikat resmi Anda.",
            "action_label": "🔐 Masuk SSO",
            "action_url": "/login/",
            "progress": 0,
            "remaining_lessons": 0,
            "course_title": "",
            "enrollment_id": None
        }

    display_name = user.full_name or user.first_name or user.username or "Rekan ASN"
    enrollments = api_models.EnrolledCourse.objects.filter(user=user).select_related('course').order_by('-date')

    if not enrollments.exists():
        return {
            "has_nudge": True,
            "nudge_type": "no_courses",
            "bubble_text": f"Halo Bapak/Ibu {display_name} 👋 Belum ada kursus aktif. Mari jelajahi katalog pelatihan!",
            "title": "Mulai Perjalanan Belajar Anda",
            "message": f"Bapak/Ibu {display_name}, Anda saat ini belum terdaftar pada pelatihan manapun. Jelajahi katalog kursus untuk memilih pelatihan resmi Setjen DPD RI.",
            "action_label": "🔍 Jelajahi Katalog Kursus",
            "action_url": "/search/",
            "progress": 0,
            "remaining_lessons": 0,
            "course_title": "",
            "enrollment_id": None
        }

    in_progress_enr = None
    not_started_enr = None
    all_completed = True

    for enr in enrollments:
        try:
            pct = round(enr.completion_percentage(), 1)
        except Exception:
            pct = 0.0

        if pct < 100:
            all_completed = False

        if 0 < pct < 100 and not in_progress_enr:
            in_progress_enr = (enr, pct)
        elif pct == 0 and not not_started_enr:
            not_started_enr = (enr, pct)

    if in_progress_enr:
        enr, pct = in_progress_enr
        course = enr.course
        total_lessons = api_models.VariantItem.objects.filter(variant__course=course).count()
        completed_lessons = api_models.CompletedLesson.objects.filter(user=user, course=course).count()
        remaining = max(0, total_lessons - completed_lessons)

        remaining_str = f"Tersisa {remaining} materi lagi" if remaining > 0 else "Sedikit lagi"
        course_short = course.title[:24] + "..." if len(course.title) > 24 else course.title
        bubble_text = f"Halo Bapak/Ibu {display_name} 👋 Kursus '{course_short}' sudah {pct}%. {remaining_str} untuk sertifikat!"

        return {
            "has_nudge": True,
            "nudge_type": "in_progress",
            "bubble_text": bubble_text,
            "title": "Lanjutkan Pelatihan Aktif",
            "course_title": course.title,
            "course_slug": course.slug,
            "enrollment_id": enr.enrollment_id,
            "progress": pct,
            "remaining_lessons": remaining,
            "total_lessons": total_lessons,
            "action_label": f"▶️ Lanjut Belajar ({pct}%)",
            "action_url": f"/student/courses/{enr.enrollment_id}/"
        }

    if not_started_enr:
        enr, pct = not_started_enr
        course = enr.course
        total_lessons = api_models.VariantItem.objects.filter(variant__course=course).count()
        course_short = course.title[:24] + "..." if len(course.title) > 24 else course.title
        bubble_text = f"Halo Bapak/Ibu {display_name} 👋 Anda terdaftar di '{course_short}'. Siap mulai materi pertama?"

        return {
            "has_nudge": True,
            "nudge_type": "not_started",
            "bubble_text": bubble_text,
            "title": "Mulai Modul Pembelajaran Pertama",
            "course_title": course.title,
            "course_slug": course.slug,
            "enrollment_id": enr.enrollment_id,
            "progress": 0,
            "remaining_lessons": total_lessons,
            "total_lessons": total_lessons,
            "action_label": "▶️ Mulai Belajar Sekarang",
            "action_url": f"/student/courses/{enr.enrollment_id}/"
        }

    if all_completed:
        cert_count = api_models.Certificate.objects.filter(user=user).count()
        cert_info = f" ({cert_count} sertifikat diperoleh)" if cert_count > 0 else ""
        bubble_text = f"Luar biasa, Bapak/Ibu {display_name}! 🎉 Seluruh kursus Anda telah selesai 100%{cert_info}."

        return {
            "has_nudge": True,
            "nudge_type": "all_completed",
            "bubble_text": bubble_text,
            "title": "Selamat! Seluruh Pelatihan Tuntas 100%",
            "course_title": "",
            "course_slug": "",
            "enrollment_id": None,
            "progress": 100,
            "remaining_lessons": 0,
            "total_lessons": 0,
            "action_label": "📜 Unduh Sertifikat" if cert_count > 0 else "🔍 Cari Pelatihan Baru",
            "action_url": "/student/sertifikat/" if cert_count > 0 else "/search/"
        }

    return {
        "has_nudge": False,
        "nudge_type": "default",
        "bubble_text": f"Halo Bapak/Ibu {display_name}! 👋 Ada topik pelatihan yang ingin dipelajari hari ini?",
        "title": "Asisten Pembelajaran LMS Setjen DPD RI",
        "action_label": "🔍 Jelajahi Katalog",
        "action_url": "/search/",
        "progress": 0,
        "remaining_lessons": 0,
        "course_title": "",
        "enrollment_id": None
    }


class AILearningNudgeAPIView(APIView):
    """
    Endpoint untuk mengambil pengingat belajar proaktif pengguna (Smart Learning Nudge):
    GET /api/v1/ai/nudge/?user_id=...
    POST /api/v1/ai/nudge/
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        user = None
        if request.user and request.user.is_authenticated:
            user = request.user
        else:
            uid = request.GET.get("user_id")
            if uid:
                try:
                    user = api_models.User.objects.filter(id=uid).first()
                except Exception:
                    user = None

        nudge_data = get_user_learning_nudge(user)
        return Response({"status": "success", "nudge": nudge_data})


def sync_manta_proactive_notifications(user: Any) -> int:
    """
    Menghasilkan notifikasi proaktif cerdas Manta AI (Smart Notification Digest & Learning Nudge)
    secara otomatis dan santun untuk aparatur sipil negara di lingkungan Setjen DPD RI:
    1. AI Learning Nudge: Pengingat kelanjutan pelatihan yang sedang aktif berjalan.
    2. AI JP Target Reminder: Pengingat target 20 JP ASN tahunan.
    3. AI Microlearning Digest: Wawasan 1 menit seputar inovasi birokrasi, tata tertib parlemen, dan nilai BerAKHLAK.
    4. AI Flashcard Challenge: Latihan mandiri konsep kunci.
    
    Dilengkapi mekanisme rate-limiting pintar (maksimal 1 notifikasi AI baru per 6 jam)
    agar tidak mengganggu atau membanjiri peserta.
    """
    if not user or not user.is_authenticated:
        return 0

    try:
        now = timezone.now()
        # Periksa notifikasi AI terakhir untuk user ini dalam 6 jam terakhir
        recent_ai_notif = api_models.Notification.objects.filter(
            user=user,
            type__startswith="AI ",
            date__gte=now - timezone.timedelta(hours=6)
        ).first()

        if recent_ai_notif:
            return 0

        # Ambil kursus aktif yang belum selesai (< 100%)
        enrollments = api_models.EnrolledCourse.objects.filter(user=user).select_related('course').order_by('-date')
        
        in_progress_enr = None
        for enr in enrollments:
            try:
                pct = enr.completion_percentage()
                if 0 < pct < 100:
                    in_progress_enr = (enr, pct)
                    break
            except Exception:
                continue

        # 1. Prioritas Utama: Kursus Aktif Berjalan (Learning Nudge)
        if in_progress_enr:
            enr, pct = in_progress_enr
            course = enr.course
            total_lessons = api_models.VariantItem.objects.filter(variant__course=course).count()
            completed_lessons = api_models.CompletedLesson.objects.filter(user=user, course=course).count()
            remaining = max(0, total_lessons - completed_lessons)

            existing_unread = api_models.Notification.objects.filter(
                user=user,
                course=course,
                type="AI Learning Nudge",
                seen=False
            ).exists()

            if not existing_unread:
                api_models.Notification.objects.create(
                    user=user,
                    course=course,
                    type="AI Learning Nudge",
                    title=f"💡 Manta Nudge: Lanjutkan Pelatihan '{course.title[:35]}...' ({round(pct)}%)",
                    message=(
                        f"Progres belajar Anda pada '{course.title}' sudah mencapai {round(pct)}%. "
                        f"Tersisa {remaining} materi lagi untuk menuntaskan evaluasi dan menerbitkan sertifikat resmi Anda. "
                        f"Mari luangkan 10 menit untuk melanjutkan!"
                    ),
                    seen=False,
                    date=now
                )
                return 1

        # 2. Prioritas Kedua: Pemenuhan Target 20 JP ASN Tahunan
        completed_enrollments = [e for e in enrollments if getattr(e, 'completed', False) or (hasattr(e, 'completion_percentage') and e.completion_percentage() >= 100)]
        total_jp = 0
        for ce in completed_enrollments:
            c = ce.course
            dur_secs = 0
            lectures = api_models.VariantItem.objects.filter(variant__course=c)
            for vi in lectures:
                if getattr(vi, 'duration', None):
                    dur_secs += vi.duration.total_seconds()
                elif getattr(vi, 'duration_seconds', None):
                    dur_secs += vi.duration_seconds
            course_jp = max(2, min(12, round((dur_secs / 60.0) / 45.0))) if dur_secs > 0 else 2
            total_jp += course_jp

        if total_jp < 20:
            existing_jp_notif = api_models.Notification.objects.filter(
                user=user,
                type="AI JP Target Reminder",
                seen=False
            ).exists()

            if not existing_jp_notif:
                remaining_jp = 20 - total_jp
                rec_course = api_models.Course.objects.filter(platform_status="Published").exclude(
                    id__in=[e.course_id for e in enrollments]
                ).first()

                api_models.Notification.objects.create(
                    user=user,
                    course=rec_course,
                    type="AI JP Target Reminder",
                    title=f"🎯 Target 20 JP ASN: Masih perlu {remaining_jp} JP lagi tahun ini",
                    message=(
                        f"Akumulasi pengembangan kompetensi Anda saat ini adalah {total_jp}/20 JP. "
                        f"Sesuai UU ASN, setiap aparatur diimbau memenuhi minimal 20 JP/tahun. "
                        f"Konsultasikan rencana belajar Anda dengan Manta AI untuk memilih pelatihan yang tepat!"
                    ),
                    seen=False,
                    date=now
                )
                return 1

        # 3. Prioritas Ketiga: Microlearning Digest of the Day
        microlearning_pool = [
            {
                "topic": "Tiga Lensa Inovasi Birokrasi (Three Lenses)",
                "summary": "Inovasi pelayanan publik yang berdampak harus berada di titik iris Desirability (diinginkan pengguna), Feasibility (layak teknis), dan Viability (berkelanjutan secara hukum & anggaran)."
            },
            {
                "topic": "Prinsip Nilai Adaptif ASN BerAKHLAK",
                "summary": "Aparatur adaptif cepat menyesuaikan diri menghadapi transformasi digital, proaktif berinovasi, dan tidak resistan terhadap pembaruan sistem administrasi parlemen."
            },
            {
                "topic": "Kuorum Sah Sidang Paripurna DPD RI",
                "summary": "Berdasarkan Tata Tertib DPD RI, keputusan sidang paripurna sah jika dihadiri oleh lebih dari 1/2 jumlah Anggota DPD RI yang mewakili lebih dari 1/2 jumlah provinsi di Indonesia."
            },
            {
                "topic": "Urgensi Naskah Akademik RUU Inisiatif",
                "summary": "Naskah Akademik menyajikan kajian ilmiah landasan filosofis, sosiologis, dan yuridis yang memperkuat argumentasi substansi pasal-pasal RUU inisiatif DPD RI."
            }
        ]

        digest_item = random.choice(microlearning_pool)
        existing_digest = api_models.Notification.objects.filter(
            user=user,
            type="AI Microlearning Digest",
            seen=False
        ).exists()

        if not existing_digest:
            api_models.Notification.objects.create(
                user=user,
                type="AI Microlearning Digest",
                title=f"💡 Wawasan 1 Menit Manta: {digest_item['topic']}",
                message=f"{digest_item['summary']} Klik 'Tanya Manta' untuk mendiskusikan implementasinya di unit kerja Anda.",
                seen=False,
                date=now
            )
            return 1

    except Exception as e:
        logger.warning(f"Error syncing Manta proactive notifications: {e}")
        return 0

    return 0


class AIMantaNotificationsSyncAPIView(APIView):
    """
    Endpoint sinkronisasi notifikasi cerdas Manta AI:
    POST /api/v1/ai/notifications/sync/
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        user = None
        if request.user and request.user.is_authenticated:
            user = request.user
        else:
            uid = request.data.get("user_id")
            if uid:
                try:
                    user = api_models.User.objects.filter(id=uid).first()
                except Exception:
                    user = None

        if not user:
            return Response({"status": "error", "message": "User tidak ditemukan"}, status=status.HTTP_400_BAD_REQUEST)

        created_count = sync_manta_proactive_notifications(user)
        return Response({"status": "success", "created_count": created_count})


class AIAssistantSuggestionsAPIView(APIView):
    """
    Endpoint untuk mengambil saran pertanyaan dan metadata asisten:
    GET /api/v1/ai/suggestions/
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        pathname = request.GET.get("pathname", "")
        user = None
        if request.user and request.user.is_authenticated:
            user = request.user
        else:
            uid = request.GET.get("user_id")
            if uid:
                try:
                    user = api_models.User.objects.filter(id=uid).first()
                except Exception:
                    user = None
        
        quick_prompts = [
            {
                "label": "🧠 Latihan Kuis Mandiri",
                "query": "Beri saya latihan kuis dan uji pemahaman materi"
            },
            {
                "label": "📑 Rangkuman Materi",
                "query": "Rangkumkan poin penting dari materi pelatihan Design Thinking"
            },
            {
                "label": "🏛️ Apa itu LMS DPD RI?",
                "query": "Apa itu LMSetjen DPD RI?"
            },
            {
                "label": "🚀 Panduan Belajar",
                "query": "Bagaimana cara saya memulai untuk belajar?"
            },
            {
                "label": "⏰ Pengingat Belajar",
                "query": "Apa pengingat belajar saya hari ini?"
            },
            {
                "label": "📚 Progres Kursus Saya",
                "query": "Bagaimana progres kursus saya saat ini?"
            },
            {
                "label": "📜 Unduh Sertifikat",
                "query": "Bagaimana cara mendapatkan dan mengunduh sertifikat pelatihan?"
            },
            {
                "label": "⚡ Kendala SCORM/Video",
                "query": "Video atau modul SCORM macet, apa solusinya?"
            },
            {
                "label": "🔐 Login SSO DPD",
                "query": "Bagaimana cara masuk menggunakan SSO Setjen DPD RI?"
            }
        ]

        if "/course-detail/" in pathname:
            quick_prompts = [
                {"label": "📑 Rangkum Materi Kursus", "query": "Rangkumkan poin penting dan key takeaways materi ini"},
                {"label": "🧠 Latihan Kuis Kursus Ini", "query": "Beri saya latihan kuis simulasi dari materi kursus ini"},
                {"label": "📖 Silabus & Bab Kursus", "query": "Jelaskan ringkasan materi, silabus bab, dan modul di kursus ini"},
                {"label": "🔍 Materi yang Dipelajari", "query": "Modul dan materi apa saja yang ada di kursus ini?"},
                {"label": "📝 Syarat & Evaluasi", "query": "Bagaimana evaluasi kuis dan syarat kelulusan kursus ini?"},
                {"label": "📜 Sertifikat Kelulusan", "query": "Apakah kursus ini menerbitkan sertifikat digital resmi?"}
            ]
        elif "/student/sertifikat/" in pathname:
            quick_prompts = [
                {"label": "📜 Sertifikat Saya", "query": "Berapa banyak sertifikat yang sudah saya miliki?"},
                {"label": "🔍 Verifikasi QR Code", "query": "Bagaimana cara memverifikasi keaslian QR Code sertifikat?"},
                {"label": "📥 Syarat Terbit Sertifikat", "query": "Apa syarat agar sertifikat kelulusan otomatis terbit?"},
                {"label": "📚 Lanjut Belajar", "query": "Lihat progres kursus saya"}
            ]
        elif "/student/courses/" in pathname:
            quick_prompts = [
                {"label": "⏰ Pengingat Belajar", "query": "Apa pengingat belajar saya hari ini?"},
                {"label": "📊 Progres Belajar Saya", "query": "Bagaimana progres kursus saya saat ini?"},
                {"label": "▶️ Lanjut Kursus Tertunda", "query": "Kursus apa yang belum saya selesaikan?"},
                {"label": "⚡ Modul SCORM Macet", "query": "Video atau modul SCORM macet, apa solusinya?"},
                {"label": "📜 Cek Sertifikat", "query": "Bagaimana cara unduh sertifikat setelah selesai?"}
            ]
        elif "/search/" in pathname:
            quick_prompts = [
                {"label": "💡 Cari Modul Inovatif", "query": "Modul mana yang membahas design thinking?"},
                {"label": "🏛️ Pelatihan Keparlemenan", "query": "Cari kursus keparlemenan Setjen DPD RI"},
                {"label": "🌟 Kursus Terpopuler", "query": "Rekomendasikan kursus paling populer di LMS"},
                {"label": "🚀 Cara Mendaftar", "query": "Bagaimana cara mendaftar kursus di katalog?"}
            ]

        # Personalisasi quick prompt berdasarkan Unit Kerja & Jabatan ASN Setjen DPD RI
        user_unit_name = None
        user_pos_name = None
        if user:
            try:
                prof = getattr(user, 'profile', None)
                if prof:
                    if getattr(prof, 'organization_unit', None):
                        user_unit_name = getattr(prof.organization_unit, 'name', None) or str(prof.organization_unit)
                    if getattr(prof, 'position', None):
                        user_pos_name = getattr(prof.position, 'name', None) or str(prof.position)
            except Exception:
                pass

        if user_pos_name or user_unit_name:
            label_text = "🎯 Pelatihan Sesuai Jabatan"
            if user_unit_name:
                short_unit = user_unit_name.replace("Subbagian", "Subbag").replace("Sekretariat", "Sekr")
                if len(short_unit) > 22:
                    short_unit = short_unit[:20] + ".."
                label_text = f"🎯 Rekomendasi: {short_unit}"

            quick_prompts.insert(0, {
                "label": label_text,
                "query": "Rekomendasi pelatihan yang sesuai dengan unit kerja dan jabatan saya"
            })
        else:
            quick_prompts.insert(1, {
                "label": "🎯 Rekomendasi Unit Kerja",
                "query": "Rekomendasi pelatihan yang sesuai dengan unit kerja di Setjen DPD RI"
            })

        data = {
            "assistant_name": "Manta",
            "assistant_title": "Asisten Virtual LMS Setjen DPD RI",
            "quick_prompts": quick_prompts,
            "learning_nudge": get_user_learning_nudge(user)
        }
        return Response(data)


class AIAssistantSaveNoteAPIView(APIView):
    """
    Menyimpan Rangkuman Materi Manta AI langsung ke Catatan Belajar Pengguna:
    POST /api/v1/ai/notes/save/
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        user = None
        if request.user and request.user.is_authenticated:
            user = request.user
        else:
            uid = request.data.get("user_id")
            if uid:
                try:
                    user = api_models.User.objects.filter(id=uid).first()
                except Exception:
                    user = None

        if not user:
            return Response(
                {"status": "error", "message": "Harap masuk (login) terlebih dahulu untuk menyimpan catatan pembelajaran."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        course_id = request.data.get("course_id")
        course_slug = request.data.get("course_slug")
        title = (request.data.get("title") or "Rangkuman Materi Manta AI").strip()
        content = (request.data.get("content") or "").strip()
        raw_color = request.data.get("color")
        color = "#0d9488" if (not raw_color or raw_color == "emerald") else raw_color

        if not content:
            return Response(
                {"status": "error", "message": "Konten rangkuman tidak boleh kosong."},
                status=status.HTTP_400_BAD_REQUEST
            )

        course = None
        if course_id:
            try:
                course = api_models.Course.objects.filter(id=course_id).first()
            except Exception:
                course = None
        if not course and course_slug:
            try:
                course = api_models.Course.objects.filter(slug=course_slug).first()
            except Exception:
                course = None

        # Cek apakah user memiliki EnrolledCourse untuk course ini, atau course dengan judul serupa
        enrollment = None
        if course:
            enrollment = api_models.EnrolledCourse.objects.filter(user=user, course=course).first()
            if not enrollment:
                # Cek apakah ada enrollment dengan judul yang sama (misal duplikat instance Course)
                alt_enr = api_models.EnrolledCourse.objects.filter(user=user, course__title__iexact=course.title).first()
                if alt_enr:
                    enrollment = alt_enr
                    course = alt_enr.course
        else:
            # Ambil enrollment terbaru jika course tidak spesifik
            enrollment = api_models.EnrolledCourse.objects.filter(user=user).order_by("-id").first()
            if enrollment:
                course = enrollment.course

        enrollment_id = enrollment.enrollment_id if enrollment else None
        note_url = f"/student/courses/{enrollment_id}/" if enrollment_id else (f"/course-detail/{course.slug}/" if course else "/student/courses/")

        note_unique_id = f"manta_{uuid.uuid4().hex[:8]}"

        try:
            note = api_models.Note.objects.create(
                user=user,
                course=course,
                title=title[:100],
                note=content,
                color=color,
                note_id=note_unique_id
            )
            created_date_str = note.date.strftime("%d %b %Y, %H:%M WIB") if hasattr(note, 'date') and note.date else "Baru saja"
            return Response({
                "status": "success",
                "message": "Rangkuman materi berhasil disimpan ke Catatan Belajar Anda! 🎉",
                "note": {
                    "id": note.id,
                    "note_id": note.note_id,
                    "title": note.title,
                    "course_title": course.title if course else "Umum",
                    "enrollment_id": enrollment_id,
                    "note_url": note_url,
                    "content": note.note,
                    "date": created_date_str
                }
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"Error saving Manta AI note: {e}", exc_info=True)
            return Response(
                {"status": "error", "message": f"Gagal menyimpan catatan: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AIMantaMilestonesAPIView(APIView):
    """
    Endpoint untuk mengambil ringkasan gamifikasi & lencana milestone belajar ASN:
    GET /api/v1/ai/milestones/
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        user = None
        if request.user and request.user.is_authenticated:
            user = request.user
        else:
            uid = request.GET.get("user_id")
            if uid:
                try:
                    user = api_models.User.objects.filter(id=uid).first()
                except Exception:
                    user = None

        user_ctx = {
            "is_authenticated": bool(user and user.is_authenticated),
            "user_id": user.id if user else None,
            "name": (user.full_name or user.username) if user else "Tamu",
            "organization_unit": getattr(user, "organization_unit", None) if user else None,
            "position": getattr(user, "position", None) if user else None,
        }

        chat_helper = AIAssistantChatAPIView()
        badges_data = chat_helper._handle_learning_journey_badges(user_ctx, "lencana saya")
        return Response(badges_data)
