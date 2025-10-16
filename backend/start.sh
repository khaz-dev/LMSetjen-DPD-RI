#!/bin/bash
# Render.com Startup Script for Django Backend
# This script runs migrations and starts the Django server

set -e  # Exit on any error

echo "========================================"
echo "Starting Django Application on Render"
echo "========================================"

# Wait a moment for database to be ready
echo "Waiting for database to be ready..."
sleep 2

# Run database migrations
echo "Running database migrations..."
python manage.py migrate --noinput

# Check migration status
echo "Checking migration status..."
python manage.py showmigrations

# Collect static files (if needed)
echo "Collecting static files..."
python manage.py collectstatic --noinput --clear || echo "Static files collection skipped"

# Create superuser if it doesn't exist (optional)
echo "Checking for superuser..."
python manage.py shell -c "
from django.contrib.auth import get_user_model;
User = get_user_model();
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@lmsdpdri.com', 'admin123');
    print('Superuser created: admin / admin123');
else:
    print('Superuser already exists');
" || echo "Superuser creation skipped"

echo "========================================"
echo "Starting Gunicorn Server..."
echo "========================================"

# Start Gunicorn
exec gunicorn \
    --bind 0.0.0.0:8000 \
    --workers 2 \
    --threads 2 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    --log-level info \
    backend.wsgi:application
