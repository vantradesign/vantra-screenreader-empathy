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
const playback = new EmpathyPlayback(result, {
  onEntryStart: (entry) => console.log(`Reading: ${entry.role} — ${entry.accessibleName}`),
})

await playback.init()
await playback.play()
```

### Node / CI — headless analysis only

```ts
import { analyzeAccessibilityFlow } from '@vantra-design/screenreader-empathy/core'
import { JSDOM } from 'jsdom'

const dom = new JSDOM(html)
const result = analyzeAccessibilityFlow(dom.window.document)
console.log(`Found ${result.summary.flagCount['missing-alt-text']} images without alt text`)
```

The `./core` entry point has **zero runtime dependencies** and works anywhere JavaScript runs.

---

## Size budget

| Component | Size | Cached? |
| --- | --- | --- |
| Full package (JS, gzipped) | 8.5 KB | — |
| Core-only `./core` (JS, gzipped) | 5.9 KB | — |
| Kokoro TTS model (q8, WebGPU) | ~82 MB | ✓ Cache API |
| Llama-3.2-1B-Instruct (AI commentary) | ~500 MB | ✓ Cache API |

> Models are downloaded once and cached in the browser via the Cache API. If `@vantra-design/ask-design-system` is also installed, both tools share the LLM cache — download once, both tools use it.

## Content Security Policy

```txt
default-src 'self';
connect-src 'self' https://huggingface.co https://*.huggingface.co https://cdn-lfs.hf.co https://cdn-lfs-us-1.hf.co https://cdn-lfs-us-1.huggingface.co;
script-src 'self' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline';
worker-src 'self' blob:;
```

After the one-time model download, **zero network calls** are made.

---

## Packages

| Package | Description |
| --- | --- |
| [`@vantra-design/screenreader-empathy`](.) | Core — headless analysis (`./core`) and browser playback + AI commentary (`.`) |
| [`@vantra-design/screenreader-empathy-vue`](./vue) | Vue 3 components and composables (Phase 2 — placeholder) |

---

## Development

```bash
git clone https://github.com/vantradesign/vantra-screenreader-empathy.git
cd vantra-screenreader-empathy
pnpm install
pnpm run verify       # lint + typecheck + test + build
```

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## License

[Apache-2.0](./LICENSE) © Vantra Design
