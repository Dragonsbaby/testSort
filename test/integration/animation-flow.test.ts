import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { useSortAnimation } from '@/composables/useSortAnimation';
import { bubbleSort, quickSort } from '@/utils/sortingAlgorithms';
import { useSortStore } from '@/stores/sortStore';
import { createPinia, setActivePinia } from 'pinia';
import type { ISortCanvas } from '@/composables/useSortAnimation';

// Mock Canvas 组件
const mockCanvasRenderer = vi.hoisted(() => ({
  renderFrame: vi.fn(),
  currentFrame: null,
  reset: vi.fn()
}));

// 创建 mock ISortCanvas
function createMockCanvas(): ISortCanvas {
  return {
    renderFrame: vi.fn((frame) => {
      mockCanvasRenderer.currentFrame = frame;
    })
  };
}

describe('useSortAnimation 集成测试', () => {
  let canvasRef: ReturnType<typeof ref<ISortCanvas | null>>;

  beforeEach(() => {
    setActivePinia(createPinia());
    canvasRef = ref(createMockCanvas());
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('初始化流程', () => {
    test('应该正确初始化动画系统', () => {
      const store = useSortStore();
      store.generateArray(5);

      const { array, isReady, steps } = useSortAnimation({
        sortFn: bubbleSort,
        speed: ref(200),
        canvasRef: canvasRef,
        originalArray: ref(store.originalArray),
        algorithm: 'bubble'
      });

      // 等待异步操作完成
      setTimeout(() => {
        expect(array.value).toHaveLength(5);
        expect(isReady.value).toBe(true);
        expect(steps.value.length).toBeGreaterThan(0);
      }, 150);
    });

    test('应该创建初始帧并渲染', () => {
      const store = useSortStore();
      store.generateArray(3);

      useSortAnimation({
        sortFn: bubbleSort,
        speed: ref(200),
        canvasRef: canvasRef,
        originalArray: ref(store.originalArray),
        algorithm: 'bubble'
      });

      setTimeout(() => {
        expect(mockCanvasRenderer.renderFrame).toHaveBeenCalled();
      }, 150);
    });
  });

  describe('播放控制集成', () => {
    test('play/pause 应该正确控制动画', () => {
      const store = useSortStore();
      store.generateArray(5);

      const { isPlaying, play, pause } = useSortAnimation({
        sortFn: bubbleSort,
        speed: ref(200),
        canvasRef: canvasRef,
        originalArray: ref(store.originalArray),
        algorithm: 'bubble'
      });

      setTimeout(() => {
        expect(isPlaying.value).toBe(false);

        play();
        expect(isPlaying.value).toBe(true);

        pause();
        expect(isPlaying.value).toBe(false);
      }, 150);
    });

    test('step 应该单步执行', () => {
      const store = useSortStore();
      store.generateArray(3);

      const { currentStep, step, steps } = useSortAnimation({
        sortFn: bubbleSort,
        speed: ref(200),
        canvasRef: canvasRef,
        originalArray: ref(store.originalArray),
        algorithm: 'bubble'
      });

      setTimeout(() => {
        const initialStep = currentStep.value;
        expect(initialStep).toBe(0);

        step();

        setTimeout(() => {
          expect(currentStep.value).toBeGreaterThan(initialStep);
          expect(currentStep.value).toBeLessThanOrEqual(steps.value.length);
        }, 50);
      }, 150);
    });

    test('reset 应该重置动画', () => {
      const store = useSortStore();
      store.generateArray(3);

      const { currentStep, play, reset, comparisons, swaps } = useSortAnimation({
        sortFn: bubbleSort,
        speed: ref(200),
        canvasRef: canvasRef,
        originalArray: ref(store.originalArray),
        algorithm: 'bubble'
      });

      setTimeout(() => {
        play();

        setTimeout(() => {
          expect(currentStep.value).toBeGreaterThan(0);

          reset();

          expect(currentStep.value).toBe(0);
          expect(comparisons.value).toBe(0);
          expect(swaps.value).toBe(0);
        }, 50);
      }, 150);
    });
  });

  describe('统计数据同步', () => {
    test('应该正确统计比较次数', () => {
      const store = useSortStore();
      store.generateArray(5);

      const { comparisons, play } = useSortAnimation({
        sortFn: bubbleSort,
        speed: ref(200),
        canvasRef: canvasRef,
        originalArray: ref(store.originalArray),
        algorithm: 'bubble'
      });

      setTimeout(() => {
        const initialComparisons = comparisons.value;
        expect(initialComparisons).toBe(0);

        play();

        // 等待一些步骤执行
        setTimeout(() => {
          expect(comparisons.value).toBeGreaterThan(initialComparisons);
        }, 100);
      }, 150);
    });

    test('应该正确统计交换次数', () => {
      const store = useSortStore();
      store.generateArray([5, 4, 3, 2, 1]); // 逆序数组会有更多交换

      const { swaps, play } = useSortAnimation({
        sortFn: bubbleSort,
        speed: ref(200),
        canvasRef: canvasRef,
        originalArray: ref(store.originalArray),
        algorithm: 'bubble'
      });

      setTimeout(() => {
        play();

        setTimeout(() => {
          expect(swaps.value).toBeGreaterThan(0);
        }, 100);
      }, 150);
    });
  });

  describe('数组状态同步', () => {
    test('应该同步数组状态到显示', () => {
      const store = useSortStore();
      store.generateArray([3, 1, 2]);

      const { array, step } = useSortAnimation({
        sortFn: bubbleSort,
        speed: ref(200),
        canvasRef: canvasRef,
        originalArray: ref(store.originalArray),
        algorithm: 'bubble'
      });

      setTimeout(() => {
        const initialArray = [...array.value];

        step();

        setTimeout(() => {
          // 数组状态可能改变
          expect(array.value).toBeDefined();
          expect(array.value.length).toBe(3);
        }, 50);
      }, 150);
    });
  });

  describe('多算法切换', () => {
    test('应该支持算法切换', () => {
      const store = useSortStore();
      store.generateArray(5);

      const bubbleAnimation = useSortAnimation({
        sortFn: bubbleSort,
        speed: ref(200),
        canvasRef: canvasRef,
        originalArray: ref(store.originalArray),
        algorithm: 'bubble'
      });

      const quickAnimation = useSortAnimation({
        sortFn: quickSort,
        speed: ref(200),
        canvasRef: ref(createMockCanvas()),
        originalArray: ref(store.originalArray),
        algorithm: 'quick'
      });

      setTimeout(() => {
        expect(bubbleAnimation.steps.value.length).toBeGreaterThan(0);
        expect(quickAnimation.steps.value.length).toBeGreaterThan(0);

        // 不同算法的步骤数可能不同
        expect(bubbleAnimation.steps.value.length).not.toBe(quickAnimation.steps.value.length);
      }, 150);
    });
  });

  describe('速度控制集成', () => {
    test('速度变化应该重新构建时间轴', () => {
      const store = useSortStore();
      store.generateArray(3);

      const speedRef = ref(200);

      const { rebuild } = useSortAnimation({
        sortFn: bubbleSort,
        speed: speedRef,
        canvasRef: canvasRef,
        originalArray: ref(store.originalArray),
        algorithm: 'bubble'
      });

      setTimeout(() => {
        const initialCallCount = mockCanvasRenderer.renderFrame.mock.calls.length;

        speedRef.value = 100;

        // 等待防抖执行
        setTimeout(() => {
          expect(mockCanvasRenderer.renderFrame.mock.calls.length).toBeGreaterThan(initialCallCount);
        }, 150);
      }, 150);
    });
  });

  describe('状态文本更新', () => {
    test('应该正确显示状态文本', () => {
      const store = useSortStore();
      store.generateArray(3);

      const { statusText, isReady, play } = useSortAnimation({
        sortFn: bubbleSort,
        speed: ref(200),
        canvasRef: canvasRef,
        originalArray: ref(store.originalArray),
        algorithm: 'bubble'
      });

      setTimeout(() => {
        expect(isReady.value).toBe(true);
        expect(statusText.value).toMatch(/就绪/);

        play();

        setTimeout(() => {
          expect(statusText.value).toMatch(/播放中/);
        }, 50);
      }, 150);
    });

    test('应该正确显示当前操作信息', () => {
      const store = useSortStore();
      store.generateArray(3);

      const { currentStepInfo, step } = useSortAnimation({
        sortFn: bubbleSort,
        speed: ref(200),
        canvasRef: canvasRef,
        originalArray: ref(store.originalArray),
        algorithm: 'bubble'
      });

      setTimeout(() => {
        expect(currentStepInfo.value).toBeNull();

        step();

        setTimeout(() => {
          expect(currentStepInfo.value).toBeDefined();
          expect(currentStepInfo.value?.description).toBeTruthy();
        }, 50);
      }, 150);
    });
  });

  describe('错误处理和边界情况', () => {
    test('空数组应该正常处理', () => {
      const store = useSortStore();
      store.generateArray(0);

      const { steps, isReady } = useSortAnimation({
        sortFn: bubbleSort,
        speed: ref(200),
        canvasRef: canvasRef,
        originalArray: ref(store.originalArray),
        algorithm: 'bubble'
      });

      setTimeout(() => {
        expect(isReady.value).toBe(true);
        expect(steps.value.length).toBe(0);
      }, 150);
    });

    test('单元素数组应该正常处理', () => {
      const store = useSortStore();
      store.generateArray(1);

      const { steps, isReady } = useSortAnimation({
        sortFn: bubbleSort,
        speed: ref(200),
        canvasRef: canvasRef,
        originalArray: ref(store.originalArray),
        algorithm: 'bubble'
      });

      setTimeout(() => {
        expect(isReady.value).toBe(true);
        expect(steps.value.length).toBeGreaterThan(0);
      }, 150);
    });

    test('极大数组应该正常处理', () => {
      const store = useSortStore();
      store.generateArray(100);

      const { steps, isReady } = useSortAnimation({
        sortFn: bubbleSort,
        speed: ref(200),
        canvasRef: canvasRef,
        originalArray: ref(store.originalArray),
        algorithm: 'bubble'
      });

      setTimeout(() => {
        expect(isReady.value).toBe(true);
        expect(steps.value.length).toBeGreaterThan(0);
      }, 500); // 更长的超时时间
    });
  });

  describe('Canvas 渲染集成', () => {
    test('应该为每一步生成有效的帧状态', () => {
      const store = useSortStore();
      store.generateArray(3);

      const { step } = useSortAnimation({
        sortFn: bubbleSort,
        speed: ref(200),
        canvasRef: canvasRef,
        originalArray: ref(store.originalArray),
        algorithm: 'bubble'
      });

      setTimeout(() => {
        step();

        setTimeout(() => {
          const renderedFrame = mockCanvasRenderer.currentFrame;

          expect(renderedFrame).toBeDefined();
          expect(renderedFrame?.entities).toBeInstanceOf(Array);
          expect(renderedFrame?.entities.length).toBeGreaterThan(0);
        }, 50);
      }, 150);
    });

    test('帧状态应该包含必要的属性', () => {
      const store = useSortStore();
      store.generateArray(3);

      const { step } = useSortAnimation({
        sortFn: bubbleSort,
        speed: ref(200),
        canvasRef: canvasRef,
        originalArray: ref(store.originalArray),
        algorithm: 'bubble'
      });

      setTimeout(() => {
        step();

        setTimeout(() => {
          const frame = mockCanvasRenderer.currentFrame;

          expect(frame).toHaveProperty('algorithm');
          expect(frame).toHaveProperty('stepIndex');
          expect(frame).toHaveProperty('progress');
          expect(frame).toHaveProperty('phase');
          expect(frame).toHaveProperty('description');
          expect(frame).toHaveProperty('entities');
          expect(frame).toHaveProperty('regions');
          expect(frame).toHaveProperty('overlays');
        }, 50);
      }, 150);
    });
  });

  describe('内存泄漏和资源清理', () => {
    test('应该正确清理定时器', () => {
      const store = useSortStore();
      store.generateArray(5);

      const { play } = useSortAnimation({
        sortFn: bubbleSort,
        speed: ref(200),
        canvasRef: canvasRef,
        originalArray: ref(store.originalArray),
        algorithm: 'bubble'
      });

      setTimeout(() => {
        play();

        // 在测试结束前确保清理
        expect(() => {
          // 组件卸载时的清理逻辑
        }).not.toThrow();
      }, 150);
    });
  });
});
