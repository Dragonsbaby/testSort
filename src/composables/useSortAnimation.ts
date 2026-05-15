import { computed, ref, watch, type Ref, type ToRef } from "vue";
import type { SemanticStep, TimelineStep, FrameState } from "@/types/timeline";
import type { ArrayElement } from "@/stores/sortStore";
import { buildBasicTimeline } from "@/utils/timeline-builders/build-basic-timeline";
import { buildMergeTimeline } from "@/utils/timeline-builders/build-merge-timeline";
import { buildBucketTimeline } from "@/utils/timeline-builders/build-bucket-timeline";
import { buildHeapTimeline } from "@/utils/timeline-builders/build-heap-timeline";
import { useTimelinePlayer } from "@/composables/useTimelinePlayer";

export interface ISortCanvas {
  renderFrame(frame: FrameState): void;
}

type BasicAlgorithm = "bubble" | "insertion" | "quick" | "shell";
type SortAnimationAlgorithm = BasicAlgorithm | "merge" | "bucket" | "heap";
type SortFn = (arr: number[]) => SemanticStep[];

function buildDisplayArray(values: number[], displayIndexes: number[]): ArrayElement[] {
  return values.map((value, index) => ({
    value,
    displayIndex: displayIndexes[index] ?? index + 1,
  }));
}

export function useSortAnimation(params: {
  sortFn: SortFn;
  speed: ToRef<number>;
  canvasRef: Ref<ISortCanvas | null>;
  canvasWidth?: ToRef<number>;
  canvasHeight?: ToRef<number>;
  originalArray: ToRef<ArrayElement[]>;
  algorithm: SortAnimationAlgorithm;
  heapMode?: ToRef<"max" | "min">;
}) {
  const { sortFn, speed, canvasRef, canvasWidth, canvasHeight, originalArray, algorithm, heapMode } = params;

  const currentCanvasWidth = computed(() => canvasWidth?.value ?? 760);
  const currentCanvasHeight = computed(() => canvasHeight?.value ?? 460);

  const semanticSteps = ref<SemanticStep[]>([]);
  const timelineSteps = ref<TimelineStep[]>([]);
  const array = ref<ArrayElement[]>([]);
  const comparisons = ref(0);
  const swaps = ref(0);

  function rebuild() {
    const current = originalArray.value;
    const values = current.map((item) => item.value);
    const displayIndexes = current.map((item) => item.displayIndex);

    array.value = [...current];
    semanticSteps.value = sortFn(values);
    timelineSteps.value = algorithm === "merge"
      ? buildMergeTimeline({
          steps: semanticSteps.value,
          originalValues: values,
          displayIndexes,
          width: currentCanvasWidth.value,
          height: currentCanvasHeight.value,
          stepDuration: speed.value,
        })
      : algorithm === "bucket"
        ? buildBucketTimeline({
            steps: semanticSteps.value,
            originalValues: values,
            displayIndexes,
            width: currentCanvasWidth.value,
            height: currentCanvasHeight.value,
            stepDuration: speed.value,
          })
        : algorithm === "heap"
          ? buildHeapTimeline({
              steps: semanticSteps.value,
              originalValues: values,
              displayIndexes,
              width: currentCanvasWidth.value,
              height: 48 + Math.max(1, Math.floor(Math.log2(Math.max(values.length, 1))) + 1) * 90 + 88,
              stepDuration: speed.value,
              isMinHeap: heapMode?.value === "min",
            })
          : buildBasicTimeline({
              algorithm,
              steps: semanticSteps.value,
              originalValues: values,
              displayIndexes,
              width: currentCanvasWidth.value,
              height: 320,
              stepDuration: speed.value,
            });
    comparisons.value = 0;
    swaps.value = 0;
    player.reset();
  }

  const player = useTimelinePlayer(() => timelineSteps.value);

  function syncStats(index: number) {
    let nextComparisons = 0;
    let nextSwaps = 0;

    timelineSteps.value.slice(0, index).forEach((step) => {
      nextComparisons += step.statsDelta.comparisons;
      nextSwaps += step.statsDelta.swaps;
    });

    comparisons.value = nextComparisons;
    swaps.value = nextSwaps;
  }

  function syncArray(index: number) {
    if (index <= 0) {
      array.value = [...originalArray.value];
      return;
    }

    const step = timelineSteps.value[index - 1];
    const snapshot = step?.to.entities
      .filter((entity) => entity.kind === "main-bar" || entity.kind === "heap-array-node")
      .sort((left, right) => left.x - right.x || left.displayIndex - right.displayIndex);

    if (!snapshot?.length) return;

    array.value = buildDisplayArray(
      snapshot.map((entity) => entity.value),
      snapshot.map((entity) => entity.displayIndex),
    );
  }

  function step() {
    if (player.currentStepIndex.value >= timelineSteps.value.length) return;
    player.stepForward();
  }

  function reset() {
    player.reset();
    comparisons.value = 0;
    swaps.value = 0;
    array.value = [...originalArray.value];
    const firstFrame = timelineSteps.value[0]?.from;
    if (firstFrame) canvasRef.value?.renderFrame(firstFrame);
  }

  watch(originalArray, rebuild, { immediate: true });

  watch(
    () => speed.value,
    () => rebuild(),
  );

  watch(
    () => currentCanvasWidth.value,
    () => rebuild(),
  );

  watch(
    () => currentCanvasHeight.value,
    () => rebuild(),
  );

  watch(
    () => player.currentFrame.value,
    (frame) => {
      if (frame) canvasRef.value?.renderFrame(frame);
    },
    { immediate: true },
  );

  watch(
    () => player.currentStepIndex.value,
    (index) => {
      syncStats(index);
      syncArray(index);
    },
  );

  return {
    array,
    steps: semanticSteps,
    currentStep: computed(() => player.currentStepIndex.value),
    comparisons,
    swaps,
    currentStepInfo: computed(() => semanticSteps.value[player.currentStepIndex.value - 1] ?? null),
    isPlaying: player.isPlaying,
    play: player.play,
    pause: player.pause,
    step,
    reset,
    rebuild,
    statusText: computed(() => {
      if (player.isPlaying.value) return "播放中";
      if (player.currentStepIndex.value >= timelineSteps.value.length) return "已完成";
      if (player.currentStepIndex.value === 0) return "就绪";
      return "已暂停";
    }),
    statusClass: computed(() => {
      if (player.isPlaying.value) return "playing";
      if (player.currentStepIndex.value >= timelineSteps.value.length) return "done";
      if (player.currentStepIndex.value === 0) return "ready";
      return "paused";
    }),
  };
}
