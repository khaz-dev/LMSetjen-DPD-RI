# Tuntunan UAT Readiness Preparation Proyek LMSetjen DPD RI
**Dokumen Standar Operasional Kesiapan User Acceptance Testing (UAT)**  
*Sekretariat Jenderal Dewan Perwakilan Daerah Republik Indonesia (Setjen DPD RI)*  
*Disusun oleh: Principal QA Lead & Release Manager*  
*Versi Dokumen: 1.3.0 | Status: Siap Eksekusi (Telah Disesuaikan: Ekosistem LMS & SSO Nusa Dikembangkan Penuh oleh Bagian Pengembangan Kapasitas SDM)*

---

## DAFTAR ISI
1. [Ringkasan Eksekutif & Kriteria Kelayakan (Go-Criteria)](#1-ringkasan-eksekutif--kriteria-kelayakan-go-criteria)
2. [Arsitektur & Setup Lingkungan UAT (UAT Environment)](#2-arsitektur--setup-lingkungan-uat-uat-environment)
3. [Strategi Migrasi & Sanitasi Data (Data Masking)](#3-strategi-migrasi--sanitasi-data-data-masking)
4. [Matriks User Profile & Role-Based Access Control (RBAC)](#4-matriks-user-profile--role-based-access-control-rbac)
5. [Template Test Script & Blueprint Skenario UAT](#5-template-test-script--blueprint-skenario-uat)
6. [Alur Pengelolaan Temuan Bug (Issue Triaging & SLA)](#6-alur-pengelolaan-temuan-bug-issue-triaging--sla)
7. [Lembar Pengesahan Kesiapan (Sign-Off Sheet)](#7-lembar-pengesahan-kesiapan-sign-off-sheet)

---

## 1. RINGKASAN EKSEKUTIF & KRITERIA KELAYAKAN (GO-CRITERIA)

### 1.1 Latar Belakang & Tata Kelola Kelembagaan DPD RI
Fase *User Acceptance Testing* (UAT) untuk sistem **Learning Management System (LMS) Setjen DPD RI** merupakan gerbang akhir (*final quality gate*) sebelum sistem dideploy ke lingkungan produksi (`lms.dpd.go.id`). 

Tata kelola kelembagaan, kepemilikan produk, dan pengembangan teknologi resmi diatur sebagai berikut:
- **Pengembang Penuh Ekosistem Pembelajaran & Autentikasi (*Full Developer & Product Owner*):** 
  Sistem **LMSetjen DPD RI** beserta gerbang autentikasi terpusat **SSO Nusa (`nusa.dpd.go.id`)** dikembangkan secara penuh (*fully developed*) oleh **Bagian Pengembangan Kapasitas Sumber Daya Manusia** (di bawah **Biro Organisasi, Keanggotaan, dan Kepegawaian**). Dengan demikian, integrasi pertukaran token, validasi data ASN, modul pembelajaran digital, akumulasi Jam Pelajaran (JP), hingga penerbitan sertifikat digital merupakan ekosistem terpadu satu pintu di bawah rancang bangun unit ini.
- **Dukungan Tata Kelola Infrastruktur:** 
  Koordinasi teknis infrastruktur server, jaringan intranet/internet parlemen, dan kepatuhan standar keamanan siber disinergikan bersama **Biro Sistem Informasi dan Dokumentasi** (khususnya **Bagian Pengembangan Sistem Informasi**).
- **Struktur Organisasi Pelayanan Pembelajaran:** 
  Setjen DPD RI **belum memiliki Pusdiklat**. Layanan pelatihan digital pada LMS ini mencakup seluruh unit kerja Setjen DPD RI: **Pusat** (Pusat Kajian Daerah dan Anggaran, Pusat Perancangan dan Kajian Kebijakan Hukum, Biro Sistem Informasi dan Dokumentasi), **Biro-Biro Kesekretariatan**, **Inspektorat**, serta **Kantor Daerah DPD RI** di 38 Ibukota Provinsi.
- **Karakteristik Pengajar / Instruktur:** 
  Sistem **tidak menggunakan jabatan Widyaiswara internal** (tidak ada Diklat Widyaiswara), melainkan memberdayakan **Instruktur / Fasilitator Pembelajaran / Narasumber Materi** yang berasal dari pejabat fungsional keahlian internal, pejabat struktural, maupun pakar eksternal yang dikurasi langsung oleh Bagian Pengembangan Kapasitas SDM.
- **Karakteristik Autentikasi Mandiri (Passwordless):** 
  LMS Setjen DPD RI **TIDAK MENGGUNAKAN KATA SANDI (PASSWORDLESS)**. Sistem hanya menerima autentikasi resmi melalui dua pintu gerbang:
  1. **SSO Nusa DPD RI (`nusa.dpd.go.id`):** Portal SSO yang juga dikembangkan oleh Bagian Pengembangan Kapasitas SDM sebagai metode autentikasi utama (*primary single sign-on*) bagi seluruh pegawai Setjen DPD RI di pusat maupun kantor daerah.
  2. **Google OAuth 2.0 (Masuk dengan Google):** Pintu masuk fleksibel untuk Peserta ASN dari instansi luar (K/L/Pemda), Masyarakat Umum, serta akun Google kedinasan.

---

### 1.2 Profil Arsitektur & Teknologi Terdeteksi
- **Backend Runtime & Framework:** Python 3.11.4, Django 4.2.7 (LTS), Django REST Framework (DRF) 3.14.0, SimpleJWT 5.2.2.
- **Frontend Runtime & Framework:** Node.js, Vite 7.3.1, React 18.2.0 (Single Page Application), React-Bootstrap / Bootstrap 5.3.2, Zustand 4.4.4.
- **Basis Data Utama:** PostgreSQL 15+ (Gin Indexing, Full-Text Search Vector `pg_trgm`, UUID).
- **In-Memory Cache & Message Broker:** Redis 7 (Alpine) pada port 6381.
- **Web Server & Reverse Proxy:** NGINX 1.18+, Gunicorn 21.2.0 (WSGI 4 workers, 2 threads, 300s timeout).
- **Fitur Khusus LMS:** Modul SCORM 1.2/2004 & H5P Engine, Video Streaming, Engine Generator Sertifikat Digital otomatis (jsPDF & html2canvas) dilengkapi Public QR Verification, Endpoint Verifikasi SSO Nusa (`/sso/<token>/` dan `/api/v1/sso/verify/`), Google OAuth Handler (`/auth/google/`), Onboarding Wizard profil kepegawaian, serta kalkulator Jam Pelajaran (JP) ASN.

---

### 1.3 Prasyarat Mutlak Masuk UAT (Entry Criteria / Go-Criteria)
Sebelum sistem diserahkan kepada tim penguji pengguna Setjen DPD RI, seluruh kriteria gerbang berikut **wajib 100% terpenuhi**:

- [ ] **SIT (System Integration Testing) Selesai 100%**: Alur komunikasi antara SSO Nusa dan LMS Setjen DPD RI, Google OAuth, pemutar modul SCORM/H5P, evaluasi kuis, generator sertifikat, dan kontrol admin telah lulus uji integrasi QA.
- [ ] **Zero Blocker & Zero Critical Defects**: Tidak ada cacat fungsional berstatus *Severity-1 (Blocker)* atau *Severity-2 (Critical)* yang masih terbuka (*open/unresolved*).
- [ ] **Maksimal Toleransi Major/Minor Bug**: Cacat berstatus *Major* = 0; Cacat berstatus *Minor/Trivial* maksimal 3 item dengan catatan memiliki *workaround* tertulis yang disetujui QA Lead dan Tim Bagian Pengembangan Kapasitas SDM.
- [ ] **Validasi Sinkronisasi SSO Nusa (Karya Pengembangan Kapasitas SDM)**: Token SSO Nusa staging dapat didecode secara presisi oleh backend LMS tanpa kendala invalid signature atau token expiry.
- [ ] **Ketersediaan Staging/UAT Environment Terisolasi**: Server UAT terisolasi penuh dari server produksi dan menggunakan enkripsi SSL/TLS (HTTPS).
- [ ] **Ketersediaan Akun Uji Terverifikasi Tanpa Sandi**: Akun uji SSO Nusa dan Google sandbox telah disiapkan untuk seluruh variasi profil (Pegawai Pusat, Pegawai Biro, Pegawai Inspektorat, Pegawai Kantor Daerah, ASN Luar, Umum, Instruktur/Fasilitator, dan Admin Pengelola SDM).
- [ ] **Kelengkapan Dokumen UAT**: Lembar Uji Pengguna (Test Script), *Release Notes*, dan Petunjuk Singkat Pengguna (*User Guide*) telah disetujui oleh Bagian Pengembangan Kapasitas SDM untuk pengujian bersama.

---

### 1.4 Definition of Ready (DoR) Spesifik Arsitektur LMS DPD RI
Sistem dinyatakan **Ready for UAT** apabila checklist teknis arsitektural berikut telah berstatus centang:

- [ ] **DoR-AUTH-01**: Endpoint penerima SSO Nusa (`/sso/:sso_token/` dan `/api/v1/sso/verify/`) mampu mendecode klaim token SSO Nusa buatan Bagian Pengembangan Kapasitas SDM, memetakan identitas NIP, unit kerja, serta menerbitkan token akses JWT LMS tanpa input password.
- [ ] **DoR-AUTH-02**: Endpoint Google OAuth (`/auth/google/`) sukses memproses token Google credential (popup & redirect flow) serta mendeteksi flag `onboarding_completed`.
- [ ] **DoR-BE-01**: Backend Django berjalan stabil pada Python 3.11 di Gunicorn tanpa error tak tertangani pada log `/app/logs/django.log`.
- [ ] **DoR-BE-02**: Migrasi database PostgreSQL berada pada kondisi mutakhir (`python manage.py showmigrations` tanpa ada status unapplied).
- [ ] **DoR-BE-03**: Redis Cache aktif pada port 6381, mekanisme caching API merespons dengan latency < 150ms.
- [ ] **DoR-FE-01**: Frontend React telah dibuild via Vite production (`npm run build`) tanpa error kompilasi dan asset static terkompresi.
- [ ] **DoR-FE-02**: Variabel `VITE_API_BASE_URL` mengarah tepat ke domain API UAT/Staging (bukan `localhost`).
- [ ] **DoR-MEDIA-01**: Storage media direktori `/app/media` memiliki izin tulis yang aman untuk paket modul SCORM, H5P, dan aset gambar.
- [ ] **DoR-CERT-01**: Modul verifikasi publik sertifikat via QR Code (`/certificate/verify/<certificate_id>`) dapat diakses tanpa autentikasi login (akses publik) dan menampilkan validitas resmi Bagian Pengembangan Kapasitas SDM Setjen DPD RI.

---

## 2. ARSITEKTUR & SETUP LINGKUNGAN UAT (UAT ENVIRONMENT)

### 2.1 Topologi Lingkungan UAT Terisolasi
Seluruh komponen ekosistem LMS dan SSO Nusa yang dibangun oleh Bagian Pengembangan Kapasitas SDM direplikasi ke lingkungan UAT terisolasi (host: `165.245.191.216` atau server staging internal DPD RI).

```
                      INTERNET / INTRANET DPD RI
                                  │
                                  ▼
                   [ NGINX Reverse Proxy (Port 443) ]
                     - SSL Termination (HTTPS)
                     - Security Headers & Static Cache
                                  │
             ┌────────────────────┴────────────────────┐
             ▼ (Proxy :5174)                           ▼ (Proxy :8001)
   [ Frontend Container ]                    [ Backend Container ]
   - React 18 SPA (Vite Prod)               - Django 4.2.7 REST API
   - Handler SSO Nusa & Google              - Gunicorn WSGI (4 Workers)
   - SCORM & H5P Player                      - Auth JWT & Role Switcher
             │                                         │
             └────────────────────┬────────────────────┘
                                  │
          ┌───────────────────────┴───────────────────────┐
          ▼                                               ▼
 [ PostgreSQL Database (Port 5432) ]           [ Redis Cache (Port 6381) ]
   - DB: lms_uat_db                              - Container: lms_redis
   - Data Sanitized & Masked                     - Auth Token Caching
   - Multi-unit Setjen DPD RI                    - Rate Limit & Session
```

---

### 2.2 Template Variabel Lingkungan UAT (`.env.uat`)
Konfigurasi lingkungan `.env.uat` pada server staging:

```ini
# ==============================================================================
# LINGKUNGAN UAT - LMS SETJEN DPD RI CONFIGURATION (PASSWORDLESS)
# Pengembang Aplikasi LMS & SSO Nusa: Bagian Pengembangan Kapasitas SDM
# Dukungan Infrastruktur Jaringan: Bagian Pengembangan Sistem Informasi
# ==============================================================================
DEBUG=False
DJANGO_LOG_LEVEL=INFO
SECRET_KEY=django-secure-uat-dpdri-2026-x#91ka83!lkq0192837465alzkqm
MODE=production

# Konfigurasi Domain & Akses
ALLOWED_HOSTS=lms-uat.dpd.go.id,165.245.191.216,localhost
FRONTEND_SITE_URL=https://lms-uat.dpd.go.id
BACKEND_SITE_URL=https://lms-uat.dpd.go.id/api/v1
VITE_API_BASE_URL=https://lms-uat.dpd.go.id/api/v1
VITE_PORT=5174

# Database PostgreSQL UAT (Terpisah dari database produksi)
DB_NAME=lms_uat_db
DB_USER=lms_uat_user
DB_PASSWORD=UatStrongP@ssw0rd_DPD2026!
DB_HOST=host.docker.internal
DB_PORT=5432

# Redis Cache UAT
REDIS_HOST=redis
REDIS_PORT=6381
REDIS_PASSWORD=UatRedisP@ssw0rd2026!
REDIS_URL=redis://:UatRedisP@ssw0rd2026!@redis:6381/0

# CORS & CSRF Whitelist
CORS_ALLOWED_ORIGINS=https://lms-uat.dpd.go.id,http://localhost:5174
CSRF_TRUSTED_ORIGINS=https://lms-uat.dpd.go.id,http://127.0.0.1:8001

# Autentikasi Passwordless: SSO Nusa (Internal SDM) & Google OAuth
SSO_NUSA_PUBLIC_KEY_PATH=/app/ca-certificates/sso_nusa_uat.pub
SSO_NUSA_PORTAL_URL=https://nusa.dpd.go.id?app=LMS
GOOGLE_CLIENT_ID=uat-dpd-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=uat-dpd-google-secret
VITE_GOOGLE_CLIENT_ID=uat-dpd-google-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_REDIRECT_URI=https://lms-uat.dpd.go.id/login

# Email & Notifikasi Sandbox
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
FROM_EMAIL=lms-noreply@dpd.go.id
```

---

### 2.3 Prosedur Eksekusi Deployment Server UAT (Step-by-Step CLI)

#### Tahap A: Pengambilan Kode Sumber & Persiapan File Konfigurasi
```bash
# 1. Masuk ke server staging UAT via SSH
ssh -i ~/.ssh/id_rsa_dpd admin_uat@165.245.191.216

# 2. Pindah ke direktori deployment proyek
cd /var/www/html/lms

# 3. Ambil kode sumber dari branch rilis UAT
git fetch origin
git checkout release/v1.3.0-uat
git pull origin release/v1.3.0-uat

# 4. Terapkan konfigurasi lingkungan UAT
cp .env.uat .env
```

#### Tahap B: Inisialisasi Database PostgreSQL & Redis
```bash
# 1. Masuk ke PostgreSQL host untuk membuat database uji terisolasi
sudo -u postgres psql << EOF
CREATE DATABASE lms_uat_db WITH ENCODING 'UTF8' LC_COLLATE='en_US.UTF-8' LC_CTYPE='en_US.UTF-8';
CREATE USER lms_uat_user WITH ENCRYPTED PASSWORD 'UatStrongP@ssw0rd_DPD2026!';
GRANT ALL PRIVILEGES ON DATABASE lms_uat_db TO lms_uat_user;
ALTER DATABASE lms_uat_db OWNER TO lms_uat_user;
\c lms_uat_db
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
\q
EOF
```

#### Tahap C: Build & Eksekusi Layanan Backend (Django + Redis)
```bash
# 1. Hentikan container lama (jika ada)
docker-compose -f docker-compose.yml down

# 2. Build ulang container backend dan frontend
docker-compose -f docker-compose.yml build --no-cache

# 3. Jalankan container Redis dan pastikan health check aktif
docker-compose up -d redis
docker-compose ps redis

# 4. Jalankan migrasi skema database Django
docker-compose run --rm backend python manage.py wait_for_db
docker-compose run --rm backend python manage.py migrate --noinput

# 5. Inisialisasi master data unit kerja resmi Setjen DPD RI
docker-compose run --rm backend python manage.py init_db --skip-if-exists

# 6. Kumpulkan static files
docker-compose run --rm backend python manage.py collectstatic --noinput --clear
```

#### Tahap D: Build & Verifikasi Frontend
```bash
# 1. Jalankan proses pre-build dan build bundle Vite
cd frontend
npm ci --prefer-offline
npm run prebuild
npm run build
cd ..

# 2. Nyalakan seluruh stack container (Backend, Redis, Frontend)
docker-compose up -d

# 3. Periksa status seluruh container
docker-compose ps
```

#### Tahap E: Validasi NGINX & Responsivitas Layanan
```bash
# 1. Validasi sintaks NGINX dan muat ulang
sudo nginx -t
sudo systemctl reload nginx

# 2. Uji responsivitas endpoint via cURL
curl -I https://lms-uat.dpd.go.id/
curl -I https://lms-uat.dpd.go.id/api/v1/course/category/
```

---

## 3. STRATEGI MIGRASI & SANITASI DATA (DATA MASKING)

> [!CAUTION]
> **KEPATUHAN PRIVASI & KEBIJAKAN TANPA KATA SANDI**:
> 1. Sistem menerapkan prinsip **Passwordless murni (hanya SSO Nusa & Google OAuth)**; tidak ada data hash password yang disimpan atau diuji.
> 2. Seluruh identitas pegawai asli (NIP riil, nama asli, email kedinasan, dan nomor kontak) **wajib disamarkan/dimasking** agar data kepegawaian Setjen DPD RI tidak bocor ke publik atau lingkungan pengujian.

### 3.1 Blueprint Penyediaan Data Uji Realistis
Struktur data uji mencerminkan susunan unit kerja nyata di lingkungan Sekretariat Jenderal DPD RI yang dirancang oleh Bagian Pengembangan Kapasitas SDM:

1. **Master Data Unit Kerja Resmi Setjen DPD RI**:
   - **Biro Organisasi, Keanggotaan, dan Kepegawaian** *(unit pengembang penuh LMS & SSO Nusa, serta penanggung jawab kompetensi SDM)*.
   - **Biro Sistem Informasi dan Dokumentasi** *(unit pendukung infrastruktur TI & jaringan)*.
   - **Biro Lainnya:** Biro Protokol Humas dan Media, Biro Persidangan dan Musyawarah, Biro Umum, Biro Keuangan.
   - **Pusat:** Pusat Kajian Daerah dan Anggaran, Pusat Perancangan dan Kajian Kebijakan Hukum, Biro Sistem Informasi dan Dokumentasi.
   - **Inspektorat:** Inspektorat Setjen DPD RI.
   - **Kantor Daerah (Provinsi):** Kantor DPD RI Provinsi Jawa Barat, Kantor DPD RI Provinsi Jawa Timur, Kantor DPD RI Provinsi Sumatera Utara, Kantor DPD RI Provinsi Bali, Kantor DPD RI Provinsi Sulawesi Selatan, Kantor DPD RI Provinsi Papua, dll.
2. **Kategori Modul Pelatihan / Materi Pembelajaran**:
   - *Orientasi & Nilai Dasar:* Orientasi Penugasan Pegawai Baru Setjen DPD RI (24 JP).
   - *Administrasi Kesekretariatan:* Penguatan Tata Naskah Dinas Elektronik & Persuratan Parlemen (18 JP).
   - *Teknologi & Sistem Informasi:* Pemanfaatan Portal Kerja Nusa & Sistem Informasi Kepegawaian DPD RI (12 JP).
   - *Integritas & Tata Kelola:* Kode Etik Pegawai, Pengendalian Gratifikasi, & SPIP di Lingkungan Lembaga Perwakilan (10 JP).
   - *Kursus Publik / Terbuka:* Pengantar Hukum Tata Negara & Sistem Bikameral Parlemen Indonesia (8 JP).
3. **Format Materi Pembelajaran**:
   - Video Pembelajaran (MP4 H.264, 3–5 menit).
   - Modul Interaktif SCORM 1.2 / H5P (Paket interaktif dengan pelacakan status penyelesaian).
   - Materi Dokumen Bacaan PDF Resmi.

---

### 3.2 Prosedur & Skrip Sanitasi Data (SQL Data Masking Script)
Jalankan skrip sanitasi SQL berikut pada basis data UAT (`lms_uat_db`):

```sql
-- ==============================================================================
-- SCRIPT SANITASI & ANOMINISASI DATA UAT (LMS SETJEN DPD RI)
-- Lingkungan: lms_uat_db (Passwordless - SSO Nusa & Google Login Only)
-- Disusun untuk: Bagian Pengembangan Kapasitas SDM
-- ==============================================================================

BEGIN;

-- 1. Kosongkan hash kata sandi lokal untuk menegaskan sistem passwordless
UPDATE userauths_user 
SET password = '!'
WHERE is_superuser = FALSE;

-- 2. Anomisasi Identitas Pegawai (NIP, Nama Lengkap, Username, Email)
-- NIP fiktif terstandarisasi 18 digit: 19880101 + [ID unik 10 digit]
UPDATE userauths_user
SET 
    full_name = 'Pegawai UAT DPD ' || id,
    email = 'pegawai_uat_' || id || '@dpd.test.local',
    username = 'pegawai_uat_' || id,
    nip = '19880101' || LPAD(id::text, 10, '0'),
    otp = NULL,
    refresh_token = NULL
WHERE is_superuser = FALSE;

-- 3. Masking Profil Tambahan
UPDATE userauths_profile
SET 
    bio = 'Akun pengujian resmi UAT - Bagian Pengembangan Kapasitas SDM DPD RI',
    image = 'default-avatar.png';

-- 4. Distribusi Realistis Jenis Peserta & Unit Kerja Nyata Setjen DPD RI
-- A. Pegawai Internal Setjen DPD RI (Biro, Pusat, Inspektorat, Kantor Daerah)
UPDATE userauths_user
SET 
    user_type = 'INTERNAL', 
    is_internal = TRUE, 
    instansi_asal = 'Sekretariat Jenderal DPD RI'
WHERE id % 3 = 0 AND is_superuser = FALSE;

-- B. ASN Luar (Kementerian / Lembaga / Pemda)
UPDATE userauths_user
SET 
    user_type = 'ASN', 
    is_internal = FALSE, 
    instansi_asal = 'Pemerintah Daerah Provinsi Jawa Barat'
WHERE id % 3 = 1 AND is_superuser = FALSE;

-- C. Masyarakat Umum / Peneliti
UPDATE userauths_user
SET 
    user_type = 'UMUM', 
    is_internal = FALSE, 
    instansi_asal = NULL, 
    pekerjaan = 'Peneliti Lembaga Kajian / Mahasiswa'
WHERE id % 3 = 2 AND is_superuser = FALSE;

-- 5. Bersihkan Log Audit Sensitif & Notifikasi Lama
TRUNCATE TABLE api_searchlog;
TRUNCATE TABLE api_notification;

COMMIT;
```

---

## 4. MATRIKS USER PROFILE & ROLE-BASED ACCESS CONTROL (RBAC)

Sistem otorisasi LMS Setjen DPD RI menggunakan kombinasi **User Type** (`INTERNAL`, `ASN`, `UMUM`) dan **Active Role** (`student`, `teacher`/`instructor`, `admin`) dengan mekanisme *multi-role switcher*.

### 4.1 Definisi Profil Pengguna Pengujian UAT
Seluruh pengujian dilakukan melalui akun yang telah dihubungkan dengan Google OAuth UAT Sandbox atau Token Uji SSO Nusa (keduanya di bawah arsitektur Bagian Pengembangan Kapasitas SDM):

| ID Akun UAT | Role Aktif | User Type | Unit Kerja / Instansi | Jalur Masuk (Auth) | Tujuan Pengujian |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `uat_pegawai_sdm` | Peserta (*Student*) | `INTERNAL` | Bagian Pengembangan Kapasitas SDM | **SSO Nusa DPD** | Uji alur peserta internal pengembang, verifikasi modul kedinasan. |
| `uat_pegawai_psi` | Peserta (*Student*) | `INTERNAL` | Bagian Pengembangan Sistem Informasi | **SSO Nusa DPD** | Uji alur peserta tim infrastruktur TI, verifikasi token dan log. |
| `uat_pegawai_daerah` | Peserta (*Student*) | `INTERNAL` | Kantor DPD RI Provinsi Bali | **SSO Nusa DPD** | Uji akses peserta kantor daerah di luar Jakarta via SSO Nusa. |
| `uat_peserta_asn_luar`| Peserta (*Student*) | `ASN` | Bappeda Pemprov Jawa Barat | **Google OAuth** | Uji registrasi onboarding ASN luar, akses kelas khusus ASN. |
| `uat_peserta_umum` | Peserta (*Student*) | `UMUM` | Peneliti / Publik | **Google OAuth** | Uji akses kelas publik, verifikasi pembatasan kelas internal DPD. |
| `uat_instruktur_ahli`| Instruktur (*Teacher*) | `INTERNAL` | Biro Persidangan & Musyawarah | **SSO Nusa DPD** | Uji penyusunan silabus, upload SCORM/Video, bank soal kuis. |
| `uat_admin_sdm` | Admin (*Admin*) | `INTERNAL` | Bagian Pengembangan Kapasitas SDM | **SSO Nusa DPD** | Uji kurasi kursus, reset ujian, kelola sertifikat JP, ekspor laporan. |
| `uat_super_admin` | Super Admin | `INTERNAL` | Bagian Pengembangan Sistem Informasi | **SSO Nusa DPD** | Uji konfigurasi teknis global, audit log, manajemen user. |

---

### 4.2 Matriks Hak Akses Fitur (RBAC Verification Matrix)

Keterangan:
- `V` : Diizinkan Penuh (*Authorized*)
- `X` : Dilarang / Dicegah (*Access Denied / Forbidden 403*)
- `K` : Kondisional (*Khusus konten/materi miliknya sendiri*)

| Fitur / Modul Aplikasi | Pegawai Internal DPD RI | Peserta ASN Luar | Peserta Umum | Instruktur / Fasilitator | Admin Pengelola SDM | Super Admin (PSI) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Metode Autentikasi** | | | | | | |
| - Masuk via SSO Nusa DPD RI (`nusa.dpd.go.id`) | `V` | `X` | `X` | `V` | `V` | `V` |
| - Masuk via Google OAuth (`Masuk dengan Google`) | `V` | `V` | `V` | `V` | `V` | `V` |
| **Katalog & Enrollment** | | | | | | |
| - Akses Kursus Target "Khusus Internal Setjen DPD RI"| `V` | `X` | `X` | `V` | `V` | `V` |
| - Akses Kursus Target "Khusus ASN" | `V` | `V` | `X` | `V` | `V` | `V` |
| - Akses Kursus Target "Terbuka untuk Umum" | `V` | `V` | `V` | `V` | `V` | `V` |
| - Pendaftaran Mandiri Kelas (*Self-Enrollment*) | `V` | `V` | `V` | `V` | `V` | `V` |
| **Pelaksanaan Belajar & Evaluasi** | | | | | | |
| - Menonton Video Pembelajaran & Membaca Modul | `V` | `V` | `V` | `V` | `V` | `V` |
| - Membuka Modul Interaktif SCORM / H5P | `V` | `V` | `V` | `V` | `V` | `V` |
| - Mengerjakan Evaluasi & Kuis Akhir (*Exam Attempt*) | `V` | `V` | `V` | `X` | `X` | `V` |
| - Mengunduh Sertifikat Kelulusan & Jam Pelajaran (JP)| `V` | `V` | `V` | `X` | `X` | `V` |
| - Validasi Keaslian Sertifikat (Akses Publik QR) | `V` | `V` | `V` | `V` | `V` | `V` |
| **Manajemen Materi (Instruktur / Fasilitator)** | | | | | | |
| - Pembuatan & Perubahan Silabus Kursus | `X` | `X` | `X` | `K` (Milik Sendiri) | `V` | `V` |
| - Unggah Modul SCORM / H5P / Video Pembelajaran | `X` | `X` | `X` | `K` (Milik Sendiri) | `V` | `V` |
| - Pengaturan Butir Soal Kuis & Kunci Jawaban | `X` | `X` | `X` | `K` (Milik Sendiri) | `V` | `V` |
| - Monitoring Nilai & Progres Belajar Siswa per Kelas | `X` | `X` | `X` | `K` (Kelas Asuh) | `V` | `V` |
| - Pengajuan Menjadi Instruktur Kursus | `V` | `V` | `X` | - | - | - |
| **Pusat Pengelolaan SDM & Verifikasi (Admin SDM)** | | | | | | |
| - Kurasi & Persetujuan Publikasi Kursus | `X` | `X` | `X` | `X` | `V` | `V` |
| - Reset Hasil Ujian Peserta (*Exam Reset*) | `X` | `X` | `X` | `X` | `V` | `V` |
| - Konfigurasi Template & Nomor Sertifikat Resmi | `X` | `X` | `X` | `X` | `V` | `V` |
| - Rekapitulasi & Ekspor Laporan JP Lintas Unit DPD RI | `X` | `X` | `X` | `X` | `V` | `V` |
| - Manajemen Hak Akses Pengguna (*Role Switcher*) | `X` | `X` | `X` | `X` | `V` | `V` |
| - Audit Trail & Konfigurasi Sistem Global | `X` | `X` | `X` | `X` | `X` | `V` |

---

## 5. TEMPLATE TEST SCRIPT & BLUEPRINT SKENARIO UAT

### 5.1 Format Tabel Lembar Uji UAT (UAT Test Script Template)

| Kolom | Deskripsi Pengisian |
| :--- | :--- |
| **ID Test Case** | Kode unik skenario pengujian (contoh: `UAT-AUTH-01`, `UAT-ENROL-02`). |
| **Fitur / Modul** | Modul aplikasi yang diuji (misal: SSO Nusa, Pemutar SCORM, Sertifikat). |
| **Langkah Pengujian** | Urutan tindakan teknis yang dieksekusi penguji. |
| **Hasil yang Diharapkan** | Perilaku sistem yang diharapkan sesuai spesifikasi kebutuhan. |
| **Hasil Aktual** | Respons nyata yang ditampilkan oleh sistem. |
| **Status** | Pilihan: **[ LULUS / GAGAL / BLOCKED ]**. |
| **Catatan User** | Evaluasi kemudahan pemakaian, redaksional istilah keparlemenan, dsb. |
| **Bukti Screenshot** | Nama file tangkapan layar pendukung (misal: `SS_UAT_AUTH_01.png`). |

---

### 5.2 Blueprint 5 Skenario Bisnis End-to-End Utama LMS Setjen DPD RI

```
+-----------------------------------------------------------------------------------+
|               5 SKENARIO BISNIS END-TO-END UTAMA UAT LMS DPD RI                   |
+-----------------------------------------------------------------------------------+
```

#### Skenario 1: Autentikasi Passwordless via SSO Nusa (Karya SDM) / Google & Onboarding Profil ASN
- **ID Test Case**: `UAT-E2E-01`
- **Tujuan**: Memastikan alur login tanpa sandi (*passwordless*) melalui portal SSO Nusa DPD RI (yang dikembangkan oleh Bagian Pengembangan Kapasitas SDM) dan Google OAuth, serta proses onboarding profil (NIP, Unit Kerja: Biro/Pusat/Inspektorat/Kantor Daerah, Golongan) bekerja secara mulus.

| Step | Tindakan Pengujian | Data Uji | Hasil yang Diharapkan | Status |
| :---: | :--- | :--- | :--- | :---: |
| 1 | Buka portal UAT `https://lms-uat.dpd.go.id/login`. | Browser Chrome / Edge | Halaman menampilkan dua opsi masuk resmi: **"Login dengan SSO Nusa DPD"** dan **"Masuk dengan Google"**; **tidak ada form input password**. | - [ ] |
| 2 | Klik tombol **"Login dengan SSO Nusa DPD"**. | Akun Pegawai: Raden Mas Danang (NIP: 199002152015031002) | Dialihkan ke portal SSO Nusa DPD (`nusa.dpd.go.id`), verifikasi identitas pegawai berhasil, lalu diredirect kembali ke `/sso/<token>/`. | - [ ] |
| 3 | Periksa respons backend LMS terhadap verifikasi SSO Nusa token. | Endpoint: `/api/v1/sso/verify/` | Backend memverifikasi token Nusa yang dikeluarkan oleh sistem Nusa, menerbitkan LMS JWT (`access` & `refresh`), dan memetakan data NIP serta nama pegawai. | - [ ] |
| 4 | Jika login pertama kali via Google OAuth, periksa pemunculan modal Onboarding. | Akun Google: `peserta.asn@gmail.com` | Modal Onboarding (`OnboardingModal.jsx`) terbuka otomatis meminta kelengkapan NIP, Jenis Peserta, Unit Kerja / Instansi, dan Jabatan. | - [ ] |
| 5 | Lengkapi profil: pilih Unit Kerja **"Biro Organisasi, Keanggotaan, dan Kepegawaian"**, Golongan **"III/b"**, lalu klik **Simpan & Masuk**. | Data unit kerja Setjen DPD RI | Data tersimpan, flag `onboarding_completed: true`, dan user diarahkan ke Dashboard Peserta dengan badge unit kerja yang sesuai. | - [ ] |

---

#### Skenario 2: Penemuan Katalog, Pembatasan Target Audiens, & Enrolment Mandiri
- **ID Test Case**: `UAT-E2E-02`
- **Tujuan**: Memvalidasi filter visibilitas kursus berdasarkan audiens target (Khusus Internal Setjen DPD RI vs Khusus ASN vs Terbuka untuk Umum) dan kelancaran proses enrollment mandiri.

| Step | Tindakan Pengujian | Data Uji | Hasil yang Diharapkan | Status |
| :---: | :--- | :--- | :--- | :---: |
| 1 | Login menggunakan akun **Peserta Umum** (`uat_peserta_umum`) via Google OAuth. | Role: `student`, `user_type: UMUM` | Berhasil masuk ke beranda publik LMS. | - [ ] |
| 2 | Cari pelatihan pada halaman katalog `/search` dengan kata kunci: "Tata Naskah Dinas Persuratan DPD". | Kursus ID: `CRS-INTERNAL-001` (Target: Khusus Internal Setjen DPD RI) | Kursus berstatus terkunci dengan penanda: *"Akses Khusus Pegawai Internal Setjen DPD RI"*. | - [ ] |
| 3 | Coba klik tombol pendaftaran pada kursus internal tersebut. | - | Sistem menolak pendaftaran dan menampilkan pesan informatif bahwa kursus diperuntukkan khusus bagi pegawai Setjen DPD RI. | - [ ] |
| 4 | Beralih akun ke **Pegawai Kantor Daerah DPD RI Provinsi Bali** (`uat_pegawai_daerah`) via SSO Nusa. | Role: `student`, `user_type: INTERNAL` | Berhasil masuk ke dashboard pegawai internal. | - [ ] |
| 5 | Buka kembali kursus `CRS-INTERNAL-001` dan klik tombol **Ikuti Pelatihan (Enroll)**. | - | Pendaftaran sukses seketika tanpa tagihan pembayaran, data tersimpan di `EnrolledCourse`, dan tombol berubah menjadi *"Mulai Belajar"*. | - [ ] |

---

#### Skenario 3: Pembelajaran Multimedia, Pelacakan Modul SCORM/H5P, & Evaluasi Kuis
- **ID Test Case**: `UAT-E2E-03`
- **Tujuan**: Memastikan materi video terputar dengan baik, modul interaktif SCORM/H5P dapat berinteraksi dan mencatat progres, serta pengerjaan evaluasi kuis akhir.

| Step | Tindakan Pengujian | Data Uji | Hasil yang Diharapkan | Status |
| :---: | :--- | :--- | :--- | :---: |
| 1 | Buka kursus yang telah dienroll pada halaman `/student/courses/<course_id>/learn`. | Materi Bab 1: Video Pengantar (3 Menit) | Video diputar via React Player secara responsif dan tanpa kendala buffer. | - [ ] |
| 2 | Tonton video pembelajaran hingga tuntas. | Progress = 100% | Materi tercentang selesai di daftar silabus, status terekam di backend (`CompletedLesson`), progres kelas bertambah. | - [ ] |
| 3 | Buka materi Bab 2 berupa **Paket Interaktif SCORM 1.2**. | Paket SCORM diunggah oleh Instruktur | Konten SCORM tampil utuh di dalam iframe (`ModulePlayerPage.jsx`), tombol navigasi materi di dalam paket dapat diklik normal. | - [ ] |
| 4 | Tuntaskan seluruh slide interaktif SCORM hingga mencapai halaman penutup modul. | Sinyal SCORM API: `cmi.core.lesson_status = "completed"` | Backend mencatat progres modul (`UserProgress.completed = true`). | - [ ] |
| 5 | Buka Bab Evaluasi dan klik tombol **Mulai Evaluasi Akhir (Post-Test)**. | Kuis pilihan ganda 10 butir soal | Timer ujian berjalan, butir soal tersusun acak, pilihan opsi jawaban responsif. | - [ ] |
| 6 | Jawab semua soal dan klik **Kirim Jawaban Evaluasi**. | Nilai capai: 90 (Passing Grade: 75) | Nilai 90 ditampilkan seketika dengan status **LULUS**, dan muncul pengumuman kelayakan penerbitan sertifikat digital. | - [ ] |

---

#### Skenario 4: Generator Sertifikat Otomatis, Pencantuman JP, & Validasi Publik QR
- **ID Test Case**: `UAT-E2E-04`
- **Tujuan**: Memvalidasi penerbitan sertifikat digital berbobot Jam Pelajaran (JP), pengesahan resmi dari Bagian Pengembangan Kapasitas SDM - Biro Organisasi, Keanggotaan, dan Kepegawaian, pencetakan PDF, dan verifikasi publik anti-pemalsuan melalui QR Code.

| Step | Tindakan Pengujian | Data Uji | Hasil yang Diharapkan | Status |
| :---: | :--- | :--- | :--- | :---: |
| 1 | Masuk ke menu **Sertifikat Saya** (`/student/certificates`). | Peserta telah lulus kursus `CRS-INTERNAL-001` | Muncul sertifikat kelulusan lengkap dengan judul pelatihan, tanggal lulus, dan jumlah bobot Jam Pelajaran (misal: "18 JP"). | - [ ] |
| 2 | Klik tombol **Lihat & Unduh Sertifikat** (`SertifikatKursus.jsx`). | Render Canvas/PDF | Modal preview sertifikat terbuka menampilkan: Nama Lengkap, NIP, Nama Pelatihan, Unit Kerja, Pengesahan Resmi Bagian Pengembangan Kapasitas SDM DPD RI, Nomor Seri, dan QR Code. | - [ ] |
| 3 | Klik tombol **Unduh Format PDF**. | Format A4 Landscape | File PDF berhasil diunduh, tata letak teks tajam dan proporsional, ukuran file efisien (< 1.5MB). | - [ ] |
| 4 | Buka kamera smartphone atau pemindai QR, scan kode QR yang tertera di sertifikat. | URL terdeteksi: `https://lms-uat.dpd.go.id/certificate/verify/<uuid>` | Halaman validasi publik (`CertificateValidation.jsx`) terbuka langsung tanpa meminta login. | - [ ] |
| 5 | Periksa status validitas pada halaman verifikasi publik. | ID Sertifikat & UUID | Menampilkan pernyataan: **"Sertifikat Sah & Terverifikasi Diterbitkan oleh Bagian Pengembangan Kapasitas SDM, Biro Organisasi, Keanggotaan, dan Kepegawaian Setjen DPD RI"**, lengkap dengan nama penerima dan tanggal terbit. | - [ ] |

---

#### Skenario 5: Manajemen Verifikasi Ujian, Rekapitulasi JP per Unit Kerja, & Ekspor Laporan
- **ID Test Case**: `UAT-E2E-05`
- **Tujuan**: Memverifikasi modul administrator Bagian Pengembangan Kapasitas SDM dalam mengelola hasil evaluasi (termasuk reset ujian akibat kendala teknis), rekap perolehan JP lintas unit kerja (Biro, Pusat, Inspektorat, Kantor Daerah), dan ekspor data laporan.

| Step | Tindakan Pengujian | Data Uji | Hasil yang Diharapkan | Status |
| :---: | :--- | :--- | :--- | :---: |
| 1 | Login menggunakan akun **Admin Pengelola SDM** (`uat_admin_sdm`) via SSO Nusa. | Role: `admin` | Masuk ke Dashboard Admin LMS Setjen DPD RI (`DashboardAdmin.jsx`). | - [ ] |
| 2 | Buka daftar riwayat pengerjaan kuis peserta yang memerlukan tinjauan. | Kasus: Peserta mengalami kendala jaringan saat ujian | Daftar peserta dan rincian jawaban per butir soal tampil secara transparan. | - [ ] |
| 3 | Lakukan tindakan **Reset Percobaan Ujian (Exam Reset)** untuk peserta tersebut. | ID Percobaan: `ATTEMPT-881` | Status percobaan tereset, sistem mencatat riwayat pada audit trail, dan peserta dapat mengulang ujian kembali. | - [ ] |
| 4 | Buka menu **Laporan & Analitik Pembelajaran** (`ReportsAdmin.jsx`). | Filter Unit: **"Kantor DPD RI Provinsi Jawa Timur"** | Grafik statistik dan tabel menampilkan capaian pembelajaran serta total perolehan JP pegawai kantor daerah tersebut secara akurat. | - [ ] |
| 5 | Klik tombol **Ekspor Laporan (Excel / CSV)**. | Format: `.xlsx` / `.csv` | Berkas terunduh rapi dengan kolom: No, Nama Pegawai, NIP, Unit Kerja / Kantor Daerah, Judul Pelatihan, Nilai Evaluasi, Bobot JP, Status Lulus, dan Nomor Sertifikat. | - [ ] |

---

## 6. ALUR PENGELOLAAN TEMUAN BUG (ISSUE TRIAGING & SLA)

Untuk menjamin kelancaran evaluasi dan kepastian tindak lanjut selama masa pengujian berlangsung, seluruh temuan kendala teknis wajib ditangani mengikuti SOP berikut:

```
+-----------------------------------------------------------------------------------+
|                     DIAGRAM ALUR PENGELOLAAN DEFECT / BUG UAT                     |
+-----------------------------------------------------------------------------------+

   [ Penguji Setjen DPD RI ] ───────► [ Temukan Kendala / Bug saat UAT ]
                                                │
                                                ▼
                                  [ Catat pada UAT Bug Tracker ]
                                  - ID Skenario Test Case
                                  - Langkah Reproduksi (Steps to Reproduce)
                                  - Bukti Tangkapan Layar / Console Log
                                                │
                                                ▼
                                   [ QA Lead & Release Manager ]
                             (Bersama Bagian Pengembangan Kapasitas SDM)
                                                │
                 ┌──────────────────────────────┼──────────────────────────────┐
                 ▼                              ▼                              ▼
      [ BLOCKER / CRITICAL ]                 [ MAJOR ]                  [ MINOR / TRIVIAL ]
      - Sistem terhenti total                - Fitur utama gagal         - Kosmetik / Label
      - Kegagalan SSO Nusa                   - Ada workaround sulit      - Perataan tata letak
      - Kebocoran NIP asli                   - Rekap JP salah            - Typo redaksional
                 │                              │                              │
                 ▼ (SLA < 4 Jam)                ▼ (SLA < 12 Jam)               ▼ (SLA < 24 Jam)
                 └──────────────────────────────┼──────────────────────────────┘
                                                │
                                                ▼
                                  [ Tim Pengembang Kapasitas SDM ]
                                  (Perbaikan di Branch Bugfix UAT)
                                                │
                                                ▼
                                   [ Internal QA Verification ]
                                                │
                                                ▼
                                  [ Deploy Patch ke Server UAT ]
                                                │
                                                ▼
                                   [ User Re-test & Sign-Off ]
```

---

### 6.1 Matriks Klasifikasi Keparahan Bug (Severity Matrix & Target SLA)

| Tingkat Keparahan (*Severity*) | Definisi & Karakteristik Dampak | Contoh Kasus pada LMS Setjen DPD RI | Service Level Agreement (SLA Target Penyelesaian) |
| :--- | :--- | :--- | :--- |
| **Severity 1: Blocker** | Sistem mati total (*crash*), jalur masuk autentikasi putus total, tidak ada alternatif (*no workaround*), atau celah keamanan kritis. | Callback SSO Nusa melempar error 500 secara konsisten; server database crash; video materi tidak bisa dimuat sama sekali. | **Maksimal 4 Jam Kerja** (Sesi pengujian pada modul terkait ditunda sementara). |
| **Severity 2: Critical** | Fitur operasional utama gagal bekerja dan memutus alur bisnis penting pengguna. | Peserta yang lulus passing grade tidak menerima sertifikat; paket SCORM macet tanpa mengirim progres; akumulasi JP tidak tersimpan. | **Maksimal 8 Jam Kerja**. |
| **Severity 3: Major** | Fitur penting mengalami malfungsi, namun ada solusi sementara (*workaround*) yang dapat dilakukan penguji. | Filter unit kerja pada laporan ekspor Excel tidak berfungsi di browser Firefox; notifikasi in-app terlambat tampil. | **Maksimal 12 Jam Kerja**. |
| **Severity 4: Minor / Trivial** | Gangguan tampilan antarmuka (UI/UX), salah ketik redaksional (*typo*), atau inkonsistensi penamaan istilah keparlemenan DPD RI. | Label unit kerja terpotong pada resolusi tablet; logo Setjen DPD RI bergeser 4px; redaksional petunjuk evaluasi kuis keliru. | **Maksimal 24 Jam Kerja** (Dapat dibundel dalam patch harian). |

---

### 6.2 Format Formulir Pelaporan Bug (Bug Report Template)
Penguji dari pihak Setjen DPD RI dapat mencatat temuan menggunakan format ringkas berikut:

```markdown
**ID Laporan**: BUG-UAT-[Nomor Urut, contoh: BUG-UAT-005]
**Tanggal & Waktu Temuan**: YYYY-MM-DD HH:mm WIB
**Pelapor**: [Nama Penguji / Unit Kerja (Biro/Pusat/Inspektorat/Kantor Daerah)]
**Peran Pengguna yang Digunakan**: [Student / Instructor / Admin SDM]
**Metode Autentikasi**: [SSO Nusa DPD / Google OAuth]
**Modul / Halaman URL**: [Misal: https://lms-uat.dpd.go.id/student/courses/12/learn]
**Perangkat & Browser**: [Contoh: Windows 11 / Google Chrome 124]

**Ringkasan Isu**:
[Deskripsi singkat dan padat mengenai kendala yang terjadi]

**Langkah untuk Mereproduksi (Steps to Reproduce)**:
1. Masuk via SSO Nusa DPD ...
2. Buka modul ...
3. Klik tombol ...
4. Amati respons sistem ...

**Hasil Aktual (Actual Result)**:
[Tulis apa yang terjadi, sertakan kode status HTTP jika ada, misal: 403 Forbidden]

**Hasil yang Diharapkan (Expected Result)**:
[Tulis apa yang seharusnya terjadi sesuai standar operasional]

**Tingkat Keparahan yang Diusulkan**: [Blocker / Critical / Major / Minor]
**Lampiran Bukti**: [Sertakan screenshot layar penuh atau file rekaman layar]
```

---

## 7. LEMBAR PENGESAHAN KESIAPAN (SIGN-OFF SHEET)

Dokumen ini menyatakan bahwa seluruh penyesuaian tata kelola organisasi resmi, keselarasan ekosistem pembelajaran dan autentikasi (**LMSetjen DPD RI & SSO Nusa**) yang dikembangkan penuh oleh **Bagian Pengembangan Kapasitas SDM**, dukungan infrastruktur jaringan oleh **Bagian Pengembangan Sistem Informasi**, serta arsitektur autentikasi tanpa sandi (*passwordless*) telah divalidasi secara menyeluruh. Lingkungan sistem secara resmi diserahterimakan untuk pelaksanaan UAT.

```
+-----------------------------------------------------------------------------------+
|                        PERSETUJUAN KELAYAKAN PELAKSANAAN UAT                      |
+-----------------------------------------------------------------------------------+
```

- [ ] **Kesiapan Infrastruktur & Jaringan (Bagian Pengembangan Sistem Informasi)**:
  *Nama:* _______________________  
  *Jabatan:* Pengelola Infrastruktur TI & Jaringan  
  *Tanggal:* ____________________  
  *Catatan:* Container Docker, NGINX HTTPS, PostgreSQL `lms_uat_db`, Redis, dan konektivitas jaringan server beroperasi normal.

- [ ] **Kesiapan Kualitas Perangkat Lunak & Test Script (Principal QA Lead)**:
  *Nama:* _______________________  
  *Tanggal:* ____________________  
  *Catatan:* Zero blocker defect, DoR terpenuhi 100%, 5 skenario bisnis E2E passwordless siap dievaluasi.

- [ ] **Penerimaan Kesiapan Sistem untuk Diuji (Bagian Pengembangan Kapasitas SDM)**:
  *Nama:* _______________________  
  *NIP:* ________________________  
  *Jabatan:* Kepala Bagian / Pengembang Utama LMSetjen DPD RI & SSO Nusa  
  *Biro:* Biro Organisasi, Keanggotaan, dan Kepegawaian  
  *Tanggal:* ____________________  
  *Catatan:* Menyetujui dimulainya fase pengujian penerimaan pengguna (UAT) untuk ekosistem LMS dan SSO Nusa Setjen DPD RI.
