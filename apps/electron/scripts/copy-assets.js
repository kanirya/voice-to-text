const fs = require('fs');
const path = require('path');

const copies = [
  ['src/renderer/widget/widget.html', 'build/renderer/widget/widget.html'],
  ['src/renderer/onboarding/onboarding.html', 'build/renderer/onboarding/onboarding.html'],
  ['src/renderer/settings/settings.html', 'build/renderer/settings/settings.html'],
  ['src/renderer/recorder/recorder.html', 'build/renderer/recorder/recorder.html'],
  ['src/renderer/audio/vad-processor.js', 'build/renderer/audio/vad-processor.js'],
];

for (const [src, dest] of copies) {
  const destDir = path.dirname(dest);
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
}

console.log('Assets copied to build/');
