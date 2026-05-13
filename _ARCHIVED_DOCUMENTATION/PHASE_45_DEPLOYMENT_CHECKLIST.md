# PHASE 45 Quick Deployment Checklist

## Pre-Deployment
- [ ] Backup PostgreSQL database
  ```bash
  pg_dump lms_db > backup_$(date +%Y%m%d_%H%M%S).sql
  ```

## Code Deployment
- [ ] Update `backend/backend/settings.py` 
  - Verify `CONN_MAX_AGE: 600` at lines 147 and 168
  
- [ ] Update `backend/api/views.py`
  - Verify CHECKPOINT code at line ~10646
  - Verify verification query at line ~10680
  - Verify `database_verified` in response

## Server Restart
- [ ] Stop Django development server (if running)
  ```bash
  pkill -f "python manage.py runserver"
  ```

- [ ] Start fresh Django server
  ```bash
  cd backend
  python manage.py runserver
  ```

## Verification
- [ ] Run test script
  ```bash
  python backend/test_phase_45.py
  ```
  Expected: All 4 tests should pass

- [ ] Check logs for Phase 45 messages
  ```bash
  grep -i "phase 45" django_error.log
  ```

## Manual Testing
- [ ] Login as student
- [ ] Enroll in a course with verification question
- [ ] Answer correctly
- [ ] Verify logs show:
  - `[PHASE 45] ✅ Forced PostgreSQL CHECKPOINT`
  - `[PHASE 45] ✅ Record ID=XXX found in database`
  - `"database_verified": true`
- [ ] Refresh page - badge should show "Diselesaikan"
- [ ] Check course progress - should show 100%

## Rollback (If Issues)
- [ ] If connection pool exhausts:
  ```python
  # In settings.py, reduce to:
  'CONN_MAX_AGE': 60  # 1 minute instead of 10
  ```

- [ ] If CHECKPOINT fails (some configs):
  ```python
  # Comment out the CHECKPOINT line in views.py
  # cursor.execute("CHECKPOINT;")
  ```

- [ ] Full revert: Use git checkout or revert to Phase 44

## Post-Deployment Monitoring
- [ ] Watch PostgreSQL connection count
  ```bash
  psql -c "SELECT count(*) FROM pg_stat_activity;"
  ```
  Should stay < max_connections setting

- [ ] Monitor `django_error.log` for errors
- [ ] Check browser console for JavaScript errors
- [ ] Verify no "connection pool exhausted" messages

## Success Criteria
✅ Students can answer verification questions
✅ Course completion tracked correctly
✅ Progress reaches 100% when all lessons done
✅ Certificates can be generated
✅ No orphaned records in database
✅ Logs show CHECKPOINT succeeding
✅ No connection pool exhaustion errors
