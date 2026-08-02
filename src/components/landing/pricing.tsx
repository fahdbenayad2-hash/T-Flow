import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { SUBSCRIPTION_PLANS } from '~/lib/subscription-plans'
import { formatCurrency } from '~/lib/utils'

export function Pricing() {
  return (
    <section className="lp-section lp-pricing" id="pricing">
      <div className="lp-pricing-inner">
        <div className="lp-section-head">
          <div className="lp-eyebrow-light">
            <span className="lp-dot" /> باقات واضحة
          </div>
          <h2>ابدأ مجاناً، ووسّع الباقة عندما يكبر متجرك</h2>
          <p>
            لا رسوم مخفية ولا عقد طويل. باقة البداية مجانية، وباقة النمو متاحة للتجربة 14 يوماً قبل
            اتخاذ القرار.
          </p>
        </div>

        <div className="lp-pricing-grid">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <article
              key={plan.code}
              className={`lp-price-card${plan.featured ? ' lp-price-featured' : ''}`}
            >
              {plan.featured && <span className="lp-price-ribbon">الأكثر مناسبة</span>}
              <div className="lp-price-code">{plan.code.toUpperCase()}</div>
              <h3>{plan.name}</h3>
              <p className="lp-price-desc">{plan.description}</p>
              <div className="lp-price-value">
                <strong>{formatCurrency(plan.monthlyPrice)}</strong>
                <span>/ شهر</span>
              </div>

              <div className="lp-price-limits">
                <span>
                  {plan.limits.orders === null
                    ? 'طلبات غير محدودة'
                    : `${plan.limits.orders.toLocaleString('ar-DZ')} طلب / شهر`}
                </span>
                <span>
                  {plan.limits.users === null ? 'مستخدمون غير محدودين' : `${plan.limits.users} مستخدم`}
                </span>
              </div>

              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <Check aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                to="/auth"
                className={`lp-btn ${plan.featured ? 'lp-btn-cta' : 'lp-btn-ghost-dark'} lp-price-action`}
              >
                {plan.code === 'starter'
                  ? 'ابدأ مجاناً'
                  : plan.code === 'growth'
                    ? 'جرّب 14 يوماً'
                    : 'ابدأ الاحتراف'}
              </Link>
            </article>
          ))}
        </div>
        <p className="lp-price-note">
          الأسعار بالدينار الجزائري. لن يتم خصم أي مبلغ خلال الفترة التجريبية.
        </p>
      </div>
    </section>
  )
}
