import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves this as a project site at /unravel-tax/, not the
// domain root - the deploy workflow (.github/workflows/deploy-pages.yml)
// sets GITHUB_PAGES=true for that build only, so `npm run dev`/local
// `npm run build` keep working at the root path unchanged.
const base = process.env.GITHUB_PAGES === "true" ? "/unravel-tax/" : "/";
const fixturesDir = resolve(import.meta.dirname, "..", "fixtures");

/** Serve repo fixtures at /fixtures/ for spike page and local dev. */
function serveFixtures(): Plugin {
  return {
    name: "serve-fixtures",
    configureServer(server) {
      server.middlewares.use("/fixtures", (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? "/").replace(/^\//, ""));
        if (!rel || rel.includes("..")) {
          next();
          return;
        }
        const filePath = resolve(fixturesDir, rel);
        if (!filePath.startsWith(fixturesDir)) {
          next();
          return;
        }
        try {
          statSync(filePath);
          const body = readFileSync(filePath);
          const ext = rel.split(".").pop()?.toLowerCase();
          const type =
            ext === "pdf"
              ? "application/pdf"
              : ext === "json"
                ? "application/json"
                : "text/plain; charset=utf-8";
          res.setHeader("Content-Type", type);
          res.end(body);
        } catch {
          next();
        }
      });
    }
  };
}

/** Local-only OpenRouter proxy for dev, avoiding browser CORS/preflight failures. */
function openRouterProxy(): Plugin {
  return {
    name: "openrouter-proxy",
    configureServer(server) {
      server.middlewares.use("/openrouter", async (req, res, next) => {
        if (req.method !== "POST" || !req.url?.startsWith("/api/v1/chat/completions")) {
          next();
          return;
        }

        try {
          const authorization = req.headers.authorization;
          if (!authorization) {
            res.statusCode = 401;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: { message: "Missing OpenRouter API key." } }));
            return;
          }

          const body = await readRequestBody(req);
          const upstream = await fetch(`https://openrouter.ai${req.url}`, {
            method: "POST",
            headers: {
              Authorization: authorization,
              "Content-Type": req.headers["content-type"] ?? "application/json",
              "X-OpenRouter-Metadata": req.headers["x-openrouter-metadata"] ?? "enabled"
            },
            body
          });

          res.statusCode = upstream.status;
          res.setHeader(
            "Content-Type",
            upstream.headers.get("content-type") ?? "application/json; charset=utf-8"
          );
          res.end(await upstream.text());
        } catch (error) {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: {
                message:
                  error instanceof Error
                    ? `OpenRouter proxy failed: ${error.message}`
                    : "OpenRouter proxy failed."
              }
            })
          );
        }
      });
    }
  };
}

function readRequestBody(req: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolveBody, rejectBody) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolveBody(body));
    req.on("error", rejectBody);
  });
}

export default defineConfig({
  base,
  plugins: [react(), serveFixtures(), openRouterProxy()],
  server: {
    fs: { allow: [".."] }
  },
  worker: {
    format: "es"
  },
  optimizeDeps: {
    exclude: ["@mlc-ai/web-llm"]
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
