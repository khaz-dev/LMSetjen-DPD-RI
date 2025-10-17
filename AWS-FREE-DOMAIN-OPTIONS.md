# AWS Free Domain Options for EC2 Instance

**Project**: LMSetjen DPD RI - Learning Management System  
**EC2 IP**: 16.79.83.21  
**Date**: October 17, 2025

---

## 🚨 Important Clarification

**AWS Does NOT Offer Free Domain Registration**

Route 53 domain pricing is similar to other registrars (~$12/year). However, there are FREE alternatives you can use with your EC2 instance.

---

## 🆓 Option 1: AWS Public IPv4 Address (Current Setup)

**What you have now**: Direct IP access

### Current Access
```
http://16.79.83.21/
```

### Pros
✅ Already working  
✅ Completely FREE  
✅ No setup needed  

### Cons
❌ Hard to remember  
❌ Not professional  
❌ Can't get SSL certificate from Let's Encrypt (requires domain)  
❌ IP may change if instance stops  

### Make It Permanent (FREE)

**Allocate Elastic IP** - FREE while instance is running:

```bash
# AWS Console Steps:
# 1. EC2 → Elastic IPs
# 2. Allocate Elastic IP address
# 3. Associate with your LMS instance
# Cost: $0 (free while associated)
```

**After allocation:**
- Your IP becomes permanent
- No charges while instance runs
- ⚠️ $0.005/hour charge only if NOT associated

---

## 🆓 Option 2: Free Dynamic DNS Services

Use a free subdomain from these services:

### A. DuckDNS (Recommended for Testing)

**Website**: https://www.duckdns.org

#### Features
✅ Completely FREE forever  
✅ No ads  
✅ Open source  
✅ Supports Let's Encrypt SSL  
✅ Auto-update IP script  

#### Setup (5 minutes)

1. **Create Account**:
   - Visit https://www.duckdns.org
   - Sign in with Google/GitHub/Reddit

2. **Create Subdomain**:
   - Enter name: `lms-dpdri` 
   - Full domain: `lms-dpdri.duckdns.org`
   - Set IP: `16.79.83.21`
   - Click **Add domain**

3. **Update DNS** (instant):
   - DuckDNS immediately points your subdomain to EC2 IP
   - Test: `nslookup lms-dpdri.duckdns.org`

4. **Auto-Update Script** (optional):
   ```bash
   # SSH to EC2
   ssh -i "D:\Project\lms-server-key.pem" ubuntu@16.79.83.21
   
   # Create update script
   echo "*/5 * * * * curl 'https://www.duckdns.org/update?domains=lms-dpdri&token=YOUR_TOKEN&ip=' >> /var/log/duckdns.log 2>&1" | crontab -
   ```

5. **Setup SSL** (works with Let's Encrypt):
   ```bash
   sudo ./scripts/setup-ssl.sh lms-dpdri.duckdns.org your-email@example.com
   ```

#### Result
```
Your LMS: https://lms-dpdri.duckdns.org
Cost: FREE
SSL: FREE (Let's Encrypt)
```

---

### B. No-IP (Free Tier Available)

**Website**: https://www.noip.com

#### Features
✅ FREE subdomain  
✅ 3 hostnames on free plan  
✅ Dynamic DNS updates  
⚠️ Must confirm hostname every 30 days (free tier)  

#### Setup

1. **Register**:
   - Visit https://www.noip.com/sign-up
   - Create free account

2. **Create Hostname**:
   - Dashboard → Dynamic DNS → Create Hostname
   - Hostname: `lms-dpdri`
   - Domain: Choose from free options (e.g., `ddns.net`, `hopto.org`)
   - IP Address: `16.79.83.21`
   - Create

3. **Result**:
   ```
   Your domain: lms-dpdri.ddns.net
   ```

4. **Confirmation**:
   - Free tier requires email confirmation every 30 days
   - Or upgrade to $25/year for no confirmation

---

### C. FreeDNS (afraid.org)

**Website**: https://freedns.afraid.org

#### Features
✅ Completely FREE  
✅ Many domain options  
✅ No ads  
✅ Community-driven  

#### Setup

1. **Register**:
   - Visit https://freedns.afraid.org/signup/
   - Create account

2. **Add Subdomain**:
   - Subdomains → Add
   - Type: A
   - Subdomain: `lms-dpdri`
   - Domain: Choose from list (e.g., `mooo.com`, `chickenkiller.com`)
   - Destination: `16.79.83.21`

3. **Result**:
   ```
   Your domain: lms-dpdri.mooo.com
   ```

---

### D. Cloudflare Tunnel (Advanced - FREE)

**Website**: https://www.cloudflare.com/products/tunnel/

#### Features
✅ FREE SSL automatically  
✅ DDoS protection  
✅ No need to expose port 80/443  
✅ Access EC2 through Cloudflare network  

#### How It Works
```
User → Cloudflare (FREE SSL) → Tunnel → Your EC2
```

#### Setup (20 minutes)

1. **Install Cloudflared on EC2**:
   ```bash
   ssh -i "D:\Project\lms-server-key.pem" ubuntu@16.79.83.21
   
   # Download cloudflared
   wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared-linux-amd64.deb
   ```

2. **Authenticate**:
   ```bash
   cloudflared tunnel login
   # Opens browser - login to Cloudflare
   ```

3. **Create Tunnel**:
   ```bash
   cloudflared tunnel create lms-tunnel
   ```

4. **Configure Tunnel**:
   ```bash
   nano ~/.cloudflared/config.yml
   ```
   
   Add:
   ```yaml
   tunnel: lms-tunnel
   credentials-file: /home/ubuntu/.cloudflared/<TUNNEL-ID>.json
   
   ingress:
     - hostname: lms-dpdri.yourdomain.com
       service: http://localhost:80
     - service: http_status:404
   ```

5. **Route DNS**:
   ```bash
   cloudflared tunnel route dns lms-tunnel lms-dpdri.yourdomain.com
   ```

6. **Run Tunnel**:
   ```bash
   cloudflared tunnel run lms-tunnel
   ```

#### Pros
✅ FREE SSL (no Let's Encrypt setup needed)  
✅ DDoS protection  
✅ CDN acceleration  
✅ No open ports needed  

#### Cons
❌ More complex setup  
❌ Requires Cloudflare account  
❌ Need a domain (can use free subdomain from above)  

---

## 🆓 Option 3: AWS Elastic Beanstalk Default Domain

If you migrate to Elastic Beanstalk (not recommended for existing setup):

```
yourapp.elasticbeanstalk.com (FREE)
```

**Not applicable** for your current EC2 setup.

---

## 🆓 Option 4: AWS CloudFront with Custom Domain

Use CloudFront (AWS CDN) with a free dynamic DNS:

### Setup
1. Get free domain from DuckDNS: `lms-dpdri.duckdns.org`
2. Create CloudFront distribution pointing to EC2
3. FREE SSL from AWS Certificate Manager
4. Configure CNAME in DuckDNS

### Cost
- CloudFront: Free tier - 1TB data transfer/month (first year)
- After: ~$0.085/GB

---

## 💰 Comparison Table

| Option | Cost | SSL | Professional | Setup Time |
|--------|------|-----|--------------|------------|
| **Direct IP** | FREE | ❌ No | ❌ | 0 min (current) |
| **Elastic IP** | FREE* | ❌ No | ❌ | 5 min |
| **DuckDNS** | FREE | ✅ Yes | ⚠️ OK | 5 min |
| **No-IP Free** | FREE | ✅ Yes | ⚠️ OK | 10 min |
| **FreeDNS** | FREE | ✅ Yes | ⚠️ OK | 10 min |
| **Cloudflare Tunnel** | FREE | ✅ Yes | ✅ Good | 20 min |
| **Paid Domain** | $12/year | ✅ Yes | ✅ Best | 1-2 days |
| **Route 53** | $12/year + $0.50/mo | ✅ Yes | ✅ Best | 1-2 days |

*Elastic IP is FREE only while associated with running instance

---

## 🎯 Recommended Solution for FREE

### **For Testing/Development**: DuckDNS

```bash
# 1. Create DuckDNS subdomain (5 minutes)
#    Visit: https://www.duckdns.org
#    Create: lms-dpdri.duckdns.org → 16.79.83.21

# 2. Wait 1 minute for DNS propagation

# 3. Test DNS
nslookup lms-dpdri.duckdns.org

# 4. Setup SSL on EC2
ssh -i "D:\Project\lms-server-key.pem" ubuntu@16.79.83.21
cd /home/ubuntu/LMSetjen-DPD-RI
git pull origin main
sudo ./scripts/setup-ssl.sh lms-dpdri.duckdns.org your-email@example.com

# 5. Deploy SSL
sudo ./scripts/deploy-ssl.sh lms-dpdri.duckdns.org

# 6. Access your LMS
https://lms-dpdri.duckdns.org
```

**Total Cost**: $0 (FREE)
**Setup Time**: 10 minutes
**SSL**: FREE (Let's Encrypt)
**Professional**: Acceptable for development

---

### **For Production**: Buy a Domain

While not free, this is the best long-term solution:

```
Domain Cost: $8-15/year (less than $1.25/month)
SSL: FREE (Let's Encrypt)
Professional: Best
```

**Recommended registrars**:
- **Namecheap**: $10-15/year
- **Cloudflare**: $8-12/year (includes DDoS protection)
- **Porkbun**: $8-10/year (cheapest)

---

## 📋 Quick Start with DuckDNS (FREE)

### Step 1: Create DuckDNS Account (2 minutes)

1. Visit: https://www.duckdns.org
2. Sign in with Google/GitHub
3. You'll see your token (save it)

### Step 2: Create Subdomain (1 minute)

1. **Subdomain**: Enter `lms-dpdri` (or your choice)
2. **Current IP**: Enter `16.79.83.21`
3. Click **add domain**
4. **Result**: `lms-dpdri.duckdns.org` created

### Step 3: Verify DNS (1 minute)

From your computer:
```powershell
nslookup lms-dpdri.duckdns.org

# Should return: 16.79.83.21
```

### Step 4: Setup SSL on EC2 (5 minutes)

```bash
# SSH to EC2
ssh -i "D:\Project\lms-server-key.pem" ubuntu@16.79.83.21

# Navigate to project
cd /home/ubuntu/LMSetjen-DPD-RI

# Pull latest code with SSL scripts
git pull origin main

# Make scripts executable
chmod +x scripts/*.sh

# Setup SSL with DuckDNS domain
sudo ./scripts/setup-ssl.sh lms-dpdri.duckdns.org your-email@example.com

# Deploy SSL configuration
sudo ./scripts/deploy-ssl.sh lms-dpdri.duckdns.org
```

### Step 5: Update Application (5 minutes)

Edit `.env` file on EC2:
```bash
# Edit environment variables
nano /home/ubuntu/LMSetjen-DPD-RI/.env
```

Update these values:
```env
FRONTEND_SITE_URL=https://lms-dpdri.duckdns.org
BACKEND_SITE_URL=https://lms-dpdri.duckdns.org
ALLOWED_HOSTS=lms-dpdri.duckdns.org,localhost
```

Restart backend:
```bash
cd /home/ubuntu/LMSetjen-DPD-RI
docker-compose restart backend
```

### Step 6: Test Access

Open browser:
```
https://lms-dpdri.duckdns.org
```

Should show:
- ✅ Green padlock (HTTPS)
- ✅ Valid SSL certificate
- ✅ LMS login page

---

## 🔧 Keep IP Updated (Optional)

If your EC2 IP changes (e.g., instance stops/starts), auto-update DuckDNS:

```bash
# On EC2, create cron job
crontab -e

# Add this line (replace YOUR_TOKEN with your DuckDNS token):
*/5 * * * * curl "https://www.duckdns.org/update?domains=lms-dpdri&token=YOUR_TOKEN&ip=" >> /var/log/duckdns.log 2>&1
```

This updates DuckDNS every 5 minutes with current IP.

---

## ⚠️ Limitations of Free Domains

### DuckDNS / No-IP / FreeDNS

**Pros**:
✅ Completely free  
✅ Works with Let's Encrypt SSL  
✅ Good for development/testing  

**Cons**:
❌ Not professional looking (`yourname.duckdns.org`)  
❌ Less trust for users  
❌ Can't customize domain extension  
❌ Service may have downtime  
❌ Not suitable for business/production  

### Comparison Example

**Free Domain**:
```
https://lms-dpdri.duckdns.org
```

**Paid Domain**:
```
https://lms.dpdri.com
```

For a Learning Management System for DPD RI (official government institution), a **paid custom domain is recommended** for credibility.

---

## 💡 Recommendation by Use Case

### 🧪 **Testing / Development**
Use: **DuckDNS** (100% FREE)
```
https://lms-dpdri.duckdns.org
Cost: $0
Time: 10 minutes
```

### 🏢 **Production / Official Use**
Use: **Paid Domain** (e.g., `lms.dpdri.go.id` or `lms.dpdri.com`)
```
https://lms.dpdri.com
Cost: $10-15/year (~$1/month)
Time: 1-2 days (DNS propagation)
Professional: ✅ YES
```

### 🎓 **Educational Institution** (DPD RI)
Recommended: `.go.id` (Indonesian government domain)
- Contact: https://pandi.id
- Cost: Varies (government rates)
- Professional: ✅ Best for official government institution
- Example: `lms.dpdri.go.id`

---

## 🚀 Next Steps

### Option A: FREE (DuckDNS) - Start Now

```bash
# 1. Create account at https://www.duckdns.org (2 min)
# 2. Create subdomain pointing to 16.79.83.21 (1 min)
# 3. Run SSL setup script (5 min)
# 4. Deploy and test (2 min)

Total time: 10 minutes
Total cost: $0
```

### Option B: Professional Domain - Tomorrow

```bash
# 1. Register domain at Namecheap/Cloudflare ($10-15)
# 2. Configure DNS A record → 16.79.83.21
# 3. Wait for DNS propagation (1-48 hours)
# 4. Run SSL setup script (5 min)
# 5. Deploy and test (2 min)

Total time: 1-2 days (mostly waiting)
Total cost: $10-15/year
```

---

## 📞 Support Resources

### DuckDNS
- **Website**: https://www.duckdns.org
- **Install Guide**: https://www.duckdns.org/install.jsp
- **FAQ**: https://www.duckdns.org/faqs.jsp

### Let's Encrypt with DuckDNS
- **Certbot Guide**: https://certbot.eff.org/
- **Works perfectly** with DuckDNS domains

### AWS Elastic IP
- **Documentation**: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html
- **Pricing**: https://aws.amazon.com/ec2/pricing/on-demand/#Elastic_IP_Addresses

---

## ✅ Summary

**AWS Free Domain Options**:
1. ❌ AWS Route 53: NOT FREE (~$12/year)
2. ✅ DuckDNS: 100% FREE forever
3. ✅ No-IP: FREE tier (30-day confirmation)
4. ✅ FreeDNS: 100% FREE
5. ✅ Elastic IP: FREE (while instance runs)

**Best for FREE testing**: **DuckDNS** + Let's Encrypt SSL  
**Best for production**: Buy domain ($10-15/year)

**Your EC2 IP**: `16.79.83.21`  
**Ready for**: Free domain setup with DuckDNS  
**Time needed**: 10 minutes  

---

Would you like me to help you set up DuckDNS right now? It's completely free and takes just 10 minutes! 🚀
