import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const INPUT  = 'C:\\Users\\DELL\\.gemini\\antigravity-ide\\brain\\f10d4557-e32a-4f76-a5da-4ad1aae728f7\\media__1782632226945.png';
const OUTPUT = path.join(__dirname, '..', 'public', 'bella-erp-logo.png');

// Pixels whiter than this threshold in all 3 channels → transparent
const THRESHOLD = 240;

const { data, info } = await sharp(INPUT)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info; // 4 channels: RGBA
const pixels = new Uint8ClampedArray(data);

let transparent = 0;
for (let i = 0; i < pixels.length; i += channels) {
  const r = pixels[i];
  const g = pixels[i + 1];
  const b = pixels[i + 2];
  if (r >= THRESHOLD && g >= THRESHOLD && b >= THRESHOLD) {
    pixels[i + 3] = 0; // set alpha = 0 (fully transparent)
    transparent++;
  }
}

await sharp(Buffer.from(pixels.buffer), {
  raw: { width, height, channels },
})
  .png({ compressionLevel: 9 })
  .toFile(OUTPUT);

console.log(`✅ Done: ${OUTPUT}`);
console.log(`   ${transparent} white pixels removed → transparent`);
