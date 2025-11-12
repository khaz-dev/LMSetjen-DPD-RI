# ✅ FIXED: TTY Error Solution

## 🎯 The Problem You Encountered
```
WARN[0000] docker-compose.yml: the attribute `version` is obsolete
the input device is not a TTY
```

## ✅ The Fix
The issue is the missing `-T` flag in the docker command.

---

## 🚀 3 Ways to Fix (Choose One)

### ✨ **EASIEST - Use the Bash Script**

Pull latest code first:
```bash
cd ~/LMSetjen-DPD-RI
git pull origin main
```

Then run the script:
```bash
bash run_certificate_fix.sh
```

**That's it! ✅** The script will:
- Execute the population script
- Show you progress
- Verify all tokens were created
- Tell you when it's done

---

### 🔧 Alternative 1: Direct Command (If script doesn't work)

```bash
cd ~/LMSetjen-DPD-RI

docker compose exec -T backend python manage.py shell << 'EOF'
exec(open('/app/backend/populate_validation_tokens.py').read())
EOF
```

**Key difference from before:** The `-T` flag (disables TTY)

---

### 📋 Alternative 2: Step by Step

```bash
cd ~/LMSetjen-DPD-RI

# Start interactive shell
docker compose exec -T backend python manage.py shell

# Inside the shell, type this:
exec(open('/app/backend/populate_validation_tokens.py').read())

# Then type:
exit()
```

---

## ✅ What to Expect

**While running:**
```
🔧 Certificate Validation Token Population Script
================================================

📊 Current Status:
  Total certificates: 5
  With validation_token: 0
  Without validation_token: 5

🔄 Generating validation tokens for 5 certificates...
  ✓ Processed 5/5 certificates

✅ Completed!
  Successfully updated: 5 certificates
  Failed: 0 certificates

✅ All certificates now have validation tokens!
```

---

## 🧪 Verify It Worked

After the script finishes:

```bash
docker compose exec -T backend python manage.py shell << 'EOF'
from api.models import Certificate
count = Certificate.objects.filter(validation_token__isnull=True).count()
print(f"Certificates without tokens: {count}")
EOF
```

**Should output:** `Certificates without tokens: 0`

---

## 🌐 Test on Website

1. Visit: https://lmsetjendpdri.duckdns.org/student/courses/223339/
2. Click "Certificate" tab
3. **QR code should now be visible** ✅
4. Click "Print Verification"
5. **QR code should appear in print** ✅

---

## ⏱️ Timeline
- **Script execution:** ~30 seconds
- **Verification:** ~10 seconds
- **Total:** ~1 minute

---

**Run the bash script now: `bash run_certificate_fix.sh` ✨**

