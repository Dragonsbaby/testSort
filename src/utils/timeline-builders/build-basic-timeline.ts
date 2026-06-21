import type { FrameState, RenderableEntity, SemanticStep, TimelineStep } from "@/types/timeline";
import { BASIC_LAYOUT_LABEL_OFFSET, buildBasicLayout } from "@/utils/layout/basic-layout";
import { BAR_BASE_STYLE, getStyleFromStateTags } from "@/utils/frame/style-utils";
import { buildStateTagsFromSemantic } from "./state-tags";
import { TIMING } from "./timing-presets";

type BasicAlgorithm = "bubble" | "insertion" | "quick" | "shell";

function createBasicFrame(
  algorithm: BasicAlgorithm,
  values: number[],
  displayIndexes: number[],
  width: number,
  height: number,
  stepIndex: number,
  description: string,
  stateTagsByIndex: Map<number, RenderableEntity["stateTags"]>,
): FrameState {
  const slots = buildBasicLayout({ width, height, count: values.length });
  const baseY = slots[0]?.y ?? height;
  const maxValue = Math.max(...values, 1);

  const entities: RenderableEntity[] = values.map((value, index) => {
    const stateTags = stateTagsByIndex.get(index) ?? [];
    const style = getStyleFromStateTags(stateTags, BAR_BASE_STYLE);

    return {
      id: `main-${displayIndexes[index]}`,
      sourceId: `value-${displayIndexes[index]}`,
      kind: "main-bar",
      value,
      displayIndex: displayIndexes[index],
      x: slots[index]?.x ?? 0,
      y: slots[index]?.y ?? 0,
      width: slots[index]?.width ?? 0,
      height: Math.max(5, Math.round((value / maxValue) * (slots[index]?.maxHeight ?? 0))),
      opacity: 1,
      zIndex: 1,
      style,
      stateTags,
    };
  });

  return {
    algorithm,
    stepIndex,
    progress: 0,
    phase: "paused",
    description,
    entities,
    regions: [{
      id: "main",
      kind: "main",
      x: 0,
      y: 0,
      width,
      height,
      meta: {
        baseY,
        labelOffset: BASIC_LAYOUT_LABEL_OFFSET,
      },
    }],
    overlays: [],
  };
}

function applyArraySnapshot(values: number[], semantic: SemanticStep) {
  if (!semantic.arraySnapshot) return values;
  return [...semantic.arraySnapshot];
}

export function buildBasicInitialFrame(params: {
  algorithm: BasicAlgorithm;
  originalValues: number[];
  displayIndexes: number[];
  width: number;
  height: number;
}): FrameState {
  return createBasicFrame(params.algorithm, params.originalValues, params.displayIndexes, params.width, params.height, 0, "初始状态", new Map());
}

export function buildBasicTimeline(params: {
  algorithm: BasicAlgorithm;
  steps: SemanticStep[];
  originalValues: number[];
  displayIndexes: number[];
  width: number;
  height: number;
}): TimelineStep[] {
  const { algorithm, steps, originalValues, width, height } = params;

  let values = [...originalValues];
  let displayIndexes = [...params.displayIndexes];
  let sortedIndices = new Set<number>();
  let currentFrame = createBasicFrame(algorithm, values, displayIndexes, width, height, 0, "初始状态", new Map());

  return steps.map((semantic, index) => {
    // from 直接引用上一步的 to（createBasicFrame 每步返回独立新对象，引用共享安全；插值/渲染只读不 mutate）
    const from = currentFrame;
    const { nextSorted, stateTagsByIndex } = buildStateTagsFromSemantic(semantic, sortedIndices, { pendingTag: "pending" });
    sortedIndices = nextSorted;

    if (semantic.type === "swap") {
      displayIndexes = semantic.indices.reduce((nextDisplayIndexes, index, currentIndex, indices) => {
        const pairIndex = indices[currentIndex === 0 ? 1 : 0];
        nextDisplayIndexes[index] = displayIndexes[pairIndex];
        return nextDisplayIndexes;
      }, [...displayIndexes]);
    }

    if (semantic.type === "swap" || semantic.type === "set" || semantic.type === "merge" || semantic.type === "sorted") {
      values = applyArraySnapshot(values, semantic);
    }

    const to = createBasicFrame(
      algorithm,
      values,
      displayIndexes,
      width,
      height,
      index + 1,
      semantic.description,
      stateTagsByIndex,
    );

    // to 是当步新建的独立对象，直接引用即可（无需深拷贝）
    currentFrame = to;

    const swapDuration = TIMING.swap;

    return {
      id: `basic-${algorithm}-${index + 1}`,
      kind: semantic.type,
      description: semantic.description,
      duration: semantic.type === "swap" ? swapDuration : 1,
      from,
      to,
      transition: {
        type: semantic.type === "swap" ? "linear" : "instant",
        duration: semantic.type === "swap" ? swapDuration : 1,
        easing: semantic.type === "swap" ? "easeInOutCubic" : "linear",
        movingEntityIds: undefined,
        swapEntityIdPairs: undefined,
        styleTransition: semantic.type !== "swap",
      },
      statsDelta: {
        comparisons: semantic.type === "compare" ? 1 : 0,
        swaps: semantic.type === "swap" || semantic.type === "set" || semantic.type === "merge" ? 1 : 0,
      },
      semanticRef: semantic,
    };
  });
}
