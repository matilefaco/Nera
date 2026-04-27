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
      console.log('[AuthContext] Generating referralCode for user:', user.uid);
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
      console.log('[AuthContext] Auth state changed:', currentUser?.uid || 'null');
      setUser(currentUser);
      
      if (unsubscribeProfile) {
        console.log('[AuthContext] Unsubscribing from previous profile...');
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (currentUser) {
        console.log('[AuthContext] Starting profile snapshot for:', currentUser.uid);
        const docRef = doc(db, 'users', currentUser.uid);
        
        // Use onSnapshot for real-time updates
        unsubscribeProfile = onSnapshot(docRef, (docSnap) => {
          console.log('[AuthContext] Profile snapshot received. Exists:', docSnap.exists());
          if (docSnap.exists()) {
            setProfile(docSnap.data());
          } else {
            console.log('[AuthContext] Profile document does not exist yet.');
            setProfile(null);
          }
          setLoading(false);
          setIsAuthReady(true);
          clearTimeout(safetyTimeout);
        }, (error) => {
          console.error("[AuthContext] Error listening to profile:", error);
          setLoading(false);
          setIsAuthReady(true);
          clearTimeout(safetyTimeout);
        });
      } else {
        console.log('[AuthContext] No user, setting loading to false.');
        setProfile(null);
        setLoading(false);
        setIsAuthReady(true);
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
