# SSL Certificate Setup Guide

## Overview

This guide will help you set up HTTPS for your LMSetjen DPD RI Learning Management System using free Let's Encrypt SSL certificates.

## Prerequisites

Before starting, ensure you have:

1. **Domain Name**: A registered domain (e.g., `lms.example.com`)
2. **DNS Configuration**: Domain points to your EC2 instance IP (16.79.83.21)
3. **Ports Open**: 
   - Port 80 (HTTP) - for Let's Encrypt validation
   - Port 443 (HTTPS) - for secure connections
4. **Email Address**: For SSL certificate notifications

## Quick Start

### Option 1: Automated Setup (Recommended)

```bash
# 1. SSH to your server
ssh -i "D:\Project\lms-server-key.pem" ubuntu@16.79.83.21

# 2. Navigate to project directory
cd /home/ubuntu/LMSetjen-DPD-RI

# 3. Pull latest changes
git pull origin main

# 4. Make scripts executable
chmod +x scripts/setup-ssl.sh
chmod +x scripts/deploy-ssl.sh

# 5. Run SSL setup (replace with your domain and email)
sudo ./scripts/setup-ssl.sh lms.example.com admin@example.com

# 6. Deploy SSL configuration
sudo ./scripts/deploy-ssl.sh lms.example.com
```

### Option 2: Manual Setup

Follow the detailed step-by-step instructions below.

---

## Step-by-Step Setup

### Step 1: Verify DNS Configuration

Before obtaining SSL certificate, ensure your domain points to your server:

```bash
# Check DNS resolution
nslookup your-domain.com

# Or use dig
dig your-domain.com +short
```

**Expected Result**: Should show your EC2 IP address (16.79.83.21)

### Step 2: Install Certbot

```bash
# Update package list
sudo apt-get update

# Install Certbot and Nginx plugin
sudo apt-get install -y certbot python3-certbot-nginx
```

### Step 3: Obtain SSL Certificate

```bash
# Stop frontend container temporarily
docker stop lms_frontend

# Obtain certificate (standalone mode)
sudo certbot certonly \
  --standalone \
  --non-interactive \
  --agree-tos \
  --email your-email@example.com \
  --domains your-domain.com

# Start frontend container
docker start lms_frontend
```

**Certificate Location**: `/etc/letsencrypt/live/your-domain.com/`

Files created:
- `fullchain.pem` - Full certificate chain (use in nginx)
- `privkey.pem` - Private key (use in nginx)
- `cert.pem` - Certificate only
- `chain.pem` - Certificate chain

### Step 4: Update Nginx Configuration

```bash
cd /home/ubuntu/LMSetjen-DPD-RI

# Copy SSL template
cp frontend/nginx-ssl.conf frontend/nginx.conf

# Replace DOMAIN_NAME placeholder with your actual domain
sed -i 's/DOMAIN_NAME/your-domain.com/g' frontend/nginx.conf
```

### Step 5: Update Docker Compose

The `docker-compose.yml` has already been updated to:
- Expose port 443 for HTTPS
- Mount SSL certificate directories as read-only volumes

Verify the configuration:

```bash
cat docker-compose.yml | grep -A 5 "frontend:"
```

Should show:
```yaml
volumes:
  - /etc/letsencrypt:/etc/letsencrypt:ro
  - /var/www/certbot:/var/www/certbot:ro
ports:
  - "80:80"
  - "443:443"
```

### Step 6: Rebuild and Deploy

```bash
# Rebuild frontend with SSL configuration
docker compose down frontend
docker compose up -d --build frontend

# Check container status
docker ps

# Check logs
docker logs lms_frontend
```

### Step 7: Update Cookie Security Settings

Now that HTTPS is enabled, update the cookie settings to use the secure flag:

```bash
cd /home/ubuntu/LMSetjen-DPD-RI/frontend/src/utils

# Edit auth.js to restore secure flag
# Find and update Cookie.set() calls
```

**Before** (current):
```javascript
Cookie.set("access_token", access_token, {
    expires: 1,
    sameSite: 'lax'
});
```

**After** (with HTTPS):
```javascript
Cookie.set("access_token", access_token, {
    expires: 1,
    secure: true,
    sameSite: 'strict'
});
```

Then rebuild:
```bash
docker compose up -d --build frontend
```

### Step 8: Update Environment Variables

Update `.env` file with HTTPS URLs:

```bash
# Edit .env
nano /home/ubuntu/LMSetjen-DPD-RI/.env
```

Update these values:
```env
FRONTEND_SITE_URL=https://your-domain.com
BACKEND_SITE_URL=https://your-domain.com
ALLOWED_HOSTS=your-domain.com,www.your-domain.com
```

Restart backend to apply changes:
```bash
docker compose restart backend
```

### Step 9: Setup Auto-Renewal

Let's Encrypt certificates expire after 90 days. Setup automatic renewal:

```bash
# Test renewal (dry run)
sudo certbot renew --dry-run

# Add cron job for auto-renewal
sudo crontab -e

# Add this line (runs daily at 3 AM):
0 3 * * * certbot renew --quiet --post-hook "docker restart lms_frontend"
```

### Step 10: Verify HTTPS

Test your SSL configuration:

```bash
# Test HTTPS access
curl -I https://your-domain.com

# Test HTTP redirect
curl -I http://your-domain.com

# Check SSL certificate
openssl s_client -connect your-domain.com:443 -servername your-domain.com
```

**Online Tools**:
- [SSL Labs Test](https://www.ssllabs.com/ssltest/)
- [Security Headers](https://securityheaders.com/)

---

## Configuration Files

### Nginx SSL Configuration

Location: `frontend/nginx-ssl.conf`

Key features:
- ✅ HTTP to HTTPS redirect
- ✅ TLS 1.2 and 1.3 support
- ✅ Strong cipher suites
- ✅ HSTS enabled
- ✅ OCSP stapling
- ✅ Security headers
- ✅ Gzip compression

### Docker Compose Updates

Location: `docker-compose.yml`

Changes:
- Added port 443 mapping
- Added SSL certificate volume mounts
- Read-only access to certificates

### Cookie Security

Location: `frontend/src/utils/auth.js`

Updates:
- Restored `secure: true` flag
- Changed `sameSite` from 'lax' to 'strict'
- Ensures cookies only sent over HTTPS

---

## Troubleshooting

### Issue: Certificate Validation Failed

**Cause**: Domain not pointing to server or port 80 blocked

**Solution**:
```bash
# Check DNS
nslookup your-domain.com

# Check port 80 access
curl -I http://your-domain.com

# Check firewall
sudo ufw status
```

### Issue: Nginx Won't Start

**Cause**: Certificate files not found

**Solution**:
```bash
# Check certificate exists
sudo ls -la /etc/letsencrypt/live/your-domain.com/

# Check nginx configuration
docker exec lms_frontend nginx -t

# Check logs
docker logs lms_frontend
```

### Issue: HTTP Doesn't Redirect to HTTPS

**Cause**: Wrong nginx configuration

**Solution**:
```bash
# Verify nginx.conf has HTTP redirect block
docker exec lms_frontend cat /etc/nginx/conf.d/default.conf

# Check for "return 301 https://$host$request_uri"
```

### Issue: Mixed Content Warnings

**Cause**: Some resources loading over HTTP

**Solution**:
- Update all URLs in code to use HTTPS or relative paths
- Check browser console for specific resources
- Update BACKEND_SITE_URL to use HTTPS

### Issue: Certificate Renewal Fails

**Cause**: Port 80 blocked during renewal

**Solution**:
```bash
# Test renewal manually
sudo certbot renew --dry-run

# Check nginx is configured for ACME challenge
# Should have /.well-known/acme-challenge/ location block
```

---

## Security Best Practices

### 1. Strong SSL Configuration

✅ TLS 1.2+ only (no SSL, TLS 1.0, or TLS 1.1)  
✅ Strong cipher suites  
✅ OCSP stapling enabled  
✅ HSTS enabled with long max-age  

### 2. Security Headers

Headers configured:
- `Strict-Transport-Security` - Forces HTTPS
- `X-Frame-Options` - Prevents clickjacking
- `X-Content-Type-Options` - Prevents MIME sniffing
- `X-XSS-Protection` - XSS filter
- `Referrer-Policy` - Controls referrer information
- `Content-Security-Policy` - Restricts resource loading

### 3. Cookie Security

With HTTPS enabled:
- `secure: true` - Cookies only sent over HTTPS
- `sameSite: 'strict'` - Strongest CSRF protection
- `httpOnly: true` - Prevents JavaScript access (for sensitive cookies)

### 4. Regular Updates

```bash
# Update Certbot
sudo apt-get update
sudo apt-get upgrade certbot

# Check certificate expiration
sudo certbot certificates

# Verify auto-renewal
sudo certbot renew --dry-run
```

---

## Monitoring & Maintenance

### Check Certificate Expiration

```bash
# View certificate details
sudo certbot certificates

# Check expiration date
echo | openssl s_client -servername your-domain.com -connect your-domain.com:443 2>/dev/null | openssl x509 -noout -dates
```

### Monitor Renewal

```bash
# View renewal logs
sudo tail -f /var/log/letsencrypt/letsencrypt.log

# Test renewal
sudo certbot renew --dry-run
```

### Backup Certificates

```bash
# Backup certificate directory
sudo tar -czf letsencrypt-backup-$(date +%Y%m%d).tar.gz /etc/letsencrypt/
```

### SSL Certificate Health Check

Add to monitoring:
```bash
#!/bin/bash
# Check SSL certificate expiration
EXPIRY_DATE=$(echo | openssl s_client -servername your-domain.com -connect your-domain.com:443 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
NOW_EPOCH=$(date +%s)
DAYS_LEFT=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))

if [ $DAYS_LEFT -lt 30 ]; then
    echo "⚠️  SSL certificate expires in $DAYS_LEFT days!"
else
    echo "✓ SSL certificate is valid for $DAYS_LEFT more days"
fi
```

---

## Performance Optimization

### 1. Enable HTTP/2

Already configured in nginx:
```nginx
listen 443 ssl http2;
```

### 2. OCSP Stapling

Already enabled:
```nginx
ssl_stapling on;
ssl_stapling_verify on;
```

### 3. Session Resumption

Configured:
```nginx
ssl_session_cache shared:SSL:50m;
ssl_session_timeout 1d;
```

### 4. Compression

Gzip enabled for text-based resources:
```nginx
gzip on;
gzip_types text/plain text/css text/javascript application/json;
```

---

## Rollback Procedure

If you need to revert to HTTP:

```bash
# 1. Restore original nginx config
cd /home/ubuntu/LMSetjen-DPD-RI
cp frontend/nginx.conf.backup.* frontend/nginx.conf

# 2. Restore docker-compose.yml
cp docker-compose.yml.backup.* docker-compose.yml

# 3. Rebuild frontend
docker compose down frontend
docker compose up -d frontend

# 4. Restore cookie settings in auth.js
# Remove secure: true flag from cookies
```

---

## Cost

**Let's Encrypt SSL Certificates**: FREE ✅

Features:
- Valid for 90 days
- Unlimited renewals
- Domain validation (DV) certificates
- Trusted by all major browsers
- Auto-renewal supported

---

## Support & Resources

### Official Documentation
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Certbot Documentation](https://certbot.eff.org/docs/)
- [Nginx SSL Configuration](https://nginx.org/en/docs/http/configuring_https_servers.html)

### Testing Tools
- [SSL Labs Server Test](https://www.ssllabs.com/ssltest/)
- [Security Headers Scanner](https://securityheaders.com/)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)

### Troubleshooting
- [Let's Encrypt Community](https://community.letsencrypt.org/)
- [Certbot Help](https://certbot.eff.org/help/)

---

## Checklist

Before going live with HTTPS:

- [ ] Domain DNS points to server IP
- [ ] Ports 80 and 443 are open in firewall
- [ ] SSL certificate obtained successfully
- [ ] Nginx configuration updated with domain name
- [ ] Docker compose updated with SSL volumes
- [ ] Containers rebuilt and running
- [ ] HTTPS access verified
- [ ] HTTP redirects to HTTPS
- [ ] Cookie security settings updated
- [ ] Environment variables updated with HTTPS URLs
- [ ] Auto-renewal cron job configured
- [ ] SSL tested with SSL Labs
- [ ] Security headers verified
- [ ] Backup of certificates created
- [ ] Monitoring configured

---

## Next Steps

After SSL is configured:

1. **Update Documentation**: Update all references from HTTP to HTTPS
2. **Monitor Logs**: Watch for any SSL-related errors
3. **User Testing**: Have users test HTTPS access
4. **Update External Links**: Update any hardcoded HTTP links
5. **Enable HSTS Preload**: Consider HSTS preload list submission
6. **Performance Testing**: Verify HTTPS doesn't impact performance
7. **Backup Strategy**: Include certificates in backup plan

---

**Last Updated**: October 17, 2025  
**Status**: Ready for deployment  
**Estimated Setup Time**: 15-30 minutes
