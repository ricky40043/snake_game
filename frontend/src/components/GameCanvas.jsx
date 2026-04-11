import { useRef, useEffect, useCallback } from 'react'

const GRID_COLOR = '#1a1a25'
const BG_COLOR = '#11111a'

export default function GameCanvas({ snakes, food, gridSize, myPlayerId }) {
  const canvasRef = useRef(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const size = canvas.width
    const tileSize = Math.floor(size / gridSize)

    // Background
    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, size, size)

    // Grid lines
    ctx.strokeStyle = GRID_COLOR
    ctx.lineWidth = 0.5
    for (let i = 0; i <= gridSize; i++) {
      ctx.beginPath()
      ctx.moveTo(i * tileSize, 0)
      ctx.lineTo(i * tileSize, gridSize * tileSize)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i * tileSize)
      ctx.lineTo(gridSize * tileSize, i * tileSize)
      ctx.stroke()
    }

    // Food
    for (const f of food) {
      const cx = f.x * tileSize + tileSize / 2
      const cy = f.y * tileSize + tileSize / 2
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
        const x = seg.x * tileSize + 1
        const y = seg.y * tileSize + 1
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
        const dx = head.x - neck.x
        const dy = head.y - neck.y

        const hx = head.x * tileSize
        const hy = head.y * tileSize
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
        ctx.globalAlpha = 0.6
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.beginPath()
        if (ctx.roundRect) {
          ctx.roundRect(head.x * tileSize + 1, head.y * tileSize + 1, tileSize - 2, tileSize - 2, 5)
        } else {
          ctx.rect(head.x * tileSize + 1, head.y * tileSize + 1, tileSize - 2, tileSize - 2)
        }
        ctx.stroke()
      }

      ctx.globalAlpha = 1
    }
  }, [snakes, food, gridSize, myPlayerId])

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

  return (
    <canvas
      ref={canvasRef}
      className="block rounded-lg"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
