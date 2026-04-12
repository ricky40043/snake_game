const { v4: uuidv4 } = require('uuid')
const config = require('../config')

const rooms = new Map() // roomId -> Room

const PLAYER_COLORS = [
  // First 10: high-contrast primaries
  '#22c55e', // green
  '#3b82f6', // blue
  '#f97316', // orange
  '#a855f7', // purple
  '#eab308', // yellow
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
  '#14b8a6', // teal
  // Next 10: between the primaries
  '#4ade80', // light green  (green ↔ lime)
  '#6366f1', // indigo       (blue ↔ purple)
  '#fb923c', // light orange (orange ↔ yellow)
  '#c026d3', // fuchsia      (purple ↔ pink)
  '#f59e0b', // amber        (yellow ↔ orange)
  '#f87171', // light red    (red ↔ pink)
  '#0ea5e9', // sky blue     (cyan ↔ blue)
  '#f472b6', // light pink   (pink ↔ purple)
  '#a3e635', // yellow-green (lime ↔ yellow)
  '#2dd4bf', // turquoise    (teal ↔ cyan)
]

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
    if (!rooms.has(code)) return code
  }
  throw new Error('Failed to generate unique room code')
}

function createRoom(hostId) {
  const roomId = generateRoomCode()
  const room = {
    roomId,
    hostId,
    status: 'waiting', // waiting | playing | finished
    players: new Map(), // playerId -> Player
    settings: {
      gridSize: config.gridSize,
      tickMs: config.tickMs,
      mode: config.mode,
      duration: config.duration,
      foodCount: config.foodCount,
      maxPlayers: config.defaultMaxPlayers,
      attackEnabled: config.attackEnabled,
      attackUnlockRemaining: config.attackUnlockRemaining,
      wallDeath: config.wallDeath,
    },
    game: null,
    cleanupTimer: null,
    createdAt: Date.now(),
  }
  rooms.set(roomId, room)
  return roomId
}

function getRoom(roomId) {
  return rooms.get(roomId) || null
}

function addPlayer(roomId, socketId, name, existingPlayerId = null) {
  const room = rooms.get(roomId)
  if (!room) return { error: 'ROOM_NOT_FOUND' }

  // Reconnect path
  if (existingPlayerId && room.players.has(existingPlayerId)) {
    const player = room.players.get(existingPlayerId)
    player.socketId = socketId
    player.isOnline = true
    return { player, isRejoin: true }
  }

  if (room.status === 'playing') return { error: 'GAME_ALREADY_STARTED' }
  if (room.status === 'finished') return { error: 'GAME_FINISHED' }
  const playerLimit = Math.min(room.settings.maxPlayers || config.defaultMaxPlayers, config.maxPlayersPerRoom)
  if (room.players.size >= playerLimit) return { error: 'ROOM_FULL' }

  const playerId = existingPlayerId || uuidv4()
  const usedColors = new Set([...room.players.values()].map((p) => p.color))
  const color = PLAYER_COLORS.find((c) => !usedColors.has(c)) ?? PLAYER_COLORS[room.players.size % PLAYER_COLORS.length]
  const player = {
    playerId,
    name: name.trim().slice(0, 12) || 'Player',
    socketId,
    color,
    isAlive: true,
    isOnline: true,
    score: 0,
  }
  room.players.set(playerId, player)
  return { player, isRejoin: false }
}

function removePlayer(roomId, playerId) {
  const room = rooms.get(roomId)
  if (!room) return
  room.players.delete(playerId)
  if (room.players.size === 0) {
    rooms.delete(roomId)
  }
}

function setPlayerOffline(roomId, playerId) {
  const room = rooms.get(roomId)
  if (!room) return
  const player = room.players.get(playerId)
  if (player) player.isOnline = false
}

function getPublicPlayers(room) {
  return [...room.players.values()].map((p) => ({
    playerId: p.playerId,
    name: p.name,
    color: p.color,
    isAlive: p.isAlive,
    isOnline: p.isOnline,
    score: p.score,
  }))
}

function scheduleCleanup(roomId) {
  const room = rooms.get(roomId)
  if (!room) return
  if (room.cleanupTimer) clearTimeout(room.cleanupTimer)
  room.cleanupTimer = setTimeout(() => {
    rooms.delete(roomId)
  }, config.roomCleanupMs)
}

function resetRoom(roomId) {
  const room = rooms.get(roomId)
  if (!room) return false
  if (room.cleanupTimer) {
    clearTimeout(room.cleanupTimer)
    room.cleanupTimer = null
  }
  room.status = 'waiting'
  room.game = null
  for (const player of room.players.values()) {
    player.isAlive = true
    player.score = 0
  }
  return true
}

function deleteRoom(roomId) {
  const room = rooms.get(roomId)
  if (room && room.cleanupTimer) clearTimeout(room.cleanupTimer)
  rooms.delete(roomId)
}

module.exports = {
  createRoom,
  getRoom,
  addPlayer,
  removePlayer,
  setPlayerOffline,
  getPublicPlayers,
  scheduleCleanup,
  resetRoom,
  deleteRoom,
}
