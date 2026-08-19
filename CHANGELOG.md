# @vantra-design/screenreader-empathy

## 0.3.0

### Minor Changes

- Structure report: scored assessment with heading tree, landmark list, issue aggregation and orphaned-content detection. Exported as `getStructureReport` / `StructureReport` from `./core`.
- 16 new deterministic flags: fieldset-no-legend, table-no-headers, table-no-caption, form-no-submit, no-skip-link, no-nav-landmark, duplicate-landmark-no-label, orphaned-content, flat-structure, wall-of-text, identical-links-different-href, adjacent-duplicate-links, content-before-main, landmark-nesting-violation, no-title, viewport-no-zoom.
- Interactive demo app: fetch any URL, see the page preview with landmark/heading/issue overlays, reading order, heading outline, and Markdown export.
- Demo preview: full sub-resource proxy for CSS, images and fonts (no CORS); viewport-height unit rewriting to prevent the 100vh iframe feedback loop.

## 0.2.0

### Minor Changes

- Hardening release — no API changes, no new features.
  - Cross-package integration tests verify LLM cache sharing with ask-design-system (download once, both tools use it)
  - CSP policy documented and verified — strict `connect-src` allowlist
  - README updated with real measured bundle sizes (8.5 KB full / 5.9 KB core, gzipped) and model sizes
  - Confirmed zero network calls after model download

## 0.1.0

### Minor Changes

- Initial release — local-first accessibility empathy tool
  - Core entry point (`./core`) with zero runtime dependencies
  - Browser entry point with TTS playback (Kokoro) and AI commentary (WebLLM)
  - Deterministic screen reader traversal, landmark detection, accessible name computation
  - 122 tests across 5 test suites
