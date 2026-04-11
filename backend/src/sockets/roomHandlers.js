const roomService = require('../services/roomService')
const gameService = require('../services/gameService')

function registerRoomHandlers(io, socket, socketMap) {
  // Host creates a new room
  socket.on('create_room', ({ hostId } = {}) => {
    if (!hostId) return socket.emit('error', { code: 'MISSING_FIELD', message: 'hostId required' })
    try {
      const roomId = roomService.createRoom(hostId)
      const room = roomService.getRoom(roomId)

      // Add host as first player (name set on join_room)
      socket.join(roomId)
      socket.emit('room_created', { roomId })
    } catch (err) {
      socket.emit('error', { code: 'CREATE_FAILED', message: err.message })
    }
  })

  // Player (or host) joins a room
  socket.on('join_room', ({ roomId, playerId, name } = {}) => {
    if (!roomId || !name) {
      return socket.emit('error', { code: 'MISSING_FIELD', message: 'roomId and name required' })
    }

    const result = roomService.addPlayer(roomId, socket.id, name, playerId || null)
    if (result.error) {
      return socket.emit('error', { code: result.error, message: result.error })
    }

    const { player, isRejoin } = result
    const room = roomService.getRoom(roomId)

    socket.join(roomId)
    socketMap.set(socket.id, { roomId, playerId: player.playerId })

    const isHost = room.hostId === player.playerId ||
      [...room.players.values()].find((p) => p.playerId === player.playerId)?.playerId === room.hostId

    socket.emit('room_joined', {
      playerId: player.playerId,
      isHost: room.hostId === player.playerId,
      isRejoin,
      roomState: {
        roomId,
        players: roomService.getPublicPlayers(room),
        status: room.status,
        settings: room.settings,
        hostId: room.hostId,
      },
    })

    io.to(roomId).emit('room_updated', { roomId,
      players: roomService.getPublicPlayers(room),
      status: room.status,
      settings: room.settings,
      hostId: room.hostId,
    })

    // If rejoining during an active game, sync current game state
    if (isRejoin && room.status === 'playing' && room.game) {
      const game = room.game
      socket.emit('game_started', {
        gridSize: game.gridSize,
        tickMs: game.tickMs,
        mode: game.mode,
        duration: room.settings.duration,
        paused: game.paused || false,
        snakes: Object.values(game.snakes).map((s) => ({
          playerId: s.playerId,
          body: s.body,
          color: s.color,
          name: s.name,
          alive: s.alive,
          score: s.score,
        })),
        food: game.food,
      })
      if (game.paused) {
        socket.emit('game_paused', { gridSize: game.gridSize, tickMs: game.tickMs })
      }
    }
  })

  // Host rejoins (page refresh recovery)
  socket.on('rejoin_host', ({ roomId, hostId } = {}) => {
    if (!roomId || !hostId) {
      return socket.emit('error', { code: 'MISSING_FIELD', message: 'roomId and hostId required' })
    }
    const room = roomService.getRoom(roomId)
    if (!room) return socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' })
    if (room.hostId !== hostId) return socket.emit('error', { code: 'NOT_HOST', message: 'Not the host' })

    // Find host player by hostId (hostId is the playerId for the host)
    const player = room.players.get(hostId)
    if (!player) return socket.emit('error', { code: 'PLAYER_NOT_FOUND', message: 'Host player not found' })

    player.socketId = socket.id
    player.isOnline = true
    socket.join(roomId)
    socketMap.set(socket.id, { roomId, playerId: hostId })

    socket.emit('room_joined', {
      playerId: hostId,
      isHost: true,
      isRejoin: true,
      roomState: {
        roomId,
        players: roomService.getPublicPlayers(room),
        status: room.status,
        settings: room.settings,
        hostId: room.hostId,
      },
    })

    if (room.status === 'playing' && room.game) {
      const game = room.game
      socket.emit('game_started', {
        gridSize: game.gridSize,
        tickMs: game.tickMs,
        mode: game.mode,
        duration: room.settings.duration,
        paused: game.paused || false,
        snakes: Object.values(game.snakes).map((s) => ({
          playerId: s.playerId,
          body: s.body,
          color: s.color,
          name: s.name,
          alive: s.alive,
          score: s.score,
        })),
        food: game.food,
      })
      if (game.paused) {
        socket.emit('game_paused', { gridSize: game.gridSize, tickMs: game.tickMs })
      }
    }
  })

  // Play again (host resets room to waiting)
  socket.on('play_again', ({ roomId } = {}) => {
    const info = socketMap.get(socket.id)
    if (!info) return socket.emit('error', { code: 'NOT_IN_ROOM', message: 'Not in a room' })

    const room = roomService.getRoom(roomId)
    if (!room) return socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' })
    if (room.hostId !== info.playerId) {
      return socket.emit('error', { code: 'NOT_HOST', message: 'Only host can reset' })
    }

    // Clear game loop if still running
    if (room.game && room.game.intervalId) {
      clearInterval(room.game.intervalId)
    }

    roomService.resetRoom(roomId)

    io.to(roomId).emit('room_updated', { roomId,
      players: roomService.getPublicPlayers(room),
      status: 'waiting',
      settings: room.settings,
      hostId: room.hostId,
    })
    io.to(roomId).emit('game_reset')
  })

  // Host updates settings
  socket.on('update_settings', ({ roomId, settings } = {}) => {
    const info = socketMap.get(socket.id)
    if (!info) return

    const room = roomService.getRoom(roomId)
    if (!room) return socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' })
    if (room.hostId !== info.playerId) return
    if (room.status !== 'waiting') return

    const g = Math.round(Number(settings.gridSize))
    const t = Math.round(Number(settings.tickMs))
    const d = Math.round(Number(settings.duration))
    if (g >= 10 && g <= 60) room.settings.gridSize = g
    if (t >= 60 && t <= 500) room.settings.tickMs = t
    if (settings.mode === 'classic' || settings.mode === 'timed') room.settings.mode = settings.mode
    if (d >= 30 && d <= 600) room.settings.duration = d

    io.to(roomId).emit('settings_updated', { settings: room.settings })
  })

  // Leave room
  socket.on('leave_room', ({ roomId } = {}) => {
    const info = socketMap.get(socket.id)
    if (!info) return

    const { playerId } = info
    socketMap.delete(socket.id)
    socket.leave(roomId)

    const room = roomService.getRoom(roomId)
    if (!room) return

    if (room.status === 'playing') {
      gameService.killSnakeByDisconnect(roomId, playerId)
    }
    roomService.removePlayer(roomId, playerId)

    const updatedRoom = roomService.getRoom(roomId)
    if (updatedRoom) {
      io.to(roomId).emit('room_updated', { roomId,
        players: roomService.getPublicPlayers(updatedRoom),
        status: updatedRoom.status,
        settings: updatedRoom.settings,
        hostId: updatedRoom.hostId,
      })
    }
  })
}

module.exports = registerRoomHandlers
