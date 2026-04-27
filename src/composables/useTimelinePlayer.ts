import { computed, ref } from "vue";
import type { FrameState, TimelineStep } from "@/types/timeline";
import { interpolateFrame } from "@/utils/frame/interpolate-frame";

export function useTimelinePlayer(steps: () => TimelineStep[]) {
  const currentStepIndex = ref(0);
  const progress = ref(0);
  const isPlaying = ref(false);
  let rafId: number | null = null;
  let stepStartedAt = 0;

  const currentTimelineStep = computed(() => steps()[currentStepIndex.value] ?? null);
  const currentFrame = computed<FrameState | null>(() => {
    const step = currentTimelineStep.value;
    if (!step) return null;
    return interpolateFrame(step, progress.value);
  });

  function stopLoop() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function pause() {
    isPlaying.value = false;
    stopLoop();
  }

  function renderCurrentStep() {
    progress.value = 1;
    pause();
  }

  function stepForward() {
    pause();
    const nextIndex = Math.min(currentStepIndex.value + 1, steps().length);
    currentStepIndex.value = nextIndex;
    progress.value = 0;
  }

  function play() {
    if (!currentTimelineStep.value || isPlaying.value || rafId !== null) return;
    isPlaying.value = true;
    stepStartedAt = performance.now() - currentTimelineStep.value.duration * progress.value;

    const tick = (ts: number) => {
      const step = currentTimelineStep.value;
      if (!step) {
        pause();
        return;
      }

      const elapsed = ts - stepStartedAt;
      progress.value = Math.min(1, elapsed / Math.max(step.duration, 1));

      if (progress.value >= 1) {
        currentStepIndex.value += 1;
        progress.value = 0;
        if (!steps()[currentStepIndex.value]) {
          pause();
          return;
        }
        stepStartedAt = ts;
      }

      if (isPlaying.value) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
  }

  function reset() {
    pause();
    currentStepIndex.value = 0;
    progress.value = 0;
  }

  return {
    currentStepIndex,
    progress,
    currentFrame,
    currentTimelineStep,
    isPlaying,
    play,
    pause,
    reset,
    renderCurrentStep,
    stepForward,
  };
}
