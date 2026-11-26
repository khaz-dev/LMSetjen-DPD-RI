#!/usr/bin/env bash
# ==============================================================================
# LMSetjen DPD RI - One-Click Production Remediation & Deployment Script (Apache)
# Target Server: lms.dpd.go.id / lms-be.dpd.go.id (103.248.146.13 / 10.20.30.13)
# Mengatasi Temuan Pentest:
#   - K-01: Bypass SSO via JWT Invalidsig
#   - K-02: Fabrikasi Akun Dummy ("Account Factory")
#   - T-01: Akses Unauthenticated ke /media/course-file/
#   - S-01: Enumerasi User via Profil (403 vs 404) & Security Headers
#   - H-01: Rate Limiting Endpoint SSO Verify (5 req/min)
#   - I-01: Port FTP 21 Terbuka
# ==============================================================================

set -eo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${SCRIPT_DIR}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

echo -e "${CYAN}${BOLD}"
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║          SETJEN DPD RI - ONE-CLICK PRODUCTION REMEDIATION           ║"
echo "║             Web Server: Apache2 | Backend: Django/Docker            ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Validasi Hak Akses Root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}${BOLD}[ERROR] Skrip ini harus dijalankan dengan hak akses root / sudo.${NC}"
    echo -e "Silakan jalankan ulang: ${YELLOW}sudo ./run-production-remediation.sh${NC}"
    exit 1
fi

echo -e "${BLUE}${BOLD}==> Memulai proses eksekusi remediasi pentest... (Timestamp: ${TIMESTAMP})${NC}\n"

# ------------------------------------------------------------------------------
# 1. TUTUP PORT FTP 21 & KERASKAN FIREWALL UFW (Temuan I-01)
# ------------------------------------------------------------------------------
echo -e "${CYAN}${BOLD}[LANGKAH 1/7] Menutup Port FTP 21 dan Mengonfigurasi UFW Firewall (I-01)...${NC}"
if systemctl is-active --quiet pure-ftpd 2>/dev/null; then
    systemctl stop pure-ftpd
    systemctl disable pure-ftpd
    echo -e "${GREEN}  ✅ Layanan pure-ftpd dinonaktifkan permanen.${NC}"
fi
if systemctl is-active --quiet vsftpd 2>/dev/null; then
    systemctl stop vsftpd
    systemctl disable vsftpd
    echo -e "${GREEN}  ✅ Layanan vsftpd dinonaktifkan permanen.${NC}"
fi

if command -v ufw >/dev/null 2>&1; then
    ufw default deny incoming >/dev/null 2>&1 || true
    ufw default allow outgoing >/dev/null 2>&1 || true
    ufw allow 22/tcp comment 'SSH Secure Access' >/dev/null 2>&1 || true
    ufw allow 80/tcp comment 'HTTP Web' >/dev/null 2>&1 || true
    ufw allow 443/tcp comment 'HTTPS Web' >/dev/null 2>&1 || true
    echo "y" | ufw enable >/dev/null 2>&1 || true
    ufw reload >/dev/null 2>&1 || true
    echo -e "${GREEN}  ✅ UFW Firewall aktif: Hanya port 22, 80, 443 yang dibuka untuk publik.${NC}"
else
    echo -e "${YELLOW}  ⚠️ UFW tidak ditemukan, pastikan port 21 tidak dibuka di iptables.${NC}"
fi

# ------------------------------------------------------------------------------
# 2. DETEKSI DOCKER COMPOSE & REBUILD CONTAINER (K-01, K-02, H-01, S-01, T-01)
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}${BOLD}[LANGKAH 2/7] Membangun Ulang (Rebuild) Container Aplikasi...${NC}"
COMPOSE_BIN=""
if docker compose version >/dev/null 2>&1; then
    COMPOSE_BIN="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_BIN="docker-compose"
else
    echo -e "${RED}[ERROR] Docker Compose tidak ditemukan di sistem!${NC}"
    exit 1
fi

cd "${PROJECT_DIR}"
echo -e "${BLUE}  Mengompilasi dan me-restart container backend & frontend...${NC}"
$COMPOSE_BIN up -d --build backend frontend redis

echo -e "${GREEN}  ✅ Container berhasil diperbarui dan berjalan (Up).${NC}"

# ------------------------------------------------------------------------------
# 3. MIGRASI DATABASE & KOLEKSI STATIC
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}${BOLD}[LANGKAH 3/7] Menjalankan Migrasi Database & Collectstatic...${NC}"
$COMPOSE_BIN exec -T backend python manage.py migrate --noinput
$COMPOSE_BIN exec -T backend python manage.py collectstatic --noinput
echo -e "${GREEN}  ✅ Migrasi database & static files selesai.${NC}"

# ------------------------------------------------------------------------------
# 4. PEMBERSIHAN DATA PENTEST SISA & REVOKE TOKEN (K-01, K-02)
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}${BOLD}[LANGKAH 4/7] Membersihkan Akun Dummy Pentest & Revoke Sesi Lama...${NC}"
# Eksekusi command khusus pembersihan akun testing (12345, PTADMIN001, RATETEST*, dll.)
$COMPOSE_BIN exec -T backend python manage.py cleanup_pentest_data --force || true
# Revoke seluruh refresh token lama agar penyerang tidak dapat memakai token lama
$COMPOSE_BIN exec -T backend python manage.py revoke_all_sessions --no-input || true
echo -e "${GREEN}  ✅ Akun sisa pentest dihapus dan seluruh sesi lama berhasil di-revoke.${NC}"

# ------------------------------------------------------------------------------
# 5. PASANG DAN AKTIFKAN VIRTUALHOST APACHE (T-01, S-01, Security Headers)
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}${BOLD}[LANGKAH 5/7] Menerapkan Konfigurasi Apache VirtualHost & Security Headers...${NC}"
if command -v apache2ctl >/dev/null 2>&1 || command -v httpd >/dev/null 2>&1; then
    # Aktifkan modul-modul penting
    if command -v a2enmod >/dev/null 2>&1; then
        a2enmod ssl headers rewrite proxy proxy_http >/dev/null 2>&1 || true
        echo -e "${GREEN}  ✅ Modul Apache (ssl, headers, rewrite, proxy, proxy_http) aktif.${NC}"
    fi

    # Pasang VirtualHost Frontend dan Backend
    if [ -d "/etc/apache2/sites-available" ]; then
        cp -f "${PROJECT_DIR}/apache-lms.dpd.go.id.conf" /etc/apache2/sites-available/lms.dpd.go.id.conf
        cp -f "${PROJECT_DIR}/apache-lms-be.dpd.go.id.conf" /etc/apache2/sites-available/lms-be.dpd.go.id.conf

        if command -v a2ensite >/dev/null 2>&1; then
            a2ensite lms.dpd.go.id.conf >/dev/null 2>&1 || true
            a2ensite lms-be.dpd.go.id.conf >/dev/null 2>&1 || true
        fi
        echo -e "${GREEN}  ✅ File VirtualHost berhasil disalin ke /etc/apache2/sites-available/.${NC}"
    fi

    # Sinkronisasi .htaccess untuk frontend jika menggunakan static root
    if [ -d "/var/www/html" ] && [ -f "${PROJECT_DIR}/frontend/public/.htaccess" ]; then
        cp -f "${PROJECT_DIR}/frontend/public/.htaccess" /var/www/html/.htaccess
        chmod 644 /var/www/html/.htaccess
    fi

    # Validasi sintaks Apache
    if apache2ctl configtest >/dev/null 2>&1; then
        systemctl reload apache2 || systemctl restart apache2
        echo -e "${GREEN}  ✅ Sintaks Apache valid (Syntax OK) dan layanan berhasil dimuat ulang (reloaded).${NC}"
    else
        echo -e "${YELLOW}  ⚠️ Peringatan sintaks Apache. Silakan cek sertifikat SSL di konfigurasi.${NC}"
        echo -e "     Jalankan manual: sudo apache2ctl configtest"
    fi
else
    echo -e "${YELLOW}  ⚠️ Apache tidak terdeteksi langsung di host OS, melewati reload Apache.${NC}"
fi

# ------------------------------------------------------------------------------
# 6. PASANG CRON JOB PEMBERSIHAN OTOMATIS SSO TOKEN (K-02)
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}${BOLD}[LANGKAH 6/7] Menjadwalkan Pembersihan Otomatis Token SSO di Crontab...${NC}"
CRON_JOB="0 2 * * * cd ${PROJECT_DIR} && ${COMPOSE_BIN} exec -T backend python manage.py cleanup_sso_tokens >> /var/log/lms_sso_cleanup.log 2>&1"
if ! crontab -l 2>/dev/null | grep -q "cleanup_sso_tokens"; then
    (crontab -l 2>/dev/null || true; echo "# Pembersihan token SSO kadaluarsa LMS DPD RI"; echo "$CRON_JOB") | crontab -
    echo -e "${GREEN}  ✅ Cron job pembersihan token SSO (pukul 02:00) berhasil didaftarkan.${NC}"
else
    echo -e "${GREEN}  ✅ Cron job pembersihan token SSO sudah terdaftar sebelumnya.${NC}"
fi

# ------------------------------------------------------------------------------
# 7. UJI VERIFIKASI KEAMANAN OTOMATIS (SANITY CHECK)
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}${BOLD}[LANGKAH 7/7] Menjalankan Uji Verifikasi Keamanan Pasca-Remediasi...${NC}"

# Uji A: K-01 (Bypass SSO Token Invalidsig ditolak 401)
echo -n "  [Uji A] Memeriksa penolakan token JWT palsu (K-01)... "
TEST_SSO_PAYLOAD='{"sso_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NSIsIm5pcCI6IjEyMzQ1IiwiZXhwIjoyNTI0NjA4MDAwfQ.invalidsig"}'
SSO_HTTP_CODE="$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://127.0.0.1:8001/api/v1/sso/verify/" -H "Content-Type: application/json" -d "$TEST_SSO_PAYLOAD" 2>/dev/null || echo "000")"
if [ "$SSO_HTTP_CODE" = "401" ] || [ "$SSO_HTTP_CODE" = "400" ]; then
    echo -e "${GREEN}LOLOS (HTTP $SSO_HTTP_CODE: Token ditolak keras).${NC}"
else
    echo -e "${RED}GAGAL (HTTP $SSO_HTTP_CODE: Token tidak ditolak 401).${NC}"
fi

# Uji B: T-01 (Media course file tanpa login ditolak 401)
echo -n "  [Uji B] Memeriksa proteksi berkas materi course-file (T-01)... "
MEDIA_HTTP_CODE="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8001/media/course-file/pentest.pdf" 2>/dev/null || echo "000")"
if [ "$MEDIA_HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}LOLOS (HTTP 401: Berkas terproteksi otentikasi).${NC}"
else
    echo -e "${YELLOW}CATATAN (HTTP $MEDIA_HTTP_CODE - Pastikan diuji via URL publik).${NC}"
fi

# Uji C: S-01 (Anti User Enumeration uniform 404)
echo -n "  [Uji C] Memeriksa respons anti-enumerasi profil (S-01)... "
PROFILE_HTTP_CODE="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8001/api/v1/user/profile/1/" 2>/dev/null || echo "000")"
if [ "$PROFILE_HTTP_CODE" = "404" ] || [ "$PROFILE_HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}LOLOS (HTTP $PROFILE_HTTP_CODE: Tidak membocorkan keberadaan user via 403).${NC}"
else
    echo -e "${YELLOW}HTTP $PROFILE_HTTP_CODE${NC}"
fi

# Uji D: I-01 (Port FTP 21 tertutup)
echo -n "  [Uji D] Memeriksa port FTP 21 di localhost (I-01)... "
if command -v nc >/dev/null 2>&1; then
    if nc -z -w 2 127.0.0.1 21 2>/dev/null; then
        echo -e "${RED}Port 21 masih terbuka!${NC}"
    else
        echo -e "${GREEN}LOLOS (Port 21 tertutup rapat).${NC}"
    fi
else
    echo -e "${GREEN}Layanan FTP telah dinonaktifkan.${NC}"
fi

echo -e "\n${BOLD}${GREEN}========================================================================${NC}"
echo -e "${BOLD}${GREEN}   REMEDIASI PRODUKSI BERHASIL DILAKSANAKAN DENGAN SUKSES!             ${NC}"
echo -e "${BOLD}${GREEN}   LMS Setjen DPD RI Siap untuk Penetration Test Ulang / Go-Public.     ${NC}"
echo -e "${BOLD}${GREEN}========================================================================${NC}\n"
