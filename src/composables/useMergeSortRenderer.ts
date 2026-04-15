import { ref, type Ref } from 'vue';
import type { SortStep } from '@/types/sorting';
import type { ArrayElement } from '@/stores/sortStore';
import type { HighlightedIndices } from '@/composables/useCanvasRenderer';

// 复用 BarState 类型
export type { BarState } from '@/composables/useCanvasRenderer';
import type { BarState } from '@/composables/useCanvasRenderer';

// ─── 布局常量 ───────────────────────────────────────────────────────────────
const GAP = 4;
const DIVIDER_RATIO = 0.5;
const DIVIDER_HALF_GAP = 18;    // 分割线上下各留 18px
const TOP_LABEL_OFFSET = 28;    // 上排顶部留给数值标签
const BOTTOM_LABEL_OFFSET = 18; // 下排底部标签高度

// ─── 颜色表 ──────────────────────────────────────────────────────────────────
// 导出供外部组件（如 SortBarCanvasMerge.vue）直接引用，避免跨文件硬编码 RGB 值
export const COLORS = {
  default:   { r: 74,  g: 158, b: 255 }, // 蓝色 - 默认
  comparing: { r: 255, g: 204, b: 0   }, // 黄色 - 比较中
  swapping:  { r: 255, g: 107, b: 107 }, // 红色 - 交换中
  sorted:    { r: 103, g: 194, b: 58  }, // 绿色 - 已排序
  pivot:     { r: 155, g: 89,  b: 182 }, // 紫色 - 基准点
  pending:   { r: 149, g: 117, b: 205 }, // 淡紫 - 待排序（当前组）
  tempNew:   { r: 255, g: 160, b: 50  }, // 橙色 - 最新飞下来的
  tempFill:  { r: 78,  g: 205, b: 196 }, // 青色 - 已到下排的
};

/** merge-back 完成后柱子的辉光强度（与普通 sorted 态一致） */
const MERGE_BACK_GLOW = 0.3;

const EASING = {
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
};

// ─── 已飞到下排的柱子 ─────────────────────────────────────────────────────
interface BottomBar {
  value: number;
  displayIndex: number;
  destIndex: number;  // 下排输出位置（与上排列对齐）
  x: number;          // 当前 X（动画中）
  y: number;          // 当前 Y（动画中）
  width: number;
  height: number;
  color: { r: number; g: number; b: number };
  glowIntensity: number;
  isLatest: boolean;  // true = 橙色高亮（最新飞下来的），false = 青色（已在下排）
}

// ─── 对角线移动任务（上↔下排之间） ──────────────────────────────────────
interface DiagonalTask {
  movers: Array<{
    target: BottomBar;
    startX: number;
    endX: number;
    startY: number;
    endY: number;
  }>;
  startTime: number;
  duration: number;
  resolve?: () => void;
}

// ─── swap 动画任务（兼容保留） ───────────────────────────────────────────
interface SwapTask {
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
 *
 * 动画流程：
 *  1. compare（含 groupIndices）: 上排高亮待合并的两个元素
 *  2. merge-set [sourceIndex, destIndex]: 胜出元素从上排飞到下排
 *  3. merge-back: 下排所有元素并行飞回上排
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

  // ── 下排状态（不放入 ref，在 rAF 中直接操作） ───────────────────────────
  const bottomBars: BottomBar[] = [];
  /** 已飞走的上排位置（渲染为幽灵） */
  const ghostTopIndices = new Set<number>();

  // ── 动画队列 ──────────────────────────────────────────────────────────────
  const diagonalQueue: DiagonalTask[] = [];
  const swapQueue: SwapTask[] = [];

  let animationFrameId: number | null = null;

  // ── 画布尺寸 ──────────────────────────────────────────────────────────────
  let containerWidth = 800;
  let containerHeight = 360;
  /** 数组最大值缓存，updateBars 时更新，避免 moveBarDown/moveAllBarsUp 重复遍历 */
  let cachedMaxValue = 1;

  // ─── 布局计算 ─────────────────────────────────────────────────────────────
  function dividerY()          { return Math.floor(containerHeight * DIVIDER_RATIO); }
  function topRowBottomY()     { return dividerY() - DIVIDER_HALF_GAP; }
  function topRowMaxHeight()   { return topRowBottomY() - TOP_LABEL_OFFSET; }
  function bottomRowBottomY()  { return containerHeight - BOTTOM_LABEL_OFFSET; }
  function bottomRowMaxHeight(){ return bottomRowBottomY() - dividerY() - DIVIDER_HALF_GAP - 10; }

  // ─── 初始化 / resize ──────────────────────────────────────────────────────
  function initialize(width: number, height: number) {
    setCanvasDimensions(width, height);
    updateBars();
  }

  function resize(width: number, height: number) {
    setCanvasDimensions(width, height);
    updateBars();
  }

  function setCanvasDimensions(width: number, height: number) {
    containerWidth  = Math.max(1, width);
    containerHeight = Math.max(1, height);
    const canvas = canvasRef.value;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = Math.floor(containerWidth  * dpr);
    canvas.height = Math.floor(containerHeight * dpr);
    canvas.style.width  = `${containerWidth}px`;
    canvas.style.height = `${containerHeight}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = false;
    }
  }

  // ─── 柱子布局（上下排共用） ───────────────────────────────────────────────
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
  /**
   * @param clearQueue     true（默认）时清空动画队列和下排状态；false 用于仅刷新颜色
   * @param mergeBackColor 传入时，所有柱子的初始颜色强制使用该颜色（绕过 displayIndex 继承），
   *                       用于 merge-back 完成后颜色无法通过 displayIndex 正确继承的场景
   */
  function updateBars(clearQueue = true, mergeBackColor?: { r: number; g: number; b: number }) {
    const arr = displayArray.value as ArrayElement[];
    if (!arr || arr.length === 0) return;
    if (clearQueue) {
      swapQueue.length    = 0;
      diagonalQueue.length = 0;
      bottomBars.length   = 0;
      ghostTopIndices.clear();
    }

    const layout = getBarLayout();
    if (!layout) return;
    const { barWidth, startX } = layout;
    const maxValue = Math.max(...arr.map(e => e.value));
    cachedMaxValue = maxValue;
    const maxH = topRowMaxHeight();

    // mergeBackColor 模式：不依赖 displayIndex 继承，直接使用指定颜色（避免 round-robin 不连续导致颜色丢失）
    const oldStates = mergeBackColor ? null : new Map(barStates.value.map(b => [b.displayIndex, b]));

    barStates.value = arr.map((element, index) => {
      const old = oldStates?.get(element.displayIndex);
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
        color: mergeBackColor ?? old?.color ?? COLORS.default,
        glowIntensity: mergeBackColor ? MERGE_BACK_GLOW : (old?.glowIntensity ?? 0),
      };
    });

    // mergeBackColor 模式下不调用 updateColors：
    // merge-back 后 highlightedIndices 为空（sorted 集合尚未更新），
    // updateColors 会把所有柱子重置为蓝色，覆盖掉传入的绿色。
    // 等待下一个步骤（sorted / compare）自然触发 updateColors。
    if (!mergeBackColor) updateColors();
  }

  // ─── 上排：颜色更新（跳过幽灵柱子） ──────────────────────────────────────
  function updateColors() {
    const { comparing, swapping, sorted, pivot, pending } = highlightedIndices.value;
    const comparingSet = new Set(comparing);
    const swappingSet  = new Set(swapping);
    const sortedSet    = new Set(sorted);
    const pivotSet     = new Set(pivot);
    const pendingSet   = new Set(pending);

    barStates.value.forEach(bar => {
      // 幽灵柱子：已飞走，不更新颜色，渲染时会以半透明方式绘制
      if (ghostTopIndices.has(bar.index)) return;

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

  // ─── 动画：单个柱子从上排飞到下排 ────────────────────────────────────────
  /**
   * @param sourceTopIndex 上排源位置（bar.index）
   * @param destIndex      下排输出位置（对齐到主数组的列索引）
   * @param speed          动画时长（ms）
   */
  function moveBarDown(sourceTopIndex: number, destIndex: number, speed: number): Promise<number> {
    const bar = barStates.value.find(b => b.index === sourceTopIndex);
    if (!bar) return Promise.resolve(speed);

    // 立即标记为幽灵（原位留半透明占位）
    ghostTopIndices.add(sourceTopIndex);

    const layout = getBarLayout();
    if (!layout) return Promise.resolve(speed);
    const { barWidth, startX } = layout;
    const maxH = bottomRowMaxHeight();

    const destX = Math.round(startX + destIndex * (barWidth + GAP));
    const destY = Math.round(bottomRowBottomY());

    // 只把上一个橙色（isLatest）改为青色；绿色等其他状态保持不变
    bottomBars.forEach(b => {
      if (b.isLatest) { b.color = COLORS.tempFill; b.glowIntensity = 0.2; b.isLatest = false; }
    });

    // 创建新的下排柱子（橙色，从上排位置出发）
    const bottomBar: BottomBar = {
      value: bar.value,
      displayIndex: bar.displayIndex,
      destIndex,
      x: bar.x,
      y: topRowBottomY(),
      width: bar.width,
      // 下排高度按下排可用空间重新计算
      height: cachedMaxValue > 0 ? Math.max(5, Math.round((bar.value / cachedMaxValue) * maxH)) : bar.height,
      color: COLORS.tempNew,
      glowIntensity: 0.7,
      isLatest: true,
    };
    bottomBars.push(bottomBar);

    const duration = speed * 0.8;
    return new Promise<number>(resolve => {
      diagonalQueue.push({
        movers: [{
          target: bottomBar,
          startX: bar.x,
          endX: destX,
          startY: topRowBottomY(),
          endY: destY,
        }],
        startTime: performance.now(),
        duration,
        resolve: () => resolve(duration),
      });
    });
  }

  // ─── 动画：下排所有柱子并行飞回上排 ──────────────────────────────────────
  /**
   * @param speed 每个柱子的动画时长（ms），飞回时略慢
   */
  function moveAllBarsUp(speed: number): Promise<number> {
    if (bottomBars.length === 0) {
      ghostTopIndices.clear();
      return Promise.resolve(speed);
    }

    const layout = getBarLayout();
    if (!layout) return Promise.resolve(speed);
    const { barWidth, startX } = layout;
    const maxH = topRowMaxHeight();

    // 飞回时染绿色，表示本轮子合并完成
    bottomBars.forEach(b => { b.color = COLORS.sorted; b.glowIntensity = 0.4; b.isLatest = false; });

    const movers = bottomBars.map(bar => ({
      target: bar,
      startX: bar.x,
      endX: Math.round(startX + bar.destIndex * (barWidth + GAP)),
      startY: bar.y,
      endY: Math.round(topRowBottomY()),
    }));

    // 恢复下排柱子的高度为上排高度（避免飞回时高度跳变）
    bottomBars.forEach(b => {
      b.height = cachedMaxValue > 0 ? Math.max(5, Math.round((b.value / cachedMaxValue) * maxH)) : b.height;
    });

    const duration = speed * 1.2; // 飞回稍慢，更有仪式感
    return new Promise<number>(resolve => {
      diagonalQueue.push({
        movers,
        startTime: performance.now(),
        duration,
        resolve: () => {
          // 注意：不在此处清空 bottomBars / ghostTopIndices。
          // 清空操作由后续 updateBars(clearQueue=true) 统一完成，
          // 确保清空与 barStates 重建在同一同步调用内，避免 rAF 帧内出现
          // "下排消失但上排还未重建"的状态撕裂（空帧闪动）。
          resolve(duration);
        },
      });
    });
  }

  // ─── 渲染主循环 ───────────────────────────────────────────────────────────
  function draw(timestamp: number) {
    const canvas = canvasRef.value;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, containerWidth, containerHeight);
    drawBackground(ctx);

    // 处理 swap 动画（兼容）
    processSwapAnimations(timestamp);
    // 处理上下排移动动画
    processDiagonalAnimations(timestamp);

    // 上排：先画幽灵（被飞走的位置），再画实体柱子
    barStates.value.forEach(bar => {
      if (ghostTopIndices.has(bar.index)) {
        drawGhostBar(ctx, bar);
      } else {
        drawBar(ctx, bar);
      }
    });

    // 下排：绘制所有已飞下来的柱子
    bottomBars.forEach(bar => drawBottomBar(ctx, bar));

    animationFrameId = requestAnimationFrame(draw);
  }

  // ─── 背景（深色 + 网格 + 分割线） ────────────────────────────────────────
  function drawBackground(ctx: CanvasRenderingContext2D) {
    const w = containerWidth, h = containerHeight;

    ctx.fillStyle = '#0f1219';
    ctx.fillRect(0, 0, w, h);

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

    // 中间分割线
    const dy = dividerY();
    ctx.strokeStyle = 'rgba(78, 205, 196, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    ctx.moveTo(0, dy);
    ctx.lineTo(w, dy);
    ctx.stroke();
    ctx.setLineDash([]);

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

  // ─── 上排：绘制实体柱子 ──────────────────────────────────────────────────
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

    ctx.font = `bold ${Math.min(12, bw - 2)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#20e25a';
    ctx.fillText(bar.displayIndex.toString(), bx + bw / 2, by + 16);
  }

  // ─── 上排：绘制幽灵柱子（元素已飞走，留半透明占位） ──────────────────────
  function drawGhostBar(ctx: CanvasRenderingContext2D, bar: BarState) {
    const bx = Math.round(bar.x);
    const by = Math.round(bar.y);
    const bw = Math.round(bar.width);
    const bh = Math.round(bar.height);
    if (bw <= 0 || bh <= 0) return;

    const barTop = by - bh;
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = 'rgba(74, 158, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.roundRect(bx, barTop, bw, bh, Math.min(3, Math.round(bw / 2)));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ─── 下排：绘制已飞下来的柱子 ────────────────────────────────────────────
  function drawBottomBar(ctx: CanvasRenderingContext2D, bar: BottomBar) {
    const bx = Math.round(bar.x);
    const by = Math.round(bar.y);
    const bw = Math.round(bar.width);
    const bh = Math.round(bar.height);
    if (bw <= 0 || bh <= 0) return;

    const { color, glowIntensity } = bar;
    const barTop = by - bh;

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

    ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + glowIntensity * 0.15})`;
    ctx.fillRect(bx + 3, barTop + 2, bw - 6, 3);

    // 数值标签
    ctx.font = `600 ${Math.min(10, bw - 2)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 2;
    ctx.fillStyle = bar.isLatest ? '#fff' : '#e0f7f6';
    let textY = barTop - 8;
    if (textY < dividerY() + 5) textY = dividerY() + 14;
    ctx.fillText(bar.value.toString(), bx + bw / 2, textY);
    ctx.shadowBlur = 0;
  }

  // ─── 动画处理：对角线（上↔下排） ─────────────────────────────────────────
  function processDiagonalAnimations(timestamp: number) {
    const toRemove: number[] = [];
    diagonalQueue.forEach((task, i) => {
      const elapsed = timestamp - task.startTime;
      const rawProgress = elapsed / task.duration;
      const t = EASING.easeInOutCubic(Math.min(1, rawProgress));

      task.movers.forEach(mover => {
        mover.target.x = Math.round(mover.startX + (mover.endX - mover.startX) * t);
        mover.target.y = Math.round(mover.startY + (mover.endY - mover.startY) * t);
      });

      if (rawProgress >= 1) {
        toRemove.push(i);
        task.resolve?.();
      }
    });
    toRemove.reverse().forEach(i => diagonalQueue.splice(i, 1));
  }

  // ─── 动画处理：swap（兼容） ───────────────────────────────────────────────
  function processSwapAnimations(timestamp: number) {
    const toRemove: number[] = [];
    swapQueue.forEach((task, i) => {
      const elapsed = timestamp - task.startTime;
      const rawProgress = elapsed / task.duration;
      const t = EASING.easeOutCubic(Math.min(1, rawProgress));
      const [val1, val2] = task.indices;
      const bar1 = barStates.value.find(b => b.value === val1);
      const bar2 = barStates.value.find(b => b.value === val2);
      if (bar1 && bar2) {
        const deltaX = task.startX2 - task.startX1;
        const arcHeight = Math.sin(t * Math.PI) * 50;
        bar1.x = Math.round(task.startX1 + deltaX * t);
        bar1.y = Math.round(task.baseY - arcHeight);
        bar2.x = Math.round(task.startX2 - deltaX * t);
        bar2.y = Math.round(task.baseY - arcHeight);
      }
      if (rawProgress >= 1) {
        toRemove.push(i);
        if (bar1 && bar2) { bar1.y = task.baseY; bar2.y = task.baseY; }
        task.resolve?.();
      }
    });
    toRemove.reverse().forEach(i => swapQueue.splice(i, 1));
  }

  // ─── 辅助：swap 动画（归并排序不产生，保留扩展性） ───────────────────────
  function queueSwap(speed: number, values: [number, number], oldPositions?: Map<number, number>): Promise<number> {
    const bar1 = barStates.value.find(b => b.value === values[0]);
    const bar2 = barStates.value.find(b => b.value === values[1]);
    if (!bar1 || !bar2) return Promise.resolve(0);
    const duration = speed;
    const startX1 = oldPositions?.get(values[0]) ?? bar1.x;
    const startX2 = oldPositions?.get(values[1]) ?? bar2.x;
    return new Promise<number>(resolve => {
      swapQueue.push({
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

  // ─── 步骤处理（由 SortBarCanvasMerge 调用） ───────────────────────────────
  function onStep(step: SortStep, speed: number, oldPositions?: Map<number, number>): Promise<number> | number | undefined {
    if (step.type === 'swap' && step.indices.length === 2 && step.arraySnapshot) {
      const oldValues: [number, number] = [step.arraySnapshot[step.indices[0]], step.arraySnapshot[step.indices[1]]];
      return queueSwap(speed, oldValues, oldPositions);
    }
    return undefined;
  }

  // ─── 渲染循环控制 ─────────────────────────────────────────────────────────
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
    // 归并排序专用动画 API
    moveBarDown,
    moveAllBarsUp,
  };
}
