import { Link } from '@tanstack/react-router'

export function Cta() {
  return (
    <section className="lp-section">
      <div style={{ maxWidth: 1180, margin: '0 auto', paddingInline: 24 }}>
        <div className="lp-cta-box">
          <div className="lp-hero-glow" />
          <div className="lp-orb lp-orb-1" style={{ opacity: .6 }} />
          <div style={{ position: 'relative' }}>
            <h2>جهّز غرفة عملياتك اليوم</h2>
            <p>انضم إلى البائعين الذين يديرون طلباتهم بسرعة الفهد — مجانًا، بلا عقود، بلا تعقيد.</p>
            <Link to="/auth" className="lp-btn lp-btn-cta pulse">
              جرّب لوحة التحكم
              <span className="lp-streak" /><span className="lp-streak" /><span className="lp-streak" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
