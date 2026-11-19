const root = document.querySelector('#fasol-site')
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
const asset = path => new URL(path, new URL(root.dataset.assets || './', location.href)).href
const photo = n => `./img/client-20261104/${n}.webp`

const narrowOriginals = new Set([3822, 3831])
const sectionPhoto = n => matchMedia('(max-width:600px)').matches && !narrowOriginals.has(n) ? `./img/client-20261104/m/${n}.webp` : photo(n)

export const heroFrames = [

  { src: './img/client-20261113/interior-3825.webp', desk: '50% 55%', phone: '56% 50%' },
  { src: photo(3827), desk: '50% 50%', phone: '50% 50%' },
  { src: photo(3826), desk: '50% 50%', phone: '42% 50%' },
  { src: photo(3828), desk: '50% 50%', phone: '50% 50%' },

  { src: photo(3831), desk: '50% 58%', phone: '50% 50%' },
]

const phoneFrame = matchMedia('(max-width:600px)')
const framePos = frame => (typeof frame === 'string' ? '' : (phoneFrame.matches ? frame.phone : frame.desk) || '')
const frameSrc = frame => (typeof frame === 'string' ? frame : frame.src)

const setFit = (image, frame) => image.classList.toggle('fs-fit', Boolean(frame && frame.fit))

const setPos = (image, pos) => (pos ? image.style.setProperty('object-position', pos, 'important') : image.style.removeProperty('object-position'))
function slideshow(container, sources, interval = 6500) {
  const original = container?.querySelector('img')
  if (!original || sources.length < 2) return
  container.classList.add('fs-rotating-stage')
  original.removeAttribute('srcset'); original.removeAttribute('sizes')
  original.src = asset(frameSrc(sources[0])); setPos(original, framePos(sources[0])); setFit(original, sources[0])
  const overlay = original.cloneNode()
  overlay.classList.add('fs-slide-next')
  overlay.removeAttribute('fetchpriority')
  overlay.alt = ''; overlay.setAttribute('aria-hidden', 'true')
  original.after(overlay)
  let index = 0, busy = false, visible = false
  phoneFrame.addEventListener('change', () => { setPos(original, framePos(sources[index])) })
  new IntersectionObserver(entries => { visible = entries.some(e => e.isIntersecting) }, { rootMargin: '200px' }).observe(container)
  setInterval(async () => {
    if (!visible || document.hidden || reducedMotion.matches || busy) return
    busy = true
    const nextIndex = (index + 1) % sources.length
    const url = asset(frameSrc(sources[nextIndex])), pos = framePos(sources[nextIndex])
    const preload = new Image(); preload.src = url

    try { await preload.decode() } catch { sources.splice(nextIndex, 1); busy = false; return }
    overlay.src = url; setPos(overlay, pos); setFit(overlay, sources[nextIndex])
    overlay.classList.add('is-visible')
    setTimeout(async () => {
      original.src = url; setPos(original, pos); setFit(original, sources[nextIndex])
      try { await original.decode() } catch {}
      overlay.classList.remove('is-visible')
      index = nextIndex; busy = false
    }, 1900)
  }, interval)
}

slideshow(root.querySelector('.fs-hero'), heroFrames)

const fresh = (name, desk = '50% 50%', phone = desk) => ({ src: `./img/client-20261113/${matchMedia('(max-width:600px)').matches ? 'm/' : ''}${name}.webp`, desk, phone })
const room = (n, pos = '50% 50%') => ({ src: sectionPhoto(n), desk: pos, phone: pos })

const p17 = (name, desk = '50% 50%', phone = desk, fit = false) => ({ src: `./img/client-20261117/${matchMedia('(max-width:600px)').matches ? 'm/' : ''}${name}.webp`, desk, phone, fit })
export const barFrames = [
  p17('bar-counter-4120', '50% 55%', '35% 50%'),
  p17('cocktails-1', '50% 50%', '50% 50%', true),
  p17('bar-counter-4115', '50% 60%', '50% 55%'),
  p17('cocktails-2', '50% 50%', '50% 50%', true),
  p17('bar-counter-4121', '50% 60%', '50% 55%'),
  p17('cocktails-3', '50% 50%', '50% 50%', true),
  p17('cocktails-4', '50% 50%', '50% 50%', true),
  p17('cocktails-5', '50% 50%', '50% 50%', true),
]

export const kidsFrames = [
  fresh('kids-4092', '50% 86%', '50% 50%'), room(3834), fresh('kids-4096', '50% 86%', '50% 50%'), fresh('kids-4103', '50% 86%', '50% 50%'), room(3829),
  fresh('kids-4100', '50% 86%', '50% 50%'), fresh('kids-4093', '50% 86%', '50% 50%'), fresh('kids-4107', '50% 86%', '50% 50%'), room(3816),
]
slideshow(root.querySelector('#bar .c-split__image'), barFrames, 7400)
slideshow(root.querySelector('#kids .c-split__image'), kidsFrames, 7800)

const header = root.querySelector('.fs-header')
const stick = () => header.classList.toggle('is-stuck', scrollY > 24)
addEventListener('scroll', stick, { passive: true }); stick()

const rail = root.querySelector('.fs-about-gallery')
const steps = root.querySelectorAll('[data-gallery-step]')
function syncSteps() {
  const max = rail.scrollWidth - rail.clientWidth - 2
  steps.forEach(button => { button.disabled = Number(button.dataset.galleryStep) < 0 ? rail.scrollLeft <= 2 : rail.scrollLeft >= max })
}
steps.forEach(button => button.addEventListener('click', () => {
  const amount = rail.querySelector('button').getBoundingClientRect().width + parseFloat(getComputedStyle(rail).columnGap || 20)
  rail.scrollBy({ left: amount * Number(button.dataset.galleryStep), behavior: reducedMotion.matches ? 'instant' : 'smooth' })
}))
rail.addEventListener('scroll', syncSteps, { passive: true })

if ('IntersectionObserver' in window) new IntersectionObserver((entries, observer) => {
  if (!entries.some(entry => entry.isIntersecting)) return
  observer.disconnect()
  rail.querySelectorAll('img[loading="lazy"]').forEach(img => { img.loading = 'eager' })
}, { rootMargin: '2000px 0px' }).observe(rail)
addEventListener('resize', syncSteps); syncSteps()

const map = root.querySelector('.fs-map'), frame = map?.querySelector('iframe')
if (frame) {
  const fail = () => map.classList.add('is-failed')

  let frameLoaded = false, timer
  frame.addEventListener('load', () => { frameLoaded = true; clearTimeout(timer) }, { once: true })
  new IntersectionObserver((entries, observer) => {
    if (!entries.some(e => e.isIntersecting)) return
    observer.disconnect()
    if (!frameLoaded) timer = setTimeout(fail, 12000)

    let slow = false
    const controller = new AbortController(); setTimeout(() => { slow = true; controller.abort() }, 8000)
    fetch(frame.src, { mode: 'no-cors', cache: 'no-store', signal: controller.signal }).catch(() => { if (slow) return; clearTimeout(timer); fail() })
  }, { rootMargin: '300px' }).observe(map)
}

if (!reducedMotion.matches && 'IntersectionObserver' in window) {
  const blocks = root.querySelectorAll('.fs-pair-copy .c-split__content, .fs-about-inline > h2, .fs-about-inline > p, .fs-usp, .fs-about-gallery-wrap, .fs-contacts > div')
  const reveal = new IntersectionObserver((entries, observer) => entries.forEach(entry => {
    if (!entry.isIntersecting) return
    entry.target.classList.add('is-in')
    observer.unobserve(entry.target)
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.05 })
  blocks.forEach(block => { block.classList.add('fs-reveal'); reveal.observe(block) })
}

const footer = root.querySelector('.fs-footer')
const typo = () => footer.querySelectorAll('p').forEach(p => {
  const fixed = p.textContent.replace(/"([^"]+)"/g, '«$1»').replace(/ (\d{9})\b/, ' $1')
  if (fixed !== p.textContent) p.textContent = fixed
})
new MutationObserver(typo).observe(footer, { subtree: true, childList: true, characterData: true }); typo()

{
  const stack = [], silent = new WeakSet()
  let skipPops = 0
  new MutationObserver(records => {
    let closed = 0
    for (const { target } of records) {
      if (target.tagName !== 'DIALOG') continue
      const index = stack.indexOf(target)
      if (target.open && index < 0) { stack.push(target); history.pushState({ fsDialog: true }, '') }
      else if (!target.open && index >= 0) {
        stack.splice(index, 1)
        if (silent.has(target)) silent.delete(target); else closed++
      }
    }

    if (closed) setTimeout(() => { if (history.state?.fsDialog) { skipPops++; history.go(-closed) } })
  }).observe(root, { subtree: true, attributes: true, attributeFilter: ['open'] })
  addEventListener('popstate', () => {
    if (skipPops) { skipPops--; return }
    const top = stack.at(-1)
    if (top) { silent.add(top); top.close(); return }
    if (history.state?.fsDialog) history.back()
  })
}

{
  const area = root.querySelector('#fs-menu-content')
  const fade = image => {
    if (image.complete && image.naturalWidth) return
    image.classList.add('fs-img-fade')
    const show = () => image.classList.remove('fs-img-fade')
    image.addEventListener('load', show, { once: true }); image.addEventListener('error', show, { once: true })
  }
  if (area && !reducedMotion.matches) new MutationObserver(records => {
    for (const { addedNodes } of records) for (const node of addedNodes) {
      if (node.nodeType !== 1) continue
      if (node.tagName === 'IMG') fade(node)
      else node.querySelectorAll('img').forEach(fade)
    }
  }).observe(area, { childList: true, subtree: true })
}
