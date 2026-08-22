# 首页仪表盘重构接手记录（全屏磨砂背景 + 信息卡片布局）

> 状态：已实现（分支 `feat/ui-elysia-theme-CC`）
> 范围：仅 `apps/web` 首页（HomeView 及新增子组件）；导航栏只调毛玻璃参数，结构未动

## 设计图对照

按线框设计图将首页重构为「占满整栏的毛玻璃大容器」，内部区块：

| 设计图区块                        | 实现                                                          |
| --------------------------------- | ------------------------------------------------------------- |
| 名言（随机、每 6 秒换一句）       | `HomeQuote.vue` + `config/quotes.ts` 语句池（**无打字机**）   |
| 小闹钟看时间                      | `HomeClock.vue`（秒级刷新，HH:MM:SS + 本地化日期星期）        |
| 轮播图（点击跳转随笔文章）        | `HomeCarousel.vue`（随笔封面轮播，5.2s，带指示点）            |
| 最新随笔（图片为背景 + 随笔文字） | `.home-latest-card`（RouterLink，封面背景 + 深色渐隐压字）    |
| 照片墙一张张轮播                  | `HomeCarousel.vue` 复用（4.2s，无指示点，整卡跳 `/photos`）   |
| 最近几条过审核的留言              | `/api/messages/public` 前 3 条（公开接口本身只返回已过审）    |
| 描述网站状态（底部横条）          | `.home-status-card`：站点名 h1 + 简介 + 运行天数 + 各版块计数 |

原首页的 h1 / summary / 站点点赞 / 公告条全部保留（挪进状态条与容器顶部），
`HomeView.spec.ts` 的既有契约（`h1`、`.summary`、`.heart-like-button`、`.notice-strip`、点赞切换）不变。

## 毛玻璃：做在全屏蒙版层，不是内容区局部

用户定稿：**整个背景蒙版都是磨砂的**，中间内容面板只要边框 + 阴影，不再自带毛玻璃。

| 层                    | 做法                                                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `body`                | 承载背景图 `--bg-image`（`fixed / cover`，滚动不动）                                                                        |
| `.site-shell::before` | **全屏磨砂**：`backdrop-filter: blur(var(--bg-blur)) saturate(125%)` + 粉调光晕 + 底色蒙版（`--bg-veil`）+ 底部金色落日光晕 |
| `.site-header`        | 自带 `blur(20px) saturate(140%)`，叠在磨砂层之上 → 导航栏最实                                                               |
| `.home-panel`         | **完全不做玻璃**：无 `backdrop-filter`、**也不铺底色**，只有边框 + 阴影                                                     |
| `.home-card`          | 无 `backdrop-filter`，只用半透明底色保证正文对比度                                                                          |

⚠️ 面板曾经铺过一层 12% 的半透明白，用户反馈「和背景磨砂冲突、发灰」——
背景已经整片磨砂了，面板再叠一层白只会让这一块显脏。**别再给 `.home-panel` 加 `background`。**

⚠️ `backdrop-filter` 只能挂在 `.site-shell::before` 这个伪元素上，**不能加到 `.site-shell` 本身**：
那会让 `.site-shell` 变成 `position: fixed` 后代的包含块，音乐播放器 / 看板娘 / 开屏终端
会跟着页面一起滚动。这是重构时踩过的坑。

三个可调 token（都在 `:root`，暗色主题可另设）：
`--bg-image`（图片路径）、`--bg-veil`（底色蒙版不透明度，越低图越清晰）、
`--bg-blur`（磨砂强度，12px 左右保留照片轮廓，20px+ 只剩色块）。

## 站点背景图：放哪、在哪设

- **放图**：`apps/web/public/bg/`（Vite 的 `publicDir`，原样复制到产物根目录、不带 hash）。
- **引用**：`--bg-image: url('/bg/home.jpg')` —— **必须用 `/bg/...` 绝对路径**。
  写成 `url('../public/bg/home.jpg')` 相对路径在 dev 下能显示，但打包时 Vite 会把它当模块资源
  再复制一份，产物里同一张图出现两次。已验证：改成绝对路径后 `dist/bg/home.jpg` 只有一份，
  `dist/assets/` 里没有重复的 jpg。
- 详细步骤见 `apps/web/public/bg/README.md`。

## 欢迎语（公告条）常驻

用户要求保留欢迎语、不给关闭。已移除：

- `.notice-strip` 的 `×` 关闭按钮，以及 `announcementDismissed` / `localStorage`
  记忆键 `yuer.home.announcement.dismissed` / `announcementIdentity()`；
- HomeView 对 `open-site-announcement` 事件的监听；
- **App.vue 头部那颗 `i` 按钮（`.announcement-toggle`）**——它唯一的作用就是「重新打开被关掉的公告」，
  公告不可关闭后它点了没有任何反应，属于死按钮，连同 `announcementAvailable` 状态、
  `loadAnnouncementAvailability()`（一次多余的 `/api/site/announcement` 请求）和对应 CSS 一并删除。
  若以后想让它做别的事（比如滚动定位到公告），需要重新设计而不是恢复旧逻辑。

## 时钟卡（HomeClock.vue）

左边数字时间（时分 34px / 秒 30px，窄屏 28/25），右边一个正圆表盘 + 三根会走的指针。

- **表盘底图**：`--clock-face-image`（默认 `none`，此时显示自带的一圈内联 SVG 刻度）。
  图片放 `apps/web/public/bg/`，写成 `url('/bg/clock-face.png')`。
  表盘按 `cover` 居中裁切，**请用正方形、主体居中的图**；显示约 108px（窄屏 88px），2 倍图足够。
  暗色主题可在 `:root[data-theme='dark']` 单独换一张。
- **指针角度**（`handAngles` computed，12 点为 0°、顺时针）：
  秒 `s×6`、分 `m×6 + s×0.1`、时 `(h%12)×30 + m×0.5`。
  时针/分针都带上更小单位的零头，否则会出现「3 点 59 分时针还死死指着 3」的假表感。
  `HomeClock.spec.ts` 用固定系统时间锁死了这三个角度。
- **刻意不给指针加 transition**：秒针从 59 秒跳到 0 秒时角度是 354°→0°，
  加过渡会让它倒着转回去一整圈。离散跳秒才是对的。
- 表盘只是左侧数字时间的视觉重复，`aria-hidden="true"`，读屏器只念 `<time>`。

## 今日拾语（HomeQuote.vue）

**没有打字机效果**（用户定稿推翻了初版的逐字动画）：文字直接出现。

- 容器 `.home-quote` 固定 `min-height`、文字块 `.home-quote-text` 预留 `3.5em`（两行）：
  一句从一行变两行时**页面不会跟着抖**。这是当初用打字机时最刺眼的问题。
- 排版规则（`segments` computed）：≤14 字排一行、靠左；更长且带逗号则在**第一个逗号后**断开，
  上句左上、下句右下（`.home-quote-tail { justify-self: end }`），读起来像对仗。
  窄屏（≤760px）两段都靠左、预留高度放宽到三行。
- 每 6 秒随机换下一句（不与当前重复），换句淡入淡出；
  离场元素 `position: absolute` 脱离文档流，避免 `mode="out-in"` 造成的高度塌陷。
- 回归测试 `test/HomeQuote.spec.ts`：直接显示、长句拆两段、短句单行、6 秒轮换。
- 语句池仍在 `config/quotes.ts`，不做 i18n 翻译。

## 照片墙溢出修复

初版图片会漏出卡片下沿：`.home-carousel` 用了硬 `min-height: 150px`，
而 `.home-row-mini` 分到的高度不够时，`.home-card` 没有 `overflow: hidden` 兜底。
现在 `.home-photo-card` 改为 `display: flex; flex-direction: column; overflow: hidden`，
轮播 `flex: 1; min-height: 0`（允许被压缩），`.home-row-mini` 给 `min-height: 152px` 保底。
**给轮播设固定 min-height 是这里的陷阱**，别再加回来。

## 数据与降级

`loadHomeData` 用 `Promise.allSettled` 并行取 6 个接口（settings / announcement / site-like /
essays×6 / photos×6 / messages×3）。列表响应经 `readPage()` 防御（rejected 或结构不对 → 空数组 +
total 0），任何接口挂掉首页都渲染空态文案 `home.empty`，不会白屏。`siteLike` 校验 `likeCount` 为
number 才写入，防止把 undefined 传进 HeartLikeButton 必填 props。

状态条「已安静记录 N 天」基于 `SITE_LAUNCH_DATE = '2026-06-01'`（HomeView 顶部常量，上线日改这里）；
i18n 用 `t('home.statusDays').replace('{days}', …)` 手工插值（t() 无插值能力，与 terminal.commandNotFound 同法）。

## stylelint 经验（no-descending-specificity）

新首页样式一律**避免裸元素作最右选择器键**（`a` / `span` / `h1`），否则会与文件后部的
`.mobile-nav a`、`.notice-strip span`、全局 `h1` 等互相触发降序报错。因此模板加了专属类：
`.home-message-link` / `.home-message-nick` / `.home-message-text` / `.home-status-title` /
`.home-status-summary` / `.home-status-error` / `.home-latest-link`。后续加样式请沿用这个约定。

## i18n 新增键

`home.quoteLabel / clockLabel / carouselLabel / latestEssay / photoWall / recentMessages / empty /
statusLabel / statusOnline / statusDays`（zh/en/ja 三份）。版块计数标签复用 `search.section.*`。

## 相关文件

- `apps/web/src/views/HomeView.vue`（整体重构）
- `apps/web/src/components/HomeQuote.vue`、`HomeClock.vue`、`HomeCarousel.vue`（新增）
- `apps/web/src/config/quotes.ts`（新增语句池）
- `apps/web/src/composables/useI18n.ts`（新键）
- `apps/web/src/styles.css`（背景图 token、三层毛玻璃、.home-panel 起的整段仪表盘样式、响应式）
- `apps/web/public/bg/README.md`（背景图放置与开启说明）
- `apps/web/src/test/HomeView.spec.ts`（重写：router 挂载 + 列表 mock + 新断言）、`test/HomeQuote.spec.ts`（新增）
- `e2e/public.spec.ts`：`enterThroughBootTerminal()` —— 开屏终端开发期每次播放且等待输入，
  e2e 必须先「回车跳过 → 点击进入 → 等 `.boot-terminal` detached」再操作首页；
  终端随时可能卸载，对它的 `click()` 必须带短 `timeout`，否则 locator 默认 30s 等待会吃满全场。
- `scripts/preview-home.mjs`（mock API + reduced-motion 截图）、`preview-dev-server.mjs` / `preview-dev-stop.mjs`
  （后台启停 web dev server）、`kill-port.mjs`（清理端口残留）

## reduced-motion 陷阱：hover 过渡被压没了

`styles.css` 末尾有一条全局无障碍规则，把所有 `transition-duration` 压成 `0.001ms`。
本机 Windows 关了「动画效果」，真实 Chrome 里 `prefers-reduced-motion` 就是 `reduce`，
于是「最新随笔」hover 抬升表现为**一碰就跳上去、完全没有过渡**。

已在 reduced-motion 覆盖块里恢复这几处的时长（`!important`）：
`.home-latest-link`、`.home-message-text`、`.home-carousel-dot`、`.heart-like-button`（180ms），
以及 `.carousel-fade-*` / `.quote-fade-*`（420ms，否则轮播和换句是硬切）。

验证脚本 `scripts/probe-hover-transition.mjs`：用 `reducedMotion: 'reduce'` 起浏览器，
读 `.home-latest-link` 的 computed `transitionDuration`，期望 `0.18s` 而不是 `0.001s`。
**以后再往首页加 hover 微交互，记得同步加进那个覆盖块，否则在本机是看不到过渡的。**

## E2E 环境坑：端口残留

## 开屏终端的两个开关（别再合成一个）

`BootTerminal.vue` 顶部：

- `replayEveryVisit`（当前 `false`）：`false` = 同一浏览器会话只播一次，之后刷新直接进首页
  （调试首页内容时用）；`true` = 每次进首页都重播（调试开屏动画本身时用）。
  想再看一次：关掉标签页重开，或删掉 sessionStorage 的 `yuer.boot.played`。
- `respectReducedMotion`（当前 `false`）：`true` = 系统开了「减少动态效果」就整段跳过。
  **上线前必须改成 true**（届时 `BootTerminal.spec.ts` 第一条断言要同步改为「不挂载 + emit done」）。

⚠️ 这两件事以前是同一个开关 `playWhileDeveloping` 控制的。本机 `prefers-reduced-motion` 为
`reduce`，一旦把它翻成 `false` 想要「只播一次」，会连带打开无障碍跳过，结果变成**一次都不播**。
所以刻意拆成两个，别再合回去。

`scripts/run-e2e.mjs` 对 5173/5174「可达就复用」。若本机残留了别的 vite 进程占住 5174
（例如 web dev 因 5173 被占而漂移到 5174），admin 用例会打开一个**前台站点**并全部超时，
且报错只是「找不到登录输入框」。先 `pnpm exec node scripts/kill-port.mjs 5173 5174` 清干净再跑。

## 验证命令

```bash
pnpm --filter @yuer/web test
pnpm --filter @yuer/web build
pnpm exec eslint apps/web/src --max-warnings=0
pnpm exec stylelint "apps/web/src/**/*.{css,vue}"

# 截图（-bg 两张用仓库里真实的 public/bg/home.jpg；另外三张把背景图关掉看纯色底）
pnpm exec node scripts/preview-dev-server.mjs
pnpm exec node scripts/preview-home.mjs
pnpm exec node scripts/preview-dev-stop.mjs

# e2e 前先清端口，避免残留 vite 占位导致 admin 用例全超时
pnpm exec node scripts/kill-port.mjs 5173 5174
pnpm exec node scripts/run-e2e.mjs
```

浏览器检查点：整个背景磨砂（不是只有内容区一块）、面板只有边框阴影、
「最新随笔」hover 有 180ms 抬升过渡、换句时页面不抖动、长句左上右下对仗、
时钟秒跳、轮播 hover 暂停、照片墙图片不溢出卡片、欢迎语没有关闭按钮、390px 单列不出血。
