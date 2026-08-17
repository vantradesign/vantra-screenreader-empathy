/**
 * Landmark role detection.
 *
 * Identifies landmark regions per the ARIA landmarks spec.
 * Used by the traversal to mark entries and by deterministic flags
 * to detect missing landmarks.
 */

import type { ElementRole } from './types.js'

// Explicit landmark roles
const LANDMARK_ROLES = new Set<string>([
  'banner', 'complementary', 'contentinfo', 'form', 'main',
  'navigation', 'region', 'search',
])

// HTML elements with implicit landmark roles
const IMPLICIT_LANDMARK_MAP: Record<string, string> = {
  header: 'banner',
  footer: 'contentinfo',
  main: 'main',
  nav: 'navigation',
  aside: 'complementary',
  section: 'region',
  form: 'form',
  search: 'search',
}

/**
 * Determine whether an element is a landmark.
 *
 * Rules:
 * - Explicit role attribute with a landmark role → always a landmark
 * - <header>/<footer> → only landmarks when they are direct children
 *   of <body> (not nested within sectioning content)
 * - <section>/<form> → landmarks only when they have an accessible name
 * - <main>, <nav>, <aside>, <search> → always landmarks
 */
export function isLandmark(element: Element): boolean {
  const explicitRole = element.getAttribute('role')?.trim().toLowerCase()
  if (explicitRole && LANDMARK_ROLES.has(explicitRole)) return true

  const tag = element.tagName.toLowerCase()
  const implicitRole = IMPLICIT_LANDMARK_MAP[tag]

  if (!implicitRole) return false

  // <header>/<footer> only landmarks at body scope
  if (tag === 'header' || tag === 'footer') {
    return !isNestedInSectioningContent(element)
  }

  // <section>/<form> only landmarks when they have an accessible name
  if (tag === 'section' || tag === 'form') {
    return hasAccessibleName(element)
  }

  return true
}

/**
 * Get the landmark role for an element, or null if it's not a landmark.
 */
export function getLandmarkRole(element: Element): ElementRole | null {
  const explicitRole = element.getAttribute('role')?.trim().toLowerCase()
  if (explicitRole && LANDMARK_ROLES.has(explicitRole)) {
    return explicitRole as ElementRole
  }

  const tag = element.tagName.toLowerCase()
  const implicitRole = IMPLICIT_LANDMARK_MAP[tag]

  if (!implicitRole) return null
  if (!isLandmark(element)) return null

  return implicitRole as ElementRole
}

// Sectioning content elements that prevent <header>/<footer> from
// being treated as landmarks
const SECTIONING_CONTENT = new Set([
  'article', 'aside', 'main', 'nav', 'section',
])

function isNestedInSectioningContent(element: Element): boolean {
  let parent = element.parentElement
  while (parent) {
    if (parent.tagName.toLowerCase() === 'body') return false
    if (SECTIONING_CONTENT.has(parent.tagName.toLowerCase())) return true
    parent = parent.parentElement
  }
  return false
}

function hasAccessibleName(element: Element): boolean {
  // Quick checks: aria-label, aria-labelledby, title
  if (element.getAttribute('aria-label')?.trim()) return true
  if (element.getAttribute('aria-labelledby')?.trim()) return true
  if (element.getAttribute('title')?.trim()) return true
  return false
}
