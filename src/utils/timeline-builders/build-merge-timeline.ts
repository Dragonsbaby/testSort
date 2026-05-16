import type { FrameState, RenderableEntity, RenderableOverlay, StateTag, TimelineStep, SemanticStep } from "@/types/timeline";
import { buildMergeLayout } from "@/utils/layout/merge-layout";
import { getStyleFromStateTags } from "@/utils/frame/style-utils";

const MAIN_BASE_STYLE = { fill: "#4a9eff", glow: 0 };
const BUFFER_BASE_STYLE = { fill: "#4ecdc4", glow: 0.2 };
type FrameRole = "from" | "to" | "static";

/** 缓冲区条目：同时记录值和元素原始序号，飞行过程中序号跟随元素 */
type BufferEntry = { value: number; displayIndex: number };

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
  bufferValues: Array<BufferEntry | null>;
  displayIndexes: number[];
  width: number;
  height: number;
  stepIndex: number;
  description: string;
  mainStateTags: Map<number, StateTag[]>;
  bufferStateTags: Map<number, StateTag[]>;
  semantic?: SemanticStep;
  frameRole?: FrameRole;
  ghostStepIndex?: number;
  hiddenMainIndices?: Set<number>;
  hiddenBufferIndices?: Set<number>;
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
    frameRole = "static",
    ghostStepIndex,
    hiddenMainIndices,
    hiddenBufferIndices,
  } = params;

  const layout = buildMergeLayout(width, height, values.length);
  const maxValue = Math.max(...values, 1);

  const mainEntities: RenderableEntity[] = values.map((value, index) => {
    const stateTags = mainStateTags.get(index) ?? [];
    const isHidden = hiddenMainIndices?.has(index) ?? false;
    return {
      id: `main-${index}`,
      sourceId: `value-${displayIndexes[index]}`,
      kind: "main-bar",
      value,
      displayIndex: displayIndexes[index],
      x: layout.topSlots[index]?.x ?? 0,
      y: layout.topSlots[index]?.y ?? 0,
      width: isHidden ? 0 : (layout.topSlots[index]?.width ?? 0),
      height: Math.max(5, Math.round((value / maxValue) * (layout.topSlots[index]?.maxHeight ?? 0))),
      opacity: isHidden ? 0 : 1,
      zIndex: 1,
      style: getStyleFromStateTags(stateTags, MAIN_BASE_STYLE),
      stateTags,
    };
  });

  const bufferEntities: RenderableEntity[] = bufferValues.flatMap((entry, index) => {
    if (entry === null) return [];

    const { value, displayIndex } = entry;
    const stateTags = bufferStateTags.get(index) ?? [];
    const isHidden = hiddenBufferIndices?.has(index) ?? false;
    return [{
      id: `buffer-${index}`,
      sourceId: `buffer-${displayIndex}`,
      kind: "buffer-bar",
      value,
      displayIndex,
      x: layout.bottomSlots[index]?.x ?? 0,
      y: layout.bottomSlots[index]?.y ?? 0,
      width: layout.bottomSlots[index]?.width ?? 0,
      height: Math.max(5, Math.round((value / maxValue) * (layout.bottomSlots[index]?.maxHeight ?? 0))),
      opacity: isHidden ? 0 : 1,
      zIndex: 2,
      style: getStyleFromStateTags(stateTags, BUFFER_BASE_STYLE),
      stateTags,
    } satisfies RenderableEntity];
  });

  const ghostEntities: RenderableEntity[] = [];

  // merge-set：主数组元素飞入缓冲区
  if (semantic?.type === "merge-set" && (frameRole === "from" || frameRole === "to")) {
    const [sourceIndex, destIndex] = semantic.indices;
    if (typeof sourceIndex === "number" && typeof destIndex === "number") {
      const sourceMain = mainEntities.find((e) => e.id === `main-${sourceIndex}`);
      const destSlot = layout.bottomSlots[destIndex];

      if (sourceMain && destSlot) {
        const ghostId = `ghost-set-${ghostStepIndex ?? stepIndex}`;
        const ghostHeight = Math.max(5, Math.round((sourceMain.value / maxValue) * (destSlot.maxHeight ?? 0)));

        if (frameRole === "from") {
          // ghost 在主数组源位置，完全覆盖源柱子
          // 注意：不能 spread sourceMain，因为 sourceMain.width 可能为 0（hiddenMainIndices 导致）
          ghostEntities.push({
            id: ghostId,
            sourceId: sourceMain.sourceId,
            kind: "main-bar",
            value: sourceMain.value,
            displayIndex: sourceMain.displayIndex,
            x: sourceMain.x,
            y: sourceMain.y,
            width: layout.topSlots[sourceIndex]?.width ?? sourceMain.width,
            height: ghostHeight,
            opacity: 1,
            zIndex: 3,
            style: BUFFER_BASE_STYLE,
            stateTags: [],
          });
        } else {
          // ghost 到达 buffer 目标位置
          ghostEntities.push({
            ...sourceMain,
            id: ghostId,
            kind: "main-bar",
            x: destSlot.x,
            y: destSlot.y,
            width: destSlot.width,
            height: ghostHeight,
            opacity: 1,
            zIndex: 3,
            style: BUFFER_BASE_STYLE,
            stateTags: [],
          });
          // to 帧 buffer 目标柱子隐藏（ghost 覆盖它，ghost 消失后下一步才显示真实柱子）
          const bIdx = bufferEntities.findIndex((e) => e.id === `buffer-${destIndex}`);
          if (bIdx !== -1) bufferEntities[bIdx] = { ...bufferEntities[bIdx], opacity: 0 };
        }
      }
    }
  }

  // merge-back：缓冲区元素飞回主数组
  if (semantic?.type === "merge-back" && (frameRole === "from" || frameRole === "to")) {
    for (const bufferIdx of semantic.indices) {
      if (typeof bufferIdx !== "number") continue;

      const bufferEntry = bufferValues[bufferIdx];
      if (bufferEntry === null) continue;

      const { value: bufferVal, displayIndex: bufferDispIdx } = bufferEntry;
      const bufferSlot = layout.bottomSlots[bufferIdx];
      if (!bufferSlot) continue;

      const targetMain = mainEntities.find((e) => e.id === `main-${bufferIdx}`);
      if (!targetMain) continue;

      const ghostId = `ghost-back-${ghostStepIndex ?? stepIndex}-${bufferIdx}`;
      const ghostHeight = Math.max(5, Math.round((bufferVal / maxValue) * (bufferSlot.maxHeight ?? 0)));

      if (frameRole === "from") {
        // ghost 在缓冲区位置，覆盖真实 buffer bar
        ghostEntities.push({
          id: ghostId,
          sourceId: `buffer-${bufferDispIdx}`,
          kind: "buffer-bar",
          value: bufferVal,
          displayIndex: bufferDispIdx,
          x: bufferSlot.x,
          y: bufferSlot.y,
          width: bufferSlot.width,
          height: ghostHeight,
          opacity: 1,
          zIndex: 3,
          style: BUFFER_BASE_STYLE,
          stateTags: [],
        });
      } else {
        // to 帧：ghost 到达主数组目标位置，保持 opacity=1（与 merge-set 一致，ghost 是唯一视觉主体）
        // 不能 spread targetMain，因为 targetMain.width 可能为 0（hiddenMainIndices 导致）
        const mainSlot = layout.topSlots[bufferIdx];
        ghostEntities.push({
          id: ghostId,
          sourceId: `buffer-${bufferDispIdx}`,
          kind: "buffer-bar",
          value: bufferVal,
          displayIndex: bufferDispIdx,
          x: mainSlot?.x ?? targetMain.x,
          y: mainSlot?.y ?? targetMain.y,
          width: mainSlot?.width ?? 0,
          height: Math.max(5, Math.round((bufferVal / maxValue) * (mainSlot?.maxHeight ?? 0))),
          opacity: 1,
          zIndex: 3,
          style: BUFFER_BASE_STYLE,
          stateTags: [],
        });
      }
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

export function buildMergeInitialFrame(params: {
  originalValues: number[];
  displayIndexes: number[];
  width: number;
  height: number;
}): FrameState {
  return createMergeFrame({
    values: params.originalValues,
    displayIndexes: params.displayIndexes,
    bufferValues: new Array(params.originalValues.length).fill(null) as Array<{ value: number; displayIndex: number } | null>,
    width: params.width,
    height: params.height,
    stepIndex: 0,
    description: "初始状态",
    mainStateTags: new Map(),
    bufferStateTags: new Map(),
    hiddenMainIndices: new Set(),
    hiddenBufferIndices: new Set(),
  });
}

export function buildMergeTimeline(params: {
  steps: SemanticStep[];
  originalValues: number[];
  displayIndexes: number[];
  width: number;
  height: number;
}): TimelineStep[] {
  const { steps, originalValues, displayIndexes, width, height } = params;

  let values = [...originalValues];
  let mainDisplayIndexes = [...displayIndexes];
  let bufferValues: Array<BufferEntry | null> = new Array(originalValues.length).fill(null);
  let sortedIndices = new Set<number>();

  // 追踪哪些柱子被 ghost 接管需要隐藏（与桶排序的 scatteredIndices 同理）
  const hiddenMainIndices = new Set<number>();
  const hiddenBufferIndices = new Set<number>();

  return steps.map((semantic, index) => {
    const { mainStateTags, bufferStateTags, nextSorted } = buildStateTags(semantic, sortedIndices);
    sortedIndices = nextSorted;

    const isAnimated = semantic.type === "merge-set" || semantic.type === "merge-back";

    // merge-set：在构建 from 帧之前就隐藏源柱子，ghost 接替飞行
    if (semantic.type === "merge-set") {
      const [sourceIndex] = semantic.indices;
      if (typeof sourceIndex === "number") {
        hiddenMainIndices.add(sourceIndex);
      }
    }

    // merge-back：在构建 from 帧之前就隐藏缓冲柱子，ghost 接替飞行
    if (semantic.type === "merge-back") {
      for (const bufferIdx of semantic.indices) {
        if (typeof bufferIdx === "number") {
          hiddenBufferIndices.add(bufferIdx);
          // 主数组对应位置也隐藏（ghost 飞到后才显示真实柱子）
          hiddenMainIndices.add(bufferIdx);
        }
      }
    }

    const from = createMergeFrame({
      values: semantic.type === "merge-back"
        ? (() => {
            // merge-back 的 from 帧主数组是 merge-back 之前的值，从 bufferValues 对应位置读取
            // values 此时还未更新，直接用即可
            return values;
          })()
        : values,
      bufferValues: semantic.type === "merge-set"
        ? (() => {
            // merge-set 的 from 帧 buffer 应该是填充前的状态
            const prev = [...bufferValues];
            const [, destIndex] = semantic.indices;
            if (typeof destIndex === "number") prev[destIndex] = null;
            return prev;
          })()
        : bufferValues,
      displayIndexes: mainDisplayIndexes,
      width,
      height,
      stepIndex: index,
      description: semantic.description,
      mainStateTags,
      bufferStateTags,
      semantic,
      frameRole: "from",
      ghostStepIndex: index,
      hiddenMainIndices: new Set(hiddenMainIndices),
      hiddenBufferIndices: new Set(hiddenBufferIndices),
    });

    // 更新状态：merge-set 填充 buffer（同时记录元素的 displayIndex）
    if (semantic.type === "merge-set") {
      const [sourceIndex, destIndex] = semantic.indices;
      if (typeof sourceIndex === "number" && typeof destIndex === "number") {
        const val = values[sourceIndex] ?? semantic.arraySnapshot?.[sourceIndex] ?? null;
        bufferValues = [...bufferValues];
        bufferValues[destIndex] = val !== null
          ? { value: val, displayIndex: mainDisplayIndexes[sourceIndex] }
          : null;
      }
    }

    if (semantic.type === "sorted" && semantic.arraySnapshot) {
      values = [...semantic.arraySnapshot];
    }

    if (semantic.type === "merge-back" && semantic.arraySnapshot) {
      values = [...semantic.arraySnapshot];
      // 从 buffer 恢复 displayIndex 到主数组
      for (const bufferIdx of semantic.indices) {
        if (typeof bufferIdx !== "number") continue;
        const entry = bufferValues[bufferIdx];
        if (entry) mainDisplayIndexes[bufferIdx] = entry.displayIndex;
      }
    }

    const to = createMergeFrame({
      values,
      bufferValues,
      displayIndexes: mainDisplayIndexes,
      width,
      height,
      stepIndex: index + 1,
      description: semantic.description,
      mainStateTags,
      bufferStateTags,
      semantic,
      frameRole: isAnimated ? "to" : "static",
      ghostStepIndex: index,
      // to 帧始终传递隐藏集合：merge-set 保持源柱子隐藏，merge-back 保持目标柱子隐藏（由 ghost 接替视觉）
      // 非动画步骤（compare/sorted）也保持隐藏，防止 to 帧让隐藏柱子重新出现
      hiddenMainIndices: new Set(hiddenMainIndices),
      // merge-back to 帧：缓冲柱子也需隐藏（ghost 接替视觉），否则插值过程中 opacity 从 0→1 导致缓冲区元素重现
      hiddenBufferIndices: semantic.type === "merge-back" ? new Set(hiddenBufferIndices) : undefined,
    });

    // merge-back 完成后清空 buffer 和隐藏集合
    if (semantic.type === "merge-back") {
      bufferValues = new Array(originalValues.length).fill(null);
      hiddenBufferIndices.clear();
      hiddenMainIndices.clear();
    }

    // merge-set 完成后，源柱子的隐藏状态保持到 merge-back 时一并清除
    // to 帧 buffer 目标柱子在 createMergeFrame 内部已处理（opacity=0，ghost 覆盖）
    // 下一步 from 帧需要显示真实 buffer 柱子，所以这里不加入 hiddenBufferIndices

    const movingEntityIds = semantic.type === "merge-set"
      ? [`ghost-set-${index}`]
      : semantic.type === "merge-back"
        ? semantic.indices.filter((i) => typeof i === "number").map((i) => `ghost-back-${index}-${i}`)
        : undefined;

    const flyDuration = 3;
    return {
      id: `merge-${index + 1}`,
      kind: semantic.type,
      description: semantic.description,
      duration: isAnimated ? flyDuration : 1,
      from,
      to,
      transition: {
        type: isAnimated ? "linear" : "instant",
        duration: isAnimated ? flyDuration : 1,
        easing: "easeInOutCubic",
        movingEntityIds,
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
