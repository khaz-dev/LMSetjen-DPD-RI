# 🔐 API Credentials - Quick Setup Guide

## TL;DR - Just the Commands

### Production Server
```bash
# SSH to server
ssh -i your-key.pem ubuntu@your-ip

# Edit credentials
cd ~/LMSetjen-DPD-RI
nano .env

# Add these lines:
CMB_API_URL=https://cmb.tail91813a.ts.net
CMB_API_TOKEN=your-actual-token
CMB_XSRF_TOKEN=your-xsrf-token
CMB_SESSION_COOKIE=your-session-cookie
CMB_API_TIMEOUT=30

# Save (Ctrl+O, Enter, Ctrl+X)

# Restart backend
docker compose restart backend

# Verify it works
docker compose logs -f backend | grep "Attempting to fetch"
```

### Local Development
```bash
# Copy example
cp .env.example .env

# Edit with your credentials
nano .env

# Django will automatically load .env
python manage.py runserver
```

### Docker Development
```bash
# Copy example
cp .env.docker.example .env.docker

# Edit credentials
nano .env.docker

# In docker-compose.yml, ensure backend service has:
# env_file: .env.docker

# Restart
docker compose restart backend
```

## What Changed?

| Before | After |
|--------|-------|
| ❌ Credentials in `views.py` | ✅ Credentials in `.env` |
| ❌ Hardcoded API URL | ✅ Environment variable |
| ❌ Visible in git history | ✅ `.env` in `.gitignore` |
| ❌ Hard to rotate credentials | ✅ Easy: edit `.env`, restart |

## Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `CMB_API_URL` | API endpoint | `https://cmb.tail91813a.ts.net` |
| `CMB_API_TOKEN` | Bearer token | `hY89aCK6...` |
| `CMB_XSRF_TOKEN` | CSRF token | `eyJpdiI6IkwwenJpQk94...` |
| `CMB_SESSION_COOKIE` | Session cookie | `eyJpdiI6ImM2NGhSSXBK...` |
| `CMB_API_TIMEOUT` | Request timeout (seconds) | `30` |

## Where Are They Used?

```
.env file
  ↓
backend/backend/settings.py (EXTERNAL_API dict)
  ↓
backend/api/views.py (SyncExternalUsersAPIView)
  ↓
CMB API at https://cmb.tail91813a.ts.net
```

## Did It Work?

Check the logs:
```bash
# Docker
docker compose logs backend | grep "Attempting to fetch"

# Production
tail -100 backend/logs/django.log | grep "CMB\|Attempting"
```

Should see:
```
Attempting to fetch data from: https://cmb.tail91813a.ts.net/api/external/users?all=1
Response status code: 200
```

## Need to Rotate Credentials?

1. Get new token from CMB admin
2. Edit `.env` file
3. Restart container: `docker compose restart backend`
4. Done! No code changes needed.

## Security Checklist

- [ ] `.env` file NOT in git (check `.gitignore`)
- [ ] Production `.env` has REAL credentials
- [ ] `.env.example` has placeholder values
- [ ] Backend restarted after editing `.env`
- [ ] API calls working (check logs)

## Troubleshooting

**Still getting credential errors?**
```bash
# Check credentials are loaded
docker compose exec backend env | grep CMB

# If empty, restart:
docker compose restart backend

# Check again
docker compose exec backend env | grep CMB
```

**Getting 401 from API?**
- Token expired? Get new one from CMB admin
- Token wrong? Double-check copy-paste
- Firewall blocking? Check network

## For More Details

See: `EXTERNAL_API_CONFIGURATION.md`

---

**Status:** ✅ All credentials now in `.env` (environment variables)  
**Security:** ✅ No sensitive data in code or git history  
**Rotation:** ✅ Easy - just edit `.env` and restart  
