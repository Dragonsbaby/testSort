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

  // 构建 swap pair 的「起点覆盖」映射：
  // 对于 pair [idA, idB]，A 应从 B 的目标 x 出发飞向 A 的目标 x，反之亦然
  const swapFromXOverride = new Map<string, number>();
  if (transition.swapEntityIdPairs) {
    for (const [idA, idB] of transition.swapEntityIdPairs) {
      const toA = toEntities.find((e) => e.id === idA);
      const toB = toEntities.find((e) => e.id === idB);
      if (toA && toB) {
        // A 的 from.x 覆盖为 B 的目标 x（让 A 从 B 的位置出发）
        swapFromXOverride.set(idA, toB.x);
        // B 的 from.x 覆盖为 A 的目标 x（让 B 从 A 的位置出发）
        swapFromXOverride.set(idB, toA.x);
      }
    }
  }

  return toEntities.map((toEntity) => {
    const fromEntity = fromMap.get(toEntity.id);
    if (!fromEntity || transition.type === "instant") {
      return { ...toEntity };
    }

    // 如果是 swap pair 成员，覆盖 from.x 为对方的目标 x
    const overrideX = swapFromXOverride.get(toEntity.id);
    const effectiveFrom = overrideX !== undefined
      ? { ...fromEntity, x: overrideX }
      : fromEntity;

    return interpolateEntity(effectiveFrom, toEntity, transition, progress);
  });
}
