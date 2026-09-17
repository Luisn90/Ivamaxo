// /repuesto/:slug  → ficha de producto renderizada en el servidor
// /producto.html?id=UUID → redirección 301 a la URL limpia
const { SITE, STORE, template, sb, esc, clip, jsonLd, injectHead, send } = require('./_lib/seo');

const FIELDS = 'id,name,seo_name,slug,brand,sku,oem,price,old_price,availability,description,image_url,vehicle_brand,vehicle_type,compatible_models,compatible_years,engine_codes,updated_at,category_id,categories(name,slug)';

module.exports = async (req, res) => {
  const url = new URL(req.url, SITE);
  const id = url.searchParams.get('id');
  const slug = (url.searchParams.get('slug') || '').toLowerCase();

  try {
    // URL vieja con ?id= → 301 a la nueva
    if (id && /^[0-9a-f-]{36}$/i.test(id)) {
      const rows = await sb(`products?select=slug&status=eq.active&id=eq.${id}`);
      if (rows[0]?.slug) {
        res.statusCode = 301;
        res.setHeader('Location', `/repuesto/${rows[0].slug}`);
        res.setHeader('Cache-Control', 'public, s-maxage=86400');
        return res.end();
      }
      return notFound(res);
    }

    if (!/^[a-z0-9-]{3,140}$/.test(slug)) return notFound(res);
    const rows = await sb(`products?select=${FIELDS}&status=eq.active&slug=eq.${encodeURIComponent(slug)}`);
    const p = rows[0];
    if (!p) return notFound(res);

    // Relacionados: mismo vehículo y categoría primero (enlaces reales, rastreables)
    let related = [];
    const base = `products?select=slug,seo_name,name,brand,price,availability&status=eq.active&id=neq.${p.id}&limit=8`;
    if (p.vehicle_brand && p.category_id) related = await sb(`${base}&vehicle_brand=eq.${encodeURIComponent(p.vehicle_brand)}&category_id=eq.${p.category_id}`);
    if (related.length < 8 && p.vehicle_brand) related = related.concat(await sb(`${base}&vehicle_brand=eq.${encodeURIComponent(p.vehicle_brand)}`));
    if (related.length < 8 && p.category_id) related = related.concat(await sb(`${base}&category_id=eq.${p.category_id}`));
    const seen = new Set();
    related = related.filter((r) => !seen.has(r.slug) && seen.add(r.slug)).slice(0, 8);

    return send(res, 200, render(p, related), 21600);
  } catch (e) {
    console.error(e);
    res.statusCode = 503;
    res.setHeader('Retry-After', '120');
    res.setHeader('Cache-Control', 'no-store');
    return res.end('Servicio temporalmente no disponible');
  }
};

function notFound(res) {
  const html = injectHead(template('producto.html'), {
    title: 'Producto no encontrado | IVAMAXO',
    description: 'Este repuesto ya no está disponible. Busca otras referencias en el catálogo de IVAMAXO.',
    canonical: SITE + '/tienda.html',
    robots: 'noindex, follow',
  }).replace('<script>\nconst SB_URL', '<script>window.__PRODUCT_ID__="__none__";</script>\n<script>\nconst SB_URL');
  return send(res, 404, html);
}

function render(p, related) {
  const name = p.seo_name || p.name;
  const price = parseFloat(p.price) || 0;
  const cat = p.categories || null;
  const canonical = `${SITE}/repuesto/${p.slug}`;
  const inStock = p.availability === 'stock';
  const vehicle = [p.vehicle_brand, p.compatible_models].filter(Boolean).join(' ');
  const years = p.compatible_years ? ` (${p.compatible_years})` : '';

  const title = clip(`${name} | ${p.brand ? p.brand + ' | ' : ''}IVAMAXO`, 70);
  const description = clip(
    `${name}${p.brand ? ' marca ' + p.brand : ''}${p.oem ? ', OEM ' + p.oem : ''}.` +
    `${vehicle ? ' Compatible con ' + vehicle + years + '.' : ''}` +
    ` $${price.toFixed(2)}. ${inStock ? 'En stock' : 'Bajo pedido'}, entrega en Carabobo. Pide por WhatsApp.`, 160);

  // Texto único por ficha (evita 21 mil páginas "vacías" a ojos de Google)
  const paras = [];
  paras.push(`<strong>${esc(name)}</strong>${p.brand ? ` de la marca <strong>${esc(p.brand)}</strong>` : ''}${p.oem ? `, código OEM <strong>${esc(p.oem)}</strong>` : ''}.` +
    (vehicle ? ` Compatible con <strong>${esc(vehicle)}</strong>${esc(years)}.` : '') +
    (p.engine_codes ? ` Motor: ${esc(p.engine_codes)}.` : ''));
  if (p.description && p.description.trim().toUpperCase() !== String(p.name).trim().toUpperCase()) {
    paras.push(esc(p.description).replace(/\n+/g, '<br>'));
  }
  paras.push(inStock
    ? 'Disponible en inventario. Escríbenos por WhatsApp y coordinamos la entrega.'
    : 'Disponible bajo pedido: antes de despachar te confirmamos por WhatsApp la disponibilidad y el tiempo de entrega.');
  paras.push(`Hacemos entregas en el estado Carabobo sin costo de envío. Precio referencial: <strong>$${price.toFixed(2)}</strong> (USD); confirmamos el precio final antes de cerrar el pedido. Si no estás seguro de que sea la pieza correcta para tu ${p.vehicle_type === 'moto' ? 'moto' : 'vehículo'}, envíanos la referencia o el serial y te ayudamos.`);
  const descHtml = paras.map((x) => `<p>${x}</p>`).join('');

  const specs = [['Marca', p.brand], ['Referencia', p.sku], ['Código OEM', p.oem], ['Vehículo', p.vehicle_brand],
    ['Modelos', p.compatible_models], ['Años', p.compatible_years], ['Motor', p.engine_codes], ['Descripción del proveedor', p.name]]
    .filter((r) => r[1]).map((r) => `<tr><td>${r[0]}</td><td>${esc(r[1])}</td></tr>`).join('');

  const box = '<svg viewBox="0 0 24 24" style="width:60px;height:60px;stroke:#D0D0D0;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round" aria-hidden="true"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>';
  const relatedHtml = related.map((r) => `
    <a class="pcard" href="/repuesto/${esc(r.slug)}">
      <div class="pc-img">${box}</div>
      <div class="pc-info">
        <div class="pc-brand">${esc(r.brand || '')}</div>
        <div class="pc-name">${esc(r.seo_name || r.name)}</div>
        <div class="pc-price">$${(parseFloat(r.price) || 0).toFixed(2)}</div>
      </div>
    </a>`).join('');

  const crumbs = [{ n: 'Inicio', u: SITE + '/' }];
  if (cat) crumbs.push({ n: cat.name, u: `${SITE}/categoria/${cat.slug}` });
  crumbs.push({ n: name, u: canonical });

  const offer = {
    '@type': 'Offer', url: canonical, priceCurrency: 'USD', price: price.toFixed(2),
    availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/BackOrder',
    seller: { '@id': SITE + '/#tienda' },
    shippingDetails: {
      '@type': 'OfferShippingDetails',
      shippingRate: { '@type': 'MonetaryAmount', value: '0', currency: 'USD' },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'VE', addressRegion: 'VE-G' },
    },
  };
  const product = {
    '@context': 'https://schema.org', '@type': 'Product', name, sku: p.sku, description: clip(descHtml.replace(/<[^>]+>/g, '').replace(/\s+([,.])/g, '$1'), 500),
    ...(p.oem ? { mpn: p.oem } : {}),
    ...(p.brand ? { brand: { '@type': 'Brand', name: p.brand } } : {}),
    ...(cat ? { category: cat.name } : {}),
    ...(p.image_url ? { image: [p.image_url] } : {}),
    ...(p.vehicle_brand ? { isAccessoryOrSparePartFor: { '@type': 'Vehicle', name: vehicle, brand: { '@type': 'Brand', name: p.vehicle_brand } } } : {}),
    offers: offer,
  };
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.n, item: c.u })) };

  let html = injectHead(template('producto.html'), {
    title, description, canonical, ogType: 'product',
    image: p.image_url || undefined,
    extra: `<meta property="product:price:amount" content="${price.toFixed(2)}">
<meta property="product:price:currency" content="USD">
${jsonLd(product)}
${jsonLd(breadcrumb)}
${jsonLd({ '@context': 'https://schema.org', ...STORE })}`,
  });

  html = html
    .replace('class="prod-grid prod-loading"', 'class="prod-grid prod-ready"')
    .replace('<div class="pi-brand" id="piBrand" style="min-height:16px">&nbsp;</div>', `<div class="pi-brand" id="piBrand" style="min-height:16px">${esc(p.brand || '')}</div>`)
    .replace('<h1 class="pi-name" id="piName" style="min-height:32px"></h1>', `<h1 class="pi-name" id="piName" style="min-height:32px">${esc(name)}</h1>`)
    .replace('<span id="piSku"></span>', `<span id="piSku">${esc(p.sku)}</span>`)
    .replace('<span id="piPrice">—</span>', `<span id="piPrice">$${price.toFixed(2)}</span>`)
    .replace(/<a href="[^"]*" id="breadCat">[^<]*<\/a>/, cat ? `<a href="/categoria/${esc(cat.slug)}" id="breadCat">${esc(cat.name)}</a>` : '<a href="tienda.html" id="breadCat">Tienda</a>')
    .replace(/<span id="breadName">[^<]*<\/span>/, `<span id="breadName">${esc(name)}</span>`)
    .replace(/<div class="desc-body">[\s\S]*?<\/div>/, `<div class="desc-body">${descHtml}</div>`)
    .replace('id="specsTabBtn" onclick="showTab(\'specs\',this)" style="display:none"', 'id="specsTabBtn" onclick="showTab(\'specs\',this)"')
    .replace('<table class="specs-table" id="specsTable"></table>', `<table class="specs-table" id="specsTable">${specs}</table>`)
    .replace('<div class="related-grid" id="relatedGrid"></div>', `<div class="related-grid" id="relatedGrid" data-ssr="1">${relatedHtml}</div>`)
    .replace('<script>\nconst SB_URL', `<script>window.__PRODUCT_ID__=${JSON.stringify(p.id)};</script>\n<script>\nconst SB_URL`);
  return html;
}
