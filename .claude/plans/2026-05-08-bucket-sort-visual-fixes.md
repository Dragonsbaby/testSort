# Bucket Sort 可视化修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复桶排序可视化的 7 个视觉/动画问题，包括柱高比例、布局、编号、swap 动画 bug、柱宽、scatter/gather 飞行动画。

**Architecture:** 所有改动集中在 3 个文件：布局参数（bucket-layout.ts）、时间轴帧构建（build-bucket-timeline.ts）、实体插值（interpolate-entity.ts）。不涉及算法逻辑或渲染器绘制函数。

**Tech Stack:** TypeScript, Vue 3, Canvas 2D API

---

## 文件改动总览

| 文件 | 改动 |
|------|------|
| `src/utils/layout/bucket-layout.ts` | 调整布局比例，去掉分隔带高度，减小顶部 padding |
| `src/utils/timeline-builders/build-bucket-timeline.ts` | 问题 1/2/3/5/6/7 全部集中在这里 |
| `src/utils/frame/interpolate-entity.ts` | 问题 4：实现 swapEntityIdPairs 的交叉插值 |

---

### Task 1：修复布局 — 移除分隔带，桶区加高（问题 2）

**Files:**
- Modify: `src/utils/layout/bucket-layout.ts`

- [ ] **Step 1: 修改 bucket-layout.ts 布局参数**

将文件改为：

```typescript
import { calcBucketCount } from "@/types/sorting";

export interface BucketRegion {
  bucketIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BucketLayout {
  bucketCount: number;
  mainHeight: number;
  separatorHeight: number;
  bucketRegions: BucketRegion[];
}

/** 桶内顶部留白（仅标题区域，去掉值域标签） */
export const BUCKET_INNER_PADDING_TOP = 28;
/** 桶内底部留白（index 标签区域） */
export const BUCKET_INNER_PADDING_BOT = 24;
/** 桶内左右 padding */
export const BUCKET_INNER_PADDING_X = 8;

export function buildBucketLayout(width: number, height: number, count: number): BucketLayout {
  const bucketCount = calcBucketCount(count);
  const mainHeight = Math.round(height * 0.38);
  const separatorHeight = 4;
  const top = mainHeight + separatorHeight;
  const gap = 10;
  const bucketWidth = Math.floor((width - gap * (bucketCount + 1)) / bucketCount);

  return {
    bucketCount,
    mainHeight,
    separatorHeight,
    bucketRegions: Array.from({ length: bucketCount }, (_, bucketIndex) => ({
      bucketIndex,
      x: gap + bucketIndex * (bucketWidth + gap),
      y: top,
      width: bucketWidth,
      height: height - top - 8,
    })),
  };
}
```

关键变化：
- `BUCKET_INNER_PADDING_TOP`: 40 → 28
- `mainHeight`: `height * 0.42` → `height * 0.38`
- `separatorHeight`: `height * 0.07` → 固定 4px

- [ ] **Step 2: 确认 TypeScript 无报错**

在终端运行：
```bash
npx vue-tsc --noEmit
```
预期：无错误输出（或仅有无关的既有错误）。

---

### Task 2：移除分隔带/百分比 overlay，Bucket 编号从 1 开始（问题 2 + 3）

**Files:**
- Modify: `src/utils/timeline-builders/build-bucket-timeline.ts`

- [ ] **Step 1: 删除 `getBucketRangeLabel` 函数**

定位并删除第 84-88 行的整个函数：
```typescript
// 删除此函数
function getBucketRangeLabel(bucketIndex: number, bucketCount: number) {
  const start = Math.round((bucketIndex / bucketCount) * 100);
  const end = Math.round(((bucketIndex + 1) / bucketCount) * 100);
  return `${start}%–${end}%`;
}
```

- [ ] **Step 2: 修改 `buildBucketOverlays` — 删除 3 类 overlay，改 Bucket 编号**

找到 `buildBucketOverlays` 函数，做以下修改：

1. 删除 `bucket-separator-label` overlay（约第 108-114 行）：
```typescript
// 删除这段
overlays.push({
  id: "bucket-separator-label",
  kind: "label",
  points: [{ x: width / 2, y: layout.mainHeight + Math.round(layout.separatorHeight / 2) }],
  text: "▼  分  桶  区",
  style: { fill: "rgba(78, 205, 196, 0.7)", text: "rgba(78, 205, 196, 0.7)", alpha: 0.9 },
});
```

2. 删除 `bucket-range-*` overlay（约第 152-159 行）：
```typescript
// 删除这段
overlays.push({
  id: `bucket-range-${bucketIndex}`,
  kind: "guide",
  points: [{ x: region.x + region.width / 2, y: region.y + 28 }],
  text: getBucketRangeLabel(bucketIndex, layout.bucketCount),
  style: { fill: "rgba(186, 242, 255, 0.75)", text: "rgba(186, 242, 255, 0.75)", alpha: 0.8 },
});
```

3. 删除 `bucket-divider` overlay（约第 171-180 行）：
```typescript
// 删除这段
overlays.push({
  id: "bucket-divider",
  kind: "divider",
  points: [
    { x: 18, y: layout.mainHeight + Math.round(layout.separatorHeight / 2) },
    { x: width - 18, y: layout.mainHeight + Math.round(layout.separatorHeight / 2) },
  ],
  style: { fill: "rgba(78, 205, 196, 0.2)", stroke: "rgba(78, 205, 196, 0.2)", dashed: true },
});
```

4. 修改 Bucket 标题编号从 0 开始改为从 1 开始（约第 147-149 行）：
```typescript
// 修改前
text: `Bucket ${bucketIndex}`,
// 修改后
text: `Bucket ${bucketIndex + 1}`,
```

- [ ] **Step 3: 确认 TypeScript 无报错**

```bash
npx vue-tsc --noEmit
```

---

### Task 3：桶内柱高改用全局 maxValue 归一化（问题 1）

**Files:**
- Modify: `src/utils/timeline-builders/build-bucket-timeline.ts`

- [ ] **Step 1: 删除 `bucketFinalMaxMap` 预计算块**

找到 `buildBucketTimeline` 函数中约第 358-370 行，删除整个预计算块：
```typescript
// 删除这段
const bucketFinalMaxMap = new Map<number, number>();
for (const step of steps) {
  if (step.type === "bucket-scatter" && typeof step.bucketIndex === "number") {
    const sourceIndex = step.indices[0];
    if (typeof sourceIndex === "number") {
      const val = originalValues[sourceIndex];
      const prev = bucketFinalMaxMap.get(step.bucketIndex) ?? 0;
      if (val > prev) bucketFinalMaxMap.set(step.bucketIndex, val);
    }
  }
}
```

- [ ] **Step 2: 计算全局 maxValue 并传递**

在删除预计算块的位置，替换为：
```typescript
const globalMaxValue = Math.max(...originalValues, 1);
```

- [ ] **Step 3: 修改 `createBucketFrame` 签名 — 去掉 `bucketFinalMaxMap` 参数，加入 `globalMaxValue`**

函数签名（约第 185 行）改为：
```typescript
function createBucketFrame(params: {
  mainValues: number[];
  buckets: number[][];
  displayIndexes: number[];
  width: number;
  height: number;
  stepIndex: number;
  description: string;
  mainStateTags: Map<number, StateTag[]>;
  bucketStateTags: Map<string, StateTag[]>;
  semantic?: SemanticStep;
  frameRole?: FrameRole;
  activeBucketIndex?: number;
  globalMaxValue: number;
}): FrameState {
```

解构时把 `bucketFinalMaxMap` 改为 `globalMaxValue`：
```typescript
const {
  mainValues,
  buckets,
  displayIndexes,
  width,
  height,
  stepIndex,
  description,
  mainStateTags,
  bucketStateTags,
  semantic,
  frameRole = "static",
  activeBucketIndex,
  globalMaxValue,
} = params;
```

- [ ] **Step 4: 修改桶内柱高计算 — 改用全局 maxValue**

找到 `bucketEntities` 的计算块（约第 241-287 行），找到这行：
```typescript
const bucketMax = bucketFinalMaxMap?.get(bucketIndex) ?? maxValue;
```
改为：
```typescript
const bucketMax = globalMaxValue;
```

同时把同一块中主数组 `maxValue` 的定义（第 216 行）：
```typescript
const maxValue = Math.max(...mainValues, 1);
```
保持不变（主数组仍用动态 maxValue，桶内用 globalMaxValue）。

- [ ] **Step 5: 更新 `buildBucketTimeline` 中两处 `createBucketFrame` 调用**

两处调用（from 帧和 to 帧）都把 `bucketFinalMaxMap` 替换为 `globalMaxValue`：

```typescript
// from 帧调用
const from = createBucketFrame({
  mainValues,
  buckets,
  displayIndexes,
  width,
  height,
  stepIndex: index,
  description: semantic.description,
  mainStateTags,
  bucketStateTags,
  semantic,
  frameRole: "from",
  activeBucketIndex,
  globalMaxValue,   // ← 替换 bucketFinalMaxMap
});

// to 帧调用
const to = createBucketFrame({
  mainValues,
  buckets,
  displayIndexes,
  width,
  height,
  stepIndex: index + 1,
  description: semantic.description,
  mainStateTags,
  bucketStateTags,
  semantic,
  frameRole: "to",
  activeBucketIndex,
  globalMaxValue,   // ← 替换 bucketFinalMaxMap
});
```

- [ ] **Step 6: 确认 TypeScript 无报错**

```bash
npx vue-tsc --noEmit
```

---

### Task 4：修复 swap 交叉平移动画 bug（问题 4）

**Files:**
- Modify: `src/utils/frame/interpolate-entity.ts`

**背景：** `swapEntityIdPairs` 字段存在于 `Transition` 类型中，但 `interpolateEntities` 从未读取它。`from`/`to` 帧中两根 bar 的 x 坐标已经是交换后的状态，`lerp(from.x, to.x)` 结果是从各自原始位置 lerp 到对方目标位置——看起来像原地不动（因为值变了但视觉上没有"对穿"感）。

正确做法：对 swap pair 中的每个 entity，让它从**对方**的目标 x 出发，lerp 到自己的目标 x，产生真正的交叉对穿效果。

- [ ] **Step 1: 修改 `interpolateEntities` 增加 swap pair 处理**

将 `interpolate-entity.ts` 改为：

```typescript
import type { RenderableEntity, Transition } from "@/types/timeline";
import { getArcPoint, getFadeOpacity, getPathPoint, lerp } from "./path-utils";
import { interpolateStyle } from "./style-utils";

function interpolateEntity(from: RenderableEntity, to: RenderableEntity, transition: Transition, progress: number): RenderableEntity {
  const movedByTransition = transition.movingEntityIds?.includes(from.id) ?? false;

  let x = lerp(from.x, to.x, progress);
  let y = lerp(from.y, to.y, progress);

  if (movedByTransition) {
    if (transition.type === "arc") {
      const arcHeight = Math.max(80, (from.height + to.height) / 2 * 1.8);
      const point = getArcPoint({ x: from.x, y: from.y }, { x: to.x, y: to.y }, progress, arcHeight);
      x = point.x;
      y = point.y;
    }

    if (transition.type === "path") {
      const point = getPathPoint(
        { x: from.x, y: from.y },
        { x: to.x, y: to.y },
        progress,
        transition.pathParams,
      );
      x = point.x;
      y = point.y;
    }
  }

  return {
    ...to,
    x,
    y,
    width: lerp(from.width, to.width, progress),
    height: lerp(from.height, to.height, progress),
    value: to.value,
    displayIndex: to.displayIndex,
    opacity: transition.visibilityTransition || transition.type === "fade"
      ? getFadeOpacity(from.opacity, to.opacity, progress)
      : lerp(from.opacity, to.opacity, progress),
    style: transition.styleTransition ? interpolateStyle(from.style, to.style, progress) : to.style,
  };
}

export function interpolateEntities(
  fromEntities: RenderableEntity[],
  toEntities: RenderableEntity[],
  transition: Transition,
  progress: number,
): RenderableEntity[] {
  const fromMap = new Map(fromEntities.map((entity) => [entity.id, entity]));

  // 构建 swap pair 的「起点覆盖」映射：
  // 对于 pair [idA, idB]，A 应从 B 的目标 x 出发飞向 A 的目标 x，反之亦然
  const swapFromXOverride = new Map<string, number>();
  if (transition.swapEntityIdPairs) {
    for (const [idA, idB] of transition.swapEntityIdPairs) {
      const toA = toEntities.find((e) => e.id === idA);
      const toB = toEntities.find((e) => e.id === idB);
      if (toA && toB) {
        // A 的 from.x 覆盖为 B 的目标 x（让 A 从 B 的位置出发）
        swapFromXOverride.set(idA, toB.x);
        // B 的 from.x 覆盖为 A 的目标 x（让 B 从 A 的位置出发）
        swapFromXOverride.set(idB, toA.x);
      }
    }
  }

  return toEntities.map((toEntity) => {
    const fromEntity = fromMap.get(toEntity.id);
    if (!fromEntity || transition.type === "instant") {
      return { ...toEntity };
    }

    // 如果是 swap pair 成员，覆盖 from.x 为对方的目标 x
    const overrideX = swapFromXOverride.get(toEntity.id);
    const effectiveFrom = overrideX !== undefined
      ? { ...fromEntity, x: overrideX }
      : fromEntity;

    return interpolateEntity(effectiveFrom, toEntity, transition, progress);
  });
}
```

- [ ] **Step 2: 确认 TypeScript 无报错**

```bash
npx vue-tsc --noEmit
```

---

### Task 5：桶内柱宽放宽（问题 5）

**Files:**
- Modify: `src/utils/timeline-builders/build-bucket-timeline.ts`

- [ ] **Step 1: 修改 `bucketEntities` 中的 barWidth / barGap 计算**

找到约第 248-251 行的 barGap / barWidth 计算，替换为：

```typescript
const barGap = bucket.length > 1
  ? Math.max(2, Math.min(8, Math.floor((innerWidth - bucket.length * 10) / (bucket.length - 1 || 1))))
  : 0;
const barWidth = bucket.length > 0
  ? Math.max(10, Math.min(36, Math.floor((innerWidth - barGap * Math.max(bucket.length - 1, 0)) / bucket.length)))
  : 12;
```

关键变化：`barWidth` 上限 20 → 36，`barGap` 上限 6 → 8，`barWidth` 下限 6 → 10。

- [ ] **Step 2: 确认 TypeScript 无报错**

```bash
npx vue-tsc --noEmit
```

---

### Task 6：修复 scatter 飞行动画 — 柱子本体飞入桶（问题 6）

**Files:**
- Modify: `src/utils/timeline-builders/build-bucket-timeline.ts`

**背景：** 当前 ghost entity 使用半透明青色 `GHOST_BASE_STYLE`，且主数组 source bar 在 `from` 帧仍然可见（opacity 1）。目标：source bar 立刻消失（opacity 0），ghost 以主数组 bar 的真实样式从原位飞到桶内目标位置，落地后消失（opacity 0，桶内真实 bar 接替）。

- [ ] **Step 1: 修改 `createBucketFrame` 中 `bucket-scatter` 的 ghost 逻辑**

找到约第 291-312 行的 `bucket-scatter` ghost 块：

```typescript
if (semantic?.type === "bucket-scatter") {
  const [sourceIndex] = semantic.indices;
  const bucketIndex = semantic.bucketIndex;
  const bucketPos = semantic.bucketPos;
  const source = typeof sourceIndex === "number" ? mainEntities[sourceIndex] : null;
  const target = typeof bucketIndex === "number" && typeof bucketPos === "number"
    ? bucketEntities.find((entity) => entity.id === `bucket-${bucketIndex}-${bucketPos}`)
    : null;

  if (source && target) {
    ghostEntities.push({
      ...(frameRole === "from" ? source : target),
      id: `ghost-scatter-${stepIndex}`,
      sourceId: source.sourceId,
      kind: "ghost-bar",
      opacity: frameRole === "from" ? 0.95 : 0.35,
      zIndex: 3,
      style: GHOST_BASE_STYLE,
      stateTags: [],
    });
  }
}
```

替换为：

```typescript
if (semantic?.type === "bucket-scatter") {
  const [sourceIndex] = semantic.indices;
  const bucketIndex = semantic.bucketIndex;
  const bucketPos = semantic.bucketPos;
  const source = typeof sourceIndex === "number" ? mainEntities[sourceIndex] : null;
  const target = typeof bucketIndex === "number" && typeof bucketPos === "number"
    ? bucketEntities.find((entity) => entity.id === `bucket-${bucketIndex}-${bucketPos}`)
    : null;

  if (source && target) {
    // from 帧：ghost 从主数组位置出发，使用真实主数组样式，opacity 1
    // to 帧：ghost 到达桶内位置后消失，opacity 0（桶内真实 bar 接替显示）
    ghostEntities.push({
      ...(frameRole === "from" ? source : target),
      id: `ghost-scatter-${stepIndex}`,
      sourceId: source.sourceId,
      kind: "main-bar",
      opacity: frameRole === "from" ? 1 : 0,
      zIndex: 3,
      style: source.style,
      stateTags: [],
    });

    // source bar 在 from 帧立刻隐藏（柱子已被"拿走"）
    if (frameRole === "from" && typeof sourceIndex === "number") {
      const idx = mainEntities.findIndex((e) => e.id === `main-${sourceIndex}`);
      if (idx !== -1) {
        mainEntities[idx] = { ...mainEntities[idx], opacity: 0 };
      }
    }
  }
}
```

- [ ] **Step 2: 将 scatter 的 `curveHeight` 从 40 提高到 70**

找到 `buildBucketTimeline` 中 transition 的 `pathParams`（约第 477 行）：
```typescript
pathParams: { mode: semantic.type === "bucket-gather" ? "vertical-first" : "horizontal-first", curveHeight: 40 },
```
改为：
```typescript
pathParams: { mode: semantic.type === "bucket-gather" ? "vertical-first" : "horizontal-first", curveHeight: 70 },
```

- [ ] **Step 3: 确认 TypeScript 无报错**

```bash
npx vue-tsc --noEmit
```

---

### Task 7：修复 gather 飞行动画 — 柱子本体飞回主数组（问题 7）

**Files:**
- Modify: `src/utils/timeline-builders/build-bucket-timeline.ts`

**背景：** 与 scatter 对称。桶内第 0 个 bar 立刻消失，ghost 以桶的真实样式从桶内位置飞到主数组目标位置，落地后消失（opacity 0，主数组 sorted bar 接替）。

- [ ] **Step 1: 修改 `createBucketFrame` 中 `bucket-gather` 的 ghost 逻辑**

找到约第 314-334 行的 `bucket-gather` ghost 块：

```typescript
if (semantic?.type === "bucket-gather") {
  const [destIndex] = semantic.indices;
  const bucketIndex = semantic.bucketIndex;
  const source = typeof bucketIndex === "number"
    ? bucketEntities.find((entity) => entity.id === `bucket-${bucketIndex}-0`)
    : null;
  const target = typeof destIndex === "number" ? mainEntities[destIndex] : null;

  if (source && target) {
    ghostEntities.push({
      ...(frameRole === "from" ? source : target),
      id: `ghost-gather-${stepIndex}`,
      sourceId: source.sourceId,
      kind: "ghost-bar",
      opacity: frameRole === "from" ? 0.95 : 0.35,
      zIndex: 3,
      style: GHOST_BASE_STYLE,
      stateTags: [],
    });
  }
}
```

替换为：

```typescript
if (semantic?.type === "bucket-gather") {
  const [destIndex] = semantic.indices;
  const bucketIndex = semantic.bucketIndex;
  const source = typeof bucketIndex === "number"
    ? bucketEntities.find((entity) => entity.id === `bucket-${bucketIndex}-0`)
    : null;
  const target = typeof destIndex === "number" ? mainEntities[destIndex] : null;

  if (source && target) {
    // from 帧：ghost 从桶内位置出发，使用桶的真实样式，opacity 1
    // to 帧：ghost 到达主数组位置后消失，opacity 0（主数组 sorted bar 接替）
    ghostEntities.push({
      ...(frameRole === "from" ? source : target),
      id: `ghost-gather-${stepIndex}`,
      sourceId: source.sourceId,
      kind: "bucket-bar",
      opacity: frameRole === "from" ? 1 : 0,
      zIndex: 3,
      style: source.style,
      stateTags: [],
    });

    // 桶内 source bar（position 0）在 from 帧立刻隐藏
    if (frameRole === "from" && typeof bucketIndex === "number") {
      const idx = bucketEntities.findIndex((e) => e.id === `bucket-${bucketIndex}-0`);
      if (idx !== -1) {
        bucketEntities[idx] = { ...bucketEntities[idx], opacity: 0 };
      }
    }
  }
}
```

- [ ] **Step 2: 确认 TypeScript 无报错**

```bash
npx vue-tsc --noEmit
```

- [ ] **Step 3: 清理不再使用的 `GHOST_BASE_STYLE` 常量**

如果 `GHOST_BASE_STYLE` 在文件其他位置没有引用，删除第 7 行：
```typescript
// 删除
const GHOST_BASE_STYLE = { fill: "rgba(78, 205, 196, 0.25)", stroke: "rgba(78, 205, 196, 0.55)", text: "#9ff3ea", dashed: true, alpha: 0.8 };
```

---

## 自检结果

- [x] **Spec 覆盖：** 问题 1→Task 3，问题 2→Task 1+2，问题 3→Task 2，问题 4→Task 4，问题 5→Task 5，问题 6→Task 6，问题 7→Task 7。全覆盖。
- [x] **Placeholder 扫描：** 无 TBD/TODO。
- [x] **类型一致性：** `globalMaxValue: number` 贯穿 Task 3 所有步骤；`swapFromXOverride` 仅在 Task 4 内部使用；ghost 的 `kind` 改为 `"main-bar"` / `"bucket-bar"` 均是 `EntityKind` 的合法值。
- [x] **注意：** Task 6/7 中直接 mutate 了 `mainEntities` / `bucketEntities` 数组元素——这两个数组在 `createBucketFrame` 中是局部变量，不会影响外部状态，安全。
