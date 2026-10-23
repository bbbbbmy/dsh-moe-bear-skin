# assets/

壁纸素材目录。

**随包分发的只有一个原创默认效果**（`.gitignore` 里给它开了白名单）：

```
assets/leaf-fall.webp         默认壁纸：落叶动效，1280×720，60 帧 @20fps，约 260 KB，无缝循环
assets/leaf-fall-poster.webp  它的首帧静图，8 KB，动图加载前先显示
```

两者都由 [`tools/make-wallpaper.py`](../tools/make-wallpaper.py) 用 Pillow 画出来，版权归本项目（MIT），可以自由分发。重画：

```sh
python tools/make-wallpaper.py
```

换成自己的素材（`CONFIG.wallpaper` 相应改成 `'image'` 或 `'video'`）：

```
assets/my-loop.mp4         循环视频（h264 / VP9 都能播；WebM 体积更小）
assets/my-loop.webp        动图 WebP / GIF / APNG
assets/my-poster.webp      首帧占位，几十 KB 即可
assets/my-bear.png         立绘，透明 PNG 最好；留空则用内置线稿熊
```

`assets/` 下除自带的 `leaf-fall*` 之外，所有图片/视频都被 git 忽略，不会被误提交。

要求与建议：

- **编码**：视频用 h264（`avc1`）或 VP9；DSH 桌面版是 Electron/Chromium，两者都带解码器。动图用 WebP 体积最小。
- **尺寸**：1920×1080 起步，2K 更细腻；`object-fit: cover` 会裁边，主体尽量靠中间。
- **体积**：本地磁盘读，几 MB ~ 20 MB 都行；`CONFIG.pauseWhenHidden` 会在窗口不可见时暂停解码。
- **循环**：`<video loop>` 不支持交叉淡入，短片（5~8 秒）循环时接缝处可能看得出来；动图则完全靠素材本身循环。

改完素材只需要重启 Harness（不要在运行中替换文件，视频句柄会被占住）。
