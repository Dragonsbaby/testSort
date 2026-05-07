import type { FrameState, RenderableEntity, RenderableOverlay, RenderableRegion, StateTag, TimelineStep, SemanticStep } from "@/types/timeline";
import { buildBucketLayout, BUCKET_INNER_PADDING_TOP, BUCKET_INNER_PADDING_BOT, BUCKET_INNER_PADDING_X } from "@/utils/layout/bucket-layout";
import { getStyleFromStateTags } from "@/utils/frame/style-utils";
import { getBucketTheme } from "@/utils/frame/bucket-palette";

const MAIN_BASE_STYLE = { fill: "#4a9eff", glow: 0 };
const GHOST_BASE_STYLE = { fill: "rgba(78, 205, 196, 0.25)", stroke: "rgba(78, 205, 196, 0.55)", text: "#9ff3ea", dashed: true, alpha: 0.8 };

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

function getBucketRangeLabel(bucketIndex: number, bucketCount: number) {
  const start = Math.round((bucketIndex / bucketCount) * 100);
  const end = Math.round(((bucketIndex + 1) / bucketCount) * 100);
  return `${start}%–${end}%`;
}

function buildBucketOverlays(
  layout: ReturnType<typeof buildBucketLayout>,
  width: number,
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

  // 分隔带居中文字
  overlays.push({
    id: "bucket-separator-label",
    kind: "label",
    points: [{ x: width / 2, y: layout.mainHeight + Math.round(layout.separatorHeight / 2) }],
    text: "▼  分  桶  区",
    style: { fill: "rgba(78, 205, 196, 0.7)", text: "rgba(78, 205, 196, 0.7)", alpha: 0.9 },
  });

  // 每个桶的 region-panel + 标题 + 值域 + 计数徽章
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
      text: `Bucket ${bucketIndex}`,
      style: { fill: theme.border, text: theme.border, alpha: 0.95 },
    });

    // 值域范围标签（y+28，颜色柔和）
    overlays.push({
      id: `bucket-range-${bucketIndex}`,
      kind: "guide",
      points: [{ x: region.x + region.width / 2, y: region.y + 28 }],
      text: getBucketRangeLabel(bucketIndex, layout.bucketCount),
      style: { fill: "rgba(186, 242, 255, 0.75)", text: "rgba(186, 242, 255, 0.75)", alpha: 0.8 },
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

  // 虚线分隔线
  overlays.push({
    id: "bucket-divider",
    kind: "divider",
    points: [
      { x: 18, y: layout.mainHeight + Math.round(layout.separatorHeight / 2) },
      { x: width - 18, y: layout.mainHeight + Math.round(layout.separatorHeight / 2) },
    ],
    style: { fill: "rgba(78, 205, 196, 0.2)", stroke: "rgba(78, 205, 196, 0.2)", dashed: true },
  });

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
  bucketFinalMaxMap?: Map<number, number>;
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
    bucketFinalMaxMap,
  } = params;
  const layout = buildBucketLayout(width, height, mainValues.length);
  const maxValue = Math.max(...mainValues, 1);
  const mainBarWidth = Math.min(40, Math.max(10, Math.floor((width - 80) / Math.max(mainValues.length, 1)) - 4));
  const mainGap = 4;
  const mainTotalWidth = mainValues.length * mainBarWidth + Math.max(mainValues.length - 1, 0) * mainGap;
  const mainStartX = Math.max(20, Math.round((width - mainTotalWidth) / 2));

  const mainEntities: RenderableEntity[] = mainValues.map((value, index) => {
    const stateTags = mainStateTags.get(index) ?? [];
    return {
      id: `main-${index}`,
      sourceId: `value-${displayIndexes[index]}`,
      kind: "main-bar",
      value,
      displayIndex: displayIndexes[index],
      x: mainStartX + index * (mainBarWidth + mainGap),
      y: layout.mainHeight - 22,
      width: mainBarWidth,
      height: Math.max(6, Math.round((value / maxValue) * (layout.mainHeight - 52))),
      opacity: 1,
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
    const barGap = bucket.length > 1 ? Math.max(2, Math.min(6, Math.floor((innerWidth - bucket.length * 10) / (bucket.length - 1 || 1)))) : 0;
    const barWidth = bucket.length > 0
      ? Math.max(6, Math.min(20, Math.floor((innerWidth - barGap * Math.max(bucket.length - 1, 0)) / bucket.length)))
      : 12;

    // 桶内柱子底部基准 Y（从桶底部向上留出 BUCKET_INNER_PADDING_BOT）
    const barBaseY = region.y + region.height - BUCKET_INNER_PADDING_BOT;

    // 用该桶历史最终最大值归一化，保证高度稳定不随帧跳变；无预计算值时回退到全局 maxValue
    const bucketMax = bucketFinalMaxMap?.get(bucketIndex) ?? maxValue;

    // 水平越界上限，防止柱子画出桶右边界；至少保留第一根柱子的起始位置
    const xMax = Math.max(
      region.x + BUCKET_INNER_PADDING_X,
      region.x + region.width - BUCKET_INNER_PADDING_X - barWidth,
    );

    const bucketBaseStyle = getBucketBarStyle(bucketIndex);

    return bucket.map((value, position) => {
      const stateTags = bucketStateTags.get(`${bucketIndex}-${position}`) ?? [];
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
        opacity: 1,
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
    const target = typeof bucketIndex === "number" && typeof bucketPos === "number"
      ? bucketEntities.find((entity) => entity.id === `bucket-${bucketIndex}-${bucketPos}`)
      : null;

    if (source && target) {
      ghostEntities.push({
        ...(frameRole === "from" ? source : target),
        id: `ghost-scatter-${stepIndex}`,
        sourceId: source.sourceId,
        kind: "ghost-bar",
        opacity: frameRole === "from" ? 0.95 : 0.35,
        zIndex: 3,
        style: GHOST_BASE_STYLE,
        stateTags: [],
      });
    }
  }

  if (semantic?.type === "bucket-gather") {
    const [destIndex] = semantic.indices;
    const bucketIndex = semantic.bucketIndex;
    const source = typeof bucketIndex === "number"
      ? bucketEntities.find((entity) => entity.id === `bucket-${bucketIndex}-0`)
      : null;
    const target = typeof destIndex === "number" ? mainEntities[destIndex] : null;

    if (source && target) {
      ghostEntities.push({
        ...(frameRole === "from" ? source : target),
        id: `ghost-gather-${stepIndex}`,
        sourceId: source.sourceId,
        kind: "ghost-bar",
        opacity: frameRole === "from" ? 0.95 : 0.35,
        zIndex: 3,
        style: GHOST_BASE_STYLE,
        stateTags: [],
      });
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

export function buildBucketTimeline(params: {
  steps: SemanticStep[];
  originalValues: number[];
  displayIndexes: number[];
  width: number;
  height: number;
  stepDuration: number;
}): TimelineStep[] {
  const { steps, originalValues, displayIndexes, width, height, stepDuration } = params;

  // 预计算每个桶在整个排序过程中会接收到的最大值
  // 用于 createBucketFrame 中桶内高度归一化，避免当前帧动态最大值导致柱高跳变
  const bucketFinalMaxMap = new Map<number, number>();
  for (const step of steps) {
    if (step.type === "bucket-scatter" && typeof step.bucketIndex === "number") {
      const sourceIndex = step.indices[0];
      if (typeof sourceIndex === "number") {
        const val = originalValues[sourceIndex];
        const prev = bucketFinalMaxMap.get(step.bucketIndex) ?? 0;
        if (val > prev) bucketFinalMaxMap.set(step.bucketIndex, val);
      }
    }
  }

  let mainValues = [...originalValues];
  let buckets: number[][] = Array.from({ length: Math.max(steps.reduce((max, step) => Math.max(max, step.bucketIndex ?? -1), -1) + 1, 3) }, () => []);

  return steps.map((semantic, index) => {
    const { mainStateTags, bucketStateTags } = buildBucketTags(semantic);

    // 确定当前活跃桶（scatter/gather 时高亮对应桶）
    const activeBucketIndex =
      (semantic.type === "bucket-scatter" || semantic.type === "bucket-gather" ||
       semantic.type === "bucket-compare" || semantic.type === "bucket-swap")
        ? semantic.bucketIndex
        : undefined;

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
      bucketFinalMaxMap,
    });

    if (semantic.type === "bucket-scatter") {
      const sourceIndex = semantic.indices[0];
      const bucketIndex = semantic.bucketIndex ?? 0;
      if (typeof sourceIndex === "number") {
        buckets = buckets.map((bucket) => [...bucket]);
        buckets[bucketIndex] ??= [];
        buckets[bucketIndex].push(mainValues[sourceIndex]);
      }
    }

    if (semantic.type === "bucket-swap") {
      const bucketIndex = semantic.bucketIndex ?? 0;
      const [left, right] = semantic.indices;
      if (buckets[bucketIndex]?.[left] !== undefined && buckets[bucketIndex]?.[right] !== undefined) {
        buckets = buckets.map((bucket) => [...bucket]);
        [buckets[bucketIndex][left], buckets[bucketIndex][right]] = [buckets[bucketIndex][right], buckets[bucketIndex][left]];
      }
    }

    if (semantic.type === "bucket-gather" && semantic.arraySnapshot) {
      const bucketIndex = semantic.bucketIndex ?? 0;
      mainValues = [...semantic.arraySnapshot];
      buckets = buckets.map((bucket, index2) => (index2 === bucketIndex ? bucket.slice(1) : [...bucket]));
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
      bucketFinalMaxMap,
    });

    const movingEntityIds = semantic.type === "bucket-scatter"
      ? [`ghost-scatter-${index}`]
      : semantic.type === "bucket-gather"
        ? [`ghost-gather-${index}`]
        : undefined;
    const swapDuration = stepDuration * 3;
    const isSwap = semantic.type === "bucket-swap";

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
      duration: isSwap ? swapDuration : stepDuration,
      from,
      to,
      transition: {
        // swap 改用 linear 平移（不再是 arc 弧跳）；scatter/gather 保留 arc 路径动画
        type: semantic.type === "bucket-scatter" || semantic.type === "bucket-gather" ? "arc" : isSwap ? "linear" : "instant",
        duration: isSwap ? swapDuration : stepDuration,
        easing: semantic.type === "bucket-scatter" || semantic.type === "bucket-gather" || isSwap ? "easeInOutCubic" : "linear",
        // swap 不使用 movingEntityIds（linear 模式通过 swapEntityIdPairs 驱动交叉起点）
        movingEntityIds: isSwap ? undefined : movingEntityIds,
        pathParams: { mode: semantic.type === "bucket-gather" ? "vertical-first" : "horizontal-first", curveHeight: 40 },
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
