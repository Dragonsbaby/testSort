import { computed, ref, onScopeDispose, type Ref } from "vue";
import type { FrameState, TimelineStep } from "@/types/timeline";
import { interpolateFrame } from "@/utils/frame/interpolate-frame";

export function useTimelinePlayer(steps: () => TimelineStep[], speed: Ref<number>) {
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

  function getStepDuration(): number {
    const multiplier = currentTimelineStep.value?.duration ?? 1;
    return multiplier * speed.value;
  }

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
    // 单步动画进行中（rafId 占用）也拒绝重入，避免覆盖 rAF 句柄导致泄漏与双 tick 推进
    if (isPlaying.value || rafId !== null || !currentTimelineStep.value) return;
    const stepStarted = performance.now();
    const duration = getStepDuration();
    const tick = (ts: number) => {
      const elapsed = ts - stepStarted;
      progress.value = Math.min(1, elapsed / Math.max(duration, 1));
      if (progress.value >= 1) {
        currentStepIndex.value += 1;
        progress.value = 0;
        rafId = null;
        return;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  function play() {
    if (!currentTimelineStep.value || isPlaying.value || rafId !== null) return;
    isPlaying.value = true;
    stepStartedAt = performance.now() - getStepDuration() * progress.value;

    const tick = (ts: number) => {
      const step = currentTimelineStep.value;
      if (!step) {
        pause();
        return;
      }

      const elapsed = ts - stepStartedAt;
      progress.value = Math.min(1, elapsed / Math.max(getStepDuration(), 1));

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

  function stepBack() {
    if (isPlaying.value || currentStepIndex.value === 0) return;

    if (progress.value > 0) {
      progress.value = 0;
    } else {
      currentStepIndex.value -= 1;
      progress.value = 1;
    }
  }

  function seek(targetStep: number, targetProgress: number = 0) {
    const maxStep = steps().length - 1;
    if (maxStep < 0) return;

    const safeStep = Math.max(0, Math.min(targetStep, maxStep));
    const safeProgress = Math.max(0, Math.min(targetProgress, 1));

    const wasPlaying = isPlaying.value;
    pause();

    currentStepIndex.value = safeStep;
    progress.value = safeProgress;

    if (wasPlaying && safeStep < maxStep) {
      play();
    }
  }

  const canStepForward = computed(() => !isPlaying.value && currentStepIndex.value < steps().length - 1);
  const canStepBack = computed(() => !isPlaying.value && (currentStepIndex.value > 0 || progress.value > 0));
  const isAtStart = computed(() => currentStepIndex.value === 0 && progress.value === 0);
  const isAtEnd = computed(() => currentStepIndex.value >= steps().length - 1 && progress.value >= 1);

  // 组件卸载 / scope 销毁时清理 rAF，避免修改已卸载组件的 ref（对比模式 :key 重建 slot 场景）
  onScopeDispose(() => {
    stopLoop();
  });

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
    stepBack,
    seek,
    canStepForward,
    canStepBack,
    isAtStart,
    isAtEnd,
  };
}
