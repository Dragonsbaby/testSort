import type { RenderableEntity, Transition } from "@/types/timeline";
import { getArcPoint, getFadeOpacity, getPathPoint, lerp } from "./path-utils";
import { interpolateStyle } from "./style-utils";

function interpolateEntity(from: RenderableEntity, to: RenderableEntity, transition: Transition, progress: number): RenderableEntity {
  const movedByTransition = transition.movingEntityIds?.includes(from.id)
    || transition.swapEntityIdPairs?.some(([a, b]) => a === from.id || b === from.id)
    || false;

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
  const toMap = new Map(toEntities.map((entity) => [entity.id, entity]));

  // 构建 swap pair 的「起点覆盖」映射：
  // 对于 pair [idA, idB]，A 应从 B 的目标 x 出发飞向 A 的目标 x，反之亦然
  const swapFromXOverride = new Map<string, number>();
  if (transition.swapEntityIdPairs) {
    for (const [idA, idB] of transition.swapEntityIdPairs) {
      // toMap 已在上方构建，直接 O(1) 查找替代 O(n) 的 find 线性扫描
      const toA = toMap.get(idA);
      const toB = toMap.get(idB);
      if (toA && toB) {
        // A 的 from.x 覆盖为 B 的目标 x（让 A 从 B 的位置出发）
        swapFromXOverride.set(idA, toB.x);
        // B 的 from.x 覆盖为 A 的目标 x（让 B 从 A 的位置出发）
        swapFromXOverride.set(idB, toA.x);
      }
    }
  }

  const result = toEntities.map((toEntity) => {
    const fromEntity = fromMap.get(toEntity.id);
    if (!fromEntity || transition.type === "instant") {
      // merge-set 场景：buffer-bar 首次出现时做 fade-in（从透明渐入）
      if (
        !fromEntity
        && transition.type !== "instant"
        && transition.movingEntityIds
        && toEntity.kind === "buffer-bar"
      ) {
        const fakeFrom: RenderableEntity = { ...toEntity, opacity: 0 };
        return interpolateEntity(fakeFrom, toEntity, transition, progress);
      }
      return { ...toEntity };
    }

    // 如果是 swap pair 成员，覆盖 from.x 为对方的目标 x
    const overrideX = swapFromXOverride.get(toEntity.id);
    const effectiveFrom = overrideX !== undefined
      ? { ...fromEntity, x: overrideX }
      : fromEntity;

    return interpolateEntity(effectiveFrom, toEntity, transition, progress);
  });

  // 处理「from 存在但 to 中消失」的 moving entity（如 merge-back 的 buffer bar 飞回后消失）
  // 这些元素需要从 from 位置插值飞向 to 帧中对应 main bar 的位置，动画结束时淡出
  if (transition.movingEntityIds && transition.type !== "instant") {
    for (const movingId of transition.movingEntityIds) {
      if (toMap.has(movingId)) continue; // to 中存在则已被上方处理
      const fromEntity = fromMap.get(movingId);
      if (!fromEntity) continue;

      // buffer-N 飞向 main-N 的目标位置
      const mainId = movingId.replace(/^buffer-/, "main-");
      const targetEntity = toMap.get(mainId);
      if (!targetEntity) continue;

      // 用目标 main bar 的位置作为终点，动画结束时 opacity 归零（淡出消失）
      const fakeTarget: RenderableEntity = {
        ...fromEntity,
        x: targetEntity.x,
        y: targetEntity.y,
        opacity: 0,
      };

      result.push(interpolateEntity(fromEntity, fakeTarget, transition, progress));
    }
  }

  return result;
}
