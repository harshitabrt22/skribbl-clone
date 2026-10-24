// ChatPanel — guess input + message feed shown to all players during the game.
// For guessers: typing here sends a guess. For the drawer: messages are sent as general chat.
// Shows "PlayerX guessed the word!" (never the word itself) for correct guesses.
//
// PRD: Section 4.5, 12.3, 16.4

import React, { useState, useEffect, useRef } from 'react';

export interface ChatEntry {
  id: string;                 // unique key for React list rendering
  type: 'chat' | 'correct' | 'close' | 'system';
  playerName?: string;
  text?: string;              // for chat messages
  points?: number;            // for correct guess announcements
  streakBonus?: number;       // streak bonus points (if any)
  streak?: number;            // current streak count
}

interface ChatPanelProps {
  entries: ChatEntry[];
  isDrawer: boolean;
  hasGuessed: boolean;        // true if this player already guessed correctly this turn
  phase: string;
  onSend: (text: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ entries, isDrawer, hasGuessed, phase, onSend }) => {
  const [input, setInput] = useState('');
  const feedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom when new messages arrive
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [entries]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput('');
  };

  // Determine the input placeholder text
  const getPlaceholder = () => {
    if (isDrawer) return 'Chat (you are drawing)…';
    if (hasGuessed) return '✅ You already guessed!';
    if (phase !== 'DRAWING') return 'Chat…';
    return 'Type your guess here…';
  };

  // Input is disabled if: already guessed this turn, or not in DRAWING/other chat phases
  const inputDisabled = hasGuessed && !isDrawer;

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 300,
        padding: 0,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: 'var(--space-12) var(--space-16)',
          borderBottom: 'var(--border-thick)',
          fontFamily: 'var(--font-heading)',
          fontSize: '1rem',
          fontWeight: 700,
          backgroundColor: 'var(--paper)',
        }}
      >
        💬 Chat & Guesses
      </div>

      {/* Message feed */}
      <div
        ref={feedRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-8) var(--space-12)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          fontSize: '0.875rem',
        }}
      >
        {entries.length === 0 && (
          <p style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 'var(--space-16)' }}>
            No messages yet…
          </p>
        )}

        {entries.map((entry) => {
          if (entry.type === 'correct') {
            // "PlayerX guessed the word!" — bright green, no word shown
            return (
              <div
                key={entry.id}
                style={{
                  backgroundColor: '#d4edda',
                  border: '1px solid var(--success)',
                  borderRadius: 8,
                  padding: '6px 10px',
                  fontWeight: 700,
                  color: 'var(--success)',
                }}
              >
                🎉 <strong>{entry.playerName}</strong> guessed the word!
                {entry.points !== undefined && (
                  <span style={{ fontWeight: 400, marginLeft: 6 }}>
                    +{entry.points} pts
                    {entry.streakBonus ? ` (🔥 +${entry.streakBonus} streak x${entry.streak})` : ''}
                  </span>
                )}
              </div>
            );
          }

          if (entry.type === 'close') {
            // Private "So close!" shown only to the guesser who was close
            return (
              <div
                key={entry.id}
                style={{
                  backgroundColor: '#fff3cd',
                  border: '1px solid var(--accent)',
                  borderRadius: 8,
                  padding: '6px 10px',
                  color: '#856404',
                  fontStyle: 'italic',
                }}
              >
                🟡 So close! Try again…
              </div>
            );
          }

          if (entry.type === 'system') {
            return (
              <div key={entry.id} style={{ color: 'var(--muted)', fontStyle: 'italic', textAlign: 'center' }}>
                {entry.text}
              </div>
            );
          }

          // Regular chat message
          return (
            <div key={entry.id}>
              <strong style={{ color: 'var(--secondary)' }}>{entry.playerName}:</strong>{' '}
              <span>{entry.text}</span>
            </div>
          );
        })}
      </div>

      {/* Input area */}
      <form
        onSubmit={handleSubmit}
        style={{
          borderTop: 'var(--border-thick)',
          padding: 'var(--space-8) var(--space-12)',
          display: 'flex',
          gap: 8,
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={getPlaceholder()}
          disabled={inputDisabled}
          maxLength={100}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: 'var(--border-thick)',
            borderRadius: 'var(--radius-card)',
            fontFamily: 'var(--font-body)',
            fontSize: '0.9rem',
            backgroundColor: inputDisabled ? 'var(--paper)' : 'white',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={inputDisabled || !input.trim()}
          className="btn btn-primary btn-sm"
        >
          Send
        </button>
      </form>
    </div>
  );
};
