import { useGame } from '@/context/GameContext'
import { LandingScreen } from '@/components/LandingScreen'
import { LobbyScreen } from '@/components/LobbyScreen'
import { RoleReveal } from '@/components/RoleReveal'
import { GameBoard } from '@/components/GameBoard'
import { RoundSummary } from '@/components/RoundSummary'
import { EndScreen } from '@/components/EndScreen'
import { Toaster } from '@/components/ui/toaster'

function AppScreens() {
  const { state } = useGame()
  const { room } = state

  if (!room) return <LandingScreen />

  switch (room.status) {
    case 'lobby':         return <LobbyScreen />
    case 'role-reveal':   return <RoleReveal />
    case 'playing':       return <GameBoard />
    case 'round-summary': return <GameBoard />
    case 'ended':         return <EndScreen />
  }
}

export function App() {
  return (
    <>
      <AppScreens />
      <Toaster />
    </>
  )
}
