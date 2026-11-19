export const SITE_DOMAIN = ''

export const METRIKA_ID = ''

export const PRIVACY_EMAIL = 'orionholl@yandex.by'

export const SITEMAP_PATHS = ['/', '/privacy.html', '/cookies.html']

export function isProductionHost(host) {
  try { return Boolean(SITE_DOMAIN) && host === new URL(SITE_DOMAIN).host } catch { return false }
}
export const isProduction = typeof location !== 'undefined' && isProductionHost(location.host)
