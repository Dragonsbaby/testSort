import type { FrameState, RenderableEntity, RenderableOverlay, StateTag, TimelineStep, SemanticStep } from "@/types/timeline";
import { buildMergeLayout } from "@/utils/layout/merge-layout";
import { getStyleFromStateTags } from "@/utils/frame/style-utils";

const MAIN_BASE_STYLE = { fill: "#4a9eff", glow: 0 };
const BUFFER_BASE_STYLE = { fill: "#4ecdc4", glow: 0.2 };
const GHOST_BASE_STYLE = { fill: "rgba(74, 158, 255, 0.18)", stroke: "rgba(74, 158, 255, 0.45)", text: "#9fc9ff", dashed: true, alpha: 0.75 };

function buildStateTags(
  semantic: SemanticStep,
  previousSorted: Set<number>,
): {
  mainStateTags: Map<number, StateTag[]>;
  bufferStateTags: Map<number, StateTag[]>;
  nextSorted: Set<number>;
} {
  const nextSorted = new Set(previousSorted);
  const mainStateTags = new Map<number, StateTag[]>();
  const bufferStateTags = new Map<number, StateTag[]>();

  if (semantic.type === "sorted") {
    semantic.indices.forEach((index) => nextSorted.add(index));
  }

  nextSorted.forEach((index) => {
    mainStateTags.set(index, ["sorted"]);
  });

  if (semantic.groupIndices?.length) {
    semantic.groupIndices.forEach((index) => {
      if (!mainStateTags.has(index)) {
        mainStateTags.set(index, ["pending"]);
      }
    });
  }

  if (semantic.type === "compare") {
    semantic.indices.forEach((index) => {
      mainStateTags.set(index, ["comparing"]);
    });
  }

  if (semantic.type === "merge-set") {
    const [sourceIndex, destIndex] = semantic.indices;
    if (typeof sourceIndex === "number") {
      mainStateTags.set(sourceIndex, ["comparing"]);
    }
    if (typeof destIndex === "number") {
      bufferStateTags.set(destIndex, ["latest"]);
    }
  }

  return {
    mainStateTags,
    bufferStateTags,
    nextSorted,
  };
}

function buildMergeOverlays(width: number, dividerY: number): RenderableOverlay[] {
  return [
    {
      id: "merge-main-label",
      kind: "label",
      points: [{ x: 58, y: 18 }],
      text: "主数组区",
      style: { fill: "#74b6ff", text: "#74b6ff", alpha: 0.9 },
    },
    {
      id: "merge-buffer-label",
      kind: "label",
      points: [{ x: 58, y: dividerY + 28 }],
      text: "缓冲区",
      style: { fill: "#62e0d5", text: "#62e0d5", alpha: 0.9 },
    },
    {
      id: "merge-divider",
      kind: "divider",
      points: [
        { x: 0, y: dividerY },
        { x: width, y: dividerY },
      ],
      style: { fill: "rgba(78, 205, 196, 0.45)", stroke: "rgba(78, 205, 196, 0.45)", dashed: true },
    },
  ];
}

function createMergeFrame(params: {
  values: number[];
  bufferValues: Array<number | null>;
  displayIndexes: number[];
  width: number;
  height: number;
  stepIndex: number;
  description: string;
  mainStateTags: Map<number, StateTag[]>;
  bufferStateTags: Map<number, StateTag[]>;
  semantic?: SemanticStep;
}): FrameState {
  const {
    values,
    bufferValues,
    displayIndexes,
    width,
    height,
    stepIndex,
    description,
    mainStateTags,
    bufferStateTags,
    semantic,
  } = params;

  const layout = buildMergeLayout(width, height, values.length);
  const maxValue = Math.max(...values, 1);

  const mainEntities: RenderableEntity[] = values.map((value, index) => {
    const stateTags = mainStateTags.get(index) ?? [];
    return {
      id: `main-${index}`,
      sourceId: `value-${displayIndexes[index]}`,
      kind: "main-bar",
      value,
      displayIndex: displayIndexes[index],
      x: layout.topSlots[index]?.x ?? 0,
      y: layout.topSlots[index]?.y ?? 0,
      width: layout.topSlots[index]?.width ?? 0,
      height: Math.max(5, Math.round((value / maxValue) * (layout.topSlots[index]?.maxHeight ?? 0))),
      opacity: 1,
      zIndex: 1,
      style: getStyleFromStateTags(stateTags, MAIN_BASE_STYLE),
      stateTags,
    };
  });

  const bufferEntities: RenderableEntity[] = bufferValues.flatMap((value, index) => {
    if (value === null) return [];

    const stateTags = bufferStateTags.get(index) ?? [];
    return [{
      id: `buffer-${index}`,
      sourceId: `buffer-${index}`,
      kind: "buffer-bar",
      value,
      displayIndex: index + 1,
      x: layout.bottomSlots[index]?.x ?? 0,
      y: layout.bottomSlots[index]?.y ?? 0,
      width: layout.bottomSlots[index]?.width ?? 0,
      height: Math.max(5, Math.round((value / maxValue) * (layout.bottomSlots[index]?.maxHeight ?? 0))),
      opacity: 1,
      zIndex: 2,
      style: getStyleFromStateTags(stateTags, BUFFER_BASE_STYLE),
      stateTags,
    } satisfies RenderableEntity];
  });

  const ghostEntities: RenderableEntity[] = [];
  if (semantic?.type === "merge-set") {
    const [sourceIndex] = semantic.indices;
    if (typeof sourceIndex === "number") {
      ghostEntities.push({
        ...mainEntities[sourceIndex],
        id: `ghost-${sourceIndex}`,
        kind: "ghost-bar",
        opacity: 0.4,
        zIndex: 0,
        style: GHOST_BASE_STYLE,
        stateTags: [],
      });
    }
  }

  return {
    algorithm: "merge",
    stepIndex,
    progress: 0,
    phase: "paused",
    description,
    entities: [...ghostEntities, ...mainEntities, ...bufferEntities],
    regions: [
      { id: "main", kind: "main", x: 0, y: 0, width, height: layout.dividerY - 18 },
      { id: "buffer", kind: "buffer", x: 0, y: layout.dividerY + 18, width, height: height - layout.dividerY - 18 },
    ],
    overlays: buildMergeOverlays(width, layout.dividerY),
  };
}

export function buildMergeTimeline(params: {
  steps: SemanticStep[];
  originalValues: number[];
  displayIndexes: number[];
  width: number;
  height: number;
  stepDuration: number;
}): TimelineStep[] {
  const { steps, originalValues, displayIndexes, width, height, stepDuration } = params;

  let values = [...originalValues];
  let bufferValues = Array.from<number | null>({ length: originalValues.length }).fill(null);
  let sortedIndices = new Set<number>();
  let currentFrame = createMergeFrame({
    values,
    bufferValues,
    displayIndexes,
    width,
    height,
    stepIndex: 0,
    description: "初始状态",
    mainStateTags: new Map(),
    bufferStateTags: new Map(),
  });

  return steps.map((semantic, index) => {
    const from = structuredClone(currentFrame) as FrameState;
    const { mainStateTags, bufferStateTags, nextSorted } = buildStateTags(semantic, sortedIndices);
    sortedIndices = nextSorted;

    if (semantic.type === "merge-set") {
      const [sourceIndex, destIndex] = semantic.indices;
      if (typeof sourceIndex === "number" && typeof destIndex === "number") {
        bufferValues = [...bufferValues];
        bufferValues[destIndex] = values[sourceIndex] ?? semantic.arraySnapshot?.[sourceIndex] ?? null;
      }
    }

    if (semantic.type === "merge-back" && semantic.arraySnapshot) {
      values = [...semantic.arraySnapshot];
      bufferValues = Array.from<number | null>({ length: originalValues.length }).fill(null);
    }

    if (semantic.type === "sorted" && semantic.arraySnapshot) {
      values = [...semantic.arraySnapshot];
    }

    const to = createMergeFrame({
      values,
      bufferValues,
      displayIndexes,
      width,
      height,
      stepIndex: index + 1,
      description: semantic.description,
      mainStateTags,
      bufferStateTags,
      semantic,
    });

    currentFrame = structuredClone(to) as FrameState;

    const movingEntityIds = semantic.type === "merge-set"
      ? [`main-${semantic.indices[0]}`, `ghost-${semantic.indices[0]}`]
      : semantic.type === "merge-back"
        ? semantic.indices.map((item) => `buffer-${item}`)
        : undefined;

    return {
      id: `merge-${index + 1}`,
      kind: semantic.type,
      description: semantic.description,
      duration: stepDuration,
      from,
      to,
      transition: {
        type: semantic.type === "merge-set" || semantic.type === "merge-back" ? "path" : "instant",
        duration: stepDuration,
        easing: semantic.type === "merge-back" ? "easeInOutCubic" : "linear",
        movingEntityIds,
        pathParams: { mode: semantic.type === "merge-back" ? "vertical-first" : "horizontal-first", curveHeight: 42 },
        styleTransition: true,
      },
      statsDelta: {
        comparisons: semantic.type === "compare" ? 1 : 0,
        swaps: semantic.type === "merge-set" || semantic.type === "merge-back" ? 1 : 0,
      },
      semanticRef: semantic,
    };
  });
}
