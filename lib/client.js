// client.js - browser half: ONE button on every meme image, and it copies the image.
//
// Loaded by DSH's ModuleLoader (same shape as the other client plugins):
// window.__ModuleLoader__.load({ id, factory }); the id MUST equal the package name.
//
// dsh-meme turns `[表情: 描述]` into <img data-meme-img="..."> inside the chat flow.
// This plugin wraps those images and shows a copy button on hover. Click it, then paste
// with Ctrl+V into WeChat / QQ / anywhere that accepts a pasted image.
//
// Why a clipboard rather than a drag: dragging an image out of a browser window cannot
// produce a real file (CF_HDROP), so chat apps ignore it. Measured, not assumed.
//
// The injected chat DOM gets no text nodes: dsh-meme deliberately keeps each message's
// textContent byte-identical to the raw `[表情: x]` marker (other plugins rewrite
// messages whose text changed). The button is an SVG icon with a title, and the short
// "copied / failed" notice is a floating element attached to document.body, outside the
// chat flow. Wrappers are dropped as soon as their image leaves the DOM, because
// dsh-meme removes duplicate images at any time.

window.__ModuleLoader__.load({
  id: 'dsh-meme-copy-own',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    const WRAP_ATTR = 'data-meme-copy'
    const TOAST_ATTR = 'data-meme-copy-toast'
    const STYLE_ID = 'dsh-meme-copy-own/style'
    const TOAST_MS = 2600


    // --- inline copies of lib/helpers.js (parity asserted by the test)
    function clipboardMime() {
      return 'image/png'
    }

    function needsPngConversion(type) {
      return typeof type !== 'string' || type.toLowerCase() !== 'image/png'
    }

    function isMemeImageElement(el) {
      return Boolean(el) && el.tagName === 'IMG' && Boolean(el.dataset) && typeof el.dataset.memeImg === 'string'
    }

    function isAlreadyWrapped(el) {
      if (!el || typeof el.closest !== 'function') return false
      return el.closest('[data-meme-copy]') !== null
    }

    // Same lookup as lib/helpers.js: dsh-meme's picker paints memes as background images.
    function extractBackgroundUrl(styleText, computedText) {
      const pick = (value) => {
        if (typeof value !== 'string') return ''
        const match = value.match(/url\(\s*(?:"|')?(.*?)(?:"|')?\s*\)/i)
        return match ? match[1] : ''
      }
      return pick(styleText) || pick(computedText) || ''
    }

    // --- style ------------------------------------------------------------------
    // Look: a frosted light pill that fades in and lifts slightly on hover, instead of a
    // black slab sitting on top of the picture. Feedback states only recolour it.
    const CSS = [
      '[data-meme-copy]{position:relative;display:inline-block;line-height:0}',
      '[data-meme-copy] .mmc-btn{position:absolute;top:6px;right:6px;width:28px;height:28px;padding:0;',
      'border:1px solid rgba(255,255,255,.55);border-radius:9px;',
      'background:rgba(255,255,255,.86);color:#26282c;cursor:pointer;',
      '-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);',
      'box-shadow:0 2px 10px rgba(0,0,0,.16);',
      'display:inline-flex;align-items:center;justify-content:center;',
      'opacity:0;transform:translateY(-3px);-webkit-appearance:none;appearance:none;',
      'transition:opacity .16s ease,transform .16s ease,background .16s ease,box-shadow .16s ease;',
      'z-index:5}',
      '[data-meme-copy]:hover .mmc-btn{opacity:1;transform:translateY(0)}',
      '[data-meme-copy] .mmc-btn:hover{background:#fff;box-shadow:0 4px 14px rgba(0,0,0,.22)}',
      '[data-meme-copy] .mmc-btn.mmc-ok{background:rgba(36,150,88,.96);color:#fff;border-color:transparent;opacity:1;transform:translateY(0)}',
      '[data-meme-copy] .mmc-btn.mmc-fail{background:rgba(186,54,54,.96);color:#fff;border-color:transparent;opacity:1;transform:translateY(0)}',
      '[data-meme-copy] .mmc-btn svg{width:15px;height:15px;display:block}',
      // Picker cells (dsh-meme's chooser): the picture is a background image on a div.
      '.mp-cell .mmc-cell-btn{position:absolute;top:4px;right:4px;width:24px;height:24px;padding:0;',
      'border:1px solid rgba(255,255,255,.6);border-radius:8px;',
      'background:rgba(255,255,255,.88);color:#26282c;cursor:pointer;',
      '-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);',
      'box-shadow:0 2px 8px rgba(0,0,0,.18);',
      'display:inline-flex;align-items:center;justify-content:center;',
      'opacity:0;transform:scale(.88);-webkit-appearance:none;appearance:none;',
      'transition:opacity .14s ease,transform .14s ease,background .14s ease;',
      'z-index:6}',
      '.mp-cell:hover .mmc-cell-btn{opacity:1;transform:scale(1)}',
      '.mp-cell .mmc-cell-btn:hover{background:#fff}',
      '.mp-cell .mmc-cell-btn.mmc-ok{background:rgba(36,150,88,.96);color:#fff;border-color:transparent;opacity:1;transform:scale(1)}',
      '.mp-cell .mmc-cell-btn.mmc-fail{background:rgba(186,54,54,.96);color:#fff;border-color:transparent;opacity:1;transform:scale(1)}',
      '.mp-cell .mmc-cell-btn svg{width:14px;height:14px;display:block}',
      '[data-meme-copy-toast]{position:fixed;z-index:2147483000;max-width:320px;',
      'background:rgba(28,28,30,.96);color:#f2f2f2;border:1px solid rgba(255,255,255,.14);',
      'border-radius:8px;box-shadow:0 8px 26px rgba(0,0,0,.42);padding:8px 11px;',
      'font:13px/18px system-ui,"Microsoft YaHei UI",sans-serif;pointer-events:none}'
    ].join('')

    function ensureStyle() {
      if (document.getElementById(STYLE_ID)) return
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = CSS
      document.head.appendChild(style)
    }

    const SVG_NS = 'http://www.w3.org/2000/svg'
    const ICON_COPY = 'M9 3h9a1 1 0 0 1 1 1v9M6 8h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z'

    function icon(path) {
      const svg = document.createElementNS(SVG_NS, 'svg')
      svg.setAttribute('viewBox', '0 0 24 24')
      svg.setAttribute('fill', 'none')
      svg.setAttribute('stroke', 'currentColor')
      svg.setAttribute('stroke-width', '2.2')
      svg.setAttribute('stroke-linecap', 'round')
      svg.setAttribute('stroke-linejoin', 'round')
      const p = document.createElementNS(SVG_NS, 'path')
      p.setAttribute('d', path)
      svg.appendChild(p)
      return svg
    }

    // --- feedback (outside the chat flow, auto-dismissed) -----------------------
    function notify(anchorEl, message) {
      for (const old of document.querySelectorAll('[' + TOAST_ATTR + ']')) old.remove()

      const toast = document.createElement('div')
      toast.setAttribute(TOAST_ATTR, '1')
      toast.textContent = message
      document.body.appendChild(toast)

      const rect = anchorEl && anchorEl.getBoundingClientRect ? anchorEl.getBoundingClientRect() : { left: 20, top: 20, bottom: 44 }
      const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - toast.offsetWidth - 8))
      toast.style.left = left + 'px'
      toast.style.top = Math.min(window.innerHeight - toast.offsetHeight - 8, rect.bottom + 6) + 'px'

      window.setTimeout(() => toast.remove(), TOAST_MS)
      return toast
    }

    function flash(button, ok) {
      button.classList.add(ok ? 'mmc-ok' : 'mmc-fail')
      window.setTimeout(() => button.classList.remove('mmc-ok', 'mmc-fail'), 1400)
    }

    // --- the single job ---------------------------------------------------------
    async function fetchBlob(src) {
      const response = await fetch(src, { credentials: 'same-origin' })
      if (!response.ok) throw new Error('HTTP ' + response.status)
      return await response.blob()
    }

    async function toPng(blob) {
      if (!needsPngConversion(blob.type)) return blob
      const bitmap = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      canvas.getContext('2d').drawImage(bitmap, 0, 0)
      if (typeof bitmap.close === 'function') bitmap.close()
      return await new Promise((resolve, reject) => {
        canvas.toBlob((out) => (out ? resolve(out) : reject(new Error('canvas.toBlob 返回空'))), clipboardMime())
      })
    }

    async function copyFrom(url, button) {
      button.disabled = true
      try {
        const blob = await fetchBlob(url)
        const png = await toPng(blob)
        if (!navigator.clipboard || typeof navigator.clipboard.write !== 'function') {
          throw new Error('这个环境没有剪贴板接口')
        }
        await navigator.clipboard.write([new ClipboardItem({ [clipboardMime()]: png })])
        flash(button, true)
        notify(button, '已复制图片：去微信/QQ/其他软件里按 Ctrl+V 粘贴')
      } catch (error) {
        flash(button, false)
        notify(button, '复制失败：' + String(error && error.message ? error.message : error))
        console.warn('[dsh-meme-copy-own] 复制失败:', error)
      } finally {
        button.disabled = false
      }
    }

    // --- DOM --------------------------------------------------------------------
    function makeButton(img) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'mmc-btn'
      button.setAttribute('data-meme-copy-btn', 'copy')
      button.setAttribute('title', '复制图片（之后 Ctrl+V 粘贴到其他软件）')
      button.setAttribute('aria-label', '复制图片')
      button.appendChild(icon(ICON_COPY))
      button.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        void copyFrom(img.currentSrc || img.src, button)
      })
      return button
    }

    function wrapImage(img) {
      const parent = img.parentNode
      if (!parent) return null
      const wrap = document.createElement('span')
      wrap.setAttribute(WRAP_ATTR, '1')
      wrap.setAttribute('title', '表情包：' + (img.getAttribute('data-meme-img') || ''))
      parent.insertBefore(wrap, img)
      wrap.appendChild(img)
      wrap.appendChild(makeButton(img))
      return wrap
    }

    function makeCellButton(url) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'mmc-cell-btn'
      button.setAttribute('data-meme-copy-cell-btn', '1')
      button.setAttribute('title', '复制这张表情包（不会发出去）')
      button.setAttribute('aria-label', '复制这张表情包')
      button.appendChild(icon(ICON_COPY))
      const stop = (event) => { event.preventDefault(); event.stopPropagation() }
      button.addEventListener('mousedown', stop)
      button.addEventListener('click', (event) => {
        stop(event)
        void copyFrom(url, button)
      })
      return button
    }

    // dsh-meme's picker renders every meme as a div.mp-cell whose picture is a CSS
    // background-image (no <img>), so the chooser needs its own decoration pass. The
    // button stops propagation, otherwise clicking it would send the meme.
    function decoratePickers() {
      for (const cell of document.querySelectorAll('.mp-cell')) {
        if (cell.querySelector('[data-meme-copy-cell-btn]')) continue
        let computed = ''
        try { computed = window.getComputedStyle(cell).backgroundImage || '' } catch (error) { computed = '' }
        const url = extractBackgroundUrl(cell.getAttribute('style') || '', computed)
        if (!url || url === 'none') continue
        try { cell.style.position = 'relative' } catch (error) { /* 定位失败不致命 */ }
        cell.appendChild(makeCellButton(url))
      }
    }

    function decorateAll() {
      decoratePickers()
      for (const img of document.querySelectorAll('img[data-meme-img]')) {
        if (!isMemeImageElement(img) || isAlreadyWrapped(img)) continue
        wrapImage(img)
      }
      // dsh-meme removes duplicate images at any time; drop wrappers left behind.
      for (const wrap of document.querySelectorAll('[' + WRAP_ATTR + ']')) {
        if (!wrap.querySelector('img[data-meme-img]')) wrap.remove()
      }
    }

    let scheduled = 0
    function scheduleScan() {
      if (scheduled) return
      scheduled = window.setTimeout(() => {
        scheduled = 0
        try {
          decorateAll()
        } catch (error) {
          console.warn('[dsh-meme-copy-own] 装饰失败:', error)
        }
      }, 250)
    }

    let observer = null

    function apply(ctx) {
      if (typeof document === 'undefined') return
      try {
        ensureStyle()
        decorateAll()
        observer = new MutationObserver(scheduleScan)
        if (document.body) {
          observer.observe(document.body, { childList: true, subtree: true })
        } else {
          document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { childList: true, subtree: true }))
        }
        if (ctx && typeof ctx.effect === 'function') {
          ctx.effect(() => () => {
            if (observer) observer.disconnect()
            if (scheduled) window.clearTimeout(scheduled)
            for (const toast of document.querySelectorAll('[' + TOAST_ATTR + ']')) toast.remove()
            for (const wrap of document.querySelectorAll('[' + WRAP_ATTR + ']')) {
              const img = wrap.querySelector('img[data-meme-img]')
              if (img && wrap.parentNode) wrap.parentNode.insertBefore(img, wrap)
              wrap.remove()
            }
          }, 'dsh-meme-copy-own: cleanup')
        }
        console.info('[dsh-meme-copy-own] 已启用：表情包（含选择面板）上出现复制按钮')
      } catch (error) {
        console.warn('[dsh-meme-copy-own] 启用失败:', error)
      }
    }

    function inject() {}

    exports.apply = apply
    exports.inject = inject
    exports.__test = {
      clipboardMime,
      needsPngConversion,
      isMemeImageElement,
      isAlreadyWrapped,
      extractBackgroundUrl,
      decorateAll,
      decoratePickers
    }
    return module.exports
  }
})
