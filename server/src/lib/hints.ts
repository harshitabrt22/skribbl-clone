// Progressive Hints logic for Doodle Dash (Feature B — PRD Section 13.3, 16.2, 23.2)
//
// HOW PROGRESSIVE HINTS WORK:
//   - When drawing begins, the server calculates effective hints:
//       h = min(settings.hints, floor(wordLetterCount / 2))
//     (At least half of the letters always stay hidden).
//   - In 'Hidden' word mode, hints are completely disabled (h = 0).
//   - Reveals are scheduled at: drawTime × k / (h + 1) for k = 1..h.
//     Example: drawTime=80s, h=2 → reveals at ~26.7s and ~53.3s.
//   - Letter indices (excluding spaces) are shuffled at turn start.
//   - At each scheduled time, the next letter is revealed into revealedIndices.
//   - Server emits `hint_update { mask, revealedCount }` to all clients EXCEPT the drawer.
//   - Drawer already knows the word; reconnecting guessers receive current mask via game_state.
//   - The raw word or index list NEVER leaks to guessers before round_end (secrecy guarantee).

import { WordMode } from '../types';

/**
 * Calculate the effective number of letter hints allowed for a given word and settings.
 *
 * Rules (PRD 13.3):
 *   1. If wordMode is 'Hidden', return 0 (no hints in hidden mode).
 *   2. If hints setting <= 0, return 0.
 *   3. Effective hints cannot exceed floor(wordLetterCount / 2) so at least
 *      half the word is always hidden.
 *      (e.g., 5-letter word → max 2 hints; 3-letter word → max 1; 1-letter → 0).
 *
 * @param hintsSetting    Host-configured hints (0–5)
 * @param word            Target word string
 * @param wordMode        'Normal' | 'Hidden' (default: 'Normal')
 * @returns               Number of hints to reveal (0 to 5)
 */
export function calculateEffectiveHints(
  hintsSetting: number,
  word: string,
  wordMode: WordMode = 'Normal'
): number {
  if (wordMode === 'Hidden') return 0;
  if (!hintsSetting || hintsSetting <= 0) return 0;

  // Count only actual letters (exclude spaces and punctuation)
  const letterCount = word.replace(/[\s\-_]/g, '').length;
  if (letterCount <= 1) return 0;

  const maxAllowed = Math.floor(letterCount / 2);
  return Math.min(Math.floor(hintsSetting), maxAllowed);
}

/**
 * Calculate the schedule of reveal times (in seconds from turn start).
 *
 * Formula: reveal #k (k = 1..h) happens at drawTime × k / (h + 1).
 *
 * Example:
 *   drawTime = 60s, hints = 2 → [20, 40]
 *   drawTime = 80s, hints = 2 → [27, 53] (rounded to nearest second)
 *
 * @param drawTime   Total turn duration in seconds
 * @param hintCount  Effective number of hints to reveal
 * @returns          Array of second offsets from round start [t1, t2, ...]
 */
export function getHintSchedule(drawTime: number, hintCount: number): number[] {
  if (hintCount <= 0 || drawTime <= 0) return [];

  const schedule: number[] = [];
  for (let k = 1; k <= hintCount; k++) {
    const timeInSeconds = Math.round((drawTime * k) / (hintCount + 1));
    schedule.push(timeInSeconds);
  }
  return schedule;
}

/**
 * Pick a random sequence of non-space letter indices to reveal in order.
 * Uses Fisher-Yates shuffle.
 *
 * @param letterCount  Number of non-space letters in the word
 * @param hintCount    How many indices to return
 * @returns            Array of 0-based letter indices to reveal in order
 */
export function pickHintIndices(letterCount: number, hintCount: number): number[] {
  if (hintCount <= 0 || letterCount <= 0) return [];

  // 0-based indices for each letter in the word
  const indices = Array.from({ length: letterCount }, (_, i) => i);

  // Fisher-Yates shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  return indices.slice(0, Math.min(hintCount, letterCount));
}

/**
 * Build the masked word string displayed to guessers (e.g. "_ _ _ _ _" or "_ A _ _ E _").
 *
 * @param word              The secret word
 * @param revealedIndices   Set or array of 0-based letter indices already revealed
 * @param wordMode          'Normal' | 'Hidden'
 * @returns                 Formatted mask string
 */
export function buildMask(
  word: string,
  revealedIndices: number[] | Set<number>,
  wordMode: WordMode = 'Normal'
): string {
  if (wordMode === 'Hidden') {
    return '?';
  }

  const revealedSet = revealedIndices instanceof Set ? revealedIndices : new Set(revealedIndices);
  let letterIndex = 0;
  const words = word.split(' ');

  const maskedWords = words.map((w) => {
    const chars = [];
    for (const ch of w) {
      chars.push(revealedSet.has(letterIndex) ? ch.toUpperCase() : '_');
      letterIndex++;
    }
    return chars.join(' ');
  });

  return maskedWords.join('   ');
}
