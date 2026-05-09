import { Flame, Gem, LogOut, RotateCcw, Shield, Sword, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { useGame } from '@/context/GameContext'

const WIN_CONDITION_LABELS: Record<string, string> = {
  'all-gold':      'All Gold chambers were found!',
  'all-fire':      'All Fire traps were triggered!',
  'time-up':       'Four rounds passed without all Gold being found.',
  'no-gold-round': 'A round ended with no Gold found.',
}

export function EndScreen() {
  const { state, resetToLobby, resetGame } = useGame()
  const { room, myPlayerId } = state
  if (!room) return null

  const isAdventurersWin = room.winner === 'adventurers'
  const players = Object.values(room.players)
  const adventurers = players.filter(p => p.role === 'adventurer')
  const guardians = players.filter(p => p.role === 'guardian')
  const me = room.players[myPlayerId]
  const amHost = room.hostId === myPlayerId
  const iWon =
    (isAdventurersWin && me?.role === 'adventurer') ||
    (!isAdventurersWin && me?.role === 'guardian')

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg space-y-8">

        {/* Winner banner */}
        <div
          className={`
            rounded-2xl border-2 p-8 text-center space-y-3
            ${isAdventurersWin
              ? 'border-gold-500/60 bg-gold-950/20 shadow-[0_0_40px_rgba(245,158,11,0.2)]'
              : 'border-fire-500/60 bg-fire-950/20 shadow-[0_0_40px_rgba(249,115,22,0.2)]'
            }
          `}
        >
          <div className="text-5xl mb-2">
            {isAdventurersWin ? '🏆' : '🔥'}
          </div>
          <h1 className={`text-3xl font-bold ${isAdventurersWin ? 'text-gold-200' : 'text-fire-200'}`}>
            {isAdventurersWin ? 'Adventurers Win!' : 'Guardians Win!'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {room.winCondition ? WIN_CONDITION_LABELS[room.winCondition] : ''}
          </p>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
            iWon
              ? 'bg-green-500/20 text-green-300 border border-green-500/30'
              : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
          }`}>
            {iWon ? '🎉 You won!' : '😔 You lost this time'}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<Gem className="w-4 h-4 text-gold-400" />}
            label="Gold found"
            value={`${room.goldFound}/${room.goldTotal}`}
          />
          <StatCard
            icon={<Flame className="w-4 h-4 text-fire-400" />}
            label="Fire opened"
            value={`${room.fireFound}/${room.fireTotal}`}
          />
          <StatCard
            icon={<Timer className="w-4 h-4 text-slate-400" />}
            label="Rounds played"
            value={`${Math.min(room.currentRound, 4)}/4`}
          />
        </div>

        {/* Role reveal */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-slate-300">Roles revealed</h3>
          </div>
          <div className="divide-y divide-border/50">
            <TeamSection
              title="Adventurers"
              icon={<Sword className="w-4 h-4 text-blue-400" />}
              players={adventurers}
              myPlayerId={myPlayerId}
              variant="adventurer"
            />
            <Separator />
            <TeamSection
              title="Guardians"
              icon={<Shield className="w-4 h-4 text-purple-400" />}
              players={guardians}
              myPlayerId={myPlayerId}
              variant="guardian"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {amHost ? (
            <Button variant="gold" size="lg" className="w-full" onClick={resetToLobby}>
              <RotateCcw className="w-4 h-4" />
              Play Again (same players)
            </Button>
          ) : (
            <div className="rounded-lg border border-border/50 bg-card/30 px-4 py-3 text-center text-sm text-muted-foreground">
              Waiting for the host to start a new game…
            </div>
          )}
          <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={resetGame}>
            <LogOut className="w-4 h-4" />
            Leave Room
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 text-center space-y-1">
      <div className="flex justify-center">{icon}</div>
      <div className="text-lg font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function TeamSection({
  title,
  icon,
  players,
  myPlayerId,
  variant,
}: {
  title: string
  icon: React.ReactNode
  players: ReturnType<typeof Object.values<import('@/types/game').Player>>
  myPlayerId: string
  variant: 'adventurer' | 'guardian'
}) {
  return (
    <div className="p-4 space-y-2">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-sm font-medium text-slate-300">{title}</span>
        <Badge variant={variant} className="ml-auto">{players.length}</Badge>
      </div>
      {players.map(p => (
        <div key={p.id} className="flex items-center gap-2.5">
          <Avatar className="h-7 w-7">
            <AvatarFallback className={`text-xs ${
              variant === 'adventurer'
                ? 'bg-blue-800/50 text-blue-300'
                : 'bg-purple-800/50 text-purple-300'
            }`}>
              {p.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-foreground">
            {p.name}
            {p.id === myPlayerId && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
          </span>
        </div>
      ))}
    </div>
  )
}
