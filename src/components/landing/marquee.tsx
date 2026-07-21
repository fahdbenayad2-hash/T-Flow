import { useEffect, useRef } from 'react'

const FEATURES = [
  'إدارة الطلبات', 'قاعدة العملاء', 'مركز الاتصال', 'تتبّع التوصيل',
  'تحليل الأرباح', 'التقارير', 'صلاحيات الأدوار', 'إشعارات لحظية',
]
const TECH = ['GOOGLE SHEETS', 'SUPABASE', 'REALTIME', 'RTL', 'TANSTACK', 'POSTGRESQL']

function Ticker({ items, reverse = false, speed = 26 }: { items: string[]; reverse?: boolean; speed?: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let pos = reverse ? -50 : 0
    let raf: number
    const tick = () => {
      pos += reverse ? 0.15 : -0.15
      if (!reverse && pos <= -50) pos = 0
      if (reverse && pos >= 0) pos = -50
      el.style.transform = `translateX(${pos}%)`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reverse])

  return (
    <div
      ref={ref}
      style={{ animationDuration: `${speed}s` }}
      className="lp-marquee-track"
    >
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
      {items.map((item) => (
        <span key={`dup-${item}`}>{item}</span>
      ))}
    </div>
  )
}

export function Marquee() {
  return (
    <>
      <div className="lp-marquee">
        <div className="lp-marquee-track" style={{ animation: 'lpScrollTicker 26s linear infinite' }}>
          {FEATURES.map((f) => <span key={f}>{f}</span>)}
          {FEATURES.map((f) => <span key={`d-${f}`}>{f}</span>)}
        </div>
      </div>
      <div className="lp-marquee lp-sub">
        <div className="lp-marquee-track" style={{ animation: 'lpScrollTickerRev 32s linear infinite' }}>
          {TECH.map((t) => <span key={t}>{t}</span>)}
          {TECH.map((t) => <span key={`d-${t}`}>{t}</span>)}
        </div>
      </div>
    </>
  )
}
