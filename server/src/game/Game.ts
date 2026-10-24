// Game model: manages all in-game state including word selection, guessing, scoring,
// drawing strokes, and turn flow (PRD Section 6, 9, 11, 12, 13)
//
// HOW A TURN WORKS:
//   1. beginWordSelection()  → phase = WORD_SELECTION, pick words, set 15s auto-pick timer
//   2. chooseWord(word)      → phase = DRAWING, start draw timer + 1s tick
//   3. handleGuess(player, text) → check if correct, award points, end early if all guessed
//   4. endTurn(reason)       → phase = ROUND_END, reveal word, fire round_end event
//   5. nextTurn() / endGame() → advance to next drawer or finish the game

import { GamePhase, Stroke, DrawingTool, BrushSize, RoomSettings, DEFAULT_SETTINGS } from '../types';
import { pickWords, normalizeGuess, isClose } from '../lib/words';
import { calculateEffectiveHints, getHintSchedule, pickHintIndices, buildMask } from '../lib/hints';
import {
  getRandomChallenge,
  ActiveChallengeState,
  ChallengeCard,
  calcChallengeBonus,
  calcTurnDrawTime,
  validateDrawStartChallenge,
  recordStrokeInChallenge,
  validateUndoChallenge,
  validateClearChallenge,
} from '../lib/challenges';
import { calcGuessPoints, DRAWER_POINTS_PER_GUESSER } from '../lib/scoring';
import { Player } from './Player';

// The io object and roomCode are passed in so Game can emit events directly.
// We use a generic interface to avoid circular imports between Game and registerHandlers.
export interface GameIO {
  toRoom(event: string, data: unknown): void;       // emit to whole room
  toSocket(socketId: string, event: string, data: unknown): void; // emit to one socket
  toRoomExcept(socketId: string, event: string, data: unknown): void; // emit to room except one socket
}

export class Game {
  // ─── Phase & Turn tracking ────────────────────────────────────────────────
  public phase: GamePhase = 'LOBBY';
  public round: number = 1;          // 1-indexed: which full rotation we're in
  public turnIndex: number = 0;      // which player in turnOrder is drawing now
  public turnOrder: string[] = [];   // playerIds in draw order (set at game start)

  // ─── Current drawer & word ────────────────────────────────────────────────
  public drawerId: string = '';
  public currentWord: string = '';
  public wordOptions: string[] = [];  // what the server offered to the drawer
  public usedWords: Set<string> = new Set(); // words used so far this game

  // ─── Guess tracking ───────────────────────────────────────────────────────
  // Set of playerIds who have already guessed correctly this turn.
  // Prevents double-scoring if a player sends the same correct guess twice.
  public correctGuessers: Set<string> = new Set();

  // ─── Strokes (drawing state) ──────────────────────────────────────────────
  public strokes: Stroke[] = [];
  public currentStroke: Stroke | null = null;

  // ─── Settings ────────────────────────────────────────────────────────────
  public settings: RoomSettings = DEFAULT_SETTINGS;

  // ─── Challenge Cards (Feature A) ──────────────────────────────────────────
  public offeredChallenge: ChallengeCard | null = null;
  public activeChallenge: ActiveChallengeState | null = null;

  // ─── Hints state (Feature B) ──────────────────────────────────────────────
  public revealedIndices: Set<number> = new Set();
  public hintsRevealedCount: number = 0;
  public currentMask: string = '';
  private hintTimeouts: ReturnType<typeof setTimeout>[] = [];

  // ─── Timer state ──────────────────────────────────────────────────────────
  public drawTimeTotal: number = 80;  // total seconds for this turn (from settings)
  public drawTimeRemaining: number = 0;
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private wordSelectTimer: ReturnType<typeof setTimeout> | null = null;

  // ─── Callbacks ────────────────────────────────────────────────────────────
  // These are set by Room.startGame() so Game can signal when to advance turns.
  public onTurnEnd?: (reason: 'time' | 'all_guessed' | 'drawer_left') => void;

  // ─── IO interface ─────────────────────────────────────────────────────────
  private io?: GameIO;
  private roomCode?: string;

  /**
   * Attach the IO interface so Game can emit events.
   * Called once by Room.startGame().
   */
  public attachIO(io: GameIO, roomCode: string): void {
    this.io = io;
    this.roomCode = roomCode;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TURN FLOW METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Start the word-selection phase for the current drawer.
   * The server picks wordCount random unused words and sends them ONLY to the drawer.
   * Everyone else sees "X is choosing a word…" via round_start.
   *
   * @param drawer       The Player who will draw
   * @param wordCount    How many choices to offer (from room settings)
   * @param totalRounds  Total rounds in this game (for game_state)
   * @param players      All players (for building per-player game_state)
   */
  public beginWordSelection(
    drawer: Player,
    wordCount: number,
    totalRounds: number,
    players: Map<string, Player>,
    hostId: string
  ): void {
    this.clearTimers();

    this.phase = 'WORD_SELECTION';
    this.drawerId = drawer.id;
    this.correctGuessers = new Set();
    this.currentWord = '';
    this.wordOptions = pickWords(wordCount, this.usedWords);

    // Feature A: Offer a challenge card to drawer if challenges enabled (PRD 13.4)
    this.offeredChallenge = this.settings.challengesEnabled ? getRandomChallenge() : null;
    this.activeChallenge = null;

    // Reset hasGuessed for all players at the start of each turn
    for (const p of players.values()) {
      p.hasGuessed = false;
    }

    // Broadcast public round_start to the whole room (no word info)
    this.io?.toRoom('round_start', {
      round: this.round,
      totalRounds,
      drawerId: drawer.id,
      drawerName: drawer.name,
      drawTime: this.drawTimeTotal,
      wordSelectTime: 15,
    });

    // Send ONLY wordOptions + challenge offer to the drawer's socket (secrecy! PRD 17.2, 13.4)
    this.io?.toSocket(drawer.socketId, 'word_options', {
      wordOptions: this.wordOptions,
      challengeOffer: this.offeredChallenge || undefined,
    });

    // Send game_state to every player — drawer gets the word options info + challenge offer,
    // guessers see the phase change only (no word yet)
    for (const p of players.values()) {
      const isDrawer = p.id === drawer.id;
      this.io?.toSocket(p.socketId, 'game_state', {
        phase: 'WORD_SELECTION',
        round: this.round,
        totalRounds,
        drawerId: drawer.id,
        // Drawer sees their options and challenge offer; guessers see nothing
        wordOptions: isDrawer ? this.wordOptions : undefined,
        challengeOffer: isDrawer ? (this.offeredChallenge || undefined) : undefined,
        players: Array.from(players.values()).map((pl) => pl.toPublic(pl.id === hostId)),
      });
    }

    // Auto-pick the first word if the drawer doesn't choose within 15 seconds (skip challenge by default)
    this.wordSelectTimer = setTimeout(() => {
      if (this.phase === 'WORD_SELECTION' && this.wordOptions.length > 0) {
        console.log(`[Game] Auto-picking word for drawer ${drawer.name}`);
        this.chooseWord(this.wordOptions[0], false, players, hostId, totalRounds);
      }
    }, 15000);
  }

  /**
   * Called when the drawer picks a word (or server auto-picks after timeout).
   * Transitions to the DRAWING phase and starts the draw timer.
   *
   * @param word             The chosen word (must be one of the options)
   * @param acceptChallenge  Whether the drawer accepted the challenge card
   * @param players          All players (for building per-player game_state)
   */
  public chooseWord(
    word: string,
    acceptChallenge: boolean,
    players: Map<string, Player>,
    hostId: string,
    totalRounds: number
  ): void {
    // Ignore if we already moved on (e.g. auto-pick fired after manual pick)
    if (this.phase !== 'WORD_SELECTION') return;

    clearTimeout(this.wordSelectTimer!);
    this.wordSelectTimer = null;

    // Feature A: activate challenge if accepted
    if (acceptChallenge && this.offeredChallenge) {
      this.activeChallenge = {
        card: this.offeredChallenge,
        accepted: true,
        usedColors: new Set(),
        strokeCount: 0,
      };
      this.drawTimeTotal = calcTurnDrawTime(this.settings.drawTime, this.activeChallenge);
    } else {
      this.activeChallenge = null;
      this.drawTimeTotal = this.settings.drawTime;
    }

    this.currentWord = word;
    this.phase = 'DRAWING';
    this.drawTimeRemaining = this.drawTimeTotal;

    // Clear strokes from the previous turn
    this.strokes = [];
    this.currentStroke = null;
    this.io?.toRoom('canvas_clear', {});

    // Hints setup (PRD Section 13.3)
    const wordLength = word.replace(/\s/g, '').length;
    const effectiveHints = calculateEffectiveHints(this.settings.hints, word, this.settings.wordMode);
    this.revealedIndices = new Set();
    this.hintsRevealedCount = 0;
    this.currentMask = buildMask(word, this.revealedIndices, this.settings.wordMode);

    // Tell the room drawing has started (broadcasts challenge if accepted: PRD 13.4, 16.2)
    this.io?.toRoom('drawing_started', {
      drawTime: this.drawTimeTotal,
      wordMask: this.currentMask,
      wordLength,
      challenge: this.activeChallenge?.accepted ? this.activeChallenge.card : undefined,
    });

    // Send per-player game_state: drawer gets the real word, guessers get the mask
    const drawer = players.get(this.drawerId);
    for (const p of players.values()) {
      const isDrawer = p.id === this.drawerId;
      this.io?.toSocket(p.socketId, 'game_state', {
        phase: 'DRAWING',
        round: this.round,
        totalRounds,
        drawerId: this.drawerId,
        wordMask: this.currentMask,
        wordLength,
        // Drawer sees the actual word; guessers do NOT
        word: isDrawer ? word : undefined,
        remaining: this.drawTimeRemaining,
        total: this.drawTimeTotal,
        hintsRevealed: this.hintsRevealedCount,
        challenge: this.activeChallenge?.accepted ? this.activeChallenge.card : undefined,
        players: Array.from(players.values()).map((pl) => pl.toPublic(pl.id === hostId)),
        drawerName: drawer?.name,
      });
    }

    // Schedule progressive hints (Feature B)
    if (effectiveHints > 0) {
      const hintOrder = pickHintIndices(wordLength, effectiveHints);
      const schedule = getHintSchedule(this.drawTimeTotal, effectiveHints);

      for (let k = 0; k < hintOrder.length; k++) {
        const revealIndex = hintOrder[k];
        const revealSec = schedule[k];
        const timeout = setTimeout(() => {
          if (this.phase !== 'DRAWING') return;
          this.revealedIndices.add(revealIndex);
          this.hintsRevealedCount += 1;
          this.currentMask = buildMask(this.currentWord, this.revealedIndices, this.settings.wordMode);

          const currentDrawer = players.get(this.drawerId);
          if (currentDrawer) {
            this.io?.toRoomExcept(currentDrawer.socketId, 'hint_update', {
              mask: this.currentMask,
              revealedCount: this.hintsRevealedCount,
            });
          }
        }, revealSec * 1000);

        this.hintTimeouts.push(timeout);
      }
    }

    // Start counting down with a 1-second tick sent to all clients
    this.tickInterval = setInterval(() => {
      this.drawTimeRemaining = Math.max(0, this.drawTimeRemaining - 1);
      this.io?.toRoom('timer_tick', { remaining: this.drawTimeRemaining });
    }, 1000);

    // End the turn when the timer runs out
    this.turnTimer = setTimeout(() => {
      this.endTurn('time', players, hostId, totalRounds);
    }, this.drawTimeTotal * 1000);

    console.log(`[Game] Drawing started. Word: "${word}", Drawer: ${drawer?.name}`);
  }

  /**
   * Handle a guess from a guesser (PRD Section 12.3, 13.1).
   *
   * Steps:
   *   1. Validate: must be DRAWING phase, not the drawer, not already guessed
   *   2. Normalize both guess and word
   *   3. If correct: award points, update streak, emit public guess_result, maybe end turn
   *   4. If close (Levenshtein ≤ 1, word ≥ 5 letters): emit private close hint
   *   5. Otherwise: emit as a normal chat_message to the room
   *
   * @param player       The guessing player
   * @param text         Raw text from the client (not yet normalized)
   * @param players      All players map (to check if all guessers have guessed)
   * @param hostId       For building public player list
   * @param totalRounds  For building game_state
   */
  public handleGuess(
    player: Player,
    text: string,
    players: Map<string, Player>,
    hostId: string,
    totalRounds: number
  ): void {
    // Phase must be DRAWING
    if (this.phase !== 'DRAWING') return;

    // Drawer cannot guess their own word (PRD 12.3 rule 5)
    if (player.id === this.drawerId) return;

    // Player already guessed correctly this turn — silently ignore
    if (this.correctGuessers.has(player.id)) return;

    const normGuess = normalizeGuess(text);
    const normWord = normalizeGuess(this.currentWord);

    if (normGuess === normWord) {
      // ✅ CORRECT GUESS
      this.correctGuessers.add(player.id);
      player.hasGuessed = true;
      player.streak += 1; // increment streak BEFORE scoring so bonus reflects new streak

      const { basePoints, streakBonus, total } = calcGuessPoints(
        this.drawTimeRemaining,
        this.drawTimeTotal,
        player.streak
      );

      player.score += total;

      // Give the drawer +50 for this correct guesser
      const drawer = players.get(this.drawerId);
      if (drawer) {
        drawer.score += DRAWER_POINTS_PER_GUESSER;
      }

      // Public event: "PlayerX guessed the word!" — no word revealed (PRD 16.4)
      this.io?.toRoom('guess_result', {
        correct: true,
        playerId: player.id,
        playerName: player.name,
        points: total,
        basePoints,
        streakBonus,
        streak: player.streak,
      });

      // Update everyone's player list (scores changed)
      this.io?.toRoom('players_updated', {
        players: Array.from(players.values()).map((p) => p.toPublic(p.id === hostId)),
        hostId,
      });

      console.log(`[Game] ${player.name} guessed correctly! +${total} pts (base ${basePoints} + streak ${streakBonus})`);

      // Check if all connected guessers have now guessed
      const allGuessed = this.allGuessersCorrect(players);
      if (allGuessed) {
        this.endTurn('all_guessed', players, hostId, totalRounds);
      }
    } else if (isClose(text, this.currentWord)) {
      // 🟡 CLOSE GUESS — private "So close!" only to that player (PRD 12.3 rule 3)
      this.io?.toSocket(player.socketId, 'guess_result', {
        correct: false,
        close: true,
      });
    } else {
      // ❌ WRONG GUESS — show as a regular chat message to the room
      this.io?.toRoom('chat_message', {
        playerId: player.id,
        playerName: player.name,
        text,
      });
    }
  }

  /**
   * End the current drawing turn.
   * Idempotent: if phase is already past DRAWING, returns immediately (PRD 11).
   *
   * @param reason    Why the turn ended: 'time' | 'all_guessed' | 'drawer_left'
   */
  public endTurn(
    reason: 'time' | 'all_guessed' | 'drawer_left',
    players: Map<string, Player>,
    hostId: string,
    totalRounds: number
  ): void {
    // Idempotent guard — must be in an active turn phase (DRAWING or WORD_SELECTION)
    if (this.phase !== 'DRAWING' && this.phase !== 'WORD_SELECTION') return;

    this.phase = 'ROUND_END';
    this.clearTimers();

    // Feature A: Challenge reward (+25 if accepted, enforced, and >= 1 guesser)
    const challengeBonus = calcChallengeBonus(this.activeChallenge, this.correctGuessers.size);
    const drawer = players.get(this.drawerId);
    if (drawer && challengeBonus > 0) {
      drawer.score += challengeBonus;
      console.log(`[Game] Challenge reward awarded: +${challengeBonus} to drawer ${drawer.name}`);
    }

    // Reset streaks for all connected players who were eligible (not drawer) but didn't guess
    for (const p of players.values()) {
      if (p.id !== this.drawerId && p.connected && !this.correctGuessers.has(p.id)) {
        p.streak = 0; // missed this turn → streak broken
      }
    }

    // Build a score summary for the round_end event
    const scores = Array.from(players.values()).map((p) => ({
      playerId: p.id,
      playerName: p.name,
      total: p.score,
      challengeBonus: p.id === this.drawerId ? challengeBonus : 0,
    }));

    // If word wasn't picked yet (e.g. drawer left during WORD_SELECTION), use first option
    const revealedWord = this.currentWord || this.wordOptions[0] || 'No word chosen';

    // Reveal the word — this is the one room-wide message that contains the word
    this.io?.toRoom('round_end', {
      word: revealedWord,
      reason,
      scores,
      challengeBonus: challengeBonus > 0 ? challengeBonus : undefined,
      challenge: this.activeChallenge?.accepted ? this.activeChallenge.card : undefined,
      players: Array.from(players.values()).map((p) => p.toPublic(p.id === hostId)),
    });

    console.log(`[Game] Turn ended. Reason: ${reason}. Word was: "${revealedWord}"`);

    // Notify the Room to advance turns (Room.nextTurn() is called after a 5s delay)
    this.onTurnEnd?.(reason);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STROKE MANAGEMENT (Feature A rules validated here)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Start a new stroke on the server (validates challenge restrictions) */
  public startStroke(
    id: string,
    tool: DrawingTool,
    color: string,
    size: BrushSize,
    x: number,
    y: number
  ): { stroke: Stroke | null; error?: string } {
    const challengeValidation = validateDrawStartChallenge(this.activeChallenge, tool, color);
    if (!challengeValidation.valid) {
      return { stroke: null, error: challengeValidation.reason };
    }
    recordStrokeInChallenge(this.activeChallenge, tool, color);

    const stroke: Stroke = { id, tool, color, size, points: [{ x, y }] };
    if (this.strokes.length >= 1000) this.strokes.shift();
    this.strokes.push(stroke);
    this.currentStroke = stroke;
    return { stroke };
  }

  /** Append a point to the active stroke */
  public addPoint(x: number, y: number): boolean {
    if (!this.currentStroke) return false;
    if (this.currentStroke.points.length >= 5000) return false;
    this.currentStroke.points.push({ x, y });
    return true;
  }

  /** Close the active stroke */
  public endStroke(): void {
    this.currentStroke = null;
  }

  /** Undo: remove the last stroke (blocked for ONE_STROKE) */
  public undo(): { stroke: Stroke | null; error?: string } {
    const challengeValidation = validateUndoChallenge(this.activeChallenge);
    if (!challengeValidation.valid) {
      return { stroke: null, error: challengeValidation.reason };
    }
    this.currentStroke = null;
    return { stroke: this.strokes.pop() || null };
  }

  /** Clear all strokes (blocked for ONE_STROKE) */
  public clear(): { success: boolean; error?: string } {
    const challengeValidation = validateClearChallenge(this.activeChallenge);
    if (!challengeValidation.valid) {
      return { success: false, error: challengeValidation.reason };
    }
    this.strokes = [];
    this.currentStroke = null;
    return { success: true };
  }

  /** Get all strokes (for canvas_sync on reconnect) */
  public getStrokes(): Stroke[] {
    return [...this.strokes];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if all connected non-drawer players have already guessed correctly.
   * Used to end the turn early when everyone gets it right.
   */
  public allGuessersCorrect(players: Map<string, Player>): boolean {
    let connectedGuessers = 0;
    for (const p of players.values()) {
      if (p.id === this.drawerId) continue;     // drawer doesn't guess
      if (!p.connected) continue;               // disconnected players are skipped
      connectedGuessers++;
      if (!this.correctGuessers.has(p.id)) {
        return false; // at least one connected guesser hasn't guessed yet
      }
    }
    return connectedGuessers > 0;
  }

  /**
   * Called when a player disconnects or leaves mid-turn:
   * if all remaining connected guessers are already correct, end turn early.
   */
  public checkEarlyEndIfAllGuessed(
    players: Map<string, Player>,
    hostId: string,
    totalRounds: number
  ): void {
    if (this.phase === 'DRAWING' && this.allGuessersCorrect(players)) {
      this.endTurn('all_guessed', players, hostId, totalRounds);
    }
  }

  /** Clear all pending timers — call this at every phase transition */
  public clearTimers(): void {
    if (this.turnTimer) { clearTimeout(this.turnTimer); this.turnTimer = null; }
    if (this.tickInterval) { clearInterval(this.tickInterval); this.tickInterval = null; }
    if (this.wordSelectTimer) { clearTimeout(this.wordSelectTimer); this.wordSelectTimer = null; }
    for (const t of this.hintTimeouts) {
      clearTimeout(t);
    }
    this.hintTimeouts = [];
  }
}
