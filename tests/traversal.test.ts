import { describe, it, expect } from 'vitest'
import { analyzeAccessibilityFlow } from '../src/core/traversal.js'

describe('analyzeAccessibilityFlow', () => {
  describe('basic traversal', () => {
    it('traverses a simple page', () => {
      const html = `
        <html lang="en">
          <body>
            <main>
              <h1>Welcome</h1>
              <p>Some text</p>
              <button>Submit</button>
            </main>
          </body>
        </html>
      `
      const result = analyzeAccessibilityFlow(html)

      expect(result.entries.length).toBeGreaterThan(0)

      // Should find main, h1, button
      const roles = result.entries.map((e) => e.role)
      expect(roles).toContain('main')
      expect(roles).toContain('heading')
      expect(roles).toContain('button')
    })

    it('computes accessible names', () => {
      const result = analyzeAccessibilityFlow(`
        <html lang="en"><body>
          <main>
            <h1>Welcome to Acme</h1>
            <button>Submit</button>
          </main>
        </body></html>
      `)

      const heading = result.entries.find((e) => e.role === 'heading')
      expect(heading?.accessibleName).toBe('Welcome to Acme')

      const button = result.entries.find((e) => e.role === 'button')
      expect(button?.accessibleName).toBe('Submit')
    })

    it('detects heading levels', () => {
      const result = analyzeAccessibilityFlow(`
        <html lang="en"><body><main>
          <h1>Title</h1>
          <h2>Subtitle</h2>
          <h3>Section</h3>
        </main></body></html>
      `)

      const headings = result.entries.filter((e) => e.role === 'heading')
      expect(headings).toHaveLength(3)
      expect(headings[0]?.level).toBe(1)
      expect(headings[1]?.level).toBe(2)
      expect(headings[2]?.level).toBe(3)
    })
  })

  describe('flag detection', () => {
    it('flags images without alt', () => {
      const result = analyzeAccessibilityFlow(`
        <html lang="en"><body><main>
          <img src="photo.jpg">
        </main></body></html>
      `)

      const img = result.entries.find((e) => e.role === 'image')
      expect(img?.flags.some((f) => f.code === 'missing-alt-text')).toBe(true)
    })

    it('does not flag decorative images', () => {
      const result = analyzeAccessibilityFlow(`
        <html lang="en"><body><main>
          <img src="bg.jpg" alt="">
        </main></body></html>
      `)

      const img = result.entries.find((e) => e.role === 'image')
      expect(img?.flags.some((f) => f.code === 'missing-alt-text')).toBe(false)
    })

    it('flags heading level skips', () => {
      const result = analyzeAccessibilityFlow(`
        <html lang="en"><body><main>
          <h1>Title</h1>
          <h3>Skipped h2</h3>
        </main></body></html>
      `)

      const h3 = result.entries.find((e) => e.role === 'heading' && e.level === 3)
      expect(h3?.flags.some((f) => f.code === 'heading-level-skip')).toBe(true)
    })

    it('flags empty buttons', () => {
      const result = analyzeAccessibilityFlow(`
        <html lang="en"><body><main>
          <button></button>
        </main></body></html>
      `)

      const btn = result.entries.find((e) => e.role === 'button')
      expect(btn?.flags.some((f) => f.code === 'empty-button-text')).toBe(true)
    })

    it('flags generic link text', () => {
      const result = analyzeAccessibilityFlow(`
        <html lang="en"><body><main>
          <a href="/">click here</a>
        </main></body></html>
      `)

      const link = result.entries.find((e) => e.role === 'link')
      expect(link?.flags.some((f) => f.code === 'generic-link-text')).toBe(true)
    })
  })

  describe('landmarks', () => {
    it('identifies landmarks', () => {
      const result = analyzeAccessibilityFlow(`
        <html lang="en"><body>
          <nav aria-label="Main">Links</nav>
          <main>Content</main>
          <aside>Sidebar</aside>
        </body></html>
      `)

      const landmarks = result.entries.filter((e) => e.isLandmark)
      expect(landmarks.length).toBeGreaterThanOrEqual(3)
      expect(result.summary.landmarkCount).toBeGreaterThanOrEqual(3)
    })
  })

  describe('summary', () => {
    it('builds heading structure', () => {
      const result = analyzeAccessibilityFlow(`
        <html lang="en"><body><main>
          <h1>Page Title</h1>
          <h2>Section A</h2>
          <h2>Section B</h2>
        </main></body></html>
      `)

      expect(result.summary.headingStructure).toEqual([
        { level: 1, name: 'Page Title' },
        { level: 2, name: 'Section A' },
        { level: 2, name: 'Section B' },
      ])
    })

    it('counts flags in summary', () => {
      const result = analyzeAccessibilityFlow(`
        <html lang="en"><body><main>
          <img src="a.jpg">
          <img src="b.jpg">
        </main></body></html>
      `)

      expect(result.summary.flagCount['missing-alt-text']).toBe(2)
    })
  })

  describe('page-level flags', () => {
    it('flags missing lang', () => {
      const result = analyzeAccessibilityFlow(`
        <html><body><main>Content</main></body></html>
      `)

      expect(result.summary.flagCount['no-lang-attribute']).toBe(1)
    })

    it('flags missing main landmark when absent', () => {
      const result = analyzeAccessibilityFlow(`
        <html lang="en"><body><div>Content</div></body></html>
      `)

      expect(result.summary.flagCount['missing-landmark']).toBe(1)
    })
  })

  describe('options', () => {
    it('truncates at maxEntries', () => {
      const items = Array.from({ length: 100 }, (_, i) => `<button>Btn ${i}</button>`).join('')
      const result = analyzeAccessibilityFlow(
        `<html lang="en"><body><main>${items}</main></body></html>`,
        { maxEntries: 10 },
      )

      expect(result.entries.length).toBeLessThanOrEqual(10)
      expect(result.warnings.some((w) => w.code === 'truncated')).toBe(true)
    })
  })

  describe('input types', () => {
    it('accepts an HTML string', () => {
      const result = analyzeAccessibilityFlow('<html lang="en"><body><main><h1>Title</h1></main></body></html>')
      expect(result.entries.length).toBeGreaterThan(0)
    })

    it('accepts a Document', () => {
      const parser = new DOMParser()
      const doc = parser.parseFromString('<html lang="en"><body><main><h1>Title</h1></main></body></html>', 'text/html')
      const result = analyzeAccessibilityFlow(doc)
      expect(result.entries.length).toBeGreaterThan(0)
    })
  })
})
