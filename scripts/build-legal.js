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

function slugHasYoutubeVideos(slug) {
  try {
    const yt = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'youtube-channel.json'), 'utf8'));
    return (yt.videos || []).some((v) => v.slug === slug);
  } catch {
    return false;
  }
}

function rewrite(html, app, filename) {
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

  // Campaign attribution: pages migrated to this domain attribute here, not to the
  // legacy per-app site (which will be retired once the migration completes)
  html = html.split('ct=h53d.github.io').join('ct=apps.h53d.xyz');

  html = html.split('./policy.html').join(`${pageBase}/policy.html`);
  html = html.split('./support.html').join(`${pageBase}/support.html`);
  html = html.split(`${pageBase}/macOS512.png`).join(`${DOMAIN}${icon}`);

  if (html.includes('class="related-links"') && !html.includes('Visit More Apps')) {
    const h53dLink = `                        <a class="related-text-link" href="${DOMAIN}/" target="_blank" rel="noopener noreferrer">
                            <img class="related-link-icon" src="/assets/icon.jpg" alt="" width="22" height="22" aria-hidden="true">
                            <span>Visit More Apps</span>
                        </a>\n`;
    html = html.replace(
      /(<div class="related-links">[\s\S]*?)(\n\s*<\/div>)/,
      `$1${h53dLink}$2`
    );
  }

  if (html.includes('<link rel="stylesheet" href="/legal/docs.css">')) {
    html = html.replace(
      '<link rel="stylesheet" href="/legal/docs.css">',
      `<link rel="stylesheet" href="/legal/docs.css">\n    ${iconStyle}`
    );
  } else {
    html = html.replace('</head>', `    ${iconStyle}\n</head>`);
  }

  if (filename === 'support.html' && !/http-equiv=["']refresh["']/i.test(html)) {
    html = html.replace(/\s*<div class="section-group yt-support"[\s\S]*?H53D_YT\.mountSupport[\s\S]*?<\/script>/gi, '\n');
    html = html.replace(/\s*<div class="yt-support-simple"[\s\S]*?H53D_YT\.mountSupport[\s\S]*?<\/script>/gi, '\n');
    if (!slugHasYoutubeVideos(app.slug)) {
      html = html.replace(/\s*<link rel="stylesheet" href="\/assets\/yt-embed\.css">\s*/gi, '\n');
    } else {
      if (!html.includes('yt-embed.css')) {
        html = html.replace('</head>', '    <link rel="stylesheet" href="/assets/yt-embed.css">\n</head>');
      }
      const slugJson = JSON.stringify(app.slug);
      const legalVideo = `<div class="section-group yt-support" id="video">
            <div class="group-card">
                <section class="group-item">
                    <div id="ytSupport"></div>
                </section>
            </div>
        </div>
        <script src="/assets/yt-embed.js"></script>
        <script>if (window.H53D_YT) H53D_YT.mountSupport(document.getElementById('ytSupport'), ${slugJson});</script>
        `;
      const simpleVideo = `<div class="yt-support-simple" id="video">
        <div id="ytSupport"></div>
        </div>
        <script src="/assets/yt-embed.js"></script>
        <script>if (window.H53D_YT) H53D_YT.mountSupport(document.getElementById('ytSupport'), ${slugJson});</script>
        `;
      const videoMarkup = html.includes('class="page-footer"') ? legalVideo : simpleVideo;
      const footerAt = html.lastIndexOf('<footer');
      if (footerAt !== -1) {
        html = html.slice(0, footerAt) + videoMarkup + html.slice(footerAt);
      } else {
        html = html.replace('</body>', videoMarkup + '</body>');
      }
    }
  }

  return html;
}

function isRedirectStub(html) {
  return /http-equiv=["']refresh["']/i.test(html)
    && html.includes('apps.h53d.xyz/apps/')
    && html.length < 5000;
}

function resolveSourceDir(app) {
  const vendored = path.join(ROOT, 'legal', 'sources', app.slug);
  if (fs.existsSync(path.join(vendored, 'policy.html'))) return vendored;
  return path.join(ROOT, app.source);
}

function writePage(app, filename) {
  const srcDir = resolveSourceDir(app);
  const src = path.join(srcDir, filename);
  if (!fs.existsSync(src)) {
    console.warn(`skip missing ${path.relative(ROOT, src)}`);
    return false;
  }
  const raw = fs.readFileSync(src, 'utf8');
  if (isRedirectStub(raw)) {
    console.warn(`skip redirect stub ${app.source}/${filename}`);
    return false;
  }
  const outDir = path.join(ROOT, 'apps', app.slug);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, filename), rewrite(raw, app, filename));
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadPortfolio() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'apps.json'), 'utf8'));
}

function fillById(html, openTagPattern, inner) {
  return html.replace(openTagPattern, (match) => `${match}${inner}`);
}

function storeLinkOf(app) {
  if (app.links) return app.links.ios || app.links.macos;
  return `https://apps.apple.com/us/app/id${app.id}`;
}

function appSchema(app, canonicalHref) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: app.name,
    operatingSystem: 'iOS, iPadOS, macOS',
    applicationCategory: 'UtilitiesApplication',
    url: canonicalHref,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    description: app.desc,
    author: { '@type': 'Person', name: 'Wei Ai' }
  };
  if (app.links && app.links.policy) schema.privacyPolicy = `${DOMAIN}${app.links.policy}`;
  if (app.links && app.links.support) schema.softwareHelp = `${DOMAIN}${app.links.support}`;
  return schema;
}

let ytData = null;
function videosOf(slug) {
  if (ytData === null) {
    try {
      ytData = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'youtube-channel.json'), 'utf8'));
    } catch (e) {
      ytData = {};
    }
  }
  return (ytData.videos || []).filter((v) => v.slug === slug);
}

// VideoObject entries for the app's matched YouTube videos (landscape first,
// capped so video-heavy apps don't bloat the page head).
function videoSchema(slug) {
  const vids = videosOf(slug);
  if (vids.length === 0) return null;
  const picked = [...vids.filter((v) => !v.short), ...vids.filter((v) => v.short)].slice(0, 8);
  return picked.map((v) => ({
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: v.title,
    description: v.description || v.title,
    thumbnailUrl: v.thumb,
    contentUrl: `https://www.youtube.com/watch?v=${v.id}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${v.id}`
  }));
}

// Bake each app's metadata and visible content into its detail page so
// crawlers that do not execute JavaScript (most AI/LLM crawlers) can read it.
// The runtime JS re-renders the same data from apps.json, so behavior is unchanged.
function prerenderDetail(template, app, ui) {
  const name = app.name;
  const assetBase = `/assets/${encodeURIComponent(name)}`;
  const canonicalHref = `${DOMAIN}/apps/${app.slug}/detail.html`;
  const title = app.promotional ? `${name} — ${app.promotional} | Wei Ai` : `${name} | Wei Ai Portfolio`;
  const metaDesc = `${name}: ${app.desc}. Built with local AI technology.`;
  const ogImage = `${DOMAIN}${assetBase}/${(app.screenshots && app.screenshots[0]) || app.icon}`;
  const storeLink = storeLinkOf(app);
  const badgeSrc = ui.appleIconIOS ? `/assets/${ui.appleIconIOS}` : '';

  let html = template;

  // --- <head> metadata ---
  html = html.split('<title>App Details · Wei Ai Portfolio</title>')
    .join(`<title>${escapeHtml(title)}</title>`);
  html = html.replace(
    /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${escapeHtml(metaDesc)}">`
  );
  html = html.split('content="App Details · Wei Ai"').join(`content="${escapeHtml(name)}"`);
  html = html.replace(
    /<meta property="og:description" content="[^"]*">/,
    `<meta property="og:description" content="${escapeHtml(app.desc)}">`
  );
  html = html.split('content="/assets/social-preview.jpg"').join(`content="${escapeHtml(ogImage)}"`);

  const headExtras = [
    `<meta property="og:url" content="${canonicalHref}">`,
    `<link rel="canonical" href="${canonicalHref}">`,
    `<meta name="apple-itunes-app" content="app-id=${app.id}">`,
    `<link rel="icon" type="image/jpeg" href="${assetBase}/${app.icon}">`,
    `<link rel="apple-touch-icon" href="${assetBase}/${app.icon}">`,
    `<script id="dynamic-schema" type="application/ld+json">${JSON.stringify(appSchema(app, canonicalHref))}</script>`
  ];
  const videos = videoSchema(app.slug);
  if (videos) {
    headExtras.push(`<script id="video-schema" type="application/ld+json">${JSON.stringify(videos)}</script>`);
  }
  html = html.replace(/(<meta name="twitter:image"[^>]*>)/, `$1\n  ${headExtras.join('\n  ')}`);

  // --- visible content (runtime JS overwrites these nodes with the same data) ---
  html = fillById(html, /<h1 id="detailTitle"[^>]*>/, escapeHtml(name));
  html = fillById(html, /<p id="detailDesc"[^>]*>/, escapeHtml(app.desc));
  html = fillById(html, /<div id="detailPromo"[^>]*>/, escapeHtml(app.promotional || 'FEATURED'));
  html = fillById(
    html,
    /<div id="detailIcon"[^>]*>/,
    `<img src="${assetBase}/${app.icon}" class="w-full h-full object-cover" alt="${escapeHtml(name)}">`
  );

  html = html.split('id="detailLink" href="#"').join(`id="detailLink" href="${storeLink}"`);
  html = html.split('id="appStoreLink" href="#"').join(`id="appStoreLink" href="${storeLink}"`);
  if (badgeSrc) {
    html = html.split('id="appleBadgeIcon" src=""').join(`id="appleBadgeIcon" src="${badgeSrc}"`);
  }
  if (app.links && (app.links.policy || app.links.support)) {
    html = html.split('id="legalLinks" class="hidden flex').join('id="legalLinks" class="flex');
    if (app.links.policy) html = html.split('id="policyLink" href="#"').join(`id="policyLink" href="${app.links.policy}"`);
    if (app.links.support) html = html.split('id="supportLink" href="#"').join(`id="supportLink" href="${app.links.support}"`);
  }

  if (app.knowledge && app.knowledge.title) {
    html = fillById(html, /<h2 id="knowledgeTitle"[^>]*>/, escapeHtml(app.knowledge.title));
    html = fillById(html, /<p id="knowledgeContent"[^>]*>/, escapeHtml(app.knowledge.content));
  }

  if (app.features && app.features.length > 0) {
    const cards = app.features.map((feat) => `
                        <div class="feature-card flex gap-3 items-start">
                            <div class="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
                            </div>
                            <span class="text-sm text-slate-700 leading-relaxed">${escapeHtml(feat)}</span>
                        </div>`).join('');
    html = fillById(html, /<div id="featureGrid"[^>]*>/, cards);
  }

  if (app.audience && app.audience.length > 0) {
    const tags = app.audience
      .map((tag) => `<span class="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs text-slate-600 font-medium">${escapeHtml(tag)}</span>`)
      .join('');
    html = fillById(html, /<div id="audienceContainer"[^>]*>/, tags);
  }

  if (app.screenshots && app.screenshots.length > 0) {
    html = fillById(
      html,
      /<div id="sliderContainer"[^>]*>/,
      `<img src="${assetBase}/${app.screenshots[0]}" alt="${escapeHtml(name)} screenshot" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:15;">`
    );
  }

  return html;
}

function writeDetailPages() {
  const template = fs.readFileSync(path.join(ROOT, 'detail.html'), 'utf8');
  const portfolio = loadPortfolio();
  const ui = portfolio.ui || {};
  for (const app of registry.apps) {
    if (!app.listed) continue;
    const data = portfolio.apps.find((item) => item.id === app.id);
    const outDir = path.join(ROOT, 'apps', app.slug);
    fs.mkdirSync(outDir, { recursive: true });
    const html = data ? prerenderDetail(template, data, ui) : template;
    if (!data) console.warn(`detail data miss ${app.name}`);
    fs.writeFileSync(path.join(outDir, 'detail.html'), html);
  }
}

// Bake the hero copy, the app-card grid, and an ItemList schema into index.html.
// Idempotent: content lives between PRERENDER markers / inside id-anchored tags,
// and the runtime JS replaces the static cards before rebuilding the grid.
function prerenderIndex() {
  const indexPath = path.join(ROOT, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  const portfolio = loadPortfolio();
  const ui = portfolio.ui || {};
  const hero = portfolio.hero || {};

  if (hero.title) {
    html = html.replace(/(<h2 id="heroTitle"[^>]*>)[\s\S]*?(<\/h2>)/, `$1${hero.title}$2`);
  }
  if (hero.subtitle) {
    html = html.replace(/(<p id="heroDesc"[^>]*>)[\s\S]*?(<\/p>)/, `$1${escapeHtml(hero.subtitle)}$2`);
  }

  const cards = portfolio.apps.map((app) => {
    const iconPath = app.icon ? `assets/${encodeURIComponent(app.name)}/${app.icon}` : null;
    const fallbackText = app.name ? app.name.substring(0, 2).toUpperCase() : 'AP';
    let iconLayer = `<div class="absolute inset-0 flex items-center justify-center z-0"><span class="text-slate-300 font-mono font-bold text-2xl select-none">${escapeHtml(fallbackText)}</span></div>`;
    if (iconPath) iconLayer += `<img src="${iconPath}" alt="${escapeHtml(app.name)}" class="absolute inset-0 w-full h-full object-cover z-10 bg-white transition-transform duration-500 group-hover:scale-110" onerror="this.style.display='none'">`;
    const promoBadge = app.promotional ? `<span class="mb-2 inline-block px-2 py-0.5 rounded-md text-[10px] font-bold font-mono uppercase tracking-wider bg-blue-100 text-blue-600 border border-blue-200">${escapeHtml(app.promotional)}</span>` : '';
    const appleImg = ui.appleIconIOS
      ? `<img src="assets/${ui.appleIconIOS}" class="h-8 w-auto object-contain select-none" alt="App Store">`
      : '<span class="text-[10px] font-bold bg-black text-white px-2 py-1 rounded">GET</span>';
    return `
                <div class="holo-card p-6 flex gap-6 items-start cursor-pointer mb-5 group">
                  <div class="app-icon group-hover:shadow-lg group-hover:shadow-blue-500/20 transition-shadow duration-300">${iconLayer}</div>
                  <div class="flex-1 min-w-0">
                    ${promoBadge}
                    <div class="flex justify-between items-start">
                      <h4 class="text-xl font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">${escapeHtml(app.name)}</h4>
                    </div>
                    <p class="text-sm text-slate-500 mt-2 line-clamp-2 mb-5 leading-relaxed font-light">${escapeHtml(app.desc)}</p>
                    <div class="flex gap-3 items-center flex-wrap">
                      <a href="${storeLinkOf(app)}" title="Download on the App Store" class="hover:opacity-70 transition-opacity transform active:scale-95">${appleImg}</a>
                      <a href="/apps/${app.slug}/detail.html" class="detail-link px-3 py-1.5 rounded-full border border-blue-100 text-blue-500 text-[10px] font-bold font-mono hover:bg-blue-50 transition flex items-center gap-1 group/btn bg-white/50">DETAILS <svg class="w-3 h-3 transform group-hover/btn:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></a>
                    </div>
                  </div>
                </div>`;
  }).join('');

  html = html.replace(
    /(<!-- PRERENDER:APPS:BEGIN[^>]*-->)[\s\S]*?(<!-- PRERENDER:APPS:END -->)/,
    `$1${cards}\n                $2`
  );

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: portfolio.apps.map((app, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${DOMAIN}/apps/${app.slug}/detail.html`,
      name: app.name
    }))
  };
  html = html.replace(
    /(<script type="application\/ld\+json" id="apps-itemlist">)[\s\S]*?(<\/script>)/,
    `$1\n  ${JSON.stringify(itemList)}\n  $2`
  );

  fs.writeFileSync(indexPath, html);
}

// llms.txt: a plain-markdown site summary for generative engines (GEO).
// Content is derived 1:1 from apps.json — nothing new is authored here.
function writeLlmsTxt() {
  const portfolio = loadPortfolio();
  const hero = portfolio.hero || {};
  const lines = [
    '# Wei Ai · H53D — Privacy-First Apple Apps',
    '',
    `> ${(hero.subtitle || 'A collection of utility tools built with SwiftUI & CoreML.').replace(/<[^>]+>/g, ' ')} All apps process data on device — no ads, no tracking, no uploads.`,
    '',
    `Site: ${DOMAIN}/`,
    '',
    '## Apps'
  ];
  for (const app of portfolio.apps) {
    lines.push('');
    lines.push(`### ${app.name}`);
    lines.push(`- Detail: ${DOMAIN}/apps/${app.slug}/detail.html`);
    lines.push(`- App Store: ${storeLinkOf(app)}`);
    if (app.links && app.links.policy) lines.push(`- Privacy policy: ${DOMAIN}${app.links.policy}`);
    if (app.links && app.links.support) lines.push(`- Support: ${DOMAIN}${app.links.support}`);
    lines.push(`- ${app.desc}`);
    if (app.knowledge && app.knowledge.content) lines.push(`- Background: ${app.knowledge.content}`);
  }
  lines.push('');
  lines.push('## Other pages');
  lines.push(`- Sitemap: ${DOMAIN}/sitemap.xml`);
  lines.push('');
  fs.writeFileSync(path.join(ROOT, 'llms.txt'), lines.join('\n'));
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

const only = process.env.LEGAL_ONLY
  ? new Set(process.env.LEGAL_ONLY.split(',').map((s) => s.trim()).filter(Boolean))
  : null;

let written = 0;
for (const app of registry.apps) {
  if (only && !only.has(app.slug)) continue;
  const policy = writePage(app, 'policy.html');
  const support = writePage(app, 'support.html');
  copyExtras(app);
  if (policy && support) {
    written += 1;
    console.log(`built ${app.slug}`);
  }
}
if (!only) {
  patchPortfolio();
  writeSlugMap();
  writeDetailPages();
  prerenderIndex();
  writeLlmsTxt();
}
console.log(`done: ${written}/${only ? only.size : registry.apps.length} apps`);
