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

  // Link legal pages back into the site so they are not near-orphans
  if (!html.includes('id="appBacklink"')) {
    const backlink = `<p id="appBacklink" style="max-width:820px;margin:1.5rem auto 2rem;padding:0 1.25rem;text-align:center;font-size:0.9rem;">
      <a href="${pageBase}/detail.html">${app.name} — features, screenshots, and download</a>
      &nbsp;·&nbsp;
      <a href="${DOMAIN}/">All apps by Wei Ai</a>
    </p>
    `;
    const footerAt = html.lastIndexOf('<footer');
    if (footerAt !== -1) {
      html = html.slice(0, footerAt) + backlink + html.slice(footerAt);
    } else {
      html = html.replace('</body>', backlink + '</body>');
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

function webpOf(p) {
  return String(p).replace(/\.(jpg|jpeg|png)$/i, '.webp');
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

let faqData = null;
function faqsOf(slug) {
  if (faqData === null) {
    try {
      faqData = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'faqs.json'), 'utf8'));
    } catch (e) {
      faqData = {};
    }
  }
  return Array.isArray(faqData[slug]) ? faqData[slug] : [];
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
  return picked.map((v) => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: v.title,
      description: v.description || v.title,
      thumbnailUrl: v.thumb,
      contentUrl: `https://www.youtube.com/watch?v=${v.id}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${v.id}`
    };
    if (v.uploadDate) schema.uploadDate = v.uploadDate;
    return schema;
  });
}

// Bake each app's metadata and visible content into its detail page so
// crawlers that do not execute JavaScript (most AI/LLM crawlers) can read it.
// The runtime JS re-renders the same data from apps.json, so behavior is unchanged.
function prerenderDetail(template, app, ui, allApps) {
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
    `<script id="dynamic-schema" type="application/ld+json">${JSON.stringify(appSchema(app, canonicalHref))}</script>`,
    `<script id="breadcrumb-schema" type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Apps by Wei Ai', item: `${DOMAIN}/` },
        { '@type': 'ListItem', position: 2, name, item: canonicalHref }
      ]
    })}</script>`
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
    `<picture><source srcset="${webpOf(assetBase + '/' + app.icon)}" type="image/webp"><img src="${assetBase}/${app.icon}" class="w-full h-full object-cover" width="120" height="120" alt="${escapeHtml(name)}"></picture>`
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

  html = fillById(html, /<li id="crumbName"[^>]*>/, escapeHtml(name));

  // Visible FAQ (required for FAQPage markup) plus the matching schema
  const faqs = faqsOf(app.slug);
  if (faqs.length) {
    const items = faqs.map((entry) => `
                        <details class="feature-card" open>
                            <summary class="text-sm font-bold text-slate-700 cursor-pointer">${escapeHtml(entry.q)}</summary>
                            <p class="text-sm text-slate-600 leading-relaxed mt-2">${escapeHtml(entry.a)}</p>
                        </details>`).join('');
    html = fillById(html, /<div id="faqList"[^>]*>/, items);
    html = html.replace('<div id="faqSection" hidden>', '<div id="faqSection">');
    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((entry) => ({
        '@type': 'Question',
        name: entry.q,
        acceptedAnswer: { '@type': 'Answer', text: entry.a }
      }))
    };
    html = html.replace(
      '<script id="breadcrumb-schema"',
      `<script id="faq-schema" type="application/ld+json">${JSON.stringify(faqSchema)}</script>\n  <script id="breadcrumb-schema"`
    );
  }

  // Cross-link sibling apps so every detail page is reachable from any other
  const siblings = (allApps || [])
    .filter((other) => other.slug && other.slug !== app.slug)
    .map((other) => `<a href="/apps/${other.slug}/detail.html" class="px-3 py-1.5 rounded-full border border-slate-200 bg-white/60 text-xs text-slate-600 font-medium hover:border-blue-300 hover:text-blue-600 transition">${escapeHtml(other.name)}</a>`)
    .join('');
  if (siblings) html = fillById(html, /<div id="relatedApps"[^>]*>/, siblings);

  if (app.screenshots && app.screenshots.length > 0) {
    html = fillById(
      html,
      /<div id="sliderContainer"[^>]*>/,
      `<picture><source srcset="${webpOf(assetBase + '/' + app.screenshots[0])}" type="image/webp"><img src="${assetBase}/${app.screenshots[0]}" alt="${escapeHtml(name)} screenshot" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:15;"></picture>`
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
    const html = data ? prerenderDetail(template, data, ui, portfolio.apps) : template;
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
    let iconLayer = `<div class="absolute inset-0 flex items-center justify-center z-0"><span class="text-slate-500 font-mono font-bold text-2xl select-none">${escapeHtml(fallbackText)}</span></div>`;
    if (iconPath) iconLayer += `<picture><source srcset="${webpOf(iconPath)}" type="image/webp"><img src="${iconPath}" alt="${escapeHtml(app.name)}" width="80" height="80" class="absolute inset-0 w-full h-full object-cover z-10 bg-white transition-transform duration-500 group-hover:scale-110"></picture>`;
    const promoBadge = app.promotional ? `<span class="mb-2 inline-block px-2 py-0.5 rounded-md text-[10px] font-bold font-mono uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200">${escapeHtml(app.promotional)}</span>` : '';
    const appleImg = ui.appleIconIOS
      ? `<img src="assets/${ui.appleIconIOS}" width="120" height="40" class="h-8 w-auto object-contain select-none" alt="App Store">`
      : '<span class="text-[10px] font-bold bg-black text-white px-2 py-1 rounded">GET</span>';
    return `
                <div class="holo-card p-6 flex gap-6 items-start cursor-pointer mb-5 group">
                  <div class="app-icon group-hover:shadow-lg group-hover:shadow-blue-500/20 transition-shadow duration-300">${iconLayer}</div>
                  <div class="flex-1 min-w-0">
                    ${promoBadge}
                    <div class="flex justify-between items-start">
                      <h4 class="text-xl font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors"><a href="/apps/${app.slug}/detail.html" class="detail-link" title="${escapeHtml(app.name)} — features, screenshots, and download">${escapeHtml(app.name)}</a></h4>
                    </div>
                    <p class="text-sm text-slate-500 mt-2 line-clamp-2 mb-5 leading-relaxed font-light">${escapeHtml(app.desc)}</p>
                    <div class="flex gap-3 items-center flex-wrap">
                      <a href="${storeLinkOf(app)}" title="Download on the App Store" class="hover:opacity-70 transition-opacity transform active:scale-95">${appleImg}</a>
                      <a href="/apps/${app.slug}/detail.html" class="detail-link px-3 py-1.5 rounded-full border border-blue-100 text-blue-700 text-[10px] font-bold font-mono hover:bg-blue-50 transition flex items-center gap-1 group/btn bg-white/50">DETAILS <svg class="w-3 h-3 transform group-hover/btn:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></a>
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

// GitHub Pages serves /404.html for unknown paths. Keep it useful: the full
// app list doubles as internal links back into the site.
function writeNotFound() {
  const portfolio = loadPortfolio();
  const links = portfolio.apps
    .map((app) => `      <li><a href="/apps/${app.slug}/detail.html">${escapeHtml(app.name)}</a><span> — ${escapeHtml(app.promotional || '')}</span></li>`)
    .join('\n');
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Page not found · Wei Ai · H53D</title>
  <meta name="description" content="This page could not be found. Browse the privacy-first Apple apps by Wei Ai instead.">
  <link rel="icon" type="image/jpeg" href="/assets/favicon.jpg">
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Arial, sans-serif;
      background: #f8fafc; color: #1e293b; line-height: 1.7;
      min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem 1.25rem;
    }
    main { max-width: 720px; width: 100%; }
    .code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.75rem; letter-spacing: 0.2em; color: #3b82f6; }
    h1 { font-size: 2rem; font-weight: 800; margin: 0.35rem 0 0.75rem; letter-spacing: -0.02em; }
    p { color: #475569; }
    .panel { background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 2rem; box-shadow: 0 10px 30px -20px rgba(15, 23, 42, 0.4); }
    ul { list-style: none; margin-top: 1.25rem; display: grid; gap: 0.4rem; }
    li a { color: #2563eb; text-decoration: none; font-weight: 600; }
    li a:hover { text-decoration: underline; }
    li span { color: #94a3b8; font-size: 0.85rem; }
    .home { display: inline-block; margin-top: 1.5rem; padding: 0.5rem 1.1rem; border-radius: 999px; border: 1px solid #bfdbfe; color: #2563eb; text-decoration: none; font-weight: 600; font-size: 0.9rem; }
    .home:hover { background: #eff6ff; }
  </style>
</head>
<body>
  <main class="panel">
    <div class="code">ERROR 404</div>
    <h1>This page could not be found</h1>
    <p>The link may be outdated, or the page may have moved. Every app below is still here:</p>
    <ul>
${links}
    </ul>
    <a class="home" href="/">← Back to all apps</a>
  </main>
</body>
</html>
`;
  fs.writeFileSync(path.join(ROOT, '404.html'), html);
}

// llms.txt following the llmstxt.org structure: H1, blockquote summary,
// optional notes, then H2 sections holding markdown link lists only.
// Content is derived 1:1 from apps.json — nothing new is authored here.
function writeLlmsTxt() {
  const portfolio = loadPortfolio();
  const hero = portfolio.hero || {};
  const summary = `${(hero.subtitle || 'A collection of utility tools built with SwiftUI & CoreML.').replace(/<[^>]+>/g, ' ')} Every app runs on device: no ads, no tracking, no file uploads.`;
  const oneLine = (app) => {
    const promo = app.promotional ? `${app.promotional.replace(/[\s.·]+$/, '')} — ` : '';
    const first = String(app.desc || '').split(/(?<=\.)\s/)[0];
    return `${promo}${first}`.replace(/\s+/g, ' ').trim();
  };

  const lines = [
    '# Wei Ai · H53D',
    '',
    `> ${summary}`,
    '',
    'Notes:',
    '',
    '- The apps cover two areas: CAD and 3D (STEP, IGES, JT, DXF, STL and other mesh formats) and on-device AI tools for images and spreadsheets.',
    '- Every app has a detail page, a privacy policy, and a support page on this site; the App Store links below are the official listings.',
    '- These pages replace the older per-app sites on h53d.github.io, which now redirect here.',
    '',
    '## Apps',
    ''
  ];
  for (const app of portfolio.apps) {
    lines.push(`- [${app.name}](${DOMAIN}/apps/${app.slug}/detail.html): ${oneLine(app)}`);
  }

  lines.push('');
  lines.push('## App Store listings');
  lines.push('');
  for (const app of portfolio.apps) {
    lines.push(`- [${app.name} on the App Store](${storeLinkOf(app)}): Official listing for iPhone, iPad, and Mac where available.`);
  }

  lines.push('');
  lines.push('## Optional');
  lines.push('');
  for (const app of portfolio.apps) {
    if (app.links && app.links.policy) {
      lines.push(`- [${app.name} privacy policy](${DOMAIN}${app.links.policy}): How ${app.name} handles files and data on device.`);
    }
    if (app.links && app.links.support) {
      lines.push(`- [${app.name} support](${DOMAIN}${app.links.support}): Supported formats, usage notes, and troubleshooting.`);
    }
  }
  lines.push(`- [Sitemap](${DOMAIN}/sitemap.xml): Every indexable page on this site.`);
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
  writeNotFound();
  writeLlmsTxt();
}
console.log(`done: ${written}/${only ? only.size : registry.apps.length} apps`);
