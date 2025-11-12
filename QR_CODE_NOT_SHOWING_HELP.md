# ⚠️ QR Code Still Not Showing - Let's Diagnose

Great news! The fix script ran successfully and tokens ARE in the database.

But the QR code still isn't showing on the website. Let's find out why.

## 🔍 Run This Diagnostic (Copy & Paste on Production)

```bash
cd ~/LMSetjen-DPD-RI

# Test 1: Check token in database
docker compose exec -T backend python << 'EOF'
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Certificate
cert = Certificate.objects.first()
print(f"Certificate ID: {cert.id}")
print(f"Token in DB: {cert.validation_token}")
print(f"Token is NULL: {cert.validation_token is None}")
print(f"Token is empty: {cert.validation_token == ''}")
print(f"Token value: '{cert.validation_token}'")
EOF

# Test 2: Check serializer output
docker compose exec -T backend python << 'EOF'
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Certificate
from api.serializer import CertificateSerializer
from django.test import RequestFactory

factory = RequestFactory()
request = factory.get('/api/')
request.META['HTTP_HOST'] = 'lmsetjendpdri.duckdns.org'
request.is_secure = lambda: True

cert = Certificate.objects.first()
serializer = CertificateSerializer(cert, context={'request': request})
data = serializer.data

print(f"API Response for Certificate:")
print(f"  certificate_id: {data.get('certificate_id')}")
print(f"  validation_token: {data.get('validation_token')}")
print(f"  qr_code_url: {data.get('qr_code_url')}")
EOF

# Test 3: Check browser API call
echo ""
echo "BROWSER TEST:"
echo "1. Open: https://lmsetjendpdri.duckdns.org"
echo "2. Go to: Certificate tab on course 223339"
echo "3. Press F12 (open developer tools)"
echo "4. Go to: Network tab"
echo "5. Look for API call to: /api/v1/student/certificate/"
echo "6. Click on it and check Response"
echo "7. Look for: 'qr_code_url' field"
echo ""
echo "If qr_code_url is NOT in the response:"
echo "  → API is not returning it"
echo ""
echo "If qr_code_url IS in the response but QR still doesn't show:"
echo "  → Frontend/React component issue"
echo "  → Browser cache issue"
EOF
```

## 📋 What to Check

After running the diagnostic above, report back:

1. **Database token value:**
   - Is it NULL? 
   - Is it empty string ''?
   - Is it a valid value like 'a1b2c3d4e5f6'?

2. **Serializer output:**
   - Does qr_code_url show a proper URL?
   - Or is it NULL/None?

3. **Browser Network tab:**
   - Does API response include qr_code_url?
   - What's its value?

## 🎯 Most Likely Issues

Based on the script running successfully, the issue is likely:

### Issue A: Browser Cache
**Symptom:** Token in DB ✅, API returns URL ✅, but still no QR
**Fix:**
```bash
# Hard refresh browser
Press: Ctrl + Shift + R  (or Cmd + Shift + R on Mac)

# Or clear cache in settings
# Then revisit the page
```

### Issue B: Frontend Component Bug
**Symptom:** API returns qr_code_url but component doesn't render it
**Check:**
```
1. Browser F12 → Console tab
2. Look for any red errors
3. Copy any errors and report
```

### Issue C: API Endpoint Different
**Symptom:** Using wrong API endpoint
**Check:**
```
What endpoint is frontend calling?
  - /api/v1/student/certificate/? (GET all)
  - /api/v1/student/certificate/{id}/ (GET single)
```

### Issue D: CORS or Network Error
**Symptom:** API call fails silently
**Check:**
```
Browser F12 → Network tab
Look for failed requests (red text)
Check for CORS errors
```

## 🚀 Quick Fixes to Try

### Fix 1: Browser Cache
```bash
# Ctrl + Shift + R on Windows/Linux
# Cmd + Shift + R on Mac
# Or: Settings → Clear browsing data → Clear cache
```

### Fix 2: Restart Backend
```bash
docker compose restart backend

# Wait 10 seconds, then refresh page
```

### Fix 3: Force Rebuild Frontend
```bash
docker compose restart frontend

# Wait 10 seconds for rebuild
# Then refresh page
```

## 📊 Debug Output Format

Please run the diagnostic and share:

```
Certificate Token: [value here]
Serializer qr_code_url: [value here]
Browser API Response: [paste qr_code_url field]
Browser Console Errors: [yes/no, if yes paste them]
```

## 🔍 If Still Stuck

1. Share the diagnostic output
2. Check browser console for errors
3. Take a screenshot of:
   - Network tab showing API response
   - Console tab showing any errors
   - Certificate tab on website

Then we can diagnose the exact issue!

---

**Quick Checklist:**
- [ ] Run diagnostic tests above
- [ ] Share output
- [ ] Try browser cache clear
- [ ] Try restart backend
- [ ] Check browser console
- [ ] Check network tab in DevTools
