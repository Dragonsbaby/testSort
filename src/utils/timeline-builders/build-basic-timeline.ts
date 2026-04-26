import type { FrameState, RenderableEntity, SemanticStep, TimelineStep } from "@/types/timeline";
import { buildBasicLayout } from "@/utils/layout/basic-layout";
import { getStyleFromStateTags } from "@/utils/frame/style-utils";

const BASE_STYLE = { fill: "#4a9eff", glow: 0 };

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
  const maxValue = Math.max(...values, 1);

  const entities: RenderableEntity[] = values.map((value, index) => {
    const stateTags = stateTagsByIndex.get(index) ?? [];
    const style = getStyleFromStateTags(stateTags, BASE_STYLE);

    return {
      id: `main-${index}`,
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
    regions: [{ id: "main", kind: "main", x: 0, y: 0, width, height }],
    overlays: [],
  };
}

function buildStateTags(semantic: SemanticStep, previousSorted: Set<number>) {
  const nextSorted = new Set(previousSorted);
  const stateTagsByIndex = new Map<number, RenderableEntity["stateTags"]>();

  if (semantic.type === "sorted") {
    semantic.indices.forEach((index) => nextSorted.add(index));
  }

  nextSorted.forEach((index) => {
    stateTagsByIndex.set(index, ["sorted"]);
  });

  if (semantic.type === "compare") {
    semantic.indices.forEach((index) => stateTagsByIndex.set(index, ["comparing"]));
  }

  if (semantic.type === "swap") {
    semantic.indices.forEach((index) => stateTagsByIndex.set(index, ["swapping"]));
  }

  if (semantic.type === "pivot") {
    semantic.indices.forEach((index) => stateTagsByIndex.set(index, ["pivot"]));
  }

  if (semantic.groupIndices?.length) {
    semantic.groupIndices.forEach((index) => {
      if (!stateTagsByIndex.has(index)) {
        stateTagsByIndex.set(index, ["pending"]);
      }
    });
  }

  return { nextSorted, stateTagsByIndex };
}

function applyArraySnapshot(values: number[], semantic: SemanticStep) {
  if (!semantic.arraySnapshot) return values;
  return [...semantic.arraySnapshot];
}

export function buildBasicTimeline(params: {
  algorithm: BasicAlgorithm;
  steps: SemanticStep[];
  originalValues: number[];
  displayIndexes: number[];
  width: number;
  height: number;
  stepDuration: number;
}): TimelineStep[] {
  const { algorithm, steps, originalValues, displayIndexes, width, height, stepDuration } = params;

  let values = [...originalValues];
  let sortedIndices = new Set<number>();
  let currentFrame = createBasicFrame(algorithm, values, displayIndexes, width, height, 0, "初始状态", new Map());

  return steps.map((semantic, index) => {
    const from = structuredClone(currentFrame) as FrameState;
    const { nextSorted, stateTagsByIndex } = buildStateTags(semantic, sortedIndices);
    sortedIndices = nextSorted;

    if (semantic.type === "swap" || semantic.type === "set" || semantic.type === "merge") {
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

    currentFrame = structuredClone(to) as FrameState;

    return {
      id: `basic-${algorithm}-${index + 1}`,
      kind: semantic.type,
      description: semantic.description,
      duration: stepDuration,
      from,
      to,
      transition: {
        type: semantic.type === "swap" ? "arc" : "instant",
        duration: stepDuration,
        easing: semantic.type === "swap" ? "easeOutCubic" : "linear",
        movingEntityIds: semantic.type === "swap" ? semantic.indices.map((item) => `main-${item}`) : undefined,
        styleTransition: true,
      },
      statsDelta: {
        comparisons: semantic.type === "compare" ? 1 : 0,
        swaps: semantic.type === "swap" || semantic.type === "set" || semantic.type === "merge" ? 1 : 0,
      },
      semanticRef: semantic,
    };
  });
}
