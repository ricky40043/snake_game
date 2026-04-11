// Generate a stable hostId for this browser
export function getHostId() {
  let id = localStorage.getItem('snake_hostId')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('snake_hostId', id)
  }
  return id
}

export function getPlayerId(roomId) {
  return localStorage.getItem(`snake_pid_${roomId}`) || null
}

export function savePlayerId(roomId, playerId) {
  localStorage.setItem(`snake_pid_${roomId}`, playerId)
}

export function getPlayerName() {
  return localStorage.getItem('snake_name') || ''
}

export function savePlayerName(name) {
  localStorage.setItem('snake_name', name)
}
