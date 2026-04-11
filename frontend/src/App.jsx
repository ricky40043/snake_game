import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Lobby from './pages/Lobby'
import Game from './pages/Game'
import { useGameState } from './hooks/useGameState'
import { createContext, useContext } from 'react'

export const GameContext = createContext(null)
export const useGame = () => useContext(GameContext)

export default function App() {
  const gameState = useGameState()

  return (
    <GameContext.Provider value={gameState}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/game" element={<Game />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </GameContext.Provider>
  )
}
