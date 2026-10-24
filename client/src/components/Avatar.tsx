import React from 'react';

// Palette colors for avatars derived from PRD Section 19.1
const AVATAR_COLORS = [
  '#FF6B4A', // Tomato
  '#4C6FFF', // Indigo
  '#2ED3A3', // Mint
  '#FFD23F', // Yellow
  '#8E5CFF', // Purple
  '#FF7EB6', // Pink
  '#FF8A3D', // Orange
  '#1FB86B', // Green
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

interface AvatarProps {
  name: string;
  size?: number;
  connected?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({ name, size = 48, connected = true }) => {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const bgColor = getAvatarColor(name);

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderRadius: '50%',
        backgroundColor: bgColor,
        border: 'var(--border-thick)',
        boxShadow: 'var(--shadow-chunky-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-heading)',
        fontSize: size * 0.45,
        fontWeight: 800,
        color: '#FFFFFF',
        textShadow: '1px 1px 0 var(--ink)',
        opacity: connected ? 1 : 0.5,
      }}
      title={`${name}${!connected ? ' (Disconnected)' : ''}`}
    >
      {initial}
      {!connected && (
        <span
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: size * 0.32,
            height: size * 0.32,
            borderRadius: '50%',
            backgroundColor: 'var(--danger)',
            border: '2px solid #FFFFFF',
          }}
          title="Disconnected"
        />
      )}
    </div>
  );
};
