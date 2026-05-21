import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

export function useFirstVisitTip(pageKey: string) {
  const [showTip, setShowTip] = useState(false);
  const { profile, user } = useAuth();
  
  // To avoid layout shift or double checking, we check both local and profile state
  useEffect(() => {
    // If not loaded profile yet, let's wait or fallback to localStorage
    const hasLocal = localStorage.getItem(`tip_${pageKey}`);
    const hasProfile = profile?.dismissedTips?.[`tip_${pageKey}`];

    if (hasProfile || hasLocal === 'true') {
      setShowTip(false);
    } else {
      setShowTip(true);
    }
  }, [pageKey, profile?.dismissedTips]);

  const dismissTip = async () => {
    setShowTip(false);
    localStorage.setItem(`tip_${pageKey}`, 'true');
    
    if (user?.uid) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          [`dismissedTips.tip_${pageKey}`]: true
        });
      } catch (err) {
        console.error("Failed to dismiss tip on profile", err);
      }
    }
  };

  return { showTip, dismissTip };
}
