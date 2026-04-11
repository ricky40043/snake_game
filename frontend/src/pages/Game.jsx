import { useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { socket } from '../socket'
import { getPlayerId, getPlayerName, savePlayerId, getHostId } from '../storage'
import { useGame } from '../App'
import GameCanvas from '../components/GameCanvas'
import GameOver from '../components/GameOver'

const DIR_MAP = {
  ArrowUp: 'UP', w: 'UP', W: 'UP',
  ArrowDown: 'DOWN', s: 'DOWN', S: 'DOWN',
  ArrowLeft: 'LEFT', a: 'LEFT', A: 'LEFT',
  ArrowRight: 'RIGHT', d: 'RIGHT', D: 'RIGHT',
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

    // Rejoin if page was refreshed
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

  // Go back to lobby on game_reset
  useEffect(() => {
    if (state.status === 'lobby') {
      navigate(`/lobby?room=${roomId}`)
    }
  }, [state.status, roomId, navigate])

  // Keyboard controls
  const handleKey = useCallback((e) => {
    const dir = DIR_MAP[e.key]
    if (!dir) return
    e.preventDefault()
    if (dir === lastDirRef.current) return
    lastDirRef.current = dir
    socket.emit('change_direction', { roomId, direction: dir })
  }, [roomId])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  // Mobile direction button
  function sendDir(dir) {
    if (dir === lastDirRef.current) return
    lastDirRef.current = dir
    socket.emit('change_direction', { roomId, direction: dir })
  }

  const mySnake = state.snakes.find((s) => s.playerId === state.myPlayerId)
  const alivePlayers = state.snakes.filter((s) => s.alive)
  const isAlive = mySnake?.alive ?? true

  return (
    <div className="flex flex-col h-dvh bg-[#0d1117] select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#30363d] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-green-400 font-bold text-sm">🐍 貪吃蛇</span>
          <span className="text-gray-600 text-xs font-mono">{roomId}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>存活: {alivePlayers.length}</span>
          {mySnake && (
            <span className="text-yellow-400 font-mono">{mySnake.score}分</span>
          )}
          {!isAlive && (
            <span className="text-red-400 font-semibold">已淘汰</span>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden gap-2 p-2">
        {/* Canvas container — square */}
        <div className="relative flex-1 flex items-center justify-center min-w-0">
          <div className="relative w-full h-full flex items-center justify-center">
            <GameCanvas
              snakes={state.snakes}
              food={state.food}
              gridSize={state.gridSize || 20}
              myPlayerId={state.myPlayerId}
            />
          </div>

          {/* Game over overlay */}
          {state.status === 'finished' && (
            <GameOver
              winnerId={state.winnerId}
              winnerName={state.winnerName}
              rankings={state.rankings}
              myPlayerId={state.myPlayerId}
              isHost={state.isHost}
              roomId={roomId}
            />
          )}
        </div>

        {/* Side scoreboard (desktop) */}
        <div className="hidden sm:flex flex-col gap-2 w-36 shrink-0">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
            <div className="px-3 py-2 text-xs text-gray-500 uppercase tracking-wider border-b border-[#21262d]">
              玩家
            </div>
            {state.snakes
              .slice()
              .sort((a, b) => b.score - a.score)
              .map((s) => (
                <div
                  key={s.playerId}
                  className={`flex items-center gap-2 px-3 py-2 border-b border-[#21262d] last:border-b-0 text-xs ${!s.alive ? 'opacity-40' : ''}`}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span className="flex-1 truncate">{s.name}{s.playerId === state.myPlayerId ? ' ★' : ''}</span>
                  <span className="text-yellow-500 font-mono">{s.score}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Mobile controls */}
      <div className="sm:hidden flex flex-col items-center gap-2 pb-4 pt-2 shrink-0">
        <button
          onPointerDown={() => sendDir('UP')}
          className="w-14 h-14 bg-[#21262d] active:bg-[#30363d] rounded-xl text-2xl flex items-center justify-center"
        >↑</button>
        <div className="flex gap-2">
          <button
            onPointerDown={() => sendDir('LEFT')}
            className="w-14 h-14 bg-[#21262d] active:bg-[#30363d] rounded-xl text-2xl flex items-center justify-center"
          >←</button>
          <button
            onPointerDown={() => sendDir('DOWN')}
            className="w-14 h-14 bg-[#21262d] active:bg-[#30363d] rounded-xl text-2xl flex items-center justify-center"
          >↓</button>
          <button
            onPointerDown={() => sendDir('RIGHT')}
            className="w-14 h-14 bg-[#21262d] active:bg-[#30363d] rounded-xl text-2xl flex items-center justify-center"
          >→</button>
        </div>
      </div>
    </div>
  )
}
