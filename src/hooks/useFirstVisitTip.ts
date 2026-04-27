import { useState, useEffect } from 'react';

export function useFirstVisitTip(pageKey: string) {
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    const hasBeenVisited = localStorage.getItem(`tip_${pageKey}`);
    if (hasBeenVisited === null) {
      setShowTip(true);
    }
  }, [pageKey]);

  const dismissTip = () => {
    localStorage.setItem(`tip_${pageKey}`, 'true');
    setShowTip(false);
  };

  return { showTip, dismissTip };
}
