export function isSupabaseStorage(): boolean {
  return import.meta.env.VITE_STORAGE_PROVIDER === "supabase";
}

export function getSupabaseStoragePath(): string {
  return import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || "fileit";
}

export function getFileUrl(storagePath: string, password?: string): string {
  if (isSupabaseStorage() && import.meta.env.VITE_SUPABASE_URL) {
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${getSupabaseStoragePath()}/${storagePath}`;
  }
  const query = password ? `?password=${encodeURIComponent(password)}` : "";
  return `/api/storage/${encodeURIComponent(storagePath)}${query}`;
}

export function getFileDownloadUrl(storagePath: string, password?: string): string {
  const query = password ? `?download=1&password=${encodeURIComponent(password)}` : `?download=1`;
  return `/api/storage/${encodeURIComponent(storagePath)}${query}`;
}
