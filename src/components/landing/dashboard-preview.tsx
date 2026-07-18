import { CheckCircle2, Clock, DollarSign } from 'lucide-react'

const stats = [
  { label: 'طلبات اليوم', value: '28', icon: Clock, color: 'text-amber-500' },
  { label: 'الإيرادات', value: '184,500 DZD', icon: DollarSign, color: 'text-green-500' },
  { label: 'معدل التأكيد', value: '86%', icon: CheckCircle2, color: 'text-blue-500' },
]

const recentOrders = [
  { id: 'FS-7A3F', client: 'أحمد بن علي', product: 'تيشيرت رياضي, مقاس L', status: 'مؤكد', statusClass: 'text-[var(--status-confirmed)]' },
  { id: 'FS-9B21', client: 'سارة محمود', product: 'فستان كلاسيكي, مقاس M', status: 'مشحون', statusClass: 'text-[var(--status-shipped)]' },
  { id: 'FS-2C88', client: 'خالد ناصر', product: 'حذاء رياضي, مقاس 42', status: 'تم التسليم', statusClass: 'text-[var(--status-delivered)]' },
  { id: 'FS-5D44', client: 'مريم عبد الله', product: 'تيشيرت رياضي, مقاس S', status: 'قيد المعالجة', statusClass: 'text-[var(--status-processing)]' },
]

export function DashboardPreview() {
  return (
    <div aria-hidden="true" className="w-full max-w-4xl mx-auto">
      <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/60 border-b border-border">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="mx-auto text-xs text-muted-foreground">لوحة التحكم — T-Flow</div>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="bg-muted/40 rounded-lg p-3.5 flex items-center gap-3">
                <div className="shrink-0 w-9 h-9 rounded-lg bg-background flex items-center justify-center">
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <div>
                  <div className="text-lg font-bold text-foreground">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-3 bg-muted/40 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">آخر الطلبات</h4>
              <div className="space-y-2">
                {recentOrders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{o.client}</div>
                      <div className="text-xs text-muted-foreground truncate">{o.product}</div>
                    </div>
                    <span className={`text-xs font-semibold shrink-0 mr-2 ${o.statusClass}`}>
                      {o.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 bg-muted/40 rounded-lg p-4 flex flex-col">
              <h4 className="text-sm font-semibold text-foreground mb-3">توزيع الحالات</h4>
              <div className="flex-1 flex items-end justify-around gap-1 pb-1">
                {[
                  { label: 'معالجة', pct: 25, color: 'var(--status-processing)' },
                  { label: 'مؤكد', pct: 30, color: 'var(--status-confirmed)' },
                  { label: 'مشحون', pct: 20, color: 'var(--status-shipped)' },
                  { label: 'تم', pct: 15, color: 'var(--status-delivered)' },
                  { label: 'ملغي', pct: 10, color: 'var(--status-cancelled)' },
                ].map((b) => (
                  <div key={b.label} className="flex flex-col items-center gap-1">
                    <div className="w-full flex justify-center text-[10px] font-semibold text-foreground">{b.pct}%</div>
                    <div className="w-8 sm:w-10 bg-muted rounded-full overflow-hidden" style={{ height: 64 }}>
                      <div
                        className="w-full rounded-full transition-all"
                        style={{ height: `${b.pct}%`, backgroundColor: b.color }}
                      />
                    </div>
                    <div className="text-[10px] text-muted-foreground">{b.label}</div>
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
