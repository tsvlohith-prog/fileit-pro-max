import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateFile, getGetFileStatsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseStorage, getSupabaseStoragePath } from "@/lib/storage";

export function useUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createFile = useCreateFile();

  const uploadFile = async (file: File, folderId?: string, expiresAt?: string) => {
    setIsUploading(true);
    setProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => (prev < 90 ? prev + 10 : prev));
      }, 300);

      let storagePath: string;
      let shareToken: string;

      if (isSupabaseStorage()) {
        const uploadUrlRes = await fetch("/api/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ originalName: file.name }),
        });
        if (!uploadUrlRes.ok) throw new Error("Could not prepare Supabase upload");
        const signed = await uploadUrlRes.json() as { storagePath: string; shareToken: string; token: string };
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !anonKey) throw new Error("Supabase browser environment variables are missing");
        const supabase = createClient(supabaseUrl, anonKey);
        const { error } = await supabase.storage
          .from(getSupabaseStoragePath())
          .uploadToSignedUrl(signed.storagePath, signed.token, file);
        if (error) throw error;
        storagePath = signed.storagePath;
        shareToken = signed.shareToken;
      } else {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(err.error || "Upload failed");
        }
        ({ storagePath, shareToken } = await uploadRes.json() as {
          storagePath: string;
          shareToken: string;
        });
      }

      clearInterval(progressInterval);

      setProgress(100);

      // Step 2: register the file metadata in the database
      const newFile = await createFile.mutateAsync({
        data: {
          originalName: file.name,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
          storagePath,
          shareToken,
          folderId: folderId || undefined,
          expiresAt: expiresAt || undefined,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: getGetFileStatsQueryKey() });

      toast({
        title: "File uploaded successfully",
        description: "Your file is ready to be shared.",
      });

      setIsUploading(false);
      return newFile;
    } catch (error: unknown) {
      setIsUploading(false);
      setProgress(0);
      const msg =
        error instanceof Error ? error.message : "Something went wrong during upload.";
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: msg,
      });
      throw error;
    }
  };

  return { uploadFile, isUploading, progress };
}
