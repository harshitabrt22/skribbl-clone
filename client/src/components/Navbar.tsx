import React from 'react';

interface NavbarProps {
  connected: boolean;
  onHomeClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ connected, onHomeClick }) => {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-12) var(--space-24)',
        borderBottom: 'var(--border-thick)',
        backgroundColor: 'var(--paper)',
      }}
    >
      <div
        onClick={onHomeClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-8)',
          cursor: onHomeClick ? 'pointer' : 'default',
        }}
      >
        <span style={{ fontSize: '1.8rem' }}>🎨</span>
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.8rem',
            color: 'var(--primary)',
            textShadow: '1.5px 1.5px 0 var(--ink)',
            letterSpacing: '0.5px',
          }}
        >
          Doodle Dash
        </h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-16)' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 10px',
            borderRadius: 'var(--radius-pill)',
            border: 'var(--border-thick)',
            backgroundColor: connected ? 'var(--mint)' : 'var(--danger)',
            color: connected ? 'var(--ink)' : '#FFFFFF',
            fontSize: '0.85rem',
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            boxShadow: 'var(--shadow-chunky-sm)',
          }}
          title={connected ? 'Connected to game server' : 'Disconnected / Reconnecting'}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: connected ? 'var(--success)' : '#FFFFFF',
            }}
          />
          {connected ? 'LIVE' : 'OFFLINE'}
        </span>

        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--ink)',
            textDecoration: 'none',
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: '1rem',
          }}
        >
          GitHub
        </a>
      </div>
    </header>
  );
};
