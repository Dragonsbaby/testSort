import { ref, type Ref } from "vue";
import type { SortStep } from "@/types/sorting";

export interface BarState {
  index: number;
  value: number;
  x: number;
  targetX: number;
  y: number;
  width: number;
  height: number;
  color: { r: number; g: number; b: number };
  glowIntensity: number;
  isAnimating: boolean;
}

export interface HighlightedIndices {
  comparing: number[];
  swapping: number[];
  sorted: number[];
  pivot: number[];
}

interface AnimationTask {
  type: "swap" | "compare";
  indices: number[];
  startTime: number;
  duration: number;
  startX1: number;
  startX2: number;
  baseY: number;
}

const COLORS = {
  default: { r: 74, g: 158, b: 255 },
  comparing: { r: 255, g: 204, b: 0 },
  swapping: { r: 255, g: 107, b: 107 },
  sorted: { r: 0, g: 255, b: 160 },
  pivot: { r: 155, g: 89, b: 182 },
};

const EASING = {
  easeOutElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    return (
      Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1
    );
  },
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
};

const GAP = 4;
const BASE_DURATION = 800;
const BAR_HEIGHT_OFFSET = 20;

export function useCanvasRenderer(
  canvasRef: Ref<HTMLCanvasElement | null>,
  displayArray: Ref<number[]>,
  highlightedIndices: Ref<HighlightedIndices>,
) {
  const barStates = ref<BarState[]>([]);
  const animationQueue = ref<AnimationTask[]>([]);
  let animationFrameId: number | null = null;
  let containerHeight = 360;
  let containerWidth = 800;

  function initialize(width: number, height: number) {
    setCanvasDimensions(width, height);
    updateBars();
  }

  function resize(width: number, height: number) {
    setCanvasDimensions(width, height);
    updateBars();
  }

  function setCanvasDimensions(width: number, height: number) {
    containerWidth = width;
    containerHeight = height;
    if (canvasRef.value) {
      canvasRef.value.width = width;
      canvasRef.value.height = height;
    }
  }

  function updateBars() {
    const arr = displayArray.value;
    if (!arr || arr.length === 0) return;

    // 清空动画队列，因为柱子重建后旧动画无效
    animationQueue.value = [];

    const maxValue = Math.max(...arr);
    // 确保总宽度不超过容器宽度
    const maxBarWidth = Math.min(60, (containerWidth - GAP) / arr.length - GAP);
    const barWidth = Math.max(4, maxBarWidth);
    const totalWidth = arr.length * barWidth + (arr.length - 1) * GAP;
    const startX = Math.max(0, (containerWidth - totalWidth) / 2);

    const oldStates = new Map(barStates.value.map((b) => [b.value, b]));

    barStates.value = arr.map((value, index) => {
      const old = oldStates.get(value);
      const x = startX + index * (barWidth + GAP);

      return {
        index,
        value,
        x,
        targetX: x,
        y: containerHeight - BAR_HEIGHT_OFFSET,
        width: barWidth,
        height: maxValue > 0 ? (value / maxValue) * (containerHeight - 60) : 0,
        color: old?.color ?? COLORS.default,
        glowIntensity: old?.glowIntensity ?? 0,
        isAnimating: false,
      };
    });

    updateColors();
  }

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

  function draw(timestamp: number) {
    const canvas = canvasRef.value;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBackground(ctx);
    processAnimations(timestamp);
    barStates.value.forEach((bar) => drawBar(ctx, bar));

    animationFrameId = requestAnimationFrame(draw);
  }

  function drawBackground(ctx: CanvasRenderingContext2D) {
    const { width, height } = {
      width: containerWidth,
      height: containerHeight,
    };

    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, "#0f0f1a");
    bgGradient.addColorStop(0.5, "#1a1a2e");
    bgGradient.addColorStop(1, "#16213e");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    const topGlow = ctx.createRadialGradient(
      width / 2,
      0,
      0,
      width / 2,
      0,
      height * 0.8,
    );
    topGlow.addColorStop(0, "rgba(74, 158, 255, 0.08)");
    topGlow.addColorStop(1, "rgba(74, 158, 255, 0)");
    ctx.fillStyle = topGlow;
    ctx.fillRect(0, 0, width, height);

    const bottomFade = ctx.createLinearGradient(0, height - 60, 0, height);
    bottomFade.addColorStop(0, "rgba(0, 0, 0, 0)");
    bottomFade.addColorStop(1, "rgba(0, 0, 0, 0.3)");
    ctx.fillStyle = bottomFade;
    ctx.fillRect(0, height - 60, width, 60);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
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

    ctx.strokeStyle = "rgba(78, 205, 196, 0.2)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, height - 20);
    ctx.lineTo(width, height - 20);
    ctx.stroke();
  }

  function drawBar(ctx: CanvasRenderingContext2D, bar: BarState) {
    const { x, y, width, height, color, glowIntensity } = bar;
    const barTop = y - height;

    if (glowIntensity > 0) {
      ctx.shadowColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${glowIntensity * 0.8})`;
      ctx.shadowBlur = 15 * glowIntensity;
    } else {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    }

    const gradient = ctx.createLinearGradient(x, y, x, barTop);
    gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 1)`);
    gradient.addColorStop(
      0.5,
      `rgba(${Math.min(255, color.r + 30)}, ${Math.min(255, color.g + 30)}, ${Math.min(255, color.b + 30)}, 1)`,
    );
    gradient.addColorStop(
      1,
      `rgba(${Math.max(0, color.r - 20)}, ${Math.max(0, color.g - 20)}, ${Math.max(0, color.b - 20)}, 0.9)`,
    );

    ctx.fillStyle = gradient;

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

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;

    ctx.fillStyle = `rgba(255, 255, 255, ${0.15 + glowIntensity * 0.15})`;
    ctx.fillRect(x + 2, barTop, width - 4, 3);

    if (height > 25) {
      ctx.font = `600 ${Math.min(10, width - 2)}px "JetBrains Mono", monospace`;
      ctx.textAlign = "center";
      ctx.fillStyle = glowIntensity > 0.3 ? "#1a1a2e" : "#e0e0e0";
      ctx.fillText(bar.value.toString(), x + width / 2, barTop - 8);
    }
  }

  function processAnimations(timestamp: number) {
    const toRemove: number[] = [];

    animationQueue.value.forEach((task, i) => {
      const elapsed = timestamp - task.startTime;
      const rawProgress = elapsed / task.duration;

      if (task.type === "swap") {
        // 使用 easeOutCubic 替代 easeOutElastic，避免弹性抖动
        const easedProgress = EASING.easeOutCubic(Math.min(1, rawProgress));
        animateSwap(task, easedProgress);
      }

      if (rawProgress >= 1) {
        toRemove.push(i);
        finalizeSwap(task);
      }
    });

    toRemove.reverse().forEach((i) => animationQueue.value.splice(i, 1));
  }

  function animateSwap(task: AnimationTask, progress: number) {
    const [val1, val2] = task.indices;
    const bar1 = barStates.value.find((b) => b.value === val1);
    const bar2 = barStates.value.find((b) => b.value === val2);
    if (!bar1 || !bar2) return;

    const deltaX = task.startX2 - task.startX1;
    // 抛物线弧度：0 -> 最高 -> 0
    const arcHeight = Math.sin(progress * Math.PI) * 30;

    bar1.x = task.startX1 + deltaX * progress;
    bar1.y = task.baseY - arcHeight;
    bar2.x = task.startX2 - deltaX * progress;
    bar2.y = task.baseY - arcHeight;
  }

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

  function queueSwap(
    speed: number,
    values: [number, number],
    oldPositions?: Map<number, number>,
  ) {
    const bar1 = barStates.value.find((b) => b.value === values[0]);
    const bar2 = barStates.value.find((b) => b.value === values[1]);
    if (!bar1 || !bar2) return;

    const duration = BASE_DURATION * (200 / speed);

    const startX1 = oldPositions?.get(values[0]) ?? bar1.x;
    const startX2 = oldPositions?.get(values[1]) ?? bar2.x;

    animationQueue.value.push({
      type: "swap",
      indices: [bar1.value, bar2.value],
      startTime: performance.now(),
      duration,
      startX1,
      startX2,
      baseY: containerHeight - BAR_HEIGHT_OFFSET,
    });
  }

  function onStep(
    step: SortStep,
    speed: number,
    oldPositions?: Map<number, number>,
  ) {
    if (
      (step.type === "swap" || step.type === "merge") &&
      step.indices.length === 2 &&
      step.arraySnapshot
    ) {
      const oldValues: [number, number] = [
        step.arraySnapshot[step.indices[0]],
        step.arraySnapshot[step.indices[1]],
      ];
      queueSwap(speed, oldValues, oldPositions);
    }
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
