# @vantra-design/screenreader-empathy

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
