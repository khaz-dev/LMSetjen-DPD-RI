#!/usr/bin/env node

/**
 * Lighthouse Performance Testing Script
 * Phase 4.9 - Performance Testing & Validation
 * 
 * Usage: node lighthouse-test.js <url>
 * Example: node lighthouse-test.js http://localhost:3000/advanced-search
 */

const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const path = require('path');

async function runLighthouse(url) {
  let chrome = null;
  
  try {
    console.log('🚀 Starting Lighthouse audit...');
    
    // Launch Chrome
    chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
    
    const options = {
      logLevel: 'info',
      output: 'json',
      port: chrome.port,
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo']
    };
    
    // Run Lighthouse
    const runnerResult = await lighthouse(url, options);
    
    // Extract results
    const report = JSON.parse(runnerResult.report);
    const scores = {
      performance: (report.categories.performance.score * 100).toFixed(0),
      accessibility: (report.categories.accessibility.score * 100).toFixed(0),
      bestPractices: (report.categories['best-practices'].score * 100).toFixed(0),
      seo: (report.categories.seo.score * 100).toFixed(0)
    };
    
    // Extract audit details
    const audits = report.audits;
    const performanceMetrics = {
      firstContentfulPaint: audits['first-contentful-paint']?.numericValue,
      largestContentfulPaint: audits['largest-contentful-paint']?.numericValue,
      cumulativeLayoutShift: audits['cumulative-layout-shift']?.numericValue,
      timeToInteractive: audits['interactive']?.numericValue,
      totalBlockingTime: audits['total-blocking-time']?.numericValue,
      speedIndex: audits['speed-index']?.numericValue
    };
    
    // Generate report
    const reportData = {
      timestamp: new Date().toISOString(),
      url: url,
      scores: scores,
      metrics: performanceMetrics,
      audits: {
        performance: report.categories.performance.auditRefs.map(ref => ({
          id: ref.id,
          weight: ref.weight,
          group: ref.group
        })),
        accessibility: report.categories.accessibility.auditRefs.map(ref => ref.id),
        bestPractices: report.categories['best-practices'].auditRefs.map(ref => ref.id)
      }
    };
    
    // Save report
    const reportPath = path.join(
      __dirname,
      `lighthouse-report-${new Date().toISOString().split('T')[0]}.json`
    );
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    
    // Print results
    console.log('\n✅ Lighthouse Audit Complete');
    console.log('=====================================');
    console.log(`Performance Score: ${scores.performance}/100`);
    console.log(`Accessibility Score: ${scores.accessibility}/100`);
    console.log(`Best Practices Score: ${scores.bestPractices}/100`);
    console.log(`SEO Score: ${scores.seo}/100`);
    console.log('\n📊 Performance Metrics:');
    console.log(`First Contentful Paint: ${(performanceMetrics.firstContentfulPaint / 1000).toFixed(2)}s`);
    console.log(`Largest Contentful Paint: ${(performanceMetrics.largestContentfulPaint / 1000).toFixed(2)}s`);
    console.log(`Speed Index: ${(performanceMetrics.speedIndex / 1000).toFixed(2)}s`);
    console.log(`Time to Interactive: ${(performanceMetrics.timeToInteractive / 1000).toFixed(2)}s`);
    console.log('\n📁 Report saved to: ' + reportPath);
    console.log('=====================================\n');
    
    return reportData;
    
  } catch (error) {
    console.error('❌ Error running Lighthouse:', error);
    process.exit(1);
  } finally {
    if (chrome) {
      await chrome.kill();
    }
  }
}

// Get URL from command line or use default
const url = process.argv[2] || 'http://localhost:3000/advanced-search';
runLighthouse(url);
