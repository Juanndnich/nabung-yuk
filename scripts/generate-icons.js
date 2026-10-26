import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const BRANDING_DIR = path.resolve('public/branding');
const ICON_SOURCE = path.join(BRANDING_DIR, 'icon-source.png');
const PUBLIC_DIR = path.resolve('public');

async function ensureSourceIcon() {
  if (!fs.existsSync(BRANDING_DIR)) {
    fs.mkdirSync(BRANDING_DIR, { recursive: true });
  }

  if (!fs.existsSync(ICON_SOURCE)) {
    console.log('[icon-generator] icon-source.png belum ada. Membuat placeholder yang jelas...');
    
    // Create a 1024x1024 placeholder SVG
    const placeholderSvg = `
      <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
        <rect width="1024" height="1024" rx="200" fill="#0f172a" />
        <rect x="32" y="32" width="960" height="960" rx="180" fill="none" stroke="#f43f5e" stroke-width="24" stroke-dasharray="32,24" />
        
        <!-- Wallet / Piggy Silhouette -->
        <rect x="262" y="280" width="500" height="340" rx="48" fill="#10b981" />
        <rect x="580" y="390" width="220" height="120" rx="30" fill="#047857" />
        <circle cx="660" cy="450" r="28" fill="#fef08a" />
        
        <text x="512" y="730" font-family="Arial, sans-serif" font-size="70" font-weight="900" fill="#ffffff" text-anchor="middle">
          PLACEHOLDER
        </text>
        <text x="512" y="810" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="#f43f5e" text-anchor="middle">
          GANTI IKON DI
        </text>
        <text x="512" y="870" font-family="Arial, sans-serif" font-size="34" font-weight="500" fill="#94a3b8" text-anchor="middle">
          public/branding/icon-source.png
        </text>
      </svg>
    `;

    await sharp(Buffer.from(placeholderSvg))
      .png()
      .toFile(ICON_SOURCE);

    console.log('[icon-generator] Placeholder dibuat di public/branding/icon-source.png');
  }
}

/**
 * Creates standard Windows/Web ICO containing a 32x32 PNG
 */
function createIcoFromPng(pngBuffer) {
  // 6-byte ICO header + 16-byte directory entry + PNG data
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(1, 4); // 1 image

  const dirEntry = Buffer.alloc(16);
  dirEntry.writeUInt8(32, 0);  // Width 32
  dirEntry.writeUInt8(32, 1);  // Height 32
  dirEntry.writeUInt8(0, 2);   // Color palette 0
  dirEntry.writeUInt8(0, 3);   // Reserved
  dirEntry.writeUInt16LE(1, 4); // Color planes
  dirEntry.writeUInt16LE(32, 6); // Bits per pixel
  dirEntry.writeUInt32LE(pngBuffer.length, 8); // Image byte size
  dirEntry.writeUInt32LE(22, 12); // Offset (6 + 16 = 22)

  return Buffer.concat([header, dirEntry, pngBuffer]);
}

async function generateAllIcons() {
  await ensureSourceIcon();

  const sourceMeta = await sharp(ICON_SOURCE).metadata();
  console.log(`[icon-generator] Memproses sumber ikon (${sourceMeta.width}x${sourceMeta.height} px)...`);

  // 1. PWA 192x192
  await sharp(ICON_SOURCE)
    .resize(192, 192)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'pwa-192x192.png'));

  // 2. PWA 512x512
  await sharp(ICON_SOURCE)
    .resize(512, 512)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'pwa-512x512.png'));

  // 3. Maskable 512x512 with safe zone (80% scale centered)
  const innerSize = Math.round(512 * 0.8); // ~410px
  const innerBuffer = await sharp(ICON_SOURCE)
    .resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 }, // Dark slate base for maskable
    },
  })
    .composite([{ input: innerBuffer, gravity: 'center' }])
    .png()
    .toFile(path.join(PUBLIC_DIR, 'maskable-icon-512x512.png'));

  // 4. Apple Touch Icon 180x180
  await sharp(ICON_SOURCE)
    .resize(180, 180)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'apple-touch-icon-180x180.png'));

  // 5. Favicon 32x32 & 16x16
  const fav32Buffer = await sharp(ICON_SOURCE)
    .resize(32, 32)
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon-32x32.png'), fav32Buffer);

  await sharp(ICON_SOURCE)
    .resize(16, 16)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'favicon-16x16.png'));

  // 6. Favicon ICO
  const icoBuffer = createIcoFromPng(fav32Buffer);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), icoBuffer);

  // 7. Shortcut icons 96x96
  await sharp(ICON_SOURCE)
    .resize(96, 96)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'shortcut-income-96x96.png'));

  await sharp(ICON_SOURCE)
    .resize(96, 96)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'shortcut-expense-96x96.png'));

  console.log('[icon-generator] Berhasil menghasilkan seluruh varian ikon ke folder public/ :');
  console.log(' - pwa-192x192.png');
  console.log(' - pwa-512x512.png');
  console.log(' - maskable-icon-512x512.png');
  console.log(' - apple-touch-icon-180x180.png');
  console.log(' - favicon-32x32.png & favicon-16x16.png & favicon.ico');
  console.log(' - shortcut-income-96x96.png & shortcut-expense-96x96.png');
}

generateAllIcons().catch((err) => {
  console.error('[icon-generator] Gagal menghasilkan ikon:', err);
  process.exit(1);
});
