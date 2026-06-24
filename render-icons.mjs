import sharp from 'sharp';
const jobs = [
  ['assets/logo.svg', 'assets/logo-1024.png', 1024, 1024],
  ['assets/logo.svg', 'assets/logo-512.png', 512, 512],
  ['assets/logo.svg', 'assets/logo-128.png', 128, 128],
  ['assets/logo.svg', 'assets/logo-32.png', 32, 32],
  ['assets/wordmark.svg', 'assets/wordmark.png', 1180, 360],
];
for (const [src, out, w, h] of jobs) {
  await sharp(src, { density: 384 }).resize(w, h).png().toFile(out);
  console.log('wrote', out);
}
