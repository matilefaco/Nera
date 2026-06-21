import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '../AuthContext';
import { usePlanFeatures } from './usePlanFeatures';
import { Appointment } from '../types';

export type UpgradeFeature = 'unlimitedBookings' | 'whatsappNotifications' | 'advancedDashboard' | 'waitlist' | 'antiNoShow' | 'coupons' | 'analytics' | 'reports' | 'exportCsv' | 'crm' | 'referrals';

export function useUpgradeTriggers(appointments: Appointment[] = []) {
  const { profile } = useAuth();
  const { plan, features } = usePlanFeatures();
  const [isOpen, setIsOpen] = useState(false);
  const [feature, setFeature] = useState<UpgradeFeature>('unlimitedBookings');

  const usageCount = useMemo(() => {
    const currentMonthAppts = appointments.filter(a => {
      const d = new Date(a.date + 'T12:00:00');
      const now = new Date();
      return (
        d.getMonth() === now.getMonth() && 
        d.getFullYear() === now.getFullYear() &&
        ['confirmed', 'completed', 'accepted'].includes(a.status)
      );
    });
    return currentMonthAppts.length;
  }, [appointments]);

  const checkFeatureAccess = useCallback((requestedFeature: UpgradeFeature) => {
    if (features[requestedFeature]) return true;
    
    setFeature(requestedFeature);
    setIsOpen(true);
    return false;
  }, [features]);

  const closeUpgradeModal = () => setIsOpen(false);

  return {
    isUpgradeModalOpen: isOpen,
    upgradeFeature: feature,
    usageCount,
    checkFeatureAccess,
    closeUpgradeModal,
    openUpgradeModal: (f: UpgradeFeature = 'unlimitedBookings') => {
      setFeature(f);
      setIsOpen(true);
    }
  };
}
