import { ref, watch, type Ref } from "vue";
import type { FrameState, RenderableEntity, RenderableOverlay, OverlayColorToken } from "@/types/timeline";
import type { RendererPalette } from "@/types/theme";
import { useThemeStore } from "@/stores/themeStore";
import { resolveEntityStyle } from "@/utils/frame/style-utils";

/** Canvas 等宽字体族（集中管理；JetBrains Mono 由 theme.scss 自托管 @font-face 提供） */
const FONT_FAMILY = '"JetBrains Mono", monospace';
/** 固定字号字体预设（动态字号用 sizedFont 生成） */
const FONTS = {
  /** 徽章数字（桶计数）：bold 13px */
  badge: `bold 13px ${FONT_FAMILY}`,
  /** 桶标题：700 13px */
  bucketTitle: `700 13px ${FONT_FAMILY}`,
  /** 普通标签：600 11px */
  label: `600 11px ${FONT_FAMILY}`,
  /** 小字号文本：10px */
  tiny: `10px ${FONT_FAMILY}`,
  /** 堆节点 displayIndex：8px */
  heapIndex: `8px ${FONT_FAMILY}`,
} as const;
/** 按字号生成动态字体字符串（柱子值/序号、堆节点值随尺寸缩放） */
function sizedFont(weight: string, size: number) {
  return `${weight} ${size}px ${FONT_FAMILY}`;
}

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

/** overlay 语义 token → palette 颜色（渲染期解析，builders 不再携带 hex） */
function overlayColor(token: OverlayColorToken, palette: RendererPalette): string {
  switch (token) {
    case "accent": return palette.accent;
    case "text": return palette.uiText;
    case "text-secondary": return palette.uiTextSecondary;
    case "text-muted": return palette.uiTextMuted;
    case "border": return palette.border;
    case "panel-fill": return palette.backgroundSecondary;
    case "comparing": return palette.states.comparing.fill;
    case "swapping": return palette.states.swapping.fill;
    case "sorted": return palette.states.sorted.fill;
    case "latest": return palette.states.latest.fill;
  }
}

export function useCanvasRenderer(canvasRef: Ref<HTMLCanvasElement | null>) {
  const currentFrame = ref<FrameState | null>(null);
  let animationFrameId: number | null = null;
  let needsRedraw = false;
  let containerWidth = 800;
  let containerHeight = 360;
  // entities 按 zIndex 排序结果缓存（同一帧复用，避免每帧重复 slice+sort）
  let lastSortedFrame: FrameState | null = null;
  let cachedSortedEntities: RenderableEntity[] = [];
  // 静态背景（背景色 + 点阵）离屏缓存：仅在 resize / 主题混合结束时重建，绘制时 drawImage 一次
  let bgCanvas: HTMLCanvasElement | null = null;
  let bgCtx: CanvasRenderingContext2D | null = null;
  // 主题切换后缓存过期标记：混合结束的第一帧用终态 palette 重建（watch 时机在混合起点，那时取到的是旧色）
  let bgCacheStale = false;

  const themeStore = useThemeStore();

  /** 当前帧调色板（混合期间逐帧变化；轮询同时推进混合状态机） */
  function palette(): RendererPalette {
    return themeStore.currentRendererPalette(performance.now());
  }

  // 主题变化：标记缓存过期并触发重绘（背景缓存重建推迟到混合结束的终态帧）
  watch(() => themeStore.currentThemeId, () => {
    bgCacheStale = true;
    if (currentFrame.value) {
      needsRedraw = true;
      requestRender();
    }
  });

  function initialize(width: number, height: number) {
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

    rebuildBackgroundCache(palette());
    bgCacheStale = false;
  }

  function resize(width: number, height: number) {
    initialize(width, height);
    needsRedraw = true;
    requestRender();
  }

  function renderFrame(frame: FrameState) {
    currentFrame.value = frame;
    needsRedraw = true;
    requestRender();
  }

  /** 绘制桶格子的圆角矩形背景面板（region-panel 专用；颜色全部 token 解析） */
  function drawRegionPanel(ctx: CanvasRenderingContext2D, overlay: RenderableOverlay, pal: RendererPalette) {
    if (!overlay.rect) return;
    const { x, y, width, height, radius } = overlay.rect;
    const alpha = overlay.style.alpha ?? 1;
    const borderColor = overlayColor(overlay.style.color ?? "border", pal);

    ctx.save();

    // 面板底：次级背景半透明填充
    roundedRectPath(ctx, x, y, width, height, radius);
    ctx.fillStyle = overlayColor("panel-fill", pal);
    ctx.globalAlpha = alpha * 0.6;
    ctx.fill();

    // 边框（活跃桶 accent 微发光，非活跃 border 静默）
    ctx.globalAlpha = alpha;
    if (overlay.accentBar) {
      ctx.shadowColor = borderColor;
      ctx.shadowBlur = 8;
    }
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = overlay.accentBar ? 1.4 : 1;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 活跃桶：顶部内侧 accent 高亮条
    if (overlay.accentBar) {
      const barH = 2.5;
      const innerR = Math.min(radius, barH);
      ctx.save();
      ctx.shadowColor = borderColor;
      ctx.shadowBlur = 6;
      ctx.fillStyle = borderColor;
      roundedRectPath(ctx, x + 1, y + 1, width - 2, barH, innerR);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  function drawOverlay(ctx: CanvasRenderingContext2D, overlay: RenderableOverlay, pal: RendererPalette) {
    // region-panel 由三阶段绘制流程单独处理，此处跳过
    if (overlay.kind === "region-panel") {
      drawRegionPanel(ctx, overlay, pal);
      return;
    }

    ctx.save();
    ctx.globalAlpha = overlay.style.alpha ?? 1;

    if (overlay.points?.length) {
      const lineColor = overlayColor(overlay.style.color ?? "border", pal);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = overlay.kind === "guide" ? 2 : 1.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (overlay.kind === "guide") {
        // 仅引导线发光（comparing 虚线），其余线条静默
        ctx.shadowColor = lineColor;
        ctx.shadowBlur = pal.shadowBlur * (overlay.style.glow ?? 0);
      }

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
        // 徽章字号 13px
        ctx.font = FONTS.badge;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // 徽章底：次级背景 + border 细边（画廊式安静徽章）
        const paddingX = 8;
        const boxHeight = 18;
        const textWidth = ctx.measureText(overlay.text).width;
        const boxWidth = textWidth + paddingX * 2;

        roundedRectPath(ctx, anchor.x - boxWidth / 2, anchor.y - boxHeight / 2, boxWidth, boxHeight, 6);
        ctx.fillStyle = overlayColor("panel-fill", pal);
        ctx.fill();
        ctx.strokeStyle = overlayColor("border", pal);
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = overlayColor(overlay.style.textColor ?? "text-secondary", pal);
        ctx.fillText(overlay.text, anchor.x, anchor.y + 0.5);
      } else {
        // 桶标题 13px bold，其余 label 11px
        const isBucketTitle = overlay.id.startsWith("bucket-title-");
        ctx.font = isBucketTitle
          ? FONTS.bucketTitle
          : overlay.kind === "label"
            ? FONTS.label
            : FONTS.tiny;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = overlayColor(overlay.style.textColor ?? "text-secondary", pal);
        ctx.fillText(overlay.text, anchor.x, anchor.y);
      }
    }

    ctx.restore();
  }

  /** 柱状实体：纯色块 + 渲染期取色（渐变/描边/顶部高光线已退役——画廊柱子色块即身份） */
  function drawBarEntity(ctx: CanvasRenderingContext2D, entity: RenderableEntity, frame: FrameState, pal: RendererPalette) {
    const x = Math.round(entity.x);
    const y = Math.round(entity.y);
    const width = Math.round(entity.width);
    const height = Math.round(entity.height);
    const top = y - height;

    if (width <= 0 || height <= 0) return;

    const radius = Math.max(4, Math.min(10, Math.floor(width / 3)));
    const visual = resolveEntityStyle(entity.stateTags, pal);

    ctx.save();
    ctx.globalAlpha = entity.style?.alpha ?? entity.opacity;

    // 发光只在有 glow 乘数的活跃状态出现（射灯原则）；亮色主题 shadowBlur=0 天然无发光
    if (visual.glow > 0 && pal.shadowBlur > 0) {
      ctx.shadowColor = visual.fill;
      ctx.shadowBlur = pal.shadowBlur * visual.glow;
    }

    roundedRectPath(ctx, x, top, width, height, radius);
    ctx.fillStyle = visual.fill;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.font = sizedFont("700", Math.min(12, Math.max(width - 2, 9)));
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = pal.text;
    ctx.fillText(String(entity.value), x + width / 2, Math.max(14, top - 8));

    ctx.font = sizedFont("bold", Math.min(12, Math.max(width - 2, 8)));
    ctx.fillStyle = pal.indexText;
    const labelOffset = getFrameNumberMeta(frame, "labelOffset") ?? 17;
    ctx.fillText(String(entity.displayIndex), x + width / 2, y + labelOffset);

    ctx.restore();
  }

  function drawHeapEntity(ctx: CanvasRenderingContext2D, entity: RenderableEntity, pal: RendererPalette) {
    const radius = Math.max(3, Math.round(entity.width / 2));
    const visual = resolveEntityStyle(entity.stateTags, pal);

    ctx.save();
    ctx.globalAlpha = entity.style?.alpha ?? entity.opacity;
    ctx.fillStyle = visual.fill;

    if (visual.glow > 0 && pal.shadowBlur > 0) {
      ctx.shadowColor = visual.fill;
      ctx.shadowBlur = pal.shadowBlur * visual.glow;
    }

    ctx.beginPath();
    ctx.arc(entity.x, entity.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.font = sizedFont("bold", Math.min(13, Math.max(radius * 1.2, 7)));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = pal.text;
    if (radius >= 6) {
      ctx.fillText(String(entity.value), entity.x, entity.y + 0.5);
      if (entity.kind === "heap-array-node" || entity.kind === "heap-tree-node") {
        ctx.font = FONTS.heapIndex;
        ctx.textBaseline = "top";
        ctx.fillStyle = pal.indexText;
        ctx.fillText(String(entity.displayIndex), entity.x, entity.y + radius + 4);
      }
    }
  }

  function drawEntity(ctx: CanvasRenderingContext2D, entity: RenderableEntity, frame: FrameState, pal: RendererPalette) {
    if (isHeapNode(entity)) {
      drawHeapEntity(ctx, entity, pal);
      return;
    }

    drawBarEntity(ctx, entity, frame, pal);
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

  /** 静态层（背景色 + 点阵）到指定 ctx；palette 参数化以支持混合期间逐帧重画；baseline 因 baseY 随帧变化，留给 drawBackground 动态绘制 */
  function paintStaticBackground(targetCtx: CanvasRenderingContext2D, pal: RendererPalette) {
    targetCtx.fillStyle = pal.background;
    targetCtx.fillRect(0, 0, containerWidth, containerHeight);

    // 点阵网格（与 App.vue CSS 点阵同一 gridSpacing=24，画廊式安静底纹）
    targetCtx.fillStyle = pal.grid;
    for (let gx = pal.gridSpacing / 2; gx < containerWidth; gx += pal.gridSpacing) {
      for (let gy = pal.gridSpacing / 2; gy < containerHeight; gy += pal.gridSpacing) {
        targetCtx.beginPath();
        targetCtx.arc(gx, gy, 1, 0, Math.PI * 2);
        targetCtx.fill();
      }
    }
  }

  /** 重建静态背景离屏缓存（resize / 主题混合结束时调用；与主 canvas 同 dpr 创建+缩放，drawImage 时 1:1 无缩放） */
  function rebuildBackgroundCache(pal: RendererPalette) {
    if (!bgCanvas) bgCanvas = document.createElement("canvas");
    const dpr = window.devicePixelRatio || 1;
    bgCanvas.width = Math.floor(containerWidth * dpr);
    bgCanvas.height = Math.floor(containerHeight * dpr);
    bgCtx = bgCanvas.getContext("2d");
    if (!bgCtx) return;
    bgCtx.setTransform(1, 0, 0, 1, 0, 0);
    bgCtx.scale(dpr, dpr);
    paintStaticBackground(bgCtx, pal);
  }

  function drawBackground(ctx: CanvasRenderingContext2D, frame: FrameState, pal: RendererPalette) {
    ctx.clearRect(0, 0, containerWidth, containerHeight);

    if (themeStore.isPaletteMixing()) {
      // 混合期间背景逐帧直画（缓存是单帧静止色，用它会在混合中发生背景跳变）
      paintStaticBackground(ctx, pal);
    } else {
      // 混合结束：用过期标记判断是否需要按终态 palette 重建缓存
      if (bgCacheStale || !bgCtx || !bgCanvas) {
        rebuildBackgroundCache(pal);
        bgCacheStale = false;
      }
      if (bgCanvas) {
        ctx.drawImage(bgCanvas, 0, 0, containerWidth, containerHeight);
      } else {
        paintStaticBackground(ctx, pal);
      }
    }

    // baseline（动态：baseY 随帧变化，不进缓存）；安静水平线，无发光
    ctx.strokeStyle = pal.baseline;
    ctx.lineWidth = 1.5;
    const baseY = getFrameNumberMeta(frame, "baseY") ?? containerHeight - 21.5;
    const baselineY = Math.round(baseY) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, baselineY);
    ctx.lineTo(containerWidth, baselineY);
    ctx.stroke();
  }

  /** 按 zIndex 排序的实体列表（同帧缓存，跨帧重建） */
  function getSortedEntities(frame: FrameState): RenderableEntity[] {
    if (frame !== lastSortedFrame) {
      cachedSortedEntities = frame.entities.slice().sort((a, b) => a.zIndex - b.zIndex);
      lastSortedFrame = frame;
    }
    return cachedSortedEntities;
  }

  /** 单次绘制：每帧取一次 palette 贯穿全流程（按需触发，静止时零开销） */
  function drawOnce() {
    const canvas = canvasRef.value;
    const frame = currentFrame.value;
    if (!canvas || !frame) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pal = palette();

    drawBackground(ctx, frame, pal);

    const xOffset = getFrameContentOffsetX(frame);

    // 三阶段绘制：
    // 阶段一：region-panel（桶背景底层）
    frame.overlays
      .filter((overlay) => overlay.kind === "region-panel")
      .forEach((overlay) => {
        ctx.save();
        ctx.translate(xOffset, 0);
        drawOverlay(ctx, overlay, pal);
        ctx.restore();
      });

    // 阶段二：entity（数据柱子中层，zIndex 排序结果按帧缓存）
    ctx.save();
    ctx.translate(xOffset, 0);
    getSortedEntities(frame)
      .forEach((entity) => drawEntity(ctx, entity, frame, pal));
    ctx.restore();

    // 阶段三：其余 overlay（label/badge/guide/divider 前景）
    frame.overlays
      .filter((overlay) => overlay.kind !== "region-panel")
      .forEach((overlay) => {
        ctx.save();
        ctx.translate(xOffset, 0);
        drawOverlay(ctx, overlay, pal);
        ctx.restore();
      });

    // 混合未结束：自续帧直到 300ms 换装完成（spec 5.3）
    if (themeStore.isPaletteMixing()) {
      needsRedraw = true;
      requestRender();
    }
  }

  /** 合并多次重绘请求：仅当有待绘制内容且当前无挂起 rAF 时调度一帧；画面静止时零开销 */
  function requestRender() {
    if (animationFrameId !== null) return;
    animationFrameId = requestAnimationFrame(() => {
      animationFrameId = null;
      if (needsRedraw) {
        needsRedraw = false;
        drawOnce();
      }
    });
  }

  function startRenderLoop() {
    needsRedraw = true;
    requestRender();
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
