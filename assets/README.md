# assets/

壁纸素材目录。**仓库故意不提交任何图片/视频**（`.gitignore` 已排除），所以克隆下来这里是空的，皮肤会先用内置 SVG 小熊兜底。

放文件进来（文件名随意，改 `lib/client.js` 里的 `CONFIG.wallpaperFile` 对应上即可）：

```
assets/bear-loop.mp4       循环背景视频（h264 / VP9 都能播；WebM 体积更小）
assets/bear-loop.webm      同上，备选后缀（CONFIG.wallpaperFallbacks 会自动尝试）
assets/bear-cover.webp     视频起播前的首帧占位，23 KB 级别即可
assets/bear-standing.png   立绘，透明 PNG 最好；留空则用内置线稿熊
```

要求与建议：

- **编码**：视频用 h264（`avc1`）或 VP9；DSH 桌面版是 Electron/Chromium，两者都带解码器。GIF 也行但体积大。
- **尺寸**：1920×1080 起步，2K 更细腻；`object-fit: cover` 会裁边，主体尽量靠中间。
- **体积**：桌面版从本地磁盘读，几 MB ~ 20 MB 都行；`CONFIG.pauseWhenHidden` 会在窗口不可见时暂停解码。
- **循环**：`<video loop>` 不支持交叉淡入，短片（5~8 秒）循环时接缝处可能看得出水面跳一下，长一点的素材更顺。

改完素材只需要重启 Harness（不要在运行中替换文件，视频句柄会被占住）。
