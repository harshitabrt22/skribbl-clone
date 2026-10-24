import React, { useEffect } from 'react';
import { GameProvider, useGame } from './state/GameContext';
import { Navbar } from './components/Navbar';
import { ToastContainer } from './components/ToastContainer';
import { Landing } from './pages/Landing';
import { Lobby } from './pages/Lobby';
import { GameScreen } from './pages/GameScreen';
import { GameOver } from './pages/GameOver';

const MainContent: React.FC = () => {
  const { state, leaveRoom, removeToast, playAgain, isHost } = useGame();

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

    // Game over screen
    if (state.phase === 'GAME_OVER' && state.gameOver) {
      return (
        <GameOver
          winners={state.gameOver.winners}
          leaderboard={state.gameOver.leaderboard}
          isHost={isHost}
          onPlayAgain={playAgain}
          onLeave={leaveRoom}
        />
      );
    }

    // Active game: drawing, word selection, or round end
    if (state.phase === 'WORD_SELECTION' || state.phase === 'DRAWING' || state.phase === 'ROUND_END') {
      return <GameScreen />;
    }

    // Lobby (LOBBY phase or before game starts)
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
        Doodle Dash • Built with React, TypeScript &amp; Socket.IO
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
