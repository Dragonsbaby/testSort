import { ref, type Ref } from "vue";
import type { FrameState, RenderableEntity } from "@/types/timeline";

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

  function drawEntity(ctx: CanvasRenderingContext2D, entity: RenderableEntity) {
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
    ctx.restore();

    ctx.font = `600 ${Math.min(10, Math.max(width - 2, 8))}px "JetBrains Mono", monospace`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#f7cb07";
    ctx.fillText(String(entity.value), x + width / 2, Math.max(12, top - 8));

    ctx.font = `bold ${Math.min(12, Math.max(width - 2, 8))}px "JetBrains Mono", monospace`;
    ctx.fillStyle = "#20e25a";
    ctx.fillText(String(entity.displayIndex), x + width / 2, y + 16);
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
