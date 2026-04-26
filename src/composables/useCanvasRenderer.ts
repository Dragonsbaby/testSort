import { ref, type Ref } from "vue";
import type { FrameState, RenderableEntity, RenderableOverlay } from "@/types/timeline";

function isHeapNode(entity: RenderableEntity) {
  return entity.kind === "heap-tree-node" || entity.kind === "heap-array-node";
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

  function drawOverlay(ctx: CanvasRenderingContext2D, overlay: RenderableOverlay) {
    ctx.save();
    ctx.globalAlpha = overlay.style.alpha ?? 1;

    if (overlay.points?.length) {
      ctx.strokeStyle = overlay.style.stroke ?? overlay.style.fill;
      ctx.lineWidth = 1.5;

      if (overlay.style.dashed) {
        ctx.setLineDash([6, 6]);
      }

      ctx.beginPath();
      ctx.moveTo(overlay.points[0].x, overlay.points[0].y);
      for (let index = 1; index < overlay.points.length; index += 1) {
        ctx.lineTo(overlay.points[index].x, overlay.points[index].y);
      }
      ctx.stroke();
    }

    if (overlay.text && overlay.points?.[0]) {
      const anchor = overlay.points[0];

      if (overlay.kind === "badge") {
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const paddingX = 8;
        const paddingY = 4;
        const textWidth = ctx.measureText(overlay.text).width;
        const boxWidth = textWidth + paddingX * 2;
        const boxHeight = 18;
        const left = anchor.x - boxWidth / 2;
        const top = anchor.y - boxHeight / 2;

        ctx.fillStyle = overlay.style.fill;
        ctx.fillRect(left, top, boxWidth, boxHeight);
        if (overlay.style.stroke) {
          ctx.strokeStyle = overlay.style.stroke;
          ctx.strokeRect(left, top, boxWidth, boxHeight);
        }

        ctx.fillStyle = overlay.style.text ?? "#eaf2ff";
        ctx.fillText(overlay.text, anchor.x, anchor.y + 0.5);
      } else {
        ctx.font = overlay.kind === "label"
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

  function drawBarEntity(ctx: CanvasRenderingContext2D, entity: RenderableEntity) {
    const x = Math.round(entity.x);
    const y = Math.round(entity.y);
    const width = Math.round(entity.width);
    const height = Math.round(entity.height);
    const top = y - height;

    if (width <= 0 || height <= 0) return;

    ctx.save();
    ctx.globalAlpha = entity.style.alpha ?? entity.opacity;
    ctx.fillStyle = entity.style.fill;

    if (entity.style.glow) {
      ctx.shadowColor = entity.style.fill;
      ctx.shadowBlur = 16 * entity.style.glow;
    }

    ctx.fillRect(x, top, width, height);

    if (entity.style.stroke) {
      ctx.strokeStyle = entity.style.stroke;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, top, width, height);
    }

    ctx.restore();

    ctx.font = `600 ${Math.min(10, Math.max(width - 2, 8))}px "JetBrains Mono", monospace`;
    ctx.textAlign = "center";
    ctx.fillStyle = entity.style.text ?? "#f7cb07";
    ctx.fillText(String(entity.value), x + width / 2, Math.max(12, top - 8));

    ctx.font = `bold ${Math.min(12, Math.max(width - 2, 8))}px "JetBrains Mono", monospace`;
    ctx.fillStyle = "#20e25a";
    ctx.fillText(String(entity.displayIndex), x + width / 2, y + 16);
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

  function drawEntity(ctx: CanvasRenderingContext2D, entity: RenderableEntity) {
    if (isHeapNode(entity)) {
      drawHeapEntity(ctx, entity);
      return;
    }

    drawBarEntity(ctx, entity);
  }

  function drawBackground(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, containerWidth, containerHeight);
    ctx.fillStyle = "#0f1219";
    ctx.fillRect(0, 0, containerWidth, containerHeight);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;

    const gridSize = 40;
    for (let x = 0; x < containerWidth; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, containerHeight);
      ctx.stroke();
    }

    for (let y = 0; y < containerHeight; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(containerWidth, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(78, 205, 196, 0.15)";
    ctx.beginPath();
    ctx.moveTo(0, containerHeight - 20);
    ctx.lineTo(containerWidth, containerHeight - 20);
    ctx.stroke();
  }

  function draw() {
    const canvas = canvasRef.value;
    const frame = currentFrame.value;
    if (!canvas || !frame) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawBackground(ctx);

    frame.overlays.forEach((overlay) => drawOverlay(ctx, overlay));

    frame.entities
      .slice()
      .sort((a, b) => a.zIndex - b.zIndex)
      .forEach((entity) => drawEntity(ctx, entity));

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
