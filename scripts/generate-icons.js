import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceIcon = path.resolve(__dirname, '../public/logo_icon.png');
const resDir = path.resolve(__dirname, '../android/app/src/main/res');

const sizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

async function generate() {
  if (!fs.existsSync(sourceIcon)) {
    console.error('Source icon not found:', sourceIcon);
    return;
  }

  for (const [folder, size] of Object.entries(sizes)) {
    const targetDir = path.join(resDir, folder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Standard launcher icon
    await sharp(sourceIcon)
      .resize(size, size)
      .toFile(path.join(targetDir, 'ic_launcher.png'));

    // Round launcher icon
    await sharp(sourceIcon)
      .resize(size, size)
      .toFile(path.join(targetDir, 'ic_launcher_round.png'));

    // Foreground icon
    await sharp(sourceIcon)
      .resize(Math.round(size * 0.75), Math.round(size * 0.75))
      .extend({
        top: Math.round(size * 0.125),
        bottom: Math.round(size * 0.125),
        left: Math.round(size * 0.125),
        right: Math.round(size * 0.125),
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));

    console.log(`Generated icons for ${folder} (${size}x${size})`);
  }
}

generate().catch(console.error);
