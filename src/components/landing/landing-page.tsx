import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { FadeIn, StaggerContainer, StaggerItem } from '~/components/page-transition'
import { DashboardPreview } from '~/components/landing/dashboard-preview'
import LogoIntroAnimation from '~/components/landing/LogoIntro'
import {
  Zap,
  ArrowLeft,
  LayoutDashboard,
  ShoppingCart,
  Users,
  Phone,
  Package,
  DollarSign,
  Truck,
  BarChart3,
  ShieldCheck,
  FileSpreadsheet,
  RefreshCw,
  Rocket,
  Languages,
  Moon,
  Smartphone,
  Bell,
  ChevronDown,
} from 'lucide-react'

const FEATURES = [
  { icon: LayoutDashboard, title: 'لوحة تحكم لحظية', desc: 'مؤشرات، توزيع الحالات، آخر النشاطات' },
  { icon: ShoppingCart, title: 'إدارة الطلبات', desc: 'بحث/فرز/تحديث جماعي + كشف التكرار' },
  { icon: Users, title: 'قاعدة العملاء', desc: 'تجميع حسب الهاتف + إحصائيات' },
  { icon: Phone, title: 'مركز الاتصال', desc: 'طابور مكالمات + نتيجة كل مكالمة' },
  { icon: Package, title: 'أداء المنتجات', desc: 'تحليل حسب اللون/المقاس' },
  { icon: DollarSign, title: 'الإيرادات', desc: 'حسب المنتج/الولاية/التاريخ' },
  { icon: Truck, title: 'التوصيل', desc: 'منزل vs ستوب ديسك لكل ولاية' },
  { icon: BarChart3, title: 'التقارير', desc: 'أفضل العملاء + تصدير Excel' },
  { icon: ShieldCheck, title: 'صلاحيات حسب الدور', desc: 'أدمن/وكيل تأكيد/مسؤول شحن' },
]

const STEPS = [
  { icon: FileSpreadsheet, title: 'اربط جدول Google Sheets', desc: 'وصّل جدولك الحالي مباشرة بمنصتنا — لا حاجة لأي تغيير في طريقة عملك.' },
  { icon: RefreshCw, title: 'مزامنة تلقائية', desc: 'كل تحديث في Google Sheets ينعكس فوراً على لوحة التحكم والعكس.' },
  { icon: Rocket, title: 'تحكم كامل بفريقك', desc: 'حدد الصلاحيات، تابع الأداء، وطور أعمالك بسرعة الفهد.' },
]

const HIGHLIGHTS = [
  { icon: Languages, title: 'عربي RTL بالكامل', desc: 'واجهة 100% باللغة العربية' },
  { icon: Moon, title: 'وضع ليلي', desc: 'مريح للعين في العمل الليلي' },
  { icon: Smartphone, title: 'متجاوب بالكامل', desc: 'يعمل على الجوال واللوحي والكمبيوتر' },
  { icon: Bell, title: 'إشعارات لحظية', desc: 'تنبيهات فورية عند كل طلب جديد' },
]

function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="T-Flow" className="h-8 w-8 object-contain" />
          <span className="text-lg font-bold text-foreground">
            <span className="text-primary">T</span>-Flow
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            المميزات
          </a>
          <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            كيف يعمل
          </a>
        </nav>

        <Button asChild>
          <Link to="/auth">تسجيل الدخول</Link>
        </Button>
      </div>
    </header>
  )
}

function HeroSection() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="absolute inset-0 brand-glow" />
      <div className="absolute inset-0 brand-speedlines opacity-30" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-20 sm:pt-24 sm:pb-28 text-center">
        <StaggerContainer className="space-y-6">
          <StaggerItem>
            <Badge className="gap-1.5 px-3 py-1 text-xs border-crimson/20 bg-crimson/10 text-crimson mx-auto w-fit">
              <Zap className="h-3.5 w-3.5" />
              منصّة عربية لإدارة طلبات الدفع عند الاستلام — مصمّمة لبائعي الجزائر
            </Badge>
          </StaggerItem>

          <StaggerItem>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground leading-tight max-w-4xl mx-auto">
              من أول طلب إلى آخر تسليم —
              <br />
              <span className="text-primary">كل شيء بسرعة الفهد.</span>
            </h1>
          </StaggerItem>

          <StaggerItem>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              طلبات، عملاء، مركز اتصال، توصيل، وتقارير — كل ما تحتاجه لإدارة متجرك من مكان واحد.
            </p>
          </StaggerItem>

          <StaggerItem>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button size="lg" className="h-12 gap-2 text-base" asChild>
                <Link to="/auth">
                  جرّب لوحة التحكم
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="h-12 text-base" asChild>
                <a href="#features">
                  اكتشف المميزات
                  <ChevronDown className="h-5 w-5" />
                </a>
              </Button>
            </div>
          </StaggerItem>
        </StaggerContainer>

        <FadeIn delay={0.5} className="mt-16">
          <DashboardPreview />
        </FadeIn>
      </div>
    </section>
  )
}

function FeaturesSection() {
  return (
    <section id="features" className="py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground text-center mb-16">
            كل ما يحتاجه متجرك في مكان واحد
          </h2>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <FadeIn key={f.title}>
              <div className="group bg-card border border-border rounded-xl p-5 transition-all duration-200 hover:shadow-md hover:border-crimson/20">
                <div className="w-11 h-11 rounded-lg bg-accent flex items-center justify-center mb-4 group-hover:bg-crimson/15 transition-colors">
                  <f.icon className="h-5 w-5 text-crimson" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20 sm:py-28 bg-secondary/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground text-center mb-16">
            ابدأ في ثلاث خطوات فقط
          </h2>
        </FadeIn>

        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6">
          <div className="hidden md:block absolute top-16 left-[17%] right-[17%] h-0.5 bg-border" />

          {STEPS.map((s, i) => (
            <FadeIn key={s.title} delay={i * 0.12}>
              <div className="relative flex flex-col items-center text-center">
                <div className="relative z-10 w-16 h-16 rounded-full bg-crimson flex items-center justify-center mb-5 shadow-lg shadow-crimson/20">
                  <s.icon className="h-7 w-7 text-white" />
                </div>
                <div className="absolute top-0 md:hidden -right-3 w-7 h-7 rounded-full bg-muted-foreground/20 flex items-center justify-center text-xs font-bold text-muted-foreground">
                  {i + 1}
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground max-w-xs">{s.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

function HighlightsStrip() {
  return (
    <section className="py-16 border-y border-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {HIGHLIGHTS.map((h) => (
            <FadeIn key={h.title}>
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center">
                  <h.icon className="h-6 w-6 text-crimson" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{h.title}</div>
                  <div className="text-xs text-muted-foreground">{h.desc}</div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

function CtaSection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl bg-[var(--color-ink)] px-6 py-14 sm:px-14 sm:py-20 text-center">
          <div className="absolute inset-0 brand-glow opacity-50" />
          <div className="absolute inset-0 brand-speedlines opacity-20" />

          <div className="relative">
            <FadeIn>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                جهز متجرك اليوم
              </h2>
              <p className="text-white/70 max-w-lg mx-auto mb-8">
                انضم إلى البائعين الذين يديرون أعمالهم بسرعة الفهد — مجاناً، بدون عقود، بدون تعقيد.
              </p>
              <Button size="lg" className="h-12 gap-2 text-base bg-white text-[var(--color-ink)] hover:bg-white/90" asChild>
                <Link to="/auth">
                  جرّب لوحة التحكم
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
            </FadeIn>
          </div>
        </div>
      </div>
    </section>
  )
}

function LandingFooter() {
  return (
    <footer className="border-t border-border py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="T-Flow" className="h-7 w-7 object-contain" />
          <span className="text-sm font-semibold text-foreground">
            <span className="text-primary">T</span>-Flow
          </span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            — إدارة الطلبات بسرعة الفهد
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} T-Flow. جميع الحقوق محفوظة.
        </p>
      </div>
    </footer>
  )
}

export function LandingPage() {
  const [showIntro, setShowIntro] = useState(true)

  return (
    <>
      {showIntro && <LogoIntroAnimation onComplete={() => setShowIntro(false)} />}

      <div className={`min-h-screen bg-background text-foreground ${showIntro ? 'hidden' : 'block'}`}>
        <LandingHeader />
        <main>
          <HeroSection />
          <FeaturesSection />
          <HowItWorksSection />
          <HighlightsStrip />
          <CtaSection />
        </main>
        <LandingFooter />
      </div>
    </>
  )
}
