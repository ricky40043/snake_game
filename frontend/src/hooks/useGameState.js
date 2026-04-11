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
  mode: 'classic',
  duration: 180,
  snakes: [],
  food: [],
  tick: 0,
  timeLeft: null,
  respawning: {},
  paused: false,

  // Result
  winnerId: null,
  winnerName: null,
  rankings: [],

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
        status: prev.status === 'idle' ? 'idle' : roomState.status === 'waiting' ? 'lobby' : prev.status,
      }))
    })

    socket.on('game_started', ({ gridSize, tickMs, snakes, food, mode, duration, paused }) => {
      setState((prev) => ({
        ...prev,
        status: 'playing',
        gridSize,
        mode: mode || 'classic',
        duration: duration || 180,
        snakes,
        food,
        tick: 0,
        timeLeft: mode === 'timed' ? duration : null,
        respawning: {},
        paused: paused || false,
        winnerId: null,
        winnerName: null,
        rankings: [],
      }))
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

    socket.on('game_tick', ({ tick, snakes, food, timeLeft, respawning }) => {
      setState((prev) => ({
        ...prev,
        tick,
        snakes,
        food,
        ...(timeLeft !== undefined && { timeLeft }),
        ...(respawning !== undefined && { respawning }),
      }))
    })

    socket.on('game_over', ({ winnerId, winnerName, rankings }) => {
      setState((prev) => ({
        ...prev,
        status: 'finished',
        winnerId,
        winnerName,
        rankings,
      }))
    })

    socket.on('game_reset', () => {
      setState((prev) => ({
        ...prev,
        status: 'lobby',
        snakes: [],
        food: [],
        tick: 0,
        winnerId: null,
        winnerName: null,
        rankings: [],
      }))
    })

    socket.on('settings_updated', ({ settings }) => {
      setState((prev) => ({ ...prev, settings }))
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
      socket.off('settings_updated')
      socket.off('game_paused')
      socket.off('game_resumed')
      socket.off('game_resized')
      socket.off('pause_speed_updated')
      socket.off('error')
      socket.off('connect_error')
    }
  }, [set])

  const clearError = useCallback(() => set({ error: null }), [set])

  return { state, clearError }
}
