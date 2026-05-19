# 🚀 QUICK DEPLOYMENT REFERENCE
## LMSetjen DPD RI → lms.khaz.app

---

## EVERYTHING IS READY! 

✅ All code fixed  
✅ All configs prepared  
✅ Project uploaded to server  
✅ SSH access verified  

---

## 5-MINUTE DEPLOYMENT

```bash
# 1. SSH to server
ssh -i c:\Users\khair\khaz root@165.245.191.216

# 2. Go to project
cd /root/lmsetjendpdri

# 3. Create .env from template
cp .env.staging .env

# 4. EDIT .env - Open in nano and update these:
#    - SECRET_KEY (generate new one)
#    - DB_PASSWORD (use something like: $(openssl rand -base64 32))
#    - REDIS_PASSWORD (use something like: $(openssl rand -base64 32))
#    - GOOGLE_CLIENT_ID & SECRET (if using login)
nano .env

# 5. Deploy!
docker-compose build --no-cache
docker-compose up -d

# 6. Wait a bit
sleep 30

# 7. Initialize DB
docker-compose exec backend python manage.py migrate --noinput
docker-compose exec backend python manage.py collectstatic --noinput --clear

# 8. Create admin user (optional but recommended)
docker-compose exec backend python manage.py createsuperuser

# 9. Check status
docker-compose ps
```

---

## ACCESS YOUR APP

Once deployment is complete (takes 3-5 minutes):

```
Frontend:  https://lms.khaz.app
API:       https://lms.khaz.app/api/v1/
Admin:     https://lms.khaz.app/admin/
Docs:      https://lms.khaz.app/api/v1/swagger/
```

---

## TROUBLESHOOTING

### Containers not starting?
```bash
docker-compose down
docker-compose up -d
docker-compose logs -f
```

### Database error?
```bash
docker-compose logs postgres
docker-compose exec postgres psql -U postgres -d lmsdb
```

### Blank frontend?
```bash
docker-compose logs frontend
docker-compose restart frontend
```

---

## FILES PREPARED FOR YOU

Located in: `d:\Project\LMSetjen DPD RI\`

- ✅ `.env.staging` - Configuration template
- ✅ `.env.example` - Documentation
- ✅ `STAGING_DEPLOYMENT_GUIDE.md` - Detailed instructions
- ✅ `DEPLOYMENT_STATUS.md` - Complete checklist
- ✅ Project files - Already uploaded to server

---

## WHAT WAS FIXED

- ✓ 8 debug print statements removed (exposed credentials)
- ✓ CSRF_TRUSTED_ORIGINS added
- ✓ CORS updated for staging domain
- ✓ All hardcoded secrets removed
- ✓ Security settings verified

---

## YOU'RE READY!

Just SSH in, configure .env, and run `docker-compose up -d`

That's it! 🎉
