import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { socket } from '../socket'
import { getHostId, getPlayerId, savePlayerId, getPlayerName } from '../storage'
import { useGame } from '../App'

const ERROR_ZH = {
  ROOM_NOT_FOUND: '找不到該房間',
  GAME_ALREADY_STARTED: '遊戲已開始，無法加入',
  GAME_FINISHED: '遊戲已結束',
  ROOM_FULL: '房間已滿',
  NOT_HOST: '只有房主可以執行此操作',
  NOT_ENOUGH_PLAYERS: '人數不足，無法開始',
  NOT_IN_ROOM: '尚未加入任何房間',
  MISSING_FIELD: '缺少必要欄位',
  INVALID_STATUS: '目前無法執行此操作',
  CREATE_FAILED: '建立房間失敗，請重試',
  CONNECT_ERROR: '無法連線到伺服器，請檢查網路',
}

function speedToTickMs(speed) {
  return Math.round(500 - (speed - 1) * (440 / 9))
}
function tickMsToSpeed(tickMs) {
  return Math.max(1, Math.min(10, Math.round(((500 - tickMs) / 440) * 9) + 1))
}
function speedLabel(s) {
  return s <= 2 ? '很慢' : s <= 4 ? '慢' : s <= 6 ? '中' : s <= 8 ? '快' : '很快'
}
function formatDuration(sec) {
  if (sec < 60) return `${sec} 秒`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s === 0 ? `${m} 分鐘` : `${m} 分 ${s} 秒`
}

export default function Lobby() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const roomId = params.get('room')
  const { state, clearError, resetState } = useGame()
  const [copied, setCopied] = useState('')

  const [localGrid, setLocalGrid] = useState(20)
  const [localSpeed, setLocalSpeed] = useState(5)
  const [localDuration, setLocalDuration] = useState(180)
  const [localFood, setLocalFood] = useState(3)
  const [localAttackUnlock, setLocalAttackUnlock] = useState(0)

  const joinUrl = roomId ? `${window.location.origin}/?join=${roomId}` : ''

  useEffect(() => {
    if (state.settings?.gridSize) setLocalGrid(state.settings.gridSize)
    if (state.settings?.tickMs) setLocalSpeed(tickMsToSpeed(state.settings.tickMs))
    if (state.settings?.duration) setLocalDuration(state.settings.duration)
    if (state.settings?.foodCount) setLocalFood(state.settings.foodCount)
    if (state.settings?.attackUnlockRemaining !== undefined) setLocalAttackUnlock(state.settings.attackUnlockRemaining)
  }, [state.settings?.gridSize, state.settings?.tickMs, state.settings?.duration, state.settings?.foodCount, state.settings?.attackUnlockRemaining, localAttackUnlock])

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
    navigator.clipboard.writeText(joinUrl).then(() => { setCopied('url'); setTimeout(() => setCopied(''), 2000) })
  }
  function copyCode() {
    navigator.clipboard.writeText(roomId).then(() => { setCopied('code'); setTimeout(() => setCopied(''), 2000) })
  }
  function startGame() { socket.emit('start_game', { roomId }) }

  function updateSettings(key, value) {
    socket.emit('update_settings', { roomId, settings: { [key]: value } })
  }
  function commitGrid(val) { updateSettings('gridSize', Number(val)) }
  function commitSpeed(val) { updateSettings('tickMs', speedToTickMs(Number(val))) }
  function commitDuration(val) { updateSettings('duration', Number(val)) }
  function commitFood(val) { updateSettings('foodCount', Number(val)) }
  function setMode(mode) { updateSettings('mode', mode) }

  const settings = state.settings || {}
  const currentMode = settings.mode || 'classic'
  const onlinePlayers = state.players.filter((p) => p.isOnline)
  const canStart = state.isHost && onlinePlayers.length >= 1

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
        <button onClick={() => { resetState(); socket.emit('leave_room', { roomId }); navigate('/') }}
          className="text-gray-500 hover:text-gray-300 text-sm flex items-center gap-1 transition">
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
              <QRCodeSVG value={joinUrl} size={170} />
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
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">遊戲設定</h3>

            {/* My color */}
            {(() => {
              const COLORS = [
                '#22c55e','#3b82f6','#f97316','#a855f7','#eab308','#ef4444','#06b6d4','#ec4899','#84cc16','#14b8a6',
                '#4ade80','#6366f1','#fb923c','#c026d3','#f59e0b','#f87171','#0ea5e9','#f472b6','#a3e635','#2dd4bf',
              ]
              const myColor = state.players.find((p) => p.playerId === state.myPlayerId)?.color
              return (
                <div className="mb-5">
                  <div className="text-sm text-gray-300 mb-2">蛇的顏色</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {COLORS.map((c) => {
                      const isMe = c === myColor
                      return (
                        <div key={c} className="relative flex flex-col items-center gap-1">
                          <div
                            className="rounded-full transition-all"
                            style={{
                              width: isMe ? 32 : 20,
                              height: isMe ? 32 : 20,
                              background: c,
                              boxShadow: isMe ? `0 0 0 3px #fff, 0 0 12px 4px ${c}` : undefined,
                              opacity: myColor && !isMe ? 0.35 : 1,
                            }}
                          />
                          {isMe && <span className="text-[10px] font-bold text-white leading-none">你</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* Mode selector */}
            <div className="mb-5">
              <div className="text-sm text-gray-300 mb-2">遊戲模式</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={!state.isHost}
                  onClick={() => setMode('classic')}
                  className={`py-3 rounded-xl text-sm font-semibold transition disabled:cursor-default flex flex-col items-center gap-1
                    ${currentMode === 'classic' ? 'bg-green-500 text-black' : 'bg-[#21262d] text-gray-400 hover:bg-[#30363d]'}`}
                >
                  <span className="text-xl">🏆</span>
                  <span>存活模式</span>
                  <span className={`text-xs font-normal ${currentMode === 'classic' ? 'text-black/60' : 'text-gray-600'}`}>最後存活獲勝</span>
                </button>
                <button
                  disabled={!state.isHost}
                  onClick={() => setMode('timed')}
                  className={`py-3 rounded-xl text-sm font-semibold transition disabled:cursor-default flex flex-col items-center gap-1
                    ${currentMode === 'timed' ? 'bg-orange-500 text-black' : 'bg-[#21262d] text-gray-400 hover:bg-[#30363d]'}`}
                >
                  <span className="text-xl">⏱</span>
                  <span>計時模式</span>
                  <span className={`text-xs font-normal ${currentMode === 'timed' ? 'text-black/60' : 'text-gray-600'}`}>最長蛇獲勝</span>
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-2 text-center">⚡ 所有模式均可按 F 鍵（手機：⚡鈕）發射子彈攻擊</p>
            </div>

            {/* Duration slider (timed only) */}
            {currentMode === 'timed' && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">遊戲時間</span>
                  <span className="text-sm font-mono font-bold text-orange-400">{formatDuration(localDuration)}</span>
                </div>
                <input
                  type="range"
                  min={30} max={600} step={10}
                  value={localDuration}
                  disabled={!state.isHost}
                  onChange={(e) => { const v = Number(e.target.value); setLocalDuration(v); commitDuration(v) }}
                  className="w-full accent-orange-500 disabled:opacity-50 disabled:cursor-default cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>30 秒</span>
                  <span>10 分鐘</span>
                </div>
                <p className="text-xs text-gray-600 mt-2 text-center">死亡後 10 秒復活，時間到以蛇長度排名</p>
              </div>
            )}

            {/* Attack settings */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-300">⚡ 攻擊射擊</span>
                <button
                  disabled={!state.isHost}
                  onClick={() => { if (state.isHost) updateSettings('attackEnabled', !(settings.attackEnabled !== false)) }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition disabled:cursor-default
                    ${settings.attackEnabled !== false ? 'bg-red-500' : 'bg-gray-600'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition
                    ${settings.attackEnabled !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* Unlock delay — only shown in timed mode when attack is enabled */}
              {currentMode === 'timed' && settings.attackEnabled !== false && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">解鎖時機</span>
                    <span className="text-xs font-mono font-bold text-red-400">
                      {localAttackUnlock === 0 ? '遊戲開始即解鎖' : `剩餘 ${localAttackUnlock >= 60 ? `${Math.floor(localAttackUnlock/60)}分` : ''}${localAttackUnlock % 60 > 0 ? `${localAttackUnlock % 60}秒` : ''} 時解鎖`}
                    </span>
                  </div>
                  <input
                    type="range" min={0} max={180} step={30}
                    value={localAttackUnlock}
                    disabled={!state.isHost}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setLocalAttackUnlock(v)
                      updateSettings('attackUnlockRemaining', v)
                    }}
                    className="w-full accent-red-500 disabled:opacity-50 disabled:cursor-default cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>立即</span><span>剩3分鐘</span>
                  </div>
                </div>
              )}
            </div>

            {/* Wall death */}
            <div className="mb-5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-gray-300">碰牆死亡</span>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {settings.wallDeath !== false ? '碰牆即死' : '碰牆隨機轉向'}
                  </p>
                </div>
                <button
                  disabled={!state.isHost}
                  onClick={() => { if (state.isHost) updateSettings('wallDeath', !(settings.wallDeath !== false)) }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition disabled:cursor-default
                    ${settings.wallDeath !== false ? 'bg-green-500' : 'bg-gray-600'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition
                    ${settings.wallDeath !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            {/* Grid size */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">地圖大小</span>
                <span className="text-sm font-mono font-bold text-green-400">{localGrid} × {localGrid}</span>
              </div>
              <input
                type="range" min={10} max={60} step={1}
                value={localGrid}
                disabled={!state.isHost}
                onChange={(e) => { const v = Number(e.target.value); setLocalGrid(v); commitGrid(v) }}
                className="w-full accent-green-500 disabled:opacity-50 disabled:cursor-default cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>小</span><span>大</span>
              </div>
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
                disabled={!state.isHost}
                onChange={(e) => { const v = Number(e.target.value); setLocalSpeed(v); commitSpeed(v) }}
                className="w-full accent-blue-500 disabled:opacity-50 disabled:cursor-default cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>慢</span><span>快</span>
              </div>
            </div>

            {/* Food count */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">食物數量</span>
                <span className="text-sm font-mono font-bold text-red-400">{localFood} 個</span>
              </div>
              <input
                type="range" min={1} max={10} step={1}
                value={localFood}
                disabled={!state.isHost}
                onChange={(e) => { const v = Number(e.target.value); setLocalFood(v); commitFood(v) }}
                className="w-full accent-red-500 disabled:opacity-50 disabled:cursor-default cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>1 個</span><span>10 個</span>
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
        <p className="text-center text-red-400 text-sm pb-4">{ERROR_ZH[state.error.code] || state.error.message}</p>
      )}
    </div>
  )
}
