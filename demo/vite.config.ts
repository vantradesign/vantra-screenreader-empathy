import { defineConfig, type Plugin } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// ── URL rewriting helpers ──

/** Return null for URLs that must not be proxied (data:, blob:, fragments …). */
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

/** Rewrite a single URL to go through the dev-server proxy. */
function toProxyUrl(rawUrl: string, baseUrl: string): string {
  const resolved = resolveUrl(rawUrl, baseUrl)
  if (!resolved) return rawUrl
  return `/__proxy?url=${encodeURIComponent(resolved)}`
}

/**
 * Replace viewport-height units (vh, dvh, svh, lvh) with fixed pixel
 * equivalents so that 100vh always resolves to the simulated viewport
 * height inside the preview iframe — not to the iframe's actual
 * (auto-sized) height.
 */
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

/** Rewrite `url()`, `@import` and viewport-height units inside CSS. */
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

/** Rewrite resource URLs in HTML so every sub-resource loads through /__proxy. */
function rewriteHtmlUrls(html: string, pageUrl: string): string {
  // <img|script|video|audio|source|input|embed  src="…">
  html = html.replace(
    /(<(?:img|script|video|audio|source|input|embed)\b[^>]*?\b)src\s*=\s*(['"])([^'"]*)\2/gi,
    (_m, before, q, url) => `${before}src=${q}${toProxyUrl(url, pageUrl)}${q}`,
  )

  // <video poster="…">
  html = html.replace(
    /(<video\b[^>]*?\b)poster\s*=\s*(['"])([^'"]*)\2/gi,
    (_m, before, q, url) => `${before}poster=${q}${toProxyUrl(url, pageUrl)}${q}`,
  )

  // <link href="…"> (stylesheets, favicons — NOT <a> tags)
  html = html.replace(
    /(<link\b[^>]*?\b)href\s*=\s*(['"])([^'"]*)\2/gi,
    (_m, before, q, url) => `${before}href=${q}${toProxyUrl(url, pageUrl)}${q}`,
  )

  // <object data="…">
  html = html.replace(
    /(<object\b[^>]*?\b)data\s*=\s*(['"])([^'"]*)\2/gi,
    (_m, before, q, url) => `${before}data=${q}${toProxyUrl(url, pageUrl)}${q}`,
  )

  // srcset (img, source) — comma-separated, each entry is "url [descriptor]"
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

  // Inline style="… url(…) …" + vh units
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

  // <style> blocks
  html = html.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_m, open, css, close) => `${open}${rewriteCssUrls(css, pageUrl)}${close}`,
  )

  return html
}

// ── Vite plugin ──

/**
 * Dev-only plugin: proxies external URL fetches AND their sub-resources
 * server-side so the preview iframe can render pages with full styling,
 * images and fonts — no CORS issues.
 */
function fetchProxyPlugin(): Plugin {
  return {
    name: 'fetch-proxy',
    configureServer(server) {
      // Generic sub-resource proxy: /__proxy?url=<encoded-url>
      server.middlewares.use('/__proxy', async (req, res) => {
        const params = new URL(req.url ?? '', 'http://localhost').searchParams
        const target = params.get('url')

        if (!target) {
          res.statusCode = 400
          res.end('Missing ?url= parameter')
          return
        }

        try {
          const response = await fetch(target, {
            headers: { 'User-Agent': 'VantraEmpathyDemo/1.0' },
            redirect: 'follow',
          })

          if (!response.ok) {
            res.statusCode = response.status
            res.end(`Upstream ${response.status}`)
            return
          }

          const contentType =
            response.headers.get('content-type') || 'application/octet-stream'

          // CSS: rewrite url() / @import so nested resources also proxy
          if (contentType.includes('text/css')) {
            const css = await response.text()
            const rewritten = rewriteCssUrls(css, response.url || target)
            res.setHeader('Content-Type', contentType)
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.setHeader('Cache-Control', 'public, max-age=300')
            res.end(rewritten)
            return
          }

          // Everything else (images, fonts, JS …): pipe through as-is
          const buffer = Buffer.from(await response.arrayBuffer())
          res.setHeader('Content-Type', contentType)
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Cache-Control', 'public, max-age=300')
          res.end(buffer)
        } catch (err) {
          res.statusCode = 502
          res.end((err as Error).message)
        }
      })

      // HTML fetch endpoint — now rewrites resource URLs before returning
      server.middlewares.use('/api/fetch-url', async (req, res) => {
        const params = new URL(req.url ?? '', 'http://localhost').searchParams
        const target = params.get('url')

        if (!target) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'Missing ?url= parameter' }))
          return
        }

        try {
          const response = await fetch(target, {
            headers: { 'User-Agent': 'VantraEmpathyDemo/1.0' },
            redirect: 'follow',
          })

          if (!response.ok) {
            res.statusCode = 502
            res.end(
              JSON.stringify({
                error: `Upstream returned ${response.status}`,
              }),
            )
            return
          }

          const rawHtml = await response.text()
          const finalUrl = response.url || target
          const html = rewriteHtmlUrls(rawHtml, finalUrl)

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ html, url: finalUrl }))
        } catch (err) {
          res.statusCode = 502
          res.end(JSON.stringify({ error: (err as Error).message }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [fetchProxyPlugin()],
  resolve: {
    alias: [
      {
        find: '@vantra-design/screenreader-empathy/core',
        replacement: fileURLToPath(new URL('../src/core/index.ts', import.meta.url)),
      },
      {
        find: '@vantra-design/screenreader-empathy',
        replacement: fileURLToPath(new URL('../src/index.ts', import.meta.url)),
      },
    ],
  },
  server: {
    port: 5174,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  build: {
    target: 'es2022',
  },
})
