#!/usr/bin/env python
"""
LMSetjen DPD RI - Database Diagnostic Tool
Checks database connectivity and provides setup guidance
"""

import os
import sys
import socket
from pathlib import Path
from environs import Env

# Setup environment reading
env = Env()
env.read_env()

print("=" * 80)
print("🔍 LMSetjen DPD RI - Database Diagnostic Tool")
print("=" * 80)
print()

# ============================================================================
# 1. ENVIRONMENT VARIABLES CHECK
# ============================================================================
print("📋 ENVIRONMENT CONFIGURATION")
print("-" * 80)

mode = env('MODE', default='development')
debug = env.bool('DEBUG', default=True)
db_engine = env('DB_ENGINE', default='django.db.backends.postgresql')
db_host = env('DB_HOST', default='localhost')
db_port = env('DB_PORT', default='5432')
db_name = env('DB_NAME', default='lmsdb')
db_user = env('DB_USER', default='postgres')
db_password = env('DB_PASSWORD', default='secure_password')

print(f"  Mode:          {mode}")
print(f"  Debug:         {debug}")
print(f"  DB Engine:     {db_engine}")
print(f"  DB Host:       {db_host}")
print(f"  DB Port:       {db_port}")
print(f"  DB Name:       {db_name}")
print(f"  DB User:       {db_user}")
print(f"  DB Password:   {'*' * len(db_password)}")
print()

# ============================================================================
# 2. CHECK POSTGRESQL CONNECTIVITY
# ============================================================================
print("🔌 POSTGRESQL CONNECTIVITY CHECK")
print("-" * 80)

if 'postgresql' not in db_engine:
    print("✅ Not using PostgreSQL, skipping PostgreSQL check")
    print()
else:
    # Test basic socket connectivity
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(3)
        result = sock.connect_ex((db_host, int(db_port)))
        sock.close()
        
        if result == 0:
            print(f"✅ PostgreSQL server is REACHABLE at {db_host}:{db_port}")
        else:
            print(f"❌ PostgreSQL server is NOT REACHABLE at {db_host}:{db_port}")
            print("   PostgreSQL may not be running or not listening on this port")
    except Exception as e:
        print(f"❌ Connection test failed: {str(e)}")
    
    # Try actual database connection
    print()
    print("📡 Attempting actual database connection...")
    try:
        import psycopg2
        try:
            conn = psycopg2.connect(
                host=db_host,
                port=int(db_port),
                user=db_user,
                password=db_password,
                database=db_name,
                connect_timeout=5
            )
            print(f"✅ Successfully connected to database '{db_name}'")
            conn.close()
        except psycopg2.OperationalError as e:
            print(f"❌ Failed to connect to database:")
            print(f"   Error: {str(e)}")
            print()
            print("   Possible causes:")
            print(f"   1. PostgreSQL is not running on {db_host}:{db_port}")
            print(f"   2. Database '{db_name}' doesn't exist")
            print(f"   3. Credentials are incorrect (user: {db_user})")
            print(f"   4. Windows Firewall is blocking the connection")
    except ImportError:
        print("⚠️  psycopg2 is not installed")
        print("   Install it with: pip install psycopg2-binary")
    except Exception as e:
        print(f"⚠️  Unexpected error: {str(e)}")
    
    print()

# ============================================================================
# 3. CHECK SYSTEM REQUIREMENTS
# ============================================================================
print("📦 PYTHON PACKAGES CHECK")
print("-" * 80)

required_packages = {
    'django': 'Django',
    'rest_framework': 'Django REST Framework',
    'psycopg2': 'PostgreSQL adapter (psycopg2)',
    'environs': 'Environment variable management',
}

missing_packages = []

for module_name, display_name in required_packages.items():
    try:
        __import__(module_name)
        print(f"  ✅ {display_name}")
    except ImportError:
        print(f"  ❌ {display_name} - NOT INSTALLED")
        missing_packages.append(module_name)

if missing_packages:
    print()
    print(f"  Install missing packages: pip install {' '.join(missing_packages)}")

print()

# ============================================================================
# 4. SOLUTIONS & RECOMMENDATIONS
# ============================================================================
print("🛠️  SOLUTIONS & RECOMMENDATIONS")
print("-" * 80)
print()

if 'postgresql' in db_engine:
    print("Your project is configured to use PostgreSQL.")
    print()
    print("📌 OPTION 1: USE DOCKER (Recommended)")
    print("-" * 80)
    print("If you have Docker installed, use Docker Compose for the database:")
    print()
    print("  # Run PostgreSQL in Docker")
    print("  docker-compose up -d redis lms_postgres")
    print()
    print("  # Then start Django")
    print("  python manage.py runserver")
    print()
    print()
    print("📌 OPTION 2: INSTALL & RUN POSTGRESQL LOCALLY")
    print("-" * 80)
    print("Windows:")
    print("  1. Download PostgreSQL for Windows:")
    print("     https://www.postgresql.org/download/windows/")
    print("  2. Install with:")
    print("     - Username: postgres")
    print("     - Password: Okkdpdri2026")
    print("     - Port: 5432")
    print()
    print("  3. Create the database:")
    print("     In pgAdmin or psql:")
    print("       CREATE DATABASE lmsdb;")
    print()
    print("  4. Then run migrations and start server:")
    print("     python manage.py migrate")
    print("     python manage.py runserver")
    print()
    print()
    print("📌 OPTION 3: SWITCH TO SQLITE FOR LOCAL DEVELOPMENT")
    print("-" * 80)
    print("SQLite doesn't require any setup and is perfect for local development:")
    print()
    print("  1. Edit .env file and change:")
    print("     DEBUG=True")
    print("     MODE=development")
    print()
    print("  2. Edit backend/backend/settings.py and change DATABASES")
    print("     to use SQLite (instructions provided below)")
    print()
    print("  3. Run migrations:")
    print("     python manage.py migrate")
    print()
    print("  4. Create superuser:")
    print("     python manage.py createsuperuser")
    print()
    print("  5. Start server:")
    print("     python manage.py runserver")
    print()

print()
print("=" * 80)
print("For detailed setup instructions, check:")
print("  - docs/DEPLOYMENT_GUIDE_UBUNTU.md")
print("  - README.md")
print("=" * 80)
