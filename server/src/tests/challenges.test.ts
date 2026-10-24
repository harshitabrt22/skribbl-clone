// Unit tests for Feature A (Challenge Cards)
// PRD Section 13.4, 23.4 (AC-CH-1 to AC-CH-6)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHALLENGE_CARDS,
  validateDrawStartChallenge,
  recordStrokeInChallenge,
  validateUndoChallenge,
  validateClearChallenge,
  calcChallengeBonus,
  calcTurnDrawTime,
  ActiveChallengeState,
} from '../lib/challenges';

function makeState(id: keyof typeof CHALLENGE_CARDS, accepted = true): ActiveChallengeState {
  return {
    card: CHALLENGE_CARDS[id],
    accepted,
    usedColors: new Set<string>(),
    strokeCount: 0,
  };
}

// ─── TWO_COLORS tests (AC-CH-2) ─────────────────────────────────────────────

test('TWO_COLORS: allows first two distinct brush colors', () => {
  const state = makeState('TWO_COLORS');
  assert.equal(validateDrawStartChallenge(state, 'brush', '#1E1B2E').valid, true);
  recordStrokeInChallenge(state, 'brush', '#1E1B2E');

  assert.equal(validateDrawStartChallenge(state, 'brush', '#E5484D').valid, true);
  recordStrokeInChallenge(state, 'brush', '#E5484D');

  // Re-using either of the two colors is allowed
  assert.equal(validateDrawStartChallenge(state, 'brush', '#1E1B2E').valid, true);
});

test('TWO_COLORS: rejects third distinct color with reason (AC-CH-2)', () => {
  const state = makeState('TWO_COLORS');
  recordStrokeInChallenge(state, 'brush', '#1E1B2E');
  recordStrokeInChallenge(state, 'brush', '#E5484D');

  const check = validateDrawStartChallenge(state, 'brush', '#4C6FFF');
  assert.equal(check.valid, false);
  assert.ok(check.reason && check.reason.includes('Two Colors'));
});

test('TWO_COLORS: eraser strokes do not count against color allowance', () => {
  const state = makeState('TWO_COLORS');
  recordStrokeInChallenge(state, 'brush', '#1E1B2E');
  recordStrokeInChallenge(state, 'brush', '#E5484D');

  // Eraser is allowed regardless of color
  const eraserCheck = validateDrawStartChallenge(state, 'eraser', '#FFFFFF');
  assert.equal(eraserCheck.valid, true);
  recordStrokeInChallenge(state, 'eraser', '#FFFFFF');

  assert.equal(state.usedColors.size, 2);
});

// ─── ONE_STROKE tests (AC-CH-3) ─────────────────────────────────────────────

test('ONE_STROKE: allows first stroke, rejects second stroke (AC-CH-3)', () => {
  const state = makeState('ONE_STROKE');
  assert.equal(validateDrawStartChallenge(state, 'brush', '#1E1B2E').valid, true);
  recordStrokeInChallenge(state, 'brush', '#1E1B2E');

  const secondStroke = validateDrawStartChallenge(state, 'brush', '#1E1B2E');
  assert.equal(secondStroke.valid, false);
  assert.ok(secondStroke.reason && secondStroke.reason.includes('One Continuous Stroke'));
});

test('ONE_STROKE: rejects undo and clear (AC-CH-3)', () => {
  const state = makeState('ONE_STROKE');
  assert.equal(validateUndoChallenge(state).valid, false);
  assert.equal(validateClearChallenge(state).valid, false);
});

test('Other cards allow undo and clear', () => {
  const state = makeState('TWO_COLORS');
  assert.equal(validateUndoChallenge(state).valid, true);
  assert.equal(validateClearChallenge(state).valid, true);
});

// ─── SPEED_DRAW tests (AC-CH-4) ─────────────────────────────────────────────

test('SPEED_DRAW: halves normal draw time with min 15s clamp (AC-CH-4)', () => {
  const state = makeState('SPEED_DRAW');
  assert.equal(calcTurnDrawTime(80, state), 40);
  assert.equal(calcTurnDrawTime(60, state), 30);
  assert.equal(calcTurnDrawTime(20, state), 15); // clamped to 15 minimum
});

test('Non-speed cards do not modify draw time', () => {
  const state = makeState('TWO_COLORS');
  assert.equal(calcTurnDrawTime(80, state), 80);
});

// ─── Reward & Honor system tests (AC-CH-5, AC-CH-6) ──────────────────────────

test('calcChallengeBonus: awards +25 only if enforced, accepted, and >=1 guesser scored (AC-CH-6)', () => {
  const state = makeState('TWO_COLORS', true);
  assert.equal(calcChallengeBonus(state, 1), 25);
  assert.equal(calcChallengeBonus(state, 3), 25);
  // 0 guessers → 0 points
  assert.equal(calcChallengeBonus(state, 0), 0);
});

test('calcChallengeBonus: unaccepted card gives 0 bonus', () => {
  const state = makeState('TWO_COLORS', false);
  assert.equal(calcChallengeBonus(state, 2), 0);
});

test('HONOR_NO_LETTERS: gives 0 bonus points even with guessers (AC-CH-5)', () => {
  const state = makeState('HONOR_NO_LETTERS', true);
  assert.equal(calcChallengeBonus(state, 3), 0);
});
