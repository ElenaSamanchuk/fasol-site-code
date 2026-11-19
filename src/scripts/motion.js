const EASE = 'cubic-bezier(.45, 0, .25, 1)'
const DURATION = 300
const reduced = matchMedia('(prefers-reduced-motion: reduce)')
const nativeClose = HTMLDialogElement.prototype.close
const nativeShow = HTMLDialogElement.prototype.showModal
const running = new WeakMap()

function exitTransform(dialog) {
  if (dialog.classList.contains('fs-navigation')) return 'translateX(48px)'
  if (dialog.classList.contains('fst-cart')) return 'translateY(32px)'
  return 'translateY(10px)'
}

function finish(dialog, value) {
  const state = running.get(dialog)
  if (!state) return
  running.delete(dialog)
  nativeClose.call(dialog, value)
  state.animations.forEach(animation => animation.cancel())
}

HTMLDialogElement.prototype.close = function close(value) {
  if (!this.open || reduced.matches || !this.closest('#fasol-site')) return nativeClose.call(this, value)
  if (running.has(this)) return undefined
  const options = { duration: DURATION, easing: EASE, fill: 'forwards' }
  const animations = [this.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: exitTransform(this) }], options)]
  try { animations.push(this.animate([{ opacity: 1 }, { opacity: 0 }], { ...options, pseudoElement: '::backdrop' })) } catch {}
  running.set(this, { animations })
  animations[0].finished.then(() => finish(this, value), () => {})
  return undefined
}

HTMLDialogElement.prototype.showModal = function showModal() {
  if (running.has(this)) finish(this)
  return nativeShow.call(this)
}

document.addEventListener('cancel', event => {
  if (event.target instanceof HTMLDialogElement && event.target.closest('#fasol-site')) {
    event.preventDefault()
    event.target.close()
  }
}, true)
