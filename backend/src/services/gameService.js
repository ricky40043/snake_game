const config = require('../config')
const roomService = require('./roomService')

const OPPOSITE = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' }
const DIR_DELTA = {
  UP: { dx: 0, dy: -1 },
  DOWN: { dx: 0, dy: 1 },
  LEFT: { dx: -1, dy: 0 },
  RIGHT: { dx: 1, dy: 0 },
}

function getSpawnConfigs(gridSize) {
  const m = 2 // margin from edge
  const c = Math.floor(gridSize / 2)
  const far = gridSize - 1 - m
  return [
    { startX: m, startY: m, dir: 'RIGHT' },
    { startX: far, startY: far, dir: 'LEFT' },
    { startX: far, startY: m, dir: 'DOWN' },
    { startX: m, startY: far, dir: 'UP' },
    { startX: c, startY: m, dir: 'DOWN' },
    { startX: m, startY: c, dir: 'RIGHT' },
    { startX: far, startY: c, dir: 'LEFT' },
  ]
}

function buildInitialBody(startX, startY, dir) {
  const d = DIR_DELTA[dir]
  // Head + 2 trailing segments going opposite direction
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
  // Exhaustive fallback
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      if (!occupied.has(`${x},${y}`)) return { x, y }
    }
  }
  return null
}

function startGame(io, roomId) {
  const room = roomService.getRoom(roomId)
  if (!room) return

  const { gridSize, tickMs } = room.settings
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

  const food = []
  for (let i = 0; i < config.foodCount; i++) {
    const f = placeFoodSafe(snakes, food, gridSize)
    if (f) food.push(f)
  }

  room.game = {
    gridSize,
    tickMs,
    tick: 0,
    snakes,
    food,
    deathOrder: [], // playerId array, first died = index 0
    intervalId: null,
  }
  room.status = 'playing'

  io.to(roomId).emit('game_started', {
    gridSize,
    tickMs,
    snakes: Object.values(snakes),
    food,
  })

  room.game.intervalId = setInterval(() => tick(io, roomId), tickMs)
}

function tick(io, roomId) {
  const room = roomService.getRoom(roomId)
  if (!room || !room.game) return

  const game = room.game
  const { gridSize } = game
  game.tick++

  const aliveSnakes = Object.values(game.snakes).filter((s) => s.alive)
  if (aliveSnakes.length === 0) {
    endGame(io, roomId)
    return
  }

  // Phase 1: Apply buffered direction (no 180-degree reversal)
  for (const snake of aliveSnakes) {
    if (snake.nextDirection && OPPOSITE[snake.direction] !== snake.nextDirection) {
      snake.direction = snake.nextDirection
    }
  }

  // Phase 2: Extend heads (don't remove tails yet)
  for (const snake of aliveSnakes) {
    const d = DIR_DELTA[snake.direction]
    const newHead = { x: snake.body[0].x + d.dx, y: snake.body[0].y + d.dy }
    snake.body.unshift(newHead)
  }

  // Phase 3: Detect dead snakes
  const dead = new Set()

  // Wall collisions
  for (const snake of aliveSnakes) {
    const head = snake.body[0]
    if (head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize) {
      dead.add(snake.playerId)
    }
  }

  // Head-to-head collisions
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

  // Body collisions (head hits any snake's body[1..n])
  for (const snake of aliveSnakes) {
    if (dead.has(snake.playerId)) continue
    const head = snake.body[0]
    for (const other of aliveSnakes) {
      // body[1..] because body[0] is the new head (already moved)
      // For own snake: slice(2) because body[0]=newHead, body[1]=old head (valid to hit)
      // Actually slice(1) for others, slice(2) for self is wrong.
      // body[0] = newHead, body[1] = previous head position = valid segment to collide with
      // The tail (last element) was not yet removed; we'll handle this below with food check
      // For now use body.slice(1) for all (includes tail until removed)
      const segments = other.body.slice(1)
      if (segments.some((s) => s.x === head.x && s.y === head.y)) {
        dead.add(snake.playerId)
        break
      }
    }
  }

  // Phase 4: Food collection for surviving snakes; pop tails for all
  const eatenIdx = new Set()
  for (const snake of aliveSnakes) {
    if (dead.has(snake.playerId)) {
      snake.body.pop() // tail vacates (snake didn't eat)
      continue
    }
    const head = snake.body[0]
    const fi = game.food.findIndex((f, i) => f.x === head.x && f.y === head.y && !eatenIdx.has(i))
    if (fi >= 0) {
      eatenIdx.add(fi)
      snake.score += 10
      // Don't pop tail — snake grows
    } else {
      snake.body.pop()
    }
  }

  // Phase 5: Kill dead snakes + emit events
  for (const id of dead) {
    const snake = game.snakes[id]
    if (!snake) continue
    snake.alive = false
    game.deathOrder.push(id)
    io.to(roomId).emit('player_died', {
      playerId: id,
      name: snake.name,
    })
    // Sync player score
    const player = room.players.get(id)
    if (player) player.score = snake.score
  }

  // Phase 6: Respawn eaten food
  const survivingFood = game.food.filter((_, i) => !eatenIdx.has(i))
  game.food = survivingFood
  while (game.food.length < config.foodCount) {
    const f = placeFoodSafe(game.snakes, game.food, gridSize)
    if (!f) break
    game.food.push(f)
  }

  // Phase 7: Broadcast tick
  io.to(roomId).emit('game_tick', {
    tick: game.tick,
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

  // Phase 8: Win condition
  const stillAlive = Object.values(game.snakes).filter((s) => s.alive)
  const totalPlayers = Object.keys(game.snakes).length
  if (stillAlive.length === 0 || (stillAlive.length === 1 && totalPlayers > 1)) {
    endGame(io, roomId)
  }
}

function handleDirectionChange(roomId, playerId, direction) {
  const room = roomService.getRoom(roomId)
  if (!room || !room.game) return
  const snake = room.game.snakes[playerId]
  if (!snake || !snake.alive) return
  const dir = direction.toUpperCase()
  if (!DIR_DELTA[dir]) return
  if (OPPOSITE[snake.direction] === dir) return // no 180°
  snake.nextDirection = dir
}

function killSnakeByDisconnect(roomId, playerId) {
  const room = roomService.getRoom(roomId)
  if (!room || !room.game) return
  const snake = room.game.snakes[playerId]
  if (!snake || !snake.alive) return
  snake.alive = false
  room.game.deathOrder.push(playerId)
}

function endGame(io, roomId) {
  const room = roomService.getRoom(roomId)
  if (!room || !room.game) return

  const game = room.game
  clearInterval(game.intervalId)
  game.intervalId = null

  const stillAlive = Object.values(game.snakes).filter((s) => s.alive)
  let winnerId = null
  if (stillAlive.length === 1) {
    winnerId = stillAlive[0].playerId
    game.deathOrder.push(winnerId) // pushed last = rank 1
  }

  // Build rankings: last in deathOrder = rank 1
  const rankings = []
  for (let i = game.deathOrder.length - 1; i >= 0; i--) {
    const pid = game.deathOrder[i]
    const snake = game.snakes[pid]
    const player = room.players.get(pid)
    if (!snake || !player) continue
    player.score = snake.score
    rankings.push({
      playerId: pid,
      name: snake.name,
      color: snake.color,
      score: snake.score,
      placement: rankings.length + 1,
    })
  }

  room.status = 'finished'

  const winner = winnerId ? game.snakes[winnerId] : null
  io.to(roomId).emit('game_over', {
    winnerId,
    winnerName: winner ? winner.name : null,
    rankings,
  })

  roomService.scheduleCleanup(roomId)
}

module.exports = {
  startGame,
  handleDirectionChange,
  killSnakeByDisconnect,
  endGame,
}
