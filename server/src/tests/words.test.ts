// Unit tests for normalizeGuess, isClose, and calcGuessPoints
// Uses Node.js built-in test runner with tsx (no extra libraries needed).
//
// Run: npx tsx --test server/src/tests/words.test.ts
//   or: npm run test (if you add a "test" script in package.json)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGuess, isClose } from '../lib/words';
import { calcGuessPoints } from '../lib/scoring';

// ─── normalizeGuess tests ──────────────────────────────────────────────────

test('normalizeGuess: trims and lowercases', () => {
  assert.equal(normalizeGuess('  CASTLE  '), 'castle');
});

test('normalizeGuess: converts hyphens to spaces', () => {
  assert.equal(normalizeGuess('ice-cream'), 'ice cream');
});

test('normalizeGuess: converts underscores to spaces', () => {
  assert.equal(normalizeGuess('ice_cream'), 'ice cream');
});

test('normalizeGuess: collapses multiple spaces', () => {
  assert.equal(normalizeGuess('ice  cream'), 'ice cream');
});

test('normalizeGuess: strips punctuation', () => {
  assert.equal(normalizeGuess('castle!'), 'castle');
});

test('normalizeGuess: mixed case with hyphens', () => {
  assert.equal(normalizeGuess('  CaSTle-ICE  '), 'castle ice');
});

test('normalizeGuess: empty string stays empty', () => {
  assert.equal(normalizeGuess(''), '');
});

// ─── isClose tests ────────────────────────────────────────────────────────

test('isClose: exact match is NOT close (it is correct)', () => {
  assert.equal(isClose('castle', 'castle'), false);
});

test('isClose: one substitution on 6-letter word is close', () => {
  // "casgle" vs "castle" — one substitution → distance 1
  assert.equal(isClose('casgle', 'castle'), true);
});

test('isClose: one insertion on 6-letter word is close', () => {
  // "castlee" vs "castle" — one insertion
  assert.equal(isClose('castlee', 'castle'), true);
});

test('isClose: one deletion on 6-letter word is close', () => {
  // "castl" vs "castle" — one deletion
  assert.equal(isClose('castl', 'castle'), true);
});

test('isClose: two-letter difference is NOT close', () => {
  assert.equal(isClose('casXXe', 'castle'), false);
});

test('isClose: short word (4 letters) is never close', () => {
  // "cats" → 4 letters: too short to qualify for close hint
  assert.equal(isClose('catt', 'cats'), false);
});

test('isClose: exactly 5 letters qualifies for close', () => {
  // "horse" vs "morse" — one substitution, 5 letters
  assert.equal(isClose('morse', 'horse'), true);
});

test('isClose: case-insensitive comparison', () => {
  assert.equal(isClose('CASGLE', 'castle'), true);
});

// ─── calcGuessPoints tests ────────────────────────────────────────────────

test('calcGuessPoints: fastest guess (remaining = total) = 300 base, streak 1 = 0 bonus', () => {
  const result = calcGuessPoints(80, 80, 1);
  assert.equal(result.basePoints, 300);
  assert.equal(result.streakBonus, 0);
  assert.equal(result.total, 300);
});

test('calcGuessPoints: last-second guess (remaining = 0) = 100 base', () => {
  const result = calcGuessPoints(0, 80, 1);
  assert.equal(result.basePoints, 100);
  assert.equal(result.streakBonus, 0);
  assert.equal(result.total, 100);
});

test('calcGuessPoints: half-time guess = 200 base', () => {
  // remaining=40, total=80 → ratio=0.5 → 100 + floor(200*0.5) = 200
  const result = calcGuessPoints(40, 80, 1);
  assert.equal(result.basePoints, 200);
});

test('calcGuessPoints: streak 2 gives +20 bonus', () => {
  const result = calcGuessPoints(80, 80, 2);
  assert.equal(result.streakBonus, 20);
  assert.equal(result.total, 320);
});

test('calcGuessPoints: streak 3 gives +40 bonus', () => {
  const result = calcGuessPoints(80, 80, 3);
  assert.equal(result.streakBonus, 40);
  assert.equal(result.total, 340);
});

test('calcGuessPoints: streak 4 gives +60 bonus', () => {
  const result = calcGuessPoints(80, 80, 4);
  assert.equal(result.streakBonus, 60);
  assert.equal(result.total, 360);
});

test('calcGuessPoints: streak 5 gives +80 bonus (cap)', () => {
  const result = calcGuessPoints(80, 80, 5);
  assert.equal(result.streakBonus, 80);
  assert.equal(result.total, 380);
});

test('calcGuessPoints: streak 6+ still capped at +80', () => {
  const result = calcGuessPoints(80, 80, 6);
  assert.equal(result.streakBonus, 80);
  assert.equal(result.total, 380);
});

test('calcGuessPoints: handles totalTime=0 gracefully (no division by zero)', () => {
  const result = calcGuessPoints(0, 0, 1);
  assert.equal(result.basePoints, 100); // ratio clamps to 0 → base = 100
  assert.equal(result.total, 100);
});
