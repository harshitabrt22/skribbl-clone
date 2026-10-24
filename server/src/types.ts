// Core data types and interfaces for Doodle Dash (PRD Section 4.6 & 16.1)

export type WordMode = 'Normal' | 'Hidden';

export interface RoomSettings {
  maxPlayers: number;        // Range: 2 - 20 (default 8)
  rounds: number;            // Range: 2 - 10 (default 3)
  drawTime: number;          // Range: 15 - 240 seconds (default 80)
  wordCount: number;         // Range: 1 - 5 choices (default 3)
  hints: number;             // Range: 0 - 5 (default 2)
  wordMode: WordMode;        // 'Normal' | 'Hidden' (default 'Normal')
  isPublic: boolean;         // true = visible in public lobby list (default false)
  challengesEnabled: boolean; // Feature A toggle (default true)
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
  | 'WORD_SELECTION'
  | 'DRAWING'
  | 'ROUND_END'
  | 'GAME_OVER'
  | 'STARTING'; // Stage 2 placeholder for starting game

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
