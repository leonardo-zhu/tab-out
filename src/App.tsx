import { useState, useCallback } from 'react';
import { closeTabsByUrls, getRealTabs } from './utils/chrome';
import { playCloseSound } from './utils/effects';
import { Greeting } from './components/Greeting';
import { CleanupBanner } from './components/CleanupBanner';
import { PinnedSection } from './components/PinnedSection';
import { MissionCard } from './components/MissionCard';
import { SavedForLater } from './components/SavedForLater';
import { Toast } from './components/Toast';
import { ICONS } from './constants';
import { useTabData } from './hooks/useTabData';
import './styles.css';

export default function App() {
  const { openTabs, domainGroups, savedTabs, pinnedLinks, pinnedDomains, loadData, updatePinnedLinks, updatePinnedDomains } = useTabData();
  const [toast, setToast] = useState('');
  const [closingCards, setClosingCards] = useState<Set<string>>(new Set());

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }, []);

  const tabOutDupes = openTabs.filter(t => t.isTabOut);

  const handleCloseAllTabs = async () => {
    const allUrls = openTabs.filter(t => t.url && !t.url.startsWith('chrome') && !t.url.startsWith('about:')).map(t => t.url);
    await closeTabsByUrls(allUrls);
    playCloseSound();
    showToast('All tabs closed. Fresh start.');
    loadData();
  };

  const realTabs = getRealTabs(openTabs);

  return (
    <div className="container">
      <Greeting />

      <CleanupBanner count={tabOutDupes.length} loadData={loadData} showToast={showToast} />

      <PinnedSection pinnedLinks={pinnedLinks} updatePinnedLinks={updatePinnedLinks} showToast={showToast} />

      <div className="dashboard-columns" style={{ display: 'flex', gap: 32 }}>
        <div className="active-section" style={{ flex: 1, minWidth: 0 }}>
          {domainGroups.length > 0 ? (
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
                  <MissionCard key={group.domain} group={group} closing={closingCards.has(group.domain)} pinned={pinnedDomains.includes(group.domain)} loadData={loadData} showToast={showToast} updatePinnedDomains={updatePinnedDomains} pinnedDomains={pinnedDomains} />
                ))}
              </div>
            </>
          ) : (
            <div className="missions-empty-state">
              <div className="empty-checkmark">{ICONS.check}</div>
              <div className="empty-title">Inbox zero, but for tabs.</div>
              <div className="empty-subtitle">You're free.</div>
            </div>
          )}
        </div>

        <SavedForLater active={savedTabs.active} archived={savedTabs.archived} loadData={loadData} showToast={showToast} />
      </div>

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

      <Toast message={toast} />
    </div>
  );
}
