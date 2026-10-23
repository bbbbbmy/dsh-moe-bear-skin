/*! dsh-moe-bear-skin — browser half (classic script, no React, no build step).
 *
 * 自嘲熊动态壁纸: a looping pastel bear wallpaper behind the whole window, an
 * optional fading portrait, and glass sidebar/composer. Everything tunable lives
 * in the CONFIG block below — the CSS is generated from it, so no magic numbers
 * are scattered through style rules.
 *
 * Layers, back to front, all `position: fixed` and `pointer-events: none`:
 *   [data-moe-layer="wallpaper"]  z-index:-2  <svg> | <video> | <img>
 *   [data-moe-layer="scrim"]      z-index:-1  dark-mode legibility scrim
 *   [data-moe-layer="portrait"]   z-index:-1  optional standing bear
 * The app's own frame is made transparent through the --dsw-* token layer, so
 * the wallpaper shows through without covering any native UI or its hit areas.
 */
window.__ModuleLoader__.load({
  id: 'dsh-moe-bear-skin',
  factory: () => {
    'use strict';

    // ─────────────────────────────────────────────────────────────────────
    // 可配置项（改这里，不要改下面的 CSS）
    // ─────────────────────────────────────────────────────────────────────
    const CONFIG = {
      // 背景来源：'video'（assets/bear-loop-2k.mp4）| 'gif' | 'bear'（内置 SVG 兜底）
      wallpaper: 'video',
      // wallpaper 为 'video'/'gif' 时读取 assets/ 下的这个文件
      // 备选：'bear-loop.mp4'（890×501 预览版，0.9 MB，省解码/省内存）
      wallpaperFile: 'bear-loop-2k.mp4',
      // 视频首帧占位图（仅 'video'）
      wallpaperPoster: 'bear-cover.webp',
      // 素材取不到时是否退回内置 SVG 小熊。
      // false = 宁可留空也不显示那只卡通熊（想要兜底就改回 true）
      svgFallback: false,
      // 窗口不可见时暂停解码（视频壁纸常驻，省电/省 CPU）
      pauseWhenHidden: true,
      // 系统开启「减少动态效果」时只显示封面静帧
      respectReducedMotion: true,

      // 立绘：空字符串 → 用内置 SVG 立绘；填文件名 → 用 assets/ 里的图
      portraitFile: '',
      portraitOpacity: 0.26,
      // 'bottom-left' | 'bottom-right'
      portraitPosition: 'bottom-left',
      portraitWidthVw: 22,

      // 毛玻璃
      glassBlurPx: 18,
      glassSaturate: 1.25,
      // 侧栏/顶栏不做毛玻璃、不留底色 → 壁纸真正铺满整个窗口
      glassSidebar: false,
      glassTopbar: false,
      // 底部输入区：整条底栏（composerSeat 的那道渐变）永远去掉；
      // 输入框本体要不要保留磨砂由 glassComposer 决定（false = 连输入框也透明）
      glassComposer: true,
      // 侧栏 / 顶栏底色不透明度（0 = 全透明，0.06~0.15 可救回一点文字对比度）
      sidebarAlpha: 0,
      topbarAlpha: 0,

      // 配色（浅色 / 深色 主色）
      accentLight: '#7EB8C9',
      accentDark: '#9CC2A8',

      // 与 lib/index.js 的 route 保持一致
      assetRoute: '/moe-bear/assets/',
      // wallpaperFile 找不到时依次尝试这些（仓库版不带 mp4，靠内联兜底）
      wallpaperFallbacks: ['bear-loop.mp4', 'bear-loop.webm'],
      // 排查用：把壁纸装载过程记到 localStorage（键名 moe-bear-skin:debug），
      // 默认 false；出问题时临时改 true，重启后在 devtools/存储里就能看到原因。
      debugStorage: false,

    };

    // 可命中的语义锚点：只认 Harness 的 data-*/语义类名后缀，不写哈希前缀。
    // 命中后加 .moe-glass（backdrop-filter）。底栏容器（composerSeat）永不加磨砂：
    // 它身上是 Harness 自己那道 180deg 渐变，一旦磨砂就又变成一条“下边框”。
    const GLASS_TARGETS = [
      ...(CONFIG.glassComposer ? ['[data-composer-card]'] : []),
      ...(CONFIG.glassSidebar ? ['[class*="_sidebarCol"]', '[class*="_rightbarCol"]'] : []),
      ...(CONFIG.glassTopbar ? ['[data-windows-titlebar]'] : []),
    ];

    const rgba = (r, g, b, alpha) => `rgba(${r}, ${g}, ${b}, ${alpha})`;

    // ─── 主题 token 覆盖（名字取自 @deepseek-ai/dsh-client-ui-theme 的调色板）
    const TOKENS = {
      '--dsw-alias-brand-primary': { light: CONFIG.accentLight, dark: CONFIG.accentDark },
      '--dsw-alias-state-business-primary': { light: CONFIG.accentLight, dark: CONFIG.accentDark },
      '--dsw-alias-bg-base': { light: 'transparent', dark: 'transparent' },
      '--dsw-alias-bg-layer-1': { light: 'rgba(255,255,255,0.62)', dark: 'rgba(16,22,21,0.55)' },
      '--dsw-alias-bg-layer-2': { light: 'rgba(255,255,255,0.50)', dark: 'rgba(20,27,26,0.50)' },
      '--dsw-alias-bg-layer-3': { light: 'rgba(255,255,255,0.74)', dark: 'rgba(24,32,31,0.64)' },
      '--dsw-alias-bg-overlay': { light: 'rgba(255,255,255,0.66)', dark: 'rgba(18,25,24,0.68)' },
      // 侧栏 / 顶栏底色由 CONFIG 控制：0 → 全透明，壁纸一直铺到窗口边缘
      '--dsw-specific-sidebar-fill': {
        light: rgba(255, 255, 255, CONFIG.sidebarAlpha),
        dark: rgba(12, 18, 17, CONFIG.sidebarAlpha),
      },
      '--dsw-specific-menu': { light: 'rgba(255,255,255,0.80)', dark: 'rgba(22,29,28,0.84)' },
      '--dsw-menu-surface-fill': { light: 'rgba(255,255,255,0.72)', dark: 'rgba(20,27,26,0.76)' },
      '--dsw-alias-interactive-bg-hover': { light: 'rgba(126,184,201,0.16)', dark: 'rgba(156,194,168,0.16)' },
    };

    // ─── 内置小熊（无外部资源也能用）
    const WALLPAPER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" role="presentation" focusable="false">
<defs>
<linearGradient id="moe-bg" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#eaf6fb"/><stop offset="0.55" stop-color="#e7f3f5"/><stop offset="1" stop-color="#e3f2e8"/>
</linearGradient>
<radialGradient id="moe-glow" cx="0.5" cy="0.44" r="0.52">
<stop offset="0" stop-color="#ffffff" stop-opacity="0.9"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
</radialGradient>
</defs>
<style>
.moe-bear{animation:moe-breathe 7s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}
.moe-eye{animation:moe-blink 6.4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes moe-breathe{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-9px) scale(1.012)}}
@keyframes moe-blink{0%,90%,100%{transform:scaleY(1)}94%{transform:scaleY(0.1)}}
@media (prefers-reduced-motion:reduce){.moe-bear,.moe-eye{animation:none}}
</style>
<rect width="1600" height="1000" fill="url(#moe-bg)"/>
<circle cx="300" cy="190" r="170" fill="#cfe9f0" opacity="0.42"/>
<circle cx="1330" cy="300" r="130" fill="#d6ecdd" opacity="0.38"/>
<circle cx="1220" cy="820" r="220" fill="#cfe9d8" opacity="0.36"/>
<rect width="1600" height="1000" fill="url(#moe-glow)"/>
<g class="moe-bear">
<ellipse cx="800" cy="905" rx="300" ry="185" fill="#fffdf9"/>
<ellipse cx="800" cy="905" rx="300" ry="185" fill="none" stroke="#eef1ef" stroke-width="3"/>
<circle cx="652" cy="378" r="66" fill="#fffdf9"/>
<circle cx="948" cy="378" r="66" fill="#fffdf9"/>
<circle cx="652" cy="378" r="31" fill="#f6e6dc"/>
<circle cx="948" cy="378" r="31" fill="#f6e6dc"/>
<ellipse cx="800" cy="545" rx="205" ry="172" fill="#fffdf9"/>
<ellipse cx="800" cy="545" rx="205" ry="172" fill="none" stroke="#eef1ef" stroke-width="3"/>
<ellipse class="moe-eye" cx="742" cy="535" rx="25" ry="30" fill="#2f2f2f"/>
<ellipse class="moe-eye" cx="858" cy="535" rx="25" ry="30" fill="#2f2f2f"/>
<ellipse cx="700" cy="612" rx="36" ry="20" fill="#f6c9c4" opacity="0.55"/>
<ellipse cx="900" cy="612" rx="36" ry="20" fill="#f6c9c4" opacity="0.55"/>
<ellipse cx="800" cy="620" rx="98" ry="70" fill="#fbf3ec"/>
<ellipse cx="800" cy="588" rx="25" ry="17" fill="#3a3a3a"/>
<path d="M772 628q28 26 56 0" fill="none" stroke="#3a3a3a" stroke-width="7" stroke-linecap="round"/>
</g>
</svg>`;

    // 立绘：白色线稿自嘲熊（躺平漂浮姿态，与壁纸里那只同款画风）
    const PORTRAIT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 520" preserveAspectRatio="xMidYMax meet" role="presentation" focusable="false">
<g fill="#ffffff" stroke="#232323" stroke-width="10" stroke-linejoin="round" stroke-linecap="round">
<circle cx="232" cy="128" r="30"/>
<circle cx="408" cy="128" r="30"/>
<path d="M196 216c-56 -20 -94 8 -102 46" fill="none"/>
<path d="M444 216c56 -20 94 8 102 46" fill="none"/>
<path d="M266 428c-42 28 -54 58 -38 78" fill="none"/>
<path d="M374 428c42 28 54 58 38 78" fill="none"/>
<path d="M320 116c104 0 178 70 178 166 0 96 -80 150 -178 150 -98 0 -178 -54 -178 -150 0 -96 74 -166 178 -166z"/>
</g>
<circle cx="286" cy="250" r="10" fill="#232323"/>
<circle cx="354" cy="250" r="10" fill="#232323"/>
<path d="M304 292q16 14 32 0" fill="none" stroke="#232323" stroke-width="8" stroke-linecap="round"/>
</svg>`;

    // 内联兜底：宿主路由拿不到时，用 bundle 自带的这段视频（见 tools/inline-assets.mjs）。
    // 1.3 MB 的 base64 只会出现在这一行，其它代码不受影响。
    // >>> INLINE_BEGIN（tools/inline-assets.mjs 生成，勿手改）
    const INLINE_WALLPAPER = '';
    // <<< INLINE_END

    // ─── 样式（全部由 CONFIG 生成）
    const portraitSide = CONFIG.portraitPosition === 'bottom-right' ? 'right' : 'left';
    const maskOrigin = CONFIG.portraitPosition === 'bottom-right' ? '88% 92%' : '12% 92%';

    const CSS = `
:root[data-moe-skin] { --moe-blur: ${CONFIG.glassBlurPx}px; --moe-sat: ${CONFIG.glassSaturate}; }
body[data-ds-dark-theme] { --moe-blur: ${CONFIG.glassBlurPx}px; --moe-sat: ${CONFIG.glassSaturate}; }

/* 让壁纸透出来：页面基色透明，正文区不加任何底色 */
html, body { background: transparent !important; }
body { background-image: none !important; }

/* 外壳 / 侧栏 / 顶栏 / 右栏：全部透明，让壁纸真正铺满整屏。
   类名后缀来自 ui-layout（*_frame / *_sidebarCol / *_centerCol / *_leadingSeat / *_rightbarCol），
   不写哈希前缀；data-* 是 Harness 自己声明过的稳定语义锚点。 */
:is([class*="_frame"], [class*="_centerCol"], [class*="_leadingSeat"], [class*="_sidebarCol"], [class*="_rightbarCol"], [data-windows-titlebar]) {
  background-color: transparent !important;
  background-image: none !important;
}
/* 会话头部容器：用 :has() 选到“包着 header 插槽”的那一层，而不是插槽本身 */
*:has(> [data-conversation-header-leading]) {
  background-color: transparent !important;
  background-image: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

/* 底部输入区：Harness 给 *_composerSeat 画了一道
      background: linear-gradient(180deg, transparent 0, var(--dsw-alias-bg-base) 36px)
   这就是那条“下边框”。连容器层一起清掉，壁纸一直铺到窗口底边。 */
:is([class*="_composerSeat"], [class*="_composerStack"], [class*="_composerHero"], [data-composer-seat]) {
  background: transparent !important;
  background-image: none !important;
  border: 0 !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
*:has(> [data-composer-seat]) {
  background: transparent !important;
  background-image: none !important;
}
${CONFIG.glassComposer ? '' : '/* glassComposer=false：连输入框本体也透明 */\n[data-composer-card] { background: transparent !important; border-color: transparent !important; box-shadow: none !important; }\n'}
/* 顶栏底色：0 → 完全不压色；给 0.06~0.15 可换回一点文字对比度 */
body { --moe-topbar-tint: ${CONFIG.topbarAlpha}; }
:is([data-windows-titlebar]) { box-shadow: none !important; }
body::before {
  content: "";
  position: fixed;
  inset-inline: 0;
  top: 0;
  height: var(--moe-topbar-height, 0px);
  background: rgba(255, 255, 255, var(--moe-topbar-tint));
  pointer-events: none;
  z-index: -1;
}

/* 壁纸层：不接收鼠标事件，不参与布局，层级在应用内容之下 */
[data-moe-layer] { position: fixed; inset: 0; pointer-events: none; -webkit-user-select: none; user-select: none; }
[data-moe-layer="wallpaper"] { z-index: -2; overflow: hidden; }
[data-moe-layer="wallpaper"] > svg,
[data-moe-layer="wallpaper"] > img,
[data-moe-layer="wallpaper"] > video { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center; }
body[data-ds-dark-theme] [data-moe-layer="wallpaper"] > * { filter: brightness(0.5) saturate(0.72); }

/* 深色模式压一层柔和暗色，保证正文对比度 */
[data-moe-layer="scrim"] { z-index: -1; background: rgba(8, 14, 13, 0); transition: background-color 0.45s ease; }
body[data-ds-dark-theme] [data-moe-layer="scrim"] { background: rgba(8, 14, 13, 0.62); }

/* 立绘：opacity + mask 渐隐边缘，贴着窗口底边 */
[data-moe-layer="portrait"] {
  z-index: -1;
  top: auto;
  bottom: 0;
  ${portraitSide}: 0;
  width: ${CONFIG.portraitWidthVw}vw;
  min-width: 150px;
  max-width: 340px;
  height: auto;
  opacity: ${CONFIG.portraitOpacity};
  -webkit-mask-image: radial-gradient(125% 125% at ${maskOrigin}, #000 32%, transparent 76%);
  mask-image: radial-gradient(125% 125% at ${maskOrigin}, #000 32%, transparent 76%);
}
[data-moe-layer="portrait"] > svg,
[data-moe-layer="portrait"] > img { display: block; width: 100%; height: auto; }

/* 毛玻璃：只加在 JS 命中的语义锚点上 */
.moe-glass {
  -webkit-backdrop-filter: blur(var(--moe-blur, ${CONFIG.glassBlurPx}px)) saturate(var(--moe-sat, ${CONFIG.glassSaturate}));
  backdrop-filter: blur(var(--moe-blur, ${CONFIG.glassBlurPx}px)) saturate(var(--moe-sat, ${CONFIG.glassSaturate}));
}
[class*="_sidebarCol"].moe-glass { box-shadow: inset -1px 0 0 0 rgba(126, 184, 201, 0.22); }
[data-composer-card].moe-glass {
  box-shadow: 0 10px 30px -22px rgba(24, 48, 56, 0.45), inset 0 0 0 1px rgba(255, 255, 255, 0.35);
}
/* 侧栏关闭毛玻璃时，也不要留描边，否则“满屏”会有一道竖线 */
[class*="_sidebarCol"] { box-shadow: none !important; border-inline-end-color: transparent !important; }
@media (prefers-reduced-motion: reduce) { .moe-glass { transition: none; } }
`;

    // ─── 小工具
    const assetUrl = (file) => `${CONFIG.assetRoute}${encodeURIComponent(file)}`;
    const tag = '[moe-bear-skin]';

    /**
     * assets/ 里现有哪些文件。故意不按 location.protocol 提前返回：桌面版有可能
     * 用 file:// 加载外壳，那里的相对 fetch 会立刻失败并落到 catch，回到内置 SVG；
     * 而 http(s) 外壳（包括 browser 里的 dsh web）能正常拿到视频。
     * 失败要留痕：这里是「壁纸没出现」唯一能自证的地方。
     */
    async function fetchManifest() {
      const url = `${CONFIG.assetRoute}manifest.json`;
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
          console.warn(`${tag} ${url} -> HTTP ${res.status}; 退回内置 SVG 壁纸`);
          return null;
        }
        const body = await res.json();
        return new Set(Array.isArray(body && body.files) ? body.files : []);
      } catch (error) {
        console.warn(
          `${tag} ${url} fetch failed (${location.protocol}//${location.host}) — ${error instanceof Error ? error.message : error}; 退回内置 SVG 壁纸`,
        );
        return null;
      }
    }

    /**
     * 排查用记录器：把装载过程写进 localStorage（键 `moe-bear-skin:debug`）。
     * 默认关闭，`CONFIG.debugStorage: true` 才写；写失败也不影响皮肤。
     */
    const debugEvents = [];
    function record(event) {
      if (!CONFIG.debugStorage) return;
      debugEvents.push(`${new Date().toISOString()} ${event}`);
      try {
        localStorage.setItem('moe-bear-skin:debug', debugEvents.slice(-20).join('\n'));
      } catch {
        // 无痕/受限环境写不了 localStorage，忽略即可。
      }
    }

    /** 视频壁纸：静音、循环、内联播放。`src` 可以是路由 URL，也可以是 data URI。 */
    function createVideo(src, posterSrc) {
      const video = document.createElement('video');
      video.src = src;
      if (posterSrc) video.poster = posterSrc;
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('disablepictureinpicture', '');
      video.setAttribute('aria-hidden', 'true');
      // 这三个事件是「壁纸到底有没有起来」的全部证据。
      video.addEventListener('loadeddata', () => record(`video loadeddata ${video.videoWidth}x${video.videoHeight}`));
      video.addEventListener('playing', () => record('video playing'));
      video.addEventListener('error', () => {
        const code = video.error?.code;
        const message = video.error?.message;
        record(`video error code=${code} message=${message} src=${String(src).slice(0, 80)}`);
        console.warn(`[moe-bear-skin] video error code=${code} ${message ?? ''}`);
      });
      const play = () => {
        const started = video.play?.();
        if (started && typeof started.catch === 'function') {
          started.catch((error) => record(`play() rejected ${error?.name}: ${error?.message}`));
        }
      };
      play();
      return { element: video, play };
    }

    /** 页面不可见时暂停解码；返回清理函数。 */
    function mountVisibility(element, play, pause) {
      if (!CONFIG.pauseWhenHidden) return () => {};
      const onVisibility = () => (document.hidden ? pause() : play());
      document.addEventListener('visibilitychange', onVisibility);
      return () => document.removeEventListener('visibilitychange', onVisibility);
    }

    /** 在 assets 清单里挑一个可用的壁纸文件（先 wallpaperFile，再 fallbacks）。 */
    function pickWallpaper(files) {
      const candidates = [CONFIG.wallpaperFile, ...(CONFIG.wallpaperFallbacks ?? [])];
      for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.length > 0 && files.has(candidate)) return candidate;
      }
      return '';
    }

    function createImage(file) {
      const image = new Image();
      image.src = assetUrl(file);
      image.alt = '';
      image.setAttribute('aria-hidden', 'true');
      image.decoding = 'async';
      return image;
    }

    /** 命中语义锚点并加 .moe-glass；DOM 变化后重新标记（React 会重挂节点）。 */
    function watchGlass() {
      const observer = new MutationObserver(() => {
        observer.disconnect();
        mark();
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      });
      function mark() {
        for (const selector of GLASS_TARGETS) {
          for (const element of document.querySelectorAll(selector)) element.classList.add('moe-glass');
        }
      }
      mark();
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      return () => {
        observer.disconnect();
        for (const element of document.querySelectorAll('.moe-glass')) element.classList.remove('moe-glass');
      };
    }

    /**
     * 用真实媒体替换内置 SVG。
     * 顺序：宿主静态路由（按 wallpaperFile → wallpaperFallbacks 依次尝试）→ bundle 内联兜底 → 内置 SVG。
     * @returns 清理函数（暂停视频、摘掉监听），dispose 时调用。
     */
    async function hydrateMedia(wallpaper, portrait) {
      const files = await fetchManifest();
      const reduceMotion =
        CONFIG.respectReducedMotion && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
      record(
        `manifest ${files === null ? 'unreachable' : `[${[...files].join('|')}]`} reduce=${reduceMotion} inline=${INLINE_WALLPAPER ? 1 : 0}`,
      );

      if (files === null) {
        // 宿主路由不可达：能内联就直接用 bundle 里那段视频，别再退回卡通渐变。
        if (!INLINE_WALLPAPER || CONFIG.wallpaper !== 'video' || reduceMotion) {
          record('no manifest and no inline video; leaving the wallpaper empty');
          return () => {};
        }
        const { element, play } = createVideo(INLINE_WALLPAPER);
        wallpaper.replaceChildren(element);
        return mountVisibility(element, play, () => element.pause());
      }

      const cleanups = [];
      // 配置里点名的文件可能不在（仓库版不带 mp4），按候选清单挑第一个真实存在的。
      const chosen = pickWallpaper(files);
      const wantsVideo = CONFIG.wallpaper === 'video' && chosen !== '';
      record(`chosen=${chosen || '(none)'} wantsVideo=${wantsVideo}`);

      if (wantsVideo && reduceMotion && CONFIG.wallpaperPoster && files.has(CONFIG.wallpaperPoster)) {
        // 用户要求减少动态效果：只留一帧封面，不启动解码。
        wallpaper.replaceChildren(createImage(CONFIG.wallpaperPoster));
      } else if (wantsVideo) {
        const { element, play } = createVideo(
          assetUrl(chosen),
          CONFIG.wallpaperPoster && files.has(CONFIG.wallpaperPoster) ? assetUrl(CONFIG.wallpaperPoster) : '',
        );
        wallpaper.replaceChildren(element);
        cleanups.push(mountVisibility(element, play, () => element.pause()));
      } else if (CONFIG.wallpaper === 'gif' && chosen !== '') {
        wallpaper.replaceChildren(createImage(chosen));
      } else {
        record('nothing to mount; wallpaper stays empty (svgFallback is off)');
      }

      if (CONFIG.portraitFile && files.has(CONFIG.portraitFile)) {
        portrait.replaceChildren(createImage(CONFIG.portraitFile));
      }
      return () => {
        for (const cleanup of cleanups) cleanup();
      };
    }

    // ─── 插件主体
    function apply(ctx) {
      try {
        ctx.effect(() => {
          document.documentElement.dataset.moeSkin = 'bear';

          const style = document.createElement('style');
          style.dataset.moeSkinStyle = '';
          style.textContent = CSS;
          document.head.append(style);

          const wallpaper = document.createElement('div');
          wallpaper.dataset.moeLayer = 'wallpaper';
          wallpaper.setAttribute('aria-hidden', 'true');
          // 只有显式要「内置小熊」或打开 svgFallback 时才先画那只卡通熊；
          // 否则这一层保持空白，交给实际素材去填，取不到就什么都不显示。
          if (CONFIG.wallpaper === 'bear' || CONFIG.svgFallback) wallpaper.innerHTML = WALLPAPER_SVG;
          record(`apply wallpaper=${CONFIG.wallpaper} svgFallback=${CONFIG.svgFallback}`);

          const scrim = document.createElement('div');
          scrim.dataset.moeLayer = 'scrim';
          scrim.setAttribute('aria-hidden', 'true');

          const portrait = document.createElement('div');
          portrait.dataset.moeLayer = 'portrait';
          portrait.setAttribute('aria-hidden', 'true');
          if (CONFIG.portraitFile || CONFIG.portraitOpacity > 0) portrait.innerHTML = PORTRAIT_SVG;

          document.body.append(wallpaper, scrim, portrait);

          const releaseTokens =
            typeof ctx.theme?.overrideTokens === 'function' ? ctx.theme.overrideTokens('dsh-moe-bear-skin', TOKENS) : () => {};
          const releaseGlass = watchGlass();
          let disposed = false;
          let releaseMedia = () => {};
          void hydrateMedia(wallpaper, portrait)
            .then((release) => {
              // 组件在媒体解析完成前就 dispose 了：立刻清掉刚接上的监听/解码。
              if (disposed) release();
              else releaseMedia = release;
            })
            .catch((error) => {
              record(`hydrateMedia threw: ${error?.name}: ${error?.message}`);
              console.warn('[moe-bear-skin] media', error);
            });

          return () => {
            if (disposed) return;
            disposed = true;
            releaseTokens();
            releaseGlass();
            releaseMedia();
            wallpaper.remove();
            scrim.remove();
            portrait.remove();
            style.remove();
            delete document.documentElement.dataset.moeSkin;
          };
        });
      } catch (error) {
        console.warn('[moe-bear-skin] failed to apply', error);
      }
    }

    var module = { exports: {} };
    var exports = module.exports;
    exports.inject = ['theme'];
    exports.apply = apply;
    return module.exports;
  },
});
