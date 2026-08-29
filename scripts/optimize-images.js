#!/usr/bin/env node
// Generate WebP variants sized for how the site actually renders them.
// Originals are left untouched; pages reference the .webp with a jpg fallback.
//   icon.jpg   -> icon.webp   (256px: 2x the 120px detail icon)
//   screen*.jpg -> screen*.webp (640px wide: 2x the 280px phone mock)

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function widthOf(file) {
  try {
    return parseInt(execFileSync('magick', ['identify', '-format', '%w', file]).toString(), 10);
  } catch (e) {
    return 0;
  }
}

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const TARGETS = [
  { match: /^icon\.(jpg|jpeg|png)$/i, size: 256, quality: 82 },
  { match: /^screen\d*\.(jpg|jpeg|png)$/i, size: 640, quality: 80 }
];

let made = 0, skipped = 0, savedBytes = 0;

for (const dir of fs.readdirSync(ASSETS)) {
  const full = path.join(ASSETS, dir);
  if (!fs.statSync(full).isDirectory()) continue;
  for (const file of fs.readdirSync(full)) {
    const target = TARGETS.find((t) => t.match.test(file));
    if (!target) continue;
    const src = path.join(full, file);
    const out = path.join(full, file.replace(/\.(jpg|jpeg|png)$/i, '.webp'));
    if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs) {
      skipped += 1;
      continue;
    }
    // never upscale: some icons ship at 128px
    const width = Math.min(target.size, widthOf(src) || target.size);
    execFileSync('cwebp', ['-quiet', '-q', String(target.quality), '-resize', String(width), '0', src, '-o', out]);
    savedBytes += fs.statSync(src).size - fs.statSync(out).size;
    made += 1;
  }
}

console.log(`webp: ${made} generated, ${skipped} up to date, ~${Math.round(savedBytes / 1024)} KB saved`);
