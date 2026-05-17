# 测试文件组织结构

```
test/
├── setup.ts                           # 测试环境初始化
├── mocks/                             # Mock 数据
│   ├── canvas.ts                      # Canvas Mock
│   └── raf.ts                         # requestAnimationFrame Mock
├── helpers/                           # 测试辅助函数
│   ├── algorithm-tester.ts            # 算法测试工具
│   └── frame-comparator.ts            # 帧比较工具
├── unit/                              # 单元测试
│   ├── algorithms/                    # 算法测试
│   │   ├── bubble-sort.test.ts
│   │   ├── quick-sort.test.ts
│   │   ├── merge-sort.test.ts
│   │   └── heap-sort.test.ts
│   ├── utils/                         # 工具函数测试
│   │   ├── frame/
│   │   │   ├── style-utils.test.ts
│   │   │   ├── path-utils.test.ts
│   │   │   └── interpolate-frame.test.ts
│   │   └── layout/
│   │       ├── basic-layout.test.ts
│   │       └── heap-layout.test.ts
│   ├── timeline-builders/             # 时间轴构建器测试
│   │   ├── build-basic-timeline.test.ts
│   │   └── build-heap-timeline.test.ts
│   └── stores/                        # 状态管理测试
│       └── sortStore.test.ts
├── integration/                       # 集成测试
│   ├── animation-flow.test.ts         # 动画流程测试
│   ├── timeline-player.test.ts        # 播放器集成测试
│   └── canvas-rendering.test.ts       # Canvas渲染测试
├── components/                        # 组件测试
│   ├── ControlPanel.test.ts
│   ├── algorithms/
│   │   ├── BubbleSort.test.ts
│   │   └── HeapSort.test.ts
│   └── canvas/
│       └── SortBarCanvas.test.ts
└── e2e/                              # E2E测试
    ├── basic-flow.spec.ts            # 基础流程测试
    ├── algorithm-comparison.spec.ts  # 算法对比测试
    └── performance.spec.ts           # 性能测试
```

## 测试命名规范

- 单元测试：`*.test.ts`
- 集成测试：`*-integration.test.ts`
- E2E测试：`*.spec.ts`
- 测试文件与源文件对应，放在相同的目录结构下
