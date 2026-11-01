const textFileExtensions: Record<string, string> = {
  plaintext: "txt",
  text: "txt",
  c: "c",
  cpp: "cpp",
  "c++": "cpp",
  python: "py",
  javascript: "js",
  typescript: "ts",
  json: "json",
  html: "html",
  css: "css",
  sql: "sql",
  markdown: "md",
  bash: "sh",
  shell: "sh",
  java: "java",
  go: "go",
  rust: "rs",
  php: "php",
  ruby: "rb",
};

export function getTextMessageFilename(title: string, language: string): string {
  const extension = textFileExtensions[language.toLowerCase()] || "txt";
  const safeTitle =
    title.replace(/[\\/]/g, "_").replace(/[^a-zA-Z0-9._ -]/g, "_").trim() || "snippet";
  return safeTitle.toLowerCase().endsWith(`.${extension}`)
    ? safeTitle
    : `${safeTitle}.${extension}`;
}