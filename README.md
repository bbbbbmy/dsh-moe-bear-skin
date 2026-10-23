# dsh-moe-bear-skin

自嘲熊动态壁纸皮肤，为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）桌面版 / Web 版准备的整屏壁纸皮肤。

- **整屏壁纸**：全窗口底层放一段循环视频（`<video autoplay muted loop playsinline>`，`position: fixed; z-index: -2; object-fit: cover`），侧栏、顶栏、右栏、底部输入区全部透明，壁纸从窗口最上沿铺到最下沿。
- **零依赖、零构建**：没有 React，没有打包步骤。`lib/client.js` 就是最终可执行的浏览器 bundle，`git clone` 完即可用。
- **自带兜底**：没有壁纸文件时用内置 SVG 小熊（呼吸 + 眨眼），窗口不会白屏。
- **毛玻璃只留一处**：输入框。侧栏/顶栏默认纯透明，可一键改回磨砂。
- **主题令牌**：浅色主色 `#7EB8C9`（雾蓝），深色 `#9CC2A8`（灰绿），通过 `ctx.theme.overrideTokens` 注入，跟随深/浅色切换。

```
┌───────────────────────────────────────────────┐
│  壁纸（video / img / SVG，cover 铺满）           │
│  ┌──────────┬──────────────────────────────┐  │
│  │ 侧栏      │  正文（透明，壁纸可见）         │  │
│  │ 透明      │                              │  │
│  │          │  ┌────────────────────────┐  │  │
│  │          │  │ 输入框（毛玻璃，可关）    │  │  │
│  └──────────┴──────────────────────────────┘  │
│  底部输入区同样透明（Harness 那道渐变被去掉）     │
└───────────────────────────────────────────────┘
```

## 安装

DSH 的插件是 **profile bundle**，装完需要重启（客户端 bundle 的字节在启动时快照，`Ctrl+R` 不够）。

```sh
# 从 GitHub 装（需要本机有 git）
dsh plugin --profile desktop add github:bbbbbmy/dsh-moe-bear-skin

# 或者直接指向本地目录（开发时用这条，改代码即时生效）
dsh plugin --profile desktop add link:/path/to/dsh-moe-bear-skin
```

`desktop` 换成你自己的 profile 名（`dsh web` 用 `web`）。装完**完全退出再打开** Harness。

> `file:` 与 `link:` 的区别：`file:` 会把包**复制**进 profile 的 `node_modules`（之后改源码不生效），`link:` 建的是 junction（软链，改源码立刻生效）。开发用 `link:`。

## 配置

所有可配置项集中在 `lib/client.js` 顶部的 `CONFIG`，CSS 由它生成，没有散落的魔法数字。

| 键 | 默认 | 说明 |
|---|---|---|
| `wallpaper` | `'video'` | `'video'` / `'gif'` / `'bear'`（用内置 SVG 小熊） |
| `wallpaperFile` | `'bear-loop-2k.mp4'` | assets/ 里的文件名，见下方 |
| `wallpaperFallbacks` | `['bear-loop.mp4', 'bear-loop.webm']` | 上面那个找不到时依次尝试 |
| `wallpaperPoster` | `'bear-cover.webp'` | 视频起播前的首帧占位 |
| `pauseWhenHidden` | `true` | 窗口不可见时暂停解码（省电） |
| `respectReducedMotion` | `true` | 系统开了「减少动态效果」时只显示静帧 |
| `portraitFile` | `''` | 立绘文件名；留空用内置线稿熊 |
| `portraitOpacity` | `0.26` | 立绘透明度 |
| `portraitPosition` | `'bottom-left'` | 或 `'bottom-right'` |
| `glassSidebar` | `false` | 侧栏要不要毛玻璃 |
| `glassTopbar` | `false` | 顶栏要不要毛玻璃 |
| `glassComposer` | `true` | 输入框要不要毛玻璃（`false` = 连输入框也透明） |
| `glassBlurPx` / `glassSaturate` | `18` / `1.25` | 毛玻璃强度 |
| `sidebarAlpha` / `topbarAlpha` | `0` | 侧栏/顶栏底色不透明度，`0.06~0.15` 可救回文字对比度 |
| `accentLight` / `accentDark` | `#7EB8C9` / `#9CC2A8` | 浅色/深色主色 |

## 换成你自己的壁纸

仓库**不包含**任何第三方壁纸（见 [assets/README.md](assets/README.md)），所以克隆下来默认是内置 SVG 小熊。换成视频：

1. 把文件放进 `assets/`：

   ```
   assets/bear-loop.mp4      循环背景（WebM 体积更小，也支持 .webm/.gif）
   assets/bear-cover.webp    首帧占位（可省，省了就用视频第一帧）
   assets/bear-standing.png  立绘（透明 PNG 最佳，可省）
   ```

2. 文件名不是默认值时，改 `CONFIG.wallpaperFile`（或加进 `wallpaperFallbacks`）。

3. 重启 Harness。

`.mp4 / .webm / .gif / .png` 等二进制素材默认被 `.gitignore` 排除，不会被误提交。

### `file://` 外壳的特殊情况

某些外壳用 `file://` 载入页面，此时浏览器取不到 `/moe-bear/assets/`，插件会退回内置 SVG。想让壁纸在那种外壳里也出现，可以把一段视频 **内联进 bundle**：

```sh
node tools/inline-assets.mjs --file assets/bear-loop.mp4   # 生成 base64，client.js 会变大
node tools/inline-assets.mjs --clear                        # 撤销
```

代价是 `lib/client.js` 会涨到十几 MB，所以默认不这么做。

## 工作原理

| 半边 | 文件 | 干了什么 |
|---|---|---|
| 宿主 | `lib/index.js` | 只做静态资源路由：`GET /moe-bear/assets/manifest.json` 返回 assets 文件清单，`GET /moe-bear/assets/<file>` 返回文件本体（后缀白名单、防目录穿越、`no-cache`）。等 `webServer` 服务就绪必须用 `ctx.inject(['webServer'], …)`——**不能在 `apply()` 里同步 `ctx.get('webServer')`**，`webserver` 这一行自己 `inject: [webStartup]`，比普通行晚就绪。 |
| 浏览器 | `lib/client.js` | 注入样式与三层 DOM（`[data-moe-layer="wallpaper"]`、`"scrim"`、`"portrait"`），用 `ctx.theme.overrideTokens` 覆盖 `--dsw-*` 令牌，用 `MutationObserver` 给语义锚点补 `.moe-glass`。 |

### 只用语义锚点，不写哈希类名

DSH 的类名带随机前缀（形如 `DuqLHW_sidebarCol`），所以选择器一律用 `[class*="_sidebarCol"]` 这种**后缀匹配**，或 Harness 自己声明过的 `data-*`：

| 目标 | 选择器 |
|---|---|
| 外壳 / 正文列 | `[class*="_frame"]`、`[class*="_centerCol"]`、`[class*="_leadingSeat"]` |
| 侧栏 / 右栏 | `[class*="_sidebarCol"]`、`[class*="_rightbarCol"]` |
| 顶栏 | `[data-windows-titlebar]` |
| 会话头部容器 | `*:has(> [data-conversation-header-leading])`（CSS 选不到父元素，用 `:has()`） |
| 底部输入区 | `[class*="_composerSeat"]`、`[class*="_composerStack"]`、`[class*="_composerHero"]`、`[data-composer-seat]` |
| 输入框 | `[data-composer-card]` |

Harness 改版时大概率只需要动这几个选择器。

> 底部那条「边框」其实是 `_composerSeat` 自带的一道
> `linear-gradient(180deg, transparent 0, var(--dsw-alias-bg-base) 36px)`（给滚动内容做遮罩用的），
> 本插件把它清掉，所以壁纸能一直铺到底。

## 卸载

```sh
dsh plugin --profile desktop remove dsh-moe-bear-skin
```

## License

MIT（见 [LICENSE](LICENSE)）。内置小熊 SVG 为本项目原创；你自己放进 `assets/` 的素材版权归你。
