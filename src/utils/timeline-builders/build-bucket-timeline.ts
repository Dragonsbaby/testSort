import type { FrameState, RenderableEntity, RenderableOverlay, RenderableRegion, StateTag, TimelineStep, SemanticStep } from "@/types/timeline";
import { buildBucketLayout, BUCKET_INNER_PADDING_TOP, BUCKET_INNER_PADDING_BOT, BUCKET_INNER_PADDING_X } from "@/utils/layout/bucket-layout";
import { getStyleFromStateTags } from "@/utils/frame/style-utils";
import { getBucketTheme } from "@/utils/frame/bucket-palette";
import { calcBucketCount } from "@/types/sorting";

const MAIN_BASE_STYLE = { fill: "#4a9eff", glow: 0 };

type FrameRole = "from" | "to" | "static";

/** 根据桶索引动态返回柱子样式 */
function getBucketBarStyle(bucketIndex: number) {
  const theme = getBucketTheme(bucketIndex);
  return { fill: theme.bar, glow: 0.2 };
}

function buildBucketTags(semantic: SemanticStep) {
  const mainStateTags = new Map<number, StateTag[]>();
  const bucketStateTags = new Map<string, StateTag[]>();

  if (semantic.type === "bucket-scatter") {
    const [sourceIndex] = semantic.indices;
    if (typeof sourceIndex === "number") {
      mainStateTags.set(sourceIndex, ["latest"]);
    }
    if (typeof semantic.bucketIndex === "number" && typeof semantic.bucketPos === "number") {
      bucketStateTags.set(`${semantic.bucketIndex}-${semantic.bucketPos}`, ["latest"]);
    }
  }

  if (semantic.type === "bucket-compare") {
    semantic.indices.forEach((index) => {
      if (typeof semantic.bucketIndex === "number") {
        bucketStateTags.set(`${semantic.bucketIndex}-${index}`, ["comparing"]);
      }
    });
  }

  if (semantic.type === "bucket-swap") {
    semantic.indices.forEach((index) => {
      if (typeof semantic.bucketIndex === "number") {
        bucketStateTags.set(`${semantic.bucketIndex}-${index}`, ["swapping"]);
      }
    });
  }

  if (semantic.type === "bucket-gather") {
    const [destIndex] = semantic.indices;
    if (typeof destIndex === "number") {
      mainStateTags.set(destIndex, ["sorted"]);
    }
    if (typeof semantic.bucketIndex === "number") {
      bucketStateTags.set(`${semantic.bucketIndex}-0`, ["latest"]);
    }
  }

  if (semantic.type === "sorted") {
    semantic.indices.forEach((index) => {
      mainStateTags.set(index, ["sorted"]);
    });
  }

  return { mainStateTags, bucketStateTags };
}

function buildBucketRegions(width: number, height: number, bucketCount: number): RenderableRegion[] {
  const layout = buildBucketLayout(width, height, Math.max(bucketCount, 1));
  // 主数组基线 Y = mainHeight - 22（与柱子底部对齐），传入 meta.baseY 供渲染器绘制水平线
  const baseY = layout.mainHeight - 22;
  return [
    { id: "main", kind: "main", x: 0, y: 0, width, height: layout.mainHeight, meta: { baseY } },
    ...layout.bucketRegions.map((region) => ({
      id: `bucket-${region.bucketIndex}`,
      kind: "bucket" as const,
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      meta: { bucketIndex: region.bucketIndex },
    })),
  ];
}

function buildBucketOverlays(
  layout: ReturnType<typeof buildBucketLayout>,
  _width: number, // 预留参数，用于未来布局计算
  buckets: number[][],
  activeBucketIndex?: number,
): RenderableOverlay[] {
  const overlays: RenderableOverlay[] = [];

  // 主数组区标签（更醒目蓝色）
  overlays.push({
    id: "bucket-main-label",
    kind: "label",
    points: [{ x: 72, y: 18 }],
    text: "▸ 主数组区",
    style: { fill: "#74b6ff", text: "#74b6ff", alpha: 0.95 },
  });

  // 每个桶的 region-panel + 标题 + 计数徽章
  for (const region of layout.bucketRegions) {
    const { bucketIndex } = region;
    const theme = getBucketTheme(bucketIndex);
    const isActive = bucketIndex === activeBucketIndex;

    // 圆角背景面板
    overlays.push({
      id: `bucket-panel-${bucketIndex}`,
      kind: "region-panel",
      rect: {
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
        radius: 8,
      },
      style: {
        fill: theme.bgFill,
        stroke: isActive ? theme.border : `${theme.border}99`,
        glow: isActive ? 0.7 : 0.3,
        alpha: 1,
      },
      accentBar: isActive ? theme.border : undefined,
    });

    // 桶标题（英文更优雅，字号 13px bold，独立配色）
    overlays.push({
      id: `bucket-title-${bucketIndex}`,
      kind: "label",
      points: [{ x: region.x + region.width / 2, y: region.y + 14 }],
      text: `Bucket ${bucketIndex + 1}`,
      style: { fill: theme.border, text: theme.border, alpha: 0.95 },
    });

    // 计数徽章（纯数字，尺寸加大）
    const bucketItemCount = buckets[bucketIndex]?.length ?? 0;
    overlays.push({
      id: `bucket-count-${bucketIndex}`,
      kind: "badge",
      points: [{ x: region.x + region.width - 22, y: region.y + 14 }],
      text: String(bucketItemCount),
      style: { fill: theme.badgeBg, stroke: `${theme.border}AA`, text: theme.badgeText, alpha: 0.95 },
    });
  }

  return overlays;
}

function createBucketFrame(params: {
  mainValues: number[];
  buckets: number[][];
  displayIndexes: number[];
  width: number;
  height: number;
  stepIndex: number;
  description: string;
  mainStateTags: Map<number, StateTag[]>;
  bucketStateTags: Map<string, StateTag[]>;
  semantic?: SemanticStep;
  frameRole?: FrameRole;
  activeBucketIndex?: number;
  globalMaxValue: number;
  ghostStepIndex?: number;
  scatteredIndices?: Set<number>;
}): FrameState {
  const {
    mainValues,
    buckets,
    displayIndexes,
    width,
    height,
    stepIndex,
    description,
    mainStateTags,
    bucketStateTags,
    semantic,
    frameRole = "static",
    activeBucketIndex,
    globalMaxValue,
    ghostStepIndex,
    scatteredIndices,
  } = params;
  const layout = buildBucketLayout(width, height, mainValues.length);
  const maxValue = Math.max(...mainValues, 1);
  const mainBarWidth = Math.min(32, Math.max(10, Math.floor((width - 80) / Math.max(mainValues.length, 1)) - 4));
  const mainGap = 4;
  const mainTotalWidth = mainValues.length * mainBarWidth + Math.max(mainValues.length - 1, 0) * mainGap;
  const mainStartX = Math.max(20, Math.round((width - mainTotalWidth) / 2));

  const mainEntities: RenderableEntity[] = mainValues.map((value, index) => {
    const stateTags = mainStateTags.get(index) ?? [];
    const isScattered = scatteredIndices?.has(index);
    return {
      id: `main-${index}`,
      sourceId: `value-${displayIndexes[index]}`,
      kind: "main-bar",
      value,
      displayIndex: displayIndexes[index],
      x: mainStartX + index * (mainBarWidth + mainGap),
      y: layout.mainHeight - 22,
      width: isScattered ? 0 : mainBarWidth,
      height: Math.max(6, Math.round((value / maxValue) * (layout.mainHeight - 52))),
      opacity: isScattered ? 0 : 1,
      zIndex: 1,
      style: getStyleFromStateTags(stateTags, MAIN_BASE_STYLE),
      stateTags,
    };
  });

  const bucketEntities: RenderableEntity[] = buckets.flatMap((bucket, bucketIndex) => {
    const region = layout.bucketRegions[bucketIndex];
    if (!region) return [];

    // 桶内可用高度（扣除顶部标签区和底部 index 标签）
    const innerHeight = region.height - BUCKET_INNER_PADDING_TOP - BUCKET_INNER_PADDING_BOT;
    const innerWidth = Math.max(region.width - BUCKET_INNER_PADDING_X * 2, 20);
    const barGap = 4;
    let barWidth = Math.round(mainBarWidth * 0.9);
    // 如果桶内元素过多导致溢出，按比例缩小
    const totalNeeded = bucket.length * barWidth + Math.max(bucket.length - 1, 0) * barGap;
    if (totalNeeded > innerWidth && bucket.length > 0) {
      barWidth = Math.max(6, Math.floor((innerWidth - Math.max(bucket.length - 1, 0) * barGap) / bucket.length));
    }

    // 桶内柱子底部基准 Y（从桶底部向上留出 BUCKET_INNER_PADDING_BOT）
    const barBaseY = region.y + region.height - BUCKET_INNER_PADDING_BOT;

    // 用全局最大值归一化，所有桶共享同一基准，高度稳定
    const bucketMax = globalMaxValue;

    // 水平越界上限，防止柱子画出桶右边界；至少保留第一根柱子的起始位置
    const xMax = Math.max(
      region.x + BUCKET_INNER_PADDING_X,
      region.x + region.width - BUCKET_INNER_PADDING_X - barWidth,
    );

    const bucketBaseStyle = getBucketBarStyle(bucketIndex);

    return bucket.map((value, position) => {
      const stateTags = bucketStateTags.get(`${bucketIndex}-${position}`) ?? [];
      // to 帧 scatter 落点的 bar 保持隐藏，由 ghost 负责视觉，ghost 消失后下一步 from 帧才显示
      const isGhostTarget =
        frameRole === "to" &&
        semantic?.type === "bucket-scatter" &&
        bucketIndex === semantic.bucketIndex &&
        position === semantic.bucketPos;
      return {
        id: `bucket-${bucketIndex}-${position}`,
        sourceId: `bucket-${bucketIndex}-${value}-${position}`,
        kind: "bucket-bar",
        value,
        displayIndex: position + 1,
        // x 坐标不超过 xMax，防止水平溢出
        x: Math.min(region.x + BUCKET_INNER_PADDING_X + position * (barWidth + barGap), xMax),
        y: barBaseY,
        width: barWidth,
        // 高度基于桶的历史最终最大值缩放，动画过程中高度稳定；上限钳制防止 bucketMax 偏低时溢出桶顶
        height: Math.min(innerHeight, Math.max(6, Math.round((value / bucketMax) * innerHeight))),
        opacity: isGhostTarget ? 0 : 1,
        zIndex: 2,
        style: getStyleFromStateTags(stateTags, bucketBaseStyle),
        stateTags,
      } satisfies RenderableEntity;
    });
  });

  const ghostEntities: RenderableEntity[] = [];

  if (semantic?.type === "bucket-scatter") {
    const [sourceIndex] = semantic.indices;
    const bucketIndex = semantic.bucketIndex;
    const bucketPos = semantic.bucketPos;
    const source = typeof sourceIndex === "number" ? mainEntities[sourceIndex] : null;

    // 直接从 layout 计算终点坐标（不依赖 bucketEntities，避免 from/to 帧桶数据不同步的问题）
    const targetBucketIndex = typeof bucketIndex === "number" ? bucketIndex : null;
    const targetRegion = targetBucketIndex !== null ? layout.bucketRegions[targetBucketIndex] : null;
    if (source && targetRegion && targetBucketIndex !== null && typeof bucketPos === "number") {
      const tBarGap = 4;
      const tBarWidth = Math.round(mainBarWidth * 0.9);
      const tBarBaseY = targetRegion.y + targetRegion.height - BUCKET_INNER_PADDING_BOT;
      const tBarHeight = Math.min(
        targetRegion.height - BUCKET_INNER_PADDING_TOP - BUCKET_INNER_PADDING_BOT,
        Math.max(6, Math.round((source.value / globalMaxValue) * (layout.mainHeight - 52))),
      );
      const xMax = Math.max(targetRegion.x + BUCKET_INNER_PADDING_X, targetRegion.x + targetRegion.width - BUCKET_INNER_PADDING_X - tBarWidth);
      const tBarX = Math.min(targetRegion.x + BUCKET_INNER_PADDING_X + (bucketPos as number) * (tBarWidth + tBarGap), xMax);
      const bucketBaseStyle = getBucketBarStyle(targetBucketIndex);

      const ghostId = `ghost-scatter-${ghostStepIndex ?? stepIndex}`;
      // from 帧：ghost 在主数组位置，宽度与源柱子一致（完全覆盖源位置）
      // to 帧：ghost 到达桶内目标位置，宽度为桶内宽度
      ghostEntities.push(
        frameRole === "from"
          ? { ...source, id: ghostId, sourceId: source.sourceId, kind: "main-bar", width: source.width, height: tBarHeight, opacity: 1, zIndex: 3, style: bucketBaseStyle, stateTags: [] }
          : { ...source, id: ghostId, sourceId: source.sourceId, kind: "main-bar", x: tBarX, y: tBarBaseY, width: tBarWidth, height: tBarHeight, opacity: 1, zIndex: 3, style: bucketBaseStyle, stateTags: [] },
      );

      // source bar 立即隐藏（ghost 接替飞行）
      if (frameRole === "from" || frameRole === "to") {
        const idx = mainEntities.findIndex((e) => e.id === `main-${sourceIndex}`);
        if (idx !== -1) mainEntities[idx] = { ...mainEntities[idx], opacity: 0 };
      }
    }
  }

  if (semantic?.type === "bucket-gather") {
    const [destIndex] = semantic.indices;
    const bucketIndex = semantic.bucketIndex;
    const target = typeof destIndex === "number" ? mainEntities[destIndex] : null;

    // 直接从 layout 计算起点坐标（from 帧桶内还有元素，to 帧已经 slice 掉了，不依赖 bucketEntities 查找）
    const sourceRegion = typeof bucketIndex === "number" ? layout.bucketRegions[bucketIndex] : null;
    if (target && sourceRegion && typeof bucketIndex === "number") {
      const fromFrameBucketLen = buckets[bucketIndex]?.length ?? 0;
      if (fromFrameBucketLen > 0) {
        const sourceValue = buckets[bucketIndex][0];
        const sBarWidth = Math.round(mainBarWidth * 0.9);
        const sBarBaseY = sourceRegion.y + sourceRegion.height - BUCKET_INNER_PADDING_BOT;
        const sBarHeight = Math.min(
          sourceRegion.height - BUCKET_INNER_PADDING_TOP - BUCKET_INNER_PADDING_BOT,
          Math.max(6, Math.round((sourceValue / globalMaxValue) * (layout.mainHeight - 52))),
        );
        const sBarX = sourceRegion.x + BUCKET_INNER_PADDING_X;
        const bucketBaseStyle = getBucketBarStyle(bucketIndex);

        const ghostId = `ghost-gather-${ghostStepIndex ?? stepIndex}`;
        ghostEntities.push(
          frameRole === "from"
            ? { id: ghostId, sourceId: `bucket-${bucketIndex}-${sourceValue}-0`, kind: "bucket-bar", value: sourceValue, displayIndex: 1, x: sBarX, y: sBarBaseY, width: sBarWidth, height: sBarHeight, opacity: 1, zIndex: 3, style: bucketBaseStyle, stateTags: [] }
            // ghost to 帧保持可见（opacity:1）：飞行结束时 target 主柱重新显示，ghost 须同位置可见以平滑接管，
            // 下一 step 的 from 帧 ghost 消失、target 接管。若 opacity:0 会导致 ghost 淡出与 target 显现的切换闪烁（CLAUDE.md 经验 #6）
            : { ...target, id: ghostId, sourceId: `bucket-${bucketIndex}-${sourceValue}-0`, kind: "bucket-bar", width: target.width, opacity: 1, zIndex: 3, style: bucketBaseStyle, stateTags: [] },
        );

        // 桶内 position-0 bar 在 from 帧立刻隐藏
        if (frameRole === "from") {
          const idx = bucketEntities.findIndex((e) => e.id === `bucket-${bucketIndex}-0`);
          if (idx !== -1) bucketEntities[idx] = { ...bucketEntities[idx], opacity: 0 };
        }
      }
    }
  }

  return {
    algorithm: "bucket",
    stepIndex,
    progress: 0,
    phase: "paused",
    description,
    entities: [...mainEntities, ...bucketEntities, ...ghostEntities],
    regions: buildBucketRegions(width, height, layout.bucketCount),
    overlays: buildBucketOverlays(layout, width, buckets, activeBucketIndex),
  };
}

export function buildBucketInitialFrame(params: {
  originalValues: number[];
  displayIndexes: number[];
  width: number;
  height: number;
}): FrameState {
  const bucketCount = calcBucketCount(params.originalValues.length);
  return createBucketFrame({
    mainValues: params.originalValues,
    buckets: Array.from({ length: bucketCount }, () => []),
    displayIndexes: params.displayIndexes,
    width: params.width,
    height: params.height,
    stepIndex: 0,
    description: "初始状态",
    mainStateTags: new Map(),
    bucketStateTags: new Map(),
    globalMaxValue: Math.max(...params.originalValues, 1),
    scatteredIndices: new Set(),
  });
}

export function buildBucketTimeline(params: {
  steps: SemanticStep[];
  originalValues: number[];
  displayIndexes: number[];
  width: number;
  height: number;
}): TimelineStep[] {
  const { steps, originalValues, displayIndexes, width, height } = params;

  const globalMaxValue = Math.max(...originalValues, 1);

  let mainValues = [...originalValues];
  // 桶数与算法层（calcBucketCount）、initialFrame、bucket-layout 完全一致
  const bucketCount = calcBucketCount(originalValues.length);
  let buckets: number[][] = Array.from({ length: bucketCount }, () => []);
  const scatteredIndices = new Set<number>();

  return steps.map((semantic, index) => {
    const { mainStateTags, bucketStateTags } = buildBucketTags(semantic);

    // 确定当前活跃桶（scatter/gather 时高亮对应桶）
    const activeBucketIndex =
      (semantic.type === "bucket-scatter" || semantic.type === "bucket-gather" ||
       semantic.type === "bucket-compare" || semantic.type === "bucket-swap")
        ? semantic.bucketIndex
        : undefined;

    // scatter 步骤：在创建 from 帧之前就把 sourceIndex 加入 scatteredIndices，
    // 让源元素在 from 帧就隐藏，实现"元素立即消失，ghost 接替飞行"的效果
    if (semantic.type === "bucket-scatter") {
      const sourceIndex = semantic.indices[0];
      if (typeof sourceIndex === "number") {
        scatteredIndices.add(sourceIndex);
      }
    }

    const from = createBucketFrame({
      mainValues,
      buckets,
      displayIndexes,
      width,
      height,
      stepIndex: index,
      description: semantic.description,
      mainStateTags,
      bucketStateTags,
      semantic,
      frameRole: "from",
      activeBucketIndex,
      globalMaxValue,
      ghostStepIndex: index,
      scatteredIndices,
    });

    if (semantic.type === "bucket-scatter") {
      const sourceIndex = semantic.indices[0];
      const bucketIndex = semantic.bucketIndex ?? 0;
      if (typeof sourceIndex === "number") {
        // 结构共享：仅复制被追加的目标桶，其余桶引用不变（createBucketFrame 只读 buckets）
        buckets = buckets.map((bucket, i) =>
          i === bucketIndex ? [...bucket, mainValues[sourceIndex]] : bucket,
        );
      }
    }

    if (semantic.type === "bucket-swap") {
      const bucketIndex = semantic.bucketIndex ?? 0;
      const [left, right] = semantic.indices;
      if (buckets[bucketIndex]?.[left] !== undefined && buckets[bucketIndex]?.[right] !== undefined) {
        // 结构共享：仅重建被交换的桶，其余桶引用不变
        buckets = buckets.map((bucket, i) => {
          if (i !== bucketIndex) return bucket;
          const next = [...bucket];
          [next[left], next[right]] = [next[right], next[left]];
          return next;
        });
      }
    }

    if (semantic.type === "bucket-gather" && semantic.arraySnapshot) {
      const bucketIndex = semantic.bucketIndex ?? 0;
      const destIndex = semantic.indices[0];
      mainValues = [...semantic.arraySnapshot];
      buckets = buckets.map((bucket, index2) => (index2 === bucketIndex ? bucket.slice(1) : bucket));
      if (typeof destIndex === "number") scatteredIndices.delete(destIndex);
    }

    if (semantic.type === "sorted" && semantic.arraySnapshot) {
      mainValues = [...semantic.arraySnapshot];
    }

    const to = createBucketFrame({
      mainValues,
      buckets,
      displayIndexes,
      width,
      height,
      stepIndex: index + 1,
      description: semantic.description,
      mainStateTags,
      bucketStateTags,
      semantic,
      frameRole: "to",
      activeBucketIndex,
      globalMaxValue,
      ghostStepIndex: index,
      scatteredIndices,
    });

    const movingEntityIds = semantic.type === "bucket-scatter"
      ? [`ghost-scatter-${index}`]
      : semantic.type === "bucket-gather"
        ? [`ghost-gather-${index}`]
        : undefined;
    const swapDuration = 3;
    const flyDuration = 2;
    const isSwap = semantic.type === "bucket-swap";
    const isFly = semantic.type === "bucket-scatter" || semantic.type === "bucket-gather";

    // swap 时构建 swapEntityIdPairs，实现 A↔B 交叉起点平移；bucketIndex 需确认为 number 防止生成无效 ID
    const swapEntityIdPairs: [string, string][] | undefined =
      isSwap && semantic.indices.length >= 2 && typeof semantic.bucketIndex === "number"
        ? [[
            `bucket-${semantic.bucketIndex}-${semantic.indices[0]}`,
            `bucket-${semantic.bucketIndex}-${semantic.indices[1]}`,
          ]]
        : undefined;

    return {
      id: `bucket-${index + 1}`,
      kind: semantic.type,
      description: semantic.description,
      duration: isFly ? flyDuration : isSwap ? swapDuration : 1,
      from,
      to,
      transition: {
        type: isFly ? "arc" : isSwap ? "linear" : "instant",
        duration: isFly ? flyDuration : isSwap ? swapDuration : 1,
        easing: isFly || isSwap ? "easeInOutCubic" : "linear",
        // swap 不使用 movingEntityIds（linear 模式通过 swapEntityIdPairs 驱动交叉起点）
        movingEntityIds: isSwap ? undefined : movingEntityIds,
        pathParams: { mode: semantic.type === "bucket-gather" ? "vertical-first" : "horizontal-first", curveHeight: 70 },
        // swap 动画过程中保持样式插值，使颜色高亮在飞行期间持续可见
        styleTransition: true,
        // swap 的交叉起点对，触发 interpolate-entity.ts 中的平移对穿逻辑
        swapEntityIdPairs,
      },
      statsDelta: {
        comparisons: semantic.type === "bucket-compare" ? 1 : 0,
        swaps: semantic.type === "bucket-swap" ? 1 : 0,
      },
      semanticRef: semantic,
    };
  });
}
