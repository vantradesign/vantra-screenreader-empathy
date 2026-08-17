# @vantra-design/screenreader-empathy — Package Specification

**Date:** 2026-08-17
**Author:** Kai Kauper, Design Systems Lead
**Status:** Pre-implementation specification

---

## 1. Product Manager Perspective

### Problem

Sighted developers and designers rarely experience their work the way a screen reader user does. The gap isn't malicious — it's experiential. You can't fix what you can't feel. Existing tools fall into two camps:

- **Compliance scanners** (axe, Lighthouse, WAVE): produce rule violations as a checklist. Useful, but they don't convey *what it feels like* to navigate a page blind. A missing `alt` is a line item, not a 3-second silence where an image should have been described.
- **Actual screen readers** (VoiceOver, NVDA, JAWS): authoritative but have steep learning curves. A designer trying VoiceOver for the first time spends 20 minutes learning keyboard shortcuts before hearing a single word of their page. Most give up.

There is no tool that says: "Here is what your page sounds like to a screen reader, and here is what's confusing about it, in plain language." That's the gap.

### Target user

- **Primary:** Front-end developers and designers building components or pages who want to *hear* their accessibility issues, not just read a report.
- **Secondary:** Design system maintainers validating that component patterns (modals, tabs, accordions) announce correctly in reading order.
- **Tertiary:** Accessibility trainers and educators running workshops where participants need to experience screen reader output without installing screen reader software.

### What "done" means for v1

A genuinely installable npm package that:

1. Takes HTML (pasted snippet or live same-origin DOM element) and produces the **reading order** a screen reader would follow — deterministically, without AI.
2. Plays that reading order aloud, node by node, via local TTS (Kokoro/Piper), with the currently-read element highlighted in the UI.
3. Uses a small local LLM (same as Package 1) to generate **plain-language commentary** on accessibility issues found in the traversal — clearly labeled as AI-generated and kept separate from the deterministic traversal data.
4. Ships a headless core function (`analyzeAccessibilityFlow`) usable in CI/Node (with jsdom) that returns the traversal sequence and deterministic flags — no audio, no AI, no heavy browser deps.
5. Can be installed, pointed at an HTML snippet, and producing audible output within 2 minutes.

### What v1 explicitly excludes

- Cross-origin page analysis (browser security prevents it; same-origin or pasted HTML only).
- WCAG compliance certification (this is an empathy tool, not an auditor).
- Screen reader fidelity claims (real screen readers have vendor-specific behaviors we don't replicate).
- Fix suggestions with code diffs (that's what vantra-a11y-fixer does).

### Positioning statement (for README and marketing)

> This tool helps you *hear* your page. It is not a WCAG compliance scanner — use axe for that. It is not a replacement for testing with real screen readers — use VoiceOver and NVDA for that. It is the step between "I've never thought about screen readers" and "I understand why this matters enough to test properly."

---

## 2. Staff UX Designer Perspective

### Interaction model: install → value in under 2 minutes

```text
1. npm install @vantra-design/screenreader-empathy
2. Import the browser playback component (or use the demo page)
3. Paste HTML or point at a live element
4. Hit "Play" → hear your page read aloud, element by element
5. See highlighted elements and plain-language flags as it reads
```

### States

#### Empty state (nothing loaded)

- A text area labeled "Paste HTML here" with a sample snippet pre-filled (a form with a missing label — a common, relatable issue)
- Alternatively: a button "Analyze this page" (for same-origin live analysis)
- Brief explainer: "Hear what your page sounds like to a screen reader."
- No model download needed for the deterministic analysis — only for AI commentary and TTS

#### Analyzing state (traversal in progress)

- Brief spinner/progress indicator: "Building accessibility tree…"
- Completes in <500ms for typical pages — this state may flash by
- No audio yet; this is the parsing phase

#### Ready state (traversal complete, not yet playing)

- Left panel: the rendered HTML with elements outlined faintly
- Right panel: the reading order as a numbered transcript
  - Each entry shows: role, accessible name, and any deterministic flags
  - Entries with issues are marked (icon + colour, not colour alone)
- Play/Pause button prominently centered
- Speed control (0.5×, 1×, 1.5×, 2×)
- Toggle: "AI commentary" (off by default — enables LLM-generated notes)

#### Playing state (TTS reading aloud)

- Current element highlighted in the HTML panel (bold outline, background tint)
- Current transcript entry scrolled into view and highlighted
- Audio plays the accessible name and role for each element:
  - "Heading level 1: Welcome to Acme Design System"
  - "Button: Submit"
  - "Image: [no alt text]" ← spoken pause to make the gap felt
  - "Link: Read more" (screen reader would say the same, lacking context)
- Pause button replaces Play
- Scrub/skip: click any transcript entry to jump there
- Progress bar showing position in the reading order

#### AI commentary state (toggled on)

- After the deterministic traversal is complete, a secondary pass generates plain-language notes
- These appear as annotated cards below the relevant transcript entries:
  - 🤖 "This button has no accessible name — a screen reader will just say 'button'. Add a label or aria-label."
  - 🤖 "These three links all say 'Read more'. A screen reader user navigating by links hears 'Read more, Read more, Read more' with no way to distinguish them."
- Every AI-generated note is visually distinct (robot icon, lighter background, "AI suggestion" label)
- If the LLM model isn't downloaded yet, toggling this on triggers the download flow (same as Package 1)

#### Error states

- **Invalid HTML:** "Couldn't parse the provided HTML. Check for unclosed tags or encoding issues."
- **WebGPU unavailable (AI commentary requested):** "AI commentary requires WebGPU (Chrome 113+). The reading order and playback work without it."
- **TTS model download failed:** "TTS download interrupted. [Retry] You can still read the transcript."
- **Same-origin violation:** "Can't analyze cross-origin pages due to browser security. Paste the HTML instead."

### Accessibility (of the tool itself)

- The transcript is fully navigable by keyboard and screen reader (ironic if the empathy tool itself isn't accessible)
- Playback controls have ARIA labels
- Highlighted elements use outline + background (not colour alone)
- All AI-generated content is marked with `aria-description="AI-generated suggestion"`
- Pause/resume works with Space key
- Reduced-motion: playback highlighting appears without animation

---

## 3. Staff Software Engineer Perspective

### Package split decision

Two entry points in one package, not two packages. Reasoning:

| Option | Pros | Cons |
| --- | --- | --- |
| Two packages (`@vantra-design/screenreader-empathy` + `@vantra-design/screenreader-empathy-playback`) | Clean separation, no dead code in CI | Two npm packages to version, two changelogs, confusing for users ("which one do I install?") |
| One package, two entry points ✓ | One install, one version, one changelog. CI users import `/core`, browser users import the root. | Slightly more complex exports map |

The core entry point has zero browser dependencies. The root entry point adds TTS, LLM, and DOM highlighting. Tree-shaking ensures CI consumers don't pull in audio code.

### Package architecture

```text
vantra-screenreader-empathy/
├── src/
│   ├── core/                           # Headless, framework-agnostic
│   │   ├── traversal.ts                # Accessibility tree walker
│   │   ├── accessible-name.ts          # Accessible Name computation (AccName spec)
│   │   ├── reading-order.ts            # Tab order + DOM order → reading sequence
│   │   ├── landmarks.ts                # Landmark role detection
│   │   ├── deterministic-flags.ts      # Rule-based issue detection (no AI)
│   │   ├── types.ts                    # All public types
│   │   └── index.ts                    # Core barrel
│   │
│   ├── browser/                        # Browser-only features
│   │   ├── playback.ts                 # TTS playback controller
│   │   ├── highlighter.ts             # DOM element highlighting
│   │   ├── ai-commentary.ts            # WebLLM commentary generation
│   │   └── index.ts                    # Browser barrel
│   │
│   └── index.ts                        # Root barrel (re-exports core + browser)
│
├── vue/                                # @vantra-design/screenreader-empathy-vue
│   ├── src/
│   │   ├── ScreenreaderEmpathy.vue     # Main component
│   │   ├── components/
│   │   │   ├── HtmlInput.vue
│   │   │   ├── Transcript.vue
│   │   │   ├── TranscriptEntry.vue
│   │   │   ├── PlaybackControls.vue
│   │   │   ├── AiCommentary.vue
│   │   │   └── HtmlPreview.vue
│   │   ├── composables/
│   │   │   ├── useTraversal.ts
│   │   │   ├── usePlayback.ts
│   │   │   └── useCommentary.ts
│   │   └── index.ts
│   └── package.json
│
├── demo/                               # Standalone demo for vantra.design
│   ├── src/
│   │   ├── App.vue
│   │   ├── sample-html.ts
│   │   └── main.ts
│   ├── index.html
│   └── vite.config.ts
│
├── .github/workflows/
│   ├── ci.yml
│   └── publish.yml
├── .changeset/config.json
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── eslint.config.js
├── CONTRIBUTING.md
├── LICENSE                             # Apache-2.0
└── README.md
```

### Exports map

```json
{
  "name": "@vantra-design/screenreader-empathy",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./core": {
      "types": "./dist/core/index.d.ts",
      "import": "./dist/core/index.js",
      "require": "./dist/core/index.cjs"
    },
    "./package.json": "./package.json"
  },
  "sideEffects": false
}
```

### Dependencies

**Core entry point (./core) — zero runtime dependencies:**

| Dependency | Purpose | Note |
| --- | --- | --- |
| (none) | — | Headless traversal uses only DOM APIs (or jsdom in Node) |

**Root entry point (./) — browser dependencies:**

| Dependency | Purpose | Size impact |
| --- | --- | --- |
| `kokoro-js` | Local TTS playback | ~200KB JS, ~82MB model at runtime |
| `@mlc-ai/web-llm` | AI commentary (optional) | ~150KB JS, ~500MB model at runtime |
| `@vantra-design/local-inference` | Shared model loading/caching | ~10KB JS |

**Vue package:**

| Dependency | Purpose |
| --- | --- |
| `@vantra-design/screenreader-empathy` | Peer dependency |
| `vue` | Peer dependency (^3.4) |

### Build & publish

- **Build:** tsup, two entry points (core, root), ESM + CJS + .d.ts
- **Monorepo:** Single package with two entry points + optional Vue wrapper as a workspace package
- **Versioning:** changesets
- **CI:** GitHub Actions — lint, typecheck, test (vitest + jsdom), build, publish on tag

---

## 4. Staff AI Specialist Perspective

### Architecture: deterministic core + AI commentary layer

The critical design decision: **the accessibility tree traversal is entirely deterministic.** The AI layer is commentary only — it adds explanations, never modifies the traversal sequence or flag data.

```text
┌─────────────────────────────────────────────────────────┐
│  INPUT: HTML string or DOM Element                       │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│  DETERMINISTIC LAYER (no AI)                             │
│                                                          │
│  1. Parse HTML → DOM (or use live DOM)                   │
│  2. Build accessibility tree                             │
│     - Compute accessible names (AccName spec)            │
│     - Determine roles (explicit + implicit)              │
│     - Resolve tab order (tabindex + DOM order)           │
│     - Identify landmarks                                 │
│  3. Walk tree → reading order sequence                   │
│  4. Apply deterministic flags:                           │
│     - Missing accessible name                            │
│     - Empty link/button text                             │
│     - Missing form labels                                │
│     - Heading level skips                                │
│     - Missing landmark regions                           │
│     - Duplicate IDs                                      │
│     - Redundant roles (role="button" on <button>)        │
│                                                          │
│  OUTPUT: TraversalResult (sequence + flags)              │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼ (optional, browser-only)
┌─────────────────────────────────────────────────────────┐
│  AI COMMENTARY LAYER (WebLLM)                            │
│                                                          │
│  Input: the traversal result (not the raw HTML)          │
│  The LLM sees the accessibility tree, not the DOM,       │
│  so it reasons about what a screen reader user would     │
│  experience, not what a sighted user sees.               │
│                                                          │
│  System prompt:                                          │
│  "You are an accessibility expert reviewing a page's     │
│   reading order as experienced by a screen reader.       │
│   For each issue in the traversal, explain in one        │
│   plain-language sentence what a screen reader user      │
│   would experience and why it's confusing.               │
│   Do NOT suggest code fixes — only explain the           │
│   experience. Mark every response as AI-generated."      │
│                                                          │
│  OUTPUT: AiCommentary[] (mapped to traversal entries)    │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼ (optional, browser-only)
┌─────────────────────────────────────────────────────────┐
│  PLAYBACK LAYER (Kokoro TTS + DOM highlighting)          │
│                                                          │
│  Reads the traversal sequence aloud, one entry at a      │
│  time, highlighting the corresponding DOM element.       │
│  AI commentary is read as an aside between entries       │
│  ("Note: ...") — distinct voice or pitch shift.          │
└─────────────────────────────────────────────────────────┘
```

### Accessible Name computation

The core implements the [Accessible Name and Description Computation](https://www.w3.org/TR/accname-1.2/) algorithm (AccName 1.2). This is the most complex part of the deterministic layer and must be correct — if the names are wrong, the empathy simulation is misleading.

Key rules implemented:
1. `aria-labelledby` → concatenate referenced elements' text content
2. `aria-label` → use directly
3. Native text alternatives (`alt`, `title`, `<label for>`, `<caption>`, `<legend>`, `<figcaption>`)
4. Text content (for elements that allow name from content)
5. `title` attribute (last resort)
6. Placeholder (for inputs, last resort)

Edge cases to test:
- Hidden elements referenced by `aria-labelledby` (their text *is* used)
- Recursive `aria-labelledby` (must not loop)
- CSS `content` on `::before`/`::after` (included in text content)
- `<img>` inside `<button>` (alt text contributes to button name)

### Model selection

Same models as Package 1 — the shared `@vantra-design/local-inference` package handles loading and caching:

| Role | Model | Size | Notes |
| --- | --- | --- | --- |
| AI commentary | Llama-3.2-1B-Instruct q4f32_1 | ~500MB | Same model, same cache — if the user has Package 1 installed, the model is already downloaded |
| TTS | Kokoro v1.0 via kokoro-js | ~82MB | Same cache key as Package 1 |

### TTS strategy

Screen reader narration is not the same as reading text aloud. The TTS layer simulates screen reader output patterns:

| Element | What is spoken | Why |
| --- | --- | --- |
| `<h2>Products</h2>` | "Heading level 2, Products" | Screen readers announce the role and level |
| `<button>Submit</button>` | "Submit, button" | Role announced after name |
| `<a href="#">Read more</a>` | "Read more, link" | Role announced |
| `<img alt="">` | *(silence, 1s pause)* | Empty alt = decorative, skipped |
| `<img>` (no alt) | "Image" *(then 2s pause)* | The pause makes the missing alt *felt* |
| `<div role="navigation" aria-label="Main">` | "Main, navigation landmark" | Landmark announced on entry |
| `<input type="text">` (no label) | "Edit text" *(no name)* | The missing label is felt as absence |

The pauses and role announcements are modeled after VoiceOver's behavior (the most commonly encountered screen reader on macOS, where most design system maintainers work). This is a simulation, not a replica — the README makes this explicit.

### Fallback behavior

| Scenario | Behavior |
| --- | --- |
| No WebGPU | AI commentary disabled (toggle hidden), deterministic analysis + TTS still work |
| No WebGPU and no audio context | Full transcript available, no playback — still useful as a reading-order visualizer |
| Node/CI (jsdom) | `analyzeAccessibilityFlow()` works fully; no audio, no AI |
| TTS model fails to load | Transcript visible, playback disabled, "Read the transcript above" message |
| Very large HTML (>10K elements) | Warn user, truncate traversal at 5K entries with a note |

### Privacy guarantees

Identical to Package 1:
- No network calls after initial model download
- HTML input is processed in-memory, never transmitted
- No analytics, telemetry, or error reporting
- CSP-enforceable: `connect-src 'self' https://huggingface.co` (for model download only)

---

## 5. Public API Surface

### Core: `@vantra-design/screenreader-empathy/core`

```ts
// --- Types ---

type ElementRole =
  | 'heading' | 'button' | 'link' | 'image' | 'textbox' | 'checkbox'
  | 'radio' | 'listitem' | 'list' | 'table' | 'row' | 'cell'
  | 'navigation' | 'main' | 'banner' | 'contentinfo' | 'complementary'
  | 'form' | 'search' | 'region' | 'separator' | 'text' | 'group'
  | 'generic' | string

interface TraversalEntry {
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

interface DeterministicFlag {
  code: DeterministicFlagCode
  severity: 'critical' | 'serious' | 'moderate' | 'minor'
  message: string
}

type DeterministicFlagCode =
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

interface TraversalResult {
  /** Ordered reading sequence */
  entries: TraversalEntry[]
  /** Page-level summary */
  summary: {
    totalElements: number
    landmarkCount: number
    headingStructure: { level: number; name: string }[]
    flagCount: Record<DeterministicFlagCode, number>
  }
  /** Warnings about the analysis itself */
  warnings: TraversalWarning[]
}

interface TraversalWarning {
  code: 'truncated' | 'jsdom-limitation' | 'css-not-computed'
  message: string
}

interface AnalyzeOptions {
  /** Maximum entries before truncation. Default: 5000 */
  maxEntries?: number
  /** Include elements hidden via CSS/aria-hidden? Default: false */
  includeHidden?: boolean
}

// --- Main function ---

/**
 * Analyze the accessibility flow of an HTML document or element.
 * Returns the reading order sequence with deterministic flags.
 *
 * Works in browsers (live DOM) and Node (with jsdom).
 * No AI, no audio — pure deterministic analysis.
 */
declare function analyzeAccessibilityFlow(
  input: string | HTMLElement | Document,
  options?: AnalyzeOptions
): TraversalResult
```

### Browser: `@vantra-design/screenreader-empathy`

```ts
// Re-exports everything from ./core, plus:

interface PlaybackConfig {
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

declare class EmpathyPlayback {
  constructor(
    result: TraversalResult,
    config?: PlaybackConfig
  )

  /** Initialize TTS model. Must be called before play(). */
  init(): Promise<void>

  /** Start or resume playback from the current position. */
  play(): Promise<void>

  /** Pause playback. */
  pause(): void

  /** Jump to a specific entry index. */
  seekTo(index: number): void

  /** Stop playback and reset to the beginning. */
  stop(): void

  /** Current playback state. */
  readonly state: 'idle' | 'loading' | 'playing' | 'paused'

  /** Index of the currently-playing entry. */
  readonly currentIndex: number

  /** Release all resources. */
  destroy(): Promise<void>
}

interface CommentaryConfig {
  /** Called during model download */
  onModelProgress?: (progress: ModelProgress) => void
}

interface AiComment {
  /** Index of the traversal entry this comment refers to */
  entryIndex: number
  /** The flag this comment explains */
  flagCode: DeterministicFlagCode
  /** Plain-language explanation of what a screen reader user experiences */
  explanation: string
}

declare class EmpathyCommentary {
  constructor(
    result: TraversalResult,
    config?: CommentaryConfig
  )

  /** Initialize LLM. Must be called before generate(). */
  init(): Promise<void>

  /** Generate AI commentary for all flagged entries. */
  generate(): AsyncGenerator<AiComment>

  /** Release all resources. */
  destroy(): Promise<void>
}

/**
 * Highlight an element in the DOM.
 * Returns a cleanup function that removes the highlight.
 */
declare function highlightElement(
  selector: string,
  options?: { color?: string; outline?: boolean }
): () => void
```

### Vue: `@vantra-design/screenreader-empathy-vue`

```vue
<script setup lang="ts">
interface Props {
  /** HTML string to analyze. Mutually exclusive with `element`. */
  html?: string
  /** Live DOM element to analyze. Mutually exclusive with `html`. */
  element?: HTMLElement
  /** Enable AI commentary toggle. Default: false */
  aiCommentary?: boolean
  /** Enable TTS playback. Default: true */
  playback?: boolean
  /** UI language. Default: 'en' */
  locale?: 'en' | 'de'
  /** CSS class for the root container */
  class?: string
}

const emit = defineEmits<{
  analyzed: [result: TraversalResult]
  entryFocus: [entry: TraversalEntry]
  error: [error: Error]
}>()
</script>

<!-- Usage -->
<template>
  <ScreenreaderEmpathy
    :html="myHtmlSnippet"
    ai-commentary
    locale="en"
    @analyzed="onAnalyzed"
  />
</template>
```

---

## 6. README (as published)

---

# @vantra-design/screenreader-empathy

[![npm](https://img.shields.io/npm/v/@vantra-design/screenreader-empathy)](https://www.npmjs.com/package/@vantra-design/screenreader-empathy)
[![CI](https://github.com/vantradesign/vantra-screenreader-empathy/actions/workflows/ci.yml/badge.svg)](https://github.com/vantradesign/vantra-screenreader-empathy/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)

Hear what your page sounds like to a screen reader. Paste HTML or point at a live element — get the reading order played back aloud with the current element highlighted, and optional AI-generated plain-language explanations of what's confusing.

**Everything runs locally in your browser. Nothing leaves your device.**

> **This is an empathy and education tool, not a WCAG compliance auditor.** It helps sighted developers and designers experience their work the way a screen reader user would. For compliance scanning, use [axe-core](https://github.com/dequelabs/axe-core). For definitive testing, use a real screen reader. This tool is the bridge between "I've never thought about screen readers" and "I understand why this matters enough to test properly."

---

## Quick start

```bash
npm install @vantra-design/screenreader-empathy
```

### Browser — full experience (TTS + highlighting)

```ts
import { analyzeAccessibilityFlow, EmpathyPlayback } from '@vantra-design/screenreader-empathy'

const html = `
  <main>
    <h1>Welcome</h1>
    <button>Submit</button>
    <img src="hero.jpg">
    <a href="#">Read more</a>
  </main>
`

const result = analyzeAccessibilityFlow(html)

// result.entries:
// 0: { role: 'main', accessibleName: '', isLandmark: true, flags: [] }
// 1: { role: 'heading', level: 1, accessibleName: 'Welcome', flags: [] }
// 2: { role: 'button', accessibleName: 'Submit', flags: [] }
// 3: { role: 'image', accessibleName: '', flags: [{ code: 'missing-alt-text', ... }] }
// 4: { role: 'link', accessibleName: 'Read more', flags: [{ code: 'generic-link-text', ... }] }

const playback = new EmpathyPlayback(result, {
  onEntryStart: (entry) => console.log(`Reading: ${entry.role} — ${entry.accessibleName}`),
})

await playback.init()  // downloads TTS model (~82 MB, cached after first use)
await playback.play()  // "Main landmark. Heading level 1, Welcome. Submit, button. Image. [pause] Read more, link."
```

### Node / CI — headless analysis only

```ts
import { analyzeAccessibilityFlow } from '@vantra-design/screenreader-empathy/core'
import { JSDOM } from 'jsdom'

const dom = new JSDOM(html)
const result = analyzeAccessibilityFlow(dom.window.document)

// No audio, no AI — just the traversal sequence and deterministic flags
console.log(`Found ${result.summary.flagCount['missing-alt-text']} images without alt text`)
```

The `./core` entry point has **zero runtime dependencies** and works anywhere JavaScript runs.

---

## What it detects (deterministic, no AI)

These flags are rule-based, reproducible, and will never hallucinate:

| Flag | What it means |
| --- | --- |
| `missing-accessible-name` | Element has a role but no name — a screen reader will announce the role with nothing to identify it |
| `empty-link-text` | Link with no text content — screen reader says "link" with no destination |
| `empty-button-text` | Button with no text — screen reader says "button" with no action |
| `missing-form-label` | Input has no associated `<label>`, `aria-label`, or `aria-labelledby` |
| `heading-level-skip` | Heading jumps from h1 to h3 (skipping h2) — disrupts heading navigation |
| `missing-landmark` | Page has no `<main>` landmark (or equivalent role) |
| `duplicate-id` | Two elements share an ID — breaks `aria-labelledby` and `<label for>` |
| `redundant-role` | `role="button"` on a `<button>` — harmless but noisy |
| `missing-alt-text` | `<img>` with no `alt` attribute (not empty alt — that means decorative) |
| `generic-link-text` | Link text is "click here", "read more", etc. — meaningless out of context |
| `no-lang-attribute` | `<html>` has no `lang` — screen reader can't select the right speech voice |
| `tabindex-positive` | `tabindex` > 0 — overrides natural tab order, almost always a mistake |

---

## AI commentary (optional)

Toggle AI commentary to get plain-language explanations of *what a screen reader user experiences* for each flagged issue. This uses a small language model (Llama 3.2 1B, ~500 MB, runs locally via WebGPU).

```ts
import { analyzeAccessibilityFlow, EmpathyCommentary } from '@vantra-design/screenreader-empathy'

const result = analyzeAccessibilityFlow(html)
const commentary = new EmpathyCommentary(result)

await commentary.init()  // downloads LLM if not cached

for await (const comment of commentary.generate()) {
  console.log(`Entry ${comment.entryIndex}: ${comment.explanation}`)
  // "Entry 3: This image has no alt text. A screen reader user will hear
  //  'image' with no description — they'll know an image exists but not
  //  what it shows. If the image is decorative, add alt="". If it conveys
  //  information, describe what it shows."
}
```

AI commentary is:
- **Clearly labeled** as AI-generated (never blended with deterministic flags)
- **Explanatory only** — it describes the experience, not code fixes
- **Optional** — the core analysis works without it
- **Local** — same privacy guarantee as everything else

---

## How TTS playback works

The playback simulates how a screen reader announces elements, not how a human reads text:

| Element | Spoken as |
| --- | --- |
| `<h2>Products</h2>` | "Heading level 2, Products" |
| `<button>Submit</button>` | "Submit, button" |
| `<a href="#">Read more</a>` | "Read more, link" |
| `<img alt="">` | *(skipped — decorative)* |
| `<img>` (no alt) | "Image" *(2-second pause)* |
| `<nav aria-label="Main">` | "Main, navigation landmark" |
| `<input type="text">` (no label) | "Edit text" *(no name — the gap is felt)* |

Pauses and announcement patterns are modeled after VoiceOver. This is a *simulation*, not a replica — real screen readers have vendor-specific behaviors that this tool does not attempt to match perfectly.

---

## Bundle size

| Entry point | JS (gzipped) | Runtime downloads |
| --- | --- | --- |
| `./core` (headless) | ~12 KB | None |
| `.` (full, browser) | ~180 KB | ~82 MB TTS + ~500 MB LLM (both optional, cached) |
| Vue component | ~30 KB | Same as full (peer dep) |

---

## Browser requirements

| Feature | Required for | Minimum | Fallback |
| --- | --- | --- | --- |
| DOM APIs | Core analysis | Any modern browser / jsdom | — |
| Audio Context | TTS playback | Chrome, Edge, Firefox, Safari | Transcript only (no audio) |
| WebGPU | AI commentary | Chrome 113+, Edge 113+ | Commentary disabled, analysis + TTS work |

---

## API reference

### `analyzeAccessibilityFlow(input, options?)`

Analyzes HTML and returns the reading order with deterministic flags.

- `input`: HTML string, `HTMLElement`, or `Document`
- `options.maxEntries`: Max traversal entries (default: 5000)
- `options.includeHidden`: Include `aria-hidden` elements (default: false)
- Returns: `TraversalResult`

### `EmpathyPlayback`

Controls TTS playback of the traversal sequence.

| Method | Description |
| --- | --- |
| `init()` | Load TTS model (downloads ~82 MB on first use) |
| `play()` | Start or resume playback |
| `pause()` | Pause |
| `seekTo(index)` | Jump to a specific entry |
| `stop()` | Stop and reset |
| `destroy()` | Release resources |

### `EmpathyCommentary`

Generates AI-powered plain-language commentary.

| Method | Description |
| --- | --- |
| `init()` | Load LLM (downloads ~500 MB on first use) |
| `generate()` | AsyncGenerator yielding `AiComment` per flagged entry |
| `destroy()` | Release resources |

### `highlightElement(selector, options?)`

Highlights a DOM element. Returns a cleanup function.

---

## Development

```bash
git clone https://github.com/vantradesign/vantra-screenreader-empathy.git
cd vantra-screenreader-empathy
pnpm install
pnpm run dev          # watch mode
pnpm run verify       # lint + typecheck + test + build
pnpm run demo         # run demo app at localhost:5173
```

### Testing

```bash
pnpm test                    # unit tests (vitest + jsdom)
pnpm run test:coverage       # with coverage
```

The test suite includes HTML fixtures for every deterministic flag, validated against expected traversal output. Accessible name computation is tested against the [AccName 1.2 test suite](https://www.w3.org/wiki/AccName_1.1_Testable_Statements).

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## License

[Apache-2.0](./LICENSE) © Vantra Design

See the [license rationale in the package spec](./PACKAGE-SPEC.md#license-rationale) for why Apache-2.0 was chosen.
