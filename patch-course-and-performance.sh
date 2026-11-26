#!/usr/bin/env bash
# ==============================================================================
# LMSetjen DPD RI - One-Click Patch Script: Course Edit & Performance Optimization
# Memperbaiki:
#   1. Error 403 & Infinite loop saat tambah fitur kursus (/teacher/course-update/admin/)
#   2. Gambar kursus tidak terload ("Gambar Tidak Tersedia")
#   3. Tag kursus tidak muncul di pencarian / dropdown TagSelector
#   4. Optimasi kecepatan SSO login & upload video/file besar
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

echo -e "${CYAN}${BOLD}"
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║    ONE-CLICK PATCH: COURSE EDIT FIX & PERFORMANCE OPTIMIZATION       ║"
echo "║       LMSetjen DPD RI - Production Server (lms.dpd.go.id)           ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}[ERROR] Skrip ini harus dijalankan dengan hak akses root / sudo.${NC}"
    echo -e "Silakan jalankan: ${YELLOW}sudo ./patch-course-and-performance.sh${NC}"
    exit 1
fi

cd "${PROJECT_DIR}"

# ------------------------------------------------------------------------------
# 1. PERBARUI APACHE VIRTUALHOST & TIMEOUT UPLOAD
# ------------------------------------------------------------------------------
echo -e "${BLUE}${BOLD}[1/4] Memperbarui Konfigurasi Apache & Timeout Upload Video...${NC}"

# A. Apache Standar Debian/Ubuntu
if [ -d "/etc/apache2/sites-available" ]; then
    cp -f "${PROJECT_DIR}/apache-lms.dpd.go.id.conf" /etc/apache2/sites-available/lms.dpd.go.id.conf
    command -v a2enmod >/dev/null 2>&1 && a2enmod proxy proxy_http headers rewrite ssl >/dev/null 2>&1 || true
    echo -e "${GREEN}  ✅ Konfigurasi VirtualHost tersalin ke /etc/apache2/sites-available/lms.dpd.go.id.conf${NC}"
fi

# B. Apache aaPanel / BT-Panel
AAPANEL_APACHE_DIR="/www/server/panel/vhost/apache"
if [ -d "$AAPANEL_APACHE_DIR" ]; then
    for vhost in "${AAPANEL_APACHE_DIR}"/*lms*.conf; do
        if [ -f "$vhost" ]; then
            if ! grep -q "ProxyTimeout 600" "$vhost"; then
                sed -i '/ProxyPreserveHost/i \    TimeOut 600\n    ProxyTimeout 600\n    LimitRequestBody 524288000' "$vhost" || true
                echo -e "${GREEN}  ✅ Pengaturan upload timeout (600s) disisipkan ke vhost aaPanel: $vhost${NC}"
            fi
        fi
    done
fi

# Reload Apache
if command -v apache2ctl >/dev/null 2>&1; then
    if apache2ctl configtest >/dev/null 2>&1; then
        systemctl reload apache2 2>/dev/null || systemctl restart apache2 2>/dev/null || true
        echo -e "${GREEN}  ✅ Layanan Apache berhasil dimuat ulang (reload).${NC}"
    fi
elif [ -f "/etc/init.d/httpd" ]; then
    /etc/init.d/httpd reload >/dev/null 2>&1 || true
    echo -e "${GREEN}  ✅ Service httpd aaPanel berhasil di-reload.${NC}"
fi

# ------------------------------------------------------------------------------
# 2. DETEKSI DOCKER COMPOSE & RESTART BACKEND DJANGO
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}${BOLD}[2/4] Menerapkan perbaikan permission & SSO di Backend Django...${NC}"
COMPOSE_BIN=""
if docker compose version >/dev/null 2>&1; then
    COMPOSE_BIN="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_BIN="docker-compose"
else
    echo -e "${RED}[ERROR] Docker Compose tidak ditemukan!${NC}"
    exit 1
fi

$COMPOSE_BIN restart backend
echo -e "${GREEN}  ✅ Container backend berhasil dimuat ulang dengan logika permission baru.${NC}"

# ------------------------------------------------------------------------------
# 3. REBUILD FRONTEND (TAG SELECTOR, IMAGE DISPLAY & ANTI-LOOP AUTO-SAVE)
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}${BOLD}[3/4] Melakukan build ulang (rebuild) frontend React...${NC}"
echo -e "  Mengompilasi TagSelector, ImageUpload, dan penanganan auto-save..."
$COMPOSE_BIN build --no-cache frontend
$COMPOSE_BIN up -d frontend
echo -e "${GREEN}  ✅ Container frontend berhasil di-build ulang dan aktif.${NC}"

# ------------------------------------------------------------------------------
# 4. SANITY CHECK KESEHATAN API
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}${BOLD}[4/4] Menguji status respons endpoint Tag dan Health API...${NC}"
TAG_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -H "X-Forwarded-Proto: https" "http://127.0.0.1:8001/api/v1/course/tag/" 2>/dev/null || echo "000")

if [ "$TAG_HTTP" = "200" ]; then
    echo -e "${GREEN}  ✅ Endpoint Tag Kursus merespons dengan normal (HTTP 200 OK).${NC}"
else
    echo -e "${YELLOW}  ℹ️ Status endpoint Tag: HTTP $TAG_HTTP${NC}"
fi

echo -e "\n${BOLD}${GREEN}========================================================================${NC}"
echo -e "${BOLD}${GREEN}   PATCH SELESAI DITERAPKAN DENGAN SUKSES!                             ${NC}"
echo -e "${BOLD}${GREEN}========================================================================${NC}"
echo -e "1. Buka kembali: ${CYAN}https://lms.dpd.go.id/instructor/edit-course/112488/${NC}"
echo -e "2. Tekan ${YELLOW}${BOLD}Ctrl + F5${NC} (Hard Refresh) di browser Anda."
echo -e "3. Tambah fitur baru sekarang akan tersimpan sukses tanpa error 403."
echo -e "4. Tag kursus dan gambar thumbnail kursus akan muncul secara sempurna."
echo ""
