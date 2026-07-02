const roomService = require('../services/roomService')
const gameService = require('../services/gameService')
const config = require('../config')

const OPPOSITE = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' }
const DIR_DELTA = { UP: true, DOWN: true, LEFT: true, RIGHT: true }
const DIRECTION_BUFFER_GRACE_MS = 8

function scheduleBufferedDirection(room, snake) {
  if (snake.bufferedDirectionTimer) return

  snake.bufferedDirectionTimer = setTimeout(() => {
    snake.bufferedDirectionTimer = null
    if (!snake.alive || !snake.bufferedDirection) return

    const dir = snake.bufferedDirection
    snake.bufferedDirection = null

    const baseDir = snake.nextDirection || snake.direction
    if (!DIR_DELTA[dir]) return
    if (dir === baseDir) return
    if (OPPOSITE[baseDir] === dir) return

    snake.nextDirection = dir
  }, Math.max(40, Number(room.game?.tickMs || config.tickMs) + DIRECTION_BUFFER_GRACE_MS))
}

function applyDirectionInput(room, playerId, direction) {
  if (!room?.game || room.status !== 'playing' || room.game.paused) return

  const snake = room.game.snakes[playerId]
  if (!snake || !snake.alive) return

  const dir = String(direction || '').toUpperCase()
  if (!DIR_DELTA[dir]) return

  const activeQueuedDir = snake.nextDirection || snake.direction
  if (dir === activeQueuedDir) return

  if (snake.nextDirection && snake.nextDirection !== snake.direction) {
    const bufferedBaseDir = snake.bufferedDirection || snake.nextDirection
    if (OPPOSITE[bufferedBaseDir] === dir || bufferedBaseDir === dir) return

    snake.bufferedDirection = dir
    scheduleBufferedDirection(room, snake)
    return
  }

  if (OPPOSITE[snake.direction] === dir) return
  snake.nextDirection = dir
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

  socket.on('change_direction', ({ roomId, direction } = {}) => {
    const info = socketMap.get(socket.id)
    if (!info) return
    const room = roomService.getRoom(roomId || info.roomId)
    applyDirectionInput(room, info.playerId, direction)
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
