import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import { isLandmark, getLandmarkRole } from '../src/core/landmarks.js'

function el(html: string): Element {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`)
  return dom.window.document.body.firstElementChild!
}

function bodyChild(html: string): Element {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`)
  return dom.window.document.body.firstElementChild!
}

describe('isLandmark', () => {
  describe('explicit roles', () => {
    it('recognizes role="navigation"', () => {
      expect(isLandmark(el('<div role="navigation">Nav</div>'))).toBe(true)
    })

    it('recognizes role="main"', () => {
      expect(isLandmark(el('<div role="main">Content</div>'))).toBe(true)
    })

    it('recognizes role="banner"', () => {
      expect(isLandmark(el('<div role="banner">Header</div>'))).toBe(true)
    })

    it('recognizes role="search"', () => {
      expect(isLandmark(el('<div role="search">Search</div>'))).toBe(true)
    })

    it('does not treat role="button" as landmark', () => {
      expect(isLandmark(el('<div role="button">Click</div>'))).toBe(false)
    })
  })

  describe('implicit landmark elements', () => {
    it('recognizes <nav>', () => {
      expect(isLandmark(el('<nav>Nav</nav>'))).toBe(true)
    })

    it('recognizes <main>', () => {
      expect(isLandmark(el('<main>Content</main>'))).toBe(true)
    })

    it('recognizes <aside>', () => {
      expect(isLandmark(el('<aside>Sidebar</aside>'))).toBe(true)
    })

    it('recognizes <header> at body scope', () => {
      expect(isLandmark(bodyChild('<header>Header</header>'))).toBe(true)
    })

    it('recognizes <footer> at body scope', () => {
      expect(isLandmark(bodyChild('<footer>Footer</footer>'))).toBe(true)
    })
  })

  describe('scoping rules', () => {
    it('does not treat <header> nested in <article> as landmark', () => {
      const dom = new JSDOM(`<!DOCTYPE html><html><body><article><header>Header</header></article></body></html>`)
      const header = dom.window.document.querySelector('header')!
      expect(isLandmark(header)).toBe(false)
    })

    it('does not treat <footer> nested in <section> as landmark', () => {
      const dom = new JSDOM(`<!DOCTYPE html><html><body><section><footer>Footer</footer></section></body></html>`)
      const footer = dom.window.document.querySelector('footer')!
      expect(isLandmark(footer)).toBe(false)
    })
  })

  describe('accessible name requirement', () => {
    it('does not treat <section> without name as landmark', () => {
      expect(isLandmark(el('<section>Content</section>'))).toBe(false)
    })

    it('treats <section> with aria-label as landmark', () => {
      expect(isLandmark(el('<section aria-label="Main content">Content</section>'))).toBe(true)
    })

    it('treats <section> with aria-labelledby as landmark', () => {
      expect(isLandmark(el('<section aria-labelledby="heading">Content</section>'))).toBe(true)
    })

    it('does not treat <form> without name as landmark', () => {
      expect(isLandmark(el('<form>Fields</form>'))).toBe(false)
    })

    it('treats <form> with title as landmark', () => {
      expect(isLandmark(el('<form title="Contact form">Fields</form>'))).toBe(true)
    })
  })

  describe('non-landmark elements', () => {
    it('returns false for <div>', () => {
      expect(isLandmark(el('<div>Content</div>'))).toBe(false)
    })

    it('returns false for <p>', () => {
      expect(isLandmark(el('<p>Paragraph</p>'))).toBe(false)
    })
  })
})

describe('getLandmarkRole', () => {
  it('returns role for explicit landmark', () => {
    expect(getLandmarkRole(el('<div role="navigation">Nav</div>'))).toBe('navigation')
  })

  it('returns implicit role for <nav>', () => {
    expect(getLandmarkRole(el('<nav>Nav</nav>'))).toBe('navigation')
  })

  it('returns implicit role for <main>', () => {
    expect(getLandmarkRole(el('<main>Content</main>'))).toBe('main')
  })

  it('returns null for non-landmark', () => {
    expect(getLandmarkRole(el('<div>Content</div>'))).toBeNull()
  })

  it('returns null for <section> without name', () => {
    expect(getLandmarkRole(el('<section>Content</section>'))).toBeNull()
  })

  it('returns "region" for named <section>', () => {
    expect(getLandmarkRole(el('<section aria-label="About">Content</section>'))).toBe('region')
  })
})
