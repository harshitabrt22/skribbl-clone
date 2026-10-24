// React Context for Doodle Dash multiplayer state (PRD Section 8, 9, 14, 16.1, 16.3, 16.4)
//
// HOW STATE FLOWS:
//   Socket events arrive → event handlers dispatch actions → reducer updates state → React re-renders.
//   The client NEVER modifies scores, phases, or the word directly — all comes from the server.

import React, { createContext, useContext, useEffect, useReducer, ReactNode } from 'react';
import { socket } from '../socket';
import { GamePhase, PublicPlayer, RoomSettings, DEFAULT_SETTINGS, ToastMessage } from '../types';
import { ChatEntry } from '../components/ChatPanel';

interface You {
  id: string;
  sessionId: string;
  name: string;
}

interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  score: number;
}

interface GameState {
  roomId: string | null;
  you: You | null;
  players: PublicPlayer[];
  hostId: string | null;
  drawerId: string | null;
  settings: RoomSettings;
  phase: GamePhase;
  toasts: ToastMessage[];
  socketConnected: boolean;

  // Round state
  round: number;
  totalRounds: number;

  // Word state (Stage 4)
  wordMask: string | null;        // "_ _ _ _ _ _" for guessers
  wordLength: number;             // letter count (for the "(6 letters)" hint)
  word: string | null;            // real word — only set for the drawer
  wordOptions: string[];          // word choices during WORD_SELECTION (drawer only)
  remaining: number;              // timer remaining (seconds)
  totalTime: number;              // total draw time for this turn

  // Chat / guess feed
  chatEntries: ChatEntry[];

  // Round summary (shown for 5s after round_end)
  roundSummary: {
    word: string;
    reason: 'time' | 'all_guessed' | 'drawer_left';
    scores: { playerId: string; playerName: string; total: number }[];
  } | null;

  // Game over data
  gameOver: {
    winners: string[];
    leaderboard: LeaderboardEntry[];
  } | null;
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
        drawerId?: string;
        settings: RoomSettings;
        phase: GamePhase;
        name: string;
      };
    }
  | { type: 'PLAYER_JOINED'; payload: { player: PublicPlayer; players: PublicPlayer[] } }
  | { type: 'PLAYER_LEFT'; payload: { playerId: string; players: PublicPlayer[]; hostId: string } }
  | { type: 'PLAYERS_UPDATED'; payload: { players: PublicPlayer[]; hostId: string } }
  | { type: 'SETTINGS_UPDATED'; payload: { settings: RoomSettings } }
  | {
      type: 'GAME_STATE';
      payload: {
        phase: GamePhase;
        drawerId?: string;
        word?: string;
        wordMask?: string;
        wordLength?: number;
        wordOptions?: string[];
        remaining?: number;
        total?: number;
        players?: PublicPlayer[];
        round?: number;
        totalRounds?: number;
      };
    }
  | { type: 'ROUND_START'; payload: { drawerId: string; drawerName: string; drawTime: number; round?: number; totalRounds?: number } }
  | { type: 'WORD_OPTIONS'; payload: { wordOptions: string[] } }
  | { type: 'DRAWING_STARTED'; payload: { wordMask: string; wordLength: number; drawTime: number } }
  | { type: 'TIMER_TICK'; payload: { remaining: number } }
  | { type: 'GUESS_RESULT_CORRECT'; payload: { playerId: string; playerName: string; points: number; basePoints: number; streakBonus: number; streak: number } }
  | { type: 'GUESS_RESULT_CLOSE' }
  | { type: 'CHAT_MESSAGE'; payload: { playerId: string; playerName: string; text: string } }
  | { type: 'ROUND_END'; payload: { word: string; reason: 'time' | 'all_guessed' | 'drawer_left'; scores: { playerId: string; playerName: string; total: number }[]; players: PublicPlayer[] } }
  | { type: 'CLEAR_ROUND_SUMMARY' }
  | { type: 'GAME_OVER'; payload: { winners: string[]; leaderboard: LeaderboardEntry[]; players: PublicPlayer[] } }
  | { type: 'ROOM_RESET'; payload: { phase: GamePhase; players: PublicPlayer[]; settings: RoomSettings; hostId: string } }
  | { type: 'ADD_TOAST'; payload: ToastMessage }
  | { type: 'REMOVE_TOAST'; payload: string }
  | { type: 'RESET_ROOM' };

const initialState: GameState = {
  roomId: null,
  you: null,
  players: [],
  hostId: null,
  drawerId: null,
  settings: DEFAULT_SETTINGS,
  phase: 'LOBBY',
  toasts: [],
  socketConnected: socket.connected,
  round: 1,
  totalRounds: 3,
  wordMask: null,
  wordLength: 0,
  word: null,
  wordOptions: [],
  remaining: 0,
  totalTime: 80,
  chatEntries: [],
  roundSummary: null,
  gameOver: null,
};

/** Generate a unique ID for chat entries (React list keys) */
function chatId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

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
        drawerId: action.payload.drawerId || null,
        settings: action.payload.settings,
        phase: action.payload.phase,
        // Clear game-specific state on fresh join
        chatEntries: [],
        roundSummary: null,
        gameOver: null,
        word: null,
        round: 1,
        totalRounds: action.payload.settings.rounds,
        wordMask: null,
        wordOptions: [],
      };

    case 'PLAYER_JOINED':
      return { ...state, players: action.payload.players };

    case 'PLAYER_LEFT':
      return { ...state, players: action.payload.players, hostId: action.payload.hostId };

    case 'PLAYERS_UPDATED':
      return { ...state, players: action.payload.players, hostId: action.payload.hostId };

    case 'SETTINGS_UPDATED':
      return { ...state, settings: action.payload.settings };

    case 'GAME_STATE':
      return {
        ...state,
        phase: action.payload.phase,
        drawerId: action.payload.drawerId ?? state.drawerId,
        word: action.payload.word ?? state.word,
        wordMask: action.payload.wordMask ?? state.wordMask,
        wordLength: action.payload.wordLength ?? state.wordLength,
        wordOptions: action.payload.wordOptions ?? state.wordOptions,
        remaining: action.payload.remaining ?? state.remaining,
        totalTime: action.payload.total ?? state.totalTime,
        players: action.payload.players ?? state.players,
        round: action.payload.round ?? state.round,
        totalRounds: action.payload.totalRounds ?? state.totalRounds,
      };

    case 'ROUND_START':
      // A new turn begins: clear chat, reset word state, set drawer
      return {
        ...state,
        phase: 'WORD_SELECTION',
        drawerId: action.payload.drawerId,
        word: null,
        round: action.payload.round ?? state.round,
        totalRounds: action.payload.totalRounds ?? state.totalRounds,
        wordMask: null,
        wordOptions: [],
        totalTime: action.payload.drawTime,
        remaining: action.payload.drawTime,
        chatEntries: [], // fresh chat for each turn
        roundSummary: null,
      };

    case 'WORD_OPTIONS':
      // Drawer only: server sends the word choices
      return {
        ...state,
        wordOptions: action.payload.wordOptions,
      };

    case 'DRAWING_STARTED':
      return {
        ...state,
        phase: 'DRAWING',
        wordMask: action.payload.wordMask,
        wordLength: action.payload.wordLength,
        totalTime: action.payload.drawTime,
        remaining: action.payload.drawTime,
      };

    case 'TIMER_TICK':
      return { ...state, remaining: action.payload.remaining };

    case 'GUESS_RESULT_CORRECT':
      // Add "PlayerX guessed the word!" to the chat feed
      return {
        ...state,
        chatEntries: [
          ...state.chatEntries,
          {
            id: chatId(),
            type: 'correct',
            playerName: action.payload.playerName,
            points: action.payload.points,
            streakBonus: action.payload.streakBonus,
            streak: action.payload.streak,
          },
        ],
      };

    case 'GUESS_RESULT_CLOSE':
      // Private "So close!" hint
      return {
        ...state,
        chatEntries: [
          ...state.chatEntries,
          { id: chatId(), type: 'close' },
        ],
      };

    case 'CHAT_MESSAGE':
      return {
        ...state,
        chatEntries: [
          ...state.chatEntries,
          {
            id: chatId(),
            type: 'chat',
            playerName: action.payload.playerName,
            text: action.payload.text,
          },
        ],
      };

    case 'ROUND_END':
      return {
        ...state,
        phase: 'ROUND_END',
        players: action.payload.players,
        roundSummary: {
          word: action.payload.word,
          reason: action.payload.reason,
          scores: action.payload.scores,
        },
      };

    case 'CLEAR_ROUND_SUMMARY':
      return { ...state, roundSummary: null };

    case 'GAME_OVER':
      return {
        ...state,
        phase: 'GAME_OVER',
        players: action.payload.players,
        gameOver: {
          winners: action.payload.winners,
          leaderboard: action.payload.leaderboard,
        },
      };

    case 'ROOM_RESET':
      // Play Again: go back to lobby with reset scores
      return {
        ...state,
        phase: action.payload.phase,
        players: action.payload.players,
        settings: action.payload.settings,
        hostId: action.payload.hostId,
        word: null,
        round: 1,
        totalRounds: action.payload.settings.rounds,
        wordMask: null,
        wordOptions: [],
        chatEntries: [],
        roundSummary: null,
        gameOver: null,
        drawerId: null,
      };

    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts.slice(-4), action.payload] };

    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.payload) };

    case 'RESET_ROOM':
      return {
        ...state,
        roomId: null,
        you: null,
        players: [],
        hostId: null,
        drawerId: null,
        settings: DEFAULT_SETTINGS,
        phase: 'LOBBY',
        word: null,
        round: 1,
        totalRounds: DEFAULT_SETTINGS.rounds,
        wordMask: null,
        wordOptions: [],
        chatEntries: [],
        roundSummary: null,
        gameOver: null,
      };

    default:
      return state;
  }
}

interface GameContextType {
  state: GameState;
  isDrawer: boolean;
  isHost: boolean;
  createRoom: (hostName: string, settings: RoomSettings) => void;
  joinRoom: (roomId: string, playerName: string) => void;
  setReady: (ready: boolean) => void;
  updateSettings: (settings: Partial<RoomSettings>) => void;
  startGame: () => void;
  undoDraw: () => void;
  clearCanvas: () => void;
  kickPlayer: (playerId: string) => void;
  leaveRoom: () => void;
  chooseWord: (word: string) => void;
  sendGuess: (text: string) => void;
  sendChat: (text: string) => void;
  playAgain: () => void;
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
    setTimeout(() => dispatch({ type: 'REMOVE_TOAST', payload: id }), 4000);
  };

  const removeToast = (id: string) => dispatch({ type: 'REMOVE_TOAST', payload: id });

  const isDrawer = Boolean(state.you && state.drawerId && state.you.id === state.drawerId);
  const isHost = Boolean(state.you && state.hostId && state.you.id === state.hostId);

  useEffect(() => {
    // ─── Socket connection ────────────────────────────────────────────────
    const onConnect = () => {
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: true });

      const savedSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (savedSession) {
        try {
          const { roomId, sessionId, playerName } = JSON.parse(savedSession);
          if (roomId && sessionId && playerName) {
            socket.emit('join_room', { roomId, playerName, sessionId });
          }
        } catch {
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }
    };

    const onDisconnect = () => dispatch({ type: 'SET_SOCKET_CONNECTED', payload: false });

    // ─── Room events ──────────────────────────────────────────────────────
    const onRoomJoined = (data: any) => {
      const storedName =
        sessionStorage.getItem('dd_last_name') ||
        data.players.find((p: PublicPlayer) => p.id === data.you.id)?.name ||
        'Player';

      dispatch({
        type: 'ROOM_JOINED',
        payload: { ...data, name: storedName },
      });

      sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ roomId: data.roomId, sessionId: data.you.sessionId, playerName: storedName })
      );

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
    };

    const onPlayersUpdated = (data: { players: PublicPlayer[]; hostId: string }) => {
      dispatch({ type: 'PLAYERS_UPDATED', payload: data });
    };

    const onSettingsUpdated = (data: { settings: RoomSettings }) => {
      dispatch({ type: 'SETTINGS_UPDATED', payload: data });
      addToast('Room settings updated.', 'info');
    };

    const onKicked = (data: { reason?: string }) => {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      dispatch({ type: 'RESET_ROOM' });
      window.history.pushState(null, '', '/');
      addToast(data.reason || 'You were kicked from the room.', 'error');
    };

    // ─── Game state events (Stage 4) ─────────────────────────────────────

    const onGameState = (data: any) => {
      dispatch({ type: 'GAME_STATE', payload: data });
    };

    // round_start fires at the beginning of each new turn (public broadcast)
    const onRoundStart = (data: { drawerId: string; drawerName: string; drawTime: number; round?: number; totalRounds?: number }) => {
      dispatch({ type: 'ROUND_START', payload: data });
    };

    // word_options fires to the drawer only — the secret word choices
    const onWordOptions = (data: { wordOptions: string[] }) => {
      dispatch({ type: 'WORD_OPTIONS', payload: data });
    };

    // drawing_started fires when the drawer picks a word and drawing begins
    const onDrawingStarted = (data: { wordMask: string; wordLength: number; drawTime: number }) => {
      dispatch({ type: 'DRAWING_STARTED', payload: data });
    };

    const onTimerTick = (data: { remaining: number }) => {
      dispatch({ type: 'TIMER_TICK', payload: data });
    };

    // guess_result can be public (correct=true) or private (close=true)
    const onGuessResult = (data: any) => {
      if (data.correct) {
        dispatch({ type: 'GUESS_RESULT_CORRECT', payload: data });
      } else if (data.close) {
        dispatch({ type: 'GUESS_RESULT_CLOSE' });
        addToast('🟡 So close! One letter off.', 'info');
      }
    };

    const onChatMessage = (data: { playerId: string; playerName: string; text: string }) => {
      dispatch({ type: 'CHAT_MESSAGE', payload: data });
    };

    // round_end reveals the word and shows who scored
    const onRoundEnd = (data: any) => {
      dispatch({ type: 'ROUND_END', payload: data });
    };

    const onGameOver = (data: any) => {
      dispatch({ type: 'GAME_OVER', payload: data });
    };

    // play_again resets the room to LOBBY
    const onRoomReset = (data: any) => {
      dispatch({ type: 'ROOM_RESET', payload: data });
    };

    const onError = (data: { code: string; message: string }) => {
      addToast(data.message, 'error');
    };

    // Register all listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room_joined', onRoomJoined);
    socket.on('player_joined', onPlayerJoined);
    socket.on('player_left', onPlayerLeft);
    socket.on('players_updated', onPlayersUpdated);
    socket.on('settings_updated', onSettingsUpdated);
    socket.on('kicked', onKicked);
    socket.on('game_state', onGameState);
    socket.on('round_start', onRoundStart);
    socket.on('word_options', onWordOptions);
    socket.on('drawing_started', onDrawingStarted);
    socket.on('timer_tick', onTimerTick);
    socket.on('guess_result', onGuessResult);
    socket.on('chat_message', onChatMessage);
    socket.on('round_end', onRoundEnd);
    socket.on('game_over', onGameOver);
    socket.on('room_reset', onRoomReset);
    socket.on('error_message', onError);

    if (socket.connected) onConnect();

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
      socket.off('round_start', onRoundStart);
      socket.off('word_options', onWordOptions);
      socket.off('drawing_started', onDrawingStarted);
      socket.off('timer_tick', onTimerTick);
      socket.off('guess_result', onGuessResult);
      socket.off('chat_message', onChatMessage);
      socket.off('round_end', onRoundEnd);
      socket.off('game_over', onGameOver);
      socket.off('room_reset', onRoomReset);
      socket.off('error_message', onError);
    };
  }, []);

  // ─── Action creators (emit socket events) ─────────────────────────────────

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
        if (parsed.roomId === roomId.toUpperCase()) sessionId = parsed.sessionId;
      } catch { /* ignore */ }
    }
    socket.emit('join_room', { roomId, playerName, sessionId });
  };

  const setReady = (ready: boolean) => socket.emit('set_ready', { ready });
  const updateSettings = (settings: Partial<RoomSettings>) => socket.emit('update_settings', { settings });
  const startGame = () => socket.emit('start_game');
  const undoDraw = () => socket.emit('draw_undo');
  const clearCanvas = () => socket.emit('canvas_clear');
  const kickPlayer = (playerId: string) => socket.emit('kick_player', { playerId });

  const leaveRoom = () => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    socket.emit('leave_room');
    dispatch({ type: 'RESET_ROOM' });
    window.history.pushState(null, '', '/');
  };

  // Drawer picks a word during WORD_SELECTION
  const chooseWord = (word: string) => socket.emit('word_chosen', { word });

  // Guesser sends a guess (or any chat during drawing)
  const sendGuess = (text: string) => socket.emit('guess', { text });

  // General chat (non-drawing phases or drawer chat)
  const sendChat = (text: string) => socket.emit('chat', { text });

  // Host requests a new game after GAME_OVER
  const playAgain = () => socket.emit('play_again');

  return (
    <GameContext.Provider
      value={{
        state,
        isDrawer,
        isHost,
        createRoom,
        joinRoom,
        setReady,
        updateSettings,
        startGame,
        undoDraw,
        clearCanvas,
        kickPlayer,
        leaveRoom,
        chooseWord,
        sendGuess,
        sendChat,
        playAgain,
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
  if (!context) throw new Error('useGame must be used within a GameProvider');
  return context;
};
