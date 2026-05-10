import { useState } from 'react'
import { Check, Copy, Crown, Plus, Sword, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { useGame } from '@/context/GameContext'
import { getDistribution } from '@/lib/gameLogic'

const DEMO_NAMES = [
  'Elena', 'Marcus', 'Aria', 'Tobias', 'Nora',
  'Felix', 'Lena', 'Hugo', 'Mira', 'Leon',
]

export function LobbyScreen() {
  const { state, addDemoPlayer, startGame, resetGame } = useGame()
  const { room, myPlayerId } = state
  const [copied, setCopied] = useState(false)
  const [demoName, setDemoName] = useState('')

  if (!room) return null

  const players = Object.values(room.players)
  const playerCount = players.length
  const isHost = room.hostId === myPlayerId
  const canStart = playerCount >= 3
  const dist = canStart ? getDistribution(playerCount) : null

  function copyCode() {
    const url = `${window.location.origin}${window.location.pathname}?join=${room!.id}`
    navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleAddDemo() {
    const trimmed = demoName.trim()
    if (!trimmed) {
      const unused = DEMO_NAMES.find(n => !players.some(p => p.name === n))
      addDemoPlayer(unused ?? `Player ${playerCount + 1}`)
    } else {
      addDemoPlayer(trimmed)
      setDemoName('')
    }
  }

  function getInitials(name: string) {
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold text-gold-300">Waiting Room</h2>
          <p className="text-muted-foreground text-sm">Share the code with your friends</p>
        </div>

        {/* Room code */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <p className="text-xs text-muted-foreground text-center uppercase tracking-widest">Invite Link</p>
          <Button variant="outline" className="w-full gap-2" onClick={copyCode}>
            {copied
              ? <><Check className="w-4 h-4 text-green-400" /> Link copied!</>
              : <><Copy className="w-4 h-4" /> Copy invite link</>
            }
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Room code: <span className="font-mono font-semibold text-gold-300 tracking-widest">{room.id}</span>
          </p>
        </div>

        {/* Player list */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">
              Players ({playerCount}/10)
            </span>
            {dist && (
              <span className="text-xs text-muted-foreground">
                {dist.adventurers} adventurers · {dist.guardians} guardians
              </span>
            )}
          </div>
          <ul className="divide-y divide-border/50">
            {players.map(player => (
              <li key={player.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className={
                    player.id === myPlayerId
                      ? 'bg-gold-800/50 text-gold-300 text-xs'
                      : 'bg-secondary text-secondary-foreground text-xs'
                  }>
                    {getInitials(player.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 text-sm text-foreground">
                  {player.name}
                  {player.id === myPlayerId && (
                    <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  {player.isHost && (
                    <Badge variant="gold" className="gap-1">
                      <Crown className="w-3 h-3" /> Host
                    </Badge>
                  )}
                  {player.isDemo && (
                    <Badge variant="secondary" className="text-xs">Demo</Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Add demo players (only visible to host, in local mode) */}
        {isHost && (
          <div className="bg-card border border-border/60 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add demo players to test locally (no Firebase needed)</span>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Demo player name (optional)…"
                value={demoName}
                onChange={e => setDemoName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddDemo()}
                className="text-sm bg-background/50"
                disabled={playerCount >= 10}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddDemo}
                disabled={playerCount >= 10}
                className="shrink-0"
              >
                <Plus className="w-4 h-4" />
                Add
              </Button>
            </div>
          </div>
        )}

        <Separator className="opacity-20" />

        {/* Action buttons */}
        <div className="space-y-3">
          {isHost ? (
            <>
              {!canStart && (
                <p className="text-xs text-muted-foreground text-center">
                  Need at least 3 players to start
                </p>
              )}
              <Button
                variant="gold"
                size="lg"
                className="w-full"
                disabled={!canStart}
                onClick={startGame}
              >
                <Sword className="w-4 h-4" />
                Start Game
              </Button>
            </>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              Waiting for the host to start the game…
            </p>
          )}
          <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={resetGame}>
            Leave Room
          </Button>
        </div>
      </div>
    </div>
  )
}
