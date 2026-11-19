const VENUE_ORIGIN = 'https://fasol.orionhall.by'
const TIMEOUT_MS = 8000
let siteConfigPromise

const rootElement = () => document.querySelector('#fasol-site')
const text = value => typeof value === 'string' ? value.trim() : ''

export function getFasolOptions() {
  const root = rootElement()
  return {
    liveApi: root?.dataset.liveApi === 'true' || location.hostname === 'fasol.orionhall.by',
    orderUrl: root?.dataset.orderUrl || `${VENUE_ORIGIN}/`,
  }
}

function assetUrl(path) {
  const base = new URL(rootElement()?.dataset.assets || './', location.href)
  return new URL(path, base).href
}

async function getJson(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`Не удалось загрузить настройки: HTTP ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

function parseSite(payload) {
  const site = payload?.site
  if (!site || typeof site !== 'object' || Array.isArray(site)) throw new Error('Некорректный ответ настроек сайта')
  return site
}

export function loadSiteConfig() {
  if (!siteConfigPromise) {
    siteConfigPromise = (async () => {
      let liveError = null
      if (getFasolOptions().liveApi) {
        try {
          const payload = await getJson('/api/site/config')
          if (payload.status !== 'success') throw new Error('Сервер не подтвердил загрузку настроек')
          return { site: parseSite(payload), live: true, error: null }
        } catch (error) {
          liveError = error
        }
      }
      try {
        const snapshot = await getJson(assetUrl('./data/site-config-snapshot.json'))
        return { site: parseSite(snapshot), live: false, error: liveError }
      } catch (error) {

        if (liveError) throw liveError
        throw error
      }
    })().catch(error => {
      siteConfigPromise = undefined
      throw error
    })
  }
  return siteConfigPromise
}

function phoneNumber(raw) {
  const digits = text(raw).replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15 ? `+${digits}` : ''
}

function displayPhone(number) {
  const match = /^\+375(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(number)
  return match ? `+375 (${match[1]}) ${match[2]}-${match[3]}-${match[4]}` : number
}

const DAY_NAMES = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']
const SHORT_DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
function dayLabel(days) {
  const sorted = [...new Set(days)].sort((a, b) => a - b)
  const key = sorted.join(',')
  if (key === '0,1,2,3,4,5,6') return 'Ежедневно'
  if (key === '1,2,3,4,5') return 'Понедельник — пятница'
  if (key === '0,6') return 'Суббота — воскресенье'
  if (sorted.length === 1) return DAY_NAMES[sorted[0]]
  return sorted.map(day => SHORT_DAYS[day]).join(', ')
}

function clock(value) {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(text(value))
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return ''
  return `${Number(match[1])}:${match[2]}`
}

function workingHours(site) {
  const explicit = Array.isArray(site.working_hours_rules) ? site.working_hours_rules : []
  const rules = explicit.length ? explicit : text(site.working_hours).split(/\r?\n/).map(line => {
    const [days, from, to] = line.split('|').map(value => value.trim())
    return { days_of_week: (days || '').split(',').map(Number), time_from: from, time_to: to }
  })
  return rules.flatMap(rule => {
    const days = (Array.isArray(rule.days_of_week) ? rule.days_of_week : []).map(Number)
      .filter(day => Number.isInteger(day) && day >= 0 && day <= 6)
    const from = clock(rule.time_from), to = clock(rule.time_to)
    return days.length && from && to ? [{ label: dayLabel(days), hours: `${from}–${to}` }] : []
  })
}

function makeNode(tag, value = '', className = '') {
  const element = document.createElement(tag)
  element.textContent = value
  if (className) element.className = className
  return element
}

function bannerImageUrl(raw) {
  const value = text(raw)
  if (!value) return ''
  if (!getFasolOptions().liveApi && /^\.?\/?img\/[a-zA-Z0-9_./-]+$/.test(value)) return assetUrl(value)
  try {

    const base = getFasolOptions().liveApi ? location.origin : VENUE_ORIGIN
    const url = new URL(value, base)
    if (url.protocol !== 'https:' || url.username || url.password) return ''
    if (url.origin !== location.origin && url.origin !== VENUE_ORIGIN) return ''
    return url.href
  } catch {
    return ''
  }
}

function applyBanners(root, site) {
  const section = root.querySelector('#offers')
  const container = section?.querySelector('.fs-banner-content')
  if (!section || !container) return
  const banners = (Array.isArray(site.banners) ? site.banners : [])
    .filter(banner => banner && typeof banner === 'object')
    .map((banner, index) => ({ banner, image: bannerImageUrl(banner.image_url), index }))
    .filter(entry => entry.image)
    .sort((a, b) => (Number(a.banner.sort_order) || 0) - (Number(b.banner.sort_order) || 0) || a.index - b.index)
  container.replaceChildren()
  section.hidden = banners.length === 0
  for (const { banner, image } of banners) {
    const card = makeNode('article', '', 'fs-banner-card')
    const img = document.createElement('img')
    img.src = image
    img.alt = text(banner.title) || 'Предложение ресторана ФаСоль'
    img.loading = 'lazy'
    const copy = makeNode('div', '', 'fs-banner-copy')
    if (text(banner.title)) copy.append(makeNode('h3', text(banner.title)))
    if (text(banner.subtitle)) copy.append(makeNode('p', text(banner.subtitle)))
    const order = makeNode('a', 'Заказать навынос', 'fs-button fs-outline')
    order.href = getFasolOptions().orderUrl
    copy.append(order)
    card.append(img, copy)
    container.append(card)
  }
}

function applyLegal(root, legal) {
  if (!legal || typeof legal !== 'object') return
  const footer = root.querySelector('.fs-footer')
  if (!footer) return
  const lines = [...footer.querySelectorAll('p')]
  const org = text(legal.legal_org_full_name), unp = text(legal.legal_unp)

  if (lines[0] && org && unp) lines[0].textContent = `${org}\u00a0· УНП\u00a0${unp}`
  const address = text(legal.legal_jurisdiction_address)?.replace(/(^|\s)(г\.|ул\.|дом)\s/g, '$1$2\u00a0')
  if (lines[1] && address) lines[1].textContent = `Юридический адрес: ${address}`
}

export function applySiteConfig(site) {
  const root = rootElement()
  if (!root || !site || typeof site !== 'object') return
  const number = phoneNumber(site.venue_phone)
  if (number) {
    root.querySelectorAll('a[href^="tel:"]').forEach(link => {
      const oldLabel = link.textContent.trim()
      link.href = `tel:${number}`

      if (/^[+\d\s().\-–—]+$/.test(oldLabel) && /\d/.test(oldLabel)) link.textContent = displayPhone(number)
    })
  }
  const address = text(site.venue_address)
  if (address) {
    const topAddress = root.querySelector('.fs-address a')
    const contactAddress = root.querySelector('#contacts address')
    if (topAddress) topAddress.textContent = address
    if (contactAddress) contactAddress.textContent = address
  }
  const hours = workingHours(site)
  if (hours.length) root.querySelectorAll('.fs-hours').forEach(list => {
    list.replaceChildren(...hours.map(rule => {
      const row = document.createElement('div')
      row.append(makeNode('dt', rule.label), makeNode('dd', rule.hours))
      return row
    }))
  })
  const email = text(site.venue_email) || text(site.legal_entity?.legal_contact_email)
  const emailElement = root.querySelector('#venue-email')
  if (emailElement && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
    emailElement.textContent = email
    if (emailElement.tagName === 'A') emailElement.setAttribute('href', `mailto:${email}`)
  }
  // заголовок и описание страницы задаются в index.html, из настроек меню не берутся:

  if (/^#[\da-f]{6}$/i.test(text(site.primary_color))) root.style.setProperty('--fs-wine', text(site.primary_color))
  applyLegal(root, site.legal_entity)
  applyBanners(root, site)
}
