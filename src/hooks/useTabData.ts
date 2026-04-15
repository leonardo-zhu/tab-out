import { useState, useEffect, useCallback } from 'react';
import { OpenTab, DomainGroup, DeferredItem, PinnedLink } from '../types';
import { fetchOpenTabs, getSavedTabs, getPinnedLinks, getPinnedDomains, savePinnedLinks, savePinnedDomains, getRealTabs } from '../utils/chrome';
import { isLandingPage } from '../utils/helpers';

export function useTabData() {
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [domainGroups, setDomainGroups] = useState<DomainGroup[]>([]);
  const [savedTabs, setSavedTabs] = useState<{ active: DeferredItem[]; archived: DeferredItem[] }>({ active: [], archived: [] });
  const [pinnedLinks, setPinnedLinks] = useState<PinnedLink[]>([]);
  const [pinnedDomains, setPinnedDomains] = useState<string[]>([]);

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

    const pinned = await getPinnedDomains();
    setPinnedDomains(pinned);

    const groups = Object.values(groupMap).sort((a, b) => {
      const aL = a.domain === '__landing-pages__';
      const bL = b.domain === '__landing-pages__';
      if (aL !== bL) return aL ? -1 : 1;

      const aPinned = pinned.includes(a.domain);
      const bPinned = pinned.includes(b.domain);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;

      return b.tabs.length - a.tabs.length;
    });

    setDomainGroups(groups);
    setSavedTabs(await getSavedTabs());
    setPinnedLinks(await getPinnedLinks());
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const updatePinnedLinks = async (links: PinnedLink[]) => {
    setPinnedLinks(links);
    await savePinnedLinks(links);
  };

  const updatePinnedDomains = async (domains: string[]) => {
    setPinnedDomains(domains);
    await savePinnedDomains(domains);
    loadData();
  };

  return {
    openTabs,
    domainGroups,
    savedTabs,
    pinnedLinks,
    pinnedDomains,
    loadData,
    updatePinnedLinks,
    updatePinnedDomains,
  };
}
