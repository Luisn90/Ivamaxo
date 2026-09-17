// IVAMAXO — utilidades SEO compartidas por las funciones de Vercel.
// Todo el HTML público se sirve con metadatos ya escritos en el servidor,
// así Google, WhatsApp e Instagram leen título, descripción y datos
// estructurados sin tener que ejecutar JavaScript.

const fs = require('fs');
const path = require('path');

const SITE = 'https://ivamaxo.com';
const SB_URL = 'https://gpvugjjjbypjposqvdmo.supabase.co';
const SB_KEY = 'sb_publishable_JZAJIHL36EvC9Frwgqid_g_k9NwpUal'; // clave pública (RLS protege)
const PHONE = '+584127449626';
const OG_IMAGE = SITE + '/og-image.jpg';

const templates = {};
function template(file) {
  if (!templates[file]) {
    templates[file] = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
  }
  return templates[file];
}

async function sb(pathAndQuery, opts = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${pathAndQuery}`, {
    method: opts.method || 'GET',
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.count ? { Prefer: 'count=exact' } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  const data = await r.json();
  if (opts.count) {
    const cr = r.headers.get('content-range') || '';
    return { data, count: parseInt(cr.split('/')[1], 10) || 0 };
  }
  return data;
}
const rpc = (fn, body) => sb(`rpc/${fn}`, { method: 'POST', body });

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function clip(s, n) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  if (s.length <= n) return s;
  const cut = s.slice(0, n - 1);
  return cut.slice(0, cut.lastIndexOf(' ') > n * 0.6 ? cut.lastIndexOf(' ') : cut.length).replace(/[\s,.;:–—-]+$/, '') + '…';
}

const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

// Negocio: solo datos reales (sin dirección de calle ni valoraciones inventadas)
const STORE = {
  '@type': 'AutoPartsStore',
  '@id': SITE + '/#tienda',
  name: 'IVAMAXO Repuestos',
  url: SITE + '/',
  logo: SITE + '/icons/icon-512.png',
  image: OG_IMAGE,
  telephone: PHONE,
  priceRange: '$',
  currenciesAccepted: 'USD',
  address: { '@type': 'PostalAddress', addressRegion: 'Carabobo', addressCountry: 'VE' },
  areaServed: { '@type': 'State', name: 'Carabobo' },
  contactPoint: { '@type': 'ContactPoint', telephone: PHONE, contactType: 'sales', availableLanguage: 'es', contactOption: 'WhatsApp' },
  sameAs: ['https://wa.me/584127449626'],
};

/**
 * Sustituye el <title> y mete en el <head> las etiquetas SEO.
 * Añade <base href="/"> para que las rutas relativas (favicon.png, sw.js…)
 * funcionen también desde /repuesto/... y /categoria/...
 */
function injectHead(html, { title, description, canonical, robots = 'index, follow, max-image-preview:large', ogType = 'website', image = OG_IMAGE, extra = '' }) {
  const head = `
<base href="/">
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${robots}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:site_name" content="IVAMAXO Repuestos">
<meta property="og:locale" content="es_VE">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<meta name="theme-color" content="#F9C200">
${extra}`;
  return html
    // quita metadatos estáticos de la plantilla para no duplicarlos
    .replace(/<!-- SEO:START -->[\s\S]*?<!-- SEO:END -->/, '')
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta charset="UTF-8">/i, (m) => m + head)
    .replace(/href="#" class="nav-link">Ofertas/g, 'href="tienda.html?sale=1" class="nav-link">Ofertas');
}

function send(res, status, html, maxAge = 3600) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // CDN de Vercel: sirve rápido y revalida en segundo plano
  res.setHeader('Cache-Control', status === 200 ? `public, s-maxage=${maxAge}, stale-while-revalidate=86400` : 'public, s-maxage=300');
  res.end(html);
}

// Nombres de modelo tal como los escribe la gente (el parser los guarda "Crv", "Bt50"…)
const MODEL_LABEL = { crv: 'CR-V', fj: 'FJ Cruiser', rav4: 'RAV4', bt50: 'BT-50', santa: 'Santa Fe', xtrail: 'X-Trail', cx7: 'CX-7', asx: 'ASX', mpv: 'MPV', '4runner': '4Runner' };
const modelLabel = (m) => MODEL_LABEL[String(m).toLowerCase()] || m;
const modelSlug = (m) => slugify(modelLabel(m));

// Umbral mínimo para indexar una página de listado (evita páginas pobres)
const MIN = { cat: 20, brand: 20, model: 10 };

module.exports = { MODEL_LABEL, modelLabel, modelSlug, MIN, SITE, PHONE, OG_IMAGE, STORE, template, sb, rpc, esc, slugify, clip, jsonLd, injectHead, send };
