import React, { useEffect } from 'react';
import { GameProvider, useGame } from './state/GameContext';
import { Navbar } from './components/Navbar';
import { ToastContainer } from './components/ToastContainer';
import { Landing } from './pages/Landing';
import { Lobby } from './pages/Lobby';
import { GameScreen } from './pages/GameScreen';

const MainContent: React.FC = () => {
  const { state, leaveRoom, removeToast } = useGame();

  // Handle browser back button (popstate)
  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname === '/' && state.roomId) {
        leaveRoom();
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [state.roomId, leaveRoom]);

  // Page selection based on room and phase (PRD Section 14)
  const renderCurrentPage = () => {
    if (!state.roomId) {
      return <Landing />;
    }
    if (state.phase === 'DRAWING') {
      return <GameScreen />;
    }
    return <Lobby />;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        connected={state.socketConnected}
        onHomeClick={state.roomId ? leaveRoom : undefined}
      />

      <main style={{ flex: 1 }}>{renderCurrentPage()}</main>

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
