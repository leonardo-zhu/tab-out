import { useState } from 'react';
import { PinnedLink } from '../types';
import { faviconUrl } from '../utils/favicon';
import { DEFAULT_PINNED_LINKS } from '../constants';

interface PinnedSectionProps {
  pinnedLinks: PinnedLink[];
  updatePinnedLinks: (links: PinnedLink[]) => Promise<void>;
  showToast: (msg: string) => void;
}

export function PinnedSection({ pinnedLinks, updatePinnedLinks, showToast }: PinnedSectionProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [addLabel, setAddLabel] = useState('');
  const [addUrl, setAddUrl] = useState('');

  const handleOpen = (url: string) => {
    chrome.tabs.create({ url, active: true });
  };

  const handleRemove = async (url: string) => {
    const filtered = pinnedLinks.filter(l => l.url !== url);
    await updatePinnedLinks(filtered);
  };

  const handleAdd = async () => {
    let cleanUrl = addUrl.trim();
    if (!addLabel.trim() || !cleanUrl) { showToast('Need both label and URL'); return; }
    if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = 'https://' + cleanUrl;
    if (pinnedLinks.some(l => l.url === cleanUrl)) { showToast('Already pinned'); return; }
    await updatePinnedLinks([...pinnedLinks, { label: addLabel, url: cleanUrl }]);
    setShowAddForm(false);
    setAddLabel('');
    setAddUrl('');
  };

  const handleReset = async () => {
    if (confirm('Reset all pinned links to defaults?')) {
      await updatePinnedLinks(DEFAULT_PINNED_LINKS);
      showToast('Pinned links reset to defaults');
    }
  };

  return (
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
              <span key={link.url} className="pinned-chip" onClick={() => handleOpen(link.url)}>
                {domain && <img className="chip-favicon" src={faviconUrl(domain)} alt="" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />}
                {link.label}
                <button className="pinned-remove" onClick={e => { e.stopPropagation(); handleRemove(link.url); }} title="Unpin">×</button>
              </span>
            );
          })}
        </div>
        {!showAddForm ? (
          <>
            <button className="pinned-add-btn" onClick={() => setShowAddForm(true)}>+</button>
            <button className="pinned-reset-btn" onClick={handleReset} title="Reset to defaults">↺</button>
          </>
        ) : (
          <div className="pinned-add-form">
            <input type="text" placeholder="Label" style={{ width: 90 }} value={addLabel} onChange={e => setAddLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setShowAddForm(false); }} autoFocus />
            <input type="url" placeholder="https://..." style={{ width: 200 }} value={addUrl} onChange={e => setAddUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setShowAddForm(false); }} />
            <button className="pinned-save-btn" onClick={handleAdd}>Add</button>
            <button className="pinned-cancel-btn" onClick={() => setShowAddForm(false)}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
