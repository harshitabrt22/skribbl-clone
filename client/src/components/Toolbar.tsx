import React from 'react';
import {
  PALETTE_COLORS,
  BRUSH_SIZES,
  BrushSize,
  DrawingTool,
} from '../types';

interface ToolbarProps {
  isDrawer: boolean;
  currentTool: DrawingTool;
  currentColor: string;
  currentSize: BrushSize;
  onToolChange: (tool: DrawingTool) => void;
  onColorChange: (color: string) => void;
  onSizeChange: (size: BrushSize) => void;
  onUndo: () => void;
  onClear: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  isDrawer,
  currentTool,
  currentColor,
  currentSize,
  onToolChange,
  onColorChange,
  onSizeChange,
  onUndo,
  onClear,
}) => {
  if (!isDrawer) {
    return (
      <div
        className="card"
        style={{
          marginTop: 'var(--space-12)',
          textAlign: 'center',
          padding: 'var(--space-12)',
          backgroundColor: '#FFFFFF',
        }}
      >
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', color: 'var(--muted)' }}>
          👀 You are currently viewing the drawing. Guess the word in chat!
        </span>
      </div>
    );
  }

  return (
    <div
      className="card"
      style={{
        marginTop: 'var(--space-12)',
        padding: 'var(--space-12) var(--space-16)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-12)',
        backgroundColor: '#FFFFFF',
      }}
    >
      {/* 1. Tool Selection: Brush vs Eraser */}
      <div style={{ display: 'flex', gap: 'var(--space-8)' }}>
        <button
          type="button"
          className={`btn btn-sm ${currentTool === 'brush' ? 'btn-primary' : ''}`}
          onClick={() => onToolChange('brush')}
          title="Brush tool"
        >
          ✏️ Brush
        </button>
        <button
          type="button"
          className={`btn btn-sm ${currentTool === 'eraser' ? 'btn-primary' : ''}`}
          onClick={() => onToolChange('eraser')}
          title="Eraser tool"
        >
          🧹 Eraser
        </button>
      </div>

      {/* 2. Color Palette (12 swatches) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: '6px',
        }}
      >
        {PALETTE_COLORS.map((color) => {
          const isSelected = currentColor.toUpperCase() === color.toUpperCase() && currentTool === 'brush';
          return (
            <button
              key={color}
              type="button"
              onClick={() => {
                onColorChange(color);
                if (currentTool === 'eraser') {
                  onToolChange('brush');
                }
              }}
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                backgroundColor: color,
                border: isSelected ? '3px solid var(--secondary)' : '2px solid var(--ink)',
                boxShadow: isSelected ? '0 0 0 2px var(--ink)' : '1px 1px 0 var(--ink)',
                cursor: 'pointer',
                transform: isSelected ? 'scale(1.15)' : 'none',
                transition: 'transform 0.1s ease',
              }}
              title={color}
            />
          );
        })}
      </div>

      {/* 3. Brush Size: Thin (4), Medium (10), Thick (20) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {BRUSH_SIZES.map((size) => {
          const isSelected = currentSize === size;
          return (
            <button
              key={size}
              type="button"
              onClick={() => onSizeChange(size)}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: isSelected ? '3px solid var(--primary)' : '2px solid var(--ink)',
                backgroundColor: isSelected ? 'var(--paper)' : '#FFFFFF',
                boxShadow: isSelected ? '0 0 0 1px var(--ink)' : '1px 1px 0 var(--ink)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title={`Size: ${size}px`}
            >
              <div
                style={{
                  width: Math.min(18, Math.max(4, size)),
                  height: Math.min(18, Math.max(4, size)),
                  borderRadius: '50%',
                  backgroundColor: 'var(--ink)',
                }}
              />
            </button>
          );
        })}
      </div>

      {/* 4. Action Buttons: Undo & Clear */}
      <div style={{ display: 'flex', gap: 'var(--space-8)' }}>
        <button
          type="button"
          className="btn btn-sm btn-accent"
          onClick={onUndo}
          title="Undo last stroke"
        >
          ↩️ Undo
        </button>
        <button
          type="button"
          className="btn btn-sm btn-danger"
          onClick={() => {
            if (confirm('Clear the entire canvas?')) {
              onClear();
            }
          }}
          title="Clear canvas"
        >
          🗑️ Clear
        </button>
      </div>
    </div>
  );
};
