// Coordinate transformations for the HTML5 Canvas (PRD Section 9)

import { Point, CANVAS_LOGICAL_WIDTH, CANVAS_LOGICAL_HEIGHT } from '../types';

/**
 * Converts a browser PointerEvent's clientX/Y into normalized [0, 1] coordinates
 * relative to the canvas's visible bounding rect.
 */
export function getNormalizedCoords(
  e: React.PointerEvent<HTMLCanvasElement> | PointerEvent,
  canvas: HTMLCanvasElement
): Point {
  const rect = canvas.getBoundingClientRect();

  // Avoid division by zero in edge-case unmounted rendering
  const width = rect.width || CANVAS_LOGICAL_WIDTH;
  const height = rect.height || CANVAS_LOGICAL_HEIGHT;

  const rawX = (e.clientX - rect.left) / width;
  const rawY = (e.clientY - rect.top) / height;

  // Clamp within bounds [0, 1]
  return {
    x: Math.min(1, Math.max(0, rawX)),
    y: Math.min(1, Math.max(0, rawY)),
  };
}

/**
 * Converts normalized [0, 1] coordinates into actual logical pixel coordinates (800x600).
 */
export function toLogicalPixel(point: Point): { x: number; y: number } {
  return {
    x: point.x * CANVAS_LOGICAL_WIDTH,
    y: point.y * CANVAS_LOGICAL_HEIGHT,
  };
}

/**
 * Calculates Euclidean distance between two normalized points
 * Used to skip micro-movements (<0.002) to reduce network traffic (PRD Section 9)
 */
export function getDistance(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}
