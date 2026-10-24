import React, { useState } from 'react';
import { useGame } from '../state/GameContext';
import { Avatar } from '../components/Avatar';
import { RoomSettings, WordMode } from '../types';

export const Lobby: React.FC = () => {
  const {
    state,
    setReady,
    updateSettings,
    startGame,
    kickPlayer,
    leaveRoom,
    addToast,
  } = useGame();

  const { roomId, you, players, hostId, settings, phase } = state;
  const isHost = you?.id === hostId;
  const myPlayer = players.find((p) => p.id === you?.id);
  const isReady = myPlayer?.ready || false;

  const [copied, setCopied] = useState<boolean>(false);
  const [isEditingSettings, setIsEditingSettings] = useState<boolean>(false);
  const [editSettings, setEditSettings] = useState<RoomSettings>(settings);

  // Copy shareable invite link (https://<site>/room/<CODE>)
  const handleCopyLink = async () => {
    if (!roomId) return;
    const url = `${window.location.origin}/room/${roomId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      addToast('Invite link copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      addToast('Failed to copy link.', 'error');
    }
  };

  // Determine if host can start game
  const connectedPlayers = players.filter((p) => p.connected);
  const hasMinPlayers = connectedPlayers.length >= 2;
  const unreadyCount = connectedPlayers.filter((p) => p.id !== hostId && !p.ready).length;
  const allNonHostReady = unreadyCount === 0;
  const canStart = hasMinPlayers && allNonHostReady;

  let startDisabledReason = '';
  if (!hasMinPlayers) {
    startDisabledReason = 'Need at least 2 connected players to start';
  } else if (!allNonHostReady) {
    startDisabledReason = `Waiting for ${unreadyCount} player${unreadyCount > 1 ? 's' : ''} to click Ready`;
  }

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(editSettings);
    setIsEditingSettings(false);
  };

  return (
    <div
      style={{
        maxWidth: '1000px',
        margin: '0 auto',
        padding: 'var(--space-24) var(--space-16)',
      }}
    >
      {/* Starting Game Notification (Stage 2 Placeholder) */}
      {phase === 'STARTING' && (
        <div
          className="card"
          style={{
            backgroundColor: 'var(--mint)',
            textAlign: 'center',
            marginBottom: 'var(--space-24)',
            borderColor: 'var(--ink)',
          }}
        >
          <h2 style={{ fontSize: '2rem', marginBottom: 'var(--space-8)' }}>
            🎮 Game Starting!
          </h2>
          <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>
            Host triggered start_game successfully. Gameplay and canvas drawing will be activated in Stage 3!
          </p>
        </div>
      )}

      {/* Top Banner: Room Code & Link Copy */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-16)',
          marginBottom: 'var(--space-24)',
        }}
      >
        <div>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 700 }}>
            ROOM CODE
          </span>
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '2.5rem',
              fontWeight: 800,
              letterSpacing: '3px',
              color: 'var(--primary)',
              lineHeight: 1,
            }}
          >
            {roomId}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
          <button className="btn btn-secondary" onClick={handleCopyLink}>
            {copied ? '✓ Copied Link!' : '🔗 Copy Invite Link'}
          </button>
          <button className="btn btn-danger btn-sm" onClick={leaveRoom}>
            Leave Room
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--space-24)',
        }}
      >
        {/* Left Column: Player List */}
        <section className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-16)',
            }}
          >
            <h2 style={{ fontSize: '1.4rem' }}>
              Players ({players.length}/{settings.maxPlayers})
            </h2>
            <span style={{ fontSize: '0.9rem', color: 'var(--muted)', fontWeight: 600 }}>
              {connectedPlayers.length} Connected
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-12)' }}>
            {players.map((player) => {
              const isPlayerHost = player.id === hostId;
              const isYou = player.id === you?.id;

              return (
                <div
                  key={player.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-12) var(--space-16)',
                    backgroundColor: isYou ? '#FFF7E8' : '#FFFFFF',
                    border: 'var(--border-thick)',
                    borderRadius: 'var(--radius-card)',
                    boxShadow: 'var(--shadow-chunky-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
                    <Avatar name={player.name} size={42} connected={player.connected} />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                          {player.name}
                        </span>
                        {isYou && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>(You)</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                        {isPlayerHost && <span className="badge badge-host">HOST</span>}
                        {player.ready ? (
                          <span className="badge badge-ready">READY</span>
                        ) : (
                          <span className="badge badge-unready">WAITING</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Host Kick Option for other players */}
                  {isHost && !isPlayerHost && (
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => {
                        if (confirm(`Kick ${player.name} from the room?`)) {
                          kickPlayer(player.id);
                        }
                      }}
                      title="Kick player"
                    >
                      Kick
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Column: Settings & Ready / Start Controls */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>
          {/* Settings Card */}
          <div className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-16)',
              }}
            >
              <h2 style={{ fontSize: '1.4rem' }}>Game Settings</h2>
              {isHost && !isEditingSettings && (
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    setEditSettings(settings);
                    setIsEditingSettings(true);
                  }}
                >
                  ✏️ Edit
                </button>
              )}
            </div>

            {isEditingSettings && isHost ? (
              <form onSubmit={handleSaveSettings}>
                <div className="form-group">
                  <label className="form-label">Rounds: {editSettings.rounds}</label>
                  <input
                    type="range"
                    min={2}
                    max={10}
                    value={editSettings.rounds}
                    onChange={(e) => setEditSettings({ ...editSettings, rounds: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Draw Time: {editSettings.drawTime}s</label>
                  <input
                    type="range"
                    min={15}
                    max={240}
                    step={5}
                    value={editSettings.drawTime}
                    onChange={(e) => setEditSettings({ ...editSettings, drawTime: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Word Choices: {editSettings.wordCount}</label>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={editSettings.wordCount}
                    onChange={(e) => setEditSettings({ ...editSettings, wordCount: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Hints: {editSettings.hints}</label>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    value={editSettings.hints}
                    onChange={(e) => setEditSettings({ ...editSettings, hints: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Word Mode</label>
                  <select
                    className="input-select"
                    value={editSettings.wordMode}
                    onChange={(e) => setEditSettings({ ...editSettings, wordMode: e.target.value as WordMode })}
                  >
                    <option value="Normal">Normal (blanks with letter hints)</option>
                    <option value="Hidden">Hidden (only '?' shown)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-8)', marginTop: 'var(--space-16)' }}>
                  <button type="submit" className="btn btn-primary btn-sm">
                    Save Settings
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setIsEditingSettings(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 'var(--space-12)',
                  fontSize: '0.95rem',
                }}
              >
                <div>
                  <span style={{ color: 'var(--muted)' }}>Rounds:</span>{' '}
                  <strong>{settings.rounds}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Draw Time:</span>{' '}
                  <strong>{settings.drawTime}s</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Word Choices:</span>{' '}
                  <strong>{settings.wordCount}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Hints:</span>{' '}
                  <strong>{settings.hints}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Word Mode:</span>{' '}
                  <strong>{settings.wordMode}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Challenges:</span>{' '}
                  <strong>{settings.challengesEnabled ? 'On' : 'Off'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Visibility:</span>{' '}
                  <strong>{settings.isPublic ? 'Public' : 'Private'}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Action Bar (Ready / Start Game) */}
          <div className="card" style={{ textAlign: 'center' }}>
            {isHost ? (
              <div>
                <button
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%' }}
                  disabled={!canStart || phase === 'STARTING'}
                  onClick={startGame}
                >
                  🚀 Start Game
                </button>
                {!canStart && (
                  <p
                    style={{
                      marginTop: 'var(--space-8)',
                      fontSize: '0.9rem',
                      color: 'var(--danger)',
                      fontWeight: 600,
                    }}
                  >
                    ⚠️ {startDisabledReason}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <button
                  className={`btn btn-lg ${isReady ? 'btn-mint' : 'btn-accent'}`}
                  style={{ width: '100%' }}
                  onClick={() => setReady(!isReady)}
                >
                  {isReady ? '✓ You Are Ready!' : 'Ready Up!'}
                </button>
                <p style={{ marginTop: 'var(--space-8)', fontSize: '0.9rem', color: 'var(--muted)' }}>
                  Click when you are ready to begin the game
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
