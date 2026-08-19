import { Link } from '@tanstack/react-router'

export function Cta() {
  return (
    <section className="lp-section">
      <div style={{ maxWidth: 1180, margin: '0 auto', paddingInline: 24 }}>
        <div className="lp-cta-box">
          <div className="lp-cta-word" aria-hidden="true">
            GO!
          </div>
          <div style={{ position: 'relative' }}>
            <span className="lp-cta-kicker">جاهز تسرّع تجارتك؟</span>
            <h2>جهّز غرفة عملياتك اليوم.</h2>
            <p>ابدأ مجاناً، اربط أول متجر، وشاهد كل طلب من مكان واحد.</p>
            <Link to="/auth" className="lp-btn lp-btn-cta">
              افتح حسابك الآن <span aria-hidden="true">←</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
