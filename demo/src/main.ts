import {
  analyzeAccessibilityFlow,
  formatEntryForSpeech,
  formatRole,
  getStructureReport,
} from '@vantra-design/screenreader-empathy/core'
import type {
  HeadingNode,
  StructureReport,
  TraversalResult,
} from '@vantra-design/screenreader-empathy/core'
import './style.css'

// ── Sample HTML ──

const SAMPLE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>My Portfolio</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  <header>
    <nav aria-label="Main">
      <a href="/">Home</a>
      <a href="/work">Work</a>
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
    </nav>
  </header>

  <main>
    <h1>Welcome to my portfolio</h1>
    <p>I'm a designer who cares about accessibility.</p>

    <h2>Recent work</h2>
    <div>
      <a href="/project-alpha"><img src="alpha.jpg"></a>
      <a href="/project-alpha">Project Alpha</a>
    </div>
    <div>
      <a href="/project-beta"><img src="beta.jpg" alt="Beta project screenshot"></a>
      <a href="/project-beta">Project Beta</a>
    </div>

    <h2>Testimonials</h2>
    <blockquote>"Great work!" — Client A</blockquote>
    <blockquote>"Fantastic results." — Client B</blockquote>

    <h2>Get in touch</h2>
    <form>
      <label for="name">Name</label>
      <input type="text" id="name">
      <label for="email">Email</label>
      <input type="email" id="email">
      <textarea placeholder="Your message"></textarea>
    </form>
  </main>

  <footer>
    <p>&copy; 2026 My Portfolio</p>
    <a href="#">click here</a> for more info.
  </footer>
</body>
</html>`

// ── App ──

const app = document.getElementById('app')!

app.innerHTML = `
  <div class="app">
    <header class="app-header">
      <h1>Screenreader Empathy — Demo</h1>
      <p>Paste HTML or enter a URL to see the reading order, structure report, and flagged issues.</p>
    </header>

    <div class="input-panel">
      <label for="url-input">Fetch from URL</label>
      <div class="url-row">
        <input id="url-input" class="url-input" type="url" placeholder="https://example.com" />
        <button id="btn-fetch" class="btn btn-secondary">Fetch</button>
      </div>
      <div id="fetch-status" class="fetch-status"></div>

      <label for="html-input">HTML Input</label>
      <textarea id="html-input" class="html-input" spellcheck="false"></textarea>
      <div class="actions">
        <button id="btn-analyze" class="btn btn-primary">Analyze</button>
        <button id="btn-sample" class="btn btn-secondary">Load Sample</button>
      </div>
    </div>

    <div id="results" class="empty-state">
      <p><strong>No results yet.</strong></p>
      <p>Paste some HTML and click Analyze, or load the sample.</p>
    </div>
  </div>
`

const textarea = document.getElementById('html-input') as HTMLTextAreaElement
const urlInput = document.getElementById('url-input') as HTMLInputElement
const btnFetch = document.getElementById('btn-fetch') as HTMLButtonElement
const btnAnalyze = document.getElementById('btn-analyze') as HTMLButtonElement
const btnSample = document.getElementById('btn-sample') as HTMLButtonElement
const fetchStatus = document.getElementById('fetch-status')!
const resultsContainer = document.getElementById('results')!


// Load sample on click
btnSample.addEventListener('click', () => {
  textarea.value = SAMPLE_HTML
})

// Fetch URL
btnFetch.addEventListener('click', async () => {
  const url = urlInput.value.trim()
  if (!url) return

  btnFetch.disabled = true
  fetchStatus.textContent = 'Fetching…'
  fetchStatus.className = 'fetch-status'

  try {
    const res = await fetch(`/api/fetch-url?url=${encodeURIComponent(url)}`)
    const data = await res.json()

    if (!res.ok || data.error) {
      fetchStatus.textContent = `Error: ${data.error}`
      fetchStatus.className = 'fetch-status fetch-error'
      return
    }

    textarea.value = data.html
    fetchStatus.textContent = `Fetched ${data.html.length.toLocaleString()} chars — click Analyze`
    fetchStatus.className = 'fetch-status fetch-ok'
  } catch (err) {
    fetchStatus.textContent = `Fetch failed: ${(err as Error).message}`
    fetchStatus.className = 'fetch-status fetch-error'
  } finally {
    btnFetch.disabled = false
  }
})

// Analyze
btnAnalyze.addEventListener('click', () => {
  const html = textarea.value.trim()
  if (!html) return

  try {
    const result = analyzeAccessibilityFlow(html)
    const report = getStructureReport(result)
    renderResults(result, report)
  } catch (err) {
    resultsContainer.innerHTML = `<div class="panel panel-full"><p style="color:var(--color-fail)">Error: ${(err as Error).message}</p></div>`
  }
})

// ── Render ──

function renderResults(result: TraversalResult, report: StructureReport) {
  const scoreColor = report.score >= 70 ? 'var(--color-pass)' : report.score >= 50 ? 'var(--color-ink-muted)' : 'var(--color-fail)'

  resultsContainer.className = 'dashboard'
  resultsContainer.innerHTML = `
    <!-- Score bar -->
    <div class="score-strip">
      <div class="score-strip-left">
        <span class="score-number" style="color:${scoreColor}">${report.score}</span>
        <span class="band-badge band-${report.band}">${report.band}</span>
      </div>
      <div class="score-bar-wrap">
        <div class="score-bar">
          <div class="score-bar-fill" style="width:${report.score}%;background:${scoreColor}"></div>
        </div>
      </div>
      <div class="stats">
        <span><span class="stat-value">${result.entries.length}</span> elements</span>
        <span><span class="stat-value">${report.landmarks.length}</span> landmarks</span>
        <span><span class="stat-value">${report.elementsBeforeMain}</span> before main</span>
        <span><span class="stat-value">${report.orphanedContentPercent}%</span> orphaned</span>
        <span><span class="stat-value">${report.issues.length}</span> issue${report.issues.length !== 1 ? 's' : ''}</span>
      </div>
      <button id="btn-export" class="btn btn-secondary btn-sm" title="Copy report as Markdown">Export ↓</button>
    </div>

    <!-- Page preview -->
    <div class="panel preview-panel">
      <div class="panel-header">
        <h2>Page Preview</h2>
        <div class="preview-legend">
          <span class="legend-item"><span class="legend-dot legend-landmark"></span> Landmark</span>
          <span class="legend-item"><span class="legend-dot legend-heading"></span> Heading</span>
          <span class="legend-item"><span class="legend-dot legend-flag"></span> Issue</span>
        </div>
      </div>
      <div class="preview-container">
        <iframe id="preview-iframe" title="Page preview"></iframe>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tab-bar">
      <button class="tab-btn active" data-tab="ia">IA &amp; Structure</button>
      <button class="tab-btn" data-tab="sr">Screen Reader Audit</button>
    </div>

    <!-- IA & Structure tab -->
    <div class="tab-content tab-ia active" id="tab-ia">
      <!-- Narrative -->
      <div class="panel narrative-panel">
        <div class="panel-header"><h2>Summary</h2></div>
        <div class="narrative">${buildNarrative(result, report)}</div>
      </div>

      <!-- Two-column: Issues + Structure -->
      <div class="dashboard-row">
        <div class="panel panel-issues">
          <div class="panel-header"><h2>Issues &amp; Fixes</h2></div>
          ${report.issues.length === 0
            ? '<p style="color:var(--color-ink-muted)">No issues found.</p>'
            : `<ul class="issue-list">${report.issues.map(renderIssue).join('')}</ul>`
          }
        </div>
        <div class="structure-sidebar">
          <div class="panel">
            <div class="panel-header"><h2>Heading Outline</h2></div>
            ${report.headingTree.length === 0
              ? '<p style="color:var(--color-ink-muted)">No headings found.</p>'
              : `<ul class="heading-tree">${report.headingTree.map(renderHeadingNode).join('')}</ul>`
            }
          </div>
          <div class="panel">
            <div class="panel-header"><h2>Landmarks</h2></div>
            ${report.landmarks.length === 0
              ? '<p style="color:var(--color-ink-muted)">No landmarks found.</p>'
              : `<ul class="landmark-list">${report.landmarks.map((l: StructureReport['landmarks'][number]) => `
                  <li class="landmark-item">
                    <span class="landmark-role">${l.role}</span>
                    <span class="landmark-label">${l.label || '(no label)'}</span>
                  </li>
                `).join('')}</ul>`
            }
          </div>
        </div>
      </div>
    </div>

    <!-- Screen Reader Audit tab -->
    <div class="tab-content tab-sr" id="tab-sr">
      <div class="panel">
        <div class="panel-header">
          <h2>Reading Order</h2>
          <span style="font-size:0.8125rem;color:var(--color-ink-muted)">${result.entries.length} entries</span>
        </div>
        ${renderGroupedReadingOrder(result, report)}
      </div>
    </div>
  `

  // Wire tabs
  const tabBtns = resultsContainer.querySelectorAll('.tab-btn')
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = (btn as HTMLElement).dataset.tab
      tabBtns.forEach((b) => b.classList.remove('active'))
      btn.classList.add('active')
      resultsContainer.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'))
      document.getElementById(`tab-${tab}`)?.classList.add('active')
    })
  })

  // Wire export
  const btnExport = document.getElementById('btn-export')
  btnExport?.addEventListener('click', () => {
    const md = exportMarkdown(result, report)
    navigator.clipboard.writeText(md).then(() => {
      btnExport.textContent = 'Copied!'
      setTimeout(() => { btnExport.textContent = 'Export ↓' }, 2000)
    })
  })

  // Inject HTML into preview iframe and draw overlays
  // Resource URLs are already rewritten server-side to go through /__proxy,
  // so no <base> tag is needed.
  const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement
  if (iframe) {
    const html = textarea.value

    // Write HTML directly into iframe document
    const doc = iframe.contentDocument
    if (doc) {
      doc.open()
      doc.write(html)
      doc.close()

      // Fix: keep the iframe at a fixed viewport height while we
      // wait for resources (images, fonts) to finish loading.
      // Only resize ONCE at the end.  This prevents a feedback loop
      // where elements with height:100vh grow the iframe, which
      // re-resolves vh, which grows the iframe again — runaway to
      // 85 000+ px.
      const VIEWPORT_H = 800
      const MAX_HEIGHT = VIEWPORT_H * 10
      iframe.style.height = `${VIEWPORT_H}px`

      let lastHeight = 0
      let stableCount = 0

      const finalise = () => {
        const body = doc.body
        const docEl = doc.documentElement
        const measured = body && docEl
          ? Math.max(body.scrollHeight, docEl.scrollHeight)
          : VIEWPORT_H
        const finalHeight = Math.min(Math.max(measured, VIEWPORT_H), MAX_HEIGHT)
        iframe.style.height = `${finalHeight}px`
        // Reflow at the final height, then draw overlays once
        requestAnimationFrame(() => drawOverlays(iframe, result, report))
      }

      // Poll scrollHeight at the FIXED viewport size (no iframe resize
      // during polling → vh stays stable → no feedback loop).
      const resizeInterval = setInterval(() => {
        const body = doc.body
        const docEl = doc.documentElement
        if (!body || !docEl) return

        const contentHeight = Math.max(body.scrollHeight, docEl.scrollHeight)

        if (contentHeight === lastHeight) {
          stableCount++
        } else {
          stableCount = 0
          lastHeight = contentHeight
        }

        // Resources settled — set final height once and stop
        if (stableCount >= 5) {
          clearInterval(resizeInterval)
          finalise()
        }
      }, 300)

      // Safety: stop polling after 8s regardless
      setTimeout(() => {
        clearInterval(resizeInterval)
        finalise()
      }, 8000)
    }
  }
}

// ── Narrative builder ──

function buildNarrative(result: TraversalResult, report: StructureReport): string {
  const lines: string[] = []

  // Opening
  if (report.score >= 70) {
    lines.push(`This page has a <strong>solid</strong> information architecture. A screen reader user can navigate it effectively.`)
  } else if (report.score >= 50) {
    lines.push(`This page has a <strong>basic</strong> structure, but several issues make it harder for assistive technology users to navigate.`)
  } else if (report.score >= 25) {
    lines.push(`This page has <strong>significant structural problems</strong> that make it difficult for screen reader users to understand and navigate.`)
  } else {
    lines.push(`This page has <strong>very little accessible structure</strong>. A screen reader user would struggle to make sense of it.`)
  }

  // Elements before main
  if (report.elementsBeforeMain > 10) {
    lines.push(`A user encounters <strong>${report.elementsBeforeMain} elements</strong> before reaching the main content.${report.issues.some(i => i.code === 'no-skip-link') ? ' There is no skip link, so keyboard users must tab through all of them.' : ''}`)
  }

  // Landmarks
  if (report.landmarks.length === 0) {
    lines.push(`The page has <strong>no landmark regions</strong>. Screen readers use landmarks (header, nav, main, footer) as a table of contents — without them, users must read linearly.`)
  } else {
    const unlabeled = report.landmarks.filter(l => !l.label)
    const dupes = report.issues.find(i => i.code === 'duplicate-landmark-no-label')
    if (dupes) {
      lines.push(`There are <strong>${dupes.count} landmark regions with the same role but no label</strong>. Screen reader users can't tell them apart.`)
    } else if (unlabeled.length > 0 && report.landmarks.length > 3) {
      lines.push(`${unlabeled.length} of ${report.landmarks.length} landmarks have no label. Adding aria-label helps screen reader users distinguish them.`)
    }
  }

  // Headings
  if (report.headingTree.length === 0) {
    lines.push(`The page has <strong>no headings</strong>. Headings are the primary way screen reader users scan page content.`)
  } else {
    const hasSkip = report.issues.some(i => i.code === 'heading-level-skip')
    if (hasSkip) {
      lines.push(`The heading outline has <strong>level skips</strong> (e.g. jumping from h1 to h3). This breaks the logical document structure.`)
    }
  }

  // Orphaned content
  if (report.orphanedContentPercent > 15) {
    lines.push(`<strong>${report.orphanedContentPercent}%</strong> of page content sits outside any landmark region. Content outside landmarks is harder for screen reader users to find.`)
  }

  // Critical/serious count
  const critical = report.issues.filter(i => i.severity === 'critical')
  const serious = report.issues.filter(i => i.severity === 'serious')
  if (critical.length > 0 || serious.length > 0) {
    const parts: string[] = []
    if (critical.length > 0) parts.push(`${critical.length} critical`)
    if (serious.length > 0) parts.push(`${serious.length} serious`)
    lines.push(`There are <strong>${parts.join(' and ')}</strong> issues that should be fixed before shipping.`)
  }

  return lines.map(l => `<p>${l}</p>`).join('')
}

// ── Grouped reading order ──

interface ReadingGroup {
  label: string
  role: string
  entries: TraversalResult['entries']
}

function groupEntriesByLandmark(
  result: TraversalResult,
  report: StructureReport,
): ReadingGroup[] {
  const groups: ReadingGroup[] = []
  let currentGroup: ReadingGroup = { label: 'Before landmarks', role: '', entries: [] }
  groups.push(currentGroup)

  // Build a set of landmark selectors for quick matching
  const landmarkSelectors = report.landmarks.map(l => l.selector)
  const landmarkMap = new Map(report.landmarks.map(l => [l.selector, l]))

  for (const entry of result.entries) {
    // Check if this entry IS a landmark start
    const lm = landmarkMap.get(entry.selector)
    if (lm) {
      currentGroup = {
        label: lm.label || lm.role,
        role: lm.role,
        entries: [],
      }
      groups.push(currentGroup)
      currentGroup.entries.push(entry)
      continue
    }

    // Check if this entry's selector starts with a landmark selector (nested inside it)
    let matched = false
    for (let i = landmarkSelectors.length - 1; i >= 0; i--) {
      if (entry.selector.startsWith(landmarkSelectors[i])) {
        // Find or use the last group with that landmark
        const lastMatchGroup = groups.filter(g => g.role === landmarkMap.get(landmarkSelectors[i])?.role)
        if (lastMatchGroup.length > 0) {
          lastMatchGroup[lastMatchGroup.length - 1].entries.push(entry)
          matched = true
          break
        }
      }
    }
    if (!matched) {
      currentGroup.entries.push(entry)
    }
  }

  return groups.filter(g => g.entries.length > 0)
}

function renderGroupedReadingOrder(result: TraversalResult, report: StructureReport): string {
  const groups = groupEntriesByLandmark(result, report)

  return groups.map(group => `
    <details class="reading-group" open>
      <summary class="reading-group-header">
        <span class="reading-group-label">${group.role ? `<span class="landmark-role">${group.role}</span> ` : ''}${escapeHtml(group.label)}</span>
        <span class="reading-group-count">${group.entries.length} entries</span>
      </summary>
      <div class="reading-header">
        <span class="rh-index">#</span>
        <span class="rh-role">Role</span>
        <span class="rh-name">Name</span>
        <span class="rh-announcement">Screen reader hears</span>
        <span class="rh-flags"></span>
      </div>
      <ol class="reading-order">
        ${group.entries.map(renderEntry).join('')}
      </ol>
    </details>
  `).join('')
}

// ── Export as Markdown ──

function exportMarkdown(result: TraversalResult, report: StructureReport): string {
  const lines: string[] = []
  lines.push(`# Accessibility Report`)
  lines.push(``)
  lines.push(`**Score:** ${report.score}/100 (${report.band})`)
  lines.push(`**Elements:** ${result.entries.length} | **Landmarks:** ${report.landmarks.length} | **Before main:** ${report.elementsBeforeMain} | **Orphaned:** ${report.orphanedContentPercent}%`)
  lines.push(``)

  if (report.issues.length > 0) {
    lines.push(`## Issues`)
    lines.push(``)
    for (const issue of report.issues) {
      const fix = FIX_SUGGESTIONS[issue.code]
      lines.push(`- **[${issue.severity}]** ${issue.message}${issue.count > 1 ? ` (×${issue.count})` : ''}`)
      if (fix) lines.push(`  - → ${fix}`)
    }
    lines.push(``)
  }

  if (report.headingTree.length > 0) {
    lines.push(`## Heading Outline`)
    lines.push(``)
    const flattenHeadings = (nodes: HeadingNode[], indent = 0): void => {
      for (const n of nodes) {
        lines.push(`${'  '.repeat(indent)}- h${n.level}: ${n.name || '(empty)'}`)
        flattenHeadings(n.children, indent + 1)
      }
    }
    flattenHeadings(report.headingTree)
    lines.push(``)
  }

  if (report.landmarks.length > 0) {
    lines.push(`## Landmarks`)
    lines.push(``)
    for (const l of report.landmarks) {
      lines.push(`- **${l.role}**${l.label ? `: ${l.label}` : ''}`)
    }
    lines.push(``)
  }

  lines.push(`---`)
  lines.push(`*Generated by Vantra Screenreader Empathy*`)

  return lines.join('\n')
}

function drawOverlays(
  iframe: HTMLIFrameElement,
  result: TraversalResult,
  report: StructureReport,
): void {
  const doc = iframe.contentDocument
  if (!doc) return

  const container = iframe.parentElement
  if (!container) return

  // Remove old overlays
  container.querySelectorAll('.overlay-marker').forEach((el: Element) => el.remove())

  const iframeRect = iframe.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()

  // Landmark overlays
  for (const lm of report.landmarks) {
    try {
      const el = doc.querySelector(lm.selector)
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) continue

      const marker = document.createElement('div')
      marker.className = 'overlay-marker overlay-landmark'
      marker.textContent = lm.label ? `${lm.role}: ${lm.label}` : lm.role
      marker.style.top = `${rect.top + (iframeRect.top - containerRect.top)}px`
      marker.style.left = `${rect.left + (iframeRect.left - containerRect.left)}px`
      container.appendChild(marker)
    } catch { /* selector may not match */ }
  }

  // Heading overlays
  for (const entry of result.entries) {
    if (entry.role !== 'heading') continue
    try {
      const el = doc.querySelector(entry.selector)
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) continue

      const marker = document.createElement('div')
      marker.className = 'overlay-marker overlay-heading'
      marker.textContent = `h${entry.level ?? '?'}`
      marker.style.top = `${rect.top + (iframeRect.top - containerRect.top)}px`
      marker.style.right = `${containerRect.right - (rect.right + (iframeRect.left - containerRect.left))}px`
      marker.style.left = 'auto'
      container.appendChild(marker)
    } catch { /* selector may not match */ }
  }

  // Flag overlays (only for entries with flags and a visible element)
  for (const entry of result.entries) {
    if (entry.flags.length === 0) continue
    try {
      const el = doc.querySelector(entry.selector)
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) continue

      const marker = document.createElement('div')
      marker.className = 'overlay-marker overlay-flag'
      marker.textContent = entry.flags.length > 1 ? `${entry.flags.length} issues` : entry.flags[0].code
      marker.title = entry.flags.map((f: TraversalResult['entries'][number]['flags'][number]) => f.message).join('\n')
      marker.style.top = `${rect.bottom + (iframeRect.top - containerRect.top) - 4}px`
      marker.style.left = `${rect.left + (iframeRect.left - containerRect.left)}px`
      container.appendChild(marker)
    } catch { /* selector may not match */ }
  }
}

const FIX_SUGGESTIONS: Record<string, string> = {
  'missing-accessible-name': 'Add an aria-label or aria-labelledby attribute to give this element a name.',
  'empty-link-text': 'Add visible text inside the <a> tag, or add an aria-label attribute.',
  'empty-button-text': 'Add visible text or an aria-label to the <button>.',
  'missing-form-label': 'Add a <label for="id"> element or an aria-label to the form control.',
  'heading-level-skip': 'Don\u2019t skip heading levels. Use h1 \u2192 h2 \u2192 h3 in order.',
  'missing-landmark': 'Wrap page sections in <header>, <nav>, <main>, <footer> elements.',
  'duplicate-id': 'Ensure every id attribute is unique on the page.',
  'redundant-role': 'Remove the role attribute \u2014 this element already has that role implicitly.',
  'missing-alt-text': 'Add alt="description" to the <img> tag. Use alt="" if decorative.',
  'generic-link-text': 'Replace "click here" / "read more" with descriptive link text.',
  'no-lang-attribute': 'Add lang="en" (or appropriate language) to the <html> element.',
  'tabindex-positive': 'Remove positive tabindex values. Use tabindex="0" or "-1" instead.',
  'no-h1': 'Add exactly one <h1> heading as the main page title.',
  'multiple-h1': 'Use only one <h1> per page. Demote others to <h2>.',
  'no-nav-landmark': 'Wrap your navigation links in a <nav> element.',
  'duplicate-landmark-no-label': 'Add aria-label to distinguish duplicate landmark roles.',
  'orphaned-content': 'Move this content inside a landmark region (<main>, <aside>, etc.).',
  'no-skip-link': 'Add a skip link at the top: <a href="#main">Skip to content</a>.',
  'landmark-nesting-violation': 'Don\u2019t nest landmarks inside each other (e.g. <main> inside <main>).',
  'content-before-main': 'Minimize content before <main>. Use a skip link so users can jump past it.',
  'flat-structure': 'Break content into sections with headings to create a navigable outline.',
  'wall-of-text': 'Break long text blocks into shorter paragraphs with subheadings.',
  'identical-links-different-href': 'Give each link unique text, or merge duplicates into one.',
  'adjacent-duplicate-links': 'Combine adjacent links that go to the same place into one link.',
  'table-no-headers': 'Add <th> elements to identify column/row headers in the table.',
  'table-no-caption': 'Add a <caption> element to describe the table\u2019s purpose.',
  'fieldset-no-legend': 'Add a <legend> inside <fieldset> to label the group.',
  'form-no-submit': 'Add a <button type="submit"> or <input type="submit"> to the form.',
  'no-title': 'Add a <title> element inside <head> with a descriptive page title.',
  'viewport-no-zoom': 'Remove maximum-scale or user-scalable=no from the viewport meta tag.',
}

function renderIssue(issue: StructureReport['issues'][number]): string {
  const fix = FIX_SUGGESTIONS[issue.code]
  return `
    <li class="issue-item">
      <span class="severity-badge severity-${issue.severity}">${issue.severity}</span>
      <div class="issue-body">
        <div>${escapeHtml(issue.message)}</div>
        ${fix ? `<div class="issue-fix">\u2192 ${escapeHtml(fix)}</div>` : ''}
        <div class="issue-code">${issue.code}</div>
      </div>
      ${issue.count > 1 ? `<span class="issue-count">\u00d7${issue.count}</span>` : ''}
    </li>
  `
}

function renderHeadingNode(node: HeadingNode): string {
  const children = node.children.length > 0
    ? `<ul>${node.children.map(renderHeadingNode).join('')}</ul>`
    : ''
  return `
    <li>
      <span class="heading-level">h${node.level}</span>
      ${escapeHtml(node.name || '(empty)')}
      ${children}
    </li>
  `
}

// ── Announcement formatting (shared from core/speech.ts) ──

/** Roles where the display shows the role label instead of "missing name". */
const STRUCTURAL_ROLES = new Set([
  'navigation', 'main', 'banner', 'contentinfo', 'complementary',
  'form', 'search', 'region', 'list', 'table', 'group', 'separator',
  'row', 'cell', 'generic',
])

/** Roles announced after the name (used for display classification). */
const INTERACTIVE_ROLES = new Set([
  'button', 'link', 'checkbox', 'radio', 'tab', 'switch',
  'textbox', 'listbox', 'slider', 'searchbox', 'spinbutton',
])

function nameDisplay(entry: TraversalResult['entries'][number]): string {
  if (entry.accessibleName) return escapeHtml(entry.accessibleName)
  if (STRUCTURAL_ROLES.has(entry.role) || entry.isLandmark) {
    return `<span class="name-structural">${escapeHtml(formatRole(entry.role))}</span>`
  }
  if (INTERACTIVE_ROLES.has(entry.role)) {
    return '<span class="name-missing">missing name</span>'
  }
  return '<span class="name-empty">—</span>'
}

function renderEntry(entry: TraversalResult['entries'][number]): string {
  const hasFlags = entry.flags.length > 0
  const announcement = formatEntryForSpeech(entry)
  return `
    <li class="reading-entry ${hasFlags ? 'has-flag' : ''}">
      <span class="reading-index">${entry.index}</span>
      <span class="reading-role">${entry.role}${entry.level ? ` (${entry.level})` : ''}</span>
      <span class="reading-name">${nameDisplay(entry)}</span>
      <span class="reading-announcement">${announcement ? escapeHtml(announcement) : ''}</span>
      <span class="reading-flags">
        ${entry.flags.map((f: TraversalResult['entries'][number]['flags'][number]) => `<span class="flag-dot" title="${escapeHtml(f.code + ': ' + f.message)}"></span>`).join('')}
      </span>
    </li>
  `
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
