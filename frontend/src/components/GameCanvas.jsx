import { useRef, useEffect, useCallback } from 'react'
import {
  clamp01,
  inferSnakeDirection,
  interpolateBullets,
  interpolateSnake,
  interpolateSnakes,
  predictSnake,
} from '../gameMotion'

const GRID_COLOR = '#2a2a3f'
const BG_COLOR = '#11111a'

const DIR_DELTA_CANVAS = { UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0] }

function nowMs() {
  return typeof performance === 'undefined' ? Date.now() : performance.now()
}

function renderLocalPlan(plan, now) {
  if (!plan) return null
  // Predict only a few ticks ahead; a long disconnect must not let the visual
  // snake run indefinitely away from the authoritative server state.
  const elapsedTicks = Math.min(3, Math.max(0, (now - plan.startedAt) / plan.duration))
  if (elapsedTicks <= 1) return interpolateSnake(plan.from, plan.to, elapsedTicks)

  const completedExtraTicks = Math.floor(elapsedTicks) - 1
  const from = completedExtraTicks > 0
    ? predictSnake(plan.to, plan.direction, completedExtraTicks)
    : plan.to
  const to = predictSnake(from, plan.direction)
  return interpolateSnake(from, to, elapsedTicks - Math.floor(elapsedTicks))
}

function isTileVisible(tile, camX, camY, viewportSize) {
  return tile.x + 1 > camX && tile.x < camX + viewportSize &&
    tile.y + 1 > camY && tile.y < camY + viewportSize
}

export default function GameCanvas({
  snakes,
  food,
  bullets,
  gridSize,
  myPlayerId,
  viewport,
  previewSnake,
  tickMs,
  moving = false,
  localDirection,
}) {
  const canvasRef = useRef(null)
  const foodRef = useRef(food)
  const previousSnakesRef = useRef(snakes)
  const currentSnakesRef = useRef(snakes)
  const previousBulletsRef = useRef(bullets || [])
  const currentBulletsRef = useRef(bullets || [])
  const snapshotAtRef = useRef(nowMs())
  const localPlanRef = useRef(null)
  const lastLocalDirectionRef = useRef(localDirection)

  useEffect(() => {
    foodRef.current = food
  }, [food])

  // Rebase every new authoritative snapshot from the pixels currently on screen.
  // This hides small network jitter instead of snapping back to an old grid cell.
  useEffect(() => {
    const now = nowMs()
    const duration = Math.max(16, Number(tickMs) || 120)
    const oldProgress = moving ? clamp01((now - snapshotAtRef.current) / duration) : 1
    const visibleBeforeUpdate = moving
      ? interpolateSnakes(previousSnakesRef.current, currentSnakesRef.current, oldProgress)
      : currentSnakesRef.current
    const localBeforeUpdate = moving ? renderLocalPlan(localPlanRef.current, now) : null
    const snapshotChanged = snakes !== currentSnakesRef.current

    if (snapshotChanged) {
      previousSnakesRef.current = visibleBeforeUpdate
      currentSnakesRef.current = snakes
      previousBulletsRef.current = moving
        ? interpolateBullets(previousBulletsRef.current, currentBulletsRef.current, oldProgress)
        : (bullets || [])
      currentBulletsRef.current = bullets || []
      snapshotAtRef.current = now
    } else if (bullets !== currentBulletsRef.current) {
      previousBulletsRef.current = currentBulletsRef.current
      currentBulletsRef.current = bullets || []
      snapshotAtRef.current = now
    }

    const authoritativeLocal = snakes.find((snake) => snake.playerId === myPlayerId)
    const direction = localDirection || inferSnakeDirection(authoritativeLocal)
    const directionChanged = direction !== lastLocalDirectionRef.current

    if (moving && authoritativeLocal?.alive && direction) {
      if (snapshotChanged || directionChanged || !localPlanRef.current) {
        localPlanRef.current = {
          from: localBeforeUpdate || authoritativeLocal,
          to: predictSnake(authoritativeLocal, direction),
          direction,
          startedAt: now,
          duration: snapshotChanged ? duration : Math.max(16, duration * (1 - oldProgress)),
        }
      }
    } else {
      localPlanRef.current = null
    }

    lastLocalDirectionRef.current = direction
  }, [snakes, bullets, myPlayerId, localDirection, moving, tickMs])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const size = canvas.width
    const now = nowMs()
    const duration = Math.max(16, Number(tickMs) || 120)
    const progress = moving ? clamp01((now - snapshotAtRef.current) / duration) : 1
    let frameSnakes = moving
      ? interpolateSnakes(previousSnakesRef.current, currentSnakesRef.current, progress)
      : currentSnakesRef.current
    const frameBullets = moving
      ? interpolateBullets(previousBulletsRef.current, currentBulletsRef.current, progress)
      : currentBulletsRef.current

    const predictedLocal = moving ? renderLocalPlan(localPlanRef.current, now) : null
    if (predictedLocal) {
      frameSnakes = frameSnakes.map((snake) => (
        snake.playerId === myPlayerId ? predictedLocal : snake
      ))
    }

    // When viewport is active, render only a viewport.size × viewport.size window
    const renderCols = viewport ? viewport.size : gridSize
    const renderRows = viewport ? viewport.size : gridSize
    const followedSnake = frameSnakes.find((snake) => snake.playerId === myPlayerId)
    const cameraTarget = viewport?.target || followedSnake?.body?.[0]
    const maxCam = Math.max(0, gridSize - renderCols)
    const camX = viewport
      ? Math.max(0, Math.min(maxCam, viewport.camX ?? ((cameraTarget?.x ?? 0) + 0.5 - renderCols / 2)))
      : 0
    const camY = viewport
      ? Math.max(0, Math.min(maxCam, viewport.camY ?? ((cameraTarget?.y ?? 0) + 0.5 - renderRows / 2)))
      : 0
    const tileSize = size / renderCols

    // Background
    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, size, size)

    // Grid lines
    ctx.strokeStyle = GRID_COLOR
    ctx.lineWidth = 1
    const firstGridX = viewport ? Math.floor(camX) : 0
    const lastGridX = viewport ? Math.ceil(camX + renderCols) : renderCols
    for (let worldX = firstGridX; worldX <= lastGridX; worldX++) {
      const x = (worldX - camX) * tileSize
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, size)
      ctx.stroke()
    }
    const firstGridY = viewport ? Math.floor(camY) : 0
    const lastGridY = viewport ? Math.ceil(camY + renderRows) : renderRows
    for (let worldY = firstGridY; worldY <= lastGridY; worldY++) {
      const y = (worldY - camY) * tileSize
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(size, y)
      ctx.stroke()
    }

    // Food
    for (const f of foodRef.current) {
      // Skip tiles outside viewport
      if (viewport && !isTileVisible(f, camX, camY, viewport.size)) continue
      const rx = f.x - camX
      const ry = f.y - camY
      const cx = rx * tileSize + tileSize / 2
      const cy = ry * tileSize + tileSize / 2
      const r = tileSize * 0.38
      if (f.type === 'corpse') {
        // Corpse food: muted tan/gold, smaller, no glow
        ctx.globalAlpha = 0.6
        ctx.fillStyle = '#c8a06e'
        ctx.beginPath()
        ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      } else {
        // Regular food: bright red with glow
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

    // Dead snakes first (dimmed), then alive on top
    const sorted = [...frameSnakes].sort((a, b) => (a.alive ? 1 : -1))

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

      // Draw body segments
      snake.body.forEach((seg, i) => {
        // Skip segments outside viewport
        if (viewport && !isTileVisible(seg, camX, camY, viewport.size)) return

        const rx = seg.x - camX
        const ry = seg.y - camY
        const x = rx * tileSize + 1
        const y = ry * tileSize + 1
        const w = tileSize - 2
        const isHead = i === 0

        if (isHead) {
          ctx.fillStyle = baseColor
        } else {
          // Slightly darker for body
          ctx.fillStyle = baseColor + 'cc'
        }

        const radius = isHead ? 5 : 3
        ctx.beginPath()
        if (ctx.roundRect) {
          ctx.roundRect(x, y, w, w, radius)
        } else {
          ctx.rect(x, y, w, w)
        }
        ctx.fill()
      })

      // Eyes on head
      if (snake.alive && snake.body.length >= 2) {
        const head = snake.body[0]
        const neck = snake.body[1]

        // Skip if head is outside viewport
        if (viewport && !isTileVisible(head, camX, camY, viewport.size)) {
          ctx.globalAlpha = 1
          continue
        }

        const direction = inferSnakeDirection(snake) || (() => {
          const dx = head.x - neck.x
          const dy = head.y - neck.y
          if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'RIGHT' : 'LEFT'
          return dy >= 0 ? 'DOWN' : 'UP'
        })()

        const hx = (head.x - camX) * tileSize
        const hy = (head.y - camY) * tileSize
        const mid = tileSize / 2

        let eye1, eye2
        const eyeOffset = tileSize * 0.22
        const eyeForward = tileSize * 0.28
        const eyeSize = Math.max(2, Math.floor(tileSize * 0.18))

        if (direction === 'RIGHT') {
          eye1 = { x: hx + eyeForward + mid * 0.3, y: hy + mid - eyeOffset }
          eye2 = { x: hx + eyeForward + mid * 0.3, y: hy + mid + eyeOffset }
        } else if (direction === 'LEFT') {
          eye1 = { x: hx + mid - eyeForward - mid * 0.3, y: hy + mid - eyeOffset }
          eye2 = { x: hx + mid - eyeForward - mid * 0.3, y: hy + mid + eyeOffset }
        } else if (direction === 'DOWN') {
          eye1 = { x: hx + mid - eyeOffset, y: hy + eyeForward + mid * 0.3 }
          eye2 = { x: hx + mid + eyeOffset, y: hy + eyeForward + mid * 0.3 }
        } else { // up
          eye1 = { x: hx + mid - eyeOffset, y: hy + mid - eyeForward - mid * 0.3 }
          eye2 = { x: hx + mid + eyeOffset, y: hy + mid - eyeForward - mid * 0.3 }
        }

        ctx.globalAlpha = 1
        ctx.fillStyle = '#000'
        ctx.fillRect(eye1.x - eyeSize / 2, eye1.y - eyeSize / 2, eyeSize, eyeSize)
        ctx.fillRect(eye2.x - eyeSize / 2, eye2.y - eyeSize / 2, eyeSize, eyeSize)
        ctx.globalAlpha = alpha
      }

      // Invincibility shield glow (blue dashed border on head)
      if (isInvincible && snake.body.length > 0) {
        const head = snake.body[0]
        if (!viewport || isTileVisible(head, camX, camY, viewport.size)) {
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
      }

      // Boost glow (yellow pulsing border on head)
      if (snake.alive && snake.boostActive && snake.body.length > 0) {
        const head = snake.body[0]
        if (!viewport || isTileVisible(head, camX, camY, viewport.size)) {
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
      }

      // "ME" indicator — outline on my snake
      if (isMe && snake.alive) {
        const head = snake.body[0]
        // Skip if head is outside viewport
        if (!viewport || isTileVisible(head, camX, camY, viewport.size)) {
          const rx = head.x - camX
          const ry = head.y - camY
          ctx.globalAlpha = 0.6
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 2
          ctx.beginPath()
          if (ctx.roundRect) {
            ctx.roundRect(rx * tileSize + 1, ry * tileSize + 1, tileSize - 2, tileSize - 2, 5)
          } else {
            ctx.rect(rx * tileSize + 1, ry * tileSize + 1, tileSize - 2, tileSize - 2)
          }
          ctx.stroke()
        }
      }

      ctx.globalAlpha = 1
    }

    // ── Bullets (attack mode) ──────────────────────────────────────────
    if (frameBullets && frameBullets.length > 0) {
      for (const bullet of frameBullets) {
        if (viewport && !isTileVisible(bullet, camX, camY, viewport.size)) continue
        const rx = bullet.x - camX
        const ry = bullet.y - camY
        const bx = rx * tileSize + tileSize / 2
        const by = ry * tileSize + tileSize / 2
        const bHalf = tileSize * 0.62  // elongated length (half)
        const bRad  = tileSize * 0.24  // oval radius

        // Angle from direction
        const angle = bullet.dx !== 0
          ? (bullet.dx > 0 ? 0 : Math.PI)
          : (bullet.dy > 0 ? Math.PI / 2 : -Math.PI / 2)

        ctx.save()
        ctx.translate(bx, by)
        ctx.rotate(angle)
        // Glow
        ctx.shadowColor = bullet.color
        ctx.shadowBlur = 16
        ctx.fillStyle = bullet.color
        ctx.beginPath()
        ctx.ellipse(0, 0, bHalf, bRad, 0, 0, Math.PI * 2)
        ctx.fill()
        // Bright core
        ctx.shadowBlur = 0
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.beginPath()
        ctx.ellipse(0, 0, bHalf * 0.55, bRad * 0.5, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }

    // ── Ghost snake: respawn preview (only visible to this player) ────
    if (previewSnake) {
      const { body, direction, color } = previewSnake
      const pulsePhase = (Date.now() % 1000) / 1000
      const pulseAlpha = 0.45 + 0.3 * Math.sin(pulsePhase * Math.PI * 2)

      // Body
      body.forEach((seg, i) => {
        if (viewport && !isTileVisible(seg, camX, camY, viewport.size)) return
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

      // Pulsing dashed border on head
      if (body.length > 0) {
        const head = body[0]
        if (!viewport || isTileVisible(head, camX, camY, viewport.size)) {
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

          // Direction arrow
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
  }, [gridSize, myPlayerId, viewport, previewSnake, tickMs, moving])

  // Resize canvas to fill container
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

  // Redraw when game state changes
  useEffect(() => {
    draw()
  }, [draw, snakes, food, bullets, localDirection])

  // Server snapshots are intentionally low-frequency; render their motion at display refresh rate.
  const hasInvincibleSnake = snakes.some((s) => s.invincibleUntil)
  const hasBoostingSnake = snakes.some((s) => s.boostActive)
  useEffect(() => {
    if (!moving && !previewSnake && !hasInvincibleSnake && !hasBoostingSnake) return
    let rafId
    const animate = () => { draw(); rafId = requestAnimationFrame(animate) }
    rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [moving, previewSnake, hasInvincibleSnake, hasBoostingSnake, draw])

  return (
    <canvas
      ref={canvasRef}
      className="block rounded-lg"
      style={{ imageRendering: 'auto' }}
    />
  )
}
