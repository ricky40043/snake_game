module.exports = {
  port: process.env.PORT || 3001,
  corsOrigins:
    process.env.NODE_ENV === 'production'
      ? '*'
      : ['http://localhost:5173', 'http://localhost:3001'],
  maxPlayersPerRoom: 7,
  minPlayersToStart: 1,
  foodCount: 3,
  gridSize: 20,
  tickMs: 120,
  roomCleanupMs: 10 * 60 * 1000, // 10 min after game finishes
}
