import type { FrameState, RenderableEntity, RenderableOverlay, RenderableRegion, StateTag, TimelineStep, SemanticStep } from "@/types/timeline";
import { buildBucketLayout } from "@/utils/layout/bucket-layout";
import { getStyleFromStateTags } from "@/utils/frame/style-utils";

const MAIN_BASE_STYLE = { fill: "#4a9eff", glow: 0 };
const BUCKET_BASE_STYLE = { fill: "#4ecdc4", glow: 0.2 };
const GHOST_BASE_STYLE = { fill: "rgba(78, 205, 196, 0.25)", stroke: "rgba(78, 205, 196, 0.55)", text: "#9ff3ea", dashed: true, alpha: 0.8 };

type FrameRole = "from" | "to" | "static";

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
  return [
    { id: "main", kind: "main", x: 0, y: 0, width, height: layout.mainHeight },
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

function buildBucketOverlays(layout: ReturnType<typeof buildBucketLayout>, width: number): RenderableOverlay[] {
  return [
    {
      id: "bucket-main-label",
      kind: "label",
      points: [{ x: 64, y: 18 }],
      text: "主数组区",
      style: { fill: "#74b6ff", text: "#74b6ff", alpha: 0.9 },
    },
    ...layout.bucketRegions.flatMap((region) => ([
      {
        id: `bucket-title-${region.bucketIndex}`,
        kind: "label" as const,
        points: [{ x: region.x + region.width / 2, y: region.y + 14 }],
        text: `桶 ${region.bucketIndex}`,
        style: { fill: "#63ddd0", text: "#63ddd0", alpha: 0.95 },
      },
      {
        id: `bucket-badge-${region.bucketIndex}`,
        kind: "badge" as const,
        points: [{ x: region.x + region.width - 22, y: region.y + 14 }],
        text: `${region.bucketIndex + 1}/${layout.bucketCount}`,
        style: { fill: "rgba(78, 205, 196, 0.18)", stroke: "rgba(78, 205, 196, 0.45)", text: "#d7fffb", alpha: 0.95 },
      },
      {
        id: `bucket-range-${region.bucketIndex}`,
        kind: "guide" as const,
        points: [{ x: region.x + region.width / 2, y: region.y + 30 }],
        text: getBucketRangeLabel(region.bucketIndex, layout.bucketCount),
        style: { fill: "rgba(186, 242, 255, 0.9)", text: "rgba(186, 242, 255, 0.9)", alpha: 0.8 },
      },
    ])),
    {
      id: "bucket-divider",
      kind: "divider",
      points: [
        { x: 18, y: layout.mainHeight + Math.round(layout.separatorHeight / 2) },
        { x: width - 18, y: layout.mainHeight + Math.round(layout.separatorHeight / 2) },
      ],
      style: { fill: "rgba(78, 205, 196, 0.2)", stroke: "rgba(78, 205, 196, 0.2)", dashed: true },
    },
  ];
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
    const innerWidth = Math.max(region.width - 20, 20);
    const barGap = bucket.length > 1 ? Math.max(2, Math.min(6, Math.floor((innerWidth - bucket.length * 10) / (bucket.length - 1 || 1)))) : 0;
    const barWidth = bucket.length > 0
      ? Math.max(6, Math.min(20, Math.floor((innerWidth - barGap * Math.max(bucket.length - 1, 0)) / bucket.length)))
      : 12;

    return bucket.map((value, position) => {
      const stateTags = bucketStateTags.get(`${bucketIndex}-${position}`) ?? [];
      return {
        id: `bucket-${bucketIndex}-${position}`,
        sourceId: `bucket-${bucketIndex}-${value}-${position}`,
        kind: "bucket-bar",
        value,
        displayIndex: position + 1,
        x: region.x + 10 + position * (barWidth + barGap),
        y: region.y + region.height - 22,
        width: barWidth,
        height: Math.max(6, Math.round((value / maxValue) * (region.height - 58))),
        opacity: 1,
        zIndex: 2,
        style: getStyleFromStateTags(stateTags, BUCKET_BASE_STYLE),
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
    overlays: buildBucketOverlays(layout, width),
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

  let mainValues = [...originalValues];
  let buckets: number[][] = Array.from({ length: Math.max(steps.reduce((max, step) => Math.max(max, step.bucketIndex ?? -1), -1) + 1, 3) }, () => []);
  let currentFrame = createBucketFrame({
    mainValues,
    buckets,
    displayIndexes,
    width,
    height,
    stepIndex: 0,
    description: "初始状态",
    mainStateTags: new Map(),
    bucketStateTags: new Map(),
  });

  return steps.map((semantic, index) => {
    const { mainStateTags, bucketStateTags } = buildBucketTags(semantic);
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
    });

    currentFrame = structuredClone(to) as FrameState;

    const movingEntityIds = semantic.type === "bucket-scatter"
      ? [`ghost-scatter-${index}`]
      : semantic.type === "bucket-gather"
        ? [`ghost-gather-${index}`]
        : undefined;

    return {
      id: `bucket-${index + 1}`,
      kind: semantic.type,
      description: semantic.description,
      duration: stepDuration,
      from,
      to,
      transition: {
        type: semantic.type === "bucket-scatter" || semantic.type === "bucket-gather" ? "path" : "instant",
        duration: stepDuration,
        easing: "easeInOutCubic",
        movingEntityIds,
        pathParams: { mode: semantic.type === "bucket-gather" ? "vertical-first" : "horizontal-first", curveHeight: 40 },
        styleTransition: true,
      },
      statsDelta: {
        comparisons: semantic.type === "bucket-compare" ? 1 : 0,
        swaps: semantic.type === "bucket-swap" ? 1 : 0,
      },
      semanticRef: semantic,
    };
  });
}
