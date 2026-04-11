import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { socket } from '../socket'
import { getHostId, getPlayerId, savePlayerId, getPlayerName, savePlayerName } from '../storage'
import { useGame } from '../App'

export default function Home() {
  const navigate = useNavigate()
  const { state, clearError } = useGame()
  const [name, setName] = useState(getPlayerName())
  const [roomCode, setRoomCode] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!socket.connected) socket.connect()
  }, [])

  // Navigate after room_joined
  useEffect(() => {
    if (state.status === 'lobby' && state.roomId) {
      setLoading(false)
      navigate(`/lobby?room=${state.roomId}`)
    }
  }, [state.status, state.roomId, navigate])

  useEffect(() => {
    if (state.error) setLoading(false)
  }, [state.error])

  function handleCreateRoom() {
    if (!name.trim()) return alert('請輸入暱稱')
    savePlayerName(name.trim())
    setLoading(true)
    clearError()

    const hostId = getHostId()

    // Listen for room_created then auto join
    socket.once('room_created', ({ roomId }) => {
      savePlayerId(roomId, hostId)
      socket.emit('join_room', { roomId, playerId: hostId, name: name.trim() })
    })

    socket.emit('create_room', { hostId })
  }

  function handleJoinRoom() {
    const code = roomCode.trim().toUpperCase()
    if (!name.trim()) return alert('請輸入暱稱')
    if (code.length !== 6) return alert('請輸入 6 位房間代碼')
    savePlayerName(name.trim())
    setLoading(true)
    clearError()

    const existingId = getPlayerId(code)
    if (existingId) {
      socket.emit('join_room', { roomId: code, playerId: existingId, name: name.trim() })
    } else {
      socket.emit('join_room', { roomId: code, name: name.trim() })
    }

    // Save playerId when we receive it
    socket.once('room_joined', ({ playerId }) => {
      savePlayerId(code, playerId)
    })
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-4 gap-8">
      <div className="text-center">
        <div className="text-6xl mb-3">🐍</div>
        <h1 className="text-4xl font-bold text-green-400">貪吃蛇 Online</h1>
        <p className="text-gray-400 mt-2 text-sm">多人線上對戰</p>
      </div>

      {/* Name input */}
      <div className="w-full max-w-sm">
        <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">暱稱</label>
        <input
          type="text"
          maxLength={12}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="輸入你的暱稱"
          className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition"
          onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
        />
      </div>

      <div className="w-full max-w-sm flex flex-col gap-3">
        {/* Create room */}
        <button
          onClick={handleCreateRoom}
          disabled={loading}
          className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-bold py-3 rounded-lg transition"
        >
          {loading ? '連線中…' : '建立房間'}
        </button>

        <div className="flex items-center gap-3">
          <hr className="flex-1 border-[#30363d]" />
          <span className="text-gray-600 text-sm">或</span>
          <hr className="flex-1 border-[#30363d]" />
        </div>

        {/* Join room */}
        <div className="flex gap-2">
          <input
            type="text"
            maxLength={6}
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="房間代碼"
            className="flex-1 bg-[#161b22] border border-[#30363d] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition tracking-widest font-mono uppercase"
            onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
          />
          <button
            onClick={handleJoinRoom}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-bold px-5 rounded-lg transition"
          >
            加入
          </button>
        </div>
      </div>

      {state.error && (
        <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-4 py-2 max-w-sm w-full text-center">
          {state.error.message}
        </p>
      )}
    </div>
  )
}
