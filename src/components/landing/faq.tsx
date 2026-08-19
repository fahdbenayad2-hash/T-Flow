const QUESTIONS = [
  {
    question: 'هل لازم نبدّل Google Sheets الذي نعمل به؟',
    answer:
      'لا. تربط الملف والصفحة الموجودة، ثم تطابق الأعمدة مرة واحدة. T-Flow يبني فوق طريقة عملك الحالية دون أن يفرض عليك بداية جديدة.',
  },
  {
    question: 'هل أقدر نربط أكثر من متجر؟',
    answer:
      'نعم. كل متجر يأخذ رابط استقبال واتصالاً مستقلاً، وتبقى الطلبات منظمة داخل نفس الحساب حسب إعدادات الباقة.',
  },
  {
    question: 'هل تخدم المنصّة على الهاتف؟',
    answer:
      'نعم. الواجهة متجاوبة بالكامل وتسمح للفريق بمتابعة الطلبات، المكالمات والتوصيل من الهاتف أو الحاسوب.',
  },
  {
    question: 'كيف تبقى بيانات كل بائع منفصلة؟',
    answer:
      'كل حساب يعمل داخل مساحة خاصة به، مع صلاحيات حسب الدور حتى يرى كل عضو فقط البيانات والعمليات المسموح بها.',
  },
  {
    question: 'هل نقدر نجرب قبل الاشتراك؟',
    answer: 'نعم. توجد باقة بداية مجانية، وباقة النمو متاحة للتجربة قبل اتخاذ قرار الترقية.',
  },
]

export function Faq() {
  return (
    <section className="lp-section lp-faq" id="faq">
      <div className="lp-faq-inner">
        <div className="lp-section-head">
          <div className="lp-eyebrow-light">
            <span className="lp-dot" /> أسئلة قبل البداية
          </div>
          <h2>كل ما تحتاج معرفته، بوضوح.</h2>
          <p>إجابات مباشرة على أكثر الأسئلة التي يطرحها البائع قبل ربط متجره.</p>
        </div>

        <div className="lp-faq-list">
          {QUESTIONS.map((item, index) => (
            <details key={item.question} className="lp-faq-item">
              <summary>
                <span className="lp-faq-num">0{index + 1}</span>
                <span>{item.question}</span>
                <i aria-hidden="true" />
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
