import type { FrameState, RenderableEntity, RenderableOverlay, StateTag, SemanticStep, TimelineStep } from "@/types/timeline";
import { buildHeapNodePosition } from "@/utils/layout/heap-layout";
import { getStyleFromStateTags } from "@/utils/frame/style-utils";

const TREE_BASE_STYLE = { fill: "#4a9eff", stroke: "#4a80d0", text: "#c0d8f8", glow: 0.15 };
const ARRAY_BASE_STYLE = { fill: "#1e50a8", stroke: "#4a80d0", text: "#c0d8f8", glow: 0.1 };

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
        stateTagsByIndex.set(index, ["pending"]);
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

  return { nextSorted, stateTagsByIndex };
}

function createHeapOverlays(count: number, width: number, height: number, isMinHeap: boolean): RenderableOverlay[] {
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
      points: [{ x: 58, y: height - 64 }],
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
        { x: 20, y: height - 78 },
        { x: width - 20, y: height - 78 },
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
  const maxValue = Math.max(...values, 1);
  const arrayBottom = height - 26;
  const arrayRadius = Math.max(10, Math.min(14, Math.floor((width - 80) / Math.max(values.length * 2, 2))));
  const arrayGap = 6;
  const totalWidth = values.length * (arrayRadius * 2) + Math.max(values.length - 1, 0) * arrayGap;
  const startX = Math.max(40, Math.round((width - totalWidth) / 2));
  const treeRadius = Math.max(12, Math.min(26, Math.round(Math.min((width - 80) / Math.max(Math.pow(2, Math.floor(Math.log2(Math.max(values.length, 1)))), 1) / 2 - 2, 110 / (Math.floor(Math.log2(Math.max(values.length, 1))) + 1)))));

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
      style: getStyleFromStateTags(stateTags, TREE_BASE_STYLE),
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
      x: startX + index * (arrayRadius * 2 + arrayGap) + arrayRadius,
      y: arrayBottom,
      width: arrayRadius * 2,
      height: arrayRadius * 2,
      opacity: 1,
      zIndex: 3,
      style: getStyleFromStateTags(stateTags, ARRAY_BASE_STYLE),
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
      { id: "heap-tree", kind: "heap-tree", x: 0, y: 0, width, height: height - 88 },
      { id: "heap-array", kind: "heap-array", x: 0, y: height - 88, width, height: 88 },
    ],
    overlays: createHeapOverlays(values.length, width, height, isMinHeap),
  };
}

export function buildHeapTimeline(params: {
  steps: SemanticStep[];
  originalValues: number[];
  displayIndexes: number[];
  width: number;
  height: number;
  stepDuration: number;
  isMinHeap?: boolean;
}): TimelineStep[] {
  const { steps, originalValues, displayIndexes, width, height, stepDuration, isMinHeap = false } = params;

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
    const from = structuredClone(currentFrame) as FrameState;
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

    currentFrame = structuredClone(to) as FrameState;

    const movingEntityIds = semantic.type === "swap"
      ? semantic.indices.flatMap((item) => [`tree-${item}`, `array-${item}`])
      : undefined;
    const isRootExtractSwap = semantic.type === "swap" && semantic.indices.includes(0) && Math.abs(semantic.indices[0] - semantic.indices[1]) > 1;
    const swapDuration = stepDuration * 3;

    return {
      id: `heap-${index + 1}`,
      kind: semantic.type,
      description: semantic.description,
      duration: semantic.type === "swap" ? swapDuration : stepDuration,
      from,
      to,
      transition: {
        type: semantic.type === "swap" ? (isRootExtractSwap ? "arc" : "linear") : "instant",
        duration: semantic.type === "swap" ? swapDuration : stepDuration,
        easing: semantic.type === "swap" ? "easeOutCubic" : "linear",
        movingEntityIds,
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
