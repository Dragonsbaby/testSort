# 测试最佳实践指南

## 📋 测试原则

### 1. 测试金字塔
```
    E2E Tests (5%)     - 用户流程验证
   ┌─────────────┐
  │  Integration │      - 组件协作验证
 │─────────────│
  │  Unit Tests │       - 函数/组件逻辑验证
 │─────────────│
│ Algorithm Tests │    - 纯函数逻辑验证
└─────────────────┘
```

### 2. 测试命名规范

#### 文件命名
- 单元测试：`filename.test.ts`
- 集成测试：`feature-integration.test.ts`
- E2E测试：`user-flow.spec.ts`

#### 测试描述命名
```typescript
// ✅ 好的命名
test('应该正确排序已排序数组', () => {})
test('当数组为空时应该返回空结果', () => {})

// ❌ 不好的命名
test('测试1', () => {})
test('排序测试', () => {})
```

### 3. AAA 模式 (Arrange-Act-Assert)
```typescript
test('应该正确交换两个元素', () => {
  // Arrange - 准备测试数据
  const array = [3, 1, 2];
  const expected = [1, 3, 2];

  // Act - 执行被测试的操作
  const result = swapElements(array, 0, 1);

  // Assert - 验证结果
  expect(result).toEqual(expected);
});
```

## 🧪 单元测试最佳实践

### 1. 纯函数测试
```typescript
describe('纯函数测试', () => {
  test('相同输入应该产生相同输出', () => {
    const input = [3, 1, 2];
    const result1 = bubbleSort(input);
    const result2 = bubbleSort(input);
    expect(result1).toEqual(result2);
  });

  test('不应该有副作用', () => {
    const input = [3, 1, 2];
    const original = [...input];
    bubbleSort(input);
    expect(input).toEqual(original);
  });
});
```

### 2. 边界情况测试
```typescript
describe('边界情况', () => {
  test.each([
    { input: [], description: '空数组' },
    { input: [1], description: '单元素数组' },
    { input: [1, 2], description: '两个元素' },
    { input: Array.from({ length: 100 }, (_, i) => i + 1), description: '大数组' }
  ])('$description', ({ input }) => {
    const result = bubbleSort(input);
    expect(result).toBeSorted();
  });
});
```

### 3. 错误处理测试
```typescript
test('应该正确处理错误输入', () => {
  expect(() => bubbleSort(null as any)).toThrow();
  expect(() => bubbleSort(undefined as any)).toThrow();
});
```

## 🔧 测试工具和辅助函数

### 1. 自定义匹配器
```typescript
// custom-matchers.ts
expect.extend({
  toBeSorted(received: number[]) {
    const sorted = [...received].sort((a, b) => a - b);
    const pass = JSON.stringify(received) === JSON.stringify(sorted);

    return {
      pass,
      message: () => pass
        ? `期望 ${received} 不是有序的`
        : `期望 ${received} 是有序的，但得到 ${sorted}`
    };
  }
});

// 使用
test('数组应该是有序的', () => {
  const result = bubbleSort([3, 1, 2]);
  expect(result).toBeSorted();
});
```

### 2. 测试数据生成器
```typescript
// test-data-generator.ts
export class TestDataGenerator {
  static randomArray(size: number, min = 1, max = size): number[] {
    return Array.from({ length: size }, () =>
      Math.floor(Math.random() * (max - min + 1)) + min
    );
  }

  static sortedArray(size: number): number[] {
    return Array.from({ length: size }, (_, i) => i + 1);
  }

  static reversedArray(size: number): number[] {
    return Array.from({ length: size }, (_, i) => size - i);
  }

  static arrayWithDuplicates(size: number, duplicateCount: number): number[] {
    const base = Array.from({ length: size - duplicateCount }, (_, i) => i + 1);
    const duplicates = Array.from({ length: duplicateCount }, () =>
      Math.floor(Math.random() * (size - duplicateCount)) + 1
    );
    return [...base, ...duplicates];
  }
}
```

### 3. Mock 对象工厂
```typescript
// mock-factory.ts
export class MockFactory {
  static createMockCanvas(): ISortCanvas {
    return {
      renderFrame: vi.fn(),
      destroy: vi.fn(),
      resize: vi.fn()
    };
  }

  static createMockFrameState(override?: Partial<FrameState>): FrameState {
    return {
      algorithm: 'bubble',
      stepIndex: 0,
      progress: 0,
      phase: 'idle',
      description: '',
      entities: [],
      regions: [],
      overlays: [],
      ...override
    };
  }
}
```

## 🎯 组件测试最佳实践

### 1. 组件挂载测试
```typescript
test('组件应该正确挂载', () => {
  const wrapper = mount(ControlPanel);
  expect(wrapper.exists()).toBe(true);
  expect(wrapper.find('.control-panel').exists()).toBe(true);
});
```

### 2. Props 测试
```typescript
test('应该正确接收和显示 props', () => {
  const wrapper = mount(SortBarCanvas, {
    props: {
      array: [{ value: 5, displayIndex: 1 }],
      animationSpeed: 200
    }
  });

  expect(wrapper.props('array')).toEqual([{ value: 5, displayIndex: 1 }]);
  expect(wrapper.props('animationSpeed')).toBe(200);
});
```

### 3. 用户交互测试
```typescript
test('应该正确处理用户交互', async () => {
  const wrapper = mount(ControlPanel);
  const button = wrapper.find('button.play');

  await button.trigger('click');
  await wrapper.vm.$nextTick();

  expect(wrapper.emitted('play')).toBeTruthy();
});
```

## 🔄 集成测试最佳实践

### 1. 动画流程测试
```typescript
test('完整的播放流程', async () => {
  const { play, pause, reset, isPlaying } = useSortAnimation({
    sortFn: bubbleSort,
    speed: ref(200),
    canvasRef: canvasRef,
    originalArray: ref(testArray),
    algorithm: 'bubble'
  });

  // 等待初始化
  await waitFor(() => expect(isReady.value).toBe(true));

  // 开始播放
  play();
  await waitFor(() => expect(isPlaying.value).toBe(true));

  // 等待一些步骤
  await waitFor(() => expect(currentStep.value).toBeGreaterThan(0));

  // 暂停
  pause();
  expect(isPlaying.value).toBe(false);

  // 重置
  reset();
  expect(currentStep.value).toBe(0);
});
```

### 2. 状态同步测试
```typescript
test('统计数据应该正确同步', async () => {
  const { comparisons, swaps, step } = setupAnimation();

  const initialComparisons = comparisons.value;
  const initialSwaps = swaps.value;

  step();
  await nextTick();

  expect(comparisons.value).toBeGreaterThan(initialComparisons);
});
```

## 🌐 E2E 测试最佳实践

### 1. 页面对象模式
```typescript
// page-objects/ControlPanel.po.ts
export class ControlPanel {
  constructor(private page: Page) {}

  async selectAlgorithm(algorithm: string) {
    await this.page.selectOption('select[name="algorithm"]', algorithm);
  }

  async setArraySize(size: number) {
    await this.page.fill('input[type="range"][name="size"]', size.toString());
  }

  async setAnimationSpeed(speed: number) {
    await this.page.fill('input[type="range"][name="speed"]', speed.toString());
  }

  async clickPlay() {
    await this.page.click('button.play');
  }

  async clickPause() {
    await this.page.click('button.pause');
  }

  async clickReset() {
    await this.page.click('button.reset');
  }

  getStatistics() {
    return {
      comparisons: this.page.textContent('.stat-value.comparisons'),
      swaps: this.page.textContent('.stat-value.swaps'),
      steps: this.page.textContent('.stat-value.steps')
    };
  }
}
```

### 2. 等待策略
```typescript
test('应该等待动画完成', async ({ page }) => {
  const controlPanel = new ControlPanel(page);

  await controlPanel.clickPlay();

  // 等待特定状态
  await page.waitForSelector('.status-indicator.completed', {
    timeout: 30000
  });

  const stats = await controlPanel.getStatistics();
  expect(stats.steps).not.toContain('0');
});
```

## 📊 性能测试

### 1. 算法性能测试
```typescript
test('算法应该在合理时间内完成', () => {
  const largeArray = Array.from({ length: 1000 }, (_, i) => i + 1);

  const startTime = performance.now();
  const steps = quickSort(largeArray);
  const endTime = performance.now();

  const duration = endTime - startTime;

  expect(duration).toBeLessThan(100); // 100ms 内完成
  expect(steps.length).toBeLessThan(10000); // 步骤数合理
});
```

### 2. 内存使用测试
```typescript
test('不应该有内存泄漏', () => {
  const initialMemory = (performance as any).memory?.usedJSHeapSize;

  // 运行多次
  for (let i = 0; i < 100; i++) {
    const steps = bubbleSort([3, 1, 2]);
    // 清理引用
  }

  const finalMemory = (performance as any).memory?.usedJSHeapSize;

  if (initialMemory && finalMemory) {
    const memoryIncrease = finalMemory - initialMemory;
    expect(memoryIncrease).toBeLessThan(1024 * 1024); // 1MB
  }
});
```

## 🚫 反模式

### 1. 避免测试实现细节
```typescript
// ❌ 测试实现细节
test('应该调用 bubbleSort 函数', () => {
  const spy = vi.spyOn(utils, 'bubbleSort');
  // ...
  expect(spy).toHaveBeenCalled();
});

// ✅ 测试行为结果
test('应该正确排序数组', () => {
  const result = bubbleSort([3, 1, 2]);
  expect(result).toEqual([1, 2, 3]);
});
```

### 2. 避免脆弱的测试
```typescript
// ❌ 脆弱的测试
test('应该有 42 个步骤', () => {
  const steps = bubbleSort([3, 1, 2]);
  expect(steps.length).toBe(42); // 具体数字容易变
});

// ✅ 稳健的测试
test('步骤数应该在合理范围内', () => {
  const steps = bubbleSort([3, 1, 2]);
  expect(steps.length).toBeGreaterThan(0);
  expect(steps.length).toBeLessThan(100);
});
```

### 3. 避免过度使用 Mock
```typescript
// ❌ 过度 Mock
test('组件渲染', () => {
  const mockStore = {
    state: { array: [] },
    actions: { generateArray: vi.fn() }
  };
  // 大量 Mock...
});

// ✅ 使用真实实现
test('组件渲染', () => {
  const wrapper = mount(Component, {
    global: {
      plugins: [createTestingPinia({
        initialState: { array: [] }
      }]
    }
  });
});
```

## 📝 测试文档

### 1. 测试文件文档
```typescript
/**
 * bubbleSort.test.ts
 *
 * 测试冒泡排序算法的正确性、性能和边界情况处理
 *
 * 测试覆盖:
 * - 基本功能: 空数组、单元素、已排序、逆序、随机数组
 * - 步骤验证: 比较步骤、交换步骤、排序标记
 * - 边界情况: 重复元素、负数、混合正负数
 * - 性能特性: 步骤数、时间复杂度
 */
```

### 2. 复杂测试逻辑注释
```typescript
test('复杂算法逻辑', () => {
  // Setup: 创建测试数据
  const input = [3, 1, 4, 1, 5];

  // Act: 执行算法
  const steps = quickSort(input);

  // Assert: 验证基准选择策略
  const pivotSteps = steps.filter(s => s.type === 'pivot');
  expect(pivotSteps[0].indices[0]).toBe(input.length - 1);
  // ↑ 快速排序选择末尾元素作为基准
});
```

## 🔄 CI/CD 集成

### 1. 测试前置条件
```bash
# 确保环境一致性
npm ci
npm run type-check
npm run lint
```

### 2. 测试报告存储
```yaml
- name: 存储测试报告
  uses: actions/upload-artifact@v3
  with:
    name: test-results
    path: |
      coverage/
      playwright-report/
      test-results/
```

## 📈 持续改进

### 1. 定期审查测试
- 移除过时的测试
- 合并重复的测试
- 提高测试覆盖率

### 2. 性能监控
- 监控测试执行时间
- 优化慢速测试
- 并行化独立测试

### 3. 反馈循环
- 分析测试失败原因
- 改进错误处理
- 更新测试文档

记住：**好的测试应该快速、可靠、易维护**！
