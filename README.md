# dsh-meme-copy-own

给 DSH 聊天里的表情包加**一个**按钮：**复制图片**。点它 → 图片进剪贴板 → 到微信/QQ/任何收粘贴图片的软件里按 `Ctrl+V` 就能发出去。

就这一件事，没有别的：不装外部程序、不联网、不读文件、不写注册表、不设开机自启、不注册热键。删掉插件目录并把 profile 里那两行去掉，界面立刻恢复原样。

## 安装

profile（`C:\Users\<你>\.dsh\profiles\desktop\package.json`）：

```jsonc
{
  "dependencies": { "dsh-meme-copy-own": "link:D:/DSH/plugins/dsh-meme-copy-own" },
  "dsh": { "profile": { "bundles": [ /* ... */ "dsh-meme-copy-own" ] } }
}
```

`node_modules` 里要有对应条目（pnpm 的 `link:` 就是指向插件目录的**目录联接 / Junction**；手工建：`New-Item -ItemType Junction -Path <node_modules>\dsh-meme-copy-own -Target D:\DSH\plugins\dsh-meme-copy-own`）。**然后重启 DSH 桌面端**——新插件不是热改。

## 用法

把鼠标移到聊天里的表情包上 → 右上角出现复制图标 → 点一下 → 左下角会提示「已复制图片」，然后去微信/QQ 输入框 `Ctrl+V`。

失败不会静默：图标变红，并弹出提示写明原因（最常见是宿主未授予剪贴板写入权限）。

## 为什么用剪贴板而不是拖拽

从浏览器窗口把图片拖出去给不了真文件（`CF_HDROP`），微信/QQ 都不认——本机实测过，并且全量扫描 DSH 的 `app.asar` 确认整个应用没有原生拖拽通道。剪贴板是网页端唯一可靠的出路。

## 设计约束

1. **不改 `dsh-meme` 任何文件**，只挂在它注入的 `img[data-meme-img]` 标记上；它升级不影响本插件。
2. **聊天 DOM 里没有文本节点**：`dsh-meme` 刻意维持消息 `textContent` 与原始 `[表情: x]` 一致（其它插件靠这个判断消息是否被改过）。所以按钮只用 SVG 图标 + `title`，提示浮层挂在 `document.body` 上，不在聊天流里。
3. **图片离开 DOM 就拆掉包装**：`dsh-meme` 去重时会随时 `remove()` 掉重复的 `img`。
4. **零依赖**：客户端半边不 `require` 任何包。

## 测试

```powershell
node dsh-meme-copy-own/tests/client.test.mjs
```

> 别用 `node --test <目录>`：它靠子进程 + 管道 stdio 跑用例，会被 DSH 文件沙箱拒（`spawn EPERM`）。直接 `node <文件>`，`node:test` 在本进程内跑。

DOM 部分（悬停按钮、点击、剪贴板）无法无头验证，人工验收：重启 DSH → 悬停表情包 → 点复制 → 微信/QQ 里 `Ctrl+V`。
