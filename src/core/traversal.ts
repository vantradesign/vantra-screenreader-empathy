/**
 * Accessibility tree traversal.
 *
 * The main entry point: `analyzeAccessibilityFlow()` takes HTML
 * (string, Element, or Document) and returns a TraversalResult
 * with the reading order sequence and deterministic flags.
 */

import type {
  AnalyzeOptions,
  DeterministicFlagCode,
  TraversalEntry,
  TraversalResult,
  TraversalSummary,
  TraversalWarning,
} from './types.js'
import { computeAccessibleName } from './accessible-name.js'
import { computeReadingOrder } from './reading-order.js'
import { isLandmark } from './landmarks.js'
import {
  detectFlags,
  detectPageFlags,
  getHeadingLevel,
  resolveRole,
} from './deterministic-flags.js'
import type { FlagContext } from './deterministic-flags.js'

const DEFAULT_MAX_ENTRIES = 5000

/**
 * Analyze the accessibility flow of an HTML document or element.
 * Returns the reading order sequence with deterministic flags.
 *
 * Works in browsers (live DOM) and Node (with jsdom).
 * No AI, no audio — pure deterministic analysis.
 */
export function analyzeAccessibilityFlow(
  input: string | HTMLElement | Document,
  options?: AnalyzeOptions,
): TraversalResult {
  const maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES
  const includeHidden = options?.includeHidden ?? false

  // Parse HTML string into a DOM if needed
  const { root, warnings: parseWarnings } = parseInput(input)

  const warnings: TraversalWarning[] = [...parseWarnings]

  // Compute reading order
  const elements = computeReadingOrder(root, includeHidden)

  // Check for truncation
  if (elements.length > maxEntries) {
    elements.length = maxEntries
    warnings.push({
      code: 'truncated',
      message: `Traversal truncated at ${maxEntries} entries. The page has more than ${maxEntries} readable elements.`,
    })
  }

  // Build traversal entries
  const entries: TraversalEntry[] = []
  const flagContext: FlagContext = { previousHeadingLevel: 0 }
  let hasMainLandmark = false

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i]!
    const role = resolveRole(element)
    const accessibleName = computeAccessibleName(element)
    const elementIsLandmark = isLandmark(element)
    const level = role === 'heading' ? getHeadingLevel(element) : undefined
    const flags = detectFlags(element, accessibleName, role, flagContext)

    if (role === 'main') hasMainLandmark = true

    entries.push({
      index: i,
      accessibleName,
      role,
      level,
      selector: buildSelector(element),
      htmlSnippet: getSnippet(element),
      isLandmark: elementIsLandmark,
      flags,
    })
  }

  // Page-level flags
  const pageFlags = detectPageFlags(root, hasMainLandmark)

  // Build summary
  const summary = buildSummary(entries, pageFlags)

  // Add page-level flags as entries at index -1 (or attach to result)
  // Per spec, page-level flags go into the summary.flagCount
  for (const pf of pageFlags) {
    const code = pf.code as DeterministicFlagCode
    summary.flagCount[code] = (summary.flagCount[code] ?? 0) + 1
  }

  return { entries, summary, warnings }
}

// ── Input parsing ──

function parseInput(
  input: string | HTMLElement | Document,
): { root: Element | Document; warnings: TraversalWarning[] } {
  const warnings: TraversalWarning[] = []

  if (typeof input === 'string') {
    // Parse HTML string using DOMParser (available in browsers and jsdom)
    const parser = new DOMParser()
    const doc = parser.parseFromString(input, 'text/html')

    // Check for parse errors
    const parseError = doc.querySelector('parsererror')
    if (parseError) {
      warnings.push({
        code: 'jsdom-limitation',
        message: 'HTML parse error detected. Results may be incomplete.',
      })
    }

    return { root: doc, warnings }
  }

  if ('documentElement' in input) {
    // It's a Document
    return { root: input, warnings }
  }

  // It's an HTMLElement
  return { root: input, warnings }
}

// ── Selector building ──

function buildSelector(element: Element): string {
  const parts: string[] = []
  let current: Element | null = element

  while (current && current.nodeType === 1) {
    const tag = current.tagName.toLowerCase()

    // Stop at body
    if (tag === 'body' || tag === 'html') {
      parts.unshift(tag)
      break
    }

    const id = current.getAttribute('id')
    if (id) {
      const escapedId = typeof CSS !== 'undefined' && CSS.escape
        ? CSS.escape(id)
        : id
      parts.unshift(`${tag}#${escapedId}`)
      break
    }

    // Use nth-child for disambiguation
    const parent: Element | null = current.parentElement
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (s: Element) => s.tagName === current!.tagName,
      )
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1
        parts.unshift(`${tag}:nth-of-type(${index})`)
      } else {
        parts.unshift(tag)
      }
    } else {
      parts.unshift(tag)
    }

    current = parent
  }

  return parts.join(' > ')
}

// ── Snippet extraction ──

function getSnippet(element: Element, maxLength = 120): string {
  const outer = element.outerHTML
  if (outer.length <= maxLength) return outer

  // Truncate inner content
  const tag = element.tagName.toLowerCase()
  const openTag = outer.slice(0, outer.indexOf('>') + 1)
  const remaining = maxLength - openTag.length - tag.length - 5 // </tag> + …
  if (remaining > 10) {
    return `${openTag}${element.innerHTML.slice(0, remaining)}…</${tag}>`
  }
  return `${openTag}…</${tag}>`
}

// ── Summary building ──

function buildSummary(
  entries: TraversalEntry[],
  _pageFlags: ReturnType<typeof detectPageFlags>,
): TraversalSummary {
  const headingStructure: { level: number; name: string }[] = []
  const flagCount: Partial<Record<DeterministicFlagCode, number>> = {}
  let landmarkCount = 0

  for (const entry of entries) {
    if (entry.isLandmark) landmarkCount++

    if (entry.role === 'heading' && entry.level) {
      headingStructure.push({
        level: entry.level,
        name: entry.accessibleName,
      })
    }

    for (const f of entry.flags) {
      flagCount[f.code] = (flagCount[f.code] ?? 0) + 1
    }
  }

  return {
    totalElements: entries.length,
    landmarkCount,
    headingStructure,
    flagCount,
  }
}
