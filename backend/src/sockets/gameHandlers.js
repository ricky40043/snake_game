const roomService = require('../services/roomService')
const gameService = require('../services/gameService')
const config = require('../config')

function registerGameHandlers(io, socket, socketMap) {
  socket.on('start_game', ({ roomId } = {}) => {
    const info = socketMap.get(socket.id)
    if (!info) return socket.emit('error', { code: 'NOT_IN_ROOM', message: 'Not in a room' })

    const room = roomService.getRoom(roomId)
    if (!room) return socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' })
    if (room.hostId !== info.playerId) {
      return socket.emit('error', { code: 'NOT_HOST', message: 'Only host can start the game' })
    }
    if (room.status !== 'waiting') {
      return socket.emit('error', { code: 'INVALID_STATUS', message: 'Room is not in waiting state' })
    }

    const onlinePlayers = [...room.players.values()].filter((p) => p.isOnline)
    if (onlinePlayers.length < config.minPlayersToStart) {
      return socket.emit('error', {
        code: 'NOT_ENOUGH_PLAYERS',
        message: `Need at least ${config.minPlayersToStart} player(s) to start`,
      })
    }

    gameService.startGame(io, roomId)
  })

  socket.on('change_direction', ({ roomId, direction } = {}) => {
    const info = socketMap.get(socket.id)
    if (!info) return

    gameService.handleDirectionChange(roomId || info.roomId, info.playerId, direction)
  })
}

module.exports = registerGameHandlers
