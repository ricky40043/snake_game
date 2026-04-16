const registerRoomHandlers = require('./roomHandlers')
const registerGameHandlers = require('./gameHandlers')
const roomService = require('../services/roomService')
const gameService = require('../services/gameService')
const reconnectTimers = require('./reconnectTimers')

// socketId -> { roomId, playerId }
const socketMap = new Map()

const PLAYING_RECONNECT_MS = 8000 // grace period before killing snake on disconnect

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
        // Give a grace period to reconnect before killing the snake
        roomService.setPlayerOffline(roomId, playerId)
        io.to(roomId).emit('room_updated', {
          roomId,
          players: roomService.getPublicPlayers(room),
          status: room.status,
          settings: room.settings,
          hostId: room.hostId,
        })
        const timerKey = `${roomId}:${playerId}`
        const timerId = setTimeout(() => {
          reconnectTimers.delete(timerKey)
          const currentRoom = roomService.getRoom(roomId)
          if (!currentRoom || currentRoom.status !== 'playing') return
          gameService.killSnakeByDisconnect(roomId, playerId)
          io.to(roomId).emit('room_updated', {
            roomId,
            players: roomService.getPublicPlayers(currentRoom),
            status: currentRoom.status,
            settings: currentRoom.settings,
            hostId: currentRoom.hostId,
          })
          // Check if game should end (not applicable to timed mode — players can respawn)
          const game = currentRoom.game
          if (game && game.mode !== 'timed') {
            const stillAlive = Object.values(game.snakes).filter((s) => s.alive)
            const totalPlayers = Object.keys(game.snakes).length
            if (stillAlive.length === 0 || (stillAlive.length === 1 && totalPlayers > 1)) {
              gameService.endGame(io, roomId)
            }
          }
        }, PLAYING_RECONNECT_MS)
        reconnectTimers.set(timerKey, timerId)
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
