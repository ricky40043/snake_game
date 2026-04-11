import { useState, useEffect } from 'react'
import { socket } from '../socket'

function speedToTickMs(s) { return Math.round(500 - (s - 1) * (440 / 9)) }
function tickMsToSpeed(t) { return Math.max(1, Math.min(10, Math.round(((500 - t) / 440) * 9) + 1)) }
function speedLabel(s) { return s <= 2 ? '很慢' : s <= 4 ? '慢' : s <= 6 ? '中' : s <= 8 ? '快' : '很快' }

export default function PausePanel({ roomId, gameGridSize, gameTickMs }) {
  const [localSpeed, setLocalSpeed] = useState(tickMsToSpeed(gameTickMs || 130))
  const [localGrid, setLocalGrid] = useState(gameGridSize || 20)
  const [minGrid, setMinGrid] = useState(gameGridSize || 20)
  const [resized, setResized] = useState(false)
  const [confirming, setConfirming] = useState(false)

  // Update min when server confirms resize
  useEffect(() => {
    setMinGrid(gameGridSize)
    setLocalGrid((prev) => Math.max(prev, gameGridSize))
  }, [gameGridSize])

  // Update speed label when server confirms speed change
  useEffect(() => {
    setLocalSpeed(tickMsToSpeed(gameTickMs || 130))
  }, [gameTickMs])

  function commitSpeed(val) {
    socket.emit('update_pause_speed', { roomId, tickMs: speedToTickMs(Number(val)) })
  }

  function handleConfirmResize() {
    if (localGrid <= minGrid) return
    setConfirming(true)
    socket.emit('resize_game', { roomId, gridSize: localGrid })
    // After server confirms (game_resized event updates gameGridSize), setResized
    setTimeout(() => { setResized(true); setConfirming(false) }, 500)
  }

  function handleEnd() {
    if (window.confirm('確定要直接結束遊戲？')) {
      socket.emit('end_game_now', { roomId })
    }
  }

  return (
    <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-20 p-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 w-full max-w-sm shadow-2xl">

        <div className="text-center mb-6">
          <div className="text-4xl mb-2">⏸</div>
          <h2 className="text-xl font-bold text-white">遊戲暫停</h2>
          <p className="text-xs text-gray-500 mt-1">按空白鍵繼續遊戲</p>
        </div>

        {/* Speed */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300">速度</span>
            <span className="text-sm font-mono font-bold text-blue-400">{speedLabel(localSpeed)}</span>
          </div>
          <input
            type="range" min={1} max={10} step={1}
            value={localSpeed}
            onChange={(e) => setLocalSpeed(Number(e.target.value))}
            onMouseUp={(e) => commitSpeed(e.target.value)}
            onTouchEnd={(e) => commitSpeed(e.target.value)}
            className="w-full accent-blue-500 cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>慢</span><span>快</span>
          </div>
        </div>

        {/* Map size (enlarge only) */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300">地圖大小（只能放大）</span>
            <span className="text-sm font-mono font-bold text-green-400">{localGrid} × {localGrid}</span>
          </div>
          <input
            type="range" min={minGrid} max={60} step={1}
            value={localGrid}
            onChange={(e) => { setLocalGrid(Number(e.target.value)); setResized(false) }}
            className="w-full accent-green-500 cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>目前 {minGrid}×{minGrid}</span><span>最大 60×60</span>
          </div>
        </div>

        <button
          onClick={handleConfirmResize}
          disabled={localGrid <= minGrid || resized || confirming}
          className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl mb-4 transition text-sm"
        >
          {resized ? '✓ 地圖已調整（按空白繼續）' : confirming ? '調整中…' : `確認放大地圖 → ${localGrid}×${localGrid}`}
        </button>

        <button
          onClick={handleEnd}
          className="w-full bg-red-700/80 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl transition text-sm"
        >
          結束遊戲
        </button>

        <p className="text-center text-gray-600 text-xs mt-4 leading-relaxed">
          調整後按「確認」→ 畫面會縮放 → 再按空白鍵繼續
        </p>
      </div>
    </div>
  )
}
