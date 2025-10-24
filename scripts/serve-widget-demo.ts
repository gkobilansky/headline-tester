import { promises as fs } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { parse } from "node:url";

const ROOT = resolve(process.cwd(), "test-sites/widget-demo");
const PORT = Number.parseInt(process.env.WIDGET_DEMO_PORT ?? "4000", 10);

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
};

const server = createServer(async (request, response) => {
  const url = request.url ?? "/";
  const { pathname = "/" } = parse(url);

  const normalisedPath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(ROOT, normalisedPath);

  try {
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      filePath = join(filePath, "index.html");
    }
  } catch (_error) {
    if (normalisedPath.endsWith("/")) {
      filePath = join(ROOT, normalisedPath, "index.html");
    } else {
      filePath = join(ROOT, `${normalisedPath}.html`);
    }
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

    response.statusCode = 200;
    response.setHeader("Content-Type", contentType);
    response.end(data);
  } catch (_error) {
    response.statusCode = 404;
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(
    `Widget demo available at http://localhost:${PORT}\n` +
      "Tip: run `pnpm dev` in another terminal so the iframe can load the widget from http://localhost:3000."
  );
});

const shutdown = () => {
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
