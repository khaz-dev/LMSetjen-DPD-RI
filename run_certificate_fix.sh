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

docker compose exec -T backend python manage.py shell << 'PYTHON_EOF'
import sys
sys.path.insert(0, '/app')

# Import and run the population script
exec(open('/app/backend/populate_validation_tokens.py').read())
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
