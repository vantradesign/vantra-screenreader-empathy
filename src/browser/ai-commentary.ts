/**
 * EmpathyCommentary — AI-generated plain-language commentary.
 *
 * Uses a local LLM (via @vantra-design/local-inference) to generate
 * explanations of what a screen reader user experiences for each
 * flagged traversal entry.
 *
 * This is strictly optional and clearly labeled as AI-generated.
 * The deterministic analysis works without it.
 */

import type {
  AiComment,
  CommentaryConfig,
  DeterministicFlagCode,
  TraversalEntry,
  TraversalResult,
} from '../core/types.js'
import type { LocalLLMEngine } from '@vantra-design/local-inference'

const SYSTEM_PROMPT = `You are an accessibility expert reviewing a page's reading order as experienced by a screen reader. For each issue in the traversal, explain in one plain-language sentence what a screen reader user would experience and why it's confusing. Do NOT suggest code fixes — only explain the experience. Mark every response as AI-generated.`

/**
 * Generates AI-powered plain-language commentary for flagged entries.
 */
export class EmpathyCommentary {
  private readonly result: TraversalResult
  private readonly config: CommentaryConfig
  private engine: LocalLLMEngine | null = null

  constructor(result: TraversalResult, config?: CommentaryConfig) {
    this.result = result
    this.config = config ?? {}
  }

  /** Initialize LLM. Must be called before generate(). */
  async init(): Promise<void> {
    const { LocalLLMEngine: LLMClass } = await import('@vantra-design/local-inference')
    this.engine = new LLMClass({
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
    await this.engine!.init()
  }

  /** Generate AI commentary for all flagged entries. */
  async *generate(): AsyncGenerator<AiComment> {
    if (!this.engine) throw new Error('Call init() before generate()')

    const flaggedEntries = this.result.entries.filter(
      (entry) => entry.flags.length > 0,
    )

    for (const entry of flaggedEntries) {
      for (const flag of entry.flags) {
        const userPrompt = buildFlagPrompt(entry, flag.code)

        let response = ''
        for await (const token of this.engine.generate(userPrompt, SYSTEM_PROMPT)) {
          response += token
        }

        yield {
          entryIndex: entry.index,
          flagCode: flag.code,
          explanation: response.trim(),
        }
      }
    }
  }

  /** Release all resources. */
  async destroy(): Promise<void> {
    await this.engine?.destroy()
    this.engine = null
  }
}

function buildFlagPrompt(
  entry: TraversalEntry,
  flagCode: DeterministicFlagCode,
): string {
  const parts: string[] = [
    `Element at position ${entry.index} in the reading order:`,
    `- Role: ${entry.role}`,
    `- Accessible name: ${entry.accessibleName ? `"${entry.accessibleName}"` : '(none)'}`,
    `- HTML: ${entry.htmlSnippet}`,
    `- Issue: ${flagCode}`,
    '',
    'Explain in one sentence what a screen reader user would experience and why this is a problem.',
  ]

  if (entry.level) {
    parts.splice(2, 0, `- Heading level: ${entry.level}`)
  }

  return parts.join('\n')
}
