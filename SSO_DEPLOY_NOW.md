# 🚀 SSO Production Deployment - QUICK START

## ⏱️ 5 Minute Overview

Your SSO login is **fixed and tested locally**. Now deploying to production.

## 📋 3-Step Deployment (If You're in a Hurry)

### Step 1: Pre-Flight Check (2 minutes)
```bash
# SSH to server
ssh your-user@16.79.83.21
cd /path/to/LMSetjen-DPD-RI

# Backup database RIGHT NOW
docker-compose exec postgres pg_dump -U lms_user django_lms_db > backup_$(date +%Y%m%d_%H%M%S).sql
ls -lh backup_*.sql  # Verify backup exists
```

**⚠️ STOP - Go complete the pre-deployment checklist before continuing!**
See: `SSO_PRODUCTION_DEPLOYMENT_CHECKLIST.md`

### Step 2: Deploy (3 minutes)
```bash
# Pull latest code
git pull origin main

# Create frontend env
cat > frontend/.env.production << 'EOF'
VITE_API_BASE_URL=https://lmsetjendpdri.duckdns.org
EOF

# Deploy!
docker-compose down
docker-compose up -d --build

# Migrate database
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py collectstatic --noinput
```

### Step 3: Verify (1 minute)
```bash
# Check services
docker-compose ps

# View logs
docker-compose logs -f backend

# Verify it works in browser
# Open: https://lmsetjendpdri.duckdns.org
# Click: "Login dengan SSO"
# Check: Console (F12) shows "role = student"
# Result: Dashboard loads
```

**Success!** 🎉

---

## 📚 Full Documentation

For detailed information, read these in order:

1. **Checklist First**: `SSO_PRODUCTION_DEPLOYMENT_CHECKLIST.md`
   - Complete all items before deploying
   - Only takes 10 minutes
   - Prevents mistakes

2. **Then Deploy**: `SSO_DEPLOYMENT_COMMANDS.md`
   - Copy-paste commands
   - One section at a time
   - Monitor logs

3. **If Stuck**: `SSO_PRODUCTION_DEPLOYMENT_GUIDE.md`
   - Comprehensive guide
   - Detailed explanations
   - Troubleshooting tips

---

## ⚠️ THE MOST IMPORTANT STEP

### Before You Deploy - Read This!

You MUST update the SSO Provider (Nusa DPD) callback URL:

**Old (Local)**:
```
http://localhost:5173/sso/{token}/
```

**New (Production)**:
```
https://lmsetjendpdri.duckdns.org/sso/{token}/
```

If you don't do this, SSO will still redirect to localhost and fail!

---

## 🧪 Post-Deployment Quick Test

```bash
# Open browser
https://lmsetjendpdri.duckdns.org

# Open DevTools (F12)
# Click "Login dengan SSO"
# Look in console for:

✅ Should see:
- "✅ UserData: Decoded from refresh_token"
- "role = student"
- Dashboard loads

❌ Should NOT see:
- "role = undefined"
- "Access Denied" error
- Any red errors in console
```

---

## 📞 If It Breaks

### Immediate Fix
```bash
# Stop everything
docker-compose down

# Go back to previous version
git revert HEAD

# Restart
docker-compose up -d

# This takes 30 seconds
```

### Then Check
```bash
# View logs to see what went wrong
docker-compose logs backend | grep -i error
```

---

## ✅ Success Indicators

After deployment you'll see:

- ✅ https://lmsetjendpdri.duckdns.org loads
- ✅ "Login dengan SSO" button visible
- ✅ Can click and authenticate
- ✅ Redirected back to dashboard
- ✅ Dashboard shows your data
- ✅ No "Access Denied" error
- ✅ Console shows `role = student`

---

## 📊 What Got Fixed

### The Bug
SSO login succeeded but JWT tokens didn't include the `role` field, so RoleRoute blocked access.

### The Fix
Backend now adds `role` field to JWT tokens for SSO (same as normal login).

### The Result
SSO and normal login now work identically. All features available.

---

## 🎓 Understanding the Deployment

### What Happens
1. Pull latest code (with SSO fix)
2. Stop old containers
3. Build new images
4. Start containers
5. Run database migrations
6. Collect static files

### How Long
- Backup: 1 minute
- Build: 3-5 minutes
- Deploy: 1 minute
- Total: ~10 minutes

### Downtime
- Total: ~5 minutes (while rebuilding)
- Users: Won't be able to access during rebuild
- After: Everything works normally

---

## 🔒 Security

All production settings are already configured:
- ✅ SSL/HTTPS enabled
- ✅ DEBUG=False
- ✅ Strong SECRET_KEY
- ✅ Secure cookies
- ✅ CORS restricted
- ✅ Security headers set

No security configuration needed!

---

## 📋 Decision Tree

```
Ready to deploy?
├─ No → Read SSO_PRODUCTION_DEPLOYMENT_CHECKLIST.md
└─ Yes
   ├─ Updated SSO Provider callback URL?
   │  ├─ No → Update it now
   │  └─ Yes
   │     ├─ Backed up database?
   │     │  ├─ No → Run backup command first
   │     │  └─ Yes → DEPLOY!
   └─ Deployment failed?
      ├─ Run: docker-compose logs backend
      └─ See common issues in guide
```

---

## 🚀 Ready?

1. ✅ SSO fix is complete and tested
2. ✅ Configuration is production-ready
3. ✅ You have all the commands
4. ✅ Backup is ready
5. ✅ You understand what happens

**Then go to**: `SSO_PRODUCTION_DEPLOYMENT_CHECKLIST.md` and start deployment!

---

## 📞 Need Help?

- **Checklist**: `SSO_PRODUCTION_DEPLOYMENT_CHECKLIST.md` ← Start here
- **Commands**: `SSO_DEPLOYMENT_COMMANDS.md` ← Copy-paste
- **Details**: `SSO_PRODUCTION_DEPLOYMENT_GUIDE.md` ← Full info
- **Overview**: `SSO_DEPLOYMENT_READY.md` ← Big picture

---

**Current Status**: ✅ Ready for Production Deployment

**Next Step**: Open `SSO_PRODUCTION_DEPLOYMENT_CHECKLIST.md` and follow it.

That's it! In 10 minutes, your SSO will be live in production. 🎉

