import type { FrameState, RenderableEntity, RenderableOverlay, StateTag, SemanticStep, TimelineStep } from "@/types/timeline";
import { buildHeapNodePosition, getArrayAreaHeight } from "@/utils/layout/heap-layout";
import { getStyleFromStateTags } from "@/utils/frame/style-utils";

const TREE_BASE_STYLE = { fill: "#1a3a5c", stroke: "#254e7a", text: "#f0ead8", glow: 0.04 };
const ARRAY_BASE_STYLE = { fill: "#112240", stroke: "#1a3356", text: "#f0ead8", glow: 0.02 };

function getHeapStyle(stateTags: StateTag[], fallback: typeof TREE_BASE_STYLE) {
  const style = getStyleFromStateTags(stateTags, fallback);
  return style.glow ? { ...style, glow: style.glow * 0.45 } : style;
}

function createStateTags(semantic: SemanticStep, previousSorted: Set<number>) {
  const nextSorted = new Set(previousSorted);
  const stateTagsByIndex = new Map<number, StateTag[]>();

  if (semantic.type === "sorted") {
    semantic.indices.forEach((index) => nextSorted.add(index));
  }

  nextSorted.forEach((index) => {
    stateTagsByIndex.set(index, ["sorted"]);
  });

  if (semantic.groupIndices?.length) {
    semantic.groupIndices.forEach((index) => {
      if (!stateTagsByIndex.has(index)) {
        stateTagsByIndex.set(index, ["heap-pending"]);
      }
    });
  }

  if (semantic.type === "compare") {
    semantic.indices.forEach((index) => stateTagsByIndex.set(index, ["comparing"]));
  }

  if (semantic.type === "swap") {
    semantic.indices.forEach((index) => stateTagsByIndex.set(index, ["swapping"]));
  }

  if (semantic.type === "pivot") {
    semantic.indices.forEach((index) => stateTagsByIndex.set(index, ["pivot"]));
  }

  if (semantic.type === "latest") {
    semantic.indices.forEach((index) => stateTagsByIndex.set(index, ["latest"]));
  }

  return { nextSorted, stateTagsByIndex };
}

function createHeapOverlays(count: number, width: number, height: number, isMinHeap: boolean): RenderableOverlay[] {
  const arrayAreaHeight = getArrayAreaHeight(count);
  const dividerY = height - arrayAreaHeight + 10;
  return [
    {
      id: "heap-tree-label",
      kind: "label",
      points: [{ x: 58, y: 18 }],
      text: isMinHeap ? "最小堆视图" : "最大堆视图",
      style: { fill: isMinHeap ? "#62e0d5" : "#74b6ff", text: isMinHeap ? "#62e0d5" : "#74b6ff", alpha: 0.9 },
    },
    {
      id: "heap-array-label",
      kind: "label",
      points: [{ x: 58, y: dividerY + 14 }],
      text: "数组映射区",
      style: { fill: "#74b6ff", text: "#74b6ff", alpha: 0.9 },
    },
    ...Array.from({ length: count }, (_, index) => {
      const childIndexes = [2 * index + 1, 2 * index + 2].filter((childIndex) => childIndex < count);
      const start = buildHeapNodePosition(index, count, width, height);

      return childIndexes.map((childIndex) => ({
        id: `edge-${index}-${childIndex}`,
        kind: "edge" as const,
        points: [start, buildHeapNodePosition(childIndex, count, width, height)],
        style: { fill: "rgba(255,255,255,0.08)", stroke: "rgba(255,255,255,0.08)" },
      }));
    }).flat(),
    {
      id: "heap-divider",
      kind: "divider",
      points: [
        { x: 20, y: dividerY },
        { x: width - 20, y: dividerY },
      ],
      style: { fill: "rgba(74,158,255,0.15)", stroke: "rgba(74,158,255,0.15)", dashed: true },
    },
  ];
}

function createHeapFrame(params: {
  values: number[];
  displayIndexes: number[];
  width: number;
  height: number;
  stepIndex: number;
  description: string;
  stateTagsByIndex: Map<number, StateTag[]>;
  isMinHeap: boolean;
}): FrameState {
  const { values, displayIndexes, width, height, stepIndex, description, stateTagsByIndex, isMinHeap } = params;
  const availableWidth = width - 80;
  const n = Math.max(values.length, 1);
  const arrayAreaHeight = getArrayAreaHeight(n);

  // 单行自适应：slot 均分可用宽度，节点尺寸最小 3px
  const slotWidth = Math.floor(availableWidth / n);
  const arrayRadius = Math.min(14, Math.max(3, Math.floor(slotWidth * 0.8 / 2)));
  const arrayGap = Math.max(1, slotWidth - arrayRadius * 2);
  const rowWidth = n * (arrayRadius * 2) + Math.max(n - 1, 0) * arrayGap;
  const row0StartX = Math.max(40, Math.round((width - rowWidth) / 2));
  const row0Y = height - arrayAreaHeight + Math.floor(arrayAreaHeight / 2);
  const maxDepth = Math.floor(Math.log2(Math.max(values.length, 1)));
  const bottomLevelCount = Math.pow(2, maxDepth);
  const treeRadius = Math.max(10, Math.min(14, Math.floor((width - 80) / bottomLevelCount / 2) - 1));

  const treeEntities: RenderableEntity[] = values.map((value, index) => {
    const stateTags = stateTagsByIndex.get(index) ?? [];
    const position = buildHeapNodePosition(index, values.length, width, height);

    return {
      id: `tree-${index}`,
      sourceId: `value-${displayIndexes[index]}`,
      kind: "heap-tree-node",
      value,
      displayIndex: displayIndexes[index],
      x: position.x,
      y: position.y,
      width: treeRadius * 2,
      height: treeRadius * 2,
      opacity: 1,
      zIndex: 2,
      style: getHeapStyle(stateTags, TREE_BASE_STYLE),
      stateTags,
    };
  });

  const arrayEntities: RenderableEntity[] = values.map((value, index) => {
    const stateTags = stateTagsByIndex.get(index) ?? [];
    return {
      id: `array-${index}`,
      sourceId: `value-${displayIndexes[index]}`,
      kind: "heap-array-node",
      value,
      displayIndex: displayIndexes[index],
      x: row0StartX + index * (arrayRadius * 2 + arrayGap) + arrayRadius,
      y: row0Y,
      width: arrayRadius * 2,
      height: arrayRadius * 2,
      opacity: 1,
      zIndex: 3,
      style: getHeapStyle(stateTags, ARRAY_BASE_STYLE),
      stateTags,
    };
  });

  return {
    algorithm: "heap",
    stepIndex,
    progress: 0,
    phase: "paused",
    description,
    entities: [...treeEntities, ...arrayEntities],
    regions: [
      { id: "heap-tree", kind: "heap-tree", x: 0, y: 0, width, height: height - arrayAreaHeight },
      { id: "heap-array", kind: "heap-array", x: 0, y: height - arrayAreaHeight, width, height: arrayAreaHeight },
    ],
    overlays: createHeapOverlays(values.length, width, height, isMinHeap),
  };
}

export function buildHeapInitialFrame(params: {
  originalValues: number[];
  displayIndexes: number[];
  width: number;
  height: number;
  isMinHeap: boolean;
}): FrameState {
  return createHeapFrame({
    values: params.originalValues,
    displayIndexes: params.displayIndexes,
    width: params.width,
    height: params.height,
    stepIndex: 0,
    description: "初始状态",
    stateTagsByIndex: new Map(),
    isMinHeap: params.isMinHeap,
  });
}

export function buildHeapTimeline(params: {
  steps: SemanticStep[];
  originalValues: number[];
  displayIndexes: number[];
  width: number;
  height: number;
  isMinHeap?: boolean;
}): TimelineStep[] {
  const { steps, originalValues, displayIndexes, width, height, isMinHeap = false } = params;

  let values = [...originalValues];
  let sortedIndices = new Set<number>();
  let currentFrame = createHeapFrame({
    values,
    displayIndexes,
    width,
    height,
    stepIndex: 0,
    description: "初始状态",
    stateTagsByIndex: new Map(),
    isMinHeap,
  });

  return steps.map((semantic, index) => {
    const from = currentFrame as FrameState;
    const { nextSorted, stateTagsByIndex } = createStateTags(semantic, sortedIndices);
    sortedIndices = nextSorted;

    if ((semantic.type === "swap" || semantic.type === "set" || semantic.type === "merge") && semantic.arraySnapshot) {
      values = [...semantic.arraySnapshot];
    }

    if (semantic.type === "sorted" && semantic.arraySnapshot) {
      values = [...semantic.arraySnapshot];
    }

    const to = createHeapFrame({
      values,
      displayIndexes,
      width,
      height,
      stepIndex: index + 1,
      description: semantic.description,
      stateTagsByIndex,
      isMinHeap,
    });

    if (semantic.type === "compare" && semantic.indices.length === 2) {
      const [a, b] = semantic.indices;
      const isParentChild = b === 2 * a + 1 || b === 2 * a + 2 || a === 2 * b + 1 || a === 2 * b + 2;
      if (!isParentChild) {
        const posA = buildHeapNodePosition(a, values.length, width, height);
        const posB = buildHeapNodePosition(b, values.length, width, height);
        to.overlays.push({
          id: `compare-edge-${index}`,
          kind: "guide",
          points: [posA, posB],
          style: { fill: "#ffd43b", stroke: "#ffd43b", dashed: true, alpha: 0.85, glow: 0.4 },
        });
      }
    }

    // to 是当步新建的独立对象（compare 的 overlay push 在此前已完成），直接引用无需深拷贝
    currentFrame = to;

    const isRootExtractSwap = semantic.type === "swap" && semantic.indices.includes(0) && Math.abs(semantic.indices[0] - semantic.indices[1]) > 1;
    const swapDuration = 3;
    const compareDuration = 2;

    const swapEntityIdPairs: [string, string][] | undefined = semantic.type === "swap"
      ? [
          [`tree-${semantic.indices[0]}`, `tree-${semantic.indices[1]}`],
          [`array-${semantic.indices[0]}`, `array-${semantic.indices[1]}`],
        ]
      : undefined;

    return {
      id: `heap-${index + 1}`,
      kind: semantic.type,
      description: semantic.description,
      duration: semantic.type === "swap" ? swapDuration : semantic.type === "compare" ? compareDuration : 1,
      from,
      to,
      transition: {
        type: semantic.type === "swap" ? (isRootExtractSwap ? "arc" : "linear") : "instant",
        duration: semantic.type === "swap" ? swapDuration : semantic.type === "compare" ? compareDuration : 1,
        easing: semantic.type === "swap" ? "easeOutCubic" : "linear",
        swapEntityIdPairs,
        styleTransition: true,
      },
      statsDelta: {
        comparisons: semantic.type === "compare" ? 1 : 0,
        swaps: semantic.type === "swap" ? 1 : 0,
      },
      semanticRef: semantic,
    };
  });
}
