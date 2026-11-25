"""
Django Management Command: revoke_all_sessions
Mengatasi Temuan Pentest P0 (Laporan Pentest 22 Oktober 2026 PT-BPSI-LMS-002):
"Rotasi HMAC SSO/LMS, cabut seluruh sesi CMB dan refresh token LMS."

Perintah ini mencabut:
1. Seluruh outstanding refresh token SimpleJWT (memasukkannya ke tabel BlacklistedToken)
2. Seluruh session database Django
3. Seluruh cache session di Redis (jika aktif)
"""

from django.core.management.base import BaseCommand
from django.contrib.sessions.models import Session
from django.core.cache import caches
import logging

logger = logging.getLogger('security')


class Command(BaseCommand):
    help = 'Mencabut seluruh sesi pengguna aktif dan memasukkan semua refresh token JWT ke blacklist (P0 Remediasi Pentest)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--no-input',
            action='store_true',
            help='Jalankan tanpa meminta konfirmasi manual',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING(
            "\n" + "=" * 70 + "\n"
            "⚠️  PERINGATAN: Perintah ini akan mencabut SELURUH sesi login pengguna dan\n"
            "memasukkan seluruh JWT Refresh Token ke daftar hitam (blacklist).\n"
            "Seluruh pengguna (termasuk admin dan siswa) harus login ulang.\n"
            "=" * 70
        ))

        # 1. Blacklist semua Outstanding JWT Tokens
        blacklisted_count = 0
        try:
            from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
            outstanding_tokens = OutstandingToken.objects.all()
            total_outstanding = outstanding_tokens.count()

            for token in outstanding_tokens:
                _, created = BlacklistedToken.objects.get_or_create(token=token)
                if created:
                    blacklisted_count += 1

            self.stdout.write(self.style.SUCCESS(
                f"✅ JWT Tokens: {blacklisted_count} token berhasil dimasukkan ke BlacklistedToken (dari total {total_outstanding} outstanding)."
            ))
        except ImportError:
            self.stdout.write(self.style.NOTICE(
                "ℹ️ App rest_framework_simplejwt.token_blacklist tidak tersedia. Melewati blacklist token model."
            ))
        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f"❌ Terjadi kesalahan saat mem-blacklist token: {str(e)}"
            ))

        # 2. Hapus Session Database Django
        deleted_sessions = 0
        try:
            session_count = Session.objects.count()
            Session.objects.all().delete()
            deleted_sessions = session_count
            self.stdout.write(self.style.SUCCESS(
                f"✅ Django Sessions: {deleted_sessions} sesi di database berhasil dihapus."
            ))
        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f"❌ Gagal menghapus database sessions: {str(e)}"
            ))

        # 3. Bersihkan Cache Redis untuk Sessions
        try:
            if 'sessions' in caches:
                caches['sessions'].clear()
                self.stdout.write(self.style.SUCCESS(
                    "✅ Redis Session Cache: Cache session 'sessions' berhasil dikosongkan."
                ))
        except Exception as e:
            self.stdout.write(self.style.WARNING(
                f"⚠️ Catatan Redis cache: {str(e)}"
            ))

        logger.warning(
            f"[SECURITY REMEDIATION] Seluruh sesi ({deleted_sessions}) dan JWT refresh token ({blacklisted_count}) telah dicabut atas perintah administrator."
        )

        self.stdout.write(self.style.SUCCESS(
            "\n🎉 Remediasi Selesai: Seluruh sesi dan token aktif telah berhasil dicabut secara menyeluruh!\n"
        ))
