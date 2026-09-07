const sharp = require('sharp');
const fs = require('fs');

async function run() {
  const meta = await sharp('public/logo.jpg').metadata();
  console.log('Logo dimensions:', meta.width, meta.height);

  // In logo.jpg, the emblem center is around (512, 360) with radius approx 270
  // Let's extract the emblem cleanly
  const left = 220;
  const top = 100;
  const size = 560;

  const circleSvg = `<svg width="${size}" height="${size}">
    <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="#ffffff"/>
  </svg>`;

  await sharp('public/logo.jpg')
    .extract({ left, top, width: size, height: size })
    .composite([{ input: Buffer.from(circleSvg), blend: 'dest-in' }])
    .png()
    .toFile('public/emblem.png');

  fs.copyFileSync('public/emblem.png', 'src/assets/emblem.png');
  fs.copyFileSync('public/logo.jpg', 'src/assets/logo.jpg');
  fs.copyFileSync('public/logo_horizontal.png', 'src/assets/logo_horizontal.png');
  fs.copyFileSync('public/logo_icon.png', 'src/assets/logo_icon.png');

  console.log('Successfully generated emblem.png and copied all assets.');
}

run().catch(console.error);
