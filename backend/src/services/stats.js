// 輕量遊戲數據上報：fire-and-forget POST 到共用 game-stats 收集服務。
// 失敗一律吞掉，絕不影響遊戲本身。
const STATS_URL = process.env.STATS_URL || 'https://admin-games.ricky-nova.com/api/event'
const GAME = process.env.STATS_GAME || 'snake'

function track(event, data = {}) {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 2000)
    fetch(STATS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: GAME, event, ...data }),
      signal: ctrl.signal,
    }).catch(() => {}).finally(() => clearTimeout(t))
  } catch (_) { /* ignore */ }
}

module.exports = { track }
