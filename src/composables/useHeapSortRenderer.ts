import { ref, type Ref } from 'vue';
import type { SortStep } from '@/types/sorting';
import type { ArrayElement } from '@/stores/sortStore';
import type { HighlightedIndices } from '@/composables/useCanvasRenderer';

// ── 配色：fill 为主色（实心有色球），border 为同色系浅色（用于光晕） ──
const FILL = {
  default:  { fill: '#1e50a8', border: '#4a80d0', text: '#c0d8f8', shadow: 'rgba(4,14,40,0.9)'   },
  compare:  { fill: '#8c6c00', border: '#c49200', text: '#ffe080', shadow: 'rgba(50,36,0,0.9)'   },
  pivot:    { fill: '#601f90', border: '#9060cc', text: '#ddc0f8', shadow: 'rgba(30,8,50,0.9)'   },
  swapping: { fill: '#901818', border: '#c04040', text: '#ffc0c0', shadow: 'rgba(50,8,8,0.9)'    },
  sorted:   { fill: '#1a7810', border: '#389620', text: '#a8e890', shadow: 'rgba(6,24,4,0.9)'    },
  sortedMin:{ fill: '#0a7070', border: '#1e9888', text: '#90eee8', shadow: 'rgba(4,24,22,0.9)'   },
  outside:  { fill: '#111520', border: '#2a3040', text: '#383f50', shadow: 'rgba(0,0,0,0.6)'     },
  pending:  { fill: '#382070', border: '#5848a0', text: '#c8c0f0', shadow: 'rgba(20,8,50,0.9)'   },
} as const;
type FillKey = keyof typeof FILL;

// ── 小球状态 ──
interface BallState {
  index: number;       // 在数组中的位置
  value: number;
  displayIndex: number;
  /** 当前渲染坐标（CSS px，动画中会变） */
  x: number;
  y: number;
  /** 目标坐标（动画终点） */
  targetX: number;
  targetY: number;
  radius: number;
  colorKey: FillKey;
  alpha: number;
}

// ── 飞行动画任务 ──
interface FlyTask {
  /** 要移动的元素值（通过 value 查找 ball） */
  val1: number;
  val2: number;
  startX1: number; startY1: number;
  startX2: number; startY2: number;
  endX1: number;   endY1: number;
  endX2: number;   endY2: number;
  /** true = 用弧线，false = 用直线 */
  useArc: boolean;
  startTime: number;
  duration: number;
  resolve: () => void;
}

// 布局常量
const TOP_PAD  = 48;
const BOT_PAD  = 88;  // 底部保留给 array[] 行

/**
 * 堆排序专用渲染器
 * 将数组元素以完整二叉树布局绘制成小球，swap 动画沿直线或弧线飞行。
 */
function resolveColorKey(
  index: number,
  highlighted: HighlightedIndices,
  isMinHeapMode: boolean,
): FillKey {
  const { comparing, swapping, sorted, pivot, pending } = highlighted;
  if (sorted.includes(index)) return isMinHeapMode ? 'sortedMin' : 'sorted';
  if (pivot.includes(index)) return 'pivot';
  if (comparing.includes(index)) return 'compare';
  if (swapping.includes(index)) return 'swapping';
  if (pending.includes(index)) return 'pending';
  return 'default';
}

export function useHeapSortRenderer(
  canvasRef: Ref<HTMLCanvasElement | null>,
  displayArray: Ref<ArrayElement[]>,
  highlightedIndices: Ref<HighlightedIndices>,
  /** 当前是否为最小堆模式（决定已就位节点颜色） */
  isMinHeap: Ref<boolean>,
) {
  const balls = ref<BallState[]>([]);
  let flyTask: FlyTask | null = null;
  let animationFrameId: number | null = null;
  let containerWidth  = 800;
  let containerHeight = 400;

  // ── 布局计算 ──
  function getBallRadius(n: number): number {
    if (n <= 1) return 26;
    const maxDepth = Math.floor(Math.log2(n));
    const bottomSlots = Math.pow(2, maxDepth);
    const slotW = (containerWidth - 80) / bottomSlots;
    const rByDepth = Math.min(26, 110 / (maxDepth + 1));
    const rBySlot  = slotW / 2 - 2;
    return Math.max(8, Math.round(Math.min(rByDepth, rBySlot)));
  }

  function getNodePos(idx: number, n: number): { x: number; y: number } {
    const depth = Math.floor(Math.log2(idx + 1));
    const maxDepth = Math.floor(Math.log2(Math.max(n, 1)));
    const levelCount = Math.pow(2, depth);
    const posInLevel = idx - (Math.pow(2, depth) - 1);
    const r = getBallRadius(n);
    const treeH = containerHeight - TOP_PAD - BOT_PAD;
    // 均匀分布：第 0 层在 TOP_PAD + r，第 maxDepth 层在 TOP_PAD + treeH - r
    const y = maxDepth === 0
      ? TOP_PAD + treeH / 2
      : TOP_PAD + r + (depth / maxDepth) * (treeH - 2 * r);
    const xTotal = containerWidth - 80;
    const cellW = xTotal / levelCount;
    const x = 40 + posInLevel * cellW + cellW / 2;
    return { x, y };
  }

  /** 父子节点之间可直线到达；否则需要弧线绕过中间节点 */
  function needsArc(i: number, j: number): boolean {
    return !(2 * i + 1 === j || 2 * i + 2 === j || 2 * j + 1 === i || 2 * j + 2 === i);
  }

  // ── 构建/重建 balls ──
  function rebuildBalls() {
    const arr = displayArray.value;
    if (!arr || arr.length === 0) { balls.value = []; return; }
    const n = arr.length;
    const r = getBallRadius(n);

    balls.value = arr.map((el, idx) => {
      const pos = getNodePos(idx, n);
      const colorKey = resolveColorKey(idx, highlightedIndices.value, isMinHeap.value);

      return {
        index: idx,
        value: el.value,
        displayIndex: el.displayIndex,
        x: pos.x, y: pos.y,
        targetX: pos.x, targetY: pos.y,
        radius: r,
        colorKey,
        alpha: 1,
      };
    });
  }

  /** 根据 highlightedIndices 刷新颜色（不重建位置） */
  function refreshColors() {
    const n = displayArray.value.length;

    balls.value.forEach(b => {
      b.colorKey = resolveColorKey(b.index, highlightedIndices.value, isMinHeap.value);
      // 修正 radius（容器尺寸可能已变）
      b.radius = getBallRadius(n);
    });
  }

  // ── 绘制 ──
  function draw(ts: number) {
    const canvas = canvasRef.value;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, containerWidth, containerHeight);
    drawBackground(ctx);

    const n = displayArray.value.length;
    if (n === 0) { animationFrameId = requestAnimationFrame(draw); return; }

    const r = getBallRadius(n);

    // 处理飞行动画
    if (flyTask) {
      const t = Math.min(1, (ts - flyTask.startTime) / flyTask.duration);
      const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
      updateFlyPositions(flyTask, ease);
      if (t >= 1) {
        flyTask.resolve();
        flyTask = null;
      }
    }

    // 绘制边（先画在球下面）
    drawEdges(ctx, n, r);

    // 绘制飞行路径指示（虚线）
    drawFlightPath(ctx, n);

    // 绘制小球
    balls.value.forEach(b => drawBall(ctx, b));

    // 绘制底部数组行
    drawArrayRow(ctx, n, r);

    animationFrameId = requestAnimationFrame(draw);
  }

  function drawBackground(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#0f1219';
    ctx.fillRect(0, 0, containerWidth, containerHeight);
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 1;
    for (let x = 0; x < containerWidth; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, containerHeight); ctx.stroke();
    }
    for (let y = 0; y < containerHeight; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(containerWidth, y); ctx.stroke();
    }
    // 树区 / 数组区 分隔线
    const sepY = containerHeight - BOT_PAD + 10;
    ctx.strokeStyle = 'rgba(74,158,255,0.08)';
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(20, sepY); ctx.lineTo(containerWidth - 20, sepY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '9px monospace'; ctx.fillStyle = '#445'; ctx.textAlign = 'right';
    ctx.fillText('TREE',  containerWidth - 22, sepY - 6);
    ctx.fillText('ARRAY', containerWidth - 22, sepY + 18);
  }

  function drawEdges(ctx: CanvasRenderingContext2D, n: number, r: number) {
    const { comparing, pivot, swapping } = highlightedIndices.value;
    const compareSet = new Set(comparing);
    const pivotSet   = new Set(pivot);
    const swapSet    = new Set(swapping);

    for (let i = 0; i < n; i++) {
      const p1 = getNodePos(i, n);
      // 若球正在飞行，用飞行中坐标
      const b1 = balls.value[i];
      const cx1 = b1 ? b1.x : p1.x;
      const cy1 = b1 ? b1.y : p1.y;

      [2 * i + 1, 2 * i + 2].forEach(c => {
        if (c >= n) return;
        const p2 = getNodePos(c, n);
        const b2 = balls.value[c];
        const cx2 = b2 ? b2.x : p2.x;
        const cy2 = b2 ? b2.y : p2.y;

        const dx = cx2 - cx1, dy = cy2 - cy1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return;
        const ux = dx / dist, uy = dy / dist;

        const active =
          (compareSet.has(i) && compareSet.has(c)) ||
          (pivotSet.has(i) && (compareSet.has(c) || swapSet.has(c)));

        ctx.beginPath();
        ctx.moveTo(cx1 + ux * r, cy1 + uy * r);
        ctx.lineTo(cx2 - ux * r, cy2 - uy * r);
        ctx.strokeStyle = active ? 'rgba(255,204,0,0.5)' : 'rgba(255,255,255,0.07)';
        ctx.lineWidth = active ? 1.5 : 1;
        ctx.stroke();
      });
    }
  }

  function drawFlightPath(ctx: CanvasRenderingContext2D, n: number) {
    const { swapping, comparing } = highlightedIndices.value;
    const pair = [...swapping, ...comparing].slice(0, 2);
    if (pair.length < 2) return;
    const [i, j] = pair;
    const p1 = getNodePos(i, n);
    const p2 = getNodePos(j, n);
    const arc = needsArc(i, j);

    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,204,0,0.5)';

    if (!arc) {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    } else {
      const mx = (p1.x + p2.x) / 2;
      const arcHRaw = Math.abs(p2.x - p1.x) * 0.28 + 24;
      // 确保弧线控制点不超出画布顶部
      const topY = Math.max(TOP_PAD / 2, Math.min(p1.y, p2.y) - arcHRaw);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.quadraticCurveTo(mx, topY, p2.x, p2.y);
      ctx.stroke();
      // 箭头
      ctx.setLineDash([]);
      const ang = Math.atan2(p2.y - topY, p2.x - mx);
      ctx.beginPath();
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(p2.x - 10 * Math.cos(ang - 0.4), p2.y - 10 * Math.sin(ang - 0.4));
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(p2.x - 10 * Math.cos(ang + 0.4), p2.y - 10 * Math.sin(ang + 0.4));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawBall(ctx: CanvasRenderingContext2D, b: BallState) {
    const { x, y, radius: r, colorKey, alpha } = b;
    const clr = FILL[colorKey];
    ctx.save();
    ctx.globalAlpha = alpha;

    // 外层霓虹光晕（在填充前绘制，形成外发光）
    ctx.shadowColor = clr.border;
    ctx.shadowBlur  = r * 0.9;
    ctx.shadowOffsetY = 0;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = clr.fill;
    ctx.fill();
    ctx.shadowBlur = 0;

    // 底部投影（叠加绘制增加立体感）
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur  = 4;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = clr.fill;
    ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    // 描边
    ctx.strokeStyle = clr.border;
    ctx.lineWidth = r < 14 ? 1.5 : 2.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();

    // 数字
    if (b.value !== 0) {
      const fs = r < 12 ? 9 : r < 18 ? 11 : 13;
      ctx.font = `bold ${fs}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = clr.text;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 2;
      ctx.fillText(b.value.toString(), x, y + 0.5);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  function drawArrayRow(ctx: CanvasRenderingContext2D, n: number, r: number) {
    const arr = displayArray.value;
    const { sorted } = highlightedIndices.value;
    const sortedSet = new Set(sorted);
    const arrR = Math.min(r * 0.7, 14);
    const gap = 4;
    const totalW = n * (arrR * 2 + gap) - gap;
    const startX = (containerWidth - totalW) / 2;
    const y = containerHeight - BOT_PAD + 10 + arrR + 14;

    arr.forEach((el, i) => {
      const x = startX + i * (arrR * 2 + gap) + arrR;
      let colorKey: FillKey = 'default';
      if (sortedSet.has(i)) colorKey = isMinHeap.value ? 'sortedMin' : 'sorted';

      const fakeB: BallState = { index: i, value: el.value, displayIndex: el.displayIndex, x, y, targetX: x, targetY: y, radius: arrR, colorKey, alpha: 1 };
      drawBall(ctx, fakeB);

      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#445';
      ctx.fillText(i.toString(), x, y + arrR + 2);
    });

    ctx.font = '9px monospace';
    ctx.fillStyle = '#445';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('array[]', startX - 50, y);
  }

  // ── 飞行动画（更新两个 ball 的位置） ──
  function updateFlyPositions(task: FlyTask, ease: number) {
    const b1 = balls.value.find(b => b.value === task.val1);
    const b2 = balls.value.find(b => b.value === task.val2);

    if (task.useArc) {
      // 弧线：沿抛物线，高度限制在画布范围内
      const arcH1 = Math.sin(ease * Math.PI) * Math.min(Math.abs(task.endX2 - task.startX1) * 0.2, containerHeight * 0.3);
      const arcH2 = Math.sin(ease * Math.PI) * Math.min(Math.abs(task.endX1 - task.startX2) * 0.2, containerHeight * 0.3);
      if (b1) {
        b1.x = task.startX1 + (task.endX1 - task.startX1) * ease;
        b1.y = task.startY1 + (task.endY1 - task.startY1) * ease - arcH1;
      }
      if (b2) {
        b2.x = task.startX2 + (task.endX2 - task.startX2) * ease;
        b2.y = task.startY2 + (task.endY2 - task.startY2) * ease - arcH2;
      }
    } else {
      // 直线
      if (b1) {
        b1.x = task.startX1 + (task.endX1 - task.startX1) * ease;
        b1.y = task.startY1 + (task.endY1 - task.startY1) * ease;
      }
      if (b2) {
        b2.x = task.startX2 + (task.endX2 - task.startX2) * ease;
        b2.y = task.startY2 + (task.endY2 - task.startY2) * ease;
      }
    }
  }

  // ── 公共接口 ──
  function initialize(width: number, height: number) {
    setDimensions(width, height);
    rebuildBalls();
  }

  function resize(width: number, height: number) {
    setDimensions(width, height);
    rebuildBalls();
  }

  function setDimensions(width: number, height: number) {
    containerWidth  = Math.max(1, width);
    containerHeight = Math.max(1, height);
    const canvas = canvasRef.value;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = Math.floor(containerWidth * dpr);
    canvas.height = Math.floor(containerHeight * dpr);
    canvas.style.width  = `${containerWidth}px`;
    canvas.style.height = `${containerHeight}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(dpr, dpr); }
  }

  /** 由 Canvas 组件 watch displayArray 变化时调用（非动画期间） */
  function updateBars() {
    rebuildBalls();
  }

  /** 给定数组长度，计算树形区域所需的最小 canvas 高度 */
  function getRequiredHeight(n: number): number {
    if (n <= 1) return TOP_PAD + 80 + BOT_PAD;
    const maxDepth = Math.floor(Math.log2(n));
    // 每层最小高度 90px，保证层间有足够间距
    return TOP_PAD + (maxDepth + 1) * 90 + BOT_PAD;
  }

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

  /**
   * 执行一步排序动画
   * - swap：两球飞行（父子直线，跨层弧线）
   * - compare / pivot / sorted：仅刷新颜色后等待 speed 毫秒
   */
  function onStep(step: SortStep, speed: number): Promise<number> | number | undefined {
    if ((step.type === 'swap' || step.type === 'merge') && step.arraySnapshot && step.indices.length === 2) {
      const [i, j] = step.indices;
      const snap = step.arraySnapshot;
      const val1 = snap[i];
      const val2 = snap[j];
      const b1 = balls.value.find(b => b.value === val1);
      const b2 = balls.value.find(b => b.value === val2);
      if (!b1 || !b2) return undefined;

      const arc = needsArc(i, j);

      return new Promise<number>(resolve => {
        flyTask = {
          val1, val2,
          startX1: b1.x, startY1: b1.y,
          startX2: b2.x, startY2: b2.y,
          endX1: b2.x,   endY1: b2.y,
          endX2: b1.x,   endY2: b1.y,
          useArc: arc,
          startTime: performance.now(),
          duration: speed,
          resolve: () => resolve(speed),
        };
      });
    }
    // 其他步骤刷新颜色后由调用方 wait
    refreshColors();
    return undefined;
  }

  return { initialize, resize, updateBars, startRenderLoop, stopRenderLoop, onStep, getRequiredHeight };
}
