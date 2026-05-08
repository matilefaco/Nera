import React, { createContext, useContext } from 'react';
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
  // Isolation mode: intentionally inert to verify whether this global listener is the crash trigger.
  const value = {
    pendingAppointments: [],
    pendingCount: 0,
    loading: false,
    error: null,
  };

  return (
    <PendingAppointmentsContext.Provider value={value}>
      {children}
    </PendingAppointmentsContext.Provider>
  );
};
