// Word list utilities for Doodle Dash (PRD Section 12.1, 12.2, 12.3)
//
// How this module works:
//   - words.json is loaded once at startup (categories with 30+ words each).
//   - pickWords(n, usedSet) picks n distinct random words the game hasn't used yet.
//   - normalizeGuess(text) cleans up a player's guess so "  CASTLE " == "castle".
//   - isClose(guess, word) returns true if the guess is just one letter off (Levenshtein ≤ 1)
//     for words that are 5+ letters long, so players get a private "So close!" hint.

import wordsData from '../data/words.json';

// Flatten all categories into a single word pool
const ALL_WORDS: string[] = Object.values(wordsData as Record<string, string[]>).flat();

/**
 * Pick n distinct words that have not been used this game.
 * If the pool is exhausted (all used), reset the used set and start fresh.
 *
 * @param n        How many words to return (e.g. wordCount setting)
 * @param usedSet  Words already played this game — modified in place when pool resets
 * @returns        Array of n word strings
 */
export function pickWords(n: number, usedSet: Set<string>): string[] {
  // Find words that haven't been used yet
  let available = ALL_WORDS.filter((w) => !usedSet.has(w));

  // If we don't have enough unused words, reset the used set (PRD 12.1)
  if (available.length < n) {
    usedSet.clear();
    available = [...ALL_WORDS];
  }

  // Fisher-Yates shuffle then take the first n words
  const shuffled = [...available];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const chosen = shuffled.slice(0, n);
  // Mark them as used so they don't appear again this game
  chosen.forEach((w) => usedSet.add(w));
  return chosen;
}

/**
 * Normalize a guess or word for comparison (PRD Section 12.3):
 *   1. Unicode NFKC normalization (handles accented chars, ligatures, etc.)
 *   2. Lowercase
 *   3. Trim leading/trailing whitespace
 *   4. Replace hyphens, underscores, and punctuation with spaces
 *   5. Collapse any repeated whitespace to a single space
 *
 * Examples:
 *   "  CASTLE " → "castle"
 *   "ice-cream" → "ice cream"
 *   "Ice_Cream!" → "ice cream"
 */
export function normalizeGuess(text: string): string {
  return text
    .normalize('NFKC')           // Unicode normalization
    .toLowerCase()               // case-insensitive
    .trim()                      // strip edge whitespace
    .replace(/[-_\p{P}]/gu, ' ') // punctuation/hyphens → space
    .replace(/\s+/g, ' ')        // collapse multiple spaces
    .trim();                     // trim again after replacement
}

/**
 * Check if a guess is "close" to the target word.
 *
 * "Close" means:
 *   - The word is 5+ letters long (too short → not close, trivially guessable)
 *   - Levenshtein edit distance between normalized guess and normalized word is exactly 1
 *     (one insertion, deletion, or substitution)
 *
 * A close guess is NOT correct and does NOT score points. It only triggers a private
 * "So close!" message so the guesser knows they're almost there (PRD Section 12.3).
 */
export function isClose(guess: string, word: string): boolean {
  const normGuess = normalizeGuess(guess);
  const normWord = normalizeGuess(word);

  // Word must be at least 5 letters to qualify as "close"
  if (normWord.replace(/\s/g, '').length < 5) return false;

  // Exact match is correct, not "close"
  if (normGuess === normWord) return false;

  return levenshtein(normGuess, normWord) === 1;
}

/**
 * Compute Levenshtein edit distance between two strings.
 * This is the classic dynamic programming approach — O(m × n) time.
 * Easy to explain in an interview: build a grid where each cell [i][j]
 * holds the min edits to convert s[0..i] to t[0..j].
 */
function levenshtein(s: string, t: string): number {
  const m = s.length;
  const n = t.length;

  // dp[i][j] = edit distance between s[0..i-1] and t[0..j-1]
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s[i - 1] === t[j - 1]) {
        // Characters match — no extra cost
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        // Pick the cheapest of: substitution, insertion, deletion
        dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i][j - 1], dp[i - 1][j]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Build the masked word that guessers see, e.g. "_ _ _ _ _" for "castle".
 * Spaces in the original word become a visible gap (extra space).
 * revealedIndices is the list of letter positions (ignoring spaces) already shown.
 *
 * Example: word="ice cream", revealedIndices=[2] → "_ _ _   _ R _ _ _"
 */
export function buildMask(word: string, revealedIndices: number[]): string {
  const revealedSet = new Set(revealedIndices);
  let letterIndex = 0; // counts only non-space characters
  const parts: string[] = [];

  for (const ch of word) {
    if (ch === ' ') {
      parts.push('  '); // double space to visually separate word parts
    } else {
      parts.push(revealedSet.has(letterIndex) ? ch.toUpperCase() : '_');
      letterIndex++;
    }
  }

  // Join with spaces between each character for the classic "_ _ _ _" look
  return parts.join(' ').replace(/   /g, '   '); // keep double space gaps clean
}
