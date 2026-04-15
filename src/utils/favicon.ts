export function faviconUrl(domain: string, size = 16): string {
  if (!domain) return '';
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}
