// RoundSummary overlay — shown for ~5 seconds after each turn ends.
// Reveals the word and shows who gained points.
//
// PRD: Section 7.5, 16.2 (round_end event)

import React from 'react';
import { ChallengeCardInfo } from '../types';

interface ScoreEntry {
  playerId: string;
  playerName: string;
  total: number;
  challengeBonus?: number;
}

interface RoundSummaryProps {
  word: string;
  reason: 'time' | 'all_guessed' | 'drawer_left';
  scores: ScoreEntry[];
  nextDrawerName?: string;
  challengeBonus?: number;
  challenge?: ChallengeCardInfo;
}

export const RoundSummary: React.FC<RoundSummaryProps> = ({
  word,
  reason,
  scores,
  nextDrawerName,
  challengeBonus,
  challenge,
}) => {
  // Human-readable end reason
  const reasonText =
    reason === 'all_guessed'
      ? '🎉 Everyone guessed it!'
      : reason === 'drawer_left'
      ? '🚶 The drawer disconnected.'
      : "⏱️ Time's up!";

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(30, 27, 46, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        className="card"
        style={{
          padding: 'var(--space-32)',
          maxWidth: 480,
          width: '90%',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-8)' }}>📝</div>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: 4 }}>{reasonText}</p>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', marginBottom: 'var(--space-20)' }}>
          The word was: <span style={{ color: 'var(--primary)' }}>{word}</span>
        </h2>

        {/* Feature A: Challenge bonus notification (PRD 13.4) */}
        {challengeBonus && challengeBonus > 0 && challenge && (
          <div
            style={{
              marginBottom: 'var(--space-16)',
              padding: 'var(--space-8) var(--space-12)',
              borderRadius: 8,
              backgroundColor: 'rgba(255, 107, 74, 0.1)',
              border: '1.5px solid var(--primary)',
              color: 'var(--primary)',
              fontSize: '0.85rem',
              fontWeight: 700,
            }}
          >
            🎯 Challenge bonus +{challengeBonus} ({challenge.title})
          </div>
        )}

        {/* Score list — top guessers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 'var(--space-16)' }}>
          {scores.map((s) => (
            <div
              key={s.playerId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 12px',
                borderRadius: 8,
                backgroundColor: 'var(--paper)',
                fontSize: '0.9rem',
              }}
            >
              <span style={{ fontWeight: 600 }}>{s.playerName}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {s.challengeBonus && s.challengeBonus > 0 ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>
                    (+{s.challengeBonus} card)
                  </span>
                ) : null}
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{s.total} pts</span>
              </div>
            </div>
          ))}
        </div>

        {nextDrawerName && (
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
            Next up: <strong>{nextDrawerName}</strong> will draw…
          </p>
        )}

        <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 'var(--space-12)' }}>
          Next round starting in a few seconds…
        </p>
      </div>
    </div>
  );
};
