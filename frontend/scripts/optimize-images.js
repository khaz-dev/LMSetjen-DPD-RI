import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Image optimization configurations based on Lighthouse recommendations
const IMAGE_CONFIGS = {
  // Logo optimization (displayed 56x56, actual 192x192)
  'logo/logo-192.png': { width: 112, height: 112, quality: 90 },
  'logo/logo-180.png': { width: 112, height: 112, quality: 90 },
  'logo/logo-512.png': { width: 256, height: 256, quality: 90 }, // Keep larger for PWA
  'logo/logo-32.png': { width: 64, height: 64, quality: 90 },
  'logo/logo-16.png': { width: 32, height: 32, quality: 90 },
  
  // Large images that need optimization
  'LMSetjen-DPD-RI.jpg': { width: 1920, height: 958, quality: 85 },
  'background.jpg': { width: 1920, height: 1080, quality: 80 },
  'region-indonesia-map.jpg': { width: 1600, height: 587, quality: 85 },
  'certificate-bg.png': { width: 1920, height: 1080, quality: 85 },
};

const assetsDir = path.join(__dirname, '../src/assets');
const optimizedCount = { total: 0, success: 0, failed: 0, skipped: 0 };

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function optimizeImage(inputPath, config) {
  try {
    const parsedPath = path.parse(inputPath);
    const outputPath = path.join(
      parsedPath.dir,
      `${parsedPath.name}.webp`
    );

    // Check if already optimized (WebP exists and is newer)
    if (fs.existsSync(outputPath)) {
      const inputStats = fs.statSync(inputPath);
      const outputStats = fs.statSync(outputPath);
      
      if (outputStats.mtime > inputStats.mtime) {
        console.log(`⏭️  Skipped (already optimized): ${path.basename(inputPath)}`);
        optimizedCount.skipped++;
        return;
      }
    }

    const inputStats = fs.statSync(inputPath);
    const inputSizeKB = (inputStats.size / 1024).toFixed(2);

    // Optimize and convert to WebP
    await sharp(inputPath)
      .resize(config.width, config.height, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({
        quality: config.quality,
        effort: 6,
      })
      .toFile(outputPath);

    const outputStats = fs.statSync(outputPath);
    const outputSizeKB = (outputStats.size / 1024).toFixed(2);
    const savings = ((1 - outputStats.size / inputStats.size) * 100).toFixed(1);

    console.log(`✅ Optimized: ${path.basename(inputPath)}`);
    console.log(`   ${config.width}×${config.height} | ${inputSizeKB}KB → ${outputSizeKB}KB (saved ${savings}%)`);
    
    optimizedCount.success++;
  } catch (error) {
    console.error(`❌ Failed to optimize ${inputPath}:`, error.message);
    optimizedCount.failed++;
  }
}

async function optimizeAllImages() {
  console.log('🖼️  Starting Image Optimization...\n');
  console.log('📊 Target: Save 463 KB through optimization\n');

  for (const [filename, config] of Object.entries(IMAGE_CONFIGS)) {
    const inputPath = path.join(assetsDir, filename);
    
    if (!fs.existsSync(inputPath)) {
      console.log(`⚠️  Not found: ${filename}`);
      continue;
    }

    optimizedCount.total++;
    await optimizeImage(inputPath, config);
  }

  console.log('\n' + '='.repeat(60));
  console.log('📈 Optimization Summary:');
  console.log('='.repeat(60));
  console.log(`✅ Successfully optimized: ${optimizedCount.success}`);
  console.log(`⏭️  Skipped (up-to-date): ${optimizedCount.skipped}`);
  console.log(`❌ Failed: ${optimizedCount.failed}`);
  console.log(`📊 Total processed: ${optimizedCount.total}`);
  console.log('='.repeat(60));
  
  if (optimizedCount.success > 0) {
    console.log('\n✨ Next steps:');
    console.log('1. Update image imports to use .webp files');
    console.log('2. Add <picture> elements with fallbacks for older browsers');
    console.log('3. Run Lighthouse audit to verify improvements');
  }
}

optimizeAllImages().catch(console.error);
