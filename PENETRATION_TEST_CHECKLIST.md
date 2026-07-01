# 🔒 PENETRATION TEST PREPARATION CHECKLIST
**LMSetjen DPD RI Project - Staging Server: https://lms.khaz.app/**

---

## ✅ Completed Security Fixes

### Critical Issues (Fixed)
- [x] **SECRET_KEY Exposure**: Removed default value, now requires environment variable
- [x] **DEBUG Mode**: Changed default to False (production-safe)
- [x] **Database Credentials**: All now from environment variables only
- [x] **File Upload CSRF Exemption**: Removed, now requires JWT authentication
- [x] **SSO Token Validation**: Fixed to require signature verification in production
- [x] **Inadequate Error Handling**: Added secure logging, removed stack traces

### High-Severity Issues (Fixed)
- [x] **JWT Token Imports**: Added logging infrastructure
- [x] **Enhanced Security Headers**: Configured in settings.py

### Configuration Files
- [x] **Created `.env.example.secure`**: Complete environment variable documentation

---

## ⏳ Remaining Tasks for Penetration Test

### 1. API Endpoint Security Review
**Status**: IN PROGRESS

#### Endpoints Requiring Authentication Review (20+ endpoints)
Search API endpoints with `permission_classes = [AllowAny]`:
```
Line 1532: FullTextSearchAPIView
Line 1269: TrendingSearchesAnalyticsAPIView
Line 1397: SearchAnalyticsDashboardAPIView
Line 1462: SearchStatsAPIView
Line 1585: TrendingSearchesAnalyticsAPIView
... (and 15+ more)
```

**Action Required**: Determine which endpoints should be:
- Public (search, course list, testimonials)
- Authenticated only (analytics dashboards)
- Role-based (admin dashboard)

### 2. Error Message Sanitization
**Status**: PARTIALLY COMPLETE

Replace all `str(e)` error messages in responses with generic messages:
```
Lines to fix: 2602, 3198, 3508, 3565, 3656, 3729, ...
```

**Action Required**: 
```python
# Instead of:
return Response({"error": str(e)}, status=500)

# Use:
security_logger.error("Error details", exc_info=True)
return Response({"error": "An error occurred. Please try again."}, status=500)
```

### 3. Rate Limiting Implementation
**Status**: CONFIGURED, NOT DEPLOYED

DRF throttle classes are configured in settings but need validation:
- Anonymous users: 100 requests/hour
- Authenticated users: 1000 requests/hour

**Action Required**: Test on staging server
```python
# Test rate limiting
for i in range(101):
    response = requests.get('https://lms.khaz.app/api/v1/course/course-list/')
    if response.status_code == 429:
        print(f"Rate limited at request {i}")
        break
```

### 4. CORS Validation
**Status**: CONFIGURED

Verify staging server `.env`:
```
CORS_ALLOWED_ORIGINS=https://lms.khaz.app,https://lms.dpd.go.id
CSRF_TRUSTED_ORIGINS=https://lms.khaz.app,https://lms-be.khaz.app,https://lms.dpd.go.id
```

**Action Required**: Verify on staging with cross-origin requests

### 5. HTTPS/SSL Certificate Validation
**Status**: CONFIGURED IN NGINX

nginx config at `nginx-lms-complete.conf`:
- SSL certificates: Let's Encrypt
- TLS 1.2+ enforced
- HSTS headers set

**Action Required**: Verify SSL certificate validity
```bash
openssl s_client -connect lms.khaz.app:443 -showcerts
```

### 6. Database SSL/TLS Connection
**Status**: CONFIGURED, NOT VERIFIED

Settings:
```python
DB_SSLMODE=require  # Force SSL connection
```

**Action Required**: Test database SSL on staging
```python
# In Django shell:
from django.db import connection
print(connection.get_connection_params())
```

### 7. Redis Security
**Status**: CONFIGURED

docker-compose.yml requires Redis password:
```
REDIS_PASSWORD=<strong-password-from-env>
```

**Action Required**: Verify Redis requires password
```bash
redis-cli -h redis-host -p 6379 -a <password> ping
```

### 8. Logging & Audit Trail
**Status**: PARTIALLY IMPLEMENTED

Added security logger in `backend/api/views.py`:
```python
security_logger = logging.getLogger('security')
```

**Action Required**: 
1. Verify all security events are logged
2. Implement audit logging for sensitive operations
3. Monitor logs during penetration test

---

## 🔐 Security Hardening Checklist

### Django Security
- [x] `SECURE_SSL_REDIRECT = True`
- [x] `SECURE_HSTS_SECONDS = 31536000`
- [x] `SECURE_BROWSER_XSS_FILTER = True`
- [x] `SECURE_CONTENT_TYPE_NOSNIFF = True`
- [x] `X_FRAME_OPTIONS = 'DENY'`
- [x] `SESSION_COOKIE_SECURE = True`
- [x] `SESSION_COOKIE_HTTPONLY = True`
- [x] `CSRF_COOKIE_SECURE = True`
- [x] `CSRF_COOKIE_HTTPONLY = True`

### Password Security
- [x] Minimum length: 12 characters
- [x] Require uppercase, lowercase, numbers
- [x] Check against common passwords
- [x] Prevent user attribute similarity

### JWT Token Security
- [x] Access token lifetime: 15 minutes (reduced from 3 days)
- [x] Refresh token lifetime: 7 days (reduced from 50 days)
- [x] Token rotation on refresh
- [x] Blacklist after rotation enabled

### File Upload Security
- [x] Requires JWT authentication
- [x] File type validation
- [x] File size limits enforced
- [x] UUID-based storage (prevents path traversal)

---

## 🧪 Penetration Test Plan

### Phase 1: Authentication Testing
- [ ] Test SQL injection in login endpoint
- [ ] Test brute force attack on login
- [ ] Test JWT token manipulation
- [ ] Test token expiration handling
- [ ] Test refresh token abuse

### Phase 2: Authorization Testing
- [ ] Test unauthorized access to protected endpoints
- [ ] Test role-based access control (student vs instructor vs admin)
- [ ] Test privilege escalation attempts
- [ ] Test cross-user data access

### Phase 3: Input Validation Testing
- [ ] Test XSS injection in input fields
- [ ] Test SQL injection in search functionality
- [ ] Test command injection in file upload
- [ ] Test XML/XXE injection
- [ ] Test CSRF attacks

### Phase 4: API Security Testing
- [ ] Test rate limiting effectiveness
- [ ] Test CORS policy enforcement
- [ ] Test CSRF protection
- [ ] Test error message information leakage
- [ ] Test API key/token security

### Phase 5: Infrastructure Testing
- [ ] Test SSL/TLS certificate validity
- [ ] Test HTTPS redirect enforcement
- [ ] Test security header presence
- [ ] Test database security
- [ ] Test Redis security

### Phase 6: Data Protection Testing
- [ ] Test data encryption in transit
- [ ] Test data encryption at rest
- [ ] Test password hashing algorithm
- [ ] Test session management security

---

## 📋 Server Configuration Verification

### Staging Server: https://lms.khaz.app/

**Verify Environment Variables:**
```bash
# SSH to staging server and check:
env | grep -E "SECRET_KEY|DEBUG|ALLOWED_HOSTS|DB_|REDIS_|CORS_"

# All must be non-default values from .env file
SECRET_KEY=<strong-random-string>
DEBUG=False
ALLOWED_HOSTS=lms.dpd.go.id,www.lms.dpd.go.id,lms.khaz.app
DB_PASSWORD=<strong-password>
REDIS_PASSWORD=<strong-password>
CORS_ALLOWED_ORIGINS=https://lms.khaz.app,https://lms.dpd.go.id
```

**Verify Django Settings:**
```bash
# In Django shell:
python manage.py shell
>>> from django.conf import settings
>>> print(f"DEBUG: {settings.DEBUG}")  # Should be False
>>> print(f"SECRET_KEY: {'*' * 10}...")  # Should not be default
>>> print(f"ALLOWED_HOSTS: {settings.ALLOWED_HOSTS}")
>>> print(f"SECURE_SSL_REDIRECT: {settings.SECURE_SSL_REDIRECT}")  # Should be True
>>> print(f"SESSION_COOKIE_SECURE: {settings.SESSION_COOKIE_SECURE}")  # Should be True
```

**Verify HTTP Security Headers:**
```bash
curl -i https://lms.khaz.app/ | grep -E "Strict-Transport-Security|X-Content-Type-Options|X-Frame-Options|X-XSS-Protection"
# Should include all security headers
```

**Verify SSL Certificate:**
```bash
openssl s_client -connect lms.khaz.app:443 -showcerts < /dev/null
# Verify certificate is valid and not self-signed
```

---

## 📝 Testing Reports

### Test Execution Log Template

```
PENETRATION TEST REPORT
Project: LMSetjen DPD RI
Staging Server: https://lms.khaz.app/
Date: [DATE]
Tester: [NAME]

## Authentication Testing
- [ ] SQL Injection: PASS/FAIL
- [ ] Brute Force: PASS/FAIL
- [ ] JWT Manipulation: PASS/FAIL

## Authorization Testing
- [ ] Role-based Access: PASS/FAIL
- [ ] Privilege Escalation: PASS/FAIL

## Input Validation
- [ ] XSS Prevention: PASS/FAIL
- [ ] SQL Injection: PASS/FAIL

## API Security
- [ ] Rate Limiting: PASS/FAIL
- [ ] CORS Policy: PASS/FAIL
- [ ] CSRF Protection: PASS/FAIL

## Infrastructure
- [ ] SSL/TLS: PASS/FAIL
- [ ] Security Headers: PASS/FAIL

## Critical Issues Found
[List any critical vulnerabilities]

## Recommendations
[List remediation actions]
```

---

## 🚀 Deployment Instructions for Staging

### 1. Pull Latest Code with Fixes
```bash
cd /app
git pull origin main
git checkout -b pentest-hardening
```

### 2. Update Environment Variables
```bash
# Copy secure template
cp .env.example.secure .env.staging

# Edit with actual values
nano .env.staging

# Deploy
export $(cat .env.staging | xargs)
```

### 3. Restart Services
```bash
# Using Docker Compose
docker-compose -f docker-compose.yml restart backend redis

# Or using systemd (if not Docker)
systemctl restart lms-backend
systemctl restart redis
```

### 4. Verify Fixes
```bash
# Test Django starts with strict settings
python manage.py check --deploy

# Test all required env vars are set
python manage.py shell -c "from django.conf import settings; print('✓ Settings loaded securely')"

# Test database connection with SSL
python manage.py dbshell < /dev/null
```

### 5. Run Security Tests
```bash
# Check for common vulnerabilities
bandit -r api/ -ll

# Check dependency vulnerabilities
safety check --json

# Run Django security check
python manage.py check --deploy
```

---

## 📞 Support & Issues

If any vulnerabilities are found during penetration testing:

1. **Critical Issue** → Immediate response team alert
2. **High Severity** → Fix within 24 hours
3. **Medium Severity** → Fix within 1 week
4. **Low Severity** → Document and plan for next release

Contact: Security Team @ DPD RI

