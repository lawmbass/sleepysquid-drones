const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Image compression script using Sharp
// This will compress your 4-8MB images to web-optimized sizes

const imagesDir = path.join(process.cwd(), 'public/images');
const outputDir = path.join(process.cwd(), 'public/images/optimized');

// Create optimized directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function compressImage(inputPath, outputPath, quality = 85, maxWidth = 1920) {
  try {
    const info = await sharp(inputPath)
      .resize(maxWidth, null, { withoutEnlargement: true })
      .jpeg({ quality, progressive: true })
      .toFile(outputPath);
    
    const inputStats = fs.statSync(inputPath);
    const outputStats = fs.statSync(outputPath);
    const reduction = ((inputStats.size - outputStats.size) / inputStats.size * 100).toFixed(1);
    
    console.log(`✅ ${path.basename(inputPath)}: ${(inputStats.size / 1024 / 1024).toFixed(1)}MB → ${(outputStats.size / 1024 / 1024).toFixed(1)}MB (${reduction}% reduction)`);
    
    return info;
  } catch (error) {
    console.error(`❌ Error compressing ${path.basename(inputPath)}:`, error.message);
  }
}

async function compressAllImages() {
  console.log('🔧 COMPRESSING IMAGES');
  console.log('======================\n');
  
  try {
    const files = fs.readdirSync(imagesDir);
    const imageFiles = files.filter(file => /\.(jpg|jpeg|png)$/i.test(file));
    
    if (imageFiles.length === 0) {
      console.log('No images found to compress.');
      return;
    }
    
    console.log(`Found ${imageFiles.length} images to compress...\n`);
    
    for (const file of imageFiles) {
      const inputPath = path.join(imagesDir, file);
      const outputPath = path.join(outputDir, file);
      
      await compressImage(inputPath, outputPath, 85, 1920);
    }
    
    console.log('\n✨ Compression complete!');
    console.log(`\nOptimized images saved to: ${outputDir}`);
    console.log('\n📝 Next steps:');
    console.log('1. Review the optimized images');
    console.log('2. Replace original images with optimized versions if satisfied');
    console.log('3. Delete the optimized folder after copying files');
    
  } catch (error) {
    console.error('Error:', error.message);
    
    if (error.code === 'MODULE_NOT_FOUND' && error.message.includes('sharp')) {
      console.log('\n💡 Sharp not installed. Run:');
      console.log('npm install sharp');
    }
  }
}

// Check if sharp is available
try {
  require.resolve('sharp');
  compressAllImages();
} catch (error) {
  console.log('📦 Installing Sharp...\n');
  console.log('Sharp is required for image compression.');
  console.log('Please run: npm install sharp');
  console.log('Then run this script again: node scripts/compress-images.js');
} 