(() => {
  if (!document.querySelector('#app-container') || document.body.classList.contains('admin-page')) return
  // Настройки расписания в одном месте. Коды папок — из публичного API меню, часы — как в админке.
  // End — окончание приёма заказов навынос (11:55, 14:55, 22:35); label и hours — часы подачи для гостя.
  // это только блокировка кнопок в интерфейсе; время приёма при оформлении сервер должен проверять сам.
  const scheduleRoots = {"5139": 5139, "5222": 5139, "5198": 5139, "5151": 5139, "5174": 5139, "5140": 5139, "5231": 5139, "5188": 5139, "5323": 5139, "5342": 5139, "6846": 6846, "7855": 6846, "7823": 6846, "7834": 6846, "7841": 6846, "7839": 6846, "7850": 6846, "7848": 6846, "7845": 6846, "6848": 6846, "5474": 5474, "5497": 5474, "5491": 5474, "5483": 5474, "5475": 5474, "9105": 5474}
  const rootSchedule = {
    6846: { label: 'Завтраки: пн–пт 09:00–12:00, сб–вс 10:00–12:00', hours: 'Пн–пт 9:00–12:00 · сб–вс 10:00–12:00', start: 9 * 60, weekendStart: 10 * 60, end: 11 * 60 + 55 },
    5474: { label: 'Домашние обеды: пн–пт 12:00–15:00', hours: 'Пн–пт 12:00–15:00', start: 12 * 60, end: 14 * 60 + 55, weekdaysOnly: true },
    5139: { label: 'Основное меню: ежедневно 12:00–23:00', hours: 'Ежедневно 12:00–23:00', start: 12 * 60, end: 22 * 60 + 35 },
  }
  const html = document.documentElement
  html.dataset.emenuRedesign = 'fasol'
  const script = document.currentScript
  const assetRoot = new URL(html.dataset.fasolAssets || '../', script?.src || location.href)
  if (!document.querySelector('[data-fasol-icons]')) {
    const icons = document.createElement('link'); icons.rel = 'stylesheet'
    icons.href = new URL('fonts/fontawesome.css', assetRoot).href; icons.dataset.fasolIcons = ''
    document.head.append(icons)
  }
  const preloader = document.querySelector('#app-preloader')
  if (preloader && !preloader.querySelector('.fasol-loading-mark')) {
    const mark = document.createElement('img'); mark.className = 'fasol-loading-mark'
    mark.src = new URL('img/fasol-wordmark-light.svg', assetRoot).href; mark.alt = 'ФаСоль'
    preloader.append(mark); preloader.setAttribute('role', 'status'); preloader.setAttribute('aria-label', 'Загружаем меню')
  }
  const homeUrl = html.dataset.fasolHome || '/'
  const brand = document.querySelector('.header-venue-showcase-link')
  if (brand && !brand.querySelector('.fasol-emenu-wordmark')) {
    const img = document.createElement('img')
    img.className = 'fasol-emenu-wordmark'; img.src = new URL('img/fasol-wordmark-light.svg', assetRoot).href
    img.alt = 'ФаСоль'; img.width = 116; img.height = 59
    brand.prepend(img); brand.href = homeUrl; brand.setAttribute('aria-label', 'ФаСоль — на главную')
    const back = document.createElement('a'); back.className = 'fasol-return-home'; back.href = homeUrl; back.textContent = 'На главную'; brand.after(back)
  }
  const login = document.querySelector('#telegram-login-btn')
  if (login && !login.querySelector('.fasol-login-label')) {
    const label = document.createElement('span')
    label.className = 'fasol-login-label'
    label.textContent = 'Войти'
    login.append(label)
    login.setAttribute('role','button'); login.setAttribute('tabindex','0'); login.setAttribute('aria-label','Войти в личный кабинет')
    login.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();login.click()}})
  }
  const main = document.querySelector('#main-content')
  if (main && !main.querySelector('.fasol-menu-heading')) {
    const heading = document.createElement('div'); heading.className = 'fasol-menu-heading'
    const title = document.createElement('h1'); title.textContent = 'Меню «ФаСоль»'
    const subtitle = document.createElement('p'); subtitle.textContent = 'Выберите блюда для заказа'
    heading.append(title, subtitle); main.prepend(heading)
  }
  const footerRow = document.querySelector('.emenu-footer-row')
  const legal = document.querySelector('.footer-legal-entity')
  if (footerRow && legal && !footerRow.querySelector('.fasol-footer-contact')) {
    const contact = document.createElement('section'); contact.className = 'fasol-footer-contact'
    const heading = document.createElement('h2'); heading.textContent = 'Ждём в «ФаСоль»'; contact.append(heading)
    for (const [selector, fallback] of [['#venue-address-text-desktop','г. Гомель, ул. Советская, 36'],['#venue-hours-text-desktop','Пн–Пт 09:00–23:00 · Сб–Вс 10:00–23:00']]) {
      const p = document.createElement('p'), source = document.querySelector(selector)
      const sync = () => { p.textContent = source?.textContent.trim() || fallback }; sync()
      if (source) new MutationObserver(sync).observe(source,{childList:true,subtree:true,characterData:true})
      contact.append(p)
    }
    const phone = legal.querySelector('a[href^="tel:"]')?.cloneNode(true)
    if (phone) { const p = document.createElement('p'); p.append(phone); contact.append(p) }
    footerRow.prepend(contact)
    const dl = legal.querySelector('dl')
    if (dl) {
      const details = document.createElement('section')
      details.className = 'fasol-legal-details'
      const summary = document.createElement('h3')
      summary.textContent = 'Реквизиты организации'
      dl.before(details)
      details.append(summary, dl)
    }
  }
  const panel = document.querySelector('#mobileHeaderMenu .offcanvas-body')
  if (panel && !panel.querySelector('[data-fasol-home-link]')) {
    const link = document.createElement('a'); link.dataset.fasolHomeLink = ''; link.href = homeUrl
    link.className = 'btn btn-outline-secondary text-start'; link.textContent = 'На главную'; panel.prepend(link)
  }
  function accessibleButtons(scope) {
    scope.querySelectorAll('.add-to-cart-btn').forEach(button => {
      if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', `Добавить: ${button.dataset.dishName || 'блюдо'}`)
    })
  }
  function readableCategories() {
    document.querySelectorAll('.folder-section-title').forEach(title => {
      const raw = title.textContent.trim(), display = raw.charAt(0).toLocaleUpperCase('ru') + raw.slice(1).toLocaleLowerCase('ru')
      if (raw && raw !== display && raw === raw.toLocaleUpperCase('ru') && title.children.length === 0) title.textContent = display
    })
    document.querySelectorAll('.category-name').forEach(label => {
      let raw = label.textContent.trim()
      // У папки 9105 в данных меню custom_name пустой, без подмены раздел остаётся без названия.
      if (/^(null|undefined)$/i.test(raw)) raw = label.closest('.category-item')?.dataset.folderCode === '9105' ? 'Десерты обеда' : 'Другие блюда'
      const display = raw.charAt(0).toLocaleUpperCase('ru') + raw.slice(1).toLocaleLowerCase('ru')
      if (label.textContent !== display) label.textContent = display
    })
  }
  const banners = document.querySelector('#main-banner-carousel-inner')
  const cleanBannerCopy=()=>{banners?.querySelectorAll('.carousel-caption p').forEach(p=>{if(p.textContent.trim()==='Актуальные предложения заведения')p.hidden=true})}
  if (banners) { cleanBannerCopy();new MutationObserver(cleanBannerCopy).observe(banners,{childList:true,subtree:true}) }
  const categories = document.querySelector('#categories-container')
  if (categories) { readableCategories(); new MutationObserver(readableCategories).observe(categories, { childList: true, subtree: true }) }
  { const content = document.querySelector('#content-area'); if (content) new MutationObserver(readableCategories).observe(content, { childList: true, subtree: true }) }
  const catalog = document.querySelector('#content-area')
  if (catalog) {
    accessibleButtons(catalog)
    new MutationObserver(() => accessibleButtons(catalog)).observe(catalog, { childList: true, subtree: true })
  }
  // Меняются только подписи на экране: количество, данные блюда и корзина не трогаются.
  function readableWeights() {
    document.querySelectorAll('#addItemWeight, .cart-item-weight').forEach(label => {
      const raw = label.textContent.trim()
      const bare = raw.match(/^(Вес\s*[:—-]?\s*)?(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)*)$/i)
      if (bare) label.textContent = `${bare[1] || ''}${bare[2].replace(/\s*\/\s*/g, '/')} г`
    })
  }
  for (const target of [document.querySelector('#addItemWeight'), document.querySelector('#cart-items-container')]) {
    if (target) new MutationObserver(readableWeights).observe(target, { childList: true, subtree: true, characterData: true })
  }
  readableWeights()

  const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Minsk', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  function availability(folder, now = new Date()) {
    const rule = rootSchedule[scheduleRoots[String(folder)]]
    if (!rule) return null
    const parts = Object.fromEntries(clock.formatToParts(now).map(part => [part.type, part.value]))
    const weekend = parts.weekday === 'Sat' || parts.weekday === 'Sun'
    const minute = Number(parts.hour) * 60 + Number(parts.minute)
    return { open: !(weekend && rule.weekdaysOnly) && minute >= (weekend ? rule.weekendStart ?? rule.start : rule.start) && minute < rule.end, label: rule.label, rule }
  }

  const dayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayWhen = ['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу']
  const hm = minutes => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
  function nextOpening(rule, now = new Date()) {
    const parts = Object.fromEntries(clock.formatToParts(now).map(part => [part.type, part.value]))
    const today = dayShort.indexOf(parts.weekday), minute = Number(parts.hour) * 60 + Number(parts.minute)
    for (let offset = 0; offset < 8; offset++) {
      const day = (today + offset) % 7, weekend = day === 0 || day === 6
      if (weekend && rule.weekdaysOnly) continue
      const start = weekend ? rule.weekendStart ?? rule.start : rule.start
      if (offset === 0 && minute >= start) continue
      return { when: offset === 0 ? 'сегодня' : offset === 1 ? 'завтра' : dayWhen[day], time: hm(start) }
    }
    return null
  }
  const scheduleOwned = new WeakMap()
  let activeAddFolder = null
  function updateButtonAvailability(button, folder) {
    const state = availability(folder)
    if (!state) return
    if (!state.open) {
      if (!scheduleOwned.has(button)) scheduleOwned.set(button, { disabled: button.disabled, title: button.getAttribute('title') })
      button.disabled = true
      button.dataset.fasolScheduleClosed = 'true'
      button.setAttribute('aria-disabled', 'true')
      button.title = state.label
    } else if (scheduleOwned.has(button)) {
      const original = scheduleOwned.get(button)
      button.disabled = original.disabled
      delete button.dataset.fasolScheduleClosed
      if (original.title === null) button.removeAttribute('title'); else button.title = original.title
      if (!button.disabled) button.removeAttribute('aria-disabled')
      scheduleOwned.delete(button)
    }
    const noteHost = button.closest('.product-footer') || button.parentElement
    let note = noteHost?.querySelector('.fasol-schedule-note')
    if (!state.open && noteHost && !note) { note = document.createElement('p'); note.className = 'fasol-schedule-note'; noteHost.append(note) }
    if (note) {
      const next = !state.open && nextOpening(state.rule)
      const text = next ? `Доступно ${next.when} с ${next.time}` : state.label
      if (note.textContent !== text) note.textContent = text
      note.hidden = state.open
    }
  }
  function refreshAvailability() {
    document.querySelectorAll('.add-to-cart-btn, .add-to-cart-from-modal-btn').forEach(button => updateButtonAvailability(button, button.dataset.dishFolderCode))
    const confirm = document.querySelector('#addItemToCartBtn')
    if (confirm && activeAddFolder) updateButtonAvailability(confirm, activeAddFolder)
    renderViewMeta()
  }
  document.addEventListener('click', event => {
    const add = event.target.closest('.add-to-cart-btn, .add-to-cart-from-modal-btn, #addItemToCartBtn')
    if (!add) return
    const folder = add.dataset.dishFolderCode || activeAddFolder
    const state = availability(folder)
    // Клик по неактивной кнопке гасим до обработчика ui.js, иначе окно добавления всё равно откроется.
    if (state && !state.open) { event.preventDefault(); event.stopImmediatePropagation(); refreshAvailability(); return }
    if (add.dataset.dishFolderCode) activeAddFolder = add.dataset.dishFolderCode
    queueMicrotask(refreshAvailability)
  }, true)

  const views = {
    breakfast: { root: 6846, title: 'Завтраки' },
    lunch: { root: 5474, title: 'Домашние обеды' },
    main: { root: 5139, title: 'Основное меню' },
  }
  const branchOfFolder = folder => Object.keys(views).find(key => views[key].root === scheduleRoots[String(folder)]) || ''
  const viewFromHash = () => { const key = decodeURIComponent(location.hash.slice(1)); return views[key] ? key : '' }
  const titleNode = document.querySelector('.fasol-menu-heading h1')
  const defaultTitle = titleNode?.textContent || ''
  let metaBox = null, appliedView = null
  function renderViewMeta() {
    const view = viewFromHash()
    if (!view || !titleNode) { metaBox?.remove(); metaBox = null; return }
    const rule = rootSchedule[views[view].root], state = availability(views[view].root)
    if (!metaBox) {
      metaBox = document.createElement('div'); metaBox.className = 'fasol-view-meta'
      const back = document.createElement('a'); back.className = 'fasol-view-back'; back.href = `${new URL(homeUrl, location.href).href.split('#')[0]}#takeaway`; back.textContent = 'К выбору меню'
      const info = document.createElement('p'); info.className = 'fasol-view-info'
      const hours = document.createElement('span'); hours.className = 'fasol-view-hours'
      const status = document.createElement('span'); status.className = 'fasol-view-status'
      info.append(hours, status); metaBox.append(back, info); titleNode.after(metaBox)
    }
    metaBox.querySelector('.fasol-view-hours').textContent = rule.hours
    const status = metaBox.querySelector('.fasol-view-status')
    const next = !state.open && nextOpening(rule)
    const text = state.open ? `Принимаем заказы до ${hm(rule.end)}` : `Сейчас закрыто${next ? ` · откроется ${next.when} в ${next.time}` : ''}`
    if (status.textContent !== text) status.textContent = text
    status.classList.toggle('is-open', state.open); status.classList.toggle('is-closed', !state.open)
  }
  // Подсветка разделов идёт по всем .folder-dishes-section[data-folder-code], включая скрытые слоем.
  // У секций другой ветки атрибут временно переносится, при смене ветки возвращается.
  function isolateSections(view) {
    document.querySelectorAll('.folder-dishes-section').forEach(node => {
      const code = node.dataset.folderCode || node.dataset.fasolFolderCode
      const branch = branchOfFolder(code)
      if (view && branch && branch !== view) {
        if (node.dataset.folderCode) { node.dataset.fasolFolderCode = code; delete node.dataset.folderCode }
      } else if (node.dataset.fasolFolderCode) {
        node.dataset.folderCode = code; delete node.dataset.fasolFolderCode
      }
    })
  }
  function applyView() {
    const view = viewFromHash()
    isolateSections(view)
    if (!view) {
      delete html.dataset.fasolView; delete html.dataset.fasolBranchMissing
      if (titleNode && titleNode.textContent !== defaultTitle) titleNode.textContent = defaultTitle
      renderViewMeta(); appliedView = null
      return
    }
    html.dataset.fasolView = view
    if (titleNode && titleNode.textContent !== views[view].title) titleNode.textContent = views[view].title
    renderViewMeta()
    document.querySelectorAll('.category-item, .folder-dishes-section').forEach(node => {
      const branch = branchOfFolder(node.dataset.folderCode || node.dataset.fasolFolderCode)
      if (branch && node.dataset.fasolBranch !== branch) node.dataset.fasolBranch = branch
    })
    const items = [...document.querySelectorAll('#categories-container .category-item')]
    const ready = items.length > 0 && document.querySelector('.folder-dishes-section, .product-card')
    if (!ready) return
    // Раздел без блюд в этот час (например, суп другого дня недели) не показываем пустой кнопкой
    const grouped = document.querySelector('.folder-dishes-section')
    items.forEach(item => { item.toggleAttribute('data-fasol-empty', !!grouped && !document.querySelector(`#folder-section-${item.dataset.folderCode}`)) })
    const first = items.find(item => item.dataset.fasolBranch === view && !item.hasAttribute('data-fasol-empty')) || items.find(item => item.dataset.fasolBranch === view)
    if (!first) { html.dataset.fasolBranchMissing = 'true'; appliedView = view; return }
    delete html.dataset.fasolBranchMissing
    const hasSection = document.querySelector(`#folder-section-${first.dataset.folderCode}`) || !document.querySelector('.folder-dishes-section')
    if (appliedView !== view && hasSection) { appliedView = view; first.click(); confirmActive(view, 8) }
  }
  // Меню дорисовывает разделы уже после первого клика и снимает подсветку: повторяем штатный клик, пока раздел не выбран
  function confirmActive(view, tries) {
    setTimeout(() => {
      if (viewFromHash() !== view || tries <= 0) return
      if (document.querySelector(`#categories-container .category-item.active[data-fasol-branch="${view}"]`)) return
      const item = [...document.querySelectorAll('#categories-container .category-item')].find(node => node.dataset.fasolBranch === view && !node.hasAttribute('data-fasol-empty'))
      if (item) item.click()
      confirmActive(view, tries - 1)
    }, 250)
  }
  window.addEventListener('hashchange', () => { appliedView = null; applyView() })
  for (const target of [categories, catalog]) if (target) new MutationObserver(applyView).observe(target, { childList: true, subtree: true })
  applyView()

  if (categories) {
    const markEdges = () => {
      categories.toggleAttribute('data-more-left', categories.scrollLeft > 2)
      categories.toggleAttribute('data-more-right', categories.scrollLeft + categories.clientWidth < categories.scrollWidth - 2)
    }
    categories.addEventListener('scroll', markEdges, { passive: true })
    new ResizeObserver(markEdges).observe(categories)
    new MutationObserver(markEdges).observe(categories, { childList: true, subtree: true })
    markEdges()
  }

  function cleanCatalogControls() {
    document.querySelectorAll('.category-item').forEach(item => {
      if (/^все блюда$/i.test(item.textContent.trim())) item.hidden = true
    })
    document.querySelectorAll('input[placeholder]').forEach(input => {
      if (/найти (блюдо|ингредиент)/i.test(input.placeholder)) {
        const group = input.closest('.search-container, .input-group') || input
        group.dataset.fasolHideSearch = ''
      }
    })
    refreshAvailability()
  }
  for (const target of [catalog, categories, document.querySelector('#modal-content'), document.querySelector('#addItemModal')]) {
    if (target) new MutationObserver(cleanCatalogControls).observe(target, { childList: true, subtree: true })
  }
  cleanCatalogControls()
  setInterval(refreshAvailability, 30000)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshAvailability() })
})()
