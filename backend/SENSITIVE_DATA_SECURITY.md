# Sensitive Data Security Guide

## Overview
This guide documents how sensitive data is managed in the LMS backend, following security best practices to prevent credentials from being exposed in source code or git repositories.

## What Changed

### Before (❌ Insecure)
Sensitive credentials were hardcoded directly in `backend/api/views.py`:
```python
headers = {
    'X-API-Token': 'hY89aCK6tgMmGQNootpLYsw9otfwmNAv24cZ3QIljC8aI8DQ4RbxQlHPn0cVBbgdtwuJpWbxfbu4qGCwTycKtAiIDwX8ePEcWRtBhu2LfKmsY87eGuCDXBv8pAvbLtEH',
    'Cookie': 'XSRF-TOKEN=...very-long-cookie...'
}
```

**Risks:**
- Credentials visible in source code
- Exposed in git repository history
- Anyone with repo access can impersonate the API
- Difficult to rotate credentials
- Production credentials mixed with development code

### After (✅ Secure)
All sensitive data moved to `.env` file with access through Django settings:
```python
from django.conf import settings

external_api_config = settings.EXTERNAL_API
external_api_token = external_api_config['token']
```

**Benefits:**
- Credentials kept separate from code
- `.env` file is git-ignored (never committed)
- Easy credential rotation
- Different credentials per environment
- Clear separation of secrets management

## Directory Structure

```
backend/
├── .env                    ← Actual secrets (git-ignored, LOCAL ONLY)
├── .env.example            ← Template (safe to commit, no real secrets)
├── .gitignore              ← Ensures .env is never committed
├── backend/
│   └── settings.py         ← Loads secrets from .env via Django
└── api/
    └── views.py            ← Uses secrets from settings (NOT hardcoded)
```

## Environment Variables - Sensitive Data

### 1. External API Credentials
Location: `.env` file

```dotenv
EXTERNAL_API_URL=https://cmb.tail91813a.ts.net/api/external/users
EXTERNAL_API_TOKEN=hY89aCK6tgMmGQNootpLYsw9otfwmNAv24cZ3QIljC8aI8DQ4RbxQlHPn0cVBbgdtwuJpWbxfbu4qGCwTycKtAiIDwX8ePEcWRtBhu2LfKmsY87eGuCDXBv8pAvbLtEH
EXTERNAL_API_XSRF_TOKEN=eyJpdiI6IkwwenJpQk94QStXcHpVbUdFMEoraWc9PSIsInZhbHVl...
EXTERNAL_API_SESSION_COOKIE=cmb_setjen_dpd_ri_session=eyJpdiI6ImM2NGhSSXBKSXhaM...
EXTERNAL_API_TIMEOUT=30
```

### 2. Database Credentials
Location: `.env` file

```dotenv
DB_NAME=django_lms_db
DB_USER=lms_user
DB_PASSWORD=your_secure_password
DB_HOST=localhost
DB_PORT=5432
```

### 3. Email Service Credentials
Location: `.env` file

```dotenv
SENDGRID_API_KEY=SG.yr6y_IzIRIGOOj9VdAis6A...
FROM_EMAIL=sdm@dpd.go.id
```

### 4. Django Security Keys
Location: `.env` file

```dotenv
SECRET_KEY=django-insecure-+c@7t#q96f*r#f-@ss1$2r5a3...
```

### 5. Other Sensitive Variables
Location: `.env` file

```dotenv
REDIS_URL=redis://localhost:6379
DEBUG=False  # Should be False in production
```

## Usage in Code

### ✅ CORRECT - Using settings

**backend/backend/settings.py** - Load from environment:
```python
from environs import Env

env = Env()
env.read_env()

EXTERNAL_API = {
    'url': env('EXTERNAL_API_URL'),
    'token': env('EXTERNAL_API_TOKEN'),
    'xsrf_token': env('EXTERNAL_API_XSRF_TOKEN'),
    'session_cookie': env('EXTERNAL_API_SESSION_COOKIE'),
    'timeout': env.int('EXTERNAL_API_TIMEOUT', default=30),
}
```

**backend/api/views.py** - Use from settings:
```python
from django.conf import settings

external_api_config = settings.EXTERNAL_API
token = external_api_config['token']
headers = {
    'X-API-Token': token,
    'Cookie': f"XSRF-TOKEN={external_api_config['xsrf_token']}"
}
```

### ❌ WRONG - Hardcoding credentials

```python
# NEVER do this!
headers = {
    'X-API-Token': 'hY89aCK6tgMmGQNootpLYsw9otfwmNAv24cZ3QIljC8aI8DQ4RbxQlHPn0cVBbgdtwuJpWbxfbu4qGCwTycKtAiIDwX8ePEcWRtBhu2LfKmsY87eGuCDXBv8pAvbLtEH',  # ❌ EXPOSED!
}
```

## Security Best Practices

### 1. ✅ Git Ignore Configuration
**`.gitignore`** (backend/.gitignore):
```ignore
.env
.env.local
.env.*.local
secrets.py
```

**Current status:** ✅ Already configured
- `.env` is in `.gitignore`
- `.env` is never committed to git
- `.gitignore` is checked into git

### 2. ✅ Example File for Documentation
**`.env.example`** - Safe to commit, no real secrets:
```dotenv
EXTERNAL_API_URL=https://example.com/api
EXTERNAL_API_TOKEN=your-token-here
EXTERNAL_API_TIMEOUT=30
```

**Current status:** ✅ Created
- Developers can copy `.env.example` to `.env`
- Shows required variables without exposing real values
- Helps new team members set up environment

### 3. ✅ Environment-Specific Secrets
Different credentials per environment:

**Development:**
```dotenv
DEBUG=True
EXTERNAL_API_TOKEN=dev-token-123
```

**Staging:**
```dotenv
DEBUG=False
EXTERNAL_API_TOKEN=staging-token-456
```

**Production:**
```dotenv
DEBUG=False
EXTERNAL_API_TOKEN=prod-token-789  # Highly restricted
```

### 4. ✅ Credential Rotation
- Change `EXTERNAL_API_TOKEN` when token is compromised
- Change `EXTERNAL_API_SESSION_COOKIE` if session expires
- Update `.env` file locally
- Restart application (Docker compose restart)
- No code changes needed!

### 5. ✅ Production Deployment
For production, use proper secrets management:

**Option A: Docker Secrets (Recommended for Docker Swarm)**
```yaml
services:
  backend:
    environment:
      EXTERNAL_API_TOKEN_FILE: /run/secrets/external_api_token
```

**Option B: Environment Variables (AWS ECS, Heroku)**
```bash
export EXTERNAL_API_TOKEN=prod-token-xyz
docker-compose up
```

**Option C: Secrets Manager (AWS Secrets Manager, HashiCorp Vault)**
```python
import boto3

client = boto3.client('secretsmanager')
secret = client.get_secret_value(SecretId='prod/external-api-token')
```

**Option D: Docker Compose with external .env**
```bash
# Create .env with production values
docker-compose --env-file /secure/path/.env up
```

## Audit Trail

### What Credentials Were Exposed?

1. **EXTERNAL_API_TOKEN**: API authentication token for external user sync
   - Status: Moved to `.env`
   - Location in code: Lines 3608-3612 in `views.py`
   - Fixed: ✅ Now loaded from settings

2. **EXTERNAL_API_XSRF_TOKEN**: CSRF token for cookie-based auth
   - Status: Moved to `.env`
   - Location in code: Lines 3608-3612 in `views.py`
   - Fixed: ✅ Now loaded from settings

3. **EXTERNAL_API_SESSION_COOKIE**: Session authentication cookie
   - Status: Moved to `.env`
   - Location in code: Lines 3608-3612 in `views.py`
   - Fixed: ✅ Now loaded from settings

4. **EXTERNAL_API_URL**: API endpoint URL
   - Status: Moved to `.env`
   - Risk Level: Low (URL is not secret, but good practice)
   - Fixed: ✅ Now loaded from settings

## Git History Cleanup (Optional but Recommended)

If credentials were exposed in git history, clean it up:

```bash
# Check git history for exposed credentials
git log --all -S "hY89aCK6tgMmGQNootpLYsw9otfwmNAv24cZ3QIljC8aI8DQ4RbxQlHPn0cVBbgdtwuJpWbxfbu4qGCwTycKtAiIDwX8ePEcWRtBhu2LfKmsY87eGuCDXBv8pAvbLtEH" --oneline

# Remove sensitive commits (use BFG Repo Cleaner)
bfg --replace-text secrets.txt repo.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --all --force

# After cleanup, IMMEDIATELY ROTATE all exposed credentials!
```

## Testing Your Setup

### 1. Verify `.env` is ignored
```bash
git status
# Should NOT show .env file
```

### 2. Verify settings load from `.env`
```bash
cd backend
python manage.py shell
>>> from django.conf import settings
>>> print(settings.EXTERNAL_API)
{'url': 'https://...', 'token': 'hY89...', ...}
```

### 3. Verify credentials are NOT in code
```bash
grep -r "hY89aCK6tgMmGQNootpLYsw9otfwmNAv24cZ3QIljC8aI8DQ4RbxQlHPn0cVBbgdtwuJpWbxfbu4qGCwTycKtAiIDwX8ePEcWRtBhu2LfKmsY87eGuCDXBv8pAvbLtEH" backend/
# Should return NOTHING (only in .env)
```

## Troubleshooting

### Problem: "KeyError: 'EXTERNAL_API_TOKEN'"
**Cause:** `.env` file missing or not loaded
**Solution:**
```bash
# Check .env exists
ls -la backend/.env

# Reload environment
python manage.py shell
>>> import os
>>> os.environ.get('EXTERNAL_API_TOKEN')  # Should show value
```

### Problem: Settings show None for credentials
**Cause:** `.env` not being read by environs
**Solution:**
```bash
# Check .env path in settings.py
cd backend
python -c "from environs import Env; env = Env(); env.read_env(); print(env('EXTERNAL_API_TOKEN'))"
```

### Problem: Docker container can't access `.env`
**Cause:** `.env` file not mounted or copied to container
**Solution:**
```yaml
# docker-compose.yml
services:
  backend:
    env_file:
      - .env  # Ensure this path is correct
    environment:
      # OR use explicit environment variables
      EXTERNAL_API_TOKEN: ${EXTERNAL_API_TOKEN}
```

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| Credential Storage | Hardcoded in `views.py` | `.env` file (git-ignored) |
| Code Exposure | ❌ Visible in source | ✅ Not in source code |
| Git History | ❌ Exposed forever | ✅ Only in local .env |
| Easy Rotation | ❌ Code changes needed | ✅ Just update .env |
| Multiple Environments | ❌ Mixed credentials | ✅ Separate per environment |
| Production Ready | ❌ Major security risk | ✅ Enterprise best practice |

## References

- [Django Security Documentation](https://docs.djangoproject.com/en/4.2/topics/security/)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [12 Factor App - Config](https://12factor.net/config)
- [Python environs library](https://github.com/sloria/environs)
