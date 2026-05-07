# 桶排序 Canvas 三处视觉 Bug 修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复桶排序可视化中的三个视觉 Bug：桶内柱子越界、交换动画跳跃（应为平移）、主数组区过矮且画布高度硬编码不同步。

**Architecture:** 三处修复相互独立，分三个 Task 按顺序实施。Task 1 修复桶内柱子高度计算和水平越界保护；Task 2 修复 swap 动画从 arc 跳跃改为 linear 平移对穿；Task 3 打通高度响应式链路（`SortBarCanvasBucket` → `BucketSort` → `useSortAnimation` → `buildBucketTimeline`）并调大主数组区比例。每个 Task 都是纯逻辑修改，无新文件，无新依赖。

**Tech Stack:** Vue 3, TypeScript, Canvas 2D

---

## 文件改动速览

| 文件 | Task | 改动内容 |
|---|---|---|
| `src/utils/timeline-builders/build-bucket-timeline.ts` | 1、2 | 桶内高度按桶内最大值缩放；x 越界保护；swap transition 改 linear + swapEntityIdPairs |
| `src/utils/layout/bucket-layout.ts` | 3 | mainHeight 比例 0.30 → 0.42 |
| `src/components/SortBarCanvasBucket.vue` | 3 | emit 同时上报高度；min-height 420→560；Math.max 基准 420→520 |
| `src/components/algorithms/BucketSort.vue` | 3 | 维护 canvasHeightRef，传入 useSortAnimation |
| `src/composables/useSortAnimation.ts` | 3 | 增加 canvasHeight 参数；bucket 分支使用动态高度 |

---

## Task 1：修复桶内柱子越界（高度缩放 + 水平保护）

**Files:**
- Modify: `src/utils/timeline-builders/build-bucket-timeline.ts`（`buildBucketTimeline` 函数入口处 + `createBucketFrame` 函数签名 + `bucketEntities` 构建段）

### 问题背景

当前第 265 行用全局 `maxValue` 做柱子高度缩放：
```ts
height: Math.max(6, Math.round((value / maxValue) * innerHeight)),
```
全局 `maxValue` 可能远大于某桶内最大值，导致柱子高度不合理（含大值的桶溢出桶顶；含小值的桶视觉极矮）。

**修复策略：预计算每桶的历史最终最大值（`bucketFinalMaxMap`），而非用当前帧的动态最大值**，避免动画过程中高度随帧跳变。

`buildBucketTimeline` 在入口处已知所有 `steps`，可以遍历所有 `bucket-scatter` 步骤预先算出每个桶最终会放入的最大值。

水平方向：当桶内元素多、`barWidth` 被压到最小时，累积 x 坐标可能超出桶右边界，加 `xMax` 截断保护。

- [ ] **Step 1：在 `buildBucketTimeline` 函数入口预计算 `bucketFinalMaxMap`**

打开 `d:\home\test-sort\src\utils\timeline-builders\build-bucket-timeline.ts`，找到 `export function buildBucketTimeline` 函数（约第 341 行），在 `const { steps, originalValues, ... } = params;` 解构之后、`let mainValues = ...` 之前，插入以下代码：

```ts
  // 预计算每个桶在整个排序过程中会接收到的最大值
  // 用于 createBucketFrame 中桶内高度归一化，避免当前帧动态最大值导致柱高跳变
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

- [ ] **Step 2：将 `bucketFinalMaxMap` 传入 `createBucketFrame`**

`createBucketFrame` 函数（约第 183 行）通过 `params` 对象接收参数，需要在参数类型和解构处各加一个字段 `bucketFinalMaxMap`。

**① 修改 `createBucketFrame` 的参数类型**（第 183 行附近的 `params:` 类型声明），新增一行：
```ts
  bucketFinalMaxMap?: Map<number, number>;
```

**② 在解构处**（紧接 `activeBucketIndex,` 的下面或同一块内）新增：
```ts
  bucketFinalMaxMap,
```

**③ 在 `buildBucketTimeline` 内所有调用 `createBucketFrame` 的地方**，传入 `bucketFinalMaxMap`，例如：
```ts
  let currentFrame = createBucketFrame({
    mainValues,
    buckets,
    displayIndexes,
    width,
    height,
    stepIndex: 0,
    description: "初始状态",
    mainStateTags: new Map(),
    bucketStateTags: new Map(),
    bucketFinalMaxMap,        // ← 新增
  });
```
以及 `from` 帧和 `to` 帧的 `createBucketFrame` 调用，同样加上 `bucketFinalMaxMap,`。

- [ ] **Step 3：修改 `bucketEntities` 构建段使用 `bucketFinalMaxMap`**

找到 `createBucketFrame` 函数内的 `const bucketEntities: RenderableEntity[] = buckets.flatMap(...)` 代码块（约第 237 行），将整个 `flatMap` 回调替换为：

```ts
  const bucketEntities: RenderableEntity[] = buckets.flatMap((bucket, bucketIndex) => {
    const region = layout.bucketRegions[bucketIndex];
    if (!region) return [];

    // 桶内可用高度（扣除顶部标签区和底部 index 标签）
    const innerHeight = region.height - BUCKET_INNER_PADDING_TOP - BUCKET_INNER_PADDING_BOT;
    const innerWidth = Math.max(region.width - BUCKET_INNER_PADDING_X * 2, 20);
    const barGap = bucket.length > 1 ? Math.max(2, Math.min(6, Math.floor((innerWidth - bucket.length * 10) / (bucket.length - 1 || 1)))) : 0;
    const barWidth = bucket.length > 0
      ? Math.max(6, Math.min(20, Math.floor((innerWidth - barGap * Math.max(bucket.length - 1, 0)) / bucket.length)))
      : 12;

    // 桶内柱子底部基准 Y（从桶底部向上留出 BUCKET_INNER_PADDING_BOT）
    const barBaseY = region.y + region.height - BUCKET_INNER_PADDING_BOT;

    // 用该桶历史最终最大值归一化，保证高度稳定不随帧跳变；无预计算值时回退到全局 maxValue
    const bucketMax = bucketFinalMaxMap?.get(bucketIndex) ?? maxValue;

    // 水平越界上限，防止柱子画出桶右边界
    const xMax = region.x + region.width - BUCKET_INNER_PADDING_X - barWidth;

    const bucketBaseStyle = getBucketBarStyle(bucketIndex);

    return bucket.map((value, position) => {
      const stateTags = bucketStateTags.get(`${bucketIndex}-${position}`) ?? [];
      return {
        id: `bucket-${bucketIndex}-${position}`,
        sourceId: `bucket-${bucketIndex}-${value}-${position}`,
        kind: "bucket-bar",
        value,
        displayIndex: position + 1,
        // x 坐标不超过 xMax，防止水平溢出
        x: Math.min(region.x + BUCKET_INNER_PADDING_X + position * (barWidth + barGap), xMax),
        y: barBaseY,
        width: barWidth,
        // 高度基于桶的历史最终最大值缩放，动画过程中高度稳定
        height: Math.max(6, Math.round((value / bucketMax) * innerHeight)),
        opacity: 1,
        zIndex: 2,
        style: getStyleFromStateTags(stateTags, bucketBaseStyle),
        stateTags,
      } satisfies RenderableEntity;
    });
  });
```

- [ ] **Step 4：目视检查整条链路**

确认：
1. `bucketFinalMaxMap` 在 `buildBucketTimeline` 入口处由遍历 `steps` 得出
2. `createBucketFrame` 参数类型新增了 `bucketFinalMaxMap?: Map<number, number>`
3. 所有 `createBucketFrame(...)` 调用都传入了 `bucketFinalMaxMap`
4. `bucketEntities` 中 `height` 使用 `bucketMax`（来自 `bucketFinalMaxMap?.get(bucketIndex) ?? maxValue`）
5. `x` 使用 `Math.min(..., xMax)` 包裹

---

## Task 2：修复桶内 swap 动画（arc 跳跃 → linear 平移对穿）

**Files:**
- Modify: `src/utils/timeline-builders/build-bucket-timeline.ts`（第 428-460 行，transition 构建段）

### 问题背景

当前 `bucket-swap` 的 transition 配置：
```ts
transition: {
  type: "arc",                            // arc = 弧形路径
  movingEntityIds: [...],                 // 让元素走弧路
  // ❌ 缺少 swapEntityIdPairs
}
```

`interpolate-entity.ts` 中，`swapEntityIdPairs` 决定"A 从 B 的旧位置出发，B 从 A 的旧位置出发"，是真正实现平移对穿的关键。没有它，每个元素只从自身旧位置弧跳到新位置，视觉上是原地跳而非对穿。

修复方向：改为 `type: "linear"` + `swapEntityIdPairs`，移除 `movingEntityIds`（linear 不需要它）。

- [ ] **Step 1：定位并修改 transition 构建段**

打开文件 `src/utils/timeline-builders/build-bucket-timeline.ts`，找到约第 428 行的 `movingEntityIds` 和 `isSwap` 变量定义，以及紧随其后的 `return { ... transition: { ... } }` 代码块。

将 `movingEntityIds` 定义和 `return` 块内的 `transition` 字段替换为：

```ts
    const movingEntityIds = semantic.type === "bucket-scatter"
      ? [`ghost-scatter-${index}`]
      : semantic.type === "bucket-gather"
        ? [`ghost-gather-${index}`]
        : undefined;
    const swapDuration = stepDuration * 3;
    const isSwap = semantic.type === "bucket-swap";

    // ✅ 修复：swap 时构建 swapEntityIdPairs，实现 A↔B 交叉起点平移
    const swapEntityIdPairs: [string, string][] | undefined = isSwap && semantic.indices.length >= 2
      ? [[
          `bucket-${semantic.bucketIndex}-${semantic.indices[0]}`,
          `bucket-${semantic.bucketIndex}-${semantic.indices[1]}`,
        ]]
      : undefined;

    return {
      id: `bucket-${index + 1}`,
      kind: semantic.type,
      description: semantic.description,
      duration: isSwap ? swapDuration : stepDuration,
      from,
      to,
      transition: {
        // ✅ 修复：swap 改用 linear 平移（不再是 arc 弧跳）
        type: semantic.type === "bucket-scatter" || semantic.type === "bucket-gather" ? "arc" : isSwap ? "linear" : "instant",
        duration: isSwap ? swapDuration : stepDuration,
        easing: semantic.type === "bucket-scatter" || semantic.type === "bucket-gather" || isSwap ? "easeInOutCubic" : "linear",
        // ✅ 修复：swap 不再使用 movingEntityIds（linear 模式通过 swapEntityIdPairs 驱动）
        movingEntityIds: isSwap ? undefined : movingEntityIds,
        pathParams: { mode: semantic.type === "bucket-gather" ? "vertical-first" : "horizontal-first", curveHeight: 40 },
        styleTransition: true,
        // ✅ 修复：swap 添加 swapEntityIdPairs，触发交叉起点插值
        swapEntityIdPairs,
      },
      statsDelta: {
        comparisons: semantic.type === "bucket-compare" ? 1 : 0,
        swaps: semantic.type === "bucket-swap" ? 1 : 0,
      },
      semanticRef: semantic,
    };
```

- [ ] **Step 2：目视检查修改正确性**

确认以下三点：
1. `swapEntityIdPairs` 仅在 `isSwap === true` 时为非 `undefined`
2. `transition.type` 对于 `isSwap` 分支是 `"linear"`
3. `transition.movingEntityIds` 对于 `isSwap` 分支是 `undefined`

---

## Task 3：修复画布高度硬编码 + 主数组区比例

**Files:**
- Modify: `src/utils/layout/bucket-layout.ts`（第 27 行）
- Modify: `src/components/SortBarCanvasBucket.vue`（emit 签名、onMounted、ResizeObserver、样式）
- Modify: `src/components/algorithms/BucketSort.vue`（增加 canvasHeightRef）
- Modify: `src/composables/useSortAnimation.ts`（增加 canvasHeight 参数）

### 问题背景

`useSortAnimation.ts` 传给 `buildBucketTimeline` 的 `height: 460` 是硬编码，但 `SortBarCanvasBucket.vue` canvas 实际高度是 `Math.max(420, containerHeight - 40)`，两者不同步，导致所有 y 坐标基于错误的 460 计算。

此外 `bucket-layout.ts` 中主数组区只占总高 30%（460px 时仅 138px），元素较多时极矮。

修复链：`SortBarCanvasBucket` 上报高度 → `BucketSort` 接收 → `useSortAnimation` 使用动态高度。

### Step 1：修改 `bucket-layout.ts` — 主数组区比例

- [ ] **Step 1：修改 `bucket-layout.ts` 第 27 行**

打开 `src/utils/layout/bucket-layout.ts`，将：
```ts
const mainHeight = Math.round(height * 0.30);
```
改为：
```ts
const mainHeight = Math.round(height * 0.42);
```

> 42% 保证主数组区在 520px 高度下约 218px，在 560px 下约 235px，元素较多时也有足够展示空间。

### Step 2：修改 `SortBarCanvasBucket.vue` — 上报高度 + 调大最小高度

- [ ] **Step 2：修改 `SortBarCanvasBucket.vue` 的 emit 签名和上报逻辑**

打开 `src/components/SortBarCanvasBucket.vue`。

**① 修改 emit 签名**（第 13 行），从只上报宽度改为上报对象：
```ts
const emit = defineEmits<{ (e: "canvas-ready", payload: { width: number; height: number }): void }>();
```

**② 修改 `onMounted` 回调**（第 22-27 行）：
```ts
onMounted(() => {
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect();
    const actualHeight = Math.max(520, rect.height - 40);
    emit("canvas-ready", { width: rect.width - 40, height: actualHeight });
    initialize(rect.width - 40, actualHeight);
    startRenderLoop();
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const h = Math.max(520, height - 40);
        emit("canvas-ready", { width: width - 40, height: h });
        resize(width - 40, h);
      }
    });
    resizeObserver.observe(containerRef.value);
  }
});
```

**③ 修改 `.sort-bar-canvas` 的 `min-height`**（style 块）：
```scss
.sort-bar-canvas {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 560px;   /* 原 420px → 560px */
  position: relative;
  padding: 20px 20px 0 20px;
  box-shadow: inset 0 0 60px rgba(78, 205, 196, 0.04);
}
```

### Step 3：修改 `BucketSort.vue` — 接收高度

- [ ] **Step 3：修改 `BucketSort.vue`，增加 `canvasHeightRef` 并传入 `useSortAnimation`**

打开 `src/components/algorithms/BucketSort.vue`。

将 `canvasWidthRef` 定义和 `useSortAnimation` 调用改为：

```ts
const canvasWidthRef = ref(760);
const canvasHeightRef = ref(520);   // ✅ 新增

const {
  array, steps, currentStep, comparisons, swaps,
  currentStepInfo, isPlaying, play, pause, step: stepOnce,
  reset, statusText, statusClass,
} = useSortAnimation({
  sortFn: bucketSort,
  speed: toRef(props, "speed"),
  canvasRef,
  canvasWidth: canvasWidthRef,
  canvasHeight: canvasHeightRef,   // ✅ 新增
  originalArray: toRef(store, "originalArray"),
  algorithm: "bucket",
});
```

同时修改 template 中的 `@canvas-ready` 事件处理：

```html
<!-- 原来 -->
@canvas-ready="canvasWidthRef = $event"

<!-- 改为 -->
@canvas-ready="canvasWidthRef = $event.width; canvasHeightRef = $event.height"
```

### Step 4：修改 `useSortAnimation.ts` — 增加 canvasHeight 参数

- [ ] **Step 4：修改 `useSortAnimation.ts`，增加 `canvasHeight` 可选参数，bucket 分支使用动态高度**

打开 `src/composables/useSortAnimation.ts`。

**① 修改函数参数类型**（第 25-33 行的 params 类型）：
```ts
export function useSortAnimation(params: {
  sortFn: SortFn;
  speed: ToRef<number>;
  canvasRef: Ref<ISortCanvas | null>;
  canvasWidth?: ToRef<number>;
  canvasHeight?: ToRef<number>;   // ✅ 新增
  originalArray: ToRef<ArrayElement[]>;
  algorithm: SortAnimationAlgorithm;
  heapMode?: ToRef<"max" | "min">;
}) {
```

**② 解构时增加 `canvasHeight`**（第 34 行）：
```ts
const { sortFn, speed, canvasRef, canvasWidth, canvasHeight, originalArray, algorithm, heapMode } = params;
```

**③ 增加 `currentCanvasHeight` computed**（紧接 `currentCanvasWidth` 后）：
```ts
const currentCanvasWidth = computed(() => canvasWidth?.value ?? 760);
const currentCanvasHeight = computed(() => canvasHeight?.value ?? 460);  // ✅ 新增
```

**④ 修改 `rebuild` 函数中 bucket 分支**（第 60-68 行）：
```ts
: algorithm === "bucket"
  ? buildBucketTimeline({
      steps: semanticSteps.value,
      originalValues: values,
      displayIndexes,
      width: currentCanvasWidth.value,
      height: currentCanvasHeight.value,   // ✅ 改为动态高度
      stepDuration: speed.value,
    })
```

**⑤ 在 `watch` 列表末尾增加对 `canvasHeight` 的监听**（在已有的 `currentCanvasWidth` watch 之后）：
```ts
watch(
  () => currentCanvasHeight.value,
  () => rebuild(),
);
```

- [ ] **Step 5：目视检查整条链路**

从上到下确认以下路径：
1. `SortBarCanvasBucket.vue` emit 发出 `{ width, height }`
2. `BucketSort.vue` template 中 `@canvas-ready` 同时更新 `canvasWidthRef` 和 `canvasHeightRef`
3. `useSortAnimation` 的 `currentCanvasHeight` computed 读取 `canvasHeight?.value`
4. `buildBucketTimeline` 收到的 `height` 是动态值而非 460

---

## 验证清单

完成三个 Task 后，在浏览器中打开桶排序页面，执行以下检查：

- [ ] **验证1（Task 1）**：运行 10 个元素的桶排序。观察每个桶内柱子是否都在桶框内，各桶的最高柱应接近（但不超过）桶内可用高度顶端。
- [ ] **验证2（Task 2）**：步进到 `bucket-swap` 步骤（当前操作显示"桶 N 内排序：比较 X 与 Y"并触发实际交换时）。观察两根柱子是否做直线水平平移对穿，而非弧形跳跃。
- [ ] **验证3（Task 3）**：主数组区柱子高度明显增高（不再极矮）。调整浏览器窗口高度，确认画布高度响应式变化，不同窗口高度下主数组区比例保持一致。
