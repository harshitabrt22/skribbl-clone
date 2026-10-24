// Core data types and interfaces for Doodle Dash (PRD Section 4.6, 9, 16.1, 16.3)

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

export type ChallengeId = 'TWO_COLORS' | 'ONE_STROKE' | 'SPEED_DRAW' | 'HONOR_NO_LETTERS';

export interface ChallengeCardInfo {
  id: ChallengeId;
  title: string;
  description: string;
  enforced: boolean;
  reward?: number;
}

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

// 12-Color Palette defined in PRD Section 19.1
export const PALETTE_COLORS = [
  '#1E1B2E', // Black / Ink
  '#FFFFFF', // White / Canvas background
  '#E5484D', // Red
  '#FF8A3D', // Orange
  '#FFD23F', // Yellow
  '#2ED3A3', // Mint
  '#1FB86B', // Green
  '#4C6FFF', // Blue
  '#8E5CFF', // Purple
  '#FF7EB6', // Pink
  '#8B5E3C', // Brown
  '#9AA0A6', // Gray
] as const;

export const BRUSH_SIZES = [4, 10, 20] as const;
export type BrushSize = (typeof BRUSH_SIZES)[number];
export type DrawingTool = 'brush' | 'eraser';

// Canvas logical coordinates normalized to [0, 1] (PRD Section 9)
export interface Point {
  x: number;
  y: number;
}

// Stroke data model stored in memory on the server
export interface Stroke {
  id: string;
  tool: DrawingTool;
  color: string;
  size: number;
  points: Point[];
}

// Draw data broadcast payload (PRD Section 16.3)
export interface DrawDataPayload {
  type: 'start' | 'move' | 'end';
  strokeId: string;
  x?: number;
  y?: number;
  color?: string;
  size?: number;
  tool?: DrawingTool;
}
