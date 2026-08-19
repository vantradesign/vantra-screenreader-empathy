/**
 * Core entry point — headless, zero-dependency accessibility analysis.
 *
 * @packageDocumentation
 */

// Main function
export { analyzeAccessibilityFlow } from './traversal.js'

// Utilities (useful for advanced consumers)
export { computeAccessibleName } from './accessible-name.js'
export { computeReadingOrder } from './reading-order.js'
export { isLandmark, getLandmarkRole } from './landmarks.js'
export { resolveRole, getHeadingLevel, detectFlags, detectPageFlags, detectEntryPatternFlags } from './deterministic-flags.js'
export { getStructureReport } from './structure-report.js'

// Types
export type {
  ElementRole,
  DeterministicFlagCode,
  DeterministicFlag,
  TraversalEntry,
  TraversalWarning,
  TraversalSummary,
  TraversalResult,
  AnalyzeOptions,
  LandmarkInfo,
  HeadingNode,
  StructureBand,
  StructureReport,
  StructureIssue,
} from './types.js'

export type { FlagContext } from './deterministic-flags.js'
