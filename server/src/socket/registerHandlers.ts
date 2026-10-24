// Socket.IO event handlers for Room, Lobby, and Real-Time Canvas Drawing (PRD Section 9, 16.1, 16.3, 17)

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
import {
  validateNickname,
  validateRoomCode,
  validateSettings,
  validateDrawStart,
  validateDrawMove,
} from '../lib/validation';
import { drawMoveRateLimiter } from '../lib/rateLimit';

export function registerHandlers(io: Server, socket: Socket, roomManager: RoomManager): void {
  /**
   * Helper to send structured error messages to the client
   */
  const sendError = (code: string, message: string) => {
    socket.emit('error_message', { code, message });
  };

  // 1. CREATE ROOM
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

  // 2. JOIN ROOM (supports reconnection via sessionId)
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

  // 3. SET READY STATE
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

  // 4. UPDATE ROOM SETTINGS (Host only)
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

  // 5. START GAME (Host only)
  // Stage 3 test phase: Host is set as drawer, moves room to DRAWING phase (PRD Section 9)
  socket.on('start_game', () => {
    const { room, player } = roomManager.lookupSocket(socket.id);
    if (!room || !player) return;

    const startCheck = room.canStartGame(player.id);
    if (!startCheck.canStart) {
      return sendError('START_FAILED', startCheck.reason || 'Cannot start game.');
    }

    // Move to DRAWING phase with host as the test drawer
    room.startDrawingTestPhase();

    io.to(room.code).emit('game_state', {
      phase: 'DRAWING',
      drawerId: room.hostId,
    });

    // Reset canvas strokes for all clients
    io.to(room.code).emit('canvas_sync', {
      strokes: [],
    });

    console.log(`[Game] Stage 3 Drawing started in room ${room.code}. Drawer: ${player.name} (${room.hostId})`);
  });

  // 6. DRAW START (Drawer only)
  socket.on('draw_start', (payload: unknown) => {
    const { room, player } = roomManager.lookupSocket(socket.id);
    if (!room || !player) return;

    // Authorization & Phase check: Only the active drawer in DRAWING phase may draw (PRD Section 17.3)
    if (room.phase !== 'DRAWING' || player.id !== room.game.drawerId) {
      return socket.emit('draw_rejected', { reason: 'Only the current drawer can draw.' });
    }

    const validation = validateDrawStart(payload);
    if (!validation.valid || !validation.data) {
      return socket.emit('draw_rejected', { reason: validation.error || 'Invalid draw start coordinates.' });
    }

    const { x, y, tool, color, size } = validation.data;
    const strokeId = `s_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // Store stroke on server
    room.game.startStroke(strokeId, tool, color, size, x, y);

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

  // 7. DRAW MOVE (Drawer only, rate limited)
  socket.on('draw_move', (payload: unknown) => {
    const { room, player } = roomManager.lookupSocket(socket.id);
    if (!room || !player) return;

    // Authorization & Phase check
    if (room.phase !== 'DRAWING' || player.id !== room.game.drawerId) {
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

  // 8. DRAW END (Drawer only)
  socket.on('draw_end', () => {
    const { room, player } = roomManager.lookupSocket(socket.id);
    if (!room || !player) return;

    if (room.phase !== 'DRAWING' || player.id !== room.game.drawerId) {
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

  // 9. DRAW UNDO (Drawer only)
  socket.on('draw_undo', () => {
    const { room, player } = roomManager.lookupSocket(socket.id);
    if (!room || !player) return;

    if (room.phase !== 'DRAWING' || player.id !== room.game.drawerId) {
      return socket.emit('draw_rejected', { reason: 'Only the current drawer can undo.' });
    }

    const removedStroke = room.game.undo();
    if (!removedStroke) return;

    // S->room: Broadcast undo to all clients (including drawer so stroke lists stay synchronized)
    io.to(room.code).emit('draw_undo', {});
  });

  // 10. CANVAS CLEAR (Drawer only)
  socket.on('canvas_clear', () => {
    const { room, player } = roomManager.lookupSocket(socket.id);
    if (!room || !player) return;

    if (room.phase !== 'DRAWING' || player.id !== room.game.drawerId) {
      return socket.emit('draw_rejected', { reason: 'Only the current drawer can clear the canvas.' });
    }

    room.game.clear();

    // S->room: Broadcast clear to all clients
    io.to(room.code).emit('canvas_clear', {});
  });

  // 11. KICK PLAYER (Host only)
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

  // 12. LEAVE ROOM
  socket.on('leave_room', () => {
    const { room, player } = roomManager.lookupSocket(socket.id);
    if (!room || !player) return;

    socket.leave(room.code);
    roomManager.unbindSocket(socket.id);
    drawMoveRateLimiter.cleanup(socket.id);

    const removal = room.removePlayer(player.id);

    io.to(room.code).emit('player_left', {
      playerId: player.id,
      players: room.getPublicPlayers(),
      hostId: removal.newHostId || room.hostId,
    });

    console.log(`[Room] Player ${player.name} left room ${room.code}`);
  });

  // 13. DISCONNECT
  socket.on('disconnect', () => {
    const { room, player } = roomManager.lookupSocket(socket.id);
    if (!room || !player) return;

    roomManager.unbindSocket(socket.id);
    drawMoveRateLimiter.cleanup(socket.id);

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
    }

    console.log(`[Room] Socket disconnected for player ${player.name} in room ${room.code}`);
  });
}
