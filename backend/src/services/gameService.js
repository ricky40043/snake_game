const config = require('../config')
const roomService = require('./roomService')

const OPPOSITE = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' }
const DIR_DELTA = {
  UP: { dx: 0, dy: -1 },
  DOWN: { dx: 0, dy: 1 },
  LEFT: { dx: -1, dy: 0 },
  RIGHT: { dx: 1, dy: 0 },
}
const DIRS = ['UP', 'DOWN', 'LEFT', 'RIGHT']
const RESPAWN_DELAY_MS = 10000
const RESPAWN_SAFE_RADIUS = 6

function getSpawnConfigs(gridSize) {
  const m = 2
  const c = Math.floor(gridSize / 2)
  const far = gridSize - 1 - m
  const q1 = Math.floor(gridSize / 4)
  const q3 = Math.floor(gridSize * 3 / 4)
  return [
    { startX: m,   startY: m,   dir: 'RIGHT' },
    { startX: far, startY: far, dir: 'LEFT'  },
    { startX: far, startY: m,   dir: 'DOWN'  },
    { startX: m,   startY: far, dir: 'UP'    },
    { startX: c,   startY: m,   dir: 'DOWN'  },
    { startX: m,   startY: c,   dir: 'RIGHT' },
    { startX: far, startY: c,   dir: 'LEFT'  },
    { startX: c,   startY: far, dir: 'UP'    },
    { startX: q1,  startY: m,   dir: 'DOWN'  },
    { startX: q3,  startY: m,   dir: 'DOWN'  },
    { startX: q1,  startY: far, dir: 'UP'    },
    { startX: q3,  startY: far, dir: 'UP'    },
    { startX: m,   startY: q1,  dir: 'RIGHT' },
    { startX: m,   startY: q3,  dir: 'RIGHT' },
    { startX: far, startY: q1,  dir: 'LEFT'  },
    { startX: far, startY: q3,  dir: 'LEFT'  },
    { startX: q1,  startY: q1,  dir: 'RIGHT' },
    { startX: q3,  startY: q1,  dir: 'LEFT'  },
    { startX: q1,  startY: q3,  dir: 'RIGHT' },
    { startX: q3,  startY: q3,  dir: 'LEFT'  },
  ]
}

function buildInitialBody(startX, startY, dir) {
  const d = DIR_DELTA[dir]
  return [
    { x: startX, y: startY },
    { x: startX - d.dx, y: startY - d.dy },
    { x: startX - d.dx * 2, y: startY - d.dy * 2 },
  ]
}

function placeFoodSafe(snakes, existingFood, gridSize) {
  const occupied = new Set()
  for (const s of Object.values(snakes)) {
    for (const seg of s.body) occupied.add(`${seg.x},${seg.y}`)
  }
  for (const f of existingFood) occupied.add(`${f.x},${f.y}`)
  for (let attempt = 0; attempt < 200; attempt++) {
    const x = Math.floor(Math.random() * gridSize)
    const y = Math.floor(Math.random() * gridSize)
    if (!occupied.has(`${x},${y}`)) return { x, y }
  }
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      if (!occupied.has(`${x},${y}`)) return { x, y }
    }
  }
  return null
}

// Find a safe respawn position away from all alive snakes
function findRespawnPos(snakes, existingFood, gridSize) {
  const occupied = new Set()
  const danger = new Set()
  for (const s of Object.values(snakes)) {
    if (!s.alive) continue
    for (const seg of s.body) occupied.add(`${seg.x},${seg.y}`)
    if (s.body.length > 0) {
      const head = s.body[0]
      for (let dx = -RESPAWN_SAFE_RADIUS; dx <= RESPAWN_SAFE_RADIUS; dx++) {
        for (let dy = -RESPAWN_SAFE_RADIUS; dy <= RESPAWN_SAFE_RADIUS; dy++) {
          danger.add(`${head.x + dx},${head.y + dy}`)
        }
      }
    }
  }
  for (const f of existingFood) occupied.add(`${f.x},${f.y}`)

  // Pick the direction with the most room before hitting a wall
  function bestDir(x, y) {
    const distances = {
      UP:    y,
      DOWN:  gridSize - 1 - y,
      LEFT:  x,
      RIGHT: gridSize - 1 - x,
    }
    return Object.entries(distances).reduce((best, [d, dist]) => dist > best[1] ? [d, dist] : best, ['UP', -1])[0]
  }

  // Try safe (not near any snake head)
  for (let attempt = 0; attempt < 300; attempt++) {
    const x = Math.floor(Math.random() * (gridSize - 4)) + 2
    const y = Math.floor(Math.random() * (gridSize - 4)) + 2
    const key = `${x},${y}`
    if (!occupied.has(key) && !danger.has(key)) return { x, y, dir: bestDir(x, y) }
  }
  // Fallback: anywhere unoccupied
  for (let attempt = 0; attempt < 200; attempt++) {
    const x = Math.floor(Math.random() * gridSize)
    const y = Math.floor(Math.random() * gridSize)
    if (!occupied.has(`${x},${y}`)) return { x, y, dir: bestDir(x, y) }
  }
  return null
}

// ── Shoot a bullet (available in all modes, costs 1 tail segment) ────────────
function processShoot(game, playerId) {
  const snake = game.snakes[playerId]
  if (!snake || !snake.alive) return
  if (snake.body.length <= 3) return // minimum length to shoot

  // Cost: lose tail segment
  snake.body.pop()

  // Bullet starts 1 tile ahead of head in current direction
  const head = snake.body[0]
  const d = DIR_DELTA[snake.direction]
  game.bullets.push({
    id: `${playerId}_${++game.bulletIdCounter}`,
    playerId,
    x: head.x + d.dx,
    y: head.y + d.dy,
    dx: d.dx,
    dy: d.dy,
    color: snake.color,
  })
}

function startGame(io, roomId) {
  const room = roomService.getRoom(roomId)
  if (!room) return

  const { gridSize, tickMs, mode, duration, foodCount } = room.settings
  const alivePlayers = [...room.players.values()].filter((p) => p.isOnline)
  const spawnConfigs = getSpawnConfigs(gridSize)

  const snakes = {}
  alivePlayers.forEach((player, i) => {
    const spawn = spawnConfigs[i % spawnConfigs.length]
    snakes[player.playerId] = {
      playerId: player.playerId,
      body: buildInitialBody(spawn.startX, spawn.startY, spawn.dir),
      direction: spawn.dir,
      nextDirection: spawn.dir,
      alive: true,
      score: 0,
      color: player.color,
      name: player.name,
    }
  })

  const gameFoodCount = (foodCount >= 1 && foodCount <= 10) ? foodCount : config.foodCount
  const food = []
  for (let i = 0; i < gameFoodCount; i++) {
    const f = placeFoodSafe(snakes, food, gridSize)
    if (f) food.push({ x: f.x, y: f.y, type: 'regular' })
  }

  room.game = {
    gridSize,
    tickMs,
    mode: mode || 'classic',
    duration: (duration || 180) * 1000, // store as ms
    foodCount: gameFoodCount,
    tick: 0,
    snakes,
    food,
    deathLog: [],        // Mode 1/attack: [{ playerId, length, score }]
    respawnQueue: {},    // Mode 2: { playerId: respawnAtMs }
    previewQueue: {},    // Mode 2: { playerId: previewAtMs } — 3s before respawn
    bullets: [],         // Mode attack: active projectiles
    bulletIdCounter: 0,
    startTime: Date.now(),
    paused: false,
    intervalId: null,
    totalPausedMs: 0,
    pausedAt: null,
  }
  room.status = 'playing'

  io.to(roomId).emit('game_started', {
    gridSize,
    tickMs,
    mode: room.game.mode,
    duration: room.settings.duration,
    snakes: Object.values(snakes),
    food,
    paused: false,
  })

  room.game.intervalId = setInterval(() => tick(io, roomId), tickMs)
}

function tick(io, roomId) {
  const room = roomService.getRoom(roomId)
  if (!room || !room.game) return

  const game = room.game
  const { gridSize, mode } = game
  game.tick++

  // ── Mode 2: check timer first ──────────────────────────────────────
  if (mode === 'timed') {
    const elapsed = Date.now() - game.startTime - (game.totalPausedMs || 0)
    if (elapsed >= game.duration) {
      endGame(io, roomId)
      return
    }
  }

  // ── Mode 2: handle respawns + previews ───────────────────────────
  if (mode === 'timed') {
    const now = Date.now()
    for (const [pid, respawnAt] of Object.entries(game.respawnQueue)) {
      if (now >= respawnAt) {
        respawnPlayer(game, pid)
        delete game.respawnQueue[pid]
        io.to(roomId).emit('player_respawned', { playerId: pid })
      }
    }
    // 3s before respawn: calculate spawn position and notify only that player
    for (const [pid, previewAt] of Object.entries(game.previewQueue)) {
      if (now >= previewAt) {
        const snake = game.snakes[pid]
        if (snake && !snake.alive && !snake.pendingRespawn) {
          const pos = findRespawnPos(game.snakes, game.food, game.gridSize)
          if (pos) {
            snake.pendingRespawn = pos
            const player = room.players.get(pid)
            if (player?.socketId) {
              io.to(player.socketId).emit('respawn_preview', {
                playerId: pid,
                body: buildInitialBody(pos.x, pos.y, pos.dir),
                direction: pos.dir,
              })
            }
          }
        }
        delete game.previewQueue[pid]
      }
    }
  }

  const aliveSnakes = Object.values(game.snakes).filter((s) => s.alive)

  if (aliveSnakes.length === 0) {
    if (mode === 'classic') { endGame(io, roomId); return }
    // timed: wait for respawns — just broadcast empty state
  }

  // ── Phase 1: Apply buffered direction ─────────────────────────────
  for (const snake of aliveSnakes) {
    if (snake.nextDirection && OPPOSITE[snake.direction] !== snake.nextDirection) {
      snake.direction = snake.nextDirection
    }
  }

  // ── Phase 2: Extend heads ─────────────────────────────────────────
  for (const snake of aliveSnakes) {
    const d = DIR_DELTA[snake.direction]
    snake.body.unshift({ x: snake.body[0].x + d.dx, y: snake.body[0].y + d.dy })
  }

  // ── Phase 2.5: Move bullets ───────────────────────────────────────
  const dead = new Set()

  if (game.bullets.length > 0) {
    const bulletsToKeep = []
    for (const bullet of game.bullets) {
      let bulletDead = false
      for (let step = 0; step < 3; step++) {
        bullet.x += bullet.dx
        bullet.y += bullet.dy
        // Wall
        if (bullet.x < 0 || bullet.x >= gridSize || bullet.y < 0 || bullet.y >= gridSize) {
          bulletDead = true; break
        }
        // Snake body hit (can't hit shooter)
        for (const snake of aliveSnakes) {
          if (snake.playerId === bullet.playerId || dead.has(snake.playerId)) continue
          if (snake.body.some((seg) => seg.x === bullet.x && seg.y === bullet.y)) {
            dead.add(snake.playerId)
            bulletDead = true; break
          }
        }
        if (bulletDead) break
      }
      if (!bulletDead) bulletsToKeep.push(bullet)
    }
    game.bullets = bulletsToKeep
  }

  // ── Phase 3: Collision detection ──────────────────────────────────
  // Wall
  for (const snake of aliveSnakes) {
    const h = snake.body[0]
    if (h.x < 0 || h.x >= gridSize || h.y < 0 || h.y >= gridSize) dead.add(snake.playerId)
  }

  // Head-to-head
  const headPos = new Map()
  for (const snake of aliveSnakes) {
    if (dead.has(snake.playerId)) continue
    const key = `${snake.body[0].x},${snake.body[0].y}`
    if (!headPos.has(key)) headPos.set(key, [])
    headPos.get(key).push(snake.playerId)
  }
  for (const [, ids] of headPos) {
    if (ids.length > 1) ids.forEach((id) => dead.add(id))
  }

  // Body
  for (const snake of aliveSnakes) {
    if (dead.has(snake.playerId)) continue
    const head = snake.body[0]
    for (const other of aliveSnakes) {
      if (other.body.slice(1).some((s) => s.x === head.x && s.y === head.y)) {
        dead.add(snake.playerId)
        break
      }
    }
  }

  // ── Phase 4: Food + tail removal ──────────────────────────────────
  const eatenIdx = new Set()
  for (const snake of aliveSnakes) {
    if (dead.has(snake.playerId)) { snake.body.pop(); continue }
    const head = snake.body[0]
    const fi = game.food.findIndex((f, i) => f.x === head.x && f.y === head.y && !eatenIdx.has(i))
    if (fi >= 0) { eatenIdx.add(fi); snake.score += 10 }
    else snake.body.pop()
  }

  // ── Phase 5: Kill ─────────────────────────────────────────────────
  for (const id of dead) {
    const snake = game.snakes[id]
    if (!snake) continue
    const lengthAtDeath = snake.body.length

    if (mode === 'classic') {
      snake.alive = false
      game.deathLog.push({ playerId: id, length: lengthAtDeath, score: snake.score })
    } else {
      // Timed: queue respawn + preview 3s before
      snake.alive = false
      snake.lengthAtDeath = lengthAtDeath
      const deathNow = Date.now()
      game.respawnQueue[id] = deathNow + RESPAWN_DELAY_MS
      game.previewQueue[id] = deathNow + RESPAWN_DELAY_MS - 3000
    }

    // Convert body to corpse food (tracked by ownerId for cleanup on respawn)
    const foodPos = new Set(game.food.map((f) => `${f.x},${f.y}`))
    const alivePos = new Set()
    for (const s of Object.values(game.snakes)) {
      if (s.playerId === id || !s.alive) continue
      for (const seg of s.body) alivePos.add(`${seg.x},${seg.y}`)
    }
    for (const seg of snake.body) {
      const key = `${seg.x},${seg.y}`
      if (!foodPos.has(key) && !alivePos.has(key)) {
        game.food.push({ x: seg.x, y: seg.y, type: 'corpse', ownerId: id })
        foodPos.add(key)
      }
    }
    snake.body = [] // body is now food; cleared so dead snake doesn't render as ghost

    const player = room.players.get(id)
    if (player) player.score = snake.score

    io.to(roomId).emit('player_died', { playerId: id, name: snake.name })
  }

  // ── Phase 6: Respawn food ─────────────────────────────────────────
  // Remove any eaten food (regular or corpse)
  game.food = game.food.filter((_, i) => !eatenIdx.has(i))
  // Only replenish regular food up to configured count; corpse food is independent
  const regularCount = game.food.filter((f) => !f.type || f.type === 'regular').length
  let needed = game.foodCount - regularCount
  while (needed > 0) {
    const f = placeFoodSafe(game.snakes, game.food, gridSize)
    if (!f) break
    game.food.push({ x: f.x, y: f.y, type: 'regular' })
    needed--
  }

  // ── Phase 7: Broadcast ────────────────────────────────────────────
  const tickPayload = {
    tick: game.tick,
    snakes: Object.values(game.snakes).map((s) => ({
      playerId: s.playerId,
      body: s.body,
      color: s.color,
      name: s.name,
      alive: s.alive,
      score: s.score,
      lengthAtDeath: s.lengthAtDeath || null,
    })),
    food: game.food,
  }

  if (mode === 'timed') {
    const now = Date.now()
    tickPayload.timeLeft = Math.max(0, Math.ceil((game.duration - (now - game.startTime - (game.totalPausedMs || 0))) / 1000))
    const respawning = {}
    for (const [pid, at] of Object.entries(game.respawnQueue)) {
      respawning[pid] = Math.max(0, Math.ceil((at - now) / 1000))
    }
    tickPayload.respawning = respawning
  }

  tickPayload.bullets = game.bullets.map((b) => ({
    id: b.id, x: b.x, y: b.y, dx: b.dx, dy: b.dy, color: b.color, playerId: b.playerId,
  }))

  io.to(roomId).emit('game_tick', tickPayload)

  // ── Phase 8: Win condition (classic only — timed has timer) ──────
  if (mode === 'classic') {
    const stillAlive = Object.values(game.snakes).filter((s) => s.alive)
    const total = Object.keys(game.snakes).length
    if (stillAlive.length === 0 || (stillAlive.length === 1 && total > 1)) {
      endGame(io, roomId)
    }
  }
}

function respawnPlayer(game, playerId) {
  const snake = game.snakes[playerId]
  if (!snake) return
  // Remove this player's corpse food on respawn
  game.food = game.food.filter((f) => !(f.type === 'corpse' && f.ownerId === playerId))
  // Use pre-calculated position from preview; fall back to fresh calculation
  const pos = snake.pendingRespawn || findRespawnPos(game.snakes, game.food, game.gridSize)
  snake.pendingRespawn = null
  if (!pos) return
  snake.body = buildInitialBody(pos.x, pos.y, pos.dir)
  snake.direction = pos.dir
  snake.nextDirection = pos.dir
  snake.alive = true
}

function handleDirectionChange(roomId, playerId, direction) {
  const room = roomService.getRoom(roomId)
  if (!room || !room.game) return
  const snake = room.game.snakes[playerId]
  if (!snake || !snake.alive) return
  const dir = direction.toUpperCase()
  if (!DIR_DELTA[dir]) return
  if (OPPOSITE[snake.direction] === dir) return
  snake.nextDirection = dir
}

function killSnakeByDisconnect(roomId, playerId) {
  const room = roomService.getRoom(roomId)
  if (!room || !room.game) return
  const game = room.game
  const snake = game.snakes[playerId]
  if (!snake || !snake.alive) return

  snake.alive = false
  if (game.mode === 'classic') {
    game.deathLog.push({ playerId, length: snake.body.length, score: snake.score })
  } else {
    snake.lengthAtDeath = snake.body.length
    // Disconnected players don't respawn in timed mode
  }

  // Convert body to corpse food
  const foodPos = new Set(game.food.map((f) => `${f.x},${f.y}`))
  const alivePos = new Set()
  for (const s of Object.values(game.snakes)) {
    if (s.playerId === playerId || !s.alive) continue
    for (const seg of s.body) alivePos.add(`${seg.x},${seg.y}`)
  }
  for (const seg of snake.body) {
    const key = `${seg.x},${seg.y}`
    if (!foodPos.has(key) && !alivePos.has(key)) {
      game.food.push({ x: seg.x, y: seg.y, type: 'corpse', ownerId: playerId })
      foodPos.add(key)
    }
  }
  snake.body = []
}

function endGame(io, roomId) {
  const room = roomService.getRoom(roomId)
  if (!room || !room.game) return

  const game = room.game
  clearInterval(game.intervalId)
  game.intervalId = null

  let winnerId = null
  let rankings = []

  if (game.mode === 'classic') {
    // Winner = last alive
    const stillAlive = Object.values(game.snakes).filter((s) => s.alive)
    if (stillAlive.length === 1) {
      winnerId = stillAlive[0].playerId
      const w = stillAlive[0]
      // Push winner to deathLog last so they end up at top after sort
      game.deathLog.push({ playerId: winnerId, length: w.body.length, score: w.score })
    }

    // Sort non-winners by length at death (descending)
    const others = game.deathLog
      .filter((d) => d.playerId !== winnerId)
      .sort((a, b) => b.length - a.length)

    const ordered = winnerId
      ? [game.deathLog.find((d) => d.playerId === winnerId), ...others]
      : others.sort((a, b) => b.length - a.length)

    rankings = ordered.map((d, i) => {
      const snake = game.snakes[d.playerId]
      return {
        playerId: d.playerId,
        name: snake ? snake.name : d.playerId,
        color: snake ? snake.color : '#fff',
        length: d.length,
        score: d.score,
        placement: i + 1,
      }
    })

    if (rankings.length > 0) winnerId = rankings[0].playerId
  } else {
    // Timed: rank all by snake length (alive use body.length; dead use lengthAtDeath)
    const effectiveLen = (s) => s.alive ? s.body.length : (s.lengthAtDeath || 0)
    const allSnakes = Object.values(game.snakes).sort((a, b) => effectiveLen(b) - effectiveLen(a))
    rankings = allSnakes.map((snake, i) => ({
      playerId: snake.playerId,
      name: snake.name,
      color: snake.color,
      length: effectiveLen(snake),
      score: snake.score,
      placement: i + 1,
    }))
    if (rankings.length > 0) winnerId = rankings[0].playerId
  }

  room.status = 'finished'
  const winner = rankings[0]
  io.to(roomId).emit('game_over', {
    winnerId,
    winnerName: winner ? winner.name : null,
    rankings,
    mode: game.mode,
  })

  roomService.scheduleCleanup(roomId)
}

// ── Pause / Resume ────────────────────────────────────────────────────────────
function pauseGame(io, roomId) {
  const room = roomService.getRoom(roomId)
  if (!room?.game || room.game.paused) return
  const game = room.game
  game.paused = true
  game.pausedAt = Date.now()
  clearInterval(game.intervalId)
  game.intervalId = null
  io.to(roomId).emit('game_paused', {
    gridSize: game.gridSize,
    tickMs: game.tickMs,
  })
}

function resumeGame(io, roomId) {
  const room = roomService.getRoom(roomId)
  if (!room?.game || !room.game.paused) return
  const game = room.game
  game.paused = false
  game.totalPausedMs = (game.totalPausedMs || 0) + (Date.now() - game.pausedAt)
  game.pausedAt = null
  game.intervalId = setInterval(() => tick(io, roomId), game.tickMs)
  io.to(roomId).emit('game_resumed')
}

// ── Resize map during pause (enlarge only — no death risk) ────────────────────
function resizeGameMap(io, roomId, newGridSize) {
  const room = roomService.getRoom(roomId)
  if (!room?.game) return
  const game = room.game
  const oldSize = game.gridSize
  if (newGridSize < oldSize || newGridSize > 60) return // only enlarge

  const offset = Math.floor((newGridSize - oldSize) / 2)

  for (const snake of Object.values(game.snakes)) {
    snake.body = snake.body.map((seg) => ({
      x: Math.min(newGridSize - 1, seg.x + offset),
      y: Math.min(newGridSize - 1, seg.y + offset),
    }))
  }
  game.food = game.food.map((f) => ({
    x: Math.min(newGridSize - 1, f.x + offset),
    y: Math.min(newGridSize - 1, f.y + offset),
  }))

  game.gridSize = newGridSize
  room.settings.gridSize = newGridSize

  io.to(roomId).emit('game_resized', {
    gridSize: newGridSize,
    snakes: Object.values(game.snakes).map((s) => ({
      playerId: s.playerId, body: s.body, color: s.color,
      name: s.name, alive: s.alive, score: s.score,
    })),
    food: game.food,
  })
}

// ── Update speed during pause ─────────────────────────────────────────────────
function updatePauseSpeed(io, roomId, newTickMs) {
  const room = roomService.getRoom(roomId)
  if (!room?.game) return
  const t = Math.round(newTickMs)
  if (t < 60 || t > 500) return
  room.game.tickMs = t
  room.settings.tickMs = t
  io.to(roomId).emit('pause_speed_updated', { tickMs: t })
}

// ── Force end game ────────────────────────────────────────────────────────────
function endGameNow(io, roomId) {
  const room = roomService.getRoom(roomId)
  if (!room?.game) return
  if (room.game.paused) {
    room.game.paused = false // don't need to clear interval (already cleared)
  } else {
    clearInterval(room.game.intervalId)
    room.game.intervalId = null
  }
  endGame(io, roomId)
}

module.exports = {
  startGame,
  processShoot,
  handleDirectionChange,
  killSnakeByDisconnect,
  pauseGame,
  resumeGame,
  resizeGameMap,
  updatePauseSpeed,
  endGameNow,
  endGame,
}
