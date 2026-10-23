// index.js - host half of dsh-meme-copy-own.
//
// The FEATURE is entirely client-side (lib/client.js): a copy button on the meme images in
// the chat (img[data-meme-img]) and on the cells of dsh-meme's picker (div.mp-cell), so a
// meme can be copied before it is ever sent.
//
// This half exists only because a DSH bundle needs a host-side entry point. It reads
// nothing, writes nothing, spawns nothing, registers no route, and touches no system
// setting — which is also why it needs no service dependencies.

function apply(ctx) {
  ctx?.logger?.info?.('[dsh-meme-copy-own] 已加载：表情包上会出现「复制图片」按钮')
}

export { apply }
