# 前台视觉重构接手记录（爱莉希雅「粉色妖精」主题）

> 状态：已实现（分支 `feat/ui-elysia-theme-CC`）
> 范围：仅 `apps/web` 前台视觉层；后台 / API 不改，开屏终端黑绿配色刻意独立不换肤

## 目的

「3D 书页翻页」动画移除后，继续清掉全部「书」主题装饰（书皮侧边条、稿纸横线背景、纸页文案），并把站点视觉整体重构为崩坏三角色**爱莉希雅**（粉色妖精小姐）的意象：柔粉 + 珍珠白 + 金色点缀、梦幻优雅，含轻量蝴蝶/水晶元素。

## 设计令牌（styles.css `:root` 与 `:root[data-theme='dark']` 两套）

### Light

| 变量                 | 值                                  | 用途                                         |
| -------------------- | ----------------------------------- | -------------------------------------------- |
| `--accent`           | `#e0568f`                           | 甜美亮粉，装饰/图标/focus 环/悬停混色        |
| `--accent-strong`    | `#b93c6d`                           | 深玫瑰，正文强调 + 按钮底（白底 ≈5.4:1，AA） |
| `--gold`             | `#e6c384`                           | 香槟金装饰                                   |
| `--bg` / `--bg-soft` | `#fbf3f8` / `#fde8f2`               | 极淡粉白 / 粉调次级块                        |
| `--border`           | `#f3d5e3`                           | 浅粉描边                                     |
| `--card`             | `rgb(255 255 255 / 78%)`            | 半透明白瓷                                   |
| `--surface`          | `#ffffff`                           | 输入框/弹窗面                                |
| `--ink` / `--muted`  | `#3d2f38` / `#735863`               | 主/次要文字（≈11.5:1 / ≈4.9:1）              |
| `--shadow`           | `0 18px 50px rgb(176 88 126 / 16%)` | 玫瑰色投影                                   |
| `--on-accent`        | `#fff7fa`                           | 按钮/徽标/品牌块上的暖白字                   |

### Dark（低饱和深梅紫，非纯黑）

`--accent: #f2a0bd` / `--accent-strong: #ffd2df` / `--gold: #dbb877` / `--bg: #251a28` / `--bg-soft: #33222f` / `--border: #5d4350` / `--card: rgb(62 42 57 / 86%)` / `--surface: #382a38` / `--ink: #f6e6ee` / `--muted: #c9b2bf` / `--shadow: 0 18px 50px rgb(10 5 12 / 36%)` / **`--on-accent: #3c1226`（深梅字）**。

### 圆角三级 token

```css
--radius-sm: 10px; /* 小控件/按钮/输入框 */
--radius-md: 14px; /* 常规卡片 */
--radius-lg: 20px; /* 大容器/正文页 */
```

### 梦幻背景 `--bg-aura`

三层静态梯度（左上粉晕 + 右上香槟金暖光 + 粉白纵向渐变），无动画、无 `filter`，合成进 `.site-shell` 背景。切勿退回大面积纯色或引入渐变动画。

## 书主题删除清单（不得恢复）

- `--book-cover*`（light/dark 两处）
- `--paper-line`、`--paper-background`
- `.site-shell::before/::after` 书皮侧边条及其响应式宽度规则（`@media (width <= 1100px)` 整块已删；`<= 760px` 内残留已删）
- `.photo-canvas` 上的稿纸横线梯度；任何 paper-line 横向纹理

## `--on-accent` 的对比修复逻辑

旧实现 dark 下 `--accent` / `--accent-strong` 作按钮底 + `color: #fff`，对比仅 ~1.8:1。现在主按钮（`.message-submit-button`、`.search-box button`）用 `--accent-strong` 底 + `--on-accent` 字，并换成了「深玫瑰底 + 金发丝描边」；`.preview-badge`、`.about-avatar`、`.brand-mark` 同步改 `--on-accent`。light 下 ≈5.4:1，dark 下深梅字 ≈10:1。

## 页面切换过渡

保留 `transition name="page-shift"` 与 `mode="out-in"`（`App.vue` 与 `AppShell.spec.ts` 契约均不变），仅把 `styles.css` 的 `.page-shift-*` 从左右 `12px` 位移改为垂直：新页 `translateY(10px)→0` 上浮淡入 / 旧页 `translateY(-6px)` 上滑淡出，`opacity 220ms` + `transform 240ms`。搜索页「只改 `q` 不重挂载」约定不受影响。

## 爱莉希雅元素清单

1. **`.site-shell::before`**：底部极淡金色落日光晕（`position: fixed; z-index: 0; pointer-events: none`）。
2. **`.site-shell::after`**：右上角极淡蝴蝶剪影（内联 SVG data-URI，`opacity 0.05`）。
3. **品牌章 `.brand-mark`**：粉→金 `135deg` 渐变底 + 柔和粉影。
4. **品牌小蝴蝶**：`App.vue` 品牌区一枚内联 SVG（15px，粉金渐变四翼，`aria-hidden`）。
5. **eyebrow 金拖尾**：`.eyebrow` / `.page-placeholder-eyebrow` `::after` 为 28px 金色发丝线（文字仍 `--accent-strong`）。
6. **首页水晶棱镜**：`.home-view::before`（右上粉光晕）+ `.home-view::after`（旋转 45° 水晶菱形）；`<= 760px` 隐藏。
7. **`::selection`**：粉色半透明。
8. 按钮金发丝描边（`.message-submit-button`、`.search-box button`）。

全部为静态 CSS / 内联 SVG，无色位图、无动画、无 `backdrop-filter`。

## 开屏终端（BootTerminal）边界

`.boot-terminal` 黑底 `#070d08` + 绿字 `#2ee46f` **刻意不参与换肤**，仍是品牌化的「技术感」对比；提示符/光标用 `--accent` 亮粉随主题微调。勿把终端配色纳入 token 体系。

## 文案变更

| 位置                                  | 现值                                                      | 新值                                                                     |
| ------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------ |
| `useI18n.ts` `loading.label` zh/en/ja | 正在翻开这一页 / Opening this page / ページを開いています | 正在轻轻点亮这一页… / Waking up this page… / ページをそっと灯しています… |
| `EssayDetailView.vue` h1              | 正在翻阅这篇随笔                                          | 正在整理这篇随笔…                                                        |
| `EssaysView.vue` skeleton label       | 正在翻阅随笔…                                             | 正在整理随笔…（`EssaysView.spec.ts:109` 同步）                           |

## 相关文件

- `apps/web/src/styles.css`（主体：tokens、书清理、卡片圆角、过渡、点缀）
- `apps/web/src/App.vue`（品牌小蝴蝶 SVG）
- `apps/web/src/composables/useI18n.ts`（loading 文案）
- `apps/web/src/views/EssayDetailView.vue`、`EssaysView.vue`（「翻阅」文案）
- `apps/web/src/test/EssaysView.spec.ts`（aria-label 断言）
- 文档：本文档、`page-transition-handoff.md`

## 验证命令

```bash
pnpm --filter @yuer/web test
pnpm --filter @yuer/web build
pnpm exec eslint apps/web/src --max-warnings=0
pnpm exec stylelint "apps/web/src/**/*.{css,vue}"
```

浏览器检查：亮/暗两主题按钮对比、背景光晕无噪点、过渡无横滚、搜索同词不重挂载、reduce-motion 下开屏转场仍在、320px 无横向出血、console 无 `--paper-*`/`--book-cover*` 无效变量告警。
