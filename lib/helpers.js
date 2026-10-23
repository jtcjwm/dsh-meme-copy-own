// helpers.js - the pure parts (single source of truth; the client bundle carries
// inline copies because a ModuleLoader bundle cannot import a file).
// tests/client.test.mjs asserts the copies behave identically.

/** Chromium's async clipboard only accepts image/png. */
export function clipboardMime() {
  return 'image/png'
}

/** True when the source bytes must be re-encoded through a canvas first. */
export function needsPngConversion(type) {
  return typeof type !== 'string' || type.toLowerCase() !== 'image/png'
}

/** True for the images dsh-meme injects into the chat flow. */
export function isMemeImageElement(el) {
  return Boolean(el) && el.tagName === 'IMG' && Boolean(el.dataset) && typeof el.dataset.memeImg === 'string'
}

/** True when this image already sits inside one of our wrappers. */
export function isAlreadyWrapped(el) {
  if (!el || typeof el.closest !== 'function') return false
  return el.closest('[data-meme-copy]') !== null
}

/**
 * Pulls the picture URL out of a CSS `background-image`, trying the inline style first and
 * the computed style after that. dsh-meme's picker paints each meme as a background image
 * on a div (`div.mp-cell`), so there is no <img> to read a src from.
 */
export function extractBackgroundUrl(styleText, computedText) {
  const pick = (value) => {
    if (typeof value !== 'string') return ''
    const match = value.match(/url\(\s*(?:"|')?(.*?)(?:"|')?\s*\)/i)
    return match ? match[1] : ''
  }
  return pick(styleText) || pick(computedText) || ''
}

