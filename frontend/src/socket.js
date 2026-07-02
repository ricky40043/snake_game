import { io } from 'socket.io-client'

const URL = import.meta.env.DEV ? 'http://localhost:3001' : '/'

export const socket = io(URL, {
  autoConnect: false,
  // Real-time controls should use WebSocket only. Polling fallback makes input feel delayed.
  transports: ['websocket'],
  upgrade: false,
})

const DIR_MAP = {
  ArrowUp: 'UP', w: 'UP', W: 'UP',
  ArrowDown: 'DOWN', s: 'DOWN', S: 'DOWN',
  ArrowLeft: 'LEFT', a: 'LEFT', A: 'LEFT',
  ArrowRight: 'RIGHT', d: 'RIGHT', D: 'RIGHT',
}

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

function emitDirection(roomId, direction) {
  if (!roomId || !direction) return socket

  const now = performance.now()
  const normalized = String(direction).toUpperCase()

  if (normalized === lastDirection && now - lastDirectionAt < DUPLICATE_DIRECTION_GUARD_MS) {
    return socket
  }

  lastDirection = normalized
  lastDirectionAt = now
  notifyLocalDirection(normalized)
  return rawEmit('change_direction', { roomId, direction: normalized })
}

socket.emit = (eventName, payload, ...args) => {
  if (eventName === 'change_direction' && payload?.direction) {
    return emitDirection(payload.roomId, payload.direction)
  }

  return rawEmit(eventName, payload, ...args)
}

// Fast keyboard path:
// Game.jsx's keydown handler is recreated on frequent game state updates.
// Capture direction keys here first so local input does not wait on React render churn.
if (typeof window !== 'undefined' && !window.__snakeFastDirectionListenerInstalled) {
  window.__snakeFastDirectionListenerInstalled = true

  window.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return

    const direction = DIR_MAP[e.key]
    if (!direction) return

    const params = new URLSearchParams(window.location.search)
    const roomId = params.get('room')
    if (!roomId) return

    e.preventDefault()
    e.stopImmediatePropagation()

    if (!socket.connected) socket.connect()
    emitDirection(roomId, direction)
  }, true)
}
