# 🚀 Deployment Guide - Vercel & Netlify

## 📋 Prerequisites

- ✅ Production build complete (`npm run build`)
- ✅ All optimizations applied and tested
- ✅ Git repository set up
- ✅ GitHub account (for both Vercel and Netlify)

---

## 🌐 Option 1: Deploy to Vercel (Recommended)

### Why Vercel?
- ✅ Built by Vite creators - perfect compatibility
- ✅ Zero-config deployment
- ✅ Automatic HTTP/2 + HTTP/3
- ✅ Global CDN (100+ edge locations)
- ✅ Automatic gzip + brotli compression
- ✅ Free SSL certificates
- ✅ Preview deployments for every commit

### Step-by-Step Deployment:

#### 1. Install Vercel CLI
```bash
npm install -g vercel
```

#### 2. Login to Vercel
```bash
vercel login
```

#### 3. Deploy from Frontend Directory
```bash
cd "d:\Project\LMSetjen DPD RI\frontend"
vercel
```

#### 4. Answer the Prompts:
```
? Set up and deploy "frontend"? Y
? Which scope? [Your account name]
? Link to existing project? N
? What's your project's name? lmsetjen-dpd-ri
? In which directory is your code located? ./
? Want to override the settings? N
```

#### 5. Production Deployment
```bash
vercel --prod
```

### Expected Output:
```
✅ Production: https://lmsetjen-dpd-ri.vercel.app [deployed]
```

### Vercel Configuration (vercel.json)

Create `frontend/vercel.json`:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

---

## 🌐 Option 2: Deploy to Netlify

### Why Netlify?
- ✅ Excellent for static sites
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Built-in form handling
- ✅ Split testing capabilities
- ✅ Free tier generous limits

### Step-by-Step Deployment:

#### 1. Install Netlify CLI
```bash
npm install -g netlify-cli
```

#### 2. Login to Netlify
```bash
netlify login
```

#### 3. Initialize and Deploy
```bash
cd "d:\Project\LMSetjen DPD RI\frontend"
netlify init
```

#### 4. Answer the Prompts:
```
? What would you like to do? Create & configure a new site
? Team: [Your team name]
? Site name: lmsetjen-dpd-ri
? Build command: npm run build
? Directory to deploy: dist
```

#### 5. Deploy to Production
```bash
netlify deploy --prod
```

### Expected Output:
```
✅ Live URL: https://lmsetjen-dpd-ri.netlify.app
```

### Netlify Configuration (netlify.toml)

Create `frontend/netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

---

## 🔧 Environment Variables

### For Backend API Connection:

Both Vercel and Netlify support environment variables.

#### In Vercel Dashboard:
1. Go to Project Settings
2. Click "Environment Variables"
3. Add:
   - `VITE_API_URL` = `https://your-backend-api.com`
   - `VITE_API_KEY` = `your-api-key`

#### In Netlify Dashboard:
1. Go to Site Settings
2. Click "Environment Variables"
3. Add same variables as above

#### Or via CLI:

**Vercel:**
```bash
vercel env add VITE_API_URL production
# Enter value: https://your-backend-api.com
```

**Netlify:**
```bash
netlify env:set VITE_API_URL "https://your-backend-api.com"
```

---

## 📊 Post-Deployment: Run Lighthouse Audit

### Once deployed, run final audit on live URL:

```bash
# For Vercel
npx lighthouse https://lmsetjen-dpd-ri.vercel.app \
  --preset=desktop \
  --output=html \
  --output=json \
  --output-path=lighthouse-production \
  --chrome-flags=--incognito \
  --only-categories=performance,accessibility,best-practices,seo

# For Netlify
npx lighthouse https://lmsetjen-dpd-ri.netlify.app \
  --preset=desktop \
  --output=html \
  --output=json \
  --output-path=lighthouse-production \
  --chrome-flags=--incognito \
  --only-categories=performance,accessibility,best-practices,seo
```

### Expected Production Scores:
```
🚀 Performance:    97-99/100
♿ Accessibility:  91/100
✅ Best Practices: 100/100
🔍 SEO:            100/100
───────────────────────────
📊 OVERALL:        96-98/100
```

---

## 🎯 Quick Deployment Commands

### Vercel (One-Command Deploy):
```bash
cd "d:\Project\LMSetjen DPD RI\frontend"
npx vercel --prod
```

### Netlify (One-Command Deploy):
```bash
cd "d:\Project\LMSetjen DPD RI\frontend"
npx netlify deploy --prod --dir=dist
```

---

## 📝 Custom Domain Setup

### Vercel:
1. Go to Project Settings → Domains
2. Add your domain: `lms.dpd.go.id`
3. Configure DNS:
   ```
   Type: CNAME
   Name: lms (or @)
   Value: cname.vercel-dns.com
   ```

### Netlify:
1. Go to Site Settings → Domain Management
2. Add custom domain: `lms.dpd.go.id`
3. Configure DNS:
   ```
   Type: CNAME
   Name: lms (or @)
   Value: [your-site].netlify.app
   ```

---

## 🔍 Monitoring & Analytics

### Vercel Analytics (Built-in):
```bash
# Already enabled on all deployments
# View at: https://vercel.com/[your-project]/analytics
```

### Netlify Analytics:
```bash
# Enable in Site Settings → Analytics
# $9/month but very detailed
```

### Alternative: Google Analytics

Add to `frontend/index.html`:
```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

---

## 🚨 Troubleshooting

### Issue: Build Fails
**Solution:** Check build logs and ensure all dependencies are installed:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Issue: 404 on Routes
**Solution:** Ensure SPA redirect is configured (see vercel.json or netlify.toml above)

### Issue: Environment Variables Not Working
**Solution:** 
- Prefix with `VITE_` for Vite to expose them
- Redeploy after adding variables
- Check spelling and case sensitivity

### Issue: API Calls Failing
**Solution:**
- Update CORS settings on backend
- Add production URL to allowed origins
- Check API URL in environment variables

---

## ✅ Deployment Checklist

Before deploying:
- [ ] Production build successful (`npm run build`)
- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Backend API accessible
- [ ] CORS configured for production domain
- [ ] robots.txt updated with production URL
- [ ] Sitemap.xml generated (if needed)

After deploying:
- [ ] Run Lighthouse audit on live URL
- [ ] Test all major features
- [ ] Check forms submission
- [ ] Verify API connections
- [ ] Test on mobile devices
- [ ] Check SSL certificate
- [ ] Verify custom domain (if configured)

---

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Netlify Documentation](https://docs.netlify.com/)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)

---

## 🎉 Success Criteria

Your deployment is successful when:
- ✅ Live URL accessible globally
- ✅ HTTPS working (green padlock)
- ✅ Lighthouse score ≥ 96/100 overall
- ✅ All pages loading correctly
- ✅ API connections working
- ✅ No console errors
- ✅ Mobile responsive
- ✅ Fast load times (<2s)

---

**Next Step:** Choose Vercel (recommended) or Netlify and follow the deployment steps above.

Once deployed, run the Lighthouse audit on your live URL to see the **true performance score** with HTTP/2, compression, and CDN benefits!

**Expected Final Score: 97-99/100** 🏆

---

*Last Updated: October 16, 2025*  
*Project: LMSetjen DPD RI - Learning Management System*  
*Status: Ready for Production Deployment*
