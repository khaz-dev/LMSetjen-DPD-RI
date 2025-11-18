# SSO Configuration Environment Variables

Add these environment variables to your `.env` file for SSO integration.

## Required Environment Variables

```bash
# SSO Provider Configuration
SSO_PROVIDER_URL=https://nusadpd.duckdns.org/
SSO_VERIFY_ENDPOINT=https://cmb.tail91813a.ts.net/sso/verify/

# JWT Token Settings for SSO
SSO_TOKEN_ALGORITHM=HS256          # Algorithm used (HS256 for HMAC, RS256 for RSA)
SSO_TOKEN_EXPIRY_SECONDS=300       # Token expiry time in seconds (5 minutes recommended)

# SSO Callback URLs (used for redirects)
SSO_CALLBACK_URL=https://lmsetjendpdri.duckdns.org/sso/
SSO_LOGIN_SUCCESS_URL=https://lmsetjendpdri.duckdns.org/student/dashboard/

# Logging
SSO_DEBUG_LOGGING=False            # Enable detailed SSO logging (False in production)
```

## Optional Environment Variables

```bash
# SSO Provider Public Key (if using RS256 signature verification)
# Get this from your SSO provider
SSO_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----

# SSO Provider Private Key (if you need to generate tokens for testing)
# WARNING: Never commit this to version control!
SSO_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQE...
-----END PRIVATE KEY-----

# Role Mapping (maps SSO roles to LMS roles)
SSO_ROLE_MAPPING_STUDENT=student
SSO_ROLE_MAPPING_TEACHER=teacher
SSO_ROLE_MAPPING_ADMIN=admin
```

## Example .env File

```bash
# ============================================
# Database Configuration
# ============================================
DB_NAME=django_lms_db
DB_USER=lms_user
DB_PASSWORD=your_secure_password

# ============================================
# Redis Configuration
# ============================================
REDIS_PASSWORD=your_redis_password

# ============================================
# Django Settings
# ============================================
SECRET_KEY=your-secret-key-here
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,16.79.83.21,lmsetjendpdri.duckdns.org

# ============================================
# Frontend Configuration
# ============================================
FRONTEND_SITE_URL=https://lmsetjendpdri.duckdns.org
VITE_API_BASE_URL=https://lmsetjendpdri.duckdns.org

# ============================================
# Email Configuration (SendGrid)
# ============================================
SENDGRID_API_KEY=your-sendgrid-api-key

# ============================================
# SSL/HTTPS Configuration
# ============================================
USE_SSL=True

# ============================================
# SSO (Single Sign-On) Configuration
# ============================================
SSO_PROVIDER_URL=https://nusadpd.duckdns.org/
SSO_VERIFY_ENDPOINT=https://cmb.tail91813a.ts.net/sso/verify/
SSO_TOKEN_ALGORITHM=HS256
SSO_TOKEN_EXPIRY_SECONDS=300
SSO_CALLBACK_URL=https://lmsetjendpdri.duckdns.org/sso/
SSO_LOGIN_SUCCESS_URL=https://lmsetjendpdri.duckdns.org/student/dashboard/
SSO_DEBUG_LOGGING=False
```

## Updating Settings.py to Use Environment Variables

```python
# backend/backend/settings.py

from environs import Env
env = Env()
env.read_env()

# ============================================================
# SSO Configuration
# ============================================================

SSO_PROVIDER_URL = env('SSO_PROVIDER_URL', default='https://nusadpd.duckdns.org/')
SSO_VERIFY_ENDPOINT = env('SSO_VERIFY_ENDPOINT', default='https://cmb.tail91813a.ts.net/sso/verify/')
SSO_TOKEN_ALGORITHM = env('SSO_TOKEN_ALGORITHM', default='HS256')
SSO_TOKEN_EXPIRY_SECONDS = env.int('SSO_TOKEN_EXPIRY_SECONDS', default=300)
SSO_CALLBACK_URL = env('SSO_CALLBACK_URL', default='https://lmsetjendpdri.duckdns.org/sso/')
SSO_LOGIN_SUCCESS_URL = env('SSO_LOGIN_SUCCESS_URL', default='https://lmsetjendpdri.duckdns.org/student/dashboard/')
SSO_DEBUG_LOGGING = env.bool('SSO_DEBUG_LOGGING', default=False)

# Get public key from env variable (multi-line)
SSO_PUBLIC_KEY = env('SSO_PUBLIC_KEY', default=None)

# Configure logging for SSO
import logging
if SSO_DEBUG_LOGGING:
    logging.getLogger('api.sso_utils').setLevel(logging.DEBUG)
```

## How to Generate Test SSO Token

```python
# Generate a test JWT token for development

import jwt
from datetime import datetime, timedelta

# Secret key (should match what SSO provider uses)
SECRET_KEY = "your-secret-key"

# Token payload (what SSO provider sends)
payload = {
    'nip': '20000420202506100008',  # Employee ID
    'name': 'Test User',             # Full name
    'email': 'test@example.com',     # Email address
    'iat': datetime.utcnow(),        # Issued at
    'exp': datetime.utcnow() + timedelta(minutes=5)  # Expires in 5 minutes
}

# Generate token
token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')
print(f"Test Token: {token}")

# Test URL
test_url = f"https://lmsetjendpdri.duckdns.org/sso/{token}/"
print(f"Test URL: {test_url}")
```

## Verification Checklist

- [ ] `.env` file created with SSO variables
- [ ] SSO provider URL configured
- [ ] Callback URL matches registered application
- [ ] ALLOWED_HOSTS includes both LMS and SSO domains
- [ ] CORS configured if needed
- [ ] Public key obtained from SSO provider
- [ ] Token algorithm matches SSO provider
- [ ] Test token generated and verified
- [ ] Frontend environment variables updated
- [ ] Production secrets secured in `.env` file

## Security Considerations

1. **Never commit .env file to version control**
   ```bash
   # Add to .gitignore
   .env
   .env.local
   .env.*.local
   ```

2. **Use strong SECRET_KEY**
   ```python
   from django.core.management.utils import get_random_secret_key
   print(get_random_secret_key())
   ```

3. **Rotate tokens regularly**
   - Set reasonable expiration times (5-15 minutes)
   - Implement token refresh logic

4. **Validate SSL certificates**
   ```python
   # In production, never set VERIFY_SSL=False
   import ssl
   ssl._create_default_https_context = ssl._create_unverified_context
   ```

5. **Monitor SSO activity**
   - Log all SSO login attempts
   - Alert on unusual patterns
   - Track token validation failures

## Troubleshooting

### Token validation fails

1. Verify token hasn't expired
2. Check SECRET_KEY matches SSO provider
3. Ensure algorithm matches (HS256 vs RS256)
4. Validate token payload contains required fields

### Environment variables not loaded

1. Restart Docker containers after changing `.env`
   ```bash
   docker compose down
   docker compose up -d --build
   ```

2. Check env file location (should be in project root)
3. Verify `env.read_env()` is called in settings.py

### SSO redirect not working

1. Verify callback URL is whitelisted at SSO provider
2. Check ALLOWED_HOSTS includes LMS domain
3. Ensure redirect URL in frontend matches backend
4. Check browser cookies are enabled

---

**Last Updated:** November 18, 2025

