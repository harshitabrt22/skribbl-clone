// WordPicker overlay — shown to the drawer during WORD_SELECTION phase.
// The drawer sees 2-5 word cards; everyone else sees "X is choosing a word…"
// This component handles both cases based on the `isDrawer` prop.
//
// PRD: Section 12.2, 16.2

import React from 'react';

interface WordPickerProps {
  isDrawer: boolean;
  drawerName: string;
  wordOptions: string[];    // empty for non-drawers
  onChoose: (word: string) => void;
}

export const WordPicker: React.FC<WordPickerProps> = ({ isDrawer, drawerName, wordOptions, onChoose }) => {
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
          maxWidth: 520,
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
            <p style={{ color: 'var(--muted)', marginBottom: 'var(--space-24)' }}>
              Choose wisely — the clock starts when you pick.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-12)', justifyContent: 'center' }}>
              {wordOptions.map((word) => (
                <button
                  key={word}
                  className="btn btn-primary"
                  onClick={() => onChoose(word)}
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
