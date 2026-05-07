# 设计文档：桶排序 Canvas 三处视觉 Bug 修复

**日期：** 2026-05-07  
**状态：** 已确认，待实施

---

## 背景与动机

桶排序可视化存在三个明显视觉问题，影响演示效果：

1. **桶内柱子超出桶边界**：部分桶的柱子高度溢出桶区顶部
2. **桶内交换动画跳跃**：两个柱子互换时是"原地弧跳"而非直线平移对穿
3. **主数组区过矮 + 画布高度硬编码不同步**：元素多时主数组区视觉效果差，且 canvas 逻辑高度与实际渲染尺寸不一致

---

## 问题一：桶内柱子超出边界

### 根因

`build-bucket-timeline.ts` 第 265 行：

```ts
height: Math.max(6, Math.round((value / maxValue) * innerHeight)),
```

`maxValue` 是**全局主数组的最大值**，而非该桶内最大值。  
当某个桶里的元素都比较小（如 Bucket 0 含 1、2、3、4），最高柱子高度 `= (4/10) * innerHeight`，占 40%，不越界。  
但当桶的宽度有限、元素较多时，水平累积 `x + position * (barWidth + barGap)` 可能超出 `region.x + region.width`。

### 修复方案

1. **改用桶内最大值**：`const bucketMax = Math.max(...bucket, 1)`，柱子高度 `= (value / bucketMax) * innerHeight`，保证每桶最高柱撑满，视觉更饱满，彻底消除高度方向溢出
2. **加水平越界保护**：`x` 最大值限制为 `region.x + region.width - BUCKET_INNER_PADDING_X - barWidth`，防止柱子画出桶右边界

### 涉及文件

- `src/utils/timeline-builders/build-bucket-timeline.ts`（第 244-270 行）

---

## 问题二：桶内交换动画"跳跃"而非平移

### 根因

`build-bucket-timeline.ts` 第 443-452 行，`bucket-swap` 的 transition：

```ts
transition: {
  type: "arc",                          // ← arc 类型
  movingEntityIds: semantic.indices.map(...),  // ← 有 movingEntityIds
  // ❌ 没有 swapEntityIdPairs！
}
```

`interpolate-entity.ts` 中，`swapEntityIdPairs` 才是让 A 从 B 的旧位置出发、B 从 A 的旧位置出发的关键。  
没有它，每个元素只从"自身旧位置"弧跳到"自身新位置"，看起来就是原地向上跳然后落回，不是对穿平移。

### 修复方案

1. **改 transition type 为 `"linear"`**（直线平移），与主数组 swap 动画风格一致
2. **移除 `movingEntityIds`**（arc 类型才需要）
3. **添加 `swapEntityIdPairs`**：将参与交换的两个元素 id 构成 pair，让插值引擎实现 A↔B 交叉起点平移

具体：

```ts
// 修改前
transition: {
  type: "arc",
  movingEntityIds: semantic.indices.map((item) => `bucket-${semantic.bucketIndex}-${item}`),
  ...
}

// 修改后
const [posA, posB] = semantic.indices;
transition: {
  type: "linear",
  swapEntityIdPairs: [[
    `bucket-${semantic.bucketIndex}-${posA}`,
    `bucket-${semantic.bucketIndex}-${posB}`,
  ]],
  ...
}
```

### 涉及文件

- `src/utils/timeline-builders/build-bucket-timeline.ts`（第 433-452 行）

---

## 问题三：主数组区过矮 + 画布高度硬编码

### 根因

**两处不同步：**

- `SortBarCanvasBucket.vue` 第 26 行：`initialize(width - 40, Math.max(420, containerHeight - 40))`  
  → canvas 实际高度随容器动态计算
- `useSortAnimation.ts` 第 66 行：`height: 460`  
  → `buildBucketTimeline` 用 460 固定值计算所有坐标，与 canvas 实际尺寸不同步

**主数组区比例过小：**

- `bucket-layout.ts` 第 27 行：`mainHeight = height * 0.30`  
  → 460 × 30% = 138px，元素 10 个以上时柱子极矮

### 修复方案

**Step 1：让高度响应式传递**

`SortBarCanvasBucket.vue` 的 `canvas-ready` 事件目前只上报宽度，改为同时上报高度：

```ts
// 修改 emit 签名
emit("canvas-ready", { width: rect.width - 40, height: actualHeight });
```

`BucketSort.vue` 增加 `canvasHeightRef`，接收高度并传入 `useSortAnimation`。  
`useSortAnimation` 增加可选参数 `canvasHeight?: ToRef<number>`，`bucket` 分支使用该值替代硬编码 460。

**Step 2：调整主数组区比例**

`bucket-layout.ts` 第 27 行：

```ts
// 修改前
const mainHeight = Math.round(height * 0.30);
// 修改后
const mainHeight = Math.round(height * 0.42);
```

42% → 460px 时主数组区约 193px；560px 时约 235px，空间充裕。

**Step 3：桶排序容器最小高度提升**

`SortBarCanvasBucket.vue` 的 `.sort-bar-canvas` 样式：

```scss
// 修改前
min-height: 420px;
// 修改后
min-height: 560px;
```

同时 `onMounted` 和 `ResizeObserver` 中的 `Math.max(420, ...)` 改为 `Math.max(520, ...)`，保证逻辑层和样式层一致。

### 涉及文件

- `src/components/SortBarCanvasBucket.vue`（emit 签名、min-height、Math.max 基准值）
- `src/components/algorithms/BucketSort.vue`（接收 height 事件，维护 canvasHeightRef）
- `src/composables/useSortAnimation.ts`（增加 canvasHeight 参数，bucket 分支使用动态高度）
- `src/utils/layout/bucket-layout.ts`（mainHeight 比例 0.30 → 0.42）

---

## 涉及文件汇总

| 文件 | 修改内容 |
|---|---|
| `src/utils/timeline-builders/build-bucket-timeline.ts` | 桶内高度按桶内最大值缩放；水平越界保护；swap transition 改线性平移+swapEntityIdPairs |
| `src/utils/layout/bucket-layout.ts` | mainHeight 比例 0.30 → 0.42 |
| `src/components/SortBarCanvasBucket.vue` | emit 上报宽高；min-height 420→560；Math.max 基准 420→520 |
| `src/components/algorithms/BucketSort.vue` | 维护 canvasHeightRef，传入 useSortAnimation |
| `src/composables/useSortAnimation.ts` | 增加 canvasHeight 参数；bucket 分支使用动态高度 |

---

## 验证方式

1. 将数组设为 10 个元素，运行桶排序动画
2. **问题1验证**：观察各桶内柱子是否均在桶框内，最高柱撑满桶内高度
3. **问题2验证**：触发桶内 swap 步骤，观察两个柱子是否直线平移对穿（不再弧跳）
4. **问题3验证**：主数组区柱子高度可见，不再"矮矮一排"；切换不同元素数量（5/10/15）确认画布高度响应正常

---

## 不在本次范围内

- 其他排序算法的 Canvas 改动
- 桶排序步骤生成逻辑（sortingAlgorithms.ts）变更
- 整体布局响应式重构
