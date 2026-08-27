#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const registry = require('../legal/registry.json');
const DOMAIN = registry.domain;
const BADGE_IOS = '/assets/Download_on_the_App_Store_Badge_US-UK_RGB_blk_092917.svg';
const BADGE_MAC = '/assets/Download_on_the_Mac_App_Store_Badge_US-UK_RGB_blk_092917.svg';

function iconUrl(app) {
  return `/assets/${encodeURIComponent(app.assetDir)}/${app.icon}`;
}

function rewrite(html, app) {
  const icon = iconUrl(app);
  const pageBase = `${DOMAIN}/apps/${app.slug}`;
  const iconStyle = `<style>:root { --app-icon: url("${icon}"); }</style>`;

  html = html.split('./lite3d.css').join('/legal/docs.css');
  html = html.split('./fs.css').join('/legal/docs.css');
  html = html.split('./macOS512.png').join(icon);
  html = html.split('./icon64.png').join(icon);
  html = html.split('./logo512.jpg').join(icon);
  html = html.split('./h53d.jpg').join('/assets/icon.jpg');
  html = html.split('./Download_on_the_App_Store_Badge.svg').join(BADGE_IOS);
  html = html.split('./images/Download_on_the_App_Store_Badge_US-UK_RGB_blk_092917.svg').join(BADGE_IOS);
  html = html.split('./images/Download_on_the_Mac_App_Store_Badge_US-UK_RGB_blk_092917.svg').join(BADGE_MAC);
  html = html.split('./images/eTableCollector64.png').join(icon);
  html = html.split('./images/eTableCollectorQR.jpeg').join('./eTableCollectorQR.jpeg');

  if (app.legacyBase) {
    const legacy = app.legacyBase.replace(/\/$/, '');
    html = html.split(`${legacy}/`).join(`${pageBase}/`);
    html = html.split(`${legacy}"`).join(`${pageBase}"`);
  }

  html = html.split('./policy.html').join(`${pageBase}/policy.html`);
  html = html.split('./support.html').join(`${pageBase}/support.html`);
  html = html.split(`${pageBase}/macOS512.png`).join(`${DOMAIN}${icon}`);

  if (html.includes('<link rel="stylesheet" href="/legal/docs.css">')) {
    html = html.replace(
      '<link rel="stylesheet" href="/legal/docs.css">',
      `<link rel="stylesheet" href="/legal/docs.css">\n    ${iconStyle}`
    );
  } else {
    html = html.replace('</head>', `    ${iconStyle}\n</head>`);
  }

  return html;
}

function writePage(app, filename) {
  const src = path.join(ROOT, app.source, filename);
  if (!fs.existsSync(src)) {
    console.warn(`skip missing ${app.source}/${filename}`);
    return false;
  }
  const outDir = path.join(ROOT, 'apps', app.slug);
  fs.mkdirSync(outDir, { recursive: true });
  const html = rewrite(fs.readFileSync(src, 'utf8'), app);
  fs.writeFileSync(path.join(outDir, filename), html);
  return true;
}

function writeSlugMap() {
  const map = {};
  for (const app of registry.apps) {
    if (app.id && app.slug && app.listed !== false) map[app.id] = app.slug;
  }
  const body = `window.SLUG_BY_ID = ${JSON.stringify(map, null, 2)};\n`;
  fs.writeFileSync(path.join(ROOT, 'legal', 'slugs.js'), body);
}

function writeDetailPages() {
  const src = path.join(ROOT, 'detail.html');
  const html = fs.readFileSync(src, 'utf8');
  for (const app of registry.apps) {
    if (!app.listed) continue;
    const outDir = path.join(ROOT, 'apps', app.slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'detail.html'), html);
  }
}

function copyExtras(app) {
  const qrSrc = path.join(ROOT, app.source, 'images', 'eTableCollectorQR.jpeg');
  if (fs.existsSync(qrSrc)) {
    const dest = path.join(ROOT, 'apps', app.slug, 'eTableCollectorQR.jpeg');
    fs.copyFileSync(qrSrc, dest);
  }
}

function patchPortfolio() {
  const appsPath = path.join(ROOT, 'assets', 'apps.json');
  const data = JSON.parse(fs.readFileSync(appsPath, 'utf8'));
  for (const legalApp of registry.apps) {
    if (!legalApp.listed) continue;
    const app = data.apps.find((item) => item.id === legalApp.id);
    if (!app) {
      console.warn(`portfolio miss ${legalApp.name}`);
      continue;
    }
    app.slug = legalApp.slug;
    app.links = app.links || {};
    app.links.policy = `/apps/${legalApp.slug}/policy.html`;
    app.links.support = `/apps/${legalApp.slug}/support.html`;
    app.links.detail = `/apps/${legalApp.slug}/detail.html`;
  }
  fs.writeFileSync(appsPath, `${JSON.stringify(data, null, 2)}\n`);
}

let written = 0;
for (const app of registry.apps) {
  const policy = writePage(app, 'policy.html');
  const support = writePage(app, 'support.html');
  copyExtras(app);
  if (policy && support) {
    written += 1;
    console.log(`built ${app.slug}`);
  }
}
patchPortfolio();
writeSlugMap();
writeDetailPages();
console.log(`done: ${written}/${registry.apps.length} apps`);
