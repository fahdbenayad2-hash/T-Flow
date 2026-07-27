import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import {
  pageTransition,
  staggerContainer,
  staggerItem,
  fadeIn as fadeInConfig,
  scaleIn,
  EASE,
  DURATION,
} from '~/lib/motion'

interface PageTransitionProps {
  children: ReactNode
}

export function PageTransition({ children }: PageTransitionProps) {
  return (
    <motion.div variants={pageTransition} initial="initial" animate="animate" exit="exit">
      {children}
    </motion.div>
  )
}

export function StaggerContainer({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  )
}

export function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  return (
    <motion.div
      initial={fadeInConfig(delay).initial}
      animate={fadeInConfig(delay).animate}
      transition={fadeInConfig(delay).transition}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function ScaleIn({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={scaleIn.initial}
      animate={scaleIn.animate}
      transition={scaleIn.transition}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export { EASE, DURATION }
