# Quick Docker Test Guide

## Test Docker Setup Locally (Before AWS Deployment)

### Prerequisites
- Docker Desktop installed and running
- Git repository cloned

### Steps

1. **Copy environment file**
   ```bash
   cp .env.example .env
   ```

2. **Edit .env file** (use localhost values for testing)
   ```bash
   SECRET_KEY=test-secret-key-for-local-development
   DEBUG=True
   DB_NAME=lms_db
   DB_USER=lms_user
   DB_PASSWORD=test_password
   DB_HOST=db
   ALLOWED_HOSTS=localhost,127.0.0.1
   CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
   REDIS_PASSWORD=test_redis_password
   ```

3. **Build and run**
   ```bash
   # Build images
   docker compose -f docker-compose.prod.yml build

   # Start services
   docker compose -f docker-compose.prod.yml up -d

   # Check status
   docker compose -f docker-compose.prod.yml ps
   ```

4. **Verify services**
   ```bash
   # Test health endpoint
   curl http://localhost:8000/api/v1/health/

   # Test admin panel
   # Open browser: http://localhost:8000/admin/
   # Login: admin / admin123
   ```

5. **View logs**
   ```bash
   # All services
   docker compose -f docker-compose.prod.yml logs -f

   # Backend only
   docker compose -f docker-compose.prod.yml logs -f backend
   ```

6. **Stop services**
   ```bash
   docker compose -f docker-compose.prod.yml down
   ```

### Expected Result
- ✅ All containers running
- ✅ Health endpoint returns 200 OK
- ✅ Admin panel accessible
- ✅ No errors in logs

### If Everything Works
You're ready for AWS deployment! Follow `AWS_DEPLOYMENT_GUIDE.md`

### If Issues
Check logs:
```bash
docker compose -f docker-compose.prod.yml logs backend
```

Common fixes:
- Port already in use: Change port in docker-compose.prod.yml
- Database error: Check DB_PASSWORD matches in .env
- Connection refused: Wait 30 seconds for containers to start
