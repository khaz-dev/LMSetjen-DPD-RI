# External API Configuration & Secrets Management

## Overview

This document explains how to securely manage sensitive API credentials for external integrations (like CMB API). All sensitive data is now stored in environment variables instead of being hardcoded.

## Architecture

### Before (❌ Insecure)
```python
# Hardcoded credentials in views.py (exposed in git history)
headers = {
    'X-API-Token': 'hY89aCK6tgMmGQNootpLYsw9otfwmNAv24cZ3QIljC8aI8DQ4RbxQlHPn0cVBbgdtwuJpWbxfbu4qGCwTycKtAiIDwX8ePEcWRtBhu2LfKmsY87eGuCDXBv8pAvbLtEH',
    'Cookie': 'XSRF-TOKEN=eyJp...'
}
```

### After (✅ Secure)
```python
# Configuration stored in settings.py, read from .env
cmb_config = settings.EXTERNAL_API.get('cmb', {})
api_token = cmb_config.get('api_token', '')
```

## Implementation

### 1. **Settings Configuration** (`backend/backend/settings.py`)

Added centralized external API configuration:

```python
EXTERNAL_API = {
    'cmb': {
        'base_url': env('CMB_API_URL', default='https://cmb.tail91813a.ts.net'),
        'api_token': env('CMB_API_TOKEN', default=''),
        'xsrf_token': env('CMB_XSRF_TOKEN', default=''),
        'session_cookie': env('CMB_SESSION_COOKIE', default=''),
        'timeout': env.int('CMB_API_TIMEOUT', default=30),
        'users_endpoint': '/api/external/users',
    }
}
```

**Benefits:**
- Centralized configuration in one place
- Easy to extend for multiple external APIs
- Type-safe (e.g., `timeout` as integer)
- Fallback defaults for development
- Follows Django best practices

### 2. **Views Update** (`backend/api/views.py`)

Updated `SyncExternalUsersAPIView` to use settings:

```python
from django.conf import settings

cmb_config = settings.EXTERNAL_API.get('cmb', {})

external_api_url = f"{cmb_config.get('base_url')}{cmb_config.get('users_endpoint')}"
api_token = cmb_config.get('api_token', '')
xsrf_token = cmb_config.get('xsrf_token', '')
session_cookie = cmb_config.get('session_cookie', '')
api_timeout = cmb_config.get('timeout', 30)

headers = {}
if api_token:
    headers['X-API-Token'] = api_token
if xsrf_token or session_cookie:
    cookie_parts = []
    if xsrf_token:
        cookie_parts.append(f'XSRF-TOKEN={xsrf_token}')
    if session_cookie:
        cookie_parts.append(f'cmb_setjen_dpd_ri_session={session_cookie}')
    headers['Cookie'] = '; '.join(cookie_parts)
```

**Benefits:**
- No hardcoded credentials
- Flexible header construction (only adds headers if provided)
- Cleaner code with dynamic timeout

### 3. **Environment Variables**

#### `.env.example` (for AWS/production deployments)

```env
# ============================================
# External API Configuration - CMB Integration
# ============================================
CMB_API_URL=https://cmb.tail91813a.ts.net
CMB_API_TOKEN=your-cmb-api-token-here
CMB_XSRF_TOKEN=your-cmb-xsrf-token-here
CMB_SESSION_COOKIE=your-cmb-session-cookie-here
CMB_API_TIMEOUT=30
```

#### `.env.docker.example` (for Docker deployments)

```env
# ============================================
# External API Configuration - CMB Integration
# ============================================
CMB_API_URL=https://cmb.tail91813a.ts.net
CMB_API_TOKEN=your-cmb-api-token-here
CMB_XSRF_TOKEN=your-cmb-xsrf-token-here
CMB_SESSION_COOKIE=your-cmb-session-cookie-here
CMB_API_TIMEOUT=30
```

## Setup Instructions

### For Production (EC2)

1. **SSH into production server:**
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-ip
   cd ~/LMSetjen-DPD-RI
   ```

2. **Edit `.env` file:**
   ```bash
   nano .env
   ```

3. **Add/Update CMB credentials:**
   ```env
   CMB_API_URL=https://cmb.tail91813a.ts.net
   CMB_API_TOKEN=your-actual-token
   CMB_XSRF_TOKEN=your-actual-xsrf-token
   CMB_SESSION_COOKIE=your-actual-session-cookie
   CMB_API_TIMEOUT=30
   ```

4. **Save and restart containers:**
   ```bash
   docker compose restart backend
   ```

### For Docker Development

1. **Copy example file:**
   ```bash
   cp .env.docker.example .env.docker
   ```

2. **Edit with credentials:**
   ```bash
   nano .env.docker
   ```

3. **Update docker-compose.yml to use .env.docker:**
   ```yaml
   services:
     backend:
       env_file: .env.docker
   ```

4. **Restart containers:**
   ```bash
   docker compose down
   docker compose up -d
   ```

### For Local Development

1. **Copy example file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit with credentials:**
   ```bash
   nano .env
   ```

3. **Run Django:**
   ```bash
   python manage.py runserver
   ```

## Security Best Practices

### ✅ What We're Doing Right

1. **Never commit credentials to Git**
   - `.env` files are in `.gitignore`
   - Only `.env.example` is committed with placeholder values

2. **Centralized configuration**
   - All external API configs in one place
   - Easy to audit and rotate credentials

3. **Environment-specific configs**
   - Different configs for dev/staging/production
   - Uses `environs` library for safe parsing

4. **Type safety**
   - `env.int()` for timeout values
   - Prevents accidental string/int mismatches

5. **Graceful fallbacks**
   - Default values for development
   - Won't crash if env vars are missing

### 🔐 Additional Security Recommendations

#### 1. **Rotating Credentials**
```bash
# When credentials are exposed or rotated:
# 1. Update CMB_API_TOKEN in .env on production
# 2. Restart backend container
docker compose restart backend

# 3. Verify new credentials are working
docker compose logs -f backend | grep "Attempting to fetch"
```

#### 2. **Audit Trail**
```bash
# Log who changed credentials and when
git log --all --grep="CMB" --oneline

# Check deployment history
docker compose logs backend | grep "CMB_API"
```

#### 3. **Monitoring**
```python
# Add logging to track API calls
import logging
logger = logging.getLogger(__name__)

logger.info(f"CMB API call to: {external_api_url}")
logger.debug(f"Using timeout: {api_timeout}s")
# Don't log the actual token!
```

#### 4. **Rate Limiting & Timeout**
```python
# Timeout is already configurable
CMB_API_TIMEOUT=30  # seconds

# Add request retries in production
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

session = requests.Session()
retry = Retry(connect=3, backoff_factor=0.5)
adapter = HTTPAdapter(max_retries=retry)
session.mount('https://', adapter)
response = session.get(full_api_url, headers=headers, timeout=api_timeout)
```

#### 5. **Secrets Management (AWS Secrets Manager)**
```python
# For enterprise deployments, use AWS Secrets Manager:
import json
import boto3

def get_cmb_credentials():
    client = boto3.client('secretsmanager')
    secret = client.get_secret_value(SecretId='prod/cmb-api')
    return json.loads(secret['SecretString'])

# Then in settings.py:
if os.getenv('USE_AWS_SECRETS'):
    cmb_creds = get_cmb_credentials()
else:
    cmb_creds = {
        'base_url': env('CMB_API_URL'),
        'api_token': env('CMB_API_TOKEN'),
        # ...
    }
```

## Migration from Old Code

### Git History Cleanup

If credentials were exposed in git history:

```bash
# Option 1: Force push to remove from remote (use with caution!)
git reset --hard HEAD~1
git push origin main --force

# Option 2: Use git-filter-branch to remove sensitive data
# WARNING: This rewrites all commits!
git filter-branch --tree-filter 'sed -i "s/hY89aCK6tgMmGQNootpLYsw9otfwmNAv24cZ3QIljC8aI8DQ4RbxQlHPn0cVBbgdtwuJpWbxfbu4qGCwTycKtAiIDwX8ePEcWRtBhu2LfKmsY87eGuCDXBv8pAvbLtEH//g" $file' -- --all
git push origin main --force-with-lease
```

### Rotate Credentials

1. Contact CMB administrator
2. Request new API token
3. Update `.env` file
4. Restart containers
5. Test API calls work
6. Monitor logs for any errors

## Verification Checklist

- [ ] `.env` file is in `.gitignore`
- [ ] Only `.env.example` is committed
- [ ] Settings.py loads from `env()` variables
- [ ] Views.py uses `settings.EXTERNAL_API`
- [ ] No credentials in git history
- [ ] Production `.env` has real credentials
- [ ] Docker restart loads new credentials
- [ ] API calls are working
- [ ] Logs don't show sensitive data

## Troubleshooting

### API credentials not being loaded

**Problem:** Getting "API token is empty" errors

**Solution:**
```bash
# 1. Check .env file exists
ls -la .env

# 2. Verify credentials are set
grep CMB .env

# 3. Check backend container environment
docker compose exec backend env | grep CMB

# 4. Restart container
docker compose restart backend
```

### Getting 401/403 from CMB API

**Problem:** Invalid credentials error from external API

**Solution:**
```bash
# 1. Verify credentials are correct
cat .env | grep CMB_API_TOKEN

# 2. Check if token has expired
# Contact CMB administrator for new token

# 3. Test with curl
curl -H "X-API-Token: $(grep CMB_API_TOKEN .env | cut -d= -f2)" \
  https://cmb.tail91813a.ts.net/api/external/users?all=1
```

### Changes not reflected after updating .env

**Problem:** Still using old credentials

**Solution:**
```bash
# Environment variables are only loaded on process start
# Must restart container for changes to take effect

docker compose restart backend

# Verify new credentials are loaded
docker compose logs -f backend | head -20
```

## Files Changed

1. **backend/backend/settings.py**
   - Added `EXTERNAL_API` configuration dictionary
   - Moved from hardcoded values to environment variables

2. **backend/api/views.py** (SyncExternalUsersAPIView)
   - Replaced hardcoded API URL
   - Replaced hardcoded credentials
   - Replaced hardcoded timeout
   - Added dynamic header construction

3. **.env.example**
   - Added CMB API configuration section
   - Documented all required variables

4. **.env.docker.example**
   - Added CMB API configuration section
   - Documented for Docker deployments

## Next Steps

### Phase 2: Advanced Features
- [ ] Add API credential rotation endpoint
- [ ] Add request signing/HMAC verification
- [ ] Add request rate limiting
- [ ] Add request retry logic with exponential backoff
- [ ] Add comprehensive audit logging

### Phase 3: Enterprise
- [ ] AWS Secrets Manager integration
- [ ] HashiCorp Vault integration
- [ ] Certificate pinning for API calls
- [ ] Mutual TLS (mTLS) for API authentication

## References

- [Django Settings Documentation](https://docs.djangoproject.com/en/4.2/topics/settings/)
- [environs Library Documentation](https://github.com/sloria/environs)
- [12 Factor App - Config](https://12factor.net/config)
- [OWASP: Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
