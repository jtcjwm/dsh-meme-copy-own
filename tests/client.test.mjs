// client.test.mjs - the plugin has one job: put a meme image on the clipboard.
// Run in-process: node dsh-meme-copy-own/tests/client.test.mjs
// (`node --test <dir>` spawns child processes with piped stdio and the DSH file
// sandbox denies that with EPERM.)

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { needsPngConversion, clipboardMime, isMemeImageElement, isAlreadyWrapped } from '../lib/helpers.js'

const captured = []
globalThis.window = {
  __ModuleLoader__: { load: (entry) => captured.push(entry) },
  setTimeout: () => 0,
  clearTimeout: () => {}
}

await import('../lib/client.js')

test('the bundle registers itself under the package name', () => {
  assert.equal(captured.length, 1, 'exactly one loader entry')
  assert.equal(captured[0].id, 'dsh-meme-copy-own', 'loader id must equal the package name')
  assert.equal(typeof captured[0].factory, 'function')
})

const exports = captured[0].factory((name) => {
  throw new Error('unexpected require: ' + name)
})

test('it exports the loader entry points', () => {
  assert.equal(typeof exports.apply, 'function', 'apply')
  assert.equal(typeof exports.inject, 'function', 'inject')
})

test('it finds meme images and wraps each one only once', () => {
  assert.equal(isMemeImageElement({ tagName: 'IMG', dataset: { memeImg: 'x' } }), true)
  assert.equal(isMemeImageElement({ tagName: 'IMG', dataset: {} }), false)
  assert.equal(isMemeImageElement(null), false)
  assert.equal(isAlreadyWrapped({ closest: (s) => (s === '[data-meme-copy]' ? {} : null) }), true)
  assert.equal(isAlreadyWrapped({ closest: () => null }), false)
  assert.equal(isAlreadyWrapped(null), false)
})

test('the clipboard payload is always png', () => {
  assert.equal(clipboardMime(), 'image/png')
  assert.equal(needsPngConversion('image/jpeg'), true)
  assert.equal(needsPngConversion('image/webp'), true)
  assert.equal(needsPngConversion('image/png'), false)
  assert.equal(needsPngConversion(''), true)
})

test('the inline copies inside client.js match lib/helpers.js', () => {
  const t = exports.__test
  assert.equal(typeof t, 'object', '__test exposed')
  assert.equal(t.clipboardMime(), clipboardMime())

  for (const type of ['image/jpeg', 'image/webp', 'image/png', 'IMAGE/PNG', '', null]) {
    assert.equal(t.needsPngConversion(type), needsPngConversion(type), 'needsPngConversion(' + type + ')')
  }

  const elements = [
    { tagName: 'IMG', dataset: { memeImg: 'x' } },
    { tagName: 'IMG', dataset: {} },
    { tagName: 'DIV', dataset: { memeImg: 'x' } },
    null
  ]
  for (const el of elements) {
    assert.equal(t.isMemeImageElement(el), isMemeImageElement(el), 'isMemeImageElement')
  }

  const wrapped = { closest: (s) => (s === '[data-meme-copy]' ? {} : null) }
  assert.equal(t.isAlreadyWrapped(wrapped), isAlreadyWrapped(wrapped))
  assert.equal(t.isAlreadyWrapped({ closest: () => null }), isAlreadyWrapped({ closest: () => null }))
  assert.equal(t.isAlreadyWrapped(null), isAlreadyWrapped(null))
})
