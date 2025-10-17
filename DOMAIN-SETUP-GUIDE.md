# Domain Setup Guide for EC2 Instance

**Project**: LMSetjen DPD RI - Learning Management System  
**EC2 IP**: 16.79.83.21  
**Date**: October 17, 2025

---

## 📋 Overview

This guide covers all methods to set up a domain name for your EC2 instance running the LMS application.

---

## 🌐 Option 1: Using Your Own Domain (Most Common)

### Prerequisites
- A registered domain name (or register one)
- Access to domain registrar's DNS settings

### Step 1: Register a Domain

**Popular Registrars:**
- **Namecheap**: https://www.namecheap.com (~$10-15/year)
- **GoDaddy**: https://www.godaddy.com (~$12-20/year)
- **Google Domains**: https://domains.google (~$12/year)
- **Cloudflare**: https://www.cloudflare.com/products/registrar/ (~$8-12/year)

**Recommended**: Use `.com`, `.org`, or `.edu` for educational platforms

### Step 2: Configure DNS Records

Log into your domain registrar and add DNS records:

#### **A Record Configuration**

**For root domain** (e.g., `lms-dpdri.com`):
```
Type: A
Name: @ or (root)
Value: 16.79.83.21
TTL: 300 or Auto
```

**For subdomain** (e.g., `lms.dpdri.com`):
```
Type: A
Name: lms
Value: 16.79.83.21
TTL: 300
```

**For www subdomain** (optional):
```
Type: CNAME
Name: www
Value: lms.dpdri.com (or your root domain)
TTL: 300
```

#### **DNS Configuration Examples by Registrar**

**Namecheap:**
1. Login → Domain List → Manage
2. Advanced DNS → Add New Record
3. Select "A Record"
4. Host: `@` (root) or `lms` (subdomain)
5. Value: `16.79.83.21`
6. TTL: Automatic
7. Save

**GoDaddy:**
1. Login → My Products → DNS
2. Add → Type: A
3. Name: `@` or `lms`
4. Value: `16.79.83.21`
5. TTL: 1 Hour
6. Save

**Cloudflare:**
1. Login → Select Domain → DNS
2. Add record → Type: A
3. Name: `@` or `lms`
4. IPv4 address: `16.79.83.21`
5. Proxy status: DNS only (grey cloud) initially
6. TTL: Auto
7. Save

### Step 3: Verify DNS Propagation

**Command Line (Windows PowerShell):**
```powershell
# Check DNS resolution
nslookup your-domain.com

# Should return: 16.79.83.21
```

**Online Tools:**
- https://dnschecker.org
- https://www.whatsmydns.net
- https://mxtoolbox.com/SuperTool.aspx

**Expected Result:**
```
Name:    your-domain.com
Address: 16.79.83.21
```

**DNS Propagation Time:**
- Minimum: 5-10 minutes
- Average: 30-60 minutes
- Maximum: 24-48 hours

### Step 4: Test Domain Access

```bash
# Test HTTP access
curl -I http://your-domain.com

# Should return 200 OK or redirect to HTTPS
```

**Browser Test:**
- Open: `http://your-domain.com`
- Should load your LMS application

---

## 🏢 Option 2: Using AWS Route 53

AWS's managed DNS service with better integration.

### Advantages
- ✅ Seamless AWS integration
- ✅ Health checks and failover
- ✅ Low latency routing
- ✅ API-based management
- ✅ 100% uptime SLA

### Cost
- Domain registration: ~$12/year
- Hosted zone: $0.50/month
- Queries: $0.40 per million (first billion/month)

### Setup Process

#### Step 1: Register Domain in Route 53

```bash
# Via AWS Console:
# 1. Go to Route 53 console
# 2. Click "Register Domain"
# 3. Search for available domain
# 4. Complete registration (takes 24-72 hours)
```

#### Step 2: Create Hosted Zone

If you registered domain elsewhere:

1. **AWS Console** → **Route 53** → **Hosted zones**
2. Click **Create hosted zone**
3. Domain name: `your-domain.com`
4. Type: Public hosted zone
5. Create

#### Step 3: Update Name Servers

If domain registered elsewhere, update nameservers:

**Route 53 Nameservers** (from hosted zone):
```
ns-123.awsdns-12.com
ns-456.awsdns-34.net
ns-789.awsdns-56.org
ns-012.awsdns-78.co.uk
```

Update at your registrar with Route 53's nameservers.

#### Step 4: Create A Record

1. In Hosted Zone, click **Create record**
2. **Record name**: Leave blank (root) or enter subdomain
3. **Record type**: A
4. **Value**: `16.79.83.21`
5. **TTL**: 300 seconds
6. **Routing policy**: Simple
7. Create

#### Step 5: Verify

```bash
# Check nameservers
nslookup -type=NS your-domain.com

# Check A record
nslookup your-domain.com
```

---

## 🆓 Option 3: Free Dynamic DNS Services

For testing or temporary use (not recommended for production):

### Services
- **No-IP** (https://www.noip.com) - Free subdomain
- **DuckDNS** (https://www.duckdns.org) - Free subdomain
- **FreeDNS** (https://freedns.afraid.org) - Free subdomain

### Example: Using DuckDNS

1. Visit https://www.duckdns.org
2. Sign in with Google/GitHub
3. Create subdomain: `lms-dpdri.duckdns.org`
4. Update IP to: `16.79.83.21`
5. Copy your token

**Update IP automatically:**
```bash
# On EC2 instance, create cron job
echo "*/5 * * * * curl 'https://www.duckdns.org/update?domains=lms-dpdri&token=YOUR_TOKEN&ip='" | crontab -
```

**Limitations:**
- ⚠️ Free subdomain only (e.g., `yourname.duckdns.org`)
- ⚠️ Less professional
- ⚠️ May have service interruptions

---

## 🔧 Option 4: Using Elastic IP (AWS)

Make your EC2 IP permanent (currently it's dynamic).

### Why?
- Current IP `16.79.83.21` may change if instance stops/restarts
- Elastic IP stays the same

### Setup

**AWS Console:**
1. **EC2** → **Elastic IPs**
2. Click **Allocate Elastic IP address**
3. **Network Border Group**: Keep default
4. Click **Allocate**
5. Select the new IP → **Actions** → **Associate Elastic IP address**
6. Instance: Select your LMS instance
7. Private IP: Select from dropdown
8. Click **Associate**

**Result**: Your instance now has a permanent IP address

**Cost**: FREE while associated with running instance

⚠️ **Warning**: $0.005/hour charge if NOT associated with a running instance

### Update DNS

After associating Elastic IP:
1. Note the new IP address
2. Update your DNS A record with the new IP
3. Wait for DNS propagation

---

## 🚀 Complete Setup Workflow

### For Production Deployment

**Timeline**: 1-2 days (mostly waiting for DNS/domain)

#### Day 1: Domain Registration
1. ✅ Register domain at registrar (~$12/year)
2. ✅ Wait for domain registration confirmation (1-24 hours)
3. ✅ (Optional) Allocate Elastic IP in AWS
4. ✅ Configure DNS A record pointing to EC2 IP
5. ✅ Wait for DNS propagation (30 mins - 48 hours)

#### Day 2: SSL Setup
1. ✅ Verify domain resolves to EC2 IP
2. ✅ Pull latest code with SSL scripts
3. ✅ Run SSL setup: `sudo ./scripts/setup-ssl.sh your-domain.com your-email@example.com`
4. ✅ Deploy SSL configuration
5. ✅ Update application settings (cookies, .env)
6. ✅ Test HTTPS access

---

## 📝 Specific Registrar Instructions

### Namecheap (Detailed)

1. **Purchase Domain:**
   - Go to https://www.namecheap.com
   - Search for domain
   - Add to cart → Checkout
   - Complete payment

2. **Configure DNS:**
   - Login → Domain List
   - Click **Manage** next to your domain
   - Go to **Advanced DNS** tab
   - Click **Add New Record**
   
   **Settings:**
   ```
   Type: A Record
   Host: @ (for root) or lms (for subdomain)
   Value: 16.79.83.21
   TTL: Automatic
   ```
   
3. **Save Changes**

### GoDaddy (Detailed)

1. **Purchase Domain:**
   - Go to https://www.godaddy.com
   - Search and purchase domain

2. **Configure DNS:**
   - My Products → Domain → DNS
   - Click **Add** under Records
   
   **Settings:**
   ```
   Type: A
   Name: @ or lms
   Value: 16.79.83.21
   TTL: 1 Hour
   ```

3. **Save**

### Cloudflare (Detailed)

Cloudflare offers domain registration + free CDN/DDoS protection.

1. **Register Domain:**
   - https://www.cloudflare.com/products/registrar/
   - Search and register domain

2. **Add to Cloudflare:**
   - Add site → Enter domain
   - Select Free plan
   - Cloudflare scans DNS records

3. **Configure DNS:**
   - DNS → Add record
   
   **Settings:**
   ```
   Type: A
   Name: @ or lms
   IPv4 address: 16.79.83.21
   Proxy status: DNS only (grey cloud)
   TTL: Auto
   ```

4. **Update Nameservers:**
   - Copy Cloudflare nameservers
   - Update at your registrar
   - Wait 24-48 hours for activation

**Benefits:**
- Free SSL (alternative to Let's Encrypt)
- Free CDN
- DDoS protection
- Analytics

---

## ✅ Verification Checklist

After domain setup:

### DNS Verification
```bash
# From your computer (PowerShell)
nslookup your-domain.com

# Should show:
# Address: 16.79.83.21
```

### HTTP Access
```bash
# Test HTTP
curl -I http://your-domain.com

# Should return 200 OK
```

### Browser Test
- [ ] Open `http://your-domain.com` in browser
- [ ] Site loads correctly
- [ ] Check for SSL/HTTPS (after SSL setup)

### DNS Checklist
- [ ] A Record created with correct IP
- [ ] DNS propagated (check with online tools)
- [ ] No CNAME conflicts
- [ ] TTL set appropriately (300-3600 seconds)

---

## 🔍 Troubleshooting

### Domain Doesn't Resolve

**Symptoms**: `nslookup` returns "can't find" or wrong IP

**Causes**:
- DNS not propagated yet
- Wrong IP address in A record
- Nameserver issues

**Fixes**:
1. Wait longer (up to 48 hours)
2. Verify A record is correct: `16.79.83.21`
3. Clear local DNS cache:
   ```powershell
   # Windows
   ipconfig /flushdns
   
   # Linux/Mac
   sudo systemd-resolve --flush-caches
   ```
4. Try different DNS server:
   ```bash
   nslookup your-domain.com 8.8.8.8
   ```

### Site Not Loading

**Symptoms**: Domain resolves but site doesn't load

**Causes**:
- EC2 instance not running
- Security group blocking port 80/443
- Nginx not running

**Fixes**:
1. Check EC2 instance status
2. Verify security group allows inbound:
   - Port 80 (HTTP) from 0.0.0.0/0
   - Port 443 (HTTPS) from 0.0.0.0/0
3. Check nginx is running:
   ```bash
   ssh -i "D:\Project\lms-server-key.pem" ubuntu@16.79.83.21
   docker ps | grep frontend
   ```

### HTTPS Not Working

**Symptoms**: HTTP works but HTTPS fails

**Cause**: SSL not set up yet

**Fix**: Follow SSL setup guide after domain is working on HTTP:
```bash
sudo ./scripts/setup-ssl.sh your-domain.com your-email@example.com
```

---

## 📊 Recommended Configuration

### For Production LMS

**Domain Structure:**
```
Main site: lms.yourcompany.com
API: lms.yourcompany.com/api/
Admin: lms.yourcompany.com/admin/
```

**DNS Records:**
```
A     lms              16.79.83.21
CNAME www.lms          lms.yourcompany.com
TXT   @                "v=spf1 include:sendgrid.net ~all"
```

**Security:**
- ✅ Enable DNSSEC (if registrar supports)
- ✅ Set up CAA records for SSL
- ✅ Use Cloudflare for DDoS protection (optional)

---

## 💡 Best Practices

### Domain Selection
✅ Use `.com` or `.org` for credibility  
✅ Keep it short and memorable  
✅ Avoid hyphens and numbers  
✅ Check social media availability  
✅ Consider SEO implications  

### DNS Configuration
✅ Use low TTL (300s) during setup  
✅ Increase TTL (3600s) after stable  
✅ Add multiple A records for redundancy (if you have multiple IPs)  
✅ Set up monitoring for DNS changes  

### Security
✅ Enable domain privacy/WHOIS protection  
✅ Enable two-factor auth at registrar  
✅ Set domain auto-renewal  
✅ Keep registrar email updated  

---

## 📞 Support Resources

### DNS Checking Tools
- **DNS Checker**: https://dnschecker.org
- **What's My DNS**: https://www.whatsmydns.net
- **MX Toolbox**: https://mxtoolbox.com/SuperTool.aspx
- **DNS Propagation**: https://www.whatsmydns.net/

### Learning Resources
- **DNS Basics**: https://www.cloudflare.com/learning/dns/what-is-dns/
- **AWS Route 53 Guide**: https://docs.aws.amazon.com/route53/
- **Domain Registration Guide**: https://www.namecheap.com/support/knowledgebase/

---

## 🎯 Quick Reference

### After You Have a Domain

```bash
# 1. SSH to EC2
ssh -i "D:\Project\lms-server-key.pem" ubuntu@16.79.83.21

# 2. Pull latest code
cd /home/ubuntu/LMSetjen-DPD-RI
git pull origin main

# 3. Setup SSL
sudo ./scripts/setup-ssl.sh your-domain.com your-email@example.com

# 4. Deploy SSL
sudo ./scripts/deploy-ssl.sh your-domain.com

# 5. Update application
# (Follow SSL-QUICK-START.md for cookie and .env updates)
```

### Summary Commands

```bash
# Check DNS
nslookup your-domain.com

# Test HTTP
curl -I http://your-domain.com

# Test HTTPS (after SSL setup)
curl -I https://your-domain.com

# View SSL certificate
openssl s_client -connect your-domain.com:443
```

---

## 📋 Next Steps

1. ✅ Choose your domain option (Own domain recommended)
2. ✅ Register domain if needed
3. ✅ Configure DNS A record → `16.79.83.21`
4. ✅ Wait for DNS propagation
5. ✅ Verify domain resolves
6. ✅ Run SSL setup scripts (see SSL-QUICK-START.md)
7. ✅ Update application configuration
8. ✅ Test thoroughly

---

**Current Status**: EC2 IP: `16.79.83.21`  
**Ready for**: Domain configuration  
**Next**: Register domain and configure DNS  

**Estimated Time**: 1-2 hours (setup) + 1-48 hours (DNS propagation)
