const sharp = require('sharp');
const pngToIco = require('png-to-ico');
const fs = require('fs');
const path = require('path');

async function main() {
  const svgPath = path.join(__dirname, '..', 'assets', 'icon.svg');
  const pngPath = path.join(__dirname, '..', 'assets', 'icon.png');
  const icoPath = path.join(__dirname, '..', 'assets', 'icon.ico');

  // SVG to PNG (256x256)
  await sharp(svgPath)
    .resize(256, 256)
    .png()
    .toFile(pngPath);
  console.log('Created icon.png');

  // PNG to ICO
  const pngBuffer = fs.readFileSync(pngPath);
  const pngToIcoModule = require('png-to-ico');
  const pngToIcoFn = pngToIcoModule.default || pngToIcoModule;
  const icoBuffer = await pngToIcoFn(pngBuffer);
  fs.writeFileSync(icoPath, icoBuffer);
  console.log('Created icon.ico');
}

main().catch(console.error);
