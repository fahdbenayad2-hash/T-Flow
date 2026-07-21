import { useEffect, useRef, useState } from 'react'
import { cn } from '~/lib/utils'

interface AnimatedCounterProps {
  value: number | string
  duration?: number
  prefix?: string
  suffix?: string
  className?: string
}

export function AnimatedCounter({
  value,
  duration = 800,
  prefix = '',
  suffix = '',
  className,
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState('0')
  const ref = useRef<HTMLSpanElement>(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (hasAnimated.current) {
      setDisplay(typeof value === 'number' ? String(value) : value)
      return
    }

    const numValue = typeof value === 'number' ? value : parseInt(String(value).replace(/[^0-9]/g, ''), 10)
    if (isNaN(numValue)) {
      setDisplay(typeof value === 'number' ? String(value) : value)
      return
    }

    hasAnimated.current = true
    const start = performance.now()
    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(numValue * eased)
      setDisplay(String(current))
      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }
    requestAnimationFrame(animate)
  }, [value, duration])

  return (
    <span ref={ref} className={cn('font-mono tabular-nums', className)}>
      {prefix}{display}{suffix}
    </span>
  )
}
