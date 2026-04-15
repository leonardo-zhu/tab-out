/**
 * Returns a URL for the favicon of a given domain/hostname using the Chrome extension's native API.
 * The standard format for Manifest V3 is: chrome-extension://<ID>/_favicon/?pageUrl=<URL>&size=<SIZE>
 */
export function faviconUrl(domain: string, size = 32): string {
  if (!domain) return '';
  const url = `https://${domain}`;
  // chrome.runtime.id will resolve correctly when running as an extension
  return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=${size}`;
}
