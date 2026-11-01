import type { TextMessageRecord } from "@workspace/api-client-react";
import { Copy, Download, FileCode2, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getTextMessageFilename } from "@/lib/text-message";
import { motion } from "framer-motion";

interface TextMessageCardProps {
  message: TextMessageRecord;
  onDelete?: (id: string) => void;
  showDelete?: boolean;
}

export function TextMessageCard({ message, onDelete, showDelete = true }: TextMessageCardProps) {
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      toast({ title: "Snippet copied" });
    } catch {
      toast({ variant: "destructive", title: "Failed to copy snippet" });
    }
  };

  const handleDownload = () => {
    const blob = new Blob([message.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = getTextMessageFilename(message.title, message.language);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -8, transition: { duration: 0.2 } }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden rounded-xl border border-border bg-card hover:border-primary/30 transition-colors"
    >
      <div className="flex items-center gap-3 border-b border-border bg-secondary/40 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileCode2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{message.title}</p>
          <p className="text-xs text-muted-foreground">
            {message.language} &bull; {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" onClick={handleDownload} aria-label="Download snippet">
            <Download className="h-4 w-4" />
            <span className="sr-only">Download</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCopy} aria-label="Copy snippet">
            <Copy className="h-4 w-4" />
            <span className="sr-only">Copy</span>
          </Button>
          {showDelete && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(message.id)}
              aria-label="Delete snippet"
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Delete</span>
            </Button>
          )}
        </div>
      </div>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words p-4 text-sm leading-6 text-foreground [tab-size:2]">
        {message.content}
      </pre>
    </motion.article>
  );
}