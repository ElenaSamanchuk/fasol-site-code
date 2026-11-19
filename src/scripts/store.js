import { getFasolOptions } from './site-bindings.js'
const root = document.querySelector('#fasol-site')

export const LIVE = getFasolOptions().liveApi
const asset = path => new URL(path, new URL(root?.dataset.assets || './', location.href)).href
const STORAGE_KEY = 'fasol-takeaway-cart-v1'
const DISCOUNT = Number(document.querySelector('#fasol-site')?.dataset.pickupDiscount ?? 0.2)
const PREP_MINUTES = 30
const SLOT_STEP = 15
const CLOSE_MINUTES = 23 * 60
const PHONE_HREF = 'tel:+375447903333'
const PHONE_TEXT = '+375 (44) 790-33-33'
const ADDRESS = 'г.\u00a0Гомель, ул.\u00a0Советская, 36'
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

export const menuTitles = { breakfast: 'Завтраки', lunch: 'Домашние обеды', main: 'Основное меню' }

const menuImages = Object.fromEntries(['breakfast', 'lunch', 'main'].map(name => [name, `./img/client-20261117/${matchMedia('(max-width:600px)').matches ? 'm/' : ''}menu-${name}.webp`]))

function preloadMenuImages() {
  if (navigator.connection?.saveData) return
  const start = () => Object.values(menuImages).forEach(src => { const image = new Image(); image.src = asset(src) })
  const idle = () => 'requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 3000 }) : setTimeout(start, 1200)
  if (document.readyState === 'complete') idle()
  else addEventListener('load', idle, { once: true })
}

const schedule = {
  breakfast: day => (day >= 5 ? [600, 715] : [540, 715]),
  lunch: day => (day >= 5 ? null : [720, 895]),
  main: () => [720, 1355],
}
const dayNames = ['понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу', 'воскресенье']
const dayTitles = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']

const soupDays = [/картофельн.*лосос/i, /борщ/i, /рассольник/i, /(^|[^а-яё])щи([^а-яё]|$)/i, /фрикадел/i]
export function soupDayOf(name, menu = 'lunch') {
  if (menu !== 'lunch') return -1
  const text = String(name || '').toLocaleLowerCase('ru')
  return soupDays.findIndex(re => re.test(text))
}
const onDay = day => `${day === 1 ? 'во' : 'в'} ${dayNames[day]}`

// время считаем по Минску, а не по часам устройства гостя: расписание меню задано для ресторана.
function minskNow(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Minsk', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(p => [p.type, p.value]))
  return { day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday), minutes: Number(parts.hour) * 60 + Number(parts.minute) }
}
const clock = minutes => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
const windowFor = (type, day) => schedule[type]?.(day) || null
export function isOpen(type, date = new Date()) {
  const { day, minutes } = minskNow(date), w = windowFor(type, day)
  return Boolean(w && minutes >= w[0] && minutes <= w[1])
}

export function orderHours(type) {
  const range = w => `${clock(w[0])}–${clock(w[1])}`
  const weekday = windowFor(type, 0), weekend = windowFor(type, 5)
  if (!weekend) return [`Пн–пт ${range(weekday)}`]
  if (weekday[0] === weekend[0] && weekday[1] === weekend[1]) return [`Ежедневно ${range(weekday)}`]
  return [`Пн–пт ${range(weekday)}`, `сб–вс ${range(weekend)}`]
}

function orderBlock(name, menu, date = new Date()) {
  const soup = soupDayOf(name, menu), { day } = minskNow(date)
  if (soup >= 0 && soup !== day) return `Только ${onDay(soup)}`
  if (!isOpen(menu, date)) { const when = opensText(menu, date), cut = when.lastIndexOf(' в\u00a0'); return `Доступно ${cut >= 0 ? `${when.slice(0, cut)} с\u00a0${when.slice(cut + 3)}` : when}` }
  return ''
}

export function opensText(type, date = new Date()) {
  const { day, minutes } = minskNow(date)
  for (let offset = 0; offset < 8; offset++) {
    const d = (day + offset) % 7, w = windowFor(type, d)
    if (!w || (offset === 0 && minutes >= w[0])) continue
    const when = offset === 0 ? 'сегодня' : offset === 1 ? 'завтра' : onDay(d)
    return `${when} в\u00a0${clock(w[0])}`
  }
  return 'позже'
}
export function statusText(type, date = new Date()) {
  if (isOpen(type, date)) return { open: true, text: `Принимаем заказы до\u00a0${clock(windowFor(type, minskNow(date).day)[1])}` }
  return { open: false, text: `Сейчас закрыто · откроется ${opensText(type, date)}` }
}

const guillemets = text => String(text).replace(/"([^"]+)"/g, '«$1»')
const money = new Intl.NumberFormat('ru-BY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt = cents => `${money.format(cents / 100)} BYN`
const toCents = value => Math.round(Number(value) * 100)

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}
function iconButton(className, label, symbol) {
  const button = el('button', className, symbol)
  button.type = 'button'
  button.setAttribute('aria-label', label)
  return button
}

let cart = []
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  if (Array.isArray(saved)) cart = saved.filter(row => row && Number.isSafeInteger(row.id) && row.qty > 0 && menuTitles[row.menu]).map(row => ({ ...row, qty: Math.min(99, Math.floor(row.qty)) }))
} catch { cart = [] }
const listeners = new Set()
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)) } catch {}
  listeners.forEach(fn => fn())
}
const qtyOf = id => cart.find(row => row.id === id)?.qty || 0
function setQty(item, menu, qty) {
  const index = cart.findIndex(row => row.id === item.id)
  if (qty <= 0) { if (index >= 0) cart.splice(index, 1) }
  else if (index >= 0) cart[index].qty = Math.min(99, qty)
  else cart.push({ id: item.id, name: item.name, price: toCents(item.price), image: item.image, menu, qty: Math.min(99, qty) })
  save()
}
function totals() {
  const count = cart.reduce((sum, row) => sum + row.qty, 0)
  const subtotal = cart.reduce((sum, row) => sum + row.price * row.qty, 0)
  // скидка навынос (DISCOUNT) только на основное меню, завтраки и обеды по полной цене — так же настроено в электронном меню.
  const discountBase = cart.reduce((sum, row) => sum + (row.menu === 'main' ? row.price * row.qty : 0), 0)
  const discount = Math.round(discountBase * DISCOUNT)
  return { count, subtotal, discount, total: subtotal - discount }
}
const plural = (n, one, few, many) => (n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many)

const controls = new Set()

export function cartControl(item, menu) {
  const box = el('div', 'fst-buy')
  const control = { box, render: null }
  control.render = () => {
    const qty = qtyOf(item.id)
    box.replaceChildren()
    const blocked = orderBlock(item.name, menu)
    const soup = soupDayOf(item.name, menu)
    if (soup >= 0) box.dataset.soupDay = String(soup)
    box.classList.toggle('is-off', Boolean(blocked))
    if (blocked) {
      const button = el('button', 'fst-add', 'В заказ')
      button.type = 'button'; button.disabled = true

      const note = el('small', blocked.startsWith('Только') ? 'fst-soup-note' : 'fst-buy-note', blocked)
      note.id = `fst-note-${item.id}-${Math.random().toString(36).slice(2, 7)}`
      button.setAttribute('aria-describedby', note.id)
      box.append(button, note)
      return
    }
    if (!qty) {
      const button = el('button', 'fst-add')
      button.type = 'button'
      button.textContent = 'В заказ'
      button.setAttribute('aria-label', `Добавить в корзину: ${item.name}`)
      button.addEventListener('click', () => { const from = button.closest('.fs-dish')?.querySelector('img'); setQty(item, menu, 1); flyToBar(from); toast(`«${guillemets(item.name)}» в корзине`); focusAfter(item.id, 'plus') })
      box.append(button)
      return
    }
    box.append(stepper(qty, item.name, () => setQty(item, menu, qty - 1), () => setQty(item, menu, qty + 1), true))
  }
  control.id = item.id
  controls.add(control)
  control.render()
  return box
}
function stepper(qty, name, minus, plus, liveFocus = false, plusDisabled = false) {
  const wrap = el('div', 'fst-stepper')
  wrap.setAttribute('role', 'group')
  wrap.setAttribute('aria-label', `Количество: ${name}`)
  const dec = iconButton('fst-step', qty === 1 ? `Убрать из корзины: ${name}` : `Меньше: ${name}`, '−')
  const inc = iconButton('fst-step', `Больше: ${name}`, '+')
  inc.disabled = plusDisabled || qty >= 99
  dec.dataset.step = 'minus'; inc.dataset.step = 'plus'
  const value = el('output', 'fst-qty', String(qty))
  value.setAttribute('aria-live', 'polite')
  dec.addEventListener('click', minus)
  inc.addEventListener('click', plus)
  wrap.append(dec, value, inc)
  return wrap
}

let pendingFocus = null
function focusAfter(id, step) { pendingFocus = { id, step } }
function refreshControls() {
  const active = document.activeElement
  for (const control of controls) {
    if (!control.box.isConnected) { controls.delete(control); continue }
    const hadFocus = control.box.contains(active)
    const step = active?.dataset?.step
    control.render()
    if (pendingFocus?.id === control.id || hadFocus) {
      const target = control.box.querySelector(`[data-step="${pendingFocus?.step || step}"]:not(:disabled)`) || control.box.querySelector('button:not(:disabled)')
      target?.focus({ preventScroll: true })
    }
  }
  pendingFocus = null
}
listeners.add(refreshControls)

const menuDialog = root?.querySelector('#fs-menu-dialog')
const menuContent = root?.querySelector('#fs-menu-content')
const dock = el('div', 'fst-dock')
const toastBox = el('div', 'fst-toast')
toastBox.setAttribute('role', 'status')
toastBox.setAttribute('aria-live', 'polite')
const bar = el('button', 'fst-bar')
bar.type = 'button'
dock.append(toastBox, bar)
menuDialog?.append(dock)

const topbar = el('div', 'fst-topbar')
const logoButton = el('button', 'fst-logo')
logoButton.type = 'button'; logoButton.setAttribute('aria-label', 'ФаСоль — на главную')
const logoImg = el('img'); logoImg.src = asset('./img/fasol-wordmark-light.svg'); logoImg.alt = ''; logoImg.width = 150; logoImg.height = 76
logoButton.append(logoImg)
const homeButton = el('button', 'fst-home')
homeButton.type = 'button'
homeButton.append(el('span', '', '←'), el('span', '', 'На главную'))
const cartButton = el('button', 'fst-cartbtn')
cartButton.type = 'button'
const cartCount = el('span', 'fst-cartbtn-count', '0')
const cartIcon = el('span', 'fst-cartbtn-icon'); cartIcon.setAttribute('aria-hidden', 'true')
cartIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 3.5h2.6l2.6 12h10.6l2.2-8.5H6.2"/><circle cx="9.5" cy="19.6" r="1.3"/><circle cx="16.8" cy="19.6" r="1.3"/></svg>'
cartButton.append(cartIcon, el('span', 'fst-cartbtn-label', 'Корзина'), cartCount)
topbar.append(logoButton, homeButton, cartButton)
menuDialog?.prepend(topbar)
const goHome = () => menuDialog.close()
logoButton.addEventListener('click', goHome)
homeButton.addEventListener('click', goHome)
cartButton.addEventListener('click', () => openCart())
let lastCount = totals().count
function renderBar() {
  const { count, subtotal, total } = totals()
  bar.replaceChildren()
  const left = el('span', 'fst-bar-left')
  left.append(el('span', 'fst-bar-count', String(count)), el('span', 'fst-bar-label', 'Корзина'))
  const right = el('span', 'fst-bar-sum')
  if (subtotal !== total) right.append(el('s', '', fmt(subtotal)))
  right.append(el('strong', '', fmt(total)))
  bar.append(left, right)
  bar.setAttribute('aria-label', `Открыть корзину: ${count} ${plural(count, 'позиция', 'позиции', 'позиций')}, ${fmt(total)}${subtotal !== total ? ' со скидкой 20 % на основное меню' : ''}`)
  dock.hidden = LIVE || !count || !menuDialog?.dataset.fst
  cartButton.hidden = LIVE
  cartCount.textContent = String(count)
  cartButton.setAttribute('aria-label', count ? `Корзина, ${count} ${plural(count, 'позиция', 'позиции', 'позиций')}` : 'Корзина')
  cartCount.hidden = !count
  cartButton.setAttribute('aria-label', count ? `Корзина: ${count} ${plural(count, 'позиция', 'позиции', 'позиций')}, ${fmt(total)}` : 'Корзина пуста')
  if (count > lastCount && !reducedMotion.matches) { bar.classList.remove('is-bump'); void bar.offsetWidth; bar.classList.add('is-bump') }
  lastCount = count
}
listeners.add(renderBar)

function flyToBar(image) {
  if (!image || reducedMotion.matches || !menuDialog?.open) return
  const target = [bar.querySelector('.fst-bar-count'), cartButton].find(node => node?.getBoundingClientRect().width)
  if (!target || !image.getBoundingClientRect().width) return
  const from = image.getBoundingClientRect(), to = target.getBoundingClientRect()
  const ghost = el('img', 'fst-fly'); ghost.src = image.currentSrc || image.src; ghost.alt = ''
  const size = Math.min(from.width, from.height, 96)
  ghost.style.cssText = `left:${from.left + from.width / 2 - size / 2}px;top:${from.top + from.height / 2 - size / 2}px;width:${size}px;height:${size}px`
  menuDialog.append(ghost)
  const dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height / 2 - (from.top + from.height / 2)
  ghost.animate([
    { transform: 'translate(0,0) scale(1)', opacity: 1 },
    { transform: `translate(${dx * .55}px,${dy * .35}px) scale(.6)`, opacity: 1, offset: .6 },
    { transform: `translate(${dx}px,${dy}px) scale(.16)`, opacity: .2 },
  ], { duration: 620, easing: 'cubic-bezier(.45,0,.25,1)' }).finished.finally(() => ghost.remove())
}
let toastTimer
function toast(text) {
  toastBox.textContent = text
  toastBox.classList.add('is-visible')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toastBox.classList.remove('is-visible'), 2200)
}
function setMode(mode) {
  if (!menuDialog) return
  if (mode) menuDialog.dataset.fst = mode
  else delete menuDialog.dataset.fst
  renderBar()
}
if (menuContent) {

  new MutationObserver(() => { if (!menuContent.querySelector('[data-fst-view]')) setMode(null) }).observe(menuContent, { childList: true })
}
menuDialog?.addEventListener('close', () => { setMode(null); if (cartDialog.open) cartDialog.close() })

export function takeawayChooser(onPick, hrefFor) {
  const wrap = el('div', 'fst-chooser')
  wrap.dataset.fstView = 'chooser'
  const intro = el('p', 'fst-chooser-intro', `Самовывоз · ${ADDRESS}`)
  const list = el('div', 'fst-choices')
  for (const type of ['breakfast', 'lunch', 'main']) {
    const status = statusText(type)
    const card = el(hrefFor ? 'a' : 'button', 'fst-choice')
    if (hrefFor) card.href = hrefFor(type)
    else card.type = 'button'
    const media = el('span', 'fst-choice-media')
    const img = el('img'); img.src = asset(menuImages[type]); img.alt = ''; img.width = 480; img.height = 480
    media.append(img)

    const discounted = type === 'main' && DISCOUNT > 0
    if (discounted) { const badge = el('span', 'fst-choice-badge', `−${Math.round(DISCOUNT * 100)}\u00a0%`); badge.setAttribute('aria-hidden', 'true'); media.append(badge) }
    const body = el('span', 'fst-choice-body')
    const hours = el('span', 'fst-choice-hours')
    orderHours(type).forEach((range, index) => { if (index) hours.append(el('span', 'fst-dot', ' · ')); hours.append(el('span', 'fst-nowrap', range)) })
    body.append(el('span', 'fst-choice-title', menuTitles[type]), hours)
    const state = el('span', `fst-status ${status.open ? 'is-open' : 'is-closed'}`, status.text)
    body.append(state, el('span', 'fst-choice-go', status.open ? 'Выбрать блюда' : 'Посмотреть меню'))
    card.append(media, body)
    card.setAttribute('aria-label', `${menuTitles[type]}${discounted ? `, скидка ${Math.round(DISCOUNT * 100)} % навынос` : ''}. Приём заказов: ${orderHours(type).join(', ')}. ${status.text}`)
    if (!hrefFor) card.addEventListener('click', () => onPick(type))
    list.append(card)
  }
  wrap.append(intro, list)
  setMode('chooser')
  return wrap
}

export function wheelTabs(categories) {
  categories.addEventListener('wheel', event => {
    if (event.ctrlKey || categories.scrollWidth <= categories.clientWidth + 1 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return

    const max = categories.scrollWidth - categories.clientWidth
    if ((event.deltaY < 0 && categories.scrollLeft <= 0) || (event.deltaY > 0 && categories.scrollLeft >= max - 1)) return
    event.preventDefault()
    categories.scrollLeft += event.deltaY
  }, { passive: false })
}

export function menuFade(categories, scroller) {
  const fade = el('div', 'fs-tabs-fade'); fade.setAttribute('aria-hidden', 'true')
  const ro = new ResizeObserver(() => {
    if (!categories.isConnected) { ro.disconnect(); return }
    scroller.style.setProperty('--fs-tabs-bottom', `${(parseFloat(getComputedStyle(categories).top) || 0) + categories.offsetHeight}px`)
  })
  ro.observe(categories); ro.observe(scroller)
  const head = scroller.querySelector('.fst-topbar'); if (head) ro.observe(head)
  return fade
}

export function sectionFeed({ categories, grid, scroller, offset, decorate }) {
  const buttons = [...categories.querySelectorAll('button')]
  if (!buttons.length || !grid?.isConnected) return null
  const feed = el('div', 'fst-feed')
  const sections = buttons.map((button, index) => {
    button.click()
    const id = `fst-sec-${index}-${Math.random().toString(36).slice(2, 6)}`
    const section = el('section', 'fst-section'), title = el('h3', 'fst-section-title', button.textContent.trim()), list = el('div', grid.className)
    title.id = id; section.setAttribute('aria-labelledby', id); section.dataset.section = String(index)
    list.append(...grid.childNodes)
    section.append(title, list)
    decorate?.(section, title.textContent, list)
    feed.append(section)
    button.removeAttribute('aria-pressed')
    button.dataset.target = id
    return section
  })
  grid.replaceWith(feed)
  categories.setAttribute('role', 'navigation')
  const smooth = () => (reducedMotion.matches ? 'auto' : 'smooth')
  let active = -1, locked = false, unlockTimer
  function setActive(index) {
    if (index === active || index < 0) return
    active = index
    buttons.forEach((button, i) => { if (i === index) button.setAttribute('aria-current', 'true'); else button.removeAttribute('aria-current') })

    const button = buttons[index], c = categories.getBoundingClientRect(), b = button.getBoundingClientRect()
    if (categories.scrollWidth > categories.clientWidth + 1 && (b.left < c.left + 8 || b.right > c.right - 8)) categories.scrollTo({ left: categories.scrollLeft + b.left - c.left - (c.width - b.width) / 2, behavior: smooth() })
  }

  function byPosition() {
    if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) return sections.length - 1

    const line = categories.getBoundingClientRect().bottom + 24 + 2
    let index = 0
    sections.forEach((section, i) => { if (section.getBoundingClientRect().top <= line) index = i })
    return index
  }
  let observer
  function observe() {
    observer?.disconnect()
    if (!feed.isConnected) return
    const top = Math.round(offset()) + 2, bottom = Math.max(0, scroller.clientHeight - top - 1)
    observer = new IntersectionObserver(() => { if (!locked) setActive(byPosition()) }, { root: scroller, rootMargin: `-${top}px 0px -${bottom}px 0px`, threshold: 0 })
    sections.forEach(section => observer.observe(section))
  }
  const onScroll = () => { if (!locked) setActive(byPosition()) }
  scroller.addEventListener('scroll', onScroll, { passive: true })
  const resize = new ResizeObserver(() => { if (!feed.isConnected) { resize.disconnect(); observer?.disconnect(); scroller.removeEventListener('scroll', onScroll); return } observe() })
  resize.observe(scroller); resize.observe(categories)
  let target = -1, fixes = 0

  function unlock() {
    clearTimeout(unlockTimer); if (!locked) return
    scroller.removeEventListener('scrollend', unlock)
    const section = sections[target]
    if (section && fixes < 2) {
      const delta = section.getBoundingClientRect().top - scroller.getBoundingClientRect().top - offset()
      const room = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop
      if (Math.abs(delta) > 2 && !(delta > 0 && room < 2)) {
        fixes++
        if ('onscrollend' in scroller) scroller.addEventListener('scrollend', unlock, { once: true })
        waitStill(scroller.scrollTop)
        scroller.scrollTo({ top: scroller.scrollTop + delta, behavior: smooth() })
        return
      }
    }
    locked = false
    setActive(byPosition())
  }

  function waitStill(start = scroller.scrollTop, last = -1, still = 0, waited = 0) {
    unlockTimer = setTimeout(() => {
      const now = scroller.scrollTop, moved = Math.abs(now - start) > 1
      if (waited > 4000 || (now === last && still >= 2 && (moved || waited > 1200))) unlock()
      else waitStill(start, now, now === last ? still + 1 : 0, waited + 150)
    }, 150)
  }

  categories.addEventListener('click', event => {
    const button = event.target.closest('button')
    if (!button || !categories.contains(button)) return
    event.stopPropagation()
    const index = buttons.indexOf(button), section = sections[index]
    if (!section) return
    const top = Math.min(scroller.scrollHeight - scroller.clientHeight, scroller.scrollTop + section.getBoundingClientRect().top - scroller.getBoundingClientRect().top - offset())
    locked = true; target = index; fixes = 0
    setActive(index)
    clearTimeout(unlockTimer)
    if (Math.abs(top - scroller.scrollTop) < 1) { unlock(); return }
    scroller.removeEventListener('scrollend', unlock)
    if ('onscrollend' in scroller) scroller.addEventListener('scrollend', unlock, { once: true })
    waitStill(scroller.scrollTop)
    scroller.scrollTo({ top: Math.max(0, top), behavior: smooth() })
  }, true)
  observe()
  setActive(0)
  return { feed, sections, buttons, setActive }
}

export function decorateSoups(scope) {
  const { day } = minskNow()
  const soupDay = card => card.dataset.soupDay ?? card.querySelector('.fst-buy[data-soup-day]')?.dataset.soupDay
  const cards = [...scope.querySelectorAll('.fs-dish')].filter(card => soupDay(card) != null)
  if (!cards.length) return
  const list = cards[0].parentElement
  const order = card => { const d = Number(soupDay(card)); return d === day ? -1 : d }
  for (const card of cards) {
    const d = Number(soupDay(card)), title = card.querySelector('h3')
    title?.querySelector('.fst-day')?.remove()
    card.classList.toggle('is-today', d === day)
    const label = el('span', `fst-day${d === day ? ' is-today' : ''}`, d === day ? `Сегодня, ${dayTitles[d].toLocaleLowerCase('ru')}` : dayTitles[d])
    title?.prepend(label)
  }

  const sorted = [...cards].sort((a, b) => order(a) - order(b))
  const current = [...list.children].filter(node => cards.includes(node))
  if (sorted.some((card, i) => card !== current[i])) {
    const anchor = current[0].previousSibling
    if (anchor) anchor.after(...sorted); else list.prepend(...sorted)
  }
}

export function decorateCatalog({ type, onBack }) {
  if (!menuContent) return
  const [schedule, categories, grid] = menuContent.children
  const head = el('div', 'fst-catalog-head')
  head.dataset.fstView = 'catalog'
  const back = el('button', 'fst-back')
  back.type = 'button'
  back.append(el('span', '', '←'), el('span', '', 'К выбору меню'))
  back.addEventListener('click', onBack)
  const meta = el('div', 'fst-catalog-meta')
  const status = statusText(type)

  if (schedule) { schedule.classList.add('fst-hours'); schedule.textContent = orderHours(type).join(' · '); meta.append(schedule) }
  const state = el('span', `fst-status ${status.open ? 'is-open' : 'is-closed'}`, status.text)
  meta.append(state)
  head.append(back, meta)
  menuContent.prepend(head)
  syncHeadHeight()
  setMode('catalog')
  if (!categories || !grid) return
  categories.classList.add('fst-tabs')
  const markEdges = () => {
    categories.toggleAttribute('data-more-left', categories.scrollLeft > 2)
    categories.toggleAttribute('data-more-right', categories.scrollLeft + categories.clientWidth < categories.scrollWidth - 2)
  }
  categories.addEventListener('scroll', markEdges, { passive: true })
  new ResizeObserver(markEdges).observe(categories)
  categories.after(menuFade(categories, menuDialog))
  wheelTabs(categories)
  grid.classList.add('fst-grid')
  const decorate = (section, name, list) => {

    if (type !== 'main') list.querySelectorAll('.fs-dish-price').forEach(price => { const old = price.querySelector('s'); if (old) price.textContent = old.textContent })
    if (list.querySelector('.fs-text-menu-section')) list.prepend(el('p', 'fst-text-note', 'Напитки можно указать в комментарии к заказу — ресторан подтвердит наличие при звонке'))
    if (type === 'lunch') decorateSoups(list)
  }
  const result = sectionFeed({ categories, grid, scroller: menuDialog, offset: () => menuDialog.clientTop + (parseFloat(getComputedStyle(categories).top) || 0) + categories.offsetHeight + 24, decorate })
  markEdges()

  const feed = result?.feed
  const tick = setInterval(() => {
    if (!feed?.isConnected || !menuDialog.open) { clearInterval(tick); return }
    const now = statusText(type)
    state.className = `fst-status ${now.open ? 'is-open' : 'is-closed'}`; state.textContent = now.text
    refreshControls()
    if (type === 'lunch') decorateSoups(feed)
  }, 30000)
}
function syncHeadHeight() {
  if (menuDialog && topbar.offsetHeight) menuDialog.style.setProperty('--fst-head', `${topbar.offsetHeight}px`)
}
if (menuDialog) new ResizeObserver(syncHeadHeight).observe(topbar)

const cartDialog = el('dialog', 'fst-cart')
cartDialog.setAttribute('aria-labelledby', 'fst-cart-title')
const cartHead = el('div', 'fst-cart-head')
const cartTitleWrap = el('div', '')
const cartTitle = el('h2', '', 'Ваш заказ'); cartTitle.id = 'fst-cart-title'
const cartSub = el('p', 'fst-cart-sub', `Самовывоз · ${ADDRESS}`)
cartTitleWrap.append(cartTitle, cartSub)
const cartClose = iconButton('fst-x', 'Закрыть корзину', '')
cartClose.addEventListener('click', () => cartDialog.close())
cartHead.append(cartTitleWrap, cartClose)
const cartBody = el('div', 'fst-cart-body')
const cartFoot = el('div', 'fst-cart-foot')
cartDialog.append(cartHead, cartBody, cartFoot)

cartDialog.addEventListener('click', event => {
  if (event.target !== cartDialog) return
  const r = cartDialog.getBoundingClientRect()
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) cartDialog.close()
})
let view = 'cart', form = null, formState = { name: '', phone: '', slot: '', comment: '' }, lastOrder = null
bar.addEventListener('click', () => openCart())
export function openCart() {
  view = 'cart'
  renderCart()
  if (!cartDialog.isConnected) root.append(cartDialog)
  if (!cartDialog.open) cartDialog.showModal()
}
function blockedMenus() {
  return [...new Set(cart.map(row => row.menu))].filter(menu => !isOpen(menu))
}
// строка корзины недоступна, если её меню сейчас закрыто или суп не сегодняшнего дня.
const rowBlock = row => orderBlock(row.name, row.menu)
function slots(date = new Date()) {
  const menus = [...new Set(cart.map(row => row.menu))]
  if (!menus.length || cart.some(rowBlock)) return []
  const { day, minutes } = minskNow(date)
  // время получения — не раньше чем через PREP_MINUTES и не позже, чем через PREP_MINUTES после конца приёма.

  let start = 0, end = 1440
  for (const menu of menus) { const w = windowFor(menu, day); start = Math.max(start, w[0]); end = Math.min(end, w[1] + PREP_MINUTES) }
  // ресторан закрывается в 23:00 (CLOSE_MINUTES), позже время получения не предлагаем.
  end = Math.min(end, CLOSE_MINUTES)
  const first = Math.min(Math.ceil(Math.max(start, minutes + PREP_MINUTES) / 5) * 5, end)
  const out = []
  if (first <= end) out.push(clock(first))
  for (let t = Math.floor(first / SLOT_STEP) * SLOT_STEP + SLOT_STEP; t <= end && out.length < 40; t += SLOT_STEP) out.push(clock(t))
  return out
}
listeners.add(() => { if (cartDialog.open && view === 'cart') renderCart() })

function summary(container, compact = false) {
  const { subtotal, discount, total } = totals()
  const dl = el('dl', `fst-summary${compact ? ' is-compact' : ''}`)

  const row = (label, value, className = '', more = '') => { const r = el('div', `fst-sum-row ${className}`); const dt = el('dt', '', label); if (more) dt.append(el('span', 'fst-sum-more', more)); r.append(dt, el('dd', '', value)); dl.append(r) }

  if (compact) {
    row('К оплате', fmt(total), 'is-total')
    if (discount) dl.append(el('p', 'fst-sum-note', `Скидка 20 % на основное меню: −${fmt(discount)}`))
    container.append(dl)
    return
  }

  if (discount) row('Сумма', fmt(subtotal), '', ' заказа')
  if (discount) row('Скидка 20 %', `−${fmt(discount)}`, 'is-discount', ' на основное меню')
  row('Итого', fmt(total), 'is-total')
  container.append(dl)
}
function primary(text, onClick, disabled = false) {
  const button = el('button', 'fst-primary', text)
  button.type = 'button'; button.disabled = disabled
  if (onClick) button.addEventListener('click', onClick)
  return button
}

function renderCart() {
  cartTitle.textContent = 'Ваш заказ'
  cartSub.hidden = false
  cartBody.replaceChildren(); cartFoot.replaceChildren()
  cartDialog.dataset.view = 'cart'
  renderUndo()
  if (!cart.length) {
    const empty = el('div', 'fst-empty')
    empty.append(el('p', 'fst-empty-title', 'В корзине пока пусто'), el('p', '', 'Добавьте блюда из меню — они появятся здесь'))
    const back = el('button', 'fst-secondary', 'Выбрать блюда'); back.type = 'button'
    back.addEventListener('click', () => cartDialog.close())
    empty.append(back)
    cartBody.append(empty)
    return
  }
  const list = el('ul', 'fst-lines')
  const closed = blockedMenus()
  const offRows = cart.filter(rowBlock)
  for (const row of cart) {
    const reason = rowBlock(row), off = Boolean(reason)
    const li = el('li', `fst-line${off ? ' is-off' : ''}`)
    const img = el('img'); img.src = asset(row.image?.replace('/remote-menu/', '/remote-menu-tall/')); img.alt = ''; img.width = 72; img.height = 72; img.loading = 'lazy'
    const info = el('div', 'fst-line-info')
    info.append(el('p', 'fst-line-name', guillemets(row.name)))

    if (off || row.qty > 1) info.append(el('p', 'fst-line-meta', off ? (closed.includes(row.menu) ? `${menuTitles[row.menu]} — можно заказать ${opensText(row.menu)}` : `Суп дня — ${reason.toLocaleLowerCase('ru')}`) : `${fmt(row.price)} × ${row.qty}`))
    const actions = el('div', 'fst-line-actions')
    const item = { id: row.id, name: row.name, price: row.price / 100, image: row.image }
    actions.append(stepper(row.qty, row.name, () => { focusLine(row.id, 'minus'); setQty(item, row.menu, row.qty - 1) }, () => { focusLine(row.id, 'plus'); setQty(item, row.menu, row.qty + 1) }, false, off))
    const remove = el('button', 'fst-remove', 'Удалить'); remove.type = 'button'
    remove.setAttribute('aria-label', `Удалить из корзины: ${row.name}`)
    remove.addEventListener('click', () => removeLine(item, row))

    const total = el('strong', 'fst-line-total', fmt(row.price * row.qty))
    actions.append(total, remove)
    li.dataset.id = row.id
    li.append(img, info, actions)
    list.append(li)
  }
  cartBody.append(list)
  if (offRows.length) {
    const soupsOnly = !closed.length
    const warn = el('p', 'fst-warn', soupsOnly ? 'Этот суп готовим в другой день. Удалите его, чтобы оформить заказ' : `${closed.map(m => `«${menuTitles[m]}»`).join(' и ')} сейчас не принимаем. Удалите эти блюда, чтобы оформить заказ`)
    warn.setAttribute('role', 'alert')
    cartBody.append(warn)
  }
  summary(cartFoot)
  cartFoot.append(primary('Перейти к оформлению', () => { view = 'checkout'; renderCheckout() }, offRows.length > 0))
  if (lineFocus) {
    const target = cartBody.querySelector(`.fst-line[data-id="${lineFocus.id}"] [data-step="${lineFocus.step}"]:not(:disabled)`) || cartBody.querySelector(`.fst-line[data-id="${lineFocus.id}"] button:not(:disabled)`) || cartBody.querySelector('.fst-line button') || cartClose
    target.focus({ preventScroll: true })
    lineFocus = null
  }
}
let lineFocus = null
function focusLine(id, step) { lineFocus = { id, step } }

let undo = null, undoTimer
function clearUndo() { undo = null; clearTimeout(undoTimer) }
function removeLine(item, row) {
  clearUndo()
  undo = { item, menu: row.menu, qty: row.qty, name: row.name }
  undoTimer = setTimeout(() => { undo = null; if (cartDialog.open && cartDialog.dataset.view === 'cart') { const had = cartBody.querySelector('.fst-undo button') === document.activeElement; renderCart(); if (had) cartClose.focus() } }, 8000)
  setQty(item, row.menu, 0)
  if (cartDialog.dataset.view === 'cart') cartBody.querySelector('.fst-undo button')?.focus()
}
function renderUndo() {
  if (!undo) return
  const box = el('div', 'fst-undo')
  box.setAttribute('role', 'status')
  box.append(el('span', '', `«${guillemets(undo.name)}» удалено`))
  const back = el('button', '', 'Вернуть'); back.type = 'button'
  back.addEventListener('click', () => { const { item, menu, qty } = undo; clearUndo(); setQty(item, menu, qty); cartBody.querySelector(`.fst-line[data-id="${CSS.escape(item.id)}"] button`)?.focus() })
  box.append(back)
  cartBody.append(box)
}

function formatPhone(raw) {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('375')) digits = digits.slice(3)
  else if (digits.startsWith('80')) digits = digits.slice(2)

  if (digits.length > 9 && digits.startsWith('375')) digits = digits.slice(3)
  else if (digits.length > 9 && digits.startsWith('80')) digits = digits.slice(2)
  digits = digits.slice(0, 9)
  let out = '+375'
  if (digits.length) out += ` (${digits.slice(0, 2)}`
  if (digits.length >= 2) out += ')'
  if (digits.length > 2) out += ` ${digits.slice(2, 5)}`
  if (digits.length > 5) out += `-${digits.slice(5, 7)}`
  if (digits.length > 7) out += `-${digits.slice(7, 9)}`
  return { text: out, digits }
}
function field(id, label, input, hint) {
  const wrap = el('div', 'fst-field')
  const lab = el('label', '', label); lab.htmlFor = id
  input.id = id
  const error = el('p', 'fst-error'); error.id = `${id}-error`
  wrap.append(lab, input)
  if (hint) { const h = el('p', 'fst-hint', hint); h.id = `${id}-hint`; wrap.append(h); input.setAttribute('aria-describedby', h.id) }
  wrap.append(error)
  return wrap
}
function setError(input, message) {
  const error = cartBody.querySelector(`#${input.id}-error`)
  error.textContent = message || ''
  input.toggleAttribute('aria-invalid', Boolean(message))
  if (message) input.setAttribute('aria-invalid', 'true')

  const described = [message ? `${input.id}-error` : `${input.id}-hint`].filter(id => cartBody.querySelector(`#${id}`)?.textContent)
  if (described.length) input.setAttribute('aria-describedby', described.join(' ')); else input.removeAttribute('aria-describedby')
  input.closest('.fst-field').classList.toggle('has-error', Boolean(message))
}
function renderCheckout() {
  cartDialog.dataset.view = 'checkout'
  cartTitle.textContent = 'Оформление'
  cartSub.hidden = false
  cartBody.replaceChildren(); cartFoot.replaceChildren()
  const back = el('button', 'fst-back fst-back-inline')
  back.type = 'button'; back.append(el('span', '', '←'), el('span', '', 'К корзине'))
  back.addEventListener('click', () => { view = 'cart'; renderCart() })
  form = el('form', 'fst-form')
  form.noValidate = true
  form.id = 'fst-checkout-form'
  const name = el('input'); name.name = 'name'; name.autocomplete = 'given-name'; name.value = formState.name; name.maxLength = 60
  const phone = el('input'); phone.name = 'phone'; phone.type = 'tel'; phone.inputMode = 'tel'; phone.autocomplete = 'tel'; phone.placeholder = '+375 (__) ___-__-__'; phone.value = formState.phone
  phone.addEventListener('focus', () => { if (!phone.value) phone.value = '+375 (' })
  phone.addEventListener('blur', () => { if (formatPhone(phone.value).digits.length === 0) phone.value = '' })
  phone.addEventListener('input', () => { const caretAtEnd = phone.selectionStart === phone.value.length; phone.value = formatPhone(phone.value).text; if (caretAtEnd) phone.setSelectionRange(phone.value.length, phone.value.length); formState.phone = phone.value; if (phone.getAttribute('aria-invalid')) validate(phone) })
  name.addEventListener('input', () => { formState.name = name.value; if (name.getAttribute('aria-invalid')) validate(name) })
  const slot = el('select'); slot.name = 'slot'
  const available = slots()
  const placeholder = el('option', '', available.length ? 'Выберите время' : 'Сегодня свободного времени нет'); placeholder.value = ''
  slot.append(placeholder)
  available.forEach((time, index) => { const o = el('option', '', index === 0 ? `${time} — ближайшее` : time); o.value = time; slot.append(o) })
  slot.value = available.includes(formState.slot) ? formState.slot : (available[0] || '')
  slot.addEventListener('change', () => { formState.slot = slot.value; validate(slot) })
  const comment = el('textarea'); comment.name = 'comment'; comment.rows = 3; comment.maxLength = 300; comment.value = formState.comment
  comment.placeholder = 'Например: без лука, приборы на двоих'
  comment.addEventListener('input', () => { formState.comment = comment.value })
  form.append(
    field('fst-name', 'Имя', name),
    field('fst-phone', 'Телефон', phone, 'Перезвоним, чтобы подтвердить заказ'),
    field('fst-slot', 'Время получения', slot, available.length ? `Сегодня, готовим около ${PREP_MINUTES} минут` : 'Заказ на сегодня уже не успеем приготовить — позвоните в ресторан'),
    field('fst-comment', 'Комментарий к заказу', comment, 'Необязательно'),
  )
  const { count } = totals()
  const brief = el('p', 'fst-brief', `${count} ${plural(count, 'позиция', 'позиции', 'позиций')} в заказе · оплата при получении`)
  cartBody.append(back, brief, form)
  summary(cartFoot, true)
  const submit = primary('Оформить заказ', null, !available.length)
  submit.type = 'submit'; submit.setAttribute('form', form.id)
  cartFoot.append(submit)
  form.addEventListener('submit', event => {
    event.preventDefault()
    const invalid = [name, phone, slot].filter(input => !validate(input))
    if (invalid.length) { invalid[0].focus(); return }
    complete({ name: name.value.trim(), phone: phone.value, slot: slot.value })
  })

  ;(matchMedia('(hover: hover)').matches ? name : cartClose).focus({ preventScroll: true })
}
function validate(input) {
  let message = ''
  if (input.name === 'name') {
    const v = input.value.trim()
    if (!v) message = 'Укажите имя, чтобы мы знали, к кому обратиться'
    else if (v.length < 2 || !/[A-Za-zА-Яа-яЁёІіЎў]/.test(v)) message = 'Имя должно содержать хотя бы две буквы'
  } else if (input.name === 'phone') {
    const digits = formatPhone(input.value).digits
    if (!digits.length) message = 'Укажите телефон для подтверждения заказа'
    else if (digits.length < 9) message = 'Номер неполный: нужен код оператора и 7 цифр, например +375 (29) 123-45-67'
  } else if (input.name === 'slot' && !input.value) message = 'Выберите время получения'
  setError(input, message)
  return !message
}
function complete(data) {
  const sums = totals()
  lastOrder = { number: String(Math.floor(Date.now() / 1000) % 100000).padStart(5, '0'), ...data, ...sums }
  cart = []; formState.slot = ''; formState.comment = ''
  save()
  view = 'done'
  renderDone()
}
function renderDone() {
  cartDialog.dataset.view = 'done'
  cartTitle.textContent = 'Заказ принят'
  cartSub.hidden = true
  cartBody.replaceChildren(); cartFoot.replaceChildren()
  const box = el('div', 'fst-done')
  const mark = el('span', 'fst-done-mark'); mark.setAttribute('aria-hidden', 'true')
  mark.innerHTML = '<svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15.5l6 6L24 9"/></svg>'
  box.append(mark, el('p', 'fst-done-title', `Спасибо, ${lastOrder.name}!`))
  const dl = el('dl', 'fst-done-list')
  const row = (k, v) => { const r = el('div', ''); r.append(el('dt', '', k), el('dd', '', v)); dl.append(r) }
  row('Номер заказа', `№ ${lastOrder.number}`)
  row(lastOrder.discount ? 'Сумма со скидкой' : 'Сумма', fmt(lastOrder.total))
  row('Получение', `сегодня в ${lastOrder.slot}`)
  row('Адрес', `${ADDRESS}, ресторан «ФаСоль»`)
  box.append(dl, el('p', 'fst-done-note', 'Оплата при получении. Если планы изменятся — позвоните нам'))
  cartBody.append(box)
  const call = el('a', 'fst-primary', `Позвонить: ${PHONE_TEXT}`); call.href = PHONE_HREF
  const back = el('button', 'fst-secondary', 'Вернуться к меню'); back.type = 'button'
  back.addEventListener('click', () => cartDialog.close())
  cartFoot.append(call, back)
  cartClose.focus({ preventScroll: true })
}
cartDialog.addEventListener('close', () => { if (view === 'done') view = 'cart' })
renderBar()
preloadMenuImages()
