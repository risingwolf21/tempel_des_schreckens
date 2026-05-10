import { useState } from 'react'
import { Flame, KeyRound, Loader2, Sword } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useGame } from '@/context/GameContext'
import { firebaseConfigured } from '@/lib/firebase'

type Mode = 'create' | 'join'

export function LandingScreen() {
  const { state, createRoom, joinRoom } = useGame()
  const { isLoading, joinError } = state

  // Read invite code from URL once on mount, then clean the URL
  const [inviteCode] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('join')?.trim().toUpperCase() ?? null
    if (code) history.replaceState({}, '', window.location.pathname)
    return code
  })

  const [mode, setMode] = useState<Mode>(inviteCode ? 'join' : 'create')
  const [name, setName] = useState('')
  const [code, setCode] = useState(inviteCode ?? '')
  const [error, setError] = useState('')

  function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) { setError('Enter your name first'); return }
    if (trimmed.length > 20) { setError('Name too long (max 20 chars)'); return }
    setError('')
    createRoom(trimmed)
  }

  function handleJoin() {
    const trimmedCode = code.trim().toUpperCase()
    const trimmedName = name.trim()
    if (!trimmedName) { setError('Enter your name first'); return }
    if (trimmedName.length > 20) { setError('Name too long (max 20 chars)'); return }
    if (trimmedCode.length !== 6) { setError('Room code must be 6 characters'); return }
    setError('')
    joinRoom(trimmedCode, trimmedName)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return
    mode === 'create' ? handleCreate() : handleJoin()
  }

  const displayError = error || joinError

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-950 px-4">
      <div className="fixed inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.015) 3px, rgba(255,255,255,0.015) 4px)',
        }}
      />

      <div className="relative z-10 w-full max-w-md space-y-10 text-center">

        {/* Title */}
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

        <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
          Adventurers seek the temple's gold. Guardians protect it with fire and deceit.
          Four rounds. One winning team.
        </p>

        {/* Card */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-5 shadow-2xl">

          {inviteCode ? (
            /* Invite link flow — just ask for a name */
            <div className="space-y-1 text-center">
              <p className="text-sm text-muted-foreground">You&apos;ve been invited to join room</p>
              <p className="text-2xl font-mono font-bold tracking-[0.25em] text-gold-300">{inviteCode}</p>
            </div>
          ) : (
            /* Mode toggle */
            <div className="flex rounded-lg overflow-hidden border border-border">
              <button
                onClick={() => { setMode('create'); setError('') }}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  mode === 'create'
                    ? 'bg-gold-500/20 text-gold-300 border-r border-border'
                    : 'text-muted-foreground hover:text-foreground border-r border-border'
                }`}
              >
                Create Room
              </button>
              <button
                onClick={() => { setMode('join'); setError('') }}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  mode === 'join'
                    ? 'bg-gold-500/20 text-gold-300'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Join Room
              </button>
            </div>
          )}

          {/* Name field — shared */}
          <div className="space-y-2 text-left">
            <Label htmlFor="player-name" className="text-slate-300">Your name</Label>
            <Input
              id="player-name"
              placeholder="Enter your name…"
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              onKeyDown={handleKeyDown}
              maxLength={20}
              className="bg-background/60"
              autoFocus
            />
          </div>

          {/* Join-only: room code field (hidden when joining via invite link) */}
          {mode === 'join' && !inviteCode && (
            <div className="space-y-2 text-left">
              <Label htmlFor="room-code" className="text-slate-300">Room code</Label>
              <Input
                id="room-code"
                placeholder="6-character code e.g. A3K7P2"
                value={code}
                onChange={e => { setCode(e.target.value.toUpperCase()); setError('') }}
                onKeyDown={handleKeyDown}
                maxLength={6}
                className="bg-background/60 font-mono tracking-widest uppercase"
              />
              {!firebaseConfigured && (
                <p className="text-xs text-amber-500/80">
                  Firebase is not configured — joining requires Firebase setup.
                </p>
              )}
            </div>
          )}

          {/* Error */}
          {displayError && (
            <p className="text-fire-400 text-xs text-left">{displayError}</p>
          )}

          {/* CTA */}
          {mode === 'create' && !inviteCode ? (
            <Button
              variant="gold"
              size="lg"
              className="w-full"
              onClick={handleCreate}
              disabled={isLoading}
            >
              {isLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
                : <><Sword className="w-4 h-4" /> Create Room</>
              }
            </Button>
          ) : (
            <Button
              variant="gold"
              size="lg"
              className="w-full"
              onClick={handleJoin}
              disabled={isLoading || !firebaseConfigured}
            >
              {isLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Joining…</>
                : <><KeyRound className="w-4 h-4" /> Join Room</>
              }
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground/50">
          3–10 players · 4 rounds · Hidden roles
        </p>
      </div>
    </div>
  )
}
