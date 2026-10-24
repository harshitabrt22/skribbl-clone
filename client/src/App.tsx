import React, { useEffect } from 'react';
import { GameProvider, useGame } from './state/GameContext';
import { Navbar } from './components/Navbar';
import { ToastContainer } from './components/ToastContainer';
import { Landing } from './pages/Landing';
import { Lobby } from './pages/Lobby';

const MainContent: React.FC = () => {
  const { state, leaveRoom, removeToast } = useGame();

  // Listen to popstate (e.g. user hits back button)
  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname === '/' && state.roomId) {
        leaveRoom();
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [state.roomId, leaveRoom]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        connected={state.socketConnected}
        onHomeClick={state.roomId ? leaveRoom : undefined}
      />

      <main style={{ flex: 1 }}>
        {state.roomId ? <Lobby /> : <Landing />}
      </main>

      <ToastContainer toasts={state.toasts} onDismiss={removeToast} />

      <footer
        style={{
          textAlign: 'center',
          padding: 'var(--space-16)',
          borderTop: 'var(--border-thick)',
          backgroundColor: 'var(--paper)',
          fontSize: '0.9rem',
          color: 'var(--muted)',
        }}
      >
        Doodle Dash • Built with React, TypeScript & Socket.IO
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <GameProvider>
      <MainContent />
    </GameProvider>
  );
};

export default App;
