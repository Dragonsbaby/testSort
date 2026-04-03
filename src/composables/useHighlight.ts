import { computed, type Ref } from "vue";
import type { SortStep } from "../types/sorting";

export interface HighlightedIndices {
  comparing: number[];
  swapping: number[];
  sorted: number[];
  pivot: number[];
}

export function useHighlight(steps: Ref<SortStep[]>, currentStep: Ref<number>) {
  const highlightedIndices = computed<HighlightedIndices>(() => {
    if (currentStep.value < 0 || currentStep.value >= steps.value.length) {
      return { comparing: [], swapping: [], sorted: [], pivot: [] };
    }

    const step = steps.value[currentStep.value];
    const sortedIndices = new Set<number>();

    for (let i = 0; i <= currentStep.value; i++) {
      if (steps.value[i].type === "sorted") {
        steps.value[i].indices.forEach((idx) => sortedIndices.add(idx));
      }
    }

    let comparing: number[] = [];
    let swapping: number[] = [];
    let pivot: number[] = [];

    switch (step.type) {
      case "compare":
        comparing = step.indices;
        break;
      case "swap":
      case "merge":
        swapping = step.indices;
        break;
      case "pivot":
        pivot = step.indices;
        break;
      case "set":
        swapping = step.indices;
        break;
    }

    return {
      comparing,
      swapping,
      sorted: Array.from(sortedIndices),
      pivot,
    };
  });

  return { highlightedIndices };
}
