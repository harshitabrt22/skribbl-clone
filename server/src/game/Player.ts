// Player model representing an active or reconnecting player in a room (PRD Section 8, 11, 16.1)

import { PublicPlayer } from '../types';

export class Player {
  public id: string;
  public socketId: string;
  public sessionId: string;
  public name: string;
  public score: number = 0;
  public streak: number = 0;
  public ready: boolean = false;
  public connected: boolean = true;
  public hasGuessed: boolean = false;
  public disconnectTimeout?: NodeJS.Timeout;

  constructor(id: string, socketId: string, sessionId: string, name: string) {
    this.id = id;
    this.socketId = socketId;
    this.sessionId = sessionId;
    this.name = name;
  }

  /**
   * Serializes the player data safe for broadcasting to clients.
   * Internal identifiers like sessionId and raw timers are omitted.
   */
  public toPublic(isHost: boolean): PublicPlayer {
    return {
      id: this.id,
      name: this.name,
      score: this.score,
      streak: this.streak,
      ready: this.ready,
      connected: this.connected,
      isHost,
      hasGuessed: this.hasGuessed,
    };
  }
}
