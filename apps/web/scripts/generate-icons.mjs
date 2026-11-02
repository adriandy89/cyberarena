// Renders app/icon.svg into the other app icons Next.js serves from app/:
//   favicon.ico     16, 32 and 48 px (PNG frames) for browsers and tools that only ask for /favicon.ico
//   apple-icon.png  180 px, opaque (iOS home screen)
// Run after editing the SVG: pnpm --filter @repo/web icons
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

// sharp ships with Next.js (image optimization): reuse it instead of adding a dependency.
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('next'))('sharp');

const app = new URL('../app/', import.meta.url);
const svg = await readFile(new URL('icon.svg', app));
const TILE = '#020617';

// Rasterize at high density, then downscale: crisper edges than rendering at the target size.
const render = (size) => sharp(svg, { density: 576 }).resize(size, size);

/** ICO container with PNG-encoded frames (supported by every current browser and OS). */
function ico(frames) {
  const header = Buffer.alloc(6 + 16 * frames.length);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach(({ size, data }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size, entry); // width
    header.writeUInt8(size, entry + 1); // height
    header.writeUInt16LE(1, entry + 4); // color planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...frames.map((frame) => frame.data)]);
}

const frames = await Promise.all(
  [16, 32, 48].map(async (size) => ({ size, data: await render(size).png().toBuffer() })),
);
await writeFile(new URL('favicon.ico', app), ico(frames));
await writeFile(new URL('apple-icon.png', app), await render(180).flatten({ background: TILE }).png().toBuffer());
console.log('icons: app/favicon.ico (16/32/48), app/apple-icon.png (180)');
