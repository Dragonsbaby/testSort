import type { FrameState, TimelineStep } from "@/types/timeline";
import { easeInOutCubic, easeOutCubic } from "./path-utils";
import { interpolateEntities } from "./interpolate-entity";

function applyEasing(step: TimelineStep, progress: number) {
  if (step.transition.easing === "easeOutCubic") return easeOutCubic(progress);
  if (step.transition.easing === "easeInOutCubic") return easeInOutCubic(progress);
  return progress;
}

export function interpolateFrame(step: TimelineStep, progress: number): FrameState {
  const easedProgress = applyEasing(step, Math.min(1, Math.max(0, progress)));

  return {
    ...step.to,
    stepIndex: step.from.stepIndex,
    progress: easedProgress,
    phase: easedProgress >= 1 ? "paused" : "playing",
    description: step.description,
    entities: interpolateEntities(step.from.entities, step.to.entities, step.transition, easedProgress),
  };
}
