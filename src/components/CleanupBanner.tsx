import { ICONS } from '../constants';
import { closeTabOutDupes as apiCloseTabOutDupes } from '../utils/chrome';
import { playCloseSound } from '../utils/effects';

interface CleanupBannerProps {
  count: number;
  loadData: () => void;
  showToast: (msg: string) => void;
}

export function CleanupBanner({ count, loadData, showToast }: CleanupBannerProps) {
  if (count <= 1) return null;

  const handleClose = async () => {
    await apiCloseTabOutDupes();
    playCloseSound();
    showToast('Closed extra Tab Out tabs');
    loadData();
  };

  return (
    <div className="tab-cleanup-banner">
      <div className="tab-cleanup-left">
        <div className="tab-cleanup-icon">{ICONS.copy}</div>
        <div className="tab-cleanup-text">
          You have <strong>{count}</strong> Tab Out tabs open. Keep just this one?
        </div>
      </div>
      <button className="tab-cleanup-btn" onClick={handleClose}>Close extras</button>
    </div>
  );
}
