const FEATURES = [
  { num: '01', title: 'لوحة تحكم لحظية', desc: 'مؤشرات الأداء، توزيع الحالات، وآخر النشاطات — نظرة واحدة على المتجر كله.' },
  { num: '02', title: 'إدارة الطلبات', desc: 'بحث، فرز، تحديث جماعي للحالات، وكشف تلقائي للطلبات المكررة.' },
  { num: '03', title: 'قاعدة العملاء', desc: 'تجميع تلقائي حسب رقم الهاتف، سجل الطلبات، ونسب الإلغاء لكل عميل.' },
  { num: '04', title: 'مركز الاتصال', desc: 'طابور مكالمات للوكلاء، تسجيل نتيجة كل مكالمة، وجدولة المتابعة.' },
  { num: '05', title: 'أداء المنتجات', desc: 'تحليل الإيرادات حسب المنتج، اللون، والمقاس.' },
  { num: '06', title: 'الأرباح', desc: 'مؤشرات مالية حسب المنتج، الولاية، والتاريخ.' },
  { num: '07', title: 'التوصيل', desc: 'منزل مقابل ستوب ديسك، مع تحليل مفصّل لكل ولاية.' },
  { num: '08', title: 'التقارير', desc: 'أفضل العملاء، ملخصات الحالات، وتصدير كامل إلى Excel.' },
  { num: '09', title: 'صلاحيات حسب الدور', desc: 'أدمن، وكيل تأكيد، ومسؤول شحن — كل واحد يرى ما يخصّه فقط.' },
]

export function FeatureList() {
  return (
    <section className="lp-section" id="features">
      <div style={{ maxWidth: 1180, margin: '0 auto', paddingInline: 24 }}>
        <div className="lp-section-head">
          <div className="lp-eyebrow-light"><span className="lp-dot" /> 01–09 / الوحدات</div>
          <h2>كل ما يحتاجه متجرك، في مكان واحد</h2>
          <p>نفس ترتيب القائمة الجانبية لديك — من أول ما يدخل الطلب، إلى آخر خطوة في التسليم.</p>
        </div>

        <div>
          {FEATURES.map((f) => (
            <div key={f.num} className="lp-feature-row">
              <div className="lp-feature-num"><span className="lp-led" />{f.num}</div>
              <div className="lp-feature-main">
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
              <div className="lp-feature-arrow">←</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
