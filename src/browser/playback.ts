/**
 * EmpathyPlayback — TTS playback controller.
 *
 * Reads the traversal sequence aloud, one entry at a time,
 * using LocalTTS from @vantra-design/local-inference.
 * Simulates screen reader announcement patterns.
 */

import type {
  PlaybackConfig,
  PlaybackState,
  TraversalResult,
} from '../core/types.js'
import type { LocalTTS } from '@vantra-design/local-inference'
import { formatEntryForSpeech } from '../core/speech.js'
import { highlightElement, clearHighlights } from './highlighter.js'

// Re-export so existing consumers of `import { formatEntryForSpeech } from './playback'`
// continue to work. The canonical source is now core/speech.ts.
export { formatEntryForSpeech } from '../core/speech.js'

/**
 * Controls TTS playback of the traversal sequence.
 */
export class EmpathyPlayback {
  private readonly result: TraversalResult
  private readonly config: PlaybackConfig
  private _state: PlaybackState = 'idle'
  private _currentIndex = 0
  private tts: LocalTTS | null = null
  private cleanupHighlight: (() => void) | null = null
  private aborted = false

  constructor(result: TraversalResult, config?: PlaybackConfig) {
    this.result = result
    this.config = config ?? {}
  }

  get state(): PlaybackState {
    return this._state
  }

  get currentIndex(): number {
    return this._currentIndex
  }

  /** Initialize TTS model. Must be called before play(). */
  async init(): Promise<void> {
    this._state = 'loading'

    const { LocalTTS: TTSClass } = await import('@vantra-design/local-inference')
    this.tts = new TTSClass({
      voice: this.config.voice ?? 'af_heart',
      rate: this.config.speed ?? 1.0,
      onProgress: this.config.onModelProgress
        ? (p) => {
            this.config.onModelProgress!({
              stage: p.phase === 'download' ? 'download' : 'init',
              progress: p.total > 0 ? p.loaded / p.total : 0,
              message: `${p.phase}: ${p.loaded}/${p.total}`,
            })
          }
        : undefined,
    })
    await this.tts!.init()
    this._state = 'idle'
  }

  /** Start or resume playback from the current position. */
  async play(): Promise<void> {
    if (!this.tts) throw new Error('Call init() before play()')

    if (this._state === 'paused') {
      this.tts.resume()
      this._state = 'playing'
      return
    }

    this._state = 'playing'
    this.aborted = false

    for (let i = this._currentIndex; i < this.result.entries.length; i++) {
      if (this.aborted || this._state !== 'playing') break

      const entry = this.result.entries[i]!
      this._currentIndex = i

      // Highlight
      this.cleanupHighlight?.()
      this.cleanupHighlight = highlightElement(entry.selector)

      // Callbacks
      this.config.onEntryStart?.(entry)

      // Speak
      const text = formatEntryForSpeech(entry)
      if (text) {
        await this.tts.speak(text)
      } else if (entry.role === 'image' && entry.accessibleName === '') {
        // Decorative image — brief silence
      } else if (entry.role === 'image') {
        // Missing alt — pause to make the gap felt
        await sleep(2000)
      }

      // Callback
      this.config.onEntryEnd?.(entry)
    }

    if (!this.aborted) {
      this._state = 'idle'
      this._currentIndex = 0
      this.cleanupHighlight?.()
      this.cleanupHighlight = null
      this.config.onComplete?.()
    }
  }

  /** Pause playback. */
  pause(): void {
    if (this._state !== 'playing') return
    this.tts?.pause()
    this._state = 'paused'
  }

  /** Jump to a specific entry index. */
  seekTo(index: number): void {
    if (index < 0 || index >= this.result.entries.length) return
    this._currentIndex = index
  }

  /** Stop playback and reset to the beginning. */
  stop(): void {
    this.aborted = true
    this.tts?.stop()
    this._state = 'idle'
    this._currentIndex = 0
    this.cleanupHighlight?.()
    this.cleanupHighlight = null
    clearHighlights()
  }

  /** Release all resources. */
  async destroy(): Promise<void> {
    this.stop()
    await this.tts?.destroy()
    this.tts = null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
