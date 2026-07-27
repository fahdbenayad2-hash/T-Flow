const FEATURES = [
  'إدارة الطلبات',
  'قاعدة العملاء',
  'مركز الاتصال',
  'تتبّع التوصيل',
  'تحليل الأرباح',
  'التقارير',
  'صلاحيات الأدوار',
  'إشعارات لحظية',
]
const TECH = ['GOOGLE SHEETS', 'SUPABASE', 'REALTIME', 'RTL', 'TANSTACK', 'POSTGRESQL']

export function Marquee() {
  return (
    <>
      <div className="lp-marquee">
        <div
          className="lp-marquee-track"
          style={{ animation: 'lpScrollTicker 26s linear infinite' }}
        >
          {FEATURES.map((f) => (
            <span key={f}>{f}</span>
          ))}
          {FEATURES.map((f) => (
            <span key={`d-${f}`}>{f}</span>
          ))}
        </div>
      </div>
      <div className="lp-marquee lp-sub">
        <div
          className="lp-marquee-track"
          style={{ animation: 'lpScrollTickerRev 32s linear infinite' }}
        >
          {TECH.map((t) => (
            <span key={t}>{t}</span>
          ))}
          {TECH.map((t) => (
            <span key={`d-${t}`}>{t}</span>
          ))}
        </div>
      </div>
    </>
  )
}
