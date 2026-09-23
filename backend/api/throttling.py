"""
Custom Rate-Limiting & Throttling Classes for LMSetjen DPD RI
Mengatasi Temuan Pentest T-03: Perbaiki Skema Throttling / Rate-Limit

Mencegah bypass rate-limiting menggunakan header X-Forwarded-For palsu / manipulasi spoofing.
Menggunakan library django-ipware untuk mengekstrak IP klien yang sebenarnya.
"""

import logging
import ipaddress
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle, SimpleRateThrottle
from ipware import get_client_ip

logger = logging.getLogger('api')
security_logger = logging.getLogger('security')


def is_private_or_loopback(ip_str):
    """Cek apakah IP adalah private (RFC 1918), loopback, atau link-local."""
    try:
        ip = ipaddress.ip_address(ip_str)
        return (
            ip.is_loopback or 
            ip.is_link_local or
            ip in ipaddress.ip_network('10.0.0.0/8') or
            ip in ipaddress.ip_network('172.16.0.0/12') or
            ip in ipaddress.ip_network('192.168.0.0/16') or
            ip in ipaddress.ip_network('100.64.0.0/10')
        )
    except ValueError:
        return True


def get_real_client_ip(request):
    """
    Ekstrak IP klien yang sebenarnya dengan aman menggunakan django-ipware (Mengatasi Pentest T-03).
    
    1. Mengecek header proxy dengan validasi routable (IP publik).
    2. Mencegah manipulasi header X-Forwarded-For palsu / injeksi IP private dari klien eksternal.
    3. Fallback aman ke REMOTE_ADDR jika header tidak valid.
    """
    remote_addr = request.META.get('REMOTE_ADDR')

    try:
        client_ip, is_routable = get_client_ip(request)
        if client_ip:
            client_ip_str = str(client_ip)
            # Jika IP dari proxy adalah IP publik/routable yang valid, gunakan itu
            if is_routable:
                return client_ip_str

            # Jika IP yang dihasilkan adalah private/unroutable tetapi REMOTE_ADDR adalah IP eksternal publik,
            # berarti klien publik mencoba memalsukan IP internal. Gunakan REMOTE_ADDR asli!
            if remote_addr and not is_private_or_loopback(remote_addr):
                return str(remote_addr)

            return client_ip_str
    except Exception as e:
        logger.warning(f"[Throttling] Error extracting client IP with ipware: {e}")

    # Fallback ke direct REMOTE_ADDR
    if remote_addr:
        return str(remote_addr)

    return '127.0.0.1'


class SecureAnonRateThrottle(AnonRateThrottle):
    """
    Rate throttle untuk anonymous user yang aman dari manipulasi header X-Forwarded-For.
    Menggunakan IP asli klien hasil inspeksi django-ipware.
    """
    scope = 'anon'

    def get_ident(self, request):
        return get_real_client_ip(request)


class SecureUserRateThrottle(UserRateThrottle):
    """
    Rate throttle untuk authenticated user (berdasarkan ID user)
    dengan fallback aman ke IP klien asli hasil inspeksi django-ipware.
    """
    scope = 'user'

    def get_ident(self, request):
        user = getattr(request, 'user', None)
        if user and getattr(user, 'is_authenticated', False):
            return str(user.pk)
        return get_real_client_ip(request)


class SecureBurstRateThrottle(SimpleRateThrottle):
    """
    Throttle untuk mencegah serangan burst / brute force cepat (misal pada login/auth).
    Default scope: burst
    """
    scope = 'burst'

    def get_cache_key(self, request, view):
        user = getattr(request, 'user', None)
        if user and getattr(user, 'is_authenticated', False):
            ident = str(user.pk)
        else:
            ident = get_real_client_ip(request)

        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }
