import { computed, onUnmounted, ref, watch, type Ref, type ToRef } from "vue";
import type { SemanticStep, TimelineStep, FrameState } from "@/types/timeline";
import type { ArrayElement } from "@/stores/sortStore";
import { buildBasicTimeline, buildBasicInitialFrame } from "@/utils/timeline-builders/build-basic-timeline";
import { buildMergeTimeline, buildMergeInitialFrame } from "@/utils/timeline-builders/build-merge-timeline";
import { buildBucketTimeline, buildBucketInitialFrame } from "@/utils/timeline-builders/build-bucket-timeline";
import { buildHeapTimeline, buildHeapInitialFrame } from "@/utils/timeline-builders/build-heap-timeline";
import { getHeapRequiredHeight } from "@/utils/layout/heap-layout";
import { useTimelinePlayer } from "@/composables/useTimelinePlayer";

export interface ISortCanvas {
  renderFrame(frame: FrameState): void;
}

export type BasicAlgorithm = "bubble" | "insertion" | "quick" | "shell";
export type SortAnimationAlgorithm = BasicAlgorithm | "merge" | "bucket" | "heap";
export type SortFn = (arr: number[]) => SemanticStep[];

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
  const isReady = ref(false);
  const initialFrame = ref<FrameState | null>(null);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function buildInitialFrameForAlgorithm(values: number[], displayIndexes: number[]): FrameState {
    if (algorithm === "merge")
      return buildMergeInitialFrame({ originalValues: values, displayIndexes, width: currentCanvasWidth.value, height: currentCanvasHeight.value });
    if (algorithm === "bucket")
      return buildBucketInitialFrame({ originalValues: values, displayIndexes, width: currentCanvasWidth.value, height: currentCanvasHeight.value });
    if (algorithm === "heap")
      return buildHeapInitialFrame({ originalValues: values, displayIndexes, width: currentCanvasWidth.value, height: getHeapRequiredHeight(values.length), isMinHeap: heapMode?.value === "min" });
    return buildBasicInitialFrame({ algorithm: algorithm as BasicAlgorithm, originalValues: values, displayIndexes, width: currentCanvasWidth.value, height: 320 });
  }

  function buildTimelineForAlgorithm(values: number[], displayIndexes: number[]): TimelineStep[] {
    if (algorithm === "merge") return buildMergeTimeline({ steps: semanticSteps.value, originalValues: values, displayIndexes, width: currentCanvasWidth.value, height: currentCanvasHeight.value });
    if (algorithm === "bucket") return buildBucketTimeline({ steps: semanticSteps.value, originalValues: values, displayIndexes, width: currentCanvasWidth.value, height: currentCanvasHeight.value });
    if (algorithm === "heap") return buildHeapTimeline({ steps: semanticSteps.value, originalValues: values, displayIndexes, width: currentCanvasWidth.value, height: getHeapRequiredHeight(values.length), isMinHeap: heapMode?.value === "min" });
    return buildBasicTimeline({ algorithm: algorithm as BasicAlgorithm, steps: semanticSteps.value, originalValues: values, displayIndexes, width: currentCanvasWidth.value, height: 320 });
  }

  function buildInitial() {
    const current = originalArray.value;
    const values = current.map((item) => item.value);
    const displayIndexes = current.map((item) => item.displayIndex);
    array.value = [...current];
    semanticSteps.value = [];
    timelineSteps.value = [];
    comparisons.value = 0;
    swaps.value = 0;
    lastSyncedIndex.value = 0;
    isReady.value = false;
    const frame = buildInitialFrameForAlgorithm(values, displayIndexes);
    initialFrame.value = frame;
    canvasRef.value?.renderFrame(frame);
  }

  function buildTimeline() {
    const current = originalArray.value;
    const values = current.map((item) => item.value);
    const displayIndexes = current.map((item) => item.displayIndex);
    semanticSteps.value = sortFn(values);
    timelineSteps.value = buildTimelineForAlgorithm(values, displayIndexes);
    isReady.value = true;
    player.reset();
    if (initialFrame.value) canvasRef.value?.renderFrame(initialFrame.value);
  }

  function rebuild() {
    buildInitial();
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(buildTimeline, 100);
  }

  const player = useTimelinePlayer(() => timelineSteps.value, speed);
  const lastSyncedIndex = ref(0);

  function syncStats(index: number) {
    const delta = index - lastSyncedIndex.value;
    if (delta === 0) return;

    if (delta > 0) {
      for (let i = lastSyncedIndex.value; i < index; i++) {
        const step = timelineSteps.value[i];
        if (step) {
          comparisons.value += step.statsDelta.comparisons;
          swaps.value += step.statsDelta.swaps;
        }
      }
    } else {
      for (let i = lastSyncedIndex.value - 1; i >= index; i--) {
        const step = timelineSteps.value[i];
        if (step) {
          comparisons.value -= step.statsDelta.comparisons;
          swaps.value -= step.statsDelta.swaps;
        }
      }
    }

    lastSyncedIndex.value = index;
  }

  function syncArray(index: number) {
    if (index <= 0) {
      array.value = [...originalArray.value];
      return;
    }

    const step = timelineSteps.value[index - 1];
    const snapshot = step?.to.entities
      .filter((entity) => (entity.kind === "main-bar" || entity.kind === "heap-array-node") && entity.width > 0)
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

  function stepBack() {
    player.stepBack();
  }

  function seek(targetStep: number, targetProgress: number = 0) {
    player.seek(targetStep, targetProgress);
  }

  function reset() {
    player.reset();
    comparisons.value = 0;
    swaps.value = 0;
    array.value = [...originalArray.value];
    lastSyncedIndex.value = 0;
    if (initialFrame.value) canvasRef.value?.renderFrame(initialFrame.value);
  }

  onUnmounted(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  watch(originalArray, rebuild, { immediate: true });

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

  // 播放中 Canvas 已自绘，syncArray 每步重建会触发模板重渲染，故播放中跳过；
  // 暂停 / seek / stepBack（非播放态）时同步，保证 array 与当前帧一致
  watch(
    () => player.currentStepIndex.value,
    (index) => {
      syncStats(index);
      if (!player.isPlaying.value) syncArray(index);
    },
  );

  // 播放 → 暂停 / 结束时补一次 syncArray，确保 array 反映最终停留帧
  watch(
    () => player.isPlaying.value,
    (playing) => {
      if (!playing) syncArray(player.currentStepIndex.value);
    },
  );

  return {
    array,
    steps: semanticSteps,
    currentStep: computed(() => player.currentStepIndex.value),
    currentProgress: player.progress,
    totalSteps: computed(() => timelineSteps.value.length),
    comparisons,
    swaps,
    currentStepInfo: computed(() => semanticSteps.value[player.currentStepIndex.value - 1] ?? null),
    isPlaying: player.isPlaying,
    isReady,
    play: player.play,
    pause: player.pause,
    step,
    stepBack,
    seek,
    reset,
    rebuild,
    canStepForward: player.canStepForward,
    canStepBack: player.canStepBack,
    isAtStart: player.isAtStart,
    isAtEnd: player.isAtEnd,
    progressPct: computed(() => timelineSteps.value.length
      ? ((player.currentStepIndex.value + player.progress.value) / timelineSteps.value.length) * 100
      : 0),
    phase: computed(() => (semanticSteps.value[player.currentStepIndex.value - 1])?.context?.phase ?? ''),
    desc: computed(() => {
      const s = semanticSteps.value[player.currentStepIndex.value - 1];
      return s?.brief ?? s?.description ?? '';
    }),
    handleSeek(e: MouseEvent) {
      const el = e.currentTarget as HTMLElement;
      const rect = el.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, clickX / rect.width));
      player.seek(Math.floor(pct * timelineSteps.value.length), 0);
    },
    statusText: computed(() => {
      if (!isReady.value) return "计算中";
      if (player.isPlaying.value) return "播放中";
      if (player.currentStepIndex.value >= timelineSteps.value.length) return "已完成";
      if (player.currentStepIndex.value === 0) return "就绪";
      return "已暂停";
    }),
    statusClass: computed(() => {
      if (!isReady.value) return "loading";
      if (player.isPlaying.value) return "playing";
      if (player.currentStepIndex.value >= timelineSteps.value.length) return "done";
      if (player.currentStepIndex.value === 0) return "ready";
      return "paused";
    }),
  };
}
