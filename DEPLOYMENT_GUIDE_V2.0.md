# Deployment Guide: Multi-Role System (v2.0)

**Version:** 2.0  
**Release Date:** January 25, 2026  
**Deployment Type:** Major Feature Release

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Deployment Steps](#deployment-steps)
3. [Database Migrations](#database-migrations)
4. [Environment Configuration](#environment-configuration)
5. [Testing Before Production](#testing-before-production)
6. [Rollback Plan](#rollback-plan)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Monitoring](#monitoring)

---

## Pre-Deployment Checklist

### Code Review
- [x] All changes reviewed and approved
- [x] No breaking changes to existing APIs
- [x] Backward compatible (single-role users unaffected)
- [x] All tests passing

### Testing
- [x] Backend tests: 45+ test cases
- [x] Frontend tests: 20+ test cases
- [x] Integration tests: Complete
- [x] Cross-browser testing: Passed
- [x] Mobile testing: Passed
- [x] Accessibility testing: WCAG AA compliant

### Documentation
- [x] API documentation updated
- [x] Database schema documented
- [x] Frontend component documentation
- [x] Deployment guide completed

### Dependencies
- [x] No new Python packages required
- [x] No new Node.js packages required
- [x] Database version: PostgreSQL 12+
- [x] Python version: 3.8+
- [x] Node version: 14+

---

## Deployment Steps

### Phase 1: Pre-Deployment (Development Environment)

```bash
# 1. Verify all tests pass locally
cd backend
python manage.py test api.tests.test_multi_role_integration

cd ../frontend
npm test

# 2. Build frontend for production
npm run build

# 3. Check for any console warnings
npm run build 2>&1 | grep -i warning
```

### Phase 2: Staging Deployment

```bash
# 1. Deploy backend to staging
git push staging develop:main

# 2. SSH into staging server
ssh user@staging-server.com

# 3. Pull latest code
cd /app
git pull origin main

# 4. Install any new dependencies
pip install -r requirements.txt
npm install

# 5. Run database migrations (see next section)
python manage.py migrate

# 6. Collect static files
python manage.py collectstatic --noinput

# 7. Restart services
systemctl restart lms-backend
systemctl restart lms-frontend

# 8. Run smoke tests
curl -H "Authorization: Bearer <test_token>" \
     https://staging.example.com/api/v1/auth/available-roles/
```

### Phase 3: User Acceptance Testing (Staging)

```
Test Scenarios:
□ Single-role user can login and access dashboard
□ Multi-role user sees role selection modal
□ Multi-role user can switch roles from header
□ Role indicator displays correctly in headers
□ Route protection works for new role
□ All student endpoints accessible for student role
□ All instructor endpoints accessible for instructor role
□ All admin endpoints accessible for admin role
□ Error handling works (invalid role selection)
□ Mobile UI responsive (tested on real devices)
□ Toast notifications display correctly
□ Page reload happens after role switch
```

### Phase 4: Production Deployment

#### 4.1 Backup Production Database

```bash
# SSH into production
ssh user@prod-server.com

# Backup database
pg_dump -U postgres lms_db > lms_db_backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh lms_db_backup_*.sql

# Optional: Upload to S3
aws s3 cp lms_db_backup_*.sql s3://backups/lms/
```

#### 4.2 Enable Maintenance Mode

```bash
# Create maintenance page
touch /var/www/lms/maintenance.html

# Update nginx to serve maintenance page
# (Configure in nginx.conf)

# Restart nginx
systemctl restart nginx

# Notify users (send email/banner)
```

#### 4.3 Deploy Code

```bash
# 1. Pull latest code
cd /app
git pull origin main

# 2. Install dependencies
pip install -r requirements.txt --no-deps
npm install --production

# 3. Build frontend
npm run build

# 4. Collect static files
python manage.py collectstatic --noinput --clear
```

#### 4.4 Run Migrations

```bash
# Run all migrations
python manage.py migrate

# Verify migrations
python manage.py migrate --list
```

#### 4.5 Restart Services

```bash
# Graceful restart (keeps existing connections)
systemctl restart lms-backend
systemctl restart lms-frontend

# Wait for services to be ready
sleep 10

# Check service status
systemctl status lms-backend
systemctl status lms-frontend
```

#### 4.6 Disable Maintenance Mode

```bash
# Remove maintenance page
rm /var/www/lms/maintenance.html

# Restart nginx
systemctl restart nginx

# Verify site is accessible
curl https://example.com
```

---

## Database Migrations

### Migration Overview

No database schema changes in v2.0 (Phase 1-3 already added required fields):
- `roles` field (JSONField) - already exists
- `current_role` field - already exists

### Run Migrations

```bash
# Apply all pending migrations
python manage.py migrate

# Migration will:
# ✓ Ensure roles and current_role fields exist
# ✓ Set current_role to 'student' for existing users (default)
# ✓ No data loss

# To see what would be applied:
python manage.py migrate --plan
```

### Verify Migrations

```python
# In Django shell
from userauths.models import User

# Check if fields exist
user = User.objects.first()
print(f"Roles: {user.roles}")
print(f"Current role: {user.current_role}")

# Verify all users have current_role set
users_without_role = User.objects.filter(current_role__isnull=True)
print(f"Users without current_role: {users_without_role.count()}")
```

---

## Environment Configuration

### Backend (Django Settings)

No new environment variables required. Multi-role system uses existing settings.

**Verification:**
```bash
# SSH to production
ssh user@prod-server.com

# Check Django settings
cd /app
python manage.py shell

# In shell
from django.conf import settings
print(settings.AUTH_USER_MODEL)
```

### Frontend (Environment Variables)

No new environment variables required.

**Verification:**
```bash
# Check .env file
cat .env | grep -E "REACT_APP|API"
```

### Docker (If Using)

```dockerfile
# Docker Compose remains unchanged
# Multi-role system is backward compatible

# Rebuild images if any dependencies changed
docker-compose build

# Restart services
docker-compose restart
```

---

## Testing Before Production

### Backend API Tests

```bash
# Run integration tests
python manage.py test api.tests.test_multi_role_integration -v 2

# Expected output: OK (all tests pass)

# Test specific scenarios
python manage.py test api.tests.test_multi_role_integration.AuthEndpointsTestCase.test_select_role_endpoint -v 2
```

### Frontend Component Tests

```bash
# Run all tests
npm test -- --ci --coverage

# Run specific test file
npm test RoleIndicator.integration.test.js -- --ci

# Check coverage
# Should have high coverage for RoleIndicator component
```

### E2E Tests (Manual)

```
1. Login with single-role account
   ✓ Verify no modal shown
   ✓ Verify dashboard accessible

2. Login with multi-role account
   ✓ Verify modal shown with role options
   ✓ Verify modal displays all roles
   ✓ Verify can select role from modal

3. At dashboard with multi-role account
   ✓ Click role indicator in header
   ✓ Verify dropdown shows available roles
   ✓ Select different role
   ✓ Verify toast notification shown
   ✓ Verify page reloads
   ✓ Verify new role displayed in header
   ✓ Verify new role's endpoints accessible

4. Test error cases
   ✓ Try to switch to unavailable role (should error)
   ✓ Verify error toast shown
   ✓ Verify can retry
```

---

## Rollback Plan

### If Deployment Fails

#### Immediate Rollback (First 24 hours)

```bash
# 1. SSH to production
ssh user@prod-server.com

# 2. Enable maintenance mode
touch /var/www/lms/maintenance.html
systemctl restart nginx

# 3. Revert database migrations
cd /app
git revert HEAD  # Revert last commit
python manage.py migrate <previous_migration_number>

# 4. Revert code
git checkout stable-v1.9  # Checkout previous version

# 5. Restart services
systemctl restart lms-backend
systemctl restart lms-frontend

# 6. Disable maintenance mode
rm /var/www/lms/maintenance.html
systemctl restart nginx

# 7. Verify site is working
curl https://example.com
```

#### Restore from Backup

```bash
# If rollback not sufficient

# 1. Stop services
systemctl stop lms-backend
systemctl stop lms-frontend

# 2. Restore database
psql -U postgres lms_db < lms_db_backup_20260125_145322.sql

# 3. Restart services
systemctl start lms-backend
systemctl start lms-frontend

# 4. Verify
curl https://example.com/api/v1/auth/available-roles/
```

### Communication During Rollback

```
Email Template:

Subject: LMSetjen v2.0 Rollback - Service Restored

Dear Users,

We've temporarily reverted to the previous version while we investigate 
an issue with the latest update.

Service has been restored and is fully operational.

We apologize for any inconvenience and will provide an update within 24 hours.

Best regards,
Technical Team
```

---

## Post-Deployment Verification

### Health Checks

```bash
# 1. Check backend is running
curl -s https://example.com/api/v1/health/ | jq

# 2. Check available roles endpoint
curl -s -H "Authorization: Bearer <token>" \
     https://example.com/api/v1/auth/available-roles/ | jq

# 3. Check frontend loads
curl -s https://example.com | grep -q "React" && echo "Frontend loaded"

# 4. Check database connection
python manage.py shell -c "from django.db import connection; cursor = connection.cursor(); print('DB OK')"

# 5. Check migrations applied
python manage.py migrate --list | grep -c "\[X\]"  # Should show many
```

### User-Facing Verification

```
□ Can login with existing credentials
□ Dashboard loads without errors
□ Single-role user: No modal shown
□ Multi-role user: Modal shown on first login
□ Can select role from modal
□ Header displays role indicator
□ Can click role indicator to open dropdown
□ Can select different role from header
□ Toast notification shows on role switch
□ Page reloads after role switch
□ Routes protected correctly for new role
□ All endpoints return correct data
□ No console errors in browser
□ Mobile view responsive
□ Performance acceptable (page load < 3s)
```

### Monitoring Metrics

```bash
# Check backend logs for errors
tail -f /var/log/lms/django.log | grep ERROR

# Check frontend logs
tail -f /var/log/lms/frontend.log | grep ERROR

# Check error rate in monitoring tools
# (NewRelic, DataDog, or similar)
# Should be < 0.1% error rate

# Check API response times
# Available roles endpoint: < 200ms
# Select role endpoint: < 300ms
```

---

## Monitoring

### Post-Deployment Monitoring (First 24-48 hours)

```
Checklist:
□ Error rate normal (< 0.1%)
□ Response times normal (< 200ms for most endpoints)
□ Database queries normal (< 100ms for most)
□ Memory usage stable
□ CPU usage normal
□ No spike in support tickets
□ User feedback positive
□ Analytics collecting properly
□ Backups running successfully
```

### Long-Term Monitoring

```bash
# Create monitoring dashboard for:

1. Role Switch Success Rate
   - Endpoint: /auth/select-role/
   - Target: 99.9% success rate
   - Alert if < 98% for 30 minutes

2. Available Roles Endpoint Performance
   - Endpoint: /auth/available-roles/
   - Target: < 100ms response time
   - Alert if > 500ms for 5 minutes

3. Multi-Role User Count
   - Metric: Users with multiple roles
   - Baseline: Track for trends

4. Role Switch Frequency
   - Metric: Switches per hour
   - Baseline: Track for trends

5. Error Rate by Endpoint
   - Monitored endpoints: /auth/* endpoints
   - Target: < 0.1% error rate
   - Alert if > 1% for 15 minutes
```

### Alerting

```yaml
# Example Prometheus alert rules

- alert: HighErrorRateMultiRole
  expr: rate(http_requests_total{path=~"/auth/.*",status=~"[45].."}[5m]) > 0.01
  for: 5m
  annotations:
    summary: "High error rate on multi-role endpoints"

- alert: SlowMultiRoleEndpoints
  expr: histogram_quantile(0.95, http_request_duration_seconds{path=~"/auth/.*"}) > 0.5
  for: 5m
  annotations:
    summary: "Multi-role endpoints responding slowly"
```

---

## Deployment Timing

### Recommended Deployment Window

- **Time:** 2:00 AM - 4:00 AM (off-peak hours)
- **Estimated Duration:** 15-20 minutes
- **Maintenance Window:** 20 minutes
- **Rollback Readiness:** 10 minutes (if needed)

### Communication Plan

```
T-7 days: Announce deployment to users
T-1 day:  Send reminder email with details
T-30 min: Send "deployment starting soon" message
T-0:      Begin deployment, enable maintenance mode
T+20 min: Deployment complete, disable maintenance mode
T+1 hour: Send success notification
T+24 hr:  Send status report
```

---

## Post-Deployment Checklist

```bash
# Day 1 - Immediate After Deployment
□ Monitor error logs
□ Check user feedback
□ Verify all endpoints responding
□ Test role switching (manual)
□ Verify mobile access
□ Check analytics
□ Document any issues

# Day 2-3 - Extended Monitoring
□ Review performance metrics
□ Check database query performance
□ Verify backup completed
□ User reports - any issues?
□ Performance report
□ Security scan
□ Update documentation

# Week 1 - Final Verification
□ Weekly performance report
□ User adoption metrics
□ Feature usage analytics
□ Issue resolution rate
□ Code quality metrics
□ Create v2.1 plan (if any fixes needed)
```

---

## Support & Troubleshooting

### Common Deployment Issues

**Issue:** Migration fails with "column already exists"
```
Solution: Column already exists from Phase 1-3 work
Action: Run: python manage.py migrate --fake-initial
```

**Issue:** Frontend build fails
```
Solution: Clear node_modules and reinstall
Action: rm -rf node_modules && npm install
```

**Issue:** Static files not loading
```
Solution: Collect static files after deployment
Action: python manage.py collectstatic --noinput --clear
```

### Emergency Contact

- Backend Issues: backend-team@example.com
- Frontend Issues: frontend-team@example.com
- Database Issues: dba@example.com
- Emergency Hotline: +1-XXX-XXX-XXXX (24/7)

---

## Deployment Success Criteria

✅ **Deployment is successful if:**

1. All users can login
2. Dashboard loads without errors
3. Single-role users work as before
4. Multi-role users see role modal
5. Role switching works end-to-end
6. All endpoints return correct data
7. Error rate < 0.1%
8. Response times normal
9. No database issues
10. Mobile UI responsive

---

**Document Version:** 1.0  
**Last Updated:** January 25, 2026  
**Status:** ✅ Ready for Deployment
