/**
 * Deterministic flag detection — rule-based issue detection with no AI.
 *
 * Each flag function examines an element and its context to produce
 * zero or more DeterministicFlag entries. These are reproducible,
 * will never hallucinate, and require no model.
 */

import type { DeterministicFlag, DeterministicFlagCode, TraversalEntry } from './types.js'

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
  checkFieldsetNoLegend(element, flags)
  checkTableNoHeaders(element, flags)
  checkTableNoCaption(element, flags)
  checkFormNoSubmit(element, flags)

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

  const isDocument = 'documentElement' in root
  const doc = isDocument ? root as Document : root.ownerDocument
  const queryRoot = isDocument ? root as Document : root.ownerDocument
  const html = doc?.documentElement

  // Missing main landmark
  if (!hasMainLandmark) {
    flags.push(flag(
      'missing-landmark',
      'serious',
      'Page has no <main> landmark. Screen reader users cannot jump directly to the primary content.',
    ))
  }

  // Missing lang attribute
  if (html && !html.getAttribute('lang')?.trim()) {
    flags.push(flag(
      'no-lang-attribute',
      'serious',
      '<html> has no lang attribute. Screen readers cannot select the correct speech voice.',
    ))
  }

  // Duplicate IDs
  if (queryRoot) {
    const idMap = new Map<string, number>()
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
  }

  if (!queryRoot) return flags

  // ── IA / UX page-level checks ──

  // no-h1 / multiple-h1
  const h1s = queryRoot.querySelectorAll('h1, [role="heading"][aria-level="1"]')
  if (h1s.length === 0) {
    flags.push(flag(
      'no-h1',
      'serious',
      'Page has no h1. The document has no clear primary title — heading navigation starts without a root.',
    ))
  } else if (h1s.length > 1) {
    flags.push(flag(
      'multiple-h1',
      'moderate',
      `Page has ${h1s.length} h1 elements. This creates an ambiguous document title — which one is the page about?`,
    ))
  }

  // no-nav-landmark
  const navs = queryRoot.querySelectorAll('nav, [role="navigation"]')
  if (navs.length === 0) {
    flags.push(flag(
      'no-nav-landmark',
      'moderate',
      'Page has no <nav> landmark. There is no marked navigation region for users to jump to.',
    ))
  }

  // duplicate-landmark-no-label
  checkDuplicateLandmarksNoLabel(queryRoot, flags)

  // no-skip-link
  checkNoSkipLink(queryRoot, flags)

  // landmark-nesting-violation
  checkLandmarkNesting(queryRoot, flags)

  // flat-structure
  checkFlatStructure(queryRoot, flags)

  // no-title
  if (isDocument) {
    const title = (root as Document).title?.trim()
    if (!title) {
      flags.push(flag(
        'no-title',
        'serious',
        'Page has no <title>. The browser tab, bookmarks, and search results have no name for this page.',
      ))
    }
  }

  // viewport-no-zoom
  const viewport = queryRoot.querySelector('meta[name="viewport"]')
  if (viewport) {
    const content = viewport.getAttribute('content')?.toLowerCase() ?? ''
    if (
      /user-scalable\s*=\s*no/.test(content) ||
      /maximum-scale\s*=\s*1(\.0)?(?!\d)/.test(content)
    ) {
      flags.push(flag(
        'viewport-no-zoom',
        'serious',
        'Viewport meta disables zoom. Users who need to enlarge text cannot do so.',
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

function checkFieldsetNoLegend(
  element: Element,
  flags: DeterministicFlag[],
): void {
  if (element.tagName.toLowerCase() !== 'fieldset') return
  const legend = element.querySelector('legend')
  if (!legend || !legend.textContent?.trim()) {
    flags.push(flag(
      'fieldset-no-legend',
      'moderate',
      '<fieldset> has no <legend>. Grouped form controls have no group label — users cannot tell what this group is for.',
    ))
  }
}

function checkTableNoHeaders(
  element: Element,
  flags: DeterministicFlag[],
): void {
  if (element.tagName.toLowerCase() !== 'table') return
  // Ignore layout tables
  const role = element.getAttribute('role')
  if (role === 'presentation' || role === 'none') return
  const ths = element.querySelectorAll('th')
  if (ths.length === 0) {
    flags.push(flag(
      'table-no-headers',
      'serious',
      'Data table has no <th> elements. Screen readers cannot associate cells with their column or row headers.',
    ))
  }
}

function checkTableNoCaption(
  element: Element,
  flags: DeterministicFlag[],
): void {
  if (element.tagName.toLowerCase() !== 'table') return
  const role = element.getAttribute('role')
  if (role === 'presentation' || role === 'none') return
  const caption = element.querySelector('caption')
  const ariaLabel = element.getAttribute('aria-label')?.trim()
  const ariaLabelledby = element.getAttribute('aria-labelledby')?.trim()
  if (!caption?.textContent?.trim() && !ariaLabel && !ariaLabelledby) {
    flags.push(flag(
      'table-no-caption',
      'moderate',
      'Data table has no <caption> or accessible name. Users encounter a table with no description of what data it contains.',
    ))
  }
}

function checkFormNoSubmit(
  element: Element,
  flags: DeterministicFlag[],
): void {
  if (element.tagName.toLowerCase() !== 'form') return
  const submit = element.querySelector(
    'input[type="submit"], button[type="submit"], button:not([type])',
  )
  if (!submit) {
    flags.push(flag(
      'form-no-submit',
      'moderate',
      '<form> has no submit button. Users may not know how to submit the form.',
    ))
  }
}

// ── Page-level IA helpers ──

const LANDMARK_ROLE_TAGS: Record<string, string> = {
  nav: 'navigation',
  main: 'main',
  aside: 'complementary',
  header: 'banner',
  footer: 'contentinfo',
  section: 'region',
  form: 'form',
  search: 'search',
}

const NON_NESTABLE_LANDMARKS = new Set(['main', 'banner', 'contentinfo'])

function resolveLandmarkRole(element: Element): string | null {
  const explicit = element.getAttribute('role')?.trim().toLowerCase()
  if (explicit && [
    'banner', 'complementary', 'contentinfo', 'form', 'main',
    'navigation', 'region', 'search',
  ].includes(explicit)) {
    return explicit
  }
  return LANDMARK_ROLE_TAGS[element.tagName.toLowerCase()] ?? null
}

function checkDuplicateLandmarksNoLabel(
  root: Document,
  flags: DeterministicFlag[],
): void {
  const landmarksByRole = new Map<string, Element[]>()
  const selectors = 'nav, main, aside, header, footer, section, form, search, [role="navigation"], [role="main"], [role="complementary"], [role="banner"], [role="contentinfo"], [role="region"], [role="form"], [role="search"]'
  const elements = root.querySelectorAll(selectors)

  for (const el of elements) {
    const role = resolveLandmarkRole(el)
    if (!role) continue
    const arr = landmarksByRole.get(role) ?? []
    arr.push(el)
    landmarksByRole.set(role, arr)
  }

  for (const [role, els] of landmarksByRole) {
    if (els.length < 2) continue
    const unlabeled = els.filter((el) => {
      const label = el.getAttribute('aria-label')?.trim()
      const labelledby = el.getAttribute('aria-labelledby')?.trim()
      const title = el.getAttribute('title')?.trim()
      return !label && !labelledby && !title
    })
    if (unlabeled.length >= 2) {
      flags.push(flag(
        'duplicate-landmark-no-label',
        'serious',
        `${els.length} "${role}" landmarks exist but ${unlabeled.length} have no label. Users cannot distinguish between them.`,
      ))
    }
  }
}

function checkNoSkipLink(
  root: Document,
  flags: DeterministicFlag[],
): void {
  // Look for a link whose href starts with # in the first few elements
  const body = root.body
  if (!body) return

  const firstLinks: Element[] = []
  const walker = root.createTreeWalker(body, 1 /* SHOW_ELEMENT */)
  let count = 0
  let node = walker.nextNode() as Element | null
  while (node && count < 10) {
    if (node.tagName.toLowerCase() === 'a' && node.getAttribute('href')?.startsWith('#')) {
      firstLinks.push(node)
    }
    count++
    node = walker.nextNode() as Element | null
  }

  const hasSkipLink = firstLinks.some((link) => {
    const href = link.getAttribute('href') ?? ''
    const text = link.textContent?.toLowerCase() ?? ''
    return (
      href === '#main' ||
      href === '#main-content' ||
      href === '#content' ||
      text.includes('skip') ||
      text.includes('jump to') ||
      text.includes('zum inhalt')
    )
  })

  if (!hasSkipLink) {
    flags.push(flag(
      'no-skip-link',
      'moderate',
      'No skip navigation link found. Keyboard users must tab through all navigation before reaching content.',
    ))
  }
}

function checkLandmarkNesting(
  root: Document,
  flags: DeterministicFlag[],
): void {
  const selectors = 'main, [role="main"], header, [role="banner"], footer, [role="contentinfo"]'
  const elements = root.querySelectorAll(selectors)

  for (const el of elements) {
    const role = resolveLandmarkRole(el)
    if (!role || !NON_NESTABLE_LANDMARKS.has(role)) continue

    // Walk up to see if there's an ancestor with the same landmark role
    let parent = el.parentElement
    while (parent) {
      const parentRole = resolveLandmarkRole(parent)
      if (parentRole === role) {
        flags.push(flag(
          'landmark-nesting-violation',
          'serious',
          `A "${role}" landmark is nested inside another "${role}" landmark. This creates a broken document structure.`,
        ))
        break
      }
      parent = parent.parentElement
    }
  }
}

function checkFlatStructure(
  root: Document,
  flags: DeterministicFlag[],
): void {
  const body = root.body
  if (!body) return

  const headings = body.querySelectorAll('h1, h2, h3, h4, h5, h6')
  const landmarks = body.querySelectorAll(
    'main, nav, aside, header, footer, section[aria-label], section[aria-labelledby], [role="navigation"], [role="main"], [role="complementary"], [role="banner"], [role="contentinfo"], [role="region"], [role="search"]',
  )

  if (headings.length === 0 && landmarks.length === 0) {
    flags.push(flag(
      'flat-structure',
      'serious',
      'Page has no headings and no landmarks. The content is a flat block with no navigable structure.',
    ))
  }
}

/**
 * Detect IA flags that require the full entries array.
 * Called after traversal entries are built.
 */
export function detectEntryPatternFlags(
  entries: TraversalEntry[],
): DeterministicFlag[] {
  const flags: DeterministicFlag[] = []

  checkContentBeforeMain(entries, flags)
  checkOrphanedContent(entries, flags)
  checkIdenticalLinksDifferentHref(entries, flags)
  checkAdjacentDuplicateLinks(entries, flags)
  checkWallOfText(entries, flags)

  return flags
}

function checkContentBeforeMain(
  entries: TraversalEntry[],
  flags: DeterministicFlag[],
): void {
  const mainIndex = entries.findIndex((e) => e.role === 'main')
  if (mainIndex < 0) return // no main — already flagged by missing-landmark
  // Count non-landmark, non-navigation entries before main
  const contentBefore = entries.slice(0, mainIndex).filter(
    (e) => !e.isLandmark && e.role !== 'navigation',
  ).length
  if (contentBefore > 20) {
    flags.push(flag(
      'content-before-main',
      'moderate',
      `${contentBefore} elements appear before the <main> landmark. Users must wade through significant content before reaching the primary area.`,
    ))
  }
}

function checkOrphanedContent(
  entries: TraversalEntry[],
  flags: DeterministicFlag[],
): void {
  if (entries.length === 0) return
  // An entry is orphaned if its selector doesn't pass through any landmark
  // Heuristic: entries not inside main, nav, aside, header, footer, section, form, search
  const landmarkSelectors = ['main', 'nav', 'aside', 'header', 'footer', 'search']
  const orphaned = entries.filter((e) => {
    const sel = e.selector.toLowerCase()
    return !e.isLandmark && !landmarkSelectors.some((l) => sel.includes(` ${l}`) || sel.startsWith(l) || sel.includes(`${l} `) || sel.includes(`${l}>`) || sel.includes(`${l}#`) || sel.includes(`${l}:`) || sel.includes(`${l}.`))
  })
  const percent = Math.round((orphaned.length / entries.length) * 100)
  if (percent > 50 && entries.length > 5) {
    flags.push(flag(
      'orphaned-content',
      'moderate',
      `${percent}% of content (${orphaned.length} of ${entries.length} elements) is outside any landmark region. Landmark navigation will skip most of the page.`,
    ))
  }
}

function checkIdenticalLinksDifferentHref(
  entries: TraversalEntry[],
  flags: DeterministicFlag[],
): void {
  const linksByText = new Map<string, Set<string>>()
  for (const e of entries) {
    if (e.role !== 'link' || !e.accessibleName.trim()) continue
    const key = e.accessibleName.toLowerCase().trim()
    const href = extractHref(e.htmlSnippet)
    if (!href) continue
    const set = linksByText.get(key) ?? new Set()
    set.add(href)
    linksByText.set(key, set)
  }
  for (const [text, hrefs] of linksByText) {
    if (hrefs.size > 1) {
      flags.push(flag(
        'identical-links-different-href',
        'moderate',
        `${hrefs.size} links with text "${text}" point to different destinations. Users navigating by link list cannot tell them apart.`,
      ))
    }
  }
}

function checkAdjacentDuplicateLinks(
  entries: TraversalEntry[],
  flags: DeterministicFlag[],
): void {
  let count = 0
  for (let i = 0; i < entries.length - 1; i++) {
    const a = entries[i]!
    const b = entries[i + 1]!
    if (a.role !== 'link' || b.role !== 'link') continue
    const hrefA = extractHref(a.htmlSnippet)
    const hrefB = extractHref(b.htmlSnippet)
    if (hrefA && hrefB && hrefA === hrefB && a.accessibleName !== b.accessibleName) {
      count++
    }
  }
  if (count > 0) {
    flags.push(flag(
      'adjacent-duplicate-links',
      'moderate',
      `${count} adjacent link pair(s) point to the same destination (e.g. image + text link). These create redundant tab stops.`,
    ))
  }
}

function checkWallOfText(
  entries: TraversalEntry[],
  flags: DeterministicFlag[],
): void {
  // Count consecutive non-heading, non-landmark text entries
  let streak = 0
  let maxStreak = 0
  for (const e of entries) {
    if (e.role === 'heading' || e.isLandmark) {
      streak = 0
    } else {
      streak++
      if (streak > maxStreak) maxStreak = streak
    }
  }
  if (maxStreak > 30) {
    flags.push(flag(
      'wall-of-text',
      'moderate',
      `${maxStreak} consecutive elements without a heading or landmark break. Long runs of content without structure are hard to navigate.`,
    ))
  }
}

function extractHref(htmlSnippet: string): string | null {
  const match = htmlSnippet.match(/href=["']([^"']*)["']/i)
  return match?.[1] ?? null
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
