import { type Ref } from 'vue';
import type { ArrayElement } from '@/stores/sortStore';
import type { SortStep } from '@/types/sorting';
import { calcBucketCount } from '@/types/sorting';

type Color = { r: number; g: number; b: number };

const COLORS = {
  default: { r: 74,  g: 158, b: 255 },
  compare: { r: 255, g: 204, b: 0   },
  swap:    { r: 255, g: 107, b: 107 },
  sorted:  { r: 103, g: 194, b: 58  },
  flying:  { r: 255, g: 159, b: 64  },
};

const BUCKET_COLORS: Color[] = [
  { r: 78,  g: 205, b: 196 },  // 青色   桶 0
  { r: 155, g: 89,  b: 182 },  // 紫色   桶 1
  { r: 255, g: 159, b: 64  },  // 橙色   桶 2
  { r: 46,  g: 204, b: 113 },  // 绿色   桶 3
  { r: 231, g: 76,  b: 60  },  // 红色   桶 4
  { r: 52,  g: 152, b: 219 },  // 蓝色   桶 5
  { r: 241, g: 196, b: 15  },  // 黄色   桶 6
  { r: 230, g: 126, b: 34  },  // 深橙   桶 7
  { r: 149, g: 165, b: 166 },  // 灰色   桶 8
];

// ── 内部状态类型 ──────────────────────────────────────────────────────────
interface MainSlot {
  value: number;
  displayIndex: number;
  visible: boolean;   // false = 已飞入桶，显示虚线占位
  gathered: boolean;  // true = 已从桶归位
  color: Color;
  glow: number;
}

interface BucketBar {
  value: number;
  displayIndex: number;
  color: Color;
  glow: number;
}

interface FlyingBar {
  value: number;
  displayIndex: number;
  fromX: number; fromY: number;
  toX: number;   toY: number;
  w: number; h: number;
  color: Color;
  t0: number; dur: number;
  resolve: () => void;
}

// ── 工具函数 ──────────────────────────────────────────────────────────────
const rgb = (c: Color, a = 1) =>
  a < 1 ? `rgba(${c.r},${c.g},${c.b},${a})` : `rgb(${c.r},${c.g},${c.b})`;
const lit = (c: Color, d = 55): Color =>
  ({ r: Math.min(255, c.r + d), g: Math.min(255, c.g + d), b: Math.min(255, c.b + d) });
const drk = (c: Color, d = 40): Color =>
  ({ r: Math.max(0, c.r - d), g: Math.max(0, c.g - d), b: Math.max(0, c.b - d) });
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * 桶排序 Canvas 渲染器
 * 管理主数组区、分隔区、桶区的全部绘制和动画逻辑
 */
export function useBucketSortRenderer(
  canvasRef: Ref<HTMLCanvasElement | null>,
  displayArray: Ref<ArrayElement[]>,
) {
  // ── 容器尺寸 ────────────────────────────────────────────────────────────
  let W = 800, H = 400;

  // ── 布局（随容器尺寸动态计算） ──────────────────────────────────────────
  const BOT_OFF      = 22;   // 基线距底边偏移
  const BUCKET_HDR_H = 36;   // 桶标题栏高度
  const BUCKET_GAP   = 8;    // 标题栏下方留白
  const BKT_HG       = 14;   // 桶间水平间距

  let MAIN_H  = 0;
  let SEP_H   = 0;
  let BKT_TOP = 0;
  let BKT_BOT = 0;

  // 主数组柱子布局
  let BAR_W = 40;
  const BAR_G = 4;
  let mStartX = 0;
  let maxVal = 1;
  let n = 1;

  // 桶区布局
  let BKT_W  = 0;
  let BB_W   = 0;
  let BB_MAX_H = 0;
  let BB_G   = 6;   // 桶内柱间距（动态收窄以防越界）
  const BB_PAD = 10;

  // 当前生效的桶数（由 computeLayout 根据 n 动态计算）
  let BUCKET_COUNT = 3;

  function computeLayout() {
    MAIN_H  = Math.round(H * 0.33);
    SEP_H   = Math.round(H * 0.09);
    BKT_TOP = MAIN_H + SEP_H;
    BKT_BOT = H - 8;

    const totalBarW = n * BAR_W + (n - 1) * BAR_G;
    mStartX = Math.round((W - totalBarW) / 2);

    // 根据元素数动态计算桶数
    BUCKET_COUNT = calcBucketCount(n);

    BKT_W   = Math.floor((W - BKT_HG * (BUCKET_COUNT + 1)) / BUCKET_COUNT);
    BB_MAX_H = BKT_BOT - BKT_TOP - BOT_OFF - BUCKET_HDR_H - BUCKET_GAP;

    // 桶内柱子宽度：先尝试 BB_G=6，不够则收窄到 2，保证总占用不超出桶宽
    const maxPerBucket = Math.ceil(n / BUCKET_COUNT);
    const available    = BKT_W - BB_PAD * 2;  // 桶内可用宽度
    BB_G = 6;
    BB_W = Math.floor((available + BB_G) / maxPerBucket - BB_G);
    if (BB_W < 4) {
      BB_G = 2;
      BB_W = Math.floor((available + BB_G) / maxPerBucket - BB_G);
    }
    BB_W = Math.max(2, Math.min(48, BB_W));
  }

  // ── 坐标计算 ────────────────────────────────────────────────────────────
  const mBarX = (i: number) => mStartX + i * (BAR_W + BAR_G);
  const mBarH = (v: number) => Math.max(6, Math.round((v / maxVal) * (MAIN_H - 52)));
  const mBarY = () => MAIN_H - BOT_OFF;
  const bktX  = (bi: number) => BKT_HG + bi * (BKT_W + BKT_HG);
  const bBarX = (bi: number, pos: number) => bktX(bi) + BB_PAD + pos * (BB_W + BB_G);
  const bBarH = (v: number) => Math.max(6, Math.round((v / maxVal) * BB_MAX_H));
  const bBarY = () => BKT_BOT - BOT_OFF;

  // ── 内部状态 ────────────────────────────────────────────────────────────
  let mainSlots: MainSlot[] = [];
  let buckets: BucketBar[][] = Array.from({ length: BUCKET_COUNT }, () => []);
  let flyingBars: FlyingBar[] = [];
  let bucketStateActive = false;
  let animationFrameId: number | null = null;
  // 背景网格离屏缓存（尺寸变化时重建）
  let bgCanvas: HTMLCanvasElement | null = null;
  let bgW = 0, bgH = 0;

  // ── 飞行动画 ────────────────────────────────────────────────────────────
  function flyBar(
    value: number, displayIndex: number,
    fromX: number, fromY: number,
    toX: number,   toY: number,
    w: number, h: number,
    color: Color,
    duration: number,
  ): Promise<void> {
    return new Promise<void>(resolve => {
      flyingBars.push({ value, displayIndex, fromX, fromY, toX, toY, w, h, color, t0: performance.now(), dur: duration, resolve });
    });
  }

  // ── 绘制工具 ─────────────────────────────────────────────────────────────
  function drawSingleBar(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    color: Color, glow: number, val: number, displayIdx?: number,
  ) {
    const bx = Math.round(x), by = Math.round(y);
    const bw = Math.round(w), bh = Math.round(h);
    if (bw <= 0 || bh <= 0) return;
    const top = by - bh;
    const r   = Math.min(3, Math.round(bw / 2));

    ctx.beginPath();
    ctx.moveTo(bx + r, by);       ctx.lineTo(bx + bw - r, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by - r);
    ctx.lineTo(bx + bw, top + r); ctx.quadraticCurveTo(bx + bw, top, bx + bw - r, top);
    ctx.lineTo(bx + r, top);      ctx.quadraticCurveTo(bx, top, bx, top + r);
    ctx.lineTo(bx, by - r);       ctx.quadraticCurveTo(bx, by, bx + r, by);
    ctx.closePath();

    const g = ctx.createLinearGradient(0, top, 0, by);
    g.addColorStop(0,   rgb(lit(color)));
    g.addColorStop(0.5, rgb(color));
    g.addColorStop(1,   rgb(drk(color)));
    ctx.fillStyle = g;
    ctx.fill();

    if (glow > 0) {
      ctx.shadowColor = rgb(color, glow * 0.8);
      ctx.shadowBlur  = 14 * glow;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 顶部高光条
    ctx.fillStyle = `rgba(255,255,255,${0.28 + glow * 0.12})`;
    ctx.fillRect(bx + 3, top + 2, bw - 6, 3);

    // 数值标签
    const fs = Math.min(11, bw - 3);
    if (fs >= 7) {
      ctx.font = `bold ${fs}px "JetBrains Mono",Consolas,monospace`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 2;
      ctx.fillStyle = '#f7cb07';
      ctx.fillText(String(val), bx + bw / 2, Math.max(8, top - 6));
      ctx.shadowBlur = 0;
    }

    // 底部序号
    if (displayIdx !== undefined) {
      ctx.font = `bold ${Math.min(12, bw - 2)}px "JetBrains Mono",Consolas,monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#20e25a';
      ctx.fillText(String(displayIdx), bx + bw / 2, by + 16);
    }
  }

  // ── 各区域绘制 ────────────────────────────────────────────────────────────

  /** 重建背景网格离屏缓存（尺寸变化或首次调用时触发） */
  function rebuildBgCache() {
    bgCanvas = document.createElement('canvas');
    bgCanvas.width  = W;
    bgCanvas.height = H;
    bgW = W; bgH = H;
    const c = bgCanvas.getContext('2d')!;
    c.fillStyle = '#0f1219';
    c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(255,255,255,0.028)';
    c.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
    }
  }

  function drawBackground(ctx: CanvasRenderingContext2D) {
    // 尺寸变化时重建缓存，否则直接 drawImage
    if (!bgCanvas || bgW !== W || bgH !== H) rebuildBgCache();
    ctx.drawImage(bgCanvas!, 0, 0);
    // 分界线和文字依赖动态布局（MAIN_H/SEP_H），每帧绘制
    ctx.strokeStyle = 'rgba(78,205,196,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, MAIN_H); ctx.lineTo(W, MAIN_H); ctx.stroke();
    const my = MAIN_H + SEP_H / 2;
    ctx.font = '11px Consolas,monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(78,205,196,0.5)';
    ctx.fillText('▼  分桶区', 14, my + 4);
  }

  function drawBucketRegions(ctx: CanvasRenderingContext2D) {
    const R = 10;
    for (let bi = 0; bi < BUCKET_COUNT; bi++) {
      const bx = bktX(bi), bw = BKT_W;
      const by = BKT_TOP,  bh = BKT_BOT - BKT_TOP;
      const bc = BUCKET_COLORS[bi];
      const cnt = buckets[bi].length;

      // 主体渐变背景
      const bgGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
      bgGrad.addColorStop(0,   rgb(bc, 0.13));
      bgGrad.addColorStop(0.3, rgb(bc, 0.07));
      bgGrad.addColorStop(1,   rgb(bc, 0.02));
      ctx.fillStyle = bgGrad;
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, R); ctx.fill();

      // 外发光边框
      ctx.save();
      ctx.shadowColor = rgb(bc, cnt > 0 ? 0.55 : 0.25);
      ctx.shadowBlur  = cnt > 0 ? 14 : 8;
      ctx.strokeStyle = rgb(bc, cnt > 0 ? 0.9 : 0.45);
      ctx.lineWidth   = cnt > 0 ? 1.8 : 1.2;
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, R); ctx.stroke();
      ctx.restore();

      // 顶部标题栏
      const hdrGrad = ctx.createLinearGradient(bx, by, bx, by + BUCKET_HDR_H);
      hdrGrad.addColorStop(0, rgb(bc, 0.32));
      hdrGrad.addColorStop(1, rgb(bc, 0.08));
      ctx.fillStyle = hdrGrad;
      ctx.beginPath();
      ctx.moveTo(bx + R, by); ctx.lineTo(bx + bw - R, by);
      ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + R);
      ctx.lineTo(bx + bw, by + BUCKET_HDR_H);
      ctx.lineTo(bx,       by + BUCKET_HDR_H);
      ctx.lineTo(bx,       by + R);
      ctx.quadraticCurveTo(bx, by, bx + R, by);
      ctx.closePath(); ctx.fill();

      // 标题栏分隔线
      const sepGrad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      sepGrad.addColorStop(0,   rgb(bc, 0));
      sepGrad.addColorStop(0.2, rgb(bc, 0.6));
      sepGrad.addColorStop(0.8, rgb(bc, 0.6));
      sepGrad.addColorStop(1,   rgb(bc, 0));
      ctx.strokeStyle = sepGrad; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx, by + BUCKET_HDR_H); ctx.lineTo(bx + bw, by + BUCKET_HDR_H);
      ctx.stroke();

      // 玻璃高光线
      const glassGrad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      glassGrad.addColorStop(0,    'rgba(255,255,255,0)');
      glassGrad.addColorStop(0.25, 'rgba(255,255,255,0.18)');
      glassGrad.addColorStop(0.75, 'rgba(255,255,255,0.18)');
      glassGrad.addColorStop(1,    'rgba(255,255,255,0)');
      ctx.strokeStyle = glassGrad; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx + R + 2, by + 1.5); ctx.lineTo(bx + bw - R - 2, by + 1.5);
      ctx.stroke();

      // 左侧竖向装饰条
      const sideGrad = ctx.createLinearGradient(0, by, 0, by + bh * 0.6);
      sideGrad.addColorStop(0, rgb(bc, 0.7));
      sideGrad.addColorStop(1, rgb(bc, 0));
      ctx.fillStyle = sideGrad;
      ctx.fillRect(bx, by + R, 2, bh * 0.6);

      // 桶编号（左上角小字）
      ctx.font = 'bold 11px Consolas,monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = rgb(bc, 0.55);
      ctx.fillText(`B${bi}`, bx + 10, by + 15);

      // 主标签（居中）
      const rS = Math.floor(1 + bi * maxVal / BUCKET_COUNT);
      const rE = Math.floor(1 + (bi + 1) * maxVal / BUCKET_COUNT) - 1;
      ctx.font = 'bold 13px Consolas,monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = rgb(bc, 1);
      ctx.shadowColor = rgb(bc, 0.6); ctx.shadowBlur = 6;
      ctx.fillText(`桶 ${bi}`, bx + bw / 2, by + 17);
      ctx.shadowBlur = 0;
      ctx.font = '10px Consolas,monospace';
      ctx.fillStyle = rgb(bc, 0.65);
      ctx.fillText(`[ ${rS} – ${rE} ]`, bx + bw / 2, by + 30);

      // 右上角计数徽章
      if (cnt > 0) {
        const bX = bx + bw - 18, bY = by + 8;
        ctx.beginPath(); ctx.arc(bX, bY, 10, 0, Math.PI * 2);
        ctx.fillStyle = rgb(bc, 0.85); ctx.fill();
        ctx.font = 'bold 10px Consolas,monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#000';
        ctx.fillText(String(cnt), bX, bY + 3.5);
      }

      // 底部基线（渐变实线 + 端点）
      const baseGrad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      baseGrad.addColorStop(0,    rgb(bc, 0));
      baseGrad.addColorStop(0.15, rgb(bc, 0.4));
      baseGrad.addColorStop(0.85, rgb(bc, 0.4));
      baseGrad.addColorStop(1,    rgb(bc, 0));
      ctx.strokeStyle = baseGrad; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx + 12, BKT_BOT - BOT_OFF); ctx.lineTo(bx + bw - 12, BKT_BOT - BOT_OFF);
      ctx.stroke();
      ctx.fillStyle = rgb(bc, 0.5);
      ctx.beginPath(); ctx.arc(bx + 12, BKT_BOT - BOT_OFF, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(bx + bw - 12, BKT_BOT - BOT_OFF, 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawMainSlots(ctx: CanvasRenderingContext2D) {
    mainSlots.forEach((sl, i) => {
      const x = mBarX(i), y = mBarY(), h = mBarH(sl.value);
      if (!sl.visible && !sl.gathered) {
        // 虚线占位框
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = 'rgba(74,158,255,0.14)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y - h, BAR_W, h);
        ctx.setLineDash([]);
        ctx.font = 'bold 11px Consolas,monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(32,226,90,0.3)';
        ctx.fillText(String(sl.displayIndex), x + BAR_W / 2, y + 15);
        return;
      }
      drawSingleBar(ctx, x, y, BAR_W, h, sl.color, sl.glow, sl.value, sl.displayIndex);
    });
  }

  function drawBucketBars(ctx: CanvasRenderingContext2D) {
    buckets.forEach((bkt, bi) => {
      bkt.forEach((bar, pos) => {
        drawSingleBar(ctx, bBarX(bi, pos), bBarY(), BB_W, bBarH(bar.value), bar.color, bar.glow, bar.value);
      });
    });
  }

  function processFly(ctx: CanvasRenderingContext2D, ts: number) {
    flyingBars = flyingBars.filter(fb => {
      const rawT = Math.min(1, (ts - fb.t0) / fb.dur);
      const t    = easeInOut(rawT);
      const arc  = Math.sin(rawT * Math.PI) * Math.min(60, H * 0.15);
      const cx   = fb.fromX + (fb.toX - fb.fromX) * t;
      const cy   = fb.fromY + (fb.toY - fb.fromY) * t - arc;
      drawSingleBar(ctx, cx, cy, fb.w, fb.h, COLORS.flying, 0.75, fb.value);
      if (rawT >= 1) { fb.resolve(); return false; }
      return true;
    });
  }

  // ── 渲染循环 ─────────────────────────────────────────────────────────────
  function draw(ts: number) {
    const canvas = canvasRef.value;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, W, H);
    drawBackground(ctx);
    drawBucketRegions(ctx);
    drawMainSlots(ctx);
    drawBucketBars(ctx);
    processFly(ctx, ts);

    animationFrameId = requestAnimationFrame(draw);
  }

  // ── 步骤执行 ─────────────────────────────────────────────────────────────
  /** 将桶内两个位置的柱子颜色/发光恢复为该桶的默认色 */
  function resetBucketBarColors(b: BucketBar[], bi: number, p0: number, p1: number) {
    const bc = BUCKET_COLORS[bi];
    if (b[p0]) { b[p0].color = { ...bc }; b[p0].glow = 0; }
    if (b[p1]) { b[p1].color = { ...bc }; b[p1].glow = 0; }
  }

  async function applyStep(step: SortStep, animationSpeed: number): Promise<number | undefined> {
    if (step.type === 'bucket-scatter') {
      bucketStateActive = true;
      const si = step.indices[0];
      const bi = step.bucketIndex ?? 0;
      const bp = step.bucketPos ?? buckets[bi].length;
      const slot = mainSlots[si];
      const bc   = BUCKET_COLORS[bi];
      slot.visible = false;

      const flyPromise = flyBar(
        slot.value, slot.displayIndex,
        mBarX(si), mBarY(),
        bBarX(bi, bp), bBarY(),
        BB_W, bBarH(slot.value), bc, animationSpeed,
      );
      await flyPromise;
      buckets[bi].push({ value: slot.value, displayIndex: slot.displayIndex, color: { ...bc }, glow: 0 });
      await wait(animationSpeed * 0.15);
      return animationSpeed;

    } else if (step.type === 'bucket-compare') {
      const bi = step.bucketIndex ?? 0;
      const b  = buckets[bi];
      const [p0, p1] = step.indices;
      if (b[p0]) { b[p0].color = { ...COLORS.compare }; b[p0].glow = 0.55; }
      if (b[p1]) { b[p1].color = { ...COLORS.compare }; b[p1].glow = 0.55; }
      await wait(animationSpeed * 0.65);
      resetBucketBarColors(b, bi, p0, p1);
      return animationSpeed;

    } else if (step.type === 'bucket-swap') {
      const bi = step.bucketIndex ?? 0;
      const b  = buckets[bi];
      const [p0, p1] = step.indices;
      if (b[p0]) { b[p0].color = { ...COLORS.swap }; b[p0].glow = 0.55; }
      if (b[p1]) { b[p1].color = { ...COLORS.swap }; b[p1].glow = 0.55; }
      await wait(animationSpeed * 0.4);
      if (b[p0] && b[p1]) [b[p0], b[p1]] = [b[p1], b[p0]];
      await wait(animationSpeed * 0.25);
      resetBucketBarColors(b, bi, p0, p1);
      return animationSpeed;

    } else if (step.type === 'bucket-gather') {
      const bi   = step.bucketIndex ?? 0;
      const dest = step.indices[0];
      const b    = buckets[bi];
      const bar  = b[0];
      if (!bar) return animationSpeed;
      b.shift();

      const flyPromise = flyBar(
        bar.value, bar.displayIndex,
        bBarX(bi, 0), bBarY(),
        mBarX(dest), mBarY(),
        BAR_W, mBarH(bar.value), COLORS.sorted, animationSpeed,
      );
      await flyPromise;

      mainSlots[dest].value    = bar.value;
      mainSlots[dest].visible  = true;
      mainSlots[dest].gathered = true;
      mainSlots[dest].color    = { ...COLORS.sorted };
      mainSlots[dest].glow     = 0.3;
      await wait(animationSpeed * 0.15);
      return animationSpeed;

    } else if (step.type === 'sorted') {
      bucketStateActive = false;
      mainSlots.forEach(sl => { sl.color = { ...COLORS.sorted }; sl.glow = 0.35; });
      await wait(500);
      mainSlots.forEach(sl => { sl.glow = 0.2; });
      return animationSpeed;

    }

    return animationSpeed;
  }

  // ── 公共接口 ─────────────────────────────────────────────────────────────
  function setCanvasDimensions(width: number, height: number) {
    W = Math.max(1, width);
    H = Math.max(1, height);
    const canvas = canvasRef.value;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width  = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = false;
    }
  }

  /**
   * 重建主数组插槽（无动画时调用，如初始化和重置）
   * 若 bucketStateActive=true（动画进行中），则跳过，避免干扰视觉状态
   */
  function updateBars() {
    if (bucketStateActive) return;
    const arr = displayArray.value;
    if (!arr || arr.length === 0) return;

    n      = arr.length;
    maxVal = Math.max(...arr.map(e => e.value));
    BAR_W  = Math.min(60, Math.max(4, Math.round((W - BAR_G) / n - BAR_G)));
    const totalBarW = n * BAR_W + (n - 1) * BAR_G;
    mStartX = Math.round((W - totalBarW) / 2);
    computeLayout();

    mainSlots = arr.map(el => ({
      value:        el.value,
      displayIndex: el.displayIndex,
      visible:      true,
      gathered:     false,
      color:        { ...COLORS.default },
      glow:         0,
    }));
    buckets    = Array.from({ length: BUCKET_COUNT }, () => []);
    flyingBars = [];
  }

  /** 强制重置（无视 bucketStateActive，用于外部显式重置） */
  function forceReset() {
    bucketStateActive = false;
    flyingBars = [];
    updateBars();
  }

  function initialize(width: number, height: number) {
    setCanvasDimensions(width, height);
    updateBars();
  }

  function resize(width: number, height: number) {
    setCanvasDimensions(width, height);
    if (!bucketStateActive) updateBars();
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

  return { initialize, resize, updateBars, forceReset, startRenderLoop, stopRenderLoop, applyStep };
}
