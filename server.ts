import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const candidateBundles = [
  path.resolve(__dirname, "dist/server/index.mjs"),
  path.resolve(__dirname, "artifacts/api-server/dist/index.mjs"),
  path.resolve(process.cwd(), "dist/server/index.mjs"),
  path.resolve(process.cwd(), "artifacts/api-server/dist/index.mjs"),
];

const bundlePath = candidateBundles.find((p) => fs.existsSync(p));

function startFallbackServer(cause?: unknown) {
  console.warn("Starting fallback HTTP server...", cause || "");

  const rawPort = process.env.PORT || "3000";
  const port = Number(rawPort) || 3000;

  const MIME_TYPES: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8",
    ".wasm": "application/wasm",
  };

  const candidateDirs = [
    path.resolve(process.cwd(), "dist"),
    path.resolve(process.cwd(), "dist/public"),
    path.resolve(process.cwd(), "artifacts/fileit/dist/public"),
    path.resolve(process.cwd(), "artifacts/fileit/dist"),
    path.resolve(__dirname, "dist"),
    path.resolve(__dirname, "dist/public"),
    path.resolve(__dirname, "artifacts/fileit/dist/public"),
  ];

  const publicDir = candidateDirs.find((dir) => fs.existsSync(path.join(dir, "index.html")));

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;

    // Health probes for GCP Cloud Run
    if (
      pathname === "/health" ||
      pathname === "/healthz" ||
      pathname === "/livez" ||
      pathname === "/readyz" ||
      pathname === "/api/health" ||
      pathname === "/api/healthz" ||
      pathname === "/_ah/health" ||
      pathname === "/_ah/warmup"
    ) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { "Content-Type": "text/plain" });
      res.end("Method Not Allowed");
      return;
    }

    if (!publicDir) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<!DOCTYPE html><html><head><title>Fileit</title></head><body><div id='root'>Loading Fileit...</div></body></html>");
      return;
    }

    // Try serving static file
    const sanitizedPath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, "");
    const filePath = path.join(publicDir, sanitizedPath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType });
      if (req.method === "HEAD") {
        res.end();
      } else {
        fs.createReadStream(filePath).pipe(res);
      }
      return;
    }

    // SPA fallback
    const indexPath = path.join(publicDir, "index.html");
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (req.method === "HEAD") {
        res.end();
      } else {
        fs.createReadStream(indexPath).pipe(res);
      }
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<!DOCTYPE html><html><head><title>Fileit</title></head><body><div id='root'></div></body></html>");
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });

  server.on("error", (err) => {
    console.error("Server error:", err);
  });

  process.on("SIGTERM", () => {
    server.close(() => process.exit(0));
  });

  process.on("SIGINT", () => {
    server.close(() => process.exit(0));
  });
}

if (bundlePath) {
  import(pathToFileURL(bundlePath).href).catch((err) => {
    console.error("Failed to start server bundle from", bundlePath, err);
    startFallbackServer(err);
  });
} else {
  console.warn("Could not find compiled server bundle. Checked:", candidateBundles);
  startFallbackServer();
}
