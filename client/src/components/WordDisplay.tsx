// WordDisplay — shows the current word to drawers (real word) and guessers (masked).
// Displayed in the top bar of the game screen.
//
// PRD: Section 12.4, 16.2
//   - Guessers see: "_ _ _ _ _ _  (6)" or "_ C _ _ L E" with revealed hints
//   - Drawer sees:  the actual word highlighted

import React from 'react';

interface WordDisplayProps {
  isDrawer: boolean;
  word: string | null;       // the real word (only for the drawer)
  wordMask: string | null;   // e.g. "_ _ _ _ _ _" (for guessers)
  wordLength: number;        // letter count (excluding spaces)
  phase: string;
}

export const WordDisplay: React.FC<WordDisplayProps> = ({ isDrawer, word, wordMask, wordLength, phase }) => {
  if (phase === 'WORD_SELECTION') {
    return (
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', color: 'var(--muted)' }}>
        Waiting for word selection…
      </div>
    );
  }

  if (isDrawer && word) {
    // Drawer sees the real word
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
        <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Draw:</span>
        <span
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.4rem',
            fontWeight: 800,
            backgroundColor: 'var(--accent)',
            padding: '2px 10px',
            borderRadius: 'var(--radius-pill)',
            border: 'var(--border-thick)',
            letterSpacing: '0.05em',
          }}
        >
          {word}
        </span>
      </div>
    );
  }

  // Guesser sees the mask: "_ _ _ _ _ _  (6 letters)"
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
      <span
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '1.5rem',
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: 'var(--ink)',
        }}
      >
        {wordMask || '_ _ _ _ _ _'}
      </span>
      {wordLength > 0 && (
        <span style={{ fontSize: '0.8rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
          ({wordLength} letters)
        </span>
      )}
    </div>
  );
};
