# 🔧 Certificate QR Code Fix - Production Deployment

## 🔴 Problem
QR codes are not showing in the Certificate tab on production website (https://lmsetjendpdri.duckdns.org/student/courses/223339/).

## ✅ Root Cause Analysis

The issue is that **existing certificates in the production database do not have the `validation_token` field** because:

1. The migration `0011_add_certificate_validation_token.py` was added recently (Nov 11, 2025)
2. Certificates created BEFORE this migration don't have the `validation_token` populated
3. The QR code URL generation depends on the `validation_token`:
   ```python
   # In serializer.py - line 415-420
   def get_qr_code_url(self, obj):
       """Generate QR code URL for certificate validation (frontend route)"""
       request = self.context.get('request')
       if request:
           domain = request.get_host()
           protocol = 'https' if request.is_secure() else 'http'
           return f"{protocol}://{domain}/certificate/validate/{obj.validation_token}/"
       return None
   ```
4. If `validation_token` is NULL, the QR code URL becomes `None` or invalid
5. Frontend's conditional `{certificate.qr_code_url && (...)}` evaluates to false, so QR code doesn't render

## 🚀 Solution - 3 Step Fix

### Step 1: Ensure Migration is Applied on Production
The migration already exists in the codebase. When you pull the code on production, you need to run migrations.

### Step 2: Create Migration to Populate Existing Certificates
We need to generate validation tokens for certificates that were created before the migration was added.

### Step 3: Rebuild Frontend and Deploy

---

## 📋 Detailed Deployment Steps

### Prerequisites
- SSH access to production server (16.79.83.21)
- Private key: `D:\Project\lms-server-key.pem`

---

## 🔧 On Production Server

### Step 1: SSH into Server
```bash
ssh -i "D:\Project\lms-server-key.pem" ubuntu@16.79.83.21
```

### Step 2: Navigate to Project
```bash
cd ~/LMSetjen-DPD-RI
```

### Step 3: Pull Latest Code (includes migrations)
```bash
git pull origin main
```

**Expected output:**
```
remote: Enumerating objects: X, done.
Updating xxxxx..yyyyy
Fast-forward
 backend/api/migrations/0011_add_certificate_validation_token.py | XX +++++
 ...
```

### Step 4: Check Database Migration Status
```bash
docker compose exec backend python manage.py showmigrations api | grep 0011
```

**Should show:**
```
 [X] 0011_add_certificate_validation_token
```

If it shows `[ ]` instead of `[X]`, the migration needs to be run.

### Step 5: Run Migrations (if needed)
```bash
docker compose exec backend python manage.py migrate api
```

**Expected output:**
```
Operations to perform:
  Apply all migrations: api, ...
Running migrations:
  Applying api.0011_add_certificate_validation_token... OK
```

### Step 6: Populate Validation Tokens for Existing Certificates
Run this Django shell command to generate validation tokens for certificates missing them:

```bash
docker compose exec backend python manage.py shell
```

Then in the Django shell:
```python
from api.models import Certificate
from shortuuid import ShortUUID

# Check how many certificates need validation tokens
certs_without_token = Certificate.objects.filter(validation_token__isnull=True)
print(f"Certificates without validation_token: {certs_without_token.count()}")

# Generate validation tokens for all certificates without them
su = ShortUUID(alphabet="abcdefghijklmnopqrstuvwxyz0123456789", length=12)
count = 0
for cert in certs_without_token:
    try:
        # Generate unique token
        while True:
            new_token = su.random()
            if not Certificate.objects.filter(validation_token=new_token).exists():
                cert.validation_token = new_token
                cert.save()
                count += 1
                break
    except Exception as e:
        print(f"Error updating certificate {cert.id}: {e}")

print(f"Successfully updated {count} certificates with validation tokens")

# Verify
print(f"Certificates still without token: {Certificate.objects.filter(validation_token__isnull=True).count()}")

# Exit shell
exit()
```

### Step 7: Verify Fix in Database
```bash
docker compose exec backend python manage.py shell
```

Then:
```python
from api.models import Certificate

# Check if all certificates have validation tokens
all_certs = Certificate.objects.all()
certs_with_token = all_certs.filter(validation_token__isnull=False)

print(f"Total certificates: {all_certs.count()}")
print(f"Certificates with token: {certs_with_token.count()}")
print(f"Match: {all_certs.count() == certs_with_token.count()}")

# Show a sample
sample = all_certs.first()
if sample:
    print(f"\nSample certificate:")
    print(f"  ID: {sample.certificate_id}")
    print(f"  Token: {sample.validation_token}")
    print(f"  Valid: {sample.is_valid}")

exit()
```

### Step 8: Stop Old Frontend Container
```bash
docker compose down frontend
```

### Step 9: Rebuild Frontend (No Cache!)
```bash
docker compose build --no-cache frontend
```

⏱️ This will take 2-5 minutes

### Step 10: Start Frontend
```bash
docker compose up -d frontend
```

### Step 11: Verify Deployment
```bash
# Check if all containers are running
docker compose ps

# Check frontend logs for errors
docker compose logs frontend | tail -20
```

---

## ✅ Post-Deployment Testing

### On Production Website:
1. Go to https://lmsetjendpdri.duckdns.org/student/courses/223339/
2. Click on "Certificate" tab
3. **Verify that QR code now appears** in the certificate preview
4. Click "Print Verification" button
5. Verify PDF prints with QR code visible

### Test QR Code Scanning:
1. Download a QR code scanner app to your phone
2. Scan the QR code from the certificate
3. Should redirect to certificate validation page

---

## 🧪 Quick Troubleshooting

### Issue: QR code still not showing
**Diagnosis:**
```bash
# Check certificate data in database
docker compose exec backend python manage.py shell
from api.models import Certificate
cert = Certificate.objects.first()
print(f"ID: {cert.id}")
print(f"Token: {cert.validation_token}")
print(f"Token is None: {cert.validation_token is None}")
exit()
```

### Issue: Frontend build failed
```bash
# Check build logs
docker compose logs frontend | tail -50

# Rebuild with detailed output
docker compose build --no-cache --progress=plain frontend
```

### Issue: Containers not starting
```bash
# Check docker compose status
docker compose ps -a

# Check backend logs
docker compose logs backend | tail -20

# Try restarting
docker compose restart backend
docker compose restart frontend
```

---

## 📝 Technical Details

### Backend Changes
- **Migration 0011**: Adds `validation_token` field to Certificate model
- **Serializer**: `get_qr_code_url()` method generates URL using validation token
- **No API changes**: Existing endpoints return QR URL in response

### Frontend Changes
- **Conditional rendering**: `{certificate.qr_code_url && (...)}`
- **QR Code component**: Uses `qrcode.react` to render QR
- **CSS styling**: `.certificate-qr-code` positioned on certificate

### QR Code Flow
```
Certificate in DB
    ↓
Serializer reads validation_token
    ↓
QR URL generated: /certificate/validate/{token}/
    ↓
Frontend receives qr_code_url
    ↓
QRCode component renders QR code
    ↓
User scans → Certificate validation page
```

---

## ⚡ Summary

**What was broken:**
- Certificates created before migration didn't have `validation_token`
- Without token, QR code URL couldn't be generated
- QR code didn't render on frontend

**What's fixed:**
- Migration applied to database
- Existing certificates populated with validation tokens
- Frontend receives valid QR code URL
- QR codes now display and are scannable

**Timeline to fix:**
- ~30 seconds: SSH and pull code
- ~2-3 minutes: Run migrations + populate tokens
- ~3-5 minutes: Rebuild frontend
- ~1 minute: Verify and test

**Total: ~6-10 minutes**

