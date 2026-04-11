import { useNavigate, useSearchParams } from 'react-router-dom'
import { socket } from '../socket'

export default function GameOver({ winnerId, winnerName, rankings, myPlayerId, isHost, roomId }) {
  const navigate = useNavigate()
  const myResult = rankings.find((r) => r.playerId === myPlayerId)
  const isWinner = winnerId === myPlayerId

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
        {/* Winner banner */}
        <div className="text-center mb-5">
          {winnerId ? (
            <>
              <div className="text-4xl mb-2">🏆</div>
              <div className="text-2xl font-bold" style={{ color: rankings.find((r) => r.playerId === winnerId)?.color || '#fff' }}>
                {winnerName}
              </div>
              <div className="text-gray-400 text-sm mt-1">獲得勝利！</div>
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
        </div>

        {/* Rankings */}
        <div className="bg-[#0d1117] rounded-xl overflow-hidden mb-5">
          <div className="px-3 py-2 text-xs text-gray-500 uppercase tracking-wider border-b border-[#21262d]">
            排行榜
          </div>
          {rankings.map((r) => (
            <div
              key={r.playerId}
              className={`flex items-center gap-3 px-3 py-2 border-b border-[#21262d] last:border-b-0 ${r.playerId === myPlayerId ? 'bg-blue-900/20' : ''}`}
            >
              <span className="text-gray-500 w-5 text-sm font-mono">#{r.placement}</span>
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: r.color }} />
              <span className="flex-1 text-sm font-medium truncate">
                {r.name}
                {r.playerId === myPlayerId && <span className="text-gray-600 ml-1">(你)</span>}
              </span>
              <span className="text-xs text-yellow-500 font-mono">{r.score}分</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {isHost && (
            <button
              onClick={handlePlayAgain}
              className="flex-1 bg-green-500 hover:bg-green-400 text-black font-bold py-2.5 rounded-lg transition"
            >
              再來一局
            </button>
          )}
          <button
            onClick={handleLeave}
            className={`${isHost ? '' : 'flex-1'} bg-[#21262d] hover:bg-[#30363d] text-gray-300 font-medium py-2.5 px-4 rounded-lg transition`}
          >
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
