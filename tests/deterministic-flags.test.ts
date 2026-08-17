import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import { detectFlags, detectPageFlags, resolveRole, getHeadingLevel } from '../src/core/deterministic-flags.js'
import type { FlagContext } from '../src/core/deterministic-flags.js'

function el(html: string): Element {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`)
  return dom.window.document.body.firstElementChild!
}

function ctx(previousHeadingLevel = 0): FlagContext {
  return { previousHeadingLevel }
}

describe('detectFlags', () => {
  describe('missing-accessible-name', () => {
    it('flags heading without name', () => {
      const element = el('<h1></h1>')
      const flags = detectFlags(element, '', 'heading', ctx())
      expect(flags.some(f => f.code === 'missing-accessible-name')).toBe(true)
    })

    it('does not flag heading with name', () => {
      const element = el('<h1>Title</h1>')
      const flags = detectFlags(element, 'Title', 'heading', ctx())
      expect(flags.some(f => f.code === 'missing-accessible-name')).toBe(false)
    })
  })

  describe('empty-link-text', () => {
    it('flags link without text', () => {
      const element = el('<a href="/"></a>')
      const flags = detectFlags(element, '', 'link', ctx())
      expect(flags.some(f => f.code === 'empty-link-text')).toBe(true)
    })

    it('does not flag link with text', () => {
      const element = el('<a href="/">Home</a>')
      const flags = detectFlags(element, 'Home', 'link', ctx())
      expect(flags.some(f => f.code === 'empty-link-text')).toBe(false)
    })
  })

  describe('empty-button-text', () => {
    it('flags button without text', () => {
      const element = el('<button></button>')
      const flags = detectFlags(element, '', 'button', ctx())
      expect(flags.some(f => f.code === 'empty-button-text')).toBe(true)
    })
  })

  describe('missing-form-label', () => {
    it('flags input without label', () => {
      const element = el('<input type="text">')
      const flags = detectFlags(element, '', 'textbox', ctx())
      expect(flags.some(f => f.code === 'missing-form-label')).toBe(true)
    })

    it('does not flag hidden input', () => {
      const element = el('<input type="hidden">')
      const flags = detectFlags(element, '', 'textbox', ctx())
      expect(flags.some(f => f.code === 'missing-form-label')).toBe(false)
    })

    it('does not flag submit button', () => {
      const element = el('<input type="submit" value="Go">')
      const flags = detectFlags(element, 'Go', 'button', ctx())
      expect(flags.some(f => f.code === 'missing-form-label')).toBe(false)
    })

    it('does not flag input with label', () => {
      const element = el('<input type="text">')
      const flags = detectFlags(element, 'Email', 'textbox', ctx())
      expect(flags.some(f => f.code === 'missing-form-label')).toBe(false)
    })
  })

  describe('heading-level-skip', () => {
    it('flags heading skip (h1 → h3)', () => {
      const element = el('<h3>Sub</h3>')
      const flags = detectFlags(element, 'Sub', 'heading', ctx(1))
      expect(flags.some(f => f.code === 'heading-level-skip')).toBe(true)
    })

    it('does not flag sequential headings (h1 → h2)', () => {
      const element = el('<h2>Sub</h2>')
      const flags = detectFlags(element, 'Sub', 'heading', ctx(1))
      expect(flags.some(f => f.code === 'heading-level-skip')).toBe(false)
    })

    it('does not flag first heading', () => {
      const element = el('<h2>Title</h2>')
      const flags = detectFlags(element, 'Title', 'heading', ctx(0))
      expect(flags.some(f => f.code === 'heading-level-skip')).toBe(false)
    })
  })

  describe('redundant-role', () => {
    it('flags role="button" on <button>', () => {
      const element = el('<button role="button">Click</button>')
      const flags = detectFlags(element, 'Click', 'button', ctx())
      expect(flags.some(f => f.code === 'redundant-role')).toBe(true)
    })

    it('flags role="navigation" on <nav>', () => {
      const element = el('<nav role="navigation">Nav</nav>')
      const flags = detectFlags(element, 'Nav', 'navigation', ctx())
      expect(flags.some(f => f.code === 'redundant-role')).toBe(true)
    })

    it('does not flag role="dialog" on <div>', () => {
      const element = el('<div role="dialog">Modal</div>')
      const flags = detectFlags(element, 'Modal', 'dialog', ctx())
      expect(flags.some(f => f.code === 'redundant-role')).toBe(false)
    })
  })

  describe('missing-alt-text', () => {
    it('flags <img> without alt', () => {
      const element = el('<img src="photo.jpg">')
      const flags = detectFlags(element, '', 'image', ctx())
      expect(flags.some(f => f.code === 'missing-alt-text')).toBe(true)
    })

    it('does not flag <img> with alt=""', () => {
      const element = el('<img src="decorative.jpg" alt="">')
      const flags = detectFlags(element, '', 'image', ctx())
      expect(flags.some(f => f.code === 'missing-alt-text')).toBe(false)
    })

    it('does not flag <img> with alt text', () => {
      const element = el('<img src="photo.jpg" alt="Company team">')
      const flags = detectFlags(element, 'Company team', 'image', ctx())
      expect(flags.some(f => f.code === 'missing-alt-text')).toBe(false)
    })

    it('does not flag presentational <img>', () => {
      const element = el('<img src="bg.jpg" role="presentation">')
      const flags = detectFlags(element, '', 'presentation', ctx())
      expect(flags.some(f => f.code === 'missing-alt-text')).toBe(false)
    })
  })

  describe('generic-link-text', () => {
    it('flags "click here"', () => {
      const element = el('<a href="/">click here</a>')
      const flags = detectFlags(element, 'click here', 'link', ctx())
      expect(flags.some(f => f.code === 'generic-link-text')).toBe(true)
    })

    it('flags "read more"', () => {
      const element = el('<a href="/">Read more</a>')
      const flags = detectFlags(element, 'Read more', 'link', ctx())
      expect(flags.some(f => f.code === 'generic-link-text')).toBe(true)
    })

    it('does not flag descriptive link text', () => {
      const element = el('<a href="/">View pricing details</a>')
      const flags = detectFlags(element, 'View pricing details', 'link', ctx())
      expect(flags.some(f => f.code === 'generic-link-text')).toBe(false)
    })
  })

  describe('tabindex-positive', () => {
    it('flags tabindex > 0', () => {
      const element = el('<div tabindex="5">Content</div>')
      const flags = detectFlags(element, '', 'generic', ctx())
      expect(flags.some(f => f.code === 'tabindex-positive')).toBe(true)
    })

    it('does not flag tabindex="0"', () => {
      const element = el('<div tabindex="0">Content</div>')
      const flags = detectFlags(element, '', 'generic', ctx())
      expect(flags.some(f => f.code === 'tabindex-positive')).toBe(false)
    })

    it('does not flag tabindex="-1"', () => {
      const element = el('<div tabindex="-1">Content</div>')
      const flags = detectFlags(element, '', 'generic', ctx())
      expect(flags.some(f => f.code === 'tabindex-positive')).toBe(false)
    })
  })
})

describe('detectPageFlags', () => {
  it('flags missing main landmark', () => {
    const dom = new JSDOM('<!DOCTYPE html><html><body><div>Content</div></body></html>')
    const flags = detectPageFlags(dom.window.document, false)
    expect(flags.some(f => f.code === 'missing-landmark')).toBe(true)
  })

  it('does not flag when main landmark exists', () => {
    const dom = new JSDOM('<!DOCTYPE html><html><body><main>Content</main></body></html>')
    const flags = detectPageFlags(dom.window.document, true)
    expect(flags.some(f => f.code === 'missing-landmark')).toBe(false)
  })

  it('flags missing lang attribute', () => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
    const flags = detectPageFlags(dom.window.document, true)
    expect(flags.some(f => f.code === 'no-lang-attribute')).toBe(true)
  })

  it('does not flag when lang is present', () => {
    const dom = new JSDOM('<!DOCTYPE html><html lang="en"><body></body></html>')
    const flags = detectPageFlags(dom.window.document, true)
    expect(flags.some(f => f.code === 'no-lang-attribute')).toBe(false)
  })

  it('flags duplicate IDs', () => {
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="dup">A</div><div id="dup">B</div></body></html>')
    const flags = detectPageFlags(dom.window.document, true)
    expect(flags.some(f => f.code === 'duplicate-id')).toBe(true)
  })
})

describe('resolveRole', () => {
  it('uses explicit role', () => {
    expect(resolveRole(el('<div role="dialog">Modal</div>'))).toBe('dialog')
  })

  it('resolves <button> to "button"', () => {
    expect(resolveRole(el('<button>Click</button>'))).toBe('button')
  })

  it('resolves <a href> to "link"', () => {
    expect(resolveRole(el('<a href="/">Home</a>'))).toBe('link')
  })

  it('resolves <a> without href to "generic"', () => {
    expect(resolveRole(el('<a>Not a link</a>'))).toBe('generic')
  })

  it('resolves <input type="checkbox"> to "checkbox"', () => {
    expect(resolveRole(el('<input type="checkbox">'))).toBe('checkbox')
  })

  it('resolves <h1> to "heading"', () => {
    expect(resolveRole(el('<h1>Title</h1>'))).toBe('heading')
  })

  it('resolves unknown element to "generic"', () => {
    expect(resolveRole(el('<span>Text</span>'))).toBe('generic')
  })
})

describe('getHeadingLevel', () => {
  it('returns level from h1-h6 tags', () => {
    expect(getHeadingLevel(el('<h1>Title</h1>'))).toBe(1)
    expect(getHeadingLevel(el('<h3>Sub</h3>'))).toBe(3)
    expect(getHeadingLevel(el('<h6>Tiny</h6>'))).toBe(6)
  })

  it('uses aria-level for elements with role="heading"', () => {
    expect(getHeadingLevel(el('<div role="heading" aria-level="2">Title</div>'))).toBe(2)
  })

  it('returns 0 for non-heading elements', () => {
    expect(getHeadingLevel(el('<div>Not heading</div>'))).toBe(0)
  })
})
