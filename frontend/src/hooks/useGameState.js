import { useState, useEffect, useCallback } from 'react'
import { socket } from '../socket'

const initialState = {
  // Room
  status: 'idle', // idle | lobby | playing | finished
  roomId: null,
  myPlayerId: null,
  isHost: false,
  players: [],
  settings: {},
  hostId: null,

  // Game
  gridSize: 20,
  mode: 'timed',
  duration: 180,
  snakes: [],
  food: [],
  bullets: [],
  tick: 0,
  timeLeft: null,
  respawning: {},
  paused: false,

  // Game settings (also used during play)
  attackEnabled: true,
  attackUnlocked: true,
  wallDeath: true,
  boostEnabled: false,
  tutorialEnabled: false,
  tutorialActive: false,
  tutorialStep: 0,

  // Result
  winnerId: null,
  winnerName: null,
  rankings: [],

  // Respawn preview (timed mode — only for myPlayer, 3s before respawn)
  respawnPreview: null, // { body, direction, color } | null

  // Start countdown (3→2→1 before first tick)
  startCountdown: null,

  // Death notifications
  deathCause: null,   // { type, killerId?, killerName? } | null
  revengeKill: null,  // { victimName } | null

  error: null,
}

export function useGameState() {
  const [state, setState] = useState(initialState)

  const set = useCallback((partial) => {
    setState((prev) => ({ ...prev, ...partial }))
  }, [])

  useEffect(() => {
    socket.on('room_joined', ({ playerId, isHost, isRejoin, roomState }) => {
      setState((prev) => ({
        ...prev,
        myPlayerId: playerId,
        isHost,
        roomId: roomState.roomId,
        status: roomState.status === 'playing' ? 'playing' : 'lobby',
        players: roomState.players,
        settings: roomState.settings,
        hostId: roomState.hostId,
        error: null,
      }))
    })

    socket.on('room_updated', (roomState) => {
      setState((prev) => ({
        ...prev,
        roomId: roomState.roomId || prev.roomId,
        players: roomState.players,
        settings: roomState.settings,
        hostId: roomState.hostId,
        isHost: roomState.hostId === prev.myPlayerId,
        status: prev.status === 'idle' ? 'idle' : roomState.status === 'waiting' ? 'lobby' : prev.status,
      }))
    })

    socket.on('game_started', ({ gridSize, tickMs, snakes, food, mode, duration, paused, attackEnabled, attackUnlockRemaining, attackUnlocked, wallDeath, boostEnabled, tutorialEnabled, tutorialActive, tutorialStep }) => {
      setState((prev) => ({
        ...prev,
        status: 'playing',
        gridSize,
        mode: mode || 'timed',
        duration: duration || 180,
        snakes,
        food,
        bullets: [],
        tick: 0,
        timeLeft: mode === 'timed' ? duration : null,
        respawning: {},
        paused: paused || false,
        attackEnabled: attackEnabled !== false,
        attackUnlocked: attackUnlocked !== false,
        wallDeath: wallDeath !== false,
        boostEnabled: boostEnabled === true,
        tutorialEnabled: tutorialEnabled === true,
        tutorialActive: tutorialActive === true,
        tutorialStep: tutorialStep || 0,
        winnerId: null,
        winnerName: null,
        rankings: [],
        startCountdown: null,
        deathCause: null,
        revengeKill: null,
      }))
    })

    socket.on('game_countdown', ({ countdown }) => {
      setState((prev) => ({ ...prev, startCountdown: countdown, tutorialActive: false }))
    })

    socket.on('game_tutorial_started', ({ step } = {}) => {
      setState((prev) => ({ ...prev, tutorialActive: true, tutorialStep: step || 0, startCountdown: null }))
    })

    socket.on('game_tutorial_step', ({ step }) => {
      setState((prev) => ({ ...prev, tutorialStep: step || 0 }))
    })

    socket.on('game_tutorial_finished', () => {
      setState((prev) => ({ ...prev, tutorialActive: false, tutorialStep: 0 }))
    })

    socket.on('game_paused', () => {
      setState((prev) => ({ ...prev, paused: true }))
    })

    socket.on('game_resumed', () => {
      setState((prev) => ({ ...prev, paused: false }))
    })

    socket.on('game_resized', ({ gridSize, snakes, food }) => {
      setState((prev) => ({ ...prev, gridSize, snakes, food }))
    })

    socket.on('pause_speed_updated', ({ tickMs }) => {
      setState((prev) => ({ ...prev, settings: { ...prev.settings, tickMs } }))
    })

    socket.on('game_tick', ({ tick, snakes, food, timeLeft, respawning, bullets, attackUnlocked }) => {
      setState((prev) => ({
        ...prev,
        startCountdown: null,
        tick,
        snakes,
        food,
        ...(timeLeft !== undefined && { timeLeft }),
        ...(respawning !== undefined && { respawning }),
        ...(bullets !== undefined && { bullets }),
        ...(attackUnlocked !== undefined && { attackUnlocked }),
      }))
    })

    socket.on('respawn_preview', ({ playerId, body, direction }) => {
      setState((prev) => {
        if (playerId !== prev.myPlayerId) return prev
        const mySnake = prev.snakes.find((s) => s.playerId === playerId)
        return { ...prev, respawnPreview: { body, direction, color: mySnake?.color || '#22c55e' } }
      })
    })

    socket.on('player_died', ({ playerId, deathCause }) => {
      setState((prev) => {
        if (playerId !== prev.myPlayerId) return prev
        return { ...prev, deathCause: deathCause || null }
      })
    })

    socket.on('revenge_kill', ({ victimName }) => {
      setState((prev) => ({ ...prev, revengeKill: { victimName, ts: Date.now() } }))
    })

    socket.on('player_respawned', ({ playerId }) => {
      setState((prev) => ({
        ...prev,
        ...(prev.myPlayerId === playerId ? { respawnPreview: null, deathCause: null } : {}),
      }))
    })

    socket.on('game_over', ({ winnerId, winnerName, rankings, timedWinCondition }) => {
      setState((prev) => ({
        ...prev,
        status: 'finished',
        paused: false,
        winnerId,
        winnerName,
        rankings,
        settings: timedWinCondition ? { ...prev.settings, timedWinCondition } : prev.settings,
        respawnPreview: null,
        tutorialActive: false,
        tutorialStep: 0,
      }))
    })

    socket.on('game_reset', () => {
      setState((prev) => ({
        ...prev,
        status: 'lobby',
        snakes: [],
        food: [],
        bullets: [],
        tick: 0,
        winnerId: null,
        winnerName: null,
        rankings: [],
        respawnPreview: null,
        startCountdown: null,
        tutorialActive: false,
        tutorialStep: 0,
        deathCause: null,
        revengeKill: null,
      }))
    })

    socket.on('settings_updated', ({ settings }) => {
      setState((prev) => ({ ...prev, settings }))
    })

    socket.on('room_left', () => {
      setState(initialState)
    })

    socket.on('error', ({ code, message }) => {
      set({ error: { code, message } })
    })

    socket.on('connect_error', () => {
      set({ error: { code: 'CONNECT_ERROR', message: '無法連線到伺服器' } })
    })

    return () => {
      socket.off('room_joined')
      socket.off('room_updated')
      socket.off('game_started')
      socket.off('game_tick')
      socket.off('game_over')
      socket.off('game_reset')
      socket.off('room_left')
      socket.off('settings_updated')
      socket.off('game_paused')
      socket.off('game_resumed')
      socket.off('game_resized')
      socket.off('pause_speed_updated')
      socket.off('respawn_preview')
      socket.off('player_respawned')
      socket.off('player_died')
      socket.off('revenge_kill')
      socket.off('game_countdown')
      socket.off('game_tutorial_started')
      socket.off('game_tutorial_step')
      socket.off('game_tutorial_finished')
      socket.off('error')
      socket.off('connect_error')
    }
  }, [set])

  const clearError = useCallback(() => set({ error: null }), [set])

  const resetState = useCallback(() => setState(initialState), [])

  return { state, clearError, resetState }
}
