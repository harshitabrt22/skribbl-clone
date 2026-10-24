// WordPicker overlay — shown to the drawer during WORD_SELECTION phase.
// The drawer sees 2-5 word cards; everyone else sees "X is choosing a word…"
// If challenges are enabled, the drawer also sees a challenge card to accept/skip.
//
// PRD: Section 12.2, 13.4, 16.2

import React, { useState } from 'react';
import { ChallengeCardInfo } from '../types';

interface WordPickerProps {
  isDrawer: boolean;
  drawerName: string;
  wordOptions: string[];    // empty for non-drawers
  challengeOffer: ChallengeCardInfo | null;
  onChoose: (word: string, acceptChallenge?: boolean) => void;
}

const CHALLENGE_EMOJI: Record<string, string> = {
  TWO_COLORS: '🎨',
  ONE_STROKE: '✍️',
  SPEED_DRAW: '⚡',
  HONOR_NO_LETTERS: '🚫',
};

export const WordPicker: React.FC<WordPickerProps> = ({ isDrawer, drawerName, wordOptions, challengeOffer, onChoose }) => {
  const [acceptChallenge, setAcceptChallenge] = useState(false);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(30, 27, 46, 0.75)',
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
          maxWidth: 560,
          width: '90%',
          textAlign: 'center',
        }}
      >
        {isDrawer ? (
          <>
            {/* Drawer sees word options */}
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', marginBottom: 'var(--space-8)' }}>
              ✏️ Pick a Word to Draw!
            </h2>
            <p style={{ color: 'var(--muted)', marginBottom: 'var(--space-16)' }}>
              Choose wisely — the clock starts when you pick.
            </p>

            {/* Challenge card offer */}
            {challengeOffer && (
              <div
                style={{
                  marginBottom: 'var(--space-20)',
                  padding: 'var(--space-12) var(--space-16)',
                  borderRadius: 12,
                  border: acceptChallenge
                    ? '2px solid var(--primary)'
                    : '2px dashed var(--muted)',
                  backgroundColor: acceptChallenge ? 'rgba(76, 111, 255, 0.08)' : 'var(--paper)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => setAcceptChallenge(!acceptChallenge)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: '1.3rem' }}>
                    {CHALLENGE_EMOJI[challengeOffer.id] || '🃏'}
                  </span>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 700 }}>
                    {challengeOffer.title}
                  </span>
                  {!challengeOffer.enforced && (
                    <span style={{
                      fontSize: '0.65rem',
                      padding: '2px 6px',
                      borderRadius: 6,
                      backgroundColor: 'var(--accent)',
                      color: '#fff',
                      fontWeight: 700,
                    }}>
                      HONOR
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0 }}>
                  {challengeOffer.description}
                </p>
                {challengeOffer.enforced && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700, margin: '6px 0 0' }}>
                    +{challengeOffer.reward || 25} bonus if a guesser gets it!
                  </p>
                )}
                <div style={{ marginTop: 8 }}>
                  <span
                    className={`btn btn-sm ${acceptChallenge ? 'btn-primary' : ''}`}
                    style={{ fontSize: '0.8rem', pointerEvents: 'none' }}
                  >
                    {acceptChallenge ? '✅ Accepted' : 'Click to Accept'}
                  </span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-12)', justifyContent: 'center' }}>
              {wordOptions.map((word) => (
                <button
                  key={word}
                  className="btn btn-primary"
                  onClick={() => onChoose(word, acceptChallenge)}
                  style={{ fontSize: '1.1rem', padding: '12px 24px', minWidth: 120 }}
                >
                  {word}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Guessers wait while drawer picks */}
            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-16)' }}>🎨</div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', marginBottom: 'var(--space-8)' }}>
              {drawerName} is choosing a word…
            </h2>
            <p style={{ color: 'var(--muted)' }}>
              Get ready to guess! Drawing starts soon.
            </p>
          </>
        )}
      </div>
    </div>
  );
};
