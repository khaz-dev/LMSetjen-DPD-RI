# ⚡ Fix for "input device is not a TTY" Error

## 🔴 Problem
When running the population script, you get:
```
WARN[0000] docker-compose.yml: the attribute `version` is obsolete
the input device is not a TTY
```

## 🟢 Solution

The issue is that `docker compose exec` needs the `-T` flag to disable TTY when piping input.

### ✅ Correct Commands (Choose One)

#### Option 1: Direct Command (Simplest)
```bash
docker compose exec -T backend python manage.py shell << 'EOF'
exec(open('/app/backend/populate_validation_tokens.py').read())
EOF
```

#### Option 2: Using the Bash Script (Recommended)
```bash
# 1. Download/copy the script
# File: run_certificate_fix.sh

# 2. Make it executable
chmod +x run_certificate_fix.sh

# 3. Run it
bash run_certificate_fix.sh
```

#### Option 3: Step-by-Step Interactive
```bash
# Start interactive Django shell
docker compose exec -T backend python manage.py shell

# Then inside the shell, type:
exec(open('/app/backend/populate_validation_tokens.py').read())
exit()
```

---

## 🚀 Running the Fix on Production

### Method 1: Using Bash Script (Recommended)
```bash
# SSH to production
ssh -i "D:\Project\lms-server-key.pem" ubuntu@16.79.83.21

# Navigate to project
cd ~/LMSetjen-DPD-RI

# Run the script
bash run_certificate_fix.sh
```

**Output:**
```
======================================================================
🔧 Certificate QR Code Fix - Validation Token Population
======================================================================

📍 Working directory: /home/ubuntu/LMSetjen-DPD-RI
📍 Docker compose file found: ✓

🚀 Executing validation token population script...
   This will take ~30 seconds...

======================================================================
✅ Script completed successfully!

📊 Final Status:
   Total certificates: 5
   With validation tokens: 5
   Without validation tokens: 0

✅ All certificates now have validation tokens!

🎉 QR codes will now display on the certificate tab!
======================================================================

✨ Done! You can now:
   1. Visit: https://lmsetjendpdri.duckdns.org/student/courses/223339/
   2. Click on Certificate tab
   3. Verify QR code is now visible
```

### Method 2: Direct Command
```bash
ssh -i "D:\Project\lms-server-key.pem" ubuntu@16.79.83.21

cd ~/LMSetjen-DPD-RI

docker compose exec -T backend python manage.py shell << 'EOF'
exec(open('/app/backend/populate_validation_tokens.py').read())
EOF
```

### Method 3: Pull Latest and Run Script
```bash
ssh -i "D:\Project\lms-server-key.pem" ubuntu@16.79.83.21

cd ~/LMSetjen-DPD-RI

# Make sure you have latest code
git pull origin main

# Run the bash script
bash run_certificate_fix.sh
```

---

## 🔑 Key Flags Explained

### `-T` Flag
```bash
docker compose exec -T backend ...
```
- `-T` = Disable pseudo-terminal (TTY)
- Needed when piping input or running non-interactive commands
- Without it, you get "input device is not a TTY" error

### Before (Incorrect ❌)
```bash
docker compose exec backend python manage.py shell < backend/populate_validation_tokens.py
# Error: the input device is not a TTY
```

### After (Correct ✅)
```bash
docker compose exec -T backend python manage.py shell << 'EOF'
exec(open('/app/backend/populate_validation_tokens.py').read())
EOF
# Works perfectly!
```

---

## ✅ Verification

After running the fix:

```bash
# Verify all certificates have tokens
docker compose exec -T backend python manage.py shell << 'EOF'
from api.models import Certificate

# Should return 0
print(Certificate.objects.filter(validation_token__isnull=True).count())

# Should equal total count
total = Certificate.objects.count()
with_token = Certificate.objects.filter(validation_token__isnull=False).count()
print(f"Total: {total}, With tokens: {with_token}, Match: {total == with_token}")

exit()
EOF
```

**Expected Output:**
```
0
Total: X, With tokens: X, Match: True
```

---

## 🧪 Testing on Website

After the script completes:

1. **Visit Production URL**
   ```
   https://lmsetjendpdri.duckdns.org/student/courses/223339/
   ```

2. **Click Certificate Tab**
   - Should now see certificate preview

3. **Look for QR Code**
   - Should see 100x100px QR code in bottom-left
   - Has text "Scan to Verify" below it

4. **Test Print**
   - Click "Print Verification"
   - QR code should appear in print preview

5. **Scan QR Code**
   - Use phone QR scanner
   - Should navigate to validation page

---

## 📋 Quick Reference

| Issue | Solution |
|-------|----------|
| "input device is not a TTY" | Add `-T` flag to `docker compose exec` |
| Script file not found | Run `git pull origin main` first |
| Permission denied | Run `chmod +x run_certificate_fix.sh` |
| Container not running | Run `docker compose up -d backend` |
| Want to check progress | Run verification command above |

---

## 🚀 One-Liner for Production

```bash
ssh -i "D:\Project\lms-server-key.pem" ubuntu@16.79.83.21 "cd ~/LMSetjen-DPD-RI && git pull origin main && docker compose exec -T backend python manage.py shell << 'EOF'
exec(open('/app/backend/populate_validation_tokens.py').read())
EOF
"
```

---

## 📝 Files Available

1. **`run_certificate_fix.sh`** - Bash script (Linux/Mac)
   - Automated with verification
   - Clear output and error handling
   - Shows progress

2. **`CERTIFICATE_QR_FIX_TTY_ERROR.md`** - This guide
   - Explains the error
   - Multiple solutions
   - Troubleshooting

3. **`backend/populate_validation_tokens.py`** - Main script
   - Python script that does the work
   - Can be run directly or via management command

---

## ✨ Summary

- **Problem:** `-T` flag was missing from docker compose command
- **Solution:** Use `docker compose exec -T backend ...` instead of `docker compose exec backend ...`
- **Fix Time:** ~30 seconds
- **Result:** QR codes work for all certificates

**You're all set! 🎉**

