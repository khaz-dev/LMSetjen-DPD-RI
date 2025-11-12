# QR Code Not Showing - Complete Troubleshooting Guide

## 🔴 Problem
QR code not visible on certificate tab even after running the fix script

## 🔍 Root Cause Analysis - Step by Step

### Step 1: Verify Migration Was Applied

**On production server:**
```bash
docker compose exec -T backend python manage.py migrate --list | grep "0011"

# Should show: [X] 0011_add_certificate_validation_token
#              ^ X means applied
```

If you see `[ ]` instead of `[X]`:
- Migration was NOT applied
- Solution: Run `bash run_certificate_fix.sh` again

---

### Step 2: Check Database Column Exists

```bash
docker compose exec -T backend python << 'EOF'
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Certificate
try:
    field = Certificate._meta.get_field('validation_token')
    print(f"✅ Column exists: {field.name}")
except Exception as e:
    print(f"❌ ERROR: {e}")
EOF
```

Expected: `✅ Column exists: validation_token`

If error: Column doesn't exist, run migration again

---

### Step 3: Check If Tokens Were Generated

```bash
docker compose exec -T backend python << 'EOF'
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Certificate

total = Certificate.objects.count()
with_token = Certificate.objects.filter(validation_token__isnull=False).exclude(validation_token='').count()
without_token = Certificate.objects.filter(validation_token__isnull=True).count()

print(f"Total certificates: {total}")
print(f"With tokens: {with_token}")
print(f"Without tokens: {without_token}")

# Show sample
if total > 0:
    cert = Certificate.objects.first()
    print(f"\nSample certificate ID {cert.id}:")
    print(f"  Token: {cert.validation_token if cert.validation_token else '❌ NULL'}")
EOF
```

**Expected Results:**

✅ Good:
```
Total certificates: 1
With tokens: 1
Without tokens: 0

Sample certificate ID 1:
  Token: a1b2c3d4e5f6
```

❌ Problem: Without tokens > 0
- Tokens NOT generated
- Solution: Run `bash run_certificate_fix.sh` again with `--force` if needed

---

### Step 4: Check Serializer Output

Test if API returns qr_code_url:

```bash
docker compose exec -T backend python << 'EOF'
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Certificate
from api.serializer import CertificateSerializer
from django.test import RequestFactory

factory = RequestFactory()
request = factory.get('/api/v1/student/certificate/')
request.META['HTTP_HOST'] = 'lmsetjendpdri.duckdns.org'
request.is_secure = lambda: True

if Certificate.objects.exists():
    cert = Certificate.objects.first()
    serializer = CertificateSerializer(cert, context={'request': request})
    data = serializer.data
    
    print(f"Certificate ID: {cert.id}")
    print(f"Validation Token (DB): {cert.validation_token}")
    print(f"QR Code URL (Serializer): {data.get('qr_code_url')}")
    
    if not data.get('qr_code_url'):
        print("\n❌ PROBLEM: qr_code_url is None")
        print("   Reason: validation_token is missing or empty")
    else:
        print("\n✅ QR Code URL is generated correctly")
EOF
```

**Expected Output:**

✅ Good:
```
Certificate ID: 1
Validation Token (DB): a1b2c3d4e5f6
QR Code URL (Serializer): https://lmsetjendpdri.duckdns.org/certificate/validate/a1b2c3d4e5f6/

✅ QR Code URL is generated correctly
```

❌ Problem:
```
QR Code URL (Serializer): None

❌ PROBLEM: qr_code_url is None
   Reason: validation_token is missing or empty
```

---

### Step 5: Test API Endpoint Directly

**In browser (or curl):**

```bash
curl -s "https://lmsetjendpdri.duckdns.org/api/v1/student/certificate/" \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.[] | {certificate_id, qr_code_url}'
```

Expected output:
```json
{
  "certificate_id": "123456",
  "qr_code_url": "https://lmsetjendpdri.duckdns.org/certificate/validate/a1b2c3d4e5f6/"
}
```

If `qr_code_url` is `null`: Token not generated in database

---

### Step 6: Check Frontend Component

Visit: `https://lmsetjendpdri.duckdns.org/student/courses/223339/`

Open browser console (F12 → Console tab):

**Look for:**
- ❌ Any red errors
- ❌ Network errors (failed API calls)
- Check if QRCode component is rendering

**Test in console:**
```javascript
// Check if QRCode library is loaded
console.log(typeof QRCode)  // Should be "function"

// Check certificate data
// (Depends on your React state, adapt as needed)
```

---

## 🛠️ Troubleshooting Checklist

### If QR Code Not Showing

**Scenario 1: Migration not applied**
```bash
[ ] Step 1: Verify migration with --list
[ ] If not applied: Run bash run_certificate_fix.sh
[ ] Re-check: migrate --list should show [X] 0011
```

**Scenario 2: Tokens not generated**
```bash
[ ] Step 3: Check token count
[ ] If without_token > 0: Tokens missing
[ ] Solution: Run bash run_certificate_fix.sh --force
[ ] Check logs: docker compose logs backend
```

**Scenario 3: Serializer returns null**
```bash
[ ] Step 4: Run serializer test
[ ] If qr_code_url is None: Database tokens are NULL
[ ] Check token value in step 3
[ ] Make sure validation_token is NOT empty string
```

**Scenario 4: Frontend not receiving data**
```bash
[ ] Step 5: Test API endpoint
[ ] If response shows qr_code_url: API is fine
[ ] If still not showing: Frontend issue
[ ] Check browser console for errors
```

---

## 🔧 Quick Fixes

### Fix 1: Re-run Migration
```bash
cd ~/LMSetjen-DPD-RI
docker compose exec -T backend python manage.py migrate api 0011
```

### Fix 2: Force Regenerate All Tokens
```bash
cd ~/LMSetjen-DPD-RI
bash run_certificate_fix.sh
```

### Fix 3: Manual Token Generation
```bash
docker compose exec -T backend python << 'EOF'
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Certificate
import shortuuid

for cert in Certificate.objects.filter(validation_token__isnull=True):
    cert.validation_token = shortuuid.ShortUUID(
        alphabet="abcdefghijklmnopqrstuvwxyz0123456789"
    ).random(12)
    cert.save()
    print(f"Updated cert {cert.id}: {cert.validation_token}")

print("✅ All tokens generated!")
EOF
```

### Fix 4: Clear Cache & Restart Backend
```bash
docker compose exec -T backend python manage.py clear_cache
docker compose restart backend
```

---

## 📊 Quick Diagnostic

Run this to get full status:

```bash
bash production_diagnostic.sh
```

This script checks:
1. ✅ Migration status
2. ✅ Database column exists
3. ✅ Tokens generated
4. ✅ Serializer output
5. ✅ Frontend component
6. ✅ Comprehensive summary

---

## 🎯 Expected vs Actual

### ✅ EXPECTED (After Fix)
```
Database:
- Column api_certificate.validation_token exists ✅
- All certificates have non-null tokens ✅
- Example token: "a1b2c3d4e5f6" ✅

API:
- Endpoint returns qr_code_url ✅
- Example URL: "https://lmsetjendpdri.duckdns.org/certificate/validate/a1b2c3d4e5f6/" ✅

Frontend:
- Certificate tab loads ✅
- QR code image displays ✅
- QR code is clickable ✅
```

### ❌ ACTUAL (Problem Scenarios)

**Problem A: Migration not applied**
```
Database:
- Column api_certificate.validation_token DOES NOT EXIST ❌

Solution: Run bash run_certificate_fix.sh
```

**Problem B: Tokens not generated**
```
Database:
- Column exists ✅
- But all validation_token values are NULL ❌

Solution: Run bash run_certificate_fix.sh
```

**Problem C: API error**
```
API:
- Returns: "qr_code_url": null ❌

Reason: validation_token is NULL or empty in database
Solution: Fix Problem B
```

**Problem D: Frontend not rendering**
```
Frontend:
- API call succeeds ✅
- But QR code doesn't display ❌

Reason: React component issue or CSS hiding QR
Solution: Check browser console for errors
```

---

## 📞 If Still Stuck

1. **Run diagnostic:** `bash production_diagnostic.sh`
2. **Share output** from all steps
3. **Check logs:** `docker compose logs backend | tail -50`
4. **Restart:** `docker compose restart backend`
5. **Retry:** `bash run_certificate_fix.sh`

---

## Summary Table

| What to Check | Command | Expected | Problem |
|--------------|---------|----------|---------|
| Migration | `migrate --list \| grep 0011` | `[X] 0011` | Not applied |
| Column | Django shell | No error | Column missing |
| Tokens | Query DB | with_token > 0 | Tokens NULL |
| Serializer | Test API | qr_code_url not null | Token issue |
| Frontend | Browser | QR code visible | Cache/rendering issue |

