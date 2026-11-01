import { createClient } from "@supabase/supabase-js";
import { Readable } from "node:stream";

function getConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Supabase storage");
  }
  return {
    url,
    serviceRoleKey,
    bucket: process.env.SUPABASE_STORAGE_BUCKET || "fileit",
  };
}

export function isSupabaseStorageEnabled(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getClient() {
  const config = getConfig();
  return {
    config,
    client: createClient(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}

export async function uploadToSupabase(
  buffer: Buffer,
  storagePath: string,
  contentType: string,
): Promise<void> {
  const { client, config } = getClient();
  const { error } = await client.storage.from(config.bucket).upload(storagePath, buffer, {
    contentType: contentType || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
}

export async function createSupabaseUploadUrl(storagePath: string): Promise<{ token: string }> {
  const { client, config } = getClient();
  const { data, error } = await client.storage.from(config.bucket).createSignedUploadUrl(storagePath);
  if (error || !data?.token) {
    throw error || new Error("Could not create a signed upload URL");
  }
  return { token: data.token };
}

async function downloadFromSupabase(storagePath: string): Promise<{ buffer: Buffer; contentType: string }> {
  const { client, config } = getClient();
  const { data, error } = await client.storage.from(config.bucket).download(storagePath);
  if (error || !data) throw error || new Error("File not found");
  return {
    buffer: Buffer.from(await data.arrayBuffer()),
    contentType: data.type || "application/octet-stream",
  };
}

export async function serveFromSupabase(
  storagePath: string,
  res: import("express").Response,
): Promise<void> {
  try {
    const { buffer, contentType } = await downloadFromSupabase(storagePath);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", String(buffer.length));
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(buffer);
  } catch {
    res.status(404).json({ error: "File not found" });
  }
}

export async function getSupabaseFileStream(storagePath: string): Promise<{
  stream: Readable;
  size: number;
  contentType: string;
}> {
  const { buffer, contentType } = await downloadFromSupabase(storagePath);
  return {
    stream: Readable.from(buffer),
    size: buffer.length,
    contentType,
  };
}

export async function deleteFromSupabase(storagePath: string): Promise<void> {
  const { client, config } = getClient();
  const { error } = await client.storage.from(config.bucket).remove([storagePath]);
  if (error && !/not found/i.test(error.message)) throw error;
}