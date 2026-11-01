import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import {
  useListTextMessages,
  useCreateTextMessage,
  useDeleteTextMessage,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare,
  Code2,
  ClipboardPaste,
  Copy,
  Check,
  Download,
  Trash2,
  Send,
  FileCode,
  Sparkles,
  Search,
  Terminal,
  Upload,
  FileUp,
  Image as ImageIcon,
  Paperclip,
  X,
  Maximize2,
  Eye,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";

// Language extensions catalog
const EXTENSIONS = [
  { id: "plaintext", ext: "txt", name: "Plain Text (.txt)" },
  { id: "python", ext: "py", name: "Python (.py)" },
  { id: "java", ext: "java", name: "Java (.java)" },
  { id: "c", ext: "c", name: "C (.c)" },
  { id: "cpp", ext: "cpp", name: "C++ (.cpp)" },
  { id: "javascript", ext: "js", name: "JavaScript (.js)" },
  { id: "typescript", ext: "ts", name: "TypeScript (.ts)" },
  { id: "html", ext: "html", name: "HTML (.html)" },
  { id: "css", ext: "css", name: "CSS (.css)" },
  { id: "json", ext: "json", name: "JSON (.json)" },
  { id: "sql", ext: "sql", name: "SQL (.sql)" },
  { id: "bash", ext: "sh", name: "Shell / Bash (.sh)" },
  { id: "rust", ext: "rs", name: "Rust (.rs)" },
  { id: "go", ext: "go", name: "Go (.go)" },
  { id: "php", ext: "php", name: "PHP (.php)" },
  { id: "markdown", ext: "md", name: "Markdown (.md)" },
];

export default function TextStudioPage() {
  const [mode, setMode] = useState<"chat" | "code">("chat");
  const { data: messages, isLoading, refetch } = useListTextMessages();
  const createMessage = useCreateTextMessage();
  const deleteMessage = useDeleteTextMessage();
  const { toast } = useToast();

  // Chat Mode States
  const [chatInput, setChatInput] = useState("");
  const [chatAttachment, setChatAttachment] = useState<{
    url: string;
    name: string;
    size: number;
    isImage: boolean;
  } | null>(null);
  const [isChatDragging, setIsChatDragging] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  // Code Studio States
  const [codeTitle, setCodeTitle] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("python");
  const [codeContent, setCodeContent] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditorDragging, setIsEditorDragging] = useState(false);
  const [imagePreview, setImagePreview] = useState<{
    url: string;
    name: string;
    size: number;
    isSvg?: boolean;
  } | null>(null);
  const [viewingImage, setViewingImage] = useState<{
    url: string;
    title: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Safe file & image drop/upload into Code Studio
  const handleLoadFileContent = (file: File) => {
    if (!file) return;

    // Stability: size protection
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large (>10MB)",
        description: "For files exceeding 10MB, please upload in the Files tab or Secret Rooms.",
        variant: "destructive",
      });
      return;
    }

    const fileNameWithoutExt = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const isSvg = file.type === "image/svg+xml" || ext === "svg";
    const isImage = file.type.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "ico"].includes(ext);

    // SVG: Read vector XML text, display live SVG preview
    if (isSvg) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text === "string") {
          setCodeContent(text);
          setCodeTitle(fileNameWithoutExt);
          setSelectedLanguage("html");
          setImagePreview({
            url: `data:image/svg+xml;utf8,${encodeURIComponent(text)}`,
            name: file.name,
            size: file.size,
            isSvg: true,
          });
          toast({
            title: "SVG Vector Loaded",
            description: `Loaded markup and live preview for "${file.name}"`,
          });
        }
      };
      reader.onerror = () => {
        toast({
          title: "Failed to read SVG",
          description: "Could not read SVG file content.",
          variant: "destructive",
        });
      };
      reader.readAsText(file);
      return;
    }

    // Raster Image: Read as Data URL safely (prevent binary encoding crashes)
    if (isImage) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result;
        if (typeof dataUrl === "string") {
          setImagePreview({
            url: dataUrl,
            name: file.name,
            size: file.size,
            isSvg: false,
          });
          setCodeTitle(fileNameWithoutExt);
          setSelectedLanguage("markdown");
          // Insert clean Markdown image syntax
          setCodeContent(`![${fileNameWithoutExt}](${dataUrl})`);
          toast({
            title: "Image Loaded Safely",
            description: `Loaded "${file.name}" (${(file.size / 1024).toFixed(1)} KB) with visual preview.`,
          });
        }
      };
      reader.onerror = () => {
        toast({
          title: "Failed to read image",
          description: "Could not read image data.",
          variant: "destructive",
        });
      };
      reader.readAsDataURL(file);
      return;
    }

    // Standard code/text file
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === "string") {
        setCodeContent(result);
        setCodeTitle(fileNameWithoutExt);
        setImagePreview(null);

        const matched = EXTENSIONS.find((e) => e.ext === ext);
        if (matched) {
          setSelectedLanguage(matched.id);
        } else {
          setSelectedLanguage("plaintext");
        }

        toast({
          title: "File Loaded",
          description: `Loaded content from "${file.name}"`,
        });
      }
    };
    reader.onerror = () => {
      toast({
        title: "Failed to read file",
        description: "Could not read this file as text.",
        variant: "destructive",
      });
    };
    reader.readAsText(file);
  };

  // Safe file & image loader for Chat mode
  const handleChatFileLoad = (file: File) => {
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large (>10MB)",
        description: "Please upload large files in the Files tab.",
        variant: "destructive",
      });
      return;
    }

    const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(file.name);

    if (isImage) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result;
        if (typeof dataUrl === "string") {
          setChatAttachment({
            url: dataUrl,
            name: file.name,
            size: file.size,
            isImage: true,
          });
          toast({
            title: "Image Attached",
            description: `Attached "${file.name}" ready to send.`,
          });
        }
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text === "string") {
          setChatInput((prev) => (prev ? `${prev}\n\n${text}` : text));
          toast({
            title: "File Content Loaded",
            description: `Imported text from "${file.name}" into chat.`,
          });
        }
      };
      reader.readAsText(file);
    }
  };

  const handleEditorDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsEditorDragging(true);
  };

  const handleEditorDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsEditorDragging(false);
  };

  const handleEditorDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsEditorDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleLoadFileContent(file);
    }
  };

  // Chat drag and drop handlers
  const handleChatDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsChatDragging(true);
  };

  const handleChatDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsChatDragging(false);
  };

  const handleChatDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsChatDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleChatFileLoad(file);
    }
  };

  // Filter messages for General Chat vs Code Snippets
  const chatMessages = (messages || []).filter(
    (m) => m.language === "chat" || m.language === "plaintext" || !m.title || m.title === "Chat Message"
  );
  const codeSnippets = (messages || []).filter(
    (m) => m.language !== "chat" && m.title && m.title !== "Chat Message"
  );

  // Handle "Paste Copied" for Chat
  const handlePasteCopied = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setChatInput((prev) => (prev ? `${prev}\n${text}` : text));
          toast({
            title: "Clipboard Pasted",
            description: "Pasted text from your device clipboard.",
          });
        } else {
          toast({
            title: "Clipboard Empty",
            description: "No text found in your system clipboard.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Clipboard Notice",
          description: "Use Ctrl+V or Cmd+V to paste into the box directly.",
        });
      }
    } catch {
      toast({
        title: "Permission needed",
        description: "Please allow clipboard permissions or press Ctrl+V to paste.",
      });
    }
  };

  // Extract image metadata from markdown or raw data URI
  const extractImage = (content: string) => {
    const mdMatch = content.match(/!\[(.*?)\]\((data:image\/[^)]+|https?:\/\/[^)]+)\)/);
    if (mdMatch) {
      return { alt: mdMatch[1], url: mdMatch[2], cleanText: content.replace(mdMatch[0], "").trim() };
    }
    if (content.startsWith("data:image/")) {
      return { alt: "Image", url: content.trim(), cleanText: "" };
    }
    return null;
  };

  // Send Chat Message with optional image attachment
  const handleSendChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() && !chatAttachment) return;

    let finalContent = chatInput.trim();
    if (chatAttachment) {
      const imgEmbed = `![${chatAttachment.name}](${chatAttachment.url})`;
      finalContent = finalContent ? `${finalContent}\n\n${imgEmbed}` : imgEmbed;
    }

    try {
      await createMessage.mutateAsync({
        data: {
          title: chatAttachment ? chatAttachment.name : "Chat Message",
          content: finalContent,
          language: "chat",
        },
      });
      setChatInput("");
      setChatAttachment(null);
      refetch();
    } catch {
      toast({
        title: "Failed to send message",
        variant: "destructive",
      });
    }
  };

  // 1-Click Copy
  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({
      title: "Copied to clipboard",
      description: "Text is ready to paste anywhere.",
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 1-Click Download File with real extension
  const handleDownloadFile = (title: string, content: string, language: string) => {
    const matched = EXTENSIONS.find((e) => e.id === language.toLowerCase()) || {
      ext: "txt",
    };
    const cleanTitle = (title || "snippet").replace(/[\\/]/g, "_").trim();
    const filename = cleanTitle.toLowerCase().endsWith(`.${matched.ext}`)
      ? cleanTitle
      : `${cleanTitle}.${matched.ext}`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Downloaded",
      description: `Saved as ${filename}`,
    });
  };

  // Save from Code Studio
  const handleSaveSnippet = async () => {
    if (!codeContent.trim()) {
      toast({
        title: "Empty code",
        description: "Please enter some code or text before saving.",
        variant: "destructive",
      });
      return;
    }

    const title = codeTitle.trim() || `snippet_${Date.now().toString().slice(-4)}`;
    try {
      await createMessage.mutateAsync({
        data: {
          title,
          content: codeContent,
          language: selectedLanguage,
        },
      });
      toast({
        title: "Snippet Saved",
        description: `Saved "${title}" into your code library.`,
      });
      setCodeTitle("");
      refetch();
    } catch {
      toast({
        title: "Failed to save snippet",
        variant: "destructive",
      });
    }
  };

  // Delete message / snippet
  const handleDelete = async (id: string) => {
    try {
      await deleteMessage.mutateAsync({ id });
      refetch();
      toast({
        title: "Item removed",
      });
    } catch {
      toast({
        title: "Failed to delete item",
        variant: "destructive",
      });
    }
  };

  const currentExt =
    EXTENSIONS.find((e) => e.id === selectedLanguage)?.ext || "txt";

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 max-w-5xl flex-1 flex flex-col">
        {/* Top Header & Segmented Mode Toggle */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-border/80">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              {mode === "chat" ? (
                <>
                  <MessageSquare className="w-6 h-6 text-primary" />
                  Text Messages & Chat
                </>
              ) : (
                <>
                  <Code2 className="w-6 h-6 text-primary" />
                  Code & Text Studio
                </>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {mode === "chat"
                ? "Send quick text, notes, and 1-tap paste from your clipboard"
                : "Write, edit, and export code with any extension (.py, .java, .c, .cpp, .txt)"}
            </p>
          </div>

          {/* Segmented Top Toggle */}
          <div className="inline-flex p-1 rounded-xl bg-muted/80 border border-border shrink-0 shadow-inner">
            <button
              onClick={() => setMode("chat")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                mode === "chat"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageSquare className="w-4 h-4 text-primary" />
              <span>Chat & Quick Text</span>
            </button>
            <button
              onClick={() => setMode("code")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                mode === "code"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Code2 className="w-4 h-4 text-primary" />
              <span>Code Studio</span>
            </button>
          </div>
        </div>

        {/* ────────────────────────────────────────────────────────────────────────
            MODE A: CHAT & QUICK TEXT WITH "PASTE COPIED"
        ───────────────────────────────────────────────────────────────────────── */}
        {mode === "chat" && (
          <div className="flex-1 flex flex-col pt-6 gap-6">
            {/* Quick Action Bar with Dedicated "Paste Copied" & "Attach File / Image" */}
            <div
              onDragOver={handleChatDragOver}
              onDragLeave={handleChatDragLeave}
              onDrop={handleChatDrop}
              className={`relative p-4 rounded-2xl bg-card border shadow-xs transition-colors ${
                isChatDragging
                  ? "border-primary border-dashed ring-2 ring-primary/30 bg-primary/5"
                  : "border-border"
              }`}
            >
              {isChatDragging && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/85 backdrop-blur-xs rounded-2xl pointer-events-none gap-2">
                  <FileUp className="w-6 h-6 text-primary animate-bounce" />
                  <span className="text-sm font-semibold text-foreground">Drop image or text file here</span>
                </div>
              )}

              {/* Staged File/Image Attachment preview */}
              {chatAttachment && (
                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-primary/10 border border-primary/20 mb-3 animate-in fade-in">
                  {chatAttachment.isImage ? (
                    <img
                      src={chatAttachment.url}
                      alt={chatAttachment.name}
                      className="w-10 h-10 rounded-lg object-cover border border-border shrink-0"
                    />
                  ) : (
                    <FileText className="w-6 h-6 text-primary shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{chatAttachment.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {(chatAttachment.size / 1024).toFixed(1)} KB • Image attached ready to send
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setChatAttachment(null)}
                    className="h-7 w-7 p-0 rounded-full hover:bg-destructive/10 hover:text-destructive shrink-0"
                    title="Remove attachment"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}

              <input
                ref={chatFileInputRef}
                type="file"
                className="hidden"
                accept="image/*,text/*,.txt,.md,.json,.js,.py,.ts,.html,.css,.sh"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleChatFileLoad(e.target.files[0]);
                  }
                }}
              />

              <div className="flex flex-col sm:flex-row gap-3">
                <Textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type a note, memo, or drop an image/file here..."
                  className="min-h-[72px] resize-y rounded-xl border-border bg-background focus-visible:ring-primary font-sans text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChat();
                    }
                  }}
                />
                <div className="flex sm:flex-col gap-2 shrink-0 justify-end sm:justify-start">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePasteCopied}
                    className="flex-1 sm:flex-none border-primary/30 text-primary hover:bg-primary/10 font-semibold gap-1.5 rounded-xl h-10 px-3.5 text-xs"
                  >
                    <ClipboardPaste className="w-4 h-4" />
                    <span>Paste Copied</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => chatFileInputRef.current?.click()}
                    className="flex-1 sm:flex-none border-border font-semibold gap-1.5 rounded-xl h-10 px-3.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>Attach Image</span>
                  </Button>
                  <Button
                    onClick={() => handleSendChat()}
                    disabled={(!chatInput.trim() && !chatAttachment) || createMessage.isPending}
                    className="flex-1 sm:flex-none font-semibold gap-1.5 rounded-xl h-10 px-4 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Send className="w-4 h-4" />
                    <span>Send</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Chat Stream Messages */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between pb-1">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent Messages & Memos ({chatMessages.length})
                </h2>
                <span className="text-xs text-muted-foreground">Click copy to duplicate to clipboard</span>
              </div>

              {isLoading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Loading messages...
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-muted/20">
                  <MessageSquare className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="font-semibold text-foreground text-sm">No messages yet</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    Type a message, drop an image, or tap "Paste Copied" to immediately share.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    {chatMessages.map((msg) => {
                      const isCopied = copiedId === msg.id;
                      const imgData = extractImage(msg.content);

                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs hover:border-primary/40 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-3 group"
                        >
                          <div className="min-w-0 flex-1 space-y-2">
                            {imgData ? (
                              <>
                                {imgData.cleanText && (
                                  <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed font-sans select-text">
                                    {imgData.cleanText}
                                  </p>
                                )}
                                <div className="relative group/img inline-block rounded-xl overflow-hidden border border-border/70 bg-black/5">
                                  <img
                                    src={imgData.url}
                                    alt={imgData.alt}
                                    className="max-h-60 max-w-xs sm:max-w-md rounded-xl object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() =>
                                      setViewingImage({ url: imgData.url, title: imgData.alt || msg.title })
                                    }
                                  />
                                  <div className="absolute top-2 right-2 opacity-0 group-hover/img:opacity-100 transition-opacity flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() =>
                                        setViewingImage({ url: imgData.url, title: imgData.alt || msg.title })
                                      }
                                      className="h-7 px-2 text-xs font-semibold rounded-lg gap-1 shadow-md bg-background/90 hover:bg-background"
                                    >
                                      <Maximize2 className="w-3 h-3" />
                                      <span>View</span>
                                    </Button>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed font-sans select-text">
                                {msg.content}
                              </p>
                            )}

                            <p className="text-[11px] text-muted-foreground pt-1">
                              {new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}{" "}
                              • {new Date(msg.createdAt).toLocaleDateString()}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-start">
                            <Button
                              size="sm"
                              variant={isCopied ? "default" : "outline"}
                              onClick={() => handleCopyText(msg.id, msg.content)}
                              className="h-8 px-2.5 text-xs font-medium rounded-lg gap-1.5"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-primary-foreground" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy</span>
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (imgData) {
                                  const a = document.createElement("a");
                                  a.href = imgData.url;
                                  a.download = imgData.alt || "image";
                                  a.click();
                                } else {
                                  handleDownloadFile("message", msg.content, "plaintext");
                                }
                              }}
                              className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                              title={imgData ? "Download image" : "Download as .txt"}
                            >
                              <Download className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(msg.id)}
                              className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-destructive"
                              title="Delete message"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────────
            MODE B: CODE STUDIO & MULTI-EXTENSION GENERATOR
        ───────────────────────────────────────────────────────────────────────── */}
        {mode === "code" && (
          <div className="flex-1 flex flex-col pt-6 gap-6">
            {/* Editor Workspace Card */}
            <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
              {/* Header metadata row */}
              <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                <div className="flex-1 flex flex-col sm:flex-row gap-2.5">
                  <div className="flex-1">
                    <Input
                      value={codeTitle}
                      onChange={(e) => setCodeTitle(e.target.value)}
                      placeholder="File or script name (e.g. main, algorithm, scraper)"
                      className="rounded-xl border-border bg-background h-10 font-medium text-sm"
                    />
                  </div>

                  {/* Extension & Language Selector */}
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    aria-label="Select Programming Language"
                    className="h-10 px-3 rounded-xl border border-border bg-background text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {EXTENSIONS.map((lang) => (
                      <option key={lang.id} value={lang.id}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl h-10 px-3 text-xs font-semibold gap-1.5 border-border hover:bg-secondary"
                  >
                    <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Import File / Image</span>
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="text/*,image/*,.txt,.md,.json,.js,.py,.ts,.html,.css,.sh,.svg,.png,.jpg,.jpeg,.gif,.webp"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleLoadFileContent(e.target.files[0]);
                      }
                    }}
                  />

                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(codeContent);
                      setCodeCopied(true);
                      toast({ title: "Code copied to clipboard" });
                      setTimeout(() => setCodeCopied(false), 2000);
                    }}
                    className="rounded-xl h-10 px-3 text-xs font-semibold gap-1.5"
                  >
                    {codeCopied ? (
                      <Check className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>Copy</span>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() =>
                      handleDownloadFile(codeTitle || "code", codeContent, selectedLanguage)
                    }
                    className="rounded-xl h-10 px-3 text-xs font-semibold gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .{currentExt}</span>
                  </Button>

                  <Button
                    onClick={handleSaveSnippet}
                    disabled={createMessage.isPending}
                    className="rounded-xl h-10 px-4 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Save Snippet</span>
                  </Button>
                </div>
              </div>

              {/* Image/SVG Preview Banner and Quick Conversion Toolbar */}
              {imagePreview && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 border border-primary/30 animate-in fade-in">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      onClick={() => setViewingImage({ url: imagePreview.url, title: imagePreview.name })}
                      className="w-12 h-12 rounded-lg border border-border bg-background overflow-hidden flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all shrink-0 relative group"
                    >
                      <img
                        src={imagePreview.url}
                        alt={imagePreview.name}
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Eye className="w-4 h-4 text-white" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/15 text-primary">
                          {imagePreview.isSvg ? "SVG Vector" : "Image Preview"}
                        </span>
                        <p className="text-xs font-semibold text-foreground truncate max-w-[180px] sm:max-w-xs">
                          {imagePreview.name}
                        </p>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {(imagePreview.size / 1024).toFixed(1)} KB • Choose snippet format:
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setCodeContent(`![${imagePreview.name}](${imagePreview.url})`);
                        setSelectedLanguage("markdown");
                        toast({ title: "Inserted as Markdown", description: "Markdown image embed syntax applied." });
                      }}
                      className="h-7 px-2.5 text-[11px] font-semibold rounded-lg"
                    >
                      Markdown
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setCodeContent(`<img src="${imagePreview.url}" alt="${imagePreview.name}" />`);
                        setSelectedLanguage("html");
                        toast({ title: "Inserted as HTML", description: "HTML <img> tag syntax applied." });
                      }}
                      className="h-7 px-2.5 text-[11px] font-semibold rounded-lg"
                    >
                      HTML &lt;img&gt;
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setCodeContent(imagePreview.url);
                        setSelectedLanguage("plaintext");
                        toast({ title: "Inserted Data URI", description: "Raw base64 data URL applied." });
                      }}
                      className="h-7 px-2.5 text-[11px] font-semibold rounded-lg"
                    >
                      Data URI
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setImagePreview(null)}
                      className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-destructive shrink-0"
                      title="Dismiss preview"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Monospace Code Editor Area with Drag-and-Drop */}
              <div
                onDragOver={handleEditorDragOver}
                onDragLeave={handleEditorDragLeave}
                onDrop={handleEditorDrop}
                className={`relative rounded-xl border transition-all overflow-hidden font-mono ${
                  isEditorDragging
                    ? "border-primary border-dashed ring-2 ring-primary/30 bg-primary/5"
                    : "border-border/80 bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between px-3 py-1.5 bg-muted/70 border-b border-border text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-3 h-3 text-primary" />
                    {codeTitle ? `${codeTitle}.${currentExt}` : `untitled.${currentExt}`}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="hidden sm:inline-block text-[10px] text-muted-foreground/80">
                      Drag & drop any file to edit
                    </span>
                    <span>{codeContent ? codeContent.split("\n").length : 0} lines</span>
                  </span>
                </div>

                {isEditorDragging && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/80 backdrop-blur-xs gap-2 pointer-events-none"
                  >
                    <FileUp className="w-8 h-8 text-primary animate-bounce" />
                    <p className="text-sm font-semibold text-foreground">Drop file to load into editor</p>
                    <p className="text-xs text-muted-foreground">Extracts code or text automatically</p>
                  </motion.div>
                )}

                <Textarea
                  value={codeContent}
                  onChange={(e) => setCodeContent(e.target.value)}
                  placeholder="Type or paste your code snippet here, or drag and drop any file directly..."
                  className="w-full min-h-[220px] max-h-[480px] p-3.5 font-mono text-xs md:text-sm bg-transparent border-0 focus-visible:ring-0 resize-y leading-relaxed"
                  spellCheck={false}
                />
              </div>
            </div>

            {/* Saved Code Snippets Library */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
                <div>
                  <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-primary" />
                    Saved Code Snippets ({codeSnippets.length})
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Stored code files and scripts ready for instant download or copy
                  </p>
                </div>

                {codeSnippets.length > 3 && (
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search snippets..."
                      className="pl-8 h-9 rounded-xl text-xs bg-card"
                    />
                  </div>
                )}
              </div>

              {codeSnippets.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-border bg-muted/10">
                  <FileCode className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-foreground">No saved code snippets</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Write code in the editor above and tap "Save Snippet".
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AnimatePresence mode="popLayout">
                    {codeSnippets
                      .filter(
                        (s) =>
                          !searchQuery ||
                          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.content.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((snippet) => {
                        const matched =
                          EXTENSIONS.find(
                            (e) => e.id === snippet.language.toLowerCase()
                          ) || { ext: "txt", name: "Text" };
                        const isCopied = copiedId === snippet.id;

                        return (
                          <motion.div
                            key={snippet.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                            transition={{ duration: 0.2 }}
                            className="p-4 rounded-2xl bg-card border border-border shadow-xs flex flex-col justify-between hover:border-primary/40 transition-colors"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2 pb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary">
                                    .{matched.ext}
                                  </span>
                                  <h3 className="font-semibold text-sm text-foreground truncate">
                                    {snippet.title}
                                  </h3>
                                </div>
                                <span className="text-[11px] text-muted-foreground shrink-0">
                                  {new Date(snippet.createdAt).toLocaleDateString()}
                                </span>
                              </div>

                              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50 text-[11px] font-mono text-muted-foreground line-clamp-4 overflow-hidden whitespace-pre leading-relaxed">
                                {snippet.content}
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-border/60">
                              <Button
                                size="sm"
                                variant={isCopied ? "default" : "outline"}
                                onClick={() => handleCopyText(snippet.id, snippet.content)}
                                className="h-8 px-2.5 text-xs font-semibold rounded-lg gap-1.5"
                              >
                                {isCopied ? (
                                  <Check className="w-3.5 h-3.5" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                                <span>{isCopied ? "Copied" : "Copy"}</span>
                              </Button>

                              <div className="flex items-center gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleDownloadFile(
                                      snippet.title,
                                      snippet.content,
                                      snippet.language
                                    )
                                  }
                                  className="h-8 px-2.5 text-xs font-semibold rounded-lg gap-1.5 text-primary border-primary/30 hover:bg-primary/10"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>.{matched.ext}</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDelete(snippet.id)}
                                  className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Full-Screen Image Lightbox Modal */}
      {viewingImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setViewingImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-card rounded-2xl border border-border overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
              <span className="text-sm font-semibold truncate text-foreground pr-4">
                {viewingImage.title}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = viewingImage.url;
                    a.download = viewingImage.title || "image";
                    a.click();
                  }}
                  className="h-8 px-3 text-xs font-semibold gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setViewingImage(null)}
                  className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="p-4 flex items-center justify-center overflow-auto max-h-[calc(90vh-60px)] bg-muted/20">
              <img
                src={viewingImage.url}
                alt={viewingImage.title}
                className="max-h-[75vh] w-auto object-contain rounded-lg shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
