// ── Element roles ──

export type ElementRole =
  | 'heading' | 'button' | 'link' | 'image' | 'textbox' | 'checkbox'
  | 'radio' | 'listitem' | 'list' | 'table' | 'row' | 'cell'
  | 'navigation' | 'main' | 'banner' | 'contentinfo' | 'complementary'
  | 'form' | 'search' | 'region' | 'separator' | 'text' | 'group'
  | 'generic' | string

// ── Deterministic flags ──

export type DeterministicFlagCode =
  | 'missing-accessible-name'
  | 'empty-link-text'
  | 'empty-button-text'
  | 'missing-form-label'
  | 'heading-level-skip'
  | 'missing-landmark'
  | 'duplicate-id'
  | 'redundant-role'
  | 'missing-alt-text'
  | 'generic-link-text'
  | 'no-lang-attribute'
  | 'tabindex-positive'

export interface DeterministicFlag {
  code: DeterministicFlagCode
  severity: 'critical' | 'serious' | 'moderate' | 'minor'
  message: string
}

// ── Traversal ──

export interface TraversalEntry {
  /** 0-based index in reading order */
  index: number
  /** Computed accessible name (may be empty) */
  accessibleName: string
  /** Resolved ARIA role (explicit or implicit) */
  role: ElementRole
  /** Heading level (1-6) if role is 'heading' */
  level?: number
  /** CSS selector path to the element */
  selector: string
  /** Trimmed outer HTML snippet */
  htmlSnippet: string
  /** Is this element a landmark? */
  isLandmark: boolean
  /** Deterministic flags (issues detected by rules, no AI) */
  flags: DeterministicFlag[]
}

export interface TraversalWarning {
  code: 'truncated' | 'jsdom-limitation' | 'css-not-computed'
  message: string
}

export interface TraversalSummary {
  totalElements: number
  landmarkCount: number
  headingStructure: { level: number; name: string }[]
  flagCount: Partial<Record<DeterministicFlagCode, number>>
}

export interface TraversalResult {
  /** Ordered reading sequence */
  entries: TraversalEntry[]
  /** Page-level summary */
  summary: TraversalSummary
  /** Warnings about the analysis itself */
  warnings: TraversalWarning[]
}

export interface AnalyzeOptions {
  /** Maximum entries before truncation. Default: 5000 */
  maxEntries?: number
  /** Include elements hidden via CSS/aria-hidden? Default: false */
  includeHidden?: boolean
}

// ── Browser-only types ──

export interface ModelProgress {
  stage: 'download' | 'init' | 'ready'
  progress: number
  message?: string
}

export interface PlaybackConfig {
  /** TTS voice preset. Default: 'af_heart' */
  voice?: string
  /** Playback speed multiplier. Default: 1.0 */
  speed?: number
  /** Called when an entry starts being read */
  onEntryStart?: (entry: TraversalEntry) => void
  /** Called when an entry finishes */
  onEntryEnd?: (entry: TraversalEntry) => void
  /** Called on playback completion */
  onComplete?: () => void
  /** Called during TTS model download */
  onModelProgress?: (progress: ModelProgress) => void
}

export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused'

export interface CommentaryConfig {
  /** Called during model download */
  onModelProgress?: (progress: ModelProgress) => void
}

export interface AiComment {
  /** Index of the traversal entry this comment refers to */
  entryIndex: number
  /** The flag this comment explains */
  flagCode: DeterministicFlagCode
  /** Plain-language explanation of what a screen reader user experiences */
  explanation: string
}

export interface HighlightOptions {
  color?: string
  outline?: boolean
}
