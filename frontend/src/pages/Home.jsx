import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { socket } from '../socket'
import { getHostId, getPlayerId, savePlayerId, getPlayerName, savePlayerName } from '../storage'
import { useGame } from '../App'
import QRScanner from '../components/QRScanner'

export default function Home() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { state, clearError } = useGame()
  const [name, setName] = useState(getPlayerName())
  const [roomCode, setRoomCode] = useState(params.get('join') || '')
  const [loading, setLoading] = useState(null) // 'create' | 'join' | null
  const [showScanner, setShowScanner] = useState(false)

  useEffect(() => {
    if (!socket.connected) socket.connect()
  }, [])

  useEffect(() => {
    if (state.status === 'lobby' && state.roomId) {
      setLoading(null)
      navigate(`/lobby?room=${state.roomId}`)
    }
  }, [state.status, state.roomId, navigate])

  useEffect(() => {
    if (state.error) setLoading(null)
  }, [state.error])

  function validateName() {
    if (!name.trim()) { alert('請先輸入暱稱'); return false }
    savePlayerName(name.trim())
    return true
  }

  function handleCreate() {
    if (!validateName()) return
    setLoading('create')
    clearError()
    const hostId = getHostId()
    socket.once('room_created', ({ roomId }) => {
      savePlayerId(roomId, hostId)
      socket.emit('join_room', { roomId, playerId: hostId, name: name.trim() })
    })
    socket.emit('create_room', { hostId })
  }

  function handleJoin() {
    const code = roomCode.trim().toUpperCase()
    if (!validateName()) return
    if (code.length !== 6) { alert('請輸入 6 位房間代碼'); return }
    setLoading('join')
    clearError()
    const existingId = getPlayerId(code)
    socket.emit('join_room', { roomId: code, playerId: existingId, name: name.trim() })
    socket.once('room_joined', ({ playerId }) => savePlayerId(code, playerId))
  }

  function handleScan(url) {
    setShowScanner(false)
    try {
      const parsed = new URL(url)
      const code = parsed.searchParams.get('join') || parsed.pathname.split('/').pop()
      if (code) setRoomCode(code.toUpperCase())
    } catch {
      // raw room code
      if (url.length === 6) setRoomCode(url.toUpperCase())
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-10 gap-6">
      {/* Title */}
      <div className="text-center mb-2">
        <div className="text-6xl mb-3">🐍</div>
        <h1 className="text-4xl font-bold text-green-400">貪吃蛇 Online</h1>
        <p className="text-gray-500 mt-1 text-sm">多人線上即時對戰</p>
      </div>

      {/* Name input */}
      <div className="w-full max-w-md">
        <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-widest">暱稱</label>
        <input
          type="text"
          maxLength={12}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="輸入你的暱稱"
          className="w-full bg-[#161b22] border border-[#30363d] rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition text-center text-lg font-semibold"
        />
      </div>

      {/* Three cards */}
      <div className="w-full max-w-md flex flex-col gap-3">

        {/* 建立房間 */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl px-5 py-4 flex items-center gap-4">
          <div className="text-3xl">🏠</div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white">建立房間</div>
            <div className="text-xs text-gray-500 mt-0.5">成為房主，設定並開始遊戲</div>
          </div>
          <button
            onClick={handleCreate}
            disabled={loading !== null}
            className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-bold px-5 py-2 rounded-xl transition shrink-0"
          >
            {loading === 'create' ? '…' : '建立'}
          </button>
        </div>

        {/* 加入房間 */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl px-5 py-4 flex items-center gap-4">
          <div className="text-3xl">👥</div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white mb-2">加入房間</div>
            <input
              type="text"
              maxLength={6}
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="輸入房間代碼"
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 tracking-widest font-mono uppercase transition"
            />
          </div>
          <button
            onClick={handleJoin}
            disabled={loading !== null}
            className="bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-xl transition shrink-0"
          >
            {loading === 'join' ? '…' : '加入'}
          </button>
        </div>

        {/* 掃描加入 */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl px-5 py-4 flex items-center gap-4">
          <div className="text-3xl">📷</div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white">掃描加入</div>
            <div className="text-xs text-gray-500 mt-0.5">使用相機掃描 QR Code</div>
          </div>
          <button
            onClick={() => setShowScanner(true)}
            disabled={loading !== null}
            className="bg-[#21262d] hover:bg-[#30363d] disabled:opacity-50 text-gray-300 font-bold px-5 py-2 rounded-xl transition shrink-0"
          >
            掃描
          </button>
        </div>
      </div>

      {state.error && (
        <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-xl px-4 py-2 max-w-md w-full text-center">
          {state.error.message}
        </p>
      )}

      {showScanner && (
        <QRScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
      )}
    </div>
  )
}
