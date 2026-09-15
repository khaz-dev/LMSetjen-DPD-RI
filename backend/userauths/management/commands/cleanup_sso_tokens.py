from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from userauths.models import UsedSSOToken
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Membersihkan UsedSSOToken yang usianya lebih dari 24 jam'

    def handle(self, *args, **kwargs):
        # Tentukan batas waktu (24 jam yang lalu dari sekarang)
        threshold_time = timezone.now() - timedelta(days=1)
        
        try:
            # Cari dan hapus token yang lebih lama dari threshold_time
            old_tokens = UsedSSOToken.objects.filter(used_at__lt=threshold_time)
            deleted_count, _ = old_tokens.delete()
            
            success_msg = f'Berhasil menghapus {deleted_count} token SSO lama.'
            self.stdout.write(self.style.SUCCESS(success_msg))
            logger.info(success_msg)
            
        except Exception as e:
            error_msg = f'Gagal menghapus token SSO lama: {str(e)}'
            self.stdout.write(self.style.ERROR(error_msg))
            logger.error(error_msg)