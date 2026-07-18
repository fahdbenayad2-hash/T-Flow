import { useLayoutEffect, useEffect, useState } from 'react'

const MIN_DISPLAY_MS = 2700
const SESSION_KEY = 'tflow-intro-shown-v1'

export function AppLoader() {
  const [show, setShow] = useState(true)
  const [hiding, setHiding] = useState(false)
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) {
      setShow(false)
      return
    }
    sessionStorage.setItem(SESSION_KEY, '1')
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return

    const start = Date.now()
    const reveal = () => {
      const elapsed = Date.now() - start
      window.setTimeout(() => setHiding(true), Math.max(0, MIN_DISPLAY_MS - elapsed))
    }

    if (document.readyState === 'complete') {
      reveal()
    } else {
      window.addEventListener('load', reveal, { once: true })
      return () => window.removeEventListener('load', reveal)
    }
  }, [ready])

  if (!show) return null

  return (
    <div
      className={`tflow-loader${hiding ? ' is-hiding' : ''}`}
      aria-hidden="true"
      dir="ltr"
      onAnimationEnd={(e) => {
        if (e.animationName === 'loaderOut') setShow(false)
      }}
    >
      <div className="stage">
        <div className="glow" />
        <img className="logo" src="/logo.png" alt="" />
        <div className="speed-burst">
          <span /><span /><span /><span /><span />
        </div>
      </div>

      <div className="progress-track">
        <div className="progress-fill" />
      </div>
    </div>
  )
}
