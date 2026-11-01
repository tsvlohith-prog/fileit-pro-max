import React from "react";
import {
  File,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  FileText,
  Presentation,
  Image as ImageIcon,
  Music,
  Video,
  Box,
  HardDrive,
  Binary,
  Layers,
  Sparkles,
} from "lucide-react";
import { FaAndroid, FaApple, FaWindows, FaLinux } from "react-icons/fa";

export type FileCategory =
  | "apk"
  | "archive"
  | "disk_image"
  | "executable"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "presentation"
  | "sheet"
  | "code"
  | "text"
  | "other";

export interface FileMetadataHelper {
  category: FileCategory;
  extension: string;
  badgeLabel: string;
  badgeColor: string;
  icon: React.ReactNode;
  isInstallable?: boolean;
  isArchive?: boolean;
  canPreviewInBrowser: boolean;
}

export function getFileExtension(filename: string): string {
  if (!filename) return "";
  const parts = filename.split(".");
  if (parts.length <= 1) return "";
  // Check for multi-part extensions like .tar.gz, .tar.bz2
  const lower = filename.toLowerCase();
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tar.bz2") || lower.endsWith(".tar.xz")) {
    return lower.endsWith(".tar.gz") ? "tar.gz" : lower.endsWith(".tar.bz2") ? "tar.bz2" : "tar.xz";
  }
  return parts.pop()?.toLowerCase() || "";
}

export function inspectFileType(filename: string, mimeType?: string): FileMetadataHelper {
  const ext = getFileExtension(filename);
  const mime = (mimeType || "").toLowerCase();

  // 1. Android APK
  if (ext === "apk" || mime.includes("vnd.android.package-archive")) {
    return {
      category: "apk",
      extension: "APK",
      badgeLabel: "Android APK",
      badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      icon: <FaAndroid className="w-5 h-5 text-emerald-500" />,
      isInstallable: true,
      isArchive: true,
      canPreviewInBrowser: true,
    };
  }

  // 2. Archives (ZIP, TAR, GZ, 7Z, RAR, BZ2, XZ, TGZ)
  if (
    ["zip", "tar", "gz", "tgz", "7z", "rar", "bz2", "xz", "zst", "iso"].includes(ext) ||
    mime.includes("zip") ||
    mime.includes("tar") ||
    mime.includes("gzip") ||
    mime.includes("7z-compressed") ||
    mime.includes("x-rar")
  ) {
    const isIso = ext === "iso";
    return {
      category: isIso ? "disk_image" : "archive",
      extension: ext.toUpperCase(),
      badgeLabel: isIso ? "Disk Image (ISO)" : `${ext.toUpperCase()} Archive`,
      badgeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
      icon: isIso ? <HardDrive className="w-5 h-5 text-amber-500" /> : <FileArchive className="w-5 h-5 text-amber-500" />,
      isArchive: true,
      canPreviewInBrowser: !isIso,
    };
  }

  // 3. Executables & Installers (DMG, EXE, DEB, RPM, PKG, MSI, BIN, APPIMAGE)
  if (["dmg", "pkg", "exe", "msi", "deb", "rpm", "appimage", "bin"].includes(ext)) {
    let icon = <Box className="w-5 h-5 text-indigo-500" />;
    if (ext === "dmg" || ext === "pkg") icon = <FaApple className="w-5 h-5 text-slate-400" />;
    if (ext === "exe" || ext === "msi") icon = <FaWindows className="w-5 h-5 text-blue-500" />;
    if (ext === "deb" || ext === "rpm" || ext === "appimage") icon = <FaLinux className="w-5 h-5 text-yellow-500" />;

    return {
      category: "executable",
      extension: ext.toUpperCase(),
      badgeLabel: `${ext.toUpperCase()} Package`,
      badgeColor: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
      icon,
      isInstallable: true,
      canPreviewInBrowser: false,
    };
  }

  // 4. Images
  if (
    ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "tiff", "heic", "avif"].includes(ext) ||
    mime.startsWith("image/")
  ) {
    return {
      category: "image",
      extension: ext.toUpperCase() || "IMAGE",
      badgeLabel: "Image",
      badgeColor: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
      icon: <ImageIcon className="w-5 h-5 text-sky-500" />,
      canPreviewInBrowser: true,
    };
  }

  // 5. Video
  if (
    ["mp4", "webm", "mkv", "avi", "mov", "wmv", "flv", "m4v"].includes(ext) ||
    mime.startsWith("video/")
  ) {
    return {
      category: "video",
      extension: ext.toUpperCase() || "VIDEO",
      badgeLabel: "Video",
      badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
      icon: <Video className="w-5 h-5 text-purple-500" />,
      canPreviewInBrowser: true,
    };
  }

  // 6. Audio
  if (
    ["mp3", "wav", "ogg", "flac", "m4a", "aac", "opus", "wma"].includes(ext) ||
    mime.startsWith("audio/")
  ) {
    return {
      category: "audio",
      extension: ext.toUpperCase() || "AUDIO",
      badgeLabel: "Audio",
      badgeColor: "bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30",
      icon: <Music className="w-5 h-5 text-pink-500" />,
      canPreviewInBrowser: true,
    };
  }

  // 7. PowerPoint Presentations (PPTX, PPT, KEYNOTE)
  if (
    ["pptx", "ppt", "odp", "key"].includes(ext) ||
    mime.includes("presentation") ||
    mime.includes("powerpoint")
  ) {
    return {
      category: "presentation",
      extension: ext.toUpperCase() || "PPTX",
      badgeLabel: ext === "ppt" ? "PowerPoint (PPT)" : "PowerPoint (PPTX)",
      badgeColor: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
      icon: <Presentation className="w-5 h-5 text-orange-500" />,
      canPreviewInBrowser: true,
    };
  }

  // 8. Documents (PDF, DOCX, DOC, EPUB)
  if (["pdf", "docx", "doc", "epub", "rtf", "odt"].includes(ext) || mime === "application/pdf") {
    return {
      category: "document",
      extension: ext.toUpperCase() || "DOC",
      badgeLabel: ext === "pdf" ? "PDF Document" : "Word Document",
      badgeColor: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
      icon: <FileText className="w-5 h-5 text-rose-500" />,
      canPreviewInBrowser: ext === "pdf" || ext === "docx",
    };
  }

  // 8. Spreadsheets (XLSX, XLS, CSV)
  if (["xlsx", "xls", "csv", "tsv", "ods"].includes(ext)) {
    return {
      category: "sheet",
      extension: ext.toUpperCase() || "SHEET",
      badgeLabel: "Spreadsheet",
      badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      icon: <FileSpreadsheet className="w-5 h-5 text-emerald-500" />,
      canPreviewInBrowser: true,
    };
  }

  // 9. Plain Text, Notes & Documentation
  if (
    ["txt", "text", "log", "md", "markdown", "rst", "ini", "toml", "conf", "config", "env", "properties"].includes(ext) ||
    mime === "text/plain" ||
    mime === "text/markdown"
  ) {
    return {
      category: "text",
      extension: ext.toUpperCase() || "TXT",
      badgeLabel: ext === "md" || ext === "markdown" ? "Markdown (.MD)" : ext ? `Text (.${ext.toUpperCase()})` : "Plain Text",
      badgeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
      icon: <FileText className="w-5 h-5 text-amber-500" />,
      canPreviewInBrowser: true,
    };
  }

  // 10. Code & Development Scripts
  if (
    [
      "js",
      "jsx",
      "mjs",
      "cjs",
      "ts",
      "tsx",
      "py",
      "pyw",
      "html",
      "htm",
      "css",
      "scss",
      "sass",
      "less",
      "json",
      "sql",
      "sh",
      "bash",
      "zsh",
      "fish",
      "bat",
      "cmd",
      "ps1",
      "c",
      "cpp",
      "cc",
      "cxx",
      "h",
      "hpp",
      "cs",
      "rs",
      "go",
      "java",
      "kt",
      "kts",
      "swift",
      "dart",
      "php",
      "rb",
      "lua",
      "r",
      "scala",
      "pl",
      "perl",
      "yaml",
      "yml",
      "xml",
      "vue",
      "svelte",
      "dockerfile",
      "makefile",
      "graphql",
      "gql",
      "wasm",
    ].includes(ext) ||
    mime.startsWith("text/") ||
    mime.includes("json") ||
    mime.includes("javascript") ||
    mime.includes("xml") ||
    mime.includes("x-sh") ||
    mime.includes("x-shellscript")
  ) {
    return {
      category: "code",
      extension: ext.toUpperCase() || "CODE",
      badgeLabel: `Code (${ext.toUpperCase() || "CODE"})`,
      badgeColor: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
      icon: <FileCode className="w-5 h-5 text-cyan-500" />,
      canPreviewInBrowser: true,
    };
  }

  // Default fallback
  return {
    category: "other",
    extension: ext.toUpperCase() || "FILE",
    badgeLabel: ext ? `${ext.toUpperCase()} File` : "Binary File",
    badgeColor: "bg-muted text-muted-foreground border-border",
    icon: <File className="w-5 h-5 text-muted-foreground" />,
    canPreviewInBrowser: false,
  };
}
