// Páginas de aterrizaje indexables sobre la plantilla de tienda.html:
//   /categoria/:cat            → categoría
//   /repuestos/:marca          → marca de vehículo
//   /repuestos/:marca/:modelo  → modelo de vehículo
//   /repuestos-de-autos | /repuestos-de-motos
const { SITE, STORE, template, sb, rpc, esc, slugify, clip, jsonLd, injectHead, send, modelLabel, modelSlug, MIN } = require('./_lib/seo');

let INDEX = null, INDEX_AT = 0;
async function vehicleIndex() {
  if (!INDEX || Date.now() - INDEX_AT > 3600e3) { INDEX = await rpc('seo_vehicle_index', {}); INDEX_AT = Date.now(); }
  return INDEX;
}

module.exports = async (req, res) => {
  const q = new URL(req.url, SITE).searchParams;
  const tipo = q.get('tipo');
  try {
    const idx = await vehicleIndex();
    let page;
    if (tipo === 'cat') page = await categoria(idx, (q.get('cat') || '').toLowerCase());
    else if (tipo === 'veh') page = await vehiculo(idx, (q.get('marca') || '').toLowerCase(), (q.get('modelo') || '').toLowerCase());
    else if (tipo === 'auto' || tipo === 'moto') page = await vertical(idx, tipo);
    if (!page) return send(res, 404, injectHead(template('tienda.html'), {
      title: 'Página no encontrada | IVAMAXO', description: 'Busca tu repuesto en el catálogo de IVAMAXO.',
      canonical: SITE + '/tienda.html', robots: 'noindex, follow' }));
    return send(res, 200, render(page, idx), 21600);
  } catch (e) {
    console.error(e);
    res.statusCode = 503; res.setHeader('Retry-After', '120'); res.setHeader('Cache-Control', 'no-store');
    return res.end('Servicio temporalmente no disponible');
  }
};

const PSEL = 'slug,seo_name,name,brand,price,availability';
const topCats = (idx, n = 6) => (idx.categories || []).filter((c) => c.slug !== 'accesorios').slice(0, n).map((c) => c.name.toLowerCase());
const joinY = (arr) => arr.length > 1 ? arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1] : (arr[0] || '');

async function categoria(idx, slug) {
  const cat = (idx.categories || []).find((c) => c.slug === slug);
  if (!cat) return null;
  const cats = await sb(`categories?select=id&slug=eq.${encodeURIComponent(slug)}`);
  const { data, count } = await sb(`products?select=${PSEL}&status=eq.active&category_id=eq.${cats[0].id}&order=availability.desc,sku.asc&limit=24`, { count: true });
  const brands = (idx.brands || []).slice(0, 10);
  return {
    path: `/categoria/${slug}`, filter: { cat: slug }, thin: cat.n < MIN.cat,
    h1: `Repuestos de ${cat.name}`, eyebrow: 'Categoría',
    title: `Repuestos de ${cat.name} para Autos y Motos | IVAMAXO`,
    description: clip(`${count.toLocaleString('de-DE')} repuestos de ${cat.name.toLowerCase()} para Toyota, Mitsubishi, Nissan, Hyundai y más. Precios en USD, entrega en Carabobo sin costo y pedido por WhatsApp.`, 160),
    intro: `Encuentra <strong>${count.toLocaleString('de-DE')} referencias</strong> de ${esc(cat.name.toLowerCase())} para las marcas más comunes en Venezuela. Filtra por vehículo, compara precios y pídelo por WhatsApp con entrega en Carabobo.`,
    crumbs: [['Tienda', '/tienda.html'], [cat.name, `/categoria/${slug}`]],
    links: { title: 'Por marca de vehículo', items: brands.map((b) => [`${cat.name} ${b.brand}`, `/repuestos/${slugify(b.brand)}`]) },
    products: data, count,
  };
}

async function vehiculo(idx, marcaSlug, modeloSlug) {
  const brand = (idx.brands || []).find((b) => slugify(b.brand) === marcaSlug);
  if (!brand) return null;
  const models = (idx.models || []).filter((m) => m.brand === brand.brand);
  let model = null;
  if (modeloSlug) { model = models.find((m) => modelSlug(m.model) === modeloSlug || slugify(m.model) === modeloSlug); if (!model) return null; }
  const label = model ? `${brand.brand} ${modelLabel(model.model)}` : brand.brand;
  let filt = `&vehicle_brand=eq.${encodeURIComponent(brand.brand)}`;
  if (model) filt += `&compatible_models=ilike.${encodeURIComponent('*' + model.model + '*')}`;
  const { data, count } = await sb(`products?select=${PSEL}&status=eq.active${filt}&order=availability.desc,sku.asc&limit=24`, { count: true });
  const others = model ? models.filter((m) => m !== model).slice(0, 12) : models.slice(0, 20);
  return {
    path: model ? `/repuestos/${marcaSlug}/${modelSlug(model.model)}` : `/repuestos/${marcaSlug}`,
    thin: model ? model.n < MIN.model : brand.n < MIN.brand,
    filter: { vb: brand.brand, vm: model ? model.model : '', v: 'auto' },
    h1: `Repuestos para ${label}`, eyebrow: model ? brand.brand : 'Marca de vehículo',
    title: `Repuestos ${label} en Carabobo | IVAMAXO`,
    description: clip(`${count.toLocaleString('de-DE')} repuestos para ${label}: ${joinY(topCats(idx, 4))} y más. Precios en USD, entrega en Carabobo sin costo y pedido por WhatsApp.`, 160),
    intro: `Tenemos <strong>${count.toLocaleString('de-DE')} referencias</strong> compatibles con <strong>${esc(label)}</strong>, en categorías como ${esc(joinY(topCats(idx)))}. Si no sabes cuál es la pieza exacta, escríbenos con el año y el motor de tu vehículo y te ayudamos a encontrarla.`,
    crumbs: model ? [['Tienda', '/tienda.html'], [brand.brand, `/repuestos/${marcaSlug}`], [modelLabel(model.model), `/repuestos/${marcaSlug}/${modelSlug(model.model)}`]]
      : [['Tienda', '/tienda.html'], [brand.brand, `/repuestos/${marcaSlug}`]],
    links: others.length ? { title: model ? `Otros modelos ${brand.brand}` : `Modelos ${brand.brand}`, items: others.map((m) => [`${m.brand} ${modelLabel(m.model)}`, `/repuestos/${slugify(m.brand)}/${modelSlug(m.model)}`]) } : null,
    products: data, count,
  };
}

async function vertical(idx, v) {
  const types = v === 'moto' ? 'in.(moto,universal)' : 'in.(auto,universal)';
  const { data, count } = await sb(`products?select=${PSEL}&status=eq.active&vehicle_type=${types}&order=availability.desc,sku.asc&limit=24`, { count: true });
  const moto = v === 'moto';
  return {
    path: moto ? '/repuestos-de-motos' : '/repuestos-de-autos', filter: { v },
    h1: moto ? 'Repuestos para motos' : 'Repuestos para autos', eyebrow: 'Carabobo, Venezuela',
    title: moto ? 'Repuestos para Motos en Carabobo | IVAMAXO' : 'Repuestos para Autos en Carabobo | IVAMAXO',
    description: moto
      ? clip(`Repuestos para motos CG150, SBR 150, scooter GY6 y más: CDI, embobinados, kits y piezas eléctricas. Entrega en Carabobo y pedido por WhatsApp.`, 160)
      : clip(`${count.toLocaleString('de-DE')} repuestos para Toyota, Mitsubishi, Nissan, Hyundai, Honda y más. Precios en USD, entrega en Carabobo sin costo y pedido por WhatsApp.`, 160),
    intro: moto
      ? `Repuestos para las motos más comunes en Venezuela. <strong>${count.toLocaleString('de-DE')} referencias</strong> con entrega en Carabobo y atención directa por WhatsApp.`
      : `<strong>${count.toLocaleString('de-DE')} referencias</strong> para las marcas que más circulan en Venezuela: ${esc(joinY((idx.brands || []).slice(0, 6).map((b) => b.brand)))}. Entrega en Carabobo y atención directa por WhatsApp.`,
    crumbs: [['Tienda', '/tienda.html'], [moto ? 'Motos' : 'Autos', moto ? '/repuestos-de-motos' : '/repuestos-de-autos']],
    links: moto ? null : { title: 'Repuestos por marca', items: (idx.brands || []).map((b) => [b.brand, `/repuestos/${slugify(b.brand)}`]) },
    products: data, count,
  };
}

function render(pg, idx) {
  const canonical = SITE + pg.path;
  const crumbs = [['Inicio', '/'], ...pg.crumbs];
  const ld = [
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: pg.h1, url: canonical, description: pg.description,
      isPartOf: { '@type': 'WebSite', '@id': SITE + '/#web', url: SITE + '/', name: 'IVAMAXO Repuestos' },
      mainEntity: { '@type': 'ItemList', numberOfItems: pg.count,
        itemListElement: pg.products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/repuesto/${p.slug}`, name: p.seo_name || p.name })) } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c[0], item: SITE + c[1] })) },
    { '@context': 'https://schema.org', ...STORE },
  ];

  const block = `
<section class="seo-hero">
  <nav class="seo-crumbs" aria-label="Ruta">${crumbs.map((c, i) => i < crumbs.length - 1 ? `<a href="${c[1]}">${esc(c[0])}</a><span>›</span>` : `<span aria-current="page">${esc(c[0])}</span>`).join('')}</nav>
  <div class="seo-eyebrow">${esc(pg.eyebrow)}</div>
  <h1>${esc(pg.h1)}</h1>
  <p>${pg.intro}</p>
  ${pg.links ? `<div class="seo-links"><span>${esc(pg.links.title)}:</span>${pg.links.items.map((l) => `<a href="${l[1]}">${esc(l[0])}</a>`).join('')}</div>` : ''}
</section>
<noscript><ul>${pg.products.map((p) => `<li><a href="/repuesto/${esc(p.slug)}">${esc(p.seo_name || p.name)}</a> — $${(parseFloat(p.price) || 0).toFixed(2)}</li>`).join('')}</ul></noscript>
`;

  let html = injectHead(template('tienda.html'), {
    title: pg.title, description: pg.description, canonical,
    robots: pg.thin ? 'noindex, follow' : undefined,
    extra: `<style>.slider{display:none}</style>\n${ld.map(jsonLd).join('\n')}`,
  });
  html = html
    .replace(/<!-- SEO: encabezado del catálogo[\s\S]*?<\/section>\n/, '')
    .replace('<!-- SEARCH BAR -->', `${block}\n<!-- SEARCH BAR -->`)
    .replace('<script>\nconst SB_URL', `<script>window.__SEO_FILTER__=${JSON.stringify(pg.filter).replace(/</g, '\\u003c')};</script>\n<script>\nconst SB_URL`);
  return html;
}
