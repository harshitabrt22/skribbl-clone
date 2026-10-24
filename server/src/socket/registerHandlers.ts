// Socket.IO event handlers for Room & Lobby management (PRD Section 16.1, 17)

import { Server, Socket } from 'socket.io';
import { RoomManager } from '../game/RoomManager';
import { validateNickname, validateRoomCode, validateSettings } from '../lib/validation';

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
      });

      // S->others: broadcast player_joined to existing room members
      socket.to(room.code).emit('player_joined', {
        player: player.toPublic(player.id === room.hostId),
        players: room.getPublicPlayers(),
      });

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

    // S->room: broadcast updated players list
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

    // S->room: broadcast settings_updated
    io.to(room.code).emit('settings_updated', {
      settings: room.settings,
    });
  });

  // 5. START GAME (Host only)
  socket.on('start_game', () => {
    const { room, player } = roomManager.lookupSocket(socket.id);
    if (!room || !player) return;

    const startCheck = room.canStartGame(player.id);
    if (!startCheck.canStart) {
      return sendError('START_FAILED', startCheck.reason || 'Cannot start game.');
    }

    // Stage 2: switch phase to placeholder 'STARTING' and broadcast game_state
    room.phase = 'STARTING';
    io.to(room.code).emit('game_state', {
      phase: 'STARTING',
    });

    console.log(`[Room] Host started game in room ${room.code}`);
  });

  // 6. KICK PLAYER (Host only)
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

    // Notify the kicked player directly
    io.to(kicked.socketId).emit('kicked', {
      reason: 'You have been removed from the lobby by the host.',
    });

    // Notify room of player departure
    io.to(room.code).emit('player_left', {
      playerId: kicked.id,
      players: room.getPublicPlayers(),
      hostId: room.hostId,
    });

    console.log(`[Room] Host ${player.name} kicked ${kicked.name} from room ${room.code}`);
  });

  // 7. LEAVE ROOM (Voluntary)
  socket.on('leave_room', () => {
    const { room, player } = roomManager.lookupSocket(socket.id);
    if (!room || !player) return;

    socket.leave(room.code);
    roomManager.unbindSocket(socket.id);

    const removal = room.removePlayer(player.id);

    // S->room: broadcast player_left
    io.to(room.code).emit('player_left', {
      playerId: player.id,
      players: room.getPublicPlayers(),
      hostId: removal.newHostId || room.hostId,
    });

    console.log(`[Room] Player ${player.name} left room ${room.code}`);
  });

  // 8. DISCONNECT
  socket.on('disconnect', () => {
    const { room, player } = roomManager.lookupSocket(socket.id);
    if (!room || !player) return;

    roomManager.unbindSocket(socket.id);
    const result = room.handleDisconnect(socket.id);

    if (room.phase === 'LOBBY') {
      // In lobby, notify others that player left
      io.to(room.code).emit('player_left', {
        playerId: player.id,
        players: room.getPublicPlayers(),
        hostId: result.newHostId || room.hostId,
      });
    } else {
      // In game, notify that player connection changed
      io.to(room.code).emit('players_updated', {
        players: room.getPublicPlayers(),
        hostId: result.newHostId || room.hostId,
      });
    }

    console.log(`[Room] Socket disconnected for player ${player.name} in room ${room.code}`);
  });
}
