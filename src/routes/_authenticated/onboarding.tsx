import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Check, Circle, Rocket, Store } from 'lucide-react'
import { RoleGuard } from '~/components/role-guard'
import { Button } from '~/components/ui/button'
import { useSellerOnboarding } from '~/lib/queries'

export const Route = createFileRoute('/_authenticated/onboarding')({ component: OnboardingPage })

function OnboardingPage() {
  const query = useSellerOnboarding()
  if (query.isLoading) return <div className="h-96 rounded-2xl skeleton-shimmer" />
  if (query.isError || !query.data)
    return <div className="dc-card p-6">تعذر تحميل خطوات إعداد المتجر.</div>
  const data = query.data
  return (
    <RoleGuard roles={['admin']}>
      <div className="mx-auto max-w-4xl space-y-5">
        <section className="relative overflow-hidden rounded-[20px] border border-primary/25 bg-gradient-to-l from-primary/20 via-card to-card p-6 md:p-8">
          <Rocket className="mb-4 h-9 w-9 text-primary" />
          <h2 className="text-2xl font-black">جهّز متجرك لاستقبال الطلبات</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            أكمل الخطوات بالترتيب. عند الوصول إلى 100% يصبح المتجر جاهزاً للعمل اليومي.
          </p>
          <div className="mt-6 h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${data.percent}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs">
            <span className="font-bold text-primary">{data.percent}% مكتمل</span>
            <span className="text-muted-foreground">
              {data.completed} من {data.total}
            </span>
          </div>
        </section>
        <section className="dc-card divide-y divide-border/70 overflow-hidden">
          {data.steps.map((step, index) => (
            <div key={step.key} className="flex items-center gap-4 p-5">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${step.done ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}
              >
                {step.done ? <Check className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold">
                  {index + 1}. {step.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
              </div>
              <Button asChild variant={step.done ? 'outline' : 'default'} size="sm">
                <Link to={step.to}>
                  <span>{step.done ? 'مراجعة' : 'ابدأ'}</span>
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          ))}
        </section>
        {data.percent === 100 && (
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5 text-center">
            <Store className="mx-auto mb-2 h-7 w-7 text-emerald-500" />
            <p className="font-black text-emerald-500">متجرك جاهز بالكامل</p>
            <p className="mt-1 text-xs text-muted-foreground">
              يمكنك الآن إدارة الطلبات ومتابعة الفريق والتوصيل من لوحة التحكم.
            </p>
          </div>
        )}
      </div>
    </RoleGuard>
  )
}
