import React, { useEffect, useState } from 'react';
import { useGame } from '../state/GameContext';
import { CreateRoomModal } from '../components/CreateRoomModal';
import { PublicRoomsModal } from '../components/PublicRoomsModal';
import { RoomSettings } from '../types';

export const Landing: React.FC = () => {
  const { createRoom, joinRoom, addToast } = useGame();

  const [nickname, setNickname] = useState<string>(() => sessionStorage.getItem('dd_last_name') || '');
  const [roomCode, setRoomCode] = useState<string>('');
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isPublicOpen, setIsPublicOpen] = useState<boolean>(false);

  // Check URL path on mount to see if user opened /room/:code
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/room\/([A-Za-z0-9]{6})$/i);
    if (match) {
      setRoomCode(match[1].toUpperCase());
    }
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNick = nickname.trim();
    if (!cleanNick) {
      addToast('Please enter your nickname first.', 'error');
      return;
    }
    const cleanCode = roomCode.trim().toUpperCase();
    if (cleanCode.length !== 6) {
      addToast('Room code must be 6 characters.', 'error');
      return;
    }

    joinRoom(cleanCode, cleanNick);
  };

  const handleCreateSubmit = (hostName: string, settings: RoomSettings) => {
    setIsCreateOpen(false);
    createRoom(hostName, settings);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 'var(--space-32) var(--space-16)',
        maxWidth: '900px',
        margin: '0 auto',
      }}
    >
      {/* Hero Section */}
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-32)' }}>
        {/* Playful animated doodle illustration (CSS / SVG) */}
        <div style={{ marginBottom: 'var(--space-12)' }}>
          <svg
            width="80"
            height="80"
            viewBox="0 0 100 100"
            style={{
              filter: 'drop-shadow(3px 3px 0 var(--ink))',
              animation: 'bounce 2s infinite ease-in-out',
            }}
          >
            <style>{`
              @keyframes bounce {
                0%, 100% { transform: translateY(0) rotate(0deg); }
                50% { transform: translateY(-8px) rotate(4deg); }
              }
            `}</style>
            <circle cx="50" cy="50" r="42" fill="var(--accent)" stroke="var(--ink)" strokeWidth="4" />
            <path d="M 28 42 Q 35 32 42 42" stroke="var(--ink)" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M 58 42 Q 65 32 72 42" stroke="var(--ink)" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M 32 62 Q 50 78 68 62" stroke="var(--ink)" strokeWidth="5" fill="none" strokeLinecap="round" />
            <circle cx="28" cy="54" r="6" fill="var(--primary)" opacity="0.6" />
            <circle cx="72" cy="54" r="6" fill="var(--primary)" opacity="0.6" />
          </svg>
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '3.5rem',
            color: 'var(--primary)',
            textShadow: '3px 3px 0 var(--ink)',
            lineHeight: 1.1,
            marginBottom: 'var(--space-8)',
          }}
        >
          Doodle Dash
        </h1>
        <p
          style={{
            fontSize: '1.25rem',
            color: 'var(--ink)',
            fontWeight: 600,
          }}
        >
          The real-time multiplayer drawing & guessing party!
        </p>
      </div>

      {/* Main Join & Create Card */}
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '460px',
          marginBottom: 'var(--space-48)',
          textAlign: 'center',
        }}
      >
        <div className="form-group" style={{ marginBottom: 'var(--space-20)' }}>
          <label className="form-label" style={{ fontSize: '1.1rem' }}>
            Choose Your Nickname
          </label>
          <input
            type="text"
            className="input-text"
            placeholder="e.g. PixelPanda"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            style={{ textAlign: 'center', fontSize: '1.2rem', fontWeight: 700 }}
          />
        </div>

        {/* Primary Action: Create Room */}
        <button
          className="btn btn-primary btn-lg"
          style={{ width: '100%', marginBottom: 'var(--space-16)' }}
          onClick={() => {
            if (!nickname.trim()) {
              addToast('Enter a nickname first!', 'error');
              return;
            }
            setIsCreateOpen(true);
          }}
        >
          ✨ Create New Room
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-8)',
            margin: 'var(--space-16) 0',
            color: 'var(--muted)',
            fontWeight: 700,
          }}
        >
          <div style={{ flex: 1, height: 2, backgroundColor: 'var(--ink)' }} />
          <span>OR</span>
          <div style={{ flex: 1, height: 2, backgroundColor: 'var(--ink)' }} />
        </div>

        {/* Join With Code Form */}
        <form onSubmit={handleJoin} style={{ display: 'flex', gap: 'var(--space-8)' }}>
          <input
            type="text"
            className="input-text"
            placeholder="6-LETTER CODE"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            maxLength={6}
            style={{
              textTransform: 'uppercase',
              fontWeight: 800,
              letterSpacing: '2px',
              textAlign: 'center',
            }}
          />
          <button type="submit" className="btn btn-secondary">
            Join
          </button>
        </form>

        {/* Browse Public Rooms Link */}
        <div style={{ marginTop: 'var(--space-20)' }}>
          <button
            type="button"
            onClick={() => setIsPublicOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--secondary)',
              fontFamily: 'var(--font-heading)',
              fontSize: '1rem',
              fontWeight: 700,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            🌐 Browse Public Rooms
          </button>
        </div>
      </div>

      {/* How To Play Strip (PRD Section 7.1) */}
      <section style={{ width: '100%', marginBottom: 'var(--space-48)' }}>
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.8rem',
            textAlign: 'center',
            marginBottom: 'var(--space-20)',
          }}
        >
          How To Play in 3 Simple Steps
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 'var(--space-16)',
          }}
        >
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-20)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-8)' }}>🚪</div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-4)' }}>1. Create or Join</h3>
            <p style={{ fontSize: '0.95rem', color: 'var(--muted)' }}>
              Start a room and share your 6-character room link with friends.
            </p>
          </div>

          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-20)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-8)' }}>🎨</div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-4)' }}>2. Draw & Guess</h3>
            <p style={{ fontSize: '0.95rem', color: 'var(--muted)' }}>
              One player draws the secret word while everyone else types their guesses in real time.
            </p>
          </div>

          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-20)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-8)' }}>🏆</div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-4)' }}>3. Score & Win</h3>
            <p style={{ fontSize: '0.95rem', color: 'var(--muted)' }}>
              Guess fast for more points, build streak multipliers, and top the leaderboard!
            </p>
          </div>
        </div>
      </section>

      {/* Modals */}
      <CreateRoomModal
        initialNickname={nickname}
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreateSubmit}
      />

      <PublicRoomsModal
        isOpen={isPublicOpen}
        onClose={() => setIsPublicOpen(false)}
        onSelectRoom={(code) => setRoomCode(code)}
      />
    </div>
  );
};
