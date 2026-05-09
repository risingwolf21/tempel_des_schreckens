import { useEffect, useRef, useState } from 'react'
import { Flame, Gem, Wind } from 'lucide-react'
import type { Chamber } from '@/types/game'

// Displayed card size during the center animation
const W = 112
const H = 160

type Phase = 'fly-in' | 'spinning' | 'reveal' | 'fly-out'

const CONTENT_STYLES = {
  gold: {
    outer: 'bg-gradient-to-b from-gold-600 to-gold-900 border-gold-400',
    inner: 'bg-gold-400/20',
    icon:  <Gem className="w-12 h-12 text-gold-200" />,
    glow:  'shadow-[0_0_50px_rgba(245,158,11,0.8)]',
    label: 'text-gold-200',
    text:  'GOLD',
  },
  fire: {
    outer: 'bg-gradient-to-b from-fire-600 to-red-900 border-fire-400',
    inner: 'bg-fire-400/20',
    icon:  <Flame className="w-12 h-12 text-fire-200" />,
    glow:  'shadow-[0_0_50px_rgba(249,115,22,0.8)]',
    label: 'text-fire-200',
    text:  'FIRE TRAP',
  },
  empty: {
    outer: 'bg-gradient-to-b from-slate-600 to-slate-800 border-slate-400',
    inner: 'bg-slate-500/20',
    icon:  <Wind className="w-10 h-10 text-slate-300" />,
    glow:  '',
    label: 'text-slate-300',
    text:  'EMPTY',
  },
}

interface Props {
  chamber: Chamber
  playerName: string
  /** Screen-space rect of the card that was just clicked (keyholder's device only). */
  startRect: DOMRect | null
  onDone: () => void
}

export function CardRevealAnimation({ chamber, playerName, startRect, onDone }: Props) {
  const cx = window.innerWidth  / 2 - W / 2
  const cy = window.innerHeight / 2 - H / 2

  // Starting position: center of the clicked card (keyholder) or below screen (others)
  const sx = startRect ? startRect.left + startRect.width  / 2 - W / 2 : cx
  const sy = startRect ? startRect.top  + startRect.height / 2 - H / 2 : window.innerHeight + H

  // Target for fly-out: just above the top of the viewport
  const ty = -(H + 40)

  const [phase, setPhase]       = useState<Phase>('fly-in')
  const [posX, setPosX]         = useState(sx)
  const [posY, setPosY]         = useState(sy)
  const [rotDeg, setRotDeg]     = useState(0)
  const [showBack, setShowBack] = useState(false)
  const dismissedRef            = useRef(false)

  const dismiss = () => {
    if (!dismissedRef.current) {
      dismissedRef.current = true
      onDone()
    }
  }

  useEffect(() => {
    // Phase 1 — fly-in to center  (starts immediately after first paint)
    const rafId = requestAnimationFrame(() => requestAnimationFrame(() => {
      setPosX(cx)
      setPosY(cy)
    }))

    // Phase 2 — spin 3 full rotations (1080°), still face-down
    const t1 = setTimeout(() => {
      setPhase('spinning')
      setRotDeg(1080)
    }, 380)

    // Phase 3 — flip another 180° to reveal content
    const t2 = setTimeout(() => {
      setPhase('reveal')
      setRotDeg(1260)
      // Show back face halfway through the flip
      setTimeout(() => setShowBack(true), 200)
    }, 1580)

    // Phase 4 — fly-out upward
    const t3 = setTimeout(() => {
      setPhase('fly-out')
      setPosY(ty)
    }, 2100)

    // Done
    const t4 = setTimeout(dismiss, 2450)

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const posTransition =
    phase === 'fly-in'  ? 'transform 0.35s cubic-bezier(0.25,0.46,0.45,0.94)' :
    phase === 'fly-out' ? 'transform 0.30s cubic-bezier(0.55,0,1,0.45)'       : 'none'

  const rotTransition =
    phase === 'spinning' ? 'transform 1.15s cubic-bezier(0.45,0.05,0.55,0.95)' :
    phase === 'reveal'   ? 'transform 0.45s cubic-bezier(0.4,0,0.2,1)'         : 'none'

  const s = CONTENT_STYLES[chamber.content]

  return (
    <div className="fixed inset-0 z-50" style={{ perspective: '900px' }}>
      {/* Backdrop — fades out during fly-out */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          phase === 'fly-out' ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={dismiss}
      />

      {/* Player label (visible while at center) */}
      {(phase === 'spinning' || phase === 'reveal') && (
        <div
          className="absolute text-sm text-muted-foreground animate-[fade-in_0.2s_ease-out] text-center pointer-events-none"
          style={{ left: cx, top: cy - 32, width: W }}
        >
          {playerName}&apos;s chamber
        </div>
      )}

      {/* Position wrapper */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: W, height: H,
          transform: `translate(${posX}px, ${posY}px)`,
          transition: posTransition,
        }}
      >
        {/* Rotation wrapper */}
        <div
          style={{
            width: '100%', height: '100%',
            transformStyle: 'preserve-3d',
            transform: `rotateY(${rotDeg}deg)`,
            transition: rotTransition,
          }}
        >
          {/* Front face — face-down */}
          <div
            style={{ backfaceVisibility: 'hidden' }}
            className="absolute inset-0 rounded-2xl border-2 bg-gradient-to-b from-slate-700 to-slate-800 border-slate-600 flex items-center justify-center overflow-hidden"
          >
            <div
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.05) 4px, rgba(255,255,255,0.05) 5px)',
              }}
            />
            <div className="relative z-10 w-10 h-10 rounded border border-slate-500/50 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-slate-500/60" />
            </div>
          </div>

          {/* Back face — revealed content (rotated 180° so it faces forward when flipped) */}
          <div
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            className={`absolute inset-0 rounded-2xl border-2 flex flex-col items-center justify-center gap-3 ${s.outer} ${showBack ? s.glow : ''}`}
          >
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${s.inner}`}>
              {s.icon}
            </div>
            <span className={`text-xs font-bold tracking-widest uppercase ${s.label}`}>
              {s.text}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
