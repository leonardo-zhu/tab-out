import { useState } from 'react';
import { DomainGroup, OpenTab } from '../types';
import { ICONS } from './Icons.tsx';
import { friendlyDomain, cleanTitle, smartTitle, stripTitleNoise } from '../utils/helpers';
import { faviconUrl } from '../utils/favicon';
import { focusTab, closeTabsExact, closeTabsByUrls, closeDuplicateTabs, saveTabForLater } from '../utils/chrome';
import { playCloseSound } from '../utils/effects';

interface MissionCardProps {
  group: DomainGroup;
  closing: boolean;
  pinned: boolean;
  loadData: () => void;
  showToast: (msg: string) => void;
  updatePinnedDomains: (domains: string[]) => Promise<void>;
  pinnedDomains: string[];
}

export function MissionCard({
                              group,
                              closing: closingProp,
                              pinned,
                              loadData,
                              showToast,
                              updatePinnedDomains,
                              pinnedDomains
                            }: MissionCardProps) {
  const [isClosing, setIsClosing] = useState(false);
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
    if (!seen.has(tab.url)) {
      seen.add(tab.url);
      uniqueTabs.push(tab);
    }
  }

  const [expanded, setExpanded] = useState(false);
  const visibleTabs = expanded ? uniqueTabs : uniqueTabs.slice(0, 8);
  const extraCount = uniqueTabs.length - 8;

  const handleCloseSingle = async (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const allTabs = await chrome.tabs.query({});
    const match = allTabs.find(t => t.url === url);
    if (match) await chrome.tabs.remove(match.id!);
    playCloseSound();
    showToast('Tab closed');
    loadData();
  };

  const handleSave = async (url: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await saveTabForLater({ url, title });
    const allTabs = await chrome.tabs.query({});
    const match = allTabs.find(t => t.url === url);
    if (match) await chrome.tabs.remove(match.id!);
    showToast('Saved for later');
    loadData();
  };

  const handleCloseGroup = async () => {
    const urls = group.tabs.map(t => t.url);
    const useExact = group.domain === '__landing-pages__';

    setIsClosing(true);
    await Promise.all([
      useExact ? closeTabsExact(urls) : closeTabsByUrls(urls),
      new Promise(resolve => setTimeout(resolve, 300))
    ]);

    playCloseSound();
    setIsClosing(false);
    loadData();

    const label = group.domain === '__landing-pages__' ? 'Homepages' : (group.label || friendlyDomain(group.domain));
    showToast(`Closed ${urls.length} tab${urls.length !== 1 ? 's' : ''} from ${label}`);
  };

  const handleDedup = async () => {
    const urls = dupeUrls.map(([u]) => u);
    await closeDuplicateTabs(urls, true);
    playCloseSound();
    showToast('Closed duplicates, kept one copy each');
    loadData();
  };

  const handleTogglePin = async () => {
    const updated = pinnedDomains.includes(group.domain)
      ? pinnedDomains.filter(d => d !== group.domain)
      : [...pinnedDomains, group.domain];
    await updatePinnedDomains(updated);
  };

  const barClass = pinned ? 'has-active-bar' : hasDupes ? 'has-amber-bar' : 'has-neutral-bar';

  return (
    <div className={`mission-card domain-card ${barClass} ${isClosing || closingProp ? 'closing' : ''}`}>
      <div className="mission-content">
        <div className="mission-top">
          <span className="mission-name">{isLanding ? 'Homepages' : friendlyDomain(group.domain)}</span>
          <button className={`mission-pin-btn ${pinned ? 'pinned' : ''}`} onClick={(e) => {
            e.stopPropagation();
            handleTogglePin();
          }} title={pinned ? 'Unpin' : 'Pin to top'}>
            📌
          </button>
          <span className="open-tabs-badge">{ICONS.tabs} {tabCount} tab{tabCount !== 1 ? 's' : ''} open</span>
          {hasDupes && <span className="open-tabs-badge" style={{
            color: 'var(--accent-amber)',
            background: 'rgba(200,113,58,0.08)'
          }}>{totalExtras} duplicate{totalExtras !== 1 ? 's' : ''}</span>}
        </div>

        <div className="mission-pages">
          {visibleTabs.map(tab => {
            let label = cleanTitle(smartTitle(stripTitleNoise(tab.title || ''), tab.url), group.domain);
            try {
              const parsed = new URL(tab.url);
              if (parsed.hostname === 'localhost' && parsed.port) label = `${parsed.port} ${label}`;
            } catch {
            }
            const count = urlCounts[tab.url];
            let domain = '';
            try {
              domain = new URL(tab.url).hostname;
            } catch {
            }
            return (
              <div key={tab.url} className={`page-chip clickable ${count > 1 ? 'chip-has-dupes' : ''}`}
                   onClick={() => focusTab(tab.url)} title={label}>
                {domain && <img className="chip-favicon" src={faviconUrl(domain)} alt=""
                                onError={e => (e.target as HTMLImageElement).style.display = 'none'}/>}
                <span className="chip-text">{label}</span>
                {count > 1 && <span className="chip-dupe-badge">({count}x)</span>}
                <div className="chip-actions">
                  <button className="chip-action chip-save" onClick={e => handleSave(tab.url, label, e)}
                          title="Save for later">{ICONS.bookmark}</button>
                  <button className="chip-action chip-close" onClick={e => handleCloseSingle(tab.url, e)}
                          title="Close this tab">{ICONS.close}</button>
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
          <button className="action-btn close-tabs" onClick={handleCloseGroup}>
            {ICONS.close} Close all {tabCount} tab{tabCount !== 1 ? 's' : ''}
          </button>
          {hasDupes && (
            <button className="action-btn" onClick={handleDedup}>
              Close {totalExtras} duplicate{totalExtras !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
