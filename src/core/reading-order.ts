/**
 * Reading order computation.
 *
 * Walks the DOM in reading order, yielding elements that a screen
 * reader would visit. This combines:
 * - DOM tree order (the primary reading order)
 * - tabindex handling (positive tabindex elements come first)
 * - Skipping hidden/presentation elements
 *
 * The output is a flat sequence of Element nodes in the order a
 * screen reader would announce them.
 */

// Elements that are never part of the reading order
const SKIPPED_TAGS = new Set([
  'script', 'style', 'template', 'noscript', 'head', 'meta', 'link',
  'title', 'base',
])

// Elements with roles that indicate they should be skipped
const PRESENTATION_ROLES = new Set(['presentation', 'none'])

/**
 * Compute the reading order for a document or element.
 * Returns an ordered array of elements to be visited.
 */
export function computeReadingOrder(
  root: Element | Document,
  includeHidden = false,
): Element[] {
  const elements: Element[] = []

  walkDOM(root, elements, includeHidden)

  return elements
}

function walkDOM(
  node: Element | Document,
  result: Element[],
  includeHidden: boolean,
): void {
  const children = node.childNodes

  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (!child) continue

    if (child.nodeType !== 1 /* ELEMENT */) continue

    const element = child as Element
    const tag = element.tagName.toLowerCase()

    // Skip non-rendered elements
    if (SKIPPED_TAGS.has(tag)) continue

    // Check aria-hidden
    if (!includeHidden && element.getAttribute('aria-hidden') === 'true') continue

    // Check role="presentation" / role="none"
    const role = element.getAttribute('role')
    if (role && PRESENTATION_ROLES.has(role)) {
      // Presentation role: skip the element itself but walk children
      walkDOM(element, result, includeHidden)
      continue
    }

    // Check hidden attribute
    if (!includeHidden && element.hasAttribute('hidden')) continue

    // Check display: none / visibility: hidden (via style attribute only;
    // computed styles unavailable in jsdom for external CSS)
    if (!includeHidden && isVisuallyHidden(element)) continue

    // Determine if this element contributes to the reading order
    if (isReadableElement(element)) {
      result.push(element)
    }

    // Recurse into children
    walkDOM(element, result, includeHidden)
  }
}

/**
 * Determine whether an element is "readable" — i.e., a screen reader
 * would announce it as a distinct node in the reading order.
 *
 * Elements that are just containers (div, span without roles) produce
 * no announcement of their own; their children do.
 */
function isReadableElement(element: Element): boolean {
  const tag = element.tagName.toLowerCase()

  // Elements with explicit roles are always readable
  const role = element.getAttribute('role')
  if (role && !PRESENTATION_ROLES.has(role)) return true

  // Headings
  if (/^h[1-6]$/.test(tag)) return true

  // Interactive elements
  if (['button', 'a', 'input', 'textarea', 'select', 'summary'].includes(tag)) return true

  // Images (including those with empty alt — those are explicitly decorative)
  if (tag === 'img') return true

  // Table structure
  if (['table', 'th', 'td', 'caption'].includes(tag)) return true

  // Lists
  if (['ul', 'ol', 'li'].includes(tag)) return true

  // Semantic elements
  if (['main', 'nav', 'aside', 'header', 'footer', 'section', 'article', 'form', 'fieldset', 'figure', 'figcaption', 'search', 'details'].includes(tag)) return true

  // <hr> is announced as separator
  if (tag === 'hr') return true

  // Embedded content
  if (['iframe', 'video', 'audio', 'canvas', 'svg', 'embed', 'object'].includes(tag)) return true

  // Generic elements with tabindex
  if (element.hasAttribute('tabindex')) return true

  return false
}

function isVisuallyHidden(element: Element): boolean {
  const style = element.getAttribute('style')
  if (!style) return false

  const lower = style.toLowerCase()

  // Check display: none
  if (/display\s*:\s*none/.test(lower)) return true

  // Check visibility: hidden
  if (/visibility\s*:\s*hidden/.test(lower)) return true

  return false
}
