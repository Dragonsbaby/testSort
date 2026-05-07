# 修复交换动画时序 bug

## Context

排序可视化中，交换动画存在严重的视觉 bug：动画播放时，柱子的高度和数值不匹配，导致用户看到"大的往小的方向移动"，动画完成后又瞬间变成正确顺序。

## 根因

在 `src/utils/frame/interpolate-entity.ts` 第 34-44 行，`interpolateEntity` 函数返回时使用 `...to` 展开：

```typescript
return {
  ...to,  // ← to.value 已经是交换后的值了
  x,
  y,
  height: isSwapMove ? from.height : lerp(...),  // 高度正确保持 from
  // 但 value 没有保持 from 的值！
};
```

对于 swap 动画：
- `from` 实体：value=5（大）, height=大
- `to` 实体：value=3（小）, height=小

动画过程中：
- **高度**保持为 `from.height`（大）✓ 正确
- **数值 `value`** 却是 `to.value`（3）✗ 错误！

结果：大柱子显示小值，小柱子显示大值。

## 修复方案

在 `src/utils/frame/interpolate-entity.ts` 第 34 行的返回对象中，增加 `value` 的处理：

```typescript
return {
  ...to,
  x,
  y,
  width: lerp(from.width, to.width, progress),
  height: isSwapMove ? from.height : lerp(from.height, to.height, progress),
  value: isSwapMove ? from.value : to.value,  // ← 新增
  opacity: ...,
  style: ...,
};
```

这样 swap 动画中，数值与高度保持一致，都是 from 的值。动画完成后，`syncArray` 会更新显示为正确的值。

## 修改文件

- `src/utils/frame/interpolate-entity.ts` — 第 34-44 行，增加 `value` 处理

## 验证

1. 运行任意排序算法（如冒泡排序）
2. 观察交换动画：柱子的高度和数值应该始终匹配
3. 动画完成后，数值应该正确更新为交换后的值
