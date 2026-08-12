# 开屏终端动画（BootTerminal.vue）接手记录

> 状态：已实现（分支 `feat/security-and-perf-CC`）／开发调试开关打开中
> 范围：仅 `apps/web` 首页开屏，非路由切换动效

## 设计约定（与用户确认过的决策）

| 决策项 | 结论                                                                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 形态   | 全屏黑底终端，打完整段后整体淡出（340ms），露出正常粉色首页                                                                                                  |
| 频率   | **开发阶段：每次进首页都播**（`BootTerminal.vue` 顶部 `playWhileDeveloping = true`），方便反复查看效果；**定稿后改为 false**，恢复「同一浏览器会话只播一次」 |
| 内容   | 伪命令行一问一答：`whoami` → `cat welcome.txt` → `ls`，最后一行落到站点标语                                                                                  |
| 配色   | 黑底 `#070d08` + 绿字 `#2ee46f`，提示符 `$` 与光标块用站点粉 `var(--accent)` 点缀                                                                            |
| 跳过   | Esc / 回车随时跳过（开发阶段跳过不写记忆，便于继续查看）                                                                                                     |
| 无障碍 | `prefers-reduced-motion: reduce` 下直接跳过不播                                                                                                              |

## 实现位置

| 文件                                       | 职责                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| `apps/web/src/components/BootTerminal.vue` | 打字动画状态机、跳过/淡出、sessionStorage 记忆                          |
| `apps/web/src/App.vue`                     | 挂在首页路由下，`@done` 后卸载；非首页不渲染                            |
| `apps/web/src/styles.css`                  | `.boot-terminal` 全屏遮罩（z-index 1000）、绿黑配色、光标闪烁 keyframes |
| `apps/web/src/composables/useI18n.ts`      | `terminal.whoami` / `terminal.ls` / `terminal.skip` 三种语言文案        |
| `apps/web/src/test/BootTerminal.spec.ts`   | 6 个用例覆盖跳过/记忆/完整播放/卸载清理                                 |

## 关键行为

1. **首屏无闪白**：`App.vue` 里 `bootComplete` 初始为 `true`，路由为 home 时由
   `immediate` watcher 在 setup 阶段置为 `false`，所以首个渲染帧就包含终端遮罩，
   用户看不到粉色首页在终端下闪现。
2. **会话记忆（仅定稿后）**：`playWhileDeveloping = false` 时，播放完成 / 被跳过 /
   命中 reduced-motion 才会写 sessionStorage，关掉浏览器标签再回来会重播（会话级）。
   **开发阶段（当前）不写记忆，每次进首页都播**，方便反复调整动画效果。
3. **中途离开首页**：动画未完成时导航走，组件卸载并停掉所有定时器；开发阶段不写
   记忆，回到首页会重新播放（仍可跳过）。
4. **节奏**：命令行 20→10 fps 逐字打字，行间停顿 240ms，完整流程约 5 秒；总时长
   由 `BootTerminal.vue` 顶部常量控制（`INITIAL_FPS` / `MIN_FPS` / `STALL_MS` / `LS_ITEM_STEP`）。
5. **出场兜底**：`transitionend` 没触发（例如浏览器禁用过渡）时，500ms 兜底定时器
   强制 `emit('done')`，避免遮罩永远盖在页面上。

## 上线前收尾（重要）

把 `BootTerminal.vue` 顶部的开发调试开关改回一次性：

```ts
// BootTerminal.vue
const playWhileDeveloping = true; // ← 定稿后改成 false
```

改回后行为恢复为：第一次进首页播放一次，之后同一会话不再播；
`markPlayed()` 重新写入 sessionStorage。改完记得：

1. 把 `BootTerminal.spec.ts` 里两个断言同步回来：
   - 「会话已播过 → 立即跳过并 emit done」的用例可恢复；
   - skip / 完整播放相关的 `sessionStorage` 断言改回期待 `'1'`。
2. 本文件「频率」「跳过」「会话记忆」三格及本节一并更新。
3. 重新跑 `pnpm --filter @yuer/web test`，全绿后即可提交。

## 验收要点

1. 进入首页：黑底终端出现，`$ whoami` 逐字打出后回车回显名字，依次打完三段。
2. 动画结束后淡出，露出粉色首页，DOM 中无 `.boot-terminal` 残留。
3. **开发阶段（当前）刷新 / 反复进首页：每次都重新播放**（这是为了便于调整）。
4. 播放中按 Esc / Enter：立即淡出；开发阶段不写记忆，下次进首页仍会播。
5. 深色 / 浅色主题、中英日三种语言文案都正常。
6. `prefers-reduced-motion: reduce` 时直接跳过。

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
