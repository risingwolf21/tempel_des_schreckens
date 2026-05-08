import { useState } from 'react'
import { Flame, KeyRound, Sword } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useGame } from '@/context/GameContext'

export function LandingScreen() {
  const { createRoom } = useGame()
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) { setError('Enter your name first'); return }
    if (trimmed.length > 20) { setError('Name too long (max 20 chars)'); return }
    createRoom(trimmed)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-950 px-4">
      {/* Background texture overlay */}
      <div className="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTAgMCBMNjAgNjAgTTYwIDAgTDAgNjAiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9zdmc+')] opacity-40 pointer-events-none" />

      <div className="relative z-10 w-full max-w-md space-y-10 text-center">
        {/* Title block */}
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-3 text-gold-400">
            <Flame className="w-7 h-7" />
            <KeyRound className="w-9 h-9" />
            <Flame className="w-7 h-7" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gold-300 drop-shadow-[0_0_20px_rgba(245,158,11,0.4)]">
            Tempel des Schreckens
          </h1>
          <p className="text-muted-foreground text-sm">Temple of Terrors · 3–10 players</p>
        </div>

        {/* Flavour text */}
        <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
          Adventurers seek the temple's gold. Guardians protect it with fire and deceit.
          Four rounds. One winning team.
        </p>

        {/* Form */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-5 shadow-2xl">
          <div className="space-y-2 text-left">
            <Label htmlFor="player-name" className="text-slate-300">Your name</Label>
            <Input
              id="player-name"
              placeholder="Enter your name…"
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              maxLength={20}
              className="bg-background/60 border-border/80 text-foreground placeholder:text-muted-foreground/60"
              autoFocus
            />
            {error && <p className="text-fire-400 text-xs">{error}</p>}
          </div>

          <Button
            variant="gold"
            size="lg"
            className="w-full"
            onClick={handleCreate}
          >
            <Sword className="w-4 h-4" />
            Create Room
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">multiplayer</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            Share the room code with friends after creating a room.
            <br />
            They can join via the code displayed in the lobby.
          </p>
        </div>

        {/* Rules hint */}
        <p className="text-xs text-muted-foreground/50">
          3–10 players · 4 rounds · Hidden roles
        </p>
      </div>
    </div>
  )
}
