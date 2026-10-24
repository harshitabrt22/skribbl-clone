// Scoring logic for Doodle Dash (PRD Section 13.1, 13.5)
//
// WHY a separate file? Scoring is pure math with no side effects — easy to unit test
// and easy to explain in an interview without understanding the whole server.
//
// GUESSER POINTS:
//   base = 100 + floor(200 × remainingTime / totalTime)
//   → Fastest guess = 300 pts, last-second guess = 100 pts (never below 100)
//
// STREAK BONUS (Feature C):
//   Streak = consecutive turns where the player guessed correctly.
//   Bonus = min(streak - 1, 4) × 20   (so streak 1 → +0, streak 5+ → +80)
//
// DRAWER POINTS: +50 per correct guesser, awarded inside Game.handleGuess().

/**
 * Calculate the total points a guesser earns for one correct answer.
 *
 * @param remainingTime  Seconds left on the draw timer when the guess lands
 * @param totalTime      Total draw time for this turn (from room settings)
 * @param streak         Player's NEW streak AFTER this guess is counted
 *                       (i.e. already incremented: streak 1 means first-ever correct guess)
 * @returns              Object with basePoints, streakBonus, and total
 */
export function calcGuessPoints(
  remainingTime: number,
  totalTime: number,
  streak: number = 0
): { basePoints: number; streakBonus: number; total: number } {
  // Base: 100 guaranteed + up to 200 for speed (PRD 13.1)
  // Clamp to 100 minimum in case remaining > total due to floating point
  const ratio = totalTime > 0 ? Math.max(0, Math.min(1, remainingTime / totalTime)) : 0;
  const basePoints = 100 + Math.floor(200 * ratio);

  // Streak bonus: streak <= 1 gives 0; each extra streak level gives +20 up to +80
  const streakBonus = streak > 1 ? Math.min(streak - 1, 4) * 20 : 0;

  return { basePoints, streakBonus, total: basePoints + streakBonus };
}

/**
 * Points awarded to the drawer for each correct guesser (PRD 13.1).
 * Flat +50 per guesser; no streak or time dependency.
 */
export const DRAWER_POINTS_PER_GUESSER = 50;
