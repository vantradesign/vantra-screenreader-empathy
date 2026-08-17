import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import { computeAccessibleName } from '../src/core/accessible-name.js'

function el(html: string): Element {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`)
  return dom.window.document.body.firstElementChild!
}

function elFromDoc(html: string): { element: Element; document: Document } {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`)
  return { element: dom.window.document.body.firstElementChild!, document: dom.window.document }
}

describe('computeAccessibleName', () => {
  describe('aria-label', () => {
    it('uses aria-label directly', () => {
      expect(computeAccessibleName(el('<button aria-label="Close dialog">X</button>'))).toBe('Close dialog')
    })

    it('trims whitespace', () => {
      expect(computeAccessibleName(el('<button aria-label="  Save  ">💾</button>'))).toBe('Save')
    })

    it('ignores empty aria-label', () => {
      expect(computeAccessibleName(el('<button aria-label="">Submit</button>'))).toBe('Submit')
    })
  })

  describe('aria-labelledby', () => {
    it('concatenates referenced elements', () => {
      const { element } = elFromDoc(`
        <div>
          <button id="btn" aria-labelledby="label1 label2">X</button>
          <span id="label1">Save</span>
          <span id="label2">changes</span>
        </div>
      `)
      const btn = element.querySelector('#btn')!
      expect(computeAccessibleName(btn)).toBe('Save changes')
    })

    it('takes precedence over aria-label', () => {
      const { element } = elFromDoc(`
        <div>
          <button id="btn" aria-label="Wrong" aria-labelledby="lbl">X</button>
          <span id="lbl">Right</span>
        </div>
      `)
      const btn = element.querySelector('#btn')!
      expect(computeAccessibleName(btn)).toBe('Right')
    })

    it('includes hidden elements referenced by aria-labelledby', () => {
      const { element } = elFromDoc(`
        <div>
          <button id="btn" aria-labelledby="hidden-label">X</button>
          <span id="hidden-label" aria-hidden="true">Hidden but referenced</span>
        </div>
      `)
      const btn = element.querySelector('#btn')!
      expect(computeAccessibleName(btn)).toBe('Hidden but referenced')
    })

    it('handles missing references gracefully', () => {
      const btn = el('<button aria-labelledby="nonexistent">Fallback</button>')
      expect(computeAccessibleName(btn)).toBe('Fallback')
    })
  })

  describe('native text alternatives', () => {
    it('uses alt text for <img>', () => {
      expect(computeAccessibleName(el('<img alt="Company logo">'))).toBe('Company logo')
    })

    it('returns empty string for decorative <img> (empty alt)', () => {
      expect(computeAccessibleName(el('<img alt="">'))).toBe('')
    })

    it('uses label[for] for inputs', () => {
      const { element } = elFromDoc(`
        <div>
          <label for="email">Email address</label>
          <input id="email" type="email">
        </div>
      `)
      const input = element.querySelector('input')!
      expect(computeAccessibleName(input)).toBe('Email address')
    })

    it('uses wrapping <label> for inputs', () => {
      const { element } = elFromDoc(`
        <label>Username <input type="text"></label>
      `)
      const input = element.querySelector('input')!
      expect(computeAccessibleName(input)).toBe('Username')
    })

    it('uses <legend> for <fieldset>', () => {
      expect(computeAccessibleName(
        el('<fieldset><legend>Personal info</legend><input></fieldset>'),
      )).toBe('Personal info')
    })

    it('uses <figcaption> for <figure>', () => {
      expect(computeAccessibleName(
        el('<figure><img alt="Chart"><figcaption>Sales data</figcaption></figure>'),
      )).toBe('Sales data')
    })

    it('uses <caption> for <table>', () => {
      expect(computeAccessibleName(
        el('<table><caption>Q1 Results</caption><tr><td>Data</td></tr></table>'),
      )).toBe('Q1 Results')
    })
  })

  describe('name from content', () => {
    it('uses text content for buttons', () => {
      expect(computeAccessibleName(el('<button>Submit form</button>'))).toBe('Submit form')
    })

    it('uses text content for links', () => {
      expect(computeAccessibleName(el('<a href="/">Home page</a>'))).toBe('Home page')
    })

    it('uses text content for headings', () => {
      expect(computeAccessibleName(el('<h1>Welcome to Acme</h1>'))).toBe('Welcome to Acme')
    })

    it('includes alt text from images inside buttons', () => {
      expect(computeAccessibleName(
        el('<button><img alt="Save"> Save document</button>'),
      )).toBe('Save Save document')
    })

    it('handles nested elements', () => {
      expect(computeAccessibleName(
        el('<a href="/"><span>Go</span> <strong>home</strong></a>'),
      )).toBe('Go home')
    })
  })

  describe('title fallback', () => {
    it('uses title as last resort', () => {
      expect(computeAccessibleName(el('<div role="button" title="Close"></div>'))).toBe('Close')
    })

    it('prefers aria-label over title', () => {
      expect(computeAccessibleName(
        el('<button aria-label="Save" title="Save document">💾</button>'),
      )).toBe('Save')
    })
  })

  describe('placeholder fallback', () => {
    it('uses placeholder for unlabeled inputs', () => {
      expect(computeAccessibleName(el('<input type="text" placeholder="Enter name">'))).toBe('Enter name')
    })

    it('prefers label over placeholder', () => {
      const { element } = elFromDoc(`
        <div>
          <label for="name">Full name</label>
          <input id="name" placeholder="Enter name">
        </div>
      `)
      const input = element.querySelector('input')!
      expect(computeAccessibleName(input)).toBe('Full name')
    })
  })

  describe('edge cases', () => {
    it('returns empty string for elements with no name', () => {
      expect(computeAccessibleName(el('<div></div>'))).toBe('')
    })

    it('handles self-closing elements', () => {
      expect(computeAccessibleName(el('<input type="text">'))).toBe('')
    })

    it('prevents infinite recursion with self-referencing labelledby', () => {
      const btn = el('<button id="btn" aria-labelledby="btn">Click</button>')
      expect(computeAccessibleName(btn)).toBe('Click')
    })
  })
})
