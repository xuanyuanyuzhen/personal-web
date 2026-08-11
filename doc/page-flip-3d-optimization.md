# 真 3D 书页翻页优化方案

> 状态：**已废弃 / 未采用**。这套 3D 翻页曾经实现过，之后被整体移除，
> 前台现在用的是 `Transition` 短距离淡入淡出，详见 `doc/page-transition-handoff.md`。
> 本文保留作为设计存档与踩坑记录，不代表当前代码行为。  
> 范围：仅 `apps/web` 顶部导航路由切换的翻页动效  
> 原则：书脊外侧真 3D，同时解决性能、对齐、内容闪跳；不引入 WebGL / 截图库

---

## 1. 背景与目标

### 1.1 现状

当前实现由 Vue Router 导航守卫驱动：

1. `beforeEach`：按导航顺序判定 `forward` / `backward`，克隆**旧页**为 `.page-turn-front-snapshot`
2. 路由组件在 `RouterView` 中直接替换
3. `afterEach` + `nextTick`：追加 `.page-turn-crease`，添加 `.page-turn-running` 启动 CSS 动画
4. 约 `620 + 120ms` 后清理快照

活跃动画是 `translateX` + `scale` + `skewY` + `opacity` 的轻微推移淡出，配合一条横向扫过的折痕渐变。  
`styles.css` 中仍保留完整的 `page-curl-*` clip-path keyframes，但**未挂载到任何元素**。

相关代码：

| 文件                                              | 职责                                    |
| ------------------------------------------------- | --------------------------------------- |
| `apps/web/src/composables/usePageFlip.ts`         | 导航顺序、方向、时长、session 清理      |
| `apps/web/src/composables/usePageTurnSnapshot.ts` | 旧页克隆、折痕层、清理                  |
| `apps/web/src/router.ts`                          | beforeEach / afterEach 接线             |
| `apps/web/src/styles.css`                         | 快照样式与 keyframes                    |
| `doc/page-flip-animation-handoff.md`              | 历史 4 层卷页设计（与运行时代码已脱节） |

### 1.2 主要痛点

| 痛点      | 根因                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------ |
| 不像翻书  | 活跃路径是 slide/fade，不是绕书脊翻转；背面无目标页内容                                          |
| 节奏拖沓  | `page-sheet-front-*` 在 0–42% 几乎静止，有效运动只剩后半段                                       |
| 内容闪跳  | 只冻旧页；新页实时挂载，加载/骨架在遮罩下变化，结束后跳变                                        |
| 方向/边界 | 位移幅度小；对齐依赖固定 `inset`，未精确测量内容盒与滚动位置                                     |
| 性能卡顿  | 克隆整页 DOM + 动画期新旧页可能双份绘制；全局 `prefers-reduced-motion` 用 `*` 把动画压成 0.001ms |

### 1.3 目标

- **视觉**：书脊外侧真 3D 掀页（非中轴硬翻）
- **内容**：翻起正面 = 旧页，背面 = 目标页；下层为冻结目标页
- **稳定**：动画中数据加载不导致画面跳变；结束无位置跳动
- **性能**：只合成 `transform`，层数固定，中低端设备可用
- **交互**：方向由导航顺序决定；跨多页仍只播一次；快速连点可抢占

### 1.4 明确不做

- 中轴 `transform-origin: center` 的整页硬翻
- 按导航距离重复播放多次翻页
- html2canvas / 整页截图
- 动画期 `filter`、`mix-blend-mode`、动态大面积 `box-shadow`
- WebGL / Canvas 物理纸张模拟（除非未来单独立项）

---

## 2. 目标视觉模型

### 2.1 方向语义（与现有一致）

导航顺序（`usePageFlip.ts`）：

`home → thoughts → essays → photos → messages → about`

- `toIndex > fromIndex` → `forward`：右侧书页向左翻
- `toIndex < fromIndex` → `backward`：左侧书页向右翻
- 同 index / 未知路由（search、custom-page、404 等）→ 不翻页
- `essay-detail` 与 `essays` 同 index，列表↔详情不翻页

### 2.2 图层结构

```
.page-turn-stage                 ← perspective 容器（唯一 3D 上下文）
  ├── .page-turn-target-snapshot ← 冻结目标页，平铺，z=0
  └── .page-turn-sheet           ← preserve-3d，绕左/右书脊旋转
        ├── .page-turn-front     ← 旧页快照，backface-visibility: hidden
        └── .page-turn-back      ← 目标页快照 + rotateY(180°)，backface-hidden
```

可选：sheet 上用伪元素做**静态**边缘高光（不动画 filter）。

### 2.3 3D 运动（书脊外侧，非中轴）

| 方向     | transform-origin | 旋转                      |
| -------- | ---------------- | ------------------------- |
| forward  | `left center`    | `rotateY(0deg → -180deg)` |
| backward | `right center`   | `rotateY(0deg → +180deg)` |

要点：

- 唯一 `perspective` 挂在 `.page-turn-stage`（建议约 `1600–2200px`，默认可取 `1800px`）
- **禁止**把 perspective 挂在 `html` / `body`
- 双面使用 `backface-visibility: hidden`
- 背面内容通过 `rotateY(180deg)` 预翻转，使掀起过程中可见目标页

### 2.4 与历史「clip-path 卷页」的关系

- 本文方案以 **书脊 3D + 双面冻结** 为主路径
- 遗留 `page-curl-*` / `page-sheet-front-*` keyframes 在实现后应删除或停用，避免双轨维护
- 历史 handoff 中的「移动折痕 + 多点 clip-path」不再作为默认实现

---

## 3. 性能方案

| 策略             | 做法                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| 只合成 transform | 动画属性仅限 `transform`（必要时极短 opacity）；`will-change: transform` 仅在 `.page-turn-running` 期间            |
| 单 perspective   | 仅 stage 上设置 perspective                                                                                        |
| 动画期隐藏真页   | 真实路由根节点 `visibility: hidden`（或等价），避免克隆 + 真 DOM 双份绘制                                          |
| 克隆瘦身         | 去 `id`、`aria-hidden`、`inert`；`<video>` / `<canvas>` / `<iframe>` 换静态占位                                    |
| 层数固定         | 固定 stage + target + sheet(front/back)，不按距离叠多次                                                            |
| 时长             | 桌面约 `560–620ms`（保持与现网接近的 `620ms` 亦可）；移动端可略短（如 `520ms`）                                    |
| reduced-motion   | **不要**用全局 `* { animation-duration: 0.001ms }` 杀掉翻页；对 `.page-turn-*` 单独保留一次明确翻页（或短距离 3D） |

**禁止**在动画路径中使用：

- 整页 `filter`
- `mix-blend-mode`
- 动画中的动态大阴影
- 多点 `clip-path` 插值（若 3D 路径已足够）

---

## 4. 对齐与边界方案

| 策略       | 做法                                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 精确量盒   | `beforeEach` 对源页 `getBoundingClientRect()`，相对 `.site-main` 计算 top/left/width/height，写入 stage/sheet 的 inline style |
| 滚动冻结   | 记录 `scrollY` / 容器 scroll；快照内容用 `translateY(-scrollY)` 或固定高度 + `overflow: hidden`；结束后恢复                   |
| 统一坐标系 | 所有动画层相对 `.page-turn-stage`；边距与 `.site-main` 一致（桌面 24px / 移动 16px）                                          |
| 壳层不参与 | Header、Mascot、Music、全局 loader 始终在 stage 外                                                                            |
| 结束无缝   | 清理前先显示真页面，再移除 stage，同一帧避免闪白                                                                              |

导航栏、书皮（`.site-shell` 伪元素）、看板娘在动画前后位置必须稳定。

---

## 5. 内容不闪跳

完整生命周期：

```
用户点击导航
    │
    ▼
beforeEach
  • startRoutePageFlip → direction + session
  • 精确量盒 + 滚动位置
  • capturePageTurnSource → 冻旧页（front）
  • 创建 stage 骨架（尚未 running）
    │
    ▼
Router 替换路由组件
    │
    ▼
afterEach + nextTick（必要时 rAF 双帧）
  • capturePageTurnTarget → 冻新页两份（target 底层 + back face）
  • 真页面 visibility: hidden
  • 添加 .page-turn-running → 3D 动画开始
    │
    ▼
CSS ~620ms
  • sheet 绕书脊 rotateY
  • 背面显现目标页内容
  • 下层 target-snapshot 始终可见
    │
    ▼
cleanup
  • 显示真页面
  • clearPageTurnSnapshots
  • 清除 direction / duration 变量
```

原则：

- 动画期间画面只依赖**冻结快照**，不依赖实时路由 DOM 的数据更新
- 接口返回导致的骨架→列表切换只发生在隐藏的真 DOM 上
- 快速连点：session 所有者校验，旧 cleanup 不得清掉新 session 的层

---

## 6. 节奏方案

- 删除「前 42% 静止」：0% 即开始 `rotateY`
- 缓动：起手快、落地慢，例如 `cubic-bezier(0.2, 0.7, 0.15, 1)`（可与现有 `--page-flip-ease` 对齐微调）
- 可选：0–70% 完成大部分角度，末尾 30% 减速贴合（仍用一条 keyframe）
- 总时长控制在约 `500–650ms`

---

## 7. 涉及文件与改动点

| 文件                                              | 改动                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `apps/web/src/composables/usePageTurnSnapshot.ts` | 建 stage；源/目标双冻；front/back face；量盒与滚动；真页 hide/show；session 安全清理 |
| `apps/web/src/composables/usePageFlip.ts`         | 时长/session 逻辑基本保留；可选移动端 duration                                       |
| `apps/web/src/styles.css`                         | 3D stage/sheet/faces 与 keyframes；停用 `page-sheet-front-*`；修正 reduced-motion    |
| `apps/web/src/router.ts`                          | 生命周期基本不变；必要时 rAF 双帧再开跑                                              |
| `apps/web/src/test/PageTurnSnapshot.spec.ts`      | 期望 target/back 快照；session 抢占；真页隐藏等                                      |
| `apps/web/src/test/PageFlip.spec.ts`              | 方向/时长/清理回归                                                                   |
| `doc/page-flip-animation-handoff.md`              | 实现完成后同步为「书脊 3D + 冻结双面」模型                                           |

**不改动**（除非后续单独需要）：

- `NavigationTree.vue`、路由表结构、各业务页面逻辑
- 导航数据 API / 配置（仅当新增一级导航时同步 `pageOrder` / `pagePathOrder`）

Canvas / 视频等无法 `cloneNode` 完整冻结的组件：实现阶段用静态占位类名即可，不追求像素级一致。

---

## 8. 实现步骤

### Step 1：Stage + 量盒对齐

- 在 `.site-main` 内创建绝对定位 `.page-turn-stage`
- 用源页矩形写入精确位置与尺寸
- 验收：快照盖住真页像素级重合；清理后无下移/横移

### Step 2：目标冻结 + 隐藏真页

- 恢复 `.page-turn-target-snapshot`
- 动画期真路由根节点不可见
- 验收：加载中跳转，动画画面不闪跳（可先不接 3D）

### Step 3：3D sheet 双面

- front = 旧页；back = 目标页 + `rotateY(180deg)`
- forward / backward 镜像 origin 与角度
- 验收：掀起中段可见目标页背面；落地后是新页

### Step 4：节奏与视觉微调

- 无 hold 段；缓动；perspective；边缘静态阴影
- 日间 / 夜间主题变量可读
- 验收：不再「前半段发闷」；中英日 + 双主题无横向溢出

### Step 5：性能与 a11y

- 克隆瘦身；`will-change` 仅 running 期间
- reduced-motion 白名单
- session 抢占回归测试

### Step 6：文档与回归

- 更新 `page-flip-animation-handoff.md` 与本方案状态
- 跑测试与构建（见第 10 节）

---

## 9. 可选降级

| 场景            | 策略                                     |
| --------------- | ---------------------------------------- |
| 移动端 / 低性能 | 时长略短；或背面降采样（只冻可见区高度） |
| 极弱设备        | 背面用纸纹 + 标题摘要占位（产品可选）    |
| reduced-motion  | 保留一次短 3D，或略减角度但仍明确方向    |

---

## 10. 验收清单

每次修改后至少检查：

1. 首页 → 随笔：右页向左翻，绕**左书脊**，背面为随笔内容
2. 随笔 → 首页：完全镜像
3. 跨多页（如 home → about）：只播一次，方向正确
4. 文章列表 ↔ 详情：不翻页
5. 翻页中接口返回数据：快照不跳变
6. 快速连续点击左右导航：最新动画接管，无残留层
7. 中文 / 英文 / 日文 × 日间 / 夜间：无横向溢出、可读
8. 书皮、条纹纸、导航栏、页边距、看板娘在动画前后稳定
9. 动画结束后 DOM 中无 `.page-turn-*` 残留
10. 桌面目标流畅；中低端无明显长卡顿

验证命令：

```bash
pnpm --filter @yuer/web test
pnpm --filter @yuer/web build
pnpm lint:style
```

调试时可临时拉长 `pageFlipDuration` 观察中间帧，提交前必须恢复约定值（默认 `620`），且不得为通过测试而随意改断言语义。

---

## 11. 风险与应对

| 风险                      | 应对                                                 |
| ------------------------- | ---------------------------------------------------- |
| 克隆大 DOM 偶发卡顿       | 背面只冻可见高度；移动端可选摘要背面                 |
| backface 渲染毛刺         | `translateZ(0.1px)` 促层；结束立刻拆 stage           |
| Canvas / 视频无法冻真画面 | 静态占位，不追求像素级一致                           |
| 与旧 clip-path 方案并存   | 3D 为主路径；实现后清理未使用 keyframes              |
| 量盒与 padding 不一致     | 统一相对 `.site-main`，桌面/移动分别校验 24px / 16px |

---

## 12. 结论

可实现**真 3D 书页**，并同时处理性能、对齐与内容闪跳。核心公式：

**书脊外侧 `rotateY` + 双面冻结快照 + 精确量盒 + 动画期隐藏真页 + 只动画 transform**

不是：中轴硬翻 + 实时 DOM 当动画画面。

实现时按第 8 节顺序落地，完成后同步 handoff 文档与本文件状态为「已实现」。
