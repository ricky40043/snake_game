import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { socket } from '../socket'
import { getHostId, getPlayerId, savePlayerId, getPlayerName } from '../storage'
import { useGame } from '../App'

export default function Lobby() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const roomId = params.get('room')
  const { state, clearError } = useGame()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!roomId) { navigate('/'); return }
    if (!socket.connected) socket.connect()

    // If we're not in a room yet (e.g. page refresh), rejoin
    if (state.status === 'idle' || !state.myPlayerId) {
      const hostId = getHostId()
      const name = getPlayerName() || 'Player'
      const existingPid = getPlayerId(roomId)

      // Try host rejoin first; fall back to player join
      if (existingPid === hostId) {
        socket.emit('rejoin_host', { roomId, hostId })
      } else {
        socket.emit('join_room', { roomId, playerId: existingPid, name })
        socket.once('room_joined', ({ playerId }) => savePlayerId(roomId, playerId))
      }
    }
  }, [roomId]) // eslint-disable-line

  // Navigate to game when it starts
  useEffect(() => {
    if (state.status === 'playing') {
      navigate(`/game?room=${roomId}`)
    }
  }, [state.status, roomId, navigate])

  // Go home if room is gone
  useEffect(() => {
    if (state.error?.code === 'ROOM_NOT_FOUND') {
      setTimeout(() => navigate('/'), 2000)
    }
  }, [state.error, navigate])

  function startGame() {
    socket.emit('start_game', { roomId })
  }

  function copyCode() {
    const url = `${window.location.origin}/?join=${roomId}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const myPlayer = state.players.find((p) => p.playerId === state.myPlayerId)
  const canStart = state.isHost && state.players.filter((p) => p.isOnline).length >= 1

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-4 gap-6 max-w-md mx-auto w-full">
      <div className="text-center">
        <div className="text-3xl font-bold text-green-400">等待大廳</div>
        <div className="mt-2 flex items-center justify-center gap-2">
          <span className="text-gray-400 text-sm">房間代碼：</span>
          <span className="font-mono text-xl font-bold tracking-widest text-white">{roomId}</span>
          <button
            onClick={copyCode}
            className="text-xs text-blue-400 hover:text-blue-300 transition"
          >
            {copied ? '已複製！' : '複製連結'}
          </button>
        </div>
      </div>

      {/* Player list */}
      <div className="w-full bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
        <div className="px-4 py-2 border-b border-[#30363d] text-xs text-gray-500 uppercase tracking-wider">
          玩家 ({state.players.length})
        </div>
        {state.players.length === 0 && (
          <div className="px-4 py-6 text-center text-gray-600">等待玩家加入…</div>
        )}
        {state.players.map((p) => (
          <div key={p.playerId} className="flex items-center gap-3 px-4 py-3 border-b border-[#21262d] last:border-b-0">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.color }} />
            <span className="flex-1 font-medium">{p.name}</span>
            {p.playerId === state.hostId && (
              <span className="text-xs text-yellow-500 bg-yellow-900/30 px-2 py-0.5 rounded-full">房主</span>
            )}
            {p.playerId === state.myPlayerId && (
              <span className="text-xs text-gray-500">(你)</span>
            )}
            <span className={`w-2 h-2 rounded-full ${p.isOnline ? 'bg-green-500' : 'bg-gray-600'}`} />
          </div>
        ))}
      </div>

      {/* Controls help */}
      <div className="text-xs text-gray-600 text-center">
        方向鍵 / WASD 控制蛇的方向
      </div>

      {state.isHost ? (
        <button
          onClick={startGame}
          disabled={!canStart}
          className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-3 rounded-lg transition text-lg"
        >
          開始遊戲
        </button>
      ) : (
        <div className="text-gray-500 text-sm animate-pulse">等待房主開始遊戲…</div>
      )}

      {state.error && (
        <p className="text-red-400 text-sm text-center">{state.error.message}</p>
      )}

      <button
        onClick={() => { socket.emit('leave_room', { roomId }); navigate('/') }}
        className="text-gray-600 hover:text-gray-400 text-sm transition"
      >
        離開房間
      </button>
    </div>
  )
}
