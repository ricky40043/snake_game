import { useEffect, useRef } from 'react'

const GRID_COLOR = '#2a2a3f'
const BG_COLOR = '#11111a'
const DEFAULT_INTERPOLATION_MS = 100
const MAX_INTERPOLATION_MS = 140
const TELEPORT_DISTANCE = 2.5

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function clonePoint(p) {
  return p ? { x: p.x, y: p.y } : null
}

function cloneSnake(s) {
  return {
    ...s,
    body: Array.isArray(s.body) ? s.body.map(clonePoint).filter(Boolean) : [],
  }
}

function cloneFrame(snakes = [], food = [], bullets = [], previewSnake = null) {
  return {
    snakes: snakes.map(cloneSnake),
    food: food.map((f) => ({ ...f })),
    bullets: bullets.map((b) => ({ ...b })),
    previewSnake: previewSnake
      ? { ...previewSnake, body: previewSnake.body?.map(clonePoint).filter(Boolean) || [] }
      : null,
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function shouldSnap(a, b) {
  if (!a || !b) return true
  return Math.hypot(a.x - b.x, a.y - b.y) > TELEPORT_DISTANCE
}

function interpolatePoint(from, to, t) {
  if (!from || !to || shouldSnap(from, to)) return clonePoint(to || from)
  return { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) }
}

function interpolateSnake(prevSnake, nextSnake, t) {
  if (!nextSnake) return null
  if (!prevSnake || !prevSnake.body?.length || !nextSnake.body?.length) return cloneSnake(nextSnake)

  return {
    ...nextSnake,
    body: nextSnake.body.map((nextSeg, i) => {
      const prevSeg = prevSnake.body[i] || prevSnake.body[prevSnake.body.length - 1]
      return interpolatePoint(prevSeg, nextSeg, t)
    }),
  }
}

function buildRenderFrame(prevFrame, nextFrame, t) {
  if (!prevFrame) return nextFrame

  const prevById = new Map(prevFrame.snakes.map((s) => [s.playerId, s]))
  return {
    ...nextFrame,
    snakes: nextFrame.snakes
      .map((snake) => interpolateSnake(prevById.get(snake.playerId), snake, t))
      .filter(Boolean),
  }
}

function isInViewport(p, viewport, camX, camY) {
  if (!viewport) return true
  return p.x >= camX && p.x < camX + viewport.size && p.y >= camY && p.y < camY + viewport.size
}

function drawRoundRect(ctx, x, y, w, h, radius) {
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, radius)
  else ctx.rect(x, y, w, h)
}

function drawGame(ctx, canvas, frame, options) {
  const { gridSize, myPlayerId, viewport } = options
  const size = canvas.width
  if (!size || !frame) return

  const renderCols = viewport ? viewport.size : gridSize
  const renderRows = viewport ? viewport.size : gridSize
  const camX = viewport ? viewport.camX : 0
  const camY = viewport ? viewport.camY : 0
  const tileSize = Math.floor(size / renderCols)

  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = BG_COLOR
  ctx.fillRect(0, 0, size, size)

  ctx.strokeStyle = GRID_COLOR
  ctx.lineWidth = 1
  for (let i = 0; i <= renderCols; i++) {
    ctx.beginPath()
    ctx.moveTo(i * tileSize, 0)
    ctx.lineTo(i * tileSize, renderRows * tileSize)
    ctx.stroke()
  }
  for (let i = 0; i <= renderRows; i++) {
    ctx.beginPath()
    ctx.moveTo(0, i * tileSize)
    ctx.lineTo(renderCols * tileSize, i * tileSize)
    ctx.stroke()
  }

  for (const f of frame.food || []) {
    if (!isInViewport(f, viewport, camX, camY)) continue
    const rx = f.x - camX
    const ry = f.y - camY
    const cx = rx * tileSize + tileSize / 2
    const cy = ry * tileSize + tileSize / 2
    const r = tileSize * 0.38

    if (f.type === 'corpse') {
      ctx.globalAlpha = 0.6
      ctx.fillStyle = '#c8a06e'
      ctx.beginPath()
      ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    } else {
      ctx.save()
      ctx.shadowColor = '#f87171'
      ctx.shadowBlur = 8
      ctx.fillStyle = '#f87171'
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }

  const sortedSnakes = [...(frame.snakes || [])].sort((a, b) => (a.alive ? 1 : -1))
  for (const snake of sortedSnakes) {
    if (!snake.body?.length) continue

    const isMe = snake.playerId === myPlayerId
    const baseColor = snake.color || '#22c55e'
    const isInvincible = snake.alive && snake.invincibleUntil && snake.invincibleUntil > Date.now()
    const pulsePhase = (Date.now() % 1200) / 1200
    const alpha = !snake.alive
      ? 0.2
      : isInvincible
        ? 0.35 + 0.25 * Math.sin(pulsePhase * Math.PI * 2)
        : 1

    ctx.globalAlpha = alpha

    snake.body.forEach((seg, i) => {
      if (!isInViewport(seg, viewport, camX, camY)) return
      const x = (seg.x - camX) * tileSize + 1
      const y = (seg.y - camY) * tileSize + 1
      const w = tileSize - 2
      const isHead = i === 0

      ctx.fillStyle = isHead ? baseColor : `${baseColor}cc`
      drawRoundRect(ctx, x, y, w, w, isHead ? 5 : 3)
      ctx.fill()
    })

    const head = snake.body[0]
    const neck = snake.body[1]
    if (snake.alive && head && neck && isInViewport(head, viewport, camX, camY)) {
      const dx = Math.sign(head.x - neck.x)
      const dy = Math.sign(head.y - neck.y)
      const hx = (head.x - camX) * tileSize
      const hy = (head.y - camY) * tileSize
      const mid = tileSize / 2
      const eyeOffset = tileSize * 0.22
      const eyeForward = tileSize * 0.28
      const eyeSize = Math.max(2, Math.floor(tileSize * 0.18))
      let eye1
      let eye2

      if (dx > 0) {
        eye1 = { x: hx + eyeForward + mid * 0.3, y: hy + mid - eyeOffset }
        eye2 = { x: hx + eyeForward + mid * 0.3, y: hy + mid + eyeOffset }
      } else if (dx < 0) {
        eye1 = { x: hx + mid - eyeForward - mid * 0.3, y: hy + mid - eyeOffset }
        eye2 = { x: hx + mid - eyeForward - mid * 0.3, y: hy + mid + eyeOffset }
      } else if (dy > 0) {
        eye1 = { x: hx + mid - eyeOffset, y: hy + eyeForward + mid * 0.3 }
        eye2 = { x: hx + mid + eyeOffset, y: hy + eyeForward + mid * 0.3 }
      } else {
        eye1 = { x: hx + mid - eyeOffset, y: hy + mid - eyeForward - mid * 0.3 }
        eye2 = { x: hx + mid + eyeOffset, y: hy + mid - eyeForward - mid * 0.3 }
      }

      ctx.globalAlpha = 1
      ctx.fillStyle = '#000'
      ctx.fillRect(eye1.x - eyeSize / 2, eye1.y - eyeSize / 2, eyeSize, eyeSize)
      ctx.fillRect(eye2.x - eyeSize / 2, eye2.y - eyeSize / 2, eyeSize, eyeSize)
      ctx.globalAlpha = alpha
    }

    if ((isInvincible || snake.boostActive || isMe) && head && isInViewport(head, viewport, camX, camY)) {
      const rx = head.x - camX
      const ry = head.y - camY
      ctx.save()
      ctx.globalAlpha = isMe ? 0.6 : 0.65
      ctx.strokeStyle = isMe ? '#fff' : isInvincible ? '#93c5fd' : '#fde68a'
      ctx.shadowColor = isInvincible ? '#60a5fa' : snake.boostActive ? '#fbbf24' : 'transparent'
      ctx.shadowBlur = isMe ? 0 : 10
      ctx.lineWidth = 2
      if (!isMe) ctx.setLineDash([3, 2])
      drawRoundRect(ctx, rx * tileSize + 1, ry * tileSize + 1, tileSize - 2, tileSize - 2, 5)
      ctx.stroke()
      ctx.restore()
    }

    ctx.globalAlpha = 1
  }

  for (const bullet of frame.bullets || []) {
    if (!isInViewport(bullet, viewport, camX, camY)) continue
    const bx = (bullet.x - camX) * tileSize + tileSize / 2
    const by = (bullet.y - camY) * tileSize + tileSize / 2
    const angle = bullet.dx !== 0
      ? (bullet.dx > 0 ? 0 : Math.PI)
      : (bullet.dy > 0 ? Math.PI / 2 : -Math.PI / 2)

    ctx.save()
    ctx.translate(bx, by)
    ctx.rotate(angle)
    ctx.shadowColor = bullet.color || '#ef4444'
    ctx.shadowBlur = 16
    ctx.fillStyle = bullet.color || '#ef4444'
    ctx.beginPath()
    ctx.ellipse(0, 0, tileSize * 0.62, tileSize * 0.24, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.beginPath()
    ctx.ellipse(0, 0, tileSize * 0.34, tileSize * 0.12, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  const preview = frame.previewSnake
  if (preview?.body?.length) {
    const phase = (Date.now() % 1000) / 1000
    const pulseAlpha = 0.45 + 0.3 * Math.sin(phase * Math.PI * 2)
    const color = preview.color || '#22c55e'

    preview.body.forEach((seg, i) => {
      if (!isInViewport(seg, viewport, camX, camY)) return
      const x = (seg.x - camX) * tileSize + 1
      const y = (seg.y - camY) * tileSize + 1
      const w = tileSize - 2
      ctx.globalAlpha = i === 0 ? 0.55 : 0.25
      ctx.fillStyle = i === 0 ? color : `${color}88`
      drawRoundRect(ctx, x, y, w, w, i === 0 ? 5 : 3)
      ctx.fill()
    })

    const head = preview.body[0]
    if (head && isInViewport(head, viewport, camX, camY)) {
      const rx = head.x - camX
      const ry = head.y - camY
      ctx.globalAlpha = pulseAlpha
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.setLineDash([3, 3])
      drawRoundRect(ctx, rx * tileSize + 1, ry * tileSize + 1, tileSize - 2, tileSize - 2, 5)
      ctx.stroke()
      ctx.setLineDash([])
    }

    ctx.globalAlpha = 1
  }
}

export default function GameCanvas({ snakes, food, bullets, gridSize, myPlayerId, viewport, previewSnake }) {
  const canvasRef = useRef(null)
  const optionsRef = useRef({ gridSize, myPlayerId, viewport })
  const timelineRef = useRef({
    prev: null,
    next: cloneFrame(snakes, food, bullets, previewSnake),
    receivedAt: nowMs(),
    duration: DEFAULT_INTERPOLATION_MS,
    lastReceivedAt: nowMs(),
  })

  useEffect(() => {
    optionsRef.current = { gridSize, myPlayerId, viewport }
  }, [gridSize, myPlayerId, viewport])

  useEffect(() => {
    const current = timelineRef.current
    const now = nowMs()
    const elapsedSinceLastTick = now - current.lastReceivedAt
    const duration = Math.min(
      MAX_INTERPOLATION_MS,
      Math.max(60, Number.isFinite(elapsedSinceLastTick) ? elapsedSinceLastTick : DEFAULT_INTERPOLATION_MS),
    )

    timelineRef.current = {
      prev: current.next,
      next: cloneFrame(snakes, food, bullets, previewSnake),
      receivedAt: now,
      duration,
      lastReceivedAt: now,
    }
  }, [snakes, food, bullets, previewSnake])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const container = canvas.parentElement
    if (!container) return undefined

    const resize = () => {
      const size = Math.floor(Math.min(container.clientWidth, container.clientHeight))
      if (!size) return
      if (canvas.width !== size || canvas.height !== size) {
        canvas.width = size
        canvas.height = size
      }
    }

    const ro = new ResizeObserver(resize)
    ro.observe(container)
    resize()

    let rafId
    const animate = () => {
      resize()
      const ctx = canvas.getContext('2d')
      const timeline = timelineRef.current
      const t = Math.min(1, Math.max(0, (nowMs() - timeline.receivedAt) / timeline.duration))
      const frame = buildRenderFrame(timeline.prev, timeline.next, t)
      drawGame(ctx, canvas, frame, optionsRef.current)
      rafId = requestAnimationFrame(animate)
    }

    rafId = requestAnimationFrame(animate)
    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="block rounded-lg"
      style={{ imageRendering: 'auto' }}
    />
  )
}
