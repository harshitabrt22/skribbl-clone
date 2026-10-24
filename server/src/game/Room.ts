// Room model managing players, settings, and room lifecycle (PRD Section 4.2, 7.3, 8, 11)

import crypto from 'crypto';
import { Player } from './Player';
import { Game, GameIO } from './Game';
import { GamePhase, PublicPlayer, PublicRoomInfo, RoomSettings } from '../types';
import { validateSettings } from '../lib/validation';

export class Room {
  public code: string;
  public settings: RoomSettings;
  public players: Map<string, Player> = new Map();
  public hostId: string = '';
  public phase: GamePhase = 'LOBBY';
  public game: Game = new Game();
  public emptyTimeout?: NodeJS.Timeout;
  public onDestroy?: (code: string) => void;

  // Tracks which player in turnOrder is currently drawing
  // turnOrder is fixed at game start (join order); each round everyone draws once
  private turnOrderIndex: number = 0;
  private currentRound: number = 1;

  // After a turn ends, we wait 5 seconds before starting the next (round summary)
  private nextTurnTimer?: NodeJS.Timeout;

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
      return this.removePlayer(player.id);
    }

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
   * Start the full game flow (Stage 4).
   * Freezes turn order, resets scores, and begins word selection for the first drawer.
   *
   * @param io   The GameIO interface for emitting socket events
   */
  public startGame(io: GameIO): void {
    // Lock turn order to current join order (only connected players)
    this.game = new Game(); // fresh game state
    this.game.attachIO(io, this.code);
    this.game.drawTimeTotal = this.settings.drawTime;

    // Build turn order from all connected players in join order
    this.game.turnOrder = Array.from(this.players.values())
      .filter((p) => p.connected)
      .map((p) => p.id);

    this.currentRound = 1;
    this.turnOrderIndex = 0;
    this.phase = 'WORD_SELECTION';
    this.game.round = this.currentRound;

    // Reset all scores and streaks for a fresh game
    for (const p of this.players.values()) {
      p.score = 0;
      p.streak = 0;
      p.hasGuessed = false;
    }

    // Wire up the end-of-turn callback: Room handles what happens after each turn
    this.game.onTurnEnd = (reason) => {
      this.phase = 'ROUND_END';
      // Wait 5 seconds so players can see the round summary, then advance
      this.nextTurnTimer = setTimeout(() => {
        this.advanceTurn(io, reason);
      }, 5000);
    };

    // Begin the first word selection
    const firstDrawer = this.players.get(this.game.turnOrder[0]);
    if (firstDrawer) {
      this.game.drawerId = firstDrawer.id;
      this.game.beginWordSelection(
        firstDrawer,
        this.settings.wordCount,
        this.settings.rounds,
        this.players,
        this.hostId
      );
    }

    console.log(`[Room] Game started in room ${this.code}. Turn order: ${this.game.turnOrder.join(', ')}`);
  }

  /**
   * Called when a drawer picks a word (from registerHandlers).
   * Validates the word is one of the offered options (PRD 12.2).
   */
  public handleWordChosen(
    playerId: string,
    word: string,
    io: GameIO
  ): { success: boolean; error?: string } {
    if (this.game.phase !== 'WORD_SELECTION') {
      return { success: false, error: 'Not in word selection phase.' };
    }
    if (playerId !== this.game.drawerId) {
      return { success: false, error: 'Only the current drawer can choose a word.' };
    }
    // Security: word must be one of the server-offered options (PRD 12.2)
    if (!this.game.wordOptions.includes(word)) {
      return { success: false, error: 'Invalid word choice.' };
    }

    this.phase = 'DRAWING';
    this.game.chooseWord(word, this.players, this.hostId, this.settings.rounds);
    return { success: true };
  }

  /**
   * Called when a guesser sends a guess (or any non-drawer chat in DRAWING phase).
   */
  public handleGuess(playerId: string, text: string): void {
    const player = this.players.get(playerId);
    if (!player) return;
    this.game.handleGuess(player, text, this.players, this.hostId, this.settings.rounds);
  }

  /**
   * Advance to the next turn after a round ends.
   * Checks if the game is over; if not, moves to the next drawer.
   */
  private advanceTurn(io: GameIO, reason: string): void {
    // Check if fewer than 2 connected players remain
    const connected = Array.from(this.players.values()).filter((p) => p.connected);
    if (connected.length < 2) {
      console.log(`[Room] Fewer than 2 players connected, ending game early.`);
      this.endGame(io);
      return;
    }

    // Find the next connected player in turn order
    let foundNextDrawer = false;
    while (!foundNextDrawer) {
      this.turnOrderIndex += 1;
      if (this.turnOrderIndex >= this.game.turnOrder.length) {
        this.turnOrderIndex = 0;
        this.currentRound += 1;
      }

      if (this.currentRound > this.settings.rounds) {
        this.endGame(io);
        return;
      }

      const candidateId = this.game.turnOrder[this.turnOrderIndex];
      const candidate = this.players.get(candidateId);
      if (candidate && candidate.connected) {
        foundNextDrawer = true;
      }
    }

    // Start next word selection
    this.phase = 'WORD_SELECTION';
    this.game.round = this.currentRound;

    const nextDrawer = this.players.get(this.game.turnOrder[this.turnOrderIndex])!;
    this.game.drawerId = nextDrawer.id;
    this.game.beginWordSelection(
      nextDrawer,
      this.settings.wordCount,
      this.settings.rounds,
      this.players,
      this.hostId
    );
  }

  /**
   * Ends game early if fewer than 2 connected players remain
   */
  public endGameEarly(io: GameIO): void {
    if (this.phase !== 'GAME_OVER' && this.phase !== 'LOBBY') {
      this.endGame(io);
    }
  }

  /**
   * End the game and send the leaderboard to all players.
   */
  private endGame(io: GameIO): void {
    this.phase = 'GAME_OVER';
    this.game.phase = 'GAME_OVER';
    this.game.clearTimers();

    // Sort players by score (descending) for the leaderboard
    const sorted = Array.from(this.players.values()).sort((a, b) => b.score - a.score);

    // Find winner(s) — ties are allowed
    const topScore = sorted[0]?.score ?? 0;
    const winners = sorted.filter((p) => p.score === topScore).map((p) => p.name);

    const leaderboard = sorted.map((p, i) => ({
      rank: i + 1,
      playerId: p.id,
      playerName: p.name,
      score: p.score,
    }));

    // Adjust ranks for ties (same score → same rank)
    for (let i = 1; i < leaderboard.length; i++) {
      if (leaderboard[i].score === leaderboard[i - 1].score) {
        leaderboard[i].rank = leaderboard[i - 1].rank;
      }
    }

    io.toRoom('game_over', {
      winner: winners.length === 1 ? winners[0] : null,
      winners,
      leaderboard,
      players: sorted.map((p) => p.toPublic(p.id === this.hostId)),
    });

    console.log(`[Room] Game over in room ${this.code}. Winner(s): ${winners.join(', ')}`);
  }

  /**
   * Handle drawer disconnection mid-turn: end the turn early.
   */
  public handleDrawerDisconnect(io: GameIO): void {
    if (this.game.phase === 'DRAWING' || this.game.phase === 'WORD_SELECTION') {
      this.game.endTurn('drawer_left', this.players, this.hostId, this.settings.rounds);
    }
  }

  /**
   * Reset the room back to LOBBY for a "Play Again" (PRD Section 6.11)
   */
  public resetForPlayAgain(): void {
    this.game.clearTimers();
    if (this.nextTurnTimer) { clearTimeout(this.nextTurnTimer); this.nextTurnTimer = undefined; }
    this.game = new Game();
    this.phase = 'LOBBY';
    this.currentRound = 1;
    this.turnOrderIndex = 0;

    for (const p of this.players.values()) {
      p.score = 0;
      p.streak = 0;
      p.hasGuessed = false;
      p.ready = p.id === this.hostId; // host is auto-ready, others need to re-ready
    }
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
    this.game.clearTimers();
    if (this.nextTurnTimer) { clearTimeout(this.nextTurnTimer); this.nextTurnTimer = undefined; }
    for (const player of this.players.values()) {
      if (player.disconnectTimeout) {
        clearTimeout(player.disconnectTimeout);
        player.disconnectTimeout = undefined;
      }
    }
  }
}
