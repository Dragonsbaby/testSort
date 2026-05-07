import type { RenderableEntity, Transition } from "@/types/timeline";
import { getArcPoint, getFadeOpacity, getPathPoint, lerp } from "./path-utils";
import { interpolateStyle } from "./style-utils";

function interpolateEntity(from: RenderableEntity, to: RenderableEntity, transition: Transition, progress: number): RenderableEntity {
  const movedByTransition = transition.movingEntityIds?.includes(from.id) ?? false;

  let x = lerp(from.x, to.x, progress);
  let y = lerp(from.y, to.y, progress);

  if (movedByTransition) {
    if (transition.type === "arc") {
      const arcHeight = Math.max(80, (from.height + to.height) / 2 * 1.8);
      const point = getArcPoint({ x: from.x, y: from.y }, { x: to.x, y: to.y }, progress, arcHeight);
      x = point.x;
      y = point.y;
    }

    if (transition.type === "path") {
      const point = getPathPoint(
        { x: from.x, y: from.y },
        { x: to.x, y: to.y },
        progress,
        transition.pathParams,
      );
      x = point.x;
      y = point.y;
    }
  }

  return {
    ...to,
    x,
    y,
    width: lerp(from.width, to.width, progress),
    height: lerp(from.height, to.height, progress),
    value: to.value,
    displayIndex: to.displayIndex,
    opacity: transition.visibilityTransition || transition.type === "fade"
      ? getFadeOpacity(from.opacity, to.opacity, progress)
      : lerp(from.opacity, to.opacity, progress),
    style: transition.styleTransition ? interpolateStyle(from.style, to.style, progress) : to.style,
  };
}

export function interpolateEntities(
  fromEntities: RenderableEntity[],
  toEntities: RenderableEntity[],
  transition: Transition,
  progress: number,
): RenderableEntity[] {
  const fromMap = new Map(fromEntities.map((entity) => [entity.id, entity]));

  return toEntities.map((toEntity) => {
    const fromEntity = fromMap.get(toEntity.id);
    if (!fromEntity || transition.type === "instant") {
      return { ...toEntity };
    }

    return interpolateEntity(fromEntity, toEntity, transition, progress);
  });
}
