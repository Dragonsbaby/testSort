import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  bubbleSort,
  insertionSort,
  mergeSort,
  quickSort,
} from "@/utils/sortingAlgorithms";
import type { SortAlgorithm, SortStep } from "@/types/sorting";

const ALGORITHMS: Record<SortAlgorithm, (arr: number[]) => SortStep[]> = {
  bubble: bubbleSort,
  insertion: insertionSort,
  merge: mergeSort,
  quick: quickSort,
};

export const useSortStore = defineStore("sort", () => {
  const originalArray = ref<number[]>([]);
  const displayArray = ref<number[]>([]);
  const steps = ref<SortStep[]>([]);
  const currentStep = ref(0);
  const isPlaying = ref(false);
  const isComplete = ref(false);
  const comparisons = ref(0);
  const swaps = ref(0);
  const animationSpeed = ref(200);
  const arraySize = ref(20);
  const algorithm = ref<SortAlgorithm>("merge");

  let animationTimer: ReturnType<typeof setTimeout> | null = null;

  const currentStepInfo = computed(() => {
    if (currentStep.value >= 0 && currentStep.value < steps.value.length) {
      return steps.value[currentStep.value];
    }
    return null;
  });

  const highlightedIndices = computed(() => {
    if (!currentStepInfo.value)
      return { comparing: [], swapping: [], sorted: [], pivot: [] };

    const step = currentStepInfo.value;
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

  function generateArray(size: number) {
    stopAnimation();
    const arr: number[] = [];
    for (let i = 0; i < size; i++) {
      arr.push(Math.floor(Math.random() * 90) + 10);
    }
    originalArray.value = [...arr];
    displayArray.value = [...arr];
    steps.value = [];
    currentStep.value = 0;
    isPlaying.value = false;
    isComplete.value = false;
    comparisons.value = 0;
    swaps.value = 0;
  }

  function generateSteps() {
    const sortFn = ALGORITHMS[algorithm.value];
    const arrCopy = [...originalArray.value];
    steps.value = sortFn(arrCopy);
    currentStep.value = 0;
    isComplete.value = false;
    comparisons.value = 0;
    swaps.value = 0;
  }

  function playAnimation() {
    if (isComplete.value || steps.value.length === 0) return;

    isPlaying.value = true;

    const step = () => {
      if (!isPlaying.value || currentStep.value >= steps.value.length) {
        if (currentStep.value >= steps.value.length && !isComplete.value) {
          isComplete.value = true;
          isPlaying.value = false;
          applyStep(steps.value[steps.value.length - 1]);
        }
        return;
      }

      const currentStepData = steps.value[currentStep.value];
      applyStep(currentStepData);

      if (currentStepData.type === "compare") {
        comparisons.value++;
      } else if (
        currentStepData.type === "swap" ||
        currentStepData.type === "merge" ||
        currentStepData.type === "set"
      ) {
        swaps.value++;
      }

      currentStep.value++;

      if (currentStep.value >= steps.value.length) {
        isComplete.value = true;
        isPlaying.value = false;
      } else {
        animationTimer = setTimeout(step, animationSpeed.value);
      }
    };

    step();
  }

  function applyStep(step: SortStep) {
    if (step.arraySnapshot) {
      displayArray.value = [...step.arraySnapshot];
    }
  }

  function pauseAnimation() {
    isPlaying.value = false;
    if (animationTimer) {
      clearTimeout(animationTimer);
      animationTimer = null;
    }
  }

  function stopAnimation() {
    pauseAnimation();
    resetToStart();
  }

  function resetToStart() {
    displayArray.value = [...originalArray.value];
    currentStep.value = 0;
    isComplete.value = false;
    comparisons.value = 0;
    swaps.value = 0;
  }

  function stepForward() {
    if (currentStep.value < steps.value.length) {
      const step = steps.value[currentStep.value];
      applyStep(step);
      if (step.type === "compare") comparisons.value++;
      else if (
        step.type === "swap" ||
        step.type === "merge" ||
        step.type === "set"
      )
        swaps.value++;
      currentStep.value++;
      if (currentStep.value >= steps.value.length) {
        isComplete.value = true;
      }
    }
  }

  function setSpeed(speed: number) {
    animationSpeed.value = speed;
  }

  function setAlgorithm(alg: SortAlgorithm) {
    stopAnimation();
    algorithm.value = alg;
    if (originalArray.value.length > 0) {
      generateSteps();
    }
  }

  function startSort() {
    if (steps.value.length === 0) {
      generateSteps();
    }
    playAnimation();
  }

  return {
    originalArray,
    displayArray,
    steps,
    currentStep,
    isPlaying,
    isComplete,
    comparisons,
    swaps,
    animationSpeed,
    arraySize,
    algorithm,
    currentStepInfo,
    highlightedIndices,
    generateArray,
    generateSteps,
    startSort,
    pauseAnimation,
    stopAnimation,
    resetToStart,
    stepForward,
    setSpeed,
    setAlgorithm,
  };
});
