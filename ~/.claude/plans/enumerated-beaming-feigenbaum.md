# 添加"上一步"功能计划

## Context

所有排序算法的控制栏目前有三个按钮：播放/暂停、下一步（stepOnce）、重置。用户希望在下一步按钮旁增加一个"上一步"按钮，允许在暂停状态下逐步回退动画。

---

---

## 难度分析

### 核心挑战：正向单向状态机，无法原地反向

`useSortAnimation` 是纯正向步进架构：
- `sortedIndices` — 增量式 Set，只增不减
- `comparisons`/`swaps` — 只增不减
- `prevHighlightedIndices` — `let` 变量，随步骤覆盖，无历史
- Canvas 视觉状态 — 各渲染器内部状态，调用 `applyStep` 后无法撤销

若要实现精确回退，需要在每步执行后保存完整快照，或在退步时从头重放。

### 各渲染器 updateBars() 清空能力

| 渲染器 | updateBars 清空的状态 | 是否足够回退 |
|--------|----------------------|-------------|
| `useCanvasRenderer`（冒泡/插入/快排/希尔） | `barStates` + `animationQueue` | ✅ 充分，回退后直接展示正确状态 |
| `useHeapSortRenderer` | `balls`（全量重建） | ✅ 充分，但 `flyTask` 不清空（需额外处理） |
| `useMergeSortRenderer` | `bottomBars` + `ghostTopIndices` + `swapQueue` | ⚠️ 中间 merge-set 帧无法精确还原下排状态 |
| `useBucketSortRenderer` | `mainSlots` + `buckets` + `flyingBars`（但有 bucketStateActive 守卫） | ❌ 复杂：桶内中间状态步骤无 arraySnapshot，无法精确还原 |

### arraySnapshot 覆盖情况

| step.type | 有无 arraySnapshot | 说明 |
|-----------|-------------------|------|
| `swap` | ✅ 有 | 交换前状态 |
| `merge-back` | ✅ 有 | 合并后完整状态 |
| `sorted` | 多数有 | shellSort 最终 sorted 无 |
| `bucket-gather` | ✅ 有 | 归位后状态 |
| `compare` | 部分有（mergeSort 有）| 其余无 |
| `pivot` | 无 | |
| `merge-set` | 无 | 有意为之，避免触发 updateBars |
| `bucket-scatter/compare/swap` | 无 | 桶内状态靠渲染器内部管理 |

---

## 推荐方案：预计算快照 + 干跑重建

### 核心思路

在 `initFromOriginal()` 时，对所有步骤干跑一遍，预计算每一步结束后的完整状态快照：

```typescript
interface StepSnapshot {
  array: ArrayElement[];       // 该步结束后的主数组
  sortedIndices: Set<number>;  // 该步结束后的已排序集合
  comparisons: number;
  swaps: number;
}
let stepSnapshots: StepSnapshot[] = [];  // 索引 i 对应执行完 steps[i] 后的状态
```

`stepBack()` 时：
1. `targetStep = currentStep - 1`
2. 取 `stepSnapshots[targetStep - 1]`（或初始状态若 targetStep=0）
3. 恢复 `array`、`sortedIndices`、`comparisons`、`swaps`
4. `currentStep.value = targetStep`（触发 `highlightedIndices` computed 重算）
5. 调用 `canvasRef.value?.updateBars()` 刷新 Canvas

**不播放回退动画**，直接跳变到前一步的视觉状态（无动画版本）。

### 预计算快照的实现

```typescript
function buildStepSnapshots(): StepSnapshot[] {
  const snapshots: StepSnapshot[] = [];
  let arr = originalArray.value.map(e => e.value);
  let sorted = new Set<number>();
  let comps = 0, sws = 0;

  for (const s of steps.value) {
    // 更新统计
    if (s.type === 'compare' || s.type === 'bucket-compare') comps++;
    else if (['swap','merge','set','merge-set','merge-back','bucket-swap'].includes(s.type)) sws++;
    else if (s.type === 'sorted') s.indices.forEach(i => sorted.add(i));

    // 更新数组（同 applyStep 逻辑）
    if (s.arraySnapshot && ARRAY_MUTATING_TYPES.has(s.type)) {
      let final = s.arraySnapshot;
      if (s.type === 'swap' && s.indices.length === 2) {
        const [i, j] = s.indices;
        final = [...s.arraySnapshot];
        [final[i], final[j]] = [final[j], final[i]];
      }
      arr = final;
    }

    snapshots.push({
      array: arr.map(v => ({ value: v, displayIndex: valueToDisplayIndex?.get(v) ?? 0 })),
      sortedIndices: new Set(sorted),
      comparisons: comps,
      swaps: sws,
    });
  }
  return snapshots;
}
```

### stepBack() 实现

```typescript
async function stepBack() {
  if (isAnimating || localPlaying.value) return;
  if (currentStep.value <= 0) return;

  const target = currentStep.value - 1;
  if (target === 0) {
    // 回到初始状态
    array.value = [...originalArray.value];
    sortedIndices.value = new Set();
    comparisons.value = 0;
    swaps.value = 0;
  } else {
    const snap = stepSnapshots[target - 1];
    array.value = snap.array;
    sortedIndices.value = new Set(snap.sortedIndices);
    comparisons.value = snap.comparisons;
    swaps.value = snap.swaps;
  }
  // 同步 prevHighlightedIndices（让 computed highlightedIndices 的继承状态正确）
  prevHighlightedIndices = { comparing: [], swapping: [], sorted: [], pivot: [], pending: [] };
  currentStep.value = target;
  canvasRef.value?.updateBars();
}
```

### prevHighlightedIndices 的处理

`prevHighlightedIndices` 是 `let` 变量，`swap`/`merge` 步骤时继承它来保持 comparing/pending 不变。退步后重置为空即可（最坏情况：退步到 swap 步骤时，高亮颜色不继承上一步的 comparing，但 swap 本身有 swapping 颜色，视觉上可接受）。

---

## 渲染器限制与取舍

| 渲染器 | 退步后 Canvas 准确性 | 说明 |
|--------|---------------------|------|
| 通用（冒泡等） | ✅ 完全准确 | updateBars 全量重建 barStates |
| 堆排序 | ✅ 基本准确 | rebuildBalls 全量重建；需在 stepBack 前确认 flyTask 已完成（isAnimating 守卫保证） |
| 归并排序 | ⚠️ 粗粒度 | 若目标步骤在 merge-set 中间帧，updateBars 会清空 bottomBars，显示为"无下排"状态而非当时的下排中间态；视觉上是"上排完整、下排空"，功能上不影响继续播放 |
| 桶排序 | ⚠️ 粗粒度 | 若目标步骤在 bucket-scatter/compare/swap 阶段中，updateBars 清空桶内容，显示为"主数组完整、桶空"；同样不影响继续播放 |

**结论：** 归并和桶排序的退步仅能退到"粗粒度状态"（分别为最近一次 merge-back 之前 / 主数组初始），而非精确帧。这是合理取舍：复杂飞行动画本身就没有"反向播放"的概念，用户通过退步主要是想看"上一个对比步骤"，粗粒度状态已足够直觉。

---

## 需要修改的文件

### 1. `src/composables/useSortAnimation.ts`

- 新增 `let stepSnapshots: StepSnapshot[]`
- 在 `initFromOriginal()` 和 `reset(regenerate=true)` 结束时调用 `buildStepSnapshots()`
- 新增 `buildStepSnapshots()` 函数
- 新增 `stepBack()` 函数，export 到返回值

### 2. 所有算法组件（共 7 个）

在 `ctrl-group` 的"下一步"按钮**前**（左侧）插入"上一步"按钮：

```html
<!-- 上一步按钮，插在下一步按钮前 -->
<button class="ctrl-btn" @click="stepBack()" :disabled="isPlaying || currentStep <= 0">
  <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="19,4 9,12 19,20"/>
    <rect x="5" y="4" width="3" height="16"/>
  </svg>
</button>
```

涉及文件：
- `src/components/algorithms/BubbleSort.vue`
- `src/components/algorithms/InsertionSort.vue`
- `src/components/algorithms/QuickSort.vue`
- `src/components/algorithms/ShellSort.vue`
- `src/components/algorithms/MergeSort.vue`
- `src/components/algorithms/BucketSort.vue`
- `src/components/algorithms/HeapSort.vue`

各组件需从 `useSortAnimation` 解构 `stepBack`（当前只解构了 `step`，没有 `stepBack`）。

### 3. `src/composables/useBucketSortRenderer.ts`

`stepBack` 调用 `updateBars()` 时，`bucketStateActive` 可能为 `true` 导致 updateBars 直接 return。需要让 Canvas 组件的 `updateBars` expose 接口绕过此守卫——在 `SortBarCanvasBucket.vue` 的 `updateBars` expose 实现中改为调用 `forceReset()`（已存在的内部函数）而非 `updateBars()`，或者为 `useBucketSortRenderer` 新增一个 `forceUpdateBars()` 导出。

---

## 修改文件清单

| 文件 | 改动类型 |
|------|---------|
| `src/composables/useSortAnimation.ts` | 新增快照预计算、stepBack 函数 |
| `src/components/algorithms/BubbleSort.vue` | 增加上一步按钮 |
| `src/components/algorithms/InsertionSort.vue` | 增加上一步按钮 |
| `src/components/algorithms/QuickSort.vue` | 增加上一步按钮 |
| `src/components/algorithms/ShellSort.vue` | 增加上一步按钮 |
| `src/components/algorithms/MergeSort.vue` | 增加上一步按钮 |
| `src/components/algorithms/BucketSort.vue` | 增加上一步按钮 |
| `src/components/algorithms/HeapSort.vue` | 增加上一步按钮 |
| `src/composables/useBucketSortRenderer.ts` | 新增 forceUpdateBars() 或调整 updateBars 守卫 |
| `src/components/SortBarCanvasBucket.vue` | expose 的 updateBars 改用 forceReset 路径 |

---

## 验证方法

1. 冒泡排序（n=20）：单步前进 5 步，再单步回退 3 步，确认数组状态、统计数据、高亮颜色均正确
2. 退步到 step=0（初始状态），确认所有统计归零、数组还原
3. 归并排序：在 merge-set 进行中退步，确认上排完整显示、下排清空（粗粒度接受）
4. 桶排序：在 bucket-scatter 期间退步，确认主数组完整、桶清空（粗粒度接受）
5. 堆排序：在 swap 飞行完成后退步，确认球位置正确还原
6. 所有算法：播放中上一步按钮 disabled，不可点击

