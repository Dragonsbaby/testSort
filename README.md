# 排序算法可视化

> 交互式排序算法动画演示工具，基于 Vue 3 + TypeScript + Canvas 构建

## 功能特性

- 7 种经典排序算法的可视化动画演示
- 支持 10 ~ 100 个元素的动态调整
- 动画速度可调（20ms ~ 500ms）
- 基于 requestAnimationFrame 的流畅动画
- 适配高 DPI 屏幕

## 已实现算法

| 算法 | 时间复杂度 | 空间复杂度 | 稳定性 | 可视化方式 |
|------|-----------|-----------|--------|-----------|
| 冒泡排序 | O(n²) | O(1) | 稳定 | 单排柱状图 |
| 插入排序 | O(n²) | O(1) | 稳定 | 单排柱状图 |
| 快速排序 | O(n log n) | O(log n) | 不稳定 | 单排柱状图 |
| 希尔排序 | O(n log² n) | O(1) | 不稳定 | 单排柱状图 |
| 归并排序 | O(n log n) | O(n) | 稳定 | 双排飞行动画 |
| 桶排序 | O(n + k) | O(n + k) | 稳定 | 分桶区 + 飞行动画 |
| 堆排序 | O(n log n) | O(1) | 不稳定 | 二叉树小球 + 弧线动画 |

## 技术栈

- **框架**：Vue 3（Composition API + `<script setup>`）
- **语言**：TypeScript
- **状态管理**：Pinia
- **渲染**：HTML Canvas 2D
- **构建工具**：Vite

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览构建产物
npm run preview
```

## 项目架构

```
src/
├── types/                  # 类型定义
│   ├── sorting.ts          # 算法元信息（SortAlgorithm、AlgorithmInfo）
│   └── timeline.ts         # 核心动画类型（SemanticStep、FrameState、TimelineStep）
├── stores/
│   └── sortStore.ts        # Pinia 全局状态
├── utils/
│   ├── sortingAlgorithms.ts    # 七种排序算法实现（纯函数）
│   ├── frame/                  # 帧插值系统（缓动函数、路径计算、样式插值）
│   ├── layout/                 # 布局系统（柱状图、归并、桶排序、堆排序布局）
│   └── timeline-builders/      # 时间轴构建器（语义步骤 → 视觉动画）
├── composables/
│   ├── useTimelinePlayer.ts    # 时间轴播放引擎（RAF 驱动）
│   ├── useSortAnimation.ts     # 排序动画编排器
│   └── useCanvasRenderer.ts    # Canvas2D 渲染器
└── components/
    ├── ControlPanel.vue        # 控制面板
    ├── SortVisualizer.vue      # 算法路由容器
    ├── SortBarCanvas*.vue      # Canvas 容器组件
    └── algorithms/             # 各算法页面组件
```

## 核心架构：四阶段管线

```
排序算法 (SemanticStep[])
    ↓
时间轴构建器 (TimelineStep[])
    ↓
帧插值引擎 (FrameState)
    ↓
Canvas 渲染器 (像素)
```

1. **排序算法**：纯函数，输出语义步骤描述（比较、交换、标记已排序等）
2. **时间轴构建器**：为每一步生成起止帧状态 + 动画元信息（运动轨迹、缓动函数）
3. **帧插值引擎**：RAF 驱动，在起止帧间平滑插值（支持直线、弧线、L 形路径）
4. **Canvas 渲染器**：按层级绘制实体、叠加层、背景网格

## 扩展新算法

1. 在 `src/utils/sortingAlgorithms.ts` 中实现算法函数
2. 在 `src/types/sorting.ts` 中注册算法元信息
3. 选择或创建时间轴构建器
4. 创建算法页面组件并注册导出

详细说明见项目技术文档。

## License

MIT
