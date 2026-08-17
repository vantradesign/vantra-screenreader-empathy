/**
 * Accessible Name computation following the AccName 1.2 specification.
 * @see https://www.w3.org/TR/accname-1.2/
 *
 * This is a simplified but correct implementation covering the most
 * common patterns. CSS pseudo-element content (::before/::after) is
 * not computable without getComputedStyle (unavailable in jsdom for
 * many cases), so it is omitted with a documented limitation.
 */

// Elements that allow "name from content" per ARIA spec
const NAME_FROM_CONTENT_ROLES = new Set([
  'button', 'cell', 'checkbox', 'columnheader', 'gridcell', 'heading',
  'link', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option',
  'radio', 'row', 'rowheader', 'switch', 'tab', 'tooltip', 'treeitem',
])

// HTML elements that implicitly allow name from content
const NAME_FROM_CONTENT_ELEMENTS = new Set([
  'a', 'button', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'label', 'legend', 'caption', 'figcaption', 'summary',
  'td', 'th', 'option', 'output',
])

/**
 * Compute the accessible name for an element.
 * Implements AccName 1.2 steps in simplified order:
 *
 * 1. aria-labelledby (concatenated, with loop protection)
 * 2. aria-label
 * 3. Native text alternatives (alt, label-for, caption, legend, figcaption)
 * 4. Text content (for elements that allow name from content)
 * 5. title attribute (fallback)
 * 6. placeholder (last resort for inputs)
 */
export function computeAccessibleName(
  element: Element,
  visited: Set<Element> = new Set(),
): string {
  if (visited.has(element)) return ''

  // Step 1: aria-labelledby
  const labelledBy = element.getAttribute('aria-labelledby')
  if (labelledBy && !visited.has(element)) {
    const ids = labelledBy.split(/\s+/).filter(Boolean)
    const doc = element.ownerDocument
    const names: string[] = []
    const nextVisited = new Set(visited)
    nextVisited.add(element)

    for (const id of ids) {
      const ref = doc.getElementById(id)
      if (ref) {
        names.push(getTextContent(ref, nextVisited))
      }
    }

    const result = names.join(' ').trim()
    if (result) return result
  }

  // Step 2: aria-label
  const ariaLabel = element.getAttribute('aria-label')
  if (ariaLabel?.trim()) return ariaLabel.trim()

  // Step 3: Native text alternatives
  const nativeName = getNativeTextAlternative(element, visited)
  if (nativeName) return nativeName

  // Step 4: Name from content (text content)
  if (allowsNameFromContent(element)) {
    const text = getTextContent(element, visited)
    if (text) return text
  }

  // Step 5: title attribute
  const title = element.getAttribute('title')
  if (title?.trim()) return title.trim()

  // Step 6: placeholder (inputs only)
  if (isInputElement(element)) {
    const placeholder = element.getAttribute('placeholder')
    if (placeholder?.trim()) return placeholder.trim()
  }

  return ''
}

function getNativeTextAlternative(
  element: Element,
  visited: Set<Element>,
): string {
  const tag = element.tagName.toLowerCase()

  // <img alt="...">
  if (tag === 'img' || tag === 'area') {
    const alt = element.getAttribute('alt')
    if (alt !== null) return alt.trim()
  }

  // <input type="image" alt="...">
  if (tag === 'input' && element.getAttribute('type') === 'image') {
    const alt = element.getAttribute('alt')
    if (alt?.trim()) return alt.trim()
    const value = element.getAttribute('value')
    if (value?.trim()) return value.trim()
    return 'Submit'
  }

  // <input> / <textarea> / <select> — check for <label>
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    return getFormLabelName(element, visited)
  }

  // <fieldset> → <legend>
  if (tag === 'fieldset') {
    const legend = element.querySelector('legend')
    if (legend) return getTextContent(legend, visited)
  }

  // <figure> → <figcaption>
  if (tag === 'figure') {
    const caption = element.querySelector('figcaption')
    if (caption) return getTextContent(caption, visited)
  }

  // <table> → <caption>
  if (tag === 'table') {
    const caption = element.querySelector('caption')
    if (caption) return getTextContent(caption, visited)
  }

  return ''
}

function getFormLabelName(element: Element, visited: Set<Element>): string {
  const id = element.getAttribute('id')
  if (id) {
    const doc = element.ownerDocument
    const escapedId = typeof CSS !== 'undefined' && CSS.escape
      ? CSS.escape(id)
      : id.replace(/"/g, '\\"')
    const labels = doc.querySelectorAll(`label[for="${escapedId}"]`)
    if (labels.length > 0) {
      const names: string[] = []
      for (const label of labels) {
        names.push(getTextContent(label as Element, visited))
      }
      return names.join(' ').trim()
    }
  }

  // Check for wrapping <label>
  const parent = element.closest('label')
  if (parent) {
    return getTextContent(parent, visited)
  }

  return ''
}

/**
 * Get the text content of an element, respecting aria-hidden
 * and recursively computing names for embedded elements.
 *
 * Hidden elements referenced by aria-labelledby DO contribute
 * their text content (per spec), which is why we pass the
 * visited set through.
 */
function getTextContent(element: Element, visited: Set<Element>): string {
  const nextVisited = new Set(visited)
  nextVisited.add(element)

  const parts: string[] = []

  for (const child of element.childNodes) {
    if (child.nodeType === 3 /* TEXT */) {
      const text = (child as Text).textContent
      if (text) parts.push(text)
    } else if (child.nodeType === 1 /* ELEMENT */) {
      const childEl = child as Element

      // Embedded controls contribute their value
      const embeddedValue = getEmbeddedControlValue(childEl)
      if (embeddedValue !== null) {
        parts.push(embeddedValue)
        continue
      }

      // Skip aria-hidden elements (unless we're computing for aria-labelledby ref)
      if (childEl.getAttribute('aria-hidden') === 'true' && !visited.has(element)) {
        continue
      }

      // Recurse, using the accessible name if the child has one
      const childName = computeAccessibleName(childEl, nextVisited)
      if (childName) {
        parts.push(childName)
      } else {
        parts.push(getTextContent(childEl, nextVisited))
      }
    }
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

function getEmbeddedControlValue(element: Element): string | null {
  const tag = element.tagName.toLowerCase()

  if (tag === 'input') {
    const type = element.getAttribute('type') || 'text'
    if (['text', 'search', 'tel', 'url', 'email', 'number'].includes(type)) {
      return element.getAttribute('value') || ''
    }
    if (type === 'range') {
      return element.getAttribute('value') ||
        element.getAttribute('aria-valuenow') || '50'
    }
  }

  if (tag === 'select') {
    const selected = element.querySelector('option[selected]') ?? element.querySelector('option')
    return selected?.textContent?.trim() || ''
  }

  if (tag === 'textarea') {
    return element.textContent || ''
  }

  return null
}

function allowsNameFromContent(element: Element): boolean {
  const role = element.getAttribute('role')
  if (role && NAME_FROM_CONTENT_ROLES.has(role)) return true
  return NAME_FROM_CONTENT_ELEMENTS.has(element.tagName.toLowerCase())
}

function isInputElement(element: Element): boolean {
  const tag = element.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select'
}
