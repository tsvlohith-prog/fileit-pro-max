import app from "./app";
import { logger } from "./lib/logger";
import { cleanupExpiredFilesAndFolders } from "./cleanup";

const rawPort = process.env["PORT"] || "3000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, "0.0.0.0", () => {
  logger.info({ port, host: "0.0.0.0" }, "Server listening and ready for requests");

  // Run cleanup every hour safely
  const cleanupInterval = setInterval(() => {
    logger.info("Running cleanup for expired files and folders...");
    cleanupExpiredFilesAndFolders().catch((err) => {
      logger.error({ err }, "Periodic cleanup error");
    });
  }, 60 * 60 * 1000);

  cleanupInterval.unref();
});

server.on("error", (err: any) => {
  logger.error({ err }, "Server listen error encountered");
  if (err?.code === "EADDRINUSE") {
    logger.warn({ port }, "Port already in use");
  }
});

// Handle graceful shutdown signals from Cloud Run / container runner
process.on("SIGTERM", () => {
  logger.info("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT signal received: closing HTTP server");
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
});
