#!/bin/bash
# Certificate QR Code - Validation Token Population
# This script safely populates validation tokens for existing certificates
# Run on production server: bash run_certificate_fix.sh

echo "======================================================================"
echo "🔧 Certificate QR Code Fix - Validation Token Population"
echo "======================================================================"
echo ""

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: docker-compose.yml not found!"
    echo "   Please run this script from the project root directory"
    echo "   Example: cd ~/LMSetjen-DPD-RI && bash run_certificate_fix.sh"
    exit 1
fi

echo "📍 Working directory: $(pwd)"
echo "📍 Docker compose file found: ✓"
echo ""

# Run the Python script in the container
echo "🚀 Executing validation token population script..."
echo "   This will take ~30 seconds..."
echo ""

# Run the Python script directly (embedded in container)
docker compose exec -T backend python << 'PYTHON_EOF'
import sys
import os

# Add app to path
sys.path.insert(0, '/app')
os.chdir('/app')

# Setup Django
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

# Import models
from api.models import Certificate
import shortuuid

print("=" * 70)
print("🔧 Certificate Validation Token Population Script")
print("=" * 70)

# Initialize ShortUUID generator with correct parameters
su = shortuuid.ShortUUID(alphabet="abcdefghijklmnopqrstuvwxyz0123456789")

# Check current status
all_certs = Certificate.objects.all()
certs_with_token = all_certs.filter(validation_token__isnull=False)
certs_without_token = all_certs.filter(validation_token__isnull=True)

print(f"\n📊 Current Status:")
print(f"  Total certificates: {all_certs.count()}")
print(f"  With validation_token: {certs_with_token.count()}")
print(f"  Without validation_token: {certs_without_token.count()}")

if certs_without_token.count() == 0:
    print("\n✅ All certificates already have validation tokens!")
    print("   No action needed.")
else:
    print(f"\n🔄 Generating validation tokens for {certs_without_token.count()} certificates...")
    
    
    successful = 0
    failed = 0
    
    for idx, cert in enumerate(certs_without_token, 1):
        try:
            # Generate unique token using shortuuid
            # ShortUUID().random(length) generates a random short UUID
            for attempt in range(100):
                # Generate 12-character short UUID with alphanumeric alphabet
                new_token = shortuuid.ShortUUID(
                    alphabet="abcdefghijklmnopqrstuvwxyz0123456789"
                ).random(12)
                
                # Check if token already exists
                if not Certificate.objects.filter(validation_token=new_token).exists():
                    cert.validation_token = new_token
                    cert.save()
                    successful += 1
                    
                    # Progress indicator
                    if idx % 10 == 0 or idx == certs_without_token.count():
                        print(f"  ✓ Processed {idx}/{certs_without_token.count()}")
                    
                    break
        except Exception as e:
            print(f"  ✗ Error on certificate {cert.id}: {e}")
            failed += 1
    
    print(f"\n✅ Completed!")
    print(f"  Successfully updated: {successful}")
    print(f"  Failed: {failed}")
    
    # Verify
    remaining = Certificate.objects.filter(validation_token__isnull=True).count()
    print(f"\n✅ All certificates now have validation tokens!" if remaining == 0 else f"⚠️  {remaining} still need tokens")
PYTHON_EOF

EXIT_CODE=$?

echo ""
echo "======================================================================"
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Script completed successfully!"
    echo ""
    echo "🔍 Verifying the fix..."
    docker compose exec -T backend python manage.py shell << 'VERIFY'
from api.models import Certificate
certs_without_token = Certificate.objects.filter(validation_token__isnull=True).count()
total_certs = Certificate.objects.count()
certs_with_token = total_certs - certs_without_token

print("")
print("📊 Final Status:")
print(f"   Total certificates: {total_certs}")
print(f"   With validation tokens: {certs_with_token}")
print(f"   Without validation tokens: {certs_without_token}")

if certs_without_token == 0:
    print("")
    print("✅ All certificates now have validation tokens!")
    print("")
    print("🎉 QR codes will now display on the certificate tab!")
else:
    print(f"⚠️  {certs_without_token} certificates still need tokens")

print("")
VERIFY
else
    echo "❌ Script failed with exit code: $EXIT_CODE"
    echo ""
    echo "📋 Troubleshooting:"
    echo "   1. Check if backend container is running: docker compose ps"
    echo "   2. Check container logs: docker compose logs backend"
    echo "   3. Try again: bash run_certificate_fix.sh"
    exit 1
fi

echo "======================================================================"
echo ""
echo "✨ Done! You can now:"
echo "   1. Visit: https://lmsetjendpdri.duckdns.org/student/courses/223339/"
echo "   2. Click on Certificate tab"
echo "   3. Verify QR code is now visible"
echo ""
