import { io } from 'socket.io-client'

const URL = import.meta.env.DEV ? 'http://localhost:3001' : '/'

export const socket = io(URL, {
  autoConnect: false,
  // Real-time controls should use WebSocket only. Polling fallback makes input feel delayed.
  transports: ['websocket'],
  upgrade: false,
})

// Small client-side input guard:
// - blocks accidental duplicate direction spam inside one visual reaction window
// - keeps rapid different directions possible, so cornering still feels responsive
const rawEmit = socket.emit.bind(socket)
let lastDirection = null
let lastDirectionAt = 0
const DUPLICATE_DIRECTION_GUARD_MS = 70

function notifyLocalDirection(direction) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('snake_local_direction', {
    detail: { direction, ts: Date.now() },
  }))
}

socket.emit = (eventName, payload, ...args) => {
  if (eventName === 'change_direction' && payload?.direction) {
    const now = performance.now()
    const direction = String(payload.direction).toUpperCase()

    if (direction === lastDirection && now - lastDirectionAt < DUPLICATE_DIRECTION_GUARD_MS) {
      return socket
    }

    lastDirection = direction
    lastDirectionAt = now
    payload = { ...payload, direction }

    // Optimistic local feedback: the client can draw my next grid step immediately.
    // The server is still authoritative; the next game_tick will correct the view.
    notifyLocalDirection(direction)
  }

  return rawEmit(eventName, payload, ...args)
}
