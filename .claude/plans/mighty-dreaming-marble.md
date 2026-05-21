# 对比模式高优先级优化实现计划

## Context

排序动画对比模式（CompareView）存在两个影响核心体验的缺陷：
1. 底部进度条是纯展示，不支持点击跳转
2. 缺少汇总对比面板，用户需要目测两个 slot 的数字进行对比

本次实现这两个高优先级优化，提升对比模式的交互性和信息密度。

---

## 优化 #4: 进度条点击跳转

**改动文件：** `src/components/CompareSlot.vue`

### 1. Script: 解构 handleSeek（第 94 行后）

```ts
const {
  // ...现有字段...
  progressPct,
  handleSeek,  // 新增
} = useSortAnimation({...});
```

### 2. Script: defineExpose 暴露 handleSeek（第 136 行后）

```ts
defineExpose({
  // ...现有字段...
  handleSeek,  // 新增
});
```

### 3. Template: 绑定 @click（第 179 行）

```html
<div class="slot-track-wrap" @click="handleSeek">
```

### 4. Style: 添加 cursor 和 hover 效果（第 344 行）

```scss
.slot-track-wrap {
  // ...现有样式...
  cursor: pointer;
  transition: height 0.15s ease, background 0.15s ease;

  &:hover {
    height: 5px;
    background: rgba(74, 158, 255, 0.18);
  }
}
```

---

## 优化 #2: 汇总对比面板

### CompareSlot.vue 改动

**1. Script: 新增 update:stats emit（第 31 行）**

```ts
const emit = defineEmits<{
  (e: "update:algorithm", value: SortAlgorithm): void;
  (e: "update:playing", value: boolean): void;
  (e: "update:stats", value: { algorithm: SortAlgorithm; comparisons: number; swaps: number; currentStep: number; totalSteps: number }): void;
}>();
```

**2. Script: 新增 watcher 上报统计数据（第 113 行后）**

```ts
watch(
  [comparisons, swaps, currentStep, totalSteps],
  () => {
    emit("update:stats", {
      algorithm: props.algorithm,
      comparisons: comparisons.value,
      swaps: swaps.value,
      currentStep: currentStep.value,
      totalSteps: totalSteps.value,
    });
  },
  { immediate: true },
);
```

### CompareView.vue 改动

**1. Script: 新增 import（第 3 行）**

```ts
import { algorithmInfo } from "@/types/sorting";
```

**2. Script: 新增统计数据状态（第 74 行后）**

```ts
interface SlotStats {
  algorithm: SortAlgorithm;
  comparisons: number;
  swaps: number;
  currentStep: number;
  totalSteps: number;
}

const leftStats = ref<SlotStats>({ algorithm: "bubble", comparisons: 0, swaps: 0, currentStep: 0, totalSteps: 0 });
const rightStats = ref<SlotStats>({ algorithm: "quick", comparisons: 0, swaps: 0, currentStep: 0, totalSteps: 0 });

const statsDiff = computed(() => {
  const compDiff = leftStats.value.comparisons - rightStats.value.comparisons;
  const swapDiff = leftStats.value.swaps - rightStats.value.swaps;
  return {
    comparisons: compDiff,
    swaps: swapDiff,
    compWinner: compDiff < 0 ? "left" : compDiff > 0 ? "right" : "tie" as "left" | "right" | "tie",
    swapWinner: swapDiff < 0 ? "left" : swapDiff > 0 ? "right" : "tie" as "left" | "right" | "tie",
  };
});

function formatDiff(val: number): string {
  if (val === 0) return "0";
  return val > 0 ? `+${val}` : `${val}`;
}
```

**3. Template: CompareSlot 添加 @update:stats 事件监听**

```html
<CompareSlot
  ref="leftSlot"
  :key="store.leftAlgorithm"
  :algorithm="store.leftAlgorithm"
  :speed="store.animationSpeed"
  @update:algorithm="handleLeftAlgorithmChange"
  @update:playing="v => leftPlaying = v"
  @update:stats="v => leftStats = v"
/>
```

右侧同理。

**4. Template: 新增汇总面板（.compare-slots 和 .compare-controls 之间）**

```html
<!-- 汇总对比面板 -->
<div class="compare-summary" v-if="leftStats.totalSteps > 0 && rightStats.totalSteps > 0">
  <div class="summary-col">
    <span class="summary-algo-name">{{ algorithmInfo[leftStats.algorithm].name }}</span>
    <div class="summary-metrics">
      <div class="summary-metric">
        <span class="metric-label">比较</span>
        <span class="metric-value">{{ leftStats.comparisons }}</span>
      </div>
      <div class="summary-metric">
        <span class="metric-label">交换</span>
        <span class="metric-value">{{ leftStats.swaps }}</span>
      </div>
    </div>
  </div>

  <div class="summary-center">
    <div class="diff-row">
      <span class="diff-label">比较差</span>
      <span class="diff-value" :class="'winner-' + statsDiff.compWinner">
        {{ formatDiff(statsDiff.comparisons) }}
      </span>
    </div>
    <div class="diff-row">
      <span class="diff-label">交换差</span>
      <span class="diff-value" :class="'winner-' + statsDiff.swapWinner">
        {{ formatDiff(statsDiff.swapDiff) }}
      </span>
    </div>
  </div>

  <div class="summary-col">
    <span class="summary-algo-name">{{ algorithmInfo[rightStats.algorithm].name }}</span>
    <div class="summary-metrics">
      <div class="summary-metric">
        <span class="metric-label">比较</span>
        <span class="metric-value">{{ rightStats.comparisons }}</span>
      </div>
      <div class="summary-metric">
        <span class="metric-label">交换</span>
        <span class="metric-value">{{ rightStats.swaps }}</span>
      </div>
    </div>
  </div>
</div>
```

**5. Style: 新增面板样式**

```scss
.compare-summary {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 20px;
  background: rgba(10, 10, 20, 0.6);
  border: 1px solid rgba(74, 158, 255, 0.12);
  border-radius: 8px;
  backdrop-filter: blur(12px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
}

.summary-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.summary-algo-name {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  color: #8b95a8;
  font-weight: 600;
}

.summary-metrics {
  display: flex;
  gap: 12px;
}

.summary-metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.metric-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  color: #6b7280;
}

.metric-value {
  font-family: "JetBrains Mono", monospace;
  font-size: 13px;
  color: #5dddd4;
  font-weight: 600;
}

.summary-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 0 12px;
  border-left: 1px solid rgba(74, 158, 255, 0.1);
  border-right: 1px solid rgba(74, 158, 255, 0.1);
}

.diff-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.diff-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  color: #6b7280;
  white-space: nowrap;
}

.diff-value {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  font-weight: 600;
  min-width: 50px;
  text-align: right;
}

.diff-value.winner-left { color: #4ecdc4; }
.diff-value.winner-right { color: #ff8a8a; }
.diff-value.winner-tie { color: #8b95a8; }
```

---

## 验证方法

1. 进入对比模式，点击任一 slot 进度条 —— 动画应跳转到对应位置
2. 验证点击后统计数字（比较/交换）正确更新
3. 进度条 hover 时应变粗（3px → 5px）并显示 pointer 光标
4. 汇总面板应在两侧 timeline 计算完成后显示
5. 播放动画时对比差值实时更新
6. 重置后差值显示 "0"
7. 切换算法后面板更新为新算法名称
