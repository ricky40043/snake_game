const roomService = require('../services/roomService')
const gameService = require('../services/gameService')
const config = require('../config')
const { enqueueDirection } = require('../services/directionQueue')

function applyDirectionInput(room, playerId, direction, inputId = null) {
  if (!room?.game || room.status !== 'playing') return { accepted: false, reason: 'not_playing' }
  if (room.game.paused) return { accepted: false, reason: 'paused' }

  const snake = room.game.snakes[playerId]
  if (!snake || !snake.alive) return { accepted: false, reason: 'not_alive' }
  return enqueueDirection(snake, direction, inputId)
}

function registerGameHandlers(io, socket, socketMap) {
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

  socket.on('finish_tutorial', ({ roomId } = {}) => {
    const info = socketMap.get(socket.id)
    if (!info) return
    const room = roomService.getRoom(roomId)
    if (!room || room.hostId !== info.playerId) return
    if (room.status !== 'playing') return
    gameService.finishTutorial(io, roomId)
  })

  socket.on('tutorial_next', ({ roomId } = {}) => {
    const info = socketMap.get(socket.id)
    if (!info) return
    const room = roomService.getRoom(roomId)
    if (!room || room.hostId !== info.playerId) return
    if (room.status !== 'playing') return
    gameService.setTutorialStep(io, roomId, 1)
  })

  socket.on('tutorial_prev', ({ roomId } = {}) => {
    const info = socketMap.get(socket.id)
    if (!info) return
    const room = roomService.getRoom(roomId)
    if (!room || room.hostId !== info.playerId) return
    if (room.status !== 'playing') return
    gameService.setTutorialStep(io, roomId, -1)
  })

  socket.on('shoot', ({ roomId } = {}) => {
    const info = socketMap.get(socket.id)
    if (!info) return
    const room = roomService.getRoom(roomId || info.roomId)
    if (!room?.game || room.status !== 'playing' || room.game.paused) return
    gameService.processShoot(room.game, info.playerId)
  })

  socket.on('change_direction', ({ roomId, direction, inputId } = {}, acknowledge = () => {}) => {
    const info = socketMap.get(socket.id)
    if (!info) {
      acknowledge({ accepted: false, reason: 'not_in_room', inputId })
      return
    }
    const room = roomService.getRoom(roomId || info.roomId)
    const result = applyDirectionInput(room, info.playerId, direction, inputId)
    acknowledge({ ...result, inputId, direction: String(direction || '').toUpperCase() })
  })

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

  socket.on('resize_game', ({ roomId, gridSize } = {}) => {
    const info = socketMap.get(socket.id)
    if (!info) return
    const room = roomService.getRoom(roomId)
    if (!room || room.hostId !== info.playerId) return
    gameService.resizeGameMap(io, roomId, Number(gridSize))
  })

  socket.on('update_pause_speed', ({ roomId, tickMs } = {}) => {
    const info = socketMap.get(socket.id)
    if (!info) return
    const room = roomService.getRoom(roomId)
    if (!room || room.hostId !== info.playerId) return
    gameService.updatePauseSpeed(io, roomId, Number(tickMs))
  })

  socket.on('end_game_now', ({ roomId } = {}) => {
    const info = socketMap.get(socket.id)
    if (!info) return
    const room = roomService.getRoom(roomId)
    if (!room || room.hostId !== info.playerId) return
    gameService.endGameNow(io, roomId)
  })

  socket.on('toggle_boost', ({ roomId } = {}) => {
    const info = socketMap.get(socket.id)
    if (!info) return
    const room = roomService.getRoom(roomId || info.roomId)
    if (!room?.game || room.status !== 'playing' || room.game.paused) return
    if (!room.game.boostEnabled) return
    const snake = room.game.snakes[info.playerId]
    if (!snake || !snake.alive) return
    if (!snake.boostActive && snake.body.length <= 3) return
    snake.boostActive = !snake.boostActive
    if (snake.boostActive) snake.lastHpDeductAt = Date.now()
  })
}

module.exports = registerGameHandlers
