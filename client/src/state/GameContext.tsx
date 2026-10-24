// React Context for Doodle Dash multiplayer state (PRD Section 8, 14, 16.1)

import React, { createContext, useContext, useEffect, useReducer, ReactNode } from 'react';
import { socket } from '../socket';
import { GamePhase, PublicPlayer, RoomSettings, DEFAULT_SETTINGS, ToastMessage } from '../types';

interface You {
  id: string;
  sessionId: string;
  name: string;
}

interface GameState {
  roomId: string | null;
  you: You | null;
  players: PublicPlayer[];
  hostId: string | null;
  settings: RoomSettings;
  phase: GamePhase;
  toasts: ToastMessage[];
  socketConnected: boolean;
}

type Action =
  | { type: 'SET_SOCKET_CONNECTED'; payload: boolean }
  | {
      type: 'ROOM_JOINED';
      payload: {
        roomId: string;
        you: { id: string; sessionId: string };
        players: PublicPlayer[];
        hostId: string;
        settings: RoomSettings;
        phase: GamePhase;
        name: string;
      };
    }
  | { type: 'PLAYER_JOINED'; payload: { player: PublicPlayer; players: PublicPlayer[] } }
  | { type: 'PLAYER_LEFT'; payload: { playerId: string; players: PublicPlayer[]; hostId: string } }
  | { type: 'PLAYERS_UPDATED'; payload: { players: PublicPlayer[]; hostId: string } }
  | { type: 'SETTINGS_UPDATED'; payload: { settings: RoomSettings } }
  | { type: 'SET_PHASE'; payload: GamePhase }
  | { type: 'ADD_TOAST'; payload: ToastMessage }
  | { type: 'REMOVE_TOAST'; payload: string }
  | { type: 'RESET_ROOM' };

const initialState: GameState = {
  roomId: null,
  you: null,
  players: [],
  hostId: null,
  settings: DEFAULT_SETTINGS,
  phase: 'LOBBY',
  toasts: [],
  socketConnected: socket.connected,
};

function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'SET_SOCKET_CONNECTED':
      return { ...state, socketConnected: action.payload };

    case 'ROOM_JOINED':
      return {
        ...state,
        roomId: action.payload.roomId,
        you: {
          id: action.payload.you.id,
          sessionId: action.payload.you.sessionId,
          name: action.payload.name,
        },
        players: action.payload.players,
        hostId: action.payload.hostId,
        settings: action.payload.settings,
        phase: action.payload.phase,
      };

    case 'PLAYER_JOINED':
      return {
        ...state,
        players: action.payload.players,
      };

    case 'PLAYER_LEFT':
      return {
        ...state,
        players: action.payload.players,
        hostId: action.payload.hostId,
      };

    case 'PLAYERS_UPDATED':
      return {
        ...state,
        players: action.payload.players,
        hostId: action.payload.hostId,
      };

    case 'SETTINGS_UPDATED':
      return {
        ...state,
        settings: action.payload.settings,
      };

    case 'SET_PHASE':
      return {
        ...state,
        phase: action.payload,
      };

    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [...state.toasts.slice(-4), action.payload], // Keep at most 5 toasts
      };

    case 'REMOVE_TOAST':
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.payload),
      };

    case 'RESET_ROOM':
      return {
        ...state,
        roomId: null,
        you: null,
        players: [],
        hostId: null,
        settings: DEFAULT_SETTINGS,
        phase: 'LOBBY',
      };

    default:
      return state;
  }
}

interface GameContextType {
  state: GameState;
  createRoom: (hostName: string, settings: RoomSettings) => void;
  joinRoom: (roomId: string, playerName: string) => void;
  setReady: (ready: boolean) => void;
  updateSettings: (settings: Partial<RoomSettings>) => void;
  startGame: () => void;
  kickPlayer: (playerId: string) => void;
  leaveRoom: () => void;
  addToast: (message: string, type?: 'error' | 'success' | 'info') => void;
  removeToast: (id: string) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = 'doodle_dash_session';

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  const addToast = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    dispatch({ type: 'ADD_TOAST', payload: { id, type, message } });

    setTimeout(() => {
      dispatch({ type: 'REMOVE_TOAST', payload: id });
    }, 4000);
  };

  const removeToast = (id: string) => {
    dispatch({ type: 'REMOVE_TOAST', payload: id });
  };

  // Socket.IO event registrations
  useEffect(() => {
    const onConnect = () => {
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: true });

      // Attempt automatic reconnection if session data exists in sessionStorage
      const savedSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (savedSession) {
        try {
          const { roomId, sessionId, playerName } = JSON.parse(savedSession);
          if (roomId && sessionId && playerName) {
            console.log(`[Session] Reconnecting to room ${roomId} as ${playerName}`);
            socket.emit('join_room', { roomId, playerName, sessionId });
          }
        } catch {
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }
    };

    const onDisconnect = () => {
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: false });
    };

    const onRoomJoined = (data: any) => {
      const storedName =
        sessionStorage.getItem('dd_last_name') ||
        data.players.find((p: PublicPlayer) => p.id === data.you.id)?.name ||
        'Player';

      dispatch({
        type: 'ROOM_JOINED',
        payload: {
          roomId: data.roomId,
          you: data.you,
          players: data.players,
          hostId: data.hostId,
          settings: data.settings,
          phase: data.phase,
          name: storedName,
        },
      });

      // Save session identifier to sessionStorage (PRD Section 8)
      sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          roomId: data.roomId,
          sessionId: data.you.sessionId,
          playerName: storedName,
        })
      );

      // Update URL to /room/:code for seamless sharing/refreshing
      if (window.location.pathname !== `/room/${data.roomId}`) {
        window.history.pushState(null, '', `/room/${data.roomId}`);
      }
    };

    const onPlayerJoined = (data: { player: PublicPlayer; players: PublicPlayer[] }) => {
      dispatch({ type: 'PLAYER_JOINED', payload: data });
      addToast(`${data.player.name} joined the room!`, 'info');
    };

    const onPlayerLeft = (data: { playerId: string; players: PublicPlayer[]; hostId: string }) => {
      dispatch({ type: 'PLAYER_LEFT', payload: data });
      addToast('A player left the room.', 'info');
    };

    const onPlayersUpdated = (data: { players: PublicPlayer[]; hostId: string }) => {
      dispatch({ type: 'PLAYERS_UPDATED', payload: data });
    };

    const onSettingsUpdated = (data: { settings: RoomSettings }) => {
      dispatch({ type: 'SETTINGS_UPDATED', payload: data });
      addToast('Room settings updated by host.', 'info');
    };

    const onKicked = (data: { reason?: string }) => {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      dispatch({ type: 'RESET_ROOM' });
      window.history.pushState(null, '', '/');
      addToast(data.reason || 'You were kicked from the room.', 'error');
    };

    const onGameState = (data: { phase: GamePhase }) => {
      dispatch({ type: 'SET_PHASE', payload: data.phase });
    };

    const onError = (data: { code: string; message: string }) => {
      addToast(data.message, 'error');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room_joined', onRoomJoined);
    socket.on('player_joined', onPlayerJoined);
    socket.on('player_left', onPlayerLeft);
    socket.on('players_updated', onPlayersUpdated);
    socket.on('settings_updated', onSettingsUpdated);
    socket.on('kicked', onKicked);
    socket.on('game_state', onGameState);
    socket.on('error_message', onError);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room_joined', onRoomJoined);
      socket.off('player_joined', onPlayerJoined);
      socket.off('player_left', onPlayerLeft);
      socket.off('players_updated', onPlayersUpdated);
      socket.off('settings_updated', onSettingsUpdated);
      socket.off('kicked', onKicked);
      socket.off('game_state', onGameState);
      socket.off('error_message', onError);
    };
  }, []);

  // Action dispatchers
  const createRoom = (hostName: string, settings: RoomSettings) => {
    sessionStorage.setItem('dd_last_name', hostName);
    socket.emit('create_room', { hostName, settings });
  };

  const joinRoom = (roomId: string, playerName: string) => {
    sessionStorage.setItem('dd_last_name', playerName);
    const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
    let sessionId: string | undefined;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.roomId === roomId.toUpperCase()) {
          sessionId = parsed.sessionId;
        }
      } catch {
        // Ignore invalid session
      }
    }
    socket.emit('join_room', { roomId, playerName, sessionId });
  };

  const setReady = (ready: boolean) => {
    socket.emit('set_ready', { ready });
  };

  const updateSettings = (settings: Partial<RoomSettings>) => {
    socket.emit('update_settings', { settings });
  };

  const startGame = () => {
    socket.emit('start_game');
  };

  const kickPlayer = (playerId: string) => {
    socket.emit('kick_player', { playerId });
  };

  const leaveRoom = () => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    socket.emit('leave_room');
    dispatch({ type: 'RESET_ROOM' });
    window.history.pushState(null, '', '/');
  };

  return (
    <GameContext.Provider
      value={{
        state,
        createRoom,
        joinRoom,
        setReady,
        updateSettings,
        startGame,
        kickPlayer,
        leaveRoom,
        addToast,
        removeToast,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = (): GameContextType => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
