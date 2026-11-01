import { useRoute } from "wouter";
import { useGetFolderByShareToken, getGetFolderByShareTokenQueryKey } from "@workspace/api-client-react";
import type { FileRecord, TextMessageRecord } from "@workspace/api-client-react";
import { AlertCircle, Download, File as FileIcon, FileCode2, Folder, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getFileDownloadUrl } from "@/lib/storage";
import { TextMessageCard } from "@/components/text-message-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ApiError } from "@workspace/api-client-react/custom-fetch";
import { FileitLogo } from "@/components/brand/FileitLogo";
import { FileitLoader } from "@/components/brand/FileitLoader";

import { GlassmorphicUnlockModal } from "@/components/glassmorphic-unlock-modal";

function SharedFile({ file, folderPassword }: { file: FileRecord; folderPassword?: string }) {
  const isCustomProtected = Boolean((file as any).hasPassword);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-all">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <FileIcon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{file.originalName}</p>
          {isCustomProtected && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/10 text-purple-600 dark:text-purple-400">
              Custom Lock
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{file.mimeType}</p>
      </div>
      <Button size="sm" variant="outline" asChild>
        <a href={getFileDownloadUrl(file.storagePath, folderPassword || undefined)} download={file.originalName}>
          <Download className="mr-2 h-4 w-4" />
          Download
        </a>
      </Button>
    </div>
  );
}

function SharedTextMessage({ message }: { message: TextMessageRecord }) {
  return <TextMessageCard message={message} showDelete={false} />;
}

export default function FolderSharePage() {
  const [, params] = useRoute("/folder-share/:token");
  const token = params?.token || "";
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  
  const { data, isLoading, isError, error } = useGetFolderByShareToken(token, {
    query: {
      enabled: !!token,
      queryKey: [getGetFolderByShareTokenQueryKey(token), password],
      retry: false,
    },
    request: {
      headers: password ? { "x-folder-password": password } : undefined,
    }
  });

  const handleDownload = () => {
    if (!data) return;
    const link = document.createElement("a");
    link.href = `/api/folders/share/${token}/download${password ? `?password=${encodeURIComponent(password)}` : ""}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Preparing folder ZIP" });
  };

  const isPasswordRequired = isError && error instanceof Error && (error as any).status === 401;

  if (isPasswordRequired) {
    const folderMeta = (error as any)?.data?.folder;
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background p-4 relative selection:bg-purple-500/20">
        <GlassmorphicUnlockModal
          title={folderMeta?.name || "Protected Folder"}
          isFolder={true}
          subTitle={folderMeta?.fileCount ? `Folder containing ${folderMeta.fileCount} items` : "Folder is protected by a password"}
          onUnlock={async (pass) => {
            setPassword(pass);
          }}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <FileitLoader size="lg" label="Opening shared folder..." sublabel="Decentralized room lookup" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold">Folder not found</h1>
          <p className="text-muted-foreground">This share link may be invalid, expired, or the folder was deleted.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-4xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <FileitLogo size="sm" showWordmark={true} badge="Room" />
          </div>
          <Button onClick={handleDownload} className="shrink-0">
            <Download className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Download all</span>
            <span className="sm:hidden">ZIP</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl space-y-8 px-4 py-8">
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Shared with you</p>
          <h1 className="text-3xl font-bold tracking-tight">{data.folder.name}</h1>
          <p className="text-muted-foreground">
            {data.files.length} {data.files.length === 1 ? "file" : "files"}
            {data.textMessages.length > 0 && ` and ${data.textMessages.length} ${data.textMessages.length === 1 ? "snippet" : "snippets"}`}
          </p>
        </motion.section>

        {data.files.length > 0 && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <FileIcon className="h-4 w-4" /> Files
            </h2>
            <div className="space-y-2">{data.files.map((file) => <SharedFile key={file.id} file={file} folderPassword={password} />)}</div>
          </section>
        )}

        {data.textMessages.length > 0 && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <FileCode2 className="h-4 w-4" /> Text & code
            </h2>
            <div className="space-y-3">
              {data.textMessages.map((message) => <SharedTextMessage key={message.id} message={message} />)}
            </div>
          </section>
        )}

        {data.files.length === 0 && data.textMessages.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
            This folder is empty.
          </div>
        )}
      </main>
    </div>
  );
}