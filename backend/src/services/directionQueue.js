const OPPOSITE = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' }
const DIRECTIONS = new Set(Object.keys(OPPOSITE))
const MAX_QUEUED_DIRECTIONS = 2

function normalizeDirection(direction) {
  const normalized = String(direction || '').toUpperCase()
  return DIRECTIONS.has(normalized) ? normalized : null
}

function ensureQueue(snake) {
  if (!Array.isArray(snake.directionQueue)) snake.directionQueue = []
  return snake.directionQueue
}

function syncNextDirection(snake) {
  const queue = ensureQueue(snake)
  snake.nextDirection = queue[0]?.direction || snake.direction
}

function enqueueDirection(snake, direction, inputId = null) {
  if (!snake?.alive) return { accepted: false, reason: 'not_alive' }

  const normalized = normalizeDirection(direction)
  if (!normalized) return { accepted: false, reason: 'invalid_direction' }

  const queue = ensureQueue(snake)
  const baseDirection = queue[queue.length - 1]?.direction || snake.direction
  if (normalized === baseDirection) return { accepted: false, reason: 'same_direction' }
  if (OPPOSITE[baseDirection] === normalized) return { accepted: false, reason: 'opposite_direction' }
  if (queue.length >= MAX_QUEUED_DIRECTIONS) return { accepted: false, reason: 'queue_full' }

  queue.push({ direction: normalized, inputId })
  syncNextDirection(snake)
  return { accepted: true, queued: queue.length, direction: normalized, inputId }
}

function consumeDirection(snake) {
  const queue = ensureQueue(snake)
  let applied = null

  while (queue.length > 0 && !applied) {
    const candidate = queue.shift()
    if (!candidate || candidate.direction === snake.direction) continue
    if (OPPOSITE[snake.direction] === candidate.direction) continue
    snake.direction = candidate.direction
    snake.lastAppliedDirectionInputId = candidate.inputId
    applied = candidate
  }

  syncNextDirection(snake)
  return applied
}

function resetDirectionQueue(snake, direction = snake?.direction) {
  if (!snake) return
  const normalized = normalizeDirection(direction) || snake.direction
  snake.directionQueue = []
  snake.direction = normalized
  snake.nextDirection = normalized
}

module.exports = {
  enqueueDirection,
  consumeDirection,
  resetDirectionQueue,
  normalizeDirection,
  MAX_QUEUED_DIRECTIONS,
}
