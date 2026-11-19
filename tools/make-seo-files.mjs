import fs from 'node:fs'
import path from 'node:path'
import * as cfg from '../src/scripts/launch-config.js'

const args = process.argv.slice(2)
const dir = args.find(a => !a.startsWith('--'))
if (!dir || !fs.existsSync(dir)) { console.error('Укажите папку сборки'); process.exit(2) }
const production = args.includes('--production')
const domain = (args.find(a => a.startsWith('--domain='))?.slice(9) || cfg.SITE_DOMAIN).replace(/\/+$/, '')
const w = (name, text) => fs.writeFileSync(path.join(dir, name), text)

if (!production) {
  w('robots.txt', 'User-agent: *\nDisallow: /\n')
  fs.rmSync(path.join(dir, 'sitemap.xml'), { force: true })
  console.log('OK превью: robots.txt (Disallow), sitemap.xml нет, noindex в HTML сохранён')
  process.exit(0)
}

if (!domain) { console.error('СТОП: в launch-config.js не заполнен SITE_DOMAIN. Впишите боевой домен.'); process.exit(1) }
if (!/^https:\/\/[a-z0-9.-]+$/i.test(domain)) { console.error('СТОП: SITE_DOMAIN должен быть вида https://домен'); process.exit(1) }

w('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${domain}/sitemap.xml\n`)
const today = new Date().toISOString().slice(0, 10)
w('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  cfg.SITEMAP_PATHS.map(p => `  <url><loc>${domain}${p}</loc><lastmod>${today}</lastmod></url>`).join('\n') + '\n</urlset>\n')

for (const f of ['index.html', 'privacy.html', 'cookies.html']) {
  const p = path.join(dir, f); if (!fs.existsSync(p)) continue
  let s = fs.readFileSync(p, 'utf8')
  s = s.replace(/<meta[^>]*name="robots"[^>]*>\s*/i, '')
  const canon = f === 'index.html' ? `${domain}/` : `${domain}/${f}`
  if (!/rel="canonical"/.test(s)) s = s.replace('</head>', `<link rel="canonical" href="${canon}"/>${f === 'index.html' ? `<meta property="og:url" content="${canon}"/>` : ''}</head>`)
  fs.writeFileSync(p, s)
}
const bad = ['index.html', 'privacy.html', 'cookies.html'].filter(f => /noindex/i.test(fs.readFileSync(path.join(dir, f), 'utf8')))
if (bad.length) { console.error('СТОП: noindex остался в', bad.join(', ')); process.exit(1) }
console.log(`OK боевая сборка для ${domain}: robots.txt, sitemap.xml, noindex снят, canonical добавлен`)
