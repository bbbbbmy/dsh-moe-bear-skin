# Changelog

## v0.1.0 — 2026-10-23

首个可用版本：把 DeepSeek Harness 的整个窗口交给一张循环壁纸。

### 新增

- **整屏壁纸层**：`<video autoplay muted loop playsinline>` / `<img>` / 内置 SVG，`position: fixed; z-index: -2; object-fit: cover`，`pointer-events: none`，不参与布局也不挡交互。
- **外壳全透明**：`_frame` / `_centerCol` / `_leadingSeat` / `_sidebarCol` / `_rightbarCol` / `[data-windows-titlebar]` 一律清掉底色；会话头部用 `:has(> [data-conversation-header-leading])` 选中容器；底部 `_composerSeat` 的 `linear-gradient(180deg, …)` 遮罩也被清掉，壁纸从上沿铺到下沿。
- **唯一的毛玻璃**：输入框（`[data-composer-card]`）。侧栏/顶栏默认纯透明，`glassSidebar` / `glassTopbar` 可一键改回磨砂。
- **主题令牌注入**：`ctx.theme.overrideTokens` 覆盖 `--dsw-*`，浅色主色 `#7EB8C9`、深色 `#9CC2A8`；侧栏/顶栏底色透明度由 `sidebarAlpha` / `topbarAlpha` 控制。
- **立绘**：`mask-image` 径向渐隐 + `opacity`，位置/宽度可配；内置线稿熊，也可换成 `assets/` 里的透明 PNG。
- **素材路由**（宿主侧 `lib/index.js`）：`GET /moe-bear/assets/manifest.json` 列文件，`GET /moe-bear/assets/<file>` 出文件；后缀白名单、防目录穿越、`no-cache`；用 `ctx.inject(['webServer'], …)` 等 `webServer` 就绪后再注册。
- **降级链**：`wallpaperFile` → `wallpaperFallbacks` → 内联 data URI（`tools/inline-assets.mjs`）→ 内置 SVG（`svgFallback`，默认关闭）。
- **省电**：`pauseWhenHidden` 在窗口不可见时暂停解码；`respectReducedMotion` 在系统开启「减少动态效果」时只显示静帧。
- **零依赖**：没有 React、没有构建步骤，`lib/client.js` 即最终 bundle；只用语义锚点（`[class*="_sidebarCol"]`、`data-*`），不写哈希类名。

### 已知限制

- `<video loop>` 不做交叉淡入，5~8 秒短片在接缝处可能看得出跳变。
- 侧栏全透明后，文字对比度取决于壁纸明暗；`sidebarAlpha: 0.06~0.15` 可压一层很浅的底色救回来。
- 用 `file://` 载入页面的外壳取不到 `/moe-bear/assets/`，需要用 `tools/inline-assets.mjs` 把视频内联进 bundle。

### 开发备注

- 装插件用 `link:` 而不是 `file:`：pnpm 的 `file:` 会把包复制进 profile，改源码不生效（踩过）。
- 宿主行不要同步 `ctx.get('webServer')`：`webserver` 这一行自己 `inject: [webStartup]`，比普通行晚就绪，同步取一定是 `undefined`；也不要在未 `inject` 的 ctx 上读 `ctx.webServer`，cordis 会抛 `cannot get property … without inject`。
- 前缀路由不能带结尾斜杠：`match()` 用 `pathname.startsWith(prefix + '/')`，`/x/` 会变成 `/x//`。
