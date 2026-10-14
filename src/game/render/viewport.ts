/**
 * Fits the fixed-size world (1280 x 768) into the canvas, preserving its aspect
 * ratio (letterbox). The world is uniformly scaled and centered; the area outside
 * is filled with water by the renderer, so nothing is ever cut or distorted.
 * Resizing never changes the simulation: it only affects presentation.
 */
export interface ViewportLayout {
  /** World-to-screen scale (CSS pixels per world pixel). */
  readonly scale: number;
  /** Screen position (CSS px) of the world origin. */
  readonly offsetX: number;
  readonly offsetY: number;
  readonly screenWidth: number;
  readonly screenHeight: number;
}

export function computeViewport(
  screenWidth: number,
  screenHeight: number,
  worldWidth: number,
  worldHeight: number,
): ViewportLayout {
  const width = Math.max(1, screenWidth);
  const height = Math.max(1, screenHeight);
  const scale = Math.min(width / worldWidth, height / worldHeight);
  return {
    scale,
    offsetX: (width - worldWidth * scale) / 2,
    offsetY: (height - worldHeight * scale) / 2,
    screenWidth: width,
    screenHeight: height,
  };
}

/** Converts a screen point (CSS px relative to the canvas) to world coordinates. */
export function screenToWorld(layout: ViewportLayout, x: number, y: number) {
  return {
    x: (x - layout.offsetX) / layout.scale,
    y: (y - layout.offsetY) / layout.scale,
  };
}

/** Converts a world point to screen coordinates (CSS px relative to the canvas). */
export function worldToScreen(layout: ViewportLayout, x: number, y: number) {
  return {
    x: layout.offsetX + x * layout.scale,
    y: layout.offsetY + y * layout.scale,
  };
}
