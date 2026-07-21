import { useEffect, useRef } from 'react'

const stats = [
  { label: 'طلبات اليوم', value: '28', emoji: '⏱' },
  { label: 'الإيرادات', value: '184,500 DZD', emoji: '💰' },
  { label: 'معدل التأكيد', value: '86%', emoji: '✔' },
]

const recentOrders = [
  { client: 'أحمد بن علي', product: 'تيشيرت رياضي, L', status: 'مؤكد', color: '#2563EB' },
  { client: 'سارة محمود', product: 'فستان كلاسيكي, M', status: 'مشحون', color: '#7C3AED' },
  { client: 'خالد ناصر', product: 'حذاء رياضي, 42', status: 'تم التسليم', color: '#16A34A' },
  { client: 'مريم عبد الله', product: 'تيشيرت رياضي, S', status: 'قيد المعالجة', color: '#F59E0B' },
]

const bars = [
  { label: 'معالجة', pct: 25, color: '#F59E0B' },
  { label: 'مؤكد', pct: 30, color: '#2563EB' },
  { label: 'مشحون', pct: 20, color: '#7C3AED' },
  { label: 'تم', pct: 15, color: '#16A34A' },
  { label: 'ملغي', pct: 10, color: '#6B7280' },
]

export function DashboardPreview() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!window.matchMedia('(pointer:fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const wrap = wrapRef.current
    const card = cardRef.current
    if (!wrap || !card) return

    const onMove = (e: MouseEvent) => {
      const r = wrap.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width - 0.5
      const py = (e.clientY - r.top) / r.height - 0.5
      card.style.transform = `rotateX(${8 - py * 10}deg) rotateY(${px * 10}deg)`
    }
    const onLeave = () => {
      card.style.transform = 'rotateX(8deg) rotateY(0deg)'
    }

    wrap.addEventListener('mousemove', onMove)
    wrap.addEventListener('mouseleave', onLeave)
    return () => {
      wrap.removeEventListener('mousemove', onMove)
      wrap.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return (
    <div ref={wrapRef} className="lp-preview-wrap" aria-hidden="true">
      <div ref={cardRef} className="lp-preview">
        <div className="lp-preview-bar">
          <div className="lp-dot-r" />
          <div className="lp-dot-y" />
          <div className="lp-dot-g" />
          <div className="lp-bar-title">لوحة التحكم — T-Flow</div>
        </div>

        <div className="lp-preview-body">
          <div className="lp-kpis">
            {stats.map((s) => (
              <div key={s.label} className="lp-kpi">
                <div className="lp-kpi-ic">{s.emoji}</div>
                <div>
                  <b>{s.value}</b>
                  <span>{s.label}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="lp-grid2">
            <div className="lp-panel">
              <h4>آخر الطلبات</h4>
              {recentOrders.map((o) => (
                <div key={o.client} className="lp-order-row">
                  <div>
                    <b>{o.client}</b>
                    <small>{o.product}</small>
                  </div>
                  <span style={{ color: o.color }}>{o.status}</span>
                </div>
              ))}
            </div>

            <div className="lp-panel">
              <h4>توزيع الحالات</h4>
              <div className="lp-bars">
                {bars.map((b) => (
                  <div key={b.label} className="lp-bar-col">
                    <div className="lp-bar-track">
                      <div className="lp-bar-fill" style={{ height: `${b.pct}%`, background: b.color }} />
                    </div>
                    <small style={{ fontSize: '.65rem', color: '#6B7280' }}>{b.label}</small>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
