import type { FrameState, RenderableEntity, RenderableOverlay, StateTag, SemanticStep, TimelineStep } from "@/types/timeline";
import { buildHeapNodePosition, getArrayAreaHeight } from "@/utils/layout/heap-layout";
import { buildStateTagsFromSemantic } from "./state-tags";
import { TIMING } from "./timing-presets";

function createHeapOverlays(count: number, width: number, height: number, isMinHeap: boolean): RenderableOverlay[] {
  const arrayAreaHeight = getArrayAreaHeight(count);
  const dividerY = height - arrayAreaHeight + 10;
  return [
    {
      id: "heap-tree-label",
      kind: "label",
      points: [{ x: 58, y: 18 }],
      text: isMinHeap ? "最小堆视图" : "最大堆视图",
      style: { textColor: "text-secondary", alpha: 0.9 },
    },
    {
      id: "heap-array-label",
      kind: "label",
      points: [{ x: 58, y: dividerY + 14 }],
      text: "数组映射区",
      style: { textColor: "text-secondary", alpha: 0.9 },
    },
    ...Array.from({ length: count }, (_, index) => {
      const childIndexes = [2 * index + 1, 2 * index + 2].filter((childIndex) => childIndex < count);
      const start = buildHeapNodePosition(index, count, width, height);

      return childIndexes.map((childIndex): RenderableOverlay => ({
        id: `edge-${index}-${childIndex}`,
        kind: "edge",
        points: [start, buildHeapNodePosition(childIndex, count, width, height)],
        style: { color: "border" },
      }));
    }).flat(),
    {
      id: "heap-divider",
      kind: "divider",
      points: [
        { x: 20, y: dividerY },
        { x: width - 20, y: dividerY },
      ],
      style: { color: "border", dashed: true },
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
    const { nextSorted, stateTagsByIndex } = buildStateTagsFromSemantic(semantic, sortedIndices, { pendingTag: "heap-pending" });
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
          style: { color: "comparing", dashed: true, alpha: 0.85, glow: 0.4 },
        });
      }
    }

    // to 是当步新建的独立对象（compare 的 overlay push 在此前已完成），直接引用无需深拷贝
    currentFrame = to;

    const isRootExtractSwap = semantic.type === "swap" && semantic.indices.includes(0) && Math.abs(semantic.indices[0] - semantic.indices[1]) > 1;
    const swapDuration = TIMING.swap;
    const compareDuration = TIMING.compare;

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
