# Certificate QR Code Fix - Migration Required

## 🔍 Problem Identified

When running `bash run_certificate_fix.sh` on production, it failed with:

```
django.db.utils.ProgrammingError: column api_certificate.validation_token does not exist
```

## 🎯 Root Cause

The migration `0011_add_certificate_validation_token.py` **exists in code** but **hasn't been applied on the production database**.

### Why This Happened
- Migration created: November 11, 2025
- Migration file location: `backend/api/migrations/0011_add_certificate_validation_token.py`
- Status on production: **Not yet applied**

### What the Migration Does
Adds three critical fields to the `Certificate` model:
1. `validation_token` - 12-character unique identifier for QR code generation
2. `created_at` - Timestamp when certificate was created
3. `updated_at` - Timestamp when certificate was last updated

Plus adds three database indexes for performance.

## ✅ Solution Implemented

Updated `run_certificate_fix.sh` to include a migration step:

```bash
# Step 1: Apply pending migrations
docker compose exec -T backend python manage.py migrate

# Step 2: Populate validation tokens (original fix)
```

**The script now automatically:**
1. Applies all pending migrations (including 0011)
2. Creates the missing `validation_token` column
3. Populates validation tokens for existing certificates
4. Enables QR code generation

## 🚀 How to Apply the Fix

### On Production Server

```bash
cd ~/LMSetjen-DPD-RI
git pull origin main  # Gets the updated script with migration step
bash run_certificate_fix.sh
```

### What Happens During Execution

**Step 1 - Migrations** (~5 seconds):
```
Running migrations:
  Applying api.0011_add_certificate_validation_token... OK
✅ Migrations applied successfully
```

**Step 2 - Token Population** (~30 seconds):
```
📊 Current Status:
  Total certificates: N
  With validation_token: 0
  Without validation_token: N

🔄 Generating validation tokens for N certificates...
  ✓ Processed 1/N
  ...
  
✅ All certificates now have validation tokens!
```

### Success Indicators

✅ Script completes without errors
✅ Output shows: "All certificates now have validation tokens!"
✅ On website, visit certificate tab and verify QR code visible
✅ QR code is scannable and links to validation page

## 📋 Migration Details

**File:** `backend/api/migrations/0011_add_certificate_validation_token.py`

**Operations:**
1. Add `validation_token` field (ShortUUIDField, 12 chars, alphanumeric)
2. Add `created_at` field (DateTimeField)
3. Add `updated_at` field (DateTimeField)
4. Create index on `validation_token` for fast lookups
5. Create index on `certificate_id`
6. Create composite index on `user` + `course`

## 🔧 Manual Alternative (If Script Fails)

If you need to apply the migration manually:

```bash
# On production server, in project root:
docker compose exec -T backend python manage.py migrate api 0011

# Then populate tokens:
bash run_certificate_fix.sh
```

## ⚡ Why This Matters

- **Database schema** must include `validation_token` column before code can use it
- **Django migration** system keeps DB schema in sync with code
- **Missing migrations** are a common cause of "column does not exist" errors
- **Automatic migration** in the script ensures consistency

## 📝 Timeline

- Nov 11, 2025: Migration created in code
- Nov 12, 2025: Fix script deployed
- Now: Migration automatically applied when running fix

## ❓ FAQ

**Q: Why wasn't the migration applied automatically?**
A: Migrations are applied during `docker compose up` or `python manage.py migrate`. If your production setup doesn't run migrations automatically on startup, they can accumulate.

**Q: Is it safe to run migrations?**
A: Yes. The migration only adds new columns and indexes. It's non-destructive and doesn't modify existing data.

**Q: What if the migration fails?**
A: Check backend container logs: `docker compose logs backend`. Common causes:
- Backend container not running
- Database connection issues
- Already applied (not an error, just no-op)

**Q: How long does the full fix take?**
A: ~35-40 seconds total:
- Migrations: ~5 seconds
- Token population: ~30 seconds
- Verification: ~5 seconds

## 🎯 Next Steps

1. On production server: `git pull origin main`
2. Run: `bash run_certificate_fix.sh`
3. Verify: Visit `/student/courses/223339/` and check Certificate tab

**Expected Result:**
✅ Column created by migration
✅ Validation tokens populated for all certificates
✅ QR codes visible and functional on certificate tab
