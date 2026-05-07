import { ref, type Ref } from "vue";
import type { FrameState, RenderableEntity, RenderableOverlay } from "@/types/timeline";

const BACKGROUND_COLOR = "#080d18";
const GRID_COLOR = "rgba(79, 195, 247, 0.055)";
const BASELINE_COLOR = "rgba(78, 205, 196, 0.45)";
const VALUE_LABEL_COLOR = "#ffd43b";
const INDEX_LABEL_COLOR = "#20e25a";
const BAR_HIGHLIGHT_COLOR = "rgba(203, 243, 255, 0.82)";

function isHeapNode(entity: RenderableEntity) {
  return entity.kind === "heap-tree-node" || entity.kind === "heap-array-node";
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

function hexToRgb(color: string) {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);
  if (!match) return null;

  return {
    r: Number.parseInt(match[1], 16),
    g: Number.parseInt(match[2], 16),
    b: Number.parseInt(match[3], 16),
  };
}

function rgbaFromHex(color: string, alpha: number) {
  const rgb = hexToRgb(color);
  return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` : color;
}

function createBarGradient(ctx: CanvasRenderingContext2D, entity: RenderableEntity, top: number, height: number) {
  const gradient = ctx.createLinearGradient(0, top, 0, top + height);
  const fill = entity.style.fill;

  gradient.addColorStop(0, BAR_HIGHLIGHT_COLOR);
  gradient.addColorStop(0.18, rgbaFromHex(fill, 0.95));
  gradient.addColorStop(0.72, rgbaFromHex(fill, 0.72));
  gradient.addColorStop(1, rgbaFromHex(fill, 0.46));

  return gradient;
}

export function useCanvasRenderer(canvasRef: Ref<HTMLCanvasElement | null>) {
  const currentFrame = ref<FrameState | null>(null);
  let animationFrameId: number | null = null;
  let containerWidth = 800;
  let containerHeight = 360;

  function setCanvasDimensions(width: number, height: number) {
    containerWidth = Math.max(1, width);
    containerHeight = Math.max(1, height);

    if (!canvasRef.value) return;

    const dpr = window.devicePixelRatio || 1;
    canvasRef.value.width = Math.floor(containerWidth * dpr);
    canvasRef.value.height = Math.floor(containerHeight * dpr);
    canvasRef.value.style.width = `${containerWidth}px`;
    canvasRef.value.style.height = `${containerHeight}px`;

    const ctx = canvasRef.value.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;
  }

  function initialize(width: number, height: number) {
    setCanvasDimensions(width, height);
  }

  function resize(width: number, height: number) {
    setCanvasDimensions(width, height);
  }

  function renderFrame(frame: FrameState) {
    currentFrame.value = frame;
  }

  /** 绘制桶格子的圆角矩形背景面板（region-panel 类型专用） */
  function drawRegionPanel(ctx: CanvasRenderingContext2D, overlay: RenderableOverlay) {
    if (!overlay.rect) return;
    const { x, y, width, height, radius } = overlay.rect;

    ctx.save();
    ctx.globalAlpha = overlay.style.alpha ?? 1;

    // 半透明背景填充
    roundedRectPath(ctx, x, y, width, height, radius);
    ctx.fillStyle = overlay.style.fill;
    ctx.fill();

    // 彩色边框 + 外发光
    const borderColor = overlay.style.stroke ?? overlay.style.fill;
    ctx.shadowColor = borderColor;
    ctx.shadowBlur = 18 * (overlay.style.glow ?? 0.3);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = overlay.accentBar ? 1.8 : 1.2;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 活跃桶：顶部内侧绘制 2.5px 发光高亮条
    if (overlay.accentBar) {
      const barH = 2.5;
      const innerR = Math.min(radius, barH);
      ctx.save();
      ctx.shadowColor = overlay.accentBar;
      ctx.shadowBlur = 8;
      ctx.fillStyle = overlay.accentBar;
      roundedRectPath(ctx, x + 1, y + 1, width - 2, barH, innerR);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  function drawOverlay(ctx: CanvasRenderingContext2D, overlay: RenderableOverlay) {
    // region-panel 由三阶段绘制流程单独处理，此处跳过
    if (overlay.kind === "region-panel") {
      drawRegionPanel(ctx, overlay);
      return;
    }

    ctx.save();
    ctx.globalAlpha = overlay.style.alpha ?? 1;

    if (overlay.points?.length) {
      ctx.strokeStyle = overlay.style.stroke ?? overlay.style.fill;
      ctx.lineWidth = overlay.kind === "guide" ? 2 : 1.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = overlay.style.stroke ?? overlay.style.fill;
      ctx.shadowBlur = overlay.kind === "guide" ? 8 : 3;

      if (overlay.style.dashed) {
        ctx.setLineDash([7, 7]);
      }

      ctx.beginPath();
      ctx.moveTo(overlay.points[0].x, overlay.points[0].y);
      if (overlay.points.length === 3) {
        ctx.quadraticCurveTo(
          overlay.points[1].x,
          overlay.points[1].y,
          overlay.points[2].x,
          overlay.points[2].y,
        );
      } else {
        for (let index = 1; index < overlay.points.length; index += 1) {
          ctx.lineTo(overlay.points[index].x, overlay.points[index].y);
        }
      }
      ctx.stroke();
    }

    if (overlay.text && overlay.points?.[0]) {
      const anchor = overlay.points[0];

      if (overlay.kind === "badge") {
        // 徽章字号加大至 13px
        ctx.font = 'bold 13px "JetBrains Mono", monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const paddingX = 9;
        const boxHeight = 20;
        const textWidth = ctx.measureText(overlay.text).width;
        const boxWidth = textWidth + paddingX * 2;
        const left = anchor.x - boxWidth / 2;
        const top = anchor.y - boxHeight / 2;
        const radius = 8;

        roundedRectPath(ctx, left, top, boxWidth, boxHeight, radius);
        ctx.fillStyle = overlay.style.fill;
        ctx.fill();
        if (overlay.style.stroke) {
          ctx.strokeStyle = overlay.style.stroke;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        ctx.fillStyle = overlay.style.text ?? "#eaf2ff";
        ctx.fillText(overlay.text, anchor.x, anchor.y + 0.5);
      } else {
        // 桶标题 13px bold，其余 label 11px
        const isBucketTitle = overlay.id.startsWith("bucket-title-");
        ctx.font = isBucketTitle
          ? '700 13px "JetBrains Mono", monospace'
          : overlay.kind === "label"
            ? '600 11px "JetBrains Mono", monospace'
            : '10px "JetBrains Mono", monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = overlay.style.text ?? overlay.style.fill;
        ctx.fillText(overlay.text, anchor.x, anchor.y);
      }
    }

    ctx.restore();
  }

  function drawBarEntity(ctx: CanvasRenderingContext2D, entity: RenderableEntity, frame: FrameState) {
    const x = Math.round(entity.x);
    const y = Math.round(entity.y);
    const width = Math.round(entity.width);
    const height = Math.round(entity.height);
    const top = y - height;

    if (width <= 0 || height <= 0) return;

    const radius = Math.max(4, Math.min(10, Math.floor(width / 3)));

    ctx.save();
    ctx.globalAlpha = entity.style.alpha ?? entity.opacity;

    if (entity.style.glow) {
      ctx.shadowColor = entity.style.fill;
      ctx.shadowBlur = 18 * entity.style.glow;
    }

    roundedRectPath(ctx, x, top, width, height, radius);
    ctx.fillStyle = createBarGradient(ctx, entity, top, height);
    ctx.fill();

    ctx.shadowBlur = 0;
    if (entity.style.stroke) {
      ctx.strokeStyle = entity.style.stroke;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    ctx.strokeStyle = BAR_HIGHLIGHT_COLOR;
    ctx.lineWidth = Math.max(1, Math.min(2, width / 12));
    ctx.beginPath();
    ctx.moveTo(x + radius, top + 4);
    ctx.lineTo(x + width - radius, top + 4);
    ctx.stroke();

    ctx.restore();

    ctx.font = `700 ${Math.min(12, Math.max(width - 2, 9))}px "JetBrains Mono", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = entity.style.text ?? VALUE_LABEL_COLOR;
    ctx.fillText(String(entity.value), x + width / 2, Math.max(14, top - 8));

    ctx.font = `bold ${Math.min(12, Math.max(width - 2, 8))}px "JetBrains Mono", monospace`;
    ctx.fillStyle = INDEX_LABEL_COLOR;
    const labelOffset = getFrameNumberMeta(frame, "labelOffset") ?? 17;
    ctx.fillText(String(entity.displayIndex), x + width / 2, y + labelOffset);
  }

  function drawHeapEntity(ctx: CanvasRenderingContext2D, entity: RenderableEntity) {
    const radius = Math.max(6, Math.round(entity.width / 2));

    ctx.save();
    ctx.globalAlpha = entity.style.alpha ?? entity.opacity;
    ctx.fillStyle = entity.style.fill;

    if (entity.style.glow) {
      ctx.shadowColor = entity.style.fill;
      ctx.shadowBlur = 16 * entity.style.glow;
    }

    ctx.beginPath();
    ctx.arc(entity.x, entity.y, radius, 0, Math.PI * 2);
    ctx.fill();

    if (entity.style.stroke) {
      ctx.strokeStyle = entity.style.stroke;
      ctx.lineWidth = radius < 14 ? 1.5 : 2;
      ctx.stroke();
    }

    ctx.restore();

    ctx.font = `bold ${Math.min(13, Math.max(radius, 9))}px "JetBrains Mono", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = entity.style.text ?? "#c0d8f8";
    ctx.fillText(String(entity.value), entity.x, entity.y + 0.5);

    if (entity.kind === "heap-array-node") {
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.textBaseline = "top";
      ctx.fillStyle = "#445";
      ctx.fillText(String(entity.displayIndex), entity.x, entity.y + radius + 4);
    }
  }

  function drawEntity(ctx: CanvasRenderingContext2D, entity: RenderableEntity, frame: FrameState) {
    if (isHeapNode(entity)) {
      drawHeapEntity(ctx, entity);
      return;
    }

    drawBarEntity(ctx, entity, frame);
  }

  function getMainRegion(frame: FrameState) {
    return frame.regions.find((region) => region.kind === "main");
  }

  function getFrameNumberMeta(frame: FrameState, key: string) {
    const value = getMainRegion(frame)?.meta?.[key];
    return typeof value === "number" ? value : null;
  }

  function getFrameContentOffsetX(frame: FrameState) {
    const frameWidth = getMainRegion(frame)?.width ?? containerWidth;
    return Math.max(0, Math.round((containerWidth - frameWidth) / 2));
  }

  function drawBackground(ctx: CanvasRenderingContext2D, frame: FrameState) {
    ctx.clearRect(0, 0, containerWidth, containerHeight);
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, containerWidth, containerHeight);

    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;

    const gridSize = 40;
    for (let x = 0; x <= containerWidth; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, containerHeight);
      ctx.stroke();
    }

    for (let y = 0; y <= containerHeight; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(containerWidth, y + 0.5);
      ctx.stroke();
    }

    ctx.strokeStyle = BASELINE_COLOR;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = BASELINE_COLOR;
    ctx.shadowBlur = 8;
    const baseY = getFrameNumberMeta(frame, "baseY") ?? containerHeight - 21.5;
    const baselineY = Math.round(baseY) + 0.5;

    ctx.beginPath();
    ctx.moveTo(0, baselineY);
    ctx.lineTo(containerWidth, baselineY);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function draw() {
    const canvas = canvasRef.value;
    const frame = currentFrame.value;
    if (!canvas || !frame) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawBackground(ctx, frame);

    const xOffset = getFrameContentOffsetX(frame);

    // 三阶段绘制：
    // 阶段一：region-panel（桶背景底层）
    frame.overlays
      .filter((overlay) => overlay.kind === "region-panel")
      .forEach((overlay) => {
        ctx.save();
        ctx.translate(xOffset, 0);
        drawOverlay(ctx, overlay);
        ctx.restore();
      });

    // 阶段二：entity（数据柱子中层）
    ctx.save();
    ctx.translate(xOffset, 0);
    frame.entities
      .slice()
      .sort((a, b) => a.zIndex - b.zIndex)
      .forEach((entity) => drawEntity(ctx, entity, frame));
    ctx.restore();

    // 阶段三：其余 overlay（label/badge/guide/divider 前景）
    frame.overlays
      .filter((overlay) => overlay.kind !== "region-panel")
      .forEach((overlay) => {
        ctx.save();
        ctx.translate(xOffset, 0);
        drawOverlay(ctx, overlay);
        ctx.restore();
      });

    animationFrameId = requestAnimationFrame(draw);
  }

  function startRenderLoop() {
    if (animationFrameId !== null) return;
    animationFrameId = requestAnimationFrame(draw);
  }

  function stopRenderLoop() {
    if (animationFrameId === null) return;
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  return {
    initialize,
    resize,
    renderFrame,
    startRenderLoop,
    stopRenderLoop,
  };
}
