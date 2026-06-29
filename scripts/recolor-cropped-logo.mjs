import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const INPUT = 'C:\\Users\\DELL\\.gemini\\antigravity-ide\\brain\\f10d4557-e32a-4f76-a5da-4ad1aae728f7\\media__1782660054322.png';
const OUTPUT = path.join(__dirname, '..', 'public', 'bella-erp-logo.png');

const { data, info } = await sharp(INPUT)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;
const pixels = new Uint8ClampedArray(data);

// Transparent column gaps detected (from pixel scan):
// [0,45] left margin | [196,239] butterfly↔B | [356,364] B↔e | [448,453] e↔l
// [659,676] a↔E  ← separator here  | [764,783] E↔R | [882,898] R↔P | [993,1023] right
const SEPARATOR_X = 659; // start of gap between 'a' and 'E'

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * channels;
    const a = pixels[i + 3];

    // Only process opaque/semi-opaque pixels (skip fully transparent ones)
    if (a === 0) continue;

    if (x >= SEPARATOR_X) {
      // Recolor ERP text to white while preserving existing alpha
      pixels[i]     = 255; // R
      pixels[i + 1] = 255; // G
      pixels[i + 2] = 255; // B
    }
  }
}

await sharp(Buffer.from(pixels.buffer), {
  raw: { width, height, channels },
})
  .png({ compressionLevel: 9 })
  .toFile(OUTPUT);

console.log(`✅ Logo saved: ${OUTPUT}`);
console.log(`   Separator at x=${SEPARATOR_X}  |  'a' ends 763, 'E' starts 784`);
