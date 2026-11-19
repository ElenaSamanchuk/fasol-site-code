import { loadLiveMenu } from './menu-api.js'
import dishSizes from './dish-sizes.js'
import { getFasolOptions, loadSiteConfig, applySiteConfig } from './site-bindings.js'
import { cartControl, decorateCatalog, decorateSoups, menuFade, soupDayOf, takeawayChooser, wheelTabs } from './store.js'

const root = document.querySelector('#fasol-site')
const asset = path => new URL(path, new URL(root.dataset.assets || './', location.href)).href
const menuDialog = root.querySelector('#fs-menu-dialog')
const menuContent = root.querySelector('#fs-menu-content')
const menuOrderFooter = node('div', 'fs-menu-order-footer')
menuOrderFooter.hidden = true
const menuOrder = node('a', 'fs-menu-order', 'Навынос: −20\u00a0% на\u00a0основное\u00a0меню')
menuOrder.href = '#takeaway'
menuOrder.dataset.takeaway = ''
menuOrderFooter.append(menuOrder)
menuDialog.append(menuOrderFooter)
const nav = root.querySelector('#fs-navigation')
const toggle = root.querySelector('.fs-nav-toggle')
const photo = root.querySelector('#fs-photo-dialog')
const { orderUrl, liveApi } = getFasolOptions()
root.querySelectorAll('a[href="https://fasol.orionhall.by/"]').forEach(link => { link.href = orderUrl })
void loadSiteConfig().then(({ site, live }) => { applySiteConfig(site); root.dataset.configSource = live ? 'live' : 'snapshot' }).catch(() => { root.dataset.configSource = 'static' })
let catalogPromise, menuGeneration = 0
function openDialog(dialog) {
  dialog.showModal(); document.body.style.overflow = 'hidden'

  if (dialog.id === 'fs-menu-dialog') { const title = dialog.querySelector('#fs-menu-title'); if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }) } }
}
function restoreScroll() { if (!root.querySelector('dialog[open]')) document.body.style.overflow = '' }
root.querySelectorAll('dialog').forEach(dialog => {
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close())
  dialog.addEventListener('close', () => { restoreScroll(); if (dialog === nav) toggle.setAttribute('aria-expanded', 'false') })
  dialog.addEventListener('click', event => {
    const r = dialog.getBoundingClientRect()
    if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close()
  })
})
toggle.addEventListener('click', () => { openDialog(nav); toggle.setAttribute('aria-expanded', 'true') })
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => nav.close()))
const info = root.querySelector('#fs-info-dialog')
const infoPanels = ['interior', 'gifts', 'jobs', 'reviews']
function showInfo(id) {
  info.querySelectorAll('[data-info-panel]').forEach(panel => { panel.hidden = panel.dataset.infoPanel !== id })
  info.setAttribute('aria-label', root.querySelector(`#${id} h2`)?.textContent || 'Информация о ресторане')
  openDialog(info)
}
root.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#"]')
  const id = link?.getAttribute('href')?.slice(1)
  if (infoPanels.includes(id)) { event.preventDefault(); showInfo(id) }
})
if (infoPanels.includes(location.hash.slice(1))) showInfo(location.hash.slice(1))
function node(tag, className, content) {
  const element = document.createElement(tag)
  if (className) element.className = className
  if (content) element.textContent = content
  return element
}
const photoImage = photo.querySelector('img')
const photoCaption = photo.querySelector('p')
const photoStage = node('div', 'fs-photo-stage')
photoImage.replaceWith(photoStage)
photoStage.append(photoImage)
const photoControls = node('div', 'fs-photo-controls')
const photoPrevious = node('button', 'fs-photo-step')
const photoNext = node('button', 'fs-photo-step')
const photoArrow = path => `<svg viewBox="0 0 48 24" width="28" height="14" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="${path}"/></svg>`
photoPrevious.innerHTML = photoArrow('M47 12H2M12 3 2 12l10 9')
photoNext.innerHTML = photoArrow('M1 12h45M36 3l10 9-10 9')
document.querySelectorAll('[data-gallery-step]').forEach(button => { button.innerHTML = photoArrow(button.dataset.galleryStep === '-1' ? 'M47 12H2M12 3 2 12l10 9' : 'M1 12h45M36 3l10 9-10 9') })
const photoAmbient = node('div', 'fs-photo-ambient')
const photoProgress = node('i', 'fs-photo-progress')
const photoMotion = matchMedia('(prefers-reduced-motion: reduce)')
photo.prepend(photoAmbient)
const photoCounter = node('span', 'fs-photo-count')
photoPrevious.type = photoNext.type = 'button'
photoPrevious.setAttribute('aria-label', 'Предыдущее фото')
photoNext.setAttribute('aria-label', 'Следующее фото')
photoCounter.setAttribute('role', 'status')
photoCounter.setAttribute('aria-live', 'polite')
photoCounter.setAttribute('aria-atomic', 'true')
photoControls.append(photoPrevious, photoCounter, photoNext)
photoControls.hidden = true
photo.append(photoControls, photoProgress)
let photoAlbum = [], photoPosition = 0, photoGesture = null, ignorePhotoClickUntil = 0, photoRender = 0

const photoTouches = new Set()
let photoPan = null, photoPanMoved = false
const photoAlbums = {

  interior: { title: 'Интерьер ресторана', codes: [3825, 3817, 3818, 3819, 3820, 3823, 3824, 3826, 3827, 3828, 3830, 3831, 3832, 3833] },
  terrace: { title: 'Летняя терраса', codes: [3836, 3837, 3838] },
  kids: { title: 'Для детей: комната и стульчики', codes: [3816, 3822, 3829, 3834] },
}
root.querySelectorAll('#interior .fs-gallery [data-photo]').forEach((button, index) => {
  const key = ['interior', 'terrace', 'kids'][index], album = photoAlbums[key]
  if (!album) return
  button.dataset.gallery = key
  button.setAttribute('aria-label', `Открыть альбом: ${album.title}, ${album.codes.length} фото`)
  button.append(node('small', 'fs-gallery-count', `${album.codes.length} фото`))
})

function fetchPhoto(src, attempt = 0) {
  return new Promise((resolve, reject) => {
    const probe = new Image()
    probe.onload = () => resolve(probe.src)
    probe.onerror = () => {
      if (attempt >= 2) reject(new Error('photo'))
      else setTimeout(() => fetchPhoto(src, attempt + 1).then(resolve, reject), 450)
    }
    probe.src = attempt ? `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}` : src
  })
}
function settlePhoto() {
  const from = photoImage.style.transform
  photoImage.style.transform = photoImage.style.opacity = ''
  if (from && !photoMotion.matches) photoImage.animate([{ transform: from }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.45,0,.25,1)' })
}
function renderPhoto(direction = 0) {
  const current = photoAlbum[photoPosition]
  if (!current) return
  const isAlbum = photoAlbum.length > 1, token = ++photoRender
  photo.classList.remove('fs-zoomed'); photoImage.style.width = ''
  photo.classList.toggle('fs-album', isAlbum)
  photoControls.hidden = !isAlbum
  delete photoStage.dataset.failed
  const updateCaption = () => {
    photoCaption.textContent = current.caption
    photoCounter.textContent = `${photoPosition + 1} / ${photoAlbum.length}`
    photoCounter.setAttribute('aria-label', `Фото ${photoPosition + 1} из ${photoAlbum.length}`)
    photoProgress.style.setProperty('--fs-photo-progress', String((photoPosition + 1) / photoAlbum.length))
  }
  const slow = setTimeout(() => { if (token === photoRender) photo.classList.add('fs-photo-loading') }, 220)
  fetchPhoto(asset(current.src)).then(url => {
    if (token !== photoRender) return
    updateCaption()
    photoImage.src = url
    photoImage.alt = isAlbum ? `${current.caption}, фото ${photoPosition + 1} из ${photoAlbum.length}` : current.caption
    photoAmbient.style.backgroundImage = `url("${url}")`
    photoImage.style.transform = photoImage.style.opacity = ''
    if (!photoMotion.matches) photoImage.animate([{ opacity: 0, transform: direction ? `translateX(${direction * 44}px)` : 'scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 340, easing: 'cubic-bezier(.45,0,.25,1)' })
  }).catch(() => {
    if (token !== photoRender) return
    if (isAlbum) {

      photoAlbum.splice(photoPosition, 1)
      if (direction < 0) photoPosition--
      photoPosition = (photoPosition + photoAlbum.length) % photoAlbum.length
      renderPhoto(direction)
      return
    }
    photoImage.removeAttribute('src')
    updateCaption()
    photoImage.style.transform = photoImage.style.opacity = ''
    photoStage.dataset.failed = 'true'
  }).finally(() => {
    clearTimeout(slow)
    if (token === photoRender) photo.classList.remove('fs-photo-loading')
  })
  if (isAlbum) [1, -1].forEach(step => { new Image().src = asset(photoAlbum[(photoPosition + step + photoAlbum.length) % photoAlbum.length].src) })
}
function showPhoto(src, caption, album = null, start = 0) {
  photoAlbum = album ? [...album] : [{ src, caption }]
  photoPosition = start
  photoGesture = null
  ignorePhotoClickUntil = 0
  photoImage.style.opacity = '0'
  photoImage.removeAttribute('alt')
  photoCaption.textContent = photoCounter.textContent = ''
  photoCounter.removeAttribute('aria-label')
  photoProgress.style.setProperty('--fs-photo-progress', '0')
  photoAmbient.style.backgroundImage = 'none'
  renderPhoto()
  openDialog(photo)
}
function stepPhoto(direction) {
  if (!photo.open || photoAlbum.length < 2) return
  photoPosition = (photoPosition + direction + photoAlbum.length) % photoAlbum.length
  renderPhoto(direction)
}
root.querySelectorAll('[data-photo]').forEach(button => button.addEventListener('click', () => {
  const album = photoAlbums[button.dataset.gallery]
  const rail = button.closest('.fs-about-gallery')
  if (rail) {
    const cards = [...rail.querySelectorAll('[data-photo]')]
    showPhoto(button.dataset.photo, button.dataset.caption, cards.map(card => ({ src: card.dataset.photo, caption: card.dataset.caption })), cards.indexOf(button))
  } else if (album) {
    const entries = album.codes.map(code => ({ src: code === 3825 ? './img/client-20261113/interior-3825.webp' : `./img/client-20261104/${code}.webp`, caption: album.title }))
    showPhoto(entries[0].src, album.title, entries)
  } else showPhoto(button.dataset.photo, button.dataset.caption)
}))
photoPrevious.addEventListener('click', () => stepPhoto(-1))
photoNext.addEventListener('click', () => stepPhoto(1))
photo.addEventListener('keydown', event => {
  if (photoAlbum.length < 2 || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return
  event.preventDefault()
  event.stopPropagation()
  stepPhoto(event.key === 'ArrowRight' ? 1 : -1)
})
photoStage.addEventListener('pointerdown', event => {
  if (event.pointerType === 'touch') photoTouches.add(event.pointerId)
  if (photoTouches.size > 1) { if (photoGesture) { photoGesture = null; settlePhoto() } return }
  if (photo.classList.contains('fs-zoomed') && event.pointerType === 'mouse' && photoAlbum.length > 1) { photoPan = { x: event.clientX, y: event.clientY, left: photoStage.scrollLeft, top: photoStage.scrollTop }; photoPanMoved = false; event.preventDefault(); return }
  if (photoAlbum.length < 2 || event.pointerType === 'mouse' || photo.classList.contains('fs-zoomed') || (window.visualViewport?.scale || 1) > 1.01) return
  photoGesture = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now() }
})
photoStage.addEventListener('pointermove', event => {
  if (!photoGesture || photoGesture.id !== event.pointerId) return
  const dx = event.clientX - photoGesture.x, dy = event.clientY - photoGesture.y
  if (Math.abs(dx) <= Math.abs(dy)) return
  photoImage.style.transform = `translateX(${dx}px)`
  photoImage.style.opacity = String(Math.max(.4, 1 - Math.abs(dx) / (innerWidth * 1.2)))
})
photoStage.addEventListener('pointerup', event => {
  const gesture = photoGesture
  photoGesture = null
  if (!gesture || gesture.id !== event.pointerId) return
  const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y
  if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.4) { settlePhoto(); return }
  ignorePhotoClickUntil = performance.now() + 350
  stepPhoto(dx < 0 ? 1 : -1)
})
photoStage.addEventListener('pointercancel', () => { photoGesture = null; settlePhoto() })
photo.addEventListener('close', () => {
  photoGesture = null
  photoRender++
  photo.classList.remove('fs-photo-loading')
})
for (const type of ['pointerup', 'pointercancel']) photoStage.addEventListener(type, event => photoTouches.delete(event.pointerId))
addEventListener('pointermove', event => {
  if (!photoPan) return
  const dx = event.clientX - photoPan.x, dy = event.clientY - photoPan.y
  if (Math.abs(dx) + Math.abs(dy) > 4) photoPanMoved = true
  photoStage.scrollLeft = photoPan.left - dx; photoStage.scrollTop = photoPan.top - dy
})
addEventListener('pointerup', () => { photoPan = null })
function zoomPhoto(event) {
  if (photo.classList.contains('fs-zoomed')) { photo.classList.remove('fs-zoomed'); photoImage.style.width = ''; return }
  if (photoAlbum.length < 2) { photo.classList.add('fs-zoomed'); return }
  const nw = photoImage.naturalWidth, nh = photoImage.naturalHeight
  if (!nw || !nh) return

  const r = photoImage.getBoundingClientRect(), scale = Math.min(r.width / nw, r.height / nh), fw = nw * scale, fh = nh * scale
  const fx = Math.min(1, Math.max(0, (event.clientX - r.left - (r.width - fw) / 2) / fw)), fy = Math.min(1, Math.max(0, (event.clientY - r.top - (r.height - fh) / 2) / fh))
  const width = Math.max(fw * 2, Math.min(nw, fw * 3)), height = width * nh / nw
  photo.classList.add('fs-zoomed'); photoImage.style.width = `${Math.round(width)}px`
  photoStage.scrollLeft = fx * width - photoStage.clientWidth / 2; photoStage.scrollTop = fy * height - photoStage.clientHeight / 2
}
photoImage.addEventListener('click', event => {
  if (performance.now() < ignorePhotoClickUntil || photoPanMoved) { photoPanMoved = false; return }
  zoomPhoto(event)
})

const menuPlate = root.querySelector('#menu .fs-menu-plate')

const menuPlateFrames = [...['main', 'lunch', 'breakfast'].map(name => `./img/client-20261117/${matchMedia('(max-width:600px)').matches ? 'm/' : ''}menu-${name}.webp`), `./img/client-20261119/${matchMedia('(max-width:600px)').matches ? 'm/' : ''}menu-dessert.webp`].map(src => asset(src))
menuPlate.querySelector('img').src = menuPlateFrames[0]
const plateFront = menuPlate.querySelector('img'), plateNext = plateFront.cloneNode()
let plateIndex = 0, plateBusy = false, plateVisible = false
menuPlate.classList.add('fs-rotating-stage')
plateNext.classList.add('fs-slide-next'); plateNext.alt = ''; plateNext.setAttribute('aria-hidden', 'true')
plateFront.after(plateNext)
new IntersectionObserver(entries => { plateVisible = entries.some(entry => entry.isIntersecting) }, { rootMargin: '200px' }).observe(menuPlate)
setInterval(async () => {
  if (!plateVisible || document.hidden || photoMotion.matches || plateBusy) return
  plateBusy = true
  const nextIndex = (plateIndex + 1) % menuPlateFrames.length, url = menuPlateFrames[nextIndex], preload = new Image()
  preload.src = url
  try { await preload.decode() } catch { plateBusy = false; return }
  plateNext.src = url
  plateNext.classList.add('is-visible')
  setTimeout(async () => {
    plateFront.src = url
    try { await plateFront.decode() } catch {}
    plateNext.classList.remove('is-visible')
    plateIndex = nextIndex; plateBusy = false
  }, 1900)
}, 7000)
async function json(url) { const response = await fetch(asset(url)); if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json() }
const titles = { main: 'Основное меню', breakfast: 'Завтраки', lunch: 'Домашние обеды', desserts: 'Десерты, кофе и чай', kids: 'Детское меню', bar: 'Барная карта', drinks: 'Безалкогольные напитки' }
const roots = { main: 5139, breakfast: 6846, lunch: 5474 }
const price = value => new Intl.NumberFormat('ru-BY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))

const menuHours = { breakfast: 'Пн–пт 9:00–11:55 · сб–вс 10:00–11:55', lunch: 'Пн–пт 12:00–14:55', main: 'Ежедневно 12:00–22:35' }
const serveHours = { breakfast: 'Пн–пт 9:00–12:00 · сб–вс 10:00–12:00', lunch: 'Пн–пт 12:00–15:00', main: 'Ежедневно 12:00–23:00' }
const takeawayUntil = { breakfast: '11:55', lunch: '14:55', main: '22:35' }
function available(type, date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Minsk', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(p => [p.type, p.value]))
  const time = Number(parts.hour) * 60 + Number(parts.minute), weekend = ['Sat', 'Sun'].includes(parts.weekday)
  return type === 'breakfast' ? time >= (weekend ? 600 : 540) && time <= 715 : type === 'lunch' ? !weekend && time >= 720 && time <= 895 : time >= 720 && time <= 1355
}
function printCategory(item) {
  const name = item.name.toLocaleLowerCase('ru')
  if (item.root !== roots.main) return item.category
  if (/карпаччо|тартар/.test(name)) return 'Карпаччо и тартар'
  if ([1309, 683, 688, 1321, 1864, 1865].includes(item.id)) return 'Горячие закуски'
  if ([1707, 1708, 1715, 713, 1716, 1324].includes(item.id)) return 'Закуски'
  if (item.category === 'САЛАТЫ И ЗАКУСКИ') return 'Салаты'
  if (/лазанья|спагетти|пенне|тальятелле/.test(name)) return 'Пасты'
  return item.category
}

const NB = '\u00a0'
function typo(text) {
  return String(text || '').replace(/\s+/g, ' ').trim()
    .replace(/"([^"]+)"/g, '«$1»')
    .replace(/(?<![А-Яа-яЁёA-Za-z])(в|во|на|с|со|и|из|к|ко|у|по|от|до|за|о|об)\s+/gi, `$1${NB}`)
    .replace(/(\d)\s+(г|гр|мл|л|кг|шт|мин|BYN|%)(?![А-Яа-яЁё])/g, `$1${NB}$2`)
    .replace(/(?<!\.)\.\s*$/, '')
    .replace(/\s+,/g, ',')
}

function splitDescription(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  const match = clean.match(/^(.*?)\s*Вес\s*[-–:]?\s*([\d\s/.,]+?)\s*(?:гр?|g)\.?\s*$/i)
  return match ? { text: typo(match[1]), weight: `${match[2].replace(/\s+/g, '')}${NB}г` } : { text: typo(clean), weight: '' }
}

function dishImage(card, item) {
  if (!String(item.image || '').trim()) { card.classList.add('is-no-photo'); return }
  const image = node('img')

  image.loading = 'lazy'; image.alt = typo(item.name)

  const file = item.image.split('/').pop(), size = dishSizes[file] || [450, 450]
  image.src = asset(item.image); image.width = size[0]; image.height = size[1]; image.style.setProperty('--ratio', `${size[0]} / ${size[1]}`)

  const frame = node('span', 'fs-dish-ph'); frame.append(image)
  image.addEventListener('error', () => { frame.remove(); card.classList.add('is-no-photo') }, { once: true })
  card.append(frame)
}
function dishDescription(item) {
  const { text, weight: textWeight } = splitDescription(item.description)

  const baseWeight = String(item.nutrition?.weight ?? '').trim()
  const weight = textWeight || (baseWeight ? (baseWeight.includes('/') ? baseWeight : `${baseWeight}${NB}г`) : '')
  const p = node('p', '')
  if (text) p.append(node('span', 'fs-dish-desc', text))
  if (weight) p.append(node('span', 'fs-dish-weight', weight))
  const nutrition = dishNutrition(item.nutrition)
  if (nutrition) p.append(nutrition)
  return p
}

function dishNutrition(data) {
  if (!data) return null
  const value = key => { const text = String(data[key] ?? '').trim(); return text || null }
  const macros = ['calories', 'protein', 'fat', 'carbohydrate']
  if (macros.every(key => !value(key) || Number(value(key)) === 0)) return null
  const gram = text => (/[гg]\s*$/i.test(text) || text.includes('/') ? text : `${text}${NB}г`)
  const rows = [['Ккал', value('calories')], ['Белки', value('protein') && gram(value('protein'))], ['Жиры', value('fat') && gram(value('fat'))], ['Углеводы', value('carbohydrate') && gram(value('carbohydrate'))]].filter(([, shown]) => shown)
  const box = node('span', 'fs-dish-kbju')
  for (const [label, shown] of rows) { const row = node('span', 'fs-dish-kbju-row'); row.append(node('span', '', label), node('span', '', shown)); box.append(row) }
  return box
}

function dishBody(card, item, extra) {
  const { text, weight: textWeight } = splitDescription(item.description)
  const baseWeight = String(item.nutrition?.weight ?? '').trim()
  const weight = textWeight || (baseWeight ? (baseWeight.includes('/') ? baseWeight : `${baseWeight}${NB}г`) : '')

  const textBox = node('div', 'fs-dish-text')
  textBox.append(node('h3', '', typo(item.name)), node('p', 'fs-dish-weight', weight))
  const desc = node('p', 'fs-dish-desc', text)
  if (text.length > 60) {
    desc.tabIndex = 0; desc.setAttribute('role', 'button'); desc.setAttribute('aria-expanded', 'false')
    const toggle = () => { const open = desc.classList.toggle('is-open'); desc.setAttribute('aria-expanded', String(open)) }
    desc.addEventListener('click', event => { event.stopPropagation(); toggle() })
    desc.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle() } })
  }
  textBox.append(desc); card.append(textBox)
  const nutrition = dishNutrition(item.nutrition)

  if (nutrition) { nutrition.prepend(node('span', 'fs-dish-kbju-title', 'Пищевая ценность и вес')); card.append(nutrition) }
  const row = node('div', 'fs-dish-row'); row.append(...extra); card.append(row)
}
function renderCatalog(data, type, takeaway = false) {
  menuDialog.dataset.catalogStyle = 'b'
  menuDialog.dataset.card = '4'
  const categories = node('div', 'fs-menu-categories'); categories.setAttribute('aria-label', 'Разделы меню')
  const grid = node('div', 'fs-dishes'); grid.setAttribute('aria-live', 'polite')
  const items = data.items.filter(item => item.root === roots[type]).map(item => ({ ...item, category: printCategory(item) }))
  const names = [...new Set(items.map(item => item.category))]
  const printOrder = ['Салаты', 'Закуски', 'Горячие закуски', 'Карпаччо и тартар', 'ФИРМЕННЫЕ СУПЫ', 'Пасты', 'ГОРЯЧИЕ БЛЮДА', 'ХОСПЕР ГРИЛЬ', 'ГАРНИРЫ', 'СОУСЫ', 'ХЛЕБ', 'ДЕСЕРТЫ']
  if (type === 'main') names.sort((a, b) => (printOrder.indexOf(a) + 1 || 99) - (printOrder.indexOf(b) + 1 || 99))
  if (type === 'main') names.push('Напитки безалкогольные')
  let selected = names[0]
  const label = text => { const clean = text.replace(/\s+обед(?![а-яё]).*$/i, '').trim(); return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase() }
  function render() {
    grid.replaceChildren()
    if (selected === 'Напитки безалкогольные') { renderTextGroups(grid, ['Кофе', 'Чай', 'Напитки']); return }
    for (const item of items.filter(item => item.category === selected)) {
      const card = node('article', 'fs-dish')

      dishImage(card, item)
      dishBody(card, item, takeaway ? [dishPrice(item.price, takeaway), cartControl(item, type, available(type))] : [dishPrice(item.price, takeaway)])
      grid.append(card)
    }
    if (!grid.children.length) grid.append(node('p', 'fs-empty', 'В этом разделе пока нет блюд'))
  }
  if (!takeaway) {

    const dishCard = item => {
      const card = node('article', 'fs-dish')
      dishImage(card, item)
      dishBody(card, item, [dishPrice(item.price, false)])
      const soup = soupDayOf(item.name, type)
      if (soup >= 0) card.dataset.soupDay = String(soup)
      return card
    }
    const sections = names.map(name => ({ name: label(name), fill: section => {
      if (name === 'Напитки безалкогольные') { renderTextGroups(section, ['Кофе', 'Чай', 'Напитки']); return }
      const grid = node('div', 'fs-dishes'); items.filter(item => item.category === name).forEach(item => grid.append(dishCard(item))); section.append(grid)
      if (type === 'lunch') decorateSoups(grid)
    } }))
    const schedule = node('p', 'fs-menu-hours', serveHours[type])
    const note = node('p', 'fs-menu-takeaway-note', `Заказ навынос принимаем до\u00a0${takeawayUntil[type]}`)
    menuContent.replaceChildren(schedule, note, ...feedMenu(sections))
    menuOrderFooter.hidden = false
    return
  }
  names.forEach(name => {
    const button = node('button', '', label(name)); button.setAttribute('aria-pressed', String(name === selected))
    button.addEventListener('click', () => { selected = name; categories.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button))); render(); const past = grid.getBoundingClientRect().top - categories.getBoundingClientRect().bottom - 16; if (past < 0) menuContent.scrollTop += past }); categories.append(button)
  })
  const schedule = node('p', 'fs-menu-hours', menuHours[type])
  menuContent.replaceChildren(schedule, categories, grid)
  decorateCatalog({ type, onBack: showTakeaway })
  menuOrderFooter.hidden = true
  render()
  {
    const refresh = setInterval(() => { if (!menuDialog.open) clearInterval(refresh); else render() }, 60000)
    menuDialog.addEventListener('close', () => clearInterval(refresh), { once: true })
  }
}

let printedGroups
let printedPromise
let printedBar
async function loadPrinted() { printedPromise ||= json('./data/printed-menu.json').then(data => { printedGroups = data.groups; printedBar = data.bar }).catch(error => { printedPromise = undefined; throw error }); return printedPromise }

function feedMenu(sections) {
  const categories = node('div', 'fs-menu-categories fs-feed-tabs'); categories.setAttribute('aria-label', 'Разделы меню')
  const feed = node('div', 'fs-menu-feed')
  const smooth = () => (photoMotion.matches ? 'auto' : 'smooth')
  const scroller = () => [menuContent, menuDialog].find(element => element.scrollHeight > element.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(element).overflowY)) || menuContent

  const tabsBottom = box => box.getBoundingClientRect().top + box.clientTop + (parseFloat(getComputedStyle(categories).top) || 0) + categories.offsetHeight
  let current = -1, lockUntil = 0, settleTimer, onSettle = () => {}
  const parts = sections.map(({ name, fill }, index) => {
    const section = node('section', 'fs-feed-section'); section.dataset.feedSection = name
    section.append(node('h3', 'fs-feed-heading', name)); fill(section); feed.append(section)
    const button = node('button', '', name); button.type = 'button'
    button.addEventListener('click', () => {
      const box = scroller()
      clearTimeout(settleTimer); box.removeEventListener('scrollend', onSettle)
      lockUntil = performance.now() + 5000
      mark(index)

      let fixes = 0
      const settle = () => {
        clearTimeout(settleTimer); box.removeEventListener('scrollend', onSettle)
        const delta = section.getBoundingClientRect().top - categories.getBoundingClientRect().bottom - 24
        const room = box.scrollHeight - box.clientHeight - box.scrollTop
        if (Math.abs(delta) > 2 && fixes < 2 && !(delta > 0 && room < 2)) { fixes++; go(box.scrollTop + delta); return }
        lockUntil = performance.now() + 150
      }
      const go = top => {
        onSettle = settle
        if ('onscrollend' in box) box.addEventListener('scrollend', onSettle, { once: true })
        const start = box.scrollTop
        let last = -1, still = 0, waited = 0
        const tick = () => { settleTimer = setTimeout(() => { const now = box.scrollTop; waited += 150; if (waited > 4000 || (now === last && ++still >= 2 && (Math.abs(now - start) > 1 || waited > 1200))) settle(); else { if (now !== last) still = 0; last = now; tick() } }, 150) }
        tick()
        box.scrollTo({ top, behavior: smooth() })
      }
      go(box.scrollTop + section.getBoundingClientRect().top - tabsBottom(box) - 24)
    })
    categories.append(button)
    return { button, section }
  })
  function mark(index) {
    if (index === current) return
    current = index
    parts.forEach(({ button }, i) => button.setAttribute('aria-pressed', String(i === index)))
    const button = parts[index].button
    if (categories.scrollWidth > categories.clientWidth) categories.scrollTo({ left: button.offsetLeft - (categories.clientWidth - button.offsetWidth) / 2, behavior: smooth() })
  }
  function sync() {

    if (!feed.isConnected) { [menuContent, menuDialog].forEach(element => element.removeEventListener('scroll', sync)); return }
    if (performance.now() < lockUntil) return

    const box = scroller(), line = categories.getBoundingClientRect().bottom + 24 + 2
    let index = 0
    parts.forEach(({ section }, i) => { if (section.getBoundingClientRect().top <= line) index = i })
    if (box.scrollTop + box.clientHeight >= box.scrollHeight - 4) index = parts.length - 1
    mark(index)
  }
  ;[menuContent, menuDialog].forEach(element => element.addEventListener('scroll', sync, { passive: true }))
  mark(0)

  const syncTabsFade = () => { categories.toggleAttribute('data-more-left', categories.scrollLeft > 2); categories.toggleAttribute('data-more-right', categories.scrollLeft + categories.clientWidth < categories.scrollWidth - 2) }
  categories.addEventListener('scroll', syncTabsFade, { passive: true })
  const tabsObserver = new ResizeObserver(() => { if (!categories.isConnected) { tabsObserver.disconnect(); return } syncTabsFade() })
  tabsObserver.observe(categories)
  wheelTabs(categories)
  return [categories, menuFade(categories, menuContent), feed]
}

function renderBarGroups(container, group) {
  const list = node('ul', 'fs-text-menu fs-bar-list')

  for (const raw of printedBar?.groups?.[group] || []) {
    const name = raw.replace(/ (мл|г|л)(?![а-яёА-ЯЁ])/g, '\u00a0$1').replace(/(\d) \/ (\d)/g, '$1\u00a0/\u00a0$2')
    const at = name.lastIndexOf(' · ')
    const row = node('li', 'fs-text-menu-row')
    if (at > 0 && /^\d/.test(name.slice(at + 3))) { const sep = node('span', 'fs-sr', ' · '); row.append(node('span', 'fs-bar-name', name.slice(0, at)), sep, node('span', 'fs-bar-vol', name.slice(at + 3))) }
    else row.append(node('span', 'fs-bar-name', name.replace(/ · (?=\d)/g, '\u00a0· ')))
    list.append(row)
  }
  container.append(list)
}
function renderTextGroups(container, groups) {
  for (const group of groups) {
    const section = node('section', 'fs-text-menu-section')
    if (group !== root.querySelector('#fs-menu-title').textContent) section.append(node('h3', '', group))
    const list = node('dl', 'fs-text-menu')
    for (const [name, amount] of printedGroups[group] || []) {
      const row = node('div', 'fs-text-menu-row'); row.append(node('dt', '', name.replace(/(?<![А-Яа-яЁёA-Za-z])(в|во|на|с|со|и|из|к|у|по|от|до|за|о|об) /gi, '$1\u00a0').replace(/ (мл|г|л)(?![а-яёА-ЯЁ])/g, '\u00a0$1').replace(/(\d) \/ (\d)/g, '$1\u00a0/\u00a0$2').replace(/ · (?=\d)/g, '\u00a0· ')), node('dd', '', `${amount.replaceAll('.', ',')} BYN`)); list.append(row)
    }
    section.append(list); container.append(section)
  }
}
function dishPrice(value, takeaway) {
  const box = node('strong', 'fs-dish-price')
  const rate = Number(root.dataset.pickupDiscount || 0)
  if (takeaway && rate > 0) box.append(node('s', '', `${price(value)}${NB}BYN`), document.createTextNode(`${price(Math.round(value * (1 - rate) * 100) / 100)}${NB}BYN`))
  else box.textContent = `${price(value)}${NB}BYN`
  return box
}

const kidsLinks = null
if (kidsLinks) new IntersectionObserver(async (entries, observer) => {
  if (!entries.some(entry => entry.isIntersecting)) return
  observer.disconnect()
  try {
    await loadPrinted()
    if (!printedGroups['Детское меню']?.length) return
    const box = node('div', 'fs-kids-inline')
    const hours = node('p', 'fs-kids-hours', 'Детское меню')
    hours.append(node('small', '', 'в будни с 15:00'), node('small', '', 'в выходные с 12:00'))
    box.append(hours)
    renderTextGroups(box, ['Детское меню'])
    box.querySelector('.fs-text-menu-section h3')?.remove()
    kidsLinks.replaceWith(box)
  } catch {}
}, { rootMargin: '600px' }).observe(kidsLinks)
function renderPrinted(type) {

  if (type === 'bar') {
    const sections = Object.keys(printedBar?.groups || {}).map(name => ({ name: name.replace(/ · 50 мл$/, ''), fill: section => {
      if (/ · 50 мл$/.test(name)) section.append(node('p', 'fs-bar-portion', 'Порция 50\u00a0мл'))
      renderBarGroups(section, name)
    } }))
    menuContent.replaceChildren(node('p', 'fs-menu-hours fs-bar-price-note', 'Для ознакомления. Цены уточняйте у\u00a0официанта'), ...feedMenu(sections))
    return
  }
  const groups = { drinks: ['Кофе', 'Чай', 'Напитки'], desserts: ['Кофе', 'Чай', 'Напитки'], kids: ['Детское меню'] }
  menuContent.replaceChildren()
  if (type === 'kids') menuContent.append(node('p', 'fs-menu-hours', 'В будни с 15:00 · в выходные с 12:00'))
  renderTextGroups(menuContent, groups[type] || groups.drinks)
}

function resetMenuScroll() { menuContent.scrollTop = 0; menuDialog.scrollTop = 0 }
async function showMenu(type, takeaway = false) {
  const generation = ++menuGeneration
  menuOrderFooter.hidden = true
  delete menuDialog.dataset.catalogStyle
  menuDialog.dataset.menuType = type
  root.querySelector('#fs-menu-title').textContent = titles[type] || 'Меню'
  menuContent.replaceChildren(node('p', 'fs-empty', 'Загружаем меню…'))
  if (!menuDialog.open) openDialog(menuDialog)
  resetMenuScroll()
  try {
    await loadPrinted()
    if (generation !== menuGeneration) return
    if (roots[type]) {
      catalogPromise ||= (getFasolOptions().liveApi ? loadLiveMenu().catch(() => json('./data/menu-snapshot.json')) : json('./data/menu-snapshot.json')).catch(error => { catalogPromise = undefined; throw error })
      const data = await catalogPromise; if (generation === menuGeneration) { renderCatalog(data, type, takeaway); resetMenuScroll() }
    } else { renderPrinted(type); resetMenuScroll() }
  } catch {
    if (generation !== menuGeneration) return
    const link = node('a', 'fs-button fs-solid', 'Открыть электронное меню'); link.href = orderUrl
    menuContent.replaceChildren(node('p', 'fs-empty', 'Не удалось загрузить меню'), link)
  }
}
function showTakeaway() {
  ++menuGeneration
  menuOrderFooter.hidden = true
  delete menuDialog.dataset.catalogStyle
  delete menuDialog.dataset.menuType
  root.querySelector('#fs-menu-title').textContent = 'Заказать навынос'

  const target = type => { const url = new URL(orderUrl, location.href); url.hash = type; return url.href }
  menuContent.replaceChildren(liveApi ? takeawayChooser(null, target) : takeawayChooser(type => showMenu(type, true)))
  if (!menuDialog.open) openDialog(menuDialog)
  resetMenuScroll()
}

if (liveApi && location.hash === '#takeaway') showTakeaway()
root.addEventListener('click', event => {
  const menu = event.target.closest('[data-menu]'), takeaway = event.target.closest('[data-takeaway]'), booking = event.target.closest('[data-booking]')
  if (takeaway) { event.preventDefault(); showTakeaway() }
  else if (menu) { event.preventDefault(); void showMenu(menu.dataset.menu) }
  else if (booking) {
    event.preventDefault()
    let panel = info.querySelector('[data-info-panel="booking"]')
    if (!panel) { panel = node('section'); panel.dataset.infoPanel = 'booking'; panel.append(node('h2', '', 'Забронировать стол вы можете по\u00a0номеру')); const phone = node('a', 'fs-button fs-solid', 'Позвонить: +375 (44) 790-33-33'); phone.href = 'tel:+375447903333'; panel.append(phone); info.querySelector('.fs-info-content').append(panel) }
    showInfo('booking')
  }
})
