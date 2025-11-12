# 🎯 Specific Diagnostic - Test Certificate API Response

Run these commands on your production server to see exactly what the API is returning:

## Step 1: Get First Certificate Details

```bash
docker compose exec -T backend python << 'EOF'
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Certificate
import json

if Certificate.objects.exists():
    cert = Certificate.objects.first()
    print(f"First certificate ID: {cert.id}")
    print(f"Course ID: {cert.course.course_id if cert.course else 'N/A'}")
    print(f"User ID: {cert.user.id if cert.user else 'N/A'}")
else:
    print("No certificates found")
EOF
```

## Step 2: Test Serializer with Proper Request Context

```bash
docker compose exec -T backend python << 'EOF'
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Certificate
from api.serializer import CertificateSerializer
from django.test import RequestFactory
import json

if not Certificate.objects.exists():
    print("No certificates found!")
else:
    cert = Certificate.objects.first()
    
    # Create a mock request with proper host
    factory = RequestFactory()
    request = factory.get('/')
    request.META['HTTP_HOST'] = 'lmsetjendpdri.duckdns.org'
    request.META['wsgi.url_scheme'] = 'https'
    
    # Serialize with request context
    serializer = CertificateSerializer(cert, context={'request': request})
    data = serializer.data
    
    print("\n=== SERIALIZER OUTPUT ===\n")
    print(json.dumps({
        'id': data.get('id'),
        'certificate_id': data.get('certificate_id'),
        'validation_token': data.get('validation_token'),
        'qr_code_url': data.get('qr_code_url'),
        'course_title': data.get('course_title'),
        'student_name': data.get('student_name'),
        'date': data.get('date'),
    }, indent=2))
    
    print("\n=== ANALYSIS ===\n")
    if not data.get('validation_token'):
        print("❌ PROBLEM: validation_token is None/Empty")
        print(f"   DB value: {cert.validation_token}")
    else:
        print(f"✅ validation_token present: {data.get('validation_token')}")
    
    if not data.get('qr_code_url'):
        print("❌ PROBLEM: qr_code_url is None")
    else:
        print(f"✅ qr_code_url present: {data.get('qr_code_url')}")
EOF
```

## Step 3: Verify API Endpoint Returns It

Get the certificate via the actual API endpoint:

```bash
# Get user token first
USER_ID=1  # Change to actual user ID
COURSE_ID=223339

# If you have curl with auth:
curl -s "https://lmsetjendpdri.duckdns.org/api/v1/student/certificate-eligibility/$USER_ID/$COURSE_ID/" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  | python3 -m json.tool | grep -A 5 -B 5 "qr_code_url"
```

## Step 4: Check Frontend Request

**In browser (F12 - Network Tab):**

1. Visit: https://lmsetjendpdri.duckdns.org/student/courses/223339/
2. Open DevTools (F12)
3. Go to Network tab
4. Look for API calls:
   - `/api/v1/student/certificate-eligibility/...`
   - `/api/v1/student/certificate-generate/`
5. Click on the request
6. Look at Response tab
7. Search for `qr_code_url`

**What to report:**

```
Does "qr_code_url" appear in the response? YES / NO

If YES:
  - What is its value?
  - Is it null?
  - Is it a proper URL?

If NO:
  - Certificate endpoint being called?
  - What fields ARE in the response?
```

## Expected Correct Output

```json
{
  "id": 1,
  "certificate_id": "123456",
  "validation_token": "a1b2c3d4e5f6",
  "qr_code_url": "https://lmsetjendpdri.duckdns.org/certificate/validate/a1b2c3d4e5f6/",
  "course_title": "Course Name",
  "student_name": "Student Name",
  "date": "2025-11-12T10:00:00Z"
}
```

## If qr_code_url is NULL

Check the source:

```python
# In CertificateSerializer.get_qr_code_url():
def get_qr_code_url(self, obj):
    request = self.context.get('request')
    if request:
        domain = request.get_host()
        protocol = 'https' if request.is_secure() else 'http'
        return f"{protocol}://{domain}/certificate/validate/{obj.validation_token}/"
    return None  # ← Could be returning None here
```

If qr_code_url is null, it means:
1. `request` is not in context, OR
2. `obj.validation_token` is None/empty

---

## Complete Diagnostic Output Template

Please run all steps and provide output in this format:

```
STEP 1 - Certificate Found:
[paste output]

STEP 2 - Serializer Output:
[paste JSON output]

STEP 3 - API Endpoint Test:
[paste curl response or note if couldn't test]

STEP 4 - Browser Network:
Does qr_code_url appear: YES / NO
Value if present: [paste value]

Final Analysis:
[what you think the problem is]
```

This will help us pinpoint exactly where the issue is!
