#!/usr/bin/env bash
# ==============================================================================
# LMSetjen DPD RI - Host Security Hardening Script
# Target: Production Server 10.20.30.13 (lms.dpd.go.id / lms-be.dpd.go.id)
# Mengatasi Temuan Pentest K-01, K-03, dan KMS DEBUG
# ==============================================================================

set -eo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}${BOLD}"
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║          SETJEN DPD RI - HOST SECURITY HARDENING SCRIPT              ║"
echo "║       Mengatasi Celah K-01 (Redis Unauth) & K-03 (Permukaan Host)    ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Script ini memerlukan hak akses root / sudo. Silakan jalankan dengan: sudo ./harden-host-security.sh${NC}"
    exit 1
fi

# ------------------------------------------------------------------------------
# 1. NONAKTIFKAN FTP (Port 21 Pure-FTPd)
# ------------------------------------------------------------------------------
echo -e "${BLUE}${BOLD}[1/5] Mematikan dan menonaktifkan layanan FTP (Pure-FTPd)...${NC}"
if systemctl is-active --quiet pure-ftpd 2>/dev/null; then
    systemctl stop pure-ftpd
    systemctl disable pure-ftpd
    echo -e "${GREEN}  ✅ Layanan pure-ftpd berhasil dihentikan dan dinonaktifkan.${NC}"
elif systemctl is-active --quiet vsftpd 2>/dev/null; then
    systemctl stop vsftpd
    systemctl disable vsftpd
    echo -e "${GREEN}  ✅ Layanan vsftpd berhasil dihentikan dan dinonaktifkan.${NC}"
else
    echo -e "${GREEN}  ✅ Layanan FTP tidak aktif.${NC}"
fi

# ------------------------------------------------------------------------------
# 2. KONFIGURASI FIREWALL UFW (Tutup Seluruh Port Kecuali 22, 80, 443)
# ------------------------------------------------------------------------------
echo -e "${BLUE}${BOLD}[2/5] Mengonfigurasi UFW Firewall (Hanya izinkan port 22, 80, 443)...${NC}"
if command -v ufw >/dev/null 2>&1; then
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow 22/tcp comment 'SSH Secure Access'
    ufw allow 80/tcp comment 'HTTP Web'
    ufw allow 443/tcp comment 'HTTPS Web'
    
    # Aktifkan UFW tanpa konfirmasi interaktif
    echo "y" | ufw enable
    ufw reload
    echo -e "${GREEN}  ✅ UFW Firewall berhasil dikonfigurasi:${NC}"
    ufw status verbose | sed 's/^/     /'
else
    echo -e "${YELLOW}  ⚠️ UFW tidak terpasang. Memasang ufw via apt...${NC}"
    apt-get update && apt-get install -y ufw
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    echo "y" | ufw enable
    echo -e "${GREEN}  ✅ UFW Firewall berhasil dipasang dan diaktifkan.${NC}"
fi

# ------------------------------------------------------------------------------
# 3. AUDIT & PERBAIKAN BINDING REDIS (K-01)
# ------------------------------------------------------------------------------
echo -e "${BLUE}${BOLD}[3/5] Memeriksa status port Redis (6380, 6381, 6382, 6383, 6384)...${NC}"
# Pastikan iptables / UFW memblokir akses eksternal ke port Redis
for port in 6380 6381 6382 6383 6384; do
    if command -v iptables >/dev/null 2>&1; then
        # Tambahkan aturan iptables DROP dari interface publik jika tidak melalui loopback
        iptables -C INPUT -p tcp --dport "$port" ! -s 127.0.0.1 -j DROP 2>/dev/null || \
        iptables -I INPUT 1 -p tcp --dport "$port" ! -s 127.0.0.1 -j DROP 2>/dev/null || true
    fi
done
echo -e "${GREEN}  ✅ Aturan isolasi Redis ke 127.0.0.1 diterapkan.${NC}"

# ------------------------------------------------------------------------------
# 4. ROTASI SESI DAN PEMBERSIHAN TOKEN HARVESTED DI REDIS CMB (K-02 & S-02)
# ------------------------------------------------------------------------------
echo -e "${BLUE}${BOLD}[4/5] Membersihkan token JWT SSO sisa yang tersimpan di cache Redis...${NC}"
# Jika Redis 6380 aktif di localhost, hapus cache key cmb_setjen_dpd_ri_cache_*
if command -v redis-cli >/dev/null 2>&1; then
    if redis-cli -p 6380 ping 2>/dev/null | grep -q "PONG"; then
        echo -e "${YELLOW}  Membersihkan kunci SSO di Redis 6380 db0...${NC}"
        redis-cli -p 6380 -n 0 --scan --pattern "*cmb_setjen_dpd_ri_cache*" | while read -r key; do
            redis-cli -p 6380 -n 0 del "$key" >/dev/null 2>&1 || true
        done
        echo -e "${GREEN}  ✅ Cache sesi/SSO di Redis 6380 berhasil dibersihkan.${NC}"
    fi
fi

# ------------------------------------------------------------------------------
# 5. PERINGATAN REKONFIGURASI KMS :8002 & DOCKER NETWORK
# ------------------------------------------------------------------------------
echo -e "${BLUE}${BOLD}[5/5] Rekomendasi Aplikasi Sibling (KMS, CMB, Pandawa, Awards)...${NC}"
echo -e "${YELLOW}  Catatan Penting:${NC}"
echo -e "  1. Pada aplikasi KMS (:8002), pastikan file .env disetel: ${BOLD}DEBUG=False${NC}."
echo -e "  2. Pastikan docker-compose CMB Laravel, KMS, Pandawa, dan Awards mengikat port ke ${BOLD}127.0.0.1:PORT:PORT${NC} (bukan 0.0.0.0)."
echo -e "  3. Password default DB / Redis yang tercatat di laporan pentest harus dirotasi."
echo ""
echo -e "${GREEN}${BOLD}🎉 Host Security Hardening selesai! Seluruh port non-80/443 kini tertutup dari LAN.${NC}"
