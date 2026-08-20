#!/usr/bin/env node
/**
 * Minimal production server for the empathy demo / fetch tool.
 *
 * Serves the Vite-built `dist/` directory and exposes the two proxy
 * endpoints (`/api/fetch-url`, `/__proxy`) that the demo needs to
 * load remote pages with their sub-resources (images, CSS, fonts).
 *
 * Zero external dependencies — uses only Node built-ins.
 *
 * Usage:
 *   pnpm run build && node --import tsx demo/serve.ts
 *   # or after compiling:
 *   node demo/serve.js
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const DIST = join(__dirname, 'dist')
const PORT = Number(process.env.PORT) || 3000

// ── MIME types ──

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
}

// ── URL rewriting (shared with vite.config.ts — kept in sync manually) ──

function resolveUrl(raw: string, base: string): string | null {
  const t = raw.trim()
  if (
    !t ||
    t.startsWith('data:') ||
    t.startsWith('blob:') ||
    t.startsWith('#') ||
    t.startsWith('javascript:') ||
    t.startsWith('mailto:')
  )
    return null
  try {
    return new URL(t, base).href
  } catch {
    return null
  }
}

function toProxyUrl(rawUrl: string, baseUrl: string): string {
  const resolved = resolveUrl(rawUrl, baseUrl)
  if (!resolved) return rawUrl
  return `/__proxy?url=${encodeURIComponent(resolved)}`
}

const PREVIEW_VIEWPORT_H = 800

function rewriteVhUnits(text: string): string {
  return text.replace(
    /(\d+(?:\.\d+)?)\s*(vh|dvh|svh|lvh)\b/gi,
    (_m, val) => {
      const px = (parseFloat(val) / 100) * PREVIEW_VIEWPORT_H
      return `${Number.isInteger(px) ? px : px.toFixed(2)}px`
    },
  )
}

function rewriteCssUrls(css: string, cssBaseUrl: string): string {
  css = css.replace(
    /url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi,
    (_m, q, url) => `url(${q}${toProxyUrl(url, cssBaseUrl)}${q})`,
  )
  css = css.replace(
    /@import\s+(['"])([^'"]+)\1/gi,
    (_m, q, url) => `@import ${q}${toProxyUrl(url, cssBaseUrl)}${q}`,
  )
  css = rewriteVhUnits(css)
  return css
}

function rewriteHtmlUrls(html: string, pageUrl: string): string {
  html = html.replace(
    /(<(?:img|script|video|audio|source|input|embed)\b[^>]*?\b)src\s*=\s*(['"])([^'"]*)\2/gi,
    (_m, before, q, url) => `${before}src=${q}${toProxyUrl(url, pageUrl)}${q}`,
  )
  html = html.replace(
    /(<video\b[^>]*?\b)poster\s*=\s*(['"])([^'"]*)\2/gi,
    (_m, before, q, url) => `${before}poster=${q}${toProxyUrl(url, pageUrl)}${q}`,
  )
  html = html.replace(
    /(<link\b[^>]*?\b)href\s*=\s*(['"])([^'"]*)\2/gi,
    (_m, before, q, url) => `${before}href=${q}${toProxyUrl(url, pageUrl)}${q}`,
  )
  html = html.replace(
    /(<object\b[^>]*?\b)data\s*=\s*(['"])([^'"]*)\2/gi,
    (_m, before, q, url) => `${before}data=${q}${toProxyUrl(url, pageUrl)}${q}`,
  )
  html = html.replace(
    /(<(?:img|source)\b[^>]*?\b)srcset\s*=\s*(['"])([^'"]*)\2/gi,
    (_m, before, q, srcset) => {
      const rewritten = srcset
        .split(',')
        .map((entry: string) => {
          const parts = entry.trim().split(/\s+/)
          if (parts[0]) parts[0] = toProxyUrl(parts[0], pageUrl)
          return parts.join(' ')
        })
        .join(', ')
      return `${before}srcset=${q}${rewritten}${q}`
    },
  )
  html = html.replace(
    /style\s*=\s*(['"])([\s\S]*?)\1/gi,
    (_m, q, style) => {
      let rw = style.replace(
        /url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi,
        (_u: string, iq: string, url: string) =>
          `url(${iq}${toProxyUrl(url, pageUrl)}${iq})`,
      )
      rw = rewriteVhUnits(rw)
      return `style=${q}${rw}${q}`
    },
  )
  html = html.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_m, open, css, close) => `${open}${rewriteCssUrls(css, pageUrl)}${close}`,
  )
  return html
}

// ── Request handlers ──

async function handleProxy(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const params = new URL(req.url ?? '', 'http://localhost').searchParams
  const target = params.get('url')

  if (!target) {
    res.writeHead(400)
    res.end('Missing ?url= parameter')
    return
  }

  try {
    const response = await fetch(target, {
      headers: { 'User-Agent': 'VantraEmpathyDemo/1.0' },
      redirect: 'follow',
    })

    if (!response.ok) {
      res.writeHead(response.status)
      res.end(`Upstream ${response.status}`)
      return
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream'

    if (contentType.includes('text/css')) {
      const css = await response.text()
      const rewritten = rewriteCssUrls(css, response.url || target)
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
      })
      res.end(rewritten)
      return
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    })
    res.end(buffer)
  } catch (err) {
    res.writeHead(502)
    res.end((err as Error).message)
  }
}

async function handleFetchUrl(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const params = new URL(req.url ?? '', 'http://localhost').searchParams
  const target = params.get('url')

  if (!target) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Missing ?url= parameter' }))
    return
  }

  try {
    const response = await fetch(target, {
      headers: { 'User-Agent': 'VantraEmpathyDemo/1.0' },
      redirect: 'follow',
    })

    if (!response.ok) {
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: `Upstream returned ${response.status}` }))
      return
    }

    const rawHtml = await response.text()
    const finalUrl = response.url || target
    const html = rewriteHtmlUrls(rawHtml, finalUrl)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ html, url: finalUrl }))
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: (err as Error).message }))
  }
}

async function handleStatic(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let pathname = new URL(req.url ?? '/', 'http://localhost').pathname
  if (pathname === '/') pathname = '/index.html'

  const filePath = join(DIST, pathname)

  // Basic path traversal guard
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  try {
    const info = await stat(filePath)
    if (!info.isFile()) throw new Error('Not a file')

    const content = await readFile(filePath)
    const ext = extname(filePath)
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    })
    res.end(content)
  } catch {
    // SPA fallback
    try {
      const index = await readFile(join(DIST, 'index.html'))
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(index)
    } catch {
      res.writeHead(404)
      res.end('Not found')
    }
  }
}

// ── Server ──

const server = createServer(async (req, res) => {
  const url = req.url ?? '/'

  if (url.startsWith('/__proxy')) {
    await handleProxy(req, res)
  } else if (url.startsWith('/api/fetch-url')) {
    await handleFetchUrl(req, res)
  } else {
    await handleStatic(req, res)
  }
})

server.listen(PORT, () => {
  console.warn(`Empathy fetch tool running at http://localhost:${PORT}`)
})
