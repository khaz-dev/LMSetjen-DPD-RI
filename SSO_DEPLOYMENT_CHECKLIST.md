# ✅ SSO Integration Deployment Checklist

**Version:** 1.0.0  
**Date:** November 18, 2025  
**Status:** Ready for Production  

---

## 📋 Pre-Deployment Verification

### Code Review
- [ ] All SSO code committed to main branch
- [ ] No merge conflicts
- [ ] All documentation included
- [ ] No hardcoded secrets in code
- [ ] Git log shows SSO commits

**Verify with:**
```bash
cd ~/LMSetjen-DPD-RI
git log --oneline | grep -i sso | head -5
git status  # Should show "nothing to commit, working tree clean"
```

### Files Present
- [ ] `backend/api/sso_utils.py` exists
- [ ] `frontend/src/views/auth/SSOLogin.jsx` exists
- [ ] `frontend/src/views/auth/SSOLogin.css` exists
- [ ] All documentation files present (4+ SSO guides)

**Verify with:**
```bash
ls backend/api/sso_utils.py
ls frontend/src/views/auth/SSOLogin.*
ls SSO_*.md
```

---

## 🔧 Environment Setup

### Development Server
- [ ] `.env` file exists and has backup
- [ ] All SSO variables added to `.env`
- [ ] No hardcoded secrets in configuration
- [ ] Database credentials correct
- [ ] Redis connection working

**Required .env variables:**
```bash
SSO_PROVIDER_URL=https://nusadpd.duckdns.org/
SSO_VERIFY_ENDPOINT=https://cmb.tail91813a.ts.net/sso/verify/
SSO_TOKEN_ALGORITHM=HS256
SSO_CALLBACK_URL=https://lmsetjendpdri.duckdns.org/sso/
```

### Production Server
- [ ] `.env` backed up before deployment
- [ ] SSO variables configured
- [ ] All secrets rotated
- [ ] SSL certificates valid
- [ ] CORS configuration verified

---

## 🐳 Docker Deployment

### Containers
- [ ] All containers stop cleanly: `docker compose down`
- [ ] Build completes without errors: `docker compose up -d --build`
- [ ] All containers running: `docker compose ps` shows 5 "Up"
- [ ] No port conflicts
- [ ] Volume mounts correct

**Verify with:**
```bash
docker compose ps
docker compose logs backend | grep -i error | wc -l  # Should be 0 or few
```

### Database
- [ ] Database connection working
- [ ] Migrations apply successfully
- [ ] No migration errors
- [ ] Tables created with SSO fields

**Verify with:**
```bash
docker compose exec -T backend python manage.py migrate
docker compose exec -T backend python manage.py shell
>>> from userauths.models import User
>>> print(User._meta.get_fields())  # Should include 'nip'
```

---

## 🔐 Security Verification

### HTTPS/SSL
- [ ] SSL certificate valid
- [ ] HTTPS enforced
- [ ] HTTP redirects to HTTPS
- [ ] Mixed content warnings absent

**Verify with:**
```bash
curl -I https://lmsetjendpdri.duckdns.org
# Should show: HTTP/2 200 or HTTP/1.1 200
```

### CORS Configuration
- [ ] CORS headers present
- [ ] Nusa DPD domain in ALLOWED_ORIGINS
- [ ] Credentials allowed
- [ ] Methods restricted appropriately

**Verify with:**
```bash
curl -I -H "Origin: https://nusadpd.duckdns.org" \
  https://lmsetjendpdri.duckdns.org/api/v1/sso/verify/
# Should show: Access-Control-Allow-Origin headers
```

### CSRF Protection
- [ ] CSRF middleware enabled
- [ ] CSRF tokens present in HTML
- [ ] SSO endpoints marked CSRF exempt
- [ ] Cookies have SameSite attribute

---

## 📡 API Endpoint Testing

### Backend Verification
- [ ] `/api/v1/sso/verify/` endpoint exists
- [ ] Responds to POST requests
- [ ] Validates input properly
- [ ] Handles invalid tokens
- [ ] Returns proper error messages

**Test with:**
```bash
# Test endpoint exists
curl -i https://lmsetjendpdri.duckdns.org/api/v1/health/
# Should return: HTTP 200

# Test SSO endpoint with invalid token
curl -X POST https://lmsetjendpdri.duckdns.org/api/v1/sso/verify/ \
  -H "Content-Type: application/json" \
  -d '{"sso_token": "invalid"}'
# Should return: HTTP 400 or 401
```

### Frontend Verification
- [ ] SSO button visible on login page
- [ ] SSO button clickable
- [ ] SSO route `/sso/:token/` accessible
- [ ] SSOLogin component loads
- [ ] Console has no errors

**Verify with:**
1. Open: `https://lmsetjendpdri.duckdns.org/login/`
2. Check: "Login dengan Nusa DPD" button present
3. Press: `F12` → Console → No red errors

---

## 👥 User Management

### User Fields
- [ ] `nip` field present and unique
- [ ] `external_id` field works
- [ ] `external_status` field populated
- [ ] `last_sync_date` tracking works
- [ ] User profile auto-created

**Verify with:**
```bash
docker compose exec -T backend python manage.py shell
>>> from userauths.models import User, Profile
>>> user = User.objects.filter(nip__isnull=False).first()
>>> if user: print(user.nip, user.profile)
```

### Roles & Permissions
- [ ] SSO users get `role='student'` by default
- [ ] Role-based redirects work
- [ ] Permissions properly assigned
- [ ] Admin access controlled

---

## 🔍 Logging & Monitoring

### Logs Configuration
- [ ] Backend logs accessible
- [ ] Frontend console accessible
- [ ] Error logging enabled
- [ ] Info logging not too verbose

**Verify with:**
```bash
docker compose logs backend | tail -20
docker compose logs frontend | tail -20
```

### Monitoring Setup
- [ ] Error alerts configured
- [ ] SSO login attempts tracked
- [ ] Performance metrics available
- [ ] Uptime monitoring active

---

## 📊 Performance Testing

### Load Testing
- [ ] Single login works
- [ ] 10 concurrent logins successful
- [ ] Response time under 1 second
- [ ] No database connection errors
- [ ] No memory leaks

**Test with:**
```bash
# Single login test
for i in {1..10}; do
  curl -X POST https://lmsetjendpdri.duckdns.org/api/v1/sso/verify/ \
    -H "Content-Type: application/json" \
    -d '{"sso_token": "test"}'
done
```

### Browser Compatibility
- [ ] Chrome/Chromium works
- [ ] Firefox works
- [ ] Safari works
- [ ] Edge works
- [ ] Mobile browsers work

---

## 📚 Documentation

### Guides Present
- [ ] SSO_README.md exists
- [ ] SSO_QUICK_START.md complete
- [ ] SSO_INTEGRATION_GUIDE.md complete
- [ ] SSO_ENV_CONFIGURATION.md complete
- [ ] SSO_IMPLEMENTATION_SUMMARY.md complete

**Verify with:**
```bash
ls -lh SSO_*.md
wc -l SSO_*.md | tail -1  # Should be 1500+
```

### Documentation Complete
- [ ] Architecture explained
- [ ] API endpoints documented
- [ ] Security features listed
- [ ] Troubleshooting included
- [ ] Examples provided

---

## 🧪 Integration Testing

### With Nusa DPD (When Available)
- [ ] SSO provider URL responds
- [ ] Token generation works
- [ ] Token verification works
- [ ] User data mapping correct
- [ ] Test tokens accepted

### End-to-End Flow
- [ ] User clicks SSO button
- [ ] Redirected to Nusa DPD
- [ ] Authenticated at Nusa DPD
- [ ] Redirected back with token
- [ ] Token verified successfully
- [ ] User logged into LMS
- [ ] Redirected to dashboard

---

## 🚀 Deployment Steps

### Pre-Deployment
- [ ] Backup database: `docker compose exec -T postgres pg_dump ... > backup.sql`
- [ ] Backup .env file: `cp .env .env.backup`
- [ ] Inform team: "SSO deployment in progress"
- [ ] Check: No active users

### Deployment
- [ ] Pull code: `git pull origin main`
- [ ] Verify code: `git log --oneline | head -5`
- [ ] Stop containers: `docker compose down`
- [ ] Build: `docker compose up -d --build`
- [ ] Wait: 30 seconds for startup
- [ ] Migrate: `docker compose exec -T backend python manage.py migrate`
- [ ] Verify: All containers running

### Post-Deployment
- [ ] Test SSO endpoint
- [ ] Test frontend login page
- [ ] Create test user via SSO
- [ ] Verify database entry
- [ ] Check logs for errors
- [ ] Inform team: "SSO deployment successful"

---

## ✅ Final Verification

### Functionality
- [ ] Users can see SSO button
- [ ] SSO button links to correct URL
- [ ] Token verification works
- [ ] User creation works
- [ ] JWT tokens generated
- [ ] Redirect to dashboard works
- [ ] All roles redirect correctly

### Security
- [ ] HTTPS enforced
- [ ] Cookies secure
- [ ] CSRF protection active
- [ ] No sensitive data in logs
- [ ] Tokens not exposed in URLs
- [ ] Nonce/state parameter working (if implemented)

### Performance
- [ ] Page load < 2 seconds
- [ ] API response < 500ms
- [ ] Database queries optimized
- [ ] Memory usage stable
- [ ] CPU usage normal

### Monitoring
- [ ] Logs readable and clean
- [ ] Error alerts working
- [ ] Metrics collected
- [ ] Dashboard updated
- [ ] Alerts configured

---

## 📞 Rollback Plan

### If Deployment Fails

```bash
# Stop containers
docker compose down

# Restore backup
mv .env .env.failed
mv .env.backup .env

# Restore database (if needed)
docker compose exec -T postgres psql -U lms_user < backup.sql

# Restart
docker compose up -d

# Verify
docker compose ps
```

### If Issues After Deployment

```bash
# Check logs
docker compose logs backend | grep -i error

# Restart affected service
docker compose restart backend

# If still broken, rollback to previous commit
git log --oneline | head -5
git revert <commit_id>
git push
```

---

## 📋 Sign-Off

### Deployment Team
- [ ] I have reviewed this checklist
- [ ] I have verified all items
- [ ] I authorize deployment
- [ ] I will monitor after deployment

**Name:** ________________  
**Date:** ________________  
**Time:** ________________  

### Post-Deployment
- [ ] Deployment completed successfully
- [ ] All systems operational
- [ ] Monitoring active
- [ ] Team notified

**Name:** ________________  
**Date:** ________________  
**Time:** ________________  

---

## 📞 Emergency Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| Dev Lead | | | |
| DevOps | | | |
| Database Admin | | | |
| Security | | | |
| Nusa DPD Contact | | | |

---

## 📎 Appendix

### Useful Commands

```bash
# Check deployment status
docker compose ps

# View logs
docker compose logs -f backend

# Test endpoint
curl https://lmsetjendpdri.duckdns.org/api/v1/health/

# Database shell
docker compose exec -T backend python manage.py shell

# Django admin
https://lmsetjendpdri.duckdns.org/admin/
```

### Database Backup
```bash
# Backup
docker compose exec -T postgres pg_dump -U lms_user django_lms_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore
docker compose exec -T postgres psql -U lms_user django_lms_db < backup.sql
```

### Rollback
```bash
# To previous commit
git log --oneline | head -5
git revert <commit_hash>
git push

# Rebuild containers
docker compose down
docker compose up -d --build
```

---

## ✨ Success Criteria

✅ **All of the following must be true:**

- [ ] SSO button visible on login page
- [ ] SSO endpoint responds to requests
- [ ] Users can authenticate via SSO
- [ ] User accounts auto-created
- [ ] JWT tokens stored in cookies
- [ ] Users redirected to correct dashboard
- [ ] No error messages in logs
- [ ] Database records created correctly
- [ ] All tests passing
- [ ] Documentation complete and accurate

---

**Deployment Date:** _______________  
**Deployed By:** _______________  
**Verified By:** _______________  
**Status:** ✅ **READY FOR PRODUCTION**

