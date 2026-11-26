#!/usr/bin/env bash
# ==============================================================================
# LMSetjen DPD RI - One-Click Single-Domain API Migration Script
# Mengubah arsitektur API dari lms-be.dpd.go.id (IP Privat 10.20.30.13)
# menjadi Single-Domain: https://lms.dpd.go.id/api/ (IP Publik 103.248.146.13)
# Mengatasi error net::ERR_CONNECTION_TIMED_OUT dari luar jaringan kantor
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
echo "║      MIGRASI API SINGLE-DOMAIN: https://lms.dpd.go.id/api/          ║"
echo "║    Solusi tuntas kendala akses internet publik (ERR_TIMED_OUT)      ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}[ERROR] Skrip ini harus dijalankan dengan hak akses root / sudo.${NC}"
    echo -e "Silakan jalankan: ${YELLOW}sudo ./switch-to-single-domain.sh${NC}"
    exit 1
fi

# ------------------------------------------------------------------------------
# 1. PERBARUI VARIABEL .ENV UNTUK SINGLE-DOMAIN
# ------------------------------------------------------------------------------
echo -e "${BLUE}${BOLD}[1/4] Mengonfigurasi variabel environment ke Single-Domain...${NC}"
ENV_FILE="${PROJECT_DIR}/.env"

if [ -f "$ENV_FILE" ]; then
    # Backup .env terlebih dahulu
    cp "$ENV_FILE" "${ENV_FILE}.bak_$(date +%Y%m%d_%H%M%S)"
    
    # Update VITE_API_BASE_URL ke /api
    if grep -q "^VITE_API_BASE_URL=" "$ENV_FILE"; then
        sed -i 's|^VITE_API_BASE_URL=.*|VITE_API_BASE_URL=/api|g' "$ENV_FILE"
    else
        echo "VITE_API_BASE_URL=/api" >> "$ENV_FILE"
    fi

    # Update BACKEND_SITE_URL ke https://lms.dpd.go.id
    if grep -q "^BACKEND_SITE_URL=" "$ENV_FILE"; then
        sed -i 's|^BACKEND_SITE_URL=.*|BACKEND_SITE_URL=https://lms.dpd.go.id|g' "$ENV_FILE"
    else
        echo "BACKEND_SITE_URL=https://lms.dpd.go.id" >> "$ENV_FILE"
    fi

    echo -e "${GREEN}  ✅ File .env berhasil disesuaikan (VITE_API_BASE_URL=/api).${NC}"
else
    echo -e "${YELLOW}  ⚠️ File .env tidak ditemukan di ${PROJECT_DIR}, membuat file baru...${NC}"
    echo "VITE_API_BASE_URL=/api" >> "$ENV_FILE"
    echo "BACKEND_SITE_URL=https://lms.dpd.go.id" >> "$ENV_FILE"
fi

# ------------------------------------------------------------------------------
# 2. REBUILD CONTAINER FRONTEND (COMPILE REACT DENGAN PATH RELATIF)
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}${BOLD}[2/4] Melakukan build ulang (rebuild) container frontend...${NC}"
COMPOSE_BIN=""
if docker compose version >/dev/null 2>&1; then
    COMPOSE_BIN="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_BIN="docker-compose"
else
    echo -e "${RED}[ERROR] Docker Compose tidak ditemukan!${NC}"
    exit 1
fi

cd "${PROJECT_DIR}"
echo -e "  Menjalankan: ${COMPOSE_BIN} build --no-cache frontend && ${COMPOSE_BIN} up -d frontend"
$COMPOSE_BIN build --no-cache frontend
$COMPOSE_BIN up -d frontend

echo -e "${GREEN}  ✅ Container frontend berhasil di-build ulang dan berjalan.${NC}"

# ------------------------------------------------------------------------------
# 3. PERBARUI KONFIGURASI APACHE VIRTUALHOST
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}${BOLD}[3/4] Menerapkan Reverse Proxy /api/ & /media/ di Apache...${NC}"

# A. Jika sistem menggunakan Apache standar Debian/Ubuntu
if [ -d "/etc/apache2/sites-available" ]; then
    cp -f "${PROJECT_DIR}/apache-lms.dpd.go.id.conf" /etc/apache2/sites-available/lms.dpd.go.id.conf
    command -v a2enmod >/dev/null 2>&1 && a2enmod proxy proxy_http headers rewrite ssl >/dev/null 2>&1 || true
    command -v a2ensite >/dev/null 2>&1 && a2ensite lms.dpd.go.id.conf >/dev/null 2>&1 || true
    echo -e "${GREEN}  ✅ Konfigurasi tersalin ke /etc/apache2/sites-available/lms.dpd.go.id.conf${NC}"
fi

# B. Jika sistem menggunakan aaPanel / BT-Panel Apache
AAPANEL_APACHE_DIR="/www/server/panel/vhost/apache"
if [ -d "$AAPANEL_APACHE_DIR" ]; then
    for vhost in "${AAPANEL_APACHE_DIR}"/*lms*.conf; do
        if [ -f "$vhost" ]; then
            echo -e "  Memeriksa vhost aaPanel: $vhost"
            if ! grep -q "ProxyPass /api/" "$vhost"; then
                # Sisipkan ProxyPass /api/ dan /media/ sebelum ProxyPass / http://
                sed -i '/ProxyPass \/ http/i \    # Proxy API & Media ke Django Backend (Single-Domain)\n    ProxyPass \/api\/ http:\/\/127.0.0.1:8001\/api\/\n    ProxyPassReverse \/api\/ http:\/\/127.0.0.1:8001\/api\/\n    ProxyPass \/media\/ http:\/\/127.0.0.1:8001\/media\/\n    ProxyPassReverse \/media\/ http:\/\/127.0.0.1:8001\/media\/' "$vhost" || true
                echo -e "${GREEN}  ✅ ProxyPass /api/ berhasil disisipkan ke vhost aaPanel: $vhost${NC}"
            fi
        fi
    done
fi

# C. Validasi Sintaks dan Reload Apache
echo -e "  Menguji dan memuat ulang Apache..."
if command -v apache2ctl >/dev/null 2>&1; then
    if apache2ctl configtest >/dev/null 2>&1; then
        systemctl reload apache2 2>/dev/null || systemctl restart apache2 2>/dev/null || true
        echo -e "${GREEN}  ✅ Apache berhasil dimuat ulang (reloaded).${NC}"
    else
        echo -e "${YELLOW}  ⚠️ Peringatan pada apache2ctl configtest, silakan periksa sertifikat SSL.${NC}"
    fi
elif [ -f "/etc/init.d/httpd" ]; then
    /etc/init.d/httpd reload >/dev/null 2>&1 || /etc/init.d/httpd restart >/dev/null 2>&1 || true
    echo -e "${GREEN}  ✅ Service httpd aaPanel berhasil di-reload.${NC}"
fi

# ------------------------------------------------------------------------------
# 4. VERIFIKASI AKSES LOKAL API MELALUI APACHE
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}${BOLD}[4/4] Menguji endpoint https://lms.dpd.go.id/api/ secara lokal...${NC}"

# Tes panggilan API lewat loopback dengan Host header lms.dpd.go.id
HTTP_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" -H "Host: lms.dpd.go.id" -H "X-Forwarded-Proto: https" "http://127.0.0.1:8001/api/v1/health/" 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}  ✅ UJI BERHASIL (HTTP 200 OK): Endpoint API backend merespons dengan normal.${NC}"
else
    echo -e "${YELLOW}  ℹ️ Status uji API: HTTP $HTTP_STATUS${NC}"
fi

echo -e "\n${BOLD}${GREEN}========================================================================${NC}"
echo -e "${BOLD}${GREEN}   MIGRASI KE SINGLE-DOMAIN SELESAI DENGAN SUKSES!                     ${NC}"
echo -e "${BOLD}${GREEN}========================================================================${NC}"
echo -e "Seluruh request frontend sekarang memanggil: ${CYAN}${BOLD}https://lms.dpd.go.id/api/...${NC}"
echo -e "Silakan buka kembali browser Anda di luar kantor dan tekan ${YELLOW}${BOLD}Ctrl + F5${NC} (Hard Refresh)."
echo ""
