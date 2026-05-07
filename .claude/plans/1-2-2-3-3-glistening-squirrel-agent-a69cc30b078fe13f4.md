# 修复计划：桶排序可视化桶内柱子越界问题

## 文件路径
`src/utils/timeline-builders/build-bucket-timeline.ts`

## 现状分析

读取文件后，确认以下关键信息：

### 已存在的错误修复（需替换）
- 第 253 行：`const bucketMax = Math.max(...bucket, 1);`
  - **问题**：用当前帧桶内实际值的最大值做缩放，会导致高度随帧跳变（早期帧桶内元素少时柱子撑满高度，后续帧加入更大值后柱子高度突变缩小）

### 已正确存在的修复（保留）
- 第 256 行：`const xMax = region.x + region.width - BUCKET_INNER_PADDING_X - barWidth;`
- 第 269 行：`x: Math.min(region.x + BUCKET_INNER_PADDING_X + position * (barWidth + barGap), xMax),`
  - 这两行水平越界保护已经正确，无需修改

### 需要修改的位置总结

| # | 位置 | 行号 | 修改内容 |
|---|------|------|----------|
| 1 | `createBucketFrame` 参数类型 | 183–196 | 新增 `bucketFinalMaxMap?: Map<number, number>` |
| 2 | `createBucketFrame` 解构块 | 197–210 | 新增 `bucketFinalMaxMap,` |
| 3 | `buildBucketTimeline` 入口 | 349 行之后 | 插入预计算 `bucketFinalMaxMap` 的代码块 |
| 4 | 初始帧 `createBucketFrame({...})` | 353–363 | 参数末尾加 `bucketFinalMaxMap,` |
| 5 | `from` 帧 `createBucketFrame({...})` | 375–388 | 参数末尾加 `bucketFinalMaxMap,` |
| 6 | `to` 帧 `createBucketFrame({...})` | 419–432 | 参数末尾加 `bucketFinalMaxMap,` |
| 7 | `bucketEntities` 构建块中 `bucketMax` | 253 | 将错误的 `Math.max(...bucket, 1)` 替换为 `bucketFinalMaxMap?.get(bucketIndex) ?? maxValue` |

---

## 详细修改步骤

### Step 1：`createBucketFrame` 参数类型新增 `bucketFinalMaxMap`

**位置**：第 195 行 `activeBucketIndex?: number;` 之后

**修改前**：
```ts
  activeBucketIndex?: number;
}): FrameState {
```

**修改后**：
```ts
  activeBucketIndex?: number;
  bucketFinalMaxMap?: Map<number, number>;
}): FrameState {
```

---

### Step 2：`createBucketFrame` 解构块新增 `bucketFinalMaxMap`

**位置**：第 209 行 `activeBucketIndex,` 之后

**修改前**：
```ts
    activeBucketIndex,
  } = params;
```

**修改后**：
```ts
    activeBucketIndex,
    bucketFinalMaxMap,
  } = params;
```

---

### Step 3：`buildBucketTimeline` 入口插入 `bucketFinalMaxMap` 预计算

**位置**：第 349 行解构行之后、第 351 行 `let mainValues` 之前

**插入内容**：
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

---

### Step 4：初始帧 `createBucketFrame({...})` 末尾加 `bucketFinalMaxMap,`

**位置**：第 353–363 行的初始帧调用，`bucketStateTags: new Map(),` 之后

**修改前**：
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
  });
```

**修改后**：
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
    bucketFinalMaxMap,
  });
```

---

### Step 5：`from` 帧 `createBucketFrame({...})` 末尾加 `bucketFinalMaxMap,`

**位置**：第 375–388 行，`activeBucketIndex,` 之后

**修改前**：
```ts
    const from = createBucketFrame({
      ...
      activeBucketIndex,
    });
```

**修改后**：
```ts
    const from = createBucketFrame({
      ...
      activeBucketIndex,
      bucketFinalMaxMap,
    });
```

---

### Step 6：`to` 帧 `createBucketFrame({...})` 末尾加 `bucketFinalMaxMap,`

**位置**：第 419–432 行，`activeBucketIndex,` 之后

**修改前**：
```ts
    const to = createBucketFrame({
      ...
      activeBucketIndex,
    });
```

**修改后**：
```ts
    const to = createBucketFrame({
      ...
      activeBucketIndex,
      bucketFinalMaxMap,
    });
```

---

### Step 7：替换错误的 `bucketMax` 计算

**位置**：第 253 行

**修改前**：
```ts
    // 修复1：用桶内最大值做缩放，保证每桶最高柱撑满 innerHeight，消除高度方向溢出
    const bucketMax = Math.max(...bucket, 1);
```

**修改后**：
```ts
    // 用该桶历史最终最大值归一化，保证高度稳定不随帧跳变；无预计算值时回退到全局 maxValue
    const bucketMax = bucketFinalMaxMap?.get(bucketIndex) ?? maxValue;
```

同步更新第 273 行注释（该注释描述错误的"桶内最大值"做法）：
```ts
        // 修复2（已保留）：x 坐标不超过 xMax
        // 高度基于桶的历史最终最大值缩放，动画过程中高度稳定
        height: Math.max(6, Math.round((value / bucketMax) * innerHeight)),
```

---

## 执行顺序

按以下顺序执行 Edit 操作，避免行号偏移干扰：

1. Step 1（类型声明，183–196）
2. Step 2（解构块，197–210）
3. Step 7（`bucketMax` 替换，253）——保持在 Step 3 之前，避免插入行后行号偏移
4. Step 3（入口插入，349）
5. Step 4（初始帧调用，363）
6. Step 5（from 帧调用，388）
7. Step 6（to 帧调用，432）

## 完成后检查点

1. `bucketFinalMaxMap` 在 `buildBucketTimeline` 入口处由遍历 `steps` 得出 ✓
2. `createBucketFrame` 类型声明有 `bucketFinalMaxMap?: Map<number, number>` ✓
3. `createBucketFrame` 解构块有 `bucketFinalMaxMap,` ✓
4. 三处 `createBucketFrame(...)` 调用都传入了 `bucketFinalMaxMap,` ✓
5. `bucketEntities` 中 `height` 使用 `bucketMax`（来自 `bucketFinalMaxMap?.get(bucketIndex) ?? maxValue`） ✓
6. `x` 使用 `Math.min(..., xMax)` 包裹（已有，保留不变） ✓
