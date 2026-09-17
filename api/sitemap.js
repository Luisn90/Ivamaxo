// /sitemap.xml                → índice
// /sitemap-paginas.xml        → home, tienda, categorías, marcas y modelos
// /sitemap-productos-N.xml    → fichas de producto, 5.000 por archivo
const { SITE, rpc, slugify, modelSlug, MIN } = require('./_lib/seo');
const PER = 5000;

const xml = (body) => `<?xml version="1.0" encoding="UTF-8"?>\n${body}`;
const urlTag = (loc, lastmod, priority, freq = 'weekly') =>
  `<url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}<changefreq>${freq}</changefreq><priority>${priority}</priority></url>`;

module.exports = async (req, res) => {
  const q = new URL(req.url, SITE).searchParams;
  const part = q.get('part') || 'index';
  const today = new Date().toISOString().slice(0, 10);
  try {
    let out;
    const idx = await rpc('seo_vehicle_index', {});
    if (part === 'index') {
      const files = Math.ceil((idx.total || 0) / PER);
      out = xml(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<sitemap><loc>${SITE}/sitemap-paginas.xml</loc><lastmod>${today}</lastmod></sitemap>
${Array.from({ length: files }, (_, i) => `<sitemap><loc>${SITE}/sitemap-productos-${i + 1}.xml</loc><lastmod>${today}</lastmod></sitemap>`).join('\n')}
</sitemapindex>`);
    } else if (part === 'paginas') {
      const urls = [
        urlTag(`${SITE}/`, today, '1.0', 'daily'),
        urlTag(`${SITE}/tienda.html`, today, '0.9', 'daily'),
        urlTag(`${SITE}/repuestos-de-autos`, today, '0.9', 'daily'),
        urlTag(`${SITE}/repuestos-de-motos`, today, '0.9', 'daily'),
        ...(idx.categories || []).filter((c) => c.n >= MIN.cat).map((c) => urlTag(`${SITE}/categoria/${c.slug}`, today, '0.8', 'daily')),
        ...(idx.brands || []).filter((b) => b.n >= MIN.brand).map((b) => urlTag(`${SITE}/repuestos/${slugify(b.brand)}`, today, '0.8', 'daily')),
        ...(idx.models || []).filter((m) => m.n >= MIN.model).map((m) => urlTag(`${SITE}/repuestos/${slugify(m.brand)}/${modelSlug(m.model)}`, today, '0.7')),
      ];
      out = xml(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`);
    } else {
      const n = Math.max(1, parseInt(q.get('n'), 10) || 1);
      const rows = await rpc('sitemap_products', { p_offset: (n - 1) * PER, p_limit: PER });
      if (!rows.length) { res.statusCode = 404; return res.end(); }
      out = xml(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.map((r) => urlTag(`${SITE}/repuesto/${r.s}`, r.u, '0.6')).join('\n')}\n</urlset>`);
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=43200, stale-while-revalidate=86400');
    res.end(out);
  } catch (e) {
    console.error(e);
    res.statusCode = 503; res.setHeader('Cache-Control', 'no-store'); res.end();
  }
};
