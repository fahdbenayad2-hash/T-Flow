import { useMemo } from 'react'

export function useDirection(): { dir: 'rtl' | 'ltr'; sign: 1 | -1 } {
  return useMemo(() => {
    if (typeof document === 'undefined') return { dir: 'ltr', sign: 1 }
    const dir = document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr'
    return { dir, sign: dir === 'rtl' ? -1 : 1 }
  }, [])
}
