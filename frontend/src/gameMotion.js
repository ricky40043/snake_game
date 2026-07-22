export const DIRECTION_DELTA = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
}

const OPPOSITE_DIRECTION = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
}

const TELEPORT_DISTANCE = 2.5

export function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

export function inferSnakeDirection(snake) {
  if (DIRECTION_DELTA[snake?.direction]) return snake.direction
  if (!snake?.body || snake.body.length < 2) return null

  const [head, neck] = snake.body
  const dx = head.x - neck.x
  const dy = head.y - neck.y
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'RIGHT' : 'LEFT'
  return dy >= 0 ? 'DOWN' : 'UP'
}

export function isOppositeDirection(current, next) {
  return OPPOSITE_DIRECTION[current] === next
}

export function predictSnake(snake, requestedDirection, steps = 1) {
  if (!snake?.alive || !snake.body?.length) return snake

  const currentDirection = inferSnakeDirection(snake) || 'RIGHT'
  const direction = DIRECTION_DELTA[requestedDirection] &&
    !isOppositeDirection(currentDirection, requestedDirection)
    ? requestedDirection
    : currentDirection

  let body = snake.body.map((segment) => ({ ...segment }))
  const movesPerTick = snake.boostActive ? 2 : 1
  const totalMoves = Math.max(0, steps) * movesPerTick
  const delta = DIRECTION_DELTA[direction]

  for (let i = 0; i < totalMoves; i++) {
    const head = body[0]
    body = [
      { x: head.x + delta.x, y: head.y + delta.y },
      ...body.slice(0, -1),
    ]
  }

  return { ...snake, body, direction }
}

export function interpolateSnake(fromSnake, toSnake, progress) {
  if (!toSnake) return fromSnake
  if (!fromSnake?.body?.length || !toSnake.body?.length) return toSnake
  const fromHead = fromSnake.body[0]
  const toHead = toSnake.body[0]
  if (Math.hypot(fromHead.x - toHead.x, fromHead.y - toHead.y) > TELEPORT_DISTANCE) {
    return toSnake
  }

  const t = clamp01(progress)
  const fromBody = fromSnake.body
  const body = toSnake.body.map((toSegment, index) => {
    const fromSegment = fromBody[Math.min(index, fromBody.length - 1)] || toSegment
    return {
      x: fromSegment.x + (toSegment.x - fromSegment.x) * t,
      y: fromSegment.y + (toSegment.y - fromSegment.y) * t,
    }
  })

  return { ...toSnake, body }
}

export function interpolateSnakes(fromSnakes, toSnakes, progress) {
  const fromById = new Map((fromSnakes || []).map((snake) => [snake.playerId, snake]))
  return (toSnakes || []).map((snake) => (
    interpolateSnake(fromById.get(snake.playerId), snake, progress)
  ))
}

export function interpolateBullets(fromBullets, toBullets, progress) {
  const t = clamp01(progress)
  const fromById = new Map((fromBullets || []).map((bullet) => [bullet.id, bullet]))
  return (toBullets || []).map((bullet) => {
    const previous = fromById.get(bullet.id)
    if (!previous) return bullet
    return {
      ...bullet,
      x: previous.x + (bullet.x - previous.x) * t,
      y: previous.y + (bullet.y - previous.y) * t,
    }
  })
}
