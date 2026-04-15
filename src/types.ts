// ---- Chrome Tab (what we get from chrome.tabs.query) ----
export interface OpenTab {
  id: number;
  url: string;
  title: string;
  windowId: number;
  active: boolean;
  isTabOut: boolean;
}

// ---- Domain group (tabs grouped by hostname) ----
export interface DomainGroup {
  domain: string;
  label?: string;
  tabs: OpenTab[];
}

// ---- Saved for later item ----
export interface DeferredItem {
  id: string;
  url: string;
  title: string;
  savedAt: string;
  completed: boolean;
  completedAt?: string;
  dismissed: boolean;
}

// ---- Pinned link ----
export interface PinnedLink {
  label: string;
  url: string;
}
