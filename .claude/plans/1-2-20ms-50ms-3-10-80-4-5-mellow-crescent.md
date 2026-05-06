# 排序动画 5 项问题修复计划

## Context

排序可视化项目存在 5 个用户反馈的问题：交换动画缺乏实际位移感、最低速度过快、元素增多时卡顿且不居中、调速导致动画重头开始、单步按钮无效。根源分别涉及 arc 高度硬编码、速度最小值、布局宽度硬编码、speed watcher 触发 rebuild、stepForward 直接调用 play。

---

## 问题 1：交换动画缺乏实际位移感

**根因**：`interpolate-entity.ts:13` arc 高度硬编码为 50px，在画布 320-460px 高度下弧线不够明显。且 `stepStartedAt` 计算方式（`useTimelinePlayer.ts:42`）在低速时第一帧 progress 接近 1，导致动画几乎跳过。

**修改**：
- [src/utils/frame/interpolate-entity.ts](src/utils/frame/interpolate-entity.ts)：将 arc 高度从硬编码 50 改为基于实体高度的动态值（如 `Math.max(60, (from.height + to.height) / 2 * 1.2)`），让交换弧线更明显

---

## 问题 2：最低速度 20ms 过快

**根因**：`ControlPanel.vue:62` 速度 slider min=20。在 60fps 下 20ms/step 意味着每步约 1 帧，动画插值几乎没有中间帧，视觉上是"跳动"而非"动画"。

**修改**：
- [src/components/ControlPanel.vue](src/components/ControlPanel.vue)：将 speed slider 的 `min` 从 `20` 改为 `50`，`step` 保持 `10`

---

## 问题 3：元素增多时卡顿且不居中

**根因**：布局使用硬编码 `width: 760`（[useSortAnimation.ts:53-84](src/composables/useSortAnimation.ts)），但实际 canvas 容器宽度由 `ResizeObserver` 决定（可能远大于 760px）。当 80 个元素时，`totalWidth = 80*6 + 79*12 = 1428px` 远超 760px，`startX = max(0, (760-1428)/2) = 0`，所有 bar 挤在左侧。canvas 层的 `getFrameContentOffsetX` 只在 760px 范围内居中，无法修正溢出。

**修改**：
- [src/components/SortBarCanvas.vue](src/components/SortBarCanvas.vue)：将实际 canvas 宽度通过 reactive ref 暴露出去
- [src/composables/useSortAnimation.ts](src/composables/useSortAnimation.ts)：
  - 新增可选参数 `canvasWidth: Ref<number>`，默认 `760`
  - 将 `canvasWidth.value` 传给 timeline builder 替代硬编码 760
  - watch `canvasWidth` 变化时触发 rebuild（首次 canvas 挂载后会多一次 build，可接受）
- [src/utils/layout/basic-layout.ts](src/utils/layout/basic-layout.ts)：当 bar 数量多导致 totalWidth > width 时，动态缩小 GAP（如 `Math.max(2, Math.min(GAP, (width - count * MIN_BAR_WIDTH) / Math.max(count - 1, 1)))`），确保 bar 不溢出且居中

---

## 问题 4：调速导致动画从头开始

**根因**：`useSortAnimation.ts:140-143` watch speed 变化直接调 `rebuild()`，而 `rebuild()` 会重新生成整个 timeline 并 `player.reset()`。这是架构设计问题——duration 被烘焙进每个 TimelineStep。

**修改**：
- [src/composables/useTimelinePlayer.ts](src/composables/useTimelinePlayer.ts)：
  - 新增 `stepDuration` ref 参数（默认从 steps 读取）
  - `tick()` 中使用 `stepDuration.value` 替代 `step.duration`
  - 暴露 `setStepDuration(ms)` 方法，只更新 ref，不 reset
  - 在 `setStepDuration` 中重新计算 `stepStartedAt` 以保持当前 progress 不跳变
- [src/composables/useSortAnimation.ts](src/composables/useSortAnimation.ts)：
  - speed watcher 改为调用 `player.setStepDuration(speed.value)` 而非 `rebuild()`
  - `rebuild()` 中仍用 `speed.value` 初始化 timeline（此时 duration 字段仅作初始值/fallback）

---

## 问题 5：单步按钮无效

**根因**：`useTimelinePlayer.ts:34-37` 的 `stepForward()` 直接调用 `play()`，而 `play()` 启动 raf 循环后不会自动暂停，等同于连续播放。

**修改**：
- [src/composables/useTimelinePlayer.ts](src/composables/useTimelinePlayer.ts)：重写 `stepForward()`：
  ```ts
  function stepForward() {
    if (isPlaying.value || !currentTimelineStep.value) return;
    const step = currentTimelineStep.value;
    const stepStarted = performance.now();
    const tick = (ts: number) => {
      const elapsed = ts - stepStarted;
      progress.value = Math.min(1, elapsed / Math.max(stepDuration.value, 1));
      if (progress.value >= 1) {
        currentStepIndex.value += 1;
        progress.value = 0;
        return; // 自然停止，不继续
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }
  ```
  - 使用独立的 raf 循环播放一步动画，完成后自动停止
  - 不设置 `isPlaying = true`，这样 step 按钮的 disabled 条件不受影响

---

## 涉及文件清单

| 文件 | 改动类型 |
|------|---------|
| `src/composables/useTimelinePlayer.ts` | 重构：新增 stepDuration 参数、setStepDuration、重写 stepForward |
| `src/composables/useSortAnimation.ts` | 修改：speed watcher 改用 setStepDuration、传递 canvas 实际宽度 |
| `src/components/ControlPanel.vue` | 修改：speed slider min 20→50 |
| `src/utils/layout/basic-layout.ts` | 修改：动态 GAP 计算防止溢出 |
| `src/utils/frame/interpolate-entity.ts` | 修改：arc 高度动态化 |
| `src/components/SortBarCanvas.vue` | 修改：暴露 canvas 实际宽度 |

---

## 验证方式

1. **交换动画**：运行 bubble sort，观察交换时两个 bar 是否有明显的弧线位移（抛物线轨迹）
2. **速度范围**：拖动速度 slider，确认最低为 50ms，动画流畅无跳帧
3. **大量元素居中**：将数量调到 80，确认 bar 在 canvas 中水平居中，无左侧堆积
4. **调速不重置**：播放到中间暂停，拖动速度 slider，再播放，确认从暂停处继续
5. **单步执行**：暂停状态下点击单步按钮，确认每点击一次只执行一个步骤（带动画）
