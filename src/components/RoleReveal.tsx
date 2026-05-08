import { Check, Shield, Sword } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useGame } from '@/context/GameContext'

export function RoleReveal() {
  const { state, confirmRole } = useGame()
  const { room, myPlayerId } = state
  if (!room) return null

  const me = room.players[myPlayerId]
  const isAdventurer = me?.role === 'adventurer'
  const players = Object.values(room.players)
  const confirmedCount = players.filter(p => p.roleConfirmed).length
  const alreadyConfirmed = me?.roleConfirmed ?? false

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8 text-center">

        {/* Role card */}
        <div
          className={`
            relative rounded-2xl border-2 p-8 space-y-4 shadow-2xl
            ${isAdventurer
              ? 'border-blue-500/60 bg-blue-950/30 shadow-blue-900/30'
              : 'border-purple-500/60 bg-purple-950/30 shadow-purple-900/30'
            }
          `}
        >
          <div
            className={`
              mx-auto w-20 h-20 rounded-full flex items-center justify-center
              ${isAdventurer ? 'bg-blue-500/20' : 'bg-purple-500/20'}
            `}
          >
            {isAdventurer
              ? <Sword className="w-10 h-10 text-blue-300" />
              : <Shield className="w-10 h-10 text-purple-300" />
            }
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Your secret role</p>
            <h2 className={`text-3xl font-bold ${isAdventurer ? 'text-blue-200' : 'text-purple-200'}`}>
              {isAdventurer ? 'Adventurer' : 'Guardian'}
            </h2>
          </div>

          <p className={`text-sm leading-relaxed ${isAdventurer ? 'text-blue-300/80' : 'text-purple-300/80'}`}>
            {isAdventurer
              ? 'Find all the Gold before four rounds pass. Work with fellow Adventurers, but beware of Guardians hiding among you.'
              : 'Protect the temple. Lead Adventurers astray, keep the Gold hidden, or open all the Fire traps. Stay hidden.'}
          </p>

          {/* Win condition */}
          <div className={`rounded-lg p-3 text-xs space-y-1 ${isAdventurer ? 'bg-blue-500/10 text-blue-300' : 'bg-purple-500/10 text-purple-300'}`}>
            <p className="font-semibold uppercase tracking-wider">Win condition</p>
            {isAdventurer
              ? <p>All Gold opened before the end of Round 4</p>
              : <p>All Fire opened <em>or</em> 4 rounds pass without all Gold found</p>
            }
          </div>
        </div>

        {/* Confirmation */}
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Keep your role secret! Don't tell other players.
          </p>

          {alreadyConfirmed ? (
            <div className="flex items-center justify-center gap-2 text-green-400 text-sm">
              <Check className="w-4 h-4" />
              Ready! Waiting for others…
            </div>
          ) : (
            <Button
              variant={isAdventurer ? 'default' : 'secondary'}
              size="lg"
              className={`w-full ${isAdventurer ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-purple-700 hover:bg-purple-600 text-white'}`}
              onClick={confirmRole}
            >
              I understand my role — I'm ready
            </Button>
          )}

          <p className="text-xs text-muted-foreground">
            {confirmedCount} / {players.length} players ready
          </p>
        </div>
      </div>
    </div>
  )
}
