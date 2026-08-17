/**
 * DOM element highlighting.
 *
 * Adds a visual highlight to elements during playback so users
 * can see which element is being read. Returns a cleanup function.
 */

import type { HighlightOptions } from '../core/types.js'

const DEFAULT_COLOR = '#00c8e0'
const HIGHLIGHT_CLASS = 'vantra-empathy-highlight'

// Inject styles once
let stylesInjected = false

function injectStyles(): void {
  if (stylesInjected) return
  if (typeof document === 'undefined') return

  const style = document.createElement('style')
  style.textContent = `
    .${HIGHLIGHT_CLASS} {
      outline: 3px solid var(--vantra-empathy-highlight-color, ${DEFAULT_COLOR}) !important;
      outline-offset: 2px !important;
      background-color: color-mix(in srgb, var(--vantra-empathy-highlight-color, ${DEFAULT_COLOR}) 10%, transparent) !important;
      transition: outline-color 0.15s ease, background-color 0.15s ease;
    }
    @media (prefers-reduced-motion: reduce) {
      .${HIGHLIGHT_CLASS} {
        transition: none;
      }
    }
  `
  document.head.appendChild(style)
  stylesInjected = true
}

/**
 * Highlight an element in the DOM.
 * Returns a cleanup function that removes the highlight.
 */
export function highlightElement(
  selector: string,
  options?: HighlightOptions,
): () => void {
  if (typeof document === 'undefined') return () => {}

  injectStyles()

  const element = document.querySelector(selector)
  if (!element) return () => {}

  const htmlEl = element as HTMLElement

  // Apply custom color if provided
  if (options?.color) {
    htmlEl.style.setProperty('--vantra-empathy-highlight-color', options.color)
  }

  htmlEl.classList.add(HIGHLIGHT_CLASS)

  // Scroll into view
  htmlEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })

  return () => {
    htmlEl.classList.remove(HIGHLIGHT_CLASS)
    if (options?.color) {
      htmlEl.style.removeProperty('--vantra-empathy-highlight-color')
    }
  }
}

/**
 * Remove all highlights from the document.
 */
export function clearHighlights(): void {
  if (typeof document === 'undefined') return

  const highlighted = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`)
  for (const el of highlighted) {
    el.classList.remove(HIGHLIGHT_CLASS)
    ;(el as HTMLElement).style.removeProperty('--vantra-empathy-highlight-color')
  }
}
