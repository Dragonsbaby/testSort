# 交换动画修复：Element-Based Entity ID 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `build-basic-timeline.ts` 中的 entity id 从 position-based（`main-${slotIndex}`）改为 element-based（`main-${displayIndex}`），使交换动画中柱子的高度、值、标签全程与元素绑定，视觉上呈现"元素在槽位间移动"而非"槽位内容被替换"。

**Architecture:** 每个 entity 的 `id` 改为 `main-${displayIndex}`，让同一个元素在 from/to 帧中保持相同 id；swap 步骤的 `to` 帧中，两根柱子只有 `x` 坐标互换（因为 slot 坐标固定），`height/value/displayIndex` 保持不变；`movingEntityIds` 和 `swapEntityIdPairs` 用 swap **前**的 displayIndexes 生成，与 from 帧的 entity id 对应。`interpolate-entity.ts` 无需改动，改造完成后 `isSwapMove` 冻结 height/value 的逻辑自然不再需要（但保留也无害，因为 element-based 后 from/to 的 height 本来就相同）。

**Tech Stack:** TypeScript, Vue 3，无新依赖

---

## 文件变更清单

| 文件 | 操作 | 改动说明 |
|------|------|----------|
| `src/utils/timeline-builders/build-basic-timeline.ts` | **修改** | 核心改动：id 改为 element-based，`movingEntityIds`/`swapEntityIdPairs` 用 from-displayIndexes |
| `src/utils/frame/interpolate-entity.ts` | **修改** | `isSwapMove` 冻结逻辑已不需要，但需确认 `buildSwapFromOverrides` 逻辑在新模型下仍正确（实际无需改动，验证即可） |

> `build-merge-timeline.ts`、`build-bucket-timeline.ts` 中也有 `main-${index}` 的 id，但它们的 swap 动画问题与本次修复范围不同，不在此计划内处理。

---

## 核心逻辑说明（理解改造前必读）

### 改造前（position-based）

```
from 帧（交换 slot 1 和 slot 3 前）：
  main-1: { id:"main-1", x:100, value:7, height:70, displayIndex:3 }
  main-3: { id:"main-3", x:300, value:3, height:30, displayIndex:7 }

to 帧（交换后，同 id 不同内容）：
  main-1: { id:"main-1", x:100, value:3, height:30, displayIndex:7 }  ← 高度已变！
  main-3: { id:"main-3", x:300, value:7, height:70, displayIndex:3 }  ← 高度已变！

动画 (progress: 0→1)，isSwapMove=true，height 冻结 from.height：
  main-1：从 x=300（交叉起点）→ x=100，高度全程保持 70  ✓
  main-3：从 x=100（交叉起点）→ x=300，高度全程保持 30  ✓

问题：这段逻辑看似对，但实际视觉出错。
原因：`effectiveFrom` 只覆盖了 x/y，id 还是 main-1/main-3。
      `isSwapMove` 判断依赖 from.id，能命中。
      但是 `...to` 先展开了 to 的所有字段，然后 height 用 from.height 覆盖。
      swap 交换的是值，但颜色(style)直接用 to.style（已变色），
      且整体逻辑依赖 hack，容易在其他步骤类型中出错。
```

### 改造后（element-based）

```
from 帧（交换前，id 跟随元素）：
  main-3: { id:"main-3", x:100, value:7, height:70, displayIndex:3 }  ← displayIndex=3 的元素
  main-7: { id:"main-7", x:300, value:3, height:30, displayIndex:7 }  ← displayIndex=7 的元素

to 帧（交换后，同一元素 id 不变，只有 x 坐标换了槽位）：
  main-7: { id:"main-7", x:100, value:3, height:30, displayIndex:7 }  ← 到 slot 1 的位置
  main-3: { id:"main-3", x:300, value:7, height:70, displayIndex:3 }  ← 到 slot 3 的位置

swapEntityIdPairs = [["main-3", "main-7"]]（用 from 帧的 displayIndexes 生成）

动画 (progress: 0→1)：
  main-3: effectiveFrom.x = from.main-7.x = 300，to.x = 300（slot 3 的位置）
    → 等等，这里 to.x 也是 300 吗？
```

> **⚠️ 关键洞察：** 改为 element-based 后，`to` 帧中同一元素的 `x` 坐标是目标槽位的 x，而不是原槽位。具体：
> - 元素 main-3（value=7）原在 slot 1（x=100），交换后到 slot 3（x=300）
> - 元素 main-7（value=3）原在 slot 3（x=300），交换后到 slot 1（x=100）
>
> 所以 `to` 帧：
> - `main-3`: x=300（slot 3）, value=7, height=70 ✓
> - `main-7`: x=100（slot 1）, value=3, height=30 ✓
>
> `buildSwapFromOverrides` 让：
> - main-3 从 x=100（from.main-7.x = from 的 slot 3 → 等等...）
>
> 需要重新梳理。`buildSwapFromOverrides` 做的是：
> - overrides.set("main-3", { x: fromB.x }) = { x: from["main-7"].x } = { x: 300 }
> - overrides.set("main-7", { x: fromA.x }) = { x: from["main-3"].x } = { x: 100 }
>
> 然后：
> - main-3: effectiveFrom.x = 300，to.x = 300 → lerp(300, 300, t) = **原地不动** ❌
>
> **这说明 element-based 后，`swapEntityIdPairs` 的交叉逻辑反而是多余的！**
> 因为 element-based 模型下，`from.x` 已经是元素的当前位置，`to.x` 已经是元素的目标位置，
> 直接 `lerp(from.x, to.x, t)` 就能产生正确的平移动画，**不需要交叉覆盖**。

### 改造后的正确动画链路

```
from 帧：
  main-3: { x:100, value:7, height:70 }   ← 元素在 slot 1
  main-7: { x:300, value:3, height:30 }   ← 元素在 slot 3

to 帧：
  main-3: { x:300, value:7, height:70 }   ← 元素移到 slot 3
  main-7: { x:100, value:3, height:30 }   ← 元素移到 slot 1

普通 lerp（无交叉覆盖）：
  main-3: x 从 100 → 300（向右平移）✓ 高柱向右走
  main-7: x 从 300 → 100（向左平移）✓ 矮柱向左走

结论：element-based 后，swapEntityIdPairs 不再需要，
      直接用 linear 过渡即可，fromMap 匹配正常，动画天然正确。
```

---

## Task 1：修改 `createBasicFrame`，将 entity id 改为 element-based

**Files:**
- Modify: `src/utils/timeline-builders/build-basic-timeline.ts`

- [ ] **Step 1：理解当前 `createBasicFrame` 的 entity 生成逻辑**

读取 `src/utils/timeline-builders/build-basic-timeline.ts` 第 21-40 行，确认：
- `id: \`main-${index}\`` 其中 `index` 是 `values.map` 的遍历下标（= slotIndex）
- `displayIndex: displayIndexes[index]` 是当前槽位存放的元素的原始编号（1-based）

- [ ] **Step 2：修改 `createBasicFrame` 中的 entity id**

将 `src/utils/timeline-builders/build-basic-timeline.ts` 第 26 行：

```typescript
      id: `main-${index}`,
```

改为：

```typescript
      id: `main-${displayIndexes[index]}`,
```

同时第 27 行的 `sourceId` 保持不变（已经是 element-based：`value-${displayIndexes[index]}`）。

修改后完整的 entity 对象（第 25-39 行）应为：

```typescript
    return {
      id: `main-${displayIndexes[index]}`,
      sourceId: `value-${displayIndexes[index]}`,
      kind: "main-bar",
      value,
      displayIndex: displayIndexes[index],
      x: slots[index]?.x ?? 0,
      y: slots[index]?.y ?? 0,
      width: slots[index]?.width ?? 0,
      height: Math.max(5, Math.round((value / maxValue) * (slots[index]?.maxHeight ?? 0))),
      opacity: 1,
      zIndex: 1,
      style,
      stateTags,
    };
```

- [ ] **Step 3：确认 `stateTagsByIndex` 用的仍是 slotIndex，无需改动**

`stateTagsByIndex.get(index)` 中的 `index` 是 `values.map` 的遍历下标（slotIndex），与 semantic.indices（也是 slotIndex）一致。entity id 改为 element-based 不影响 stateTag 的查找逻辑。**无需改动。**

---

## Task 2：修改 `buildBasicTimeline` 中的 transition 生成逻辑

**Files:**
- Modify: `src/utils/timeline-builders/build-basic-timeline.ts`

**背景：** element-based 改造后，`from` 帧和 `to` 帧中同一元素 id 相同，`lerp(from.x, to.x)` 天然产生正确平移。`swapEntityIdPairs` 的交叉起点覆盖逻辑不再需要。`movingEntityIds` 也不再需要（用于 arc/path 轨迹，linear swap 不用）。

- [ ] **Step 1：在 swap 前保存 from-displayIndexes 快照**

在 `buildBasicTimeline` 的 `steps.map` 回调中，紧接 `const from = structuredClone(currentFrame)` 之后、在 displayIndexes 更新之前，添加一行保存快照：

找到第 121-132 行：
```typescript
  return steps.map((semantic, index) => {
    const from = structuredClone(currentFrame) as FrameState;
    const { nextSorted, stateTagsByIndex } = buildStateTags(semantic, sortedIndices);
    sortedIndices = nextSorted;

    if (semantic.type === "swap") {
      displayIndexes = semantic.indices.reduce((nextDisplayIndexes, index, currentIndex, indices) => {
        const pairIndex = indices[currentIndex === 0 ? 1 : 0];
        nextDisplayIndexes[index] = displayIndexes[pairIndex];
        return nextDisplayIndexes;
      }, [...displayIndexes]);
    }
```

改为（添加 `fromDisplayIndexes` 快照，并将 displayIndexes 更新移到 `to` 帧构建之前）：

```typescript
  return steps.map((semantic, index) => {
    const from = structuredClone(currentFrame) as FrameState;
    const { nextSorted, stateTagsByIndex } = buildStateTags(semantic, sortedIndices);
    sortedIndices = nextSorted;

    // 保存 swap 前的 displayIndexes 快照，用于生成 movingEntityIds（与 from 帧 id 对应）
    const fromDisplayIndexes = [...displayIndexes];

    if (semantic.type === "swap") {
      displayIndexes = semantic.indices.reduce((nextDisplayIndexes, index, currentIndex, indices) => {
        const pairIndex = indices[currentIndex === 0 ? 1 : 0];
        nextDisplayIndexes[index] = displayIndexes[pairIndex];
        return nextDisplayIndexes;
      }, [...displayIndexes]);
    }
```

- [ ] **Step 2：修改 transition 的 `movingEntityIds` 和 `swapEntityIdPairs`**

找到第 160-169 行的 transition 对象：

```typescript
      transition: {
        type: semantic.type === "swap" ? "linear" : "instant",
        duration: semantic.type === "swap" ? swapDuration : stepDuration,
        easing: semantic.type === "swap" ? "easeInOutCubic" : "linear",
        movingEntityIds: semantic.type === "swap" ? semantic.indices.map((item) => `main-${item}`) : undefined,
        swapEntityIdPairs: semantic.type === "swap" && semantic.indices.length === 2
          ? [[ `main-${semantic.indices[0]}`, `main-${semantic.indices[1]}`]]
          : undefined,
        styleTransition: semantic.type !== "swap",
      },
```

改为：

```typescript
      transition: {
        type: semantic.type === "swap" ? "linear" : "instant",
        duration: semantic.type === "swap" ? swapDuration : stepDuration,
        easing: semantic.type === "swap" ? "easeInOutCubic" : "linear",
        // element-based 后：from/to 帧同一元素 id 相同，lerp(from.x, to.x) 天然正确，
        // 不再需要 swapEntityIdPairs 的交叉起点覆盖逻辑
        movingEntityIds: undefined,
        swapEntityIdPairs: undefined,
        styleTransition: semantic.type !== "swap",
      },
```

> **说明：** `movingEntityIds` 在 `interpolate-entity.ts` 中仅用于触发 arc/path 轨迹（`transition.type === "arc"` 或 `"path"`），swap 用的是 `"linear"` 类型，所以 `movingEntityIds` 对 swap 而言本来就没有实际作用，可以安全移除。

- [ ] **Step 3：清理 `fromDisplayIndexes` 变量（如果 movingEntityIds 不再需要）**

由于 Task 2 Step 2 中我们不再使用 `fromDisplayIndexes`（`movingEntityIds` 和 `swapEntityIdPairs` 都设为 `undefined`），需要删除 Task 2 Step 1 中添加的那一行，避免 TypeScript 出现 unused variable 警告。

将 Task 2 Step 1 中添加的这行删除：
```typescript
    // 保存 swap 前的 displayIndexes 快照，用于生成 movingEntityIds（与 from 帧 id 对应）
    const fromDisplayIndexes = [...displayIndexes];
```

最终 Task 2 的改动只有一处：在 transition 对象中将 `movingEntityIds` 和 `swapEntityIdPairs` 设为 `undefined`。

---

## Task 3：清理 `interpolate-entity.ts` 中已无效的 `isSwapMove` 冻结逻辑

**Files:**
- Modify: `src/utils/frame/interpolate-entity.ts`

**背景：** element-based 改造后，from/to 帧中同一元素的 `height`、`value`、`displayIndex` 本来就相同（元素属性不变，只有 `x` 在动），所以 `isSwapMove` 冻结这些字段的逻辑已经是 no-op。同时 `swapEntityIdPairs` 已设为 `undefined`，`buildSwapFromOverrides` 永远不会被调用。

可以选择：
1. **保留**：代码继续工作，只是冻结逻辑变成了等效操作（from.height === to.height）
2. **清理**：移除 `isSwapMove` 相关冻结代码，使逻辑更清晰

本计划选择**清理**，让代码意图更明确。

- [ ] **Step 1：移除 `interpolateEntity` 中的 `isSwapMove` 冻结逻辑**

找到 `src/utils/frame/interpolate-entity.ts` 第 31-46 行：

```typescript
  // swap 平移时保持柱子的原始高度（来自 from），不做高度渐变，避免视觉上"变高变矮"
  const isSwapMove = transition.swapEntityIdPairs?.some(([a, b]) => a === from.id || b === from.id) ?? false;

  return {
    ...to,
    x,
    y,
    width: lerp(from.width, to.width, progress),
    height: isSwapMove ? from.height : lerp(from.height, to.height, progress),
    value: isSwapMove ? from.value : to.value,
    displayIndex: isSwapMove ? from.displayIndex : to.displayIndex,
    opacity: transition.visibilityTransition || transition.type === "fade"
      ? getFadeOpacity(from.opacity, to.opacity, progress)
      : lerp(from.opacity, to.opacity, progress),
    style: transition.styleTransition ? interpolateStyle(from.style, to.style, progress) : to.style,
  };
```

改为（移除 `isSwapMove` 及相关分支，统一用 lerp 或 `to` 的值）：

```typescript
  return {
    ...to,
    x,
    y,
    width: lerp(from.width, to.width, progress),
    height: lerp(from.height, to.height, progress),
    value: to.value,
    displayIndex: to.displayIndex,
    opacity: transition.visibilityTransition || transition.type === "fade"
      ? getFadeOpacity(from.opacity, to.opacity, progress)
      : lerp(from.opacity, to.opacity, progress),
    style: transition.styleTransition ? interpolateStyle(from.style, to.style, progress) : to.style,
  };
```

- [ ] **Step 2：移除已无用的 `buildSwapFromOverrides` 函数及其调用**

`swapEntityIdPairs` 已设为 `undefined`，`buildSwapFromOverrides` 永远不会被调用。

将 `src/utils/frame/interpolate-entity.ts` 第 49-72 行（`buildSwapFromOverrides` 函数）删除：

```typescript
/**
 * 根据 swapEntityIdPairs 构建"交叉起点"映射表：
 * 对于 swap 中的每一对 [idA, idB]，idA 的插值起点替换为 idB 的 from 坐标，反之亦然，
 * 这样两个 entity 才会真正地从对方位置飞向自己的目标位置。
 */
function buildSwapFromOverrides(
  fromEntities: RenderableEntity[],
  swapPairs: [string, string][],
): Map<string, Pick<RenderableEntity, "x" | "y">> {
  const fromMap = new Map(fromEntities.map((e) => [e.id, e]));
  const overrides = new Map<string, Pick<RenderableEntity, "x" | "y">>();

  for (const [idA, idB] of swapPairs) {
    const fromA = fromMap.get(idA);
    const fromB = fromMap.get(idB);
    if (fromA && fromB) {
      // A 从 B 的旧位置出发，B 从 A 的旧位置出发
      overrides.set(idA, { x: fromB.x, y: fromB.y });
      overrides.set(idB, { x: fromA.x, y: fromA.y });
    }
  }

  return overrides;
}
```

- [ ] **Step 3：移除 `interpolateEntities` 中对 `buildSwapFromOverrides` 的调用**

找到 `interpolateEntities` 函数（第 74-101 行），将其中对 `swapFromOverrides` 的使用全部清理：

当前代码：
```typescript
export function interpolateEntities(
  fromEntities: RenderableEntity[],
  toEntities: RenderableEntity[],
  transition: Transition,
  progress: number,
): RenderableEntity[] {
  const fromMap = new Map(fromEntities.map((entity) => [entity.id, entity]));

  // 构建 swap 交叉起点覆盖表
  const swapFromOverrides = transition.swapEntityIdPairs?.length
    ? buildSwapFromOverrides(fromEntities, transition.swapEntityIdPairs)
    : null;

  return toEntities.map((toEntity) => {
    const fromEntity = fromMap.get(toEntity.id);
    if (!fromEntity || transition.type === "instant") {
      return { ...toEntity };
    }

    // 如果该 entity 需要交叉起点，将其 from 的 x/y 替换为对方的旧坐标
    const override = swapFromOverrides?.get(toEntity.id);
    const effectiveFrom = override
      ? { ...fromEntity, x: override.x, y: override.y }
      : fromEntity;

    return interpolateEntity(effectiveFrom, toEntity, transition, progress);
  });
}
```

改为（移除 `swapFromOverrides` 和 `effectiveFrom` 的相关逻辑）：

```typescript
export function interpolateEntities(
  fromEntities: RenderableEntity[],
  toEntities: RenderableEntity[],
  transition: Transition,
  progress: number,
): RenderableEntity[] {
  const fromMap = new Map(fromEntities.map((entity) => [entity.id, entity]));

  return toEntities.map((toEntity) => {
    const fromEntity = fromMap.get(toEntity.id);
    if (!fromEntity || transition.type === "instant") {
      return { ...toEntity };
    }

    return interpolateEntity(fromEntity, toEntity, transition, progress);
  });
}
```

---

## Task 4：验证改动正确性

**Files:** 无文件修改，仅验证

- [ ] **Step 1：静态验证 `build-basic-timeline.ts` 的改动**

用 TypeScript 逻辑在脑中推演一次完整的 swap 流程：

假设初始数组 `[7, 3]`，`displayIndexes = [1, 2]`，交换 slot 0 和 slot 1：

```
初始 currentFrame（id = element-based）：
  main-1: { id:"main-1", x:100, value:7, height:70, displayIndex:1 }
  main-2: { id:"main-2", x:300, value:3, height:30, displayIndex:2 }

semantic = { type:"swap", indices:[0,1], arraySnapshot:[3,7] }

from = clone(currentFrame) = 上面的初始帧

displayIndexes 更新后 = [2, 1]（0号槽现在是元素2，1号槽现在是元素1）

values 更新后 = [3, 7]（来自 arraySnapshot）

to = createBasicFrame(values=[3,7], displayIndexes=[2,1], ...)：
  slot 0: id="main-2", x=100, value=3, height=30, displayIndex=2
  slot 1: id="main-1", x=300, value=7, height=70, displayIndex=1

transition = {
  type: "linear",
  movingEntityIds: undefined,
  swapEntityIdPairs: undefined,
}

interpolateEntities(from, to, transition, t)：
  fromMap = { "main-1": {x:100,h:70}, "main-2": {x:300,h:30} }

  toEntity main-2 (x=100, h=30): fromEntity = fromMap["main-2"] = {x:300,h:30}
    → lerp(300, 100, t)  → 从右向左平移 ✓
    → height: lerp(30, 30, t) = 30（不变）✓

  toEntity main-1 (x=300, h=70): fromEntity = fromMap["main-1"] = {x:100,h:70}
    → lerp(100, 300, t)  → 从左向右平移 ✓
    → height: lerp(70, 70, t) = 70（不变）✓
```

**结论：** 动画完全正确，矮柱（main-2）从右飞向左，高柱（main-1）从左飞向右，高度全程不变。

- [ ] **Step 2：确认 TypeScript 无类型错误**

在 `build-basic-timeline.ts` 中，`movingEntityIds: undefined` 和 `swapEntityIdPairs: undefined` 符合 `Transition` 类型定义（两者在 `src/types/timeline.ts` 中均为可选字段 `?`），无类型错误。

- [ ] **Step 3：确认其他 timeline builder 不受影响**

- `build-merge-timeline.ts`：使用 `main-${index}`（position-based），但 merge 动画的 `movingEntityIds` 只用于 `arc`/`path` 轨迹，不影响 swap 类逻辑，**本次不改，留待后续**。
- `build-bucket-timeline.ts`：同上，**本次不改**。
- `build-heap-timeline.ts`：用 `tree-${}`/`array-${}`，**完全不受影响**。
- `interpolate-frame.ts`：纯调用层，不感知 id，**不受影响**。
- `useCanvasRenderer.ts`：渲染不按 entity.id 分支，**不受影响**。

---

## 最终改动汇总

### `src/utils/timeline-builders/build-basic-timeline.ts`

**改动 1**（第 26 行）：
```diff
-      id: `main-${index}`,
+      id: `main-${displayIndexes[index]}`,
```

**改动 2**（第 164-167 行，transition 对象内）：
```diff
-        movingEntityIds: semantic.type === "swap" ? semantic.indices.map((item) => `main-${item}`) : undefined,
-        swapEntityIdPairs: semantic.type === "swap" && semantic.indices.length === 2
-          ? [[ `main-${semantic.indices[0]}`, `main-${semantic.indices[1]}`]]
-          : undefined,
+        movingEntityIds: undefined,
+        swapEntityIdPairs: undefined,
```

---

### `src/utils/frame/interpolate-entity.ts`

**改动 1**（移除 `isSwapMove` 冻结逻辑，第 31-46 行）：
```diff
-  // swap 平移时保持柱子的原始高度（来自 from），不做高度渐变，避免视觉上"变高变矮"
-  const isSwapMove = transition.swapEntityIdPairs?.some(([a, b]) => a === from.id || b === from.id) ?? false;
-
   return {
     ...to,
     x,
     y,
     width: lerp(from.width, to.width, progress),
-    height: isSwapMove ? from.height : lerp(from.height, to.height, progress),
-    value: isSwapMove ? from.value : to.value,
-    displayIndex: isSwapMove ? from.displayIndex : to.displayIndex,
+    height: lerp(from.height, to.height, progress),
+    value: to.value,
+    displayIndex: to.displayIndex,
     opacity: transition.visibilityTransition || transition.type === "fade"
       ? getFadeOpacity(from.opacity, to.opacity, progress)
       : lerp(from.opacity, to.opacity, progress),
     style: transition.styleTransition ? interpolateStyle(from.style, to.style, progress) : to.style,
   };
```

**改动 2**（移除 `buildSwapFromOverrides` 函数，第 49-72 行，整体删除）

**改动 3**（简化 `interpolateEntities`，移除 `swapFromOverrides` 逻辑）：
```diff
 export function interpolateEntities(...) {
   const fromMap = new Map(fromEntities.map((entity) => [entity.id, entity]));
-
-  // 构建 swap 交叉起点覆盖表
-  const swapFromOverrides = transition.swapEntityIdPairs?.length
-    ? buildSwapFromOverrides(fromEntities, transition.swapEntityIdPairs)
-    : null;
-
   return toEntities.map((toEntity) => {
     const fromEntity = fromMap.get(toEntity.id);
     if (!fromEntity || transition.type === "instant") {
       return { ...toEntity };
     }
-
-    // 如果该 entity 需要交叉起点，将其 from 的 x/y 替换为对方的旧坐标
-    const override = swapFromOverrides?.get(toEntity.id);
-    const effectiveFrom = override
-      ? { ...fromEntity, x: override.x, y: override.y }
-      : fromEntity;
-
-    return interpolateEntity(effectiveFrom, toEntity, transition, progress);
+    return interpolateEntity(fromEntity, toEntity, transition, progress);
   });
 }
```
