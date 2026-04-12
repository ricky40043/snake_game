module.exports = {
  port: process.env.PORT || 3001,
  corsOrigins:
    process.env.NODE_ENV === 'production'
      ? '*'
      : ['http://localhost:5173', 'http://localhost:3001'],

  // ── Hard limits (never user-adjustable) ──────────────────────────
  maxPlayersPerRoom: 20,          // absolute cap on players in a room
  roomCleanupMs: 10 * 60 * 1000, // room auto-delete after game ends

  // ── Game defaults (all adjustable in lobby) ───────────────────────
  defaultMaxPlayers: 10,   // host-adjustable player limit default (2–20)
  minPlayersToStart: 1,

  gridSize: 20,
  tickMs: 120,
  foodCount: 3,
  mode: 'classic',         // 'classic' | 'timed'
  duration: 180,           // seconds (timed mode)

  attackEnabled: false,         // shooting off by default
  attackUnlockRemaining: 0,     // seconds remaining when attack unlocks (0 = always)
  wallDeath: true,              // wall collision kills snake
}
