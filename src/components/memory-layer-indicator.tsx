import type { Icon } from '@phosphor-icons/react'

export type MemoryLayerColor = 'blue' | 'amber' | 'green' | 'primary'

export type MemoryLayerConfig = {
  name: string
  icon: Icon
  color: MemoryLayerColor
  value: number
  /** Multiplier for the progress bar width calculation (default: 10) */
  progressMultiplier?: number
}

const colorClasses: Record<
  MemoryLayerColor,
  { bg: string; text: string; bar: string }
> = {
  blue: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-600',
    bar: 'bg-blue-500',
  },
  amber: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-600',
    bar: 'bg-amber-500',
  },
  green: {
    bg: 'bg-green-500/10',
    text: 'text-green-600',
    bar: 'bg-green-500',
  },
  primary: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    bar: 'bg-primary',
  },
}

export function MemoryLayerIndicator({
  name,
  icon: IconComponent,
  color,
  value,
  progressMultiplier = 10,
}: MemoryLayerConfig) {
  const classes = colorClasses[color]
  const progressWidth = Math.min(value * progressMultiplier, 100)

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex size-6 items-center justify-center rounded ${classes.bg} ${classes.text}`}
      >
        <IconComponent className="size-3" weight="fill" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{name}</span>
          <span className="font-medium">{value}</span>
        </div>
        <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full ${classes.bar} transition-all`}
            style={{ width: `${progressWidth}%` }}
          />
        </div>
      </div>
    </div>
  )
}
