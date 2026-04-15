import { useState, useEffect, useCallback } from 'react';
import { OpenTab, DomainGroup, DeferredItem, PinnedLink } from './types';
import { fetchOpenTabs, getRealTabs, focusTab, closeTabsExact, closeTabsByUrls, closeDuplicateTabs, closeTabOutDupes as apiCloseTabOutDupes, getSavedTabs, saveTabForLater, checkOffSavedTab, dismissSavedTab, getPinnedLinks, savePinnedLinks, DEFAULT_PINNED_LINKS } from './utils/chrome';
import { friendlyDomain, stripTitleNoise, cleanTitle, smartTitle, getUserName, getPersonalizedGreeting, getDateDisplay, timeAgo } from './utils/helpers';
import { playCloseSound, shootConfetti } from './utils/effects';
import { faviconUrl } from './utils/favicon';
import './styles.css';

// ---- Landing page patterns ----
const LANDING_PAGE_PATTERNS = [
  { hostname: 'mail.google.com', test: (_p: string, h: string) => !h.includes('#inbox/') && !h.includes('#sent/') && !h.includes('#search/') },
  { hostname: 'x.com', pathExact: ['/home'] },
  { hostname: 'www.linkedin.com', pathExact: ['/'] },
  { hostname: 'github.com', pathExact: ['/'] },
  { hostname: 'www.youtube.com', pathExact: ['/'] },
];

function isLandingPage(url: string): boolean {
  try {
    const parsed = new URL(url);
    return LANDING_PAGE_PATTERNS.some(p => {
      if (parsed.hostname !== p.hostname) return false;
      if (p.test) return p.test(parsed.pathname, url);
      if (p.pathExact) return p.pathExact.includes(parsed.pathname);
      return parsed.pathname === '/';
    });
  } catch { return false; }
}

// ---- SVG Icons ----
const ICONS = {
  tabs: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8.25V18a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18V8.25m-18 0V6a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 6v2.25m-18 0h18" /></svg>,
  close: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>,
  bookmark: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" /></svg>,
  check: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>,
  chevron: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>,
  copy: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" /></svg>,
};

// ========================
// Main App
// ========================
export default function App() {
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [domainGroups, setDomainGroups] = useState<DomainGroup[]>([]);
  const [savedTabs, setSavedTabs] = useState<{ active: DeferredItem[]; archived: DeferredItem[] }>({ active: [], archived: [] });
  const [pinnedLinks, setPinnedLinks] = useState<PinnedLink[]>([]);
  const [toast, setToast] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addLabel, setAddLabel] = useState('');
  const [addUrl, setAddUrl] = useState('');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [closingCards, setClosingCards] = useState<Set<string>>(new Set());
  const [closingChips, setClosingChips] = useState<Set<string>>(new Set());
  const [userName, setUserName] = useState('');
  const [dateTime, setDateTime] = useState(getDateDisplay());

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }, []);

  // ---- Live clock ----
  useEffect(() => {
    const timer = setInterval(() => setDateTime(getDateDisplay()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ---- Fetch user name on mount ----
  useEffect(() => {
    getUserName().then(setUserName);
  }, []);

  // ---- Load all data ----
  const loadData = useCallback(async () => {
    const tabs = await fetchOpenTabs();
    setOpenTabs(tabs);

    const realTabs = getRealTabs(tabs);
    const groupMap: Record<string, DomainGroup> = {};
    const landingTabs: OpenTab[] = [];

    for (const tab of realTabs) {
      try {
        if (isLandingPage(tab.url)) { landingTabs.push(tab); continue; }
        let hostname: string;
        if (tab.url.startsWith('file://')) hostname = 'local-files';
        else hostname = new URL(tab.url).hostname;
        if (!hostname) continue;
        if (!groupMap[hostname]) groupMap[hostname] = { domain: hostname, tabs: [] };
        groupMap[hostname].tabs.push(tab);
      } catch {}
    }

    if (landingTabs.length > 0) {
      groupMap['__landing-pages__'] = { domain: '__landing-pages__', tabs: landingTabs };
    }

    const groups = Object.values(groupMap).sort((a, b) => {
      const aL = a.domain === '__landing-pages__';
      const bL = b.domain === '__landing-pages__';
      if (aL !== bL) return aL ? -1 : 1;
      return b.tabs.length - a.tabs.length;
    });

    setDomainGroups(groups);
    setSavedTabs(await getSavedTabs());
    setPinnedLinks(await getPinnedLinks());
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ---- Tab Out dupes ----
  const tabOutDupes = openTabs.filter(t => t.isTabOut);
  const hasDupeBanner = tabOutDupes.length > 1;

  // ---- Actions ----
  const handleCloseTabOutDupes = async () => {
    await apiCloseTabOutDupes();
    playCloseSound();
    showToast('Closed extra Tab Out tabs');
    loadData();
  };

  const handleOpenPinned = (url: string) => {
    chrome.tabs.create({ url, active: true });
  };

  const handleRemovePinned = async (url: string) => {
    const filtered = pinnedLinks.filter(l => l.url !== url);
    setPinnedLinks(filtered);
    await savePinnedLinks(filtered);
  };

  const handleAddPinned = async () => {
    const label = addLabel.trim();
    let url = addUrl.trim();
    if (!label || !url) { showToast('Need both label and URL'); return; }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    if (pinnedLinks.some(l => l.url === url)) { showToast('Already pinned'); return; }
    const updated = [...pinnedLinks, { label, url }];
    setPinnedLinks(updated);
    await savePinnedLinks(updated);
    setShowAddForm(false);
    setAddLabel('');
    setAddUrl('');
  };

  const handleFocusTab = (url: string) => focusTab(url);

  const handleCloseSingleTab = async (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const allTabs = await chrome.tabs.query({});
    const match = allTabs.find(t => t.url === url);
    if (match) await chrome.tabs.remove(match.id!);
    playCloseSound();
    showToast('Tab closed');
    loadData();
  };

  const handleSaveForLater = async (url: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await saveTabForLater({ url, title });
    const allTabs = await chrome.tabs.query({});
    const match = allTabs.find(t => t.url === url);
    if (match) await chrome.tabs.remove(match.id!);
    showToast('Saved for later');
    loadData();
  };

  const handleCloseDomainGroup = async (group: DomainGroup, cardKey: string) => {
    const urls = group.tabs.map(t => t.url);
    const useExact = group.domain === '__landing-pages__';
    if (useExact) await closeTabsExact(urls);
    else await closeTabsByUrls(urls);
    playCloseSound();
    setClosingCards(prev => new Set(prev).add(cardKey));
    setTimeout(() => {
      setClosingCards(prev => { const s = new Set(prev); s.delete(cardKey); return s; });
      loadData();
    }, 300);
    const label = group.domain === '__landing-pages__' ? 'Homepages' : (group.label || friendlyDomain(group.domain));
    showToast(`Closed ${urls.length} tab${urls.length !== 1 ? 's' : ''} from ${label}`);
  };

  const handleDedup = async (dupeUrls: [string, number][]) => {
    const urls = dupeUrls.map(([u]) => u);
    await closeDuplicateTabs(urls, true);
    playCloseSound();
    showToast('Closed duplicates, kept one copy each');
    loadData();
  };

  const handleCheckDeferred = async (id: string) => {
    await checkOffSavedTab(id);
    showToast('Checked off');
    loadData();
  };

  const handleDismissDeferred = async (id: string) => {
    await dismissSavedTab(id);
    loadData();
  };

  const handleCloseAllTabs = async () => {
    const allUrls = openTabs.filter(t => t.url && !t.url.startsWith('chrome') && !t.url.startsWith('about:')).map(t => t.url);
    await closeTabsByUrls(allUrls);
    playCloseSound();
    showToast('All tabs closed. Fresh start.');
    loadData();
  };

  // ---- Render ----
  const realTabs = getRealTabs(openTabs);
  const filteredArchive = savedTabs.archived.filter(item =>
    !archiveSearch || (item.title || '').toLowerCase().includes(archiveSearch) || (item.url || '').toLowerCase().includes(archiveSearch)
  );

  return (
    <div className="container">
      {/* Header */}
      <header>
        <div className="header-left">
          <h1>{getPersonalizedGreeting(userName)}</h1>
          <div className="date">{dateTime}</div>
        </div>
      </header>

      {/* Tab Out Dupes Banner */}
      {hasDupeBanner && (
        <div className="tab-cleanup-banner">
          <div className="tab-cleanup-left">
            <div className="tab-cleanup-icon">{ICONS.copy}</div>
            <div className="tab-cleanup-text">
              You have <strong>{tabOutDupes.length}</strong> Tab Out tabs open. Keep just this one?
            </div>
          </div>
          <button className="tab-cleanup-btn" onClick={handleCloseTabOutDupes}>Close extras</button>
        </div>
      )}

      {/* Pinned Section */}
      <div className="pinned-section">
        <div className="section-header">
          <h2>Pinned</h2>
          <div className="section-line"></div>
          <div className="section-count">{pinnedLinks.length} link{pinnedLinks.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="pinned-bar">
          <div className="pinned-chips">
            {pinnedLinks.map(link => {
              let domain = '';
              try { domain = new URL(link.url).hostname; } catch {}
              return (
                <span key={link.url} className="pinned-chip" onClick={() => handleOpenPinned(link.url)}>
                  {domain && <img className="chip-favicon" src={faviconUrl(domain)} alt="" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />}
                  {link.label}
                  <button className="pinned-remove" onClick={e => { e.stopPropagation(); handleRemovePinned(link.url); }} title="Unpin">×</button>
                </span>
              );
            })}
          </div>
          {!showAddForm ? (
            <button className="pinned-add-btn" onClick={() => setShowAddForm(true)}>+</button>
          ) : (
            <div className="pinned-add-form">
              <input type="text" placeholder="Label" style={{ width: 90 }} value={addLabel} onChange={e => setAddLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddPinned(); if (e.key === 'Escape') setShowAddForm(false); }} autoFocus />
              <input type="url" placeholder="https://..." style={{ width: 200 }} value={addUrl} onChange={e => setAddUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddPinned(); if (e.key === 'Escape') setShowAddForm(false); }} />
              <button className="pinned-save-btn" onClick={handleAddPinned}>Add</button>
              <button className="pinned-cancel-btn" onClick={() => setShowAddForm(false)}>Cancel</button>
            </div>
          )}
        </div>
      </div>

      {/* Dashboard Columns */}
      <div className="dashboard-columns" style={{ display: 'flex', gap: 32 }}>
        {/* Open Tabs */}
        <div className="active-section" style={{ flex: 1, minWidth: 0 }}>
          {domainGroups.length > 0 && (
            <>
              <div className="section-header">
                <h2>Open tabs</h2>
                <div className="section-line"></div>
                <div className="section-count">
                  {domainGroups.length} domain{domainGroups.length !== 1 ? 's' : ''} &nbsp;·&nbsp;
                  <button className="action-btn close-tabs" onClick={handleCloseAllTabs} style={{ fontSize: 11, padding: '3px 10px' }}>
                    {ICONS.close} Close all {realTabs.length} tabs
                  </button>
                </div>
              </div>
              <div className="missions">
                {domainGroups.map(group => (
                  <MissionCard key={group.domain} group={group} closing={closingCards.has(group.domain)} onFocus={handleFocusTab} onCloseSingle={handleCloseSingleTab} onSave={handleSaveForLater} onCloseGroup={g => handleCloseDomainGroup(g, g.domain)} onDedup={handleDedup} />
                ))}
              </div>
            </>
          )}
          {domainGroups.length === 0 && (
            <div className="missions-empty-state">
              <div className="empty-checkmark">{ICONS.check}</div>
              <div className="empty-title">Inbox zero, but for tabs.</div>
              <div className="empty-subtitle">You're free.</div>
            </div>
          )}
        </div>

        {/* Saved for Later */}
        {(savedTabs.active.length > 0 || savedTabs.archived.length > 0) && (
          <div className="deferred-column" style={{ width: 300, flexShrink: 0 }}>
            <div className="section-header">
              <h2>Saved for later</h2>
              <div className="section-line"></div>
              <div className="section-count">{savedTabs.active.length} item{savedTabs.active.length !== 1 ? 's' : ''}</div>
            </div>

            {savedTabs.active.length > 0 ? (
              <div className="deferred-list">
                {savedTabs.active.map(item => (
                  <div key={item.id} className="deferred-item">
                    <input type="checkbox" className="deferred-checkbox" onChange={() => handleCheckDeferred(item.id)} />
                    <div className="deferred-info">
                      <a href={item.url} target="_blank" rel="noopener" className="deferred-title" title={item.title}>
                        <img src={faviconUrl(new URL(item.url).hostname.replace(/^www\./, ''))} alt="" style={{ width: 14, height: 14, verticalAlign: -2, marginRight: 4 }} onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
                        {item.title || item.url}
                      </a>
                      <div className="deferred-meta">
                        <span>{(() => { try { return new URL(item.url).hostname.replace(/^www\./, ''); } catch { return ''; } })()}</span>
                        <span>{timeAgo(item.savedAt)}</span>
                      </div>
                    </div>
                    <button className="deferred-dismiss" onClick={() => handleDismissDeferred(item.id)} title="Dismiss">
                      {ICONS.close}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="deferred-empty">Nothing saved. Living in the moment.</div>
            )}

            {savedTabs.archived.length > 0 && (
              <div className="deferred-archive">
                <button className={`archive-toggle ${archiveOpen ? 'open' : ''}`} onClick={() => setArchiveOpen(!archiveOpen)}>
                  <svg className="archive-chevron" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                  Archive <span className="archive-count">({savedTabs.archived.length})</span>
                </button>
                {archiveOpen && (
                  <div className="archive-body">
                    <input type="text" className="archive-search" placeholder="Search archived tabs..." value={archiveSearch} onChange={e => setArchiveSearch(e.target.value.toLowerCase())} />
                    <div className="archive-list">
                      {filteredArchive.map(item => (
                        <div key={item.id} className="archive-item">
                          <a href={item.url} target="_blank" rel="noopener" className="archive-item-title" title={item.title}>{item.title || item.url}</a>
                          <span className="archive-item-date">{item.completedAt ? timeAgo(item.completedAt) : timeAgo(item.savedAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer>
        <div className="footer-stats">
          <div className="stat">
            <div className="stat-num">{openTabs.length}</div>
            <div className="stat-label">Open tabs</div>
          </div>
        </div>
        <div className="last-refresh">
          <span style={{ color: 'var(--muted)', fontSize: 11 }}>Tab Out by Leonardo</span>
        </div>
      </footer>

      {/* Toast */}
      <div className={`toast ${toast ? 'visible' : ''}`}>
        {ICONS.check}
        <span>{toast}</span>
      </div>
    </div>
  );
}

// ========================
// MissionCard Component
// ========================
interface MissionCardProps {
  group: DomainGroup;
  closing: boolean;
  onFocus: (url: string) => void;
  onCloseSingle: (url: string, e: React.MouseEvent) => void;
  onSave: (url: string, title: string, e: React.MouseEvent) => void;
  onCloseGroup: (group: DomainGroup) => void;
  onDedup: (dupeUrls: [string, number][]) => void;
}

function MissionCard({ group, closing, onFocus, onCloseSingle, onSave, onCloseGroup, onDedup }: MissionCardProps) {
  const tabs = group.tabs;
  const tabCount = tabs.length;
  const isLanding = group.domain === '__landing-pages__';

  // Count duplicates
  const urlCounts: Record<string, number> = {};
  for (const tab of tabs) urlCounts[tab.url] = (urlCounts[tab.url] || 0) + 1;
  const dupeUrls = Object.entries(urlCounts).filter(([, c]) => c > 1) as [string, number][];
  const hasDupes = dupeUrls.length > 0;
  const totalExtras = dupeUrls.reduce((s, [, c]) => s + c - 1, 0);

  // Deduplicate for display
  const seen = new Set<string>();
  const uniqueTabs: OpenTab[] = [];
  for (const tab of tabs) {
    if (!seen.has(tab.url)) { seen.add(tab.url); uniqueTabs.push(tab); }
  }

  const [expanded, setExpanded] = useState(false);
  const visibleTabs = expanded ? uniqueTabs : uniqueTabs.slice(0, 8);
  const extraCount = uniqueTabs.length - 8;

  const barClass = hasDupes ? 'has-amber-bar' : 'has-neutral-bar';

  return (
    <div className={`mission-card domain-card ${barClass} ${closing ? 'closing' : ''}`}>
      <div className="mission-content">
        <div className="mission-top">
          <span className="mission-name">{isLanding ? 'Homepages' : friendlyDomain(group.domain)}</span>
          <span className="open-tabs-badge">{ICONS.tabs} {tabCount} tab{tabCount !== 1 ? 's' : ''} open</span>
          {hasDupes && <span className="open-tabs-badge" style={{ color: 'var(--accent-amber)', background: 'rgba(200,113,58,0.08)' }}>{totalExtras} duplicate{totalExtras !== 1 ? 's' : ''}</span>}
        </div>

        <div className="mission-pages">
          {visibleTabs.map(tab => {
            let label = cleanTitle(smartTitle(stripTitleNoise(tab.title || ''), tab.url), group.domain);
            try {
              const parsed = new URL(tab.url);
              if (parsed.hostname === 'localhost' && parsed.port) label = `${parsed.port} ${label}`;
            } catch {}
            const count = urlCounts[tab.url];
            let domain = '';
            try { domain = new URL(tab.url).hostname; } catch {}
            return (
              <div key={tab.url} className={`page-chip clickable ${count > 1 ? 'chip-has-dupes' : ''}`} onClick={() => onFocus(tab.url)} title={label}>
                {domain && <img className="chip-favicon" src={faviconUrl(domain)} alt="" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />}
                <span className="chip-text">{label}</span>
                {count > 1 && <span className="chip-dupe-badge">({count}x)</span>}
                <div className="chip-actions">
                  <button className="chip-action chip-save" onClick={e => onSave(tab.url, label, e)} title="Save for later">{ICONS.bookmark}</button>
                  <button className="chip-action chip-close" onClick={e => onCloseSingle(tab.url, e)} title="Close this tab">{ICONS.close}</button>
                </div>
              </div>
            );
          })}

          {!expanded && extraCount > 0 && (
            <div className="page-chip page-chip-overflow clickable" onClick={() => setExpanded(true)}>
              <span className="chip-text">+{extraCount} more</span>
            </div>
          )}
        </div>

        <div className="actions">
          <button className="action-btn close-tabs" onClick={() => onCloseGroup(group)}>
            {ICONS.close} Close all {tabCount} tab{tabCount !== 1 ? 's' : ''}
          </button>
          {hasDupes && (
            <button className="action-btn" onClick={() => onDedup(dupeUrls)}>
              Close {totalExtras} duplicate{totalExtras !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
