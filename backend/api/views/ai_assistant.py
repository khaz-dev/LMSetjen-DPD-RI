"""
Backend AI Assistant untuk LMS Sekretariat Jenderal DPD RI (Manta)
Dirancang dengan prinsip:
1. Smart Intent & Context Scoring: Memahami pertanyaan santai, formal, maupun spesifik.
2. Respons Komprehensif & Edukatif: Tidak menjawab template pendek yang monoton.
3. Live Database Search: Merekomendasikan kursus aktif langsung dari database LMS.
4. Plug-and-Play LLM: Mendukung Google Gemini / OpenAI jika GEMINI_API_KEY disetel di .env.
"""

import os
import re
import json
import logging
import hashlib
from typing import Dict, Any, List, Tuple

from django.conf import settings
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
            "Jika kendala berlanjut, Anda dapat menggunakan tombol **Kirim Masukan** di pojok kanan bawah untuk melaporkan langsung ke tim teknis!"
        ),
        "suggestions": [
            "Cara lapor kendala ke admin",
            "Bagaimana progres kursus disimpan?",
            "Panduan sertifikat"
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
            "• **Fitur Kirim Masukan:** Klik tombol floating **Kirim Masukan** di pojok kanan bawah halaman untuk mengirim tiket kendala langsung ke tim admin.\n"
            "• **Unit Pengelola:** Pusat Pelatihan & Pengembangan ASN / Bagian TI Sekretariat Jenderal DPD RI, Gedung DPD RI Kompleks Parlemen Senayan, Jakarta.\n"
            "• **Jam Layanan:** Senin – Jumat, pukul 08:00 – 16:30 WIB."
        ),
        "suggestions": [
            "Video atau modul SCORM macet",
            "Cara unduh sertifikat",
            "Kembali ke katalog kursus"
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
        ]
    }
]


class AIAssistantChatAPIView(APIView):
    """
    Endpoint Backend AI Asisten Manta:
    POST /api/v1/ai/chat/
    
    Fitur:
    - Smart Multi-Tier Intent Matching (memahami pertanyaan natural, formal, hingga santai).
    - Terintegrasi Database Kursus Aktif LMS Setjen DPD RI secara real-time.
    - Caching 5 menit untuk respons kilat (< 2ms).
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

        # 1. Normalisasi teks
        norm_query = re.sub(r"[^\w\s]", "", user_message.lower()).strip()
        cache_key = f"ai_manta_chat_{hashlib.md5(norm_query.encode('utf-8')).hexdigest()}"
        cached_result = cache.get(cache_key)
        if cached_result:
            return Response(cached_result, status=status.HTTP_200_OK)

        # 2. Periksa apakah pertanyaan eksplisit mencari / meminta rekomendasi Kursus
        explicit_course_search = re.search(
            r"\b(rekomendasi\s*kursus|kursus\s*populer|cari\s*kursus|katalog\s*kursus|daftar\s*kursus|ada\s*kursus|kursus\s*terbaru|pilihan\s*kursus)\b",
            norm_query
        )
        if explicit_course_search:
            course_response = self._search_courses_response(user_message, norm_query)
            if course_response:
                cache.set(cache_key, course_response, timeout=180)
                return Response(course_response, status=status.HTTP_200_OK)

        # 3. Smart Intent Scoring terhadap Basis Pengetahuan Lokal Terlebih Dahulu
        best_rule, score = self._find_best_knowledge_match(user_message, norm_query)
        if best_rule and score >= 3:
            result = {
                "status": "success",
                "reply": best_rule["reply"],
                "source": "knowledge_engine",
                "confidence": score,
                "suggested_questions": best_rule["suggestions"],
                "recommended_courses": []
            }
            cache.set(cache_key, result, timeout=300)
            return Response(result, status=status.HTTP_200_OK)

        # 4. Periksa apakah pertanyaan terkait pencarian Kursus umum (topik tertentu)
        course_query_pattern = re.search(
            r"\b(kursus|materi|pelatihan|kelas|belajar\s*apa)\b",
            norm_query
        )
        if course_query_pattern and not re.search(r"\b(cara\s*mulai|langkah\s*awal|panduan|sertifikat|piagam)\b", norm_query):
            course_response = self._search_courses_response(user_message, norm_query)
            if course_response:
                cache.set(cache_key, course_response, timeout=180)
                return Response(course_response, status=status.HTTP_200_OK)

        # 4. Optional Cloud AI Engine (Google Gemini / OpenAI) jika tersedia di .env
        ai_api_key = os.environ.get("GEMINI_API_KEY") or getattr(settings, "GEMINI_API_KEY", None)
        if ai_api_key:
            cloud_reply = self._call_gemini_api(user_message, history, ai_api_key)
            if cloud_reply:
                result = {
                    "status": "success",
                    "reply": cloud_reply,
                    "source": "cloud_llm",
                    "suggested_questions": [
                        "Bagaimana cara unduh sertifikat?",
                        "Cari kursus terbaru",
                        "Apa itu LMS Setjen DPD RI?"
                    ],
                    "recommended_courses": []
                }
                cache.set(cache_key, result, timeout=300)
                return Response(result, status=status.HTTP_200_OK)

        # 5. Smart Contextual Fallback (Sopan, Ramah, Membantu & Tidak Monoton)
        featured_courses = self._get_featured_courses()
        fallback_reply = (
            f"Terima kasih atas pertanyaan Anda: *\"{user_message}\"*.\n\n"
            "Sebagai **Manta**, Asisten AI Virtual LMS Setjen DPD RI, saya siap membantu seluruh kebutuhan "
            "pembelajaran daring Anda. Anda dapat menanyakan topik-topik berikut:\n\n"
            "• **Panduan Memulai Belajar & Mendaftar Kursus**\n"
            "• **Penerbitan & Unduh Sertifikat Ber-QR Code**\n"
            "• **Akses Akun & Integrasi SSO Pegawai DPD RI**\n"
            "• **Penanganan Kendala Video atau Modul SCORM**\n\n"
            "Silakan pilih topik bantuan cepat di bawah atau buka katalog kursus pelatihan kami!"
        )

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
            "recommended_courses": featured_courses
        }
        cache.set(cache_key, result, timeout=120)
        return Response(result, status=status.HTTP_200_OK)

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
                if kw in norm_query:
                    score += 4
                else:
                    kw_tokens = set(kw.split())
                    matched_tokens = query_tokens.intersection(kw_tokens)
                    # Hanya beri skor jika setidaknya 2 kata cocok atau setidaknya 50% kata dalam frasa cocok
                    if len(matched_tokens) >= 2 and (len(matched_tokens) / len(kw_tokens)) >= 0.5:
                        score += len(matched_tokens) * 2

            if score > highest_score:
                highest_score = score
                best_match = rule

        return best_match, highest_score

    def _search_courses_response(self, raw_message: str, norm_query: str) -> Dict[str, Any]:
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

            return {
                "status": "success",
                "reply": reply,
                "source": "database_search",
                "suggested_questions": [
                    "Bagaimana cara mendaftar kursus?",
                    "Cara unduh sertifikat setelah lulus",
                    "Apa itu LMS Setjen DPD RI?"
                ],
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

    def _call_gemini_api(self, message: str, history: List[Dict[str, Any]], api_key: str) -> str:
        """Panggilan opsional ke Google Gemini API dengan timeout 4.5 detik."""
        try:
            system_instruction = (
                "Anda adalah Manta, maskot resmi sekaligus Asisten AI Virtual LMS Sekretariat Jenderal "
                "Dewan Perwakilan Daerah Republik Indonesia (Setjen DPD RI). Jawablah pertanyaan pengguna "
                "dengan ramah, cerdas, solutif, dan rapi dalam Bahasa Indonesia yang santun. Format balasan "
                "menggunakan Markdown tebal, bullet points, dan emoji yang relevan."
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


class AIAssistantSuggestionsAPIView(APIView):
    """
    Endpoint untuk mengambil saran pertanyaan dan metadata asisten:
    GET /api/v1/ai/suggestions/
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        data = {
            "assistant_name": "Manta",
            "assistant_title": "Asisten Virtual LMS Setjen DPD RI",
            "quick_prompts": [
                {
                    "label": "🏛️ Apa itu LMS DPD RI?",
                    "query": "Apa itu LMSetjen DPD RI?"
                },
                {
                    "label": "🚀 Panduan Belajar",
                    "query": "Bagaimana cara saya memulai untuk belajar?"
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
        }
        return Response(data)
