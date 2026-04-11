import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { socket } from '../socket'
import { getHostId, getPlayerId, savePlayerId, getPlayerName } from '../storage'
import { useGame } from '../App'

// speed slider: 1(慢)~10(快) ↔ tickMs
function speedToTickMs(speed) {
  return Math.round(250 - (speed - 1) * (190 / 9))
}
function tickMsToSpeed(tickMs) {
  return Math.max(1, Math.min(10, Math.round(((250 - tickMs) / 190) * 9) + 1))
}

export default function Lobby() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const roomId = params.get('room')
  const { state, clearError } = useGame()
  const [copied, setCopied] = useState('')

  // Local slider state (visual while dragging)
  const [localGrid, setLocalGrid] = useState(20)
  const [localSpeed, setLocalSpeed] = useState(5)

  const joinUrl = roomId ? `${window.location.origin}/?join=${roomId}` : ''

  // Sync local sliders when server pushes settings
  useEffect(() => {
    if (state.settings?.gridSize) setLocalGrid(state.settings.gridSize)
    if (state.settings?.tickMs)   setLocalSpeed(tickMsToSpeed(state.settings.tickMs))
  }, [state.settings?.gridSize, state.settings?.tickMs])

  useEffect(() => {
    if (!roomId) { navigate('/'); return }
    if (!socket.connected) socket.connect()

    if (state.status === 'idle' || !state.myPlayerId) {
      const hostId = getHostId()
      const name = getPlayerName() || 'Player'
      const existingPid = getPlayerId(roomId)

      if (existingPid === hostId) {
        socket.emit('rejoin_host', { roomId, hostId })
      } else {
        socket.emit('join_room', { roomId, playerId: existingPid, name })
        socket.once('room_joined', ({ playerId }) => savePlayerId(roomId, playerId))
      }
    }
  }, [roomId]) // eslint-disable-line

  useEffect(() => {
    if (state.status === 'playing') navigate(`/game?room=${roomId}`)
  }, [state.status, roomId, navigate])

  useEffect(() => {
    if (state.error?.code === 'ROOM_NOT_FOUND') setTimeout(() => navigate('/'), 2000)
  }, [state.error, navigate])

  function copyUrl() {
    navigator.clipboard.writeText(joinUrl).then(() => {
      setCopied('url'); setTimeout(() => setCopied(''), 2000)
    })
  }
  function copyCode() {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied('code'); setTimeout(() => setCopied(''), 2000)
    })
  }
  function startGame() {
    socket.emit('start_game', { roomId })
  }

  // Only emit when drag ends (mouseup / touchend)
  function commitGrid(val) {
    socket.emit('update_settings', { roomId, settings: { gridSize: Number(val) } })
  }
  function commitSpeed(val) {
    socket.emit('update_settings', { roomId, settings: { tickMs: speedToTickMs(Number(val)) } })
  }

  const onlinePlayers = state.players.filter((p) => p.isOnline)
  const canStart = state.isHost && onlinePlayers.length >= 1

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
        <button
          onClick={() => { socket.emit('leave_room', { roomId }); navigate('/') }}
          className="text-gray-500 hover:text-gray-300 text-sm flex items-center gap-1 transition"
        >
          ← 返回主頁
        </button>
        <div className="text-sm text-gray-500">
          房號 <span className="font-mono font-bold text-white tracking-widest">{roomId}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 max-w-4xl mx-auto w-full">

        {/* Left: QR + Settings */}
        <div className="flex flex-col gap-4">

          {/* QR panel */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 flex flex-col items-center gap-4">
            <div className="bg-white p-3 rounded-xl">
              <QRCodeSVG value={joinUrl} size={180} />
            </div>
            <p className="text-xs text-gray-500 text-center break-all">{joinUrl}</p>
            <div className="flex gap-2 w-full">
              <button onClick={copyUrl}
                className="flex-1 bg-green-500 hover:bg-green-400 text-black font-semibold py-2 rounded-xl text-sm transition">
                {copied === 'url' ? '已複製！' : '分享連結'}
              </button>
              <button onClick={copyCode}
                className="flex-1 bg-[#21262d] hover:bg-[#30363d] text-gray-300 font-semibold py-2 rounded-xl text-sm transition">
                {copied === 'code' ? '已複製！' : '複製房號'}
              </button>
            </div>
          </div>

          {/* Game settings */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-5">遊戲設定</h3>

            {/* Grid size slider */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">地圖大小</span>
                <span className="text-sm font-mono font-bold text-green-400">{localGrid} × {localGrid}</span>
              </div>
              <input
                type="range"
                min={10} max={40} step={1}
                value={localGrid}
                disabled={!state.isHost}
                onChange={(e) => setLocalGrid(Number(e.target.value))}
                onMouseUp={(e) => commitGrid(e.target.value)}
                onTouchEnd={(e) => commitGrid(e.target.value)}
                className="w-full accent-green-500 disabled:opacity-50 disabled:cursor-default cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>小</span>
                <span>大</span>
              </div>
            </div>

            {/* Speed slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">速度</span>
                <span className="text-sm font-mono font-bold text-blue-400">
                  {localSpeed <= 2 ? '很慢' : localSpeed <= 4 ? '慢' : localSpeed <= 6 ? '中' : localSpeed <= 8 ? '快' : '很快'}
                </span>
              </div>
              <input
                type="range"
                min={1} max={10} step={1}
                value={localSpeed}
                disabled={!state.isHost}
                onChange={(e) => setLocalSpeed(Number(e.target.value))}
                onMouseUp={(e) => commitSpeed(e.target.value)}
                onTouchEnd={(e) => commitSpeed(e.target.value)}
                className="w-full accent-blue-500 disabled:opacity-50 disabled:cursor-default cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>慢</span>
                <span>快</span>
              </div>
            </div>

            {!state.isHost && (
              <p className="text-xs text-gray-600 mt-4 text-center">只有房主可以修改設定</p>
            )}
          </div>
        </div>

        {/* Right: Players + Start */}
        <div className="flex flex-col gap-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl overflow-hidden flex-1">
            <div className="px-4 py-3 border-b border-[#21262d] text-xs text-gray-500 uppercase tracking-widest">
              已加入玩家 ({state.players.length})
            </div>
            {state.players.length === 0 && (
              <div className="px-4 py-8 text-center text-gray-600">等待玩家加入…</div>
            )}
            {state.players.map((p) => (
              <div key={p.playerId} className="flex items-center gap-3 px-4 py-3 border-b border-[#21262d] last:border-b-0">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: p.color }} />
                <span className="flex-1 font-medium truncate">{p.name}</span>
                {p.playerId === state.hostId && (
                  <span className="text-xs text-yellow-500 bg-yellow-900/30 px-2 py-0.5 rounded-full">房主</span>
                )}
                {p.playerId === state.myPlayerId && (
                  <span className="text-xs text-gray-600">(你)</span>
                )}
                <span className={`w-2 h-2 rounded-full shrink-0 ${p.isOnline ? 'bg-green-500' : 'bg-gray-600'}`} />
              </div>
            ))}
          </div>

          <div className="text-xs text-gray-600 text-center">方向鍵 / WASD 控制蛇的方向</div>

          {state.isHost ? (
            <button onClick={startGame} disabled={!canStart}
              className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-4 rounded-2xl transition text-lg">
              開始遊戲
            </button>
          ) : (
            <div className="bg-[#161b22] border border-[#30363d] rounded-2xl py-4 text-center text-gray-500 text-sm animate-pulse">
              等待房主開始遊戲…
            </div>
          )}
        </div>
      </div>

      {state.error && (
        <p className="text-center text-red-400 text-sm pb-4">{state.error.message}</p>
      )}
    </div>
  )
}
