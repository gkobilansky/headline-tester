import { createServer } from "node:http";

const PORT = Number.parseInt(process.env.WIDGET_DEMO_PORT ?? "4000", 10);
const server = createServer((_request, response) => {
  response.statusCode = 200;
  response.setHeader("Content-Type", "text/plain; charset=utf-8");
  response.end("Widget demo server is running.\n");
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
