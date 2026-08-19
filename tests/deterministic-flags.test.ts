import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import { detectFlags, detectPageFlags, detectEntryPatternFlags, resolveRole, getHeadingLevel } from '../src/core/deterministic-flags.js'
import type { FlagContext } from '../src/core/deterministic-flags.js'
import type { TraversalEntry } from '../src/core/types.js'

function el(html: string): Element {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`)
  return dom.window.document.body.firstElementChild!
}

function makeEntry(overrides: Partial<TraversalEntry>): TraversalEntry {
  return {
    index: 0,
    accessibleName: '',
    role: 'generic',
    selector: 'html > body > div',
    htmlSnippet: '<div></div>',
    isLandmark: false,
    flags: [],
    ...overrides,
  }
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

// ── New element-level IA flags ──

describe('detectFlags – IA element flags', () => {
  describe('fieldset-no-legend', () => {
    it('flags fieldset without legend', () => {
      const element = el('<fieldset><input type="text"></fieldset>')
      const flags = detectFlags(element, '', 'group', ctx())
      expect(flags.some(f => f.code === 'fieldset-no-legend')).toBe(true)
    })

    it('does not flag fieldset with legend', () => {
      const element = el('<fieldset><legend>Name</legend><input type="text"></fieldset>')
      const flags = detectFlags(element, 'Name', 'group', ctx())
      expect(flags.some(f => f.code === 'fieldset-no-legend')).toBe(false)
    })

    it('flags fieldset with empty legend', () => {
      const element = el('<fieldset><legend> </legend><input type="text"></fieldset>')
      const flags = detectFlags(element, '', 'group', ctx())
      expect(flags.some(f => f.code === 'fieldset-no-legend')).toBe(true)
    })
  })

  describe('table-no-headers', () => {
    it('flags table without th', () => {
      const element = el('<table><tr><td>A</td><td>B</td></tr></table>')
      const flags = detectFlags(element, '', 'table', ctx())
      expect(flags.some(f => f.code === 'table-no-headers')).toBe(true)
    })

    it('does not flag table with th', () => {
      const element = el('<table><tr><th>Name</th><th>Age</th></tr><tr><td>A</td><td>1</td></tr></table>')
      const flags = detectFlags(element, '', 'table', ctx())
      expect(flags.some(f => f.code === 'table-no-headers')).toBe(false)
    })

    it('does not flag layout table', () => {
      const element = el('<table role="presentation"><tr><td>A</td></tr></table>')
      const flags = detectFlags(element, '', 'presentation', ctx())
      expect(flags.some(f => f.code === 'table-no-headers')).toBe(false)
    })
  })

  describe('table-no-caption', () => {
    it('flags table without caption or accessible name', () => {
      const element = el('<table><tr><th>A</th></tr></table>')
      const flags = detectFlags(element, '', 'table', ctx())
      expect(flags.some(f => f.code === 'table-no-caption')).toBe(true)
    })

    it('does not flag table with caption', () => {
      const element = el('<table><caption>Results</caption><tr><th>A</th></tr></table>')
      const flags = detectFlags(element, 'Results', 'table', ctx())
      expect(flags.some(f => f.code === 'table-no-caption')).toBe(false)
    })

    it('does not flag table with aria-label', () => {
      const element = el('<table aria-label="Results"><tr><th>A</th></tr></table>')
      const flags = detectFlags(element, 'Results', 'table', ctx())
      expect(flags.some(f => f.code === 'table-no-caption')).toBe(false)
    })
  })

  describe('form-no-submit', () => {
    it('flags form without submit', () => {
      const element = el('<form><input type="text"></form>')
      const flags = detectFlags(element, '', 'form', ctx())
      expect(flags.some(f => f.code === 'form-no-submit')).toBe(true)
    })

    it('does not flag form with submit input', () => {
      const element = el('<form><input type="submit" value="Go"></form>')
      const flags = detectFlags(element, '', 'form', ctx())
      expect(flags.some(f => f.code === 'form-no-submit')).toBe(false)
    })

    it('does not flag form with button (no type = implicit submit)', () => {
      const element = el('<form><button>Send</button></form>')
      const flags = detectFlags(element, '', 'form', ctx())
      expect(flags.some(f => f.code === 'form-no-submit')).toBe(false)
    })
  })
})

// ── New page-level IA flags ──

describe('detectPageFlags – IA page flags', () => {
  it('flags no-h1', () => {
    const dom = new JSDOM('<!DOCTYPE html><html lang="en"><body><main><h2>Sub</h2></main></body></html>')
    const flags = detectPageFlags(dom.window.document, true)
    expect(flags.some(f => f.code === 'no-h1')).toBe(true)
  })

  it('flags multiple-h1', () => {
    const dom = new JSDOM('<!DOCTYPE html><html lang="en"><body><main><h1>A</h1><h1>B</h1></main></body></html>')
    const flags = detectPageFlags(dom.window.document, true)
    expect(flags.some(f => f.code === 'multiple-h1')).toBe(true)
  })

  it('does not flag single h1', () => {
    const dom = new JSDOM('<!DOCTYPE html><html lang="en"><body><main><h1>Title</h1></main></body></html>')
    const flags = detectPageFlags(dom.window.document, true)
    expect(flags.some(f => f.code === 'no-h1')).toBe(false)
    expect(flags.some(f => f.code === 'multiple-h1')).toBe(false)
  })

  it('flags no-nav-landmark', () => {
    const dom = new JSDOM('<!DOCTYPE html><html lang="en"><body><main>Content</main></body></html>')
    const flags = detectPageFlags(dom.window.document, true)
    expect(flags.some(f => f.code === 'no-nav-landmark')).toBe(true)
  })

  it('does not flag no-nav-landmark when nav exists', () => {
    const dom = new JSDOM('<!DOCTYPE html><html lang="en"><body><nav>Links</nav><main>Content</main></body></html>')
    const flags = detectPageFlags(dom.window.document, true)
    expect(flags.some(f => f.code === 'no-nav-landmark')).toBe(false)
  })

  it('flags duplicate-landmark-no-label', () => {
    const dom = new JSDOM('<!DOCTYPE html><html lang="en"><body><nav>A</nav><nav>B</nav><main>Content</main></body></html>')
    const flags = detectPageFlags(dom.window.document, true)
    expect(flags.some(f => f.code === 'duplicate-landmark-no-label')).toBe(true)
  })

  it('does not flag labeled duplicate landmarks', () => {
    const dom = new JSDOM('<!DOCTYPE html><html lang="en"><body><nav aria-label="Main">A</nav><nav aria-label="Footer">B</nav><main>Content</main></body></html>')
    const flags = detectPageFlags(dom.window.document, true)
    expect(flags.some(f => f.code === 'duplicate-landmark-no-label')).toBe(false)
  })

  it('flags no-skip-link', () => {
    const dom = new JSDOM('<!DOCTYPE html><html lang="en"><body><nav>Links</nav><main>Content</main></body></html>')
    const flags = detectPageFlags(dom.window.document, true)
    expect(flags.some(f => f.code === 'no-skip-link')).toBe(true)
  })

  it('does not flag when skip link exists', () => {
    const dom = new JSDOM('<!DOCTYPE html><html lang="en"><body><a href="#main">Skip to content</a><nav>Links</nav><main id="main">Content</main></body></html>')
    const flags = detectPageFlags(dom.window.document, true)
    expect(flags.some(f => f.code === 'no-skip-link')).toBe(false)
  })

  it('detects German skip link', () => {
    const dom = new JSDOM('<!DOCTYPE html><html lang="de"><body><a href="#content">Zum Inhalt springen</a><nav>Links</nav><main id="content">Content</main></body></html>')
    const flags = detectPageFlags(dom.window.document, true)
    expect(flags.some(f => f.code === 'no-skip-link')).toBe(false)
  })

  it('flags landmark-nesting-violation', () => {
    const dom = new JSDOM('<!DOCTYPE html><html lang="en"><body><main><main>Nested</main></main></body></html>')
    const flags = detectPageFlags(dom.window.document, true)
    expect(flags.some(f => f.code === 'landmark-nesting-violation')).toBe(true)
  })

  it('flags flat-structure', () => {
    const dom = new JSDOM('<!DOCTYPE html><html lang="en"><body><div>Just divs</div><div>everywhere</div></body></html>')
    const flags = detectPageFlags(dom.window.document, false)
    expect(flags.some(f => f.code === 'flat-structure')).toBe(true)
  })

  it('does not flag flat-structure when headings exist', () => {
    const dom = new JSDOM('<!DOCTYPE html><html lang="en"><body><h1>Title</h1><div>Content</div></body></html>')
    const flags = detectPageFlags(dom.window.document, false)
    expect(flags.some(f => f.code === 'flat-structure')).toBe(false)
  })

  it('flags no-title', () => {
    const dom = new JSDOM('<!DOCTYPE html><html lang="en"><head></head><body><main><h1>Hi</h1></main></body></html>')
    const flags = detectPageFlags(dom.window.document, true)
    expect(flags.some(f => f.code === 'no-title')).toBe(true)
  })

  it('does not flag no-title when title exists', () => {
    const dom = new JSDOM('<!DOCTYPE html><html lang="en"><head><title>My Page</title></head><body><main><h1>Hi</h1></main></body></html>')
    const flags = detectPageFlags(dom.window.document, true)
    expect(flags.some(f => f.code === 'no-title')).toBe(false)
  })

  it('flags viewport-no-zoom with user-scalable=no', () => {
    const dom = new JSDOM('<!DOCTYPE html><html lang="en"><head><meta name="viewport" content="width=device-width, user-scalable=no"></head><body><main><h1>Hi</h1></main></body></html>')
    const flags = detectPageFlags(dom.window.document, true)
    expect(flags.some(f => f.code === 'viewport-no-zoom')).toBe(true)
  })

  it('flags viewport-no-zoom with maximum-scale=1', () => {
    const dom = new JSDOM('<!DOCTYPE html><html lang="en"><head><meta name="viewport" content="width=device-width, maximum-scale=1"></head><body><main><h1>Hi</h1></main></body></html>')
    const flags = detectPageFlags(dom.window.document, true)
    expect(flags.some(f => f.code === 'viewport-no-zoom')).toBe(true)
  })

  it('does not flag viewport with maximum-scale=2', () => {
    const dom = new JSDOM('<!DOCTYPE html><html lang="en"><head><meta name="viewport" content="width=device-width, maximum-scale=2"></head><body><main><h1>Hi</h1></main></body></html>')
    const flags = detectPageFlags(dom.window.document, true)
    expect(flags.some(f => f.code === 'viewport-no-zoom')).toBe(false)
  })
})

// ── Entry-pattern flags ──

describe('detectEntryPatternFlags', () => {
  describe('content-before-main', () => {
    it('flags when many elements appear before main', () => {
      const entries: TraversalEntry[] = [
        ...Array.from({ length: 25 }, (_, i) => makeEntry({
          index: i,
          role: 'link',
          accessibleName: `Link ${i}`,
          selector: `html > body > div > a:nth-of-type(${i + 1})`,
          htmlSnippet: `<a href="/p${i}">Link ${i}</a>`,
        })),
        makeEntry({ index: 25, role: 'main', isLandmark: true, selector: 'html > body > main' }),
      ]
      const flags = detectEntryPatternFlags(entries)
      expect(flags.some(f => f.code === 'content-before-main')).toBe(true)
    })

    it('does not flag few elements before main', () => {
      const entries: TraversalEntry[] = [
        makeEntry({ index: 0, role: 'navigation', isLandmark: true, selector: 'html > body > nav' }),
        makeEntry({ index: 1, role: 'link', accessibleName: 'Home', selector: 'html > body > nav > a' }),
        makeEntry({ index: 2, role: 'main', isLandmark: true, selector: 'html > body > main' }),
      ]
      const flags = detectEntryPatternFlags(entries)
      expect(flags.some(f => f.code === 'content-before-main')).toBe(false)
    })
  })

  describe('identical-links-different-href', () => {
    it('flags same link text pointing to different URLs', () => {
      const entries: TraversalEntry[] = [
        makeEntry({ index: 0, role: 'link', accessibleName: 'Read more', htmlSnippet: '<a href="/page1">Read more</a>', selector: 'html > body > main > a:nth-of-type(1)' }),
        makeEntry({ index: 1, role: 'link', accessibleName: 'Read more', htmlSnippet: '<a href="/page2">Read more</a>', selector: 'html > body > main > a:nth-of-type(2)' }),
      ]
      const flags = detectEntryPatternFlags(entries)
      expect(flags.some(f => f.code === 'identical-links-different-href')).toBe(true)
    })

    it('does not flag same link text same URL', () => {
      const entries: TraversalEntry[] = [
        makeEntry({ index: 0, role: 'link', accessibleName: 'Home', htmlSnippet: '<a href="/">Home</a>', selector: 'html > body > nav > a:nth-of-type(1)' }),
        makeEntry({ index: 1, role: 'link', accessibleName: 'Home', htmlSnippet: '<a href="/">Home</a>', selector: 'html > body > footer > a:nth-of-type(1)' }),
      ]
      const flags = detectEntryPatternFlags(entries)
      expect(flags.some(f => f.code === 'identical-links-different-href')).toBe(false)
    })
  })

  describe('adjacent-duplicate-links', () => {
    it('flags adjacent links to same destination with different text', () => {
      const entries: TraversalEntry[] = [
        makeEntry({ index: 0, role: 'link', accessibleName: '', htmlSnippet: '<a href="/article"><img src="thumb.jpg" alt=""></a>', selector: 'html > body > main > a:nth-of-type(1)' }),
        makeEntry({ index: 1, role: 'link', accessibleName: 'Article Title', htmlSnippet: '<a href="/article">Article Title</a>', selector: 'html > body > main > a:nth-of-type(2)' }),
      ]
      const flags = detectEntryPatternFlags(entries)
      expect(flags.some(f => f.code === 'adjacent-duplicate-links')).toBe(true)
    })
  })

  describe('wall-of-text', () => {
    it('flags long runs without headings or landmarks', () => {
      const entries: TraversalEntry[] = Array.from({ length: 35 }, (_, i) => makeEntry({
        index: i,
        role: 'generic',
        accessibleName: `Paragraph ${i}`,
        selector: `html > body > main > p:nth-of-type(${i + 1})`,
      }))
      const flags = detectEntryPatternFlags(entries)
      expect(flags.some(f => f.code === 'wall-of-text')).toBe(true)
    })

    it('does not flag when headings break up content', () => {
      const entries: TraversalEntry[] = []
      for (let i = 0; i < 40; i++) {
        if (i % 10 === 0) {
          entries.push(makeEntry({ index: i, role: 'heading', level: 2, accessibleName: `Section ${i}`, selector: `html > body > main > h2:nth-of-type(${i / 10 + 1})` }))
        } else {
          entries.push(makeEntry({ index: i, role: 'generic', accessibleName: `Text ${i}`, selector: `html > body > main > p:nth-of-type(${i})` }))
        }
      }
      const flags = detectEntryPatternFlags(entries)
      expect(flags.some(f => f.code === 'wall-of-text')).toBe(false)
    })
  })
})
