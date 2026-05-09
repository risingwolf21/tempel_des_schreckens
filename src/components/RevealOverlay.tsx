import { useEffect, useState } from 'react'
import { Flame, Gem, Wind } from 'lucide-react'
import type { Chamber } from '@/types/game'

const CONTENT_STYLES = {
  gold: {
    outer: 'bg-gradient-to-b from-gold-600 to-gold-900 border-gold-400',
    inner: 'bg-gold-400/20',
    icon:  <Gem className="w-14 h-14 text-gold-200" />,
    glow:  'shadow-[0_0_60px_rgba(245,158,11,0.85)]',
    label: 'text-gold-200',
    text:  'GOLD',
  },
  fire: {
    outer: 'bg-gradient-to-b from-fire-600 to-red-900 border-fire-400',
    inner: 'bg-fire-400/20',
    icon:  <Flame className="w-14 h-14 text-fire-200" />,
    glow:  'shadow-[0_0_60px_rgba(249,115,22,0.85)]',
    label: 'text-fire-200',
    text:  'FIRE TRAP',
  },
  empty: {
    outer: 'bg-gradient-to-b from-slate-600 to-slate-800 border-slate-400',
    inner: 'bg-slate-500/20',
    icon:  <Wind className="w-12 h-12 text-slate-300" />,
    glow:  '',
    label: 'text-slate-300',
    text:  'EMPTY',
  },
}

interface Props {
  chamber: Chamber
  playerName: string
  onDismiss: () => void
}

export function RevealOverlay({ chamber, playerName, onDismiss }: Props) {
  const [flipped, setFlipped]   = useState(false)
  const [opacity, setOpacity]   = useState(0)

  useEffect(() => {
    // Fade in backdrop
    const raf = requestAnimationFrame(() => setOpacity(1))
    // Flip card after pop-in completes
    const flipTimer    = setTimeout(() => setFlipped(true), 500)
    // Fade out then dismiss
    const fadeOutTimer = setTimeout(() => {
      setOpacity(0)
      setTimeout(onDismiss, 350)
    }, 2700)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(flipTimer)
      clearTimeout(fadeOutTimer)
    }
  }, [onDismiss])

  const s = CONTENT_STYLES[chamber.content]

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 cursor-pointer"
      style={{
        backgroundColor: `rgba(0,0,0,${opacity * 0.75})`,
        backdropFilter: `blur(${opacity * 6}px)`,
        transition: 'background-color 0.35s ease, backdrop-filter 0.35s ease',
      }}
      onClick={onDismiss}
    >
      {/* Player label */}
      <p className="text-sm text-muted-foreground animate-[fade-in_0.3s_ease-out]">
        {playerName}&apos;s chamber
      </p>

      {/* 3D flip card */}
      <div style={{ perspective: '700px' }}>
        <div
          style={{
            width: '144px',
            height: '208px',
            position: 'relative',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.55s cubic-bezier(0.4,0,0.2,1)',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
          className="animate-[pop-in_0.35s_cubic-bezier(0.34,1.56,0.64,1)_forwards]"
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

          {/* Back face — revealed content */}
          <div
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            className={`absolute inset-0 rounded-2xl border-2 flex flex-col items-center justify-center gap-3 ${s.outer} ${s.glow}`}
          >
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${s.inner}`}>
              {s.icon}
            </div>
            <span className={`text-xs font-bold tracking-widest uppercase ${s.label}`}>
              {s.text}
            </span>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground/50 animate-[fade-in_0.3s_0.2s_ease-out_both]">
        tap to dismiss
      </p>
    </div>
  )
}
