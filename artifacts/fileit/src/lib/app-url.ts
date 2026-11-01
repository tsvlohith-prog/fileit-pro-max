export function getAppUrl(path: string): string {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
  return `${window.location.origin}${base}${path.replace(/^\/+/, "")}`;
}