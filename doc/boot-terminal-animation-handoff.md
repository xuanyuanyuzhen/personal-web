# 开屏终端动画（BootTerminal.vue）接手记录

> 状态：已实现（分支 `feat/security-and-perf-CC`）
> 范围：仅 `apps/web` 首页开屏，非路由切换动效

## ✅ 已解决的问题（2026-08-12）

**原现象：用户刷新首页看不到开屏动画。**

**根因：Windows 系统关闭了「动画效果」**（`SystemParametersInfo(SPI_GETCLIENTAREAANIMATION)`
返回 0）。Chromium 据此让真实浏览器 `prefers-reduced-motion` 为 `reduce`，
旧逻辑在 `BootTerminal.vue` 的 `onMounted` 里直接跳过不播——**完全无黑屏**。
此前 headless Chrome 冒烟能复现动画，是因为 headless 不受该系统参数影响，
由此造成「测试通过、用户看不到」的假象。

**修复（`BootTerminal.vue`）：开发期（`playWhileDeveloping = true`）无视
reduced-motion 必播**，保证开发者能反复查看；定稿后（`false`）恢复无障碍跳过。
配套改动：

1. `BootTerminal.spec.ts`：reduced-motion 用例改为断言「开发期照播」；定稿后需恢复为「跳过并 emit done」。
2. `AppShell.spec.ts`：不再用 matchMedia 跳过动画，改为直接 `stubs: { BootTerminal: true }`。

**验证：** Playwright 开启 `reducedMotion: 'reduce'` 模拟下，5175 上终端正常出现并播放；
`pnpm --filter @yuer/web test` 53 用例全绿。

### 排查清单（按可能性排序，供以后同类问题参考）

1. **用户看的是旧构建产物**：如果用户访问的是 `pnpm build` 出来的
   `apps/web/dist`（或部署的静态站点），而构建发生在开屏动画实现之前，
   自然看不到。→ 重新 `pnpm --filter @yuer/web build` 并部署。
2. **浏览器缓存了旧 JS**：同一 URL 下旧 bundle 未失效。→ 强刷
   （Ctrl+Shift+R）或清缓存。
3. **系统/浏览器开启了「减少动态效果」**：曾导致真实浏览器完全看不到动画
   （即本次修复的根因，开发期已改为无视 reduced-motion 必播）。若**定稿后**
   仍遇到「看不到」，检查 Windows「设置 → 辅助功能 → 视觉效果 → 动画效果」
   与 DevTools Rendering 面板的 Emulate prefers-reduced-motion。
4. **访问的路径不是 `/`**：终端只挂在 `route.name === 'home'` 上。
   → 直接访问 http://localhost:5173/。
5. **dev server 没拿到最新代码**：HMR 偶发失效。→ 重启 `pnpm --filter @yuer/web dev`。

### 最小复现（接手者必须能跑通）

```bash
pnpm --filter @yuer/web dev
# 打开 http://localhost:5173/ ，应看到全屏黑底终端打字动画
```

当前开发期行为：**每次刷新/进入首页都播**（`playWhileDeveloping = true`）。

---

## 设计约定（与用户确认过的决策）

| 决策项 | 结论                                                                                                                                                                                                                                                                                                                                                                                      |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 形态   | 全屏黑底终端，打完整段后停在终端，出现 `$` 提示符 + 闪烁光标等待输入；进入时进度条填充（1600ms），满后**交叉转场**进入首页：终端淡出 + 微放大（600ms），同时首页内容从下方 16px 处上浮浮现（600ms）                                                                                                                                                                                       |
| 频率   | **开发阶段：每次进首页都播**（`BootTerminal.vue` 顶部 `playWhileDeveloping = true`），方便反复查看效果；**定稿后改为 false**，恢复「同一浏览器会话只播一次」                                                                                                                                                                                                                              |
| 内容   | 伪命令行一问一答：`whoami` → `cat welcome.txt` → `ls`，最后一行落到站点标语                                                                                                                                                                                                                                                                                                               |
| 配色   | 黑底 `#070d08` + 绿字 `#2ee46f`，提示符 `$` 与光标块用站点粉 `var(--accent)` 点缀                                                                                                                                                                                                                                                                                                         |
| 进入   | **点击屏幕任意处直接进入**；或输入 `clear`/无效命令回显 `command not found` 后回车，仅 `clear` 触发进度条。提示小字「点击屏幕进入 · 或输入 clear」                                                                                                                                                                                                                                        |
| 跳过   | 打字播放阶段按回车 / Esc = **快进文字**（直接落到「等待输入」提示符，**不会**直接进入页面）；等待输入阶段空回车/无效命令**不进入**（仅 `clear` 生效）。进入唯一途径：点击屏幕或 `clear` 后回车                                                                                                                                                                                            |
| 无障碍 | 由 `respectsReducedMotion()`（= `import.meta.env.PROD`）决定：**生产构建**下 `prefers-reduced-motion: reduce` 跳过不播；**开发构建**下无视 reduced-motion 必播（曾因系统关闭「动画效果」导致真实浏览器被跳过、用户看不到，见上方「已解决的问题」）。⚠️ styles.css 末尾的全局 reduce 规则会把所有 transition/animation 压成 0.001ms，开屏转场需在其后单独恢复时长（见「关键行为」第 7 条） |

## 实现位置

| 文件                                       | 职责                                                                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/BootTerminal.vue` | 打字动画状态机、快进/进度条/`leave`+`done` 事件、`playWhileDeveloping` 开发开关                                      |
| `apps/web/src/App.vue`                     | `bootOpen` 控制挂载：进首页 true、播完/离开 false；`bootReveal` 在 `@leave` 时置 true 触发首页上浮转场；`@done` 卸载 |
| `apps/web/src/styles.css`                  | `.boot-terminal` 全屏遮罩（z-index 1000）、绿黑配色、光标闪烁 keyframes、`.boot-reveal` 交叉转场 keyframes           |
| `apps/web/src/composables/useI18n.ts`      | `terminal.whoami` / `terminal.ls` / `terminal.skip` / `terminal.enterHint` / `terminal.commandNotFound` 三种语言文案 |
| `apps/web/src/test/BootTerminal.spec.ts`   | 9 个用例覆盖快进/命令校验/点击进入/完整播放/卸载清理                                                                 |
| `apps/web/src/test/AppShell.spec.ts`       | `stubs: { BootTerminal: true }` 直接替换组件，防定时器/rAF 干扰                                                      |

## 挂载机制（本次修复的核心）

**不要用 `:key` 绑 `route.fullPath` 来触发重播** —— 同一路径刷新时 fullPath
不变，Vue 复用组件实例，`onMounted` 不会重新执行，动画不重播。

正确做法（当前实现）：`App.vue` 用 `bootOpen` 布尔值控制 `v-if`：

```ts
const bootOpen = ref(false);

watch(
  () => route.name,
  (name) => {
    if (name === 'home') {
      bootOpen.value = true; // 每次进入首页都重新挂载
    } else {
      bootOpen.value = false; // 离开首页强制卸载，保证再进能重挂载
    }
  },
  { immediate: true },
);
```

```html
<BootTerminal v-if="bootOpen" @done="bootOpen = false" />
```

- 首个渲染帧就包含终端遮罩（`immediate` watcher 在 setup 阶段执行），无闪白。
- 每次进入首页都是一次**全新挂载**，`onMounted` 重新执行，动画重播。
- `@done`（淡出结束）后卸载；开发期跳过不写记忆，下次进首页仍会播。

## 关键行为

1. **首屏无闪白**：`bootOpen` 初始 `false`，`immediate` watcher 在 setup 阶段
   置 `true`，首个渲染帧就包含终端遮罩。
2. **会话记忆（仅定稿后）**：`playWhileDeveloping = false` 时，只有真正
   **进入页面**（点击屏幕或 `clear` 后回车 → 进度条 → `startExit()`）才会写
   sessionStorage（key `yuer.boot.played`）；快进文字不写记忆。写入后关掉
   浏览器标签再回来会重播。**开发阶段（当前）不写记忆，每次进首页都播**。
3. **中途离开首页**：动画未完成时导航走，组件卸载并停掉所有定时器；开发阶段
   不写记忆，回到首页会重新播放（仍可快进文字）。
4. **节奏**：命令行 12→7 fps 逐字打字（用户反馈 20 fps 偏快后放慢），行间停顿
   300/200ms（`2*LS_ITEM_STEP+STALL_MS` / `STALL_MS`），全部打完约 8 秒；总时长由
   `BootTerminal.vue` 顶部常量控制（`INITIAL_FPS` / `MIN_FPS` / `STALL_MS` / `LS_ITEM_STEP`）。
5. **打完落定**：全部文字打出后不再自动淡出，`scriptDone=true` → 出现 `$ ▊`
   提示符等待输入（`typedCommand` 支持真实打字/退格），下方暗色小字提示
   「点击屏幕进入 · 或输入 clear」。**点击屏幕任意处直接进入**（根元素
   `@click="enterSite"`）；敲命令后回车走 `submitCommand()`——仅 `clear` 进入，
   无效命令回显 `bash: xxx: command not found` 并清空输入，空回车忽略。
   进入后 `ENTER_ANIM_MS`(1600ms) 内进度条 0→100 填充，填满走 `startExit()`。
6. **打字阶段回车 / Esc = 快进文字**（`skipTyping()`）：一次性提交全部输出、
   `scriptDone=true`，直接落到「等待输入」提示符——**不会**直接进入页面，
   也不写记忆。进入的唯一途径是点击屏幕或 `clear` 后回车。
7. **交叉转场**：`startExit()` 开始的一刻 `BootTerminal` emit `leave`，`App.vue`
   置 `bootReveal=true` → `.site-shell.boot-reveal` 触发 `.site-main`（上浮 16px +
   淡入）与 `.site-header`（下移 8px + 淡入）各 600ms 动画；同时终端 `.is-leaving`
   以 600ms 淡出 + `scale(1.02)`。两者同时长形成交叉过渡。动画用 `backwards`
   填充，结束后无 transform 残留（不破坏视图内 `position: fixed`）。
   ⚠️ **reduce 兼容**：styles.css 末尾的全局 `@media (prefers-reduced-motion: reduce)`
   会把所有元素 `transition-duration`/`animation-duration` 压成 `0.001ms !important`
   （用户系统关闭「动画效果」时真实浏览器命中此规则，转场会瞬间完成 =「直接进入」）。
   因此在其后追加了同名媒体查询，用 `!important` 把 `.boot-terminal.is-leaving`
   与 `.site-shell.boot-reveal` 的时长恢复为 600ms（生产期终端不挂载，此覆盖为空操作）。
8. **出场兜底**：「进度条填满」走 `startExit()` 后，`transitionend` 没触发
   （例如浏览器禁用过渡）时，800ms 兜底定时器强制 `emit('done')`，避免遮罩
   永远盖在页面上。

## 上线前收尾

~~把 `BootTerminal.vue` 顶部的开发调试开关改回一次性。~~
**已不需要手动操作**，两个开关都已定稿：

- `replayEveryVisit = false`：第一次进首页播放一次，之后同一会话不再播。
- `respectsReducedMotion()` 返回 `import.meta.env.PROD`：生产构建下 reduce 即跳过，
  开发构建下照常播放。不再需要「上线前记得改成 true」——那个待办的问题是本机
  `prefers-reduced-motion` 恒为 `reduce`，手改后本地就再也看不到开屏。

`BootTerminal.spec.ts` 已用 `vi.stubEnv('PROD', ...)` 覆盖 dev 照播 / prod+reduce 跳过 /
prod 无 reduce 照播三个分支，不存在需要「上线时同步改断言」的用例。

详见 `doc/home-dashboard-handoff.md` 的「开屏终端的两个开关」一节。3. 重新跑 `pnpm --filter @yuer/web test` 与 `pnpm --filter @yuer/web build`，
全绿后即可提交。

## 验收要点

1. 进入首页：黑底终端出现，`$ whoami` 逐字打出后回车回显名字，依次打完三段。
2. 打完文字后出现 `$ ▊` 等待提示符；点击屏幕任意处或输入 `clear` 回车 → 进度条填充 → 淡出露出粉色首页，DOM 中无 `.boot-terminal` 残留。
3. **开发阶段（当前）刷新 / 反复进首页：每次都重新播放**（这是为了便于调整）。
4. 打字中按 Esc / Enter：快进文字到等待提示符，**不会**直接进入页面；开发阶段不写记忆，下次进首页仍会播。
5. 深色 / 浅色主题、中英日三种语言文案都正常。
6. `prefers-reduced-motion: reduce` 时直接跳过（定稿后）。

验证命令：

```bash
pnpm --filter @yuer/web test
pnpm --filter @yuer/web build
pnpm exec eslint apps/web/src --max-warnings=0
```

## 注意事项

- 不要在页面路由切换上复用这套（那是 `doc/page-transition-handoff.md` 的范围，
  仍维持轻量淡入淡出）。
- 终端是 `role="dialog" aria-modal="true"`，但**没有**实现焦点陷阱——因为动画时长
  短且随时可跳过，权衡后未加。若将来停留时间变长，需要补 focus trap。
- 打字内容全部走 i18n；`terminal.whoami` 目前是「轩辕宇振」等硬编码译名，
  没有接后台设置里的名字。若要接 `publicName`，需要把 settings 数据提升到共享状态。

---

**视觉变更附注（2026-08）：** 站点整体重构为爱莉希雅主题后，`.boot-cursor` /
`.boot-prompt-mark` 使用的新 `--accent`（`#e0568f`）自动跟随，但终端黑底绿字
（`#070d08` / `#2ee46f`）是刻意保留的「技术感」对比，**不参与 token 换肤**。
若后续调整终端配色，务必保持黑绿独立，详见 `doc/visual-redesign-handoff.md`。

**背景科技线附注（同日）：** `.boot-rain` / `.boot-rain-line`（16 根细光条，绿主 + 站内粉点缀，
`transform/opacity` 合成层动画，确定性公式生成不抖动）随终端整体淡出。⚠️ 底部
`@media (prefers-reduced-motion: reduce)` 恢复块需同步恢复 `.boot-rain-line` 的
`animation-duration: var(--dur)` 与 `animation-iteration-count: infinite`，否则
（用户系统关闭「动画效果」时）光条会被全局减速规则压成 0.001ms 而不可见。
