import { useNavigate } from 'react-router-dom'
import { socket } from '../socket'

export default function GameOver({ winnerId, winnerName, rankings, myPlayerId, isHost, roomId, mode }) {
  const navigate = useNavigate()
  const isWinner = winnerId === myPlayerId
  const winnerColor = rankings.find((r) => r.playerId === winnerId)?.color || '#fff'
  const isTimed = mode === 'timed'

  function handlePlayAgain() {
    socket.emit('play_again', { roomId })
    navigate(`/lobby?room=${roomId}`)
  }
  function handleLeave() {
    socket.emit('leave_room', { roomId })
    navigate('/')
  }

  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-10 p-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 w-full max-w-sm shadow-2xl">

        {/* Banner */}
        <div className="text-center mb-5">
          {winnerId ? (
            <>
              <div className="text-4xl mb-2">{isTimed ? '⏱' : '🏆'}</div>
              <div className="text-2xl font-bold" style={{ color: winnerColor }}>{winnerName}</div>
              <div className="text-gray-400 text-sm mt-1">
                {isTimed ? `以 ${rankings[0]?.length ?? 0} 格長度獲勝！` : '存活至最後！'}
              </div>
              {isWinner && (
                <div className="mt-2 text-green-400 font-semibold animate-bounce">你贏了！🎉</div>
              )}
            </>
          ) : (
            <>
              <div className="text-4xl mb-2">💀</div>
              <div className="text-2xl font-bold text-gray-300">遊戲結束</div>
              <div className="text-gray-500 text-sm mt-1">平局</div>
            </>
          )}

          {/* Mode badge */}
          <div className={`inline-block mt-2 text-xs px-3 py-1 rounded-full font-semibold
            ${isTimed ? 'bg-orange-900/40 text-orange-400' : 'bg-green-900/40 text-green-400'}`}>
            {isTimed ? '⏱ 計時模式' : '🏆 存活模式'}
          </div>
        </div>

        {/* Rankings */}
        <div className="bg-[#0d1117] rounded-xl overflow-hidden mb-5">
          <div className="px-3 py-2 text-xs text-gray-500 uppercase tracking-wider border-b border-[#21262d] flex items-center justify-between">
            <span>排行榜</span>
            <span className="text-gray-600 normal-case">{isTimed ? '以長度排名' : '以存活＋長度排名'}</span>
          </div>
          {rankings.map((r) => (
            <div
              key={r.playerId}
              className={`flex items-center gap-3 px-3 py-2 border-b border-[#21262d] last:border-b-0
                ${r.playerId === myPlayerId ? 'bg-blue-900/20' : ''}`}
            >
              <span className={`w-5 text-sm font-mono text-center ${r.placement === 1 ? 'text-yellow-400' : r.placement === 2 ? 'text-gray-400' : r.placement === 3 ? 'text-amber-600' : 'text-gray-600'}`}>
                {r.placement === 1 ? '🥇' : r.placement === 2 ? '🥈' : r.placement === 3 ? '🥉' : `#${r.placement}`}
              </span>
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />
              <span className="flex-1 text-sm font-medium truncate">
                {r.name}
                {r.playerId === myPlayerId && <span className="text-gray-600 ml-1">(你)</span>}
              </span>
              <div className="text-right">
                <div className="text-xs text-green-400 font-mono">{r.length} 格</div>
                <div className="text-xs text-yellow-500/70 font-mono">{r.score}分</div>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {isHost && (
            <button onClick={handlePlayAgain}
              className="flex-1 bg-green-500 hover:bg-green-400 text-black font-bold py-2.5 rounded-lg transition">
              再來一局
            </button>
          )}
          <button onClick={handleLeave}
            className={`${isHost ? '' : 'flex-1'} bg-[#21262d] hover:bg-[#30363d] text-gray-300 font-medium py-2.5 px-4 rounded-lg transition`}>
            離開
          </button>
        </div>
        {!isHost && (
          <p className="text-center text-gray-600 text-xs mt-3">等待房主開始下一局…</p>
        )}
      </div>
    </div>
  )
}
