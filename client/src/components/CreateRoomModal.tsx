import React, { useState } from 'react';
import { DEFAULT_SETTINGS, RoomSettings, WordMode } from '../types';

interface CreateRoomModalProps {
  initialNickname: string;
  isOpen: boolean;
  onClose: () => void;
  onCreate: (hostName: string, settings: RoomSettings) => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  initialNickname,
  isOpen,
  onClose,
  onCreate,
}) => {
  const [hostName, setHostName] = useState(initialNickname);
  const [settings, setSettings] = useState<RoomSettings>({ ...DEFAULT_SETTINGS });
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = hostName.trim();
    if (!trimmed) {
      setError('Please enter a nickname.');
      return;
    }
    if (trimmed.length > 20) {
      setError('Nickname cannot exceed 20 characters.');
      return;
    }
    setError(null);
    onCreate(trimmed, settings);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-20)' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', color: 'var(--primary)' }}>
            Create Room
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.4rem',
              cursor: 'pointer',
              fontWeight: 800,
            }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: '#FFE6E6',
              border: '2px solid var(--danger)',
              borderRadius: 'var(--radius-card)',
              color: 'var(--danger)',
              fontWeight: 700,
              marginBottom: 'var(--space-16)',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Host Nickname */}
          <div className="form-group">
            <label className="form-label">Your Nickname</label>
            <input
              type="text"
              className="input-text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="e.g. DoodleMaster"
              maxLength={20}
              autoFocus
              required
            />
          </div>

          {/* Max Players (2-20) */}
          <div className="form-group">
            <label className="form-label">
              Max Players: <strong>{settings.maxPlayers}</strong>
            </label>
            <input
              type="range"
              min={2}
              max={20}
              value={settings.maxPlayers}
              onChange={(e) => setSettings({ ...settings, maxPlayers: Number(e.target.value) })}
            />
          </div>

          {/* Rounds (2-10) */}
          <div className="form-group">
            <label className="form-label">
              Rounds: <strong>{settings.rounds}</strong>
            </label>
            <input
              type="range"
              min={2}
              max={10}
              value={settings.rounds}
              onChange={(e) => setSettings({ ...settings, rounds: Number(e.target.value) })}
            />
          </div>

          {/* Draw Time (15-240s) */}
          <div className="form-group">
            <label className="form-label">
              Draw Time: <strong>{settings.drawTime}s</strong>
            </label>
            <input
              type="range"
              min={15}
              max={240}
              step={5}
              value={settings.drawTime}
              onChange={(e) => setSettings({ ...settings, drawTime: Number(e.target.value) })}
            />
          </div>

          {/* Word Choices (1-5) */}
          <div className="form-group">
            <label className="form-label">
              Word Choices: <strong>{settings.wordCount}</strong>
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={settings.wordCount}
              onChange={(e) => setSettings({ ...settings, wordCount: Number(e.target.value) })}
            />
          </div>

          {/* Hints (0-5) */}
          <div className="form-group">
            <label className="form-label">
              Hints: <strong>{settings.hints === 0 ? '0 (Disabled)' : `${settings.hints} per turn`}</strong>
            </label>
            <input
              type="range"
              min={0}
              max={5}
              value={settings.hints}
              onChange={(e) => setSettings({ ...settings, hints: Number(e.target.value) })}
            />
          </div>

          {/* Word Mode */}
          <div className="form-group">
            <label className="form-label">Word Mode</label>
            <select
              className="input-select"
              value={settings.wordMode}
              onChange={(e) => setSettings({ ...settings, wordMode: e.target.value as WordMode })}
            >
              <option value="Normal">Normal (blanks with letter hints)</option>
              <option value="Hidden">Hidden (only '?' shown)</option>
            </select>
          </div>

          {/* Public Room Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', margin: 'var(--space-12) 0' }}>
            <input
              type="checkbox"
              id="isPublic"
              checked={settings.isPublic}
              onChange={(e) => setSettings({ ...settings, isPublic: e.target.checked })}
              style={{ width: 18, height: 18 }}
            />
            <label htmlFor="isPublic" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
              Make Room Public (visible in public lobby list)
            </label>
          </div>

          {/* Challenges Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', marginBottom: 'var(--space-24)' }}>
            <input
              type="checkbox"
              id="challengesEnabled"
              checked={settings.challengesEnabled}
              onChange={(e) => setSettings({ ...settings, challengesEnabled: e.target.checked })}
              style={{ width: 18, height: 18 }}
            />
            <label htmlFor="challengesEnabled" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
              Enable Challenge Cards (Feature A)
            </label>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 'var(--space-12)', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create Room 🚀
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
