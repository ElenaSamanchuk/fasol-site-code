const VENUE_HOST = 'fasol.orionhall.by'
const ROOTS = [5139, 6846, 5474]
const REQUEST_LIMIT = 39
const TIMEOUT_MS = 8000

const flag = value => value === true || value === 1 || value === '1'
const positiveCode = value => {
  const code = Number(value)
  return Number.isSafeInteger(code) && code > 0 ? code : null
}
const codes = value => new Set(String(value ?? '').split(/[,;\s]+/).map(positiveCode).filter(Boolean))
const isHidden = (item, hidden) => hidden.has(Number(item.id)) || hidden.has(Number(item.code))
const isVisible = item => flag(item.is_bot_export) && !flag(item.in_stop_list)
const nutritionValue = value => { const text = String(value ?? '').trim(); if (!text) return null; const n = Number(text.replace(',', '.')); return Number.isFinite(n) ? String(n) : text }
const nutritionOf = dish => ({ calories: nutritionValue(dish.calories), protein: nutritionValue(dish.protein), fat: nutritionValue(dish.fat), carbohydrate: nutritionValue(dish.carbohydrate), weight: nutritionValue(dish.weight) ?? nutritionValue(dish.ves) })

let nutritionFallbackPromise
const loadNutritionFallback = () => {
  nutritionFallbackPromise ??= fetch(new URL('./data/nutrition-fallback.json', document.baseURI).href, { credentials: 'omit' })
    .then(r => (r.ok ? r.json() : null)).then(j => (j && typeof j.items === 'object' ? j.items : {})).catch(() => ({}))
  return nutritionFallbackPromise
}
const isEmptyNutrition = n => ['calories', 'protein', 'fat', 'carbohydrate'].every(k => !Number(String(n[k] ?? '').replace(',', '.')))

export async function loadLiveMenu() {
  if (!getFasolOptions().liveApi) {
    throw new Error('Живое меню доступно только на домене ресторана')
  }

  let requests = 0
  const get = async path => {
    if (++requests > REQUEST_LIMIT) throw new Error('Превышен предел запросов меню')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const response = await fetch(path, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'omit',
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`Меню: HTTP ${response.status}`)
      const payload = await response.json()
      if (payload.status !== 'success') throw new Error('Сервер не подтвердил загрузку меню')
      return payload
    } finally {
      clearTimeout(timeout)
    }
  }

  const [configuration, menuList] = await Promise.all([
    loadSiteConfig(), get('/api/menu/list'),
  ])
  const site = configuration.site
  if (!configuration.live) throw configuration.error || new Error('Живые настройки не загружены')
  if (!site || !Array.isArray(menuList.menus)) throw new Error('Некорректные настройки меню')
  const menuCode = positiveCode(menuList.menus.find(menu => Number(menu.type) === 1)?.code)
  if (!menuCode) throw new Error('Электронное меню не найдено')
  const hiddenFolders = codes(site.hidden_folder_codes)
  const hiddenDishes = codes(site.hidden_dish_codes)
  const rootLabels = { 5139: 'Основное меню', 6846: 'Завтраки', 5474: 'Обеденное меню' }
  const pending = ROOTS.filter(root => !hiddenFolders.has(root)).map(root => ({
    code: root, root, category: rootLabels[root],
  }))
  const visited = new Set()
  const items = []
  const seenItems = new Set()

  while (pending.length) {
    const batch = []
    while (pending.length && batch.length < 2) {
      const folder = pending.shift()
      if (visited.has(folder.code) || hiddenFolders.has(folder.code)) continue
      visited.add(folder.code)
      batch.push(folder)
    }
    const results = await Promise.all(batch.map(async folder => ({
      folder,
      payload: await get(`/api/menu/dish/list?menu_id=${menuCode}&parent_id=${folder.code}`),
    })))
    for (const { folder, payload } of results) {
      if (!Array.isArray(payload.dishes) || !Array.isArray(payload.folders)) {
        throw new Error('Некорректная структура раздела меню')
      }
      for (const child of payload.folders) {
        const code = positiveCode(child.code)
        if (!code || !isVisible(child) || isHidden(child, hiddenFolders)) continue
        pending.push({ code, root: folder.root, category: child.custom_name || child.name || folder.category })
      }
      for (const dish of payload.dishes) {
        const id = positiveCode(dish.id)
        const code = positiveCode(dish.code)
        const price = Number(dish.cosht)
        if (!id || !code || dish.cosht == null || dish.cosht === '' || !Number.isFinite(price) || price < 0) continue
        if (!isVisible(dish) || isHidden(dish, hiddenDishes)) continue
        const key = `${folder.root}:${id}`
        if (seenItems.has(key)) continue
        seenItems.add(key)
        const rawImage = String(dish.image ?? '').trim()
        let image = ''
        if (rawImage) {
          try {
            const url = new URL(rawImage, location.origin)
            const trusted = url.origin === location.origin || url.origin === `https://${VENUE_HOST}`
            const web = url.protocol === 'https:' || (url.protocol === 'http:' && url.origin === location.origin)
            if (trusted && web && url.pathname.startsWith('/storage/')) image = url.href
          } catch {}
        }
        items.push({
          id, code,
          name: String(dish.custom_name || dish.name || ''),
          price, image,
          description: String(dish.description || ''),

          nutrition: nutritionOf(dish),
          root: folder.root,
          category: String(folder.category),
          categoryCode: folder.code,
        })
      }
    }
  }

  if (items.some(item => isEmptyNutrition(item.nutrition))) {
    const fallback = await loadNutritionFallback()
    for (const item of items) {
      const f = fallback[item.id]
      if (f && isEmptyNutrition(item.nutrition)) {
        item.nutrition = { ...item.nutrition, calories: nutritionValue(f.calories), protein: nutritionValue(f.protein), fat: nutritionValue(f.fat), carbohydrate: nutritionValue(f.carbohydrate) }
      }
    }
  }
  return { live: true, items }
}
import { getFasolOptions, loadSiteConfig } from './site-bindings.js'
