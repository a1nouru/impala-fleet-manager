// Rasterizes a source SVG into the PWA/Apple icon set.
// Usage: node scripts/generate-icons.mjs [sourceSvg] [maskableBgColor]
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const source = process.argv[2] || 'public/logo.svg';
const maskableBg = process.argv[3] || '#ffffff';
const outDir = 'public/icons';

async function main() {
  await mkdir(outDir, { recursive: true });
  const svg = readFileSync(source);

  // Standard "any" icons: logo edge-to-edge.
  await sharp(svg).resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toFile(path.join(outDir, 'icon-192.png'));
  await sharp(svg).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toFile(path.join(outDir, 'icon-512.png'));

  // Apple touch icon: opaque background (iOS ignores transparency oddly).
  await sharp(svg).resize(180, 180, { fit: 'contain', background: maskableBg })
    .flatten({ background: maskableBg })
    .png().toFile(path.join(outDir, 'apple-touch-icon-180.png'));

  // Maskable icon: logo in the safe zone (~80%) on a solid background.
  const inner = 512 * 0.8;
  const logo = await sharp(svg).resize(Math.round(inner), Math.round(inner), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: maskableBg } })
    .composite([{ input: logo, gravity: 'center' }])
    .png().toFile(path.join(outDir, 'icon-maskable-512.png'));

  console.log('✅ Icons generated in', outDir);
}
main().catch((e) => { console.error(e); process.exit(1); });
