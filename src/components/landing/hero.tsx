import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { DashboardPreview } from '~/components/landing/dashboard-preview'

function HeroMark() {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
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

const proofItems = [
  { title: 'Google Sheets', text: 'ربط مباشر' },
  { title: 'Realtime', text: 'تحديث لحظي' },
  { title: 'RTL عربي', text: 'مصمم لفريقك' },
  { title: 'متعدد الأدوار', text: 'صلاحيات واضحة' },
]

export function Hero() {
  return (
    <section className="lp-hero" id="top">
      <div className="lp-hero-glow" />
      <div className="lp-hero-grid" aria-hidden="true" />
      <div className="lp-hero-speedlines" aria-hidden="true" />
      <HeroMark />

      <div className="lp-hero-inner">
        <span className="lp-eyebrow">
          <span className="lp-dot" /> منصّة تشغيل للمتاجر الجزائرية
          <span className="lp-eyebrow-extra">
            <span className="lp-eyebrow-sep">/</span>
            الدفع عند الاستلام
          </span>
        </span>

        <h1>
          من أول طلب
          <span> إلى آخر تسليم.</span>
          <strong> بسرعة الفهد.</strong>
        </h1>

        <p className="lp-hero-sub">
          حوّل Google Sheets إلى غرفة عمليات حقيقية: طلبات، عملاء، مركز اتصال، توصيل وتقارير في
          واجهة عربية واحدة.
        </p>

        <div className="lp-hero-cta">
          <Link to="/auth" className="lp-btn lp-btn-cta">
            ابدأ مجاناً
            <span aria-hidden="true">←</span>
          </Link>
          <a href="#product" className="lp-btn lp-btn-ghost-dark">
            استكشف المنصّة
            <span aria-hidden="true">↓</span>
          </a>
        </div>

        <div className="lp-hero-proof" aria-label="قدرات T-Flow">
          {proofItems.map((item) => (
            <div key={item.title}>
              <i aria-hidden="true" />
              <span>
                <strong>{item.title}</strong>
                <small>{item.text}</small>
              </span>
            </div>
          ))}
        </div>

        <div className="lp-product-shell" id="product">
          <div className="lp-product-shell-head">
            <div>
              <span className="lp-product-live">
                <i /> بيانات مباشرة
              </span>
              <strong>شاهد متجرك كاملاً من شاشة واحدة</strong>
            </div>
            <small>T‑FLOW / OPERATIONS OS</small>
          </div>
          <DashboardPreview />
        </div>
      </div>
    </section>
  )
}
