# Bucket Sort 可视化修复设计文档

日期：2026-05-08

## 背景

桶排序可视化存在 7 个视觉 / 动画问题，本文档描述修复方案。

---

## 问题 & 修复方案

### 问题 1：桶内柱高应按全局比例，而非桶内自适应

**根因：** `createBucketFrame`（build-bucket-timeline.ts:257）用 `bucketFinalMaxMap` 对每个桶单独归一化高度，导致不同桶的柱高尺度不一致。

**修复：**
- 删除 `bucketFinalMaxMap` 的预计算逻辑（build-bucket-timeline.ts:360-370）和所有引用。
- 桶内柱高统一用全局 `maxValue = Math.max(...originalValues)` 归一化，公式与主数组相同：`(value / globalMaxValue) * 主数组有效渲染高度`。
- 桶区高度需足够容纳最高柱，因此结合问题 2 的布局调整确保空间充足。

---

### 问题 2：移除分桶区分隔带 + 百分比标签，桶区加高

**根因：** `buildBucketLayout` 分配了 7% 高度给分隔带；`buildBucketOverlays` 生成了 `bucket-separator-label`、`bucket-divider`、`bucket-range-*` 三类 overlay。

**修复：**

**bucket-layout.ts：**
- `separatorHeight` 改为固定 `4`（仅作视觉间距，不再有文字和虚线）。
- `mainHeight` 从 `height * 0.42` 调整为 `height * 0.38`，给桶区让出更多空间。
- `BUCKET_INNER_PADDING_TOP` 从 40 降到 28（节省标签占用空间）。

**build-bucket-timeline.ts `buildBucketOverlays`：**
- 删除 `bucket-separator-label` overlay 的生成。
- 删除 `bucket-divider` overlay 的生成。
- 删除 `bucket-range-*` overlay 的生成（`getBucketRangeLabel` 函数可同步删除）。

---

### 问题 3：Bucket 编号从 1 开始

**根因：** overlay 文字 `Bucket ${bucketIndex}`，bucketIndex 从 0 开始。

**修复：** 改为 `Bucket ${bucketIndex + 1}`（仅改标题 overlay 文字，bucketIndex 内部逻辑不变）。

---

### 问题 4：桶内 swap 交叉平移动画 bug 修复

**根因（需调试确认）：** `swapEntityIdPairs` 已生成并传入 `transition`，但 `interpolate-entity.ts` 中 `interpolateEntities` 并未处理 `swapEntityIdPairs` 字段——只对 `movingEntityIds` 做特殊路径，swap pair 的"交叉起点"逻辑实际上没有实现，导致两根柱子只做普通 `lerp(from.x, to.x)`，因为 from/to 的 x 坐标在 swap 后已经是交换好的，lerp 结果就是原地不动（高度变化来自 height lerp）。

**修复：**
在 `interpolateEntities`（interpolate-entity.ts:46）中增加 swap pair 处理：
- 遍历 `transition.swapEntityIdPairs`，对每对 `[idA, idB]`：
  - entity A 的 from.x = B 在 toEntities 中的 x（从 B 的目标位置出发），to.x = A 在 toEntities 中的 x
  - entity B 的 from.x = A 在 toEntities 中的 x，to.x = B 在 toEntities 中的 x
  - x 用 `easeInOutCubic` 插值，y / height / style 正常 lerp
- 效果：两根柱子从彼此的目标位置出发，交叉滑向自己的目标位置（真正的对穿效果）。

---

### 问题 5：桶内柱宽放宽

**根因：** `barWidth` 上限为 20px，当桶内元素较少时柱子仍然很细。

**修复（build-bucket-timeline.ts:249-251）：**
- `barWidth` 上限从 20 改为 36。
- `barGap` 下限保持 2，上限提高到 8。
- 公式：`barWidth = clamp(floor((innerWidth - gap * (n-1)) / n), 10, 36)`。

---

### 问题 6：scatter 分桶动画 — 柱子本体从主数组飞入桶

**根因：** 当前 ghost entity 的 `from` 状态使用 `GHOST_BASE_STYLE`（半透明青色），视觉上是叠影而非柱子本体；主数组原柱子在 `from` 帧仍然可见（opacity 1），飞行结束后才在 `to` 帧消失。

**修复（build-bucket-timeline.ts）：**

`from` 帧 ghost entity：
- 起点位置 = 主数组 source bar 的位置（已正确）
- `style` 改为 source bar 的样式（`MAIN_BASE_STYLE` 加当前 stateTags 修饰），`opacity = 1`
- `kind` 改为 `"main-bar"`（让渲染器用主数组柱子样式绘制）

`from` 帧主数组中 source bar：
- `opacity` 设为 0（立刻消失，柱子"已被拿走"）

`to` 帧 ghost entity：
- 终点位置 = 桶内目标 bar 的位置（已正确）
- `style` 改为目标桶的 bucketBaseStyle，`opacity = 0`（落地后消失，由桶内真实 bar 接替显示）

动画参数：`curveHeight` 从 40 提高到 70，让弧线更明显。

---

### 问题 7：gather 回收动画 — 柱子本体从桶飞回主数组

**根因：** 与问题 6 对称，ghost 使用半透明样式，桶内原柱子未立刻隐藏。

**修复（build-bucket-timeline.ts）：**

`from` 帧 ghost entity：
- 起点 = 桶内第 0 个 bar 位置
- `style` 改为该桶的 `getBucketBarStyle(bucketIndex)`，`opacity = 1`
- `kind` 改为 `"bucket-bar"`

`from` 帧桶内 source bar（position 0）：
- `opacity` 设为 0（立刻消失）

`to` 帧 ghost entity：
- 终点 = 主数组 dest bar 位置
- `style` 改为 `sorted` 状态样式（绿色），`opacity = 0`

动画参数：`curveHeight` 同样提高到 70，`mode: "vertical-first"` 保留。

---

## 受影响文件

| 文件 | 改动类型 |
|------|---------|
| `src/utils/layout/bucket-layout.ts` | 布局参数调整（问题 2） |
| `src/utils/timeline-builders/build-bucket-timeline.ts` | 问题 1/2/3/4/5/6/7 主要改动 |
| `src/utils/frame/interpolate-entity.ts` | 问题 4 swap pair 插值逻辑 |

---

## 不改动范围

- `useCanvasRenderer.ts` 绘制逻辑不变
- `sortingAlgorithms.ts` step 生成逻辑不变
- 其他算法（bubble/insertion/merge/heap/quick）不受影响
