import { METRIKA_ID, isProduction } from './launch-config.js'

const KEY = 'fasol-cookie-consent'

function read() { try { return localStorage.getItem(KEY) } catch { return null } }
function write(v) { try { localStorage.setItem(KEY, v) } catch {} }

function loadMetrika() {
  if (!METRIKA_ID || !isProduction || window.__fasolMetrika) return
  window.__fasolMetrika = true
  const id = Number(METRIKA_ID)
  if (!id) return
  window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments) }
  window.ym.l = Date.now()
  const s = document.createElement('script')
  s.async = true; s.src = 'https://mc.yandex.ru/metrika/tag.js'
  document.head.append(s)
  window.ym(id, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true })
}

function addFooterLinks() {
  const box = document.querySelector('.fs-footer > div')
  if (!box || box.querySelector('.fs-legal-links')) return
  const p = document.createElement('p')
  p.className = 'fs-legal-links'
  p.innerHTML = '<a href="./privacy.html">Политика конфиденциальности</a><a href="./cookies.html">Политика cookie</a>'
  box.append(p)
}

function showBanner() {
  const b = document.createElement('div')
  b.className = 'fs-cookie'
  b.setAttribute('role', 'dialog')
  b.setAttribute('aria-label', 'Использование cookie')
  b.innerHTML = '<p>Мы используем cookie, чтобы сайт работал, и, с вашего согласия, для статистики посещений. <a href="./cookies.html">Политика cookie</a></p>' +
    '<div class="fs-cookie__actions"><button type="button" class="fs-button fs-solid" data-cookie="all">Принять</button>' +
    '<button type="button" class="fs-button fs-outline" data-cookie="necessary">Только необходимые</button></div>'
  b.addEventListener('click', e => {
    const v = e.target.closest('[data-cookie]')?.dataset.cookie
    if (!v) return
    write(v); b.remove()
    if (v === 'all') loadMetrika()
  })
  document.body.append(b)
}

const bannerWanted = isProduction || new URLSearchParams(location.search).has('cookie-banner')

function init() {
  addFooterLinks()
  if (!bannerWanted) return
  const saved = read()
  if (saved === 'all') loadMetrika()
  else if (saved !== 'necessary') showBanner()
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init()
