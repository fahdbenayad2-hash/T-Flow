/**
 * Centralized motion configuration — single source of truth for all animation tokens.
 *
 * All durations are in seconds. The cubic-bezier curve [0.25, 0.1, 0.25, 1] is our
 * standard ease (close to ease-out but snappier start).
 *
 * IMPORTANT: These tokens are only used by Framer Motion (authenticated shell).
 * The landing page uses GSAP separately.
 */

export const EASE = [0.25, 0.1, 0.25, 1] as const

export const DURATION = {
  fast: 0.15,
  normal: 0.3,
  slow: 0.4,
} as const

export const SPRING = {
  stiffness: 300,
  damping: 30,
} as const

/** Standard page enter/exit */
export const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.normal, ease: EASE },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: DURATION.fast },
  },
}

/** Container that staggers its children */
export const staggerContainer = {
  animate: {
    transition: { staggerChildren: 0.06 },
  },
}

/** Item inside a stagger container */
export const staggerItem = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.slow, ease: EASE },
  },
}

/** Simple fade-in with optional y offset */
export const fadeIn = (delay = 0, yOffset = 10) => ({
  initial: { opacity: 0, y: yOffset },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DURATION.slow, delay, ease: EASE },
})

/** Scale-in from 95% */
export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: DURATION.normal, ease: EASE },
}

/** Slide up (for modals, toasts, etc.) */
export const slideUp = {
  initial: { opacity: 0, y: 24 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.normal, ease: EASE },
  },
  exit: {
    opacity: 0,
    y: 16,
    transition: { duration: DURATION.fast },
  },
}
