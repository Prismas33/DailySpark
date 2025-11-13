#!/usr/bin/env node

/**
 * Generate favicon and PWA icons using Node.js
 * Requires: npm install canvas
 */

const fs = require('fs');
const path = require('path');

try {
  const { createCanvas } = require('canvas');
  
  const PUBLIC_DIR = path.join(__dirname, '..', 'public');
  const ICONS_DIR = path.join(PUBLIC_DIR, 'icons');
  
  // Create directories
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }
  
  function drawSparkle(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, size, size);
    
    const center = size / 2;
    const colors = {
      main: '#10b981',    // Emerald
      gold: '#fbbf24',    // Gold
      white: '#ffffff'
    };
    
    // Draw 4-pointed star
    const starRadius = size * 0.35;
    ctx.save();
    ctx.translate(center, center);
    
    // Main star shape
    ctx.fillStyle = colors.main;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i * 45 - 90) * (Math.PI / 180);
      const isMainPoint = i % 2 === 0;
      const radius = isMainPoint ? starRadius : starRadius * 0.5;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    
    // White highlight
    ctx.fillStyle = colors.white;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.12, 0, Math.PI * 2);
    ctx.fill();
    
    // Sparkle dots
    ctx.fillStyle = colors.gold;
    const sparkleRadius = size * 0.25;
    const dotSize = size * 0.06;
    
    [45, 135, 225, 315].forEach(angle => {
      const rad = angle * (Math.PI / 180);
      const x = sparkleRadius * Math.cos(rad);
      const y = sparkleRadius * Math.sin(rad);
      
      ctx.beginPath();
      ctx.arc(x, y, dotSize, 0, Math.PI * 2);
      ctx.fill();
    });
    
    ctx.restore();
    
    return canvas.toBuffer('image/png');
  }
  
  // Generate all sizes
  const sizes = {
    'favicon.ico': 64,
    'icons/icon-96x96.png': 96,
    'icons/icon-128x128.png': 128,
    'icons/icon-152x152.png': 152,
    'icons/icon-192x192.png': 192,
    'icons/icon-256x256.png': 256,
    'icons/icon-384x384.png': 384,
    'icons/icon-512x512.png': 512,
    'icons/apple-touch-icon.png': 180,
  };
  
  console.log('🎨 Generating favicon and icons...\n');
  
  Object.entries(sizes).forEach(([filename, size]) => {
    const buffer = drawSparkle(size);
    const filepath = path.join(PUBLIC_DIR, filename);
    
    fs.writeFileSync(filepath, buffer);
    const fileSize = (buffer.length / 1024).toFixed(1);
    console.log(`✅ Generated ${filename} (${size}x${size}) - ${fileSize} KB`);
  });
  
  console.log('\n🎉 All icons generated successfully!');
  console.log('\nNext steps:');
  console.log('1. Rebuild: npm run build');
  console.log('2. Test PWA: DevTools → Application → Manifest');
  console.log('3. Install app on mobile or desktop');
  
} catch (err) {
  console.error('❌ Error:', err.message);
  console.error('\nTo use this script, install canvas:');
  console.error('  npm install canvas');
  process.exit(1);
}
