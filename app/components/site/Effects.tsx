'use client'

import { useEffect } from 'react'

/**
 * Effets globaux, montés une seule fois dans le layout :
 * - reflet du verre qui suit le pointeur (variables --mx / --my) ;
 * - ondulation au clic sur les boutons ;
 * - apparition douce des blocs .reveal au défilement.
 */
export default function Effects() {
  useEffect(() => {
    const GLASS = '.glass, .panel, .meal-card, .book-card, .modal, .stat, .search'

    const onMove = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.(GLASS) as HTMLElement | null
      if (!el) return
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${e.clientX - r.left}px`)
      el.style.setProperty('--my', `${e.clientY - r.top}px`)
    }

    const onDown = (e: PointerEvent) => {
      const btn = (e.target as Element | null)?.closest?.('.btn, .tile, .role-opt') as HTMLElement | null
      if (!btn || btn.hasAttribute('disabled')) return
      const r = btn.getBoundingClientRect()
      const size = Math.max(r.width, r.height)
      const dot = document.createElement('span')
      dot.className = 'ripple'
      dot.style.width = dot.style.height = `${size}px`
      dot.style.left = `${e.clientX - r.left - size / 2}px`
      dot.style.top = `${e.clientY - r.top - size / 2}px`
      if (getComputedStyle(btn).position === 'static') btn.style.position = 'relative'
      btn.style.overflow = 'hidden'
      btn.appendChild(dot)
      setTimeout(() => dot.remove(), 650)
    }

    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target) } })
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })

    const watch = () => document.querySelectorAll('.reveal:not(.in)').forEach(el => io.observe(el))
    watch()
    // Les pages changent sans rechargement : on surveille les nouveaux blocs.
    const mo = new MutationObserver(watch)
    mo.observe(document.body, { childList: true, subtree: true })

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      io.disconnect()
      mo.disconnect()
    }
  }, [])

  return (
    <div className="aurora" aria-hidden="true"><span /><span /><span /></div>
  )
}
