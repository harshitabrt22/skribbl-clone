// Leaderboard — live score ranking shown in the left column during the game.
// Sorted by score (highest first). Shows rank, name, score, streak badge, and
// special indicators: ✏️ for current drawer, ✓ for players who already guessed.
//
// PRD: Section 7.4, 13.2

import React from 'react';
import { PublicPlayer } from '../types';
import { Avatar } from './Avatar';

interface LeaderboardProps {
  players: PublicPlayer[];
  drawerId: string | null;
  myId: string | null;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ players, drawerId, myId }) => {
  // Sort by score descending, then by original order (stable sort)
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div
      className="card"
      style={{
        padding: 'var(--space-12)',
        height: '100%',
      }}
    >
      <h3
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '1.1rem',
          marginBottom: 'var(--space-12)',
          borderBottom: '2px solid var(--paper)',
          paddingBottom: 'var(--space-8)',
        }}
      >
        🏆 Leaderboard
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sorted.map((p, idx) => {
          const isDrawer = p.id === drawerId;
          const isMe = p.id === myId;
          const rank = idx + 1;

          // Rank medal for top 3
          const rankLabel = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;

          return (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                borderRadius: 'var(--radius-card)',
                border: 'var(--border-thick)',
                backgroundColor: isMe ? 'var(--paper)' : '#fff',
                opacity: p.connected ? 1 : 0.5,
                boxShadow: 'var(--shadow-chunky-sm)',
                fontSize: '0.875rem',
              }}
            >
              {/* Rank */}
              <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 700 }}>{rankLabel}</span>

              {/* Avatar */}
              <Avatar name={p.name} size={28} connected={p.connected} />

              {/* Name + badges */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                  {isMe && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> (you)</span>}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'flex', gap: 4 }}>
                  {/* Streak badge — only show if streak >= 2 */}
                  {p.streak >= 2 && (
                    <span title={`${p.streak}-turn streak!`}>🔥 x{p.streak}</span>
                  )}
                  {/* Correct this turn */}
                  {p.hasGuessed && !isDrawer && (
                    <span style={{ color: 'var(--success)' }} title="Guessed this round">✓</span>
                  )}
                  {/* Current drawer */}
                  {isDrawer && (
                    <span title="Drawing now">✏️</span>
                  )}
                </div>
              </div>

              {/* Score */}
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 800,
                  fontSize: '1rem',
                  color: 'var(--primary)',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.score}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
