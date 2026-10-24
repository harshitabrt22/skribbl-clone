// GameOver screen — shown when game_over event fires.
// Shows the podium (top 3), winner(s), full leaderboard, and Play Again / Leave buttons.
//
// PRD: Section 7.6, 16.2

import React from 'react';
import { Avatar } from '../components/Avatar';

interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  score: number;
}

interface GameOverProps {
  winners: string[];           // winner names (could be a tie)
  leaderboard: LeaderboardEntry[];
  isHost: boolean;
  onPlayAgain: () => void;
  onLeave: () => void;
}

export const GameOver: React.FC<GameOverProps> = ({
  winners,
  leaderboard,
  isHost,
  onPlayAgain,
  onLeave,
}) => {
  const winnerText =
    winners.length === 1
      ? `🏆 ${winners[0]} wins!`
      : `🏆 It's a tie! ${winners.join(' & ')}`;

  // Get player data for podium (top 3 from leaderboard)
  const podiumEntries = leaderboard.slice(0, 3);

  const podiumOrder = [1, 0, 2]; // visual order: 2nd, 1st, 3rd place

  return (
    <div
      style={{
        maxWidth: 600,
        margin: '0 auto',
        padding: 'var(--space-32) var(--space-16)',
        textAlign: 'center',
      }}
    >
      {/* Winner announcement */}
      <div
        className="card"
        style={{
          padding: 'var(--space-32)',
          marginBottom: 'var(--space-24)',
          backgroundColor: 'var(--accent)',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-8)' }}>🎊</div>
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '2rem',
            marginBottom: 'var(--space-8)',
          }}
        >
          {winnerText}
        </h1>
        <p style={{ color: 'var(--muted)' }}>What a game! Here's the final leaderboard.</p>
      </div>

      {/* Podium — top 3 */}
      {podiumEntries.length >= 2 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: 'var(--space-8)',
            marginBottom: 'var(--space-24)',
          }}
        >
          {podiumOrder.map((rank0) => {
            const entry = podiumEntries[rank0];
            if (!entry) return null;
            const height = rank0 === 0 ? 120 : rank0 === 1 ? 90 : 70;
            const medal = rank0 === 0 ? '🥇' : rank0 === 1 ? '🥈' : '🥉';
            return (
              <div key={entry.playerId} style={{ textAlign: 'center', flex: 1 }}>
                <Avatar name={entry.playerName} size={40} />
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: 4 }}>{entry.playerName}</div>
                <div style={{ fontSize: '1.4rem' }}>{medal}</div>
                <div
                  style={{
                    height,
                    backgroundColor: rank0 === 0 ? 'var(--accent)' : 'var(--paper)',
                    border: 'var(--border-thick)',
                    borderRadius: '8px 8px 0 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-heading)',
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    marginTop: 'var(--space-8)',
                  }}
                >
                  {entry.score}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full leaderboard */}
      <div className="card" style={{ padding: 'var(--space-16)', marginBottom: 'var(--space-24)' }}>
        <h3
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.2rem',
            marginBottom: 'var(--space-12)',
          }}
        >
          Final Scores
        </h3>
        {leaderboard.map((entry) => (
          <div
            key={entry.playerId}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderRadius: 8,
              backgroundColor: entry.rank === 1 ? '#fff9e6' : 'var(--paper)',
              marginBottom: 4,
              fontWeight: entry.rank === 1 ? 700 : 400,
            }}
          >
            <span>
              {entry.rank === 1 ? '🥇 ' : entry.rank === 2 ? '🥈 ' : entry.rank === 3 ? '🥉 ' : `${entry.rank}. `}
              {entry.playerName}
            </span>
            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{entry.score} pts</span>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 'var(--space-12)', justifyContent: 'center' }}>
        {isHost && (
          <button className="btn btn-primary" onClick={onPlayAgain}>
            🔄 Play Again
          </button>
        )}
        <button className="btn btn-secondary" onClick={onLeave}>
          🚪 Leave Room
        </button>
      </div>

      {!isHost && (
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: 'var(--space-12)' }}>
          Waiting for the host to start a new game…
        </p>
      )}
    </div>
  );
};
