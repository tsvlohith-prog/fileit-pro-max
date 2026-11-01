/**
 * Export and Multi-App Sharing Utilities
 * Supports Native OS Web Share API (with file attachment) and direct deep links
 * for common messaging & productivity apps (WhatsApp, Telegram, Gmail, Mailto).
 */

export interface SharePayload {
  title: string;
  text?: string;
  url: string;
  file?: File;
  blob?: Blob;
  fileName?: string;
}

export interface AppShareLinks {
  whatsApp: string;
  telegram: string;
  gmail: string;
  mailto: string;
  slackNotice: string;
}

/**
 * Checks whether the browser and environment support the Web Share API
 */
export function isNativeShareSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/**
 * Checks whether the browser can share specific files directly
 */
export function canShareFiles(files: File[]): boolean {
  if (!isNativeShareSupported()) return false;
  try {
    if (typeof navigator.canShare === "function") {
      return navigator.canShare({ files });
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Executes native OS share sheet.
 * Attaches file if supported, falling back gracefully to text/URL share.
 */
export async function executeNativeShare(payload: SharePayload): Promise<{ success: boolean; error?: string }> {
  if (!isNativeShareSupported()) {
    return { success: false, error: "Native share is not supported on this browser/platform." };
  }

  const shareData: ShareData = {
    title: payload.title,
    text: payload.text || payload.title,
    url: payload.url,
  };

  // Convert Blob to File if needed
  let fileToShare = payload.file;
  if (!fileToShare && payload.blob && payload.fileName) {
    fileToShare = new File([payload.blob], payload.fileName, {
      type: payload.blob.type || "application/octet-stream",
    });
  }

  if (fileToShare && canShareFiles([fileToShare])) {
    shareData.files = [fileToShare];
  }

  try {
    await navigator.share(shareData);
    return { success: true };
  } catch (err: any) {
    if (err?.name === "AbortError") {
      // User cancelled the share dialog
      return { success: false, error: "Share dismissed by user" };
    }
    return { success: false, error: err?.message || "Failed to share via OS sheet" };
  }
}

/**
 * Generates direct pre-filled URLs for common external messaging and email platforms
 */
export function generateAppShareUrls(payload: {
  title: string;
  fileName: string;
  url: string;
  customNote?: string;
}): AppShareLinks {
  const note = payload.customNote ? `${payload.customNote}\n\n` : "";
  const shareMessage = `${note}📄 Shared File: ${payload.fileName}\n🔗 Access / Download Link: ${payload.url}`;

  // WhatsApp click to chat web/app link
  const whatsApp = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage)}`;

  // Telegram share url
  const telegram = `https://t.me/share/url?url=${encodeURIComponent(payload.url)}&text=${encodeURIComponent(
    `${note}📄 Shared File: ${payload.fileName}`
  )}`;

  // Gmail web compose link
  const gmailSubject = encodeURIComponent(`Shared File: ${payload.fileName}`);
  const gmailBody = encodeURIComponent(
    `Hello,\n\nPlease find the shared document below:\n\nFile: ${payload.fileName}\nLink: ${payload.url}\n\n${payload.customNote || ""}`
  );
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&su=${gmailSubject}&body=${gmailBody}`;

  // Standard OS mailto
  const mailto = `mailto:?subject=${gmailSubject}&body=${gmailBody}`;

  // Slack message payload for copy/paste
  const slackNotice = `*${payload.fileName}*\n<${payload.url}|Download / View Document>`;

  return {
    whatsApp,
    telegram,
    gmail,
    mailto,
    slackNotice,
  };
}

/**
 * Fetches remote file data as a local File object to pass to navigator.share
 */
export async function fetchFileAsFileObject(url: string, fileName: string, mimeType?: string): Promise<File | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new File([blob], fileName, { type: mimeType || blob.type || "application/octet-stream" });
  } catch {
    return null;
  }
}
