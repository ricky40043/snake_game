const roomService = require('../services/roomService')
const gameService = require('../services/gameService')
const config = require('../config')

function registerGameHandlers(io, socket, socketMap) {
  // Start game
  socket.on('start_game', ({ roomId } = {}) => {
    const info = socketMap.get(socket.id)
    if (!info) return socket.emit('error', { code: 'NOT_IN_ROOM', message: 'Not in a room' })
    const room = roomService.getRoom(roomId)
    if (!room) return socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' })
    if (room.hostId !== info.playerId) return socket.emit('error', { code: 'NOT_HOST', message: 'Only host can start' })
    if (room.status !== 'waiting') return socket.emit('error', { code: 'INVALID_STATUS', message: 'Not in waiting state' })
    const onlinePlayers = [...room.players.values()].filter((p) => p.isOnline)
    if (onlinePlayers.length < config.minPlayersToStart) {
      return socket.emit('error', { code: 'NOT_ENOUGH_PLAYERS', message: `Need at least ${config.minPlayersToStart} player(s)` })
    }
    gameService.startGame(io, roomId)
  })

  // Direction input
  socket.on('change_direction', ({ roomId, direction } = {}) => {
    const info = socketMap.get(socket.id)
    if (!info) return
    gameService.handleDirectionChange(roomId || info.roomId, info.playerId, direction)
  })

  // ── Pause / Resume (host only, desktop) ───────────────────────────────────
  socket.on('pause_game', ({ roomId } = {}) => {
    const info = socketMap.get(socket.id)
    if (!info) return
    const room = roomService.getRoom(roomId)
    if (!room || room.hostId !== info.playerId) return
    if (room.status !== 'playing') return
    gameService.pauseGame(io, roomId)
  })

  socket.on('resume_game', ({ roomId } = {}) => {
    const info = socketMap.get(socket.id)
    if (!info) return
    const room = roomService.getRoom(roomId)
    if (!room || room.hostId !== info.playerId) return
    gameService.resumeGame(io, roomId)
  })

  // ── Resize map (host only, during pause) ──────────────────────────────────
  socket.on('resize_game', ({ roomId, gridSize } = {}) => {
    const info = socketMap.get(socket.id)
    if (!info) return
    const room = roomService.getRoom(roomId)
    if (!room || room.hostId !== info.playerId) return
    gameService.resizeGameMap(io, roomId, Number(gridSize))
  })

  // ── Update speed (host only, during pause) ────────────────────────────────
  socket.on('update_pause_speed', ({ roomId, tickMs } = {}) => {
    const info = socketMap.get(socket.id)
    if (!info) return
    const room = roomService.getRoom(roomId)
    if (!room || room.hostId !== info.playerId) return
    gameService.updatePauseSpeed(io, roomId, Number(tickMs))
  })

  // ── Force end game (host only) ────────────────────────────────────────────
  socket.on('end_game_now', ({ roomId } = {}) => {
    const info = socketMap.get(socket.id)
    if (!info) return
    const room = roomService.getRoom(roomId)
    if (!room || room.hostId !== info.playerId) return
    gameService.endGameNow(io, roomId)
  })
}

module.exports = registerGameHandlers
