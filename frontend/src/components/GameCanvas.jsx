import { useRef, useEffect, useCallback } from 'react'

const GRID_COLOR = '#2a2a3f'
const BG_COLOR = '#11111a'

const DIR_DELTA_CANVAS = { UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0] }

export default function GameCanvas({ snakes, food, gridSize, myPlayerId, viewport, previewSnake }) {
  const canvasRef = useRef(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const size = canvas.width

    // When viewport is active, render only a viewport.size × viewport.size window
    const renderCols = viewport ? viewport.size : gridSize
    const renderRows = viewport ? viewport.size : gridSize
    const camX = viewport ? viewport.camX : 0
    const camY = viewport ? viewport.camY : 0
    const tileSize = Math.floor(size / renderCols)

    // Background
    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, size, size)

    // Grid lines
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

    // Food
    for (const f of food) {
      // Skip tiles outside viewport
      if (viewport && (f.x < camX || f.x >= camX + viewport.size || f.y < camY || f.y >= camY + viewport.size)) continue
      const rx = f.x - camX
      const ry = f.y - camY
      const cx = rx * tileSize + tileSize / 2
      const cy = ry * tileSize + tileSize / 2
      const r = tileSize * 0.38
      ctx.save()
      ctx.shadowColor = '#f87171'
      ctx.shadowBlur = 8
      ctx.fillStyle = '#f87171'
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // Dead snakes first (dimmed), then alive on top
    const sorted = [...snakes].sort((a, b) => (a.alive ? 1 : -1))

    for (const snake of sorted) {
      if (!snake.body || snake.body.length === 0) continue
      const isMe = snake.playerId === myPlayerId
      const baseColor = snake.color
      const alpha = snake.alive ? 1 : 0.2

      ctx.globalAlpha = alpha

      // Draw body segments
      snake.body.forEach((seg, i) => {
        // Skip segments outside viewport
        if (viewport && (seg.x < camX || seg.x >= camX + viewport.size || seg.y < camY || seg.y >= camY + viewport.size)) return

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

        if (dx === 1) { // right
          eye1 = { x: hx + eyeForward + mid * 0.3, y: hy + mid - eyeOffset }
          eye2 = { x: hx + eyeForward + mid * 0.3, y: hy + mid + eyeOffset }
        } else if (dx === -1) { // left
          eye1 = { x: hx + mid - eyeForward - mid * 0.3, y: hy + mid - eyeOffset }
          eye2 = { x: hx + mid - eyeForward - mid * 0.3, y: hy + mid + eyeOffset }
        } else if (dy === 1) { // down
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

      // "ME" indicator — outline on my snake
      if (isMe && snake.alive) {
        const head = snake.body[0]
        // Skip if head is outside viewport
        if (!viewport || (head.x >= camX && head.x < camX + viewport.size && head.y >= camY && head.y < camY + viewport.size)) {
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

    // ── Ghost snake: respawn preview (only visible to this player) ────
    if (previewSnake) {
      const { body, direction, color } = previewSnake
      const pulsePhase = (Date.now() % 1000) / 1000
      const pulseAlpha = 0.45 + 0.3 * Math.sin(pulsePhase * Math.PI * 2)

      // Body
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

      // Pulsing dashed border on head
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
  }, [snakes, food, gridSize, myPlayerId, viewport, previewSnake])

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
  }, [draw])

  // Continuous animation loop when preview is active (for smooth pulse)
  useEffect(() => {
    if (!previewSnake) return
    let rafId
    const animate = () => { draw(); rafId = requestAnimationFrame(animate) }
    rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [previewSnake, draw])

  return (
    <canvas
      ref={canvasRef}
      className="block rounded-lg"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
