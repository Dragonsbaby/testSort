# 排序动画时间轴重构设计

## 1. 背景与目标

当前排序可视化项目采用“步骤生成 → 步骤消费 → Canvas 绘制”的命令式动画模型：排序算法输出 `SortStep[]`，`useSortAnimation` 顺序调用 Canvas 组件的 `applyStep(step)`，各渲染器内部自行维护飞行动画、临时高亮和中间状态。

这种模式适合顺序播放，但不适合后续扩展“回退上一步”能力。根本原因是：完整画面状态分散在多个 renderer 的运行时私有状态中，系统无法在任意步骤、任意动画进度点稳定恢复出完整画面。

本次设计不实现“回退上一步”交互，而是完成它所依赖的底层重构：

- 将命令式步骤执行改为统一时间轴驱动
- 让每个步骤都能表达完整的状态区间，而不是只表达一条执行命令
- 让任意步骤、任意动画进度都能计算出完整 `FrameState`
- 让 renderer 只消费 `FrameState` 并负责绘制，不再作为动画状态真相源

本次重构完成后，系统将具备后续实现回退、跳步、拖动进度条等能力的基础，但本次不提供这些交互。

## 2. 新架构概览

### 2.1 新数据流

现有数据流：

`排序算法 -> SortStep[] -> useSortAnimation -> canvas.applyStep(step) -> renderer 内部维护动画状态`

目标数据流：

`排序算法 -> SemanticStep[] -> TimelineBuilder -> TimelineStep[] -> TimelinePlayer -> FrameState -> renderer.renderFrame(frame)`

### 2.2 分层职责

#### 算法语义层

由 `src/utils/sortingAlgorithms.ts` 负责，输出 `SemanticStep[]`。

职责：
- 描述排序过程中发生了什么
- 保留 compare、swap、merge-set、bucket-gather、sorted 等语义能力
- 不关心布局、轨迹、时长、颜色或几何信息

#### 时间轴编排层

新增 timeline builder，负责把 `SemanticStep[]` 编译为 `TimelineStep[]`。

职责：
- 维护当前完整场景状态
- 生成每一步的 `from` / `to` / `transition`
- 将算法语义步骤转为可播放时间轴片段

#### 时间轴播放层

由新的时间轴播放器负责推进当前时间。

职责：
- 维护当前 `stepIndex`
- 维护当前步骤内 `progress`
- 按时间推进并插值计算当前 `FrameState`
- 负责播放、暂停、重置等时序控制

#### 渲染层

四类 renderer 都改成纯帧渲染器：
- 通用排序 renderer
- 归并排序 renderer
- 桶排序 renderer
- 堆排序 renderer

职责：
- 只接收 `FrameState`
- 只负责绘制当前帧
- 不再私有维护飞行动画、中间状态或临时高亮真相源

## 3. 核心数据结构

### 3.1 SemanticStep

`SemanticStep` 是现有 `SortStep` 的语义化升级版，用于表达排序过程中“发生了什么”。

建议字段：
- `type`
- `indices`
- `description`
- `arraySnapshot`
- `groupIndices`
- `bucketIndex`
- `bucketPos`
- 其他只属于算法语义的字段

约束：
- 不包含布局坐标
- 不包含动画轨迹
- 不包含时长与缓动
- 不直接驱动 renderer 执行动画

### 3.2 TimelineStep

`TimelineStep` 是时间轴播放器的直接输入，每一个 `TimelineStep` 都是一个完整的“状态区间”。

建议字段：
- `id`
- `kind`
- `description`
- `duration`
- `from: FrameState`
- `to: FrameState`
- `transition: Transition`
- `statsDelta`
- `semanticRef`（可选，用于调试）

设计含义：
- `from` 定义该步骤开始时的完整画面
- `to` 定义该步骤结束时的完整画面
- `transition` 定义两者之间如何过渡
- `duration` 定义该步骤持续时间

### 3.3 FrameState

`FrameState` 是系统在某一时刻的完整画面真相源。只要给 renderer 一份 `FrameState`，就必须能够直接渲染出完整画面，不能依赖上一步遗留状态或 renderer 内部缓存。

建议按四层组织：

#### 元信息层
- `algorithm`
- `stepIndex`
- `progress`
- `phase`
- `description`

#### 实体层 `entities`
所有可渲染对象统一抽象为实体。

建议字段：
- `id`
- `kind`
- `value`
- `displayIndex`
- `x`
- `y`
- `width`
- `height`
- `opacity`
- `zIndex`
- `style`
- `stateTags`

`kind` 需要覆盖：
- 普通 bar
- merge buffer bar
- bucket bar
- heap tree node
- heap array node
- ghost 占位对象

`stateTags` 需要覆盖：
- comparing
- swapping
- sorted
- pivot
- pending
- latest

#### 区域层 `regions`
显式表达布局结构：
- `main`
- `buffer`
- `buckets[]`
- `heapTree`
- `heapArray`

#### 装饰层 `overlays`
存放额外图元：
- `edges`
- `guides`
- `labels`
- `badges`
- `dividers`

### 3.4 Transition

`Transition` 只描述“怎么过渡”，不重复业务语义。

建议字段：
- `type`
- `duration`
- `easing`
- `movingEntityIds`
- `pathParams`
- `styleTransition`
- `visibilityTransition`

建议至少支持的过渡类型：
- `instant`
- `linear`
- `arc`
- `path`
- `fade`

不同场景示例：
- 通用 `swap` 使用 `arc`
- heap 父子交换使用 `linear`
- heap 根末交换使用 `arc`
- `merge-set` / `bucket-scatter` / `bucket-gather` 使用 `path`

## 4. 模块拆分与职责迁移

### 4.1 保留并收敛职责的模块

#### `src/utils/sortingAlgorithms.ts`
继续作为算法语义层。

职责：
- 输入原始数组
- 输出 `SemanticStep[]`
- 不承担渲染轨迹、时长、布局、视觉状态职责

#### `src/stores/sortStore.ts`
继续保存全局排序配置：
- `originalArray`
- `animationSpeed`
- `arraySize`
- `algorithm`

不建议存入：
- `TimelineStep[]`
- `FrameState`
- 当前播放进度
- 当前时间轴运行态

### 4.2 重点重构模块

#### `src/composables/useSortAnimation.ts`
保留路径，但职责重写为“排序场景控制器”。

迁移后职责：
- 调用算法层获取 `SemanticStep[]`
- 调用 timeline builder 生成 `TimelineStep[]`
- 驱动 timeline player 播放
- 维护对外业务状态：`currentStep`、`currentStepInfo`、`comparisons`、`swaps`、`isPlaying`、`statusText`
- 将当前 `FrameState` 提供给 Canvas 组件

不再负责：
- 直接执行某一步动画
- 直接等待 `applyStep()` Promise 完成

#### `src/composables/useCanvasRenderer.ts`
保留，但改成通用帧渲染器。

迁移后职责：
- 输入 `FrameState`
- 绘制 main 区 bar / ghost / 标签
- 依据 `stateTags + style` 绘制颜色与高亮

不再负责：
- 内部维护飞行动画生命周期
- 自己根据 step 类型推断当前状态
- resolve 动画 Promise

#### `src/composables/useMergeSortRenderer.ts`
迁移为归并帧渲染器。

职责：
- 渲染 main / buffer 两个 region
- 渲染 ghost 占位
- 渲染 latest / normal / returning 等 buffer 状态

不再负责内部时间推进。

#### `src/composables/useBucketSortRenderer.ts`
迁移为桶排序帧渲染器。

职责：
- 渲染主数组区
- 渲染 bucket regions
- 渲染桶标题、badge、值域标签
- 渲染桶内 bar 状态

不再负责 scatter / gather 动画推进。

#### `src/composables/useHeapSortRenderer.ts`
迁移为堆排序帧渲染器。

职责：
- 渲染 tree nodes
- 渲染 array row nodes
- 渲染 edges / divider / labels

不再负责：
- FlyTask
- 路径状态缓存
- 活跃边隐式推导

### 4.3 新增模块建议

#### `src/types/timeline.ts`
集中定义：
- `SemanticStep`
- `TimelineStep`
- `FrameState`
- `Transition`
- `RenderableEntity`
- `RenderableRegion`
- `RenderableOverlay`

#### `src/utils/timeline-builders/`
新增目录：
- `build-basic-timeline.ts`
- `build-merge-timeline.ts`
- `build-bucket-timeline.ts`
- `build-heap-timeline.ts`

职责：
- 接收 `SemanticStep[]`
- 结合布局规则和当前场景状态
- 输出 `TimelineStep[]`

#### `src/utils/frame/`
新增目录：
- `interpolate-frame.ts`
- `interpolate-entity.ts`
- `path-utils.ts`
- `style-utils.ts`

职责：
- 根据 `from + to + transition + progress`
- 计算当前时刻 `FrameState`

#### `src/utils/layout/`
新增目录：
- `basic-layout.ts`
- `merge-layout.ts`
- `bucket-layout.ts`
- `heap-layout.ts`

职责：
- 根据画布尺寸、元素数量、桶数、堆深度
- 输出各 region 几何信息与实体目标位

#### `src/composables/useTimelinePlayer.ts`（可选）
如果拆出，将作为纯时间轴播放器：
- 接收 `TimelineStep[]`
- 维护播放状态
- 推进当前时间
- 输出当前 `FrameState`

若希望减少文件数量，也可先将此逻辑内聚在 `useSortAnimation.ts` 内部。

## 5. 组件接口调整

现有 Canvas 组件通过 `applyStep()` 暴露命令式执行接口。

建议改为只暴露纯帧渲染接口：
- `renderFrame(frame: FrameState): void`

或者让组件直接接收 `frame` 作为 prop，再在内部 watch 变化后重绘。对于当前 Canvas 结构，保留 `renderFrame()` 这种 imperative 渲染接口更贴合现状。

核心约束：
- Canvas 组件只消费 frame
- 不再拥有步骤推进权
- 不再作为动画状态真相源

## 6. 实施策略

### 6.1 本次明确交付物

本次重构交付：
1. 建立统一时间轴模型
2. 建立 timeline builder、layout、interpolate 基础能力
3. 改造 `useSortAnimation` 和各 renderer 的职责边界
4. 保留未来回退能力，但本次不实现回退交互

### 6.2 本次明确不做

本次不做：
- 上一步按钮
- 倒放播放
- 拖动进度条 seek
- timeline inspector
- 性能极限优化
- 一步到位统一所有绘图辅助函数

### 6.3 推荐开发顺序

#### Phase 1：打骨架
- 新类型定义
- layout 层
- interpolate 层
- basic timeline builder

#### Phase 2：先迁移通用排序
覆盖：
- 冒泡
- 插入
- 快速
- 希尔

验证：
- compare
- swap
- pivot
- sorted
- pending

#### Phase 3：迁移归并
验证：
- 双区布局
- ghost
- merge-set
- merge-back

#### Phase 4：迁移桶排序
验证：
- 多 bucket region
- scatter
- bucket 内比较与交换
- gather

#### Phase 5：迁移堆排序
验证：
- tree / array 双视图同步
- edge overlays
- line / arc 路径兼容

## 7. 风险与约束

### 7.1 必须守住的边界

1. `SemanticStep` 只表达排序语义
2. `TimelineStep` 才是播放器输入
3. `FrameState` 是 renderer 的唯一真相源

### 7.2 主要风险点

#### 风险 1：`FrameState` 被做成补丁
如果某一步只描述增量，而 renderer 继续依赖旧内部状态，则新架构会退化回旧问题。

约束：
- 每一帧都必须能单独渲染
- `FrameState` 必须是完整输入

#### 风险 2：builder 与 renderer 双重持有布局逻辑
若 builder 和 renderer 各自推导位置，坐标将容易不一致。

约束：
- 布局逻辑统一收口到 `layout/`
- builder 与 renderer 共享同一套布局结果或规则

#### 风险 3：transition 混入过多业务语义
这会导致 transition 难以复用并快速膨胀。

约束：
- 业务语义保留在 `SemanticStep`
- transition 仅描述动画方式

#### 风险 4：统计更新时机不一致
`comparisons`、`swaps` 若在不同类型步骤中采用不同更新时机，会导致状态理解混乱。

建议统一约定：
- `statsDelta` 挂在 `TimelineStep`
- 在 step 完成时提交统计

#### 风险 5：堆排序双视图实体标识不稳定
若逻辑元素和视图实体标识混用，插值和同步会混乱。

约束：
- 区分逻辑元素 ID 与渲染实体 ID
- 同一逻辑元素可映射多个视图实体，但共享同一 source identity

## 8. 可行性结论

该方案可行，且适合当前项目继续演进。

理由：
- 当前项目元素规模为 10~100，统一时间轴计算开销可承受
- 项目已经存在通用柱状图、归并双区、桶排序多区、堆排序树结构四类渲染模型，继续维持命令式 renderer 成本会越来越高
- 将系统改造成“可计算帧状态的时间轴播放器”后，回退、跳步、拖动进度条都会变成控制层扩展，而不再要求重写 renderer

最终判断：
- 方案值得做
- 风险可控

## 9. 当前实现状态（2026-04-27）

截至当前代码状态，本设计中的核心改造已基本落地。

### 9.1 已完成

1. 时间轴核心模型已建立
   - 已定义 `SemanticStep`、`TimelineStep`、`FrameState`、`Transition`
   - 已建立 `entities / regions / overlays` 三层渲染结构

2. 插值与路径能力已建立
   - `interpolate-frame.ts`
   - `interpolate-entity.ts`
   - `path-utils.ts`
   - `style-utils.ts`
   - 已支持 `instant / linear / arc / path / fade`

3. `useSortAnimation.ts` 已迁移为统一时间轴控制器
   - 算法输出 `SemanticStep[]`
   - builder 输出 `TimelineStep[]`
   - player 推进当前帧
   - Canvas 组件只消费 `renderFrame(frame)`

4. 通用排序链路已迁移完成
   - 冒泡、插入、快速、希尔已接入 timeline builder
   - `compare / swap / pivot / sorted / pending` 已走统一帧渲染

5. 归并排序链路已迁移完成
   - 已支持 main / buffer 双区布局
   - 已支持 `merge-set` / `merge-back`
   - 已加入 ghost 实体
   - `merge-set` / `merge-back` 已改为 `path` 过渡

6. 桶排序链路已迁移完成
   - 已支持主数组区与多 bucket regions
   - 已支持 `bucket-scatter` / `bucket-compare` / `bucket-swap` / `bucket-gather`
   - 已加入桶标题、badge、值域标签、divider overlays
   - `bucket-scatter` / `bucket-gather` 已改为 `path` 过渡

7. 堆排序链路已迁移完成
   - 已支持 tree / array 双视图
   - 已支持 edge / divider / labels overlays
   - 已贯通最大堆 / 最小堆模式到 timeline builder
   - 已按设计区分交换过渡：
     - heap 父子交换使用 `linear`
     - heap 根末交换使用 `arc`

8. 通用 Canvas 渲染能力已补齐
   - 已支持 bar / heap node / ghost 的统一帧绘制
   - 已支持 `label / badge / guide / divider / edge` overlays 绘制

### 9.2 当前与原设计相比的收敛说明

1. `useTimelinePlayer.ts` 已独立拆出
   - 设计中标注“可选”，当前实现选择拆出，符合职责划分方向。

2. merge / bucket / heap 的专有 renderer 目前是薄适配层
   - 主要专有逻辑已下沉到 timeline builder 与通用 canvas renderer。
   - 这与设计目标一致：renderer 不再持有动画推进与状态真相。

3. 本次仍未实现回退、倒放、seek、时间轴调试器
   - 与本设计“本次明确不做”保持一致。
- 前提是严格守住类型分层、布局统一和 renderer 去状态化这三条边界
