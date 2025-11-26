#!/bin/bash

# Fix Production Build - Install Dependencies and Rebuild
# This script runs on the Ubuntu production server

cd /home/ubuntu/LMSetjen-DPD-RI

echo "🔧 Installing frontend dependencies..."
cd frontend
npm install --prefer-offline --no-audit

echo "🏗️  Rebuilding frontend..."
npm run build

echo "✅ Build complete!"
cd ../backend

echo "🔄 Restarting Docker services..."
docker-compose down
docker-compose up -d

echo "✨ Deployment complete!"
