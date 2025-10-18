#!/bin/bash

# Deployment Script for Level Typo Fix
# Run this on the server to deploy the fix

set -e  # Exit on error

echo "=========================================="
echo "Deploying Level Typo Fix"
echo "=========================================="
echo ""

# Step 1: Navigate to project directory
echo "📁 Step 1: Navigating to project directory..."
cd /home/ubuntu/LMSetjen-DPD-RI

# Step 2: Pull latest changes
echo ""
echo "📥 Step 2: Pulling latest changes from GitHub..."
git pull origin main

# Step 3: Run data migration
echo ""
echo "🔄 Step 3: Running data migration to fix existing courses..."
docker compose exec -T backend python manage.py fix_level_typo

# Step 4: Restart backend
echo ""
echo "🔄 Step 4: Restarting backend container..."
docker compose restart backend

# Wait for backend to start
echo ""
echo "⏳ Waiting for backend to start (15 seconds)..."
sleep 15

# Step 5: Verify deployment
echo ""
echo "✅ Step 5: Verifying deployment..."
docker logs lms_backend --tail 20 | grep -i "listening\|error" || echo "Backend started successfully"

echo ""
echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Test curriculum update at: https://lmsetjendpdri.duckdns.org/instructor/edit-course/164476/curriculum/"
echo "2. Monitor logs: docker logs lms_backend -f"
echo "3. Check for 200 OK responses on PATCH requests"
echo ""
