import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import {
  createSupabaseUploadUrl,
  deleteFromSupabase,
  getSupabaseFileStream,
  isSupabaseStorageEnabled,
  serveFromSupabase,
  uploadToSupabase,
} from "./supabaseStorage";

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".html": "text/html",
  ".json": "application/json",
  ".zip": "application/zip",
  ".tar": "application/x-tar",
  ".gz": "application/gzip",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".wav": "audio/wav",
  ".webm": "video/webm",
};

function getLocalFullPath(storagePath: string): string {
  const sanitized = storagePath.replace(/^\/+/, "").replace(/\.\./g, "");
  const candidates = [
    path.resolve(process.cwd(), sanitized),
    path.resolve(process.cwd(), "artifacts/api-server", sanitized),
    path.resolve(process.cwd(), "..", sanitized),
    path.resolve("/app/applet", sanitized),
    path.resolve("/app/applet/artifacts/api-server", sanitized),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

export function generateStoragePath(originalName: string): string {
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  const ext = originalName.lastIndexOf(".") > 0
    ? originalName.slice(originalName.lastIndexOf("."))
    : "";
  const base = originalName
    .slice(0, originalName.lastIndexOf(".") > 0 ? originalName.lastIndexOf(".") : originalName.length)
    .replace(/[^a-zA-Z0-9_.-]/g, "_")
    .slice(0, 60);
  return `uploads/${timestamp}-${rand}-${base}${ext}`;
}

export async function uploadFile(buffer: Buffer, storagePath: string, contentType: string): Promise<void> {
  if (isSupabaseStorageEnabled()) {
    await uploadToSupabase(buffer, storagePath, contentType);
    return;
  }

  const fullPath = getLocalFullPath(storagePath);
  await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.promises.writeFile(fullPath, buffer);
}

export async function fileExists(storagePath: string): Promise<boolean> {
  if (isSupabaseStorageEnabled()) {
    try {
      await getSupabaseFileStream(storagePath);
      return true;
    } catch {
      return false;
    }
  }

  const fullPath = getLocalFullPath(storagePath);
  try {
    await fs.promises.access(fullPath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function serveFile(storagePath: string, res: import("express").Response): Promise<void> {
  if (isSupabaseStorageEnabled()) {
    await serveFromSupabase(storagePath, res);
    return;
  }

  const fullPath = getLocalFullPath(storagePath);
  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const ext = path.extname(fullPath).toLowerCase();
  const contentType = MIME_MAP[ext] || "application/octet-stream";
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.sendFile(fullPath);
}

export async function getStoredFileStream(storagePath: string): Promise<{
  stream: NodeJS.ReadableStream;
  size: number;
  contentType: string;
}> {
  if (isSupabaseStorageEnabled()) {
    return getSupabaseFileStream(storagePath);
  }

  const fullPath = getLocalFullPath(storagePath);
  const stat = await fs.promises.stat(fullPath);
  const ext = path.extname(fullPath).toLowerCase();
  const contentType = MIME_MAP[ext] || "application/octet-stream";
  const stream = fs.createReadStream(fullPath);
  return {
    stream,
    size: stat.size,
    contentType,
  };
}

export async function deleteFile(storagePath: string): Promise<void> {
  if (isSupabaseStorageEnabled()) {
    await deleteFromSupabase(storagePath);
    return;
  }

  const fullPath = getLocalFullPath(storagePath);
  try {
    await fs.promises.unlink(fullPath);
  } catch (err: any) {
    if (err?.code !== "ENOENT") throw err;
  }
}

export async function createUploadUrl(storagePath: string): Promise<{ token: string }> {
  if (isSupabaseStorageEnabled()) {
    return createSupabaseUploadUrl(storagePath);
  }
  throw new Error("Signed upload URLs are only available when cloud object storage is configured");
}
