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

  // Whiteness score: how close is the pixel to (255, 255, 255)
  // We can use the minimum of the three channels as the amount of "white" in the pixel.
  const w = Math.min(r, g, b);

  if (w > 150) {
    // Smooth transition from w=150 (opaque) to w=255 (fully transparent)
    const t = (w - 150) / (255 - 150);
    const alpha = Math.round(255 * (1 - t));
    pixels[i + 3] = alpha;

    // To prevent white halos at the edges, we replace the background color component
    // with the foreground color. Since the background is white, we pull the RGB values
    // down to prevent them from staying white under low alpha.
    const ratio = alpha / 255;
    pixels[i] = Math.round(r * ratio);
    pixels[i + 1] = Math.round(g * ratio);
    pixels[i + 2] = Math.round(b * ratio);
  }
}

await sharp(Buffer.from(pixels.buffer), {
  raw: { width, height, channels },
})
  .png({ compressionLevel: 9 })
  .toFile(OUTPUT);

console.log(`✅ Antialiased logo saved to: ${OUTPUT}`);
