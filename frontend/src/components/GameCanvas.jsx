import { useRef, useEffect, useCallback } from 'react'

const GRID_COLOR = '#2a2a3f'
const BG_COLOR = '#11111a'
const LOCAL_PREDICTION_MS = 180

const DIR_DELTA_CANVAS = {
  UP: [0, -1],
  DOWN: [0, 1],
  LEFT: [-1, 0],
  RIGHT: [1, 0],
}

const OPPOSITE = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' }

function getDirectionFromBody(body) {
  if (!body || body.length < 2) return 'RIGHT'
  const head = body[0]
  const neck = body[1]
  const dx = head.x - neck.x
  const dy = head.y - neck.y
  if (dx > 0) return 'RIGHT'
  if (dx < 0) return 'LEFT'
  if (dy > 0) return 'DOWN'
  return 'UP'
}

function predictOneGridStep(snake, direction, gridSize) {
  if (!snake?.alive || !snake.body?.length) return snake
  const currentDirection = getDirectionFromBody(snake.body)
  const dir = String(direction || '').toUpperCase()
  const delta = DIR_DELTA_CANVAS[dir]
  if (!delta) return snake
  if (dir === currentDirection || OPPOSITE[currentDirection] === dir) return snake

  const head = snake.body[0]
  const nextHead = { x: head.x + delta[0], y: head.y + delta[1] }
  if (nextHead.x < 0 || nextHead.y < 0 || nextHead.x >= gridSize || nextHead.y >= gridSize) return snake

  return {
    ...snake,
    body: [nextHead, ...snake.body.slice(0, -1)],
  }
}

export default function GameCanvas({ snakes, food, bullets, gridSize, myPlayerId, viewport, previewSnake }) {
  const canvasRef = useRef(null)
  const localDirectionRef = useRef(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const size = canvas.width

    const renderCols = viewport ? viewport.size : gridSize
    const renderRows = viewport ? viewport.size : gridSize
    const camX = viewport ? viewport.camX : 0
    const camY = viewport ? viewport.camY : 0
    const tileSize = Math.floor(size / renderCols)

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

    for (const f of food) {
      if (viewport && (f.x < camX || f.x >= camX + viewport.size || f.y < camY || f.y >= camY + viewport.size)) continue
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

    const localDirection = localDirectionRef.current
    const shouldPredictLocal = localDirection && Date.now() - localDirection.ts <= LOCAL_PREDICTION_MS
    const renderSnakes = shouldPredictLocal
      ? snakes.map((s) => s.playerId === myPlayerId ? predictOneGridStep(s, localDirection.direction, gridSize) : s)
      : snakes

    const sorted = [...renderSnakes].sort((a, b) => (a.alive ? 1 : -1))

    for (const snake of sorted) {
      if (!snake.body || snake.body.length === 0) continue
      const isMe = snake.playerId === myPlayerId
      const baseColor = snake.color
      const isInvincible = snake.alive && snake.invincibleUntil && snake.invincibleUntil > Date.now()
      let alpha
      if (!snake.alive) {
        alpha = 0.2
      } else if (isInvincible) {
        const pulsePhase = (Date.now() % 1200) / 1200
        alpha = 0.35 + 0.25 * Math.sin(pulsePhase * Math.PI * 2)
      } else {
        alpha = 1
      }

      ctx.globalAlpha = alpha

      snake.body.forEach((seg, i) => {
        if (viewport && (seg.x < camX || seg.x >= camX + viewport.size || seg.y < camY || seg.y >= camY + viewport.size)) return

        const rx = seg.x - camX
        const ry = seg.y - camY
        const x = rx * tileSize + 1
        const y = ry * tileSize + 1
        const w = tileSize - 2
        const isHead = i === 0

        ctx.fillStyle = isHead ? baseColor : baseColor + 'cc'
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(x, y, w, w, isHead ? 5 : 3)
        else ctx.rect(x, y, w, w)
        ctx.fill()
      })

      if (snake.alive && snake.body.length >= 2) {
        const head = snake.body[0]
        const neck = snake.body[1]

        if (viewport && (head.x < camX || head.x >= camX + viewport.size || head.y < camY || head.y >= camY + viewport.size)) {
          ctx.globalAlpha = 1
          continue
        }

        const dx = head.x - neck.x
        const dy = head.y - neck.y
        const hx = (head.x - camX) * tileSize
        const hy = (head.y - camY) * tileSize
        const mid = tileSize / 2
        let eye1, eye2
        const eyeOffset = tileSize * 0.22
        const eyeForward = tileSize * 0.28
        const eyeSize = Math.max(2, Math.floor(tileSize * 0.18))

        if (dx === 1) {
          eye1 = { x: hx + eyeForward + mid * 0.3, y: hy + mid - eyeOffset }
          eye2 = { x: hx + eyeForward + mid * 0.3, y: hy + mid + eyeOffset }
        } else if (dx === -1) {
          eye1 = { x: hx + mid - eyeForward - mid * 0.3, y: hy + mid - eyeOffset }
          eye2 = { x: hx + mid - eyeForward - mid * 0.3, y: hy + mid + eyeOffset }
        } else if (dy === 1) {
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

      const head = snake.body[0]
      if (isInvincible && head && (!viewport || (head.x >= camX && head.x < camX + viewport.size && head.y >= camY && head.y < camY + viewport.size))) {
        const rx = head.x - camX
        const ry = head.y - camY
        const shieldPhase = (Date.now() % 800) / 800
        ctx.globalAlpha = 0.5 + 0.35 * Math.sin(shieldPhase * Math.PI * 2)
        ctx.save()
        ctx.shadowColor = '#60a5fa'
        ctx.shadowBlur = 10
        ctx.strokeStyle = '#93c5fd'
        ctx.lineWidth = 2
        ctx.setLineDash([3, 2])
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(rx * tileSize, ry * tileSize, tileSize, tileSize, 6)
        else ctx.rect(rx * tileSize, ry * tileSize, tileSize, tileSize)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.restore()
      }

      if (snake.alive && snake.boostActive && head && (!viewport || (head.x >= camX && head.x < camX + viewport.size && head.y >= camY && head.y < camY + viewport.size))) {
        const rx = head.x - camX
        const ry = head.y - camY
        const boostPhase = (Date.now() % 500) / 500
        ctx.globalAlpha = 0.55 + 0.3 * Math.sin(boostPhase * Math.PI * 2)
        ctx.save()
        ctx.shadowColor = '#fbbf24'
        ctx.shadowBlur = 12
        ctx.strokeStyle = '#fde68a'
        ctx.lineWidth = 2
        ctx.setLineDash([2, 2])
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(rx * tileSize, ry * tileSize, tileSize, tileSize, 6)
        else ctx.rect(rx * tileSize, ry * tileSize, tileSize, tileSize)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.restore()
      }

      if (isMe && snake.alive && head && (!viewport || (head.x >= camX && head.x < camX + viewport.size && head.y >= camY && head.y < camY + viewport.size))) {
        const rx = head.x - camX
        const ry = head.y - camY
        ctx.globalAlpha = 0.6
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(rx * tileSize + 1, ry * tileSize + 1, tileSize - 2, tileSize - 2, 5)
        else ctx.rect(rx * tileSize + 1, ry * tileSize + 1, tileSize - 2, tileSize - 2)
        ctx.stroke()
      }

      ctx.globalAlpha = 1
    }

    if (bullets && bullets.length > 0) {
      for (const bullet of bullets) {
        if (viewport && (bullet.x < camX || bullet.x >= camX + viewport.size || bullet.y < camY || bullet.y >= camY + viewport.size)) continue
        const rx = bullet.x - camX
        const ry = bullet.y - camY
        const bx = rx * tileSize + tileSize / 2
        const by = ry * tileSize + tileSize / 2
        const bHalf = tileSize * 0.62
        const bRad  = tileSize * 0.24

        const angle = bullet.dx !== 0
          ? (bullet.dx > 0 ? 0 : Math.PI)
          : (bullet.dy > 0 ? Math.PI / 2 : -Math.PI / 2)

        ctx.save()
        ctx.translate(bx, by)
        ctx.rotate(angle)
        ctx.shadowColor = bullet.color
        ctx.shadowBlur = 16
        ctx.fillStyle = bullet.color
        ctx.beginPath()
        ctx.ellipse(0, 0, bHalf, bRad, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.beginPath()
        ctx.ellipse(0, 0, bHalf * 0.55, bRad * 0.5, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }

    if (previewSnake) {
      const { body, direction, color } = previewSnake
      const pulsePhase = (Date.now() % 1000) / 1000
      const pulseAlpha = 0.45 + 0.3 * Math.sin(pulsePhase * Math.PI * 2)

      body.forEach((seg, i) => {
        if (viewport && (seg.x < camX || seg.x >= camX + viewport.size || seg.y < camY || seg.y >= camY + viewport.size)) return
        const rx = seg.x - camX
        const ry = seg.y - camY
        const x = rx * tileSize + 1
        const y = ry * tileSize + 1
        const w = tileSize - 2
        ctx.globalAlpha = i === 0 ? 0.55 : 0.25
        ctx.fillStyle = i === 0 ? color : color + '88'
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(x, y, w, w, i === 0 ? 5 : 3)
        else ctx.rect(x, y, w, w)
        ctx.fill()
      })

      if (body.length > 0) {
        const head = body[0]
        if (!viewport || (head.x >= camX && head.x < camX + viewport.size && head.y >= camY && head.y < camY + viewport.size)) {
          const rx = head.x - camX
          const ry = head.y - camY
          ctx.globalAlpha = pulseAlpha
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 2
          ctx.setLineDash([3, 3])
          ctx.beginPath()
          if (ctx.roundRect) ctx.roundRect(rx * tileSize + 1, ry * tileSize + 1, tileSize - 2, tileSize - 2, 5)
          else ctx.rect(rx * tileSize + 1, ry * tileSize + 1, tileSize - 2, tileSize - 2)
          ctx.stroke()
          ctx.setLineDash([])

          const d = DIR_DELTA_CANVAS[direction] || [1, 0]
          const hx = (head.x - camX) * tileSize + tileSize / 2
          const hy = (head.y - camY) * tileSize + tileSize / 2
          const as = tileSize * 0.28
          ctx.globalAlpha = 0.9
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          if (d[0] === 1)       { ctx.moveTo(hx + as, hy); ctx.lineTo(hx - as * 0.5, hy - as * 0.7); ctx.lineTo(hx - as * 0.5, hy + as * 0.7) }
          else if (d[0] === -1) { ctx.moveTo(hx - as, hy); ctx.lineTo(hx + as * 0.5, hy - as * 0.7); ctx.lineTo(hx + as * 0.5, hy + as * 0.7) }
          else if (d[1] === 1)  { ctx.moveTo(hx, hy + as); ctx.lineTo(hx - as * 0.7, hy - as * 0.5); ctx.lineTo(hx + as * 0.7, hy - as * 0.5) }
          else                  { ctx.moveTo(hx, hy - as); ctx.lineTo(hx - as * 0.7, hy + as * 0.5); ctx.lineTo(hx + as * 0.7, hy + as * 0.5) }
          ctx.fill()
        }
      }

      ctx.globalAlpha = 1
    }
  }, [snakes, food, bullets, gridSize, myPlayerId, viewport, previewSnake])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const container = canvas.parentElement
    const resize = () => {
      const size = Math.min(container.clientWidth, container.clientHeight)
      canvas.width = size
      canvas.height = size
      draw()
    }

    const ro = new ResizeObserver(resize)
    ro.observe(container)
    resize()
    return () => ro.disconnect()
  }, [draw])

  useEffect(() => {
    localDirectionRef.current = null
    draw()
  }, [draw, snakes])

  useEffect(() => {
    const onLocalDirection = (e) => {
      localDirectionRef.current = e.detail
      draw()
    }

    window.addEventListener('snake_local_direction', onLocalDirection)
    return () => window.removeEventListener('snake_local_direction', onLocalDirection)
  }, [draw])

  const hasInvincibleSnake = snakes.some((s) => s.invincibleUntil)
  const hasBoostingSnake = snakes.some((s) => s.boostActive)
  useEffect(() => {
    if (!previewSnake && !hasInvincibleSnake && !hasBoostingSnake) return
    let rafId
    const animate = () => { draw(); rafId = requestAnimationFrame(animate) }
    rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [previewSnake, hasInvincibleSnake, hasBoostingSnake, draw])

  return (
    <canvas
      ref={canvasRef}
      className="block rounded-lg"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
