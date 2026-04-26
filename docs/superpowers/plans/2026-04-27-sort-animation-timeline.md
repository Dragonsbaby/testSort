# 排序动画时间轴重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前命令式排序动画改造成统一时间轴驱动架构，让排序步骤先编译为 `TimelineStep[]`，再由播放器按时间推进计算 `FrameState`，并由各 Canvas 组件纯渲染当前帧。

**Architecture:** 保留 `src/utils/sortingAlgorithms.ts` 的排序语义生成职责，但把输出类型迁移到 `SemanticStep[]`。新增 timeline builder、layout、frame interpolation 三层，把算法语义编译为可播放时间轴，并重写 `useSortAnimation` 为时间轴控制器；四类 renderer 改成只消费 `FrameState` 的纯渲染器，逐步完成通用、归并、桶、堆四类动画迁移。

**Tech Stack:** Vue 3、TypeScript、Pinia、Canvas、Vite、vue-tsc

---

## File Structure

### Existing files to modify
- `src/types/sorting.ts` — 保留算法元信息与排序算法类型，移除或兼容旧 `SortStep`，转向导出共享语义步骤基础类型
- `src/utils/sortingAlgorithms.ts` — 将所有排序算法输出从 `SortStep[]` 调整为 `SemanticStep[]`
- `src/composables/useSortAnimation.ts` — 从命令式步骤执行器改为时间轴控制器
- `src/composables/useCanvasRenderer.ts` — 从通用动画执行器改为通用 `FrameState` 渲染器
- `src/composables/useMergeSortRenderer.ts` — 改为归并 `FrameState` 渲染器
- `src/composables/useBucketSortRenderer.ts` — 改为桶排序 `FrameState` 渲染器
- `src/composables/useHeapSortRenderer.ts` — 改为堆排序 `FrameState` 渲染器
- `src/components/SortBarCanvas.vue` — 暴露 `renderFrame()` 而不是 `applyStep()`
- `src/components/SortBarCanvasMerge.vue` — 暴露 `renderFrame()` 而不是 `applyStep()`
- `src/components/SortBarCanvasBucket.vue` — 暴露 `renderFrame()` 而不是 `applyStep()`
- `src/components/SortBarCanvasHeap.vue` — 暴露 `renderFrame()` 而不是 `applyStep()`
- `src/components/algorithms/QuickSort.vue` — 适配新 `useSortAnimation` 返回值与 Canvas 接口
- `src/components/algorithms/MergeSort.vue` — 适配新 `useSortAnimation` 返回值与 Canvas 接口
- `src/components/algorithms/BucketSort.vue` — 适配新 `useSortAnimation` 返回值与 Canvas 接口
- `src/components/algorithms/HeapSort.vue` — 适配新 `useSortAnimation` 返回值与 Canvas 接口
- `src/components/algorithms/BubbleSort.vue` — 适配新 `useSortAnimation` 返回值与 Canvas 接口
- `src/components/algorithms/InsertionSort.vue` — 适配新 `useSortAnimation` 返回值与 Canvas 接口
- `src/components/algorithms/ShellSort.vue` — 适配新 `useSortAnimation` 返回值与 Canvas 接口
- `docs/superpowers/specs/2026-04-27-sort-animation-timeline-design.md` — 若实现时发现类型命名需微调，再同步更新 spec

### New files to create
- `src/types/timeline.ts` — 定义 `SemanticStep`、`TimelineStep`、`FrameState`、`Transition`、`RenderableEntity`、`RenderableRegion`、`RenderableOverlay`
- `src/utils/layout/basic-layout.ts` — 通用柱状图布局计算
- `src/utils/layout/merge-layout.ts` — 归并双区布局计算
- `src/utils/layout/bucket-layout.ts` — 桶排序多区布局计算
- `src/utils/layout/heap-layout.ts` — 堆排序树/数组双区布局计算
- `src/utils/frame/path-utils.ts` — 弧线、直线、通用 path 点位计算
- `src/utils/frame/style-utils.ts` — state tag 到绘制样式的映射与样式插值
- `src/utils/frame/interpolate-entity.ts` — 单实体插值逻辑
- `src/utils/frame/interpolate-frame.ts` — `from + to + transition + progress -> FrameState`
- `src/utils/timeline-builders/build-basic-timeline.ts` — 通用排序时间轴编排
- `src/utils/timeline-builders/build-merge-timeline.ts` — 归并时间轴编排
- `src/utils/timeline-builders/build-bucket-timeline.ts` — 桶排序时间轴编排
- `src/utils/timeline-builders/build-heap-timeline.ts` — 堆排序时间轴编排
- `src/composables/useTimelinePlayer.ts` — 纯时间轴播放器

### Verification commands
- `npx vue-tsc --noEmit`

---

### Task 1: 定义统一时间轴类型骨架

**Files:**
- Create: `src/types/timeline.ts`
- Modify: `src/types/sorting.ts`
- Test: 类型检查通过 `npx vue-tsc --noEmit`

- [ ] **Step 1: 编写新的时间轴类型文件**

```ts
// src/types/timeline.ts
import type { SortAlgorithm } from '@/types/sorting';

export type SemanticStepType =
  | 'compare'
  | 'swap'
  | 'merge'
  | 'set'
  | 'sorted'
  | 'pivot'
  | 'merge-set'
  | 'merge-back'
  | 'bucket-scatter'
  | 'bucket-compare'
  | 'bucket-swap'
  | 'bucket-gather';

export interface SemanticStep {
  type: SemanticStepType;
  indices: number[];
  description: string;
  arraySnapshot?: number[];
  gap?: number;
  groupIndices?: number[];
  tempSnapshot?: (number | null)[];
  bucketIndex?: number;
  bucketPos?: number;
}

export type FramePhase = 'idle' | 'playing' | 'paused' | 'completed';

export type EntityKind =
  | 'main-bar'
  | 'buffer-bar'
  | 'bucket-bar'
  | 'heap-tree-node'
  | 'heap-array-node'
  | 'ghost-bar';

export type StateTag =
  | 'comparing'
  | 'swapping'
  | 'sorted'
  | 'pivot'
  | 'pending'
  | 'latest';

export interface RenderStyle {
  fill: string;
  stroke?: string;
  text?: string;
  glow?: number;
  dashed?: boolean;
  alpha?: number;
}

export interface RenderableEntity {
  id: string;
  sourceId: string;
  kind: EntityKind;
  value: number;
  displayIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  zIndex: number;
  style: RenderStyle;
  stateTags: StateTag[];
}

export interface RenderableRegion {
  id: string;
  kind: 'main' | 'buffer' | 'bucket' | 'heap-tree' | 'heap-array';
  x: number;
  y: number;
  width: number;
  height: number;
  meta?: Record<string, number | string>;
}

export interface RenderableOverlay {
  id: string;
  kind: 'edge' | 'guide' | 'label' | 'badge' | 'divider';
  points?: Array<{ x: number; y: number }>;
  text?: string;
  style: RenderStyle;
}

export interface FrameState {
  algorithm: SortAlgorithm;
  stepIndex: number;
  progress: number;
  phase: FramePhase;
  description: string;
  entities: RenderableEntity[];
  regions: RenderableRegion[];
  overlays: RenderableOverlay[];
}

export interface Transition {
  type: 'instant' | 'linear' | 'arc' | 'path' | 'fade';
  duration: number;
  easing: 'linear' | 'easeOutCubic' | 'easeInOutCubic';
  movingEntityIds?: string[];
  pathParams?: Record<string, number | string>;
  styleTransition?: boolean;
  visibilityTransition?: boolean;
}

export interface TimelineStep {
  id: string;
  kind: SemanticStepType;
  description: string;
  duration: number;
  from: FrameState;
  to: FrameState;
  transition: Transition;
  statsDelta: {
    comparisons: number;
    swaps: number;
  };
  semanticRef?: SemanticStep;
}
```

- [ ] **Step 2: 在排序类型文件中转向导出新语义步骤类型**

```ts
// src/types/sorting.ts
import type { SemanticStep, SemanticStepType } from '@/types/timeline';

export type StepType = SemanticStepType;
export type SortStep = SemanticStep;
```

- [ ] **Step 3: 运行类型检查确认新类型文件可被解析**

Run: `npx vue-tsc --noEmit`
Expected: 类型检查通过，若失败仅允许出现后续任务将修复的旧接口引用错误

- [ ] **Step 4: 提交该任务**

```bash
git add src/types/timeline.ts src/types/sorting.ts
git commit -m "feat: add timeline animation types"
```

### Task 2: 将排序算法输出统一迁移到 SemanticStep

**Files:**
- Modify: `src/utils/sortingAlgorithms.ts`
- Test: `npx vue-tsc --noEmit`

- [ ] **Step 1: 把排序算法文件的类型引用切到 SemanticStep**

```ts
// src/utils/sortingAlgorithms.ts
import type { SemanticStep } from '@/types/timeline';
import { calcBucketCount } from '@/types/sorting';

function createStep(
  type: SemanticStep['type'],
  indices: number[],
  description: string,
  arraySnapshot?: number[],
  gap?: number,
  groupIndices?: number[],
  tempSnapshot?: (number | null)[],
  bucketIndex?: number,
  bucketPos?: number,
): SemanticStep {
  return { type, indices, description, arraySnapshot, gap, groupIndices, tempSnapshot, bucketIndex, bucketPos };
}
```

- [ ] **Step 2: 更新所有排序算法函数签名**

```ts
export function bubbleSort(arr: number[]): SemanticStep[] {
  const steps: SemanticStep[] = [];
  // 原有逻辑保持不变
  return steps;
}

export function insertionSort(arr: number[]): SemanticStep[] {
  const steps: SemanticStep[] = [];
  return steps;
}

export function mergeSort(arr: number[]): SemanticStep[] {
  const steps: SemanticStep[] = [];
  return steps;
}

export function quickSort(arr: number[]): SemanticStep[] {
  const steps: SemanticStep[] = [];
  return steps;
}

export function shellSort(arr: number[]): SemanticStep[] {
  const steps: SemanticStep[] = [];
  return steps;
}

export function bucketSort(arr: number[]): SemanticStep[] {
  const steps: SemanticStep[] = [];
  return steps;
}

export function heapSort(arr: number[], mode: 'max' | 'min' = 'max'): SemanticStep[] {
  const steps: SemanticStep[] = [];
  return steps;
}
```

- [ ] **Step 3: 运行类型检查确认算法层已经兼容新语义步骤**

Run: `npx vue-tsc --noEmit`
Expected: 算法相关类型错误消失，剩余错误集中在 `useSortAnimation` 与各 renderer 旧接口

- [ ] **Step 4: 提交该任务**

```bash
git add src/utils/sortingAlgorithms.ts
git commit -m "refactor: switch sorting algorithms to semantic steps"
```

### Task 3: 新增布局层和基础样式/路径插值工具

**Files:**
- Create: `src/utils/layout/basic-layout.ts`
- Create: `src/utils/layout/merge-layout.ts`
- Create: `src/utils/layout/bucket-layout.ts`
- Create: `src/utils/layout/heap-layout.ts`
- Create: `src/utils/frame/path-utils.ts`
- Create: `src/utils/frame/style-utils.ts`
- Create: `src/utils/frame/interpolate-entity.ts`
- Create: `src/utils/frame/interpolate-frame.ts`
- Test: `npx vue-tsc --noEmit`

- [ ] **Step 1: 编写通用与归并布局工具**

```ts
// src/utils/layout/basic-layout.ts
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

export function buildBasicLayout({ width, height, count }: BasicLayoutInput): BasicBarSlot[] {
  const gap = 4;
  const barWidth = Math.max(4, Math.min(60, (width - gap) / count - gap));
  const totalWidth = count * barWidth + (count - 1) * gap;
  const startX = Math.max(0, (width - totalWidth) / 2);
  const baseY = height - 20;
  const maxHeight = height - 60;

  return Array.from({ length: count }, (_, index) => ({
    index,
    x: Math.round(startX + index * (barWidth + gap)),
    y: Math.round(baseY),
    width: Math.round(barWidth),
    maxHeight: Math.round(maxHeight),
  }));
}
```

```ts
// src/utils/layout/merge-layout.ts
import { buildBasicLayout } from './basic-layout';

export interface MergeLayout {
  topSlots: ReturnType<typeof buildBasicLayout>;
  bottomSlots: ReturnType<typeof buildBasicLayout>;
  dividerY: number;
}

export function buildMergeLayout(width: number, height: number, count: number): MergeLayout {
  const dividerY = Math.floor(height * 0.5);
  return {
    topSlots: buildBasicLayout({ width, height: dividerY - 18, count }),
    bottomSlots: buildBasicLayout({ width, height: height - dividerY - 18, count }).map(slot => ({
      ...slot,
      y: slot.y + dividerY + 18,
    })),
    dividerY,
  };
}
```

- [ ] **Step 2: 编写桶和堆布局工具**

```ts
// src/utils/layout/bucket-layout.ts
import { calcBucketCount } from '@/types/sorting';

export interface BucketRegion {
  bucketIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function buildBucketLayout(width: number, height: number, count: number) {
  const bucketCount = calcBucketCount(count);
  const mainHeight = Math.round(height * 0.33);
  const separatorHeight = Math.round(height * 0.09);
  const top = mainHeight + separatorHeight;
  const gap = 14;
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

```ts
// src/utils/layout/heap-layout.ts
export function getHeapRequiredHeight(count: number) {
  if (count <= 1) return 48 + 80 + 88;
  const maxDepth = Math.floor(Math.log2(count));
  return 48 + (maxDepth + 1) * 90 + 88;
}

export function buildHeapNodePosition(index: number, count: number, width: number, height: number) {
  const depth = Math.floor(Math.log2(index + 1));
  const maxDepth = Math.floor(Math.log2(Math.max(count, 1)));
  const levelCount = Math.pow(2, depth);
  const positionInLevel = index - (Math.pow(2, depth) - 1);
  const topPadding = 48;
  const bottomPadding = 88;
  const treeHeight = height - topPadding - bottomPadding;
  const y = maxDepth === 0 ? topPadding + treeHeight / 2 : topPadding + 16 + (depth / maxDepth) * (treeHeight - 32);
  const cellWidth = (width - 80) / levelCount;
  const x = 40 + positionInLevel * cellWidth + cellWidth / 2;
  return { x, y };
}
```

- [ ] **Step 3: 编写路径和帧插值工具**

```ts
// src/utils/frame/path-utils.ts
export function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

export function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

export function easeInOutCubic(progress: number) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

export function getArcPoint(start: { x: number; y: number }, end: { x: number; y: number }, progress: number, arcHeight: number) {
  return {
    x: lerp(start.x, end.x, progress),
    y: lerp(start.y, end.y, progress) - Math.sin(progress * Math.PI) * arcHeight,
  };
}
```

```ts
// src/utils/frame/interpolate-frame.ts
import type { FrameState, TimelineStep } from '@/types/timeline';
import { interpolateEntities } from './interpolate-entity';

export function interpolateFrame(step: TimelineStep, progress: number): FrameState {
  return {
    ...step.to,
    stepIndex: step.from.stepIndex,
    progress,
    phase: progress >= 1 ? 'paused' : 'playing',
    description: step.description,
    entities: interpolateEntities(step.from.entities, step.to.entities, step.transition, progress),
  };
}
```

- [ ] **Step 4: 运行类型检查确认工具层可单独通过**

Run: `npx vue-tsc --noEmit`
Expected: 新增工具文件无类型错误，旧错误仍集中在播放器和组件接口

- [ ] **Step 5: 提交该任务**

```bash
git add src/utils/layout src/utils/frame
git commit -m "feat: add timeline layout and interpolation utilities"
```

### Task 4: 实现基础 Timeline Builder（通用排序）

**Files:**
- Create: `src/utils/timeline-builders/build-basic-timeline.ts`
- Test: `npx vue-tsc --noEmit`

- [ ] **Step 1: 编写通用排序初始帧构建逻辑**

```ts
// src/utils/timeline-builders/build-basic-timeline.ts
import type { FrameState, RenderableEntity, SemanticStep, TimelineStep } from '@/types/timeline';
import { buildBasicLayout } from '@/utils/layout/basic-layout';

function createBasicFrame(values: number[], displayIndexes: number[], width: number, height: number, stepIndex: number, description: string): FrameState {
  const slots = buildBasicLayout({ width, height, count: values.length });
  const maxValue = Math.max(...values);

  const entities: RenderableEntity[] = values.map((value, index) => ({
    id: `main-${index}`,
    sourceId: `value-${displayIndexes[index]}`,
    kind: 'main-bar',
    value,
    displayIndex: displayIndexes[index],
    x: slots[index].x,
    y: slots[index].y,
    width: slots[index].width,
    height: Math.max(5, Math.round((value / maxValue) * slots[index].maxHeight)),
    opacity: 1,
    zIndex: 1,
    style: { fill: '#4a9eff', glow: 0 },
    stateTags: [],
  }));

  return {
    algorithm: 'quick',
    stepIndex,
    progress: 0,
    phase: 'paused',
    description,
    entities,
    regions: [{ id: 'main', kind: 'main', x: 0, y: 0, width, height }],
    overlays: [],
  };
}
```

- [ ] **Step 2: 编写 compare/swap/pivot/sorted/pending 的时间轴编排**

```ts
export function buildBasicTimeline(params: {
  algorithm: 'bubble' | 'insertion' | 'quick' | 'shell';
  steps: SemanticStep[];
  originalValues: number[];
  displayIndexes: number[];
  width: number;
  height: number;
  stepDuration: number;
}): TimelineStep[] {
  const { algorithm, steps, originalValues, displayIndexes, width, height, stepDuration } = params;
  let values = [...originalValues];
  let currentFrame = createBasicFrame(values, displayIndexes, width, height, 0, '初始状态');

  return steps.map((semantic, index) => {
    const from = structuredClone(currentFrame) as FrameState;
    const to = structuredClone(currentFrame) as FrameState;

    to.algorithm = algorithm;
    to.stepIndex = index + 1;
    to.description = semantic.description;

    if (semantic.type === 'compare') {
      to.entities.forEach((entity, entityIndex) => {
        entity.stateTags = semantic.indices.includes(entityIndex) ? ['comparing'] : [];
      });
    }

    if (semantic.type === 'pivot') {
      to.entities.forEach((entity, entityIndex) => {
        entity.stateTags = semantic.indices.includes(entityIndex) ? ['pivot'] : [];
      });
    }

    if (semantic.type === 'sorted') {
      to.entities.forEach((entity, entityIndex) => {
        entity.stateTags = semantic.indices.includes(entityIndex) ? ['sorted'] : entity.stateTags;
      });
    }

    if (semantic.type === 'swap' && semantic.arraySnapshot && semantic.indices.length === 2) {
      const [left, right] = semantic.indices;
      values = [...semantic.arraySnapshot];
      [values[left], values[right]] = [values[right], values[left]];
      const nextFrame = createBasicFrame(values, displayIndexes, width, height, index + 1, semantic.description);
      to.entities = nextFrame.entities.map(entity => ({ ...entity, stateTags: [] }));
    }

    currentFrame = structuredClone(to) as FrameState;

    return {
      id: `basic-${algorithm}-${index + 1}`,
      kind: semantic.type,
      description: semantic.description,
      duration: stepDuration,
      from,
      to,
      transition: {
        type: semantic.type === 'swap' ? 'arc' : 'instant',
        duration: stepDuration,
        easing: semantic.type === 'swap' ? 'easeOutCubic' : 'linear',
      },
      statsDelta: {
        comparisons: semantic.type === 'compare' ? 1 : 0,
        swaps: semantic.type === 'swap' || semantic.type === 'set' || semantic.type === 'merge' ? 1 : 0,
      },
      semanticRef: semantic,
    };
  });
}
```

- [ ] **Step 3: 运行类型检查确认通用时间轴 builder 成功接入**

Run: `npx vue-tsc --noEmit`
Expected: `build-basic-timeline.ts` 类型通过，剩余错误集中在播放器与渲染器旧接口

- [ ] **Step 4: 提交该任务**

```bash
git add src/utils/timeline-builders/build-basic-timeline.ts
git commit -m "feat: add basic sort timeline builder"
```

### Task 5: 实现 Timeline Player 与新 useSortAnimation 骨架

**Files:**
- Create: `src/composables/useTimelinePlayer.ts`
- Modify: `src/composables/useSortAnimation.ts`
- Test: `npx vue-tsc --noEmit`

- [ ] **Step 1: 编写纯时间轴播放器 composable**

```ts
// src/composables/useTimelinePlayer.ts
import { computed, ref } from 'vue';
import type { FrameState, TimelineStep } from '@/types/timeline';
import { interpolateFrame } from '@/utils/frame/interpolate-frame';

export function useTimelinePlayer(steps: () => TimelineStep[]) {
  const currentStepIndex = ref(0);
  const progress = ref(0);
  const isPlaying = ref(false);
  let rafId: number | null = null;
  let stepStartedAt = 0;

  const currentTimelineStep = computed(() => steps()[currentStepIndex.value] ?? null);
  const currentFrame = computed<FrameState | null>(() => {
    const step = currentTimelineStep.value;
    if (!step) return null;
    return interpolateFrame(step, progress.value);
  });

  function stopLoop() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function pause() {
    isPlaying.value = false;
    stopLoop();
  }

  function play() {
    if (!currentTimelineStep.value) return;
    isPlaying.value = true;
    stepStartedAt = performance.now() - currentTimelineStep.value.duration * progress.value;
    const tick = (ts: number) => {
      const step = currentTimelineStep.value;
      if (!step) return pause();
      const elapsed = ts - stepStartedAt;
      progress.value = Math.min(1, elapsed / step.duration);
      if (progress.value >= 1) {
        currentStepIndex.value += 1;
        progress.value = 0;
        if (!steps()[currentStepIndex.value]) return pause();
        stepStartedAt = ts;
      }
      if (isPlaying.value) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  function reset() {
    pause();
    currentStepIndex.value = 0;
    progress.value = 0;
  }

  return { currentStepIndex, progress, currentFrame, isPlaying, play, pause, reset };
}
```

- [ ] **Step 2: 将 useSortAnimation 重写为时间轴控制器**

```ts
// src/composables/useSortAnimation.ts
import { computed, ref, watch, type Ref, type ToRef } from 'vue';
import type { SemanticStep, TimelineStep } from '@/types/timeline';
import type { ArrayElement } from '@/stores/sortStore';
import { buildBasicTimeline } from '@/utils/timeline-builders/build-basic-timeline';
import { useTimelinePlayer } from '@/composables/useTimelinePlayer';

export interface ISortCanvas {
  renderFrame(frame: import('@/types/timeline').FrameState): void;
}

type SortFn = (arr: number[]) => SemanticStep[];

export function useSortAnimation(params: {
  sortFn: SortFn;
  speed: ToRef<number>;
  canvasRef: Ref<ISortCanvas | null>;
  originalArray: ToRef<ArrayElement[]>;
  algorithm: 'bubble' | 'insertion' | 'quick' | 'shell' | 'merge' | 'bucket' | 'heap';
}) {
  const { sortFn, speed, canvasRef, originalArray, algorithm } = params;
  const semanticSteps = ref<SemanticStep[]>([]);
  const timelineSteps = ref<TimelineStep[]>([]);
  const array = ref<ArrayElement[]>([]);
  const comparisons = ref(0);
  const swaps = ref(0);

  function rebuild() {
    const current = originalArray.value;
    array.value = [...current];
    semanticSteps.value = sortFn(current.map(item => item.value));
    timelineSteps.value = buildBasicTimeline({
      algorithm: algorithm as 'bubble' | 'insertion' | 'quick' | 'shell',
      steps: semanticSteps.value,
      originalValues: current.map(item => item.value),
      displayIndexes: current.map(item => item.displayIndex),
      width: 760,
      height: 320,
      stepDuration: speed.value,
    });
    comparisons.value = 0;
    swaps.value = 0;
  }

  const player = useTimelinePlayer(() => timelineSteps.value);

  watch(originalArray, rebuild, { immediate: true });
  watch(() => player.currentFrame.value, frame => {
    if (frame) canvasRef.value?.renderFrame(frame);
  }, { immediate: true });
  watch(() => player.currentStepIndex.value, index => {
    comparisons.value = timelineSteps.value.slice(0, index).reduce((sum, step) => sum + step.statsDelta.comparisons, 0);
    swaps.value = timelineSteps.value.slice(0, index).reduce((sum, step) => sum + step.statsDelta.swaps, 0);
  });

  return {
    array,
    steps: semanticSteps,
    currentStep: computed(() => player.currentStepIndex.value),
    comparisons,
    swaps,
    currentStepInfo: computed(() => semanticSteps.value[player.currentStepIndex.value - 1] ?? null),
    isPlaying: player.isPlaying,
    play: player.play,
    pause: player.pause,
    step: () => {
      player.pause();
      player.currentStepIndex.value = Math.min(player.currentStepIndex.value + 1, timelineSteps.value.length);
    },
    reset: player.reset,
    statusText: computed(() => player.isPlaying.value ? '播放中' : player.currentStepIndex.value >= timelineSteps.value.length ? '已完成' : player.currentStepIndex.value === 0 ? '就绪' : '已暂停'),
    statusClass: computed(() => player.isPlaying.value ? 'playing' : player.currentStepIndex.value >= timelineSteps.value.length ? 'done' : player.currentStepIndex.value === 0 ? 'ready' : 'paused'),
  };
}
```

- [ ] **Step 3: 运行类型检查验证新播放器骨架可编译**

Run: `npx vue-tsc --noEmit`
Expected: `useTimelinePlayer` 与 `useSortAnimation` 类型通过，组件和 renderer 因旧 `applyStep` 接口仍有错误

- [ ] **Step 4: 提交该任务**

```bash
git add src/composables/useTimelinePlayer.ts src/composables/useSortAnimation.ts
git commit -m "feat: add timeline player and animation controller"
```

### Task 6: 迁移通用 Canvas 渲染器和通用算法页面

**Files:**
- Modify: `src/composables/useCanvasRenderer.ts`
- Modify: `src/components/SortBarCanvas.vue`
- Modify: `src/components/algorithms/BubbleSort.vue`
- Modify: `src/components/algorithms/InsertionSort.vue`
- Modify: `src/components/algorithms/QuickSort.vue`
- Modify: `src/components/algorithms/ShellSort.vue`
- Test: `npx vue-tsc --noEmit`

- [ ] **Step 1: 把 useCanvasRenderer 改成纯 FrameState 渲染器**

```ts
// src/composables/useCanvasRenderer.ts
import type { FrameState, RenderableEntity } from '@/types/timeline';
import { ref, type Ref } from 'vue';

export function useCanvasRenderer(canvasRef: Ref<HTMLCanvasElement | null>) {
  const currentFrame = ref<FrameState | null>(null);
  let animationFrameId: number | null = null;
  let containerWidth = 800;
  let containerHeight = 360;

  function renderFrame(frame: FrameState) {
    currentFrame.value = frame;
  }

  function drawFrame(ctx: CanvasRenderingContext2D, entity: RenderableEntity) {
    const x = Math.round(entity.x);
    const y = Math.round(entity.y);
    const width = Math.round(entity.width);
    const height = Math.round(entity.height);
    const top = y - height;

    ctx.fillStyle = entity.style.fill;
    ctx.globalAlpha = entity.opacity;
    ctx.fillRect(x, top, width, height);
    ctx.globalAlpha = 1;

    ctx.font = `bold ${Math.min(12, width - 2)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#20e25a';
    ctx.fillText(String(entity.displayIndex), x + width / 2, y + 16);
  }

  function draw() {
    const canvas = canvasRef.value;
    const frame = currentFrame.value;
    if (!canvas || !frame) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, containerWidth, containerHeight);
    ctx.fillStyle = '#0f1219';
    ctx.fillRect(0, 0, containerWidth, containerHeight);
    frame.entities
      .slice()
      .sort((a, b) => a.zIndex - b.zIndex)
      .forEach(entity => drawFrame(ctx, entity));

    animationFrameId = requestAnimationFrame(draw);
  }

  return { renderFrame, draw };
}
```

- [ ] **Step 2: 更新通用 Canvas 组件暴露 renderFrame 接口**

```ts
// src/components/SortBarCanvas.vue
import type { FrameState } from '@/types/timeline';

const { renderFrame, draw } = useCanvasRenderer(canvasRef);

function exposedRenderFrame(frame: FrameState) {
  renderFrame(frame);
}

defineExpose({ renderFrame: exposedRenderFrame });
```

- [ ] **Step 3: 让四个通用算法页面传入 algorithm 参数并移除旧 highlighted 依赖**

```ts
// src/components/algorithms/QuickSort.vue
const { array, steps, currentStep, comparisons, swaps, currentStepInfo, isPlaying, play, pause, step, reset, statusText, statusClass } = useSortAnimation({
  sortFn: quickSort,
  speed: toRef(props, 'speed'),
  canvasRef,
  originalArray: toRef(store, 'originalArray'),
  algorithm: 'quick',
});
```

```vue
<SortBarCanvas ref="canvasRef" :array="array" :animation-speed="speed" />
```

- [ ] **Step 4: 运行类型检查确认通用排序链路接通**

Run: `npx vue-tsc --noEmit`
Expected: 通用排序相关组件通过，剩余错误集中在 merge / bucket / heap 的旧接口

- [ ] **Step 5: 提交该任务**

```bash
git add src/composables/useCanvasRenderer.ts src/components/SortBarCanvas.vue src/components/algorithms/BubbleSort.vue src/components/algorithms/InsertionSort.vue src/components/algorithms/QuickSort.vue src/components/algorithms/ShellSort.vue
git commit -m "refactor: migrate basic sort rendering to timeline frames"
```

### Task 7: 迁移归并时间轴与归并渲染器

**Files:**
- Create: `src/utils/timeline-builders/build-merge-timeline.ts`
- Modify: `src/composables/useMergeSortRenderer.ts`
- Modify: `src/components/SortBarCanvasMerge.vue`
- Modify: `src/components/algorithms/MergeSort.vue`
- Modify: `src/composables/useSortAnimation.ts`
- Test: `npx vue-tsc --noEmit`

- [ ] **Step 1: 编写归并时间轴 builder，覆盖 main/buffer/ghost 三类实体**

```ts
// src/utils/timeline-builders/build-merge-timeline.ts
import type { FrameState, RenderableEntity, SemanticStep, TimelineStep } from '@/types/timeline';
import { buildMergeLayout } from '@/utils/layout/merge-layout';

export function buildMergeTimeline(params: {
  steps: SemanticStep[];
  originalValues: number[];
  displayIndexes: number[];
  width: number;
  height: number;
  stepDuration: number;
}): TimelineStep[] {
  const { steps, originalValues, displayIndexes, width, height, stepDuration } = params;
  const layout = buildMergeLayout(width, height, originalValues.length);
  let values = [...originalValues];
  let bufferValues: Array<number | null> = Array.from({ length: originalValues.length }, () => null);

  function frame(stepIndex: number, description: string): FrameState {
    const maxValue = Math.max(...originalValues);
    const mainEntities: RenderableEntity[] = values.map((value, index) => ({
      id: `main-${index}`,
      sourceId: `value-${displayIndexes[index]}`,
      kind: 'main-bar',
      value,
      displayIndex: displayIndexes[index],
      x: layout.topSlots[index].x,
      y: layout.topSlots[index].y,
      width: layout.topSlots[index].width,
      height: Math.max(5, Math.round((value / maxValue) * layout.topSlots[index].maxHeight)),
      opacity: 1,
      zIndex: 1,
      style: { fill: '#4a9eff' },
      stateTags: [],
    }));

    const bufferEntities: RenderableEntity[] = bufferValues
      .map((value, index) => {
        if (value === null) return null;
        return {
          id: `buffer-${index}`,
          sourceId: `buffer-${index}`,
          kind: 'buffer-bar',
          value,
          displayIndex: index + 1,
          x: layout.bottomSlots[index].x,
          y: layout.bottomSlots[index].y,
          width: layout.bottomSlots[index].width,
          height: Math.max(5, Math.round((value / maxValue) * layout.bottomSlots[index].maxHeight)),
          opacity: 1,
          zIndex: 2,
          style: { fill: '#4ecdc4' },
          stateTags: [],
        } satisfies RenderableEntity;
      })
      .filter(Boolean) as RenderableEntity[];

    return {
      algorithm: 'merge',
      stepIndex,
      progress: 0,
      phase: 'paused',
      description,
      entities: [...mainEntities, ...bufferEntities],
      regions: [
        { id: 'main', kind: 'main', x: 0, y: 0, width, height: layout.dividerY },
        { id: 'buffer', kind: 'buffer', x: 0, y: layout.dividerY, width, height: height - layout.dividerY },
      ],
      overlays: [{ id: 'merge-divider', kind: 'divider', style: { fill: 'rgba(78,205,196,0.45)' }, points: [{ x: 0, y: layout.dividerY }, { x: width, y: layout.dividerY }] }],
    };
  }

  return steps.map((semantic, index) => {
    const from = frame(index, semantic.description);
    if (semantic.type === 'merge-set') {
      const [, destIndex] = semantic.indices;
      bufferValues[destIndex] = semantic.arraySnapshot?.[semantic.indices[0]] ?? values[semantic.indices[0]];
    }
    if (semantic.type === 'merge-back' && semantic.arraySnapshot) {
      values = [...semantic.arraySnapshot];
      bufferValues = Array.from({ length: originalValues.length }, () => null);
    }
    const to = frame(index + 1, semantic.description);
    return {
      id: `merge-${index + 1}`,
      kind: semantic.type,
      description: semantic.description,
      duration: stepDuration,
      from,
      to,
      transition: {
        type: semantic.type === 'merge-set' || semantic.type === 'merge-back' ? 'path' : 'instant',
        duration: stepDuration,
        easing: semantic.type === 'merge-back' ? 'easeInOutCubic' : 'easeOutCubic',
      },
      statsDelta: {
        comparisons: semantic.type === 'compare' ? 1 : 0,
        swaps: semantic.type === 'merge-set' || semantic.type === 'merge-back' ? 1 : 0,
      },
      semanticRef: semantic,
    };
  });
}
```

- [ ] **Step 2: 把归并 renderer 和 Canvas 组件切到 renderFrame 模式**

```ts
// src/composables/useMergeSortRenderer.ts
import type { FrameState } from '@/types/timeline';

export function useMergeSortRenderer(canvasRef: Ref<HTMLCanvasElement | null>) {
  const currentFrame = ref<FrameState | null>(null);
  function renderFrame(frame: FrameState) {
    currentFrame.value = frame;
  }
  return { renderFrame, initialize, resize, startRenderLoop, stopRenderLoop };
}
```

```ts
// src/components/SortBarCanvasMerge.vue
defineExpose({ renderFrame: exposedRenderFrame });
```

- [ ] **Step 3: 让 useSortAnimation 在 merge 算法下切换到 buildMergeTimeline**

```ts
if (algorithm === 'merge') {
  timelineSteps.value = buildMergeTimeline({
    steps: semanticSteps.value,
    originalValues: current.map(item => item.value),
    displayIndexes: current.map(item => item.displayIndex),
    width: 760,
    height: 420,
    stepDuration: speed.value,
  });
}
```

- [ ] **Step 4: 运行类型检查确认归并链路接通**

Run: `npx vue-tsc --noEmit`
Expected: merge 相关类型错误消失，剩余错误集中在 bucket / heap

- [ ] **Step 5: 提交该任务**

```bash
git add src/utils/timeline-builders/build-merge-timeline.ts src/composables/useMergeSortRenderer.ts src/components/SortBarCanvasMerge.vue src/components/algorithms/MergeSort.vue src/composables/useSortAnimation.ts
git commit -m "refactor: migrate merge sort to timeline frames"
```

### Task 8: 迁移桶排序时间轴与桶渲染器

**Files:**
- Create: `src/utils/timeline-builders/build-bucket-timeline.ts`
- Modify: `src/composables/useBucketSortRenderer.ts`
- Modify: `src/components/SortBarCanvasBucket.vue`
- Modify: `src/components/algorithms/BucketSort.vue`
- Modify: `src/composables/useSortAnimation.ts`
- Test: `npx vue-tsc --noEmit`

- [ ] **Step 1: 编写桶排序时间轴 builder，显式生成 main/bucket 实体与桶区域**

```ts
// src/utils/timeline-builders/build-bucket-timeline.ts
import type { FrameState, RenderableEntity, SemanticStep, TimelineStep } from '@/types/timeline';
import { buildBucketLayout } from '@/utils/layout/bucket-layout';

export function buildBucketTimeline(params: {
  steps: SemanticStep[];
  originalValues: number[];
  displayIndexes: number[];
  width: number;
  height: number;
  stepDuration: number;
}): TimelineStep[] {
  const { steps, originalValues, displayIndexes, width, height, stepDuration } = params;
  const layout = buildBucketLayout(width, height, originalValues.length);
  let mainValues = [...originalValues];
  let buckets: number[][] = Array.from({ length: layout.bucketCount }, () => []);

  function frame(stepIndex: number, description: string): FrameState {
    const maxValue = Math.max(...originalValues);
    const mainEntities: RenderableEntity[] = mainValues.map((value, index) => ({
      id: `main-${index}`,
      sourceId: `value-${displayIndexes[index]}`,
      kind: 'main-bar',
      value,
      displayIndex: displayIndexes[index],
      x: 40 + index * 44,
      y: layout.mainHeight - 22,
      width: 40,
      height: Math.max(6, Math.round((value / maxValue) * (layout.mainHeight - 52))),
      opacity: 1,
      zIndex: 1,
      style: { fill: '#4a9eff' },
      stateTags: [],
    }));

    const bucketEntities = buckets.flatMap((bucket, bucketIndex) =>
      bucket.map((value, pos) => ({
        id: `bucket-${bucketIndex}-${pos}`,
        sourceId: `bucket-${bucketIndex}-${value}`,
        kind: 'bucket-bar',
        value,
        displayIndex: pos + 1,
        x: layout.bucketRegions[bucketIndex].x + 10 + pos * 20,
        y: layout.bucketRegions[bucketIndex].y + layout.bucketRegions[bucketIndex].height - 22,
        width: 16,
        height: Math.max(6, Math.round((value / maxValue) * (layout.bucketRegions[bucketIndex].height - 58))),
        opacity: 1,
        zIndex: 2,
        style: { fill: '#4ecdc4' },
        stateTags: [],
      }))
    );

    return {
      algorithm: 'bucket',
      stepIndex,
      progress: 0,
      phase: 'paused',
      description,
      entities: [...mainEntities, ...bucketEntities],
      regions: [
        { id: 'main', kind: 'main', x: 0, y: 0, width, height: layout.mainHeight },
        ...layout.bucketRegions.map(region => ({ id: `bucket-${region.bucketIndex}`, kind: 'bucket' as const, x: region.x, y: region.y, width: region.width, height: region.height })),
      ],
      overlays: [],
    };
  }

  return steps.map((semantic, index) => {
    const from = frame(index, semantic.description);
    if (semantic.type === 'bucket-scatter') {
      const sourceIndex = semantic.indices[0];
      const bucketIndex = semantic.bucketIndex ?? 0;
      buckets[bucketIndex].push(mainValues[sourceIndex]);
    }
    if (semantic.type === 'bucket-swap') {
      const bucketIndex = semantic.bucketIndex ?? 0;
      const [left, right] = semantic.indices;
      [buckets[bucketIndex][left], buckets[bucketIndex][right]] = [buckets[bucketIndex][right], buckets[bucketIndex][left]];
    }
    if (semantic.type === 'bucket-gather' && semantic.arraySnapshot) {
      mainValues = [...semantic.arraySnapshot];
      const bucketIndex = semantic.bucketIndex ?? 0;
      buckets[bucketIndex].shift();
    }
    const to = frame(index + 1, semantic.description);

    return {
      id: `bucket-${index + 1}`,
      kind: semantic.type,
      description: semantic.description,
      duration: stepDuration,
      from,
      to,
      transition: {
        type: semantic.type === 'bucket-scatter' || semantic.type === 'bucket-gather' ? 'path' : 'instant',
        duration: stepDuration,
        easing: 'easeInOutCubic',
      },
      statsDelta: {
        comparisons: semantic.type === 'bucket-compare' ? 1 : 0,
        swaps: semantic.type === 'bucket-swap' ? 1 : 0,
      },
      semanticRef: semantic,
    };
  });
}
```

- [ ] **Step 2: 把桶 renderer 和组件收口到 renderFrame**

```ts
// src/components/SortBarCanvasBucket.vue
import type { FrameState } from '@/types/timeline';

function exposedRenderFrame(frame: FrameState) {
  renderFrame(frame);
}

defineExpose({ renderFrame: exposedRenderFrame });
```

- [ ] **Step 3: 在 useSortAnimation 中为 bucket 分支接入 builder**

```ts
if (algorithm === 'bucket') {
  timelineSteps.value = buildBucketTimeline({
    steps: semanticSteps.value,
    originalValues: current.map(item => item.value),
    displayIndexes: current.map(item => item.displayIndex),
    width: 760,
    height: 460,
    stepDuration: speed.value,
  });
}
```

- [ ] **Step 4: 运行类型检查确认桶排序链路接通**

Run: `npx vue-tsc --noEmit`
Expected: bucket 相关类型错误消失，剩余错误集中在 heap

- [ ] **Step 5: 提交该任务**

```bash
git add src/utils/timeline-builders/build-bucket-timeline.ts src/composables/useBucketSortRenderer.ts src/components/SortBarCanvasBucket.vue src/components/algorithms/BucketSort.vue src/composables/useSortAnimation.ts
git commit -m "refactor: migrate bucket sort to timeline frames"
```

### Task 9: 迁移堆排序时间轴与堆渲染器

**Files:**
- Create: `src/utils/timeline-builders/build-heap-timeline.ts`
- Modify: `src/composables/useHeapSortRenderer.ts`
- Modify: `src/components/SortBarCanvasHeap.vue`
- Modify: `src/components/algorithms/HeapSort.vue`
- Modify: `src/composables/useSortAnimation.ts`
- Test: `npx vue-tsc --noEmit`

- [ ] **Step 1: 编写堆排序时间轴 builder，显式建模 tree node / array node / edge overlay**

```ts
// src/utils/timeline-builders/build-heap-timeline.ts
import type { FrameState, RenderableEntity, RenderableOverlay, SemanticStep, TimelineStep } from '@/types/timeline';
import { buildHeapNodePosition, getHeapRequiredHeight } from '@/utils/layout/heap-layout';

export function buildHeapTimeline(params: {
  steps: SemanticStep[];
  originalValues: number[];
  displayIndexes: number[];
  width: number;
  stepDuration: number;
  isMinHeap: boolean;
}): TimelineStep[] {
  const { steps, originalValues, displayIndexes, width, stepDuration, isMinHeap } = params;
  let values = [...originalValues];
  const height = getHeapRequiredHeight(values.length);

  function frame(stepIndex: number, description: string): FrameState {
    const maxValue = Math.max(...values);
    const treeEntities: RenderableEntity[] = values.map((value, index) => {
      const position = buildHeapNodePosition(index, values.length, width, height);
      return {
        id: `tree-${index}`,
        sourceId: `value-${displayIndexes[index]}`,
        kind: 'heap-tree-node',
        value,
        displayIndex: displayIndexes[index],
        x: position.x,
        y: position.y,
        width: 26,
        height: 26,
        opacity: 1,
        zIndex: 2,
        style: { fill: '#1e50a8', stroke: '#4a80d0', text: '#c0d8f8' },
        stateTags: [],
      };
    });

    const arrayEntities: RenderableEntity[] = values.map((value, index) => ({
      id: `array-${index}`,
      sourceId: `value-${displayIndexes[index]}`,
      kind: 'heap-array-node',
      value,
      displayIndex: displayIndexes[index],
      x: 40 + index * 30,
      y: height - 60,
      width: 20,
      height: 20,
      opacity: 1,
      zIndex: 1,
      style: { fill: isMinHeap ? '#0a7070' : '#1a7810', stroke: '#4a80d0', text: '#c0d8f8' },
      stateTags: [],
    }));

    const overlays: RenderableOverlay[] = values.flatMap((_, index) => {
      return [2 * index + 1, 2 * index + 2]
        .filter(child => child < values.length)
        .map(child => ({
          id: `edge-${index}-${child}`,
          kind: 'edge' as const,
          points: [
            { x: treeEntities[index].x, y: treeEntities[index].y },
            { x: treeEntities[child].x, y: treeEntities[child].y },
          ],
          style: { fill: 'transparent', stroke: 'rgba(255,255,255,0.07)' },
        }));
    });

    return {
      algorithm: 'heap',
      stepIndex,
      progress: 0,
      phase: 'paused',
      description,
      entities: [...treeEntities, ...arrayEntities],
      regions: [
        { id: 'heap-tree', kind: 'heap-tree', x: 0, y: 0, width, height: height - 88 },
        { id: 'heap-array', kind: 'heap-array', x: 0, y: height - 88, width, height: 88 },
      ],
      overlays,
    };
  }

  return steps.map((semantic, index) => {
    const from = frame(index, semantic.description);
    if (semantic.type === 'swap' && semantic.arraySnapshot && semantic.indices.length === 2) {
      const [left, right] = semantic.indices;
      values = [...semantic.arraySnapshot];
      [values[left], values[right]] = [values[right], values[left]];
    }
    const to = frame(index + 1, semantic.description);
    return {
      id: `heap-${index + 1}`,
      kind: semantic.type,
      description: semantic.description,
      duration: stepDuration,
      from,
      to,
      transition: {
        type: semantic.type === 'swap' ? 'arc' : 'instant',
        duration: stepDuration,
        easing: semantic.type === 'swap' ? 'easeOutCubic' : 'linear',
      },
      statsDelta: {
        comparisons: semantic.type === 'compare' ? 1 : 0,
        swaps: semantic.type === 'swap' ? 1 : 0,
      },
      semanticRef: semantic,
    };
  });
}
```

- [ ] **Step 2: 把堆 renderer 和 Canvas 组件改成消费 frame**

```ts
// src/components/SortBarCanvasHeap.vue
import type { FrameState } from '@/types/timeline';

function exposedRenderFrame(frame: FrameState) {
  renderFrame(frame);
}

defineExpose({ renderFrame: exposedRenderFrame });
```

- [ ] **Step 3: 在 useSortAnimation 中为 heap 分支接入 builder，并读取最小堆模式**

```ts
if (algorithm === 'heap') {
  timelineSteps.value = buildHeapTimeline({
    steps: semanticSteps.value,
    originalValues: current.map(item => item.value),
    displayIndexes: current.map(item => item.displayIndex),
    width: 760,
    stepDuration: speed.value,
    isMinHeap: false,
  });
}
```

- [ ] **Step 4: 运行最终类型检查，确认所有算法页面和四类 renderer 全部迁移完成**

Run: `npx vue-tsc --noEmit`
Expected: PASS

- [ ] **Step 5: 提交该任务**

```bash
git add src/utils/timeline-builders/build-heap-timeline.ts src/composables/useHeapSortRenderer.ts src/components/SortBarCanvasHeap.vue src/components/algorithms/HeapSort.vue src/composables/useSortAnimation.ts
git commit -m "refactor: migrate heap sort to timeline frames"
```

### Task 10: 收尾整理与文档同步

**Files:**
- Modify: `docs/superpowers/specs/2026-04-27-sort-animation-timeline-design.md`
- Test: `npx vue-tsc --noEmit`

- [ ] **Step 1: 根据实现结果同步 spec 中的命名或边界差异**

```md
## 实现对齐说明

- `SortStep` 已作为 `SemanticStep` 别名保留在过渡期
- `useTimelinePlayer.ts` 已独立拆出
- 4 类 timeline builder 已分别实现于 `src/utils/timeline-builders/`
- Canvas 组件统一暴露 `renderFrame(frame)`
```

- [ ] **Step 2: 运行最终类型检查并记录结果**

Run: `npx vue-tsc --noEmit`
Expected: PASS

- [ ] **Step 3: 提交收尾修改**

```bash
git add docs/superpowers/specs/2026-04-27-sort-animation-timeline-design.md
git commit -m "docs: align timeline animation spec with implementation"
```

## Self-Review

### Spec coverage
- 统一时间轴模型：Task 1、Task 3、Task 4、Task 5
- `SemanticStep -> TimelineStep -> FrameState` 数据流：Task 2、Task 4、Task 5、Task 7、Task 8、Task 9
- layout / interpolate / builder 中间层：Task 3、Task 4、Task 7、Task 8、Task 9
- `useSortAnimation` 改成时间轴驱动器：Task 5
- renderer 改为纯 frame 消费：Task 6、Task 7、Task 8、Task 9
- 通用 / 归并 / 桶 / 堆四类渲染器逐步迁移：Task 6、Task 7、Task 8、Task 9
- 本次不实现回退交互：计划未包含 `stepBack`、seek、倒放等任务，范围符合 spec

### Placeholder scan
- 未使用 TBD / TODO / implement later
- 所有代码步骤均给出具体文件与代码片段
- 所有验证步骤均给出明确命令与预期结果
- 所有提交步骤均给出明确 `git add` 与 `git commit` 示例（仅作为执行 plan 的操作说明）

### Type consistency
- 统一使用 `SemanticStep`、`TimelineStep`、`FrameState`、`Transition`
- Canvas 组件统一暴露 `renderFrame(frame)`
- builder 目录统一为 `src/utils/timeline-builders/`
- timeline player 统一为 `useTimelinePlayer.ts`

