import { promises as fs } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { parse } from "node:url";

const LEADING_DOT_SLASH_REGEX = /^(\.\.[/\\])+/;

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
