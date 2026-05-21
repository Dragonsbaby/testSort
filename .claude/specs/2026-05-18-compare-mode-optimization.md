# 算法对比模式优化建议

> 基于 Playwright 自动化测试 + 代码审查总结，2026-05-18

## 已修复问题回顾

| 问题 | 根因 | 修复方案 |
|------|------|----------|
| 布局切换后比较/交换计数变为负数 | `buildInitial()` 重置 `comparisons/swaps` 为 0 但未重置 `lastSyncedIndex`，后续 `player.reset()` 触发 `syncStats(0)` 时 delta 为负 | `buildInitial()` 中增加 `lastSyncedIndex.value = 0` |
| 动画播放完成后播放按钮仍显示"暂停" | Vue 3 通过模板 ref 的 `defineExpose` 访问内部 Ref（`leftSlot.value?.isPlaying?.value`）不建立响应式依赖 | 改为事件驱动：CompareSlot watch `isPlaying` 并 emit `update:playing`，CompareView 用本地 ref 接收 |
| 对比视图未填满可用高度（440px vs 656px 容器） | `.compare-view` 和 `.compare-slot` 使用 `height: 100%`，在 flex 计算高度的父容器中不生效 | 改为 `flex: 1; min-height: 0` |

---

## 一、UI/UX 体验

### 1. Canvas 内容未充分利用 slot 高度

**现状：** 两侧 slot 在 flex 布局下高度已充分展开（测量 656px），但 canvas 内部渲染区域固定 —— basic 算法硬编码 `height: 320`（`useSortAnimation.ts` 第 57/64 行），导致 canvas 区域底部有明显空白。

**建议：** 让 canvas 根据容器实际高度自适应渲染。涉及 `buildInitialFrameForAlgorithm` 和 `buildTimelineForAlgorithm` 中各 builder 的 height 参数，需要从 slot 容器获取实际尺寸并传递。

**影响范围：** `useSortAnimation.ts`、各 timeline builder、各 Canvas 组件的尺寸初始化逻辑。改动面较广，建议作为独立优化任务。

**优先级：** 中

---

### 2. 缺少汇总对比面板

**现状：** 两个 slot 各自独立显示"比较 N · 交换 N"，用户需要目测数字进行对比，对比模式的核心价值未充分体现。

**建议：** 在底部控制栏或两个 slot 之间添加轻量对比摘要，例如：

```
希尔排序：148 次比较 / 82 次交换
归并排序：139 次比较 / 149 次交换
              ↑ 比较少 6%     ↑ 交换多 82%
```

**实现思路：** CompareView 通过 slot ref 读取 `comparisons` / `swaps`（已 expose），用 computed 计算差异百分比。考虑到模板 ref 响应式问题（同 isAnyPlaying），统计数据也应通过事件驱动上报。

**优先级：** 高 —— 直接提升对比模式的核心体验

---

### 3. 底部控制栏与顶部 ControlPanel 退出功能重叠

**现状：**
- 顶部 `ControlPanel.vue` 有"退出对比"按钮
- 底部 `CompareView.vue` 控制栏也有"退出"按钮

**建议：** 底部控制栏去掉退出按钮，只保留播放控制 + 布局切换。退出操作统一走顶部 ControlPanel。

**优先级：** 低 —— 纯净化改动

---

### 4. 进度条不可交互

**现状：** CompareSlot 底部 `.slot-progress` 是纯展示进度条，不支持点击跳转。而 `useSortAnimation` 已经暴露了 `handleSeek` 方法。

**建议：** 给进度条添加 `@click` 事件，调用 `handleSeek` 实现点击跳转。交互成本低，体验提升明显。

**实现复杂度：** 低 —— 只需在 CompareSlot 模板中给 `.slot-track-wrap` 绑定 click 事件

**优先级：** 高

---

## 二、功能增强

### 5. 同算法选择保护

**现状：** 两侧 slot 可以选择相同算法（如左右都选冒泡排序），对比相同算法没有实际意义。

**方案对比：**

| 方案 | 优点 | 缺点 |
|------|------|------|
| 限制型：过滤掉对方已选算法 | 杜绝无意义对比 | 降低灵活性；算法少时选项过少 |
| 宽容型：允许但显示提示 | 保留灵活性 | 提示可能被忽略 |

**推荐：** 宽容型 —— 选择相同算法时在 header 显示一个小提示标签即可。

**优先级：** 低

---

### 6. 同步模式选择

**现状：** 当前是**时间同步**模式（两边同速播放），步数少的算法先完成。

**建议：** 增加**进度同步**模式 —— 两边始终保持在相同百分比进度。对于"观察同一数据集在不同算法下排序过程"更有教学意义。

**实现复杂度：** 高 —— 需要 CompareView 层面的 player 编排（计算两边 timeline 的百分比映射），而非简单的 `syncPlay()`。建议作为 v2 功能。

**优先级：** 中（v2）

---

### 7. 堆排序模式切换入口缺失

**现状：** `CompareSlot.vue` 中有 `heapMode` ref（第 40 行）但没有 UI 切换入口。当用户在对比模式选择堆排序时，无法切换最大堆/最小堆。

**建议：** 在 slot header 中，当 `algorithm === 'heap'` 时条件渲染一个 max/min 切换按钮。

**实现复杂度：** 低

**优先级：** 中

---

## 三、代码/架构

### 8. enterCompareMode 默认右侧算法策略

**现状：** `sortStore.ts` 第 51 行使用 `(idx + 1) % length` 选择右侧算法 —— 简单取"下一个"。如果当前是冒泡，右侧默认插入排序，两个 O(n²) 对比缺乏代表性。

**建议：** 选择不同复杂度类别的算法作为默认右侧。例如当前 simple 类默认配 medium 类（归并），当前 medium 类默认配 simple 类中的快速排序。可复用 `useCompareUtils.ts` 中已有的 `ALGORITHM_CATEGORIES`。

**优先级：** 低 —— 锦上添花

---

### 9. 退出对比模式时原始数组丢失

**现状：** `sortStore.ts` 第 61-72 行，退出对比模式时保存了 `savedArraySize` 并调用 `generateArray(savedArraySize)` 重新生成随机数组。这意味着退出后看到的是全新数组，而非进入对比前的那组数据。

**建议：** 改为保存 `savedOriginalArray`（完整数组快照）而非只保存 size。退出时直接恢复原数组。

**实现复杂度：** 低 —— 多存一个 ref

**优先级：** 中 —— 影响用户对比前后的连续性体验

---

## 优先级汇总

| 优先级 | 编号 | 改动 | 复杂度 |
|--------|------|------|--------|
| 高 | #2 | 汇总对比面板 | 中 |
| 高 | #4 | 进度条可交互 | 低 |
| 中 | #1 | Canvas 高度自适应 | 高 |
| 中 | #7 | 堆排序模式切换入口 | 低 |
| 中 | #9 | 退出时恢复原始数组 | 低 |
| 中 | #6 | 进度同步模式（v2） | 高 |
| 低 | #3 | 去掉重复退出按钮 | 低 |
| 低 | #5 | 同算法选择保护 | 低 |
| 低 | #8 | 默认右侧算法策略 | 低 |
