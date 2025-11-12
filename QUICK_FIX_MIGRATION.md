# 🚀 Quick Fix - Run on Production NOW

## The Problem
Database column `validation_token` doesn't exist → migration not applied

## The Solution
Updated script automatically applies the migration now

## How to Fix (3 commands)

```bash
cd ~/LMSetjen-DPD-RI
git pull origin main
bash run_certificate_fix.sh
```

That's it! The script will:
1. Apply migration 0011 (creates the column)
2. Generate tokens for all certificates
3. Verify everything is working

## Expected Output

```
📦 Step 1/2: Applying pending migrations...
Running migrations:
  Applying api.0011_add_certificate_validation_token... OK
✅ Migrations applied successfully

🚀 Step 2/2: Executing validation token population script...
📊 Current Status:
  Total certificates: 1
  With validation_token: 0
  Without validation_token: 1

🔄 Generating validation tokens for 1 certificates...
  ✓ Processed 1/1

✅ All certificates now have validation tokens!
  Successfully updated: 1
  Failed: 0

✅ Script completed successfully!

📊 Final Status:
   Total certificates: 1
   With validation tokens: 1
   Without validation tokens: 0

✅ All certificates now have validation tokens!

🎉 QR codes will now display on the certificate tab!
```

## Then Verify

Visit: `https://lmsetjendpdri.duckdns.org/student/courses/223339/`
Click: Certificate tab
Check: QR code should be visible! ✓

## If It Fails

Check: `docker compose ps` - backend should be running
Logs: `docker compose logs backend`
Retry: `bash run_certificate_fix.sh`

## What Changed

- ✅ Migration 0011 now auto-runs during fix
- ✅ Creates validation_token column
- ✅ Populates tokens for all existing certs
- ✅ QR codes immediately functional

## Timeline
- Apply migration: ~5 sec
- Populate tokens: ~30 sec  
- Total: ~35-40 sec
