/**
 * Speech text formatting.
 *
 * Converts traversal entries into spoken text that simulates
 * screen reader announcement patterns (modeled after VoiceOver).
 *
 * Lives in core (not browser) because it is pure string logic
 * with no DOM or audio dependencies — reusable by the demo,
 * the browser extension, and any headless consumer.
 */

import type { TraversalEntry } from './types.js'

const ROLE_LABELS: Record<string, string> = {
  button: 'button',
  link: 'link',
  checkbox: 'checkbox',
  radio: 'radio button',
  tab: 'tab',
  switch: 'switch',
  textbox: 'edit text',
  listbox: 'pop-up button',
  slider: 'slider',
  searchbox: 'search text field',
  spinbutton: 'stepper',
  navigation: 'navigation',
  main: 'main',
  banner: 'banner',
  contentinfo: 'content info',
  complementary: 'complementary',
  form: 'form',
  search: 'search',
  region: 'region',
}

/** Roles where the role label is announced after the accessible name. */
const ROLE_AFTER = new Set([
  'button', 'link', 'checkbox', 'radio', 'tab', 'switch',
])

/** Form control roles announced as "Name, role." */
const FORM_CONTROLS = new Set([
  'textbox', 'listbox', 'slider', 'searchbox', 'spinbutton',
])

/**
 * Human-friendly label for a role.
 *
 * Exported so consumers that build their own UI can reuse the
 * same vocabulary without duplicating the map.
 */
export function formatRole(role: string): string {
  return ROLE_LABELS[role] ?? role
}

/**
 * Format a traversal entry as spoken text, simulating
 * screen reader announcement patterns (modeled after VoiceOver).
 *
 * Returns an empty string for decorative elements that a screen
 * reader would skip silently.
 */
export function formatEntryForSpeech(entry: TraversalEntry): string {
  const { role, accessibleName, level, isLandmark } = entry

  // Image: check flags to distinguish missing alt from decorative
  if (role === 'image') {
    const hasMissingAlt = entry.flags.some(f => f.code === 'missing-alt-text')
    if (hasMissingAlt) {
      return 'Image.'
    }
    if (!accessibleName) {
      // Decorative image (alt="")
      return ''
    }
    return `${accessibleName}, image.`
  }

  // Landmark entry
  if (isLandmark) {
    const landmarkName = accessibleName ? `${accessibleName}, ` : ''
    const landmarkRole = formatRole(role)
    return `${landmarkName}${landmarkRole} landmark.`
  }

  // Heading
  if (role === 'heading') {
    const headingLevel = level ? `Heading level ${level}` : 'Heading'
    return accessibleName ? `${headingLevel}, ${accessibleName}.` : `${headingLevel}.`
  }

  // Elements where role is announced after name
  if (ROLE_AFTER.has(role)) {
    const displayRole = formatRole(role)
    return accessibleName ? `${accessibleName}, ${displayRole}.` : `${displayRole}.`
  }

  // Form controls
  if (FORM_CONTROLS.has(role)) {
    const displayRole = formatRole(role)
    return accessibleName ? `${accessibleName}, ${displayRole}.` : `${displayRole}.`
  }

  // Separator
  if (role === 'separator') {
    return 'Separator.'
  }

  // Table
  if (role === 'table') {
    return accessibleName ? `${accessibleName}, table.` : 'Table.'
  }

  // List
  if (role === 'list') {
    return accessibleName ? `${accessibleName}, list.` : 'List.'
  }

  // List item
  if (role === 'listitem') {
    return accessibleName || 'List item.'
  }

  // Generic or text
  if (accessibleName) {
    return accessibleName
  }

  return ''
}
