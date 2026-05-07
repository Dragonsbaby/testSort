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

  // swap 平移时保持柱子的原始高度（来自 from），不做高度渐变，避免视觉上"变高变矮"
  const isSwapMove = transition.swapEntityIdPairs?.some(([a, b]) => a === from.id || b === from.id) ?? false;

  return {
    ...to,
    x,
    y,
    width: lerp(from.width, to.width, progress),
    height: isSwapMove ? from.height : lerp(from.height, to.height, progress),
    opacity: transition.visibilityTransition || transition.type === "fade"
      ? getFadeOpacity(from.opacity, to.opacity, progress)
      : lerp(from.opacity, to.opacity, progress),
    style: transition.styleTransition ? interpolateStyle(from.style, to.style, progress) : to.style,
  };
}

/**
 * 根据 swapEntityIdPairs 构建"交叉起点"映射表：
 * 对于 swap 中的每一对 [idA, idB]，idA 的插值起点替换为 idB 的 from 坐标，反之亦然，
 * 这样两个 entity 才会真正地从对方位置飞向自己的目标位置。
 */
function buildSwapFromOverrides(
  fromEntities: RenderableEntity[],
  swapPairs: [string, string][],
): Map<string, Pick<RenderableEntity, "x" | "y">> {
  const fromMap = new Map(fromEntities.map((e) => [e.id, e]));
  const overrides = new Map<string, Pick<RenderableEntity, "x" | "y">>();

  for (const [idA, idB] of swapPairs) {
    const fromA = fromMap.get(idA);
    const fromB = fromMap.get(idB);
    if (fromA && fromB) {
      // A 从 B 的旧位置出发，B 从 A 的旧位置出发
      overrides.set(idA, { x: fromB.x, y: fromB.y });
      overrides.set(idB, { x: fromA.x, y: fromA.y });
    }
  }

  return overrides;
}

export function interpolateEntities(
  fromEntities: RenderableEntity[],
  toEntities: RenderableEntity[],
  transition: Transition,
  progress: number,
): RenderableEntity[] {
  const fromMap = new Map(fromEntities.map((entity) => [entity.id, entity]));

  // 构建 swap 交叉起点覆盖表
  const swapFromOverrides = transition.swapEntityIdPairs?.length
    ? buildSwapFromOverrides(fromEntities, transition.swapEntityIdPairs)
    : null;

  return toEntities.map((toEntity) => {
    const fromEntity = fromMap.get(toEntity.id);
    if (!fromEntity || transition.type === "instant") {
      return { ...toEntity };
    }

    // 如果该 entity 需要交叉起点，将其 from 的 x/y 替换为对方的旧坐标
    const override = swapFromOverrides?.get(toEntity.id);
    const effectiveFrom = override
      ? { ...fromEntity, x: override.x, y: override.y }
      : fromEntity;

    return interpolateEntity(effectiveFrom, toEntity, transition, progress);
  });
}
