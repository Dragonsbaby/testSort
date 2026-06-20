# 代码全面审查与简化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: 使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 按任务逐个实施。步骤使用 `- [ ]` 复选框语法跟踪。

**Goal:** 对 PMS 排序可视化项目进行全面的代码复用、质量、运行效率治理，消除约 2000 行死代码、修复正确性 bug、根治渲染性能瓶颈，并通过组件/类型抽象实现"最佳实现"。

**Architecture:** 数据驱动渲染模型不变（算法 → timeline builder → 插值引擎 → Canvas 渲染）。改动分 6 个风险递增的阶段：死代码清理 → 正确性 bug → 渲染性能 → builder/插值性能 → 复用抽象 → 类型强化 → 质量收尾。每阶段独立可验证、可提交。

**Tech Stack:** Vue 3 (`<script setup>`) + Pinia + Canvas 2D + Element Plus + Vite + Vitest + TypeScript。

---

## 执行进度（截至 2026-06-20）

> **当前状态**：阶段 0–3 核心已完成并通过验证。阶段 4–6 待做。用户已暂停以提交/审查成果。

### 已完成（4 阶段核心）
- **阶段 0 死代码清理** ✅：删 9 文件（TestPlayback / Enhanced 控制链 / ThemeDemo / 3 个 renderer composable）+ 清理 terminology-standards / style-utils / sorting.ts，净减 ~2100 行。
- **阶段 1 正确性 bug** ✅：1.1 bucket ghost opacity（经验#6）、1.2 store setArraySize、1.3 空 catch、1.4 stepForward rafId 重入、1.5 onScopeDispose、1.6 ThemeSwitcher Alt+T/quick-menu。**1.7 对比同步列独立后续**（原方案会破坏动画平滑性，需重设计 player 时间模型）。
- **阶段 2 渲染性能** ✅：2.1 dirty-flag 按需重绘（消灭无限 rAF 循环，静止 CPU→0）、2.2 entities 排序缓存、2.3 离屏 grid 缓存、2.4 hexToRgb 缓存、2.5 syncArray 播放时跳过。
- **阶段 3 builder/插值性能** ✅：3.1 basic/heap 去 structuredClone、3.2 bucket 结构共享 + calcBucketCount、3.4 插值 find→map。**3.3 layout/overlay 缓存列独立后续**（边际收益，需改 3 builder 签名）。

### 附带修复
- `tsconfig.json` `ignoreDeprecations: "6.0"` → `"5.0"`（预存在 bug，原值无效导致 `type-check` 一直崩溃不可用）。

### 待做
- **阶段 4** 复用抽象（4 算法组件合并、builder 公共化、canvas 统一 等 10 任务，大重构）
- **阶段 5** 类型判别联合（RenderableOverlay / SemanticStep / pathParams，高风险）
- **阶段 6** 质量收尾（常量化、themes 精简等）

### 独立后续任务（不阻塞重构，单独处理）
1. **1.7 对比模式同步**：重设计 useTimelinePlayer 时间模型实现双 slot 平滑同步（原 seekByProgress 方案会导致动画瞬移）。
2. **3.3 layout/overlay 缓存**：bucket/merge layout 顶层算一次 + heap edge 缓存。
3. **13 个预存在测试失败**：多为测试期望与刻意设计/职责分离冲突（interpolateStyle 内部 clamp、getStyleFromStateTags 优先级、path-utils 弧形、sortStore 响应式），需逐个诊断"修测试 or 修实现"。

### 验证基线（后续阶段的回归标准）
- `pnpm type-check`：零错误
- `pnpm test:run`：13 failed / 155 passed（13 个均为预存在，**不得新增**）
- 运行时：playwright 视觉回归（grid / 动画 / 主题 / 对比 / bucket gather）

---

## 全局约束（每个任务都隐含遵守）

1. **不破坏 CLAUDE.md 记录的 6 条排序动画调试经验**（均为刻意设计，详见下方"勿动清单"）。任何涉及插值/ghost/隐藏实体的改动，必须先对照经验清单确认。
2. **执行者验证手段**：当前会话遵循用户全局规则，**不自动执行 git 与 build/test 命令**。本计划中的 `提交` 与 `运行测试` 步骤为**执行者（用户或新会话）的建议动作**；AI 助手的验证以静态分析（Read/Glob/Grep）+ `vue-tsc --noEmit` 类型检查提示 + 建议执行者跑 vitest 为主。
3. **风格**：中文注释、kebab-case 文件名、PascalCase 组件名；复用项目已有工具；删除前用 Grep 全局确认无引用。
4. **向后兼容**：除明确标注的破坏性变更外，保持现有 props/emit/store API 不变。
5. **提交粒度**：每个任务结束是一个建议提交点；阶段结束建议打 tag 或合并提交。
6. **回归基线**：阶段 0 完成后、以及每个高风险阶段开始前，建议执行者运行 `pnpm test:run` 确认绿，作为后续回归基线。

## 勿动清单（刻意设计，任何任务都不要"优化"掉）

以下经审查确认是 CLAUDE.md 6 条经验的正确实现，禁止简化：

- `style-utils.ts:81-83` `interpolateStyle` 中 alpha **条件注入**（`from.alpha !== undefined || to.alpha !== undefined`）—— 经验 #1 的关键修复，不可改为无条件注入。
- `interpolate-entity.ts:73-96` 主循环 `toEntities.map` + `swapFromXOverride` 交叉飞行 —— 经验 #4/#6，不可改为 fromEntities 驱动。
- `interpolate-entity.ts:77-85` buffer-bar 首次出现的 `fakeFrom` fade-in —— 经验 #6。
- `interpolate-entity.ts:98-121` moving-entity 淡出（`fakeTarget.opacity:0`）—— 经验 #6。
- `path-utils.ts:42-54` `getPathPoint` 两段式弧（起飞高、降落缓）—— 刻意视觉。
- `build-merge-timeline.ts` ghost from/to 不 spread 源实体、显式读 layout、hiddenIndices 双帧传递 —— 经验 #2/#3/#6，是正确范例。
- `ArrayElement = { value, displayIndex }` 绑值不绑位置 —— 经验 #5。
- `useTimelinePlayer` 用 rAF + 每帧重算 `getStepDuration()` 实现运行时调速 —— 设计意图正确（仅 seek 平滑度可优化）。
- bucket scatter/gather ghost 用 `width:0 + opacity:0` 双防御、按距离方向选 arc/linear —— 经验 #1/#4。

---

## 阶段总览

| 阶段 | 主题 | 风险 | 关键收益 |
|------|------|------|----------|
| 0 | 死代码清理 | 极低 | 立即减负 ~2000 行，消除误导性 API |
| 1 | 正确性 bug 修复（P0） | 低 | 修 ghost 闪烁、store 违规、rAF 泄漏、空 catch |
| 2 | 渲染引擎性能 | 中 | 消灭无限重绘（最大单点收益） |
| 3 | builder/插值性能 | 中 | 移除 structuredClone O(n²) 深拷贝 |
| 4 | 代码复用抽象 | 中高 | 4 算法组件→1、builder 公共化 |
| 5 | 类型系统强化 | 高 | 判别联合，编译期挡 bug |
| 6 | 质量收尾（P2） | 低 | 常量化、themes 精简等 |

---

# 阶段 0：死代码清理（零风险）

**目标：** 删除所有经全仓 Grep 确认零引用的死代码。完成后项目应能正常 `vue-tsc --noEmit` 与 build。

### 任务 0.1：删除渲染层死代码 composable

**Files:**
- Delete: `src/composables/useMergeSortRenderer.ts`（整文件，零引用）
- Delete: `src/composables/useBucketSortRenderer.ts`（零增值薄包装）
- Delete: `src/composables/useHeapSortRenderer.ts`（零增值薄包装）
- Modify: `src/components/SortBarCanvasBucket.vue`
- Modify: `src/components/SortBarCanvasHeap.vue`

**背景：** `useMergeSortRenderer` 全仓零引用（`SortBarCanvasMerge.vue` 已直连 `useCanvasRenderer`）。`useBucketSortRenderer`/`useHeapSortRenderer` 各 22 行与对方逐字符相同，仅是 `useCanvasRenderer` 的薄包装，且额外维护的 `currentFrame` ref **从无消费方读取**（`useSortAnimation` 只调 `renderFrame()`）。

- [ ] **Step 1：确认零引用**

执行 Grep：`useMergeSortRenderer`、`useBucketSortRenderer`、`useHeapSortRenderer`。预期除各自 `export` 行外无 import 命中。

- [ ] **Step 2：删除 3 个文件**

```bash
git rm src/composables/useMergeSortRenderer.ts
git rm src/composables/useBucketSortRenderer.ts
git rm src/composables/useHeapSortRenderer.ts
```

- [ ] **Step 3：SortBarCanvasBucket.vue 改直连**

将 `import { useBucketSortRenderer } from "@/composables/useBucketSortRenderer"` 改为 `import { useCanvasRenderer } from "@/composables/useCanvasRenderer"`；调用处 `useBucketSortRenderer(canvasRef)` 改为 `useCanvasRenderer(canvasRef)`。确认返回的 `{ initialize, resize, renderFrame, startRenderLoop, stopRenderLoop }` 与原包装一致（薄包装本来就透传这些）。

- [ ] **Step 4：SortBarCanvasHeap.vue 同 Step 3**

- [ ] **Step 5：验证**

建议执行：`pnpm type-check`（应通过）；Grep 确认无残留 import。

---

### 任务 0.2：删除增强控制死代码链

**Files:**
- Delete: `src/components/TestPlayback.vue`
- Delete: `src/components/EnhancedControlPanel.vue`
- Delete: `src/components/PlaybackControls.vue`
- Delete: `src/components/TimelineProgress.vue`
- Delete: `src/components/EnhancedStatusBar.vue`

**背景：** Grep 证据链——`EnhancedControlPanel` 仅被 `TestPlayback.vue` import；`PlaybackControls`/`TimelineProgress`/`EnhancedStatusBar` 仅被 `EnhancedControlPanel.vue` import；`TestPlayback` 全仓零引用、无路由注册。实际运行链路是 `App.vue → ControlPanel + SortVisualizer → algorithms/*.vue`，每个 algorithm 组件自带 `pb-controls`/`pb-progress`。约 1580 行死代码。

- [ ] **Step 1：确认引用链**

Grep `TestPlayback`、`EnhancedControlPanel`、`PlaybackControls`、`TimelineProgress`、`EnhancedStatusBar`，确认仅彼此互引、无外部消费者。特别注意 `App.vue` 不应引用它们。

- [ ] **Step 2：删除 5 个文件**

```bash
git rm src/components/TestPlayback.vue
git rm src/components/EnhancedControlPanel.vue
git rm src/components/PlaybackControls.vue
git rm src/components/TimelineProgress.vue
git rm src/components/EnhancedStatusBar.vue
```

- [ ] **Step 3：验证**

`pnpm type-check` 通过；`pnpm build` 通过。

---

### 任务 0.3：删除 ThemeDemo.vue

**Files:**
- Delete: `src/components/ThemeDemo.vue`（583 行）

**背景：** 全仓 Grep `ThemeDemo` 除自身定义外零引用、无路由。纯开发自测组件，内含 Canvas + rAF + watch，误引入会拖累 bundle。

- [ ] **Step 1：确认零引用** → Grep `ThemeDemo`。
- [ ] **Step 2：删除** → `git rm src/components/ThemeDemo.vue`。
- [ ] **Step 3：验证** → `pnpm type-check` 通过。

---

### 任务 0.4：清理 terminology-standards.ts 死代码

**Files:**
- Modify: `src/utils/terminology-standards.ts`

**背景：** 约 60% 是死代码。确认被使用的仅：`REGION_TERMS`、`PHASE_TERMS`、`OPERATION_TERMS.compare.withPosition`、`OPERATION_TERMS.swap.moveToPosition`、`normalizePosition`、`normalizeCompare`、`FORBIDDEN_TERMS`（若 lint 用）、`containsForbiddenTerms`（若 lint 用）。

死代码：`POSITION_TERMS`（含 concise/valueOnly/avoid）、`DESCRIPTION_TEMPLATES`、`TERMINOLOGY_MAPPING`、`normalizeSwap`、`OPERATION_TERMS.move.*`、`OPERATION_TERMS.copy.*`。

- [ ] **Step 1：逐项确认引用**

对上述每个疑似死符号执行 Grep，**保留有引用的，删除无引用的**。逐一记录结果，不要凭记忆删。

- [ ] **Step 2：删除确认无引用的导出**

按 Step 1 结果删除对应常量/函数。注意 `normalizeCompare` 与 `OPERATION_TERMS.compare.withPosition` 语义重复（stepDescriptionGenerator 用的是后者），若确认 `normalizeCompare` 仅一处调用且可被后者替代，则统一为单一来源。

- [ ] **Step 3：验证**

`pnpm type-check` 通过；手动运行一次各算法观察描述文案无缺失（术语被 builder/generator 引用）。

---

### 任务 0.5：收尾 style-utils.ts deprecated 颠倒

**Files:**
- Modify: `src/utils/frame/style-utils.ts`

**背景：** 当前状态完全颠倒——标了 `@deprecated` 的旧版（`BAR_BASE_STYLE`、`TAG_STYLE_MAP`、`getStyleFromStateTags`）被全部 4 个 timeline builder 在用；新版（`getStyleFromStateTagsWithTheme`、`getBaseStyleFromTheme`）除自身互调外**零外部引用**，是死代码。

**决策：** 用户已选"全面"，但此项**不**强行迁移到 WithTheme 版（那需要 4 个 builder 全改 + 主题色验证，风险与收益不匹配于清理阶段）。本任务采用**务实收尾**：删除从未被使用的新版死代码，撤销旧版的 `@deprecated` 标注。

- [ ] **Step 1：确认新版零外部引用**

Grep `getStyleFromStateTagsWithTheme`、`getBaseStyleFromTheme`，确认仅 `style-utils.ts` 内部互调，无 builder/render 引用。

- [ ] **Step 2：删除新版死代码函数**

删除 `getStyleFromStateTagsWithTheme`、`getBaseStyleFromTheme` 及其专属的 theme 取色逻辑。

- [ ] **Step 3：撤销旧版 @deprecated 标注**

移除 `BAR_BASE_STYLE`、`TAG_STYLE_MAP`、`getStyleFromStateTags` 上的 `@deprecated` 注释，改为正常文档注释说明"当前样式来源"。

> 备注：若未来要做主题化样式，再单独立项统一迁移，届时本任务删除的新版可作为起点重新设计。

- [ ] **Step 4：验证** → `pnpm type-check` 通过；各算法动画颜色无变化。

---

### 任务 0.6：清理类型别名残留

**Files:**
- Modify: `src/types/sorting.ts`
- Modify: `src/types/enhanced-step.ts`（若仅剩别名）

**背景：** `sorting.ts:8-9` `export type StepType = SemanticStepType` 与 `export type SortStep = SemanticStep` 是纯重导出别名。`enhanced-step.ts` 的 `EnhancedDescription` 与 `SemanticStep` 的 brief/detail/context 重复。

- [ ] **Step 1：确认别名引用方**

Grep `StepType`、`SortStep`、`EnhancedDescription`。若引用点少，把引用改为直接用 `SemanticStepType`/`SemanticStep`/`Pick<SemanticStep,'brief'|'detail'|'context'>` 后删除别名；若引用点多，**保留别名不动**（避免阶段 0 膨胀），留待阶段 5 任务 5.5 一并处理。
- [ ] **Step 2（条件）：** 仅当引用点 ≤ 5 处时执行别名内联删除。
- [ ] **Step 3：验证** → `pnpm type-check` 通过。

---

# 阶段 1：正确性 bug 修复（P0）

**目标：** 修复所有会导致视觉 bug、违反规范或资源泄漏的正确性问题。每个修复都低风险、可独立验证。

### 任务 1.1：修复 bucket-gather ghost to 帧 opacity（违反经验 #6）🔴

**Files:**
- Modify: `src/utils/timeline-builders/build-bucket-timeline.ts:332`

**问题：** bucket-gather 的 ghost to 帧 `{ ...target, opacity: 0, ... }`，违反 CLAUDE.md 经验 #6「ghost to 帧 opacity=0 → 动画结束时消失导致与真实实体切换闪烁」。对比 `build-merge-timeline.ts` 的 merge-back ghost to 帧保持 `opacity: 1`（正确范例），bucket 此处实现不一致。

**修复：** 改为 `opacity: 1`。真实 target 柱在 to 帧由 `scatteredIndices.delete(destIndex)` 恢复显示，ghost 保持可见以覆盖真身在终点的潜在闪现，下一 step 的 from 帧自然切换为真身。

- [ ] **Step 1：定位** → Read `build-bucket-timeline.ts` ghost to 帧构造段（约 325-340 行）。
- [ ] **Step 2：修改**

将 ghost to 帧的 `opacity: 0` 改为 `opacity: 1`，与 merge-back 对齐。补一行中文注释：「ghost to 帧保持可见，避免与真身在终点切换时闪烁（经验 #6）」。

- [ ] **Step 3：验证回归**

运行 BucketSort 动画到 gather 阶段，观察柱子飞回主数组时**终点无闪烁**；对照 merge 的 merge-back 视觉一致性。

---

### 任务 1.2：组件直接改 store → setArraySize action

**Files:**
- Modify: `src/stores/sortStore.ts`
- Modify: `src/components/ControlPanel.vue:26`
- Modify: `src/components/CompareView.vue:94`

**问题：** `ControlPanel.vue:26 store.arraySize = val` 与 `CompareView.vue:94 store.arraySize = max` 直接赋值 store 原始 ref，违反用户全局规则「不在组件直接改 store 原始字段」。同文件 `setSpeed/setAlgorithm/setViewMode` 都走 action，唯独 size 没有。

- [ ] **Step 1：sortStore 新增 action**

在 `sortStore.ts` 增加：

```ts
/** 设置数组规模并重新生成（原子操作，替代组件内 store.arraySize = x + generateArray） */
function setArraySize(size: number) {
  arraySize.value = size;
  generateArray(size);
}
```

并在 `return` 中导出 `setArraySize`。

- [ ] **Step 2：ControlPanel.vue 改用 action**

将 `handleSizeChange` 内 `store.arraySize = val; store.generateArray(store.arraySize);`（两行）替换为单行 `store.setArraySize(val);`。

- [ ] **Step 3：CompareView.vue 改用 action**

将 `store.arraySize = max;` 替换为 `store.setArraySize(max);`（若该处另有 `generateArray` 调用一并合并）。

- [ ] **Step 4：验证** → `pnpm type-check`；手动拖动 size slider、切换对比模式，数组规模响应正常。

---

### 任务 1.3：useCanvasRenderer 空 catch → 显式处理

**Files:**
- Modify: `src/composables/useCanvasRenderer.ts:68-82`

**问题：** `try { theme = useTheme(); watch(...) } catch (e) { /* 静默吞掉 */ }` 空 catch 把任何错误吞成「主题未初始化」，无法排查。

- [ ] **Step 1：改为显式 null + 警告**

```ts
let theme: ReturnType<typeof useTheme> | null = null;
try {
  theme = useTheme();
  watch(() => theme!.currentThemeId.value, () => {
    if (currentFrame.value) requestRender(); // 见任务 2.1，届时此处已是 requestRender
  });
} catch (e) {
  console.warn("[useCanvasRenderer] 主题系统未初始化，回退硬编码颜色", e);
  theme = null;
}
```

并把文件内 `theme!.` 非空断言改为 `theme?.`（`theme ? theme.getXxx() : FALLBACK` 的三目，或保留现有 `theme ? ... : COLOR` 写法，将 `undefined` 分支统一为 `null`）。

- [ ] **Step 2：验证** → `pnpm type-check`；主题切换仍正常着色。

> 注：此处的 `requestRender` 依赖任务 2.1。若 1.3 先于 2.1 执行，暂保留 `requestAnimationFrame(() => draw())`，并在 2.1 时一并改为 `requestRender()`。

---

### 任务 1.4：useTimelinePlayer stepForward rafId 重入泄漏

**Files:**
- Modify: `src/composables/useTimelinePlayer.ts:39-55`

**问题：** `stepForward` 入口只挡了 `isPlaying`，没挡 `rafId !== null`。若用户在单步动画进行中（progress 0→1 期间，isPlaying=false 但 rafId 已占用）再点单步，第二次会覆盖 `rafId`，第一次的 rAF 句柄丢失无法 cancel → 泄漏 + 双 tick。

- [ ] **Step 1：入口加互斥**

```ts
function stepForward() {
  if (isPlaying.value || rafId !== null) return;
  // ...原有逻辑
}
```

或更稳妥：覆盖前先 cancel：`if (rafId !== null) cancelAnimationFrame(rafId);` 再赋新值。选其一（推荐前者，语义更清晰）。

- [ ] **Step 2：验证** → 快速连点单步步进按钮，currentStepIndex 不出现跳跃两步。

---

### 任务 1.5：useTimelinePlayer onScopeDispose 兜底

**Files:**
- Modify: `src/composables/useTimelinePlayer.ts`

**问题：** 整个 composable 无 `onScopeDispose`/`onUnmounted` 清理 `rafId`。`:key` 变化（如 `CompareView` 切算法重建 slot）时旧 player 的 rAF 还会再触发一帧，修改已卸载组件的 ref（Vue warn）。

- [ ] **Step 1：加 scope 清理**

在 composable 顶部 import `onScopeDispose`，末尾加：

```ts
onScopeDispose(() => {
  stopLoop(); // 即 cancelAnimationFrame(rafId); rafId = null;
});
```

- [ ] **Step 2：验证** → 对比模式快速切换左右算法，控制台无 "Cannot modify a deleted ref" / effect scope 警告。

---

### 任务 1.6：ThemeSwitcher 重复 Alt+T 监听 + 删 quick-menu 死分支

**Files:**
- Modify: `src/components/ThemeSwitcher.vue`

**问题：**
1. `App.vue` 已全局注册 `useThemeKeyboardShortcuts()`（含 Alt+T → nextTheme），`ThemeSwitcher.vue:97-109` 又在 `onMounted` 监听 Alt+T → `themeStore.nextTheme()`，导致 Alt+T 触发两次。
2. `showQuickMenu`（`:23-37`）定义后被 `toggleThemeSelector` 互斥关闭，但**从无地方置 true**，`quick-menu` 模板与 `recentThemes` computed 是死 UI。

- [ ] **Step 1：移除重复 Alt+T 分支**

删除 `ThemeSwitcher.vue` keydown 监听里的 `Alt+T` 分支，仅保留 `Escape` 关闭逻辑（若 keydown 监听只剩 Escape，保留监听）。

- [ ] **Step 2：删除 quick-menu 死分支**

删除模板中 `quick-menu` 块、`showQuickMenu` ref、`recentThemes` computed 及其相关样式。

- [ ] **Step 3：验证** → Grep `showQuickMenu` 无残留；按 Alt+T 主题只切一次；Escape 能关闭选择器。

---

### 任务 1.7：对比模式双 slot 同步可靠性

**Files:**
- Modify: `src/components/CompareView.vue`
- Modify: `src/components/CompareSlot.vue`

**问题：** 对比模式"同步播放"靠 `CompareView` 用 `defineExpose` + 模板 ref 手工调 `leftSlot.value?.play()` / `rightSlot.value?.play()`，两侧各自独立 `requestAnimationFrame`，起步时间略有错位；`isAnyPlaying` 用 `leftPlaying || rightPlaying` 推断，一旦某侧因 `currentStepIndex >= length` 提前 pause 而另一侧还在跑，按钮状态与实际不一致。两侧 timeline 长度不同（bubble vs quick），按 step index 同步到最后会一侧早结束。

**方案：** 改为**按 progressPct 同步**——一个主时钟推进百分比，两侧各自 `seek(floor(pct * total))`，而非各自独立跑 rAF。

- [ ] **Step 1：CompareSlot 暴露 seekByProgress + totalSteps**

`CompareSlot.vue` 除现有 `play/step/...` 外，`defineExpose` 增加 `seekByProgress(pct: number)`（内部 `player.seek(Math.min(Math.floor(pct * total), total-1), 0)`）与 `totalSteps`（只读）。

- [ ] **Step 2：CompareView 用单一主时钟驱动两侧**

`CompareView` 新增一个主 `requestAnimationFrame` 循环（复用 `useTimelinePlayer` 或自建轻量计时器），按时间推进 `masterProgress`，每 tick 同时调 `leftSlot.seekByProgress(masterProgress)` 与 `rightSlot.seekByProgress(masterProgress)`。删除两侧独立 play 调用。`isPlaying` 由主时钟状态单一决定（不再 `||` 推断）。

- [ ] **Step 3：边界处理**

主时钟到 100% 时停止；两侧因 total 不同自然停在各自末尾。暂停/seek 进度条时同步推进 masterProgress。

- [ ] **Step 4：验证回归**

对比模式播放：两侧节奏同步、无错位；播放结束按钮正确回到"已结束"态；拖进度条两侧同步；快速切算法无 ref 警告（配合任务 1.5）。

> 注：此任务改动 CompareView 核心逻辑，建议在任务 1.5（onScopeDispose）之后执行，确保主时钟有清理。

---

# 阶段 2：渲染引擎性能（最大单点收益）

**目标：** 把"永不停止的 60fps 全量重绘"改为"按需重绘"，并对每帧重复的静态计算做缓存。预期：动画暂停/结束时 CPU 接近 0。

### 任务 2.1：dirty-flag 按需重绘（消灭无限 rAF 循环）⭐

**Files:**
- Modify: `src/composables/useCanvasRenderer.ts`

**问题：** `draw()` 末尾 `animationFrameId = requestAnimationFrame(draw)` **无条件**自调度 → 一旦 `startRenderLoop` 启动就永不停止地 60fps 全量重绘（清屏 + 双层 grid 循环 + N 个 gradient + N 个 fillText），即便画面完全静止。这是本次审查**最大的单点性能问题**。

**方案：** 引入 dirty-flag + 请求合并。

- [ ] **Step 1：引入 dirty flag 与 requestRender**

在 `useCanvasRenderer` 内部状态区新增：

```ts
let needsRedraw = false;

/** 合并多次重绘请求：仅当有待绘制内容且当前无挂起 rAF 时调度一帧 */
function requestRender() {
  if (animationFrameId !== null) return; // 已有挂起帧，合并
  animationFrameId = requestAnimationFrame(() => {
    animationFrameId = null;
    if (needsRedraw) {
      needsRedraw = false;
      drawOnce();
    }
  });
}
```

- [ ] **Step 2：把 draw 拆为 drawOnce（单次绘制，不自调度）**

将原 `draw()` 函数体重命名为 `drawOnce()`（内容不变，**删除末尾的 `animationFrameId = requestAnimationFrame(draw)`**）。

- [ ] **Step 3：触发点改为置脏 + requestRender**

```ts
function renderFrame(frame: FrameState) {
  currentFrame.value = frame;
  needsRedraw = true;
  requestRender();
}

// 主题 watch（任务 1.3 已改为）:
//   () => { if (currentFrame.value) { needsRedraw = true; requestRender(); } }

// resize:
function resize(w, h) {
  setCanvasDimensions(w, h);
  needsRedraw = true;
  requestRender();
}
```

- [ ] **Step 4：调整 start/stop 语义**

```ts
function startRenderLoop() {
  needsRedraw = true;
  requestRender();
}
function stopRenderLoop() {
  if (animationFrameId === null) return;
  cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
}
```

- [ ] **Step 5：验证**

动画播放流畅（每帧 renderFrame → requestRender → drawOnce，60fps 不变）；暂停/结束后用 DevTools Performance 观察主线程无持续 rAF 空转；切后台 tab 回来无卡顿堆积。注意：`useSortAnimation` 的播放循环必须仍以足够频率调 `renderFrame`（它原本每步/每帧都调，确认未被其他改动影响）。

---

### 任务 2.2：entities zIndex 排序缓存

**Files:**
- Modify: `src/composables/useCanvasRenderer.ts:426-428`

**问题：** `frame.entities.slice().sort((a,b) => a.zIndex - b.zIndex)` 每帧 O(N log N) 排序 + O(N) 拷贝。同一 frame 在多个 rAF 间复用（尤其 2.1 后静止态会反复绘制同一 frame）。

- [ ] **Step 1：按 frame 引用缓存**

```ts
let lastSortedFrame: FrameState | null = null;
let cachedSortedEntities: RenderableEntity[] = [];

function getSortedEntities(frame: FrameState) {
  if (frame !== lastSortedFrame) {
    cachedSortedEntities = frame.entities.slice().sort((a, b) => a.zIndex - b.zIndex);
    lastSortedFrame = frame;
  }
  return cachedSortedEntities;
}
```

`drawOnce` 阶段二改为 `getSortedEntities(frame).forEach(...)`。

- [ ] **Step 2：验证** → 动画层叠顺序无变化（堆/桶的 ghost 与真身 z 序正确）。

---

### 任务 2.3：离屏 Canvas 缓存 background grid

**Files:**
- Modify: `src/composables/useCanvasRenderer.ts:351-397`

**问题：** `drawBackground` 每帧双层 grid 循环（`W/gridSize + H/gridSize` ≈ 20-40 次 stroke）+ baseline shadow。grid 纯静态、仅随 resize/主题变。

**方案：** 用一张离屏 canvas 缓存 grid（baseline 因 `baseY` 来自 frame meta 可能变化，动态层单独画）。

- [ ] **Step 1：新增离屏 canvas 与重建逻辑**

```ts
let bgCanvas: HTMLCanvasElement | null = null;
let bgCtx: CanvasRenderingContext2D | null = null;

function rebuildBackgroundCache() {
  if (!bgCanvas) bgCanvas = document.createElement("canvas");
  const dpr = window.devicePixelRatio || 1;
  bgCanvas.width = Math.floor(containerWidth * dpr);
  bgCanvas.height = Math.floor(containerHeight * dpr);
  bgCtx = bgCanvas.getContext("2d");
  if (!bgCtx) return;
  bgCtx.setTransform(1, 0, 0, 1, 0, 0);
  bgCtx.scale(dpr, dpr);
  // 画背景色 + grid（不画 baseline，baseline 随 frame 动态）
  paintGrid(bgCtx);
}
```

`paintGrid(ctx)` 抽出原 grid 双循环 + 背景填充逻辑。在 `setCanvasDimensions` 末尾、主题 watch 内调 `rebuildBackgroundCache()`。

- [ ] **Step 2：drawBackground 改为 drawImage + 动态 baseline**

```ts
function drawBackground(ctx, frame) {
  if (bgCtx && bgCanvas) {
    ctx.drawImage(bgCanvas, 0, 0, containerWidth, containerHeight);
  } else {
    paintGrid(ctx); // 兜底
  }
  // baseline（动态，baseY 来自 frame meta）
  const baseY = getFrameNumberMeta(frame, "baseY") ?? containerHeight - 21.5;
  // ...原 baseline 描边逻辑
}
```

- [ ] **Step 3：验证** → 网格视觉无变化；resize/切主题后网格正确刷新；DevTools 观察每帧 drawBackground 耗时下降。

---

### 任务 2.4：hexToRgb / gradient 缓存

**Files:**
- Modify: `src/composables/useCanvasRenderer.ts:33-59`

**问题：** 每个柱子每帧 `createLinearGradient` + 4 次 `addColorStop` + 2 次 `hexToRgb` 正则。N=100 时每帧 100 gradient + 200 正则。

**方案：** (a) `hexToRgb` 按 fill 字符串 `Map` 缓存（取值 < 20 种，命中率≈100%）；(b) gradient 按 `${fill}:${heightBucket}` 分桶缓存（高度量化到 4px）。

- [ ] **Step 1：hexToRgb 缓存**

```ts
const rgbCache = new Map<string, { r: number; g: number; b: number } | null>();
function hexToRgb(color: string) {
  if (rgbCache.has(color)) return rgbCache.get(color)!;
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);
  const result = match
    ? { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16) }
    : null;
  rgbCache.set(color, result);
  return result;
}
```

- [ ] **Step 2：gradient 按 fill 分桶缓存（可选，若 height 量化可接受）**

评估 `createBarGradient` 是否可接受"固定梯度模板按高度缩放"。若柱子高度差异大需精确梯度，则仅做 Step 1 的正则缓存（已消除主要开销），gradient 缓存降级为 P2。**推荐先只做 Step 1**，profile 后再决定是否需要 Step 2。

- [ ] **Step 3：验证** → 柱子渐变视觉无变化。

---

### 任务 2.5：syncArray 仅非播放时执行

**Files:**
- Modify: `src/composables/useSortAnimation.ts:128-145, 193-199`

**问题：** `currentStepIndex` 的 watch 每步调 `syncStats + syncArray`；`syncArray` 从每帧实体 filter+sort 反推 `array` ref，赋值触发模板重渲染。播放时 Canvas 已自绘，`array` 仅用于静态展示/初始态，**播放期间不需要每步同步**。这是播放时主要开销之一。

- [ ] **Step 1：syncArray 加播放态守卫**

```ts
function syncArray(step: TimelineStep) {
  if (player.isPlaying.value) return; // 播放中 Canvas 自绘，不同步 array
  // ...原 filter+sort+赋值逻辑
}
```

并在 `syncArray` 内 filter 条件补防御：`entity.width > 0`（排除桶排序隐藏实体，见 Store 审查 P2）：

```ts
const bars = step.to.entities.filter(
  (e) => (e.kind === "main-bar" || e.kind === "heap-array-node") && e.width > 0,
);
```

- [ ] **Step 2：确保暂停/seek/stepBack 时 array 正确**

在 `pause`、`handleSeek`、`stepBack` 路径显式调一次 `syncArray(player.currentTimelineStep.value)`，保证非播放态 array 与当前帧一致。

- [ ] **Step 3：验证回归**

播放 → 暂停时下方/侧栏的数组快照显示正确；seek 到任意步数组正确；播放中不再有每步 array 重渲染（DevTools Components 面板观察依赖 array 的节点不刷新）。

---

# 阶段 3：timeline builder / 插值引擎性能

**目标：** 消除 builder 的 O(n²) 深拷贝与每帧 Map 重建，让 n=100 的构建与播放更流畅。

### 任务 3.1：basic/heap 移除 structuredClone 改重建 frame ⭐

**Files:**
- Modify: `src/utils/timeline-builders/build-basic-timeline.ts:131,158`
- Modify: `src/utils/timeline-builders/build-heap-timeline.ts:255`

**问题：** basic/heap 每步 `structuredClone(currentFrame)` 两次深拷贝整帧（含 entities[]/style/regions/overlays）。n=100、O(n²)≈10000 步、每步 2 次深拷贝 = 20000 次深拷贝。而 bucket/merge builder 根本不用 structuredClone（每步 `createXxxFrame` 重建），证明深拷贝非必需。

**方案：** 把 basic/heap 改为"每步重建 frame"，与 bucket/merge 对齐。

- [ ] **Step 1：basic 改重建**

将 `from = structuredClone(currentFrame)` 改为 `from = currentFrame`（直接引用上一步的 to 作为本步 from，因 to 本就是新对象）；`currentFrame = structuredClone(to)` 改为 `currentFrame = to`（to 是当步新建对象）。确认 `createBasicFrame` 每步返回**新对象**且不 mutate 旧帧（若有 mutate 需修复）。

- [ ] **Step 2：heap 同 Step 1**

- [ ] **Step 3：回归（关键）**

运行 Bubble/Insertion/Quick/Shell/Heap 全流程动画，逐帧对照状态标签（sorted/pending/compare/swap）与改前一致。这是高风险点，务必仔细对照。若发现状态泄漏到后续帧（典型深拷贝移除副作用），说明某处 mutate 了共享对象，需在该处改为新建。

- [ ] **Step 4：性能对比**（建议执行者）构建 n=100 数组，对比改前改后 builder 耗时（预期下降 5-10 倍）。

---

### 任务 3.2：bucket 桶数组结构共享 + 桶数 calcBucketCount

**Files:**
- Modify: `src/utils/timeline-builders/build-bucket-timeline.ts:390, 434, 444, 453`

**问题：**
1. `:390` 桶数用 `steps.reduce` 扫全部 step 找最大 bucketIndex，但 `calcBucketCount(n)` 已能算确切桶数。
2. `:434/444/453` 每次 scatter/swap/gather 都 `buckets.map(b => [...b])` 全量复制所有桶，scatter 有 n 次 → O(n·K)。

- [ ] **Step 1：桶数改用 calcBucketCount**

```ts
const bucketCount = calcBucketCount(originalValues.length);
const buckets: number[][] = Array.from({ length: bucketCount }, () => []);
```

- [ ] **Step 2：结构共享——只复制被改的桶**

scatter：
```ts
buckets[bucketIndex] = [...buckets[bucketIndex], value];
// 其余桶引用不变
```
桶内 swap/gather 同理只重建被改桶：`buckets = buckets.map((b, i) => i === target ? newBucket : b)`。

- [ ] **Step 3：验证** → BucketSort 散射/桶内交换/聚集动画与改前一致；n=100 构建更快。

---

### 任务 3.3：layout 顶层算一次 + heap edge 缓存

**Files:**
- Modify: `src/utils/timeline-builders/build-bucket-timeline.ts:184`
- Modify: `src/utils/timeline-builders/build-merge-timeline.ts:124`
- Modify: `src/utils/timeline-builders/build-heap-timeline.ts:70-80`

**问题：**
1. bucket `createBucketFrame` 每帧 `buildBucketLayout(width,height,count)`，但 width/height/count 整条 timeline 不变。merge `buildMergeLayout` 同理。
2. heap `createHeapOverlays` 每帧重算所有 edge 坐标，但树结构排序中不变（只交换值）。

- [ ] **Step 1：bucket/merge layout 上提到 builder 顶层**

在 builder 入口算一次 `const layout = buildBucketLayout(width, height, mainValues.length)`，传入 `createBucketFrame(..., layout)`，函数内不再重复算。merge 同理。

- [ ] **Step 2：heap edge 缓存为常量**

在 builder 入口算一次 `const cachedEdges = computeHeapEdges(count, width, height)`，`createHeapOverlays` 直接返回 `cachedEdges`（深拷贝或直接引用——overlay 在渲染期只读，可直接引用）。

- [ ] **Step 3：验证** → 布局视觉无变化；heap 树连线位置稳定。

---

### 任务 3.4：插值引擎 swap pair find→map + 移动实体 Set 预计算

**Files:**
- Modify: `src/utils/frame/interpolate-entity.ts:62-63, 5-8`

**问题：**
1. `:62-63` swap pair 用 `toEntities.find(e => e.id === idA)` 线性查找，而 `:55` 已构建 `toMap`。零成本改 `toMap.get`。
2. `:6-8` `movedByTransition` 对每个实体做 `movingEntityIds?.includes` / `swapEntityIdPairs?.some`，O(entities × movingIds)。

- [ ] **Step 1：swap pair 改 toMap.get**

```ts
const toA = toMap.get(idA);
const toB = toMap.get(idB);
```

- [ ] **Step 2：movingEntityIds / swapPairs 预转 Set**

在 `interpolateEntities` 入口：

```ts
const movingIdSet = new Set(transition.movingEntityIds ?? []);
const swapIdSet = new Set((transition.swapEntityIdPairs ?? []).flat());
```

`interpolateEntity` 签名增参 `isMoving: (id: string) => boolean`，或直接传 Set 进去判断 `movingIdSet.has(from.id) || swapIdSet.has(from.id)`。

- [ ] **Step 3：验证** → 勿动清单中的 swap override / fakeFrom / moving-entity 淡出逻辑**完全保留**，仅替换查找方式。运行 swap/merge-back/bucket-gather 动画视觉无变化。

---

# 阶段 4：代码复用抽象（中风险）

**目标：** 消除 7 个算法组件与 4 个 builder 的重复样板，提取公共抽象。每个子任务独立可回归。

> 本阶段改动面较大，**建议每完成一个子任务就跑一次全算法 vitest + 全算法视觉回归**。

### 任务 4.1：4 个 basic 算法组件合并为 1 个 BasicSortView + 配置表 ⭐

**Files:**
- Create: `src/components/algorithms/BasicSortView.vue`
- Modify: `src/components/algorithms/BubbleSort.vue`
- Modify: `src/components/algorithms/InsertionSort.vue`
- Modify: `src/components/algorithms/QuickSort.vue`
- Modify: `src/components/algorithms/ShellSort.vue`
- Modify: `src/components/algorithms/index.ts`

**问题：** Bubble/Insertion/Quick/Shell 四个 `.vue` 除 `sortFn` 和 `algorithm` 字面量外逐字相同（模板 + script ~79 行 × 4 = 316 行）。

**方案：** 抽 `BasicSortView.vue` 承载全部共用逻辑与模板，4 个算法组件退化为薄壳（或直接由 index.ts 配置表驱动，组件文件可删）。

- [ ] **Step 1：创建 BasicSortView.vue**

把现有 `BubbleSort.vue` 的完整内容复制为 `BasicSortView.vue`，把硬编码的 `bubbleSort` 和 `algorithm: "bubble"` 改为 props：

```ts
const props = defineProps<{
  sortFn: (arr: ArrayElement[]) => SemanticStep[];
  algorithm: SortAlgorithm;
  speed?: number;
}>();
// useSortAnimation({ sortFn: props.sortFn, algorithm: props.algorithm, ... })
```

- [ ] **Step 2：4 个算法组件退化为薄壳**

```vue
<!-- BubbleSort.vue -->
<script setup lang="ts">
import BasicSortView from "./BasicSortView.vue";
import { bubbleSort } from "@/utils/sortingAlgorithms";
</script>
<template>
  <BasicSortView :sort-fn="bubbleSort" algorithm="bubble" :speed="$attrs.speed" />
</template>
```

（Quick/Shell/Insertion 同理，仅替换 sortFn 与 algorithm 值。）

- [ ] **Step 3：保持 defineExpose 契约**

`SortVisualizer.vue` 通过 ref 调 `algorithmRef.reset()/step()`。`BasicSortView` 需 `defineExpose({ reset, step })` 透传，4 个薄壳通过 `$attrs` 或显式 expose 透传，确保 `SortVisualizer` 的 ref 调用仍生效。

- [ ] **Step 4：验证** → 4 种算法全流程动画正常；键盘快捷键、reset/step 正常。

---

### 任务 4.2：Merge/Heap/Bucket 复用通用 AlgorithmView（可选降级）

**Files:**
- Create: `src/components/algorithms/AlgorithmView.vue`（若推进）
- Modify: `src/components/algorithms/MergeSort.vue`、`HeapSort.vue`、`BucketSort.vue`

**问题：** Merge/Heap/Bucket 组件与 basic 组件高度重合（canvasRef、useSortAnimation、键盘注册），仅 canvas 子组件与个别配置不同（HeapSort 有 heapMode 切换、不同 SortBarCanvas 子组件）。

**决策点：** 此项比 4.1 风险高（Heap 的 mode 切换、不同 canvas 组件注入）。**建议作为 4.1 的延伸，仅在 4.1 顺利后推进**。若评估收益（~180 行）不及风险，可降级为 P2 留待后续。

- [ ] **Step 1：评估** → 对比 3 个组件 setup 差异，确认可否用 slot 注入 canvas 子组件 + props 传 mode。
- [ ] **Step 2（条件推进）：** 抽 `AlgorithmView`，3 组件退化为薄壳 + slot。
- [ ] **Step 3：验证** → Heap 模式切换、Merge buffer 区、Bucket 桶布局均正常。

---

### 任务 4.3：抽 timeline-builders/state-tags.ts

**Files:**
- Create: `src/utils/timeline-builders/state-tags.ts`
- Modify: `src/utils/timeline-builders/build-basic-timeline.ts:65-98`
- Modify: `src/utils/timeline-builders/build-heap-timeline.ts:13-50`

**问题：** basic `buildStateTags` 与 heap `createStateTags` 结构完全相同（sorted 累加 → groupIndices 标 pending → compare/swap/pivot 各自 set tag），仅 heap 多 `"latest"` 分支、tag 字面量 `pending` vs `heap-pending`。

- [ ] **Step 1：抽公共函数**

```ts
// state-tags.ts
export interface BuildStateTagsOptions {
  /** pending 态的 tag 名（basic="pending", heap="heap-pending"） */
  pendingTag: string;
  /** 是否处理 heap 特有的 "latest" 语义 */
  withLatest?: boolean;
}
export function buildStateTagsFromSemantic(
  semantic: SemanticStep,
  sortedSet: Set<number>,
  opts: BuildStateTagsOptions,
): Map<number, string[]> { /* ... */ }
```

- [ ] **Step 2：basic/heap 改调用**

两 builder 删除各自的 `buildStateTags`/`createStateTags`，改调 `buildStateTagsFromSemantic`。
- [ ] **Step 3：验证** → basic/heap 状态标签颜色与改前逐帧一致。

---

### 任务 4.4：抽 timing-presets.ts（duration/transition 表驱动）

**Files:**
- Create: `src/utils/timeline-builders/timing-presets.ts`
- Modify: 4 个 build-*-timeline.ts

**问题：** 魔法 duration 散落各 builder，且语义重名易混（`flyDuration` 在 bucket=2、merge=3）。`swapDuration=3`、`compareDuration=2`、`curveHeight=70` 等无统一来源。

- [ ] **Step 1：定义预设表**

```ts
// timing-presets.ts
export const TIMING = {
  compare: { duration: 2 },
  swap: { duration: 3 },
  fly: { duration: 3 },        // 统一飞行时长（合并 bucket=2/merge=3 差异，需视觉确认）
  pivot: { duration: 2 },
  // ...
} as const;
export const CURVE = { defaultHeight: 70 } as const;
```

- [ ] **Step 2：builder 内引用常量**替换魔法数。
- [ ] **Step 3：验证** → 若合并了 bucket/merge 的 flyDuration，需视觉确认两算法飞行节奏可接受；否则保留各自值但集中在表内命名。

---

### 任务 4.5：抽 buildTimelineStepShell 工厂 + createFlyGhost

**Files:**
- Create: `src/utils/timeline-builders/step-shell.ts`
- Create: `src/utils/timeline-builders/fly-ghost.ts`
- Modify: `build-bucket-timeline.ts`、`build-merge-timeline.ts`

**问题：**
1. 4 个 builder 末尾 `return { id, description, duration, statsDelta: { comparisons, swaps }, semanticRef }` 结构同构（~40 行重复）。
2. bucket（270-342）与 merge（170-280）的 ghost 创建几何计算重复 ~80 行。

- [ ] **Step 1：step-shell.ts**

```ts
export function buildTimelineStepShell(args: {
  semantic: SemanticStep;
  from: FrameState; to: FrameState;
  transition: Transition;
  description: string;
  statsRules: { comparisons?: number; swaps?: number };
}): TimelineStep { /* 组装 */ }
```

- [ ] **Step 2：fly-ghost.ts**

```ts
export function createFlyGhost(args: {
  source: RenderableEntity;       // 源实体（仅取 id/value/style）
  fromPos: { x; y }; fromSize: { w; h };
  toPos: { x; y };   toSize: { w; h };
  ghostId: string;
}): { ghostFrom: RenderableEntity; ghostTo: RenderableEntity } {
  // 显式读坐标，禁止 spread 源实体几何（经验 #3）
}
```

- [ ] **Step 3：bucket/merge 改调用**，删除内联 ghost 几何。
- [ ] **Step 4：验证** → 勿动清单的 ghost 规则（from/to 双帧隐藏、不 spread 源、opacity 1）必须在 `createFlyGhost` 内严格遵守。运行 merge-set/merge-back/bucket-scatter/bucket-gather 全视觉对照。

---

### 任务 4.6：createStep 升级消除 Object.assign 样板

**Files:**
- Modify: `src/utils/sortingAlgorithms.ts`（~30 处）

**问题：** 几乎每个 step 都是 `createStep(...); Object.assign(steps[at], { brief, detail, context })` 两步式，重复 ~30 次、约 60 行。且 quick 的 partition（:425）push 的 sorted 步骤漏补 brief/detail，造成不一致。

- [ ] **Step 1：升级 createStep 签名**

让 `createStep`（或新增 `pushStep`）直接接收可选描述：

```ts
function pushStep(
  steps: SemanticStep[],
  args: { type: SemanticStepType; indices: number[]; values?: number[];
          brief?: string; detail?: string; context?: StepContext;
          arraySnapshot?: ArrayElement[] },
): void {
  steps.push({ /* 基础字段 */ ...args });
}
```

- [ ] **Step 2：逐算法替换** Object.assign 两步式为单次 `pushStep(steps, { type, indices, brief, detail, context })`。
- [ ] **Step 3：补全 quick 漏掉的描述**。
- [ ] **Step 4：验证** → 各算法三层描述（概述/详细/操作说明）文案完整；vitest 描述快照（若有）通过。

---

### 任务 4.7：拆分 createBucketFrame / createMergeFrame

**Files:**
- Modify: `src/utils/timeline-builders/build-bucket-timeline.ts:150-354`
- Modify: `src/utils/timeline-builders/build-merge-timeline.ts:91-295`

**问题：** 两个函数各 ~204 行，混杂 4 种职责（主数组实体 / 区域实体 / scatter-ghost / gather-ghost 等），可读性与可测性差。

- [ ] **Step 1：拆 createBucketFrame** 为 `createBucketMainEntities` / `createBucketBarEntities` / `createScatterGhost` / `createGatherGhost`，每个 < 60 行（scatter/gather ghost 可复用任务 4.5 的 `createFlyGhost`）。
- [ ] **Step 2：拆 createMergeFrame** 同理（main/buffer/set-ghost/back-ghost）。
- [ ] **Step 3：验证** → 纯重构，行为不变；全流程动画对照。

---

### 任务 4.8：抽 useCanvasMount / SortBarCanvasBase（4 canvas 统一）

**Files:**
- Create: `src/composables/useCanvasMount.ts`
- Modify: 4 个 `SortBarCanvas*.vue`

**问题：** 4 个 canvas 组件的 `onMounted/onUnmounted/ResizeObserver` 模板几乎一致，差异仅 minHeight 常量、`canvas-ready` 事件载荷形态（裸 number vs `{width,height}`）、是否带 `:style`。corner SCSS 四份重复。

- [ ] **Step 1：抽 useCanvasMount**

```ts
export function useCanvasMount(opts: {
  canvasRef: Ref<HTMLCanvasElement|null>;
  containerRef: Ref<HTMLElement|null>;
  minHeight: number;
  emit: (e: "canvas-ready", payload: { width: number; height: number }) => void;
  renderer: ReturnType<typeof useCanvasRenderer>;
}) {
  // 统一 ResizeObserver + onMounted/onUnmounted + emit canvas-ready（统一为 {width,height}）
}
```

- [ ] **Step 2：4 组件改用 useCanvasMount**，`canvas-ready` 载荷统一为 `{ width, height }`。
- [ ] **Step 3：CompareSlot.vue 删除归一化兜底**（`typeof payload === "number"` 分支，因载荷已统一）。
- [ ] **Step 4：corner SCSS 抽 mixin** 到共享 scss，4 处合并。
- [ ] **Step 5：验证** → 4 种算法 canvas 尺寸响应、CompareView 双 slot 尺寸正常。

---

### 任务 4.9：抽 PlaybackButton 公共组件

**Files:**
- Create: `src/components/common/PlaybackButton.vue`
- Modify: `src/components/CompareView.vue:197-226`、`BasicSortView.vue`（任务 4.1 产物）及各算法组件

**问题：** play/pause/step/stepBack/reset 的 SVG + `.pb-btn` 样式在 CompareView 与 7 个算法组件间重复 ~8 处。

- [ ] **Step 1：PlaybackButton.vue** props: `icon/title/disabled/active`，内含 SVG（按 icon 选 path）+ 样式。
- [ ] **Step 2：替换重复处**。
- [ ] **Step 3：验证** → 按钮外观与交互一致。

---

### 任务 4.10：硬编码颜色/字体常量化

**Files:**
- Modify: `src/composables/useCanvasRenderer.ts:5-11, 197-281`

**问题：** `VALUE_LABEL_COLOR`/`INDEX_LABEL_COLOR`/`BAR_HIGHLIGHT_COLOR` 硬编码且不随主题变；字体字符串 `'700 13px "JetBrains Mono"...'` 散落 6+ 处。

- [ ] **Step 1：抽 fonts 常量**

```ts
const FONTS = {
  badge: 'bold 13px "JetBrains Mono", monospace',
  bucketTitle: '700 13px "JetBrains Mono", monospace',
  label: '600 11px "JetBrains Mono", monospace',
  tiny: '10px "JetBrains Mono", monospace',
} as const;
const FONT_FAMILY = '"JetBrains Mono", monospace';
```

绘制函数引用常量替代内联字符串。

- [ ] **Step 2：label/highlight 色纳入主题**（可选，若主题系统支持扩展）。最低限度：把 `BACKGROUND_COLOR/GRID_COLOR/BASELINE_COLOR` 兜底集中到一处，渲染器只读 theme。
- [ ] **Step 3：验证** → 字体渲染无变化。

---

# 阶段 5：类型系统强化（高风险，中长期）

**目标：** 用判别联合在编译期挡住"字段错配"类 bug。本阶段改动面最大，**强烈建议逐任务推进 + 全量 type-check + 全算法回归**。

### 任务 5.1：RenderableOverlay 判别联合

**Files:**
- Modify: `src/types/timeline.ts:118-128`
- Modify: 所有构造 overlay 的 builder + `useCanvasRenderer.ts` drawOverlay

**问题：** `kind: "edge"|"guide"|"label"|"badge"|"divider"|"region-panel"` + 一堆 `?` 可选字段，任意组合都合法（如 `kind:"label"` 无 text）。运行时靠容错。

- [ ] **Step 1：定义判别联合**

```ts
type OverlayBase = { id: string; style: RenderStyle };
export type RenderableOverlay =
  | (OverlayBase & { kind: "edge" | "guide"; points: Point[] })
  | (OverlayBase & { kind: "label" | "badge"; text: string; points: Point[] })
  | (OverlayBase & { kind: "region-panel"; rect: Rect; accentBar?: string })
  | (OverlayBase & { kind: "divider"; points: Point[] });
```

- [ ] **Step 2：修 builder 构造点**（按 kind 提供必需字段）。
- [ ] **Step 3：drawOverlay 的分支** 在 narrowing 下更安全。
- [ ] **Step 4：验证** → `pnpm type-check` 通过；全算法 overlay（连线/标签/徽章/桶面板）渲染无变化。

---

### 任务 5.2：SemanticStep 判别联合

**Files:**
- Modify: `src/types/timeline.ts:44-62`
- Modify: `sortingAlgorithms.ts`、4 个 builder、`stepDescriptionGenerator.ts`

**问题：** `type` 有 13 种取值，但所有字段（bucketPos/gap/groupIndices...）平铺可选，任何 step 可携带任何字段。

- [ ] **Step 1：按 type 拆联合**，让 `bucketPos` 仅在 `bucket-scatter`/`bucket-swap` 上、`gap` 仅在 shell 相关类型上可设。
- [ ] **Step 2：修所有构造/消费点**。
- [ ] **Step 3：验证** → type-check + 全算法。

> 这是最耗时的一项。若时间紧，可拆为"先给 bucket-*/shell 加专属字段"的增量推进。

---

### 任务 5.3：Transition.pathParams 强类型

**Files:**
- Modify: `src/types/timeline.ts:141-151`
- Modify: `src/utils/frame/path-utils.ts:22-29`

**问题：** `pathParams?: Record<string, number|string>` 宽泛，path-utils 需 `typeof curveHeight === "number"` / `mode === "vertical-first"` 运行时窄化。

- [ ] **Step 1：定义强类型**

```ts
export type PathMode = "vertical-first" | "horizontal-first";
export interface PathParams { mode: PathMode; curveHeight: number; }
// Transition.pathParams?: PathParams
```

- [ ] **Step 2：path-utils 删除 typeof 兜底**，直接用。
- [ ] **Step 3：验证** → type-check + bucket/merge 飞行路径无变化。

---

### 任务 5.4：description 上提到 step 级

**Files:**
- Modify: `src/types/timeline.ts`（FrameState）
- Modify: `src/utils/frame/interpolate-frame.ts:19`
- Modify: 消费 `frame.description` 的组件

**问题：** `interpolateFrame` 每帧 `description: step.description` 重写，但该值整个 step 生命周期不变；FrameState 携带它导致每帧构造重复写入。

- [ ] **Step 1：FrameState 去掉 description**，消费方改读 `step.description`（player/currentTimelineStep 已暴露 step）。
- [ ] **Step 2：interpolateFrame 删除 description 字段**。
- [ ] **Step 3：验证** → 描述栏文案仍正确显示（改从 step 取）。

---

### 任务 5.5：generator 返回类型对齐 SemanticStep

**Files:**
- Modify: `src/utils/stepDescriptionGenerator.ts`
- Modify: `src/types/enhanced-step.ts`（若 0.6 未删）

**问题：** generator 返回 `EnhancedDescription` 再被 Object.assign 拆回 SemanticStep 三字段（任务 4.6 已部分缓解）。

- [ ] **Step 1：generator 返回 `Pick<SemanticStep, "brief"|"detail"|"context">`**，删除 EnhancedDescription 中间类型。
- [ ] **Step 2：验证** → type-check + 描述文案。

---

# 阶段 6：质量收尾（P2）

**目标：** 收尾魔法数、主题数据精简、各类小优化。低风险，可挑选执行。

### 任务 6.1：themes.ts base + override 合并

**Files:**
- Modify: `src/data/themes.ts`

**问题：** 6 个主题的 `typography`/`animation`/`effects` 大量重复（5 个 typography 完全相同）。

- [ ] **Step 1：抽 baseTheme**，各主题用 `{ ...baseTheme, ...overrides }` 合并。预期减 ~150 行。
- [ ] **Step 2：验证** → 6 主题渲染一致。

---

### 任务 6.2：heap-layout 等魔法数常量化

**Files:**
- Modify: `src/utils/layout/heap-layout.ts:12-24`
- Modify: `src/composables/useCanvasRenderer.ts:283`（labelOffset 与 basic-layout 统一）

- [ ] **Step 1：heap-layout** 把 `48/88/80/40/16/32` 提为命名常量。
- [ ] **Step 2：labelOffset 单一来源** → builder 显式把 `labelOffset: BASIC_LAYOUT_LABEL_OFFSET` 写进 region meta，renderer 删 `?? 17` 兜底。

---

### 任务 6.3：useSortAnimation watch 合并 + originalArray 浅比较

**Files:**
- Modify: `src/composables/useSortAnimation.ts:173-199`

- [ ] **Step 1：originalArray watch 改浅比较**（generateArray 每次新引用，浅比较足够）—— 确认无需 deep 后，无需传 `{ deep }`（默认即浅）。
- [ ] **Step 2：canvasWidth/Height 两个 watch 合并**为一个 `watch([currentCanvasWidth, currentCanvasHeight], rebuild)`，buildInitial 一并纳入 debounce。

---

### 任务 6.4：themeStore setTimeout 句柄管理

**Files:**
- Modify: `src/stores/themeStore.ts:72-81`

- [ ] **Step 1：保存 setTimeout 句柄到模块变量**，新调用前 `clearTimeout` 旧的，避免快速连按 Alt+T 叠加。

---

### 任务 6.5：调速平滑度（stepStartedAt 重算）

**Files:**
- Modify: `src/composables/useTimelinePlayer.ts:60,70`

- [ ] **Step 1：tick 内调速时重算** `stepStartedAt = ts - progress.value * getStepDuration()`，避免调速瞬间 progress 跳变。

---

### 任务 6.6：剩余小项（按需挑选）

- `useKeyboardShortcuts.ts`：补全或删除未注册的 PageUp/PageDown（`:64-76` 注释承诺但无 handler）。
- `build-merge-timeline.ts:362-368`：删除无副作用的 IIFE。
- `build-heap-timeline.ts:257`：`isRootExtractSwap` 加注释说明 `distance>1` 语义。
- `ControlPanel.vue:84`：speed slider 改 computed getter/setter 或 watch 同步，避免 store 外部变更不同步。
- `ControlPanel.vue:10-13`：算法 `shortName` 从数据源提供，消除 `replace('排序','')` 脆弱处理。
- `sortingAlgorithms.ts:304-306`：mergeSort temp 数组预分配复用（n≤200 影响小，可选）。
- `getFrameNumberMeta(frame, key: string)` → key 改 `"labelOffset"|"baseY"` 字面量联合。
- **useTheme/themeStore 职责重叠**：`useTheme.ts` 几乎只是 themeStore 的 computed 透传 + 单行 getter。把 `getBackgroundColor` 等 getter 下沉为 store getter，composable 仅留跨组件派生逻辑（如 `isDarkTheme`），减一层无意义包装。
- **CompareSlot stats emit 脏检查**：`CompareView.vue:64-73` 的 `statsDiff` computed 依赖双侧 ref 对象，CompareSlot 每 step emit 新对象触发重算。在 CompareSlot 内做值比对（comparisons/swaps/currentStep 未变则不 emit），减少对比模式每步重渲染。
- **entityDrawers 注册表（最佳实现）**：`useCanvasRenderer.ts` 的 `drawEntity` 把 `if isHeapNode ... else drawBarEntity` 演化为 `entityDrawers: Partial<Record<EntityKind, Drawer>>` 注册表，新增实体形态只注册不改核心循环。非必须，作为可扩展性改进。
- **heap-layout `getArrayAreaHeight(_count)`**：参数永远忽略（`return 56`），要么按 count 算要么删参数。

---

## 验收检查表（全阶段完成后）

- [ ] `pnpm type-check` 零错误
- [ ] `pnpm build` 通过
- [ ] `pnpm test:run` 全绿（作为回归基线）
- [ ] 7 种算法全流程动画视觉与改前一致（重点：bucket-gather 终点无闪烁、merge/heap 状态标签正确、ghost 飞行无重影）
- [ ] 对比模式双 slot 同步播放正常、无控制台 ref 警告
- [ ] DevTools Performance：动画暂停/结束后主线程无持续 rAF 空转
- [ ] 主题切换（含 Alt+T）只触发一次、6 主题着色正确
- [ ] 死代码文件均已删除，Grep 无残留引用
- [ ] CLAUDE.md 勿动清单各项均未被破坏

## 预期总体收益

- **代码量**：净减约 1800-2200 行（删死代码 -2000，抽象重构后净增少量但消除大量重复）。
- **性能**：静止态 CPU ≈ 0（dirty-flag）；builder 构建提速 5-10×（去 structuredClone）；播放时模板重渲染显著减少。
- **正确性**：修复 1 处违反项目经验的 ghost 闪烁 bug、rAF 泄漏、store 违规、空 catch。
- **可维护性**：4 算法组件→1、4 builder 公共化、类型判别联合编译期防 bug。
