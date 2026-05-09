import { ArrowRight, Flame, Gem, Wind } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChamberCard } from './ChamberCard'
import { useGame } from '@/context/GameContext'

export function RoundSummary() {
  const { state, continueRound } = useGame()
  const { room } = state
  if (!room) return null

  const players = Object.values(room.players)
  const openedThisRound = Object.values(room.chambers).filter(
    c => c.isOpened && c.openedInRound === room.currentRound,
  )

  const roundGold  = openedThisRound.filter(c => c.content === 'gold').length
  const roundFire  = openedThisRound.filter(c => c.content === 'fire').length
  const roundEmpty = openedThisRound.filter(c => c.content === 'empty').length

  const isLastRound = room.currentRound >= 4

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">End of round</p>
          <h1 className="text-3xl font-bold text-foreground">Round {room.currentRound}</h1>
        </div>

        {/* Per-player reveals */}
        <div className="rounded-xl border border-border/40 bg-card/30 p-4 space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Cards revealed</p>
          <div className="space-y-3">
            {players.map(player => {
              const cards = openedThisRound.filter(c => c.ownerId === player.id)
              if (cards.length === 0) return null
              return (
                <div key={player.id} className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-24 shrink-0 truncate">{player.name}</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {cards.map(c => (
                      <ChamberCard key={c.id} chamber={{ ...c, isOpened: true }} isClickable={false} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Round totals */}
        <div className="rounded-xl border border-border/40 bg-card/30 px-4 py-3 flex items-center gap-6 flex-wrap">
          <span className="text-xs text-muted-foreground">This round:</span>
          {roundGold > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-gold-300">
              <Gem className="w-3.5 h-3.5" /> +{roundGold} gold
            </span>
          )}
          {roundFire > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-fire-400">
              <Flame className="w-3.5 h-3.5" /> +{roundFire} fire
            </span>
          )}
          {roundEmpty > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Wind className="w-3.5 h-3.5" /> {roundEmpty} empty
            </span>
          )}
        </div>

        {/* Overall progress */}
        <div className="rounded-xl border border-border/40 bg-card/30 px-4 py-3 flex items-center gap-6 flex-wrap">
          <span className="text-xs text-muted-foreground">Overall:</span>
          <span className="flex items-center gap-1.5 text-sm text-gold-300">
            <Gem className="w-3.5 h-3.5" /> {room.goldFound}/{room.goldTotal} gold
          </span>
          <span className="flex items-center gap-1.5 text-sm text-fire-400">
            <Flame className="w-3.5 h-3.5" /> {room.fireFound}/{room.fireTotal} fire
          </span>
        </div>

        {/* Continue */}
        <div className="flex justify-center">
          <Button variant="gold" className="gap-2" onClick={continueRound}>
            {isLastRound ? 'End game' : `Continue to Round ${room.currentRound + 1}`}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
