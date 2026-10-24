// Input validation utilities (PRD Section 4.6, 17.5)

import { RoomSettings, DEFAULT_SETTINGS, WordMode } from '../types';

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
 * Validates and sanitizes room settings against PRD Section 4.6 limits:
 * - maxPlayers: 2 - 20
 * - rounds: 2 - 10
 * - drawTime: 15 - 240 seconds
 * - wordCount: 1 - 5 choices
 * - hints: 0 - 5
 * - wordMode: 'Normal' | 'Hidden'
 * - isPublic: boolean
 * - challengesEnabled: boolean
 */
export function validateSettings(input: unknown): { valid: boolean; settings: RoomSettings; error?: string } {
  if (!input || typeof input !== 'object') {
    return { valid: true, settings: { ...DEFAULT_SETTINGS } };
  }

  const raw = input as Record<string, unknown>;

  const maxPlayers = typeof raw.maxPlayers === 'number' && Number.isInteger(raw.maxPlayers)
    ? Math.min(20, Math.max(2, raw.maxPlayers))
    : DEFAULT_SETTINGS.maxPlayers;

  const rounds = typeof raw.rounds === 'number' && Number.isInteger(raw.rounds)
    ? Math.min(10, Math.max(2, raw.rounds))
    : DEFAULT_SETTINGS.rounds;

  const drawTime = typeof raw.drawTime === 'number' && Number.isInteger(raw.drawTime)
    ? Math.min(240, Math.max(15, raw.drawTime))
    : DEFAULT_SETTINGS.drawTime;

  const wordCount = typeof raw.wordCount === 'number' && Number.isInteger(raw.wordCount)
    ? Math.min(5, Math.max(1, raw.wordCount))
    : DEFAULT_SETTINGS.wordCount;

  const hints = typeof raw.hints === 'number' && Number.isInteger(raw.hints)
    ? Math.min(5, Math.max(0, raw.hints))
    : DEFAULT_SETTINGS.hints;

  const wordMode: WordMode = raw.wordMode === 'Hidden' ? 'Hidden' : 'Normal';
  const isPublic = Boolean(raw.isPublic);
  const challengesEnabled = raw.challengesEnabled !== undefined ? Boolean(raw.challengesEnabled) : DEFAULT_SETTINGS.challengesEnabled;

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
