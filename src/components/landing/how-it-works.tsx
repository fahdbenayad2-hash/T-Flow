const STOPS = [
  { num: '01', title: 'اربط جدول Google Sheets', desc: 'وصّل جدولك الحالي مباشرة — لا حاجة لأي تغيير في طريقة عملك.' },
  { num: '02', title: 'مزامنة تلقائية', desc: 'كل تحديث في الشيت ينعكس فوراً على اللوحة، والعكس صحيح.' },
  { num: '03', title: 'تحكم كامل بفريقك', desc: 'حدد الصلاحيات، تابع الأداء، وطوّر أعمالك بسرعة الفهد.' },
]

export function HowItWorks() {
  return (
    <section className="lp-section lp-how" id="how">
      <div style={{ maxWidth: 1180, margin: '0 auto', paddingInline: 24, position: 'relative', zIndex: 1 }}>
        <div className="lp-section-head">
          <div className="lp-eyebrow-light"><span className="lp-dot" /> البداية</div>
          <h2>ابدأ في ثلاث خطوات فقط</h2>
          <p>بلا هجرة، بلا تعقيد — تبقى شغّال بنفس الجدول، ونحن نبني فوقه.</p>
        </div>

        <svg className="lp-track-svg" viewBox="0 0 900 60" preserveAspectRatio="none">
          <line x1="40" y1="30" x2="860" y2="30" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
          <line
            id="lp-track-fill"
            x1="40" y1="30" x2="860" y2="30"
            stroke="url(#lp-grad)" strokeWidth="2"
            pathLength="100" strokeDasharray="100" strokeDashoffset="100"
          />
          <defs>
            <linearGradient id="lp-grad" x1="0" x2="1">
              <stop offset="0" stopColor="#7D1622" />
              <stop offset="1" stopColor="#E72734" />
            </linearGradient>
          </defs>
          <circle cx="40" cy="30" r="5" fill="#0E1113" stroke="#E72734" strokeWidth="2" />
          <circle cx="450" cy="30" r="5" fill="#0E1113" stroke="#E72734" strokeWidth="2" />
          <circle cx="860" cy="30" r="5" fill="#0E1113" stroke="#E72734" strokeWidth="2" />
          <circle id="lp-race-dot" cx="40" cy="30" r="7" fill="#E72734" />
        </svg>

        <div className="lp-stops">
          {STOPS.map((s) => (
            <div key={s.num} className="lp-stop">
              <div className="lp-n">{s.num}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
