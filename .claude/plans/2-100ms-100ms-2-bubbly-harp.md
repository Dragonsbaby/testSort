# 计划：初始帧独立化 + 防抖懒计算

## Context

**问题1：** `reset()` 渲染 `timelineSteps[0].from`，该帧已带排序语义（快排 pivot 紫色、merge 分组色等），导致初始画面不干净。

**问题2：** 调整 arraySize 时，`watch(originalArray, rebuild)` 立即执行完整排序计算（`sortFn` + `buildTimeline`），即使用户还在拖动 slider，造成不必要的重复计算。

**期望行为：**
1. `originalArray` 变化时 → 立即渲染**纯初始帧**（无排序语义），清空旧 timeline，禁用播放/步进
2. 100ms 防抖静止后 → 执行 `sortFn` + `buildTimeline`，完成后启用播放/步进
3. `reset()` 渲染独立初始帧，不依赖 `timelineSteps[0].from`
4. 桶排序初始帧的桶数量直接用 `calcBucketCount(n)` 计算，与排序过程彻底分离

---

## 关键文件

- `src/composables/useSortAnimation.ts` — 主要改动：rebuild 拆分、防抖、isReady 状态
- `src/utils/timeline-builders/build-basic-timeline.ts` — 新增 `buildBasicInitialFrame`
- `src/utils/timeline-builders/build-merge-timeline.ts` — 新增 `buildMergeInitialFrame`
- `src/utils/timeline-builders/build-bucket-timeline.ts` — 新增 `buildBucketInitialFrame`
- `src/utils/timeline-builders/build-heap-timeline.ts` — 新增 `buildHeapInitialFrame`
- `src/types/sorting.ts` — 复用已有的 `calcBucketCount(n)` 函数
- 各算法组件（QuickSort.vue 等）— 消费 `isReady` 禁用按钮

---

## 实施步骤

### Step 1：各 timeline builder 新增 `buildXxxInitialFrame`

每个 builder 文件新增一个导出函数，只构建纯初始帧，不依赖 SemanticStep。

**build-basic-timeline.ts** — 复用已有 `createBasicFrame`，传空 stateTagsByIndex：
```ts
export function buildBasicInitialFrame(params: {
  algorithm: BasicAlgorithm;
  originalValues: number[];
  displayIndexes: number[];
  width: number;
  height: number;
}): FrameState {
  return createBasicFrame(
    params.algorithm, params.originalValues, params.displayIndexes,
    params.width, params.height, 0, "初始状态", new Map()
  );
}
```

**build-merge-timeline.ts** — 复用已有 `createMergeFrame`，bufferValues 全 null，所有集合为空：
```ts
export function buildMergeInitialFrame(params: {
  originalValues: number[];
  displayIndexes: number[];
  width: number;
  height: number;
}): FrameState {
  return createMergeFrame({
    values: params.originalValues,
    mainDisplayIndexes: params.displayIndexes,
    bufferValues: new Array(params.originalValues.length).fill(null),
    width: params.width,
    height: params.height,
    stepIndex: 0,
    description: "初始状态",
    mainStateTags: new Map(),
    bufferStateTags: new Map(),
    hiddenMainIndices: new Set(),
    hiddenBufferIndices: new Set(),
    role: "static",
  });
}
```

**build-bucket-timeline.ts** — 桶数量直接用 `calcBucketCount(n)`，与排序过程彻底分离：
```ts
export function buildBucketInitialFrame(params: {
  originalValues: number[];
  displayIndexes: number[];
  width: number;
  height: number;
}): FrameState {
  const bucketCount = calcBucketCount(params.originalValues.length);
  return createBucketFrame({
    mainValues: params.originalValues,
    mainDisplayIndexes: params.displayIndexes,
    buckets: Array.from({ length: bucketCount }, () => []),
    bucketDisplayIndexes: Array.from({ length: bucketCount }, () => []),
    width: params.width,
    height: params.height,
    stepIndex: 0,
    description: "初始状态",
    mainStateTags: new Map(),
    bucketStateTags: new Map(),
    scatteredIndices: new Set(),
    role: "static",
  });
}
```

**build-heap-timeline.ts** — 复用已有 `createHeapFrame`：
```ts
export function buildHeapInitialFrame(params: {
  originalValues: number[];
  displayIndexes: number[];
  width: number;
  height: number;
  isMinHeap: boolean;
}): FrameState {
  return createHeapFrame({
    values: params.originalValues,
    displayIndexes: params.displayIndexes,
    width: params.width,
    height: params.height,
    stepIndex: 0,
    description: "初始状态",
    stateTagsByIndex: new Map(),
    isMinHeap: params.isMinHeap,
  });
}
```

---

### Step 2：修改 `useSortAnimation.ts`

**新增状态：**
```ts
const isReady = ref(false);
const initialFrame = ref<FrameState | null>(null);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
```

**新增内部辅助函数 `buildInitialFrameForAlgorithm`：**
```ts
function buildInitialFrameForAlgorithm(values: number[], displayIndexes: number[]): FrameState {
  if (algorithm === "merge")
    return buildMergeInitialFrame({ originalValues: values, displayIndexes, width: currentCanvasWidth.value, height: currentCanvasHeight.value });
  if (algorithm === "bucket")
    return buildBucketInitialFrame({ originalValues: values, displayIndexes, width: currentCanvasWidth.value, height: currentCanvasHeight.value });
  if (algorithm === "heap")
    return buildHeapInitialFrame({ originalValues: values, displayIndexes, width: currentCanvasWidth.value, height: 48 + Math.max(1, Math.floor(Math.log2(Math.max(values.length, 1))) + 1) * 90 + 88, isMinHeap: heapMode?.value === "min" });
  return buildBasicInitialFrame({ algorithm: algorithm as BasicAlgorithm, originalValues: values, displayIndexes, width: currentCanvasWidth.value, height: 320 });
}
```

**将原 `rebuild()` 拆为两个函数：**
```ts
// 阶段1：立即执行，只构建初始帧并渲染
function buildInitial() {
  const current = originalArray.value;
  const values = current.map((item) => item.value);
  const displayIndexes = current.map((item) => item.displayIndex);
  array.value = [...current];
  semanticSteps.value = [];
  timelineSteps.value = [];
  comparisons.value = 0;
  swaps.value = 0;
  isReady.value = false;
  const frame = buildInitialFrameForAlgorithm(values, displayIndexes);
  initialFrame.value = frame;
  canvasRef.value?.renderFrame(frame);
}

// 阶段2：防抖后执行，完整计算 timeline
function buildTimeline() {
  const current = originalArray.value;
  const values = current.map((item) => item.value);
  const displayIndexes = current.map((item) => item.displayIndex);
  semanticSteps.value = sortFn(values);
  timelineSteps.value = buildTimelineForAlgorithm(values, displayIndexes);
  isReady.value = true;
  player.reset();
  // player.reset() 会触发 currentFrame watch → renderFrame(timelineSteps[0].from)
  // 需要重新渲染 initialFrame 覆盖，保持初始画面干净
  if (initialFrame.value) canvasRef.value?.renderFrame(initialFrame.value);
}

// 原 rebuild 替换为防抖版本
function rebuild() {
  buildInitial();
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(buildTimeline, 100);
}
```

**新增内部辅助函数 `buildTimelineForAlgorithm`**（将原 rebuild 中的 timeline builder 分支提取出来）：
```ts
function buildTimelineForAlgorithm(values: number[], displayIndexes: number[]): TimelineStep[] {
  if (algorithm === "merge") return buildMergeTimeline({ steps: semanticSteps.value, originalValues: values, displayIndexes, width: currentCanvasWidth.value, height: currentCanvasHeight.value, stepDuration: speed.value });
  if (algorithm === "bucket") return buildBucketTimeline({ steps: semanticSteps.value, originalValues: values, displayIndexes, width: currentCanvasWidth.value, height: currentCanvasHeight.value, stepDuration: speed.value });
  if (algorithm === "heap") return buildHeapTimeline({ steps: semanticSteps.value, originalValues: values, displayIndexes, width: currentCanvasWidth.value, height: 48 + Math.max(1, Math.floor(Math.log2(Math.max(values.length, 1))) + 1) * 90 + 88, stepDuration: speed.value, isMinHeap: heapMode?.value === "min" });
  return buildBasicTimeline({ algorithm: algorithm as BasicAlgorithm, steps: semanticSteps.value, originalValues: values, displayIndexes, width: currentCanvasWidth.value, height: 320, stepDuration: speed.value });
}
```

**修改 `reset()`：**
```ts
function reset() {
  player.reset();
  comparisons.value = 0;
  swaps.value = 0;
  array.value = [...originalArray.value];
  if (initialFrame.value) canvasRef.value?.renderFrame(initialFrame.value);
}
```

**新增 `onUnmounted` 清理防抖：**
```ts
import { onUnmounted } from "vue";
// ...
onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
});
```

**`useSortAnimation` 返回值新增 `isReady`：**
```ts
return {
  // ...现有返回值...
  isReady,
};
```

---

### Step 3：各算法组件消费 `isReady`

以 QuickSort.vue 为例，其他组件同理：
```ts
const { ..., isReady } = useSortAnimation({ ... });
```
模板中播放/步进按钮加 `:disabled="!isReady"`。

---

## 注意事项

1. **`player.reset()` 的副作用**：`player.reset()` 将 `currentStepIndex` 置 0，触发 `watch(currentFrame)` → `renderFrame(timelineSteps[0].from)`，该帧带排序语义。`buildTimeline` 完成后需立即重渲染 `initialFrame` 覆盖。

2. **`canvasRef` 在 `buildTimeline` 执行时可能为 null**：`buildTimeline` 在 setTimeout 回调中执行，canvas 组件应已挂载，但需保留 `canvasRef.value?.` 的可选链防御。

3. **组件卸载时清理防抖**：`onUnmounted` 中 `clearTimeout(debounceTimer)`，避免组件卸载后回调仍执行。

---

## 验证方式

1. 拖动 size slider → 画布立即更新元素数量，所有元素默认蓝色，无高亮，桶排序显示正确桶数的空桶框架
2. 拖动过程中播放/步进按钮处于禁用状态
3. 停止拖动 100ms 后，按钮恢复可用
4. 点击重置 → 画面回到纯初始帧（无高亮）
5. 快排：初始画面无紫色 pivot
6. 归并：初始画面无分组颜色
7. 桶排序：初始帧桶数 = `calcBucketCount(n)`，与 timeline 计算结果一致
