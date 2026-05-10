# Bucket Sort Scatter Animation - 3 Visual Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复桶排序 scatter 动画的三个视觉 bug：①原始柱子在飞行时重新浮现、②ghost 飞行起始宽度未过渡（突兀）、③ghost 落点与桶内已有 bar 重叠。

**Architecture:** 全部修改集中在 `createBucketFrame` 函数内，分别在 `to` 帧处理主数组 opacity、ghost `from` 帧宽度改用主数组原宽度、以及 `to` 帧桶内落点 bar opacity 置 0。不新增文件，不引入新函数。

**Tech Stack:** TypeScript, Canvas, Vue 3

---

## 文件映射

| 文件 | 修改类型 | 修改内容 |
|------|---------|---------|
| `src/utils/timeline-builders/build-bucket-timeline.ts` | Modify | 三处定点修改（行 270、292、249 附近） |

---

## Context：三个 Bug 的根本原因

### Bug 1：原始柱子飞行过程中重新浮现
- **位置：** [build-bucket-timeline.ts:297-300](../src/utils/timeline-builders/build-bucket-timeline.ts#L297-L300)
- **原因：** 第 297 行条件 `if (frameRole === "from")` 只在 `from` 帧将 `main-${sourceIndex}` opacity 置 0；在 `to` 帧（第 200 行）该实体默认 opacity: 1。
- **结果：** 插值时 `lerp(0, 1, progress)` —— 原始柱子随动画进度从不可见渐变为完全可见，与 ghost 同时出现。

### Bug 2：ghost 飞行体在 from 帧宽度突变
- **位置：** [build-bucket-timeline.ts:292](../src/utils/timeline-builders/build-bucket-timeline.ts#L292)
- **原因：** ghost `from` 帧使用的是 `tBarWidth`（桶内宽度），但主数组柱子宽度通常是 `source.width`（如 24px），而桶内宽度可能是 40px+（元素少时）。飞行开始瞬间发生宽度突变。
- **修复：** ghost `from` 帧使用 `source.width`，`to` 帧保持 `tBarWidth`，`interpolateEntity` 的 `lerp(from.width, to.width, progress)` 自动实现飞行过程中渐变过渡。

### Bug 3：ghost 落点与桶内已有 bar 重叠
- **位置：** [build-bucket-timeline.ts:235-253](../src/utils/timeline-builders/build-bucket-timeline.ts#L235-L253)
- **原因：** `to` 帧中 `bucketEntities` 包含本次 scatter 后的完整桶内布局（新元素已加入），`bucket-${bucketIndex}-${bucketPos}` 这个 bar 在 `to` 帧以 `opacity: 1` 渲染；而 ghost 同时也在飞向该位置（to 帧 opacity 从 1 渐变到 0），两者在同一坐标叠加。
- **修复：** 在 `to` 帧（且是 `bucket-scatter` 语义时），将刚飞入的那个桶内 bar（`position === bucketPos`）opacity 置 0，待下一步骤 `from` 帧才以 1 渲染——ghost 落地消失后无缝由真实 bar 接替。

---

## Task 1：修复 Bug 1 —— `to` 帧同步隐藏主数组原始柱子

**Files:**
- Modify: `src/utils/timeline-builders/build-bucket-timeline.ts:296-300`

### 当前代码（296-300 行）

```typescript
      // source bar 在 from 帧立刻隐藏（ghost 接替显示，主数组原柱子消失）
      if (frameRole === "from") {
        const idx = mainEntities.findIndex((e) => e.id === `main-${sourceIndex}`);
        if (idx !== -1) mainEntities[idx] = { ...mainEntities[idx], opacity: 0 };
      }
```

### 目标代码

```typescript
      // source bar 在 from/to 帧均隐藏（ghost 接替，原柱子全程不可见）
      if (frameRole === "from" || frameRole === "to") {
        const idx = mainEntities.findIndex((e) => e.id === `main-${sourceIndex}`);
        if (idx !== -1) mainEntities[idx] = { ...mainEntities[idx], opacity: 0 };
      }
```

- [ ] **Step 1：定位并修改条件**

  在 [build-bucket-timeline.ts:297](../src/utils/timeline-builders/build-bucket-timeline.ts#L297) 将：
  ```typescript
  if (frameRole === "from") {
  ```
  改为：
  ```typescript
  if (frameRole === "from" || frameRole === "to") {
  ```

- [ ] **Step 2：静态验证**

  用 Grep 确认该行改动唯一，无其他 `frameRole === "from"` 在相同上下文产生影响：
  ```
  grep -n 'frameRole' src/utils/timeline-builders/build-bucket-timeline.ts
  ```
  预期：只有第 270、297、330 行附近有 `frameRole` 引用，各自含义独立不互相影响。

---

## Task 2：修复 Bug 2 —— ghost `from` 帧保留主数组原宽度

**Files:**
- Modify: `src/utils/timeline-builders/build-bucket-timeline.ts:290-293`

### 当前代码（290-293 行）

```typescript
      ghostEntities.push(
        frameRole === "from"
          ? { ...source, id: ghostId, sourceId: source.sourceId, kind: "main-bar", width: tBarWidth, height: tBarHeight, opacity: 1, zIndex: 3, style: bucketBaseStyle, stateTags: [] }
          : { ...source, id: ghostId, sourceId: source.sourceId, kind: "main-bar", x: tBarX, y: tBarBaseY, width: tBarWidth, height: tBarHeight, opacity: 0, zIndex: 3, style: bucketBaseStyle, stateTags: [] },
      );
```

### 目标代码

`from` 帧保留 `source.width`（主数组原宽度），`to` 帧保持 `tBarWidth`（桶内宽度）：

```typescript
      ghostEntities.push(
        frameRole === "from"
          ? { ...source, id: ghostId, sourceId: source.sourceId, kind: "main-bar", width: source.width, height: tBarHeight, opacity: 1, zIndex: 3, style: bucketBaseStyle, stateTags: [] }
          : { ...source, id: ghostId, sourceId: source.sourceId, kind: "main-bar", x: tBarX, y: tBarBaseY, width: tBarWidth, height: tBarHeight, opacity: 0, zIndex: 3, style: bucketBaseStyle, stateTags: [] },
      );
```

- [ ] **Step 1：修改 ghost from 帧的 width 字段**

  在第 292 行，将 `width: tBarWidth` 改为 `width: source.width`（仅 `from` 帧那一行）。

- [ ] **Step 2：静态验证**

  确认 `source.width` 是主数组 bar 的宽度（第 198 行 `width: mainBarWidth`，值在 10-40px 之间）。`interpolateEntity` 的 `lerp(from.width, to.width, progress)` 将自动插值，无需额外修改。

---

## Task 3：修复 Bug 3 —— `to` 帧桶内落点 bar 延迟显示

**Files:**
- Modify: `src/utils/timeline-builders/build-bucket-timeline.ts:235-253`（`bucketEntities` 构建段）

### 当前代码（235-253 行）

```typescript
    return bucket.map((value, position) => {
      const stateTags = bucketStateTags.get(`${bucketIndex}-${position}`) ?? [];
      return {
        id: `bucket-${bucketIndex}-${position}`,
        sourceId: `bucket-${bucketIndex}-${value}-${position}`,
        kind: "bucket-bar",
        value,
        displayIndex: position + 1,
        x: Math.min(region.x + BUCKET_INNER_PADDING_X + position * (barWidth + barGap), xMax),
        y: barBaseY,
        width: barWidth,
        height: Math.min(innerHeight, Math.max(6, Math.round((value / bucketMax) * innerHeight))),
        opacity: 1,
        zIndex: 2,
        style: getStyleFromStateTags(stateTags, bucketBaseStyle),
        stateTags,
      } satisfies RenderableEntity;
    });
```

### 目标代码

在 `to` 帧且是 `bucket-scatter` 语义时，令 `position === bucketPos` 的那个 bar opacity 为 0：

```typescript
    return bucket.map((value, position) => {
      const stateTags = bucketStateTags.get(`${bucketIndex}-${position}`) ?? [];
      // to 帧 scatter 落点的 bar 保持隐藏，由 ghost 负责视觉，ghost 消失后下一步 from 帧才显示
      const isGhostTarget =
        frameRole === "to" &&
        semantic?.type === "bucket-scatter" &&
        bucketIndex === semantic.bucketIndex &&
        position === semantic.bucketPos;
      return {
        id: `bucket-${bucketIndex}-${position}`,
        sourceId: `bucket-${bucketIndex}-${value}-${position}`,
        kind: "bucket-bar",
        value,
        displayIndex: position + 1,
        x: Math.min(region.x + BUCKET_INNER_PADDING_X + position * (barWidth + barGap), xMax),
        y: barBaseY,
        width: barWidth,
        height: Math.min(innerHeight, Math.max(6, Math.round((value / bucketMax) * innerHeight))),
        opacity: isGhostTarget ? 0 : 1,
        zIndex: 2,
        style: getStyleFromStateTags(stateTags, bucketBaseStyle),
        stateTags,
      } satisfies RenderableEntity;
    });
```

**注意**：`bucketEntities` 构建时需要访问 `semantic`、`frameRole`、`bucketIndex`（外层循环变量）。检查第 207 行 `buckets.flatMap((bucket, bucketIndex) => ...)` ——`bucketIndex` 已是闭包变量，`semantic` 和 `frameRole` 也在 `createBucketFrame` 参数中，均可直接访问。

- [ ] **Step 1：在 bucketEntities 构建段添加 isGhostTarget 判断**

  在第 235 行 `return bucket.map((value, position) => {` 内，在 `const stateTags = ...` 行之后，插入：
  ```typescript
  const isGhostTarget =
    frameRole === "to" &&
    semantic?.type === "bucket-scatter" &&
    bucketIndex === semantic.bucketIndex &&
    position === semantic.bucketPos;
  ```
  并将原来的 `opacity: 1` 改为：
  ```typescript
  opacity: isGhostTarget ? 0 : 1,
  ```

- [ ] **Step 2：静态验证变量作用域**

  确认以下变量在 `buckets.flatMap` 回调内均可访问：
  - `frameRole`：`createBucketFrame` 参数，函数作用域，✓
  - `semantic`：`createBucketFrame` 参数，函数作用域，✓
  - `bucketIndex`：`flatMap` 回调参数（第二个参数），✓
  - `semantic.bucketPos`：`SemanticStep` 类型的可选字段，使用前有 `typeof semantic.bucketPos === "number"` 类型收窄，但此处 `semantic?.type === "bucket-scatter"` 已保证 bucketPos 存在；可使用 `semantic.bucketPos ?? -1` 保险起见。

---

## 验证

三处修改均在同一函数内，可直接在浏览器中运行桶排序动画验证：

1. 启动开发服务器查看动画
2. 播放桶排序，观察每次 scatter 步骤：
   - **Bug 1 验证：** 主数组原始柱子在飞行开始时消失，整个飞行过程中不再浮现
   - **Bug 2 验证：** ghost 飞行时宽度从主数组宽度平滑渐变到桶内宽度，无突变
   - **Bug 3 验证：** ghost 飞行过程中桶内落点处无重叠实体，ghost 消失后真实 bar 无缝显示

无测试文件（canvas 动画逻辑暂无单测），通过视觉验证。
