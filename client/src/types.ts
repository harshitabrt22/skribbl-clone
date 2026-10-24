// Client types matching server contract (PRD Section 4.6, 16.1)

export type WordMode = 'Normal' | 'Hidden';

export interface RoomSettings {
  maxPlayers: number;
  rounds: number;
  drawTime: number;
  wordCount: number;
  hints: number;
  wordMode: WordMode;
  isPublic: boolean;
  challengesEnabled: boolean;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  maxPlayers: 8,
  rounds: 3,
  drawTime: 80,
  wordCount: 3,
  hints: 2,
  wordMode: 'Normal',
  isPublic: false,
  challengesEnabled: true,
};

export type GamePhase =
  | 'LOBBY'
  | 'STARTING'
  | 'WORD_SELECTION'
  | 'DRAWING'
  | 'ROUND_END'
  | 'GAME_OVER';

export interface PublicPlayer {
  id: string;
  name: string;
  score: number;
  streak: number;
  ready: boolean;
  connected: boolean;
  isHost: boolean;
  hasGuessed: boolean;
}

export interface PublicRoomInfo {
  code: string;
  playerCount: number;
  maxPlayers: number;
  rounds: number;
  drawTime: number;
  hostName: string;
}

export interface ToastMessage {
  id: string;
  type: 'error' | 'success' | 'info';
  message: string;
}
