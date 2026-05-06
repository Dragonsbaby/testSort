# 排序动画旧视觉还原计划

## Context

用户希望参考 commit `eb82f05362f3412640b378aa52a952981af2210b` 的渲染效果，优化当前排序动画 UI。当前项目已经从旧的 `barStates + applyStep/updateBars` 渲染方式重构为 `FrameState + timeline` 架构，因此本次不回退架构，只在当前帧渲染层还原旧版视觉质感。

目标效果：接近截图中的深色 Canvas 舞台、细网格、青蓝底线、四角边框、居中圆角渐变柱、顶部高光、黄色数值标签、绿色索引标签，并恢复比较/交换/已排序等状态的视觉反馈。

## Recommended Approach

保留当前 `FrameState` 数据流：算法 timeline builder 继续生成帧，算法组件继续通过 `SortBarCanvas.renderFrame(frame)` 驱动画布。主要修改 Canvas 绘制逻辑和样式工具，不恢复旧版 `applyStep/updateBars` 对外 API。

## Critical Files

- `src/composables/useCanvasRenderer.ts`
  - 主要修改文件。
  - 将当前 `fillRect/strokeRect` 的扁平柱子绘制改为旧版视觉：圆角柱体、纵向渐变、顶部高光条、状态 glow。
  - 保留 heap 节点绘制逻辑，避免影响堆排序树状视图。
  - 调整背景绘制：维持深色底、低透明度网格、底部基线，并让网格/基线更贴近截图。
  - 根据现有 `frame.overlays` 继续绘制 badge/label/path；如果已有 swap path overlay，则优化为更接近旧版的抛物线或高亮线风格。

- `src/utils/frame/style-utils.ts`
  - 调整 `StateTag -> RenderStyle` 颜色映射。
  - 默认柱体以蓝色系为主；`comparing` 保持黄色强调，`swapping` 保持红色强调，`sorted` 使用绿色，`pivot/pending/latest` 保留但降低冲突感。
  - 必要时新增可复用色值常量，避免在渲染器内散落魔法颜色。

- `src/utils/layout/basic-layout.ts`
  - 微调柱宽、间距、上下 padding，使 10 个元素时的横向居中、柱间距、高度比例更接近旧截图。
  - 保持对不同数组长度的自适应，不引入固定尺寸依赖。

- `src/components/SortBarCanvas.vue`
  - 尽量少改。
  - 保留当前 `renderFrame` 暴露接口。
  - 仅在必要时微调容器 padding、角标大小/颜色/位置，使外框效果贴近旧截图。

- `src/components/algorithms/_algorithm-common.scss`
  - 如有必要，微调控制栏与画布区域间距、状态数字颜色、面板边框透明度。
  - 不改变算法组件结构。

## Data Flow

1. 各排序算法组件仍通过 `useSortAnimation` 推进动画。
2. timeline builder 输出 `FrameState`。
3. `SortBarCanvas.vue` 调用 `useCanvasRenderer.renderFrame(frame)`。
4. `useCanvasRenderer.ts` 根据 `FrameState.entities` 和 `FrameState.overlays` 绘制旧版风格 UI。

## Visual Details

- 背景：深黑蓝底色 + 40px 左右细网格 + 低透明度青色底线。
- 柱体：圆角矩形；主体为蓝色纵向渐变；顶部有浅蓝高光线。
- 标签：柱顶值使用黄色，底部索引使用绿色，字体沿用 JetBrains Mono。
- 状态：比较为黄色，交换为红色，已排序为绿色，状态色通过渐变或 glow 体现，不破坏基础蓝色柱体识别。
- 边框：继续使用四角角标，颜色与截图一致，避免完整边框压迫画面。
- 交换轨迹：优先复用现有 overlay；若 timeline 已提供 points，则按旧版风格绘制曲线/虚线高亮，不改算法数据结构。

## Scope Constraints

- 不回退到旧版 `barStates` 状态机。
- 不恢复 `applyStep/updateBars` 对外 API。
- 不改排序算法核心逻辑。
- 不新增依赖。
- 不执行 build/test/dev 命令；按用户规则只做静态检查与代码审查。
- 不执行 git 操作。

## Risks

- 当前帧模型是不可变快照，旧版部分视觉依赖持续的 `barStates`，需要通过 `entity.style` 和 overlay 表达，避免引入新的隐式状态。
- 某些算法的 timeline 可能没有 swap path overlay，不能强行假设所有算法都有交换轨迹。
- 堆排序可能使用同一个 renderer，但实体类型不同，需确保柱状图视觉改造不影响 `heap-tree-node` 和 `heap-array-node`。

## Verification

按用户约束，不启动服务、不运行 build/test。完成后使用静态方式验证：

1. 阅读修改后的 `useCanvasRenderer.ts`，确认 draw 顺序为背景 -> overlays -> entities，并且 bar/heap 绘制路径分离。
2. 全局搜索 `RenderStyle`、`StateTag`、`FrameState`，确认新增或调整的样式字段没有破坏类型使用。
3. 对照 commit `eb82f05362f3412640b378aa52a952981af2210b` 的旧视觉元素，逐项确认：圆角、渐变、高光、网格、底线、角标、标签颜色、状态色。
4. 检查算法组件仍只依赖 `SortBarCanvas.renderFrame`，没有引入旧 API。
5. 汇报未运行 dev/build/test 的原因与建议用户本地预览路径。
