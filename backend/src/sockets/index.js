const registerRoomHandlers = require('./roomHandlers')
const registerGameHandlers = require('./gameHandlers')
const roomService = require('../services/roomService')
const gameService = require('../services/gameService')
const reconnectTimers = require('./reconnectTimers')

// socketId -> { roomId, playerId }
const socketMap = new Map()

function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    registerRoomHandlers(io, socket, socketMap)
    registerGameHandlers(io, socket, socketMap)

    socket.on('disconnect', () => {
      const info = socketMap.get(socket.id)
      if (!info) return
      const { roomId, playerId } = info
      socketMap.delete(socket.id)

      const room = roomService.getRoom(roomId)
      if (!room) return

      if (room.status === 'playing') {
        // If game was paused and host disconnected, auto-resume
        if (room.game?.paused && room.hostId === playerId) {
          gameService.resumeGame(io, roomId)
        }
        // Kill snake immediately on disconnect
        gameService.killSnakeByDisconnect(roomId, playerId)
        roomService.setPlayerOffline(roomId, playerId)
        io.to(roomId).emit('room_updated', {
          roomId,
          players: roomService.getPublicPlayers(room),
          status: room.status,
          settings: room.settings,
          hostId: room.hostId,
        })
        // Check if game should end now (not applicable to timed mode — players can respawn)
        const game = room.game
        if (game && game.mode !== 'timed') {
          const stillAlive = Object.values(game.snakes).filter((s) => s.alive)
          const totalPlayers = Object.keys(game.snakes).length
          if (stillAlive.length === 0 || (stillAlive.length === 1 && totalPlayers > 1)) {
            gameService.endGame(io, roomId)
          }
        }
      } else if (room.status === 'waiting') {
        roomService.setPlayerOffline(roomId, playerId)
        const timerKey = `${roomId}:${playerId}`
        const timerId = setTimeout(() => {
          reconnectTimers.delete(timerKey)
          roomService.removePlayer(roomId, playerId)
          const updatedRoom = roomService.getRoom(roomId)
          if (updatedRoom) {
            io.to(roomId).emit('room_updated', {
              roomId,
              players: roomService.getPublicPlayers(updatedRoom),
              status: updatedRoom.status,
              settings: updatedRoom.settings,
              hostId: updatedRoom.hostId,
            })
          }
        }, 60000)
        reconnectTimers.set(timerKey, timerId)
        io.to(roomId).emit('room_updated', {
          roomId,
          players: roomService.getPublicPlayers(room),
          status: room.status,
          settings: room.settings,
          hostId: room.hostId,
        })
      } else {
        roomService.setPlayerOffline(roomId, playerId)
      }
    })
  })
}

module.exports = { registerSocketHandlers, socketMap }
