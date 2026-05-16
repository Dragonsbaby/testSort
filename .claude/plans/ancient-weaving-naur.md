# 堆排序可视化优化计划

## Context

基于对堆排序动画的全面观察（截图 + 源码分析），当前实现已完成主要的语义修正（latest/compare预告/虚线过滤），报告识别出一个视觉可读性问题和若干可进一步提升的细节。

**已确认现状（无需改动）：**
- sift-down 根节点已用 `"latest"`（墨绿）标记 ✓
- 阶段二提取堆顶已有 compare 预告步骤 + 黄色虚线 ✓
- 父子 compare 已过滤掉虚线 ✓
- sorted 状态已持久化累积 ✓

**待优化问题（本次改动目标）：**

1. **数组区下标不可读**：`drawHeapEntity` 中 `displayIndex` 颜色 `"#445"` 在深色背景 `#080d18` 下几乎不可见
2. **树形节点缺少 displayIndex 标注**：树节点只显示值，没有位置下标，用户无法对照数组理解层级关系
3. **sorted 节点被 comparing/swapping 覆盖**：阶段二提取时，堆顶（index=0）已是逻辑上的"最终最大值"，但 swap 时显示红色，sorted 的"最大堆顶"语义丢失（属于设计取舍，不改）

本次实施**改动一**（最高优先级）和**改动二**（视觉增强）。

---

## 改动一：修复数组区下标颜色（`useCanvasRenderer.ts`）

**文件**：`src/composables/useCanvasRenderer.ts`  
**位置**：`drawHeapEntity` 函数，第 303 行

```ts
// 改前
ctx.fillStyle = "#445";

// 改后
ctx.fillStyle = "rgba(160, 185, 220, 0.65)";
```

选色依据：与树节点默认文字色 `#c0d8f8` 同色系（蓝灰），但降低亮度和透明度，区分于节点内的值文字，同时在深色背景上可见。

---

## 改动二：树形节点补充 displayIndex 标注（`useCanvasRenderer.ts`）

**文件**：`src/composables/useCanvasRenderer.ts`  
**位置**：`drawHeapEntity` 函数，在绘制 `heap-array-node` 下标的 `if` 块之后，添加 `heap-tree-node` 的下标绘制

```ts
// 现有代码（第 300-305 行）
if (entity.kind === "heap-array-node") {
  ctx.font = '8px "JetBrains Mono", monospace';
  ctx.textBaseline = "top";
  ctx.fillStyle = "#445";
  ctx.fillText(String(entity.displayIndex), entity.x, entity.y + radius + 4);
}

// 改后（同时修复颜色 + 补充树节点下标）
if (entity.kind === "heap-array-node" || entity.kind === "heap-tree-node") {
  ctx.font = '8px "JetBrains Mono", monospace';
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(160, 185, 220, 0.65)";
  ctx.fillText(String(entity.displayIndex), entity.x, entity.y + radius + 4);
}
```

树节点 displayIndex 显示在圆心正下方（`y + radius + 4`），与数组节点位置逻辑一致，字号 8px 不遮挡节点内的值文字。

---

## 修改文件

- `src/composables/useCanvasRenderer.ts`（仅 `drawHeapEntity` 函数，约 5 行）

---

## 验证

用浏览器打开堆排序动画：
1. 数组映射区每个节点圆心下方应显示可见的蓝灰色下标（对比度明显高于修改前）
2. 树形视图每个节点圆心下方应显示对应的数组下标（0-based），便于对照
3. 颜色不应遮挡节点内的值文字（因为文字在圆心中心，下标在圆下方）
4. sorted（绿色）节点的下标仍然可见（`rgba` 颜色不被节点颜色影响，因为是独立 fillStyle）
