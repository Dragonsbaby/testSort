import { computed, ref, watch, type Ref, type ToRef } from "vue";
import type { SemanticStep, TimelineStep, FrameState } from "@/types/timeline";
import type { ArrayElement } from "@/stores/sortStore";
import { buildBasicTimeline } from "@/utils/timeline-builders/build-basic-timeline";
import { useTimelinePlayer } from "@/composables/useTimelinePlayer";

export interface ISortCanvas {
  renderFrame(frame: FrameState): void;
}

type BasicAlgorithm = "bubble" | "insertion" | "quick" | "shell";
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
  originalArray: ToRef<ArrayElement[]>;
  algorithm: BasicAlgorithm;
}) {
  const { sortFn, speed, canvasRef, originalArray, algorithm } = params;

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
    timelineSteps.value = buildBasicTimeline({
      algorithm,
      steps: semanticSteps.value,
      originalValues: values,
      displayIndexes,
      width: 760,
      height: 320,
      stepDuration: speed.value,
    });
    comparisons.value = 0;
    swaps.value = 0;
    player.reset();
  }

  const player = useTimelinePlayer(() => timelineSteps.value);

  function syncStats(index: number) {
    comparisons.value = timelineSteps.value
      .slice(0, index)
      .reduce((sum, step) => sum + step.statsDelta.comparisons, 0);
    swaps.value = timelineSteps.value
      .slice(0, index)
      .reduce((sum, step) => sum + step.statsDelta.swaps, 0);
  }

  function syncArray(index: number) {
    if (index <= 0) {
      array.value = [...originalArray.value];
      return;
    }

    const step = timelineSteps.value[index - 1];
    const snapshot = step?.to.entities
      .filter((entity) => entity.kind === "main-bar")
      .sort((left, right) => left.x - right.x);

    if (!snapshot?.length) return;

    array.value = buildDisplayArray(
      snapshot.map((entity) => entity.value),
      snapshot.map((entity) => entity.displayIndex),
    );
  }

  function step() {
    if (player.currentStepIndex.value >= timelineSteps.value.length) return;
    player.stepForward();
    syncStats(player.currentStepIndex.value);
    syncArray(player.currentStepIndex.value);
    const frame = player.currentFrame.value;
    if (frame) canvasRef.value?.renderFrame(frame);
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
