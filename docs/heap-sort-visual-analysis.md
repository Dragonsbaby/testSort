# 堆排序可视化分析报告

## 整体布局

- **上方**：二叉堆树形视图（圆形节点 + 边线）
- **下方**：数组映射区（与树形节点一一对应的圆形节点）
- 两区域同步高亮：同一元素的 `tree-N` 与 `array-N` 同时着色

---

## 颜色语义

| 状态 | 颜色 | 含义 |
|------|------|------|
| 默认 | 蓝色 `#4a9eff` | 未处理节点 |
| comparing | 黄色 `#ffcc00` | 当前比较的两个节点 |
| swapping | 红色 `#ff5c5c` | 正在交换的节点 |
| sorted | 绿色 `#33d17a` | 已就位节点（阶段二提取完成的尾部元素） |
| pending | 青色 `#00c8d4` | 当前堆有效范围内的节点 |
| latest | 墨绿 `#4ecdc4` | sift-down 当前锚定节点 |

---

## 动画阶段

### 阶段一：建堆（步骤 1~31）

从最后一个非叶子节点向上依次执行 sift-down。每次对比父子节点时，父节点与两子节点标为黄色（comparing）；若需要下沉则变红（swapping）。树形结构从无序逐渐调整为最大堆。

### 阶段二：提取排序（步骤 32~128）

每轮循环分四步：

1. **预告**：根节点与堆尾节点之间出现黄色虚线（guide overlay），提示即将交换
2. **swap**：根节点与堆尾交换，使用抛物线弧形（arc）轨迹动画，节点变红
3. **就位**：堆尾节点变绿（sorted），绿色节点从数组右侧向左累积
4. **sift-down**：对新根恢复堆性质，内部比较/交换使用直线（linear）轨迹

### 结束状态（步骤 128/128）

所有节点变绿，数组从小到大排列完成。

---

## 代码层面关键发现

**1. 两种 swap 的轨迹区分**（`build-heap-timeline.ts:243`）

```ts
const isRootExtractSwap = semantic.type === "swap"
  && semantic.indices.includes(0)
  && Math.abs(semantic.indices[0] - semantic.indices[1]) > 1;
// isRootExtractSwap → "arc"（抛物线），否则 → "linear"（直线）
```

根提取 swap 跨度大，用弧线强调；sift-down 内部 swap 相邻层级，用直线保持简洁。

**2. 非父子 compare 才绘制虚线**（`build-heap-timeline.ts:228`）

```ts
const isParentChild = b === 2*a+1 || b === 2*a+2 || a === 2*b+1 || a === 2*b+2;
if (!isParentChild) {
  // 绘制黄色虚线 guide overlay
}
```

正常父子比较不画虚线，避免视觉噪音；仅跨层比较时才额外标注。

**3. sorted 状态持久化**（`build-heap-timeline.ts:8`）

```ts
const nextSorted = new Set(previousSorted);
// sorted 节点通过 Set 累积，一旦标绿不会回退
```

**4. 数组区下标颜色过暗**（`useCanvasRenderer.ts:303`）

```ts
ctx.fillStyle = "#445"; // 深灰，在深色背景下几乎不可见
ctx.fillText(String(entity.displayIndex), ...);
```

数组节点的 `displayIndex` 下标文字颜色与背景接近，可读性差，是一个待优化点。
