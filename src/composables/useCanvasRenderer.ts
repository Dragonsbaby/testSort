import { ref, type Ref } from 'vue';
import type { SortStep } from '@/types/sorting';
import type { ArrayElement } from '@/stores/sortStore';

/**
 * 单个柱子的渲染状态
 * 用于跟踪每个柱子的位置、尺寸、颜色和动画状态
 */
export interface BarState {
  index: number; // 柱子在数组中的位置（动画时会变）
  value: number; // 柱子代表的数值（用于排序操作时查找）
  displayIndex: number; // 固定序号（1-based），跟随元素移动
  x: number; // 当前 X 坐标
  targetX: number; // 目标 X 坐标（动画结束后应到达的位置）
  y: number; // 底部 Y 坐标（固定为 containerHeight - offset）
  width: number; // 柱子宽度
  height: number; // 柱子高度（根据数值比例计算）
  color: { r: number; g: number; b: number }; // RGB 颜色
  glowIntensity: number; // 发光强度 0-1
}

/**
 * 当前排序步骤需要高亮的索引集合
 * 由 useSortAnimation 计算，传递给 useCanvasRenderer 用于颜色更新
 */
export interface HighlightedIndices {
  comparing: number[]; // 正在比较的元素
  swapping: number[]; // 正在交换的元素
  sorted: number[]; // 已排好序的元素
  pivot: number[]; // 基准元素（快排）
}

/**
 * 动画任务队列中的单个任务
 * 注意：目前只实现了 swap 动画，compare 类型未使用
 */
interface AnimationTask {
  indices: number[]; // 要交换的两个值 [val1, val2]
  startTime: number; // 动画开始时间戳
  duration: number; // 动画持续时长（毫秒）
  startX1: number; // 柱子1的起始 X 坐标
  startX2: number; // 柱子2的起始 X 坐标
  baseY: number; // 基础 Y 坐标（动画时 Y 会升高形成弧线）
  resolve?: () => void; // Promise resolve 回调，动画完成后调用
}

/** 各状态的默认颜色 */
const COLORS = {
  default: { r: 74, g: 158, b: 255 }, // 蓝色 - 默认状态
  comparing: { r: 255, g: 204, b: 0 }, // 黄色 - 比较中
  swapping: { r: 255, g: 107, b: 107 }, // 红色 - 交换中
  sorted: { r: 0, g: 255, b: 160 }, // 绿色 - 已排序
  pivot: { r: 155, g: 89, b: 182 }, // 紫色 - 基准点
};

/** 缓动函数 */
const EASING = {
  /** 三次方缓出 - 用于 swap 动画 */
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
};

const GAP = 4; // 柱子间距
const BAR_HEIGHT_OFFSET = 20; // 柱子底部距画布底部的偏移

/**
 * Canvas 渲染器组合式函数
 * 负责柱状图的绘制、颜色更新和交换动画
 *
 * @param canvasRef - Canvas 元素的引用
 * @param displayArray - 要显示的数组（响应式）
 * @param highlightedIndices - 当前步骤需要高亮的索引（响应式）
 */
export function useCanvasRenderer(canvasRef: Ref<HTMLCanvasElement | null>, displayArray: Ref<ArrayElement[]>, highlightedIndices: Ref<HighlightedIndices>) {
  /** 柱子状态数组，索引对应柱子位置 */
  const barStates = ref<BarState[]>([]);
  /** 待执行的动画任务队列 */
  const animationQueue = ref<AnimationTask[]>([]);
  /** 当前动画帧 ID，用于停止渲染循环 */
  let animationFrameId: number | null = null;
  /** 画布容器尺寸 */
  let containerHeight = 360;
  let containerWidth = 800;

  /**
   * 初始化渲染器
   * @param width 画布宽度
   * @param height 画布高度
   */
  function initialize(width: number, height: number) {
    setCanvasDimensions(width, height);
    updateBars();
  }

  /**
   * 调整画布尺寸
   * 柱子会重新计算位置和尺寸
   */
  function resize(width: number, height: number) {
    setCanvasDimensions(width, height);
    updateBars();
  }

  /** 设置画布尺寸并更新 DOM */
  function setCanvasDimensions(width: number, height: number) {
    containerWidth = Math.max(1, width);
    containerHeight = Math.max(1, height);
    if (canvasRef.value) {
      canvasRef.value.width = containerWidth;
      canvasRef.value.height = containerHeight;
    }
  }

  /**
   * 根据 displayArray 更新所有柱子的状态
   * @param clearQueue 是否清空动画队列（重置时为 true，正常更新时为 false）
   */
  function updateBars(clearQueue = true) {
    const arr = displayArray.value as ArrayElement[];
    if (!arr || arr.length === 0) return;

    // 重置时清空队列（柱子重建后旧动画无效）
    if (clearQueue) {
      animationQueue.value = [];
    }

    const maxValue = Math.max(...arr.map((e) => e.value));
    // 计算柱子宽度：确保总宽度不超过容器
    const maxBarWidth = Math.min(60, (containerWidth - GAP) / arr.length - GAP);
    const barWidth = Math.max(4, maxBarWidth);
    const totalWidth = arr.length * barWidth + (arr.length - 1) * GAP;
    const startX = Math.max(0, (containerWidth - totalWidth) / 2);

    // 保留旧状态的颜色和发光信息（按 displayIndex 查找，支持重复值）
    const oldStates = new Map(barStates.value.map((b) => [b.displayIndex, b]));

    barStates.value = arr.map((element, index) => {
      const old = oldStates.get(element.displayIndex);
      const x = startX + index * (barWidth + GAP);

      return {
        index,
        value: element.value,
        displayIndex: element.displayIndex,
        x,
        targetX: x,
        y: containerHeight - BAR_HEIGHT_OFFSET,
        width: barWidth,
        // 高度按数值比例计算，maxValue 为 0 时处理为 0
        height: maxValue > 0 ? (element.value / maxValue) * (containerHeight - 60) : 0,
        color: old?.color ?? COLORS.default,
        glowIntensity: old?.glowIntensity ?? 0,
      };
    });

    // 根据 highlightedIndices 更新颜色
    updateColors();
  }

  /**
   * 根据 highlightedIndices 更新所有柱子的颜色
   * 优先级：pivot > swapping > comparing > sorted > default
   */
  function updateColors() {
    const { comparing, swapping, sorted, pivot } = highlightedIndices.value;
    const comparingSet = new Set(comparing);
    const swappingSet = new Set(swapping);
    const sortedSet = new Set(sorted);
    const pivotSet = new Set(pivot);

    barStates.value.forEach((bar) => {
      if (pivotSet.has(bar.index)) {
        bar.color = COLORS.pivot;
        bar.glowIntensity = 0.8;
      } else if (swappingSet.has(bar.index)) {
        bar.color = COLORS.swapping;
        bar.glowIntensity = 1.0;
      } else if (comparingSet.has(bar.index)) {
        bar.color = COLORS.comparing;
        bar.glowIntensity = 0.6;
      } else if (sortedSet.has(bar.index)) {
        bar.color = COLORS.sorted;
        bar.glowIntensity = 0.3;
      } else {
        bar.color = COLORS.default;
        bar.glowIntensity = 0;
      }
    });
  }

  /**
   * 渲染循环的主 draw 函数
   * 每帧调用：清空画布 -> 画背景 -> 处理动画 -> 画柱子
   */
  function draw(timestamp: number) {
    const canvas = canvasRef.value;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBackground(ctx);
    processAnimations(timestamp);
    barStates.value.forEach((bar) => drawBar(ctx, bar));

    animationFrameId = requestAnimationFrame(draw);
  }

  /**
   * 绘制渐变背景、网格线和装饰
   */
  function drawBackground(ctx: CanvasRenderingContext2D) {
    const { width, height } = { width: containerWidth, height: containerHeight };

    // 垂直渐变背景
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#0f0f1a');
    bgGradient.addColorStop(0.5, '#1a1a2e');
    bgGradient.addColorStop(1, '#16213e');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // 顶部径向高光
    const topGlow = ctx.createRadialGradient(width / 2, 0, 0, width / 2, 0, height * 0.8);
    topGlow.addColorStop(0, 'rgba(74, 158, 255, 0.08)');
    topGlow.addColorStop(1, 'rgba(74, 158, 255, 0)');
    ctx.fillStyle = topGlow;
    ctx.fillRect(0, 0, width, height);

    // 底部渐变遮罩
    const bottomFade = ctx.createLinearGradient(0, height - 60, 0, height);
    bottomFade.addColorStop(0, 'rgba(0, 0, 0, 0)');
    bottomFade.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
    ctx.fillStyle = bottomFade;
    ctx.fillRect(0, height - 60, width, 60);

    // 网格线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 底部水平装饰线
    ctx.strokeStyle = 'rgba(78, 205, 196, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, height - 20);
    ctx.lineTo(width, height - 20);
    ctx.stroke();
  }

  /**
   * 绘制单个柱子和数值标签
   */
  function drawBar(ctx: CanvasRenderingContext2D, bar: BarState) {
    const { x, y, width, height, color, glowIntensity } = bar;
    const barTop = y - height;

    // 跳过不可见的柱子
    if (width <= 0 || height <= 0 || barTop > containerHeight || y < 0) {
      return;
    }

    // 发光效果
    if (glowIntensity > 0) {
      ctx.shadowColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${glowIntensity * 0.8})`;
      ctx.shadowBlur = 15 * glowIntensity;
    } else {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    // 柱子渐变填充
    const gradient = ctx.createLinearGradient(x, y, x, barTop);
    gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 1)`);
    gradient.addColorStop(0.5, `rgba(${Math.min(255, color.r + 30)}, ${Math.min(255, color.g + 30)}, ${Math.min(255, color.b + 30)}, 1)`);
    gradient.addColorStop(1, `rgba(${Math.max(0, color.r - 20)}, ${Math.max(0, color.g - 20)}, ${Math.max(0, color.b - 20)}, 0.9)`);
    ctx.fillStyle = gradient;

    // 圆角矩形路径
    const radius = Math.min(4, width / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y - radius);
    ctx.lineTo(x + width, barTop + radius);
    ctx.quadraticCurveTo(x + width, barTop, x + width - radius, barTop);
    ctx.lineTo(x + radius, barTop);
    ctx.quadraticCurveTo(x, barTop, x, barTop + radius);
    ctx.lineTo(x, y - radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 顶部高光
    ctx.fillStyle = `rgba(255, 255, 255, ${0.15 + glowIntensity * 0.15})`;
    ctx.fillRect(x + 2, barTop, width - 4, 3);

    // 数值标签（柱子足够高时显示）
    if (height > 25) {
      ctx.font = `600 ${Math.min(10, width - 2)}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 2;
      ctx.fillStyle = '#ffffff';

      // 确保文字在可见区域内
      const minTextY = 5;
      let textY = barTop - 8;
      if (textY < minTextY || barTop < 15) {
        textY = Math.max(y - 15, minTextY);
      }
      ctx.fillText(bar.value.toString(), x + width / 2, textY);
      ctx.shadowBlur = 0;
    }

    // 底部序号标签（亮绿色）
    ctx.font = `600 ${Math.min(10, width - 2)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 2;
    ctx.fillStyle = 'rgb(57, 255, 20)'; // 亮绿色
    ctx.fillText(bar.displayIndex.toString(), x + width / 2, y + 12);
    ctx.shadowBlur = 0;
  }

  /**
   * 处理动画队列中的所有任务
   * 每帧调用，更新动画进度并调用完成回调
   */
  function processAnimations(timestamp: number) {
    const toRemove: number[] = [];

    animationQueue.value.forEach((task, i) => {
      const elapsed = timestamp - task.startTime;
      const rawProgress = elapsed / task.duration;

      // 所有排队的任务都是 swap 类型，直接使用 easeOutCubic 缓动
      const easedProgress = EASING.easeOutCubic(Math.min(1, rawProgress));
      animateSwap(task, easedProgress);

      if (rawProgress >= 1) {
        toRemove.push(i);
        finalizeSwap(task);
      }
    });

    // 逆序删除避免索引偏移
    toRemove.reverse().forEach((i) => animationQueue.value.splice(i, 1));
  }

  /**
   * 更新 swap 动画中两个柱子的位置
   * 沿抛物线弧线移动（Y 坐标先上升再下降）
   */
  function animateSwap(task: AnimationTask, progress: number) {
    const [val1, val2] = task.indices;
    const bar1 = barStates.value.find((b) => b.value === val1);
    const bar2 = barStates.value.find((b) => b.value === val2);
    if (!bar1 || !bar2) return;

    const deltaX = task.startX2 - task.startX1;
    // 抛物线弧度：0 -> 最高 -> 0
    const arcHeight = Math.sin(progress * Math.PI) * 50;

    bar1.x = task.startX1 + deltaX * progress;
    bar1.y = task.baseY - arcHeight;
    bar2.x = task.startX2 - deltaX * progress;
    bar2.y = task.baseY - arcHeight;
  }

  /**
   * 动画完成后的最终处理
   * 恢复 Y 坐标到基础位置，更新 targetX，调用 resolve
   */
  function finalizeSwap(task: AnimationTask) {
    const [val1, val2] = task.indices;
    const bar1 = barStates.value.find((b) => b.value === val1);
    const bar2 = barStates.value.find((b) => b.value === val2);
    if (bar1 && bar2) {
      bar1.y = task.baseY;
      bar2.y = task.baseY;
    }

    barStates.value.forEach((bar) => {
      bar.targetX = bar.x;
    });

    // 动画完成，resolve Promise 让 applyStep 继续
    task.resolve?.();
  }

  /** 启动渲染循环 */
  function startRenderLoop() {
    if (animationFrameId !== null) return;
    animationFrameId = requestAnimationFrame(draw);
  }

  /** 停止渲染循环 */
  function stopRenderLoop() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  /**
   * 将 swap 动画加入队列
   * @param speed 动画速度（毫秒）
   * @param values 要交换的两个值
   * @param oldPositions 交换前的位置映射，用于平滑过渡动画
   * @returns Promise，动画完成后 resolve
   */
  function queueSwap(speed: number, values: [number, number], oldPositions?: Map<number, number>): Promise<number> {
    const bar1 = barStates.value.find((b) => b.value === values[0]);
    const bar2 = barStates.value.find((b) => b.value === values[1]);
    if (!bar1 || !bar2) return Promise.resolve(0);

    // 确保动画时长至少 200ms
    const duration = Math.max(speed, 200);

    const startX1 = oldPositions?.get(values[0]) ?? bar1.x;
    const startX2 = oldPositions?.get(values[1]) ?? bar2.x;

    return new Promise<number>((resolve) => {
      animationQueue.value.push({
        indices: [bar1.value, bar2.value],
        startTime: performance.now(),
        duration,
        startX1,
        startX2,
        baseY: containerHeight - BAR_HEIGHT_OFFSET,
        resolve: () => resolve(duration),
      });
    });
  }

  /**
   * 处理排序步骤，驱动相应的动画
   * @param step 排序步骤
   * @param speed 动画速度
   * @param oldPositions 交换前的位置映射
   * @returns Promise（swap/merge）或 undefined（compare/set）
   */
  function onStep(step: SortStep, speed: number, oldPositions?: Map<number, number>): Promise<number> | number | undefined {
    if ((step.type === 'swap' || step.type === 'merge') && step.indices.length === 2 && step.arraySnapshot) {
      const oldValues: [number, number] = [step.arraySnapshot[step.indices[0]], step.arraySnapshot[step.indices[1]]];
      return queueSwap(speed, oldValues, oldPositions);
    }
    // compare 和 set 操作不需要动画，返回 undefined 让调用方使用默认速度
    return undefined;
  }

  return {
    barStates,
    initialize,
    resize,
    updateBars,
    startRenderLoop,
    stopRenderLoop,
    onStep,
    queueSwap,
  };
}
