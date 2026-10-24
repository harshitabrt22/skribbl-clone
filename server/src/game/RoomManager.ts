// RoomManager: In-memory registry for all active rooms and socket lookups (PRD Section 8, 11)

import crypto from 'crypto';
import { Room } from './Room';
import { Player } from './Player';
import { PublicRoomInfo, RoomSettings } from '../types';

// 6-character room codes excluding ambiguous characters (I, 1, O, 0, L)
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  // Quick lookup to resolve which room and player a socket belongs to
  private socketMap: Map<string, { roomCode: string; playerId: string }> = new Map();

  /**
   * Generates a collision-free 6-character room code (PRD Section 8)
   */
  public generateRoomCode(): string {
    let attempts = 0;
    while (attempts < 100) {
      let code = '';
      const randomBytes = crypto.randomBytes(6);
      for (let i = 0; i < 6; i++) {
        code += CODE_ALPHABET[randomBytes[i] % CODE_ALPHABET.length];
      }

      if (!this.rooms.has(code)) {
        return code;
      }
      attempts += 1;
    }
    // Fallback in the rare event of repeated collision
    return `R${Date.now().toString(36).slice(-5).toUpperCase()}`;
  }

  /**
   * Creates a new room and registers the host player
   */
  public createRoom(
    hostName: string,
    socketId: string,
    initialSettings?: Partial<RoomSettings>
  ): { room: Room; host: Player } {
    const code = this.generateRoomCode();
    const room = new Room(code, initialSettings, (destroyedCode) => this.deleteRoom(destroyedCode));

    const joinResult = room.addPlayer(hostName, socketId);
    if (!joinResult.player) {
      throw new Error('Failed to create host player');
    }

    this.rooms.set(code, room);
    this.bindSocket(socketId, code, joinResult.player.id);

    return { room, host: joinResult.player };
  }

  /**
   * Finds a room by code (case-insensitive)
   */
  public getRoom(code: string): Room | undefined {
    return this.rooms.get(code.trim().toUpperCase());
  }

  /**
   * Removes and cleans up a room
   */
  public deleteRoom(code: string): void {
    const cleanCode = code.trim().toUpperCase();
    const room = this.rooms.get(cleanCode);
    if (room) {
      room.clearAllTimers();
      for (const player of room.players.values()) {
        this.socketMap.delete(player.socketId);
      }
      this.rooms.delete(cleanCode);
      console.log(`[RoomManager] Deleted room ${cleanCode}`);
    }
  }

  /**
   * Lists public rooms available for joining (PRD Section 8, GET /api/rooms/public)
   */
  public getPublicRooms(): PublicRoomInfo[] {
    const publicList: PublicRoomInfo[] = [];

    for (const room of this.rooms.values()) {
      if (
        room.settings.isPublic &&
        room.phase === 'LOBBY' &&
        room.players.size > 0 &&
        room.players.size < room.settings.maxPlayers
      ) {
        publicList.push(room.toPublicInfo());
      }
    }

    return publicList;
  }

  /**
   * Binds a socket connection to a room and player
   */
  public bindSocket(socketId: string, roomCode: string, playerId: string): void {
    this.socketMap.set(socketId, { roomCode, playerId });
  }

  /**
   * Unbinds a socket
   */
  public unbindSocket(socketId: string): void {
    this.socketMap.delete(socketId);
  }

  /**
   * Resolves room and player for a given socketId
   */
  public lookupSocket(socketId: string): { room?: Room; player?: Player } {
    const entry = this.socketMap.get(socketId);
    if (!entry) return {};

    const room = this.rooms.get(entry.roomCode);
    if (!room) return {};

    const player = room.players.get(entry.playerId);
    return { room, player };
  }
}

// Export singleton instance for simplicity across server routes
export const roomManager = new RoomManager();
