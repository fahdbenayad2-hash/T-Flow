import { useEffect, useRef, useCallback } from 'react'
import { Link } from '@tanstack/react-router'
import { DashboardPreview } from '~/components/landing/dashboard-preview'

function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const ctx2d = canvas.getContext('2d')
    const parentEl = canvas.parentElement
    if (!ctx2d || !parentEl) return

    const cvs = canvas
    const ctx = ctx2d
    const parent = parentEl

    let w = 0
    let h = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    function size() {
      w = parent.offsetWidth
      h = parent.offsetHeight
      cvs.width = w * dpr
      cvs.height = h * dpr
      cvs.style.width = w + 'px'
      cvs.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    size()
    window.addEventListener('resize', size)

    const N = Math.min(60, Math.floor(w / 22))
    const pts = Array.from({ length: N }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.6 + 0.6,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -(Math.random() * 0.35 + 0.08),
      a: Math.random() * 0.5 + 0.2,
    }))

    let raf: number
    function tick() {
      ctx.clearRect(0, 0, w, h)
      pts.forEach((p) => {
        p.x += p.vx
        p.y += p.vy
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w }
        if (p.x < -10) p.x = w + 10
        if (p.x > w + 10) p.x = -10
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(231,39,52,${p.a})`
        ctx.fill()
      })
      raf = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', size)
    }
  }, [])

  return <canvas ref={canvasRef} className="lp-particles" />
}

function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!window.matchMedia('(pointer:fine)').matches) return
    const el = ref.current
    const hero = el?.parentElement
    if (!el || !hero) return

    const onMove = (e: MouseEvent) => {
      const r = hero.getBoundingClientRect()
      el.style.left = (e.clientX - r.left) + 'px'
      el.style.top = (e.clientY - r.top) + 'px'
      el.style.opacity = '1'
    }
    const onLeave = () => { el.style.opacity = '0' }

    hero.addEventListener('mousemove', onMove)
    hero.addEventListener('mouseleave', onLeave)
    return () => {
      hero.removeEventListener('mousemove', onMove)
      hero.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return <div ref={ref} className="lp-cursor-glow" />
}

function MagneticButton({ children, className, to, href }: { children: React.ReactNode; className?: string; to?: string; href?: string }) {
  const ref = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (!window.matchMedia('(pointer:fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = ref.current
    if (!el) return

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      const x = e.clientX - r.left - r.width / 2
      const y = e.clientY - r.top - r.height / 2
      el.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`
    }
    const onLeave = () => {
      el.style.transition = 'transform .5s cubic-bezier(.2,1,.3,1)'
      el.style.transform = 'translate(0,0)'
      setTimeout(() => { el.style.transition = '' }, 500)
    }

    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  if (to) {
    return (
      <Link ref={ref} to={to as '/'} className={className}>
        {children}
      </Link>
    )
  }

  return (
    <a ref={ref} className={className} href={href}>
      {children}
    </a>
  )
}

export function Hero() {
  const stat9 = useRef<HTMLDivElement>(null)
  const stat3 = useRef<HTMLDivElement>(null)
  const stat100 = useRef<HTMLDivElement>(null)
  const statsRef = useRef<HTMLDivElement>(null)

  const animateStats = useCallback(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (stat9.current) stat9.current.textContent = '9'
      if (stat3.current) stat3.current.textContent = '3'
      if (stat100.current) stat100.current.textContent = '100%'
      return
    }
    const targets = [
      { el: stat9.current, v: 0, target: 9, suffix: '' },
      { el: stat3.current, v: 0, target: 3, suffix: '' },
      { el: stat100.current, v: 0, target: 100, suffix: '%' },
    ]
    targets.forEach((t) => {
      if (!t.el) return
      const obj = { v: 0 }
      import('gsap').then(({ default: gsap }) => {
        gsap.to(obj, {
          v: t.target,
          duration: 1.6,
          ease: 'power2.out',
          delay: 0.5,
          onUpdate: () => { t.el!.textContent = Math.round(obj.v) + t.suffix },
        })
      })
    })
  }, [])

  useEffect(() => {
    animateStats()
  }, [animateStats])

  return (
    <section className="lp-hero" id="top">
      <Particles />
      <div className="lp-hero-glow" />
      <div className="lp-hero-speedlines" />
      <div className="lp-orb lp-orb-1" />
      <div className="lp-orb lp-orb-2" />
      <img className="lp-hero-mark" src="/logo.png" alt="" />
      <CursorGlow />

      <div className="lp-hero-inner">
        <span className="lp-eyebrow">
          <span className="lp-dot" /> منصّة تشغيل — الدفع عند الاستلام · الجزائر
        </span>

        <h1>
          <span className="lp-hero-line"><span>من أول طلب</span></span>
          <br />
          <span className="lp-hero-line"><span>إلى آخر تسليم —</span></span>
          <br />
          <span className="lp-hero-line"><span className="lp-accent">بسرعة الفهد.</span></span>
        </h1>

        <p className="lp-hero-sub">
          طلبات، عملاء، مركز اتصال، توصيل وتقارير — غرفة عمليات كاملة فوق جدول Google Sheets الذي تستخدمه فعلاً، دون تغيير طريقة عملك.
        </p>

        <div className="lp-hero-cta">
          <MagneticButton to="/auth" className="lp-btn lp-btn-cta pulse">
            جرّب لوحة التحكم
            <span className="lp-streak" /><span className="lp-streak" /><span className="lp-streak" />
          </MagneticButton>
          <MagneticButton href="#how" className="lp-btn lp-btn-ghost-dark">
            شاهد كيف يعمل ↓
          </MagneticButton>
        </div>

        <div ref={statsRef} className="lp-stat-row">
          <div className="lp-stat">
            <div ref={stat9} className="lp-stat-num">0</div>
            <div className="lp-stat-label">وحدات تشغيلية</div>
          </div>
          <div className="lp-stat">
            <div ref={stat3} className="lp-stat-num">0</div>
            <div className="lp-stat-label">أدوار صلاحيات</div>
          </div>
          <div className="lp-stat">
            <div ref={stat100} className="lp-stat-num">0</div>
            <div className="lp-stat-label">واجهة عربية RTL</div>
          </div>
        </div>

        <div className="lp-preview-wrap">
          <DashboardPreview />
        </div>
      </div>
    </section>
  )
}
