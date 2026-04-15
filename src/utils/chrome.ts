import { OpenTab, DeferredItem, PinnedLink } from '../types';

// ---- Fetch all open tabs ----
export async function fetchOpenTabs(): Promise<OpenTab[]> {
  try {
    const extensionId = chrome.runtime.id;
    const newtabUrl = `chrome-extension://${extensionId}/index.html`;
    const tabs = await chrome.tabs.query({});
    return tabs.map(t => ({
      id: t.id!,
      url: t.url || '',
      title: t.title || '',
      windowId: t.windowId,
      active: t.active,
      isTabOut: t.url === newtabUrl || t.url === 'chrome://newtab/',
    }));
  } catch {
    return [];
  }
}

// ---- Filter out browser-internal pages ----
export function getRealTabs(tabs: OpenTab[]): OpenTab[] {
  return tabs.filter(t => {
    const url = t.url || '';
    return (
      !url.startsWith('chrome://') &&
      !url.startsWith('chrome-extension://') &&
      !url.startsWith('about:') &&
      !url.startsWith('edge://') &&
      !url.startsWith('brave://')
    );
  });
}

// ---- Focus a tab by URL ----
export async function focusTab(url: string) {
  if (!url) return;
  const allTabs = await chrome.tabs.query({});
  const currentWindow = await chrome.windows.getCurrent();

  let matches = allTabs.filter(t => t.url === url);
  if (matches.length === 0) {
    try {
      const targetHost = new URL(url).hostname;
      matches = allTabs.filter(t => {
        try { return new URL(t.url!).hostname === targetHost; }
        catch { return false; }
      });
    } catch {}
  }
  if (matches.length === 0) return;

  const match = matches.find(t => t.windowId !== currentWindow.id) || matches[0];
  await chrome.tabs.update(match.id!, { active: true });
  await chrome.windows.update(match.windowId, { focused: true });
}

// ---- Close tabs ----
export async function closeTabsExact(urls: string[]) {
  if (!urls.length) return;
  const urlSet = new Set(urls);
  const allTabs = await chrome.tabs.query({});
  const toClose = allTabs.filter(t => urlSet.has(t.url!)).map(t => t.id!);
  if (toClose.length) await chrome.tabs.remove(toClose);
}

export async function closeTabsByUrls(urls: string[]) {
  if (!urls.length) return;
  const targetHostnames: string[] = [];
  const exactUrls = new Set<string>();
  for (const u of urls) {
    if (u.startsWith('file://')) exactUrls.add(u);
    else try { targetHostnames.push(new URL(u).hostname); } catch {}
  }
  const allTabs = await chrome.tabs.query({});
  const toClose = allTabs.filter(tab => {
    const tabUrl = tab.url || '';
    if (tabUrl.startsWith('file://') && exactUrls.has(tabUrl)) return true;
    try {
      const tabHostname = new URL(tabUrl).hostname;
      return tabHostname && targetHostnames.includes(tabHostname);
    } catch { return false; }
  }).map(t => t.id!);
  if (toClose.length) await chrome.tabs.remove(toClose);
}

export async function closeDuplicateTabs(urls: string[], keepOne = true) {
  const allTabs = await chrome.tabs.query({});
  const toClose: number[] = [];
  for (const url of urls) {
    const matching = allTabs.filter(t => t.url === url);
    if (keepOne) {
      const keep = matching.find(t => t.active) || matching[0];
      for (const tab of matching) { if (tab.id !== keep.id) toClose.push(tab.id!); }
    } else {
      for (const tab of matching) toClose.push(tab.id!);
    }
  }
  if (toClose.length) await chrome.tabs.remove(toClose);
}

export async function closeTabOutDupes() {
  const extensionId = chrome.runtime.id;
  const newtabUrl = `chrome-extension://${extensionId}/index.html`;
  const allTabs = await chrome.tabs.query({});
  const currentWindow = await chrome.windows.getCurrent();
  const tabOutTabs = allTabs.filter(t => t.url === newtabUrl || t.url === 'chrome://newtab/');
  if (tabOutTabs.length <= 1) return;
  const keep = tabOutTabs.find(t => t.active && t.windowId === currentWindow.id) || tabOutTabs.find(t => t.active) || tabOutTabs[0];
  const toClose = tabOutTabs.filter(t => t.id !== keep.id).map(t => t.id!);
  if (toClose.length) await chrome.tabs.remove(toClose);
}

// ---- Saved for Later ----
export async function getSavedTabs(): Promise<{ active: DeferredItem[]; archived: DeferredItem[] }> {
  const { deferred = [] } = await chrome.storage.local.get('deferred');
  const visible = deferred.filter((t: DeferredItem) => !t.dismissed);
  return {
    active: visible.filter((t: DeferredItem) => !t.completed),
    archived: visible.filter((t: DeferredItem) => t.completed),
  };
}

export async function saveTabForLater(tab: { url: string; title: string }) {
  const { deferred = [] } = await chrome.storage.local.get('deferred');
  deferred.push({
    id: Date.now().toString(),
    url: tab.url,
    title: tab.title,
    savedAt: new Date().toISOString(),
    completed: false,
    dismissed: false,
  });
  await chrome.storage.local.set({ deferred });
}

export async function checkOffSavedTab(id: string) {
  const { deferred = [] } = await chrome.storage.local.get('deferred');
  const tab = deferred.find((t: DeferredItem) => t.id === id);
  if (tab) {
    tab.completed = true;
    tab.completedAt = new Date().toISOString();
    await chrome.storage.local.set({ deferred });
  }
}

export async function dismissSavedTab(id: string) {
  const { deferred = [] } = await chrome.storage.local.get('deferred');
  const tab = deferred.find((t: DeferredItem) => t.id === id);
  if (tab) {
    tab.dismissed = true;
    await chrome.storage.local.set({ deferred });
  }
}

// ---- Pinned Links ----
export const DEFAULT_PINNED_LINKS: PinnedLink[] = [
  { label: 'GitHub', url: 'https://github.com' },
  { label: 'OpenClaw Docs', url: 'https://docs.openclaw.ai' },
  { label: '火山方舟', url: 'https://ark.volcengine.com' },
  { label: '公众号后台', url: 'https://mp.weixin.qq.com' },
  { label: 'X', url: 'https://x.com' },
  { label: 'Notion', url: 'https://notion.so' },
];

export async function getPinnedLinks(): Promise<PinnedLink[]> {
  const { pinnedLinks } = await chrome.storage.local.get('pinnedLinks');
  if (pinnedLinks && pinnedLinks.length > 0) return pinnedLinks;
  await chrome.storage.local.set({ pinnedLinks: DEFAULT_PINNED_LINKS });
  return DEFAULT_PINNED_LINKS;
}

export async function savePinnedLinks(links: PinnedLink[]) {
  await chrome.storage.local.set({ pinnedLinks: links });
}
