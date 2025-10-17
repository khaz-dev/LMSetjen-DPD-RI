# SSL Certificate - Quick Deployment Guide

## 🚀 Quick Start (5 Minutes)

### Prerequisites
1. **Domain Name**: You need a registered domain (e.g., `lms.yourcompany.com`)
2. **DNS Setup**: Point your domain to EC2 IP: `16.79.83.21`
3. **Email**: For SSL certificate notifications

### Automated Deployment

```bash
# 1. SSH to server
ssh -i "D:\Project\lms-server-key.pem" ubuntu@16.79.83.21

# 2. Pull latest code
cd /home/ubuntu/LMSetjen-DPD-RI
git pull origin main

# 3. Make scripts executable
chmod +x scripts/*.sh

# 4. Run SSL setup (REPLACE WITH YOUR DOMAIN AND EMAIL!)
sudo ./scripts/setup-ssl.sh your-domain.com your-email@example.com

# 5. Deploy SSL configuration
sudo ./scripts/deploy-ssl.sh your-domain.com

# 6. Verify HTTPS works
curl -I https://your-domain.com
```

**Done!** Your site is now accessible via HTTPS! 🎉

---

## 📋 What Was Added

### 1. **Setup Scripts**
- `scripts/setup-ssl.sh` - Install Certbot, obtain SSL certificate
- `scripts/deploy-ssl.sh` - Deploy SSL configuration to production
- `scripts/ssl-manager.sh` - Interactive SSL management tool

### 2. **Nginx Configuration**
- `frontend/nginx-ssl.conf` - Complete HTTPS configuration
  - HTTP → HTTPS redirect
  - TLS 1.2/1.3 support
  - Security headers (HSTS, CSP, etc.)
  - HTTP/2 enabled

### 3. **Docker Configuration**
- Updated `docker-compose.yml`:
  - Added port 443 for HTTPS
  - Mounted SSL certificate directories
  - Read-only access to certificates

### 4. **Documentation**
- `SSL-SETUP-GUIDE.md` - Complete setup guide (30+ pages)
  - Step-by-step instructions
  - Troubleshooting
  - Security best practices
  - Monitoring and maintenance

---

## ⚙️ Configuration Details

### SSL Certificate
- **Provider**: Let's Encrypt (FREE)
- **Type**: Domain Validation (DV)
- **Validity**: 90 days
- **Auto-Renewal**: Configured (cron job)
- **Location**: `/etc/letsencrypt/live/your-domain.com/`

### Nginx Features
✅ HTTP to HTTPS redirect  
✅ TLS 1.2 and 1.3  
✅ Strong cipher suites  
✅ HTTP/2 support  
✅ HSTS with 2-year max-age  
✅ OCSP stapling  
✅ Security headers  
✅ Gzip compression  

### Security Headers
```
Strict-Transport-Security: max-age=63072000
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self' ...
```

---

## 🔄 After SSL Setup - Update Application

### Step 1: Update Cookie Security

**File**: `frontend/src/utils/auth.js`

Change from:
```javascript
Cookie.set("access_token", access_token, {
    expires: 1,
    sameSite: 'lax'
});
```

To:
```javascript
Cookie.set("access_token", access_token, {
    expires: 1,
    secure: true,      // ← Add this
    sameSite: 'strict'  // ← Change from 'lax'
});
```

### Step 2: Update Environment Variables

**File**: `.env` on server

```bash
# SSH to server
ssh -i "D:\Project\lms-server-key.pem" ubuntu@16.79.83.21

# Edit .env
nano /home/ubuntu/LMSetjen-DPD-RI/.env

# Update these values:
FRONTEND_SITE_URL=https://your-domain.com
BACKEND_SITE_URL=https://your-domain.com
ALLOWED_HOSTS=your-domain.com,www.your-domain.com
```

### Step 3: Rebuild Containers

```bash
cd /home/ubuntu/LMSetjen-DPD-RI

# Pull latest code with cookie fixes
git pull origin main

# Rebuild frontend
docker compose up -d --build frontend

# Restart backend to apply .env changes
docker compose restart backend
```

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] HTTPS access works: `https://your-domain.com`
- [ ] HTTP redirects to HTTPS: `http://your-domain.com`
- [ ] SSL certificate is valid (green padlock in browser)
- [ ] Login works with secure cookies
- [ ] All API calls use HTTPS
- [ ] No mixed content warnings in browser console
- [ ] SSL Labs test passes: [https://www.ssllabs.com/ssltest/](https://www.ssllabs.com/ssltest/)

### Quick Tests

```bash
# Test HTTPS
curl -I https://your-domain.com

# Test HTTP redirect
curl -I http://your-domain.com

# Check SSL certificate
openssl s_client -connect your-domain.com:443 -servername your-domain.com

# View certificate details
sudo certbot certificates
```

---

## 🛠️ SSL Management Tool

Interactive tool for common SSL tasks:

```bash
sudo ./scripts/ssl-manager.sh
```

Features:
1. View certificate information
2. Test SSL configuration
3. Renew certificate (manual)
4. Test auto-renewal (dry run)
5. Check certificate expiration
6. View renewal logs
7. Backup certificates
8. Restore HTTP (remove HTTPS)
9. View nginx SSL configuration

---

## 🔐 Security Notes

### What Changed
- **Before**: Cookies worked on HTTP, vulnerable to interception
- **After**: Cookies only work on HTTPS, encrypted in transit

### Security Improvements
✅ End-to-end encryption (TLS)  
✅ Secure cookies (HTTPS-only)  
✅ HSTS prevents downgrade attacks  
✅ Strong cipher suites  
✅ Protection against clickjacking, XSS, MIME sniffing  
✅ CSRF protection strengthened (sameSite: strict)  

### SSL Labs Rating
Expected: **A+**

Test your configuration: `https://www.ssllabs.com/ssltest/analyze.html?d=your-domain.com`

---

## 🔄 Auto-Renewal

Certificate auto-renewal is configured via cron job:

```bash
# View cron jobs
sudo crontab -l

# Should show:
# 0 3 * * * certbot renew --quiet --post-hook "docker restart lms_frontend"
```

**Runs**: Daily at 3:00 AM  
**Action**: Checks if renewal needed (30 days before expiry)  
**Post-action**: Restarts frontend container to load new certificate

### Test Renewal

```bash
# Dry run (test without actually renewing)
sudo certbot renew --dry-run

# Manual renewal
sudo certbot renew
```

---

## 📊 Monitoring

### Check Certificate Expiration

```bash
# Quick check
sudo certbot certificates

# Detailed check with days remaining
sudo ./scripts/ssl-manager.sh
# Select option 5
```

### View Renewal Logs

```bash
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

### Backup Certificates

```bash
# Automated backup
sudo ./scripts/ssl-manager.sh
# Select option 7

# Manual backup
sudo tar -czf ssl-backup-$(date +%Y%m%d).tar.gz /etc/letsencrypt/
```

---

## 🐛 Troubleshooting

### Issue: "Certificate validation failed"

**Cause**: Domain doesn't point to server

**Fix**:
```bash
# Check DNS
nslookup your-domain.com
# Should show: 16.79.83.21

# Check from server
curl -I http://your-domain.com
```

### Issue: "Nginx won't start"

**Cause**: Certificate files not found

**Fix**:
```bash
# Check certificate exists
sudo ls -la /etc/letsencrypt/live/your-domain.com/

# Test nginx config
docker exec lms_frontend nginx -t

# View logs
docker logs lms_frontend
```

### Issue: "Mixed content warnings"

**Cause**: Some resources still loading over HTTP

**Fix**:
- Check browser console for specific resources
- Ensure BACKEND_SITE_URL uses HTTPS
- Update all hardcoded HTTP URLs in code

### Issue: "Cookies not working"

**Cause**: Cookie security settings not updated

**Fix**:
1. Update `auth.js` with `secure: true`
2. Clear browser cookies
3. Rebuild frontend container
4. Test login again

---

## 📞 Support

### Documentation
- Full guide: `SSL-SETUP-GUIDE.md`
- Let's Encrypt docs: [https://letsencrypt.org/docs/](https://letsencrypt.org/docs/)
- Certbot docs: [https://certbot.eff.org/docs/](https://certbot.eff.org/docs/)

### Testing Tools
- SSL Labs: [https://www.ssllabs.com/ssltest/](https://www.ssllabs.com/ssltest/)
- Security Headers: [https://securityheaders.com/](https://securityheaders.com/)

---

## 📅 Maintenance Schedule

### Daily (Automated)
- Certificate renewal check (cron job)

### Weekly
- Check certificate expiration
- Review renewal logs
- Test HTTPS access

### Monthly
- Test auto-renewal: `sudo certbot renew --dry-run`
- Backup certificates
- Review SSL configuration
- Run SSL Labs test

### Quarterly
- Update Certbot: `sudo apt-get upgrade certbot`
- Review security headers
- Check for nginx updates
- Audit security logs

---

## 💰 Cost

**Total Cost**: $0 (FREE) ✅

- SSL Certificate: FREE (Let's Encrypt)
- Auto-renewal: FREE
- HTTP/2: FREE
- All tools: FREE and Open Source

---

## ⏱️ Setup Time

- **Automated**: 5-10 minutes
- **Manual**: 15-30 minutes
- **Testing & Verification**: 5 minutes
- **Total**: 20-45 minutes

---

## 🎯 Next Steps

After SSL is working:

1. ✅ **Update application code** (cookie security)
2. ✅ **Update environment variables** (HTTPS URLs)
3. ✅ **Test thoroughly** (all features work)
4. ✅ **Monitor certificate expiration**
5. ✅ **Document for team**
6. ✅ **Update DNS if using subdomain**
7. ✅ **Consider HSTS preload** (optional)

---

**Status**: ✅ Ready for deployment  
**Last Updated**: October 17, 2025  
**Version**: 1.0
