#!/bin/bash
# ============================================
# Docker Deployment Script - Development
# LMSetjen DPD RI - Learning Management System
# ============================================

set -e

echo "🚀 Starting LMS Docker Deployment (Development)"
echo "================================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env.docker" ]; then
    echo "⚠️  Warning: .env.docker not found. Creating from example..."
    if [ -f ".env.docker.example" ]; then
        cp .env.docker.example .env.docker
        echo "✅ Created .env.docker from example"
        echo "📝 Please edit .env.docker with your configuration"
        exit 1
    else
        echo "❌ Error: .env.docker.example not found"
        exit 1
    fi
fi

# Load environment variables
export $(cat .env.docker | grep -v '^#' | xargs)

echo "📦 Building Docker images..."
docker-compose build --no-cache

echo "🗑️  Removing old containers (if any)..."
docker-compose down -v

echo "🚀 Starting services..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo ""
echo "🔍 Checking service health..."

if docker-compose ps | grep -q "Up"; then
    echo "✅ Services are running!"
    echo ""
    echo "📊 Service Status:"
    docker-compose ps
    echo ""
    echo "🌐 Access your application:"
    echo "   Frontend: http://localhost"
    echo "   Backend API: http://localhost:8000"
    echo "   Admin Panel: http://localhost:8000/admin"
    echo ""
    echo "📝 Useful commands:"
    echo "   View logs: docker-compose logs -f"
    echo "   Stop services: docker-compose down"
    echo "   Restart services: docker-compose restart"
    echo "   Execute Django commands: docker-compose exec backend python manage.py <command>"
    echo ""
    echo "✅ Deployment completed successfully!"
else
    echo "❌ Some services failed to start. Check logs:"
    docker-compose logs
    exit 1
fi
