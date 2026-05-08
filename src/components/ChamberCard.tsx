import { Flame, Gem, Wind } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Chamber } from '@/types/game'

interface ChamberCardProps {
  chamber: Chamber
  isClickable: boolean
  onClick?: () => void
  isJustOpened?: boolean
}

export function ChamberCard({ chamber, isClickable, onClick, isJustOpened }: ChamberCardProps) {
  if (chamber.isOpened) {
    return (
      <OpenedCard content={chamber.content} isJustOpened={isJustOpened} />
    )
  }

  return (
    <button
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      title={isClickable ? 'Open this chamber' : undefined}
      className={cn(
        'relative w-14 h-20 rounded-lg border-2 flex items-center justify-center transition-all duration-200 select-none',
        'bg-gradient-to-b from-slate-700 to-slate-800 border-slate-600',
        isClickable
          ? 'cursor-pointer hover:border-gold-400 hover:shadow-[0_0_12px_rgba(245,158,11,0.4)] hover:scale-105 active:scale-100'
          : 'cursor-default opacity-90',
      )}
    >
      {/* Back pattern */}
      <div className="absolute inset-0 rounded-[6px] overflow-hidden opacity-30">
        <div className="w-full h-full"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.05) 3px, rgba(255,255,255,0.05) 4px)',
          }}
        />
      </div>
      <div className="relative z-10 w-6 h-6 rounded border border-slate-500/50 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-slate-500/60" />
      </div>
      {isClickable && (
        <div className="absolute inset-0 rounded-lg border-2 border-gold-400/0 hover:border-gold-400/60 transition-colors" />
      )}
    </button>
  )
}

function OpenedCard({
  content,
  isJustOpened,
}: {
  content: Chamber['content']
  isJustOpened?: boolean
}) {
  const styles = {
    gold: {
      outer: 'bg-gradient-to-b from-gold-700 to-gold-900 border-gold-500',
      inner: 'bg-gold-400/20',
      icon:  <Gem className="w-6 h-6 text-gold-300" />,
      glow:  'shadow-[0_0_16px_rgba(245,158,11,0.5)]',
      label: 'text-gold-300',
      text:  'Gold',
    },
    fire: {
      outer: 'bg-gradient-to-b from-fire-700 to-red-900 border-fire-500',
      inner: 'bg-fire-400/20',
      icon:  <Flame className="w-6 h-6 text-fire-300" />,
      glow:  'shadow-[0_0_16px_rgba(249,115,22,0.6)]',
      label: 'text-fire-300',
      text:  'Fire',
    },
    empty: {
      outer: 'bg-gradient-to-b from-slate-600 to-slate-800 border-slate-500',
      inner: 'bg-slate-500/20',
      icon:  <Wind className="w-5 h-5 text-slate-400" />,
      glow:  '',
      label: 'text-slate-400',
      text:  'Empty',
    },
  }

  const s = styles[content]

  return (
    <div
      className={cn(
        'w-14 h-20 rounded-lg border-2 flex flex-col items-center justify-center gap-1.5',
        s.outer,
        s.glow,
        isJustOpened && 'animate-[pulse_0.6s_ease-in-out_2]',
      )}
    >
      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', s.inner)}>
        {s.icon}
      </div>
      <span className={cn('text-[9px] font-semibold uppercase tracking-wider', s.label)}>
        {s.text}
      </span>
    </div>
  )
}
