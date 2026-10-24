import React, { useEffect, useState } from 'react';
import { socket } from './socket';

export const App: React.FC = () => {
  const [isConnected, setIsConnected] = useState<boolean>(socket.connected);
  const [socketId, setSocketId] = useState<string | undefined>(socket.id);

  useEffect(() => {
    // Handler when socket successfully connects
    const onConnect = () => {
      setIsConnected(true);
      setSocketId(socket.id);
    };

    // Handler when socket disconnects
    const onDisconnect = () => {
      setIsConnected(false);
      setSocketId(undefined);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Initial check in case socket connected before listener was registered
    if (socket.connected) {
      setIsConnected(true);
      setSocketId(socket.id);
    }

    // Cleanup listeners on unmount
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: 'var(--space-24)',
        textAlign: 'center',
      }}
    >
      <header style={{ marginBottom: 'var(--space-24)' }}>
        <h1
          style={{
            fontSize: '3rem',
            color: 'var(--primary)',
            textShadow: '2px 2px 0 var(--ink)',
            marginBottom: 'var(--space-8)',
          }}
        >
          Doodle Dash
        </h1>
        <p style={{ fontSize: '1.2rem', color: 'var(--muted)' }}>
          Stage 1: Project Scaffolding Check
        </p>
      </header>

      <section
        style={{
          backgroundColor: 'var(--card)',
          border: 'var(--border-thick)',
          borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-chunky)',
          padding: 'var(--space-32)',
          minWidth: '320px',
        }}
      >
        <h2 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-16)' }}>
          Socket.IO Handshake
        </h2>

        <p style={{ fontSize: '1.25rem', marginBottom: 'var(--space-12)' }}>
          Connected:{' '}
          <span
            style={{
              display: 'inline-block',
              padding: '2px 12px',
              borderRadius: 'var(--radius-pill)',
              border: 'var(--border-thick)',
              backgroundColor: isConnected ? 'var(--mint)' : 'var(--danger)',
              color: isConnected ? 'var(--ink)' : '#FFFFFF',
              fontWeight: 700,
            }}
          >
            {isConnected ? 'yes' : 'no'}
          </span>
        </p>

        {socketId ? (
          <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
            Socket ID: <code>{socketId}</code>
          </p>
        ) : (
          <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
            Waiting for connection...
          </p>
        )}
      </section>
    </main>
  );
};

export default App;
