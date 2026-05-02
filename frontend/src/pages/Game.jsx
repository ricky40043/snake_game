import { useEffect, useRef, useCallback, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { socket } from '../socket'
import { getPlayerId, getPlayerName, savePlayerId, getHostId } from '../storage'
import { useGame } from '../App'
import GameCanvas from '../components/GameCanvas'
import GameOver from '../components/GameOver'
import PausePanel from '../components/PausePanel'

const DIR_MAP = {
  ArrowUp: 'UP', w: 'UP', W: 'UP',
  ArrowDown: 'DOWN', s: 'DOWN', S: 'DOWN',
  ArrowLeft: 'LEFT', a: 'LEFT', A: 'LEFT',
  ArrowRight: 'RIGHT', d: 'RIGHT', D: 'RIGHT',
}

function TutorialDemoCanvas({ demo, color, isTimed, wallDeath }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let rafId

    function resize() {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.floor(rect.width * dpr))
      canvas.height = Math.max(1, Math.floor(rect.height * dpr))
    }

    function clear(w, h) {
      ctx.fillStyle = '#0d1117'
      ctx.fillRect(0, 0, w, h)
    }

    function grid(tile) {
      ctx.strokeStyle = '#263241'
      ctx.lineWidth = 1
      for (let i = 0; i <= 6; i++) {
        ctx.beginPath()
        ctx.moveTo(i * tile, 0)
        ctx.lineTo(i * tile, tile * 6)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(0, i * tile)
        ctx.lineTo(tile * 6, i * tile)
        ctx.stroke()
      }
    }

    function roundRect(x, y, w, h, r) {
      ctx.beginPath()
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, r)
      else ctx.rect(x, y, w, h)
    }

    function segment(tile, x, y, fill, alpha = 1, scale = 1, stroke = null) {
      const pad = tile * 0.12
      const size = (tile - pad * 2) * scale
      const px = x * tile + tile / 2 - size / 2
      const py = y * tile + tile / 2 - size / 2
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.fillStyle = fill
      roundRect(px, py, size, size, Math.max(4, tile * 0.14))
      ctx.fill()
      if (stroke) {
        ctx.strokeStyle = stroke
        ctx.lineWidth = 2
        ctx.stroke()
      }
      ctx.restore()
    }

    function snake(tile, body, fill = color, alpha = 1, headStroke = null) {
      body.forEach((p, i) => segment(tile, p.x, p.y, fill, alpha * (i === 0 ? 1 : 0.82), i === 0 ? 1 : 0.94, i === 0 ? headStroke : null))
    }

    function food(tile, x, y, pulse = 0) {
      const r = tile * (0.22 + pulse * 0.05)
      ctx.save()
      ctx.shadowColor = '#f87171'
      ctx.shadowBlur = 12
      ctx.fillStyle = '#f87171'
      ctx.beginPath()
      ctx.arc(x * tile + tile / 2, y * tile + tile / 2, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    function corpse(tile, points, alpha = 0.75) {
      points.forEach((p) => {
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.fillStyle = '#c8a06e'
        ctx.beginPath()
        ctx.arc(p.x * tile + tile / 2, p.y * tile + tile / 2, tile * 0.22, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })
    }

    function bullet(tile, x, y, dx = 1) {
      ctx.save()
      ctx.translate(x * tile + tile / 2, y * tile + tile / 2)
      if (dx < 0) ctx.rotate(Math.PI)
      ctx.shadowColor = '#ef4444'
      ctx.shadowBlur = 14
      ctx.fillStyle = '#ef4444'
      ctx.beginPath()
      ctx.ellipse(0, 0, tile * 0.34, tile * 0.13, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.beginPath()
      ctx.ellipse(0, 0, tile * 0.18, tile * 0.06, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    function label(tile, text, x, y, fill = '#facc15') {
      ctx.save()
      ctx.font = `700 ${Math.max(12, tile * 0.28)}px system-ui, sans-serif`
      ctx.fillStyle = fill
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, x * tile + tile / 2, y * tile + tile / 2)
      ctx.restore()
    }

    function drawFrame(now) {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.width / dpr
      const h = canvas.height / dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      clear(w, h)
      const tile = Math.min(w, h) / 6
      grid(tile)

      const loop = (now % 3600) / 3600
      const pulse = (Math.sin(now / 180) + 1) / 2
      const enemy = '#3b82f6'

      if (demo === 'color') {
        snake(tile, [{ x: 1, y: 2 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }], color, 1, '#ffffff')
        segment(tile, 1, 2, color, 0.55, 1.25 + pulse * 0.12, '#ffffff')
        label(tile, '你', 1, 1, '#ffffff')
      } else if (demo === 'food') {
        const x = Math.min(3, 1 + loop * 3.8)
        const ate = loop > 0.62
        snake(tile, ate
          ? [{ x: 4, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 2 }, { x: 1, y: 2 }]
          : [{ x, y: 2 }, { x: x - 1, y: 2 }, { x: x - 2, y: 2 }],
        color, 1, '#ffffff')
        if (!ate) food(tile, 4, 2, pulse)
        if (ate) label(tile, '+10', 4, 1, '#facc15')
      } else if (demo === 'move') {
        const x = 1 + loop * 3.5
        snake(tile, [{ x, y: 2 }, { x: x - 1, y: 2 }, { x: x - 2, y: 2 }], color, 1, '#ffffff')
        label(tile, '→', 4, 1, '#93c5fd')
      } else if (demo === 'attack') {
        const fired = loop > 0.18
        const hit = loop > 0.68
        const shooter = fired
          ? [{ x: 1, y: 2 }, { x: 0, y: 2 }, { x: -1, y: 2 }]
          : [{ x: 1, y: 2 }, { x: 0, y: 2 }, { x: -1, y: 2 }, { x: -2, y: 2 }]
        snake(tile, shooter, color, 1, '#ffffff')
        if (!hit) {
          snake(tile, [{ x: 4, y: 2 }, { x: 4, y: 3 }, { x: 4, y: 4 }, { x: 5, y: 4 }], enemy, 1, null)
          if (fired) bullet(tile, 1.4 + (loop - 0.18) / 0.5 * 2.3, 2)
          if (fired) label(tile, '自己 -1', 1, 0, '#facc15')
        } else {
          corpse(tile, [{ x: 4, y: 2 }, { x: 4, y: 3 }, { x: 4, y: 4 }, { x: 5, y: 4 }], 0.75)
          label(tile, '命中 -3', 4, 1, '#f87171')
          label(tile, '死亡', 4, 5, '#f87171')
        }
      } else if (demo === 'corpse') {
        if (loop < 0.35) {
          snake(tile, [{ x: 2, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }], color, 1, '#ffffff')
          label(tile, '死亡', 2, 1, '#f87171')
        } else {
          corpse(tile, [{ x: 2, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }], 0.35 + (1 - loop) * 0.55)
          const eaterX = Math.min(3.2, 0.5 + (loop - 0.35) * 3.5)
          snake(tile, [{ x: eaterX, y: 3 }, { x: eaterX - 1, y: 3 }, { x: eaterX - 2, y: 3 }], enemy, 1, '#ffffff')
          label(tile, '10s', 4, 1, '#c8a06e')
        }
      } else if (demo === 'respawn') {
        if (!isTimed) {
          corpse(tile, [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }], 0.7)
          snake(tile, [{ x: 2, y: 4 }, { x: 1, y: 4 }, { x: 0, y: 4 }], enemy, 1, '#ffffff')
          label(tile, '最後存活', 3, 1, '#facc15')
        } else if (loop < 0.34) {
          corpse(tile, [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }], 0.65)
          label(tile, '復活 10', 3, 4, '#facc15')
        } else if (loop < 0.66) {
          snake(tile, [{ x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }], color, 0.35 + pulse * 0.25, '#ffffff')
          label(tile, '出生預覽', 3, 1, '#93c5fd')
        } else {
          snake(tile, [{ x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }], color, 1, '#93c5fd')
          segment(tile, 3, 3, color, 0.25, 1.35 + pulse * 0.12, '#93c5fd')
          label(tile, '無敵 5s', 3, 1, '#93c5fd')
        }
      } else if (demo === 'wall') {
        ctx.fillStyle = '#7f1d1d'
        ctx.fillRect(tile * 5, 0, tile, tile * 6)
        const x = 2 + Math.min(loop / 0.55, 1) * 3
        if (wallDeath && loop > 0.58) {
          corpse(tile, [{ x: 5, y: 2 }, { x: 4, y: 2 }, { x: 3, y: 2 }], 0.75)
          label(tile, '撞牆死亡', 3, 4, '#f87171')
        } else {
          const bounced = !wallDeath && loop > 0.58
          snake(tile, bounced
            ? [{ x: 4, y: 3 }, { x: 4, y: 2 }, { x: 3, y: 2 }]
            : [{ x, y: 2 }, { x: x - 1, y: 2 }, { x: x - 2, y: 2 }],
          color, 1, '#ffffff')
          if (bounced) label(tile, '轉向', 4, 1, '#93c5fd')
        }
      } else if (demo === 'boost') {
        const x = 0.8 + loop * 4
        const body = loop > 0.5
          ? [{ x, y: 3 }, { x: x - 1, y: 3 }, { x: x - 2, y: 3 }]
          : [{ x, y: 3 }, { x: x - 1, y: 3 }, { x: x - 2, y: 3 }, { x: x - 3, y: 3 }]
        snake(tile, body, color, 1, '#facc15')
        segment(tile, x, 3, color, 0.35, 1.3 + pulse * 0.1, '#facc15')
        label(tile, loop > 0.5 ? '-1' : '加速', 3, 1, '#facc15')
      }

      rafId = requestAnimationFrame(drawFrame)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    rafId = requestAnimationFrame(drawFrame)
    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [demo, color, isTimed, wallDeath])

  return (
    <canvas
      ref={canvasRef}
      className="block w-full h-full rounded-xl bg-[#0d1117]"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}

function TutorialOverlay({ state, isTimed, isHost, onPrev, onNext, onFinish }) {
  const attackOn = state.settings?.attackEnabled !== false
  const boostOn = state.settings?.boostEnabled === true
  const wallDeath = state.settings?.wallDeath !== false
  const attackWindow = state.settings?.attackUnlockRemaining || 0
  const myColor = state.snakes[0]?.color || '#22c55e'
  const attackText = !attackOn
    ? '本局沒有攻擊射擊'
    : isTimed && attackWindow > 0 && attackWindow < (state.duration || 180)
      ? `只在最後 ${formatTime(attackWindow)} 可以攻擊`
      : '全時間可以攻擊'

  const steps = [
    {
      title: '辨認自己的顏色',
      text: '你的顏色會出現在上方小蛇、地圖蛇頭外框，以及玩家列表圓點。',
      stat: '顏色 = 身分',
      demo: 'color',
    },
    {
      title: '長度就是血量',
      text: '蛇每一格都是血量。吃紅色食物會加分並增加長度，分數顯示在右上角。',
      stat: '吃食物 +10分',
      demo: 'food',
    },
    {
      title: '移動控制',
      text: '方向鍵或 WASD 控制移動，手機用下方方向鍵。教學結束倒數後才會開始移動。',
      stat: '鍵盤 / 手機皆可',
      demo: 'move',
    },
    {
      title: '攻擊規則',
      text: attackOn
        ? `按 F 或手機 ⚡ 發射子彈。攻擊會先扣自己 1 格尾巴，打中別人扣 3 格血；${attackText}。`
        : attackText,
      stat: attackOn ? '自己 -1 / 命中 -3' : '攻擊關閉',
      demo: 'attack',
    },
    {
      title: '死亡與屍體',
      text: '死亡後身體會變成屍體食物，屍體會存在 10 秒，其他玩家可以吃到。',
      stat: '屍體 10 秒',
      demo: 'corpse',
    },
    {
      title: isTimed ? '復活與無敵' : '存活模式勝負',
      text: isTimed
        ? '計時模式死亡後 10 秒復活，復活前 3 秒會看到出生預覽，復活後有 5 秒無敵。'
        : '存活模式死亡後不復活，最後存活的玩家獲勝。',
      stat: isTimed ? '10 秒復活 / 5 秒無敵' : '最後存活獲勝',
      demo: 'respawn',
    },
    {
      title: '碰牆規則',
      text: wallDeath ? '本局碰牆會死亡。' : '本局碰牆不會直接死亡，會隨機轉向。',
      stat: wallDeath ? '碰牆死亡' : '碰牆轉向',
      demo: 'wall',
    },
    {
      title: '加速模式',
      text: boostOn ? '加速模式已啟用：按 E 或手機 🚀 切換，加速時移動更快，每 2 秒扣 1 格尾巴。' : '本局沒有加速模式。',
      stat: boostOn ? '每 2 秒 -1 格' : '加速關閉',
      demo: 'boost',
    },
  ]
  const step = Math.max(0, Math.min(steps.length - 1, state.tutorialStep || 0))
  const current = steps[step]
  const isLast = step === steps.length - 1

  return (
    <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="w-full max-w-3xl bg-[#161b22] border border-[#30363d] rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-[#30363d] flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-bold text-white">規則教學試玩</div>
            <div className="text-xs text-gray-500 mt-1">{isTimed ? '計時模式' : '存活模式'} · {attackText}</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {state.snakes.slice(0, 4).map((s) => (
              <span key={s.playerId} className="w-3 h-3 rounded-full" style={{ background: s.color }} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.1fr] gap-4 p-5">
          <div className="aspect-square bg-[#0d1117] border border-[#30363d] rounded-xl overflow-hidden">
            <TutorialDemoCanvas
              key={step}
              demo={current.demo}
              color={myColor}
              isTimed={isTimed}
              wallDeath={wallDeath}
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3">
                <div className="text-gray-500">進度</div>
                <div className="text-green-400 font-mono text-lg font-bold">{step + 1}/{steps.length}</div>
              </div>
              <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3">
                <div className="text-gray-500">重點</div>
                <div className="text-yellow-400 font-mono text-lg font-bold truncate">{current.stat}</div>
              </div>
            </div>

            <div key={step} className="tutorial-card bg-[#0d1117] border border-[#30363d] rounded-xl p-4 min-h-[150px]">
              <div className="text-xl font-bold text-white mb-3">{current.title}</div>
              <div className="text-sm text-gray-300 leading-relaxed">{current.text}</div>
            </div>

            <div className="flex gap-1.5">
              {steps.map((s, i) => (
                <div
                  key={s.title}
                  className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-green-400' : 'bg-[#30363d]'}`}
                />
              ))}
            </div>

            <div className="mt-auto flex items-center justify-between gap-3 pt-2">
              <div className="text-xs text-gray-500">
                {isHost ? '主持人控制下一步，所有玩家同步看到同一頁。' : '等待房主切換下一個規則。'}
              </div>
              {isHost && (
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={onPrev}
                    disabled={step === 0}
                    className="bg-[#21262d] hover:bg-[#30363d] disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 font-semibold px-4 py-2.5 rounded-xl transition"
                  >
                    上一步
                  </button>
                  <button
                    onClick={isLast ? onFinish : onNext}
                    className="bg-green-500 hover:bg-green-400 text-black font-bold px-5 py-2.5 rounded-xl transition"
                  >
                    {isLast ? '開始倒數' : '下一步'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatTime(sec) {
  if (sec === null || sec === undefined) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m === 0) return `${s}s`
  return `${m}:${String(s).padStart(2, '0')}`
}

function getDeathMessage(cause) {
  if (!cause) return null
  switch (cause.type) {
    case 'wall':            return { emoji: '💥', pre: null,  name: null,             post: '你撞牆了' }
    case 'self':            return { emoji: '🐍', pre: null,  name: null,             post: '你咬到自己了' }
    case 'head_collision':  return { emoji: '💥', pre: '你和', name: cause.killerName, post: '正面相撞' }
    case 'body':            return { emoji: '💀', pre: '你撞上了', name: cause.killerName, post: '的身體' }
    case 'bullet':          return { emoji: '🔫', pre: '你被', name: cause.killerName, post: '射殺' }
    default:                return { emoji: '💀', pre: null,  name: null,             post: '你死了' }
  }
}

export default function Game() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const roomId = params.get('room')
  const { state } = useGame()
  const [followMe, setFollowMe] = useState(true)

  useEffect(() => {
    if (!roomId) { navigate('/'); return }
    if (!socket.connected) socket.connect()
    if (!state.myPlayerId) {
      const hostId = getHostId()
      const existingPid = getPlayerId(roomId)
      const name = getPlayerName() || 'Player'
      if (existingPid === hostId) {
        socket.emit('rejoin_host', { roomId, hostId })
      } else {
        socket.emit('join_room', { roomId, playerId: existingPid, name })
        socket.once('room_joined', ({ playerId }) => savePlayerId(roomId, playerId))
      }
    }
  }, [roomId]) // eslint-disable-line

  useEffect(() => {
    if (state.status === 'lobby') navigate(`/lobby?room=${roomId}`)
  }, [state.status, roomId, navigate])

  // Room not found or game finished → go home
  useEffect(() => {
    const code = state.error?.code
    if (code === 'ROOM_NOT_FOUND' || code === 'GAME_FINISHED') {
      navigate('/')
    }
  }, [state.error, navigate])

  // ── Keyboard: direction + space pause ────────────────────────────────────
  const handleKey = useCallback((e) => {
    // Ignore if typing in an input
    const tag = document.activeElement?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return

    // Space: host pause/resume
    if (e.code === 'Space') {
      e.preventDefault()
      if (!state.isHost || state.status !== 'playing') return
      if (state.paused) {
        socket.emit('resume_game', { roomId })
      } else {
        socket.emit('pause_game', { roomId })
      }
      return
    }

    // F key: shoot
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault()
      if (state.status === 'playing' && !state.paused && state.attackUnlocked) socket.emit('shoot', { roomId })
      return
    }

    // E key: toggle boost
    if (e.key === 'e' || e.key === 'E') {
      e.preventDefault()
      if (state.status === 'playing' && !state.paused && state.boostEnabled) socket.emit('toggle_boost', { roomId })
      return
    }

    // Direction keys
    const dir = DIR_MAP[e.key]
    if (!dir) return
    e.preventDefault()
    if (state.startCountdown || state.tutorialActive) return  // wait for countdown/tutorial
    socket.emit('change_direction', { roomId, direction: dir })
  }, [roomId, state.isHost, state.paused, state.status, state.mode, state.startCountdown, state.tutorialActive, state.boostEnabled, state.attackUnlocked])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  function sendDir(dir) {
    if (state.startCountdown || state.tutorialActive) return
    socket.emit('change_direction', { roomId, direction: dir })
  }

  function sendShoot() {
    if (state.status === 'playing' && !state.paused && state.attackUnlocked) socket.emit('shoot', { roomId })
  }

  function sendBoost() {
    if (state.status === 'playing' && !state.paused && state.boostEnabled) socket.emit('toggle_boost', { roomId })
  }

  const mySnake = state.snakes.find((s) => s.playerId === state.myPlayerId)
  const isAlive = mySnake?.alive ?? true

  // ── Death / revenge kill toasts ──────────────────────────────────────────
  const [deathMsg, setDeathMsg] = useState(null)
  const [revengeMsg, setRevengeMsg] = useState(null)
  const deathTimerRef = useRef(null)
  const revengeTimerRef = useRef(null)

  useEffect(() => {
    if (!state.deathCause) return
    const msg = getDeathMessage(state.deathCause)
    if (!msg) return
    clearTimeout(deathTimerRef.current)
    setDeathMsg(msg)
    deathTimerRef.current = setTimeout(() => setDeathMsg(null), 3500)
  }, [state.deathCause])

  useEffect(() => {
    if (!state.revengeKill) return
    clearTimeout(revengeTimerRef.current)
    setRevengeMsg(state.revengeKill.victimName)
    revengeTimerRef.current = setTimeout(() => setRevengeMsg(null), 3500)
  }, [state.revengeKill])

  const isTimed = state.mode === 'timed'
  const isRespawning = isTimed && !isAlive && state.respawning?.[state.myPlayerId] !== undefined
  const respawnCountdown = isRespawning ? (state.respawning[state.myPlayerId] ?? 0) : 0
  const alivePlayers = state.snakes.filter((s) => s.alive)
  const timerColor = (state.timeLeft ?? 999) <= 10 ? 'text-red-400 animate-pulse' : 'text-orange-400'

  // Current game settings for PausePanel
  const gameTickMs = state.settings?.tickMs || 130

  const showBigCountdown = isTimed && state.status === 'playing' && !state.paused &&
    (state.timeLeft ?? 999) <= 10 && (state.timeLeft ?? 0) > 0

  // Invincibility countdown for mySnake
  const myInvincibleUntil = mySnake?.invincibleUntil
  const invincibleSecsLeft = myInvincibleUntil && myInvincibleUntil > Date.now()
    ? Math.ceil((myInvincibleUntil - Date.now()) / 1000)
    : 0

  function finishTutorial() {
    socket.emit('finish_tutorial', { roomId })
  }
  function tutorialNext() {
    socket.emit('tutorial_next', { roomId })
  }
  function tutorialPrev() {
    socket.emit('tutorial_prev', { roomId })
  }

  // ── Viewport / mobile camera ──────────────────────────────────────────────
  const VIEWPORT_SIZE = 20
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
  // When preview is active (dead, waiting to respawn), center camera on the
  // preview spawn position so the player can see where they'll appear
  const myHead = state.respawnPreview
    ? state.respawnPreview.body[0]
    : mySnake?.body?.[0]
  let viewport = null
  const currentGridSize = state.gridSize || 20
  // Only apply viewport when grid is larger than the viewport window; otherwise show full map
  if (isMobile && followMe && myHead && currentGridSize > VIEWPORT_SIZE) {
    const camX = Math.max(0, Math.min(currentGridSize - VIEWPORT_SIZE, myHead.x - Math.floor(VIEWPORT_SIZE / 2)))
    const camY = Math.max(0, Math.min(currentGridSize - VIEWPORT_SIZE, myHead.y - Math.floor(VIEWPORT_SIZE / 2)))
    viewport = { size: VIEWPORT_SIZE, camX, camY }
  }

  // ── Top-3 leaderboard data ────────────────────────────────────────────────
  const MEDALS = ['🥇', '🥈', '🥉']
  const displayLen = (s) => s.alive ? s.body.length : (s.lengthAtDeath || 0)
  const top3 = state.snakes.length > 0 && state.status === 'playing'
    ? state.snakes.slice().sort((a, b) => displayLen(b) - displayLen(a)).slice(0, 3)
    : null

  return (
    <div className="flex flex-col h-dvh bg-[#0d1117] select-none">
      <style>{`
        @keyframes toast-in {
          0%   { opacity: 0; transform: translateX(-50%) translateY(-10px) scale(0.9); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0)      scale(1); }
        }
        .toast-enter {
          animation: toast-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes countdown-pop {
          0%   { transform: scale(2.2); opacity: 1; filter: brightness(2) blur(0px); }
          40%  { transform: scale(1);   opacity: 0.95; filter: brightness(1.2) blur(0px); }
          100% { transform: scale(0.7); opacity: 0; filter: brightness(1) blur(2px); }
        }
        @keyframes countdown-ring {
          0%   { transform: scale(2.5); opacity: 0.6; }
          100% { transform: scale(4);   opacity: 0; }
        }
        .countdown-num {
          animation: countdown-pop 0.85s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .countdown-ring {
          animation: countdown-ring 0.85s ease-out forwards;
        }
        @keyframes tutorial-card-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes tutorial-pulse {
          0%, 100% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(255,255,255,0.7); }
          50% { transform: scale(1.08); box-shadow: 0 0 0 5px rgba(255,255,255,0); }
        }
        @keyframes tutorial-move {
          0% { transform: translateX(-130%); opacity: 0; }
          30%, 70% { transform: translateX(0); opacity: 1; }
          100% { transform: translateX(130%); opacity: 0; }
        }
        @keyframes tutorial-food {
          0%, 100% { transform: scale(0.75); }
          50% { transform: scale(1.15); }
        }
        @keyframes tutorial-bullet {
          0% { transform: translate(-180%, -50%); opacity: 0; }
          20%, 80% { opacity: 1; }
          100% { transform: translate(180%, -50%); opacity: 0; }
        }
        @keyframes tutorial-fade {
          0%, 30% { opacity: 1; transform: scale(1); }
          100% { opacity: 0.25; transform: scale(0.65); }
        }
        @keyframes tutorial-shield {
          0%, 100% { box-shadow: 0 0 0 0 rgba(147,197,253,0.8); }
          50% { box-shadow: 0 0 18px 4px rgba(147,197,253,0.65); }
        }
        @keyframes tutorial-wall-hit {
          0% { transform: translateX(-160%); }
          55% { transform: translateX(0); filter: brightness(1); }
          65%, 85% { transform: translateX(0) scale(1.1); filter: brightness(1.8); }
          100% { transform: translateX(-40%) rotate(-18deg); opacity: 0.45; }
        }
        @keyframes tutorial-boost {
          0%, 100% { transform: scale(0.9); box-shadow: 0 0 0 rgba(251,191,36,0); }
          50% { transform: scale(1.08); box-shadow: 0 0 14px rgba(251,191,36,0.9); }
        }
        .tutorial-card { animation: tutorial-card-in 0.22s ease-out; }
        .tutorial-pulse { animation: tutorial-pulse 1.2s ease-in-out infinite; }
        .tutorial-move { animation: tutorial-move 1.8s ease-in-out infinite; }
        .tutorial-food { animation: tutorial-food 1.1s ease-in-out infinite; }
        .tutorial-bullet { animation: tutorial-bullet 1.25s linear infinite; }
        .tutorial-fade { animation: tutorial-fade 2s ease-in-out infinite alternate; }
        .tutorial-shield { animation: tutorial-shield 1s ease-in-out infinite; }
        .tutorial-wall-hit { animation: tutorial-wall-hit 1.8s ease-in-out infinite; }
        .tutorial-boost { animation: tutorial-boost 0.7s ease-in-out infinite; }
      `}</style>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#30363d] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-green-400 font-bold text-sm">🐍</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isTimed ? 'bg-orange-900/40 text-orange-400' : 'bg-green-900/40 text-green-400'}`}>
            {isTimed ? '⏱ 計時' : '🏆 存活'}
          </span>
          {state.status === 'playing' && !state.paused && state.attackUnlocked && (
            <span className="text-xs text-gray-600 hidden sm:inline">F 攻擊</span>
          )}
          {state.status === 'playing' && !state.paused && state.boostEnabled && (
            <span className="text-xs text-gray-600 hidden sm:inline">E 加速</span>
          )}
          {state.status === 'playing' && !state.attackUnlocked && state.settings?.attackEnabled !== false && (
            <span className="text-xs text-red-400/70 bg-red-900/20 px-2 py-0.5 rounded-full hidden sm:inline animate-pulse">
              ⚡ 攻擊鎖定中
            </span>
          )}
          {state.isHost && state.status === 'playing' && (
            <span className="text-xs text-gray-600 hidden sm:inline">
              {state.paused ? '（已暫停）' : '空白鍵暫停'}
            </span>
          )}
        </div>

        {/* Centre: mini snake showing my color */}
        {mySnake && (() => {
          const c = mySnake.color
          const s = 7   // segment px
          const g = 2   // gap px
          const u = s + g
          // S-shape: 3 right on top, turn down, 3 left on bottom
          const segs = [
            { x: u*2, y: 0 }, { x: u, y: 0 }, { x: 0, y: 0 },   // head→left
            { x: 0, y: u },                                         // turn
            { x: 0, y: u*2 }, { x: u, y: u*2 }, { x: u*2, y: u*2 }, // tail→right
          ]
          return (
            <svg width={u*3} height={u*3-g} style={{ display: 'block', flexShrink: 0 }}>
              {segs.map((p, i) => (
                <rect
                  key={i} x={p.x} y={p.y} width={s} height={s} rx={2}
                  fill={c}
                  opacity={i === 0 ? 1 : Math.max(0.25, 1 - i * 0.12)}
                />
              ))}
              {/* eye on head */}
              <circle cx={u*2 + s - 2} cy={3} r={1.2} fill="#000" opacity={0.7} />
            </svg>
          )
        })()}

        <div className="flex items-center gap-3 text-xs">
          {isTimed && state.timeLeft !== null && (
            <span className={`font-mono font-bold text-base ${timerColor}`}>
              {formatTime(state.timeLeft)}
            </span>
          )}
          <span className="text-gray-500">存活 {alivePlayers.length}</span>
          {mySnake && (
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded-full shrink-0"
                style={{ background: mySnake.color, boxShadow: `0 0 6px 1px ${mySnake.color}` }}
              />
              <span className="text-yellow-400 font-mono">{mySnake.score}分</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Top-3 leaderboard strip (mobile only, between top bar and game area) */}
      {top3 && (
        <div className="sm:hidden flex items-center shrink-0 bg-[#161b22]/90 border-b border-[#30363d] px-2 h-7 gap-0 overflow-hidden">
          {top3.map((s, i) => (
            <div
              key={s.playerId}
              className={`flex items-center gap-1 px-2 h-full text-xs font-medium min-w-0 ${s.playerId === state.myPlayerId ? 'bg-white/10 rounded' : ''}`}
            >
              <span className="text-sm leading-none shrink-0">{MEDALS[i]}</span>
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0"
                style={{ background: s.color }}
              />
              <span className="text-white truncate max-w-[56px]">{s.name}</span>
              <span className="text-gray-400 font-mono ml-1 shrink-0">{displayLen(s)}</span>
            </div>
          )).reduce((acc, el, i) => {
            if (i === 0) return [el]
            return [...acc, <span key={`sep-${i}`} className="text-gray-600 shrink-0 px-0.5">|</span>, el]
          }, [])}
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden gap-2 p-2">
        {/* Canvas container */}
        <div className="relative flex-1 flex items-center justify-center min-w-0">
          <div className="relative w-full" style={{ aspectRatio: '1 / 1', maxHeight: '100%' }}>
            <GameCanvas
              snakes={state.snakes}
              food={state.food}
              bullets={state.bullets}
              gridSize={state.gridSize || 20}
              myPlayerId={state.myPlayerId}
              viewport={viewport}
              previewSnake={state.respawnPreview}
            />

            {/* ── Mobile viewport toggle button ─────────────────── */}
            {isMobile && state.status === 'playing' && (
              <button
                onPointerDown={() => setFollowMe(f => !f)}
                className="absolute bottom-2 right-2 z-10 bg-black/60 text-white text-xs px-2 py-1 rounded-lg border border-white/20"
              >
                {followMe ? '全圖' : '跟隨'}
              </button>
            )}

            {/* ── Big countdown (last 10 s) ──────────────────────── */}
            {showBigCountdown && (
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                <div key={state.timeLeft} className="relative flex items-center justify-center">
                  {/* ripple ring */}
                  <div
                    className="countdown-ring absolute rounded-full border-4 border-red-500"
                    style={{ width: '1em', height: '1em', fontSize: 'clamp(80px, 22vmin, 180px)' }}
                  />
                  {/* number */}
                  <span
                    className="countdown-num font-black tabular-nums leading-none"
                    style={{
                      fontSize: 'clamp(80px, 22vmin, 180px)',
                      color: state.timeLeft <= 3 ? '#ff2222' : '#ff6600',
                      textShadow: state.timeLeft <= 3
                        ? '0 0 40px rgba(255,30,30,0.9), 0 0 80px rgba(255,0,0,0.6), 0 0 2px #fff'
                        : '0 0 40px rgba(255,120,0,0.9), 0 0 80px rgba(255,80,0,0.5), 0 0 2px #fff',
                    }}
                  >
                    {state.timeLeft}
                  </span>
                </div>
              </div>
            )}

            {/* ── Pause overlays ─────────────────────────────────── */}
            {state.paused && state.isHost && (
              <PausePanel
                roomId={roomId}
                gameGridSize={state.gridSize || 20}
                gameTickMs={gameTickMs}
              />
            )}
            {state.paused && !state.isHost && (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-20">
                <div className="text-center">
                  <div className="text-5xl mb-3">⏸</div>
                  <div className="text-2xl font-bold text-white">遊戲暫停中</div>
                  <div className="text-gray-400 mt-2 text-sm">等待房主繼續…</div>
                </div>
              </div>
            )}

            {/* ── Game start countdown overlay (3-2-1) ──────────── */}
            {state.startCountdown !== null && state.startCountdown > 0 && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20 pointer-events-none">
                <div className="text-center">
                  <div className="text-white/70 text-lg mb-4 font-medium tracking-widest">遊戲即將開始</div>
                  <div key={state.startCountdown} className="relative flex items-center justify-center">
                    <div
                      className="countdown-ring absolute rounded-full border-4 border-green-400"
                      style={{ width: '1em', height: '1em', fontSize: 'clamp(80px, 22vmin, 180px)' }}
                    />
                    <span
                      className="countdown-num font-black tabular-nums leading-none"
                      style={{
                        fontSize: 'clamp(80px, 22vmin, 180px)',
                        color: '#4ade80',
                        textShadow: '0 0 40px rgba(74,222,128,0.9), 0 0 80px rgba(74,222,128,0.5), 0 0 2px #fff',
                      }}
                    >
                      {state.startCountdown}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Invincibility timer (my snake, after respawn) ─────── */}
            {invincibleSecsLeft > 0 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                <div className="flex items-center gap-2 bg-blue-950/85 text-white text-sm px-4 py-2 rounded-full font-semibold border border-blue-400/60 animate-pulse">
                  <span>🛡️</span>
                  <span>無敵保護</span>
                  <span className="text-blue-300 font-mono font-bold text-base">{invincibleSecsLeft}s</span>
                </div>
              </div>
            )}

            {/* ── Death cause toast ──────────────────────────────── */}
            {deathMsg && (
              <div key={state.deathCause?.type + (state.deathCause?.killerName || '')} className="toast-enter absolute top-3 left-1/2 z-30 pointer-events-none" style={{ transform: 'translateX(-50%)' }}>
                <div className="flex items-center gap-2 bg-black/90 text-white text-sm px-4 py-2 rounded-xl border border-red-500/50 shadow-xl whitespace-nowrap">
                  <span className="text-lg leading-none">{deathMsg.emoji}</span>
                  <span className="font-semibold">
                    {deathMsg.pre && <span>{deathMsg.pre} </span>}
                    {deathMsg.name && <span className="text-yellow-300 font-bold">{deathMsg.name} </span>}
                    <span>{deathMsg.post}</span>
                  </span>
                </div>
              </div>
            )}

            {/* ── Revenge kill toast ─────────────────────────────── */}
            {revengeMsg && (
              <div key={revengeMsg} className="toast-enter absolute top-3 left-1/2 z-30 pointer-events-none" style={{ transform: 'translateX(-50%)' }}>
                <div className="flex items-center gap-2 bg-black/90 text-sm px-4 py-2 rounded-xl border border-yellow-400/70 shadow-xl whitespace-nowrap">
                  <span className="text-lg leading-none">⚔️</span>
                  <span className="font-semibold text-yellow-300">
                    反殺成功！幹掉了 <span className="text-red-400 font-bold">{revengeMsg}</span>
                  </span>
                </div>
              </div>
            )}

            {/* ── Respawn overlay (timed mode) ───────────────────── */}
            {!state.paused && isRespawning && !state.respawnPreview && (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-10">
                <div className="text-center">
                  <div className="text-5xl mb-3">💀</div>
                  <div className="text-xl font-bold text-white">等待復活</div>
                  <div className={`text-6xl font-mono font-bold mt-2 ${respawnCountdown <= 3 ? 'text-green-400' : 'text-orange-400'}`}>
                    {respawnCountdown}
                  </div>
                  <div className="text-gray-400 text-sm mt-1">秒後復活</div>
                </div>
              </div>
            )}
            {/* ── Respawn preview hint (last 3s — canvas visible) ── */}
            {!state.paused && isRespawning && state.respawnPreview && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                <div className={`flex items-center gap-2 bg-black/60 text-white text-sm px-4 py-2 rounded-full font-semibold border border-white/20 ${respawnCountdown <= 1 ? 'animate-pulse' : ''}`}>
                  <span className="text-green-400 font-mono font-bold text-base">{respawnCountdown}s</span>
                  <span>後復活 — 箭頭為出生方向</span>
                </div>
              </div>
            )}

            {/* ── Game over ─────────────────────────────────────── */}
            {state.status === 'finished' && (
              <GameOver
                winnerId={state.winnerId}
                winnerName={state.winnerName}
                rankings={state.rankings}
                myPlayerId={state.myPlayerId}
                isHost={state.isHost}
                roomId={roomId}
                mode={state.mode}
              />
            )}

            {state.tutorialActive && (
              <TutorialOverlay
                state={state}
                isTimed={isTimed}
                isHost={state.isHost}
                onPrev={tutorialPrev}
                onNext={tutorialNext}
                onFinish={finishTutorial}
              />
            )}
          </div>
        </div>

        {/* Side scoreboard */}
        <div className="hidden sm:flex flex-col gap-2 w-36 shrink-0">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
            <div className="px-3 py-2 text-xs text-gray-500 uppercase tracking-wider border-b border-[#21262d]">
              {isTimed ? '長度排行' : '玩家'}
            </div>
            {state.snakes
              .slice()
              .sort((a, b) => (isTimed ? b.body.length - a.body.length : b.score - a.score))
              .map((s) => {
                const respawnSec = state.respawning?.[s.playerId]
                return (
                  <div
                    key={s.playerId}
                    className={`flex items-center gap-2 px-3 py-2 border-b border-[#21262d] last:border-b-0 text-xs ${!s.alive ? 'opacity-40' : ''}`}
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="flex-1 truncate">{s.name}{s.playerId === state.myPlayerId ? ' ★' : ''}</span>
                    <span className={`font-mono ${isTimed ? 'text-green-400' : 'text-yellow-500'}`}>
                      {isTimed
                        ? (respawnSec !== undefined ? `⟳${respawnSec}s` : displayLen(s))
                        : s.score}
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      </div>

      {/* Mobile controls — hidden when game is finished so GameOver overlay isn't obscured */}
      {state.status !== 'finished' && (
        <div className="sm:hidden flex items-end justify-center gap-4 pb-4 pt-2 shrink-0">
          {/* D-pad: keep cross symmetric */}
          <div className="flex flex-col items-center gap-2">
            <button onPointerDown={() => sendDir('UP')}
              className="w-14 h-14 bg-[#21262d] active:bg-[#30363d] rounded-xl text-2xl flex items-center justify-center">↑</button>
            <div className="flex gap-2">
              <button onPointerDown={() => sendDir('LEFT')}
                className="w-14 h-14 bg-[#21262d] active:bg-[#30363d] rounded-xl text-2xl flex items-center justify-center">←</button>
              <button onPointerDown={() => sendDir('DOWN')}
                className="w-14 h-14 bg-[#21262d] active:bg-[#30363d] rounded-xl text-2xl flex items-center justify-center">↓</button>
              <button onPointerDown={() => sendDir('RIGHT')}
                className="w-14 h-14 bg-[#21262d] active:bg-[#30363d] rounded-xl text-2xl flex items-center justify-center">→</button>
            </div>
          </div>
          {/* Boost + Attack column — aligned to bottom of d-pad */}
          <div className="flex flex-col gap-2 items-center">
            {state.boostEnabled && (
              <button onPointerDown={sendBoost}
                className={`w-14 h-14 rounded-xl text-2xl flex items-center justify-center border-2 transition ${
                  mySnake?.boostActive
                    ? 'bg-yellow-500 active:bg-yellow-400 border-yellow-300'
                    : 'bg-[#21262d] active:bg-[#30363d] border-gray-600'
                }`}>
                🚀
              </button>
            )}
            <button onPointerDown={sendShoot}
              className={`w-14 h-14 rounded-xl text-2xl flex items-center justify-center border-2 transition ${
                state.attackUnlocked
                  ? 'bg-red-700 active:bg-red-600 border-red-500'
                  : 'bg-gray-700 border-gray-600 opacity-40'
              }`}>
              ⚡
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
