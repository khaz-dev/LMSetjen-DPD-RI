"""
Admin Access Control Middleware
Mengatasi Temuan Pentest T-01 (PT-BPSI-LMS-002):
"Katalog API /api/v1/ dan Django admin dapat diakses tanpa batasan IP
/admin/login/ 200 tanpa allowlist. Rekomendasi: Batasi /admin/ ke VPN / allowlist IP."

Middleware ini memeriksa IP klien yang mencoba mengakses endpoint /admin/.
Jika IP klien tidak termasuk dalam ADMIN_ALLOWED_IPS yang dikonfigurasi,
permintaan akan ditolak dengan HTTP 403 Forbidden.
"""

import ipaddress
import logging
from django.conf import settings
from django.http import HttpResponseForbidden

try:
    from api.throttling import get_real_client_ip
except ImportError:
    def get_real_client_ip(request):
        return request.META.get('REMOTE_ADDR')

logger = logging.getLogger('security')


class AdminAccessControlMiddleware:
    """
    Membatasi akses rute /admin/ hanya untuk IP/CIDR yang terdaftar di ADMIN_ALLOWED_IPS.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path_info

        # Hanya periksa rute yang diawali dengan /admin/
        if path.startswith('/admin/'):
            allowed_ips_config = getattr(settings, 'ADMIN_ALLOWED_IPS', None)

            # Jika ADMIN_ALLOWED_IPS dikonfigurasi dan tidak kosong
            if allowed_ips_config:
                client_ip = get_real_client_ip(request)
                if not self._is_ip_allowed(client_ip, allowed_ips_config):
                    logger.warning(
                        f"[SECURITY ALERT] Akses ke panel admin ditolak untuk IP '{client_ip}' "
                        f"pada path '{path}'. IP tidak terdaftar dalam ADMIN_ALLOWED_IPS."
                    )
                    return HttpResponseForbidden(
                        "<h1>403 Forbidden</h1>"
                        "<p>Akses ke panel administrasi dibatasi hanya untuk jaringan internal / VPN resmi Setjen DPD RI.</p>",
                        content_type="text/html"
                    )

        return self.get_response(request)

    def _is_ip_allowed(self, client_ip, allowed_list):
        """Memeriksa apakah client_ip berada di dalam daftar IP atau subnet CIDR yang diizinkan."""
        if not client_ip:
            return False

        # Selalu izinkan localhost / loopback untuk keperluan server internal
        if client_ip in ('127.0.0.1', 'localhost', '::1'):
            return True

        try:
            client_ip_obj = ipaddress.ip_address(client_ip)
        except ValueError:
            return False

        for entry in allowed_list:
            entry = str(entry).strip()
            if not entry:
                continue
            if entry in ('*', 'all', 'ANY'):
                return True
            try:
                if '/' in entry:
                    network = ipaddress.ip_network(entry, strict=False)
                    if client_ip_obj in network:
                        return True
                else:
                    target_ip = ipaddress.ip_address(entry)
                    if client_ip_obj == target_ip:
                        return True
            except ValueError:
                # Jika format IP/CIDR tidak valid, lewati entri tersebut
                continue

        return False
