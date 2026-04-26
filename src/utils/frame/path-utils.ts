export function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

export function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

export function easeInOutCubic(progress: number) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

export function getArcPoint(start: { x: number; y: number }, end: { x: number; y: number }, progress: number, arcHeight: number) {
  return {
    x: lerp(start.x, end.x, progress),
    y: lerp(start.y, end.y, progress) - Math.sin(progress * Math.PI) * arcHeight,
  };
}
