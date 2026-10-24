// Pure HTML5 Canvas 2D rendering routines for Doodle Dash (PRD Section 9)

import {
  Stroke,
  Point,
  DrawingTool,
  CANVAS_LOGICAL_WIDTH,
  CANVAS_LOGICAL_HEIGHT,
} from '../types';
import { toLogicalPixel } from './coords';

// Canvas background color (white paper drawing surface)
export const CANVAS_BG_COLOR = '#FFFFFF';

/**
 * Clears the canvas surface and fills it with the default background color
 */
export function clearCanvas(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = CANVAS_BG_COLOR;
  ctx.fillRect(0, 0, CANVAS_LOGICAL_WIDTH, CANVAS_LOGICAL_HEIGHT);
}

/**
 * Draws a single dot (used for pointer-down tap without moving)
 */
export function drawDot(
  ctx: CanvasRenderingContext2D,
  point: Point,
  color: string,
  size: number,
  tool: DrawingTool
): void {
  const logical = toLogicalPixel(point);

  ctx.save();
  ctx.fillStyle = tool === 'eraser' ? CANVAS_BG_COLOR : color;
  ctx.beginPath();
  ctx.arc(logical.x, logical.y, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Draws a smooth line segment between two consecutive points
 */
export function drawSegment(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  color: string,
  size: number,
  tool: DrawingTool
): void {
  const p1 = toLogicalPixel(from);
  const p2 = toLogicalPixel(to);

  ctx.save();
  ctx.strokeStyle = tool === 'eraser' ? CANVAS_BG_COLOR : color;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
  ctx.restore();
}

/**
 * Renders an entire stroke from its points array
 */
export function renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  if (stroke.points.length === 0) return;

  if (stroke.points.length === 1) {
    drawDot(ctx, stroke.points[0], stroke.color, stroke.size, stroke.tool);
    return;
  }

  ctx.save();
  ctx.strokeStyle = stroke.tool === 'eraser' ? CANVAS_BG_COLOR : stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  const first = toLogicalPixel(stroke.points[0]);
  ctx.moveTo(first.x, first.y);

  for (let i = 1; i < stroke.points.length; i++) {
    const p = toLogicalPixel(stroke.points[i]);
    ctx.lineTo(p.x, p.y);
  }

  ctx.stroke();
  ctx.restore();
}

/**
 * Redraws all remaining strokes after an undo or canvas_sync event (PRD Section 9)
 */
export function redrawAllStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[]): void {
  clearCanvas(ctx);
  for (const stroke of strokes) {
    renderStroke(ctx, stroke);
  }
}
