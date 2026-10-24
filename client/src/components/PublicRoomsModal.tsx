import React, { useEffect, useState } from 'react';
import { PublicRoomInfo } from '../types';

interface PublicRoomsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRoom: (code: string) => void;
}

export const PublicRoomsModal: React.FC<PublicRoomsModalProps> = ({ isOpen, onClose, onSelectRoom }) => {
  const [rooms, setRooms] = useState<PublicRoomInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRooms = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/rooms/public');
      if (!res.ok) throw new Error('Failed to fetch rooms');
      const data = await res.json();
      setRooms(data.rooms || []);
    } catch {
      setError('Could not load public rooms.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRooms();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-16)' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', color: 'var(--secondary)' }}>
            Public Rooms
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-12)' }}>
          <button className="btn btn-sm" onClick={fetchRooms} disabled={loading}>
            {loading ? 'Refreshing...' : '🔄 Refresh'}
          </button>
        </div>

        {error && (
          <p style={{ color: 'var(--danger)', fontWeight: 600, marginBottom: 'var(--space-12)' }}>
            {error}
          </p>
        )}

        {rooms.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: 'var(--space-32) 0', color: 'var(--muted)' }}>
            <p style={{ fontSize: '1.2rem', marginBottom: 'var(--space-8)' }}>No open public rooms found.</p>
            <p style={{ fontSize: '0.95rem' }}>Create one and set "Make Room Public"!</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-12)' }}>
          {rooms.map((room) => (
            <div
              key={room.code}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-12) var(--space-16)',
                backgroundColor: 'var(--card)',
                border: 'var(--border-thick)',
                borderRadius: 'var(--radius-card)',
                boxShadow: 'var(--shadow-chunky-sm)',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 800,
                      fontSize: '1.2rem',
                      letterSpacing: '1px',
                    }}
                  >
                    {room.code}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                    Host: <strong>{room.hostName}</strong>
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '2px' }}>
                  Players: {room.playerCount}/{room.maxPlayers} • {room.rounds} rounds • {room.drawTime}s
                </div>
              </div>

              <button
                className="btn btn-sm btn-mint"
                onClick={() => {
                  onSelectRoom(room.code);
                  onClose();
                }}
              >
                Join
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
