# 页面切换动画接手记录

## 当前方案

前台路由已经移除书页翻转、DOM 快照、3D 透视和方向计时器，统一改为 Vue 原生 `Transition`：

- 旧页面向右移动 `12px` 并淡出；
- 新页面从左侧 `12px` 淡入；
- 每段持续 `190ms`，使用 `mode="out-in"`，完整切换约 `380ms`；
- `prefers-reduced-motion: reduce` 下由全局规则将过渡压缩到近乎即时；
- 顶部导航、音乐播放器和看板娘不参与页面切换。

这套动效只使用 `opacity` 与 `transform`，没有克隆页面、冻结内容或额外覆盖层。

## 代码位置

| 文件                                 | 职责                                                     |
| ------------------------------------ | -------------------------------------------------------- |
| `apps/web/src/App.vue`               | 在 `RouterView` 外包裹 `Transition`，名称为 `page-shift` |
| `apps/web/src/styles.css`            | 定义 `page-shift` 的进入、离开和减少动态效果规则         |
| `apps/web/src/router.ts`             | 只维护路由与全局 loading，不参与动画                     |
| `apps/web/src/test/AppShell.spec.ts` | 固定 `page-shift` 与 `out-in` 的结构契约                 |

以下旧实现已删除，不应恢复：

- `apps/web/src/composables/usePageFlip.ts`
- `apps/web/src/composables/usePageTurnSnapshot.ts`
- `apps/web/src/test/PageFlip.spec.ts`
- `apps/web/src/test/PageTurnSnapshot.spec.ts`
- 所有 `.page-turn-*`、`--page-flip-*` 和书页 keyframes

## 路由 key 约定

普通页面继续使用完整地址作为组件 key，因此真正的路径或预览模式变化会重新挂载页面并播放过渡。

搜索页是例外：仅修改 `q` 时保留同一个页面实例，由 `SearchResultsView` 自己刷新结果，避免一次搜索同时触发旧实例监听和新实例挂载。`preview` 变化仍会重新挂载。

## 验收重点

1. 一级导航、随笔列表与详情之间只有短距离淡入淡出，没有翻页、折痕或透视。
2. 快速连续导航后只保留最终页面，不产生旧页快照或横向滚动条。
3. 搜索同一关键词可重新请求，且不会播放整页切换。
4. 320–390px、900px、桌面宽度下导航不挤压正文。
5. 深色主题和减少动态效果模式下仍保持可读与可操作。
6. 浏览器控制台没有 Vue Transition 警告、资源错误或残留动画节点。

验证命令：

```bash
pnpm --filter @yuer/web test
pnpm --filter @yuer/web build
pnpm exec eslint apps/web/src --max-warnings=0
pnpm exec stylelint "apps/web/src/**/*.{css,vue}"
```
