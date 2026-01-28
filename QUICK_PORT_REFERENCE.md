# 🚀 Quick Port Reference Guide

## Current Port Configuration (After Migration)

```
┌─────────────────────────────────────────────────────────────┐
│                    ACCESSIBLE PORTS                          │
├─────────────────────────────────────────────────────────────┤
│ Frontend        │ 3000 (HTTP)  + 3443 (HTTPS)               │
│ Backend API     │ 9000 (HTTP)                                │
│ PostgreSQL      │ 5433 (from host, 5432 internal)           │
│ Redis Cache     │ 6380 (from host, 6379 internal)           │
└─────────────────────────────────────────────────────────────┘
```

## Access URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:3000 | Main LMS Application |
| **Backend API** | http://localhost:9000/api/v1/ | REST API Endpoints |
| **API Health** | http://localhost:9000/api/v1/health/ | Server Status |
| **Admin Panel** | http://localhost:9000/admin/ | Django Admin |
| **API Docs** | http://localhost:9000/swagger/ | Swagger Documentation |
| **Database** | localhost:5433 | Direct PostgreSQL Connection |
| **Redis** | localhost:6380 | Direct Redis Connection |

## Why These Ports?

- **3000**: Standard development frontend port (Vite, React dev servers)
- **9000**: Common alternative backend port (avoids conflicts with 8000)
- **5433**: Adjacent to standard 5432 (reduces conflicts)
- **6380**: Adjacent to standard 6379 (reduces conflicts)

## Docker Internal Network (Don't modify)

Inside Docker, services communicate via internal DNS:
- Backend listens on: `0.0.0.0:8000` (internal)
- nginx proxies to: `backend:8000` (Docker DNS resolution)
- Database at: `postgres:5432` (internal)
- Redis at: `redis:6379` (internal)

## Useful Docker Commands

```bash
# Check running containers
docker-compose ps

# View logs
docker-compose logs backend    # Backend logs
docker-compose logs frontend   # Frontend logs
docker-compose logs postgres   # Database logs
docker-compose logs redis      # Cache logs

# Follow logs (real-time)
docker-compose logs -f backend

# Stop all services
docker-compose down

# Restart all services
docker-compose restart

# Rebuild images
docker-compose build backend frontend

# Full restart with rebuild
docker-compose down && docker-compose build && docker-compose up -d
```

## Files Changed for Port Migration

1. **docker-compose.yml** - Port mappings in service definitions
2. **.env** - Backend/frontend URLs and database port
3. **frontend/src/utils/constants.js** - Hardcoded localhost:9000
4. **frontend/src/utils/axios.js** - Axios fallback to localhost:9000
5. **frontend/src/views/auth/Login-NEW.jsx** - Console reference
6. **frontend/Dockerfile.prod** - New optimized Dockerfile (NEW)

## Network Connectivity Test

```bash
# Test all endpoints
curl http://localhost:9000/api/v1/health/      # Backend
curl http://localhost:3000                      # Frontend
curl http://localhost:5433                      # PostgreSQL
curl http://localhost:6380                      # Redis (PONG response expected)
```

## Configuration for Public Server Deployment

When deploying to a public server with IP `YOUR_IP`:

1. Update **.env**:
   ```
   ALLOWED_HOSTS=YOUR_IP,your-domain.com
   CORS_ALLOWED_ORIGINS=http://YOUR_IP:3000,http://YOUR_IP:3443,http://your-domain.com:3000
   FRONTEND_SITE_URL=http://YOUR_IP:3000
   BACKEND_SITE_URL=http://YOUR_IP:9000
   ```

2. Access from browser:
   ```
   http://YOUR_IP:3000          # Frontend
   http://YOUR_IP:9000/api/v1/  # Backend API
   ```

3. For SSL/HTTPS (optional):
   - Use port 3443 (nginx configured)
   - Copy SSL certificates to `docker/nginx/ssl/`

## Performance Tips

- **Ports 9000, 3000, 5433, 6380** are typically unused on most systems
- **No port conflicts** - safe for development & production
- **Scalable** - multiple instances can bind to different host ports
- **Docker internal** - inter-service communication unchanged (optimal)

---

✨ **System Ready for Deployment** ✨
