# 站点图片资源放这里

把图片文件直接丢进这个目录（`apps/web/public/bg/`），例如：

```
apps/web/public/bg/home.jpg        # 站点背景图
apps/web/public/bg/clock-face.png  # 首页时钟的表盘底图
```

Vite 会把 `public/` 原样复制到构建产物根目录，所以上面这两张图的访问路径就是
**`/bg/home.jpg`** 和 **`/bg/clock-face.png`**（不带 hash，随时换图不用改代码）。

⚠️ 引用时**必须写 `/bg/...` 这种绝对路径**。写成 `url('../public/bg/home.jpg')` 相对路径
虽然本地 dev 能显示，但打包时 Vite 会把它当模块资源再复制一份，产物里同一张图出现两次。

## 站点背景图

编辑 `apps/web/src/styles.css` 最顶部的 `:root`，改两个变量：

```css
:root {
  /* 1. 换成你的图片路径 */
  --bg-image: url('/bg/home.jpg');

  /* 2. 底色蒙版调淡，让图片透出来（100% = 纯色看不到图；建议 50%~70%） */
  --bg-veil: 60%;
}
```

暗色主题想换另一张图（或另一个透明度），改 `:root[data-theme='dark']` 里的同名变量：

```css
:root[data-theme='dark'] {
  --bg-image: url('/bg/home-dark.jpg');
  --bg-veil: 55%;
}
```

说明：

- 背景图是 `fixed` 的，滚动时不动，毛玻璃才有稳定的虚化对象。
- `--bg-veil` 越低图片越清晰，但正文对比度会下降；调完请在亮/暗两个主题下都看一眼文字是否清楚。
- `--bg-blur` 控制整片磨砂强度：0 = 背景图完全清晰，12px 左右保留照片轮廓，20px+ 只剩色块。
- 建议图片宽度 ≥ 1920px，压到 300KB 以内（jpg / webp）。

## 首页时钟的表盘底图

同一个 `:root`，改一个变量：

```css
:root {
  --clock-face-image: url('/bg/clock-face.png');
}
```

暗色主题可以单独换一张：改 `:root[data-theme='dark']` 里的 `--clock-face-image`。

说明：

- 表盘是**正圆**，底图按 `cover` 填充并居中裁切，所以请用**正方形、主体居中**的图，
  否则边缘会被切掉。
- 显示尺寸约 108px（窄屏 88px），准备 2 倍图（216×216 以上）即可，不用更大。
- 想要透明背景的表盘（露出卡片底色）就用 png。
- 不设这个变量时，表盘显示自带的一圈淡色刻度（内联 SVG，跟随主题色）。
- 三根指针（时/分/秒）是 DOM 元素，画在底图之上，颜色跟随主题，不需要画进图里。

## 临时预览

不想改代码看效果：浏览器 DevTools 里选中 `<html>`，加内联样式即可实时预览，例如

```
--bg-image: url('/bg/home.jpg'); --bg-veil: 60%; --clock-face-image: url('/bg/clock-face.png');
```
