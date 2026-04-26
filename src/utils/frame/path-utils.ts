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

function getPathCurveHeight(pathParams?: Record<string, number | string>) {
  const curveHeight = pathParams?.curveHeight;
  return typeof curveHeight === "number" ? curveHeight : 48;
}

function getPathMode(pathParams?: Record<string, number | string>) {
  return pathParams?.mode === "vertical-first" ? "vertical-first" : "horizontal-first";
}

export function getPathPoint(
  start: { x: number; y: number },
  end: { x: number; y: number },
  progress: number,
  pathParams?: Record<string, number | string>,
) {
  const curveHeight = getPathCurveHeight(pathParams);
  const mode = getPathMode(pathParams);
  const midX = mode === "vertical-first" ? start.x : end.x;
  const midY = mode === "vertical-first" ? end.y : start.y;

  if (progress <= 0.5) {
    const localProgress = progress / 0.5;
    return {
      x: lerp(start.x, midX, localProgress),
      y: lerp(start.y, midY, localProgress) - Math.sin(localProgress * Math.PI) * curveHeight,
    };
  }

  const localProgress = (progress - 0.5) / 0.5;
  return {
    x: lerp(midX, end.x, localProgress),
    y: lerp(midY, end.y, localProgress) - Math.sin((1 - localProgress) * Math.PI) * curveHeight * 0.35,
  };
}

export function getFadeOpacity(fromOpacity: number, toOpacity: number, progress: number) {
  if (progress <= 0.5) {
    return lerp(fromOpacity, 0, progress / 0.5);
  }

  return lerp(0, toOpacity, (progress - 0.5) / 0.5);
}
