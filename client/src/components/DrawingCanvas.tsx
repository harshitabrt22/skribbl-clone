// DrawingCanvas component for real-time multiplayer sketching (PRD Section 9, 16.3, 17)

/**
 * ==============================================================================
 * HOW A DRAWING STROKE TRAVELS (MOUSE -> SERVER -> OTHER CLIENTS -> CANVAS):
 * ==============================================================================
 *
 * 1. POINTER EVENT CAPTURE (Drawer Client):
 *    - The drawer presses their pointer (mouse, stylus, touch) on the <canvas>.
 *    - `onPointerDown` uses `canvas.setPointerCapture(e.pointerId)` so tracking
 *      continues smoothly even if the cursor momentarily slides outside the canvas.
 *    - Normalized coordinates (0 to 1) are computed relative to `getBoundingClientRect()`.
 *    - The drawer immediately renders the initial dot locally on their own canvas
 *      so there is zero input delay or perceived network latency (optimistic UI).
 *    - The drawer emits `draw_start { x, y, color, size, tool }` to the Socket.IO server.
 *
 * 2. SERVER AUTHORIZATION & BROADCAST:
 *    - The server validates the sender's identity (`socket.id` must match `game.drawerId`).
 *    - The server validates the game phase (must be `DRAWING`).
 *    - The server validates that coordinates are finite numbers in [0, 1] and tool/color/size
 *      belong to the approved palette.
 *    - The server stores the new `Stroke` in its in-memory array (`room.game.strokes`).
 *    - The server broadcasts `draw_data { type: 'start', strokeId, ... }` to
 *      `socket.to(room.code)` (every socket in the room EXCEPT the drawer, preventing double drawing).
 *
 * 3. REAL-TIME STREAMING (Pointer Move):
 *    - As the drawer drags the pointer, `onPointerMove` computes new normalized (x, y).
 *    - If movement distance is < 0.002, it is skipped to avoid flooding the WebSocket.
 *    - The drawer renders the line segment locally between the last point and current point.
 *    - The drawer emits `draw_move { x, y }`.
 *    - The server verifies rate limits (<= 120/sec), appends the point to `currentStroke`,
 *      and broadcasts `draw_data { type: 'move', x, y }` to viewers.
 *
 * 4. REMOTE RENDERING (Viewer Clients):
 *    - Viewers' browsers receive the `draw_data` event via their Socket.IO listener.
 *    - If `type === 'start'`: Viewers create a new remote stroke and render the starting dot.
 *    - If `type === 'move'`: Viewers render a smooth line segment to the new point using round caps.
 *    - If `type === 'end'`: Viewers close the remote stroke and commit it to their local list.
 *
 * 5. SYNCHRONIZATION, UNDO & CLEAR:
 *    - Undo: Server removes the last stroke from its memory array and broadcasts `draw_undo`.
 *      All clients remove the last stroke from their local stroke array and redraw remaining strokes.
 *    - Clear: Server wipes its strokes and broadcasts `canvas_clear`.
 *      All clients wipe their canvas with the background color.
 *    - Reconnection / Late Join: Server sends `canvas_sync { strokes }`. The client replays
 *      all existing strokes onto the canvas.
 * ==============================================================================
 */

import React, { useEffect, useRef } from 'react';
import { socket } from '../socket';
import {
  Stroke,
  Point,
  DrawingTool,
  BrushSize,
  DrawDataPayload,
  CANVAS_LOGICAL_WIDTH,
  CANVAS_LOGICAL_HEIGHT,
} from '../types';
import { getNormalizedCoords, getDistance } from '../lib/coords';
import {
  clearCanvas,
  drawDot,
  drawSegment,
  redrawAllStrokes,
} from '../lib/canvasRenderer';

interface DrawingCanvasProps {
  isDrawer: boolean;
  currentTool: DrawingTool;
  currentColor: string;
  currentSize: BrushSize;
  onRejectToast?: (reason: string) => void;
  onStrokeStart?: (color: string, tool: DrawingTool) => void;
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  isDrawer,
  currentTool,
  currentColor,
  currentSize,
  onRejectToast,
  onStrokeStart,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // In-memory list of all strokes currently rendered on this client
  const strokesRef = useRef<Stroke[]>([]);

  // Active stroke being drawn locally (if this client is the drawer)
  const isDrawingLocally = useRef<boolean>(false);
  const localLastPoint = useRef<Point | null>(null);

  // Active stroke being drawn remotely by the drawer (if this client is a viewer)
  const remoteCurrentStroke = useRef<Stroke | null>(null);

  // Keep a stable ref to onRejectToast and onStrokeStart so the socket effect doesn't re-run on every render
  const onRejectToastRef = useRef(onRejectToast);
  useEffect(() => {
    onRejectToastRef.current = onRejectToast;
  }, [onRejectToast]);

  const onStrokeStartRef = useRef(onStrokeStart);
  useEffect(() => {
    onStrokeStartRef.current = onStrokeStart;
  }, [onStrokeStart]);

  // Initialize canvas on mount and register socket listeners (runs once on mount)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Preserve existing strokes if already present, otherwise paint initial white background
    if (strokesRef.current.length > 0) {
      redrawAllStrokes(ctx, strokesRef.current);
    } else {
      clearCanvas(ctx);
    }

    // Socket Event: draw_data (received by viewers)
    const onDrawData = (data: DrawDataPayload) => {
      const currentCtx = canvas.getContext('2d');
      if (!currentCtx) return;

      if (data.type === 'start') {
        const point: Point = { x: data.x || 0, y: data.y || 0 };
        const tool: DrawingTool = data.tool || 'brush';
        const color: string = data.color || '#1E1B2E';
        const size: number = data.size || 10;

        drawDot(currentCtx, point, color, size, tool);

        const newStroke: Stroke = {
          id: data.strokeId,
          tool,
          color,
          size,
          points: [point],
        };

        remoteCurrentStroke.current = newStroke;
        strokesRef.current.push(newStroke);
      } else if (data.type === 'move') {
        if (!remoteCurrentStroke.current) return;
        const toPoint: Point = { x: data.x || 0, y: data.y || 0 };
        const points = remoteCurrentStroke.current.points;
        const fromPoint = points[points.length - 1];

        drawSegment(
          currentCtx,
          fromPoint,
          toPoint,
          remoteCurrentStroke.current.color,
          remoteCurrentStroke.current.size,
          remoteCurrentStroke.current.tool
        );

        points.push(toPoint);
      } else if (data.type === 'end') {
        remoteCurrentStroke.current = null;
      }
    };

    // Socket Event: draw_undo (received by everyone)
    const onDrawUndo = () => {
      strokesRef.current.pop();
      const currentCtx = canvas.getContext('2d');
      if (currentCtx) {
        redrawAllStrokes(currentCtx, strokesRef.current);
      }
    };

    // Socket Event: canvas_clear (received by everyone)
    const onCanvasClear = () => {
      strokesRef.current = [];
      remoteCurrentStroke.current = null;
      const currentCtx = canvas.getContext('2d');
      if (currentCtx) {
        clearCanvas(currentCtx);
      }
    };

    // Socket Event: canvas_sync (received on join or turn start)
    const onCanvasSync = (data: { strokes: Stroke[] }) => {
      strokesRef.current = data.strokes || [];
      remoteCurrentStroke.current = null;
      const currentCtx = canvas.getContext('2d');
      if (currentCtx) {
        redrawAllStrokes(currentCtx, strokesRef.current);
      }
    };

    // Socket Event: draw_rejected (shown as toast to sender)
    const onDrawRejected = (data: { reason: string }) => {
      onRejectToastRef.current?.(data.reason);
    };

    socket.on('draw_data', onDrawData);
    socket.on('draw_undo', onDrawUndo);
    socket.on('canvas_clear', onCanvasClear);
    socket.on('canvas_sync', onCanvasSync);
    socket.on('draw_rejected', onDrawRejected);

    return () => {
      socket.off('draw_data', onDrawData);
      socket.off('draw_undo', onDrawUndo);
      socket.off('canvas_clear', onCanvasClear);
      socket.off('canvas_sync', onCanvasSync);
      socket.off('draw_rejected', onDrawRejected);
    };
  }, []);

  // 1. POINTER DOWN (Drawer begins a stroke)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Capture pointer so move/up events continue even if cursor leaves canvas boundary
    canvas.setPointerCapture(e.pointerId);

    isDrawingLocally.current = true;
    const point = getNormalizedCoords(e, canvas);
    localLastPoint.current = point;

    // Notify parent of stroke start (for tracking usedColors in challenges)
    onStrokeStartRef.current?.(currentColor, currentTool);

    // Optimistic local render: draw dot immediately
    drawDot(ctx, point, currentColor, currentSize, currentTool);

    // Save stroke locally
    const strokeId = `s_local_${Date.now()}`;
    const newStroke: Stroke = {
      id: strokeId,
      tool: currentTool,
      color: currentColor,
      size: currentSize,
      points: [point],
    };
    strokesRef.current.push(newStroke);

    // Emit draw_start to server
    socket.emit('draw_start', {
      x: point.x,
      y: point.y,
      color: currentColor,
      size: currentSize,
      tool: currentTool,
    });
  };

  // 2. POINTER MOVE (Drawer drags brush)
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !isDrawingLocally.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx || !localLastPoint.current) return;

    const currentPoint = getNormalizedCoords(e, canvas);

    // Skip micro-movements (<0.002 distance) to reduce network bandwidth (PRD Section 9)
    if (getDistance(localLastPoint.current, currentPoint) < 0.002) {
      return;
    }

    // Optimistic local render: draw line segment
    drawSegment(
      ctx,
      localLastPoint.current,
      currentPoint,
      currentColor,
      currentSize,
      currentTool
    );

    // Append to local stroke
    const activeStroke = strokesRef.current[strokesRef.current.length - 1];
    if (activeStroke) {
      activeStroke.points.push(currentPoint);
    }

    localLastPoint.current = currentPoint;

    // Emit draw_move to server
    socket.emit('draw_move', {
      x: currentPoint.x,
      y: currentPoint.y,
    });
  };

  // 3. POINTER UP / LEAVE / CANCEL (Drawer lifts brush)
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !isDrawingLocally.current) return;

    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }

    isDrawingLocally.current = false;
    localLastPoint.current = null;

    // Emit draw_end to server
    socket.emit('draw_end', {});
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '800px',
        margin: '0 auto',
      }}
    >
      <canvas
        ref={canvasRef}
        width={CANVAS_LOGICAL_WIDTH}
        height={CANVAS_LOGICAL_HEIGHT}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          display: 'block',
          width: '100%',
          aspectRatio: '4 / 3',
          border: 'var(--border-thick)',
          borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-chunky)',
          backgroundColor: '#FFFFFF',
          cursor: isDrawer ? (currentTool === 'eraser' ? 'cell' : 'crosshair') : 'default',
          touchAction: 'none', // Crucial for Pointer Events on mobile/touch screens
        }}
      />
    </div>
  );
};
