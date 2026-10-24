// Socket.IO event handlers for Room, Lobby, Real-Time Drawing, and Game (PRD Section 9, 16.1, 16.3, 16.4, 17)

/**
 * ==============================================================================
 * HOW A DRAWING STROKE TRAVELS (MOUSE -> SERVER -> OTHER CLIENTS -> CANVAS):
 * ==============================================================================
 *
 * 1. POINTER EVENT (Drawer Client):
 *    - Drawer presses down, drags, or releases mouse/touch/stylus on <canvas>.
 *    - Normalized coordinates (0 to 1) are computed relative to getBoundingClientRect().
 *    - The drawer renders the line locally and immediately for zero input lag (optimistic UI).
 *    - On pointer down: client emits `draw_start { x, y, color, size, tool }`.
 *    - On pointer move: client throttles micro-movements (<0.002) and emits `draw_move { x, y }`.
 *    - On pointer up: client emits `draw_end {}`.
 *
 * 2. SERVER AUTHORIZATION & VALIDATION:
 *    - Server checks: Does this socket belong to an active room?
 *    - Server checks: Is the room currently in the DRAWING phase?
 *    - Server checks: Is this socket the AUTHORIZED DRAWER (`player.id === room.game.drawerId`)?
 *      Any forged drawing events from guessers/viewers are rejected immediately.
 *    - Server checks: Are coordinates valid finite numbers within [0, 1]?
 *    - Server checks: Is color in the approved 12-color palette? Tool in [brush, eraser]? Size in [4, 10, 20]?
 *    - Server rate-limits `draw_move` to <= 120 events/sec per socket to prevent socket flooding.
 *
 * 3. SERVER STATE STORAGE & BROADCAST:
 *    - Server appends the stroke and its points to `room.game.strokes` in memory.
 *    - Server broadcasts `draw_data` to `socket.to(room.code)` (everyone in the room EXCEPT
 *      the drawer, since the drawer already rendered locally).
 *
 * 4. REMOTE RENDERING (Guessers / Viewers):
 *    - Guessers' browsers receive `draw_data`.
 *    - When type === 'start': initial point is established with specified color and brush size.
 *    - When type === 'move': a smooth round line segment is rendered onto the 800x600 canvas.
 *    - When type === 'end': remote stroke is committed to the local strokes list.
 *
 * 5. CANVAS SYNCHRONIZATION & UNDO:
 *    - `draw_undo`: Drawer clicks Undo -> server pops last stroke -> broadcasts `draw_undo` ->
 *      all clients wipe and redraw remaining strokes.
 *    - `canvas_clear`: Drawer clicks Clear -> server wipes strokes -> broadcasts `canvas_clear`.
 *    - Late-joiner / Reconnect: Server sends `canvas_sync { strokes }` so the canvas is restored.
 * ==============================================================================
 */

import { Server, Socket } from 'socket.io';
import crypto from 'crypto';
import { RoomManager } from '../game/RoomManager';
import { GameIO } from '../game/Game';
import {
  validateNickname,
  validateRoomCode,
  validateSettings,
  validateDrawStart,
  validateDrawMove,
} from '../lib/validation';
import { drawMoveRateLimiter, generalRateLimiter } from '../lib/rateLimit';
import { buildMask, normalizeGuess } from '../lib/words';

export function registerHandlers(io: Server, socket: Socket, roomManager: RoomManager): void {
  /**
   * Helper to send structured error messages to the client
   */
  const sendError = (code: string, message: string) => {
    socket.emit('error_message', { code, message });
  };

  /**
   * Build a GameIO adapter so Game/Room can emit socket events without
   * importing the Socket.IO server directly (keeps Game.ts clean).
   *
   * @param roomCode  The room's Socket.IO room name
   * @param drawerSocketId  The drawer's socket ID (used for toRoomExcept)
   */
  const buildGameIO = (roomCode: string): GameIO => ({
    toRoom: (event, data) => {
      io.to(roomCode).emit(event, data);
    },
    toSocket: (socketId, event, data) => {
      io.to(socketId).emit(event, data);
    },
    toRoomExcept: (exceptSocketId, event, data) => {
      io.to(roomCode).except(exceptSocketId).emit(event, data);
    },
  });

  // ─── 1. CREATE ROOM ────────────────────────────────────────────────────────
  socket.on('create_room', (payload: { hostName?: unknown; settings?: unknown }) => {
    try {
      const nameVal = validateNickname(payload?.hostName);
      if (!nameVal.valid) {
        return sendError('INVALID_NAME', nameVal.error || 'Invalid host nickname.');
      }

      const settingsVal = validateSettings(payload?.settings);
      const { room, host } = roomManager.createRoom(nameVal.value, socket.id, settingsVal.settings);

      socket.join(room.code);

      // S->1: room_joined
      socket.emit('room_joined', {
        roomId: room.code,
        you: {
          id: host.id,
          sessionId: host.sessionId,
        },
        players: room.getPublicPlayers(),
        hostId: room.hostId,
        settings: room.settings,
        phase: room.phase,
      });

      console.log(`[Room] Created room ${room.code} by host "${host.name}" (${host.id})`);
    } catch (err) {
      console.error('[Socket] create_room error:', err);
      sendError('INTERNAL_ERROR', 'Could not create room.');
    }
  });

  // ─── 2. JOIN ROOM (supports reconnection via sessionId) ───────────────────
  socket.on('join_room', (payload: { roomId?: unknown; playerName?: unknown; sessionId?: unknown }) => {
    try {
      const codeVal = validateRoomCode(payload?.roomId);
      if (!codeVal.valid) {
        return sendError('INVALID_PAYLOAD', codeVal.error || 'Invalid room code.');
      }

      const room = roomManager.getRoom(codeVal.value);
      if (!room) {
        return sendError('ROOM_NOT_FOUND', `Room ${codeVal.value} was not found.`);
      }

      const nameVal = validateNickname(payload?.playerName);
      if (!nameVal.valid) {
        return sendError('INVALID_NAME', nameVal.error || 'Invalid nickname.');
      }

      const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId : undefined;
      const joinResult = room.addPlayer(nameVal.value, socket.id, sessionId);

      if (!joinResult.success || !joinResult.player) {
        return sendError(joinResult.errorCode || 'JOIN_FAILED', joinResult.errorMessage || 'Failed to join room.');
      }

      const player = joinResult.player;
      roomManager.bindSocket(socket.id, room.code, player.id);
      socket.join(room.code);

      // Build word mask for the rejoining player (restores current progressive mask: AC-HINT-4)
      const wordMask = room.game.currentMask || (room.game.currentWord
        ? buildMask(room.game.currentWord, room.game.revealedIndices, room.settings.wordMode)
        : undefined);

      // S->1: send room_joined to the joining socket
      socket.emit('room_joined', {
        roomId: room.code,
        you: {
          id: player.id,
          sessionId: player.sessionId,
        },
        players: room.getPublicPlayers(),
        hostId: room.hostId,
        settings: room.settings,
        phase: room.phase,
        drawerId: room.game.drawerId,
      });

      // Send game_state if rejoining mid-game
      if (room.phase !== 'LOBBY') {
        const isDrawer = player.id === room.game.drawerId;
        socket.emit('game_state', {
          phase: room.phase,
          round: room.game.round,
          totalRounds: room.settings.rounds,
          drawerId: room.game.drawerId,
          // Drawer gets the real word; others get the mask (PRD 17.2)
          word: isDrawer ? room.game.currentWord : undefined,
          wordMask: isDrawer ? undefined : wordMask,
          wordLength: room.game.currentWord ? room.game.currentWord.replace(/\s/g, '').length : 0,
          wordOptions: isDrawer && room.phase === 'WORD_SELECTION' ? room.game.wordOptions : undefined,
          remaining: room.game.drawTimeRemaining,
          total: room.game.drawTimeTotal,
          hintsRevealed: room.game.hintsRevealedCount,
          challenge: room.game.activeChallenge?.accepted ? room.game.activeChallenge.card : undefined,
          challengeOffer: isDrawer && room.phase === 'WORD_SELECTION' ? room.game.offeredChallenge || undefined : undefined,
          players: room.getPublicPlayers(),
        });

        // If drawer rejoins during WORD_SELECTION, also emit word_options
        if (isDrawer && room.phase === 'WORD_SELECTION' && room.game.wordOptions.length > 0) {
          socket.emit('word_options', {
            wordOptions: room.game.wordOptions,
            challengeOffer: room.game.offeredChallenge || undefined,
          });
        }
      }

      // S->others: broadcast player_joined to existing room members
      socket.to(room.code).emit('player_joined', {
        player: player.toPublic(player.id === room.hostId),
        players: room.getPublicPlayers(),
      });

      // If rejoining while drawing is in progress, sync canvas strokes (PRD Section 9, 16.3)
      if (room.phase === 'DRAWING') {
        socket.emit('canvas_sync', {
          strokes: room.game.getStrokes(),
        });
      }

      console.log(`[Room] Player "${player.name}" (${player.id}) joined room ${room.code} (reconnect: ${joinResult.isReconnect})`);
    } catch (err) {
      console.error('[Socket] join_room error:', err);
      sendError('INTERNAL_ERROR', 'Could not join room.');
    }
  });

  // ─── 3. SET READY STATE ───────────────────────────────────────────────────
  socket.on('set_ready', (payload: { ready?: unknown }) => {
    const { room, player } = roomManager.lookupSocket(socket.id);
    if (!room || !player) return;

    if (room.phase !== 'LOBBY') {
      return sendError('BAD_PHASE', 'Cannot toggle ready state during gameplay.');
    }

    const ready = Boolean(payload?.ready);
    room.setReady(player.id, ready);

    io.to(room.code).emit('players_updated', {
      players: room.getPublicPlayers(),
      hostId: room.hostId,
    });
  });

  // ─── 4. UPDATE ROOM SETTINGS (Host only) ─────────────────────────────────
  socket.on('update_settings', (payload: { settings?: unknown }) => {
    const { room, player } = roomManager.lookupSocket(socket.id);
    if (!room || !player) return;

    const result = room.updateSettings(payload?.settings as any, player.id);
    if (!result.success) {
      return sendError(result.errorCode || 'INVALID_SETTINGS', result.errorMessage || 'Failed to update settings.');
    }

    io.to(room.code).emit('settings_updated', {
      settings: room.settings,
    });
  });

  // ─── 5. START GAME (Host only) — Stage 4: Full game flow ─────────────────
  socket.on('start_game', () => {
    try {
      const { room, player } = roomManager.lookupSocket(socket.id);
      if (!room || !player) return;

      const startCheck = room.canStartGame(player.id);
      if (!startCheck.canStart) {
        return sendError('START_FAILED', startCheck.reason || 'Cannot start game.');
      }

      // Build the GameIO adapter for this room
      const gameIO = buildGameIO(room.code);

      // Start the full game: freeze turn order, pick first word options, etc.
      room.startGame(gameIO);

      console.log(`[Game] Full game started in room ${room.code} by ${player.name}`);
    } catch (err) {
      console.error('[Socket] start_game error:', err);
      sendError('INTERNAL_ERROR', 'Could not start game.');
    }
  });

  // ─── 6. WORD CHOSEN (Drawer only, during WORD_SELECTION) ─────────────────
  // The drawer picks one of the words the server offered them (PRD 12.2, 16.2)
  socket.on('word_chosen', (payload: { word?: unknown; acceptChallenge?: unknown }) => {
    try {
      const { room, player } = roomManager.lookupSocket(socket.id);
      if (!room || !player) return;

      if (room.game.phase !== 'WORD_SELECTION') {
        return sendError('BAD_PHASE', 'Not in word selection phase.');
      }
      if (player.id !== room.game.drawerId) {
        return sendError('NOT_DRAWER', 'Only the current drawer can choose a word.');
      }

      const word = typeof payload?.word === 'string' ? payload.word.trim() : '';
      if (!word) {
        return sendError('INVALID_PAYLOAD', 'Word must be a non-empty string.');
      }

      const acceptChallenge = Boolean(payload?.acceptChallenge);
      const gameIO = buildGameIO(room.code);
      const result = room.handleWordChosen(player.id, word, acceptChallenge, gameIO);

      if (!result.success) {
        return sendError('INVALID_PAYLOAD', result.error || 'Invalid word choice.');
      }

      console.log(`[Game] Drawer ${player.name} chose word in room ${room.code}`);
    } catch (err) {
      console.error('[Socket] word_chosen error:', err);
      sendError('INTERNAL_ERROR', 'Could not process word choice.');
    }
  });

  // ─── 7. GUESS (any non-drawer player, during DRAWING) ────────────────────
  // Also serves as the primary chat message for guessers during drawing phase.
  // The server checks if it's correct/close/wrong and handles each case.
  socket.on('guess', (payload: { text?: unknown }) => {
    try {
      const { room, player } = roomManager.lookupSocket(socket.id);
      if (!room || !player) return;

      // Rate limit: max 5 guess/chat messages per 3 seconds
      if (!generalRateLimiter.allow(socket.id)) {
        return; // silently drop to avoid spamming
      }

      const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
      if (!text || text.length < 1 || text.length > 100) return;

      room.handleGuess(player.id, text);
    } catch (err) {
      console.error('[Socket] guess error:', err);
    }
  });

  // ─── 8. CHAT (general chat outside drawing phase) ────────────────────────
  socket.on('chat', (payload: { text?: unknown }) => {
    try {
      const { room, player } = roomManager.lookupSocket(socket.id);
      if (!room || !player) return;

      if (!generalRateLimiter.allow(socket.id)) return;

      const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
      if (!text || text.length < 1 || text.length > 100) return;

      // During DRAWING, route non-drawer messages through the guess handler
      if (room.phase === 'DRAWING' && player.id !== room.game.drawerId) {
        room.handleGuess(player.id, text);
        return;
      }

      // Block drawer from leaking the secret word in chat during DRAWING
      if (room.phase === 'DRAWING' && player.id === room.game.drawerId) {
        const normText = normalizeGuess(text);
        const normWord = normalizeGuess(room.game.currentWord);
        if (normWord && normText.includes(normWord)) {
          return sendError('CHAT_BLOCKED', 'You cannot send the secret word in chat!');
        }
      }

      // Outside drawing phase (or drawer chatting): broadcast as normal chat
      io.to(room.code).emit('chat_message', {
        playerId: player.id,
        playerName: player.name,
        text,
      });
    } catch (err) {
      console.error('[Socket] chat error:', err);
    }
  });

  // ─── 9. DRAW START (Drawer only) ─────────────────────────────────────────
  socket.on('draw_start', (payload: unknown) => {
    const { room, player } = roomManager.lookupSocket(socket.id);
    if (!room || !player) return;

    // Authorization & Phase check: Only the active drawer in DRAWING phase may draw (PRD Section 17.3)
    if (room.game.phase !== 'DRAWING' || player.id !== room.game.drawerId) {
      return socket.emit('draw_rejected', { reason: 'Only the current drawer can draw.' });
    }

    const validation = validateDrawStart(payload);
    if (!validation.valid || !validation.data) {
      return socket.emit('draw_rejected', { reason: validation.error || 'Invalid draw start coordinates.' });
    }

    const { x, y, tool, color, size } = validation.data;
    const strokeId = `s_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // Store stroke on server (checks challenge restrictions: AC-CH-2, AC-CH-3)
    const strokeResult = room.game.startStroke(strokeId, tool, color, size, x, y);
    if (!strokeResult.stroke) {
      return socket.emit('draw_rejected', { reason: strokeResult.error || 'Stroke rejected.' });
    }

    // S->others: Broadcast stroke start to viewers (NOT echoed to drawer, PRD Section 5.2 item 10)
    socket.to(room.code).emit('draw_data', {
      type: 'start',
      strokeId,
      tool,
      color,
      size,
      x,
      y,
    });
  });

  // ─── 10. DRAW MOVE (Drawer only, rate limited) ─────────────────────────────
  socket.on('draw_move', (payload: unknown) => {
    const { room, player } = roomManager.lookupSocket(socket.id);
    if (!room || !player) return;

    // Authorization & Phase check
    if (room.game.phase !== 'DRAWING' || player.id !== room.game.drawerId) {
      return;
    }

    // Rate limiting: drop excess events beyond 120/sec (PRD Section 10)
    if (!drawMoveRateLimiter.allow(socket.id)) {
      return;
    }

    const validation = validateDrawMove(payload);
    if (!validation.valid || !validation.data) {
      return;
    }

    const { x, y } = validation.data;
    const added = room.game.addPoint(x, y);
    if (!added) return;

    // S->others: Broadcast new point segment
    socket.to(room.code).emit('draw_data', {
      type: 'move',
      strokeId: room.game.currentStroke?.id,
      x,
      y,
    });
  });

  // ─── 11. DRAW END (Drawer only) ────────────────────────────────────────────
  socket.on('draw_end', () => {
    const { room, player } = roomManager.lookupSocket(socket.id);
    if (!room || !player) return;

    if (room.game.phase !== 'DRAWING' || player.id !== room.game.drawerId) {
      return;
    }

    const strokeId = room.game.currentStroke?.id;
    room.game.endStroke();

    // S->others: Broadcast stroke completion
    socket.to(room.code).emit('draw_data', {
      type: 'end',
      strokeId,
    });
  });

  // ─── 12. DRAW UNDO (Drawer only) ───────────────────────────────────────────
  socket.on('draw_undo', () => {
    const { room, player } = roomManager.lookupSocket(socket.id);
    if (!room || !player) return;

    if (room.game.phase !== 'DRAWING' || player.id !== room.game.drawerId) {
      return socket.emit('draw_rejected', { reason: 'Only the current drawer can undo.' });
    }

    const undoResult = room.game.undo();
    if (undoResult.error) {
      return socket.emit('draw_rejected', { reason: undoResult.error });
    }
    if (!undoResult.stroke) return;

    // S->room: Broadcast undo to all clients (including drawer so stroke lists stay synchronized)
    io.to(room.code).emit('draw_undo', {});
  });

  // ─── 13. CANVAS CLEAR (Drawer only) ───────────────────────────────────────
  socket.on('canvas_clear', () => {
    const { room, player } = roomManager.lookupSocket(socket.id);
    if (!room || !player) return;

    if (room.game.phase !== 'DRAWING' || player.id !== room.game.drawerId) {
      return socket.emit('draw_rejected', { reason: 'Only the current drawer can clear the canvas.' });
    }

    const clearResult = room.game.clear();
    if (!clearResult.success) {
      return socket.emit('draw_rejected', { reason: clearResult.error || 'Clear rejected.' });
    }

    // S->room: Broadcast clear to all clients
    io.to(room.code).emit('canvas_clear', {});
  });

  // ─── 14. KICK PLAYER (Host only) ──────────────────────────────────────────
  socket.on('kick_player', (payload: { playerId?: unknown }) => {
    const { room, player } = roomManager.lookupSocket(socket.id);
    if (!room || !player) return;

    if (typeof payload?.playerId !== 'string') {
      return sendError('INVALID_PAYLOAD', 'Invalid player ID.');
    }

    const kickResult = room.kickPlayer(payload.playerId, player.id);
    if (!kickResult.success || !kickResult.kickedPlayer) {
      return sendError(kickResult.errorCode || 'KICK_FAILED', kickResult.errorMessage || 'Cannot kick player.');
    }

    const kicked = kickResult.kickedPlayer;
    roomManager.unbindSocket(kicked.socketId);

    io.to(kicked.socketId).emit('kicked', {
      reason: 'You have been removed from the lobby by the host.',
    });

    io.to(room.code).emit('player_left', {
      playerId: kicked.id,
      players: room.getPublicPlayers(),
      hostId: room.hostId,
    });

    console.log(`[Room] Host ${player.name} kicked ${kicked.name} from room ${room.code}`);
  });

  // ─── 15. PLAY AGAIN (Host only, after GAME_OVER) ──────────────────────────
  socket.on('play_again', () => {
    try {
      const { room, player } = roomManager.lookupSocket(socket.id);
      if (!room || !player) return;

      if (room.phase !== 'GAME_OVER') {
        return sendError('BAD_PHASE', 'Play Again is only available after the game ends.');
      }
      if (player.id !== room.hostId) {
        return sendError('NOT_HOST', 'Only the host can start a new game.');
      }

      room.resetForPlayAgain();

      io.to(room.code).emit('room_reset', {
        phase: 'LOBBY',
        players: room.getPublicPlayers(),
        settings: room.settings,
        hostId: room.hostId,
      });

      console.log(`[Room] Play Again in room ${room.code}`);
    } catch (err) {
      console.error('[Socket] play_again error:', err);
    }
  });

  // ─── 16. LEAVE ROOM ───────────────────────────────────────────────────────
  socket.on('leave_room', () => {
    const { room, player } = roomManager.lookupSocket(socket.id);
    if (!room || !player) return;

    socket.leave(room.code);
    roomManager.unbindSocket(socket.id);
    drawMoveRateLimiter.cleanup(socket.id);
    generalRateLimiter.cleanup(socket.id);

    const wasDrawer = player.id === room.game.drawerId;
    const wasInGame = room.phase !== 'LOBBY' && room.phase !== 'GAME_OVER';

    const removal = room.removePlayer(player.id);

    io.to(room.code).emit('player_left', {
      playerId: player.id,
      players: room.getPublicPlayers(),
      hostId: removal.newHostId || room.hostId,
    });

    console.log(`[Room] Player ${player.name} left room ${room.code}`);

    if (wasInGame) {
      const gameIO = buildGameIO(room.code);
      const connected = Array.from(room.players.values()).filter((p) => p.connected);
      if (connected.length < 2) {
        room.endGameEarly(gameIO);
      } else if (wasDrawer) {
        room.handleDrawerDisconnect(gameIO);
      } else if (room.phase === 'DRAWING') {
        room.game.checkEarlyEndIfAllGuessed(room.players, room.hostId, room.settings.rounds);
      }
    }
  });

  // ─── 17. DISCONNECT ───────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const { room, player } = roomManager.lookupSocket(socket.id);
    if (!room || !player) return;

    roomManager.unbindSocket(socket.id);
    drawMoveRateLimiter.cleanup(socket.id);
    generalRateLimiter.cleanup(socket.id);

    const wasDrawer = player.id === room.game.drawerId;
    const wasInGame = room.phase !== 'LOBBY' && room.phase !== 'GAME_OVER';

    const result = room.handleDisconnect(socket.id);

    if (room.phase === 'LOBBY') {
      io.to(room.code).emit('player_left', {
        playerId: player.id,
        players: room.getPublicPlayers(),
        hostId: result.newHostId || room.hostId,
      });
    } else {
      io.to(room.code).emit('players_updated', {
        players: room.getPublicPlayers(),
        hostId: result.newHostId || room.hostId,
      });

      if (wasInGame) {
        const gameIO = buildGameIO(room.code);
        const connected = Array.from(room.players.values()).filter((p) => p.connected);
        if (connected.length < 2) {
          room.endGameEarly(gameIO);
        } else if (wasDrawer) {
          room.handleDrawerDisconnect(gameIO);
        } else if (room.phase === 'DRAWING') {
          room.game.checkEarlyEndIfAllGuessed(room.players, room.hostId, room.settings.rounds);
        }
      }
    }

    console.log(`[Room] Socket disconnected for player ${player.name} in room ${room.code}`);
  });
}
