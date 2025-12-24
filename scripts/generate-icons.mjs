#!/usr/bin/env node
/**
 * Generate all app icons from logo.svg
 *
 * Usage: node scripts/generate-icons.mjs
 */

import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LOGO_PATH = join(ROOT, 'logo.svg');

// Read the SVG
const svgBuffer = readFileSync(LOGO_PATH);

// Ensure directory exists
function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// Generate a PNG at a specific size
async function generatePng(outputPath, size, options = {}) {
  const { background, padding } = options;

  let image = sharp(svgBuffer)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });

  if (background) {
    image = image.flatten({ background });
  }

  if (padding) {
    const innerSize = Math.round(size * (1 - padding * 2));
    image = sharp(svgBuffer)
      .resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({
        top: Math.round(size * padding),
        bottom: Math.round(size * padding),
        left: Math.round(size * padding),
        right: Math.round(size * padding),
        background: background || { r: 0, g: 0, b: 0, alpha: 0 }
      });
  }

  await image.png().toFile(outputPath);
  console.log(`Generated: ${outputPath}`);
}

// Generate favicon.ico from multiple sizes
async function generateIco(outputPath, sizes) {
  // Generate individual PNGs for ICO
  const pngBuffers = await Promise.all(
    sizes.map(async (size) => {
      return sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toBuffer();
    })
  );

  // Simple ICO format - just use the largest size as a PNG
  // Modern browsers handle PNG favicons well
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(outputPath.replace('.ico', '-32.png'));

  console.log(`Generated: ${outputPath.replace('.ico', '-32.png')} (use as favicon)`);
}

async function generateWebIcons() {
  console.log('\n📱 Generating Web App Icons...\n');

  const webPublic = join(ROOT, 'apps/web/public');
  ensureDir(webPublic);

  // Copy SVG as favicon
  writeFileSync(join(webPublic, 'favicon.svg'), svgBuffer);
  console.log(`Generated: ${join(webPublic, 'favicon.svg')}`);

  // Favicon PNG (32x32)
  await generatePng(join(webPublic, 'favicon-32x32.png'), 32);

  // Favicon PNG (16x16)
  await generatePng(join(webPublic, 'favicon-16x16.png'), 16);

  // Apple touch icon (180x180)
  await generatePng(join(webPublic, 'apple-touch-icon.png'), 180);

  // PWA icons
  await generatePng(join(webPublic, 'icon-192.png'), 192);
  await generatePng(join(webPublic, 'icon-512.png'), 512);

  // Maskable icon (with padding for safe area)
  await generatePng(join(webPublic, 'icon-maskable-512.png'), 512, {
    background: '#2563EB',
    padding: 0.1
  });
}

async function generateIOSIcons(appDir, appName) {
  console.log(`\n🍎 Generating iOS Icons for ${appName}...\n`);

  const iosIconDir = join(ROOT, appDir, 'ios', appName, 'Images.xcassets/AppIcon.appiconset');
  ensureDir(iosIconDir);

  // iOS icon sizes (for modern iOS)
  const iosSizes = [
    { size: 20, scales: [2, 3] },    // Notification
    { size: 29, scales: [2, 3] },    // Settings
    { size: 40, scales: [2, 3] },    // Spotlight
    { size: 60, scales: [2, 3] },    // App icon
    { size: 76, scales: [1, 2] },    // iPad
    { size: 83.5, scales: [2] },     // iPad Pro
    { size: 1024, scales: [1] },     // App Store
  ];

  const contentsImages = [];

  for (const { size, scales } of iosSizes) {
    for (const scale of scales) {
      const pixelSize = Math.round(size * scale);
      const filename = `icon-${size}@${scale}x.png`;
      await generatePng(join(iosIconDir, filename), pixelSize);

      contentsImages.push({
        filename,
        idiom: size >= 76 ? 'ipad' : 'iphone',
        scale: `${scale}x`,
        size: `${size}x${size}`
      });
    }
  }

  // Add universal 1024 for App Store
  contentsImages.push({
    filename: 'icon-1024@1x.png',
    idiom: 'ios-marketing',
    scale: '1x',
    size: '1024x1024'
  });

  // Write Contents.json
  const contentsJson = {
    images: contentsImages,
    info: {
      author: 'generate-icons.mjs',
      version: 1
    }
  };

  writeFileSync(
    join(iosIconDir, 'Contents.json'),
    JSON.stringify(contentsJson, null, 2)
  );
  console.log(`Generated: ${join(iosIconDir, 'Contents.json')}`);
}

async function generateAndroidIcons(appDir) {
  console.log(`\n🤖 Generating Android Icons for ${appDir}...\n`);

  const androidResDir = join(ROOT, appDir, 'android/app/src/main/res');

  // Android adaptive icon sizes
  const densities = [
    { name: 'mipmap-mdpi', size: 48 },
    { name: 'mipmap-hdpi', size: 72 },
    { name: 'mipmap-xhdpi', size: 96 },
    { name: 'mipmap-xxhdpi', size: 144 },
    { name: 'mipmap-xxxhdpi', size: 192 },
  ];

  // Foreground sizes (with padding for adaptive icons)
  const foregroundDensities = [
    { name: 'mipmap-mdpi', size: 108 },
    { name: 'mipmap-hdpi', size: 162 },
    { name: 'mipmap-xhdpi', size: 216 },
    { name: 'mipmap-xxhdpi', size: 324 },
    { name: 'mipmap-xxxhdpi', size: 432 },
  ];

  // Generate legacy square icons
  for (const { name, size } of densities) {
    const dir = join(androidResDir, name);
    ensureDir(dir);
    await generatePng(join(dir, 'ic_launcher.png'), size);
    await generatePng(join(dir, 'ic_launcher_round.png'), size);
  }

  // Generate adaptive icon foreground (icon with padding)
  for (const { name, size } of foregroundDensities) {
    const dir = join(androidResDir, name);
    ensureDir(dir);

    // Foreground: icon centered with safe area padding (~18% on each side)
    const iconSize = Math.round(size * 0.64); // Inner icon is ~64% of total
    const padding = Math.round((size - iconSize) / 2);

    await sharp(svgBuffer)
      .resize(iconSize, iconSize)
      .extend({
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(join(dir, 'ic_launcher_foreground.png'));

    console.log(`Generated: ${join(dir, 'ic_launcher_foreground.png')}`);
  }

  // Generate background color drawable
  const valuesDir = join(androidResDir, 'values');
  ensureDir(valuesDir);

  const icLauncherBackground = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#2563EB</color>
</resources>
`;
  writeFileSync(join(valuesDir, 'ic_launcher_background.xml'), icLauncherBackground);
  console.log(`Generated: ${join(valuesDir, 'ic_launcher_background.xml')}`);

  // Generate adaptive icon XML
  const mipmapAnydpiDir = join(androidResDir, 'mipmap-anydpi-v26');
  ensureDir(mipmapAnydpiDir);

  const adaptiveIconXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;

  writeFileSync(join(mipmapAnydpiDir, 'ic_launcher.xml'), adaptiveIconXml);
  writeFileSync(join(mipmapAnydpiDir, 'ic_launcher_round.xml'), adaptiveIconXml);
  console.log(`Generated: ${join(mipmapAnydpiDir, 'ic_launcher.xml')}`);
  console.log(`Generated: ${join(mipmapAnydpiDir, 'ic_launcher_round.xml')}`);
}

async function main() {
  console.log('🎨 Mobile Worship Icon Generator\n');
  console.log(`Using logo: ${LOGO_PATH}`);

  try {
    await generateWebIcons();
    await generateIOSIcons('apps/client', 'MobileWorshipClient');
    await generateIOSIcons('apps/host', 'MobileWorshipHost');
    await generateAndroidIcons('apps/client');
    await generateAndroidIcons('apps/host');

    console.log('\n✅ All icons generated successfully!\n');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

main();
