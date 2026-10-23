// picker.test.mjs - the picker half of dsh-meme-copy-own.
//
// dsh-meme's picker renders each meme as a div.mp-cell whose picture is a CSS
// background-image (there is NO <img> element), so the copy affordance has to find the
// URL in the style attribute. That lookup is a pure function and is tested here.
//
// Run in-process: node dsh-meme-copy-own/tests/picker.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { extractBackgroundUrl } from '../lib/helpers.js'

test('finds the url in a react-serialised background-image', () => {
  assert.equal(
    extractBackgroundUrl('width: 74px; height: 74px; background-image: url(/dsh-memes/a.jpg); background-size: cover;'),
    '/dsh-memes/a.jpg'
  )
  assert.equal(extractBackgroundUrl('background-image: url("/dsh-memes/b.png")'), '/dsh-memes/b.png')
  assert.equal(extractBackgroundUrl("background-image: url('/dsh-memes/c.webp')"), '/dsh-memes/c.webp')
  assert.equal(
    extractBackgroundUrl('background-image: url(http://127.0.0.1:19387/dsh-memes/d.jpg)'),
    'http://127.0.0.1:19387/dsh-memes/d.jpg'
  )
})

test('falls back to the computed style, then gives up cleanly', () => {
  assert.equal(extractBackgroundUrl('', 'url("http://host/e.gif")'), 'http://host/e.gif')
  assert.equal(extractBackgroundUrl('color: red', 'none'), '')
  assert.equal(extractBackgroundUrl('', ''), '')
  assert.equal(extractBackgroundUrl(null, undefined), '')
  assert.equal(extractBackgroundUrl(undefined, 'url(/f.png)'), '/f.png')
})

test('prefers the inline style over the computed one', () => {
  assert.equal(extractBackgroundUrl('background-image: url(/inline.png)', 'url(/computed.png)'), '/inline.png')
})

test('the copy inside client.js matches lib/helpers.js', async () => {
  const captured = []
  globalThis.window = {
    __ModuleLoader__: { load: (entry) => captured.push(entry) },
    setTimeout: () => 0,
    clearTimeout: () => {},
    getComputedStyle: undefined
  }
  await import('../lib/client.js')
  const clientHelpers = captured[0].factory(() => {
    throw new Error('unexpected require')
  }).__test

  const samples = [
    'background-image: url(/dsh-memes/a.jpg)',
    'background-image: url("/dsh-memes/b.png")',
    "background-image: url('/dsh-memes/c.webp')",
    'color: red',
    ''
  ]
  for (const sample of samples) {
    assert.equal(clientHelpers.extractBackgroundUrl(sample, ''), extractBackgroundUrl(sample, ''), sample)
  }
  assert.equal(clientHelpers.extractBackgroundUrl('', 'url(/from-computed.png)'), extractBackgroundUrl('', 'url(/from-computed.png)'))
  assert.equal(typeof clientHelpers.decoratePickers, 'function', 'picker pass exported for regression')
})
