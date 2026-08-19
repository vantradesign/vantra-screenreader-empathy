import { describe, it, expect } from 'vitest'
import { analyzeAccessibilityFlow } from '../src/core/traversal.js'
import { getStructureReport } from '../src/core/structure-report.js'

describe('getStructureReport', () => {
  describe('heading tree', () => {
    it('builds a nested heading tree', () => {
      const result = analyzeAccessibilityFlow(`
        <html lang="en"><head><title>Test</title></head><body>
          <a href="#main">Skip to content</a>
          <nav aria-label="Main"><a href="/">Home</a></nav>
          <main id="main">
            <h1>Page Title</h1>
            <h2>Section A</h2>
            <h3>Subsection A.1</h3>
            <h2>Section B</h2>
          </main>
        </body></html>
      `)
      const report = getStructureReport(result)

      expect(report.headingTree).toHaveLength(1) // one h1 root
      expect(report.headingTree[0]!.name).toBe('Page Title')
      expect(report.headingTree[0]!.children).toHaveLength(2) // two h2s
      expect(report.headingTree[0]!.children[0]!.name).toBe('Section A')
      expect(report.headingTree[0]!.children[0]!.children).toHaveLength(1) // one h3
      expect(report.headingTree[0]!.children[1]!.name).toBe('Section B')
    })

    it('handles flat heading structure', () => {
      const result = analyzeAccessibilityFlow(`
        <html lang="en"><head><title>Test</title></head><body>
          <a href="#main">Skip to content</a>
          <nav aria-label="Main"><a href="/">Home</a></nav>
          <main id="main">
            <h2>A</h2>
            <h2>B</h2>
            <h2>C</h2>
          </main>
        </body></html>
      `)
      const report = getStructureReport(result)

      // All h2s are siblings at root level (no h1 parent)
      expect(report.headingTree).toHaveLength(3)
    })
  })

  describe('landmarks', () => {
    it('lists all landmarks', () => {
      const result = analyzeAccessibilityFlow(`
        <html lang="en"><head><title>Test</title></head><body>
          <a href="#main">Skip to content</a>
          <nav aria-label="Main">Links</nav>
          <main id="main">Content</main>
          <aside>Sidebar</aside>
        </body></html>
      `)
      const report = getStructureReport(result)

      expect(report.landmarks.length).toBeGreaterThanOrEqual(3)
      const roles = report.landmarks.map((l) => l.role)
      expect(roles).toContain('navigation')
      expect(roles).toContain('main')
      expect(roles).toContain('complementary')
    })
  })

  describe('elementsBeforeMain', () => {
    it('counts elements before main', () => {
      const result = analyzeAccessibilityFlow(`
        <html lang="en"><head><title>Test</title></head><body>
          <a href="#main">Skip</a>
          <nav aria-label="Main"><a href="/">Home</a><a href="/about">About</a></nav>
          <main id="main"><h1>Title</h1></main>
        </body></html>
      `)
      const report = getStructureReport(result)

      // skip link + nav landmark + 2 links = at least 3-4 entries before main
      expect(report.elementsBeforeMain).toBeGreaterThan(0)
      expect(report.elementsBeforeMain).toBeLessThan(10)
    })

    it('returns total count when no main exists', () => {
      const result = analyzeAccessibilityFlow(`
        <html lang="en"><head><title>Test</title></head><body>
          <div>A</div><div>B</div>
        </body></html>
      `)
      const report = getStructureReport(result)

      expect(report.elementsBeforeMain).toBe(result.entries.length)
    })
  })

  describe('scoring and bands', () => {
    it('scores a well-structured page high', () => {
      const result = analyzeAccessibilityFlow(`
        <html lang="en"><head><title>Well Structured</title></head><body>
          <a href="#main">Skip to content</a>
          <nav aria-label="Main"><a href="/">Home</a></nav>
          <main id="main">
            <h1>Welcome</h1>
            <p>Some intro text.</p>
            <h2>Features</h2>
            <p>Feature details.</p>
          </main>
          <footer>Copyright 2026</footer>
        </body></html>
      `)
      const report = getStructureReport(result)

      expect(report.score).toBeGreaterThanOrEqual(60)
      expect(['solid', 'thorough']).toContain(report.band)
    })

    it('scores a poorly structured page low', () => {
      const result = analyzeAccessibilityFlow(`
        <html><body>
          <div>No headings</div>
          <div>No landmarks</div>
          <div>No structure at all</div>
        </body></html>
      `)
      const report = getStructureReport(result)

      expect(report.score).toBeLessThan(50)
      expect(report.issues.length).toBeGreaterThan(0)
    })
  })

  describe('issues', () => {
    it('collects IA-relevant issues', () => {
      const result = analyzeAccessibilityFlow(`
        <html><body>
          <div><a href="/">click here</a></div>
          <img src="photo.jpg">
        </body></html>
      `)
      const report = getStructureReport(result)

      const codes = report.issues.map((i) => i.code)
      // Should contain structural issues
      expect(codes).toContain('missing-landmark')
      expect(codes).toContain('flat-structure')
    })

    it('sorts issues by severity', () => {
      const result = analyzeAccessibilityFlow(`
        <html><body>
          <div><a href="/">click here</a></div>
        </body></html>
      `)
      const report = getStructureReport(result)

      // Critical/serious issues should come before moderate/minor
      const severityOrder = ['critical', 'serious', 'moderate', 'minor']
      for (let i = 0; i < report.issues.length - 1; i++) {
        const a = severityOrder.indexOf(report.issues[i]!.severity)
        const b = severityOrder.indexOf(report.issues[i + 1]!.severity)
        expect(a).toBeLessThanOrEqual(b)
      }
    })
  })
})
