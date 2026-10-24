// Input validation utilities (PRD Section 4.6, 9, 16.3, 17.5)

import {
  RoomSettings,
  DEFAULT_SETTINGS,
  WordMode,
  PALETTE_COLORS,
  BRUSH_SIZES,
  BrushSize,
  DrawingTool,
} from '../types';

/**
 * Validates player nickname:
 * - Must be a string
 * - Length between 1 and 20 characters (after trimming)
 */
export function validateNickname(name: unknown): { valid: boolean; value: string; error?: string } {
  if (typeof name !== 'string') {
    return { valid: false, value: '', error: 'Nickname must be a text string.' };
  }

  const trimmed = name.trim();
  if (trimmed.length < 1) {
    return { valid: false, value: '', error: 'Nickname cannot be empty.' };
  }
  if (trimmed.length > 20) {
    return { valid: false, value: '', error: 'Nickname cannot exceed 20 characters.' };
  }

  return { valid: true, value: trimmed };
}

/**
 * Validates room code format (6 alphanumeric characters, excluding look-alikes).
 */
export function validateRoomCode(code: unknown): { valid: boolean; value: string; error?: string } {
  if (typeof code !== 'string') {
    return { valid: false, value: '', error: 'Room code must be a text string.' };
  }

  const cleaned = code.trim().toUpperCase();
  if (cleaned.length !== 6) {
    return { valid: false, value: '', error: 'Room code must be exactly 6 characters.' };
  }

  return { valid: true, value: cleaned };
}

/**
 * Validates and sanitizes room settings against PRD Section 4.6 limits
 */
export function validateSettings(input: unknown): { valid: boolean; settings: RoomSettings; error?: string } {
  if (!input || typeof input !== 'object') {
    return { valid: true, settings: { ...DEFAULT_SETTINGS } };
  }

  const raw = input as Record<string, unknown>;

  const maxPlayers =
    typeof raw.maxPlayers === 'number' && Number.isInteger(raw.maxPlayers)
      ? Math.min(20, Math.max(2, raw.maxPlayers))
      : DEFAULT_SETTINGS.maxPlayers;

  const rounds =
    typeof raw.rounds === 'number' && Number.isInteger(raw.rounds)
      ? Math.min(10, Math.max(2, raw.rounds))
      : DEFAULT_SETTINGS.rounds;

  const drawTime =
    typeof raw.drawTime === 'number' && Number.isInteger(raw.drawTime)
      ? Math.min(240, Math.max(15, raw.drawTime))
      : DEFAULT_SETTINGS.drawTime;

  const wordCount =
    typeof raw.wordCount === 'number' && Number.isInteger(raw.wordCount)
      ? Math.min(5, Math.max(1, raw.wordCount))
      : DEFAULT_SETTINGS.wordCount;

  const hints =
    typeof raw.hints === 'number' && Number.isInteger(raw.hints)
      ? Math.min(5, Math.max(0, raw.hints))
      : DEFAULT_SETTINGS.hints;

  const wordMode: WordMode = raw.wordMode === 'Hidden' ? 'Hidden' : 'Normal';
  const isPublic = Boolean(raw.isPublic);
  const challengesEnabled =
    raw.challengesEnabled !== undefined ? Boolean(raw.challengesEnabled) : DEFAULT_SETTINGS.challengesEnabled;

  return {
    valid: true,
    settings: {
      maxPlayers,
      rounds,
      drawTime,
      wordCount,
      hints,
      wordMode,
      isPublic,
      challengesEnabled,
    },
  };
}

/**
 * Validates draw_start payload (PRD Section 16.3):
 * - x, y: finite numbers in [0, 1]
 * - tool: 'brush' | 'eraser'
 * - color: must be one of the approved 12 palette colors
 * - size: must be in [4, 10, 20]
 */
export function validateDrawStart(payload: unknown): {
  valid: boolean;
  data?: { x: number; y: number; tool: DrawingTool; color: string; size: BrushSize };
  error?: string;
} {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Invalid draw_start payload.' };
  }

  const raw = payload as Record<string, unknown>;

  if (typeof raw.x !== 'number' || !Number.isFinite(raw.x) || raw.x < 0 || raw.x > 1) {
    return { valid: false, error: 'Coordinate x must be a number between 0 and 1.' };
  }
  if (typeof raw.y !== 'number' || !Number.isFinite(raw.y) || raw.y < 0 || raw.y > 1) {
    return { valid: false, error: 'Coordinate y must be a number between 0 and 1.' };
  }

  const tool: DrawingTool = raw.tool === 'eraser' ? 'eraser' : 'brush';

  const rawColor = typeof raw.color === 'string' ? raw.color.toUpperCase() : '';
  const colorMatch = PALETTE_COLORS.find((c) => c.toUpperCase() === rawColor);
  const color = colorMatch || '#1E1B2E';

  const rawSize = typeof raw.size === 'number' ? raw.size : 10;
  const size: BrushSize = (BRUSH_SIZES as readonly number[]).includes(rawSize) ? (rawSize as BrushSize) : 10;

  return {
    valid: true,
    data: {
      x: raw.x,
      y: raw.y,
      tool,
      color,
      size,
    },
  };
}

/**
 * Validates draw_move payload (PRD Section 16.3):
 * - x, y: finite numbers in [0, 1]
 */
export function validateDrawMove(payload: unknown): {
  valid: boolean;
  data?: { x: number; y: number };
  error?: string;
} {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Invalid draw_move payload.' };
  }

  const raw = payload as Record<string, unknown>;

  if (typeof raw.x !== 'number' || !Number.isFinite(raw.x) || raw.x < 0 || raw.x > 1) {
    return { valid: false, error: 'Coordinate x must be a number between 0 and 1.' };
  }
  if (typeof raw.y !== 'number' || !Number.isFinite(raw.y) || raw.y < 0 || raw.y > 1) {
    return { valid: false, error: 'Coordinate y must be a number between 0 and 1.' };
  }

  return {
    valid: true,
    data: {
      x: raw.x,
      y: raw.y,
    },
  };
}
