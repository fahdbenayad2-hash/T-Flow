import { useEffect, useCallback } from 'react'
import { Link } from '@tanstack/react-router'
import { PageLoader } from '~/components/landing/page-loader'
import { Hero } from '~/components/landing/hero'
import { Marquee } from '~/components/landing/marquee'
import { FeatureList } from '~/components/landing/feature-list'
import { HowItWorks } from '~/components/landing/how-it-works'
import { Specs } from '~/components/landing/specs'
import { Cta } from '~/components/landing/cta'

function RaceBar() {
  useEffect(() => {
    const fill = document.getElementById('lp-race-fill')
    const marker = document.getElementById('lp-race-marker')
    if (!fill || !marker) return

    const update = () => {
      const h = document.documentElement
      const pct = (h.scrollTop) / (h.scrollHeight - h.clientHeight) * 100
      fill.style.width = pct + '%'
      marker.style.right = `calc(${pct}% - 5px)`
    }

    document.addEventListener('scroll', update, { passive: true })
    update()
    return () => document.removeEventListener('scroll', update)
  }, [])

  return (
    <>
      <div id="lp-race-track"><div id="lp-race-fill" /></div>
      <div id="lp-race-marker" />
    </>
  )
}

function Header() {
  return (
    <header className="lp-nav">
      <div className="lp-nav-inner">
        <Link to="/" className="lp-nav-brand">
          <img src="/logo.png" alt="T-Flow" />
          <span><b>T</b>-Flow</span>
        </Link>
        <div className="lp-nav-links">
          <a href="#features">المميزات</a>
          <a href="#how">كيف يعمل</a>
          <a href="#specs">المواصفات</a>
        </div>
        <Link to="/auth" className="lp-btn lp-btn-primary">تسجيل الدخول</Link>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-footer-inner">
        <div className="lp-footer-brand">
          <img src="/logo.png" alt="T-Flow" />
          <span><b>T</b>-Flow</span>
          <span>— إدارة الطلبات بسرعة الفهد</span>
        </div>
        <small style={{ fontFamily: "'JetBrains Mono', monospace" }}>© 2026 T-Flow</small>
      </div>
    </footer>
  )
}

export function LandingPage() {
  // Landing page is intentionally always-dark regardless of the app's light/dark
  // theme toggle — it's a marketing surface, not a themed app view. Do not wire
  // this to the theme context.
  return (
    <div style={{ background: '#0E1113', minHeight: '100vh', color: '#fff' }}>
      <RaceBar />
      <div id="lp-grain" />
      <PageLoader />
      <Header />
      <main>
        <Hero />
        <Marquee />
        <FeatureList />
        <HowItWorks />
        <Specs />
        <Cta />
      </main>
      <Footer />
    </div>
  )
}
