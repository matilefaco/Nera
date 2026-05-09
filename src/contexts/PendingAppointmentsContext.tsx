import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { Appointment } from '../types';

interface PendingAppointmentsContextData {
  pendingAppointments: Appointment[];
  pendingCount: number;
  loading: boolean;
  error: Error | null;
}

const PendingAppointmentsContext = createContext<PendingAppointmentsContextData>({
  pendingAppointments: [],
  pendingCount: 0,
  loading: true,
  error: null,
});

export const usePendingAppointments = () => useContext(PendingAppointmentsContext);

export const PendingAppointmentsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [pendingAppointments, setPendingAppointments] = useState<Appointment[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setPendingAppointments([]);
      setLoading(false);
      return;
    }

    const qPending = query(
      collection(db, 'appointments'),
      where('professionalId', '==', user.uid),
      where('status', '==', 'pending'),
      orderBy('date', 'asc'),
      orderBy('time', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      qPending,
      (snapshot) => {
        try {
          // Just save count, avoid keeping large payload in global state memory to prevent sync crashes
          setPendingAppointments([]); 
          setLoading(false);
          setError(null);
          // Only maintain the counts for tabs/badges. 
          // Real data will be fetched locally in PendingRequestsPage.
          setPendingCount(snapshot.size); 
        } catch (err) {
          console.error('[PendingAppointmentsProvider] Error parsing snapshot callback:', err);
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      },
      (error) => {
        console.error('[PendingAppointmentsProvider] Firestore onSnapshot error:', error);
        setError(error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const value = {
    pendingAppointments,
    pendingCount,
    loading,
    error,
  };

  return (
    <PendingAppointmentsContext.Provider value={value}>
      {children}
    </PendingAppointmentsContext.Provider>
  );
};
