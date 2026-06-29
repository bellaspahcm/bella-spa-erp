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

// Column coordinate separator between the letter 'a' (ends at 658) and 'E' (starts at 677)
const SEPARATOR_X = 665; 

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * channels;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    const min = Math.min(r, g, b);

    if (x >= SEPARATOR_X) {
      // Right side: Recolor all "ERP" letters to white with smooth transparency
      if (min >= 250) {
        pixels[i + 3] = 0; // Transparent background
      } else {
        pixels[i] = 255;
        pixels[i + 1] = 255;
        pixels[i + 2] = 255;

        if (min >= 210) {
          // Smooth alpha transition on edge pixels
          const alphaFactor = (250 - min) / (250 - 210);
          pixels[i + 3] = Math.round(255 * alphaFactor);
        } else {
          pixels[i + 3] = 255; // Solid opaque white core
        }
      }
    } else {
      // Left side: Keep original purple gradients but transparent background
      if (min >= 250) {
        pixels[i + 3] = 0;
      } else if (min >= 210) {
        const alphaFactor = (250 - min) / (250 - 210);
        pixels[i + 3] = Math.round(255 * alphaFactor);
        pixels[i] = Math.round(r * alphaFactor);
        pixels[i + 1] = Math.round(g * alphaFactor);
        pixels[i + 2] = Math.round(b * alphaFactor);
      }
    }
  }
}

await sharp(Buffer.from(pixels.buffer), {
  raw: { width, height, channels },
})
  .png({ compressionLevel: 9 })
  .toFile(OUTPUT);

console.log('✅ ERP text recolored to solid white with perfect boundary at x=665!');
