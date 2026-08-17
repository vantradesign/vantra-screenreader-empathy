/**
 * Deterministic flag detection — rule-based issue detection with no AI.
 *
 * Each flag function examines an element and its context to produce
 * zero or more DeterministicFlag entries. These are reproducible,
 * will never hallucinate, and require no model.
 */

import type { DeterministicFlag, DeterministicFlagCode } from './types.js'

// ── Helpers ──

function flag(
  code: DeterministicFlagCode,
  severity: DeterministicFlag['severity'],
  message: string,
): DeterministicFlag {
  return { code, severity, message }
}

const GENERIC_LINK_TEXTS = new Set([
  'click here', 'read more', 'learn more', 'more', 'here',
  'link', 'this', 'go', 'continue', 'details',
])

// ── Flag detectors ──

/**
 * Detect all flags for a single element in context.
 */
export function detectFlags(
  element: Element,
  accessibleName: string,
  role: string,
  context: FlagContext,
): DeterministicFlag[] {
  const flags: DeterministicFlag[] = []

  checkMissingAccessibleName(element, accessibleName, role, flags)
  checkEmptyLinkText(element, accessibleName, role, flags)
  checkEmptyButtonText(element, accessibleName, role, flags)
  checkMissingFormLabel(element, accessibleName, flags)
  checkHeadingLevelSkip(element, role, context, flags)
  checkRedundantRole(element, role, flags)
  checkMissingAltText(element, flags)
  checkGenericLinkText(accessibleName, role, flags)
  checkTabindexPositive(element, flags)

  return flags
}

/**
 * Detect page-level flags that apply to the document as a whole.
 */
export function detectPageFlags(
  root: Element | Document,
  hasMainLandmark: boolean,
): DeterministicFlag[] {
  const flags: DeterministicFlag[] = []

  // Missing main landmark
  if (!hasMainLandmark) {
    flags.push(flag(
      'missing-landmark',
      'serious',
      'Page has no <main> landmark. Screen reader users cannot jump directly to the primary content.',
    ))
  }

  // Missing lang attribute
  const isDocument = 'documentElement' in root
  const doc = isDocument ? root as Document : root.ownerDocument
  const html = doc?.documentElement

  if (html && !html.getAttribute('lang')?.trim()) {
    flags.push(flag(
      'no-lang-attribute',
      'serious',
      '<html> has no lang attribute. Screen readers cannot select the correct speech voice.',
    ))
  }

  // Duplicate IDs
  const idMap = new Map<string, number>()
  const queryRoot = isDocument ? root as Document : root.ownerDocument
  if (!queryRoot) return flags
  const allWithId = queryRoot.querySelectorAll('[id]')

  for (const el of allWithId) {
    const id = el.getAttribute('id')
    if (id) {
      idMap.set(id, (idMap.get(id) ?? 0) + 1)
    }
  }

  for (const [id, count] of idMap) {
    if (count > 1) {
      flags.push(flag(
        'duplicate-id',
        'serious',
        `ID "${id}" is used ${count} times. This breaks aria-labelledby and label[for] references.`,
      ))
    }
  }

  return flags
}

export interface FlagContext {
  /** The previous heading level encountered, or 0 if none */
  previousHeadingLevel: number
}

// ── Individual checkers ──

function checkMissingAccessibleName(
  _element: Element,
  name: string,
  role: string,
  flags: DeterministicFlag[],
): void {
  // Only flag roles that should have names
  const ROLES_NEEDING_NAMES = new Set([
    'button', 'link', 'heading', 'image', 'textbox', 'checkbox', 'radio',
    'navigation', 'main', 'region', 'form', 'search',
    'tab', 'tabpanel', 'dialog', 'alertdialog',
  ])

  if (!ROLES_NEEDING_NAMES.has(role)) return

  // Exceptions: links and buttons have their own more specific flags
  if (role === 'link' || role === 'button') return

  // Images have their own flag (missing-alt-text)
  if (role === 'image') return

  if (!name) {
    flags.push(flag(
      'missing-accessible-name',
      'critical',
      `Element with role "${role}" has no accessible name. A screen reader will announce the role with nothing to identify it.`,
    ))
  }
}

function checkEmptyLinkText(
  _element: Element,
  name: string,
  role: string,
  flags: DeterministicFlag[],
): void {
  if (role !== 'link') return
  if (!name.trim()) {
    flags.push(flag(
      'empty-link-text',
      'critical',
      'Link has no text content. A screen reader will say "link" with no destination.',
    ))
  }
}

function checkEmptyButtonText(
  _element: Element,
  name: string,
  role: string,
  flags: DeterministicFlag[],
): void {
  if (role !== 'button') return
  if (!name.trim()) {
    flags.push(flag(
      'empty-button-text',
      'critical',
      'Button has no text content. A screen reader will say "button" with no action.',
    ))
  }
}

function checkMissingFormLabel(
  element: Element,
  name: string,
  flags: DeterministicFlag[],
): void {
  const tag = element.tagName.toLowerCase()
  if (!['input', 'textarea', 'select'].includes(tag)) return

  // Skip hidden inputs
  if (tag === 'input') {
    const type = element.getAttribute('type')
    if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'reset' || type === 'image') return
  }

  if (!name.trim()) {
    flags.push(flag(
      'missing-form-label',
      'critical',
      'Form control has no associated label, aria-label, or aria-labelledby.',
    ))
  }
}

function checkHeadingLevelSkip(
  element: Element,
  role: string,
  context: FlagContext,
  flags: DeterministicFlag[],
): void {
  if (role !== 'heading') return

  const level = getHeadingLevel(element)
  if (!level) return

  if (context.previousHeadingLevel > 0 && level > context.previousHeadingLevel + 1) {
    flags.push(flag(
      'heading-level-skip',
      'moderate',
      `Heading jumps from h${context.previousHeadingLevel} to h${level}. This disrupts heading navigation.`,
    ))
  }

  context.previousHeadingLevel = level
}

function checkRedundantRole(
  element: Element,
  _role: string,
  flags: DeterministicFlag[],
): void {
  const explicitRole = element.getAttribute('role')
  if (!explicitRole) return

  const tag = element.tagName.toLowerCase()
  const REDUNDANT_MAP: Record<string, string> = {
    button: 'button',
    a: 'link',
    nav: 'navigation',
    main: 'main',
    aside: 'complementary',
    header: 'banner',
    footer: 'contentinfo',
    h1: 'heading',
    h2: 'heading',
    h3: 'heading',
    h4: 'heading',
    h5: 'heading',
    h6: 'heading',
    ul: 'list',
    ol: 'list',
    li: 'listitem',
    table: 'table',
    tr: 'row',
    td: 'cell',
    th: 'columnheader',
    img: 'img',
    input: getImplicitInputRole(element),
    select: 'listbox',
    textarea: 'textbox',
    form: 'form',
    article: 'article',
    section: 'region',
    hr: 'separator',
  }

  const implicitRole = REDUNDANT_MAP[tag]
  if (implicitRole && explicitRole === implicitRole) {
    flags.push(flag(
      'redundant-role',
      'minor',
      `role="${explicitRole}" on <${tag}> is redundant — the element already has this implicit role.`,
    ))
  }
}

function checkMissingAltText(
  element: Element,
  flags: DeterministicFlag[],
): void {
  if (element.tagName.toLowerCase() !== 'img') return

  // Has alt attribute (even empty alt="" is intentional = decorative)
  if (element.hasAttribute('alt')) return

  // Check role="presentation" or role="none"
  const role = element.getAttribute('role')
  if (role === 'presentation' || role === 'none') return

  flags.push(flag(
    'missing-alt-text',
    'critical',
    'Image has no alt attribute. A screen reader will announce "image" with no description. Use alt="" if decorative.',
  ))
}

function checkGenericLinkText(
  name: string,
  role: string,
  flags: DeterministicFlag[],
): void {
  if (role !== 'link') return
  if (!name) return

  if (GENERIC_LINK_TEXTS.has(name.toLowerCase().trim())) {
    flags.push(flag(
      'generic-link-text',
      'moderate',
      `Link text "${name}" is generic. A screen reader user navigating by links hears "${name}" with no context.`,
    ))
  }
}

function checkTabindexPositive(
  element: Element,
  flags: DeterministicFlag[],
): void {
  const tabindex = element.getAttribute('tabindex')
  if (tabindex === null) return

  const value = parseInt(tabindex, 10)
  if (!isNaN(value) && value > 0) {
    flags.push(flag(
      'tabindex-positive',
      'moderate',
      `tabindex="${value}" overrides natural tab order. This is almost always a mistake.`,
    ))
  }
}

// ── Utilities ──

export function getHeadingLevel(element: Element): number {
  // Check explicit aria-level
  const ariaLevel = element.getAttribute('aria-level')
  if (ariaLevel) {
    const level = parseInt(ariaLevel, 10)
    if (level >= 1 && level <= 6) return level
  }

  // Check h1-h6 tag
  const match = element.tagName.toLowerCase().match(/^h([1-6])$/)
  if (match?.[1]) return parseInt(match[1], 10)

  return 0
}

function getImplicitInputRole(element: Element): string {
  const type = element.getAttribute('type') || 'text'
  switch (type) {
    case 'checkbox': return 'checkbox'
    case 'radio': return 'radio'
    case 'range': return 'slider'
    case 'search': return 'searchbox'
    case 'email':
    case 'tel':
    case 'url':
    case 'text':
    default: return 'textbox'
  }
}

// ── Role resolution ──

const IMPLICIT_ROLE_MAP: Record<string, string> = {
  a: 'link',
  button: 'button',
  h1: 'heading', h2: 'heading', h3: 'heading',
  h4: 'heading', h5: 'heading', h6: 'heading',
  img: 'image',
  input: 'textbox',
  textarea: 'textbox',
  select: 'listbox',
  table: 'table',
  tr: 'row',
  td: 'cell',
  th: 'columnheader',
  ul: 'list',
  ol: 'list',
  li: 'listitem',
  nav: 'navigation',
  main: 'main',
  aside: 'complementary',
  header: 'banner',
  footer: 'contentinfo',
  section: 'region',
  article: 'article',
  form: 'form',
  fieldset: 'group',
  figure: 'figure',
  hr: 'separator',
  details: 'group',
  summary: 'button',
  search: 'search',
  dialog: 'dialog',
  output: 'status',
  progress: 'progressbar',
  meter: 'meter',
}

/**
 * Resolve the ARIA role of an element. Explicit role takes precedence.
 */
export function resolveRole(element: Element): string {
  const explicitRole = element.getAttribute('role')?.trim().toLowerCase()
  if (explicitRole) return explicitRole

  const tag = element.tagName.toLowerCase()

  // Special cases for input types
  if (tag === 'input') {
    return getImplicitInputRole(element)
  }

  // <a> is only a link if it has href
  if (tag === 'a') {
    return element.hasAttribute('href') ? 'link' : 'generic'
  }

  return IMPLICIT_ROLE_MAP[tag] || 'generic'
}
