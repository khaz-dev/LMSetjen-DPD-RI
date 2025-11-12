#!/bin/bash
# Production Diagnostic Script - Certificate QR Code Debugging
# This script checks all aspects of the certificate QR code system

echo "======================================================================"
echo "🔍 Certificate QR Code - Production Diagnostic"
echo "======================================================================"
echo ""

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: docker-compose.yml not found!"
    exit 1
fi

echo "📊 DIAGNOSTIC REPORT"
echo "======================================================================"
echo ""

# 1. Check Migration Status
echo "1️⃣  CHECKING MIGRATION STATUS..."
echo "=================================="
docker compose exec -T backend python manage.py migrate --list | grep "0011" || echo "❌ Migration 0011 not found in list"
echo ""

# 2. Check Column Exists
echo "2️⃣  CHECKING DATABASE COLUMN..."
echo "=================================="
docker compose exec -T backend python << 'EOF'
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Certificate
try:
    field = Certificate._meta.get_field('validation_token')
    print(f"✅ Column exists: {field.name}")
    print(f"   Type: {field.get_internal_type()}")
    print(f"   Unique: {field.unique}")
    print(f"   Null: {field.null}")
except Exception as e:
    print(f"❌ Column error: {e}")
print("")
EOF

# 3. Check Total Certificates
echo "3️⃣  CHECKING CERTIFICATE DATA..."
echo "=================================="
docker compose exec -T backend python << 'EOF'
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Certificate

total = Certificate.objects.count()
with_token = Certificate.objects.filter(validation_token__isnull=False).exclude(validation_token='').count()
without_token = Certificate.objects.filter(validation_token__isnull=True).count()
empty_token = Certificate.objects.filter(validation_token='').count()

print(f"Total certificates: {total}")
print(f"With token (not null, not empty): {with_token}")
print(f"Without token (null): {without_token}")
print(f"Empty token (''): {empty_token}")
print("")

if total > 0:
    print("Sample certificates:")
    for cert in Certificate.objects.all()[:5]:
        print(f"  ID: {cert.id}")
        print(f"    Certificate ID: {cert.certificate_id}")
        print(f"    Validation Token: {cert.validation_token if cert.validation_token else '❌ NULL'}")
        print(f"    Course: {cert.course.title if cert.course else 'N/A'}")
        print(f"    User: {cert.user.full_name if cert.user else 'N/A'}")
        print("")
EOF

# 4. Check Serializer Output
echo "4️⃣  CHECKING SERIALIZER OUTPUT..."
echo "=================================="
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
    
    print(f"Certificate ID: {data.get('certificate_id')}")
    print(f"Validation Token: {data.get('validation_token')}")
    print(f"QR Code URL: {data.get('qr_code_url')}")
    print("")
    
    if not data.get('validation_token'):
        print("❌ ISSUE: validation_token is empty/null in serializer")
    elif not data.get('qr_code_url'):
        print("❌ ISSUE: qr_code_url not generated despite having token")
    else:
        print("✅ QR Code URL would display on frontend")
else:
    print("❌ No certificates found in database")
print("")
EOF

# 5. Check Frontend Component
echo "5️⃣  CHECKING FRONTEND COMPONENT..."
echo "=================================="
echo "Checking if CertificateTab.jsx has QR code rendering..."
docker compose exec -T frontend grep -n "qr_code_url\|QRCode" /app/src/views/base/CertificateTab.jsx 2>/dev/null || echo "⚠️  Could not check frontend component"
echo ""

# 6. Check Browser Console Errors
echo "6️⃣  CHECKING API ENDPOINT..."
echo "=================================="
echo "You should manually test the API endpoint from browser:"
echo "  URL: https://lmsetjendpdri.duckdns.org/api/v1/student/certificate/"
echo "  Look for: \"qr_code_url\" field in response"
echo ""

# 7. Summary
echo "7️⃣  DIAGNOSTIC SUMMARY"
echo "=================================="
echo ""
echo "To resolve QR code not showing, check:"
echo ""
echo "Priority 1 - Database:"
echo "  [ ] Migration 0011 is applied (should be [X] in list)"
echo "  [ ] validation_token column exists"
echo "  [ ] All certificates have non-null validation_token"
echo ""
echo "Priority 2 - API:"
echo "  [ ] CertificateSerializer returns qr_code_url"
echo "  [ ] qr_code_url is not null/empty"
echo "  [ ] qr_code_url has proper format"
echo ""
echo "Priority 3 - Frontend:"
echo "  [ ] CertificateTab receives qr_code_url from API"
echo "  [ ] QRCode component renders when qr_code_url exists"
echo "  [ ] No console errors in browser"
echo ""

echo "======================================================================"
echo "✅ Diagnostic complete!"
echo "======================================================================"
