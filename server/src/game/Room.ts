// Room model managing players, settings, and room lifecycle (PRD Section 4.2, 7.3, 8)

import crypto from 'crypto';
import { Player } from './Player';
import { GamePhase, PublicPlayer, PublicRoomInfo, RoomSettings, DEFAULT_SETTINGS } from '../types';
import { validateSettings } from '../lib/validation';

export class Room {
  public code: string;
  public settings: RoomSettings;
  public players: Map<string, Player> = new Map();
  public hostId: string = '';
  public phase: GamePhase = 'LOBBY';
  public emptyTimeout?: NodeJS.Timeout;
  public onDestroy?: (code: string) => void;

  constructor(code: string, initialSettings?: Partial<RoomSettings>, onDestroy?: (code: string) => void) {
    this.code = code;
    this.settings = validateSettings(initialSettings || {}).settings;
    this.onDestroy = onDestroy;
  }

  /**
   * Generates a unique, de-duplicated player name if someone joins with an existing name (PRD Section 8)
   */
  private getUniqueName(baseName: string): string {
    const existingNames = new Set(Array.from(this.players.values()).map((p) => p.name.toLowerCase()));
    if (!existingNames.has(baseName.toLowerCase())) {
      return baseName;
    }

    let suffix = 2;
    while (existingNames.has(`${baseName.toLowerCase()} ${suffix}`)) {
      suffix += 1;
    }
    return `${baseName} ${suffix}`;
  }

  /**
   * Adds a new player or reconnects an existing player via sessionId (PRD Section 8)
   */
  public addPlayer(
    rawName: string,
    socketId: string,
    sessionId?: string
  ): { success: boolean; player?: Player; isReconnect: boolean; errorCode?: string; errorMessage?: string } {
    // 1. Reconnection check: if client provided a known sessionId, re-bind socket
    if (sessionId) {
      for (const existingPlayer of this.players.values()) {
        if (existingPlayer.sessionId === sessionId) {
          existingPlayer.socketId = socketId;
          existingPlayer.connected = true;
          if (existingPlayer.disconnectTimeout) {
            clearTimeout(existingPlayer.disconnectTimeout);
            existingPlayer.disconnectTimeout = undefined;
          }
          this.cancelEmptyTimeout();
          return { success: true, player: existingPlayer, isReconnect: true };
        }
      }
    }

    // 2. Joining as a new player: validate room capacity
    if (this.players.size >= this.settings.maxPlayers) {
      return { success: false, isReconnect: false, errorCode: 'ROOM_FULL', errorMessage: 'This room is full.' };
    }

    // 3. Game phase check: new joins are locked once game starts (PRD Section 6, 8)
    if (this.phase !== 'LOBBY') {
      return { success: false, isReconnect: false, errorCode: 'GAME_STARTED', errorMessage: 'Game is already in progress.' };
    }

    // 4. Create new player
    const playerId = `p_${crypto.randomBytes(6).toString('hex')}`;
    const newSessionId = `s_${crypto.randomBytes(12).toString('hex')}`;
    const uniqueName = this.getUniqueName(rawName);

    const player = new Player(playerId, socketId, newSessionId, uniqueName);

    // If first player, designate as host
    if (this.players.size === 0) {
      this.hostId = playerId;
      player.ready = true; // Host is ready by default
    }

    this.players.set(playerId, player);
    this.cancelEmptyTimeout();

    return { success: true, player, isReconnect: false };
  }

  /**
   * Removes a player when they leave voluntarily or disconnect in the lobby
   */
  public removePlayer(playerId: string): { player?: Player; newHostId?: string; isEmpty: boolean } {
    const player = this.players.get(playerId);
    if (!player) {
      return { isEmpty: this.players.size === 0 };
    }

    if (this.phase === 'LOBBY') {
      // In lobby, completely remove player
      this.players.delete(playerId);

      // If host left, assign host to next remaining player
      if (this.hostId === playerId && this.players.size > 0) {
        const nextPlayer = this.players.values().next().value;
        if (nextPlayer) {
          this.hostId = nextPlayer.id;
          nextPlayer.ready = true;
        }
      }
    } else {
      // In game, mark disconnected
      player.connected = false;

      // Reassign host if host left
      if (this.hostId === playerId) {
        const nextConnected = Array.from(this.players.values()).find((p) => p.connected);
        if (nextConnected) {
          this.hostId = nextConnected.id;
        }
      }
    }

    const isEmpty = Array.from(this.players.values()).filter((p) => p.connected).length === 0;
    if (isEmpty) {
      this.scheduleEmptyTimeout();
    }

    return {
      player,
      newHostId: this.hostId,
      isEmpty,
    };
  }

  /**
   * Handles socket disconnection
   */
  public handleDisconnect(socketId: string): { player?: Player; newHostId?: string; isEmpty: boolean } {
    const player = Array.from(this.players.values()).find((p) => p.socketId === socketId);
    if (!player) {
      return { isEmpty: this.players.size === 0 };
    }

    if (this.phase === 'LOBBY') {
      // In lobby, remove immediately
      return this.removePlayer(player.id);
    }

    // In game: mark disconnected and wait 30s before skipping turns
    player.connected = false;
    if (this.hostId === player.id) {
      const nextConnected = Array.from(this.players.values()).find((p) => p.connected);
      if (nextConnected) {
        this.hostId = nextConnected.id;
      }
    }

    const isEmpty = Array.from(this.players.values()).filter((p) => p.connected).length === 0;
    if (isEmpty) {
      this.scheduleEmptyTimeout();
    }

    return {
      player,
      newHostId: this.hostId,
      isEmpty,
    };
  }

  /**
   * Toggles ready state for a player
   */
  public setReady(playerId: string, ready: boolean): boolean {
    if (this.phase !== 'LOBBY') return false;
    const player = this.players.get(playerId);
    if (!player) return false;

    // Host is always considered ready
    if (playerId === this.hostId) {
      player.ready = true;
      return true;
    }

    player.ready = Boolean(ready);
    return true;
  }

  /**
   * Updates room settings (host only, lobby only)
   */
  public updateSettings(
    newSettings: Partial<RoomSettings>,
    requesterId: string
  ): { success: boolean; errorCode?: string; errorMessage?: string } {
    if (requesterId !== this.hostId) {
      return { success: false, errorCode: 'NOT_HOST', errorMessage: 'Only the host can modify room settings.' };
    }
    if (this.phase !== 'LOBBY') {
      return { success: false, errorCode: 'BAD_PHASE', errorMessage: 'Settings can only be changed in the lobby.' };
    }

    const validation = validateSettings({ ...this.settings, ...newSettings });
    this.settings = validation.settings;
    return { success: true };
  }

  /**
   * Kicks a player from the room (host only, cannot kick self)
   */
  public kickPlayer(
    targetId: string,
    requesterId: string
  ): { success: boolean; kickedPlayer?: Player; errorCode?: string; errorMessage?: string } {
    if (requesterId !== this.hostId) {
      return { success: false, errorCode: 'NOT_HOST', errorMessage: 'Only the host can kick players.' };
    }
    if (targetId === this.hostId) {
      return { success: false, errorCode: 'INVALID_ACTION', errorMessage: 'Host cannot kick themselves.' };
    }

    const player = this.players.get(targetId);
    if (!player) {
      return { success: false, errorCode: 'PLAYER_NOT_FOUND', errorMessage: 'Player does not exist.' };
    }

    this.players.delete(targetId);
    return { success: true, kickedPlayer: player };
  }

  /**
   * Validates if the game can start (host only, >= 2 players, all non-host ready)
   */
  public canStartGame(requesterId: string): { canStart: boolean; reason?: string } {
    if (requesterId !== this.hostId) {
      return { canStart: false, reason: 'Only the host can start the game.' };
    }
    if (this.phase !== 'LOBBY') {
      return { canStart: false, reason: 'Game has already started.' };
    }

    const connectedPlayers = Array.from(this.players.values()).filter((p) => p.connected);
    if (connectedPlayers.length < 2) {
      return { canStart: false, reason: 'At least 2 connected players are required to start.' };
    }

    const unreadyPlayers = connectedPlayers.filter((p) => p.id !== this.hostId && !p.ready);
    if (unreadyPlayers.length > 0) {
      return { canStart: false, reason: 'Waiting for all players to click Ready.' };
    }

    return { canStart: true };
  }

  /**
   * Serializes public players array
   */
  public getPublicPlayers(): PublicPlayer[] {
    return Array.from(this.players.values()).map((p) => p.toPublic(p.id === this.hostId));
  }

  /**
   * Public room summary for the lobby browser
   */
  public toPublicInfo(): PublicRoomInfo {
    const hostPlayer = this.players.get(this.hostId);
    return {
      code: this.code,
      playerCount: this.players.size,
      maxPlayers: this.settings.maxPlayers,
      rounds: this.settings.rounds,
      drawTime: this.settings.drawTime,
      hostName: hostPlayer ? hostPlayer.name : 'Unknown',
    };
  }

  /**
   * Schedules room deletion after 60 seconds if empty (PRD Section 8)
   */
  private scheduleEmptyTimeout(): void {
    this.cancelEmptyTimeout();
    this.emptyTimeout = setTimeout(() => {
      if (this.onDestroy) {
        this.onDestroy(this.code);
      }
    }, 60000);
  }

  private cancelEmptyTimeout(): void {
    if (this.emptyTimeout) {
      clearTimeout(this.emptyTimeout);
      this.emptyTimeout = undefined;
    }
  }

  public clearAllTimers(): void {
    this.cancelEmptyTimeout();
    for (const player of this.players.values()) {
      if (player.disconnectTimeout) {
        clearTimeout(player.disconnectTimeout);
        player.disconnectTimeout = undefined;
      }
    }
  }
}
