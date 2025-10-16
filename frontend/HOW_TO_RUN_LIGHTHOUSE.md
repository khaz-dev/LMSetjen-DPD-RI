# 🔍 How to Run Lighthouse Audit
## Step-by-Step Guide for Windows PowerShell

**Date:** October 15, 2025  
**Project:** LMSetjen DPD RI Learning Management System

---

## 🎯 Quick Fix for Your Error

The error you encountered happens because:
1. The local server (`npx serve`) shuts down too quickly
2. Chrome/Lighthouse can't connect to the server
3. You need to keep the server running **in a separate terminal**

---

## ✅ Solution: Method 1 (Recommended - Manual Steps)

### **Step 1: Build the Production Bundle**

Open PowerShell and run:

```powershell
cd "d:\Project\LMSetjen DPD RI\frontend"
npm run build
```

Wait for build to complete (should take ~20 seconds).

---

### **Step 2: Start the Server in a NEW Terminal**

**Important:** Open a **SECOND** PowerShell terminal window

```powershell
cd "d:\Project\LMSetjen DPD RI\frontend"
npx serve -s dist -l 3000
```

You should see:
```
   ┌───────────────────────────────────────────┐
   │   Serving!                                │
   │   - Local:    http://localhost:3000       │
   └───────────────────────────────────────────┘
```

**Keep this terminal open!** Don't close it or press Ctrl+C.

---

### **Step 3: Verify Server is Running**

In your **ORIGINAL** terminal (or open a third one), test the server:

```powershell
# Test if server responds
curl http://localhost:3000
```

You should see HTML output. If you get an error, go back to Step 2.

---

### **Step 4: Run Lighthouse Audit**

In your **ORIGINAL** terminal (NOT the one running the server), run:

```powershell
cd "d:\Project\LMSetjen DPD RI\frontend"

npx lighthouse http://localhost:3000 --output=html --output=json --output-path="lighthouse-report" --chrome-flags="--no-sandbox --disable-dev-shm-usage" --only-categories=performance,accessibility,best-practices,seo --preset=desktop
```

Wait 30-60 seconds for the audit to complete.

---

### **Step 5: View Results**

The audit will generate two files:
- `lighthouse-report.html` - Visual report (open in browser)
- `lighthouse-report.json` - Raw data

Open the HTML report:
```powershell
Start-Process lighthouse-report.html
```

Or simply double-click `lighthouse-report.html` in File Explorer.

---

### **Step 6: Stop the Server**

Go back to the terminal running `npx serve` and press:
```
Ctrl + C
```

---

## ✅ Solution: Method 2 (Using Helper Script)

I've created a helper script for you!

### **Step 1: Run the Simple Script**

```powershell
cd "d:\Project\LMSetjen DPD RI\frontend"
.\run-lighthouse-simple.ps1
```

### **Step 2: Follow the On-Screen Instructions**

The script will guide you through:
1. Starting the server manually
2. Testing the connection
3. Running Lighthouse
4. Opening the report

---

## 🔧 Alternative: Using Chrome DevTools (No Terminal Needed!)

If the terminal method is too complicated:

### **Method A: Use Chrome DevTools Lighthouse**

1. **Start the server:**
   ```powershell
   cd "d:\Project\LMSetjen DPD RI\frontend"
   npx serve -s dist -l 3000
   ```

2. **Open Chrome browser** and go to: `http://localhost:3000`

3. **Open DevTools:**
   - Press `F12` or right-click → "Inspect"

4. **Go to Lighthouse tab:**
   - Click "Lighthouse" tab in DevTools
   - If you don't see it, click the `>>` icon and select "Lighthouse"

5. **Configure and Run:**
   - Select categories: Performance, Accessibility, Best Practices, SEO
   - Choose "Desktop" mode
   - Click **"Analyze page load"**

6. **View Results:**
   - Results appear in DevTools
   - Click "View Report" to see full report
   - Export as HTML if needed

7. **Stop the server:**
   - Go back to PowerShell
   - Press `Ctrl + C`

---

## 📊 Expected Results

After running the audit, you should see:

### **Performance Score**
```
Performance:      90-95/100  ✅
  - First Contentful Paint: ~1.2s
  - Largest Contentful Paint: ~2.5s
  - Speed Index: ~1.8s
  - Total Blocking Time: ~300ms
  - Cumulative Layout Shift: ~0.1
```

### **Accessibility Score**
```
Accessibility:    85-90/100  ✅
  - ARIA attributes: Valid
  - Color contrast: Sufficient
  - Alt text: Present
```

### **Best Practices Score**
```
Best Practices:   90-95/100  ✅
  - No console errors: ✅
  - HTTPS: ✅ (when deployed)
  - No browser errors: ✅
```

### **SEO Score**
```
SEO:              85-95/100  ✅
  - Meta tags: Present
  - Mobile-friendly: ✅
  - Crawlable: ✅
```

---

## 🐛 Troubleshooting

### **Problem 1: "Cannot connect to server"**

**Solution:**
```powershell
# Check if port 3000 is in use
netstat -ano | findstr :3000

# If something is running, kill it:
# Find the PID from netstat output, then:
taskkill /PID <PID_NUMBER> /F

# Now start your server again
npx serve -s dist -l 3000
```

---

### **Problem 2: "CHROME_INTERSTITIAL_ERROR"**

This is the error you encountered. **Solutions:**

1. **Keep server running in separate terminal** (recommended)

2. **Or use different Chrome flags:**
   ```powershell
   npx lighthouse http://localhost:3000 --output=html --output-path="lighthouse-report.html" --chrome-flags="--no-sandbox --disable-dev-shm-usage --disable-gpu --disable-extensions --disable-software-rasterizer" --only-categories=performance,accessibility,best-practices,seo
   ```

3. **Or increase wait time:**
   ```powershell
   # Wait 15 seconds before running Lighthouse
   Start-Sleep -Seconds 15
   npx lighthouse http://localhost:3000 ...
   ```

4. **Or use Chrome DevTools** (most reliable - no terminal issues!)

---

### **Problem 3: "Command not found: npx"**

**Solution:**
```powershell
# Install/update Node.js from https://nodejs.org/
# Then verify:
node --version
npm --version
npx --version
```

---

### **Problem 4: Lighthouse takes too long**

**Solution:**
- Add `--throttling.cpuSlowdownMultiplier=1` for faster audit
- Use `--preset=desktop` instead of mobile (faster)
- Limit categories: `--only-categories=performance`

Example:
```powershell
npx lighthouse http://localhost:3000 --output=html --output-path="lighthouse-report.html" --chrome-flags="--no-sandbox" --only-categories=performance --preset=desktop --throttling.cpuSlowdownMultiplier=1
```

---

## 📋 Command Reference

### **Basic Lighthouse Command**
```powershell
npx lighthouse <URL> --output=<format> --output-path=<filename>
```

### **Full Command (All Options)**
```powershell
npx lighthouse http://localhost:3000 `
  --output=html `
  --output=json `
  --output-path="lighthouse-report" `
  --chrome-flags="--no-sandbox --disable-dev-shm-usage" `
  --only-categories=performance,accessibility,best-practices,seo `
  --preset=desktop `
  --quiet
```

### **Quick Desktop Audit**
```powershell
npx lighthouse http://localhost:3000 --preset=desktop --view
```

### **Mobile Audit (Default)**
```powershell
npx lighthouse http://localhost:3000 --view
```

---

## 🎯 Recommended Workflow

### **For Development Testing:**
1. Use **Chrome DevTools Lighthouse** (easiest, no terminal issues)

### **For Official Reports:**
1. Start server in separate terminal
2. Run Lighthouse CLI
3. Generate HTML + JSON reports
4. Share with stakeholders

### **For CI/CD Pipeline:**
1. Use Lighthouse CI (automated)
2. Set performance budgets
3. Fail build if scores drop

---

## 💡 Pro Tips

### **Tip 1: Always Test Production Build**
```powershell
# Never audit development server
npm run dev ❌

# Always build first, then audit
npm run build ✅
npx serve -s dist -l 3000
```

### **Tip 2: Run Multiple Audits**
```powershell
# Run 3 times and average results (Lighthouse varies slightly)
npx lighthouse http://localhost:3000 --output=html --output-path="report-1.html"
npx lighthouse http://localhost:3000 --output=html --output-path="report-2.html"
npx lighthouse http://localhost:3000 --output=html --output-path="report-3.html"
```

### **Tip 3: Compare Before/After**
```powershell
# Before optimization
npx lighthouse http://localhost:3000 --output=json --output-path="before.json"

# After optimization
npx lighthouse http://localhost:3000 --output=json --output-path="after.json"

# Compare (use online tools or Lighthouse CI)
```

### **Tip 4: Use --view for Quick Check**
```powershell
# Opens report immediately in browser
npx lighthouse http://localhost:3000 --view --preset=desktop
```

---

## 📚 Additional Resources

- **Lighthouse Documentation:** https://developers.google.com/web/tools/lighthouse
- **Core Web Vitals:** https://web.dev/vitals/
- **Performance Budgets:** https://web.dev/performance-budgets-101/

---

## ✅ Quick Start (Copy-Paste)

**Terminal 1 (Server):**
```powershell
cd "d:\Project\LMSetjen DPD RI\frontend"
npx serve -s dist -l 3000
```

**Terminal 2 (Lighthouse):**
```powershell
cd "d:\Project\LMSetjen DPD RI\frontend"
npx lighthouse http://localhost:3000 --output=html --output-path="lighthouse-report.html" --chrome-flags="--no-sandbox --disable-dev-shm-usage" --preset=desktop --view
```

---

## 🎉 That's It!

You should now have a working Lighthouse audit!

If you still have issues, try the **Chrome DevTools method** - it's the most reliable and doesn't require managing separate terminals.

Good luck! 🚀

---

**Prepared by Performance Optimization Team**  
**LMSetjen DPD RI - Learning Management System**  
**October 15, 2025**
