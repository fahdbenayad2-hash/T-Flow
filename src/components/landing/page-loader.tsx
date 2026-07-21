import { useEffect, useRef, useState, useCallback } from 'react'
import gsap from 'gsap'

const SESSION_KEY = 'tflow-landing-v1'
const MIN_DISPLAY_MS = 2600

export function PageLoader() {
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const skipRef = useRef<HTMLButtonElement>(null)
  const dismissedRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(SESSION_KEY)) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    sessionStorage.setItem(SESSION_KEY, '1')
    setShow(true)
    document.body.classList.add('lp-loading')

    return () => {
      document.body.classList.remove('lp-loading')
    }
  }, [])

  useEffect(() => {
    if (!show || !rootRef.current) return
    const root = rootRef.current
    const skip = skipRef.current
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      dismiss()
      return
    }

    const tl = gsap.timeline()

    tl.set(root, { display: 'flex' })

    tl.to(root.querySelector('.lp-mark-main'), {
      keyframes: [
        { x: '170%', scale: 0.88, opacity: 0, duration: 0 },
        { opacity: 1, duration: 0.15 },
        { x: '-4%', scale: 1.07, opacity: 1, duration: 0.7, ease: 'power2.out' },
        { x: '2%', scale: 0.98, duration: 0.12 },
        { x: 0, scale: 1, duration: 0.1 },
      ],
    }, 0.25)

    root.querySelectorAll('.lp-ghost').forEach((g, i) => {
      tl.to(g, {
        keyframes: [
          { x: '170%', scale: 0.88, opacity: 0, duration: 0 },
          { opacity: 0.4, duration: 0.12 },
          { x: 0, scale: 1, opacity: 0, duration: 0.8, ease: 'power2.out' },
        ],
      }, 0.30 + i * 0.04)
    })

    tl.to(root.querySelector('.lp-impact-ring'), {
      keyframes: [
        { width: 40, height: 40, margin: '-20px 0 0 -20px', opacity: 0.65, duration: 0 },
        { width: 240, height: 240, margin: '-120px 0 0 -120px', opacity: 0, duration: 0.8, ease: 'power2.out' },
      ],
    }, 1.05)

    tl.to(root.querySelector('.lp-word-el'), {
      opacity: 1, y: 0, duration: 0.6, ease: 'power2.out',
    }, 1.2)

    tl.to(root.querySelector('.lp-tag-el'), {
      opacity: 1, duration: 0.5, ease: 'power2.out',
    }, 1.55)

    if (skip) {
      setTimeout(() => skip.classList.add('show'), 900)
    }

    const timer = setTimeout(dismiss, MIN_DISPLAY_MS)

    return () => {
      clearTimeout(timer)
      tl.kill()
    }
  }, [show])

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return
    dismissedRef.current = true
    document.body.classList.remove('lp-loading')
    setDismissed(true)
  }, [])

  if (!show) return null

  return (
    <div
      ref={rootRef}
      className={`lp-loader${dismissed ? ' dismissed' : ''}`}
      aria-hidden="true"
      dir="ltr"
      onTransitionEnd={(e) => {
        if (e.propertyName === 'opacity' && dismissed) {
          setShow(false)
        }
      }}
    >
      <div className="lp-ambient">
        <div className="lp-amb-line" />
        <div className="lp-amb-line" />
        <div className="lp-amb-line" />
        <div className="lp-amb-line" />
      </div>

      <div className="lp-entrance">
        <div className="lp-mark-layer">
          <div className="lp-mark-el lp-ghost lp-g3" style={{ backgroundImage: 'url(/loader/mark.png)' }} />
          <div className="lp-mark-el lp-ghost lp-g2" style={{ backgroundImage: 'url(/loader/mark.png)' }} />
          <div className="lp-mark-el lp-ghost lp-g1" style={{ backgroundImage: 'url(/loader/mark.png)' }} />
          <div className="lp-impact-ring" />
          <div className="lp-mark-el lp-mark-main" style={{ backgroundImage: 'url(/loader/mark.png)' }} />
        </div>
        <div className="lp-word-el" style={{ backgroundImage: 'url(/loader/word.png)' }} />
        <div className="lp-tag-el" style={{ backgroundImage: 'url(/loader/tag.png)' }} />
      </div>

      <button ref={skipRef} className="lp-skip" onClick={dismiss}>
        تخطي ↦
      </button>
    </div>
  )
}
