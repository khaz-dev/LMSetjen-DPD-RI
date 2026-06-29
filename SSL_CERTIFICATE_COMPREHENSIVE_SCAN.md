# LMSetjen DPD RI: Comprehensive SSL/Certificate & External API Scan Report
**Date:** June 15, 2026 | **Scope:** Complete Project Audit

---

## Executive Summary

This document contains a **complete audit** of SSL/certificate handling and external API integration in the LMSetjen DPD RI project. The system implements:

1. **Frontend → Nginx HTTPS** with Let's Encrypt certificates
2. **Backend → External API (cmb.dpd.go.id)** with configurable SSL verification
3. **Docker environment** with system CA certificates support
4. **Custom CA bundle support** for external API endpoints

**Critical Finding:** SSL verification for external API calls is **enabled by default** but can be overridden via environment variables.

---

## 1. SSL/CERTIFICATE HANDLING

### 1.1 Environment Variables (Configuration)

**File:** [.env.example](.env.example) (lines 23, 92-95)
```env
USE_SSL=False                                    # Line 23
EXTERNAL_API_VERIFY_SSL=True                    # Line 92
EXTERNAL_API_CA_BUNDLE=                         # Line 95
# Optional: absolute path inside backend container to custom CA bundle file
# Example: /etc/ssl/certs/ca-certificates.crt or /app/certs/cmb-ca-chain.pem
```

**File:** [.env.staging](.env.staging) (lines 21, 100-104)
```env
USE_SSL=True                                     # Line 21
# 3. SSL/HTTPS:
#    - SSL certificates configured on nginx
#    - DEBUG=False enforces HTTPS redirects
#    - Let's Encrypt certificates at: /etc/letsencrypt/live/lms.khaz.app/
```

**Key Configuration Variables:**
| Variable | Default | Purpose | File |
|----------|---------|---------|------|
| `USE_SSL` | False | Enable HTTPS in Django | .env.example:23, .env.staging:21 |
| `EXTERNAL_API_VERIFY_SSL` | True | Verify SSL for external API | .env.example:92 |
| `EXTERNAL_API_CA_BUNDLE` | (empty) | Custom CA bundle path | .env.example:95 |
| `EXTERNAL_API_BASE_URL` | https://cmb.dpd.go.id | External API endpoint | .env.example:86 |

---

### 1.2 Backend Settings Configuration

**File:** [backend/backend/settings.py](backend/backend/settings.py)

#### SSL/HTTPS Settings (Lines 595-621)
```python
# Line 597-607: SSL Configuration
if not DEBUG:
    USE_SSL = env.bool('USE_SSL', default=False)
    
    if USE_SSL:
        SECURE_SSL_REDIRECT = True
        SECURE_HSTS_SECONDS = 31536000  # 1 year
        SECURE_HSTS_INCLUDE_SUBDOMAINS = True
        SECURE_HSTS_PRELOAD = True
        SESSION_COOKIE_SECURE = True
        CSRF_COOKIE_SECURE = True
    
    # Line 609-612: Always enable these security headers
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_BROWSER_XSS_FILTER = True

# Line 614-622: Proxy SSL configuration
X_FRAME_OPTIONS = 'SAMEORIGIN'
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
USE_X_FORWARDED_PORT = True
```

#### External API Configuration (Lines 635-645)
```python
EXTERNAL_API_BASE_URL = env('EXTERNAL_API_BASE_URL', default='https://cmb.dpd.go.id')
EXTERNAL_API_USERS_ENDPOINT = env('EXTERNAL_API_USERS_ENDPOINT', default='/api/pegawai')
EXTERNAL_API_TOKEN = env('EXTERNAL_API_TOKEN', default='set-me-in-env-file')
EXTERNAL_API_TOKEN_HEADER = env('EXTERNAL_API_TOKEN_HEADER', default='X-API-TOKEN')
EXTERNAL_API_TIMEOUT = env.int('EXTERNAL_API_TIMEOUT', default=30)
EXTERNAL_API_QUERY_ALL = env.bool('EXTERNAL_API_QUERY_ALL', default=False)
EXTERNAL_API_VERIFY_SSL = env.bool('EXTERNAL_API_VERIFY_SSL', default=True)
EXTERNAL_API_CA_BUNDLE = env('EXTERNAL_API_CA_BUNDLE', default='')
```

---

### 1.3 Git Ignore Configuration for Certificates

**File:** [.gitignore](.gitignore) (Lines 164-166)
```gitignore
# SSL Certificates
*.pem
*.key
*.crt
```

**Implication:** Certificate files (`.pem`, `.key`, `.crt`) are **NOT tracked in git** and must be:
- Stored outside the repository
- Deployed separately to production servers
- Mounted as Docker volumes or placed in containers during deployment

---

## 2. EXTERNAL API INTEGRATION (cmb.dpd.go.id)

### 2.1 API Endpoint Configuration

**References:**
- [.env.example](.env.example): Lines 86-95
- [backend/backend/settings.py](backend/backend/settings.py): Lines 638-645

**Configuration:**
```
Base URL:      https://cmb.dpd.go.id
Endpoint:      /api/pegawai
Token Header:  X-API-TOKEN (configurable)
Timeout:       30 seconds
Query All:     False (only sync changed/new users by default)
```

### 2.2 SyncExternalUsersAPIView - Complete Implementation

**File:** [backend/api/views.py](backend/api/views.py) (Lines 8522-8800+)

#### Key Methods:

**Line 8590: Build SSL Verification Mode**
```python
def _build_external_api_verify(self):
    """Build TLS verification mode for requests (bool or CA bundle path)."""
    verify_ssl = getattr(settings, 'EXTERNAL_API_VERIFY_SSL', True)
    ca_bundle = str(getattr(settings, 'EXTERNAL_API_CA_BUNDLE', '') or '').strip()

    if not verify_ssl:
        return False

    if ca_bundle:
        return ca_bundle

    return True
```

**Line 8714-8757: HTTP Request with SSL Error Handling**
```python
try:
    response = requests.get(
        full_api_url,
        headers=headers,
        verify=verify_mode,  # Uses result from _build_external_api_verify()
        timeout=getattr(settings, 'EXTERNAL_API_TIMEOUT', 30)
    )
    print(f"Response status code: {response.status_code}")

# Line 8721: SSL Error Handling
except requests.exceptions.SSLError as ssl_error:
    ssl_hint = (
        "TLS certificate verification failed when calling external API. "
        "Configure EXTERNAL_API_CA_BUNDLE with trusted CA chain or set "
        "EXTERNAL_API_VERIFY_SSL=False only for temporary troubleshooting."
    )
    error_msg = f"External API SSL error: {str(ssl_error)}. {ssl_hint}"
    sync_record.fail_sync(error_msg)
    update_sync_state(
        is_syncing=False,
        status='error',
        completion_timestamp=datetime.now().isoformat()
    )
    return Response({'error': error_msg}, status=status.HTTP_502_BAD_GATEWAY)

# Line 8735: General Request Error Handling
except requests.exceptions.RequestException as req_error:
    upstream_error_msg = f"External API request failed: {str(req_error)}"
    sync_record.fail_sync(upstream_error_msg)
    update_sync_state(
        is_syncing=False,
        status='error',
        completion_timestamp=datetime.now().isoformat()
    )
    return Response({'error': upstream_error_msg}, status=status.HTTP_502_BAD_GATEWAY)
```

#### Error States Recorded (Lines 8728, 8737, 8750, 8765, 8776):
- SSL certificate verification failures
- Network/timeout failures
- Non-JSON responses
- HTTP error status codes (≥400)
- Data format errors

---

### 2.3 API Authentication Headers

**File:** [backend/api/views.py](backend/api/views.py) (Lines 8576-8585)
```python
def _build_external_api_headers(self):
    """Build authentication headers for external API request."""
    token_header = getattr(settings, 'EXTERNAL_API_TOKEN_HEADER', 'X-API-TOKEN')
    token_value = getattr(settings, 'EXTERNAL_API_TOKEN', '')

    headers = {'Accept': 'application/json'}
    if token_value:
        headers[token_header] = token_value
        # Send legacy casing as compatibility fallback.
        headers['X-API-Token'] = token_value
    return headers
```

**Features:**
- Primary header: `X-API-TOKEN` (configurable via `EXTERNAL_API_TOKEN_HEADER`)
- Fallback header: `X-API-Token` (for legacy compatibility)
- Value from: `EXTERNAL_API_TOKEN` environment variable

---

### 2.4 Response Handling and Normalization

**File:** [backend/api/views.py](backend/api/views.py) (Lines 8620-8670)

**User Field Mapping (Flexible):**
```python
normalized = {
    'id': pick_first_value(['id', 'external_id', 'pegawai_id', 'id_pegawai', 'nip']),
    'name': pick_first_value(['name', 'nama', 'full_name', 'nama_pegawai']),
    'email': pick_first_value(['email', 'mail']),
    'nip': pick_first_value(['nip', 'no_induk_pegawai', 'nomor_induk']),
    'golongan': pick_first_value(['golongan', 'gol']),
    'kelas_jabatan': pick_first_value(['kelas_jabatan', 'kelasjabatan']),
    'jenis_jabatan': pick_first_value(['jenis_jabatan', 'jenisjabatan']),
    'unit_organisasi': normalize_nested_entity(...),
    'jabatan': normalize_nested_entity(...)
}
```

---

## 3. DOCKER & CONTAINER CONFIGURATION

### 3.1 Backend Dockerfile

**File:** [backend/Dockerfile](backend/Dockerfile)

#### Stage 1 - Base Image (Lines 1-28)
```dockerfile
FROM python:3.11-slim as base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Line 17-24: CA Certificate Installation
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    gcc \
    g++ \
    libpq-dev \
    postgresql-client \
    ffmpeg \
    libmagic1 \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*
```

**Key Security Features:**
- System `ca-certificates` package installed (for system-level SSL verification)
- `update-ca-certificates` executed to initialize CA trust store
- Multi-stage build for optimization
- Non-root user (appuser UID 1000)
- Application directories with proper permissions

#### Stage 3 - Production Image (Lines 36-71)
```dockerfile
FROM base as production

# Copy installed packages from dependencies stage
COPY --from=dependencies /usr/local/lib/python3.11/site-packages ...
COPY --from=dependencies /usr/local/bin /usr/local/bin

# Copy application code
COPY --chown=appuser:appuser . .

# Create necessary directories
RUN mkdir -p /app/media /app/static /app/staticfiles /app/logs /app/temp_uploads

# Switch to non-root user
USER appuser

# Expose port 8001
EXPOSE 8001

# Health check with error handling
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; ..."
```

---

### 3.2 Docker Compose Configuration

**File:** [docker-compose.yml](docker-compose.yml) (Lines 1-120)

#### Backend Service Configuration (Lines 17-80)
```yaml
backend:
  build:
    context: ./backend
    dockerfile: Dockerfile
    target: production
  container_name: lms_backend
  restart: unless-stopped
  env_file: .env
  environment:
    # Database: Uses host PostgreSQL (172.18.0.1)
    DB_HOST: 172.18.0.1
    DB_PORT: ${DB_PORT:-5433}
    
    # Redis: Docker container
    REDIS_HOST: redis
    REDIS_PORT: 6381
    
    # Site URLs
    FRONTEND_SITE_URL: ${FRONTEND_SITE_URL:-http://localhost:5174}
    BACKEND_SITE_URL: ${BACKEND_SITE_URL:-http://localhost:8001}
    
    # CORS & Security
    CORS_ALLOWED_ORIGINS: ${CORS_ALLOWED_ORIGINS:-...}
    CSRF_TRUSTED_ORIGINS: ${CSRF_TRUSTED_ORIGINS:-...}
  
  volumes:
    - ./backend:/app                        # Application code
    - media_files:/app/media                # Media uploads
    - static_files:/app/staticfiles         # Static files
    - backend_logs:/app/logs                # Application logs
  
  ports:
    - "8001:8001"
  
  depends_on:
    redis:
      condition: service_healthy
  
  networks:
    - lms_network
  
  command: >
    sh -c "
      python manage.py wait_for_db &&
      python manage.py migrate --noinput &&
      python manage.py init_db --skip-if-exists &&
      python manage.py collectstatic --noinput --clear &&
      gunicorn --bind 0.0.0.0:8001 --workers 4 --threads 2 --timeout 120 ...
    "
```

---

### 3.3 Python Dependencies for SSL/Requests

**File:** [backend/requirements.txt](backend/requirements.txt)

```txt
certifi==2023.11.17          # Line 4: SSL certificate validation
requests==2.31.0             # Line 35: HTTP requests library
urllib3==1.26.18             # Line 44: HTTP client for requests
```

**Versions:**
- `certifi`: Provides Mozilla CA bundle for SSL verification
- `requests`: High-level HTTP client with built-in SSL support
- `urllib3`: Low-level HTTP client (depended on by requests)

**SSL Verification Flow:**
1. `requests` uses `urllib3` for HTTP calls
2. `urllib3` uses `certifi` for default CA bundle
3. Custom CA bundle can override via `verify` parameter

---

## 4. FRONTEND INTEGRATION

### 4.1 Sync External Users Endpoint

**File:** [frontend/src/views/admin/UsersAdmin.jsx](frontend/src/views/admin/UsersAdmin.jsx)

#### API Call (Line 418)
```javascript
const syncPromise = api.post("/admin/sync-external-users/", {}, {
    signal: abortControllerRef.current.signal
});
```

#### Progress Polling (Lines 428-450)
```javascript
progressPollInterval = setInterval(async () => {
    if (shouldStopPolling) return;
    
    try {
        const progressResponse = await api.get("/admin/sync-progress/");
        
        if (progressResponse.data) {
            setSyncProgress(prev => ({
                ...prev,
                created: progressResponse.data.created || 0,
                updated: progressResponse.data.updated || 0,
                failed: progressResponse.data.failed || 0,
                total: progressResponse.data.total || prev.total,
                errors: progressResponse.data.errors || [],
                ...
            }));
            
            // SMART POLLING: Check if backend says sync is done
            if (progressResponse.data.completion_timestamp && !progressResponse.data.is_syncing) {
                console.log("Backend completed sync, stopping polling");
                shouldStopPolling = true;
            }
        }
    } catch (pollError) {
        // Silently fail on poll errors - polling is best-effort
        console.debug("Progress poll error (non-critical):", pollError);
    }
}, 500); // Poll every 500ms for real-time updates
```

#### Error Handling (Lines 540-556)
```javascript
} catch (error) {
    console.error("Error syncing external users:", error);
    
    setSyncProgress(prev => ({
        ...prev,
        status: "error",
        message: error.response?.data?.error || "Gagal menyinkronkan data pengguna eksternal",
        errors: [error.response?.data?.error || error.message]
    }));
    
    Toast().fire({
        icon: "error",
        title: error.response?.data?.error || "Gagal menyinkronkan data pengguna eksternal"
    });
}
```

**Error Display:**
- User sees: `error.response?.data?.error` (from backend)
- Fallback: "Gagal menyinkronkan data pengguna eksternal" (Indonesian for "Failed to sync external user data")
- Toast notification with error message

---

### 4.2 Backend URLs

**File:** [backend/api/urls.py](backend/api/urls.py) (Lines 185-187)

```python
path("admin/sync-external-users/", api_views.SyncExternalUsersAPIView.as_view()),
path("admin/sync-progress/", api_views.SyncProgressAPIView.as_view()),
path("admin/last-sync-info/", api_views.LastSyncInfoAPIView.as_view()),
```

**Endpoints:**
| Endpoint | Method | Purpose | Authentication |
|----------|--------|---------|-----------------|
| `/admin/sync-external-users/` | POST | Trigger sync | JWT, Admin only |
| `/admin/sync-progress/` | GET | Get real-time progress | JWT, Admin only |
| `/admin/last-sync-info/` | GET | Get last successful sync timestamp | JWT, Admin only |

---

## 5. SYNC HISTORY & PROGRESS TRACKING

### 5.1 SyncHistory Model

**File:** [backend/api/models.py](backend/api/models.py) (Lines 1664-1810)

```python
class SyncHistory(models.Model):
    """Track synchronization history of external user data."""
    
    sync_type = models.CharField(max_length=50, default='external_users')
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ('in_progress', 'In Progress'),
            ('completed', 'Completed'),
            ('failed', 'Failed'),
            ('cancelled', 'Cancelled')
        ],
        default='in_progress'
    )
    
    # Statistics
    total_records = models.IntegerField(default=0)
    created_records = models.IntegerField(default=0)
    updated_records = models.IntegerField(default=0)
    failed_records = models.IntegerField(default=0)
    
    # Error tracking
    error_message = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
```

#### Key Methods:

**Line 1740: Get Last Successful Sync**
```python
@classmethod
def get_last_successful_sync(cls, sync_type='external_users'):
    """Get the last successful sync record"""
    return cls.objects.filter(
        sync_type=sync_type,
        status='completed'
    ).first()
```

**Line 1766: Mark Sync as Failed**
```python
def fail_sync(self, error_message, notes=None):
    """Mark sync as failed"""
    self.status = 'failed'
    self.completed_at = timezone.now()
    self.error_message = error_message  # Stores error message (including SSL errors)
    if notes:
        self.notes = notes
    self.save()
```

---

### 5.2 SyncProgressAPIView

**File:** [backend/api/views.py](backend/api/views.py) (Lines 9018-9085)

```python
class SyncProgressAPIView(APIView):
    """Get real-time progress of ongoing sync operation"""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Verify admin access
        if not hasattr(request.user, 'role') or not (request.user.is_admin):
            return Response(
                {'error': 'Admin access required. Only admins can view sync progress.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Return current sync state (in-memory for real-time progress)
        state = get_sync_state()
        
        # Get last successful sync from database
        last_successful_sync = api_models.SyncHistory.get_last_successful_sync('external_users')
        
        # ... Return state + last_sync_info
```

**Response Fields:**
- `is_syncing`: Boolean (sync in progress)
- `status`: idle|initializing|syncing|completed|error|cancelled
- `completion_timestamp`: ISO timestamp when sync completed
- `last_successful_sync_timestamp`: ISO timestamp of last successful sync
- `created`, `updated`, `failed`, `total`: Statistics
- `errors`: Array of error details
- `last_sync_info`: Complete info from database

---

### 5.3 LastSyncInfoAPIView

**File:** [backend/api/views.py](backend/api/views.py) (Lines 9130-9160)

```python
def get(self, request):
    try:
        # Get last successful sync from database
        last_sync = api_models.SyncHistory.get_last_successful_sync('external_users')
        
        if not last_sync:
            return Response({
                'last_sync_time': None,
                'sync_info': None,
                'message': 'No sync history available'
            }, status=status.HTTP_200_OK)
        
        sync_info = {
            'id': last_sync.id,
            'started_at': last_sync.started_at.isoformat(),
            'completed_at': last_sync.completed_at.isoformat() if last_sync.completed_at else None,
            'status': last_sync.status,
            'total_records': last_sync.total_records,
            'created_records': last_sync.created_records,
            'updated_records': last_sync.updated_records,
            'failed_records': last_sync.failed_records,
            'total_changed': last_sync.total_changed,
            'duration': last_sync.duration,
            'duration_seconds': last_sync.duration_seconds,
            'notes': last_sync.notes
        }
        
        return Response({
            'last_sync_time': last_sync.completed_at.isoformat() if last_sync.completed_at else None,
            'sync_info': sync_info
        }, status=status.HTTP_200_OK)
```

---

## 6. NGINX SSL CONFIGURATION

### 6.1 Standard Configuration

**File:** [nginx-lms.conf](nginx-lms.conf) (Lines 1-50)

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name lms.khaz.app www.lms.khaz.app;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Main HTTPS server block
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name lms.khaz.app www.lms.khaz.app;
    
    # Let's Encrypt certificate paths
    ssl_certificate /etc/letsencrypt/live/khaz.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/khaz.app/privkey.pem;
    
    # SSL configuration (A+ rating)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    ...
}
```

---

### 6.2 Complete Subdomain Configuration

**File:** [nginx-lms-complete.conf](nginx-lms-complete.conf) (Lines 1-50)

```nginx
# Subdomains:
# - lms.khaz.app → Frontend (React/Vite on port 5174)
# - lms-be.khaz.app → Backend API (Django/Gunicorn on port 8001)

# HTTP → HTTPS redirect (ALL DOMAINS)
server {
    listen 80;
    server_name lms.khaz.app lms-be.khaz.app www.lms.khaz.app;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS - Frontend (lms.khaz.app)
server {
    listen 443 ssl http2;
    server_name lms.khaz.app;
    
    ssl_certificate /etc/letsencrypt/live/khaz.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/khaz.app/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_stapling on;
    ...
}
```

**Certificate Paths:**
- Fullchain: `/etc/letsencrypt/live/khaz.app/fullchain.pem`
- Private Key: `/etc/letsencrypt/live/khaz.app/privkey.pem`

---

## 7. OTHER REQUEST INTEGRATIONS

### 7.1 Google OAuth Verification

**File:** [backend/api/sso_utils.py](backend/api/sso_utils.py)

#### Line 311: Userinfo Request
```python
response = requests.get(
    GoogleOAuthVerifier.GOOGLE_USERINFO_URL,
    headers=headers
)
# No explicit verify parameter = uses default SSL verification
```

#### Line 319: Exception Handling
```python
except requests.exceptions.RequestException as e:
    # Catches all request errors including SSL errors
```

#### Line 349: Token Info Request
```python
response = requests.get(
    GoogleOAuthVerifier.GOOGLE_TOKEN_INFO_URL,
    params=params
)
```

#### Line 374: Exception Handling
```python
except requests.exceptions.RequestException as e:
    # Catches all request errors
```

---

### 7.2 YouTube Video Metadata Retrieval

**File:** [backend/api/url_utils.py](backend/api/url_utils.py) (Line 150)

```python
response = requests.get(noembed_url, timeout=10)
# Uses default SSL verification for YouTube API
```

---

## 8. DEPLOYMENT & CERTIFICATE MANAGEMENT

### 8.1 Let's Encrypt Integration

**References:**
- [STAGING_DEPLOYMENT_GUIDE_MAY_2026.md](STAGING_DEPLOYMENT_GUIDE_MAY_2026.md)
- [docs/DEPLOYMENT_GUIDE_UBUNTU.md](docs/DEPLOYMENT_GUIDE_UBUNTU.md)

**Certificate Locations (Staging):**
```bash
# Staging server (khaz.app domain)
/etc/letsencrypt/live/khaz.app/fullchain.pem
/etc/letsencrypt/live/khaz.app/privkey.pem

# Production server (lms.dpd.go.id domain) - documented
/etc/letsencrypt/live/lms.dpd.go.id/fullchain.pem
/etc/letsencrypt/live/lms.dpd.go.id/privkey.pem
```

---

### 8.2 Manual Certificate Placement

**From:** [docs/DEPLOYMENT_GUIDE_UBUNTU.md](docs/DEPLOYMENT_GUIDE_UBUNTU.md) (Lines 300-301)

```
1. Place fullchain.pem at: `/etc/letsencrypt/live/lms.dpd.go.id/fullchain.pem`
2. Place privkey.pem at: `/etc/letsencrypt/live/lms.dpd.go.id/privkey.pem`
```

---

## 9. SSL VERIFICATION FALLBACK MECHANISMS

### 9.1 Troubleshooting Flow

**When SSL verification fails:**

1. **Error is caught:** `requests.exceptions.SSLError` (Line 8721)

2. **User-friendly hint provided:**
   ```
   TLS certificate verification failed when calling external API.
   Configure EXTERNAL_API_CA_BUNDLE with trusted CA chain or set
   EXTERNAL_API_VERIFY_SSL=False only for temporary troubleshooting.
   ```

3. **Response returned:**
   - HTTP Status: `502 Bad Gateway`
   - Error Message: Sent to frontend
   - Sync Status: Marked as `failed` in database

4. **Workaround Options:**
   - Option A: Set `EXTERNAL_API_VERIFY_SSL=False` (insecure)
   - Option B: Set `EXTERNAL_API_CA_BUNDLE=/path/to/ca-chain.pem` (secure)
   - Option C: Update system CA certificates in Docker

---

### 9.2 CA Bundle Configuration

**Environment Variable:** `EXTERNAL_API_CA_BUNDLE`

**Examples:**
```env
# System CA bundle (all containers)
EXTERNAL_API_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt

# Custom CA chain
EXTERNAL_API_CA_BUNDLE=/app/certs/cmb-ca-chain.pem

# Mozilla CA bundle (from certifi)
EXTERNAL_API_CA_BUNDLE=/usr/local/lib/python3.11/site-packages/certifi/cacert.pem
```

**How it's used (Line 8717):**
```python
response = requests.get(
    full_api_url,
    headers=headers,
    verify=verify_mode,  # Can be True, False, or path string
    timeout=...
)
```

When `verify` is a path string:
- `requests` passes it to `urllib3`
- `urllib3` loads certificates from that path
- SSL verification happens against those certificates only

---

## 10. SECURITY HEADERS & CONFIGURATION

### 10.1 Django Security Settings

**File:** [backend/backend/settings.py](backend/backend/settings.py) (Lines 595-621)

```python
if not DEBUG:
    USE_SSL = env.bool('USE_SSL', default=False)
    
    if USE_SSL:
        SECURE_SSL_REDIRECT = True                # Force HTTPS
        SECURE_HSTS_SECONDS = 31536000           # 1 year
        SECURE_HSTS_INCLUDE_SUBDOMAINS = True    # Include subdomains
        SECURE_HSTS_PRELOAD = True               # HSTS preload list
        SESSION_COOKIE_SECURE = True             # HTTPS only cookies
        CSRF_COOKIE_SECURE = True                # HTTPS only CSRF tokens
    
    SECURE_CONTENT_TYPE_NOSNIFF = True           # Always enabled
    SECURE_BROWSER_XSS_FILTER = True             # Always enabled

# Proxy trust (for nginx reverse proxy)
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
USE_X_FORWARDED_PORT = True

# Allow iframe from same origin
X_FRAME_OPTIONS = 'SAMEORIGIN'
```

---

### 10.2 Nginx Security Headers

**From:** [nginx-lms.conf](nginx-lms.conf)

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
```

---

## 11. COMPLETE REQUEST FLOW DIAGRAM

```
FRONTEND (React)
    ↓
API Call: POST /admin/sync-external-users/
    ↓
DJANGO BACKEND
    ├─→ Verify: User is Admin
    ├─→ Build Request:
    │   ├─ URL: https://cmb.dpd.go.id/api/pegawai
    │   ├─ Headers: X-API-TOKEN (and fallback)
    │   ├─ Verify SSL: EXTERNAL_API_VERIFY_SSL
    │   └─ CA Bundle: EXTERNAL_API_CA_BUNDLE (if set)
    │
    ├─→ requests.get() → urllib3 → SSL verification
    │   ├─ If SSL error: return 502 + error message
    │   ├─ If network error: return 502 + error message
    │   └─ If success: proceed
    │
    ├─→ Parse Response JSON
    ├─→ Extract Users List
    ├─→ Normalize User Fields
    ├─→ Create/Update Users in DB
    ├─→ Store Sync History (with stats/errors)
    └─→ Return Results

FRONTEND (React)
    ├─→ Poll /admin/sync-progress/ every 500ms
    ├─→ Display Progress Bar + Stats
    ├─→ Show Success/Error Toast
    └─→ Refresh Users List

DATABASE
    └─→ SyncHistory: Records sync result + error message
```

---

## 12. VULNERABILITY & RISK ASSESSMENT

### 12.1 SSL Certificate Handling

| Item | Status | Risk | Mitigation |
|------|--------|------|-----------|
| **System CA Certificates** | ✅ Installed in Docker | Low | Via apt package manager |
| **Let's Encrypt Certificates** | ✅ Configured in nginx | Low | Automatic renewal (certbot) |
| **External API SSL Verification** | ✅ Enabled by default | Low | `EXTERNAL_API_VERIFY_SSL=True` |
| **Custom CA Bundle Support** | ✅ Implemented | Medium | Must be configured correctly |
| **Certificate Storage** | ✅ Gitignored | Low | Not tracked in git |
| **Fallback to verify=False** | ⚠️ Allowed via env var | **HIGH** | Only for troubleshooting |

### 12.2 External API Integration

| Item | Status | Risk | Mitigation |
|------|--------|------|-----------|
| **Token Storage** | ⚠️ In .env file | Medium | Use secrets management |
| **Token Header** | ✅ Configurable | Low | Flexible per API requirement |
| **Timeout** | ✅ Set (30s) | Low | Prevents hanging requests |
| **Error Handling** | ✅ Comprehensive | Low | All exceptions caught |
| **SSL Error Hints** | ✅ User-friendly | Low | Guides admin on resolution |
| **Response Validation** | ✅ Format-flexible | Medium | Handles multiple formats |

---

## 13. CRITICAL FILES SUMMARY

### Configuration Files
| File | Lines | Purpose |
|------|-------|---------|
| [.env.example](.env.example) | 86-95 | External API config template |
| [.env.staging](.env.staging) | 21, 100-104 | Staging environment settings |
| [backend/backend/settings.py](backend/backend/settings.py) | 595-645 | Django SSL & external API config |

### Code Files
| File | Lines | Purpose |
|------|-------|---------|
| [backend/api/views.py](backend/api/views.py) | 8522-9160 | All sync-related views |
| [backend/api/models.py](backend/api/models.py) | 1664-1810 | SyncHistory model |
| [frontend/src/views/admin/UsersAdmin.jsx](frontend/src/views/admin/UsersAdmin.jsx) | 418-556 | Frontend sync UI |

### Docker Files
| File | Purpose |
|------|---------|
| [backend/Dockerfile](backend/Dockerfile) | Backend container with CA certs |
| [docker-compose.yml](docker-compose.yml) | Service orchestration |

### Nginx Files
| File | Purpose |
|------|---------|
| [nginx-lms.conf](nginx-lms.conf) | Basic nginx config with SSL |
| [nginx-lms-complete.conf](nginx-lms-complete.conf) | Multi-subdomain SSL config |

---

## 14. RECOMMENDATIONS & NEXT STEPS

### Immediate Actions
1. ✅ **Review SSL Error Messages:** Admin will see detailed hints
2. ✅ **Configure CA Bundle:** If cmb.dpd.go.id uses self-signed certs
3. ✅ **Test Sync:** Monitor `SyncHistory` table for failures
4. ✅ **Check Logs:** Review `backend_logs` volume for detailed errors

### Production Deployment
1. ⚠️ **Use HTTPS:** Set `USE_SSL=True` in .env
2. ⚠️ **Configure Certificates:** Place Let's Encrypt certs at correct paths
3. ⚠️ **Set External API Token:** Add real API token to .env
4. ⚠️ **Verify External API:** Test connectivity before deployment

### Troubleshooting
- **SSL Error:** Check `EXTERNAL_API_CA_BUNDLE` or update system certificates
- **Connection Timeout:** Increase `EXTERNAL_API_TIMEOUT` if network is slow
- **Auth Error:** Verify `EXTERNAL_API_TOKEN` and `EXTERNAL_API_TOKEN_HEADER`
- **Sync Stalled:** Check `/admin/sync-progress/` endpoint or database logs

---

## 15. APPENDIX: Complete Error Flow

**SSL Certificate Verification Failure:**
```
1. requests.get() executed with verify=ca_bundle_path
2. urllib3 attempts SSL handshake
3. Certificate validation fails
4. SSLError raised
5. Caught at Line 8721
6. Error message generated
7. SyncHistory.fail_sync(error_msg) called
8. Error stored in database
9. Response returned to frontend (HTTP 502)
10. Frontend shows Toast with error message
11. Admin sees: "TLS certificate verification failed..."
```

**Successful Sync Flow:**
```
1. requests.get() succeeds
2. response.json() parses response
3. Users extracted and normalized
4. Each user: create or update in database
5. Statistics calculated
6. SyncHistory.complete_sync() called
7. Frontend polls /admin/sync-progress/ (every 500ms)
8. Progress displayed in real-time modal
9. Completion detected (is_syncing=False)
10. Frontend polls /admin/last-sync-info/
11. Last sync timestamp updated
12. Success Toast shown
13. Users list refreshed
```

---

**Document Generated:** June 15, 2026  
**Version:** 1.0 Complete  
**Status:** ✅ Ready for Production Review
