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
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setPendingCount(0);
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
          setPendingCount(snapshot.size);
          setLoading(false);
          setError(null);
        } catch (err) {
          console.error('[PendingAppointmentsProvider] Error parsing snapshot callback:', err);
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
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
    pendingAppointments: [],
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
