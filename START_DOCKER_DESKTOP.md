# Docker Desktop is Installed But NOT Running

## Problem
✅ Docker is installed: `Docker version 24.0.7, build afdd53b`  
❌ Docker daemon is NOT running

## Solution - Start Docker Desktop

### For Windows 11/10:

**Option 1: Start from Start Menu**
1. Press `Windows Key`
2. Type: `Docker Desktop`
3. Click the result to launch it
4. Wait 30-60 seconds for it to fully start

**Option 2: Start from Terminal (PowerShell Admin)**
1. Right-click PowerShell → "Run as administrator"
2. Run: `& "C:\Program Files\Docker\Docker\Docker Desktop.exe"`
3. Wait 30-60 seconds for it to fully start

**Option 3: Start Automatically on Boot**
1. Open Docker Desktop application
2. Click Settings (⚙️ icon)
3. Under "General" → Check "Start Docker Desktop when you login"

---

## Verify Docker is Running

```powershell
# Run this command - it should show containers (may be empty)
docker ps

# Or check the version again
docker --version
```

**Success looks like:**
```
CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES
(empty list is fine on first run)
```

**Failure looks like:**
```
error during connect: this error may indicate that the docker daemon is not running
```

---

## After Docker is Running

1. Docker Desktop will show a green checkmark in the system tray (bottom right)
2. Then run the setup script again:
   ```powershell
   .\SETUP_SCRIPT.ps1
   ```

---

## Quick Checklist

Before running setup script again, verify:

```powershell
# Check 1: Docker running
docker --version              # Should show: Docker version 24.0.7

# Check 2: Docker engine running  
docker ps                     # Should show containers (empty is OK)

# Check 3: Docker Compose available
docker-compose --version      # Should show a version

# Check 4: Can access docker-compose.yml
Test-Path ".\docker-compose.yml"  # Should show: True
```

---

## If Still Having Issues

Try these commands:

```powershell
# View Docker logs
docker logs postgres          # Check PostgreSQL container

docker logs redis             # Check Redis container

# Restart Docker services
docker-compose restart

# Full cleanup and restart
docker-compose down
docker-compose up -d
```

---

## Note for Windows 10 Home Users

If you're on Windows 10 Home, Docker Desktop requires **WSL2 (Windows Subsystem for Linux 2)**.

Check if installed:
```powershell
wsl --version
```

If not installed:
```powershell
wsl --install
# Then restart computer
```

After restart, Docker Desktop should work fully.

---

**Your Status:**
- ✅ Docker installed
- ❌ Docker daemon not running ← **FIX THIS FIRST**
- ⏳ Setup script will work after Docker starts

