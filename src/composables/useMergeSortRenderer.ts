import { ref, type Ref } from 'vue';
import type { SortStep } from '@/types/sorting';
import type { ArrayElement } from '@/stores/sortStore';
import type { HighlightedIndices } from '@/composables/useCanvasRenderer';

// 复用 BarState 类型
export type { BarState } from '@/composables/useCanvasRenderer';
import type { BarState } from '@/composables/useCanvasRenderer';

// ─── 布局常量 ───────────────────────────────────────────────────────────────
const GAP = 4;                  // 柱子间距（与 useCanvasRenderer 保持一致）
const DIVIDER_RATIO = 0.5;      // 分割线在画布高度的位置比例
const DIVIDER_HALF_GAP = 18;    // 分割线上下各留 18px 间距（柱子底部与分割线的距离）
const TOP_LABEL_OFFSET = 28;    // 上排柱子顶部与画布顶边的最小间距（留给数值标签）
const BOTTOM_LABEL_OFFSET = 18; // 下排柱子底部标签高度
const SLOT_HEIGHT = 24;         // 空槽固定高度（px）
const SLOT_BORDER_RADIUS = 3;   // 空槽圆角

// ─── 颜色表 ──────────────────────────────────────────────────────────────────
const COLORS = {
  default:   { r: 74,  g: 158, b: 255 }, // 蓝色 - 默认
  comparing: { r: 255, g: 204, b: 0   }, // 黄色 - 比较中
  swapping:  { r: 255, g: 107, b: 107 }, // 红色 - 交换中
  sorted:    { r: 103, g: 194, b: 58  }, // 绿色 - 已排序
  pivot:     { r: 155, g: 89,  b: 182 }, // 紫色 - 基准点
  pending:   { r: 149, g: 117, b: 205 }, // 淡紫 - 待排序（当前组）
  tempFill:  { r: 78,  g: 205, b: 196 }, // 青色 - 下排已填入的元素
  tempNew:   { r: 255, g: 160, b: 50  }, // 橙色 - 下排刚放入的元素（高亮）
};

const EASING = {
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
};

// ─── 动画任务（swap，归并排序暂不使用，保留扩展性） ─────────────────────────
interface AnimationTask {
  indices: number[];
  startTime: number;
  duration: number;
  startX1: number;
  startX2: number;
  baseY: number;
  resolve?: () => void;
}

/**
 * 归并排序专用 Canvas 渲染器
 * 上排：主数组柱状图（高亮当前合并区间）
 * 下排：辅助数组（空槽 + 已填入的柱子）
 *
 * @param canvasRef        - Canvas 元素引用
 * @param displayArray     - 主数组（响应式）
 * @param highlightedIndices - 当前步骤高亮索引（响应式）
 */
export function useMergeSortRenderer(
  canvasRef: Ref<HTMLCanvasElement | null>,
  displayArray: Ref<ArrayElement[]>,
  highlightedIndices: Ref<HighlightedIndices>,
) {
  // ── 上排状态 ──────────────────────────────────────────────────────────────
  const barStates = ref<BarState[]>([]);
  const animationQueue = ref<AnimationTask[]>([]);
  let animationFrameId: number | null = null;

  // ── 下排状态 ──────────────────────────────────────────────────────────────
  /** 辅助数组值（与主数组等长，null = 空槽） */
  const tempValues = ref<(number | null)[]>([]);
  /** 当前激活的合并区间 [left, right]，null = 无合并进行中 */
  const activeMergeRange = ref<[number, number] | null>(null);
  /** 下排最近一次放入位置（橙色高亮） */
  const lastTempIndex = ref<number | null>(null);

  // ── 画布尺寸 ──────────────────────────────────────────────────────────────
  let containerWidth = 800;
  let containerHeight = 360;

  // ─── 布局计算（每帧或 resize 后调用） ────────────────────────────────────
  /** 分割线 Y 坐标 */
  function dividerY() {
    return Math.floor(containerHeight * DIVIDER_RATIO);
  }
  /** 上排柱子底部锚点 Y（从分割线向上偏移） */
  function topRowBottomY() {
    return dividerY() - DIVIDER_HALF_GAP;
  }
  /** 上排柱子最大高度 */
  function topRowMaxHeight() {
    return topRowBottomY() - TOP_LABEL_OFFSET;
  }
  /** 下排柱子底部锚点 Y */
  function bottomRowBottomY() {
    return containerHeight - BOTTOM_LABEL_OFFSET;
  }
  /** 下排柱子最大高度 */
  function bottomRowMaxHeight() {
    return bottomRowBottomY() - dividerY() - DIVIDER_HALF_GAP - 10;
  }

  // ─── 初始化 / resize ───────────────────────────────────────────────────────
  function initialize(width: number, height: number) {
    setCanvasDimensions(width, height);
    updateBars();
  }

  function resize(width: number, height: number) {
    setCanvasDimensions(width, height);
    updateBars();
  }

  function setCanvasDimensions(width: number, height: number) {
    containerWidth = Math.max(1, width);
    containerHeight = Math.max(1, height);
    const canvas = canvasRef.value;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(containerWidth * dpr);
    canvas.height = Math.floor(containerHeight * dpr);
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${containerHeight}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = false;
    }
  }

  // ─── 柱子宽度 / X 坐标计算（上下排共用同一套布局，保证对齐） ───────────────
  function getBarLayout() {
    const arr = displayArray.value;
    if (!arr || arr.length === 0) return null;
    const n = arr.length;
    const maxBarWidth = Math.min(60, (containerWidth - GAP) / n - GAP);
    const barWidth = Math.max(4, maxBarWidth);
    const totalWidth = n * barWidth + (n - 1) * GAP;
    const startX = Math.max(0, (containerWidth - totalWidth) / 2);
    return { barWidth, startX, n };
  }

  // ─── 上排：更新 barStates ─────────────────────────────────────────────────
  function updateBars(clearQueue = true) {
    const arr = displayArray.value as ArrayElement[];
    if (!arr || arr.length === 0) return;
    if (clearQueue) animationQueue.value = [];

    const layout = getBarLayout();
    if (!layout) return;
    const { barWidth, startX } = layout;
    const maxValue = Math.max(...arr.map(e => e.value));
    const maxH = topRowMaxHeight();

    const oldStates = new Map(barStates.value.map(b => [b.displayIndex, b]));

    barStates.value = arr.map((element, index) => {
      const old = oldStates.get(element.displayIndex);
      const x = Math.round(startX + index * (barWidth + GAP));
      return {
        index,
        value: element.value,
        displayIndex: element.displayIndex,
        x,
        targetX: x,
        y: Math.round(topRowBottomY()),
        width: barWidth,
        height: maxValue > 0 ? Math.max(5, Math.round((element.value / maxValue) * maxH)) : 0,
        color: old?.color ?? COLORS.default,
        glowIntensity: old?.glowIntensity ?? 0,
      };
    });

    updateColors();
  }

  // ─── 上排：颜色更新 ────────────────────────────────────────────────────────
  function updateColors() {
    const { comparing, swapping, sorted, pivot, pending } = highlightedIndices.value;
    const comparingSet = new Set(comparing);
    const swappingSet  = new Set(swapping);
    const sortedSet    = new Set(sorted);
    const pivotSet     = new Set(pivot);
    const pendingSet   = new Set(pending);

    barStates.value.forEach(bar => {
      if (pivotSet.has(bar.index)) {
        bar.color = COLORS.pivot;      bar.glowIntensity = 0.8;
      } else if (swappingSet.has(bar.index)) {
        if (comparingSet.has(bar.index)) {
          bar.color = COLORS.comparing; bar.glowIntensity = 0.6;
        } else {
          bar.color = COLORS.default;   bar.glowIntensity = 0;
        }
      } else if (comparingSet.has(bar.index)) {
        bar.color = COLORS.comparing;  bar.glowIntensity = 0.6;
      } else if (pendingSet.has(bar.index)) {
        bar.color = COLORS.pending;    bar.glowIntensity = 0.25;
      } else if (sortedSet.has(bar.index)) {
        bar.color = COLORS.sorted;     bar.glowIntensity = 0.3;
      } else {
        bar.color = COLORS.default;    bar.glowIntensity = 0;
      }
    });
  }

  // ─── 下排：设置合并区间（显示空槽） ─────────────────────────────────────────
  function setActiveMergeRange(range: [number, number] | null) {
    activeMergeRange.value = range;
    if (!range) {
      lastTempIndex.value = null;
    }
  }

  // ─── 下排：根据 tempSnapshot 刷新辅助数组显示 ─────────────────────────────
  function updateTempBars(snapshot: (number | null)[], newIndex?: number) {
    tempValues.value = [...snapshot];
    lastTempIndex.value = newIndex ?? null;
  }

  // ─── 下排：清空辅助数组 ───────────────────────────────────────────────────
  function clearTempBars() {
    tempValues.value = [];
    lastTempIndex.value = null;
  }

  // ─── 渲染主循环 ───────────────────────────────────────────────────────────
  function draw(timestamp: number) {
    const canvas = canvasRef.value;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, containerWidth, containerHeight);
    drawBackground(ctx);
    processAnimations(timestamp);

    // 上排柱子
    barStates.value.forEach(bar => drawBar(ctx, bar));

    // 下排：仅在有激活合并区间时渲染
    if (activeMergeRange.value) {
      drawBottomRow(ctx);
    }

    animationFrameId = requestAnimationFrame(draw);
  }

  // ─── 背景（深色 + 网格 + 分割线） ────────────────────────────────────────
  function drawBackground(ctx: CanvasRenderingContext2D) {
    const w = containerWidth, h = containerHeight;

    // 背景
    ctx.fillStyle = '#0f1219';
    ctx.fillRect(0, 0, w, h);

    // 网格线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const gs = 40;
    for (let x = 0; x < w; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    // 上排底部装饰线
    ctx.strokeStyle = 'rgba(78, 205, 196, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, topRowBottomY() + 14);
    ctx.lineTo(w, topRowBottomY() + 14);
    ctx.stroke();

    // 中间分割线（实线 + 标签）
    const dy = dividerY();
    ctx.strokeStyle = 'rgba(78, 205, 196, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    ctx.moveTo(0, dy);
    ctx.lineTo(w, dy);
    ctx.stroke();
    ctx.setLineDash([]);

    // 分割线左侧标签
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(78, 205, 196, 0.7)';
    ctx.textAlign = 'left';
    ctx.fillText('MERGE TEMP', 8, dy + 13);

    // 下排底部装饰线
    ctx.strokeStyle = 'rgba(78, 205, 196, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, containerHeight - BOTTOM_LABEL_OFFSET + 2);
    ctx.lineTo(w, containerHeight - BOTTOM_LABEL_OFFSET + 2);
    ctx.stroke();
  }

  // ─── 上排：绘制单个柱子 ──────────────────────────────────────────────────
  function drawBar(ctx: CanvasRenderingContext2D, bar: BarState) {
    const { x, y, width, height, color, glowIntensity } = bar;
    const bx = Math.round(x);
    const by = Math.round(y);
    const bw = Math.round(width);
    const bh = Math.round(height);
    if (bw <= 0 || bh <= 0) return;

    const barTop = by - bh;
    if (barTop > containerHeight || by < 0) return;

    const radius = Math.min(3, Math.round(bw / 2));
    drawRoundedRect(ctx, bx, barTop, bw, bh, radius);

    const gradient = ctx.createLinearGradient(0, barTop, 0, by);
    gradient.addColorStop(0, `rgba(${Math.min(255, color.r + 60)}, ${Math.min(255, color.g + 60)}, ${Math.min(255, color.b + 60)}, 1)`);
    gradient.addColorStop(0.5, `rgb(${color.r}, ${color.g}, ${color.b})`);
    gradient.addColorStop(1, `rgba(${Math.max(0, color.r - 40)}, ${Math.max(0, color.g - 40)}, ${Math.max(0, color.b - 40)}, 1)`);
    ctx.fillStyle = gradient;
    ctx.fill();

    if (glowIntensity > 0) {
      ctx.shadowColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${glowIntensity * 0.8})`;
      ctx.shadowBlur = 12 * glowIntensity;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = `rgba(255, 255, 255, ${0.35 + glowIntensity * 0.15})`;
    ctx.fillRect(bx + 3, barTop + 2, bw - 6, 3);

    // 数值标签（柱子顶部上方）
    ctx.font = `600 ${Math.min(10, width - 2)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 2;
    ctx.fillStyle = '#f7cb07';
    const minTextY = 5;
    let textY = barTop - 8;
    if (textY < minTextY || barTop < 15) textY = Math.max(by - 15, minTextY);
    ctx.fillText(bar.value.toString(), x + width / 2, textY);
    ctx.shadowBlur = 0;

    // 底部序号标签
    ctx.font = `bold ${Math.min(12, bw - 2)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#20e25a';
    ctx.fillText(bar.displayIndex.toString(), bx + bw / 2, by + 16);
  }

  // ─── 下排：绘制辅助数组（空槽 + 已填入的柱子） ────────────────────────────
  function drawBottomRow(ctx: CanvasRenderingContext2D) {
    const range = activeMergeRange.value;
    if (!range) return;
    const [left, right] = range;

    const layout = getBarLayout();
    if (!layout) return;
    const { barWidth, startX } = layout;

    const arr = displayArray.value;
    if (!arr || arr.length === 0) return;
    const maxValue = Math.max(...arr.map(e => e.value));
    const maxH = bottomRowMaxHeight();
    const bottomY = Math.round(bottomRowBottomY());

    for (let idx = left; idx <= right; idx++) {
      const x = Math.round(startX + idx * (barWidth + GAP));
      const val = tempValues.value[idx] ?? null;

      if (val === null) {
        // 空槽：虚线矩形
        drawEmptySlot(ctx, x, bottomY, barWidth);
      } else {
        // 已填入：实体柱子（最近放入的用橙色，其余用青色）
        const isNew = idx === lastTempIndex.value;
        const color = isNew ? COLORS.tempNew : COLORS.tempFill;
        const glowIntensity = isNew ? 0.7 : 0.2;
        const height = maxValue > 0 ? Math.max(5, Math.round((val / maxValue) * maxH)) : 0;

        const bw = Math.round(barWidth);
        const barTop = bottomY - height;
        const radius = Math.min(3, Math.round(bw / 2));
        drawRoundedRect(ctx, x, barTop, bw, height, radius);

        const gradient = ctx.createLinearGradient(0, barTop, 0, bottomY);
        gradient.addColorStop(0, `rgba(${Math.min(255, color.r + 60)}, ${Math.min(255, color.g + 60)}, ${Math.min(255, color.b + 60)}, 1)`);
        gradient.addColorStop(0.5, `rgb(${color.r}, ${color.g}, ${color.b})`);
        gradient.addColorStop(1, `rgba(${Math.max(0, color.r - 40)}, ${Math.max(0, color.g - 40)}, ${Math.max(0, color.b - 40)}, 1)`);
        ctx.fillStyle = gradient;
        ctx.fill();

        if (glowIntensity > 0) {
          ctx.shadowColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${glowIntensity * 0.8})`;
          ctx.shadowBlur = 12 * glowIntensity;
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // 高光条
        ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + glowIntensity * 0.15})`;
        ctx.fillRect(x + 3, barTop + 2, bw - 6, 3);

        // 数值标签
        ctx.font = `600 ${Math.min(10, bw - 2)}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 2;
        ctx.fillStyle = isNew ? '#fff' : '#e0f7f6';
        let textY = barTop - 8;
        if (textY < dividerY() + 5) textY = dividerY() + 14;
        ctx.fillText(val.toString(), x + bw / 2, textY);
        ctx.shadowBlur = 0;
      }
    }
  }

  // ─── 辅助：绘制空槽（虚线边框矩形） ─────────────────────────────────────
  function drawEmptySlot(ctx: CanvasRenderingContext2D, x: number, bottomY: number, width: number) {
    const bw = Math.round(width);
    const bx = Math.round(x);
    const slotTop = bottomY - SLOT_HEIGHT;
    ctx.save();
    ctx.strokeStyle = 'rgba(78, 205, 196, 0.4)';
    ctx.fillStyle = 'rgba(78, 205, 196, 0.05)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.roundRect(bx, slotTop, bw, SLOT_HEIGHT, SLOT_BORDER_RADIUS);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ─── 辅助：绘制圆角矩形路径 ──────────────────────────────────────────────
  function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const bxr = x + r, bxrEnd = x + w - r;
    const byt = y + r,   bytEnd = y + h - r;
    ctx.beginPath();
    ctx.moveTo(bxr, y + h);
    ctx.lineTo(bxrEnd, y + h);
    ctx.quadraticCurveTo(x + w, y + h, x + w, bytEnd);
    ctx.lineTo(x + w, byt);
    ctx.quadraticCurveTo(x + w, y, bxrEnd, y);
    ctx.lineTo(bxr, y);
    ctx.quadraticCurveTo(x, y, x, byt);
    ctx.lineTo(x, bytEnd);
    ctx.quadraticCurveTo(x, y + h, bxr, y + h);
    ctx.closePath();
  }

  // ─── 动画队列（归并排序目前无 swap，保留扩展性） ──────────────────────────
  function processAnimations(timestamp: number) {
    const toRemove: number[] = [];
    animationQueue.value.forEach((task, i) => {
      const elapsed = timestamp - task.startTime;
      const rawProgress = elapsed / task.duration;
      const easedProgress = EASING.easeOutCubic(Math.min(1, rawProgress));
      animateSwap(task, easedProgress);
      if (rawProgress >= 1) {
        toRemove.push(i);
        finalizeSwap(task);
      }
    });
    toRemove.reverse().forEach(i => animationQueue.value.splice(i, 1));
  }

  function animateSwap(task: AnimationTask, progress: number) {
    const [val1, val2] = task.indices;
    const bar1 = barStates.value.find(b => b.value === val1);
    const bar2 = barStates.value.find(b => b.value === val2);
    if (!bar1 || !bar2) return;
    const deltaX = task.startX2 - task.startX1;
    const arcHeight = Math.sin(progress * Math.PI) * 50;
    bar1.x = Math.round(task.startX1 + deltaX * progress);
    bar1.y = Math.round(task.baseY - arcHeight);
    bar2.x = Math.round(task.startX2 - deltaX * progress);
    bar2.y = Math.round(task.baseY - arcHeight);
  }

  function finalizeSwap(task: AnimationTask) {
    const [val1, val2] = task.indices;
    const bar1 = barStates.value.find(b => b.value === val1);
    const bar2 = barStates.value.find(b => b.value === val2);
    if (bar1 && bar2) { bar1.y = task.baseY; bar2.y = task.baseY; }
    barStates.value.forEach(bar => { bar.targetX = bar.x; });
    task.resolve?.();
  }

  function queueSwap(speed: number, values: [number, number], oldPositions?: Map<number, number>): Promise<number> {
    const bar1 = barStates.value.find(b => b.value === values[0]);
    const bar2 = barStates.value.find(b => b.value === values[1]);
    if (!bar1 || !bar2) return Promise.resolve(0);
    const duration = Math.max(speed, 200);
    const startX1 = oldPositions?.get(values[0]) ?? bar1.x;
    const startX2 = oldPositions?.get(values[1]) ?? bar2.x;
    return new Promise<number>(resolve => {
      animationQueue.value.push({
        indices: [bar1.value, bar2.value],
        startTime: performance.now(),
        duration,
        startX1,
        startX2,
        baseY: topRowBottomY(),
        resolve: () => resolve(duration),
      });
    });
  }

  // ─── 步骤处理（由 SortBarCanvasMerge 调用） ───────────────────────────────
  function onStep(step: SortStep, speed: number, oldPositions?: Map<number, number>): Promise<number> | number | undefined {
    if (step.type === 'swap' && step.indices.length === 2 && step.arraySnapshot) {
      const oldValues: [number, number] = [step.arraySnapshot[step.indices[0]], step.arraySnapshot[step.indices[1]]];
      return queueSwap(speed, oldValues, oldPositions);
    }
    return undefined;
  }

  // ─── 渲染循环控制 ────────────────────────────────────────────────────────
  function startRenderLoop() {
    if (animationFrameId !== null) return;
    animationFrameId = requestAnimationFrame(draw);
  }

  function stopRenderLoop() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  return {
    barStates,
    initialize,
    resize,
    updateBars,
    updateColors,
    startRenderLoop,
    stopRenderLoop,
    onStep,
    queueSwap,
    // 下排专用 API
    setActiveMergeRange,
    updateTempBars,
    clearTempBars,
  };
}
