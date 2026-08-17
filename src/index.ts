/**
 * Root entry point — re-exports core + browser.
 *
 * @packageDocumentation
 */

// Core (headless, zero dependencies)
export * from './core/index.js'

// Browser (TTS, highlighting, AI commentary)
export * from './browser/index.js'

// Browser-only types
export type {
  PlaybackConfig,
  PlaybackState,
  ModelProgress,
  CommentaryConfig,
  AiComment,
  HighlightOptions,
} from './core/types.js'
