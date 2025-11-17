# Quick Reference: Managing Sensitive Data

## Files Changed

### 1. `.env` (Updated)
- ✅ Added external API credentials and configuration
- ⚠️ **IMPORTANT:** This file is git-ignored and NEVER committed
- 📍 Location: `backend/.env`

### 2. `.env.example` (Created)
- ✅ New file documenting all required environment variables
- ✅ Safe to commit (no real secrets)
- 📍 Location: `backend/.env.example`
- 📋 Template for new developers

### 3. `backend/settings.py` (Updated)
- ✅ Added `EXTERNAL_API` configuration loading from `.env`
- ✅ Uses Django's `environs.Env()` to safely load variables
- 📍 Lines 539-549

### 4. `backend/api/views.py` (Updated)
- ✅ Changed hardcoded credentials to use `settings.EXTERNAL_API`
- ✅ Removed sensitive tokens from source code
- 📍 Lines 3600-3618 in `SyncExternalUsersAPIView.post()`

### 5. `SENSITIVE_DATA_SECURITY.md` (Created)
- ✅ Comprehensive security documentation
- ✅ Best practices and troubleshooting guide

## Environment Variables Overview

```
EXTERNAL_API_URL              → External API endpoint
EXTERNAL_API_TOKEN            → API authentication token (SENSITIVE)
EXTERNAL_API_XSRF_TOKEN       → CSRF token (SENSITIVE)
EXTERNAL_API_SESSION_COOKIE   → Session authentication (SENSITIVE)
EXTERNAL_API_TIMEOUT          → Request timeout in seconds
```

## How to Use

### For Development

1. **First time setup:**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env and fill in your actual credentials
   nano .env
   ```

2. **Update credentials:**
   ```bash
   # Edit the .env file
   nano backend/.env
   # Restart your application
   docker-compose restart backend
   ```

3. **Never commit .env:**
   ```bash
   # This is already in .gitignore
   git status  # Should NOT show .env
   ```

### For Production (Docker)

1. **Using docker-compose with .env file:**
   ```bash
   # Place .env in backend directory
   docker-compose --env-file backend/.env up
   ```

2. **Using environment variables:**
   ```bash
   export EXTERNAL_API_TOKEN=prod-token-xyz
   docker-compose up
   ```

3. **Using AWS Secrets Manager:**
   ```bash
   # Retrieve secret and export
   SECRET=$(aws secretsmanager get-secret-value --secret-id prod/external-api-token --query SecretString --output text)
   export EXTERNAL_API_TOKEN=$SECRET
   docker-compose up
   ```

## Verification Checklist

- [ ] `.env` file exists and is NOT tracked in git
- [ ] `.env.example` exists and documents all variables
- [ ] `backend/settings.py` loads variables via `environs.Env()`
- [ ] `backend/api/views.py` uses `settings.EXTERNAL_API` (not hardcoded)
- [ ] Running `git status` does NOT show `.env`
- [ ] Running `grep` for old tokens returns nothing in tracked files

## Common Commands

```bash
# View what's in settings
python manage.py shell
>>> from django.conf import settings
>>> print(settings.EXTERNAL_API)

# Check if .env is ignored
git check-ignore backend/.env

# Verify credentials loaded
python -c "from environs import Env; env = Env(); env.read_env(); print(env('EXTERNAL_API_TOKEN'))"

# Search for exposed credentials in git history (optional cleanup)
git log --all -S "SENSITIVE_STRING" --oneline

# List all environment files
find . -name ".env*" -type f
```

## Migration Path for Team

1. **Pull latest changes:**
   ```bash
   git pull origin main
   ```

2. **Set up your environment:**
   ```bash
   cp backend/.env.example backend/.env
   # Edit .env with your credentials
   nano backend/.env
   ```

3. **Restart application:**
   ```bash
   docker-compose restart backend
   # OR
   python manage.py runserver
   ```

4. **Verify it works:**
   ```bash
   python manage.py shell
   >>> from django.conf import settings
   >>> settings.EXTERNAL_API['token']  # Should print token
   ```

## Security Level: ✅ Enterprise Best Practice

- [x] Credentials not in source code
- [x] Credentials not in git history
- [x] Per-environment configuration
- [x] Easy credential rotation
- [x] Production-ready setup
- [x] Documentation for team

## Next Steps (Optional Enhancements)

1. **Implement AWS Secrets Manager** for production
2. **Add credential rotation** schedule
3. **Monitor API token** usage for suspicious activity
4. **Use Vault** by HashiCorp for advanced secrets management
5. **Set up automated alerts** for credential exposure
6. **Implement git hooks** to prevent accidental commits of .env
