import { io } from 'socket.io-client'

const URL = import.meta.env.DEV ? 'http://localhost:3001' : '/'

export const socket = io(URL, {
  autoConnect: false,
  // Real-time controls should use WebSocket only. Polling fallback makes input feel delayed.
  transports: ['websocket'],
  upgrade: false,
})

const rawEmit = socket.emit.bind(socket)
let lastDirection = null
let lastDirectionAt = 0
const DUPLICATE_DIRECTION_GUARD_MS = 45
const DIRECTION_ACK_TIMEOUT_MS = 600

/**
 * Sends a direction without Socket.IO's disconnected-event buffering. A stale
 * turn arriving after reconnect is worse than a visible rejected input in a
 * real-time snake game, so callers always receive a concrete result.
 */
export function emitDirection({ roomId, direction, inputId }, acknowledge = () => {}) {
  const normalized = String(direction || '').toUpperCase()
  if (!socket.connected) {
    socket.connect()
    acknowledge({ accepted: false, reason: 'disconnected', direction: normalized, inputId })
    return false
  }

  const now = performance.now()
  if (normalized === lastDirection && now - lastDirectionAt < DUPLICATE_DIRECTION_GUARD_MS) {
    acknowledge({ accepted: false, reason: 'duplicate_client', direction: normalized, inputId })
    return false
  }

  lastDirection = normalized
  lastDirectionAt = now

  let settled = false
  const timeoutId = window.setTimeout(() => {
    if (settled) return
    settled = true
    acknowledge({ accepted: false, reason: 'timeout', direction: normalized, inputId })
  }, DIRECTION_ACK_TIMEOUT_MS)

  rawEmit('change_direction', { roomId, direction: normalized, inputId }, (result = {}) => {
    if (settled) return
    settled = true
    window.clearTimeout(timeoutId)
    acknowledge({ ...result, direction: normalized, inputId })
  })

  return true
}

socket.on('disconnect', () => {
  lastDirection = null
  lastDirectionAt = 0
})
