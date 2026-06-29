import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const INPUT = 'C:\\Users\\DELL\\.gemini\\antigravity-ide\\brain\\f10d4557-e32a-4f76-a5da-4ad1aae728f7\\media__1782632226945.png';
const OUTPUT = path.join(__dirname, '..', 'public', 'bella-erp-logo.png');

const { data, info } = await sharp(INPUT)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;
const pixels = new Uint8ClampedArray(data);

for (let i = 0; i < pixels.length; i += channels) {
  const r = pixels[i];
  const g = pixels[i + 1];
  const b = pixels[i + 2];

  // Calculate whiteness. Pure white is 255.
  const min = Math.min(r, g, b);

  if (min >= 250) {
    // Definitely background
    pixels[i + 3] = 0;
  } else if (min >= 210) {
    // Linear transparency scale from 210 to 250
    const alphaFactor = (250 - min) / (250 - 210); // 1.0 at 210, 0.0 at 250
    pixels[i + 3] = Math.round(255 * alphaFactor);

    // Darken edge pixels to prevent white halo on dark background
    pixels[i] = Math.round(r * alphaFactor);
    pixels[i + 1] = Math.round(g * alphaFactor);
    pixels[i + 2] = Math.round(b * alphaFactor);
  }
}

await sharp(Buffer.from(pixels.buffer), {
  raw: { width, height, channels },
})
  .png({ compressionLevel: 9 })
  .toFile(OUTPUT);

console.log('✅ Clean anti-aliased logo saved!');
