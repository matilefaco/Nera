import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';
import { UserProfile } from './types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null | undefined;
  loading: boolean;
  isAuthReady: boolean;
  refreshProfile: () => Promise<UserProfile | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: undefined,
  loading: true,
  isAuthReady: false,
  refreshProfile: async () => null,
});

const isDev = import.meta.env.DEV || (typeof window !== 'undefined' && window.location.hostname.includes('ais-'));
const devLog = (...args: any[]) => isDev && console.log(...args);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const refreshProfile = async () => {
    if (!auth.currentUser) return null;
    try {
      const { getDoc } = await import('firebase/firestore');
      const docRef = doc(db, 'users', auth.currentUser.uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        setProfile(data);
        return data;
      }
    } catch (err) {
      if (isDev) console.error('[AuthContext] Error refreshing profile:', err);
    }
    return null;
  };

  useEffect(() => {
    if (user && profile && !profile.referralCode) {
      // Prevent infinite loop if updateDoc fails and reverts state constantly
      const key = `referral_attempt_${user.uid}`;
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, 'true');
      } catch (e) {
        if (isDev) console.warn('[AuthContext] sessionStorage blocked in this sandbox:', e);
      }

      const code = user.uid.slice(0, 8).toUpperCase();
      updateDoc(doc(db, 'users', user.uid), { referralCode: code })
        .catch(err => { if (isDev) console.error('[AuthContext] Error saving referralCode:', err); });
    }
  }, [user, profile]);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    // Safety timeout to prevent infinite loading
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        if (isDev) console.warn('[AuthContext] Safety timeout reached. Forcing loading to false.');
        setLoading(false);
        setIsAuthReady(true);
      }
    }, 5000);

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      try {
        devLog('[Auth] onAuthStateChanged user uid / null:', currentUser?.uid || 'null');
        setUser(currentUser);
        setIsAuthReady(true);
        
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }

        if (currentUser) {
          setLoading(true);
          const docRef = doc(db, 'users', currentUser.uid);
          
          let isFirstSnapshot = true;

          // Attempt an immediate getDoc fetch for ultra-fast, robust initial state
          getDoc(docRef).then((docSnap) => {
            if (isFirstSnapshot) {
              devLog('[AuthContext] Initial getDoc profile fetched. Exists:', docSnap.exists());
              if (docSnap.exists()) {
                const data = docSnap.data() as UserProfile;
                setProfile({ ...data, uid: docSnap.id });
              } else {
                setProfile(null);
              }
              setLoading(false);
              clearTimeout(safetyTimeout);
            }
          }).catch((err) => {
            if (isDev) console.error("[AuthContext] Error on initial getDoc profile fetch:", err);
          });

          // Use onSnapshot for real-time updates in the background
          unsubscribeProfile = onSnapshot(docRef, (docSnap) => {
            try {
              devLog('[AuthContext] Profile snapshot received. Exists:', docSnap.exists());
              if (docSnap.exists()) {
                const data = docSnap.data() as UserProfile;
                setProfile({ ...data, uid: docSnap.id });
              } else {
                setProfile(null);
              }
            } catch (err) {
              if (isDev) console.error("Error in onSnapshot callback:", err);
            } finally {
              if (isFirstSnapshot) {
                setLoading(false);
                clearTimeout(safetyTimeout);
                isFirstSnapshot = false;
              }
            }
          }, (error) => {
            if (isDev) console.error("[AuthContext] Error listening to profile:", error);
            if (isFirstSnapshot) {
              setLoading(false);
              clearTimeout(safetyTimeout);
              isFirstSnapshot = false;
            }
          });
        } else {
          setProfile(undefined);
          setLoading(false);
          clearTimeout(safetyTimeout);
        }
      } catch (err) {
        if (isDev) console.error('[AuthContext] Error in onAuthStateChanged handler:', err);
        setLoading(false);
        setIsAuthReady(true);
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
