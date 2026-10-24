// Drawing Challenge Cards for Doodle Dash (Feature A — PRD Section 13.4, 23.4)
//
// CARDS:
//   1. TWO_COLORS: "Use only two colors." (Server-enforced; eraser excluded)
//   2. ONE_STROKE: "Draw without lifting the brush." (Server-enforced; 1 stroke only; undo/clear blocked)
//   3. SPEED_DRAW: "Beat the clock: half the normal time." (Server-enforced: max(15, round(drawTime * 0.5)))
//   4. HONOR_NO_LETTERS: "Draw it without any letters or numbers." (Honor-system; no reward)
//
// REWARD:
//   Drawer gets +25 bonus points at turn end if they accepted an ENFORCED challenge
//   and at least 1 guesser guessed the word.

export type ChallengeId = 'TWO_COLORS' | 'ONE_STROKE' | 'SPEED_DRAW' | 'HONOR_NO_LETTERS';

export interface ChallengeCard {
  id: ChallengeId;
  title: string;
  description: string;
  enforced: boolean;
  reward: number;
}

export const CHALLENGE_CARDS: Record<ChallengeId, ChallengeCard> = {
  TWO_COLORS: {
    id: 'TWO_COLORS',
    title: 'Two Colors Only',
    description: 'Use only two colors for this drawing.',
    enforced: true,
    reward: 25,
  },
  ONE_STROKE: {
    id: 'ONE_STROKE',
    title: 'One Continuous Stroke',
    description: 'Draw without lifting the brush. Undo and clear are disabled.',
    enforced: true,
    reward: 25,
  },
  SPEED_DRAW: {
    id: 'SPEED_DRAW',
    title: 'Speed Draw',
    description: 'Beat the clock: half the normal drawing time!',
    enforced: true,
    reward: 25,
  },
  HONOR_NO_LETTERS: {
    id: 'HONOR_NO_LETTERS',
    title: 'No Letters or Numbers',
    description: 'Draw without any letters or numbers (Honor system).',
    enforced: false,
    reward: 0,
  },
};

export const CHALLENGE_IDS: ChallengeId[] = ['TWO_COLORS', 'ONE_STROKE', 'SPEED_DRAW', 'HONOR_NO_LETTERS'];

/**
 * Randomly pick one challenge card to offer to the drawer.
 */
export function getRandomChallenge(): ChallengeCard {
  const index = Math.floor(Math.random() * CHALLENGE_IDS.length);
  return CHALLENGE_CARDS[CHALLENGE_IDS[index]];
}

export interface ActiveChallengeState {
  card: ChallengeCard;
  accepted: boolean;
  usedColors: Set<string>;
  strokeCount: number;
}

/**
 * Validate a draw_start against active challenge rules.
 */
export function validateDrawStartChallenge(
  challenge: ActiveChallengeState | null,
  tool: string,
  color: string
): { valid: boolean; reason?: string } {
  if (!challenge || !challenge.accepted) {
    return { valid: true };
  }

  // ONE_STROKE: only first draw_start allowed
  if (challenge.card.id === 'ONE_STROKE') {
    if (challenge.strokeCount >= 1) {
      return {
        valid: false,
        reason: 'One Continuous Stroke challenge: you cannot lift the brush!',
      };
    }
  }

  // TWO_COLORS: brush strokes cannot use a third distinct color (eraser excluded)
  if (challenge.card.id === 'TWO_COLORS' && tool === 'brush') {
    if (!challenge.usedColors.has(color) && challenge.usedColors.size >= 2) {
      return {
        valid: false,
        reason: 'Two Colors Only challenge: you have already used 2 colors!',
      };
    }
  }

  return { valid: true };
}

/**
 * Record a started stroke in the challenge state.
 */
export function recordStrokeInChallenge(
  challenge: ActiveChallengeState | null,
  tool: string,
  color: string
): void {
  if (!challenge || !challenge.accepted) return;

  challenge.strokeCount += 1;
  if (tool === 'brush') {
    challenge.usedColors.add(color);
  }
}

/**
 * Validate undo request against active challenge.
 */
export function validateUndoChallenge(challenge: ActiveChallengeState | null): { valid: boolean; reason?: string } {
  if (challenge && challenge.accepted && challenge.card.id === 'ONE_STROKE') {
    return {
      valid: false,
      reason: 'Undo is disabled during the One Continuous Stroke challenge!',
    };
  }
  return { valid: true };
}

/**
 * Validate clear request against active challenge.
 */
export function validateClearChallenge(challenge: ActiveChallengeState | null): { valid: boolean; reason?: string } {
  if (challenge && challenge.accepted && challenge.card.id === 'ONE_STROKE') {
    return {
      valid: false,
      reason: 'Clear is disabled during the One Continuous Stroke challenge!',
    };
  }
  return { valid: true };
}

/**
 * Compute challenge bonus points at turn end.
 * Only awarded if accepted, enforced, and >= 1 guesser got the word.
 */
export function calcChallengeBonus(
  challenge: ActiveChallengeState | null,
  correctGuessersCount: number
): number {
  if (!challenge || !challenge.accepted) return 0;
  if (!challenge.card.enforced) return 0;
  if (correctGuessersCount < 1) return 0;
  return challenge.card.reward;
}

/**
 * Calculate effective draw time taking SPEED_DRAW challenge into account.
 */
export function calcTurnDrawTime(baseDrawTime: number, challenge: ActiveChallengeState | null): number {
  if (challenge && challenge.accepted && challenge.card.id === 'SPEED_DRAW') {
    return Math.max(15, Math.round(baseDrawTime * 0.5));
  }
  return baseDrawTime;
}
