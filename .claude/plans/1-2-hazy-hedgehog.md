# Canvas Basic Bar Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 调整基础排序柱状 Canvas 的布局，使柱体整体居中、柱体位于水平基线之上、底部索引位于基线下方，视觉效果贴近用户截图。

**Architecture:** 以 `buildBasicLayout` 作为基础排序布局的唯一坐标来源，保持 `RenderableEntity.y` 表示柱体底部基线。渲染器从当前 frame 的 `main` region 元数据读取基线，不再用 Canvas 容器高度自行推导水平线，避免 timeline 高度与实际 Canvas 高度不一致时出现错位。

**Tech Stack:** Vue 3、TypeScript、Canvas 2D、现有 timeline frame 渲染架构。

---

## Context

用户截图中柱体组应在画布可视区域中间，柱体底部贴着一条水平线并全部位于水平线之上，绿色索引在水平线下方。当前实现里 `buildBasicLayout` 使用 `height - BOTTOM_OFFSET` 作为柱体底部，而 `drawBackground` 使用实际 Canvas 的 `containerHeight - 21.5` 绘制水平线；基础排序 timeline 又固定使用 `760 x 320`，这些坐标来源不一致，导致柱体/标签与水平线视觉错位，且整体不够居中。

## File Structure

- Modify: `src/utils/layout/basic-layout.ts`
  - 负责基础排序柱体 slot 的横向居中、基线、最大柱高计算。
  - 新增导出的布局常量，供 timeline 和 renderer 共用。
- Modify: `src/utils/timeline-builders/build-basic-timeline.ts`
  - 将 `baseY`、`labelOffset` 写入 `regions[0].meta`，让 frame 携带布局元数据。
- Modify: `src/composables/useCanvasRenderer.ts`
  - 背景水平线优先读取当前 frame 的 `main` region `meta.baseY`。
  - 索引标签使用统一偏移量，保持在基线下方。
- Modify: `src/components/SortBarCanvas.vue`
  - 让 Canvas 内边距更对称，减少 CSS padding 对视觉居中的干扰。
- Optional static check: `src/types/timeline.ts`
  - 不需要改类型；`RenderableRegion.meta?: Record<string, number | string>` 已支持写入 `baseY`。

## Recommended Design

采用“统一基线元数据”的方式修复：

1. `buildBasicLayout` 继续返回每个柱体的 `x/y/width/maxHeight`，其中 `y` 明确表示柱体底部基线。
2. 基线从 `height - 22` 改为基于画布比例的中部偏下位置，例如 `height * 0.76`，同时用底部标签安全区限制，确保 `baseY + labelOffset` 不越界。
3. `buildBasicTimeline` 从 slots 中取 `baseY`，写入 `regions[0].meta.baseY` 和 `meta.labelOffset`。
4. `useCanvasRenderer.drawBackground` 接收 `frame`，使用 `frame.regions` 的 `baseY` 绘制水平线；若没有元数据，则退回到 `containerHeight - 21.5`，不影响 merge/bucket/heap 旧 frame。
5. `SortBarCanvas.vue` 保持 flex 居中，将底部 padding 调整为与顶部更接近，避免画布本身在容器内偏上。

不引入新抽象、不调整排序算法、不修改非基础排序布局。

---

### Task 1: Unify basic layout baseline

**Files:**
- Modify: `src/utils/layout/basic-layout.ts:14-35`

- [ ] **Step 1: Replace layout constants and baseline calculation**

Update `src/utils/layout/basic-layout.ts` so the top of the file contains these constants and `buildBasicLayout` body:

```ts
export interface BasicLayoutInput {
  width: number;
  height: number;
  count: number;
}

export interface BasicBarSlot {
  index: number;
  x: number;
  y: number;
  width: number;
  maxHeight: number;
}

export const BASIC_LAYOUT_LABEL_OFFSET = 17;

const GAP = 12;
const MIN_BAR_WIDTH = 6;
const MAX_BAR_WIDTH = 46;
const TOP_PADDING = 48;
const BOTTOM_PADDING = 28;
const BASELINE_RATIO = 0.76;

export function buildBasicLayout({ width, height, count }: BasicLayoutInput): BasicBarSlot[] {
  if (count <= 0) return [];

  const barWidth = Math.max(MIN_BAR_WIDTH, Math.min(MAX_BAR_WIDTH, (width - GAP) / count - GAP));
  const totalWidth = count * barWidth + (count - 1) * GAP;
  const startX = Math.max(0, (width - totalWidth) / 2);
  const labelSafeBaseY = height - BOTTOM_PADDING - BASIC_LAYOUT_LABEL_OFFSET;
  const baseY = Math.min(Math.round(height * BASELINE_RATIO), labelSafeBaseY);
  const maxHeight = Math.max(0, baseY - TOP_PADDING);

  return Array.from({ length: count }, (_, index) => ({
    index,
    x: Math.round(startX + index * (barWidth + GAP)),
    y: Math.round(baseY),
    width: Math.round(barWidth),
    maxHeight: Math.round(maxHeight),
  }));
}
```

- [ ] **Step 2: Static coordinate check**

Manually verify from the new formula:

```txt
height = 320
baseY = min(round(320 * 0.76), 320 - 28 - 17) = min(243, 275) = 243
maxHeight = 243 - 48 = 195
labelY = 243 + 17 = 260
```

Expected: tallest bar top is `48`, bar bottom is `243`, index label is `260`, so the visual group is vertically centered and the label remains below the baseline.

---

### Task 2: Store baseline metadata in basic frames

**Files:**
- Modify: `src/utils/timeline-builders/build-basic-timeline.ts:1-49`

- [ ] **Step 1: Import the shared label offset**

Change the import from:

```ts
import { buildBasicLayout } from "@/utils/layout/basic-layout";
```

to:

```ts
import { BASIC_LAYOUT_LABEL_OFFSET, buildBasicLayout } from "@/utils/layout/basic-layout";
```

- [ ] **Step 2: Add layout metadata to the main region**

Inside `createBasicFrame`, after `const slots = buildBasicLayout({ width, height, count: values.length });`, add:

```ts
  const baseY = slots[0]?.y ?? height;
```

Then replace the `regions` property in the returned frame from:

```ts
    regions: [{ id: "main", kind: "main", x: 0, y: 0, width, height }],
```

to:

```ts
    regions: [{
      id: "main",
      kind: "main",
      x: 0,
      y: 0,
      width,
      height,
      meta: {
        baseY,
        labelOffset: BASIC_LAYOUT_LABEL_OFFSET,
      },
    }],
```

- [ ] **Step 3: Static metadata check**

Verify `FrameState.regions[0].meta` is valid because `src/types/timeline.ts:78` already defines:

```ts
meta?: Record<string, number | string>;
```

Expected: no type change is required.

---

### Task 3: Draw the baseline from frame metadata

**Files:**
- Modify: `src/composables/useCanvasRenderer.ts:267-316`

- [ ] **Step 1: Add metadata helpers before `drawBackground`**

Insert these helpers above `function drawBackground`:

```ts
  function getMainRegion(frame: FrameState) {
    return frame.regions.find((region) => region.kind === "main");
  }

  function getFrameNumberMeta(frame: FrameState, key: string) {
    const value = getMainRegion(frame)?.meta?.[key];
    return typeof value === "number" ? value : null;
  }
```

- [ ] **Step 2: Change `drawBackground` to accept the current frame**

Replace:

```ts
  function drawBackground(ctx: CanvasRenderingContext2D) {
```

with:

```ts
  function drawBackground(ctx: CanvasRenderingContext2D, frame: FrameState) {
```

Inside the baseline drawing block, replace:

```ts
    ctx.beginPath();
    ctx.moveTo(0, containerHeight - 21.5);
    ctx.lineTo(containerWidth, containerHeight - 21.5);
    ctx.stroke();
```

with:

```ts
    const baseY = getFrameNumberMeta(frame, "baseY") ?? containerHeight - 21.5;
    const baselineY = Math.round(baseY) + 0.5;

    ctx.beginPath();
    ctx.moveTo(0, baselineY);
    ctx.lineTo(containerWidth, baselineY);
    ctx.stroke();
```

- [ ] **Step 3: Update the draw call**

Replace:

```ts
    drawBackground(ctx);
```

with:

```ts
    drawBackground(ctx, frame);
```

Expected: the horizontal line now matches each basic frame's bar baseline.

---

### Task 4: Use the frame label offset for bar indexes

**Files:**
- Modify: `src/composables/useCanvasRenderer.ts:169-217,257-264,313-316`

- [ ] **Step 1: Pass the frame into entity rendering**

Replace:

```ts
  function drawBarEntity(ctx: CanvasRenderingContext2D, entity: RenderableEntity) {
```

with:

```ts
  function drawBarEntity(ctx: CanvasRenderingContext2D, entity: RenderableEntity, frame: FrameState) {
```

Replace:

```ts
  function drawEntity(ctx: CanvasRenderingContext2D, entity: RenderableEntity) {
```

with:

```ts
  function drawEntity(ctx: CanvasRenderingContext2D, entity: RenderableEntity, frame: FrameState) {
```

Inside `drawEntity`, replace:

```ts
    drawBarEntity(ctx, entity);
```

with:

```ts
    drawBarEntity(ctx, entity, frame);
```

In the render loop, replace:

```ts
      .forEach((entity) => drawEntity(ctx, entity));
```

with:

```ts
      .forEach((entity) => drawEntity(ctx, entity, frame));
```

- [ ] **Step 2: Use `labelOffset` metadata for the index label**

In `drawBarEntity`, replace:

```ts
    ctx.fillText(String(entity.displayIndex), x + width / 2, y + 17);
```

with:

```ts
    const labelOffset = getFrameNumberMeta(frame, "labelOffset") ?? 17;
    ctx.fillText(String(entity.displayIndex), x + width / 2, y + labelOffset);
```

Expected: basic sorting index labels are aligned with the same offset used by layout metadata, while other frame types keep the previous visual fallback.

---

### Task 5: Center the Canvas element visually in its container

**Files:**
- Modify: `src/components/SortBarCanvas.vue:55-63`

- [ ] **Step 1: Make container padding vertically balanced**

Replace the `.sort-bar-canvas` style block content from:

```scss
.sort-bar-canvas {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  position: relative;
  padding: 18px 22px 4px;
}
```

with:

```scss
.sort-bar-canvas {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  position: relative;
  padding: 16px 22px;
}
```

Expected: Canvas itself remains centered by flex layout instead of being visually pulled down/up by asymmetric padding.

---

### Task 6: Static verification

**Files:**
- Inspect: `src/utils/layout/basic-layout.ts`
- Inspect: `src/utils/timeline-builders/build-basic-timeline.ts`
- Inspect: `src/composables/useCanvasRenderer.ts`
- Inspect: `src/components/SortBarCanvas.vue`

- [ ] **Step 1: Verify single baseline source for basic bars**

Check these exact conditions by reading the files:

```txt
basic-layout.ts:
- Renderable slot y is computed from `baseY`.
- maxHeight is computed as `baseY - TOP_PADDING`.

build-basic-timeline.ts:
- `baseY` is copied from `slots[0]?.y` into `regions[0].meta.baseY`.
- `labelOffset` is copied from `BASIC_LAYOUT_LABEL_OFFSET` into `regions[0].meta.labelOffset`.

useCanvasRenderer.ts:
- `drawBackground` accepts `frame`.
- baseline line uses `getFrameNumberMeta(frame, "baseY")`.
- index label uses `getFrameNumberMeta(frame, "labelOffset")`.

SortBarCanvas.vue:
- `.sort-bar-canvas` padding is `16px 22px`.
```

Expected: the baseline used by background, bars, and labels is consistent for basic sorting frames.

- [ ] **Step 2: Do not run commands**

Per user instructions, do not run `npm run dev`, `npm run build`, `npm test`, or git commands. Verification for this task is static review plus manual coordinate reasoning.

---

## Risk Notes

- `drawBackground` fallback preserves existing behavior for frames that do not provide `meta.baseY`.
- The change intentionally targets basic bar sorting frames. Merge, bucket, and heap timelines may still use their existing layout behavior.
- If later the app needs full responsive timeline sizing, wire actual Canvas dimensions into `useSortAnimation`; this plan avoids that larger refactor because the user requested a screenshot-matching visual correction.
