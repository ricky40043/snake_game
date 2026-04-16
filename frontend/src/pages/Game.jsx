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

function formatTime(sec) {
  if (sec === null || sec === undefined) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m === 0) return `${s}s`
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function Game() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const roomId = params.get('room')
  const { state } = useGame()
  const lastDirRef = useRef(null)
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

    // Direction keys
    const dir = DIR_MAP[e.key]
    if (!dir) return
    e.preventDefault()
    if (state.startCountdown) return  // wait for countdown
    if (dir === lastDirRef.current) return
    lastDirRef.current = dir
    socket.emit('change_direction', { roomId, direction: dir })
  }, [roomId, state.isHost, state.paused, state.status, state.mode, state.startCountdown])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  function sendDir(dir) {
    if (state.startCountdown) return
    if (dir === lastDirRef.current) return
    lastDirRef.current = dir
    socket.emit('change_direction', { roomId, direction: dir })
  }

  function sendShoot() {
    if (state.status === 'playing' && !state.paused && state.attackUnlocked) socket.emit('shoot', { roomId })
  }

  const mySnake = state.snakes.find((s) => s.playerId === state.myPlayerId)
  const isAlive = mySnake?.alive ?? true

  // Reset lastDir when this player respawns (false → true) to fix "key doesn't respond" bug
  const prevIsAliveRef = useRef(true)
  useEffect(() => {
    if (!prevIsAliveRef.current && isAlive) {
      lastDirRef.current = null
    }
    prevIsAliveRef.current = isAlive
  }, [isAlive])
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

  // ── Viewport / mobile camera ──────────────────────────────────────────────
  const VIEWPORT_SIZE = 20
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
  // When preview is active (dead, waiting to respawn), center camera on the
  // preview spawn position so the player can see where they'll appear
  const myHead = state.respawnPreview
    ? state.respawnPreview.body[0]
    : mySnake?.body?.[0]
  let viewport = null
  if (isMobile && followMe && myHead) {
    const camX = Math.max(0, Math.min((state.gridSize || 20) - VIEWPORT_SIZE, myHead.x - Math.floor(VIEWPORT_SIZE / 2)))
    const camY = Math.max(0, Math.min((state.gridSize || 20) - VIEWPORT_SIZE, myHead.y - Math.floor(VIEWPORT_SIZE / 2)))
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
      `}</style>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#30363d] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-green-400 font-bold text-sm">🐍</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isTimed ? 'bg-orange-900/40 text-orange-400' : 'bg-green-900/40 text-green-400'}`}>
            {isTimed ? '⏱ 計時' : '🏆 存活'}
          </span>
          {state.status === 'playing' && !state.paused && state.attackUnlocked && (
            <span className="text-xs text-gray-600 hidden sm:inline">F 鍵攻擊</span>
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
          {/* Attack button — aligned to bottom row */}
          <button onPointerDown={sendShoot}
            className={`w-14 h-14 rounded-xl text-2xl flex items-center justify-center border-2 transition ${
              state.attackUnlocked
                ? 'bg-red-700 active:bg-red-600 border-red-500'
                : 'bg-gray-700 border-gray-600 opacity-40'
            }`}>
            ⚡
          </button>
        </div>
      )}
    </div>
  )
}
