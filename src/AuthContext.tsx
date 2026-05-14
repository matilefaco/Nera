import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { UserProfile } from './types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAuthReady: boolean;
  refreshProfile: () => Promise<UserProfile | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAuthReady: false,
  refreshProfile: async () => null,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const refreshProfile = async () => {
    if (!auth.currentUser) return null;
    const { getDoc } = await import('firebase/firestore');
    const docRef = doc(db, 'users', auth.currentUser.uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      setProfile(data);
      return data;
    }
    return null;
  };

  useEffect(() => {
    if (user && profile && !profile.referralCode) {
      // Prevent infinite loop if updateDoc fails and reverts state constantly
      const key = `referral_attempt_${user.uid}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, 'true');

      const code = user.uid.slice(0, 8).toUpperCase();
      updateDoc(doc(db, 'users', user.uid), { referralCode: code })
        .catch(err => console.error('[AuthContext] Error saving referralCode:', err));
    }
  }, [user, profile]);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    // Safety timeout to prevent infinite loading
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn('[AuthContext] Safety timeout reached. Forcing loading to false.');
        setLoading(false);
        setIsAuthReady(true);
      }
    }, 5000);

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      console.log('[Auth] onAuthStateChanged user uid / null:', currentUser?.uid || 'null');
      setUser(currentUser);
      setIsAuthReady(true);
      console.log('[Auth] isAuthReady true');
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (currentUser) {
        // User is logged in, release global loading immediately to let App load
        setLoading(false);
        clearTimeout(safetyTimeout);
        
        const docRef = doc(db, 'users', currentUser.uid);
        
        // Use onSnapshot for real-time updates without blocking
        unsubscribeProfile = onSnapshot(docRef, (docSnap) => {
          try {
            console.log('[AuthContext] Profile snapshot received. Exists:', docSnap.exists());
            if (docSnap.exists()) {
              const data = docSnap.data() as UserProfile;
              setProfile({ ...data, uid: docSnap.id });
            } else {
              setProfile(null);
            }
          } catch (err) {
            console.error("Error in onSnapshot callback:", err);
          }
        }, (error) => {
          console.error("[AuthContext] Error listening to profile:", error);
        });
      } else {
        setProfile(null);
        setLoading(false);
        clearTimeout(safetyTimeout);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      clearTimeout(safetyTimeout);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAuthReady, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
