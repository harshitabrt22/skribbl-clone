import React, { useState } from 'react';
import { useGame } from '../state/GameContext';
import { DrawingCanvas } from '../components/DrawingCanvas';
import { Toolbar } from '../components/Toolbar';
import { Avatar } from '../components/Avatar';
import { DrawingTool, BrushSize } from '../types';

export const GameScreen: React.FC = () => {
  const { state, isDrawer, undoDraw, clearCanvas, leaveRoom, addToast } = useGame();
  const { roomId, players, drawerId } = state;

  // Local drawing tool states for the active drawer
  const [currentTool, setCurrentTool] = useState<DrawingTool>('brush');
  const [currentColor, setCurrentColor] = useState<string>('#1E1B2E');
  const [currentSize, setCurrentSize] = useState<BrushSize>(10);

  const drawerPlayer = players.find((p) => p.id === drawerId);

  return (
    <div
      style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: 'var(--space-16)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-16)',
      }}
    >
      {/* Top Banner: Status & Drawer Indication */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-12)',
          padding: 'var(--space-12) var(--space-20)',
          backgroundColor: isDrawer ? 'var(--mint)' : '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
          <span style={{ fontSize: '1.8rem' }}>{isDrawer ? '✏️' : '👀'}</span>
          <div>
            <h2 style={{ fontSize: '1.3rem', lineHeight: 1.1 }}>
              {isDrawer
                ? 'You are Drawing!'
                : `${drawerPlayer?.name || 'Host'} is Drawing...`}
            </h2>
            <span style={{ fontSize: '0.85rem', color: isDrawer ? 'var(--ink)' : 'var(--muted)', fontWeight: 600 }}>
              {isDrawer
                ? 'Sketch your idea on the canvas below.'
                : 'Watch the live canvas strokes in real time!'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-pill)',
              border: 'var(--border-thick)',
              backgroundColor: 'var(--card)',
              fontFamily: 'var(--font-heading)',
              fontSize: '0.9rem',
              fontWeight: 700,
            }}
          >
            ROOM: {roomId}
          </span>
          <button className="btn btn-sm btn-danger" onClick={leaveRoom}>
            Leave
          </button>
        </div>
      </div>

      {/* Main Drawing Area: Canvas + Live Players sidebar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr minmax(200px, 260px)',
          gap: 'var(--space-16)',
          alignItems: 'start',
        }}
      >
        {/* Canvas & Drawer Toolbar */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <DrawingCanvas
            isDrawer={isDrawer}
            currentTool={currentTool}
            currentColor={currentColor}
            currentSize={currentSize}
            onRejectToast={(reason) => addToast(reason, 'error')}
          />

          <Toolbar
            isDrawer={isDrawer}
            currentTool={currentTool}
            currentColor={currentColor}
            currentSize={currentSize}
            onToolChange={setCurrentTool}
            onColorChange={setCurrentColor}
            onSizeChange={setCurrentSize}
            onUndo={undoDraw}
            onClear={clearCanvas}
          />
        </div>

        {/* Live Players List */}
        <aside className="card" style={{ padding: 'var(--space-16)' }}>
          <h3
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.2rem',
              marginBottom: 'var(--space-12)',
              borderBottom: '2px solid var(--paper)',
              paddingBottom: 'var(--space-8)',
            }}
          >
            Players ({players.length})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
            {players.map((p) => {
              const isCurrentDrawer = p.id === drawerId;
              const isYou = p.id === state.you?.id;

              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-card)',
                    border: 'var(--border-thick)',
                    backgroundColor: isCurrentDrawer ? 'var(--accent)' : '#FFFFFF',
                    boxShadow: 'var(--shadow-chunky-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
                    <Avatar name={p.name} size={32} connected={p.connected} />
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      {p.name} {isYou && '(You)'}
                    </span>
                  </div>

                  {isCurrentDrawer && (
                    <span style={{ fontSize: '1.1rem' }} title="Drawing now">
                      ✏️
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 'var(--space-16)',
              padding: 'var(--space-8)',
              backgroundColor: 'var(--paper)',
              borderRadius: 'var(--radius-card)',
              fontSize: '0.85rem',
              color: 'var(--muted)',
              textAlign: 'center',
            }}
          >
            Stage 3: Real-Time Drawing Sync
          </div>
        </aside>
      </div>
    </div>
  );
};
