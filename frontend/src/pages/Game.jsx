import { useEffect, useRef, useCallback } from 'react'
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

    // Direction keys
    const dir = DIR_MAP[e.key]
    if (!dir) return
    e.preventDefault()
    if (dir === lastDirRef.current) return
    lastDirRef.current = dir
    socket.emit('change_direction', { roomId, direction: dir })
  }, [roomId, state.isHost, state.paused, state.status])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  function sendDir(dir) {
    if (dir === lastDirRef.current) return
    lastDirRef.current = dir
    socket.emit('change_direction', { roomId, direction: dir })
  }

  const mySnake = state.snakes.find((s) => s.playerId === state.myPlayerId)
  const isAlive = mySnake?.alive ?? true
  const isTimed = state.mode === 'timed'
  const isRespawning = isTimed && !isAlive && state.respawning?.[state.myPlayerId] !== undefined
  const respawnCountdown = isRespawning ? (state.respawning[state.myPlayerId] ?? 0) : 0
  const alivePlayers = state.snakes.filter((s) => s.alive)
  const timerColor = (state.timeLeft ?? 999) <= 10 ? 'text-red-400 animate-pulse' : 'text-orange-400'

  // Current game settings for PausePanel
  const gameTickMs = state.settings?.tickMs || 130

  return (
    <div className="flex flex-col h-dvh bg-[#0d1117] select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#30363d] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-green-400 font-bold text-sm">🐍</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isTimed ? 'bg-orange-900/40 text-orange-400' : 'bg-green-900/40 text-green-400'}`}>
            {isTimed ? '⏱ 計時' : '🏆 存活'}
          </span>
          {state.isHost && state.status === 'playing' && (
            <span className="text-xs text-gray-600 hidden sm:inline">
              {state.paused ? '（已暫停）' : '空白鍵暫停'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          {isTimed && state.timeLeft !== null && (
            <span className={`font-mono font-bold text-base ${timerColor}`}>
              {formatTime(state.timeLeft)}
            </span>
          )}
          <span className="text-gray-500">存活 {alivePlayers.length}</span>
          {mySnake && <span className="text-yellow-400 font-mono">{mySnake.score}分</span>}
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden gap-2 p-2">
        {/* Canvas container */}
        <div className="relative flex-1 flex items-center justify-center min-w-0">
          <div className="relative w-full h-full flex items-center justify-center">
            <GameCanvas
              snakes={state.snakes}
              food={state.food}
              gridSize={state.gridSize || 20}
              myPlayerId={state.myPlayerId}
            />
          </div>

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

          {/* ── Respawn overlay (timed mode) ───────────────────── */}
          {!state.paused && isRespawning && (
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
                        ? (respawnSec !== undefined ? `⟳${respawnSec}s` : s.body.length)
                        : s.score}
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      </div>

      {/* Mobile controls */}
      <div className="sm:hidden flex flex-col items-center gap-2 pb-4 pt-2 shrink-0">
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
    </div>
  )
}
