import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { DashboardPreview } from '~/components/landing/dashboard-preview'

function HeroMark() {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  if (reducedMotion) {
    return <img className="lp-hero-mark" src="/cheetah-run-poster.jpg" alt="" aria-hidden="true" />
  }

  return (
    <video
      className="lp-hero-mark"
      poster="/cheetah-run-poster.jpg"
      autoPlay
      muted
      loop
      playsInline
      aria-hidden="true"
    >
      <source src="/cheetah-flow.mp4" type="video/mp4" />
    </video>
  )
}

export function Hero() {
  const visualRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!window.matchMedia('(pointer:fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const visual = visualRef.current
    if (!visual) return

    const move = (event: MouseEvent) => {
      const box = visual.getBoundingClientRect()
      const x = (event.clientX - box.left) / box.width - 0.5
      const y = (event.clientY - box.top) / box.height - 0.5
      visual.style.setProperty('--hero-x', `${x * 9}deg`)
      visual.style.setProperty('--hero-y', `${y * -7}deg`)
    }
    const reset = () => {
      visual.style.setProperty('--hero-x', '0deg')
      visual.style.setProperty('--hero-y', '0deg')
    }

    visual.addEventListener('mousemove', move)
    visual.addEventListener('mouseleave', reset)
    return () => {
      visual.removeEventListener('mousemove', move)
      visual.removeEventListener('mouseleave', reset)
    }
  }, [])

  return (
    <section className="lp-hero" id="top">
      <div className="lp-hero-scribble" aria-hidden="true">
        T‑FLOW · ORDERS · DELIVERY · REALTIME
      </div>

      <div className="lp-hero-inner">
        <div className="lp-hero-copy">
          <span className="lp-eyebrow">
            <span className="lp-dot" /> منصّة جزائرية للتجارة بالدفع عند الاستلام
          </span>

          <h1>
            خلي طلباتك
            <span> تجري أسرع.</span>
          </h1>

          <p className="lp-hero-sub">
            من أول طلب إلى آخر تسليم: اجمع متجرك، Google Sheets، فريق التأكيد وشركات التوصيل في غرفة
            عمليات واحدة.
          </p>

          <div className="lp-hero-cta">
            <Link to="/auth" className="lp-btn lp-btn-cta">
              ابدأ مجاناً <span aria-hidden="true">←</span>
            </Link>
            <a href="#how" className="lp-btn lp-btn-ghost-dark">
              شاهد كيف تعمل
            </a>
          </div>

          <div className="lp-hero-proof" aria-label="أهم مزايا المنصة">
            <span>بدون بطاقة بنكية</span>
            <span>إعداد سريع</span>
            <span>واجهة عربية 100%</span>
          </div>
        </div>

        <div ref={visualRef} className="lp-hero-visual" aria-label="T-Flow بسرعة الفهد">
          <div className="lp-hero-number" aria-hidden="true">
            01
          </div>
          <div className="lp-hero-media">
            <HeroMark />
          </div>
          <div className="lp-float-chip lp-float-chip-live">
            <i /> مباشر
            <b>28 طلب اليوم</b>
          </div>
          <div className="lp-float-chip lp-float-chip-sheet">
            <span>G</span>
            <b>Google Sheets</b>
            <small>متصل</small>
          </div>
        </div>

        <div className="lp-hero-dashboard">
          <div className="lp-hero-dashboard-label">
            <span>لوحة واحدة. رؤية كاملة.</span>
            <small>اسحب للأسفل لاكتشاف النظام</small>
          </div>
          <DashboardPreview />
        </div>
      </div>
    </section>
  )
}
