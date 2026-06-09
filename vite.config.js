import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import nodePath from 'path'
import { pathToFileURL } from 'url'

// ── Dev-only plugin: run Vercel serverless handlers as Vite middleware ──────────
// In production Vercel serves api/*.js automatically; in development Vite
// doesn't know about them so every /api/* call 404s. This plugin intercepts
// those routes, parses the body, adds Vercel-style res helpers, and calls
// the handler directly — no separate server needed.

const handlerCache = new Map()

async function getApiHandler(name) {
  if (!handlerCache.has(name)) {
    const filePath = nodePath.resolve(process.cwd(), `api/${name}.js`)
    const { default: handler } = await import(pathToFileURL(filePath).href)
    handlerCache.set(name, handler)
  }
  return handlerCache.get(name)
}

function vercelDevPlugin() {
  return {
    name: 'vercel-dev',
    configureServer(server) {
      for (const name of ['tailoring', 'alex', 'alexchat', 'import-job', 'score-job', 'interview']) {
        server.middlewares.use(`/api/${name}`, async (req, res, next) => {
          try {
            // Collect request body
            const chunks = []
            await new Promise((resolve, reject) => {
              req.on('data', (c) => chunks.push(c))
              req.on('end', resolve)
              req.on('error', reject)
            })
            req.body = chunks.length
              ? JSON.parse(Buffer.concat(chunks).toString())
              : {}

            // Add Vercel-style helpers that the handlers expect
            res.status = (code) => { res.statusCode = code; return res }
            res.json   = (data) => {
              if (!res.headersSent) res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(data))
            }

            const handler = await getApiHandler(name)
            await handler(req, res)
          } catch (err) {
            console.error(`[vercel-dev /api/${name}]`, err)
            if (!res.headersSent) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: err.message }))
            }
          }
        })
      }
    },
  }
}

// ── Config ─────────────────────────────────────────────────────────────────────
export default defineConfig(({ mode }) => {
  // Load all .env vars (no prefix filter) and inject into process.env so the
  // API handlers can read ANTHROPIC_API_KEY etc. at runtime in dev.
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)
  // Bridge VITE_-prefixed vars to their bare equivalents for serverless handlers
  if (env.VITE_ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = env.VITE_ANTHROPIC_API_KEY

  return {
    plugins: [react(), tailwindcss(), vercelDevPlugin()],
    server: {
      proxy: {
        // Adzuna is an external API so it needs a real HTTP proxy
        '/api/adzuna': {
          target: 'https://api.adzuna.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/adzuna/, ''),
        },
      },
    },
  }
})
