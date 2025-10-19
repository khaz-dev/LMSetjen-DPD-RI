#!/bin/bash
# Deployment Commands for CSS Loading Fix
# Run these commands on the production server

echo "=== Step 1: Pull latest code from GitHub ==="
cd ~/LMSetjen-DPD-RI
git pull origin main

echo ""
echo "=== Step 2: Verify index.html changes ==="
echo "Checking for 'Critical Admin Styles' in index.html..."
grep -n "Critical Admin Styles" frontend/index.html
if [ $? -eq 0 ]; then
    echo "✅ Changes found in index.html"
else
    echo "❌ Changes NOT found - check git pull"
    exit 1
fi

echo ""
echo "=== Step 3: Rebuild frontend container with no cache ==="
docker compose build --no-cache frontend

echo ""
echo "=== Step 4: Restart frontend container ==="
docker compose restart frontend

echo ""
echo "=== Step 5: Verify container is running ==="
docker compose ps frontend

echo ""
echo "=== Step 6: Check index.html inside container ==="
docker exec lms_frontend_prod cat /usr/share/nginx/html/index.html | grep -A 5 "Critical Admin Styles"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Clear your browser cache (Ctrl+Shift+Delete)"
echo "2. Visit https://lmsetjendpdri.duckdns.org/admin/dashboard/"
echo "3. Open DevTools Console (F12)"
echo "4. Verify NO 'integrity mismatch' warning appears"
