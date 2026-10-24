// Game model managing in-memory drawing strokes, phase, and turn state (PRD Section 9, 11)

import { GamePhase, Stroke, DrawingTool, BrushSize } from '../types';

export class Game {
  public phase: GamePhase = 'LOBBY';
  public drawerId: string = '';
  public strokes: Stroke[] = [];
  public currentStroke: Stroke | null = null;

  /**
   * Initializes the drawing phase for the specified drawer.
   * Cleans up any previous strokes (PRD Section 9: "strokes are cleared at the start of each turn").
   */
  public startDrawing(drawerId: string): void {
    this.phase = 'DRAWING';
    this.drawerId = drawerId;
    this.strokes = [];
    this.currentStroke = null;
  }

  /**
   * Starts a new stroke on the server
   */
  public startStroke(
    id: string,
    tool: DrawingTool,
    color: string,
    size: BrushSize,
    x: number,
    y: number
  ): Stroke {
    const stroke: Stroke = {
      id,
      tool,
      color,
      size,
      points: [{ x, y }],
    };

    // Safety limit: cap strokes per turn (PRD Section 17.9)
    if (this.strokes.length >= 1000) {
      this.strokes.shift(); // Remove oldest stroke if ceiling reached
    }

    this.strokes.push(stroke);
    this.currentStroke = stroke;
    return stroke;
  }

  /**
   * Appends a point to the active stroke
   */
  public addPoint(x: number, y: number): boolean {
    if (!this.currentStroke) return false;

    // Safety limit: cap points per stroke (PRD Section 16.3: "cap points per stroke e.g. 5000")
    if (this.currentStroke.points.length >= 5000) {
      return false;
    }

    this.currentStroke.points.push({ x, y });
    return true;
  }

  /**
   * Closes the active stroke
   */
  public endStroke(): void {
    this.currentStroke = null;
  }

  /**
   * Removes the most recent stroke (Undo)
   */
  public undo(): Stroke | undefined {
    this.currentStroke = null;
    return this.strokes.pop();
  }

  /**
   * Wipes all strokes on the canvas
   */
  public clear(): void {
    this.strokes = [];
    this.currentStroke = null;
  }

  /**
   * Returns a copy of all current strokes for late joiners or reconnects (canvas_sync)
   */
  public getStrokes(): Stroke[] {
    return [...this.strokes];
  }
}
