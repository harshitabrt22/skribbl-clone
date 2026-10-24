// Unit tests for Feature B (Progressive Hints)
// PRD Section 13.3, 23.2 (AC-HINT-1, AC-HINT-2, AC-HINT-3, AC-HINT-4)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEffectiveHints,
  getHintSchedule,
  pickHintIndices,
  buildMask,
} from '../lib/hints';

// ─── calculateEffectiveHints tests ──────────────────────────────────────────

test('calculateEffectiveHints: never reveals more than half the letters (AC-HINT-2)', () => {
  // 6-letter word ("castle") with hints=2 → 2 (since 2 <= floor(6/2)=3)
  assert.equal(calculateEffectiveHints(2, 'castle'), 2);

  // 4-letter word ("cats") with hints=5 → 2 (floor(4/2) = 2)
  assert.equal(calculateEffectiveHints(5, 'cats'), 2);

  // 3-letter word ("dog") with hints=2 → 1 (floor(3/2) = 1)
  assert.equal(calculateEffectiveHints(2, 'dog'), 1);

  // 1-letter word with hints=2 → 0 (floor(1/2) = 0)
  assert.equal(calculateEffectiveHints(2, 'a'), 0);
});

test('calculateEffectiveHints: hints=0 disables all hints (AC-HINT-3)', () => {
  assert.equal(calculateEffectiveHints(0, 'castle'), 0);
});

test('calculateEffectiveHints: Hidden word mode disables hints (AC-HINT-3)', () => {
  assert.equal(calculateEffectiveHints(3, 'castle', 'Hidden'), 0);
});

test('calculateEffectiveHints: excludes spaces in letter count', () => {
  // "ice cream" has 8 letters → max 4 hints. Request 2 → 2.
  assert.equal(calculateEffectiveHints(2, 'ice cream'), 2);

  // "go up" has 4 letters → max 2 hints. Request 3 → 2.
  assert.equal(calculateEffectiveHints(3, 'go up'), 2);
});

// ─── getHintSchedule tests ──────────────────────────────────────────────────

test('getHintSchedule: AC-HINT-1 with hints=2 and drawTime=60s reveals at ~20s and ~40s', () => {
  const schedule = getHintSchedule(60, 2);
  assert.deepEqual(schedule, [20, 40]);
});

test('getHintSchedule: drawTime=80s with hints=2 schedules reveals at ~27s and ~53s', () => {
  const schedule = getHintSchedule(80, 2);
  assert.deepEqual(schedule, [27, 53]);
});

test('getHintSchedule: hints=1 at 60s schedules reveal at 30s', () => {
  const schedule = getHintSchedule(60, 1);
  assert.deepEqual(schedule, [30]);
});

test('getHintSchedule: hints=0 or drawTime=0 returns empty array', () => {
  assert.deepEqual(getHintSchedule(60, 0), []);
  assert.deepEqual(getHintSchedule(0, 2), []);
});

// ─── pickHintIndices tests ──────────────────────────────────────────────────

test('pickHintIndices: returns requested count of distinct valid indices', () => {
  const indices = pickHintIndices(6, 2);
  assert.equal(indices.length, 2);
  assert.notEqual(indices[0], indices[1]);
  assert.ok(indices[0] >= 0 && indices[0] < 6);
  assert.ok(indices[1] >= 0 && indices[1] < 6);
});

// ─── buildMask tests ────────────────────────────────────────────────────────

test('buildMask: shows all blanks when no hints revealed', () => {
  assert.equal(buildMask('cat', []), '_ _ _');
});

test('buildMask: reveals specific letter indices accurately', () => {
  // "castle" with index 1 (A) and 4 (L)
  const mask = buildMask('castle', [1, 4]);
  assert.equal(mask, '_ A _ _ L _');
});

test('buildMask: preserves spaces as multi-space gaps', () => {
  const mask = buildMask('ice cream', [2]); // index 2 is 'e'
  assert.equal(mask, '_ _ E   _ _ _ _ _');
});

test('buildMask: Hidden mode shows ? only', () => {
  assert.equal(buildMask('castle', [], 'Hidden'), '?');
});
