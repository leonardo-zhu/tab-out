import { useState } from 'react';
import { DeferredItem } from '../types';
import { ICONS } from '../constants';
import { faviconUrl } from '../utils/favicon';
import { timeAgo } from '../utils/helpers';
import { checkOffSavedTab, dismissSavedTab } from '../utils/chrome';

interface SavedForLaterProps {
  active: DeferredItem[];
  archived: DeferredItem[];
  loadData: () => void;
  showToast: (msg: string) => void;
}

export function SavedForLater({ active, archived, loadData, showToast }: SavedForLaterProps) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveSearch, setArchiveSearch] = useState('');

  const handleCheck = async (id: string) => {
    await checkOffSavedTab(id);
    showToast('Checked off');
    loadData();
  };

  const handleDismiss = async (id: string) => {
    await dismissSavedTab(id);
    loadData();
  };

  const searchTarget = (archiveSearch || '').toLowerCase();
  const filteredArchive =  archived.filter(item => {
      if (!searchTarget) return true;

      const titleMatch = (item.title || '').toLowerCase().includes(searchTarget);
      const urlMatch = (item.url || '').toLowerCase().includes(searchTarget);

      return titleMatch || urlMatch;
    });

  return (
    <div className="deferred-column" style={{ width: 300, flexShrink: 0 }}>
      <div className="section-header">
        <h2>Saved for later</h2>
        <div className="section-line"></div>
        <div className="section-count">{active.length} item{active.length !== 1 ? 's' : ''}</div>
      </div>

      {active.length > 0 ? (
        <div className="deferred-list">
          {active.map(item => (
            <div key={item.id} className="deferred-item">
              <input type="checkbox" className="deferred-checkbox" onChange={() => handleCheck(item.id)} />
              <div className="deferred-info">
                <a href={item.url} target="_blank" rel="noopener" className="deferred-title" title={item.title}>
                  <img src={faviconUrl(new URL(item.url).hostname.replace(/^www\./, ''))} alt=""
                       style={{ width: 14, height: 14, verticalAlign: -2, marginRight: 4 }}
                       onError={e => (e.target as HTMLImageElement).style.display = 'none'}/>
                  {item.title || item.url}
                </a>
                <div className="deferred-meta">
                  <span>{(() => {
                    try {
                      return new URL(item.url).hostname.replace(/^www\./, '');
                    } catch {
                      return '';
                    }
                  })()}</span>
                  <span>{timeAgo(item.savedAt)}</span>
                </div>
              </div>
              <button className="deferred-dismiss" onClick={() => handleDismiss(item.id)} title="Dismiss">
                {ICONS.close}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="deferred-empty">Nothing saved. Living in the moment.</div>
      )}

      {archived.length > 0 && (
        <div className="deferred-archive">
          <button className={`archive-toggle ${archiveOpen ? 'open' : ''}`} onClick={() => setArchiveOpen(!archiveOpen)}>
            <div className="archive-chevron">{ICONS.chevron}</div>
            Archive <span className="archive-count">({archived.length})</span>
          </button>
          {archiveOpen && (

            <div className="archive-body">
              <input
                type="text"
                className="archive-search"
                placeholder="Search archived tabs..."
                value={archiveSearch}
                onChange={e => setArchiveSearch(e.target.value)}
              />
              <div className="archive-list">
                {filteredArchive.map(item => (
                  <div key={item.id} className="archive-item">
                    <a href={item.url} target="_blank" rel="noopener" className="archive-item-title"
                       title={item.title}>{item.title || item.url}</a>
                    <span
                      className="archive-item-date">{item.completedAt ? timeAgo(item.completedAt) : timeAgo(item.savedAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
