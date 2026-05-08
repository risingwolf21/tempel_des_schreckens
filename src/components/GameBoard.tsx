import { Flame, Gem, KeyRound, LogOut, Shield, Sword, Wind } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ChamberCard } from './ChamberCard'
import { useGame } from '@/context/GameContext'
import { getMyDistributionSummary, getPlayerChambers } from '@/lib/gameLogic'
import type { Player } from '@/types/game'

export function GameBoard() {
  const { state, openChamber, resetToLobby } = useGame()
  const { room, myPlayerId } = state
  if (!room) return null

  const players = Object.values(room.players)
  const me = room.players[myPlayerId]
  const amKeyholder = me?.isKeyholder ?? false
  const amHost = room.hostId === myPlayerId
  const myDist = getMyDistributionSummary(room, myPlayerId)
  const keyholder = players.find(p => p.isKeyholder)

  const goldPct = Math.round((room.goldFound / room.goldTotal) * 100)

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col">

      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-stone-950/95 backdrop-blur border-b border-border/50 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-4 flex-wrap">

          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-gold-400" />
            <span className="text-sm font-semibold text-gold-300">
              Round {room.currentRound} <span className="text-muted-foreground font-normal">/ 4</span>
            </span>
          </div>

          <Separator orientation="vertical" className="h-5" />

          {/* Round progress dots */}
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map(r => (
              <div
                key={r}
                className={`w-2 h-2 rounded-full transition-colors ${
                  r < room.currentRound
                    ? 'bg-gold-500'
                    : r === room.currentRound
                    ? 'bg-gold-400 ring-2 ring-gold-400/30'
                    : 'bg-muted'
                }`}
              />
            ))}
          </div>

          <div className="ml-auto flex items-center gap-4">
            {/* Gold counter */}
            <div className="flex items-center gap-1.5">
              <Gem className="w-4 h-4 text-gold-400" />
              <span className="text-sm">
                <span className="text-gold-300 font-semibold">{room.goldFound}</span>
                <span className="text-muted-foreground">/{room.goldTotal}</span>
              </span>
              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-gold-500 transition-all duration-500 rounded-full"
                  style={{ width: `${goldPct}%` }}
                />
              </div>
            </div>

            {/* Fire counter */}
            <div className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-fire-400" />
              <span className="text-sm">
                <span className={room.fireFound > 0 ? 'text-fire-300 font-semibold' : 'text-muted-foreground'}>
                  {room.fireFound}
                </span>
                <span className="text-muted-foreground">/{room.fireTotal}</span>
              </span>
            </div>

            {/* Host-only: end game, return to lobby */}
            {amHost && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground gap-1.5 text-xs"
                onClick={resetToLobby}
                title="End game and return to lobby"
              >
                <LogOut className="w-3.5 h-3.5" />
                End Game
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 space-y-4">

        {/* Keyholder action prompt */}
        {amKeyholder && (
          <div className="rounded-xl border border-gold-500/40 bg-gold-950/20 px-4 py-3 flex items-center gap-3">
            <KeyRound className="w-5 h-5 text-gold-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-gold-300">You hold the key</p>
              <p className="text-xs text-muted-foreground">
                Click any face-down chamber that doesn't belong to you to open it.
                {room.chambersOpenedThisRound > 0 && ` (${room.chambersOpenedThisRound}/${players.length} opened this round)`}
              </p>
            </div>
          </div>
        )}

        {!amKeyholder && keyholder && (
          <div className="rounded-xl border border-border/40 bg-card/40 px-4 py-3 flex items-center gap-3">
            <KeyRound className="w-4 h-4 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">{keyholder.name}</span> holds the key
              {' '}— waiting for them to open a chamber
              {' '}({room.chambersOpenedThisRound}/{players.length} this round)
            </p>
          </div>
        )}

        {/* Player chamber rows */}
        <div className="space-y-3">
          {players.map(player => (
            <PlayerRow
              key={player.id}
              player={player}
              room={room}
              myPlayerId={myPlayerId}
              amKeyholder={amKeyholder}
              onOpenChamber={openChamber}
            />
          ))}
        </div>
      </main>

      {/* Bottom bar — my private distribution */}
      <footer className="sticky bottom-0 bg-stone-950/95 backdrop-blur border-t border-border/50 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-4 flex-wrap">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Your cards:</span>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5 text-gold-300">
              <Gem className="w-3.5 h-3.5" />
              {myDist.gold} gold
            </span>
            <span className="flex items-center gap-1.5 text-fire-400">
              <Flame className="w-3.5 h-3.5" />
              {myDist.fire} fire
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <Wind className="w-3.5 h-3.5" />
              {myDist.empty} empty
            </span>
            <span className="text-muted-foreground text-xs">({myDist.total} unopened)</span>
          </div>
          <div className="ml-auto">
            {me?.role === 'adventurer'
              ? <Badge variant="adventurer"><Sword className="w-3 h-3" /> Adventurer</Badge>
              : <Badge variant="guardian"><Shield className="w-3 h-3" /> Guardian</Badge>
            }
          </div>
        </div>
      </footer>
    </div>
  )
}

interface PlayerRowProps {
  player: Player
  room: ReturnType<typeof useGame>['state']['room']
  myPlayerId: string
  amKeyholder: boolean
  onOpenChamber: (id: string) => void
}

function PlayerRow({ player, room, myPlayerId, amKeyholder, onOpenChamber }: PlayerRowProps) {
  if (!room) return null
  const isMe = player.id === myPlayerId
  const chambers = getPlayerChambers(room, player.id)

  return (
    <div
      className={`
        rounded-xl border p-4 space-y-3 transition-colors
        ${player.isKeyholder
          ? 'border-gold-500/50 bg-gold-950/10'
          : isMe
          ? 'border-blue-500/30 bg-blue-950/10'
          : 'border-border/50 bg-card/30'
        }
      `}
    >
      <div className="flex items-center gap-2.5">
        <Avatar className="h-7 w-7">
          <AvatarFallback className={`text-xs ${isMe ? 'bg-blue-800/50 text-blue-300' : 'bg-secondary text-secondary-foreground'}`}>
            {player.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className={`text-sm font-medium ${isMe ? 'text-blue-200' : 'text-foreground'}`}>
          {player.name}
          {isMe && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
        </span>
        {player.isKeyholder && (
          <Badge variant="gold" className="gap-1 text-xs">
            <KeyRound className="w-2.5 h-2.5" />
            Keyholder
          </Badge>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {chambers.filter(c => !c.isOpened).length} remaining
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {chambers.map(chamber => (
          <ChamberCard
            key={chamber.id}
            chamber={chamber}
            isClickable={amKeyholder && !isMe && !chamber.isOpened}
            onClick={() => onOpenChamber(chamber.id)}
          />
        ))}
        {chambers.length === 0 && (
          <span className="text-xs text-muted-foreground italic">No chambers remaining</span>
        )}
      </div>
    </div>
  )
}
