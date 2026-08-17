import { describe, it, expect } from 'vitest'
import { formatEntryForSpeech } from '../src/browser/playback.js'
import type { TraversalEntry } from '../src/core/types.js'

function entry(overrides: Partial<TraversalEntry> = {}): TraversalEntry {
  return {
    index: 0,
    accessibleName: '',
    role: 'generic',
    selector: 'body > div',
    htmlSnippet: '<div></div>',
    isLandmark: false,
    flags: [],
    ...overrides,
  }
}

describe('formatEntryForSpeech', () => {
  it('formats heading with level and name', () => {
    expect(formatEntryForSpeech(entry({
      role: 'heading',
      level: 1,
      accessibleName: 'Welcome',
    }))).toBe('Heading level 1, Welcome.')
  })

  it('formats heading without name', () => {
    expect(formatEntryForSpeech(entry({
      role: 'heading',
      level: 2,
      accessibleName: '',
    }))).toBe('Heading level 2.')
  })

  it('formats button with name', () => {
    expect(formatEntryForSpeech(entry({
      role: 'button',
      accessibleName: 'Submit',
    }))).toBe('Submit, button.')
  })

  it('formats button without name', () => {
    expect(formatEntryForSpeech(entry({
      role: 'button',
      accessibleName: '',
    }))).toBe('button.')
  })

  it('formats link with name', () => {
    expect(formatEntryForSpeech(entry({
      role: 'link',
      accessibleName: 'Read more',
    }))).toBe('Read more, link.')
  })

  it('formats landmark with name', () => {
    expect(formatEntryForSpeech(entry({
      role: 'navigation',
      accessibleName: 'Main',
      isLandmark: true,
    }))).toBe('Main, navigation landmark.')
  })

  it('formats landmark without name', () => {
    expect(formatEntryForSpeech(entry({
      role: 'main',
      isLandmark: true,
    }))).toBe('main landmark.')
  })

  it('returns empty string for decorative image', () => {
    expect(formatEntryForSpeech(entry({
      role: 'image',
      accessibleName: '',
    }))).toBe('')
  })

  it('formats image without alt as "Image."', () => {
    expect(formatEntryForSpeech(entry({
      role: 'image',
      flags: [{ code: 'missing-alt-text', severity: 'critical', message: 'Image has no alt attribute.' }],
    }))).toBe('Image.')
  })

  it('formats separator', () => {
    expect(formatEntryForSpeech(entry({
      role: 'separator',
    }))).toBe('Separator.')
  })

  it('formats textbox', () => {
    expect(formatEntryForSpeech(entry({
      role: 'textbox',
      accessibleName: 'Email',
    }))).toBe('Email, edit text.')
  })

  it('formats table with name', () => {
    expect(formatEntryForSpeech(entry({
      role: 'table',
      accessibleName: 'Q1 Results',
    }))).toBe('Q1 Results, table.')
  })

  it('formats list item with name', () => {
    expect(formatEntryForSpeech(entry({
      role: 'listitem',
      accessibleName: 'Item one',
    }))).toBe('Item one')
  })

  it('returns name for generic text', () => {
    expect(formatEntryForSpeech(entry({
      role: 'generic',
      accessibleName: 'Some content',
    }))).toBe('Some content')
  })

  it('returns empty string for unnamed generic element', () => {
    expect(formatEntryForSpeech(entry({
      role: 'generic',
      accessibleName: '',
    }))).toBe('')
  })
})
