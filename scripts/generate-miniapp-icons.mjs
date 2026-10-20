import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Rasterize the existing licensed Lucide artwork for WeChat's PNG-only TabBar.
const require = createRequire(import.meta.url);
const sharp = require(
  require.resolve('sharp', {
    paths: [fileURLToPath(new URL('../node_modules/.pnpm/node_modules/', import.meta.url))],
  }),
);
const source = await readFile(new URL('../docs/design/assets/lucide-icons.svg', import.meta.url), 'utf8');
const output = new URL('../apps/miniapp/src/assets/icons/', import.meta.url);
await mkdir(output, { recursive: true });
const names = [
  'house',
  'shirt',
  'grid-2x2',
  'user-round',
  'bell',
  'chevron-right',
  'lock-keyhole',
  'bookmark',
  'clock',
  'shield-check',
  'plus',
  'check',
];
for (const name of names) {
  const match = source.match(new RegExp(`<symbol id="${name}" viewBox="([^"]+)">([\\s\\S]*?)</symbol>`));
  if (!match) throw new Error(`Missing licensed Lucide symbol: ${name}`);
  for (const [variant, stroke] of Object.entries({ default: '#74676c', active: '#763b50' })) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="${match[1]}" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${match[2]}</svg>`;
    await sharp(Buffer.from(svg))
      .png()
      .toFile(fileURLToPath(new URL(`${name}-${variant}.png`, output)));
  }
}
await copyFile(new URL('../docs/design/assets/LUCIDE-LICENSE.txt', import.meta.url), new URL('LICENSE.txt', output));
console.log(`Generated ${names.length * 2} licensed PNG icons.`);
