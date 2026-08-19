/**
 * Structure report — IA-oriented interpretation of traversal results.
 *
 * Takes a TraversalResult and produces a StructureReport with heading tree,
 * landmark map, orphaned-content metrics, and an overall structure quality band.
 */

import type {
  DeterministicFlagCode,
  HeadingNode,
  LandmarkInfo,
  StructureBand,
  StructureIssue,
  StructureReport,
  TraversalResult,
} from './types.js'

/** IA-relevant flag codes surfaced in the structure report. */
const IA_FLAG_CODES: Set<DeterministicFlagCode> = new Set([
  // Heading structure
  'no-h1',
  'multiple-h1',
  'heading-level-skip',
  'missing-accessible-name',
  // Landmark / navigation
  'missing-landmark',
  'no-nav-landmark',
  'duplicate-landmark-no-label',
  'orphaned-content',
  'no-skip-link',
  'landmark-nesting-violation',
  'flat-structure',
  // Content structure
  'content-before-main',
  'wall-of-text',
  // Navigation quality
  'generic-link-text',
  'identical-links-different-href',
  'adjacent-duplicate-links',
  'empty-link-text',
  'empty-button-text',
  // Table / form structure
  'table-no-headers',
  'table-no-caption',
  'fieldset-no-legend',
  'form-no-submit',
  // Document-level
  'no-title',
  'no-lang-attribute',
  'viewport-no-zoom',
])

/** Severity weights for scoring. */
const SEVERITY_PENALTY: Record<string, number> = {
  critical: 15,
  serious: 10,
  moderate: 5,
  minor: 2,
}

/**
 * Generate an IA-oriented structure report from a traversal result.
 */
export function getStructureReport(result: TraversalResult): StructureReport {
  const headingTree = buildHeadingTree(result)
  const landmarks = buildLandmarkList(result)
  const elementsBeforeMain = computeElementsBeforeMain(result)
  const orphanedContentPercent = computeOrphanedPercent(result)
  const issues = buildIssueList(result)
  const score = computeScore(issues)
  const band = scoreToBand(score)

  return {
    band,
    score,
    headingTree,
    landmarks,
    elementsBeforeMain,
    orphanedContentPercent,
    issues,
  }
}

// ── Heading tree ──

function buildHeadingTree(result: TraversalResult): HeadingNode[] {
  const roots: HeadingNode[] = []
  const stack: HeadingNode[] = []

  for (const entry of result.entries) {
    if (entry.role !== 'heading' || !entry.level) continue

    const node: HeadingNode = {
      level: entry.level,
      name: entry.accessibleName,
      index: entry.index,
      children: [],
    }

    // Pop stack until we find a parent with a lower level
    while (stack.length > 0 && stack[stack.length - 1]!.level >= entry.level) {
      stack.pop()
    }

    if (stack.length === 0) {
      roots.push(node)
    } else {
      stack[stack.length - 1]!.children.push(node)
    }

    stack.push(node)
  }

  return roots
}

// ── Landmark list ──

function buildLandmarkList(result: TraversalResult): LandmarkInfo[] {
  return result.entries
    .filter((e) => e.isLandmark)
    .map((e) => ({
      role: e.role,
      label: e.accessibleName,
      selector: e.selector,
    }))
}

// ── Elements before main ──

function computeElementsBeforeMain(result: TraversalResult): number {
  const mainIndex = result.entries.findIndex((e) => e.role === 'main')
  if (mainIndex < 0) return result.entries.length
  return mainIndex
}

// ── Orphaned content percent ──

function computeOrphanedPercent(result: TraversalResult): number {
  if (result.entries.length === 0) return 0

  const landmarkTags = ['main', 'nav', 'aside', 'header', 'footer', 'search']
  const orphaned = result.entries.filter((e) => {
    const sel = e.selector.toLowerCase()
    return (
      !e.isLandmark &&
      !landmarkTags.some(
        (l) =>
          sel.includes(` ${l}`) ||
          sel.startsWith(l) ||
          sel.includes(`${l} `) ||
          sel.includes(`${l}>`) ||
          sel.includes(`${l}#`) ||
          sel.includes(`${l}:`) ||
          sel.includes(`${l}.`),
      )
    )
  })

  return Math.round((orphaned.length / result.entries.length) * 100)
}

// ── Issue list ──

function buildIssueList(result: TraversalResult): StructureIssue[] {
  const issues: StructureIssue[] = []

  // Collect from per-entry flags
  const flagCounts = new Map<DeterministicFlagCode, { severity: string; message: string; count: number }>()

  for (const entry of result.entries) {
    for (const f of entry.flags) {
      if (!IA_FLAG_CODES.has(f.code)) continue
      const existing = flagCounts.get(f.code)
      if (existing) {
        existing.count++
      } else {
        flagCounts.set(f.code, { severity: f.severity, message: f.message, count: 1 })
      }
    }
  }

  // Merge in summary-level flagCount (page-level + entry-pattern flags)
  for (const code of Object.keys(result.summary.flagCount) as DeterministicFlagCode[]) {
    if (!IA_FLAG_CODES.has(code)) continue
    if (flagCounts.has(code)) continue // already counted from entries
    const count = result.summary.flagCount[code] ?? 0
    if (count > 0) {
      flagCounts.set(code, {
        severity: getDefaultSeverity(code),
        message: getDefaultMessage(code),
        count,
      })
    }
  }

  for (const [code, data] of flagCounts) {
    issues.push({
      code,
      severity: data.severity as StructureIssue['severity'],
      message: data.message,
      count: data.count,
    })
  }

  // Sort by severity weight descending
  issues.sort((a, b) => (SEVERITY_PENALTY[b.severity] ?? 0) - (SEVERITY_PENALTY[a.severity] ?? 0))

  return issues
}

// ── Scoring ──

function computeScore(issues: StructureIssue[]): number {
  let penalty = 0
  for (const issue of issues) {
    penalty += (SEVERITY_PENALTY[issue.severity] ?? 0) * issue.count
  }
  return Math.max(0, Math.min(100, 100 - penalty))
}

function scoreToBand(score: number): StructureBand {
  if (score >= 90) return 'thorough'
  if (score >= 70) return 'solid'
  if (score >= 50) return 'basic'
  if (score >= 25) return 'minimal'
  return 'none'
}

// ── Default severity/message for page-level flags ──

function getDefaultSeverity(code: DeterministicFlagCode): string {
  const map: Partial<Record<DeterministicFlagCode, string>> = {
    'no-h1': 'serious',
    'multiple-h1': 'moderate',
    'no-nav-landmark': 'moderate',
    'missing-landmark': 'serious',
    'duplicate-landmark-no-label': 'serious',
    'no-skip-link': 'moderate',
    'landmark-nesting-violation': 'serious',
    'flat-structure': 'serious',
    'content-before-main': 'moderate',
    'orphaned-content': 'moderate',
    'wall-of-text': 'moderate',
    'identical-links-different-href': 'moderate',
    'adjacent-duplicate-links': 'moderate',
    'no-title': 'serious',
    'no-lang-attribute': 'serious',
    'viewport-no-zoom': 'serious',
  }
  return map[code] ?? 'moderate'
}

function getDefaultMessage(code: DeterministicFlagCode): string {
  const map: Partial<Record<DeterministicFlagCode, string>> = {
    'no-h1': 'Page has no h1.',
    'multiple-h1': 'Page has multiple h1 elements.',
    'no-nav-landmark': 'Page has no <nav> landmark.',
    'missing-landmark': 'Page has no <main> landmark.',
    'duplicate-landmark-no-label': 'Duplicate landmarks without distinct labels.',
    'no-skip-link': 'No skip navigation link found.',
    'landmark-nesting-violation': 'Non-nestable landmark is nested inside a same-role landmark.',
    'flat-structure': 'Page has no headings and no landmarks.',
    'content-before-main': 'Significant content appears before the <main> landmark.',
    'orphaned-content': 'Most content is outside any landmark region.',
    'wall-of-text': 'Long run of content without structural breaks.',
    'identical-links-different-href': 'Identically-named links point to different destinations.',
    'adjacent-duplicate-links': 'Adjacent links point to the same destination.',
    'no-title': 'Page has no <title>.',
    'no-lang-attribute': '<html> has no lang attribute.',
    'viewport-no-zoom': 'Viewport meta disables zoom.',
  }
  return map[code] ?? code
}
