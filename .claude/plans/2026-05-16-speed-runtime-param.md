# 计划：speed 改为运行时参数，调速不重置动画

## Context

**问题：** 调整动画速率时，`watch(speed, rebuild)` 触发完整重建（`sortFn` + `buildTimeline`），动画重置回初始状态。

**根本原因：** `stepDuration` 在 `buildTimeline` 时被烘焙进每个 `TimelineStep.duration`（绝对毫秒数）。速率变化后旧 timeline 的时间数据全部作废，必须重建。

**期望行为：** 调整速率时，当前动画原地继续播放，只是快慢变化，不重置。

**方案：** `TimelineStep.duration` 和 `Transition.duration` 改存**单位倍数**（`1` / `2` / `3`），播放器消费时乘以当前 `speed`。`speed` 变化只更新 ref，不触发 rebuild。

---

## 关键文件

- `src/composables/useTimelinePlayer.ts` — 消费 `speed`，动态计算实际 duration
- `src/utils/timeline-builders/build-basic-timeline.ts` — duration 改为倍数
- `src/utils/timeline-builders/build-merge-timeline.ts` — duration 改为倍数
- `src/utils/timeline-builders/build-bucket-timeline.ts` — duration 改为倍数
- `src/utils/timeline-builders/build-heap-timeline.ts` — duration 改为倍数
- `src/composables/useSortAnimation.ts` — 移除 `watch(speed, rebuild)`，改为传 speed ref 给 player
- `src/types/timeline.ts` — （可选）注释说明 duration 语义变更

---

## 实施步骤

### Step 1：修改各 timeline builder，duration 改存倍数

各 builder 移除 `stepDuration` 参数（或保留但不再使用），`duration` 改为固定倍数：

| 步骤类型 | 原来 | 改后 |
|---|---|---|
| 普通步骤（compare、sorted 等） | `stepDuration` | `1` |
| swap / merge-set / merge-back | `stepDuration * 3` | `3` |
| bucket-scatter / bucket-gather | `stepDuration * 2` | `2` |
| bucket-swap | `stepDuration * 3` | `3` |

`TimelineStep.duration` 和 `Transition.duration` 同步修改（两处赋值表达式始终一致）。

各 builder 函数签名移除 `stepDuration` 参数（build-basic、build-merge、build-bucket、build-heap 均有此参数）。

---

### Step 2：修改 `useTimelinePlayer`，消费 speed

**修改函数签名**，接收 `speed` ref：
```ts
export function useTimelinePlayer(
  steps: () => TimelineStep[],
  speed: Ref<number>   // 新增
)
```

**修改 `getStepDuration()`**：
```ts
function getStepDuration() {
  const multiplier = currentTimelineStep.value?.duration ?? 1;
  return multiplier * speed.value;
}
```

`play()` 和 `stepForward()` 中所有 `getStepDuration()` 调用不变，自动获得运行时速率。

**`stepStartedAt` 补偿逻辑不变**（`play()` 第59行）：
```ts
stepStartedAt = performance.now() - getStepDuration() * progress.value;
```
`speed` 变化时若正在播放，下一帧 rAF 调用 `getStepDuration()` 就会读到新值，`stepStartedAt` 在下一次 `play()` 恢复时自动补偿。

> **注意：** `speed` 变化发生在 rAF 循环中间时，当前帧的 `elapsed` 已用旧 `stepStartedAt` 计算，新速率从下一帧生效。这是可接受的单帧误差，不会造成跳帧或动画乱序。

---

### Step 3：修改 `useSortAnimation.ts`

1. **移除** `watch(() => speed.value, () => rebuild())` 这个 watch
2. **传入 speed** 给 `useTimelinePlayer`：
   ```ts
   const player = useTimelinePlayer(() => timelineSteps.value, speed);
   ```
3. **各 builder 调用处移除 `stepDuration` 参数**（build-basic、build-merge、build-bucket、build-heap）

---

## 验证方式

1. 播放排序动画到中途 → 拖动速率 slider → 动画继续播放，速率变化，不重置
2. 暂停后调整速率 → 继续播放，速率已更新
3. swap/飞行动画的相对时长仍是普通步骤的 2x/3x（视觉验证）
4. 调整元素数量仍正常重置（rebuild 仍由 originalArray watch 触发）
5. 调整速率不再触发 rebuild（可在 rebuild 加 console.log 验证）
