import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// 1. Logger
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// 2. Global CORS & body parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Top-level health endpoints for Cloud Run & GCP probes
app.get(
  [
    "/health",
    "/healthz",
    "/livez",
    "/readyz",
    "/api/health",
    "/api/healthz",
    "/_ah/health",
    "/_ah/warmup",
  ],
  (_req, res) => {
    res.status(200).json({ status: "ok" });
  },
);

// 4. API routes
app.use("/api", router);

// 5. Serve static frontend assets
function getCandidatePublicDirs(): string[] {
  const currentDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();
  return [
    path.resolve(process.cwd(), "dist"),
    path.resolve(process.cwd(), "dist/public"),
    path.resolve(currentDir, ".."),
    path.resolve(currentDir, "../public"),
    path.resolve(process.cwd(), "artifacts/fileit/dist/public"),
    path.resolve(process.cwd(), "artifacts/fileit/dist"),
    path.resolve(currentDir, "../../../dist"),
    path.resolve(currentDir, "../../../dist/public"),
    path.resolve(currentDir, "../../fileit/dist/public"),
    path.resolve(currentDir, "../../fileit/dist"),
  ];
}

function getPublicDir(): string | undefined {
  const dirs = getCandidatePublicDirs();
  return dirs.find((dir) => fs.existsSync(path.join(dir, "index.html")));
}

// Serve static directory if available
app.use((req, res, next) => {
  const publicDir = getPublicDir();
  if (publicDir && (req.method === "GET" || req.method === "HEAD")) {
    express.static(publicDir)(req, res, next);
  } else {
    next();
  }
});

// Fallback dynamic SPA handler for client-side routing
app.use((req, res, next) => {
  if (req.path.startsWith("/api") || (req.method !== "GET" && req.method !== "HEAD")) {
    return next();
  }
  const publicDir = getPublicDir();
  if (publicDir) {
    const indexPath = path.join(publicDir, "index.html");
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  
  // Minimal fallback if static build is pending
  if (req.path === "/" || req.path === "/index.html") {
    return res.status(200).send("<!DOCTYPE html><html><head><title>Fileit</title></head><body><div id='root'></div></body></html>");
  }
  
  next();
});

// 6. Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Unhandled application error");
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default app;
