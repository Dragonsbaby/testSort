import type { SemanticStep, StateTag } from "@/types/timeline";

export interface BuildStateTagsOptions {
  /** pending 态的 tag 名（basic="pending", heap="heap-pending"） */
  pendingTag: StateTag;
}

/**
 * 从 semantic step 与上一步的 sorted 集合，推导每个 index 的 stateTags。
 * basic / heap 共用此逻辑，差异仅 pendingTag 字面量（heap 用 "heap-pending"）。
 *
 * 覆盖优先级：sorted（累加）→ groupIndices(pending，仅填空位) → compare → swap → pivot → latest。
 * 因 semantic.type 互斥、groupIndices 为附加标记，故与各 builder 原先的分支顺序结果等价。
 */
export function buildStateTagsFromSemantic(
  semantic: SemanticStep,
  previousSorted: Set<number>,
  opts: BuildStateTagsOptions,
): { nextSorted: Set<number>; stateTagsByIndex: Map<number, StateTag[]> } {
  const nextSorted = new Set(previousSorted);
  const stateTagsByIndex = new Map<number, StateTag[]>();

  if (semantic.type === "sorted") {
    semantic.indices.forEach((index) => nextSorted.add(index));
  }

  nextSorted.forEach((index) => {
    stateTagsByIndex.set(index, ["sorted"]);
  });

  // groupIndices 作为附加 pending 标记，仅填充尚未被占据的位置
  if (semantic.groupIndices?.length) {
    semantic.groupIndices.forEach((index) => {
      if (!stateTagsByIndex.has(index)) {
        stateTagsByIndex.set(index, [opts.pendingTag]);
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
