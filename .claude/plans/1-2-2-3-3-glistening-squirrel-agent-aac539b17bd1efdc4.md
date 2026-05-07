# 修改计划：桶内柱子高度计算修复

## 文件路径
`d:\home\test-sort\src\utils\timeline-builders\build-bucket-timeline.ts`

## 当前错误状态（已确认）
- 第 253 行：`const bucketMax = Math.max(...bucket, 1);`  ← 使用当前帧桶内最大值，导致高度跳变
- 第 273 行：`height: Math.max(6, Math.round((value / bucketMax) * innerHeight)),` ← 附带注释"修复1"

---

## 修改清单（共 5 处）

### 修改 1：`createBucketFrame` 参数类型新增字段
- **位置**：第 195 行 `activeBucketIndex?: number;` 之后
- **操作**：插入新行
- **插入内容**：
  ```ts
    bucketFinalMaxMap?: Map<number, number>;
  ```

### 修改 2：`createBucketFrame` 解构处新增字段
- **位置**：第 209 行 `activeBucketIndex,` 之后（解构块内）
- **操作**：插入新行
- **插入内容**：
  ```ts
      bucketFinalMaxMap,
  ```

### 修改 3：替换 `bucketMax` 计算方式（共 2 小处）

#### 3a：替换 bucketMax 赋值（第 252-253 行）
- **旧代码**：
  ```ts
    // 修复1：用桶内最大值做缩放，保证每桶最高柱撑满 innerHeight，消除高度方向溢出
    const bucketMax = Math.max(...bucket, 1);
  ```
- **新代码**：
  ```ts
    // 用该桶历史最终最大值归一化，保证高度稳定不随帧跳变；无预计算值时回退到全局 maxValue
    const bucketMax = bucketFinalMaxMap?.get(bucketIndex) ?? maxValue;
  ```

#### 3b：替换 height 行注释（第 272-273 行）
- **旧代码**：
  ```ts
          // 修复1：高度基于桶内最大值缩放
          height: Math.max(6, Math.round((value / bucketMax) * innerHeight)),
  ```
- **新代码**：
  ```ts
          // 高度基于桶的历史最终最大值缩放，动画过程中高度稳定
          height: Math.max(6, Math.round((value / bucketMax) * innerHeight)),
  ```

### 修改 4：在 `buildBucketTimeline` 入口预计算 `bucketFinalMaxMap`
- **位置**：第 349 行 `const { steps, originalValues, ... } = params;` 之后，第 351 行 `let mainValues = [...originalValues];` 之前
- **操作**：插入空行 + 预计算块
- **插入内容**：
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

### 修改 5：三处 `createBucketFrame({...})` 调用传入参数

#### 5a：初始帧（第 353-363 行）
- 最后字段 `bucketStateTags: new Map(),` 之后插入：
  ```ts
      bucketFinalMaxMap,
  ```

#### 5b：from 帧（第 375-388 行）
- 最后字段 `activeBucketIndex,` 之后插入：
  ```ts
      bucketFinalMaxMap,
  ```

#### 5c：to 帧（第 419-432 行）
- 最后字段 `activeBucketIndex,` 之后插入：
  ```ts
      bucketFinalMaxMap,
  ```

---

## 修改顺序建议

按从下到上的行号顺序修改可以避免行号偏移影响后续定位（也可按 1→5 顺序，但每次修改后行号会偏移）。

实际建议按 **1 → 2 → 3 → 4 → 5** 顺序，因为每次 Edit 工具定位使用的是文本内容匹配，而不是行号，所以行号偏移不影响正确性。
