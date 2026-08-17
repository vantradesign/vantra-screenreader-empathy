# Contributing to @vantra-design/screenreader-empathy

Thank you for your interest in contributing!

## Development setup

```bash
pnpm install
pnpm run verify   # lint + typecheck + test + build
```

### Useful commands

| Command | Description |
| --- | --- |
| `pnpm run build` | Build with tsup (ESM + CJS + .d.ts) |
| `pnpm run dev` | Build in watch mode |
| `pnpm run test` | Run tests with vitest |
| `pnpm run test:watch` | Run tests in watch mode |
| `pnpm run lint` | Lint with ESLint |
| `pnpm run typecheck` | Type-check with TypeScript |
| `pnpm run verify` | Run all checks (lint, typecheck, test, build) |

## Architecture

The package has two entry points:

- **`./core`** — Headless, zero-dependency accessibility tree traversal. Works in browsers and Node (with jsdom). No AI, no audio.
- **`.`** (root) — Adds TTS playback, DOM highlighting, and optional AI commentary. Browser-only.

The core entry point must remain dependency-free. Browser features must not leak into the core.

## Code style

- TypeScript strict mode
- ESLint with `@typescript-eslint`
- Prefer `type` imports for type-only usage

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat(core): add heading-level-skip flag
fix(playback): handle empty traversal result
test(accessible-name): cover aria-labelledby edge cases
```

## Versioning

This project uses [Changesets](https://github.com/changesets/changesets). Add a changeset for every user-facing change:

```bash
pnpm changeset
```

## License

Apache-2.0 — see [LICENSE](./LICENSE).
